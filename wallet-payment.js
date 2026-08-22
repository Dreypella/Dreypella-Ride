/*
    =========================================
    DREYPELLA RIDE
    WALLET PAYMENT MODULE
    =========================================
*/


const auth =
    firebase.auth();

const db =
    firebase.firestore();

const functions =
    firebase.functions();



/* =========================================
   ELEMENTS
   ========================================= */

const walletBalance =
    document.getElementById(
        "walletBalance"
    );

const balanceAfter =
    document.getElementById(
        "balanceAfter"
    );

const paymentAmount =
    document.getElementById(
        "paymentAmount"
    );

const paymentTitle =
    document.getElementById(
        "paymentTitle"
    );

const paymentDescription =
    document.getElementById(
        "paymentDescription"
    );

const paymentIcon =
    document.getElementById(
        "paymentIcon"
    );

const itemName =
    document.getElementById(
        "itemName"
    );

const paymentReference =
    document.getElementById(
        "paymentReference"
    );

const paymentMessage =
    document.getElementById(
        "paymentMessage"
    );

const payButton =
    document.getElementById(
        "payButton"
    );

const fundWalletButton =
    document.getElementById(
        "fundWalletButton"
    );

const successModal =
    document.getElementById(
        "successModal"
    );

const successMessage =
    document.getElementById(
        "successMessage"
    );

const continueButton =
    document.getElementById(
        "continueButton"
    );



/* =========================================
   PAYMENT STATE
   ========================================= */

let currentUser = null;

let currentWalletBalance = 0;

let paymentData = null;

let walletListener = null;



/* =========================================
   AUTH
   ========================================= */

auth.onAuthStateChanged(
    function(user) {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        currentUser =
            user;


        initializePayment();

    }
);



/* =========================================
   INITIALIZE
   ========================================= */

function initializePayment() {

    paymentData =
        readPaymentData();


    if (!paymentData) {

        showError(
            "Invalid payment request."
        );

        payButton.disabled =
            true;

        return;

    }


    renderPaymentData();

    listenToWallet();

}



/* =========================================
   READ PAYMENT DATA
   =========================================

   Expected URL example:

   wallet-payment.html?
   type=ride
   &amount=4000
   &reference=DR-BOOK-123
   &item=Ogbomosho%20to%20Ibadan
   &orderId=BOOKING123

*/

function readPaymentData() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const type =
        (
            params.get("type") ||
            ""
        ).toUpperCase();


    const amount =
        Number(
            params.get("amount")
        );


    const reference =
        params.get("reference") ||
        "";


    const item =
        params.get("item") ||
        "Dreypella Payment";


    const orderId =
        params.get("orderId") ||
        "";


    const returnUrl =
        params.get("returnUrl") ||
        "";


    const allowedTypes = [

        "RIDE",

        "DELIVERY",

        "MARKETPLACE"

    ];


    if (
        !allowedTypes.includes(
            type
        )
    ) {

        return null;

    }


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        return null;

    }


    if (
        !reference
    ) {

        return null;

    }


    return {

        type,

        amount,

        reference,

        item,

        orderId,

        returnUrl

    };

}



/* =========================================
   RENDER PAYMENT
   ========================================= */

function renderPaymentData() {

    paymentAmount.textContent =
        formatMoney(
            paymentData.amount
        );


    itemName.textContent =
        paymentData.item;


    paymentReference.textContent =
        paymentData.reference;


    if (
        paymentData.type ===
        "RIDE"
    ) {

        paymentTitle.textContent =
            "Ride Payment";

        paymentDescription.textContent =
            "Pay for your Dreypella ride";

        paymentIcon.textContent =
            "R";

    }


    else if (
        paymentData.type ===
        "DELIVERY"
    ) {

        paymentTitle.textContent =
            "Delivery Payment";

        paymentDescription.textContent =
            "Pay for your delivery";

        paymentIcon.textContent =
            "D";

    }


    else if (
        paymentData.type ===
        "MARKETPLACE"
    ) {

        paymentTitle.textContent =
            "Marketplace Payment";

        paymentDescription.textContent =
            "Pay for your marketplace order";

        paymentIcon.textContent =
            "M";

    }

}



/* =========================================
   WALLET LISTENER
   ========================================= */

function listenToWallet() {

    if (
        walletListener
    ) {

        walletListener();

    }


    walletListener =
        db
            .collection("wallets")
            .doc(currentUser.uid)
            .onSnapshot(

                function(snapshot) {

                    if (
                        !snapshot.exists
                    ) {

                        currentWalletBalance =
                            0;

                        renderBalance();

                        return;

                    }


                    const wallet =
                        snapshot.data();


                    currentWalletBalance =
                        Number(
                            wallet.availableBalance ||
                            0
                        );


                    renderBalance();

                },

                function(error) {

                    console.error(
                        "Wallet error:",
                        error
                    );


                    showError(
                        "Unable to load wallet balance."
                    );

                }

            );

}



/* =========================================
   RENDER BALANCE
   ========================================= */

