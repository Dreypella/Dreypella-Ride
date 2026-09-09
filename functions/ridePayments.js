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

    if (
        booking.status !==
        "PENDING_PAYMENT"
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

