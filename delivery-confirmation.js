/*
    DREYPELLA RIDE
    DELIVERY CONFIRMATION
*/


const bookingData =
    JSON.parse(
        localStorage.getItem(
            "dreypellaDeliveryBooking"
        )
    );


const functions =
    firebase.functions();

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

const categoryText =
    document.getElementById(
        "categoryText"
    );

const recipientName =
    document.getElementById(
        "recipientName"
    );

const recipientPhone =
    document.getElementById(
        "recipientPhone"
    );

const instructionsText =
    document.getElementById(
        "instructionsText"
    );

const priceText =
    document.getElementById(
        "priceText"
    );

const confirmationMessage =
    document.getElementById(
        "confirmationMessage"
    );

const confirmButton =
    document.getElementById(
        "confirmButton"
    );

const backButton =
    document.getElementById(
        "backButton"
    );

const insurance =
    document.getElementById(
        "insurance"
    );

const insuranceInfo =
    document.getElementById(
        "insuranceInfo"
    );


/*
    CHECK BOOKING
*/

if (!bookingData) {

    confirmationMessage.textContent =
        "No delivery booking was found.";

    confirmButton.disabled =
        true;

} else {

    loadBooking();

}


/*
    LOAD BOOKING
*/

function loadBooking() {

    pickupText.textContent =
        bookingData.pickup?.name ||
        "Pickup location";


    destinationText.textContent =
        bookingData.destination?.name ||
        "Destination";


    recipientName.textContent =
        bookingData.recipientName ||
        "—";


    recipientPhone.textContent =
        bookingData.recipientPhone ||
        "—";


    instructionsText.textContent =
        bookingData.instructions ||
        "No special instructions";


    categoryText.textContent =
        formatCategory(
            bookingData.category
        );


    methodText.textContent =
        formatMethod(
            bookingData.method
        );


    /*
        Distance and price are calculated
        again here from the selected
        locations.

        This is only for displaying the
        confirmation information.

        Final financial calculations
        will later be moved completely
        into Firebase Cloud Functions.
    */

    calculateConfirmationRoute();

}


/*
    CALCULATE ROUTE AGAIN
*/

async function calculateConfirmationRoute() {

    if (
        !bookingData.pickup ||
        !bookingData.destination
    ) {

        return;
    }


    const pickup =
        bookingData.pickup;

    const destination =
        bookingData.destination;


    const url =
        "https://router.project-osrm.org/route/v1/driving/" +
        pickup.lon +
        "," +
        pickup.lat +
        ";" +
        destination.lon +
        "," +
        destination.lat +
        "?overview=false";


    try {

        const response =
            await fetch(url);


        const data =
            await response.json();


        if (
            !data.routes ||
            !data.routes.length
        ) {

            throw new Error(
                "Route not found"
            );
        }


        const route =
            data.routes[0];


        const distanceKm =
            route.distance / 1000;


        const durationMinutes =
            route.duration / 60;


        distanceText.textContent =
            distanceKm.toFixed(1) +
            " km";


        timeText.textContent =
            formatTime(
                durationMinutes
            );


        /*
            Use the same temporary pricing
            rules as delivery.js.

            Later Firebase will provide
            the admin-controlled price.
        */

        const price =
            calculatePrice(
                distanceKm,
                bookingData.method
            );


        bookingData.distanceKm =
            Number(
                distanceKm.toFixed(2)
            );


        bookingData.durationMinutes =
            Math.round(
                durationMinutes
            );


        bookingData.customerPrice =
            price;


        priceText.textContent =
            formatCurrency(price);


        /*
            Update local booking.
        */

        localStorage.setItem(
            "dreypellaDeliveryBooking",
            JSON.stringify(
                bookingData
            )
        );


    } catch (error) {

        console.error(error);

        confirmationMessage.textContent =
            "Unable to calculate the route. Please go back and try again.";

        confirmButton.disabled =
            true;
    }

}


/*
    TEMPORARY CUSTOMER PRICING

    Admin-controlled pricing will later
    replace these values through Firebase.
*/

function calculatePrice(
    distanceKm,
    method
) {

    const baseFare =
        500;


    const pricePerKm =
        120;


    const vehicleSurcharge =
        300;


    const riderSurcharge =
        150;


    const walkerDifference =
        150;


    let price =
        baseFare +
        (
            distanceKm *
            pricePerKm
        );


    if (method === "VEHICLE") {

        price +=
            vehicleSurcharge;
    }


    if (method === "RIDER") {

        price +=
            riderSurcharge;
    }


    if (method === "WALKER") {

        price -=
            walkerDifference;
    }


    if (price < 700) {

        price = 700;
    }


    price =
        Math.ceil(
            price / 50
        ) * 50;


    return price;
}


/*
    INSURANCE
*/

insurance.addEventListener(
    "change",
    () => {

        if (insurance.checked) {

            insuranceInfo.style.display =
                "block";

        } else {

            insuranceInfo.style.display =
                "none";
        }

    }
);


/*
    CONTINUE TO PAYMENT
*/

