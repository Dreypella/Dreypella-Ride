const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();


/*
====================================================
ADMIN AUTHORIZATION
====================================================
*/

async function requireAdmin(context) {

    if (!context.auth) {

        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in."
        );

    }

    const uid = context.auth.uid;

    const adminRef =
        db.collection("admins").doc(uid);

    const adminSnap =
        await adminRef.get();

    if (!adminSnap.exists) {

        throw new functions.https.HttpsError(
            "permission-denied",
            "Admin access is required."
        );

    }

    const adminData =
        adminSnap.data();

    if (adminData.active === false) {

        throw new functions.https.HttpsError(
            "permission-denied",
            "This admin account is disabled."
        );

    }

    return {
        uid,
        ...adminData
    };

}


/*
====================================================
VALIDATE WITHDRAWAL
====================================================
*/

function validateWithdrawalId(withdrawalId) {

    if (
        typeof withdrawalId !== "string" ||
        !withdrawalId.trim()
    ) {

        throw new functions.https.HttpsError(
            "invalid-argument",
            "A valid withdrawal ID is required."
        );

    }

}


/*
====================================================
APPROVE WITHDRAWAL
====================================================
*/

exports.approveWithdrawal =
functions.https.onCall(
    async (data, context) => {

        const adminUser =
            await requireAdmin(context);

        const withdrawalId =
            data.withdrawalId;

        const note =
            typeof data.note === "string"
                ? data.note.trim()
                : "";

        validateWithdrawalId(withdrawalId);

        const withdrawalRef =
            db.collection("withdrawals")
                .doc(withdrawalId);

        try {

            const result =
                await db.runTransaction(
                    async transaction => {

                        const withdrawalSnap =
                            await transaction.get(
                                withdrawalRef
                            );

                        if (!withdrawalSnap.exists) {

                            throw new functions.https.HttpsError(
                                "not-found",
                                "Withdrawal does not exist."
                            );

                        }

                        const withdrawal =
                            withdrawalSnap.data();

                        if (
                            withdrawal.status !==
                            "PENDING"
                        ) {

                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                `Withdrawal is already ${withdrawal.status}.`
                            );

                        }

                        const amount =
                            Number(withdrawal.amount);

                        if (
                            !Number.isFinite(amount) ||
                            amount <= 0
                        ) {

                            throw new functions.https.HttpsError(
                                "invalid-argument",
                                "Invalid withdrawal amount."
                            );

                        }

                        const userId =
                            withdrawal.userId;

                        if (!userId) {

                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                "Withdrawal has no user ID."
                            );

                        }

                        const walletRef =
                            db.collection("wallets")
                                .doc(userId);

                        const walletSnap =
                            await transaction.get(
                                walletRef
                            );

                        if (!walletSnap.exists) {

                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                "User wallet does not exist."
                            );

                        }

                        const wallet =
                            walletSnap.data();

                        const pendingWithdrawal =
                            Number(
                                wallet.pendingWithdrawal || 0
                            );

                        if (
                            pendingWithdrawal < amount
                        ) {

                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                "Withdrawal reservation is invalid."
                            );

                        }

                        /*
                        The money was already removed
                        from availableBalance when the
                        withdrawal was requested.

                        Therefore approval only clears
                        the pending reservation.
                        */

                        transaction.update(
                            walletRef,
                            {

                                pendingWithdrawal:
                                    admin.firestore
                                        .FieldValue
                                        .increment(-amount),

                                lifetimeWithdrawn:
                                    admin.firestore
                                        .FieldValue
                                        .increment(amount),

                                updatedAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp()

                            }
                        );


                        transaction.update(
                            withdrawalRef,
                            {

                                status:
                                    "APPROVED",

                                approvedBy:
                                    adminUser.uid,

                                approvedAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp(),

                                adminNote:
                                    note,

                                updatedAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp()

                            }
                        );


                        const transactionId =
                            withdrawal.transactionId;

                        if (!transactionId) {
                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                "Withdrawal has no linked wallet transaction."
                            );
                        }

                        const transactionRef =
                            db.collection(
                                "walletTransactions"
                            ).doc(transactionId);

                        const transactionSnap =
                            await transaction.get(
                                transactionRef
                            );

                        if (!transactionSnap.exists) {
                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                "Linked wallet transaction does not exist."
                            );
                        }

                        transaction.update(
                            transactionRef,
                            {

                                status:
                                    "APPROVED",

                                performedBy:
                                    adminUser.uid,

                                approvedAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp(),

                                description:
                                    "Wallet withdrawal approved by admin.",

                                updatedAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp()

                            }
                        );


                        const auditRef =
                            db.collection(
                                "adminAuditLogs"
                            ).doc();


                        transaction.set(
                            auditRef,
                            {

                                action:
                                    "APPROVE_WITHDRAWAL",

                                adminId:
                                    adminUser.uid,

                                withdrawalId,

                                userId,

                                amount,

                                note,

                                createdAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp()

                            }
                        );


                        return {

                            withdrawalId,

                            amount,

                            status:
                                "APPROVED"

                        };

                    }
                );


            return {

                success:
                    true,

                ...result

            };

        }
        catch (error) {

            console.error(
                "Approve withdrawal error:",
                error
            );

            if (
                error instanceof
                functions.https.HttpsError
            ) {

                throw error;

            }

            throw new functions.https.HttpsError(
                "internal",
                "Unable to approve withdrawal."
            );

        }

    }
);


