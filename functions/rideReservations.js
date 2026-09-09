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
