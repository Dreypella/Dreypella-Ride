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
    INITIALIZE DELIVERY PAYMENT
    PAYSTACK
    SENDER PAYS
    =========================================
*/

async function initializeDeliveryPayment(
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

    const deliveryId =
        String(
            data?.deliveryId ||
            ""
        ).trim();

    if (!deliveryId) {
        throw new Error(
            "Delivery ID is required."
        );
    }

    const deliveryRef =
        db
            .collection("deliveries")
            .doc(deliveryId);

    const deliverySnapshot =
        await deliveryRef.get();

    if (!deliverySnapshot.exists) {
        throw new Error(
            "Delivery was not found."
        );
    }

    const delivery =
        deliverySnapshot.data();

    const ownerId =
        delivery.customerId ||
        delivery.userId ||
        null;

    if (ownerId !== uid) {
        throw new Error(
            "You cannot pay for this delivery."
        );
    }

    if (
        String(
            delivery.payer ||
            "SENDER"
        ).toUpperCase() !==
        "SENDER"
    ) {
        throw new Error(
            "This delivery is not configured for sender payment."
        );
    }

    const amount =
        money(
            delivery.customerPrice
        );

    if (amount <= 0) {
        throw new Error(
            "This delivery does not have a valid payment amount."
        );
    }

    if (
        String(
            delivery.paymentStatus ||
            ""
        ).toUpperCase() ===
        "PAID"
    ) {
        throw new Error(
            "This delivery has already been paid."
        );
    }

    const reference =
        generateTransactionReference(
            "DR-DELIVERY"
        );

    const amountKobo =
        Math.round(
            amount * 100
        );

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

    const paymentRef =
        db
            .collection("deliveryPayments")
            .doc(reference);

    await paymentRef.create({

        userId:
            uid,

        deliveryId:
            deliveryId,

        bookingReference:
            delivery.bookingReference ||
            null,

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
                            "https://dreypella.github.io/Dreypella-Ride/delivery-payment-success.html",

                        metadata: {

                            userId:
                                uid,

                            deliveryId:
                                deliveryId,

                            type:
                                "DELIVERY_PAYMENT"

                        }

                    }

                }
            );

        const authorizationUrl =
            result.data?.authorization_url;

        const accessCode =
            result.data?.access_code;

        if (!authorizationUrl) {
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

            deliveryId:
                deliveryId,

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
    VERIFY DELIVERY PAYMENT
    PAYSTACK
    SENDER PAYS
    =========================================
*/

async function verifyDeliveryPayment(
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
            .collection("deliveryPayments")
            .doc(reference);

    const paymentSnapshot =
        await paymentRef.get();

    if (!paymentSnapshot.exists) {
        throw new Error(
            "Delivery payment record was not found."
        );
    }

    const payment =
        paymentSnapshot.data();

    if (
        payment.userId !==
        uid
    ) {
        throw new Error(
            "You cannot complete this payment."
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

            deliveryId:
                payment.deliveryId,

            amount:
                money(
                    payment.amount
                ),

            status:
                "SUCCESS"
        };
    }

    if (
        payment.status ===
        "FAILED"
    ) {
        throw new Error(
            "This payment has already failed."
        );
    }

    const transaction =
        await paystackRequest(
            `/transaction/verify/${encodeURIComponent(reference)}`
        );

    if (
        !transaction.data ||
        transaction.data.status !==
        "success"
    ) {
        throw new Error(
            "Paystack payment was not successful."
        );
    }

    if (
        transaction.data.reference !==
        reference
    ) {
        throw new Error(
            "Paystack payment reference does not match."
        );
    }

    if (
        String(
            transaction.data.currency ||
            ""
        ).toUpperCase() !==
        "NGN"
    ) {
        throw new Error(
            "Paystack returned an unexpected currency."
        );
    }

    const paidAmountKobo =
        Number(
            transaction.data.amount
        );

    const expectedAmountKobo =
        Math.round(
            money(
                payment.amount
            ) * 100
        );

    if (
        !Number.isFinite(
            paidAmountKobo
        ) ||
        paidAmountKobo !==
        expectedAmountKobo
    ) {
        throw new Error(
            "Paystack payment amount does not match the delivery price."
        );
    }

    const deliveryId =
        String(
            payment.deliveryId ||
            ""
        ).trim();

    if (!deliveryId) {
        throw new Error(
            "Delivery payment is missing its delivery ID."
        );
    }

    const deliveryRef =
        db
            .collection("deliveries")
            .doc(deliveryId);

    const transactionResult =
        await db.runTransaction(
            async transactionRunner => {

                const currentPaymentSnapshot =
                    await transactionRunner.get(
                        paymentRef
                    );

                const deliverySnapshot =
                    await transactionRunner.get(
                        deliveryRef
                    );

                if (
                    !currentPaymentSnapshot.exists
                ) {
                    throw new Error(
                        "Delivery payment record was not found."
                    );
                }

                if (
                    !deliverySnapshot.exists
                ) {
                    throw new Error(
                        "Delivery was not found."
                    );
                }

                const currentPayment =
                    currentPaymentSnapshot.data();

                const delivery =
                    deliverySnapshot.data();

                if (
                    currentPayment.userId !==
                    uid
                ) {
                    throw new Error(
                        "You cannot complete this payment."
                    );
                }

                const ownerId =
                    delivery.customerId ||
                    delivery.userId ||
                    null;

                if (
                    ownerId !==
                    uid
                ) {
                    throw new Error(
                        "You cannot complete payment for this delivery."
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
                        delivery.customerPrice
                    );

                if (
                    authoritativeAmount <=
                    0
                ) {
                    throw new Error(
                        "The delivery price is no longer valid."
                    );
                }

                if (
                    authoritativeAmount !==
                    money(
                        currentPayment.amount
                    )
                ) {
                    throw new Error(
                        "Delivery price does not match the payment record."
                    );
                }

                if (
                    delivery.paymentStatus ===
                    "PAID"
                ) {

                    transactionRunner.update(
                        paymentRef,
                        {

                            status:
                                "COMPLETED",

                            paystackTransactionId:
                                transaction.data.id ||
                                null,

                            paystackStatus:
                                transaction.data.status,

                            paymentChannel:
                                transaction.data.channel ||
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
                    deliveryRef,
                    {

                        paymentStatus:
                            "PAID",

                        status:
                            "PAYMENT_CONFIRMED",

                        paymentMethod:
                            "PAYSTACK",

                        paidAmount:
                            authoritativeAmount,

                        paymentReference:
                            reference,

                        paystackTransactionId:
                            transaction.data.id ||
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

                transactionRunner.update(
                    paymentRef,
                    {

                        status:
                            "COMPLETED",

                        paystackTransactionId:
                            transaction.data.id ||
                            null,

                        paystackStatus:
                            transaction.data.status,

                        paymentChannel:
                            transaction.data.channel ||
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
            transactionResult.alreadyProcessed,

        deliveryId:
            deliveryId,

        amount:
            money(
                payment.amount
            ),

        reference:
            reference,

        status:
            "SUCCESS"

    };
}


module.exports = {

    initializeDeliveryPayment,

    verifyDeliveryPayment

};
