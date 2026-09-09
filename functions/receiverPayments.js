const crypto =
    require("crypto");

const admin =
    require("firebase-admin");

const {
    db,
    money
} =
    require("./walletHelpers");

const {
    paystackRequest
} =
    require("./paystack");


/*
    =========================================
    RECEIVER PAYMENT REQUESTS
    =========================================

    Receiver does NOT need a Dreypella account.

    Security model:

    Sender
        ↓
    authenticated backend request
        ↓
    secure random token
        ↓
    token hash stored in Firestore
        ↓
    public receiver payment URL

    The receiver never supplies the amount
    or delivery ID as authority.
*/


const RECEIVER_PAYMENT_EXPIRY_MS =
    24 * 60 * 60 * 1000;


function generateSecureToken() {

    return crypto
        .randomBytes(32)
        .toString("hex");

}


function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

}


/*
    CREATE RECEIVER PAYMENT REQUEST

    Called by an authenticated sender.
*/
async function createReceiverPaymentRequest(
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
            data.deliveryId || ""
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
            "Delivery not found."
        );

    }


    const delivery =
        deliverySnapshot.data();


    const ownerId =
        delivery.customerId ||
        delivery.userId ||
        null;


    if (
        !ownerId ||
        ownerId !== uid
    ) {

        throw new Error(
            "You cannot create a payment request for this delivery."
        );

    }


    const payer =
        String(
            delivery.payer || ""
        ).toUpperCase();


    if (payer !== "RECEIVER") {

        throw new Error(
            "This delivery is not configured for receiver payment."
        );

    }


    const paymentStatus =
        String(
            delivery.paymentStatus || ""
        ).toUpperCase();


    if (
        paymentStatus === "PAID" ||
        paymentStatus === "SUCCESS"
    ) {

        throw new Error(
            "This delivery has already been paid."
        );

    }


    const amount =
        money(
            delivery.customerPrice || 0
        );


    if (amount <= 0) {

        throw new Error(
            "The delivery payment amount is invalid."
        );

    }


    const token =
        generateSecureToken();


    const tokenHash =
        hashToken(token);


    const requestId =
        crypto.randomUUID();


    const requestRef =
        db
            .collection(
                "receiverPaymentRequests"
            )
            .doc(requestId);


    const now =
        admin.firestore.Timestamp.now();


    const expiresAt =
        admin.firestore.Timestamp.fromMillis(
            Date.now() +
            RECEIVER_PAYMENT_EXPIRY_MS
        );


    await requestRef.set({

        requestId,

        deliveryId,

        senderId:
            uid,

        bookingReference:
            delivery.bookingReference ||
            null,

        amount,

        currency:
            "NGN",

        tokenHash,

        status:
            "PENDING",

        expiresAt,

        createdAt:
            now,

        updatedAt:
            now

    });


    const paymentUrl =
        "receiver-payment.html" +
        "?token=" +
        encodeURIComponent(
            token
        );


    return {

        success:
            true,

        requestId,

        deliveryId,

        amount,

        currency:
            "NGN",

        status:
            "PENDING",

        paymentUrl,

        expiresAt:
            expiresAt.toDate()
                .toISOString()

    };

}


