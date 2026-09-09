/*
    DREYPELLA RIDE
    RECEIVER PAYMENT PAGE

    Public payment page.

    Authentication is NOT required.

    The secure payment token in the URL is the
    credential used to access the payment request.

    Example:

    receiver-payment.html?token=SECURE_TOKEN
*/


const paymentMessage =
    document.getElementById(
        "paymentMessage"
    );


const payButton =
    document.getElementById(
        "payButton"
    );


const bookingReferenceElement =
    document.getElementById(
        "bookingReference"
    );


const pickupText =
    document.getElementById(
        "pickupText"
    );


const destinationText =
    document.getElementById(
        "destinationText"
    );


const methodText =
    document.getElementById(
        "methodText"
    );


const distanceText =
    document.getElementById(
        "distanceText"
    );


const recipientText =
    document.getElementById(
        "recipientText"
    );


const priceText =
    document.getElementById(
        "priceText"
    );


const statusText =
    document.getElementById(
        "statusText"
    );


const functions =
    firebase.functions();


/*
    GET SECURE PAYMENT TOKEN
*/


const urlParams =
    new URLSearchParams(
        window.location.search
    );


const paymentToken =
    urlParams.get(
        "token"
    );


/*
    INITIAL PAGE STATE
*/


if (!paymentToken) {

    showError(
        "This payment link is missing its secure payment token."
    );

}
else if (
    paymentToken.length < 32
) {

    showError(
        "This payment link is invalid."
    );

}
else {

    loadPaymentRequest();

}


/*
    LOAD PAYMENT REQUEST
*/


async function loadPaymentRequest() {

    payButton.disabled =
        true;

    payButton.textContent =
        "LOADING PAYMENT...";

    paymentMessage.textContent =
        "";

    statusText.textContent =
        "Loading payment request...";


    try {

        const getPaymentRequest =
            functions.httpsCallable(
                "getReceiverPaymentRequest"
            );


        const result =
            await getPaymentRequest({
                token:
                    paymentToken
            });


        const data =
            result.data;


        if (
            !data ||
            !data.success
        ) {

            throw new Error(
                "Unable to load this payment request."
            );

        }


        /*
            Store only the limited response
            needed by this page.

            The amount comes from the secure
            backend response, not from the URL.
        */


        renderPaymentRequest(
            data
        );


    }
    catch(error) {

        console.error(
            "Receiver payment request error:",
            error
        );


        showError(
            getErrorMessage(
                error
            )
        );

    }

}


/*
    DISPLAY PAYMENT REQUEST
*/


function renderPaymentRequest(
    data
) {

    bookingReferenceElement.textContent =
        data.bookingReference ||
        "—";


    pickupText.textContent =
        data.pickup?.name ||
        "Pickup location";


    destinationText.textContent =
        data.destination?.name ||
        "Destination";


    methodText.textContent =
        formatMethod(
            data.method
        );


    distanceText.textContent =
        Number.isFinite(
            Number(
                data.distanceKm
            )
        )
            ? Number(
                data.distanceKm
            ) + " km"
            : "—";


    recipientText.textContent =
        data.recipientName ||
        "—";


    priceText.textContent =
        formatCurrency(
            data.amount
        );


    if (
        data.alreadyPaid === true ||
        data.status === "PAID"
    ) {

        statusText.textContent =
            "Payment completed";


        paymentMessage.textContent =
            "This delivery has already been paid.";


        payButton.disabled =
            true;


        payButton.textContent =
            "PAYMENT COMPLETED";


        return;

    }


    statusText.textContent =
        "Payment pending";


    paymentMessage.textContent =
        "Review the delivery details, then continue to secure payment.";


    payButton.disabled =
        false;


    payButton.textContent =
        "PAY NOW";

}


/*
    PAY BUTTON
*/


payButton.addEventListener(
    "click",
    startPayment
);


/*
    START RECEIVER PAYMENT
*/


async function startPayment() {

    if (!paymentToken) {

        showError(
            "This payment link is invalid."
        );

        return;

    }


    payButton.disabled =
        true;

    payButton.textContent =
        "CONNECTING TO PAYMENT...";

    paymentMessage.textContent =
        "Preparing secure payment...";


    try {

        const initializePayment =
            functions.httpsCallable(
                "initializeReceiverPayment"
            );


        const result =
            await initializePayment({
                token:
                    paymentToken
            });


        const data =
            result.data;


        if (
            !data ||
            !data.authorizationUrl
        ) {

            throw new Error(
                "Unable to initialize receiver payment."
            );

        }


        /*
            Paystack now handles the
            actual payment.

            We do NOT mark the delivery
            as paid from the browser.
        */


        window.location.href =
            data.authorizationUrl;

    }
    catch(error) {

        console.error(
            "Receiver payment initialization error:",
            error
        );


        showError(
            getErrorMessage(
                error
            )
        );

    }

}


/*
    ERROR MESSAGE
*/


function getErrorMessage(
    error
) {

    if (
        error &&
        error.message
    ) {

        return error.message;

    }


    return "Unable to process this payment request.";

}


/*
    ERROR DISPLAY
*/


function showError(
    message
) {

    statusText.textContent =
        "Payment unavailable";


    paymentMessage.textContent =
        message;


    payButton.disabled =
        true;


    payButton.textContent =
        "PAYMENT UNAVAILABLE";

}


/*
    CURRENCY
*/


function formatCurrency(
    amount
) {

    const numericAmount =
        Number(
            amount
        );


    if (
        !Number.isFinite(
            numericAmount
        )
    ) {

        return "₦0";

    }


    return "₦" +
        numericAmount.toLocaleString(
            "en-NG"
        );

}


/*
    METHOD
*/


function formatMethod(
    method
) {

    const methods = {

        WALKER:
            "Walker",

        RIDER:
            "Rider",

        VEHICLE:
            "Vehicle"

    };


    return methods[
        method
    ] ||
        "Delivery Partner";

}
