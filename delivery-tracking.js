/*
    DREYPELLA RIDE

    DELIVERY PARTNER TRACKING

    This page is for:

    - Walker
    - Rider
    - Vehicle Driver

    It allows an assigned delivery partner to:

    1. View their assigned delivery
    2. Accept the delivery
    3. Share live GPS
    4. Confirm package pickup
    5. Start transit
    6. Confirm delivery

    Customer tracking reads the same
    Firestore delivery document.
*/


let currentDeliveryId = null;

let currentDelivery = null;

let unsubscribeDelivery = null;

let gpsWatchId = null;

let locationSharing = false;


/*
    PAGE ELEMENTS
*/


const bookingReferenceElement =
    document.getElementById(
        "bookingReference"
    );


const pickupLocationElement =
    document.getElementById(
        "pickupLocation"
    );


const destinationLocationElement =
    document.getElementById(
        "destinationLocation"
    );


const distanceElement =
    document.getElementById(
        "distance"
    );


const estimatedTimeElement =
    document.getElementById(
        "estimatedTime"
    );


const deliveryMethodElement =
    document.getElementById(
        "deliveryMethod"
    );


const statusBadge =
    document.getElementById(
        "statusBadge"
    );


const currentStatusElement =
    document.getElementById(
        "currentStatus"
    );


const statusDescriptionElement =
    document.getElementById(
        "statusDescription"
    );


const partnerNameElement =
    document.getElementById(
        "partnerName"
    );


const partnerTypeElement =
    document.getElementById(
        "partnerType"
    );


const vehicleInfoElement =
    document.getElementById(
        "vehicleInfo"
    );


const gpsButton =
    document.getElementById(
        "gpsButton"
    );


const gpsMessage =
    document.getElementById(
        "gpsMessage"
    );


const gpsIndicator =
    document.getElementById(
        "gpsIndicator"
    );


