const admin = require("firebase-admin");

const {

    db,

    money,

    generateTransactionReference,

    generateIdempotencyKey,

    assertPositiveAmount

} = require("./walletHelpers");



/*
    PAY WITH WALLET

    Supported:

    RIDE
    DELIVERY
    MARKETPLACE
*/


async function payWithWallet(
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


    const paymentType =
        String(
            data.paymentType || ""
        ).toUpperCase();


    const amount =
        assertPositiveAmount(
            data.amount
        );


    const reference =
        String(
            data.reference || ""
        ).trim();


    const orderId =
        String(
            data.orderId || ""
        ).trim();


    const item =
        String(
            data.item || ""
        ).trim();


    const allowedTypes = [

        "RIDE",

        "DELIVERY",

        "MARKETPLACE"

    ];


    if (
        !allowedTypes.includes(
            paymentType
        )
    ) {

        throw new Error(
            "Invalid payment type."
        );

    }


    if (!reference) {

        throw new Error(
            "Payment reference is required."
        );

    }


    if (!orderId) {

        throw new Error(
            "Order or booking ID is required."
        );

    }


    /*
        Idempotency protection.

        Prevents the same payment from
        being processed twice.
    */


    const idempotencyKey =
        generateIdempotencyKey(
            uid,
            reference
        );


    const transactionRef =
        db
            .collection("walletTransactions")
            .doc(
                idempotencyKey
            );


    const walletRef =
        db
            .collection("wallets")
            .doc(uid);


    const result =
        await db.runTransaction(
            async transaction => {

                /*
                    Check duplicate transaction.
                */

                const existing =
                    await transaction.get(
                        transactionRef
                    );


                if (
                    existing.exists
                ) {

                    return {

                        alreadyProcessed:
                            true,

                        data:
                            existing.data()

                    };

                }


                /*
                    Read wallet.
                */

                const walletSnapshot =
                    await transaction.get(
                        walletRef
                    );


                if (
                    !walletSnapshot.exists
                ) {

                    throw new Error(
                        "Wallet does not exist."
                    );

                }


                const wallet =
                    walletSnapshot.data();


                const balance =
                    money(
                        wallet.availableBalance || 0
                    );


                if (
                    balance < amount
                ) {

                    throw new Error(
                        "Insufficient wallet balance."
                    );

                }


                const newBalance =
                    money(
                        balance - amount
                    );


                const transactionId =
                    generateTransactionReference(
                        "DR-PAY"
                    );


                /*
                    Wallet transaction.
                */

                transaction.set(
                    transactionRef,
                    {

                        transactionId,

                        userId:
                            uid,

                        type:
                            "PAYMENT",

                        paymentType,

                        amount,

                        direction:
                            "DEBIT",

                        status:
                            "SUCCESS",

                        reference,

                        orderId,

                        item,

                        balanceBefore:
                            balance,

                        balanceAfter:
                            newBalance,

                        createdAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp()

                    }
                );


                /*
                    Update wallet.
                */

                transaction.update(
                    walletRef,
                    {

                        availableBalance:
                            newBalance,

                        updatedAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp()

                    }
                );


                return {

                    alreadyProcessed:
                        false,

                    transactionId,

                    newBalance

                };

            }
        );


    /*
        Update the related business
        record AFTER the wallet transaction.

        We deliberately keep this separate
        from the wallet transaction because
        the exact structure of your ride,
        delivery and marketplace collections
        may differ.
    */


    await updatePaidRecord({

        uid,

        paymentType,

        orderId,

        amount,

        reference,

        transactionId:
            result.transactionId ||
            result.data?.transactionId

    });


    return {

        success:
            true,

        transactionId:
            result.transactionId ||
            result.data?.transactionId,

        amount,

        status:
            "SUCCESS"

    };

}



/*
    UPDATE BUSINESS RECORD
*/

async function updatePaidRecord({

    uid,

    paymentType,

    orderId,

    amount,

    reference,

    transactionId

}) {

    let collectionName;


    if (
        paymentType ===
        "RIDE"
    ) {

        collectionName =
            "rideBookings";

    }

    else if (
        paymentType ===
        "DELIVERY"
    ) {

        collectionName =
            "deliveryOrders";

    }

    else if (
        paymentType ===
        "MARKETPLACE"
    ) {

        collectionName =
            "marketplaceOrders";

    }


    if (!collectionName) {

        return;

    }


    const recordRef =
        db
            .collection(
                collectionName
            )
            .doc(orderId);


    const snapshot =
        await recordRef.get();


    if (!snapshot.exists) {

        /*
            The wallet payment is already
            recorded. Do not reverse money
            automatically just because the
            business record could not be
            found.

            This should be investigated by
            the admin/backend.
        */

        console.error(
            `Payment ${reference}: ${collectionName}/${orderId} not found.`
        );

        return;

    }


    const record =
        snapshot.data();


    /*
        Ownership protection.
    */

    if (
        record.userId &&
        record.userId !== uid
    ) {

        throw new Error(
            "You cannot pay for this record."
        );

    }


    await recordRef.update({

        paymentStatus:
            "PAID",

        paidAmount:
            amount,

        paymentReference:
            reference,

        walletTransactionId:
            transactionId,

        paidAt:
            admin.firestore
                .FieldValue
                .serverTimestamp(),

        updatedAt:
            admin.firestore
                .FieldValue
                .serverTimestamp()

    });

}



module.exports = {

    payWithWallet

};