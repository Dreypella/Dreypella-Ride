const admin =
    require("firebase-admin");


const {
    onCall,
    HttpsError
} =
    require("firebase-functions/v2/https");


admin.initializeApp();



const {
    payWithWallet
} =
    require(
        "./wallet/walletPayments"
    );


const {
    requestWalletWithdrawal
} =
    require(
        "./wallet/walletWithdrawals"
    );



/*
    =========================================
    PAY WITH WALLET
    =========================================
*/

exports.payWithWallet =
    onCall(
        async request => {

            try {

                return await payWithWallet(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "payWithWallet error:",
                    error
                );


                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Wallet payment failed."
                );

            }

        }
    );



/*
    =========================================
    REQUEST WITHDRAWAL
    =========================================
*/

exports.requestWalletWithdrawal =
    onCall(
        async request => {

            try {

                return await requestWalletWithdrawal(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "Withdrawal error:",
                    error
                );


                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Withdrawal request failed."
                );

            }

        }
    );