/*
====================================================
DECLINE WITHDRAWAL
====================================================
*/

exports.declineWithdrawal =
functions.https.onCall(
    async (data, context) => {

        const adminUser =
            await requireAdmin(context);

        const withdrawalId =
            data.withdrawalId;

        const note =
            typeof data.note === "string"
                ? data.note.trim()
                : "";

        validateWithdrawalId(withdrawalId);

        if (!note) {

            throw new functions.https.HttpsError(
                "invalid-argument",
                "Please provide a reason for declining the withdrawal."
            );

        }

        const withdrawalRef =
            db.collection("withdrawals")
                .doc(withdrawalId);

        try {

            const result =
                await db.runTransaction(
                    async transaction => {

                        const withdrawalSnap =
                            await transaction.get(
                                withdrawalRef
                            );

                        if (!withdrawalSnap.exists) {

                            throw new functions.https.HttpsError(
                                "not-found",
                                "Withdrawal does not exist."
                            );

                        }

                        const withdrawal =
                            withdrawalSnap.data();

                        if (
                            withdrawal.status !==
                            "PENDING"
                        ) {

                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                `Withdrawal is already ${withdrawal.status}.`
                            );

                        }

                        const amount =
                            Number(withdrawal.amount);

                        const userId =
                            withdrawal.userId;

                        if (
                            !userId ||
                            !Number.isFinite(amount) ||
                            amount <= 0
                        ) {

                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                "Invalid withdrawal record."
                            );

                        }

                        const walletRef =
                            db.collection("wallets")
                                .doc(userId);

                        const walletSnap =
                            await transaction.get(
                                walletRef
                            );

                        if (!walletSnap.exists) {

                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                "User wallet does not exist."
                            );

                        }

                        const wallet =
                            walletSnap.data();

                        const pendingWithdrawal =
                            Number(
                                wallet.pendingWithdrawal || 0
                            );

                        if (
                            pendingWithdrawal < amount
                        ) {

                            throw new functions.https.HttpsError(
                                "failed-precondition",
                                "Withdrawal reservation is invalid."
                            );

                        }

                        /*
                        Return the reserved money
                        back to availableBalance.
                        */

                        transaction.update(
                            walletRef,
                            {

                                pendingWithdrawal:
                                    admin.firestore
                                        .FieldValue
                                        .increment(-amount),

                                availableBalance:
                                    admin.firestore
                                        .FieldValue
                                        .increment(amount),

                                updatedAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp()

                            }
                        );


                        transaction.update(
                            withdrawalRef,
                            {

                                status:
                                    "DECLINED",

                                declinedBy:
                                    adminUser.uid,

                                declinedAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp(),

                                adminNote:
                                    note,

                                updatedAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp()

                            }
                        );


                          const linkedTransactionId =
                              withdrawal.transactionId;

                          if (!linkedTransactionId) {
                              throw new functions.https.HttpsError(
                                  "failed-precondition",
                                  "Withdrawal has no linked wallet transaction."
                              );
                          }

                          const linkedTransactionRef =
                              db.collection(
                                  "walletTransactions"
                              ).doc(linkedTransactionId);

                          const linkedTransactionSnap =
                              await transaction.get(
                                  linkedTransactionRef
                              );

                          if (!linkedTransactionSnap.exists) {
                              throw new functions.https.HttpsError(
                                  "failed-precondition",
                                  "Linked wallet transaction does not exist."
                              );
                          }

                          transaction.update(
                              linkedTransactionRef,
                              {

                                  status:
                                      "DECLINED",

                                  performedBy:
                                      adminUser.uid,

                                  declinedAt:
                                      admin.firestore
                                          .FieldValue
                                          .serverTimestamp(),

                                  description:
                                      "Wallet withdrawal declined by admin.",

                                  updatedAt:
                                      admin.firestore
                                          .FieldValue
                                          .serverTimestamp()

                              }
                          );


                        const transactionRef =
                            db.collection(
                                "walletTransactions"
                            ).doc();


                        transaction.set(
                            transactionRef,
                            {

                                transactionId:
                                    transactionRef.id,

                                userId,

                                walletId:
                                    userId,

                                type:
                                    "WITHDRAWAL_REVERSAL",

                                direction:
                                    "CREDIT",

                                amount,

                                status:
                                    "SUCCESS",

                                reference:
                                    withdrawal.withdrawalReference ||
                                    withdrawalId,

                                withdrawalId,

                                description:
                                    "Declined withdrawal funds returned to wallet.",

                                performedBy:
                                    adminUser.uid,

                                createdAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp()

                            }
                        );


                        const auditRef =
                            db.collection(
                                "adminAuditLogs"
                            ).doc();


                        transaction.set(
                            auditRef,
                            {

                                action:
                                    "DECLINE_WITHDRAWAL",

                                adminId:
                                    adminUser.uid,

                                withdrawalId,

                                userId,

                                amount,

                                note,

                                createdAt:
                                    admin.firestore
                                        .FieldValue
                                        .serverTimestamp()

                            }
                        );


                        return {

                            withdrawalId,

                            amount,

                            status:
                                "DECLINED"

                        };

                    }
                );


            return {

                success:
                    true,

                ...result

            };

        }
        catch (error) {

            console.error(
                "Decline withdrawal error:",
                error
            );

            if (
                error instanceof
                functions.https.HttpsError
            ) {

                throw error;

            }

            throw new functions.https.HttpsError(
                "internal",
                "Unable to decline withdrawal."
            );

        }

    }
);
