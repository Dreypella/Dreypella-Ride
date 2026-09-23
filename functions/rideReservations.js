const admin =
    require("firebase-admin");

const {
    db,
    money
} =
    require("./walletHelpers");


async function reserveRideForPayOnDeparture(
    data,
    context
) {

    if (!context.auth) {
        throw new Error(
            "You must be logged in."
        );
    }

    const uid =
        context.auth.uid;

    const bookingId =
        String(
            data?.bookingId ||
            ""
        ).trim();

    if (!bookingId) {
        throw new Error(
            "Ride booking ID is required."
        );
    }

    const bookingRef =
        db
            .collection("rideBookings")
            .doc(bookingId);

    const result =
        await db.runTransaction(
            async transaction => {

                const bookingSnapshot =
                    await transaction.get(
                        bookingRef
                    );

                if (
                    !bookingSnapshot.exists
                ) {
                    throw new Error(
                        "Ride booking not found."
                    );
                }

                const booking =
                    bookingSnapshot.data();


                const tripId =
                    String(
                        booking.tripId ||
                        ""
                    ).trim();

                if (!tripId) {
                    throw new Error(
                        "This ride booking is missing its trip."
                    );
                }

                const tripRef =
                    db
                        .collection("trips")
                        .doc(tripId);

                const tripSnapshot =
                    await transaction.get(
                        tripRef
                    );

                if (!tripSnapshot.exists) {
                    throw new Error(
                        "Ride trip not found."
                    );
                }

                const trip =
                    tripSnapshot.data();

                if (trip.status !== "AVAILABLE") {
                    throw new Error(
                        "This ride trip is no longer available for Pay on Departure."
                    );
                }

                const departureDate =
                    trip.departureTime &&
                    typeof trip.departureTime.toDate === "function"
                        ? trip.departureTime.toDate()
                        : new Date(
                            trip.departureTime || ""
                        );

                if (!Number.isFinite(departureDate.getTime())) {
                    throw new Error(
                        "This ride does not have a valid departure time."
                    );
                }

                if (departureDate.getTime() <= Date.now()) {
                    throw new Error(
                        "Pay on Departure is no longer available because this trip has reached its departure time."
                    );
                }
                const ownerId =
                    booking.userId ||
                    booking.customerId ||
                    null;

                if (
                    ownerId !== uid
                ) {
                    throw new Error(
                        "You cannot reserve this ride booking."
                    );
                }

                if (
                    booking.requestType !==
                    "SCHEDULED_TRIP"
                ) {
                    throw new Error(
                        "Pay on Departure is only available for scheduled trips."
                    );
                }

                const totalFare =
                    money(
                        booking.totalFare ||
                        0
                    );

                if (
                    totalFare <= 0
                ) {
                    throw new Error(
                        "This ride does not have a valid fare."
                    );
                }

                if (
                    booking.paymentStatus ===
                    "PAID"
                ) {
                    throw new Error(
                        "This ride has already been paid for."
                    );
                }

                if (
                    booking.status ===
                    "RESERVED" &&
                    booking.paymentMethod ===
                    "PAY_ON_DEPARTURE"
                ) {
                    return {
                        alreadyReserved:
                            true,
                        bookingId,
                        bookingReference:
                            booking.bookingReference ||
                            "",
                        amount:
                            totalFare,
                        status:
                            "RESERVED",
                        paymentStatus:
                            "UNPAID",
                        paymentMethod:
                            "PAY_ON_DEPARTURE"
                    };
                }

                if (
                    booking.status !==
                    "PENDING_PAYMENT"
                ) {
                    throw new Error(
                        "This ride is no longer available for payment selection."
                    );
                }

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

                const requestedSeats =
                    Number(
                        booking.seats ||
                        assignedSeats.length
                    );

                if (
                    requestedSeats < 1 ||
                    requestedSeats > 4 ||
                    assignedSeats.length !==
                        requestedSeats
                ) {
                    throw new Error(
                        "This ride booking has invalid seat information."
                    );
                }

                const uniqueSeats =
                    new Set(
                        assignedSeats.map(
                            Number
                        )
                    );

                if (
                    uniqueSeats.size !==
                    assignedSeats.length ||
                    [...uniqueSeats].some(
                        seat =>
                            !Number.isInteger(seat) ||
                            seat < 1
                    )
                ) {
                    throw new Error(
                        "This ride booking has invalid seat numbers."
                    );
                }

                const holdCollection =
                    db.collection("rideSeatHolds");

                const holdKeyPrefix =
                    encodeURIComponent(tripId) +
                    "__" +
                    encodeURIComponent(groupId);

                const holdRecords = [];

                for (
                    const seatNumber of uniqueSeats
                ) {
                    const holdRef =
                        holdCollection.doc(
                            holdKeyPrefix +
                            "__" +
                            seatNumber
                        );

                    const holdSnapshot =
                        await transaction.get(
                            holdRef
                        );

                    if (!holdSnapshot.exists) {
                        throw new Error(
                            "One or more seats are no longer held for this booking."
                        );
                    }

                    const hold =
                        holdSnapshot.data();

                    const expiresAt =
                        hold.expiresAt &&
                        typeof hold.expiresAt.toDate ===
                            "function"
                            ? hold.expiresAt.toDate()
                            : new Date(
                                hold.expiresAt ||
                                ""
                            );

                    if (
                        hold.status !== "HELD" ||
                        hold.bookingId !== bookingId ||
                        hold.userId !== uid ||
                        !Number.isFinite(
                            expiresAt.getTime()
                        ) ||
                        expiresAt.getTime() <= Date.now()
                    ) {
                        throw new Error(
                            "One or more seats are no longer available for Pay on Departure."
                        );
                    }

                    holdRecords.push({
                        ref: holdRef
                    });
                }

                const reservationExpiry =
                    admin.firestore.Timestamp.fromDate(
                        departureDate
                    );

                for (
                    const holdRecord of holdRecords
                ) {
                    transaction.update(
                        holdRecord.ref,
                        {
                            status:
                                "RESERVED",
                            expiresAt:
                                reservationExpiry,
                            updatedAt:
                                admin.firestore
                                    .FieldValue
                                    .serverTimestamp()
                        }
                    );
                }

                transaction.update(
                    bookingRef,
                    {
                        status:
                            "RESERVED",

                        paymentStatus:
                            "UNPAID",

                        paymentMethod:
                            "PAY_ON_DEPARTURE",

                        reservedAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp(),

                        updatedAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp()
                    }
                );

                return {
                    alreadyReserved:
                        false,
                    bookingId,
                    bookingReference:
                        booking.bookingReference ||
                        "",
                    amount:
                        totalFare,
                    status:
                        "RESERVED",
                    paymentStatus:
                        "UNPAID",
                    paymentMethod:
                        "PAY_ON_DEPARTURE"
                };
            }
        );

    return {
        success:
            true,
        ...result
    };
}


module.exports = {

    reserveRideForPayOnDeparture

};
