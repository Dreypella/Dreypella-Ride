/*
    DREYPELLA RIDE
    RECEIVER PAYMENT PAGE

    This page reads the delivery booking
    reference from the URL.

    Example:

    receiver-payment.html?booking=DR-12345678-123
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


/*
    GET BOOKING REFERENCE
*/

const urlParams =
    new URLSearchParams(
        window.location.search
    );


const bookingReference =
    urlParams.get(
        "booking"
    );


/*
    GET STORED BOOKING

    This is useful while developing
    the application in TrebEdit.

    In production, the booking should
    be retrieved from Firestore using
    a secure backend.
*/

let bookingData =
    JSON.parse(
        localStorage.getItem(
            "dreypellaDeliveryBooking"
        )
    );


/*
    CHECK BOOKING
*/

if (!bookingReference) {

    showError(
        "This payment link is missing a booking reference."
    );

} else if (!bookingData) {

    showError(
        "This delivery payment request could not be found."
    );

} else if (
    bookingData.bookingReference !==
    bookingReference
) {

    showError(
        "This payment request does not match the delivery."
    );

} else {

    loadBooking();

}


/*
    LOAD BOOKING
*/

function loadBooking() {

    bookingReferenceElement.textContent =
        bookingData.bookingReference;


    pickupText.textContent =
        bookingData.pickup?.name ||
        "Pickup location";


    destinationText.textContent =
        bookingData.destination?.name ||
        "Destination";


    methodText.textContent =
        formatMethod(
            bookingData.method
        );


    distanceText.textContent =
        bookingData.distanceKm
            ? bookingData.distanceKm +
              " km"
            : "—";


    recipientText.textContent =
        bookingData.recipientName ||
        "—";


    priceText.textContent =
        formatCurrency(
            bookingData.customerPrice
        );


    /*
        Check current payment status.
    */

    if (
        bookingData.paymentStatus ===
        "PAID"
    ) {

        statusText.textContent =
            "Payment completed";

        payButton.textContent =
            "PAYMENT COMPLETED";

        payButton.disabled =
            true;

    }

}


/*
    PAY BUTTON
*/

payButton.addEventListener(
    "click",
    startPayment
);


/*
    START PAYMENT
*/

function startPayment() {

    if (!bookingData) {

        showError(
            "Delivery information is unavailable."
        );

        return;
    }


    if (
        bookingData.paymentStatus ===
        "PAID"
    ) {

        return;
    }


    /*
        Make sure this is a receiver-payment
        request.
    */

    if (
        bookingData.payer !==
        "RECEIVER"
    ) {

        showError(
            "This delivery is not configured for receiver payment."
        );

        return;
    }


    /*
        Prevent duplicate clicks.
    */

    payButton.disabled =
        true;


    payButton.textContent =
        "CONNECTING TO PAYMENT...";


    paymentMessage.textContent =
        "";


    /*
        IMPORTANT:

        This is where the real payment provider
        will be connected.

        DO NOT mark payment as PAID here.

        The payment provider must confirm the
        transaction through your backend.
    */


    createPaymentRequest();

}


/*
    CREATE PAYMENT REQUEST
*/

function createPaymentRequest() {

    /*
        DEVELOPMENT VERSION

        For now, create a payment reference.

        Later this should call:

        Firebase Cloud Function
                  ↓
        Payment Provider
                  ↓
        Payment Checkout
    */


    const paymentReference =
        generatePaymentReference();


    bookingData.paymentReference =
        paymentReference;


    bookingData.paymentStatus =
        "PROCESSING";


    bookingData.status =
        "PAYMENT_PROCESSING";


    bookingData.paymentStartedAt =
        new Date().toISOString();


    localStorage.setItem(
        "dreypellaDeliveryBooking",
        JSON.stringify(
            bookingData
        )
    );


    /*
        IMPORTANT:

        Do NOT change this to PAID manually.

        The next page is a payment-provider
        checkout page when the real provider
        is connected.
    */


    /*
        For now we show a development
        message instead of pretending
        payment succeeded.
    */

    showDevelopmentMessage(
        paymentReference
    );

}


/*
    DEVELOPMENT MESSAGE
*/

function showDevelopmentMessage(
    paymentReference
) {

    paymentMessage.innerHTML =
        "Payment gateway is ready for integration.<br>" +
        "Payment Reference: <strong>" +
        paymentReference +
        "</strong>";


    payButton.disabled =
        true;


    payButton.textContent =
        "PAYMENT GATEWAY REQUIRED";

}


/*
    GENERATE PAYMENT REFERENCE
*/

function generatePaymentReference() {

    const timestamp =
        Date.now()
        .toString()
        .slice(-10);


    const random =
        Math.floor(
            1000 +
            Math.random() * 9000
        );


    return (
        "PAY-" +
        timestamp +
        "-" +
        random
    );

}


/*
    ERROR
*/

function showError(message) {

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

function formatCurrency(amount) {

    if (
        amount === undefined ||
        amount === null
    ) {

        return "₦0";
    }


    return "₦" +
        Number(amount).toLocaleString(
            "en-NG"
        );

}


/*
    METHOD
*/

function formatMethod(method) {

    const methods = {

        WALKER: "Walker",

        RIDER: "Rider",

        VEHICLE: "Vehicle"

    };


    return methods[
        method
    ] || "Delivery Partner";

}