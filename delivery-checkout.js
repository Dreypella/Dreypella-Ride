/*
    DREYPELLA RIDE
    DELIVERY CHECKOUT

    Supports:

    SENDER PAYS
    RECEIVER PAYS
*/


const bookingData =
    JSON.parse(
        localStorage.getItem(
            "dreypellaDeliveryBooking"
        )
    );


/* ELEMENTS */

const pickupText =
    document.getElementById(
        "pickupText"
    );

const destinationText =
    document.getElementById(
        "destinationText"
    );

const distanceText =
    document.getElementById(
        "distanceText"
    );

const timeText =
    document.getElementById(
        "timeText"
    );

const methodText =
    document.getElementById(
        "methodText"
    );

const packageText =
    document.getElementById(
        "packageText"
    );

const receiverName =
    document.getElementById(
        "receiverName"
    );

const receiverPhone =
    document.getElementById(
        "receiverPhone"
    );

const receiverEmail =
    document.getElementById(
        "receiverEmail"
    );

const senderChoice =
    document.getElementById(
        "senderChoice"
    );

const receiverChoice =
    document.getElementById(
        "receiverChoice"
    );

const receiverNotice =
    document.getElementById(
        "receiverNotice"
    );

const priceText =
    document.getElementById(
        "priceText"
    );

const checkoutButton =
    document.getElementById(
        "checkoutButton"
    );

const backButton =
    document.getElementById(
        "backButton"
    );

const checkoutMessage =
    document.getElementById(
        "checkoutMessage"
    );


/* CHECK BOOKING */

if (!bookingData) {

    checkoutMessage.textContent =
        "Your delivery information could not be found.";

    checkoutButton.disabled =
        true;

} else {

    loadBooking();

}


/* LOAD DATA */

function loadBooking() {

    pickupText.textContent =
        bookingData.pickup?.name ||
        "Pickup location";


    destinationText.textContent =
        bookingData.destination?.name ||
        "Destination";


    distanceText.textContent =
        bookingData.distanceKm
            ? bookingData.distanceKm + " km"
            : "Calculating...";


    timeText.textContent =
        bookingData.durationMinutes
            ? formatTime(
                bookingData.durationMinutes
            )
            : "Calculating...";


    methodText.textContent =
        formatMethod(
            bookingData.method
        );


    packageText.textContent =
        formatCategory(
            bookingData.category
        );


    receiverName.value =
        bookingData.recipientName ||
        "";


    receiverPhone.value =
        bookingData.recipientPhone ||
        "";


    receiverEmail.value =
        bookingData.recipientEmail ||
        "";


    if (bookingData.customerPrice) {

        priceText.textContent =
            formatCurrency(
                bookingData.customerPrice
            );

    } else {

        priceText.textContent =
            "Price unavailable";
    }


    updatePayerUI();

}


/*
    PAYMENT TYPE
*/

const payerInputs =
    document.querySelectorAll(
        'input[name="payer"]'
    );


payerInputs.forEach(
    input => {

        input.addEventListener(
            "change",
            updatePayerUI
        );

    }
);


/* UPDATE PAYMENT UI */

function updatePayerUI() {

    const selected =
        document.querySelector(
            'input[name="payer"]:checked'
        );


    if (!selected) {

        return;
    }


    senderChoice.classList.remove(
        "selected"
    );

    receiverChoice.classList.remove(
        "selected"
    );


    if (
        selected.value ===
        "SENDER"
    ) {

        senderChoice.classList.add(
            "selected"
        );


        receiverNotice.style.display =
            "none";


        checkoutButton.textContent =
            "PAY NOW";

    }


    if (
        selected.value ===
        "RECEIVER"
    ) {

        receiverChoice.classList.add(
            "selected"
        );


        receiverNotice.style.display =
            "block";


        checkoutButton.textContent =
            "CREATE PAYMENT REQUEST";

    }

}


/*
    CHECK RECEIVER DETAILS
*/

function validateReceiver() {

    const name =
        receiverName.value.trim();


    const phone =
        receiverPhone.value.trim();


    if (!name) {

        showMessage(
            "Enter the receiver's name."
        );

        receiverName.focus();

        return false;
    }


    if (!phone) {

        showMessage(
            "Enter the receiver's phone number."
        );

        receiverPhone.focus();

        return false;
    }


    if (
        phone.replace(
            /\D/g,
            ""
        ).length < 10
    ) {

        showMessage(
            "Enter a valid receiver phone number."
        );

        receiverPhone.focus();

        return false;
    }


    return true;
}


/*
    CHECKOUT BUTTON
*/

