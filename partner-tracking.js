/*
    DREYPELLA RIDE

    PARTNER LIVE GPS TRACKER

    Rider / Walker / Driver
    location -> Firestore

    Customer and Admin dashboards
    read the same location.
*/


let watchId = null;

let currentDeliveryId = null;

let currentBookingReference = null;

let trackingActive = false;


/*
    ELEMENTS
*/

const bookingInput =
    document.getElementById(
        "bookingReference"
    );


const startButton =
    document.getElementById(
        "startButton"
    );


const stopButton =
    document.getElementById(
        "stopButton"
    );


const message =
    document.getElementById(
        "message"
    );


const locationStatus =
    document.getElementById(
        "locationStatus"
    );


const statusIndicator =
    document.getElementById(
        "statusIndicator"
    );


const latitudeElement =
    document.getElementById(
        "latitude"
    );


const longitudeElement =
    document.getElementById(
        "longitude"
    );


const lastUpdatedElement =
    document.getElementById(
        "lastUpdated"
    );


const deliveryStatusElement =
    document.getElementById(
        "deliveryStatus"
    );


const pickupElement =
    document.getElementById(
        "pickup"
    );


const destinationElement =
    document.getElementById(
        "destination"
    );


/*
    START BUTTON
*/

startButton.addEventListener(
    "click",
    startLiveTracking
);


/*
    STOP BUTTON
*/

stopButton.addEventListener(
    "click",
    stopLiveTracking
);


/*
    START TRACKING
*/

async function startLiveTracking() {

    const booking =
        bookingInput.value.trim();


    if (!booking) {

        showMessage(
            "Enter the delivery booking reference first."
        );

        return;

    }


    if (
        !navigator.geolocation
    ) {

        showMessage(
            "This device does not support GPS location."
        );

        return;

    }


    currentBookingReference =
        booking;


    showMessage(
        "Finding your delivery..."
    );


    try {

        /*
            Find delivery in Firestore.
        */

        const snapshot =
            await db
                .collection(
                    "deliveries"
                )
                .where(
                    "bookingReference",
                    "==",
                    booking
                )
                .limit(1)
                .get();


        if (
            snapshot.empty
        ) {

            showMessage(
                "No delivery was found with this booking reference."
            );

            return;

        }


        const deliveryDocument =
            snapshot.docs[0];


        currentDeliveryId =
            deliveryDocument.id;


        const delivery =
            deliveryDocument.data();


        /*
            Display delivery information.
        */

        renderDelivery(
            delivery
        );


        /*
            Ask browser for location.
        */

        showMessage(
            "Requesting your location permission..."
        );


        navigator.geolocation.getCurrentPosition(

            function(position) {

                /*
                    We received GPS permission.
                */

                trackingActive =
                    true;


                startButton.disabled =
                    true;


                stopButton.disabled =
                    false;


                statusIndicator.classList.add(
                    "active"
                );


                locationStatus.textContent =
                    "LIVE";


                showMessage(
                    "Your live location is now being shared."
                );


                /*
                    Immediately save
                    first location.
                */

                saveLocation(
                    position
                );


                /*
                    Continue watching GPS.
                */

                watchId =
                    navigator.geolocation.watchPosition(

                        function(position) {

                            saveLocation(
                                position
                            );

                        },

                        function(error) {

                            handleLocationError(
                                error
                            );

                        },

                        {

                            enableHighAccuracy:
                                true,

                            maximumAge:
                                5000,

                            timeout:
                                15000

                        }

                    );

            },

            function(error) {

                handleLocationError(
                    error
                );

            },

            {

                enableHighAccuracy:
                    true,

                timeout:
                    15000,

                maximumAge:
                    0

            }

        );

    } catch (
        error
    ) {

        console.error(
            "Tracking startup error:",
            error
        );


        showMessage(
            "Unable to start tracking. Please try again."
        );

    }

}


/*
    SAVE GPS LOCATION
*/