const gpsHeaderStatus =
    document.getElementById(
        "gpsHeaderStatus"
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


const acceptButton =
    document.getElementById(
        "acceptButton"
    );


const pickupButton =
    document.getElementById(
        "pickupButton"
    );


const transitButton =
    document.getElementById(
        "transitButton"
    );


const deliveredButton =
    document.getElementById(
        "deliveredButton"
    );


const actionMessage =
    document.getElementById(
        "actionMessage"
    );


const statusCircle =
    document.getElementById(
        "statusCircle"
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
    CHECK BOOKING
*/


if (!bookingReference) {

    showError(
        "No delivery booking was provided."
    );

} else {

    startDeliveryListener();

}


/*
    START FIRESTORE LISTENER
*/


function startDeliveryListener() {

    unsubscribeDelivery =
        db
            .collection(
                "deliveries"
            )

            .where(
                "bookingReference",
                "==",
                bookingReference
            )

            .limit(1)

            .onSnapshot(

                function(snapshot) {

                    if (
                        snapshot.empty
                    ) {

                        showError(
                            "Delivery booking could not be found."
                        );

                        return;

                    }


                    const document =
                        snapshot.docs[0];


                    currentDeliveryId =
                        document.id;


                    currentDelivery =
                        document.data();


                    renderDelivery(
                        currentDelivery
                    );


                    verifyPartnerAccess(
                        currentDelivery
                    );

                },

                function(error) {

                    console.error(
                        "Delivery listener error:",
                        error
                    );


                    showError(
                        "Unable to connect to delivery tracking."
                    );

                }

            );

}


/*
    RENDER DELIVERY
*/


function renderDelivery(
    delivery
) {

    bookingReferenceElement.textContent =
        delivery.bookingReference ||
        bookingReference;


    pickupLocationElement.textContent =
        delivery.pickup?.address ||
        delivery.pickup?.name ||
        "Pickup location";


    destinationLocationElement.textContent =
        delivery.destination?.address ||
        delivery.destination?.name ||
        "Destination";


    distanceElement.textContent =
        delivery.distanceKm !== undefined &&
        delivery.distanceKm !== null

            ? Number(
                delivery.distanceKm
            ).toFixed(1) + " km"

            : "Calculating";


    estimatedTimeElement.textContent =
        delivery.estimatedTime ||
        "Calculating";


    deliveryMethodElement.textContent =
        formatMethod(
            delivery.method
        );


    partnerNameElement.textContent =
        delivery.partnerName ||
        "Delivery Partner";


    partnerTypeElement.textContent =
        formatMethod(
            delivery.method
        );


    vehicleInfoElement.textContent =
        delivery.vehicleInfo ||
        "Delivery partner";


    renderStatus(
        delivery.status
    );


    renderGPS(
        delivery
    );


    updateActionButtons(
        delivery.status
    );

}


/*
    PARTNER ACCESS
*/


function verifyPartnerAccess(
    delivery
) {

    /*
        We use Firebase Authentication.

        Only the assigned partner should
        be able to operate this page.
    */


    if (
        typeof firebase ===
        "undefined" ||
        !firebase.auth
    ) {

        disablePartnerActions();

        showActionMessage(
            "Authentication is not available."
        );

        return;

    }


    const user =
        firebase.auth().currentUser;


    if (!user) {

        disablePartnerActions();

        showActionMessage(
            "Please log in with your delivery partner account."
        );

        return;

    }


    /*
        Compare Firebase user UID with
        the delivery's partnerId.
    */


    if (
        delivery.partnerId &&
        delivery.partnerId !== user.uid
    ) {

        disablePartnerActions();

        showActionMessage(
            "This delivery is assigned to another delivery partner."
        );

        return;

    }


    /*
        If the delivery has not yet
        been assigned, do not allow
        actions.
    */


    if (
        !delivery.partnerId
    ) {

        disablePartnerActions();

        showActionMessage(
            "This delivery has not been assigned to a partner yet."
        );

        return;

    }


    enableCorrectActions(
        delivery.status
    );

}


/*
    FIREBASE AUTH STATE
*/


if (
    typeof firebase !==
    "undefined" &&
    firebase.auth
) {

    firebase.auth().onAuthStateChanged(
        function(user) {

            if (
                user &&
                currentDelivery
            ) {

                verifyPartnerAccess(
                    currentDelivery
                );

            }

        }
    );

}


/*
    STATUS
*/


function renderStatus(
    status
) {

    const statusMap = {

        PAYMENT_PENDING: {

            title:
                "Payment Pending",

            description:
                "Payment has not been confirmed.",

            badge:
                "PAYMENT PENDING"

        },


        PAYMENT_CONFIRMED: {

            title:
                "Ready for Assignment",

            description:
                "Waiting for the delivery partner.",

            badge:
                "PAYMENT CONFIRMED"

        },


        PARTNER_ASSIGNED: {

            title:
                "Delivery Assigned",

            description:
                "Accept the delivery and start your location sharing.",

            badge:
                "ASSIGNED"

        },


        PICKED_UP: {

            title:
                "Package Picked Up",

            description:
                "The package has been collected.",

            badge:
                "PICKED UP"

        },


        IN_TRANSIT: {

            title:
                "In Transit",

            description:
                "The package is currently on the way.",

            badge:
                "IN TRANSIT"

        },


        DELIVERED: {

            title:
                "Delivered",

            description:
                "The delivery has been completed.",

            badge:
                "DELIVERED"

        },


        CANCELLED: {

            title:
                "Cancelled",

            description:
                "This delivery has been cancelled.",

            badge:
                "CANCELLED"

        }

    };


    const result =
        statusMap[status] ||
        {

            title:
                "Processing",

            description:
                "Delivery is being processed.",

            badge:
                "PROCESSING"

        };


    currentStatusElement.textContent =
        result.title;


    statusDescriptionElement.textContent =
        result.description;


    statusBadge.textContent =
        result.badge;


    statusCircle.classList.remove(
        "active",
        "danger"
    );


    if (
        status ===
        "DELIVERED"
    ) {

        statusCircle.classList.add(
            "active"
        );

    }


    if (
        status ===
        "CANCELLED"
    ) {

        statusCircle.classList.add(
            "danger"
        );

    }

}


/*
    UPDATE BUTTONS
*/


function updateActionButtons(
    status
) {

    /*
        Disable everything first.
    */

    acceptButton.disabled =
        true;

    pickupButton.disabled =
        true;

    transitButton.disabled =
        true;

    deliveredButton.disabled =
        true;


    /*
        ASSIGNED

        Partner can accept.
    */

    if (
        status ===
        "PARTNER_ASSIGNED"
    ) {

        acceptButton.disabled =
            false;

    }


    /*
        ACCEPTED / PICKED UP

        Allow pickup confirmation.

        We treat PARTNER_ASSIGNED as
        accepted after the partner
        clicks the accept button.
    */

    if (
        status ===
        "PARTNER_ASSIGNED"
    ) {

        pickupButton.disabled =
            false;

    }


    /*
        PICKED UP

        Allow transit.
    */

    if (
        status ===
        "PICKED_UP"
    ) {

        transitButton.disabled =
            false;

    }


    /*
        IN TRANSIT

        Allow delivery completion.
    */

    if (
        status ===
        "IN_TRANSIT"
    ) {

        deliveredButton.disabled =
            false;

    }


    /*
        Completed deliveries cannot
        be changed.
    */

    if (
        status ===
        "DELIVERED" ||
        status ===
        "CANCELLED"
    ) {

        stopLocationSharing();

    }

}


/*
    ENABLE CORRECT ACTIONS
*/


function enableCorrectActions(
    status
) {

    updateActionButtons(
        status
    );

}


/*
    DISABLE PARTNER ACTIONS
*/


function disablePartnerActions() {

    acceptButton.disabled =
        true;

    pickupButton.disabled =
        true;

    transitButton.disabled =
        true;

    deliveredButton.disabled =
        true;

    gpsButton.disabled =
        true;

}


/*
    ACCEPT DELIVERY
*/


acceptButton.addEventListener(
    "click",
    async function() {

        if (
            !currentDeliveryId
        ) {

            return;

        }


        const user =
            firebase.auth().currentUser;


        if (
            !user
        ) {

            showActionMessage(
                "Please log in first."
            );

            return;

        }


        if (
            currentDelivery?.partnerId !==
            user.uid
        ) {

            showActionMessage(
                "You are not assigned to this delivery."
            );

            return;

        }


        try {

            acceptButton.disabled =
                true;


            await db
                .collection(
                    "deliveries"
                )
                .doc(
                    currentDeliveryId
                )
                .update({

                    partnerAccepted:
                        true,

                    partnerAcceptedAt:
                        firebase.firestore.FieldValue.serverTimestamp()

                });


            showActionMessage(
                "Delivery accepted. Start location sharing."
            );


            startLocationSharing();

        } catch (
            error
        ) {

            console.error(
                error
            );


            showActionMessage(
                "Unable to accept the delivery."
            );

        }

    }
);


/*
    CONFIRM PICKUP
*/


pickupButton.addEventListener(
    "click",
    async function() {

        await updateDeliveryStatus(
            "PICKED_UP",
            "Package pickup confirmed."
        );

    }
);


/*
    START TRANSIT
*/


transitButton.addEventListener(
    "click",
    async function() {

        await updateDeliveryStatus(
            "IN_TRANSIT",
            "Delivery is now in transit."
        );

    }
);


/*
    CONFIRM DELIVERY
*/


deliveredButton.addEventListener(
    "click",
    async function() {

        const confirmed =
            window.confirm(
                "Confirm that the package has been delivered?"
            );


        if (
            !confirmed
        ) {

            return;

        }


        await updateDeliveryStatus(
            "DELIVERED",
            "Delivery completed successfully."
        );


        stopLocationSharing();

    }
);


/*
    UPDATE STATUS
*/


async function updateDeliveryStatus(
    newStatus,
    message
) {

    if (
        !currentDeliveryId
    ) {

        return;

    }


    const user =
        firebase.auth().currentUser;


    if (
        !user
    ) {

        showActionMessage(
            "Please log in first."
        );

        return;

    }


    if (
        currentDelivery?.partnerId !==
        user.uid
    ) {

        showActionMessage(
            "You are not assigned to this delivery."
        );

        return;

    }


    try {

        disableAllActionButtons();


        await db
            .collection(
                "deliveries"
            )
            .doc(
                currentDeliveryId
            )
            .update({

                status:
                    newStatus,

                lastStatusUpdatedAt:
                    firebase.firestore.FieldValue.serverTimestamp(),

                lastStatusUpdatedBy:
                    user.uid

            });


        showActionMessage(
            message
        );


    } catch (
        error
    ) {

        console.error(
            "Status update error:",
            error
        );


        showActionMessage(
            "Unable to update delivery status."
        );


        updateActionButtons(
            currentDelivery?.status
        );

    }

}


/*
    START GPS
*/


gpsButton.addEventListener(
    "click",
    function() {

        if (
            locationSharing
        ) {

            stopLocationSharing();

        } else {

            startLocationSharing();

        }

    }
);


/*
    START LOCATION SHARING
*/


function startLocationSharing() {

    if (
        locationSharing
    ) {

        return;

    }


    if (
        !navigator.geolocation
    ) {

        showGPSMessage(
            "Your browser does not support GPS location."
        );

        return;

    }


    const user =
        firebase.auth().currentUser;


    if (
        !user
    ) {

        showGPSMessage(
            "Please log in before sharing your location."
        );

        return;

    }


    if (
        !currentDeliveryId
    ) {

        showGPSMessage(
            "Delivery is not ready."
        );

        return;

    }


    if (
        currentDelivery?.partnerId !==
        user.uid
    ) {

        showGPSMessage(
            "You are not assigned to this delivery."
        );

        return;

    }


    gpsButton.disabled =
        true;


    showGPSMessage(
        "Requesting your location..."
    );


    gpsWatchId =
        navigator.geolocation.watchPosition(

            async function(position) {

                locationSharing =
                    true;


                gpsButton.disabled =
                    false;


                gpsButton.textContent =
                    "STOP LOCATION SHARING";


                gpsButton.classList.add(
                    "active"
                );


                gpsIndicator.classList.add(
                    "active"
                );


                gpsHeaderStatus.textContent =
                    "GPS LIVE";


                const lat =
                    position.coords.latitude;


                const lng =
                    position.coords.longitude;


                const accuracy =
                    position.coords.accuracy;


                latitudeElement.textContent =
                    lat.toFixed(6);


                longitudeElement.textContent =
                    lng.toFixed(6);


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


                showGPSMessage(
                    "Your live location is being shared with Dreypella."
                );


                try {

                    await db
                        .collection(
                            "deliveries"
                        )
                        .doc(
                            currentDeliveryId
                        )
                        .update({

                            "tracking.latitude":
                                lat,

                            "tracking.longitude":
                                lng,

                            "tracking.accuracy":
                                accuracy,

                            "tracking.lastUpdated":
                                firebase.firestore.FieldValue.serverTimestamp(),

                            "tracking.isLive":
                                true,

                            "tracking.partnerId":
                                user.uid

                        });

                } catch (
                    error
                ) {

                    console.error(
                        "GPS update error:",
                        error
                    );


                    showGPSMessage(
                        "GPS is active, but the location could not be uploaded."
                    );

                }

            },

            function(error) {

                console.error(
                    "GPS error:",
                    error
                );


                locationSharing =
                    false;


                gpsButton.disabled =
                    false;


                gpsIndicator.classList.remove(
                    "active"
                );


                gpsHeaderStatus.textContent =
                    "GPS OFF";


                switch (
                    error.code
                ) {

                    case 1:

                        showGPSMessage(
                            "Location permission was denied. Allow location access in your browser."
                        );

                        break;


                    case 2:

                        showGPSMessage(
                            "Your current location could not be determined."
                        );

                        break;


                    case 3:

                        showGPSMessage(
                            "Location request timed out. Try again."
                        );

                        break;


                    default:

                        showGPSMessage(
                            "Unable to access your location."
                        );

                }

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

}


/*
    STOP GPS
*/


async function stopLocationSharing() {

    if (
        gpsWatchId !==
        null
    ) {

        navigator.geolocation.clearWatch(
            gpsWatchId
        );

        gpsWatchId =
            null;

    }


    locationSharing =
        false;


    gpsButton.textContent =
        "START LOCATION SHARING";


    gpsButton.classList.remove(
        "active"
    );


    gpsIndicator.classList.remove(
        "active"
    );


    gpsHeaderStatus.textContent =
        "GPS OFF";


    showGPSMessage(
        "Location sharing has stopped."
    );


    /*
        Tell Firestore that the partner
        is no longer actively sharing.
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
                        false

                });

        } catch (
            error
        ) {

            console.error(
                error
            );

        }

    }

}


/*
    GPS MESSAGE
*/


function showGPSMessage(
    message
) {

    gpsMessage.textContent =
        message;

}


/*
    ACTION MESSAGE
*/


function showActionMessage(
    message
) {

    actionMessage.textContent =
        message;

}


/*
    DISABLE ACTIONS
*/


function disableAllActionButtons() {

    acceptButton.disabled =
        true;

    pickupButton.disabled =
        true;

    transitButton.disabled =
        true;

    deliveredButton.disabled =
        true;

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
            "Vehicle Driver",

        DRIVER:
            "Vehicle Driver"

    };


    return (
        methods[method] ||
        "Delivery Partner"
    );

}


/*
    ERROR
*/


function showError(
    message
) {

    bookingReferenceElement.textContent =
        "Unavailable";


    pickupLocationElement.textContent =
        message;


    destinationLocationElement.textContent =
        "—";


    statusBadge.textContent =
        "UNAVAILABLE";


    currentStatusElement.textContent =
        "Tracking Unavailable";


    statusDescriptionElement.textContent =
        message;


    disablePartnerActions();


    gpsButton.disabled =
        true;

}


/*
    CLEANUP
*/


window.addEventListener(
    "beforeunload",
    function() {

        if (
            gpsWatchId !==
            null
        ) {

            navigator.geolocation.clearWatch(
                gpsWatchId
            );

        }


        if (
            unsubscribeDelivery
        ) {

            unsubscribeDelivery();

        }

    }
);