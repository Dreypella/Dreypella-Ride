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


async function payWithWallet(data, context) {
    if (!context.auth) {
        throw new Error("You must be logged in.");
    }

    const uid = context.auth.uid;

    const paymentType = String(data.paymentType || "").toUpperCase();
    const amount = assertPositiveAmount(data.amount);
    const reference = String(data.reference || "").trim();
    const orderId = String(data.orderId || "").trim();
    const item = String(data.item || "").trim();

    const allowedTypes = ["RIDE", "DELIVERY", "MARKETPLACE"];

    if (!allowedTypes.includes(paymentType)) {
        throw new Error("Invalid payment type.");
    }

    if (!reference) {
        throw new Error("Payment reference is required.");
    }

    if (!orderId) {
        throw new Error("Order or booking ID is required.");
    }

    let collectionName;

    if (paymentType === "RIDE") {
        collectionName = "rideBookings";
    } else if (paymentType === "DELIVERY") {
        collectionName = "deliveries";
    } else {
        collectionName = "marketplaceOrders";
    }

    const idempotencyKey = generateIdempotencyKey(uid, reference);
    const transactionRef = db.collection("walletTransactions").doc(idempotencyKey);
    const walletRef = db.collection("wallets").doc(uid);
    const recordRef = db.collection(collectionName).doc(orderId);

    const result = await db.runTransaction(async transaction => {
        const existing = await transaction.get(transactionRef);

        if (existing.exists) {
            return {
                alreadyProcessed: true,
                data: existing.data()
            };
        }

        /*
            IMPORTANT:
            Read and validate the business record BEFORE touching
            the customer's wallet.
        */
        const recordSnapshot = await transaction.get(recordRef);

        if (!recordSnapshot.exists) {
            throw new Error(
                `Payment record not found: ${collectionName}/${orderId}`
            );
        }

        const record = recordSnapshot.data();

        const ownerId =
            record.userId ||
            record.customerId ||
            null;

        if (!ownerId || ownerId !== uid) {
            throw new Error("You cannot pay for this record.");
        }

        if (
            record.paymentStatus === "PAID" ||
            record.paymentStatus === "SUCCESS"
        ) {
            throw new Error("This record has already been paid.");
        }

        /*
            Make sure the amount being charged matches
            the authoritative price stored by the application.
        */
        let expectedAmount = 0;
        let priceLabel = "payment";

        if (paymentType === "RIDE") {
            expectedAmount = money(record.totalFare || 0);
            priceLabel = "ride fare";
        }
        else if (paymentType === "DELIVERY") {
            expectedAmount = money(record.customerPrice || 0);
            priceLabel = "delivery price";
        }
        else if (paymentType === "MARKETPLACE") {
            expectedAmount = money(record.total || 0);
            priceLabel = "marketplace order total";
        }

        if (expectedAmount <= 0) {
            throw new Error(
                `The ${priceLabel} is invalid.`
            );
        }

        if (money(amount) !== expectedAmount) {
            throw new Error(
                `Payment amount does not match the ${priceLabel}.`
            );
        }

        const walletSnapshot = await transaction.get(walletRef);

        if (!walletSnapshot.exists) {
            throw new Error("Wallet does not exist.");
        }

        const wallet = walletSnapshot.data();
        const balance = money(wallet.availableBalance || 0);

        if (balance < amount) {
            const shortfall =
                money(amount - balance);

            const error =
                new Error(
                    "Insufficient wallet balance."
                );

            error.code =
                "INSUFFICIENT_WALLET_BALANCE";

            error.shortfall =
                shortfall;

            error.walletBalance =
                balance;

            error.requiredAmount =
                amount;

            throw error;
        }

        const newBalance = money(balance - amount);
        const transactionId = generateTransactionReference("DR-PAY");

        transaction.set(transactionRef, {
            transactionId,
            userId: uid,
            type: "PAYMENT",
            paymentType,
            amount,
            direction: "DEBIT",
            status: "SUCCESS",
            reference,
            orderId,
            item,
            balanceBefore: balance,
            balanceAfter: newBalance,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        transaction.update(walletRef, {
            availableBalance: newBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        /*
            Mark the actual business record paid inside the SAME
            Firestore transaction as the wallet debit.
        */
        const paymentUpdate = {
            paymentStatus: "PAID",
            paymentMethod: "WALLET",
            paidAmount: amount,
            paymentReference: reference,
            walletTransactionId: transactionId,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (paymentType === "RIDE") {
            paymentUpdate.status = "CONFIRMED";
        }
        else if (paymentType === "DELIVERY") {
            paymentUpdate.status = "PAYMENT_CONFIRMED";
        }
        else {
            paymentUpdate.orderStatus = "CONFIRMED";
        }

        transaction.update(recordRef, paymentUpdate);

        return {
            alreadyProcessed: false,
            transactionId,
            newBalance
        };
    });

    return {
        success: true,
        transactionId:
            result.transactionId ||
            result.data?.transactionId,
        amount,
        status: "SUCCESS"
    };
}

module.exports = {

    payWithWallet

};