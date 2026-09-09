const admin =
    require("firebase-admin");

const {
    db,
    money,
    generateTransactionReference,
    assertPositiveAmount
} = require("./walletHelpers");

const {
    paystackRequest
} = require("./paystack");

const {
    FieldValue
} = admin.firestore;


/*
    =========================================
    WALLET FUNDING
    PAYSTACK
    =========================================
*/


async function initializeWalletFunding(
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
        assertPositiveAmount(
            data?.amount
        );

    if (amount < 100) {
        throw new Error(
            "Minimum wallet funding is ₦100."
        );
    }

    const walletRef =
        db
            .collection("wallets")
            .doc(uid);

    const walletSnapshot =
        await walletRef.get();

    if (!walletSnapshot.exists) {
        throw new Error(
            "Wallet does not exist."
        );
    }

    const wallet =
        walletSnapshot.data();

    if (
        wallet.status &&
        wallet.status !== "ACTIVE"
    ) {
        throw new Error(
            "Wallet is not active."
        );
    }

    if (
        wallet.currency &&
        wallet.currency !== "NGN"
    ) {
        throw new Error(
            "Wallet currency is not supported."
        );
    }

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

    const reference =
        generateTransactionReference(
            "DR-FUND"
        );

    const amountKobo =
        Math.round(
            amount * 100
        );

    const fundingRef =
        db
            .collection("walletFundings")
            .doc(reference);

    await fundingRef.create({

        userId:
            uid,

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

        walletId:
            uid,

        createdAt:
            FieldValue.serverTimestamp(),

        updatedAt:
            FieldValue.serverTimestamp()

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
                            "https://dreypella.github.io/Dreypella-Ride/wallet-funding-success.html",

                        metadata: {
                            userId:
                                uid,

                            walletId:
                                uid,

                            type:
                                "WALLET_FUNDING"
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

        await fundingRef.update({

            authorizationUrl:
                authorizationUrl,

            accessCode:
                accessCode || null,

            updatedAt:
                FieldValue.serverTimestamp()

        });

        return {

            success:
                true,

            reference:
                reference,

            authorizationUrl:
                authorizationUrl

        };

    }
    catch(error) {

        await fundingRef.update({

            status:
                "FAILED",

            failureReason:
                error.message ||
                "Payment initialization failed.",

            updatedAt:
                FieldValue.serverTimestamp()

        });

        throw error;
    }
}


/*
    =========================================
    VERIFY WALLET FUNDING
    =========================================
*/


async function verifyWalletFunding(
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

    const fundingRef =
        db
            .collection("walletFundings")
            .doc(reference);

    const fundingSnapshot =
        await fundingRef.get();

    if (!fundingSnapshot.exists) {
        throw new Error(
            "Wallet funding record was not found."
        );
    }

    const funding =
        fundingSnapshot.data();

    if (
        funding.userId !== uid
    ) {
        throw new Error(
            "You cannot verify this payment."
        );
    }

    if (
        funding.status === "COMPLETED"
    ) {

        return {

            success:
                true,

            alreadyProcessed:
                true,

            reference:
                reference,

            amount:
                money(
                    funding.amount
                ),

            status:
                "COMPLETED",

            transactionId:
                funding.walletTransactionId ||
                null

        };
    }

    if (
        funding.status === "FAILED"
    ) {
        throw new Error(
            "This wallet funding attempt has failed."
        );
    }

    const result =
        await paystackRequest(
            `/transaction/verify/${encodeURIComponent(reference)}`
        );

    const payment =
        result.data;

    if (!payment) {
        throw new Error(
            "Paystack returned no payment data."
        );
    }

    if (
        payment.status !== "success"
    ) {
        throw new Error(
            "Paystack payment has not been completed."
        );
    }

    if (
        String(
            payment.reference ||
            ""
        ) !== reference
    ) {
        throw new Error(
            "Payment reference does not match."
        );
    }

    if (
        String(
            payment.currency ||
            ""
        ).toUpperCase() !== "NGN"
    ) {
        throw new Error(
            "Payment currency does not match the wallet currency."
        );
    }

    const expectedAmountKobo =
        Number(
            funding.amountKobo
        );

    const paidAmountKobo =
        Number(
            payment.amount
        );

    if (
        !Number.isFinite(
            expectedAmountKobo
        ) ||
        !Number.isFinite(
            paidAmountKobo
        ) ||
        paidAmountKobo !==
            expectedAmountKobo
    ) {
        throw new Error(
            "Payment amount does not match the wallet funding amount."
        );
    }

    const walletRef =
        db
            .collection("wallets")
            .doc(uid);

    const transactionId =
        `WF-${reference}`;

    const walletTransactionRef =
        db
            .collection(
                "walletTransactions"
            )
            .doc(transactionId);

    const resultData =
        await db.runTransaction(
            async transaction => {

                const currentFunding =
                    await transaction.get(
                        fundingRef
                    );

                const currentWallet =
                    await transaction.get(
                        walletRef
                    );

                const existingTransaction =
                    await transaction.get(
                        walletTransactionRef
                    );

                if (
                    !currentFunding.exists
                ) {
                    throw new Error(
                        "Wallet funding record was not found."
                    );
                }

                const current =
                    currentFunding.data();

                if (
                    current.userId !== uid
                ) {
                    throw new Error(
                        "You cannot verify this payment."
                    );
                }

                if (
                    current.status ===
                    "COMPLETED"
                ) {

                    return {

                        alreadyProcessed:
                            true,

                        balance:
                            money(
                                current.balanceAfter
                            ),

                        transactionId:
                            current.walletTransactionId ||
                            transactionId

                    };
                }

                if (
                    !currentWallet.exists
                ) {
                    throw new Error(
                        "Wallet does not exist."
                    );
                }

                const wallet =
                    currentWallet.data();

                if (
                    wallet.status &&
                    wallet.status !== "ACTIVE"
                ) {
                    throw new Error(
                        "Wallet is not active."
                    );
                }

                const before =
                    money(
                        wallet.availableBalance
                    );

                const amount =
                    money(
                        current.amount
                    );

                const after =
                    money(
                        before +
                        amount
                    );

                if (
                    existingTransaction.exists
                ) {

                    const existing =
                        existingTransaction.data();

                    const existingBalanceAfter =
                        money(
                            existing.balanceAfter
                        );

                    if (
                        existing.status !==
                        "COMPLETED"
                    ) {
                        throw new Error(
                            "Existing wallet transaction is not completed."
                        );
                    }

                    transaction.update(
                        fundingRef,
                        {

                            status:
                                "COMPLETED",

                            walletTransactionId:
                                transactionId,

                            balanceBefore:
                                existing.balanceBefore ??
                                before,

                            balanceAfter:
                                existingBalanceAfter,

                            paystackStatus:
                                payment.status,

                            paystackTransactionId:
                                payment.id ||
                                null,

                            completedAt:
                                FieldValue.serverTimestamp(),

                            updatedAt:
                                FieldValue.serverTimestamp()

                        }
                    );

                    return {

                        alreadyProcessed:
                            true,

                        balance:
                            existingBalanceAfter,

                        transactionId:
                            transactionId

                    };
                }

                transaction.update(
                    walletRef,
                    {

                        availableBalance:
                            after,

                        lifetimeEarned:
                            money(
                                wallet.lifetimeEarned
                            ) +
                            amount,

                        updatedAt:
                            FieldValue.serverTimestamp()

                    }
                );

                transaction.create(
                    walletTransactionRef,
                    {

                        transactionId:
                            transactionId,

                        userId:
                            uid,

                        walletId:
                            uid,

                        type:
                            "CREDIT",

                        category:
                            "WALLET_FUNDING",

                        amount:
                            amount,

                        balanceBefore:
                            before,

                        balanceAfter:
                            after,

                        reference:
                            reference,

                        description:
                            "Wallet funded through Paystack.",

                        status:
                            "COMPLETED",

                        metadata: {

                            paymentGateway:
                                "PAYSTACK",

                            paystackTransactionId:
                                payment.id ||
                                null,

                            paystackStatus:
                                payment.status,

                            channel:
                                payment.channel ||
                                null

                        },

                        createdAt:
                            FieldValue.serverTimestamp()

                    }
                );

                transaction.update(
                    fundingRef,
                    {

                        status:
                            "COMPLETED",

                        walletTransactionId:
                            transactionId,

                        balanceBefore:
                            before,

                        balanceAfter:
                            after,

                        paystackStatus:
                            payment.status,

                        paystackTransactionId:
                            payment.id ||
                            null,

                        completedAt:
                            FieldValue.serverTimestamp(),

                        updatedAt:
                            FieldValue.serverTimestamp()

                    }
                );

                return {

                    alreadyProcessed:
                        false,

                    balance:
                        after,

                    transactionId:
                        transactionId

                };
            }
        );

    return {

        success:
            true,

        alreadyProcessed:
            resultData.alreadyProcessed,

        reference:
            reference,

        amount:
            money(
                funding.amount
            ),

        status:
            "COMPLETED",

        transactionId:
            resultData.transactionId,

        balance:
            resultData.balance

    };
}


module.exports = {

    initializeWalletFunding,

    verifyWalletFunding

};
