const admin = require("firebase-admin");

const {
    verifyBankAccount
} = require("./bankFunctions");

const {

    db,

    money,

    generateTransactionReference,

    generateIdempotencyKey

} = require("./walletHelpers");



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



    const accountNumber =
        String(
            data.accountNumber || ""
        ).trim();



    const bankCode =
        String(
            data.bankCode || ""
        ).trim();

      const bankName =
        String(
            data.bankName || ""
        ).trim();

    const withdrawalRequestId =
          String(
              data.withdrawalRequestId || ""
          ).trim();



    if (!/^\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\}?$/.test(withdrawalRequestId)) {
    throw new Error(
        "Invalid withdrawal request ID."
    );
}

if (
        amount <= 0
    ) {

        throw new Error(
            "Invalid withdrawal amount."
        );

    }


    if (
        !accountNumber
    ) {

        throw new Error(
            "Account number is required."
        );

    }


    if (!bankCode) {

        throw new Error(
            "Bank code is required."
        );

    }

    if (!bankName) {
        throw new Error(
            "Bank name is required."
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



    let verifiedAccount;

    try {

        verifiedAccount =
            await verifyBankAccount(
                bankCode,
                accountNumber
            );

    }
    catch(error) {

        throw new Error(
            error.message ||
            "Unable to verify bank account."
        );

    }

    const verifiedAccountName =
        String(
            verifiedAccount.accountName || ""
        ).trim();

    if (!verifiedAccountName) {

        throw new Error(
            "Paystack could not verify this bank account."
        );

    }

    const idempotencyKey =
    generateIdempotencyKey(
        uid,
        withdrawalRequestId
    );

const walletRef =
        db
            .collection("wallets")
            .doc(uid);


    const withdrawalRef =
        db
            .collection("withdrawals")
            .doc(idempotencyKey);


    const transactionRef =
        db
            .collection("walletTransactions")
            .doc(idempotencyKey);


    const withdrawalReference =
        generateTransactionReference(
            "DR-WD"
        );



    const transactionResult =
        await db.runTransaction(
            async transaction => {

            const walletSnapshot =
                await transaction.get(
                    walletRef
                );

              const existingTransaction =
                  await transaction.get(
                      transactionRef
                  );

              if (existingTransaction.exists) {
    const existingData =
        existingTransaction.data();

    return {
        success: true,
        alreadyProcessed: true,
        withdrawalId:
            existingData.withdrawalId,
        withdrawalReference:
            existingData.reference,
        status:
            existingData.status
    };
}




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


                    transactionId:
                        transactionRef.id,
                    userId:
                        uid,

                    amount,

                    bankCode,

                    bankName,

                    accountNumber,

                    accountName:
                        verifiedAccountName,

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

                      withdrawalRequestId,

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


    if (transactionResult?.alreadyProcessed) {
        return transactionResult;
    }

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