checkoutButton.addEventListener(
    "click",
    async () => {

        checkoutMessage.textContent =
            "";


        if (!bookingData) {

            showMessage(
                "Delivery information is missing."
            );

            return;
        }


        if (
            !bookingData.customerPrice
        ) {

            showMessage(
                "Delivery price is not available yet."
            );

            return;
        }


        if (
            !validateReceiver()
        ) {

            return;
        }


        const selectedPayer =
            document.querySelector(
                'input[name="payer"]:checked'
            );


        if (!selectedPayer) {

            showMessage(
                "Please select who will pay."
            );

            return;
        }


        /*
            Save receiver information.
        */

        bookingData.recipientName =
            receiverName.value.trim();


        bookingData.recipientPhone =
            receiverPhone.value.trim();


        bookingData.recipientEmail =
            receiverEmail.value.trim();


        bookingData.payer =
            selectedPayer.value;


        /*
            Generate a booking reference.
        */

        bookingData.bookingReference =
            generateBookingReference();


        /*
            Receiver pays
        */

        if (
            selectedPayer.value ===
            "RECEIVER"
        ) {

            createReceiverPaymentRequest();

            return;
        }


        /*
            Sender pays
        */

        startSenderPayment();

    }
);


/*
    RECEIVER PAYMENT REQUEST
*/

function createReceiverPaymentRequest() {

    bookingData.status =
        "AWAITING_RECEIVER_PAYMENT";


    bookingData.paymentStatus =
        "PENDING";


    bookingData.paymentRequestedAt =
        new Date().toISOString();


    /*
        Save booking locally.

        Later this same object will be
        written to Firestore by a
        secure backend function.
    */

    localStorage.setItem(
        "dreypellaDeliveryBooking",
        JSON.stringify(
            bookingData
        )
    );


    /*
        In the production version:

        Firebase Cloud Function creates
        a secure payment request and sends:

        SMS
        Email
        WhatsApp

        to the receiver.

        The receiver then gets a link such as:

        /receiver-payment.html?booking=XXXX
    */


    const receiverPaymentLink =
        "receiver-payment.html?booking=" +
        encodeURIComponent(
            bookingData.bookingReference
        );


    /*
        Save the link for the
        next stage of development.
    */

    bookingData.receiverPaymentLink =
        receiverPaymentLink;


    localStorage.setItem(
        "dreypellaDeliveryBooking",
        JSON.stringify(
            bookingData
        )
    );


    /*
        Go to payment-request page.
    */

    window.location.href =
        receiverPaymentLink;

}


/*
    SENDER PAYMENT
*/

function startSenderPayment() {

    bookingData.status =
        "AWAITING_PAYMENT";


    bookingData.paymentStatus =
        "PENDING";


    bookingData.paymentRequestedAt =
        new Date().toISOString();


    localStorage.setItem(
        "dreypellaDeliveryBooking",
        JSON.stringify(
            bookingData
        )
    );


    /*
        For now we send the sender
        to the sender payment page.

        Connect Paystack/payment provider
        there later.
    */

    window.location.href =
        "delivery-payment.html";

}


/*
    BACK
*/

backButton.addEventListener(
    "click",
    () => {

        window.location.href =
            "delivery-confirmation.html";

    }
);


/*
    BOOKING REFERENCE
*/

function generateBookingReference() {

    const now =
        Date.now()
        .toString()
        .slice(-8);


    const random =
        Math.floor(
            100 +
            Math.random() * 900
        );


    return (
        "DR-" +
        now +
        "-" +
        random
    );

}


/*
    FORMATTING
*/

function formatCurrency(amount) {

    return "₦" +
        Number(
            amount
        ).toLocaleString(
            "en-NG"
        );

}


function formatTime(minutes) {

    if (
        Number(minutes) < 60
    ) {

        return Math.round(
            minutes
        ) + " mins";

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const remaining =
        Math.round(
            minutes % 60
        );


    if (
        remaining === 0
    ) {

        return hours +
            " hr";

    }


    return hours +
        " hr " +
        remaining +
        " mins";

}


function formatMethod(method) {

    const methods = {

        WALKER: "Walker",

        RIDER: "Rider",

        VEHICLE: "Vehicle"

    };


    return methods[method] ||
        method ||
        "Delivery Partner";

}


function formatCategory(category) {

    const categories = {

        food: "Food",

        document: "Document",

        clothing: "Clothing",

        electronics: "Electronics",

        medicine: "Medicine",

        parcel: "General Parcel",

        other: "Other"

    };


    return categories[
        category
    ] || "Parcel";

}


function showMessage(message) {

    checkoutMessage.textContent =
        message;

}