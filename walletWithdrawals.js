const admin = require("firebase-admin");

const {

    db,

    money,

    generateTransactionReference

} = require("../utils/walletHelpers");



async function requestWalletWithdrawal(
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


    const amount =
        money(
            data.amount
        );


    const bankName =
        String(
            data.bankName || ""
        ).trim();


    const accountNumber =
        String(
            data.accountNumber || ""
        ).trim();


    const accountName =
        String(
            data.accountName || ""
        ).trim();


    const bankCode =
        String(
            data.bankCode || ""
        ).trim();



    if (
        amount <= 0
    ) {

        throw new Error(
            "Invalid withdrawal amount."
        );

    }


    if (
        !bankName ||
        !accountNumber ||
        !accountName
    ) {

        throw new Error(
            "Complete bank details are required."
        );

    }


    if (
        !/^\d{10}$/.test(
            accountNumber
        )
    ) {

        throw new Error(
            "Account number must contain 10 digits."
        );

    }



    const walletRef =
        db
            .collection("wallets")
            .doc(uid);


    const withdrawalRef =
        db
            .collection("withdrawals")
            .doc();


    const transactionRef =
        db
            .collection("walletTransactions")
            .doc();


    const withdrawalReference =
        generateTransactionReference(
            "DR-WD"
        );



    await db.runTransaction(
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


            /*
                Reserve the money immediately.

                It is no longer available to
                the customer while Admin reviews
                the withdrawal.
            */


            transaction.update(
                walletRef,
                {

                    availableBalance:
                        newBalance,

                    pendingWithdrawal:
                        money(
                            (
                                wallet.pendingWithdrawal ||
                                0
                            ) + amount
                        ),

                    updatedAt:
                        admin.firestore
                            .FieldValue
                            .serverTimestamp()

                }
            );


            /*
                Withdrawal request.
            */

            transaction.set(
                withdrawalRef,
                {

                    withdrawalReference,

                    userId:
                        uid,

                    amount,

                    bankName,

                    bankCode,

                    accountNumber,

                    accountName,

                    status:
                        "PENDING",

                    adminDecision:
                        null,

                    adminId:
                        null,

                    adminNote:
                        "",

                    createdAt:
                        admin.firestore
                            .FieldValue
                            .serverTimestamp()

                }
            );


            /*
                Wallet transaction.
            */

            transaction.set(
                transactionRef,
                {

                    transactionId:
                        transactionRef.id,

                    userId:
                        uid,

                    type:
                        "WITHDRAWAL",

                    direction:
                        "DEBIT",

                    amount,

                    status:
                        "PENDING",

                    reference:
                        withdrawalReference,

                    withdrawalId:
                        withdrawalRef.id,

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

        }
    );


    return {

        success:
            true,

        withdrawalId:
            withdrawalRef.id,

        withdrawalReference,

        status:
            "PENDING"

    };

}



module.exports = {

    requestWalletWithdrawal

};