/*
    GET RECEIVER PAYMENT REQUEST

    PUBLIC ENDPOINT LOGIC.

    No authentication is required.

    The secure token is the credential.
*/
async function getReceiverPaymentRequest(
    data
) {

    const token =
        String(
            data.token || ""
        ).trim();


    if (!token) {

        throw new Error(
            "Payment token is required."
        );

    }


    if (
        token.length < 32
    ) {

        throw new Error(
            "Invalid payment token."
        );

    }


    const tokenHash =
        hashToken(token);


    const snapshot =
        await db
            .collection(
                "receiverPaymentRequests"
            )
            .where(
                "tokenHash",
                "==",
                tokenHash
            )
            .limit(1)
            .get();


    if (snapshot.empty) {

        throw new Error(
            "Payment request not found or expired."
        );

    }


    const requestDoc =
        snapshot.docs[0];


    const request =
        requestDoc.data();


    if (
        request.status !==
        "PENDING"
    ) {

        if (
            request.status ===
            "COMPLETED"
        ) {

            return {

                success:
                    true,

                alreadyPaid:
                    true,

                status:
                    "PAID",

                deliveryId:
                    request.deliveryId,

                bookingReference:
                    request.bookingReference,

                amount:
                    money(
                        request.amount
                    ),

                currency:
                    request.currency ||
                    "NGN"

            };

        }


        throw new Error(
            "This payment request is no longer available."
        );

    }


    const expiresAt =
        request.expiresAt;


    if (
        !expiresAt ||
        expiresAt.toMillis() <
        Date.now()
    ) {

        await requestDoc.ref.update({

            status:
                "EXPIRED",

            updatedAt:
                admin.firestore.FieldValue
                    .serverTimestamp()

        });


        throw new Error(
            "This payment request has expired."
        );

    }


    const deliveryRef =
        db
            .collection("deliveries")
            .doc(
                request.deliveryId
            );


    const deliverySnapshot =
        await deliveryRef.get();


    if (!deliverySnapshot.exists) {

        throw new Error(
            "Delivery no longer exists."
        );

    }


    const delivery =
        deliverySnapshot.data();


    const currentPaymentStatus =
        String(
            delivery.paymentStatus || ""
        ).toUpperCase();


    if (
        currentPaymentStatus ===
        "PAID"
    ) {

        await requestDoc.ref.update({

            status:
                "COMPLETED",

            updatedAt:
                admin.firestore.FieldValue
                    .serverTimestamp()

        });


        return {

            success:
                true,

            alreadyPaid:
                true,

            status:
                "PAID",

            deliveryId:
                request.deliveryId,

            bookingReference:
                request.bookingReference,

            amount:
                money(
                    request.amount
                ),

            currency:
                request.currency ||
                "NGN"

        };

    }


    const currentAmount =
        money(
            delivery.customerPrice || 0
        );


    if (
        currentAmount <= 0 ||
        currentAmount !==
        money(request.amount)
    ) {

        throw new Error(
            "The payment amount is no longer valid."
        );

    }


    return {

        success:
            true,

        alreadyPaid:
            false,

        status:
            "PENDING",

        deliveryId:
            request.deliveryId,

        bookingReference:
            request.bookingReference,

        pickup:
            delivery.pickup || null,

        destination:
            delivery.destination || null,

        method:
            delivery.method || null,

        distanceKm:
            delivery.distanceKm || null,

        recipientName:
            delivery.recipientName || null,

        amount:
            currentAmount,

        currency:
            "NGN"

    };

}


