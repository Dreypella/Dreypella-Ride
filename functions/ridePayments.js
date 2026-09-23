const admin =
    require("firebase-admin");

const {
    db,
    money,
    generateTransactionReference
} =
    require("./walletHelpers");

const {
    paystackRequest
} =
    require("./paystack");



/*
    =========================================
    INITIALIZE RIDE PAYMENT
    =========================================
*/

async function initializeRidePayment(
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

    const bookingSnapshot =
        await bookingRef.get();

    if (!bookingSnapshot.exists) {
        throw new Error(
            "Ride booking was not found."
        );
    }

    const booking =
        bookingSnapshot.data();

    if (
        booking.userId !== uid
    ) {
        throw new Error(
            "You cannot pay for this ride."
        );
    }

    const amount =
        money(
            booking.totalFare
        );

    if (
        amount <= 0
    ) {
        throw new Error(
            "This ride does not have a valid fare for online payment."
        );
    }

    if (
        booking.paymentStatus ===
        "PAID"
    ) {
        throw new Error(
            "This ride has already been paid."
        );
    }

    const isPayOnDepartureReservation =
        booking.status ===
        "RESERVED" &&
        booking.paymentMethod ===
        "PAY_ON_DEPARTURE";

    if (
        booking.status !==
        "PENDING_PAYMENT" &&
        !isPayOnDepartureReservation
    ) {
        throw new Error(
            "This ride is not currently available for online payment."
        );
    }

    const reference =
        generateTransactionReference(
            "DR-RIDE"
        );

    const amountKobo =
        Math.round(
            amount * 100
        );

    const paymentRef =
        db
            .collection("ridePayments")
            .doc(reference);

    let email =
        context.auth.token?.email ||
        "";

    if (!email) {

        const userSnapshot =
            await db
                .collection("users")
                .doc(uid)
                .get();

        email =
            userSnapshot.exists
                ? String(
                    userSnapshot.data()?.email ||
                    ""
                ).trim()
                : "";
    }

    if (!email) {
        throw new Error(
            "A verified account email is required for payment."
        );
    }

    await paymentRef.create({

        userId:
            uid,

        bookingId:
            bookingId,

        reference:
            reference,

        amount:
            amount,

        amountKobo:
            amountKobo,

        currency:
            "NGN",

        status:
            "PENDING",

        email:
            email,

        authorizationUrl:
            null,

        accessCode:
            null,

        paystackTransactionId:
            null,

        paystackStatus:
            null,

        createdAt:
            admin.firestore
                .FieldValue
                .serverTimestamp(),

        updatedAt:
            admin.firestore
                .FieldValue
                .serverTimestamp()

    });

    try {

        const result =
            await paystackRequest(
                "/transaction/initialize",
                {
                    method:
                        "POST",

                    body: {

                        email:
                            email,

                        amount:
                            amountKobo,

                        currency:
                            "NGN",

                        reference:
                            reference,

                        callback_url:
                            "https://dreypella.github.io/Dreypella-Ride/ride-payment-success.html",

                        metadata: {

                            userId:
                                uid,

                            bookingId:
                                bookingId,

                            type:
                                "RIDE_PAYMENT"

                        }

                    }
                }
            );

        const authorizationUrl =
            result.data?.authorization_url;

        const accessCode =
            result.data?.access_code;

        if (
            !authorizationUrl
        ) {
            throw new Error(
                "Paystack did not return a payment authorization URL."
            );
        }

        await paymentRef.update({

            authorizationUrl:
                authorizationUrl,

            accessCode:
                accessCode ||
                null,

            updatedAt:
                admin.firestore
                    .FieldValue
                    .serverTimestamp()

        });

        return {

            success:
                true,

            reference:
                reference,

            bookingId:
                bookingId,

            amount:
                amount,

            authorizationUrl:
                authorizationUrl

        };

    }
    catch(error) {

        await paymentRef.update({

            status:
                "FAILED",

            failureReason:
                error.message ||
                "Payment initialization failed.",

            updatedAt:
                admin.firestore
                    .FieldValue
                    .serverTimestamp()

        });

        throw error;
    }
}



/*
    =========================================
    VERIFY RIDE PAYMENT
    =========================================
*/




