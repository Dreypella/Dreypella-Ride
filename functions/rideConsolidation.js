const admin =
    require("firebase-admin");

const { HttpsError } = require("firebase-functions/v2/https");

const db =
    admin.firestore();

const CONSOLIDATION_WINDOW_DAYS = 3;

function normalizeRideLocation(value) {
    const normalized =
        String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");

    const aliases = {
        "ogbomosho": "ogbomoso",
        "ogbomoso": "ogbomoso"
    };

    return aliases[normalized] || normalized;
}

function normalizeRideRoute(fromCity, toCity) {
    return (
        normalizeRideLocation(fromCity) +
        "->" +
        normalizeRideLocation(toCity)
    );
}

function parseDateOnly(value) {
    const text =
        String(value || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return null;
    }

    const date =
        new Date(text + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const [year, month, day] =
        text.split("-").map(Number);

    if (
        date.getFullYear() !== year ||
        date.getMonth() + 1 !== month ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function dateDifferenceInDays(firstDate, secondDate) {
    const millisecondsPerDay =
        24 * 60 * 60 * 1000;

    return Math.round(
        Math.abs(
            firstDate.getTime() -
            secondDate.getTime()
        ) / millisecondsPerDay
    );
}

function requireAuthenticatedUser(context) {
    if (!context || !context.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    return context.auth.uid;
}

async function respondToRideConsolidation(data, context) {
    const uid = requireAuthenticatedUser(context);
    const requestId = String(data?.requestId || "").trim();
    const response = String(data?.response || "").trim().toUpperCase();

    if (!requestId) {
        throw new HttpsError("invalid-argument", "Ride request is required.");
    }
    if (response !== "ACCEPTED" && response !== "DECLINED") {
        throw new HttpsError("invalid-argument", "Response must be ACCEPTED or DECLINED.");
    }

    const requestRef = db.collection("rideBookings").doc(requestId);

    return db.runTransaction(async transaction => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists) {
            throw new HttpsError("not-found", "Ride request no longer exists.");
        }

        const request = requestSnap.data();
        if (request.userId !== uid) {
            throw new HttpsError("permission-denied", "You are not authorized to respond to this ride consolidation.");
        }
        if (request.requestType !== "CUSTOM_REQUEST") {
            throw new HttpsError("failed-precondition", "This is not a custom ride request.");
        }
        if (request.consolidationStatus !== "PROPOSED") {
            throw new HttpsError("failed-precondition", "This consolidation proposal is no longer awaiting your response.");
        }

        const now = admin.firestore.Timestamp.now();

        if (response === "ACCEPTED") {
            transaction.update(requestRef, {
                consolidationStatus: "ACCEPTED",
                consolidationRespondedAt: now,
                consolidationAcceptedAt: now,
                consolidationAcceptedBy: uid
            });
            return { success: true, requestId, response };
        }

        // Read this customer's proposal notification before any transaction writes.
        const groupId = request.consolidationGroupId || null;
        const notificationRef = groupId
            ? db.collection("notifications").doc(groupId + "__" + requestId)
            : null;
        const notificationSnap = notificationRef
            ? await transaction.get(notificationRef)
            : null;

        // Declining removes only this customer; other members can still respond.
        transaction.update(requestRef, {
            consolidationStatus: "NONE",
            consolidationGroupId: null,
            proposedTripDate: null,
            proposedTripTime: null,
            consolidationRespondedAt: null,
            consolidationAcceptedAt: null,
            consolidationAcceptedBy: null,
            lastConsolidationResponse: "DECLINED"
        });

        if (notificationSnap && notificationSnap.exists) {
            transaction.update(notificationRef, { read: true });
        }

        return {
            success: true,
            requestId,
            response,
            consolidationDissolved: false
        };
    });
}

async function findConsolidationCandidates(
    data,
    context
) {
    const uid =
        requireAuthenticatedUser(context);

    const userSnap =
        await db
            .collection("users")
            .doc(uid)
            .get();

    if (!userSnap.exists) {
        throw new HttpsError("permission-denied", "Admin access is required.");
    }

    const user =
        userSnap.data();

    if (
        user.role !== "ADMIN" &&
        user.role !== "SUPER_ADMIN"
    ) {
        throw new HttpsError("permission-denied", "Admin access is required.");
    }

    const requestId =
        String(
            data?.requestId || ""
        ).trim();

    if (!requestId) {
        throw new HttpsError("invalid-argument", "Ride request is required.");
    }

    const requestSnap =
        await db
            .collection("rideBookings")
            .doc(requestId)
            .get();

    if (!requestSnap.exists) {
        throw new HttpsError("not-found", "Ride request no longer exists.");
    }

    const request =
        requestSnap.data();

    if (
        request.requestType !==
        "CUSTOM_REQUEST"
    ) {
        throw new HttpsError("failed-precondition", "This is not a custom ride request.");
    }

    if (
        request.status !==
        "REQUESTED"
    ) {
        throw new HttpsError("failed-precondition", "Only pending ride requests can be consolidated.");
    }

    if (request.tripId) {
        throw new HttpsError("failed-precondition", "This ride request is already assigned to a trip.");
    }

    if (
        request.consolidationStatus &&
        request.consolidationStatus !== "NONE"
    ) {
        throw new HttpsError("failed-precondition", "This ride request already has a consolidation status and cannot be used for a new consolidation search.");
    }

    const requestedDate =
        parseDateOnly(
            request.travelDate
        );

    if (!requestedDate) {
        throw new HttpsError("failed-precondition", "The request does not contain a valid travel date.");
    }

    const routeKey =
        request.routeKey ||
        normalizeRideRoute(
            request.fromCity ||
            request.from,
            request.toCity ||
            request.to
        );

    const snapshot =
        await db
            .collection("rideBookings")
            .where(
                "requestType",
                "==",
                "CUSTOM_REQUEST"
            )
            .where(
                "status",
                "==",
                "REQUESTED"
            )
            .get();

    const candidates =
        snapshot.docs
            .filter(doc => {
                if (doc.id === requestId) {
                    return true;
                }

                const candidate =
                    doc.data();

                if (candidate.tripId) {
                    return false;
                }

                if (
                    candidate.consolidationStatus &&
                    candidate.consolidationStatus !== "NONE"
                ) {
                    return false;
                }

                const candidateRoute =
                    candidate.routeKey ||
                    normalizeRideRoute(
                        candidate.fromCity ||
                        candidate.from,
                        candidate.toCity ||
                        candidate.to
                    );

                if (
                    candidateRoute !==
                    routeKey
                ) {
                    return false;
                }

                const candidateDate =
                    parseDateOnly(
                        candidate.travelDate
                    );

                if (!candidateDate) {
                    return false;
                }

                return (
                    dateDifferenceInDays(
                        requestedDate,
                        candidateDate
                    ) <=
                    CONSOLIDATION_WINDOW_DAYS
                );
            })
            .map(doc => ({
                requestId:
                    doc.id,
                ...doc.data()
            }));

    return {
        success: true,
        windowDays:
            CONSOLIDATION_WINDOW_DAYS,
        routeKey,
        candidates
    };
}


async function proposeRideConsolidation(
    data,
    context
) {
    const uid = requireAuthenticatedUser(context);

    const userSnap = await db.collection("users").doc(uid).get();

    if (
        !userSnap.exists ||
        !["ADMIN", "SUPER_ADMIN"].includes(userSnap.data().role)
    ) {
        throw new HttpsError("permission-denied", "Admin access is required.");
    }

    const requestIds = Array.isArray(data?.requestIds)
        ? data.requestIds.map(id => String(id || "").trim()).filter(Boolean)
        : [];

    const proposedTripDate = String(data?.proposedTripDate || "").trim();
    const proposedTripTime = String(data?.proposedTripTime || "").trim();

    if (requestIds.length < 2) {
        throw new HttpsError("invalid-argument", "Select at least two ride requests for consolidation.");
    }

    if (requestIds.length > 100) {
        throw new HttpsError("invalid-argument", "Too many ride requests were selected.");
    }

    const proposedDate = parseDateOnly(proposedTripDate);

    if (!proposedDate) {
        throw new HttpsError("invalid-argument", "A valid proposed travel date is required.");
    }

    if (
        proposedTripTime &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(proposedTripTime)
    ) {
        throw new HttpsError("invalid-argument", "The proposed departure time must use HH:MM format.");
    }

    const uniqueRequestIds = [...new Set(requestIds)];
    const requestRefs = uniqueRequestIds.map(
        requestId => db.collection("rideBookings").doc(requestId)
    );

    const consolidationGroupId =
        "RC-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 8).toUpperCase();

    const result = await db.runTransaction(async transaction => {
        /*
         * Read and validate every request inside the transaction.
         * Concurrent proposals touching the same request conflict;
         * Firestore retries, then the stale proposal is rejected.
         * Complete all reads before scheduling any writes.
         */
        const requestSnaps = [];

        for (const requestRef of requestRefs) {
            requestSnaps.push(await transaction.get(requestRef));
        }

        const requests = [];

        for (let index = 0; index < requestSnaps.length; index++) {
            const snapshot = requestSnaps[index];

            if (!snapshot.exists) {
                throw new HttpsError("not-found", "One or more selected ride requests no longer exist.");
            }

            const request = snapshot.data();

            if (request.requestType !== "CUSTOM_REQUEST") {
                throw new HttpsError("failed-precondition", "Only custom ride requests can be consolidated.");
            }

            if (request.status !== "REQUESTED") {
                throw new HttpsError("failed-precondition", "One or more selected ride requests are no longer pending.");
            }

            if (request.tripId) {
                throw new HttpsError("failed-precondition", "An already-assigned ride request cannot be consolidated.");
            }

            if (
                request.consolidationStatus &&
                request.consolidationStatus !== "NONE"
            ) {
                throw new HttpsError("failed-precondition", "One or more selected ride requests already has a consolidation status and cannot be added to another consolidation group.");
            }

            if (!request.userId) {
                throw new HttpsError("failed-precondition", "A selected ride request has no associated customer.");
            }

            const requestedDate = parseDateOnly(request.travelDate);

            if (!requestedDate) {
                throw new HttpsError("failed-precondition", "Every selected ride request must have a valid travel date.");
            }

            const routeKey =
                request.routeKey ||
                normalizeRideRoute(
                    request.fromCity || request.from,
                    request.toCity || request.to
                );

            if (index > 0 && routeKey !== requests[0].routeKey) {
                throw new HttpsError("failed-precondition", "All selected ride requests must have the same route.");
            }

            if (
                requests.some(item =>
                    dateDifferenceInDays(item.requestedDate, requestedDate) >
                    CONSOLIDATION_WINDOW_DAYS
                )
            ) {
                throw new HttpsError("failed-precondition", "Selected ride requests must have requested travel dates within the 3-day consolidation window.");
            }

            if (
                dateDifferenceInDays(proposedDate, requestedDate) >
                CONSOLIDATION_WINDOW_DAYS
            ) {
                throw new HttpsError("failed-precondition", "The proposed date must be within the 3-day consolidation window for every selected request.");
            }

            requests.push({
                requestId: snapshot.id,
                request,
                routeKey,
                requestedDate
            });
        }

        const now = admin.firestore.Timestamp.now();

        for (const item of requests) {
            transaction.update(
                db.collection("rideBookings").doc(item.requestId),
                {
                    consolidationStatus: "PROPOSED",
                    consolidationGroupId,
                    proposedTripDate,
                    proposedTripTime: proposedTripTime || null,
                    proposedAt: now,
                    proposedBy: uid,
                    consolidationRespondedAt: null
                }
            );

            const notificationId =
                consolidationGroupId + "__" + item.requestId;

            transaction.set(
                db.collection("notifications").doc(notificationId),
                {
                    userId: item.request.userId,
                    type: "RIDE_CONSOLIDATION_PROPOSED",
                    title: "Ride Consolidation Proposal",
                    message:
                        "Dreypella has proposed a shared trip for your requested route on " +
                        proposedTripDate +
                        (proposedTripTime ? " at " + proposedTripTime : "") +
                        ". Review the proposal and accept or decline it.",
                    requestId: item.requestId,
                    consolidationGroupId,
                    routeKey: item.routeKey,
                    proposedTripDate,
                    proposedTripTime: proposedTripTime || null,
                    read: false,
                    createdAt: now
                }
            );
        }

        return {
            routeKey: requests[0].routeKey,
            requestIds: uniqueRequestIds
        };
    });

    return {
        success: true,
        consolidationGroupId,
        routeKey: result.routeKey,
        requestIds: result.requestIds,
        proposedTripDate,
        proposedTripTime: proposedTripTime || null
    };
}

module.exports = {
    findConsolidationCandidates,
    respondToRideConsolidation,
    proposeRideConsolidation,
    CONSOLIDATION_WINDOW_DAYS
};