/*
    INITIALIZE RECEIVER PAYMENT

    Public receiver payment flow.

    The secure token is the credential.
    The receiver does NOT need a Dreypella account.
*/
async function initializeReceiverPayment(
    data
) {

    const token =
        String(
            data.token || ""
        ).trim();

    if (!token) {
        throw new Error(
            "Payment token is required."
        );
    }

    if (
        token.length < 32
    ) {
        throw new Error(
            "Invalid payment token."
        );
    }

    const tokenHash =
        hashToken(token);

    const snapshot =
        await db
            .collection(
                "receiverPaymentRequests"
            )
            .where(
                "tokenHash",
                "==",
                tokenHash
            )
            .limit(1)
            .get();

    if (snapshot.empty) {
        throw new Error(
            "Payment request not found or expired."
        );
    }

    const requestDoc =
        snapshot.docs[0];

    const request =
        requestDoc.data();

    if (
        request.status !==
        "PENDING"
    ) {
        if (
            request.status ===
            "COMPLETED"
        ) {
            throw new Error(
                "This payment has already been completed."
            );
        }

        throw new Error(
            "This payment request is no longer available."
        );
    }

    const expiresAt =
        request.expiresAt;

    if (
        !expiresAt ||
        expiresAt.toMillis() <
        Date.now()
    ) {

        await requestDoc.ref.update({
            status:
                "EXPIRED",

            updatedAt:
                admin.firestore
                    .FieldValue
                    .serverTimestamp()
        });

        throw new Error(
            "This payment request has expired."
        );
    }

    const deliveryRef =
        db
            .collection("deliveries")
            .doc(
                request.deliveryId
            );

    const deliverySnapshot =
        await deliveryRef.get();

    if (
        !deliverySnapshot.exists
    ) {
        throw new Error(
            "Delivery no longer exists."
        );
    }

    const delivery =
        deliverySnapshot.data();

    const paymentStatus =
        String(
            delivery.paymentStatus || ""
        ).toUpperCase();

    if (
        paymentStatus ===
            "PAID" ||
        paymentStatus ===
            "SUCCESS"
    ) {

        await requestDoc.ref.update({
            status:
                "COMPLETED",

            updatedAt:
                admin.firestore
                    .FieldValue
                    .serverTimestamp()
        });

        throw new Error(
            "This delivery has already been paid."
        );
    }

    const currentAmount =
        money(
            delivery.customerPrice || 0
        );

    const requestAmount =
        money(
            request.amount || 0
        );

    if (
        currentAmount <= 0 ||
        currentAmount !==
            requestAmount
    ) {
        throw new Error(
            "The payment amount is no longer valid."
        );
    }

    const receiverEmail =
        String(
            delivery.recipientEmail ||
            delivery.customerEmail ||
            ""
        ).trim();

    if (!receiverEmail) {
        throw new Error(
            "A valid email address is required to process this payment."
        );
    }

    const reference =
        "DR-RECEIVER-" +
        Date.now() +
        "-" +
        crypto
            .randomBytes(6)
            .toString("hex")
            .toUpperCase();

    const amountKobo =
        Math.round(
            currentAmount * 100
        );

    await requestDoc.ref.update({

        paystackReference:
            reference,

        paystackAmountKobo:
            amountKobo,

        paystackStatus:
            "INITIALIZING",

        paymentEmail:
            receiverEmail,

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
                            receiverEmail,

                        amount:
                            amountKobo,

                        currency:
                            "NGN",

                        reference:

                            reference,

                        callback_url:
                            "https://dreypella.github.io/Dreypella-Ride/receiver-payment-success.html?token=" + encodeURIComponent(token),

                        metadata: {

                            requestId:
                                request.requestId,

                            deliveryId:
                                request.deliveryId,

                            type:
                                "RECEIVER_DELIVERY_PAYMENT"

                        }

                    }
                }
            );

        if (
            !result.data ||
            !result.data.authorization_url
        ) {
            throw new Error(
                "Unable to create the payment checkout."
            );
        }

        await requestDoc.ref.update({

            status:
                "PENDING",

            paystackStatus:
                "INITIALIZED",

            authorizationUrl:
                result.data
                    .authorization_url,

            accessCode:
                result.data
                    .access_code ||
                null,

            updatedAt:
                admin.firestore
                    .FieldValue
                    .serverTimestamp()

        });

        return {

            success:
                true,

            requestId:
                request.requestId,

            deliveryId:
                request.deliveryId,

            amount:
                currentAmount,

            currency:
                "NGN",

            reference,

            authorizationUrl:
                result.data
                    .authorization_url

        };

    }
    catch (error) {

        await requestDoc.ref.update({

            status:
                "PENDING",

            paystackStatus:
                "INITIALIZATION_FAILED",

            failureReason:
                error.message ||
                "Unable to initialize payment.",

            updatedAt:
                admin.firestore
                    .FieldValue
                    .serverTimestamp()

        });

        throw error;
    }
}



