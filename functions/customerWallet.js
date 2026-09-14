const admin = require("firebase-admin");

const db = admin.firestore();

async function getCustomerTransactions(data, context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new Error("You must be logged in.");
    }

    const requestedLimit = Number(data?.limit || 30);
    const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 100);

    const snapshot = await db
        .collection("walletTransactions")
        .where("userId", "==", context.auth.uid)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

    const transactions = [];

    snapshot.forEach(doc => {
        const transaction = doc.data();

        transactions.push({
            id: doc.id,
            transactionId: transaction.transactionId || doc.id,
            type: transaction.type || null,
            direction: transaction.direction || null,
            amount: Number(transaction.amount || 0),
            status: transaction.status || null,
            reference: transaction.reference || null,
            description: transaction.description || null,
            orderId: transaction.orderId || null,
            bookingId: transaction.bookingId || null,
            withdrawalId: transaction.withdrawalId || null,
            createdAt: transaction.createdAt || null
        });
    });

    return {
        success: true,
        transactions
    };
}

module.exports = {
    getCustomerTransactions
};
