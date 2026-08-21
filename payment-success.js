const paymentReference =
    document.getElementById(
        "paymentReference"
    );

const pickup =
    document.getElementById(
        "pickup"
    );

const destination =
    document.getElementById(
        "destination"
    );

const amount =
    document.getElementById(
        "amount"
    );

const deliveryStatus =
    document.getElementById(
        "deliveryStatus"
    );


/*
    Read booking saved during
    the delivery-payment process.
*/

let booking =
    JSON.parse(
        localStorage.getItem(
            "dreypellaDeliveryBooking"
        )
    );


/*
    Load payment information.
*/

if (booking) {

    paymentReference.textContent =
        booking.paymentReference ||
        "Payment confirmed";


    pickup.textContent =
        booking.pickup?.name ||
        "Pickup location";


    destination.textContent =
        booking.destination?.name ||
        "Destination";


    amount.textContent =
        formatCurrency(
            booking.customerPrice
        );


    deliveryStatus.textContent =
        "Payment received. Waiting for partner assignment.";

}


/*
    Currency formatter.
*/

function formatCurrency(amount) {

    if (
        amount === undefined ||
        amount === null
    ) {

        return "₦0";

    }


    return (
        "₦" +
        Number(amount).toLocaleString(
            "en-NG"
        )
    );

}


/*
    TRACK DELIVERY
*/

function goToTracking() {

    if (!booking) {

        alert(
            "Delivery information could not be found."
        );

        return;

    }


    /*
        We will connect this to the
        real tracking page next.
    */

    window.location.href =
        "delivery-tracking.html?booking=" +
        encodeURIComponent(
            booking.bookingReference
        );

}


/*
    HOME
*/

function goHome() {

    window.location.href =
        "index.html";

}