async function verifyRidePayment(
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

    const reference =
        String(
            data?.reference ||
            ""
        ).trim();

    if (!reference) {
        throw new Error(
            "Payment reference is required."
        );
    }

    const paymentRef =
        db
            .collection("ridePayments")
            .doc(reference);

    const paymentSnapshot =
        await paymentRef.get();

    if (!paymentSnapshot.exists) {
        throw new Error(
            "Ride payment record was not found."
        );
    }

    const payment =
        paymentSnapshot.data();

    if (
        payment.userId !== uid
    ) {
        throw new Error(
            "You cannot verify this payment."
        );
    }

    if (
        payment.status ===
        "COMPLETED"
    ) {

        return {

            success:
                true,

            alreadyProcessed:
                true,

            reference:
                reference,

            bookingId:
                payment.bookingId,

            amount:
                money(
                    payment.amount
                ),

            status:
                "COMPLETED"

        };
    }

    if (
        payment.status ===
        "FAILED"
    ) {
        throw new Error(
            "This payment attempt has already failed."
        );
    }

    const result =
        await paystackRequest(
            `/transaction/verify/${encodeURIComponent(reference)}`
        );

    const transaction =
        result.data;

    if (
        !transaction ||
        transaction.status !==
            "success"
    ) {
        throw new Error(
            "Paystack has not confirmed this payment."
        );
    }

    if (
        String(
            transaction.reference ||
            ""
        ) !== reference
    ) {
        throw new Error(
            "Payment reference does not match."
        );
    }

    if (
        String(
            transaction.currency ||
            ""
        ).toUpperCase() !==
        "NGN"
    ) {
        throw new Error(
            "Payment currency does not match."
        );
    }

    const expectedAmountKobo =
        Math.round(
            money(
                payment.amount
            ) * 100
        );

    const paidAmountKobo =
        Number(
            transaction.amount
        );

    if (
        !Number.isFinite(
            paidAmountKobo
        ) ||
        paidAmountKobo !==
            expectedAmountKobo
    ) {
        throw new Error(
            "Payment amount does not match the ride fare."
        );
    }

    const bookingId =
        String(
            payment.bookingId ||
            ""
        ).trim();

    if (!bookingId) {
        throw new Error(
            "Ride booking ID is missing from the payment record."
        );
    }

    const bookingRef =
        db
            .collection("rideBookings")
            .doc(bookingId);

    const transactionResult =
        await db.runTransaction(
            async transactionRunner => {

                const currentPaymentSnapshot =
                    await transactionRunner.get(
                        paymentRef
                    );

                const bookingSnapshot =
                    await transactionRunner.get(
                        bookingRef
                    );

                if (
                    !currentPaymentSnapshot.exists
                ) {
                    throw new Error(
                        "Ride payment record was not found."
                    );
                }

                if (
                    !bookingSnapshot.exists
                ) {
                    throw new Error(
                        "Ride booking was not found."
                    );
                }

                const currentPayment =
                    currentPaymentSnapshot.data();

                const booking =
                    bookingSnapshot.data();

                if (
                    currentPayment.userId !==
                    uid
                ) {
                    throw new Error(
                        "You cannot complete this payment."
                    );
                }

                if (
                    booking.userId !==
                    uid
                ) {
                    throw new Error(
                        "You cannot complete payment for this ride."
                    );
                }

                if (
                    currentPayment.status ===
                    "COMPLETED"
                ) {
                    return {

                        alreadyProcessed:
                            true

                    };
                }

                const authoritativeAmount =
                    money(
                        booking.totalFare
                    );

                if (
                    authoritativeAmount <=
                    0
                ) {
                    throw new Error(
                        "The ride fare is no longer valid."
                    );
                }

                if (
                    authoritativeAmount !==
                    money(
                        currentPayment.amount
                    )
                ) {
                    throw new Error(
                        "Ride fare does not match the payment record."
                    );
                }

                if (
                    booking.paymentStatus ===
                    "PAID"
                ) {

                    transactionRunner.update(
                        paymentRef,
                        {

                            status:
                                "COMPLETED",

                            paystackTransactionId:
                                transaction.id ||
                                null,

                            paystackStatus:
                                transaction.status,

                            paymentChannel:
                                transaction.channel ||
                                null,

                            paidAt:
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

                        alreadyProcessed:
                            true

                    };
                }

                const isPayOnDepartureReservation =
                    booking.status ===
                    "RESERVED" &&
                    booking.paymentMethod ===
                    "PAY_ON_DEPARTURE";

                if (
                    booking.status !==
                    "PENDING_PAYMENT" &&
                    !isPayOnDepartureReservation
                ) {
                    throw new Error(
                        "This ride booking is no longer awaiting payment."
                    );
                }

                const tripId =
                    String(
                        booking.tripId ||
                        ""
                    ).trim();

                const groupId =
                    String(
                        booking.groupId ||
                        ""
                    ).trim();

                const assignedSeatNumbers =
                    Array.isArray(
                        booking.assignedSeatNumbers
                    )
                        ? booking.assignedSeatNumbers
                            .map(
                                seat =>
                                    Number(seat)
                            )
                            .filter(
                                Number.isInteger
                            )
                        : [];

                const requestedSeats =
                    Number(
                        booking.seats
                    );

                if (
                    !tripId ||
                    !groupId ||
                    !Number.isInteger(
                        requestedSeats
                    ) ||
                    requestedSeats < 1 ||
                    requestedSeats > 4 ||
                    assignedSeatNumbers.length !==
                        requestedSeats ||
                    new Set(
                        assignedSeatNumbers
                    ).size !==
                        assignedSeatNumbers.length
                ) {
                    throw new Error(
                        "Ride booking seat information is invalid."
                    );
                }

                const tripRef =
                    db
                        .collection("trips")
                        .doc(tripId);

                const tripSnapshot =
                    await transactionRunner.get(
                        tripRef
                    );

                if (
                    !tripSnapshot.exists
                ) {
                    throw new Error(
                        "The scheduled trip was not found."
                    );
                }

                const trip =
                    tripSnapshot.data();

                if (
                    isPayOnDepartureReservation
                ) {
                    if (
                        trip.status !==
                        "AVAILABLE"
                    ) {
                        throw new Error(
                            "This Pay on Departure reservation can no longer be paid because the trip has started."
                        );
                    }

                    const departureDate =
                        trip.departureTime &&
                        typeof trip.departureTime.toDate ===
                            "function"
                            ? trip.departureTime.toDate()
                            : new Date(
                                trip.departureTime ||
                                ""
                            );

                    if (
                        !Number.isFinite(
                            departureDate.getTime()
                        ) ||
                        departureDate.getTime() <=
                            Date.now()
                    ) {
                        throw new Error(
                            "This Pay on Departure reservation can no longer be paid because the trip has reached its departure time."
                        );
                    }
                }

                const groups =
                    Array.isArray(
                        trip.groups
                    )
                        ? trip.groups
                        : [];

                const groupIndex =
                    groups.findIndex(
                        group =>
                            String(
                                group?.groupId ||
                                ""
                            ) === groupId
                    );

                if (
                    groupIndex < 0
                ) {
                    throw new Error(
                        "The selected ride group was not found."
                    );
                }

                const selectedGroup =
                    groups[groupIndex];

                const capacity =
                    Number(
                        selectedGroup.capacity
                    );

                if (
                    !Number.isInteger(
                        capacity
                    ) ||
                    capacity <= 0
                ) {
                    throw new Error(
                        "The selected ride group has an invalid capacity."
                    );
                }

                const rawBookedSeatNumbers =
                    Array.isArray(
                        selectedGroup.bookedSeatNumbers
                    )
                        ? selectedGroup.bookedSeatNumbers
                        : [];

                const bookedSeatNumbers =
                    rawBookedSeatNumbers.map(
                        seat =>
                            Number(seat)
                    );

                if (
                    bookedSeatNumbers.some(
                        seat =>
                            !Number.isInteger(seat) ||
                            seat < 1 ||
                            seat > capacity
                    )
                ) {
                    throw new Error(
                        "Stored booked ride seat data is invalid."
                    );
                }

                const bookedSet =
                    new Set(
                        bookedSeatNumbers
                    );

                if (
                    bookedSet.size !==
                    bookedSeatNumbers.length
                ) {
                    throw new Error(
                        "Stored booked ride seat data contains duplicates."
                    );
                }

                for (
                    const seatNumber
                    of assignedSeatNumbers
                ) {
                    if (
                        seatNumber < 1 ||
                        seatNumber > capacity
                    ) {
                        throw new Error(
                            "A booked seat number is outside the selected vehicle capacity."
                        );
                    }

                    if (
                        bookedSet.has(
                            seatNumber
                        )
                    ) {
                        throw new Error(
                            "One or more selected seats have already been booked."
                        );
                    }
                }

                const holdCollection =
                    db.collection(
                        "rideSeatHolds"
                    );

                const holdKeyPrefix =
                    encodeURIComponent(
                        tripId
                    ) +
                    "__" +
                    encodeURIComponent(
                        groupId
                    );

                const holdSnapshots = [];

                for (
                    const seatNumber
                    of assignedSeatNumbers
                ) {
                    const holdRef =
                        holdCollection.doc(
                            holdKeyPrefix +
                            "__" +
                            seatNumber
                        );

                    const holdSnapshot =
                        await transactionRunner.get(
                            holdRef
                        );

                    holdSnapshots.push({
                        ref:
                            holdRef,
                        snapshot:
                            holdSnapshot
                    });
                }

                const now =
                    admin.firestore
                        .Timestamp
                        .now();

                for (
                    const item
                    of holdSnapshots
                ) {
                    if (
                        !item.snapshot.exists
                    ) {
                        throw new Error(
                            "A seat hold for this payment could not be found."
                        );
                    }

                    const hold =
                        item.snapshot.data();

                    const expiresAt =
                        hold.expiresAt;

                    const expectedHoldStatus =
                        isPayOnDepartureReservation
                            ? "RESERVED"
                            : "HELD";

                    if (
                        hold.status !==
                        expectedHoldStatus ||
                        hold.bookingId !==
                        bookingId ||
                        hold.userId !==
                        uid ||
                        String(
                            hold.tripId ||
                            ""
                        ) !==
                            tripId ||
                        String(
                            hold.groupId ||
                            ""
                        ) !==
                            groupId ||
                        Number(
                            hold.seatNumber
                        ) !==
                            seatNumber ||
                        !expiresAt ||
                        typeof expiresAt.toMillis !==
                            "function" ||
                        expiresAt.toMillis() <=
                            now.toMillis()
                    ) {
                        throw new Error(
                            "One or more ride seat holds have expired or are no longer valid."
                        );
                    }
                }

                const updatedBookedSeatNumbers =
                    Array.from(
                        new Set([
                            ...bookedSeatNumbers,
                            ...assignedSeatNumbers
                        ])
                    ).sort(
                        (a, b) =>
                            a - b
                    );

                const updatedGroup = {
                    ...selectedGroup,

                    bookedSeatNumbers:
                        updatedBookedSeatNumbers,

                    availableSeats:
                        capacity -
                        updatedBookedSeatNumbers.length
                };

                const updatedGroups =
                    groups.map(
                        (
                            group,
                            index
                        ) =>
                            index ===
                            groupIndex
                                ? updatedGroup
                                : group
                    );

                const tripAvailableSeats =
                    updatedGroups.reduce(
                        (
                            total,
                            group
                        ) => {
                            const groupCapacity =
                                Number(
                                    group?.capacity
                                );

                            if (
                                !Number.isInteger(
                                    groupCapacity
                                ) ||
                                groupCapacity < 1
                            ) {
                                throw new Error(
                                    "A ride group has invalid capacity."
                                );
                            }

                            const groupBookedSeatNumbers =
                                Array.isArray(
                                    group?.bookedSeatNumbers
                                )
                                    ? group.bookedSeatNumbers.map(
                                        seat =>
                                            Number(seat)
                                    )
                                    : [];

                            if (
                                groupBookedSeatNumbers.some(
                                    seat =>
                                        !Number.isInteger(seat) ||
                                        seat < 1 ||
                                        seat > groupCapacity
                                )
                            ) {
                                throw new Error(
                                    "A ride group contains invalid booked seat data."
                                );
                            }

                            const uniqueBookedSeats =
                                new Set(
                                    groupBookedSeatNumbers
                                );

                            if (
                                uniqueBookedSeats.size !==
                                groupBookedSeatNumbers.length
                            ) {
                                throw new Error(
                                    "A ride group contains duplicate booked seats."
                                );
                            }

                            return (
                                total +
                                Math.max(
                                    0,
                                    groupCapacity -
                                    uniqueBookedSeats.size
                                )
                            );
                        },
                        0
                    );

                transactionRunner.update(
                    tripRef,
                    {
                        groups:
                            updatedGroups,

                        availableSeats:
                            tripAvailableSeats,

                        updatedAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp()
                    }
                );

                for (
                    const item
                    of holdSnapshots
                ) {
                    transactionRunner.delete(
                        item.ref
                    );
                }

                transactionRunner.update(
                    bookingRef,
                    {

                        paymentStatus:
                            "PAID",

                        paymentMethod:
                            "PAYSTACK",

                        paidAmount:
                            authoritativeAmount,

                        paymentReference:
                            reference,

                        paystackTransactionId:
                            transaction.id ||
                            null,

                        paidAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp(),

                        status:
                            "CONFIRMED",

                        updatedAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp()

                    }
                );

                transactionRunner.update(
                    paymentRef,
                    {

                        status:
                            "COMPLETED",

                        paystackTransactionId:
                            transaction.id ||
                            null,

                        paystackStatus:
                            transaction.status,

                        paymentChannel:
                            transaction.channel ||
                            null,

                        paidAt:
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

                    alreadyProcessed:
                        false

                };

            }
        );

    return {

        success:
            true,

        alreadyProcessed:
            transactionResult
                .alreadyProcessed,

        reference:
            reference,

        bookingId:
            bookingId,

        amount:
            money(
                payment.amount
            ),

        status:
            "COMPLETED"

    };
}


module.exports = {

    initializeRidePayment,

    verifyRidePayment

};