confirmButton.addEventListener(
    "click",
    async () => {

        if (!bookingData) {

            return;
        }


        if (!bookingData.customerPrice) {

            confirmationMessage.textContent =
                "Please wait for the delivery price to load.";

            return;
        }


        bookingData.insurance =
            insurance.checked;


        bookingData.status =
            "AWAITING_PAYMENT";


        confirmButton.disabled =
            true;


        confirmationMessage.textContent =
            "Creating your delivery booking...";


        try {

            const deliveryResult =
                await createDelivery({

                    ...bookingData,

                    packageCategory:
                        bookingData.category,

                    packageDescription:
                        bookingData.packageDescription ||
                        "",

                    packageSize:
                        bookingData.size,

                    packageWeight:
                        bookingData.weight,

                    deliveryInstructions:
                        bookingData.instructions,

                    estimatedTime:
                        bookingData.durationMinutes,

                    pickup: {

                        ...bookingData.pickup,

                        latitude:
                            bookingData.pickup?.latitude ??
                            bookingData.pickup?.lat ??
                            null,

                        longitude:
                            bookingData.pickup?.longitude ??
                            bookingData.pickup?.lon ??
                            null

                    },

                    destination: {

                        ...bookingData.destination,

                        latitude:
                            bookingData.destination?.latitude ??
                            bookingData.destination?.lat ??
                            null,

                        longitude:
                            bookingData.destination?.longitude ??
                            bookingData.destination?.lon ??
                            null

                    }

                });


            if (!deliveryResult.success) {

                throw new Error(
                    deliveryResult.message ||
                    "Unable to create delivery booking."
                );

            }


            bookingData.deliveryId =
                deliveryResult.deliveryId;


            bookingData.bookingReference =
                deliveryResult.bookingReference;


            localStorage.setItem(
                "dreypellaDeliveryBooking",
                JSON.stringify(
                    bookingData
                )
            );


            /*
                PAYMENT ROUTING

                Sender:
                WALLET   -> wallet-payment.html
                PAYSTACK -> Paystack checkout

                Receiver payment will be connected
                through the secure payment-request
                backend flow separately.
            */

            if (
                bookingData.payer ===
                "SENDER" &&
                bookingData.paymentMethod ===
                "WALLET"
            ) {

                const paymentUrl =
                    "wallet-payment.html" +
                    "?type=DELIVERY" +
                    "&amount=" +
                    encodeURIComponent(
                        bookingData.customerPrice
                    ) +
                    "&reference=" +
                    encodeURIComponent(
                        bookingData.bookingReference
                    ) +
                    "&orderId=" +
                    encodeURIComponent(
                        bookingData.deliveryId
                    ) +
                    "&item=Delivery" +
                    "&returnUrl=" +
                    encodeURIComponent(
                        "customer-dashboard.html"
                    );

                window.location.href =
                    paymentUrl;

                return;
            }


            if (
                bookingData.payer ===
                "SENDER" &&
                bookingData.paymentMethod ===
                "PAYSTACK"
            ) {

                confirmationMessage.textContent =
                    "Preparing secure online payment...";

                const initializePayment =
                    functions.httpsCallable(
                        "initializeDeliveryPayment"
                    );

                const paymentResult =
                    await initializePayment({
                        deliveryId:
                            bookingData.deliveryId
                    });

                const paymentData =
                    paymentResult.data;

                if (
                    !paymentData ||
                    !paymentData.authorizationUrl
                ) {
                    throw new Error(
                        "Unable to initialize online payment."
                    );
                }

                window.location.href =
                    paymentData.authorizationUrl;

                return;
            }


              if (
                  bookingData.payer ===
                  "RECEIVER"
              ) {

                  if (
                      bookingData.deliveryType !==
                      "LOCAL"
                  ) {
                      throw new Error(
                          "Pay on Delivery is only available for eligible local deliveries. Interstate and international deliveries must be paid upfront."
                      );
                  }

                  confirmationMessage.textContent =
                      "Delivery created. Receiver will pay on delivery.";

                  bookingData.paymentMethod =
                      "POD";

                  bookingData.paymentStatus =
                      "PENDING";

                  bookingData.status =
                      "PAYMENT_PENDING";

                  localStorage.setItem(
                      "dreypellaDeliveryBooking",
                      JSON.stringify(
                          bookingData
                      )
                  );

                  return;
              }


            throw new Error(
                "Please select a valid payment option."
            );


        } catch (error) {

            console.error(
                "Delivery creation error:",
                error
            );


            confirmationMessage.textContent =
                error.message ||
                "Unable to create the delivery booking. Please try again.";


            confirmButton.disabled =
                false;

        }

    }
);


/*
    BACK
*/

backButton.addEventListener(
    "click",
    () => {

        window.location.href =
            "delivery.html";

    }
);


/*
    HELPERS
*/

function formatCurrency(amount) {

    return "₦" +
        Number(amount).toLocaleString(
            "en-NG"
        );
}


function formatTime(minutes) {

    if (minutes < 60) {

        return Math.round(minutes) +
            " mins";
    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const remaining =
        Math.round(
            minutes % 60
        );


    if (remaining === 0) {

        return hours +
            " hr";
    }


    return hours +
        " hr " +
        remaining +
        " mins";
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


    return categories[category] ||
        "Parcel";
}


function formatMethod(method) {

    const methods = {

        WALKER: "Walker",

        RIDER: "Rider",

        VEHICLE: "Vehicle"

    };


    return methods[method] ||
        method;
}
