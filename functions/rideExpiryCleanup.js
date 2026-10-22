const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

const db = admin.firestore();
const PAGE_SIZE = 100;

function holdRef(tripId, groupId, seat) {
    const id = `${encodeURIComponent(tripId)}__${encodeURIComponent(groupId)}__${Number(seat)}`;
    return db.collection("rideSeatHolds").doc(id);
}

async function expireBooking(ref) {
    return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) return false;

        const b = snap.data();
        if (
            b.status !== "PENDING_PAYMENT" ||
            b.paymentStatus !== "UNPAID" ||
            b.requestType !== "SCHEDULED_TRIP" ||
            (b.paymentMethod !== null && b.paymentMethod !== undefined)
        ) return false;

        const expiry = b.seatHoldExpiresAt;
        if (!expiry || typeof expiry.toMillis !== "function" ||
            expiry.toMillis() > Date.now()) return false;

        const tripId = String(b.tripId || "").trim();
        const groupId = String(b.groupId || "DEFAULT").trim();
        const seats = Array.isArray(b.assignedSeatNumbers)
            ? [...new Set(b.assignedSeatNumbers.map(Number))]
            : [];

        if (!tripId || !groupId || !seats.length ||
            seats.some(n => !Number.isInteger(n) || n < 1)) return false;

        const holds = [];
        for (const seat of seats) {
            const hold = holdRef(tripId, groupId, seat);
            holds.push({ hold, seat, snap: await tx.get(hold) });
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.update(ref, {
            status: "EXPIRED",
            paymentStatus: "UNPAID",
            expirationReason: "SEAT_HOLD_EXPIRED",
            expiredAt: now,
            updatedAt: now
        });

        for (const h of holds) {
            if (!h.snap.exists) continue;
            const d = h.snap.data();
            if (
                d.status === "HELD" &&
                d.bookingId === ref.id &&
                d.userId === b.userId &&
                String(d.tripId || "") === tripId &&
                String(d.groupId || "") === groupId &&
                Number(d.seatNumber) === h.seat
            ) tx.delete(h.hold);
        }
        return true;
    });
}

exports.cleanupExpiredScheduledRideBookings = onSchedule(
    { schedule: "every 5 minutes", timeoutSeconds: 540, memory: "256MiB" },
    async () => {
        let cursor = null;
        const cutoff = admin.firestore.Timestamp.fromMillis(Date.now());
        const counts = { scanned: 0, expired: 0, skipped: 0, failed: 0 };

        while (true) {
            let q = db.collection("rideBookings")
                .where("status", "==", "PENDING_PAYMENT")
                .where("paymentStatus", "==", "UNPAID")
                .where("requestType", "==", "SCHEDULED_TRIP")
                .where("seatHoldExpiresAt", "<=", cutoff)
                .orderBy("seatHoldExpiresAt", "asc")
                .orderBy(admin.firestore.FieldPath.documentId(), "asc")
                .limit(PAGE_SIZE);
            if (cursor) q = q.startAfter(cursor);

            const page = await q.get();
            if (page.empty) break;
            cursor = page.docs[page.docs.length - 1];
            counts.scanned += page.size;

            for (const doc of page.docs) {
                try {
                    if (await expireBooking(doc.ref)) counts.expired++;
                    else counts.skipped++;
                } catch (err) {
                    counts.failed++;
                    console.error("Ride expiry cleanup failed:", doc.id, err);
                }
            }
            if (page.size < PAGE_SIZE) break;
        }
        console.log("Scheduled ride expiry cleanup finished:", counts);
    }
);
