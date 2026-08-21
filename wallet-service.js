/*
    =========================================
    DREYPELLA RIDE
    UNIFIED WALLET SERVICE
    =========================================
*/


const walletService = {


    /*
        =====================================
        GET WALLET
        =====================================
    */

    async getWallet(userId) {

        if (!userId) {

            throw new Error(
                "User ID is required."
            );

        }

        const snapshot =
            await db
                .collection("wallets")
                .doc(userId)
                .get();


        if (
            !snapshot.exists
        ) {

            return null;

        }


        return {

            id: snapshot.id,

            ...snapshot.data()

        };

    },


    /*
        =====================================
        GET TRANSACTIONS
        =====================================
    */

    async getTransactions(
        userId,
        limit = 30
    ) {

        if (!userId) {

            throw new Error(
                "User ID is required."
            );

        }


        const snapshot =
            await db
                .collection(
                    "walletTransactions"
                )
                .where(
                    "userId",
                    "==",
                    userId
                )
                .orderBy(
                    "createdAt",
                    "desc"
                )
                .limit(
                    limit
                )
                .get();


        const transactions = [];


        snapshot.forEach(
            function(doc) {

                transactions.push({

                    id: doc.id,

                    ...doc.data()

                });

            }
        );


        return transactions;

    },


    /*
        =====================================
        REQUEST WALLET FUNDING
        =====================================
    */

    async requestFunding(
        amount
    ) {

        amount =
            normalizeMoney(
                amount
            );


        if (
            amount <= 0
        ) {

            throw new Error(
                "Funding amount must be greater than zero."
            );

        }


        /*
            Payment gateway integration
            will create the actual payment.

            The wallet must NOT be credited
            simply because this function was
            called.
        */

        const callable =
            firebase
                .functions()
                .httpsCallable(
                    "initializeWalletFunding"
                );


        return callable({

            amount:
                amount

        });

    },


    /*
        =====================================
        REQUEST WITHDRAWAL
        =====================================
    */

    async requestWithdrawal(
        amount,
        bankDetails
    ) {

        amount =
            normalizeMoney(
                amount
            );


        if (
            amount <= 0
        ) {

            throw new Error(
                "Withdrawal amount must be greater than zero."
            );

        }


        if (
            !bankDetails ||
            !bankDetails.accountNumber ||
            !bankDetails.bankCode
        ) {

            throw new Error(
                "Complete bank details are required."
            );

        }


        const callable =
            firebase
                .functions()
                .httpsCallable(
                    "requestWalletWithdrawal"
                );


        return callable({

            amount:
                amount,

            bankDetails:
                bankDetails

        });

    }

};