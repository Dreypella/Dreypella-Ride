const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

async function requireAdmin(context) {

    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in."
        );
    }

    const adminUid =
        context.auth.uid;

    const userSnap =
        await db
            .collection("users")
            .doc(adminUid)
            .get();

    if (!userSnap.exists) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Admin access is required."
        );
    }

    const userData =
        userSnap.data();

    if (
        userData.role !== "ADMIN" &&
        userData.role !== "SUPER_ADMIN"
    ) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Admin access is required."
        );
    }

    return {
        uid: adminUid,
        ...userData
    };
}

/*
    =========================================
    START RIDE TRIP

    AVAILABLE
        ↓
    ACTIVE

    Before the trip becomes ACTIVE:
    - expire unpaid Pay on Departure
      reservations
    - delete their temporary RESERVED
      seat holds
    - leave permanently booked seats
      untouched
    - activate the trip atomically
    =========================================
*/

exports.startRideTrip =
    functions.https.onCall(
        async (data, context) => {

            const adminUser =
                await requireAdmin(context);

            const tripId =
                String(
                    data?.tripId || ""
                ).trim();

            if (!tripId) {
                throw new functions.https.HttpsError(
                    "invalid-argument",
                    "A valid trip ID is required."
                );
            }

            const tripRef =
                db
                    .collection("trips")
                    .doc(tripId);

            try {

                const result =
                    await db.runTransaction(
                        async transaction => {

                            const tripSnap =
                                await transaction.get(
                                    tripRef
                                );

                            if (!tripSnap.exists) {
                                throw new functions.https.HttpsError(
                                    "not-found",
                                    "Ride trip not found."
                                );
                            }

                            const trip =
                                tripSnap.data();

                            if (
                                trip.status ===
                                "ACTIVE"
                            ) {
                                return {
                                    success: true,
                                    alreadyActive: true,
                                    expiredReservations: 0
                                };
                            }

                            if (
                                trip.status !==
                                "AVAILABLE"
                            ) {
                                throw new functions.https.HttpsError(
                                    "failed-precondition",
                                    "Only an available ride trip can be started."
                                );
                            }

                            const reservationSnapshot =
                                await transaction.get(
                                    db
                                        .collection("rideBookings")
                                        .where(
                                            "tripId",
                                            "==",
                                            tripId
                                        )
                                );

                            const reservations = [];

                            reservationSnapshot.forEach(
                                bookingDoc => {

                                    const booking =
                                        bookingDoc.data();

                                    if (
                                        booking.status ===
                                            "RESERVED" &&
                                        booking.paymentStatus ===
                                            "UNPAID" &&
                                        booking.paymentMethod ===
                                            "PAY_ON_DEPARTURE"
                                    ) {
                                        reservations.push({
                                            ref:
                                                bookingDoc.ref,
                                            booking
                                        });
                                    }

                                }
                            );

                            const holdRefs = [];

                            for (
                                const reservation
                                    of reservations
                            ) {

                                const booking =
                                    reservation.booking;

                                const groupId =
                                    String(
                                        booking.groupId ||
                                        "DEFAULT"
                                    ).trim();

                                const assignedSeats =
                                    Array.isArray(
                                        booking.assignedSeatNumbers
                                    )
                                        ? booking.assignedSeatNumbers
                                        : [];

                                for (
                                    const seatNumber
                                        of assignedSeats
                                ) {

                                    const holdRef =
                                        db
                                            .collection(
                                                "rideSeatHolds"
                                            )
                                            .doc(
                                                encodeURIComponent(
                                                    tripId
                                                ) +
                                                "__" +
                                                encodeURIComponent(
                                                    groupId
                                                ) +
                                                "__" +
                                                Number(
                                                    seatNumber
                                                )
                                            );

                                    holdRefs.push(
                                        holdRef
                                    );

                                }

                            }

                            /*
                             * All reads are complete above.
                             * Writes begin only here.
                             */

                            const now =
                                admin.firestore
                                    .FieldValue
                                    .serverTimestamp();

                            for (
                                const reservation
                                    of reservations
                            ) {

                                transaction.update(
                                    reservation.ref,
                                    {
                                        status:
                                            "EXPIRED",
                                        paymentStatus:
                                            "UNPAID",
                                        expirationReason:
                                            "TRIP_STARTED",
                                        expiredAt:
                                            now,
                                        updatedAt:
                                            now
                                    }
                                );

                            }

                            for (
                                const holdRef
                                    of holdRefs
                            ) {

                                transaction.delete(
                                    holdRef
                                );

                            }

                            transaction.update(
                                tripRef,
                                {
                                    status:
                                        "ACTIVE",
                                    startedAt:
                                        now,
                                    startedBy:
                                        adminUser.uid,
                                    updatedAt:
                                        now
                                }
                            );

                            return {
                                success: true,
                                alreadyActive: false,
                                expiredReservations:
                                    reservations.length
                            };

                        }
                    );

                return result;

            }
            catch(error) {

                console.error(
                    "Start ride trip error:",
                    error
                );

                if (
                    error instanceof
                    functions.https.HttpsError
                ) {
                    throw error;
                }

                throw new functions.https.HttpsError(
                    "internal",
                    "Unable to start the ride trip."
                );

            }

        }
    );