/*
    VERIFY RECEIVER PAYMENT

    Paystack is verified server-side.

    The receiver cannot mark the delivery
    as paid from the browser.
*/
async function verifyReceiverPayment(
    data
) {

    const token =
        String(
            data.token || ""
        ).trim();

    const reference =
        String(
            data.reference || ""
        ).trim();

    if (!token) {
        throw new Error(
            "Payment token is required."
        );
    }

    if (
        token.length < 32
    ) {
        throw new Error(
            "Invalid payment token."
        );
    }

    if (!reference) {
        throw new Error(
            "Payment reference is required."
        );
    }

    const tokenHash =
        hashToken(token);

    const snapshot =
        await db
            .collection(
                "receiverPaymentRequests"
            )
            .where(
                "tokenHash",
                "==",
                tokenHash
            )
            .limit(1)
            .get();

    if (snapshot.empty) {
        throw new Error(
            "Payment request not found or expired."
        );
    }

    const requestDoc =
        snapshot.docs[0];

    const request =
        requestDoc.data();

    if (
        request.status ===
        "COMPLETED"
    ) {

        if (
            request.paystackReference ===
            reference
        ) {
            return {
                success:
                    true,

                alreadyProcessed:
                    true,

                deliveryId:
                    request.deliveryId,

                amount:
                    money(
                        request.amount
                    ),

                reference,

                status:
                    "SUCCESS"
            };
        }

        throw new Error(
            "This payment request has already been completed."
        );
    }

    if (
        request.status !==
        "PENDING"
    ) {
        throw new Error(
            "This payment request is no longer available."
        );
    }

    const expiresAt =
        request.expiresAt;

    if (
        !expiresAt ||
        expiresAt.toMillis() <
        Date.now()
    ) {

        await requestDoc.ref.update({
            status:
                "EXPIRED",

            updatedAt:
                admin.firestore
                    .FieldValue
                    .serverTimestamp()
        });

        throw new Error(
            "This payment request has expired."
        );
    }

    if (
        request.paystackReference &&
        request.paystackReference !==
            reference
    ) {
        throw new Error(
            "Payment reference does not match this request."
        );
    }

    const transaction =
        await paystackRequest(
            "/transaction/verify/" +
            encodeURIComponent(
                reference
            )
        );

    if (
        !transaction.data
    ) {
        throw new Error(
            "Paystack returned no transaction data."
        );
    }

    if (
        transaction.data.status !==
        "success"
    ) {
        throw new Error(
            "Paystack payment was not successful."
        );
    }

    if (
        String(
            transaction.data.reference ||
            ""
        ) !== reference
    ) {
        throw new Error(
            "Paystack transaction reference does not match."
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
            "Paystack transaction currency is invalid."
        );
    }

    const deliveryRef =
        db
            .collection("deliveries")
            .doc(
                request.deliveryId
            );

    const transactionResult =
        await db.runTransaction(
            async transactionRunner => {

                const [
                    currentRequestSnapshot,
                    deliverySnapshot
                ] =
                    await Promise.all([
                        transactionRunner.get(
                            requestDoc.ref
                        ),
                        transactionRunner.get(
                            deliveryRef
                        )
                    ]);

                if (
                    !currentRequestSnapshot.exists
                ) {
                    throw new Error(
                        "Payment request no longer exists."
                    );
                }

                if (
                    !deliverySnapshot.exists
                ) {
                    throw new Error(
                        "Delivery no longer exists."
                    );
                }

                const currentRequest =
                    currentRequestSnapshot.data();

                const delivery =
                    deliverySnapshot.data();

                if (
                    currentRequest.status ===
                    "COMPLETED"
                ) {

                    if (
                        currentRequest
                            .paystackReference ===
                        reference
                    ) {
                        return {
                            alreadyProcessed:
                                true
                        };
                    }

                    throw new Error(
                        "This payment request has already been completed."
                    );
                }

                if (
                    currentRequest.status !==
                    "PENDING"
                ) {
                    throw new Error(
                        "This payment request is no longer available."
                    );
                }

                if (
                    currentRequest
                        .deliveryId !==
                    request.deliveryId
                ) {
                    throw new Error(
                        "Payment request delivery mismatch."
                    );
                }

                if (
                    currentRequest
                        .paystackReference &&
                    currentRequest
                        .paystackReference !==
                    reference
                ) {
                    throw new Error(
                        "Payment reference does not match this request."
                    );
                }

                const paymentStatus =
                    String(
                        delivery.paymentStatus ||
                        ""
                    ).toUpperCase();

                if (
                    paymentStatus ===
                        "PAID" ||
                    paymentStatus ===
                        "SUCCESS"
                ) {

                    transactionRunner.update(
                        requestDoc.ref,
                        {

                            status:
                                "COMPLETED",

                            paystackReference:
                                reference,

                            paystackStatus:
                                transaction.data
                                    .status,

                            paystackTransactionId:
                                transaction.data
                                    .id ||
                                null,

                            paymentChannel:
                                transaction.data
                                    .channel ||
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

                const authoritativeAmount =
                    money(
                        delivery.customerPrice ||
                        0
                    );

                const requestAmount =
                    money(
                        currentRequest.amount ||
                        0
                    );

                if (
                    authoritativeAmount <=
                    0
                ) {
                    throw new Error(
                        "The delivery payment amount is invalid."
                    );
                }

                if (
                    authoritativeAmount !==
                    requestAmount
                ) {
                    throw new Error(
                        "The payment amount no longer matches the delivery price."
                    );
                }

                const paystackAmount =
                    Number(
                        transaction.data.amount
                    );

                const expectedAmountKobo =
                    Math.round(
                        authoritativeAmount *
                        100
                    );

                if (
                    !Number.isFinite(
                        paystackAmount
                    ) ||
                    paystackAmount !==
                    expectedAmountKobo
                ) {
                    throw new Error(
                        "Paystack payment amount does not match the delivery price."
                    );
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
                            transaction.data
                                .id ||
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
                    requestDoc.ref,
                    {

                        status:
                            "COMPLETED",

                        paystackReference:
                            reference,

                        paystackStatus:
                            transaction.data
                                .status,

                        paystackTransactionId:
                            transaction.data
                                .id ||
                            null,

                        paymentChannel:
                            transaction.data
                                .channel ||
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

        deliveryId:
            request.deliveryId,

        amount:
            money(
                request.amount
            ),

        reference,

        status:
            "SUCCESS"

    };
}



module.exports = {

    createReceiverPaymentRequest,

    getReceiverPaymentRequest,

    initializeReceiverPayment,

    verifyReceiverPayment

};
