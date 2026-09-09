const admin =
    require("firebase-admin");


const {
    onCall,
    HttpsError
} =
    require("firebase-functions/v2/https");





const {
    payWithWallet
} =
    require(
        "./walletPayments"
    );


const {
    requestWalletWithdrawal
} =
    require(
        "./walletWithdrawals"
    );

const {
    approveWithdrawal,
    declineWithdrawal
} =
    require(
        "./adminWithdrawals"
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
                    "Wallet payment failed.",
                    {
                        code:
                            error.code ||
                            "WALLET_PAYMENT_FAILED",
                        shortfall:
                            error.shortfall || null,
                        walletBalance:
                            error.walletBalance || null,
                        requiredAmount:
                            error.requiredAmount || null
                    }
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

/*
    =========================================
    VERIFY BANK ACCOUNT
    =========================================
*/

const {
    verifyBankAccount: resolveBankAccount
} = require("./bankFunctions");

exports.verifyBankAccount =
    onCall(
        async request => {

            if (!request.auth) {

                throw new HttpsError(
                    "unauthenticated",
                    "You must be logged in."
                );

            }

            const bankCode =
                String(
                    request.data?.bankCode || ""
                ).trim();

            const accountNumber =
                String(
                    request.data?.accountNumber || ""
                ).trim();

            if (!bankCode) {

                throw new HttpsError(
                    "invalid-argument",
                    "Bank code is required."
                );

            }

            if (
                !/^\d{10}$/.test(
                    accountNumber
                )
            ) {

                throw new HttpsError(
                    "invalid-argument",
                    "Account number must contain 10 digits."
                );

            }

            try {

                const result =
                    await resolveBankAccount(
                        bankCode,
                        accountNumber
                    );

                return {
                    success: true,
                    accountName:
                        result.accountName
                };

            }
            catch(error) {

                console.error(
                    "Bank account verification error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to verify bank account."
                );

            }

        }
    );

/*
    =========================================
    WALLET FUNDING
    PAYSTACK
    =========================================
*/

const {
    initializeWalletFunding,
    verifyWalletFunding
} = require("./walletFunding");

/*
    =========================================
    RIDE PAYMENTS
    PAYSTACK
    =========================================
*/

const {
    initializeRidePayment,
    verifyRidePayment
} = require("./ridePayments");

const {
    reserveRideForPayOnDeparture
} = require("./rideReservations");

exports.initializeRidePayment =
    onCall(
        async request => {

            try {
                return await initializeRidePayment(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {
                console.error(
                    "Ride payment initialization error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to initialize ride payment."
                );
            }
        }
    );


exports.verifyRidePayment =
    onCall(
        async request => {

            try {
                return await verifyRidePayment(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {
                console.error(
                    "Ride payment verification error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to verify ride payment."
                );
            }
        }
    );


exports.reserveRideForPayOnDeparture =
    onCall(
        async request => {

            try {
                return await reserveRideForPayOnDeparture(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {
                console.error(
                    "Ride pay on departure reservation error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to reserve ride for pay on departure."
                );
            }
        }
    );


exports.initializeWalletFunding =
    onCall(
        async request => {

            try {

                return await initializeWalletFunding(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "Wallet funding initialization error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to initialize wallet funding."
                );

            }

        }
    );


exports.verifyWalletFunding =
    onCall(
        async request => {

            try {

                return await verifyWalletFunding(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "Wallet funding verification error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to verify wallet funding."
                );

            }

        }
    );


/*
    =========================================
    DELIVERY PAYMENTS
    PAYSTACK
    SENDER PAYS
    =========================================
*/

const {
    initializeDeliveryPayment,
    verifyDeliveryPayment
} =
    require("./deliveryPayments");


exports.initializeDeliveryPayment =
    onCall(
        async request => {

            try {

                return await initializeDeliveryPayment(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "Delivery payment initialization error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to initialize delivery payment."
                );

            }

        }
    );


exports.verifyDeliveryPayment =
    onCall(
        async request => {

            try {

                return await verifyDeliveryPayment(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "Delivery payment verification error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to verify delivery payment."
                );

            }

        }
    );

/*
    =========================================
    RECEIVER PAYMENT REQUESTS
    PUBLIC RECEIVER PAYMENT FLOW
    =========================================
*/

const {
    createReceiverPaymentRequest,
    getReceiverPaymentRequest,
    initializeReceiverPayment,
    verifyReceiverPayment
} =
    require("./receiverPayments");


/*
    AUTHENTICATED SENDER
    CREATES SECURE RECEIVER PAYMENT LINK
*/

exports.createReceiverPaymentRequest =
    onCall(
        async request => {

            try {

                return await createReceiverPaymentRequest(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "Receiver payment request creation error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to create receiver payment request."
                );

            }

        }
    );


/*
    PUBLIC RECEIVER ACCESS

    Authentication is NOT required.

    The secure payment token is the credential.
*/

exports.getReceiverPaymentRequest =
    onCall(
        async request => {

            try {

                return await getReceiverPaymentRequest(
                    request.data || {}
                );

            }
            catch(error) {

                console.error(
                    "Receiver payment request lookup error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to load receiver payment request."
                );

            }

        }
    );


exports.initializeReceiverPayment =
    onCall(
        async request => {

            try {

                return await initializeReceiverPayment(
                    request.data || {}
                );

            }
            catch(error) {

                console.error(
                    "Receiver payment initialization error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to initialize receiver payment."
                );

            }

        }
    );


exports.verifyReceiverPayment =
    onCall(
        async request => {

            try {

                return await verifyReceiverPayment(
                    request.data || {}
                );

            }
            catch(error) {

                console.error(
                    "Receiver payment verification error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to verify receiver payment."
                );

            }

        }
    );



/*
    =========================================
    DELIVERY ASSIGNMENT
    PARTNER ACCEPTS DELIVERY
    =========================================
*/

const {
    acceptDelivery
} = require("./deliveryAssignment");


exports.acceptDelivery =
    onCall(
        async request => {

            try {

                return await acceptDelivery(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "Delivery acceptance error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to accept delivery."
                );

            }

        }
    );



/*
    =========================================
    AVAILABLE DELIVERIES
    PARTNER MATCHING
    =========================================
*/

const {
    getAvailableDeliveries
} = require("./deliveryAssignment");


exports.getAvailableDeliveries =
    onCall(
        async request => {

            try {

                return await getAvailableDeliveries(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "Available deliveries error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to load available deliveries."
                );

            }

        }
    );


/*
    =========================================
    PARTNER LOCATION
    ONLINE / OFFLINE
    AVAILABILITY
    =========================================
*/

const {
    updatePartnerLocation
} = require("./partnerLocation");


exports.updatePartnerLocation =
    onCall(
        async request => {

            try {

                return await updatePartnerLocation(
                    request.data,
                    {
                        auth:
                            request.auth
                    }
                );

            }
            catch(error) {

                console.error(
                    "Partner location update error:",
                    error
                );

                throw new HttpsError(
                    "failed-precondition",
                    error.message ||
                    "Unable to update partner location."
                );

            }

        }
    );
