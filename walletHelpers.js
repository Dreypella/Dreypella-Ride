const admin = require("firebase-admin");

const db = admin.firestore();


function money(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return 0;
    }

    return Math.round(amount * 100) / 100;
}


function generateTransactionReference(prefix = "DR-TXN") {

    const random =
        Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();

    return `${prefix}-${Date.now()}-${random}`;
}


function generateIdempotencyKey(
    uid,
    reference
) {
    return `${uid}_${reference}`;
}


function assertPositiveAmount(amount) {

    const value = money(amount);

    if (value <= 0) {
        throw new Error("Invalid payment amount.");
    }

    return value;
}


async function getWallet(uid) {

    const walletRef =
        db.collection("wallets").doc(uid);

    const snapshot =
        await walletRef.get();

    if (!snapshot.exists) {

        throw new Error(
            "Wallet does not exist."
        );

    }

    return {
        ref: walletRef,
        data: snapshot.data()
    };
}


function getAvailableBalance(wallet) {

    return money(
        wallet.availableBalance || 0
    );
}


module.exports = {

    db,
    money,
    generateTransactionReference,
    generateIdempotencyKey,
    assertPositiveAmount,
    getWallet,
    getAvailableBalance

};