function renderBalance() {

    walletBalance.textContent =
        formatMoney(
            currentWalletBalance
        );


    const remaining =
        currentWalletBalance -
        paymentData.amount;


    balanceAfter.textContent =
        formatMoney(
            Math.max(
                remaining,
                0
            )
        );


    if (
        currentWalletBalance <
        paymentData.amount
    ) {

        payButton.disabled =
            true;

        fundWalletButton.classList.remove(
            "hidden"
        );


        showError(
            "Insufficient wallet balance. Please fund your wallet before paying."
        );

    }

    else {

        payButton.disabled =
            false;

        fundWalletButton.classList.add(
            "hidden"
        );


        clearMessage();

    }

}



/* =========================================
   PAY WITH WALLET
   ========================================= */

payButton.addEventListener(
    "click",
    payWithWallet
);



async function payWithWallet() {

    if (
        !currentUser ||
        !paymentData
    ) {

        return;

    }


    /*
        Front-end balance check is only
        for user experience.

        The backend MUST check the balance
        again before performing the debit.
    */


    if (
        currentWalletBalance <
        paymentData.amount
    ) {

        showError(
            "Insufficient wallet balance."
        );

        return;

    }


    payButton.disabled =
        true;

    payButton.textContent =
        "PROCESSING...";


    clearMessage();


    try {

        /*
            SERVER-SIDE WALLET PAYMENT

            The callable function must:

            1. Authenticate the user.
            2. Validate amount.
            3. Validate order/booking.
            4. Re-read wallet balance.
            5. Prevent duplicate payment.
            6. Debit wallet atomically.
            7. Create wallet transaction.
            8. Update the related order.
            9. Record platform revenue where applicable.
        */


        const callable =
            functions.httpsCallable(
                "payWithWallet"
            );


        const result =
            await callable({

                paymentType:
                    paymentData.type,

                amount:
                    paymentData.amount,

                reference:
                    paymentData.reference,

                orderId:
                    paymentData.orderId,

                item:
                    paymentData.item

            });


        const response =
            result.data ||
            {};


        if (
            response.success === false
        ) {

            throw new Error(
                response.message ||
                "Payment failed."
            );

        }


        showSuccess(
            response
        );

    }
    catch(error) {

        console.error(
            "Wallet payment error:",
            error
        );


        showError(
            getErrorMessage(
                error
            )
        );

    }
    finally {

        if (
            !successModal ||
            successModal.classList.contains(
                "hidden"
            )
        ) {

            payButton.disabled =
                false;

            payButton.textContent =
                "PAY WITH WALLET";

        }

    }

}



/* =========================================
   SUCCESS
   ========================================= */

function showSuccess(
    response
) {

    const transactionReference =
        response.transactionId ||
        response.reference ||
        paymentData.reference;


    successMessage.textContent =
        `${formatCategory(
            paymentData.type
        )} payment of ${formatMoney(
            paymentData.amount
        )} was successful. Transaction reference: ${transactionReference}.`;


    successModal.classList.remove(
        "hidden"
    );


    payButton.textContent =
        "PAYMENT COMPLETED";


    payButton.disabled =
        true;

}



/* =========================================
   CONTINUE
   ========================================= */

continueButton.addEventListener(
    "click",
    function() {

        if (
            paymentData.returnUrl
        ) {

            window.location.href =
                paymentData.returnUrl;

            return;

        }


        if (
            paymentData.type ===
            "RIDE"
        ) {

            window.location.href =
                "customer-dashboard.html";

        }

        else if (
            paymentData.type ===
            "DELIVERY"
        ) {

            window.location.href =
                "customer-dashboard.html";

        }

        else {

            window.location.href =
                "customer-orders.html";

        }

    }
);



/* =========================================
   FUND WALLET
   ========================================= */

fundWalletButton.addEventListener(
    "click",
    function() {

        const amount =
            Math.max(
                100,
                paymentData.amount -
                currentWalletBalance
            );


        window.location.href =
            "customer-wallet.html" +
            "?fundAmount=" +
            encodeURIComponent(
                Math.ceil(
                    amount
                )
            );

    }
);



/* =========================================
   MESSAGE
   ========================================= */

function showError(
    message
) {

    paymentMessage.textContent =
        message;

    paymentMessage.className =
        "payment-message error";

}


function clearMessage() {

    paymentMessage.textContent =
        "";

    paymentMessage.className =
        "payment-message";

}



/* =========================================
   CATEGORY
   ========================================= */

function formatCategory(
    type
) {

    const names = {

        RIDE:
            "Ride",

        DELIVERY:
            "Delivery",

        MARKETPLACE:
            "Marketplace"

    };


    return (
        names[type] ||
        "Wallet"
    );

}



/* =========================================
   MONEY
   ========================================= */

function formatMoney(
    amount
) {

    return "₦" +
        Number(
            amount || 0
        ).toLocaleString(
            "en-NG",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}



/* =========================================
   ERROR
   ========================================= */

function getErrorMessage(
    error
) {

    if (
        error &&
        error.message
    ) {

        return error.message;

    }


    return (
        "Payment could not be completed. Please try again."
    );

}



/* =========================================
   CLEANUP
   ========================================= */

window.addEventListener(
    "beforeunload",
    function() {

        if (
            walletListener
        ) {

            walletListener();

        }

    }
);