async function saveLocation(
    position
) {

    if (
        !currentDeliveryId
    ) {

        return;

    }


    const latitude =
        position.coords.latitude;


    const longitude =
        position.coords.longitude;


    const accuracy =
        position.coords.accuracy;


    const speed =
        position.coords.speed;


    const heading =
        position.coords.heading;


    const timestamp =
        firebase.firestore.FieldValue.serverTimestamp();


    /*
        Update delivery tracking data.
    */

    try {

        await db
            .collection(
                "deliveries"
            )
            .doc(
                currentDeliveryId
            )
            .update({

                tracking: {

                    latitude:
                        latitude,

                    longitude:
                        longitude,

                    accuracy:
                        accuracy || null,

                    speed:
                        speed || null,

                    heading:
                        heading || null,

                    isLive:
                        true,

                    lastUpdated:
                        timestamp

                }

            });


        /*
            Update screen.
        */

        latitudeElement.textContent =
            latitude.toFixed(6);


        longitudeElement.textContent =
            longitude.toFixed(6);


        lastUpdatedElement.textContent =
            new Date().toLocaleTimeString(
                "en-NG",
                {

                    hour:
                        "2-digit",

                    minute:
                        "2-digit",

                    second:
                        "2-digit"

                }
            );


        locationStatus.textContent =
            "LIVE";


        statusIndicator.classList.add(
            "active"
        );


        console.log(
            "Location updated:",
            latitude,
            longitude
        );

    } catch (
        error
    ) {

        console.error(
            "Unable to save GPS:",
            error
        );


        showMessage(
            "Location received, but could not be saved."
        );

    }

}


/*
    STOP TRACKING
*/

async function stopLiveTracking() {

    /*
        Stop browser GPS watcher.
    */

    if (
        watchId !== null
    ) {

        navigator.geolocation.clearWatch(
            watchId
        );

        watchId =
            null;

    }


    trackingActive =
        false;


    startButton.disabled =
        false;


    stopButton.disabled =
        true;


    statusIndicator.classList.remove(
        "active"
    );


    locationStatus.textContent =
        "OFFLINE";


    /*
        Tell Firestore that
        live tracking has stopped.
    */

    if (
        currentDeliveryId
    ) {

        try {

            await db
                .collection(
                    "deliveries"
                )
                .doc(
                    currentDeliveryId
                )
                .update({

                    "tracking.isLive":
                        false,

                    "tracking.lastUpdated":
                        firebase.firestore.FieldValue.serverTimestamp()

                });

        } catch (
            error
        ) {

            console.error(
                "Unable to stop tracking:",
                error
            );

        }

    }


    showMessage(
        "Live location sharing has been stopped."
    );

}


/*
    HANDLE GPS ERRORS
*/

function handleLocationError(
    error
) {

    console.error(
        "GPS error:",
        error
    );


    switch (
        error.code
    ) {

        case 1:

            showMessage(
                "Location permission was denied. Please allow location access in your browser settings."
            );

            break;


        case 2:

            showMessage(
                "Your current location could not be determined."
            );

            break;


        case 3:

            showMessage(
                "GPS request timed out. Please move to an area with better GPS signal."
            );

            break;


        default:

            showMessage(
                "Unable to access your location."
            );

    }


    locationStatus.textContent =
        "LOCATION ERROR";


    statusIndicator.classList.remove(
        "active"
    );

}


/*
    DISPLAY DELIVERY
*/

function renderDelivery(
    delivery
) {

    deliveryStatusElement.textContent =
        formatStatus(
            delivery.status
        );


    pickupElement.textContent =
        delivery.pickup?.address ||
        delivery.pickup?.name ||
        "Pickup location";


    destinationElement.textContent =
        delivery.destination?.address ||
        delivery.destination?.name ||
        "Destination";

}


/*
    FORMAT STATUS
*/

function formatStatus(
    status
) {

    const statuses = {

        PAYMENT_PENDING:
            "Payment Pending",

        PAYMENT_CONFIRMED:
            "Payment Confirmed",

        PARTNER_ASSIGNED:
            "Partner Assigned",

        PICKED_UP:
            "Package Picked Up",

        IN_TRANSIT:
            "In Transit",

        DELIVERED:
            "Delivered",

        CANCELLED:
            "Cancelled"

    };


    return (
        statuses[status] ||
        "Delivery Processing"
    );

}


/*
    MESSAGE
*/

function showMessage(
    text
) {

    message.textContent =
        text;

}


/*
    AUTO LOAD BOOKING FROM URL

    Example:

    partner-tracking.html?booking=DRP-123456
*/

const urlParams =
    new URLSearchParams(
        window.location.search
    );


const urlBooking =
    urlParams.get(
        "booking"
    );


if (
    urlBooking
) {

    bookingInput.value =
        urlBooking;

}


/*
    CLEANUP
*/

window.addEventListener(
    "beforeunload",
    function() {

        if (
            watchId !== null
        ) {

            navigator.geolocation.clearWatch(
                watchId
            );

        }

    }
);