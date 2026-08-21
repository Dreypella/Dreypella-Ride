const functions =
    require("firebase-functions");

const admin =
    require("firebase-admin");


const db =
    admin.firestore();


/*
    =========================================
    WALLET CREATION
    =========================================
*/

async function createWallet(
    userId,
    walletType
) {

    if (!userId) {

        throw new Error(
            "User ID is required."
        );

    }


    const walletRef =
        db
            .collection("wallets")
            .doc(userId);


    const existing =
        await walletRef.get();


    if (
        existing.exists
    ) {

        return existing.data();

    }


    const wallet = {

        userId:

            userId,

        walletType:

            walletType,

        currency:

            "NGN",

        availableBalance:

            0,

        pendingBalance:

            0,

        lifetimeEarned:

            0,

        lifetimeSpent:

            0,

        lifetimeWithdrawn:

            0,

        status:

            "ACTIVE",

        createdAt:

            admin
                .firestore
                .FieldValue
                .serverTimestamp(),

        updatedAt:

            admin
                .firestore
                .FieldValue
                .serverTimestamp()

    };


    await walletRef.set(
        wallet
    );


    return wallet;

}


/*
    =========================================
    WALLET TRANSACTION
    =========================================
*/

async function createWalletTransaction(
    transaction
) {

    const transactionId =
        transaction.transactionId ||
        (
            "WTX-" +
            Date.now()
        );


    const transactionRef =
        db
            .collection(
                "walletTransactions"
            )
            .doc(
                transactionId
            );


    await transactionRef.create({

        transactionId:

            transactionId,

        userId:

            transaction.userId,

        walletId:

            transaction.walletId,

        type:

            transaction.type,

        category:

            transaction.category,

        amount:

            transaction.amount,

        balanceBefore:

            transaction.balanceBefore,

        balanceAfter:

            transaction.balanceAfter,

        reference:

            transaction.reference || null,

        description:

            transaction.description || "",

        status:

            transaction.status ||
            "COMPLETED",

        metadata:

            transaction.metadata || {},

        createdAt:

            admin
                .firestore
                .FieldValue
                .serverTimestamp()

    });


    return transactionId;

}


/*
    =========================================
    CREDIT WALLET
    =========================================
*/

async function creditWallet({

    userId,

    amount,

    category,

    reference,

    description,

    metadata = {}

}) {

    amount =
        Number(amount);


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        throw new Error(
            "Invalid credit amount."
        );

    }


    const walletRef =
        db
            .collection("wallets")
            .doc(userId);


    return db.runTransaction(
        async transaction => {

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


            const before =
                Number(
                    wallet.availableBalance ||
                    0
                );


            const after =
                before +
                amount;


            transaction.update(
                walletRef,
                {

                    availableBalance:
                        after,

                    lifetimeEarned:
                        Number(
                            wallet.lifetimeEarned ||
                            0
                        ) +
                        amount,

                    updatedAt:
                        admin
                            .firestore
                            .FieldValue
                            .serverTimestamp()

                }
            );


            const transactionId =
                "WTX-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .substring(2, 8)
                    .toUpperCase();


            const transactionRef =
                db
                    .collection(
                        "walletTransactions"
                    )
                    .doc(
                        transactionId
                    );


            transaction.create(
                transactionRef,
                {

                    transactionId:

                        transactionId,

                    userId:

                        userId,

                    walletId:

                        userId,

                    type:

                        "CREDIT",

                    category:

                        category,

                    amount:

                        amount,

                    balanceBefore:

                        before,

                    balanceAfter:

                        after,

                    reference:

                        reference ||
                        null,

                    description:

                        description ||
                        "",

                    status:

                        "COMPLETED",

                    metadata:

                        metadata,

                    createdAt:

                        admin
                            .firestore
                            .FieldValue
                            .serverTimestamp()

                }
            );


            return {

                transactionId:

                    transactionId,

                balance:

                    after

            };

        }
    );

}


/*
    =========================================
    DEBIT WALLET
    =========================================
*/

async function debitWallet({

    userId,

    amount,

    category,

    reference,

    description,

    metadata = {}

}) {

    amount =
        Number(amount);


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        throw new Error(
            "Invalid debit amount."
        );

    }


    const walletRef =
        db
            .collection("wallets")
            .doc(userId);


    return db.runTransaction(
        async transaction => {

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


            const before =
                Number(
                    wallet.availableBalance ||
                    0
                );


            if (
                before < amount
            ) {

                throw new Error(
                    "Insufficient wallet balance."
                );

            }


            const after =
                before -
                amount;


            transaction.update(
                walletRef,
                {

                    availableBalance:
                        after,

                    lifetimeSpent:
                        Number(
                            wallet.lifetimeSpent ||
                            0
                        ) +
                        amount,

                    updatedAt:
                        admin
                            .firestore
                            .FieldValue
                            .serverTimestamp()

                }
            );


            const transactionId =
                "WTX-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .substring(2, 8)
                    .toUpperCase();


            const transactionRef =
                db
                    .collection(
                        "walletTransactions"
                    )
                    .doc(
                        transactionId
                    );


            transaction.create(
                transactionRef,
                {

                    transactionId,

                    userId,

                    walletId:
                        userId,

                    type:
                        "DEBIT",

                    category,

                    amount,

                    balanceBefore:
                        before,

                    balanceAfter:
                        after,

                    reference:
                        reference ||
                        null,

                    description:
                        description ||
                        "",

                    status:
                        "COMPLETED",

                    metadata,

                    createdAt:
                        admin
                            .firestore
                            .FieldValue
                            .serverTimestamp()

                }
            );


            return {

                transactionId,

                balance:
                    after

            };

        }
    );

}


module.exports = {

    createWallet,

    createWalletTransaction,

    creditWallet,

    debitWallet

};