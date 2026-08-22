/*
    DREYPELLA RIDE

    CUSTOMER LIVE DELIVERY TRACKING

    Reads the delivery document in Firestore
    in real time.
*/


let unsubscribeTracking = null;

let deliveryReference = null;


/*
    PAGE ELEMENTS
*/

const bookingReference =
    document.getElementById(
        "bookingReference"
    );

const deliveryStatus =
    document.getElementById(
        "deliveryStatus"
    );

const statusDescription =
    document.getElementById(
        "statusDescription"
    );

const pickupLocation =
    document.getElementById(
        "pickupLocation"
    );

const destinationLocation =
    document.getElementById(
        "destinationLocation"
    );

const partnerCard =
    document.getElementById(
        "partnerCard"
    );

const partnerName =
    document.getElementById(
        "partnerName"
    );

const partnerType =
    document.getElementById(
        "partnerType"
    );

const vehicleInfo =
    document.getElementById(
        "vehicleInfo"
    );

const liveBadge =
    document.getElementById(
        "liveBadge"
    );

const locationStatus =
    document.getElementById(
        "locationStatus"
    );

const mapMessage =
    document.getElementById(
        "mapMessage"
    );

const partnerMarker =
    document.getElementById(
        "partnerMarker"
    );

const latitude =
    document.getElementById(
        "latitude"
    );

const longitude =
    document.getElementById(
        "longitude"
    );

const lastUpdated =
    document.getElementById(
        "lastUpdated"
    );

const distance =
    document.getElementById(
        "distance"
    );

const estimatedTime =
    document.getElementById(
        "estimatedTime"
    );

const deliveryMethod =
    document.getElementById(
        "deliveryMethod"
    );


/*
    GET BOOKING FROM URL
*/

const params =
    new URLSearchParams(
        window.location.search
    );


deliveryReference =
    params.get(
        "booking"
    );


if (
    !deliveryReference
) {

    showPageError(
        "No delivery booking was provided."
    );

} else {

    startTracking();

}


/*
    START REAL-TIME TRACKING
*/

function startTracking() {

    /*
        Find the delivery using
        its booking reference.
    */

    unsubscribeTracking =
        db
            .collection(
                "deliveries"
            )

            .where(
                "bookingReference",
                "==",
                deliveryReference
            )

            .limit(1)

            .onSnapshot(

                function(snapshot) {

                    if (
                        snapshot.empty
                    ) {

                        showPageError(
                            "Delivery booking was not found."
                        );

                        return;

                    }


                    const document =
                        snapshot.docs[0];


                    const delivery =
                        document.data();


                    renderDelivery(
                        delivery
                    );

                },

                function(error) {

                    console.error(
                        error
                    );


                    showPageError(
                        "Unable to connect to live tracking."
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

    bookingReference.textContent =
        delivery.bookingReference ||
        deliveryReference;


    pickupLocation.textContent =
        delivery.pickup?.address ||
        delivery.pickup?.name ||
        "Pickup location";


    destinationLocation.textContent =
        delivery.destination?.address ||
        delivery.destination?.name ||
        "Destination";


    distance.textContent =
        delivery.distanceKm
            ? Number(
                delivery.distanceKm
            ).toFixed(1) + " km"
            : "—";


    estimatedTime.textContent =
        delivery.estimatedTime ||
        "—";


    deliveryMethod.textContent =
        formatMethod(
            delivery.method
        );


    renderStatus(
        delivery.status
    );


    renderPartner(
        delivery
    );


    renderGPS(
        delivery
    );


    renderTimeline(
        delivery.status
    );

}


/*
    STATUS
*/

function renderStatus(
    status
) {

    const statuses = {

        PAYMENT_PENDING: {

            title:
                "Payment Pending",

            description:
                "Payment is required before the delivery can begin."

        },


        PAYMENT_CONFIRMED: {

            title:
                "Payment Confirmed",

            description:
                "Your delivery is waiting to be assigned."

        },


        PARTNER_ASSIGNED: {

            title:
                "Partner Assigned",

            description:
                "Your Dreypella delivery partner has been assigned."

        },


        PICKED_UP: {

            title:
                "Package Picked Up",

            description:
                "Your package has been collected."

        },


        IN_TRANSIT: {

            title:
                "In Transit",

            description:
                "Your package is currently on its way."

        },


        DELIVERED: {

            title:
                "Delivered",

            description:
                "Your package has been delivered successfully."

        },


        CANCELLED: {

            title:
                "Cancelled",

            description:
                "This delivery has been cancelled."

        }

    };


    const result =
        statuses[status] ||
        {

            title:
                "Processing",

            description:
                "Your delivery is being processed."

        };


    deliveryStatus.textContent =
        result.title;


    statusDescription.textContent =
        result.description;

}


/*
    PARTNER
*/

function renderPartner(
    delivery
) {

    if (
        !delivery.partnerId
    ) {

        partnerCard.style.display =
            "none";

        return;

    }


    partnerCard.style.display =
        "flex";


    partnerName.textContent =
        delivery.partnerName ||
        "Dreypella Partner";


    partnerType.textContent =
        formatMethod(
            delivery.method
        );


    vehicleInfo.textContent =
        delivery.vehicleInfo ||
        "Delivery partner";

}


/*
    LIVE GPS
*/

function renderGPS(
    delivery
) {

    const tracking =
        delivery.tracking;


    if (
        !tracking ||
        tracking.latitude === null ||
        tracking.longitude === null
    ) {

        liveBadge.textContent =
            "OFFLINE";


        liveBadge.classList.remove(
            "active"
        );


        locationStatus.textContent =
            "Waiting for partner location";


        mapMessage.textContent =
            "Waiting for live location";


        return;

    }


    /*
        GPS exists.
    */

    liveBadge.textContent =
        "LIVE";


    liveBadge.classList.add(
        "active"
    );


    locationStatus.textContent =
        "Partner location is updating";


    mapMessage.style.display =
        "none";


    latitude.textContent =
        Number(
            tracking.latitude
        ).toFixed(6);


    longitude.textContent =
        Number(
            tracking.longitude
        ).toFixed(6);


    lastUpdated.textContent =
        formatTimestamp(
            tracking.lastUpdated
        );


    /*
        Convert coordinates into a
        simple visual map position.

        This is NOT pretending to be a
        real geographic map.

        The actual coordinates are preserved
        and can later be connected to
        OpenStreetMap/Leaflet.
    */

    const visualPosition =
        convertCoordinateToVisualPosition(
            tracking.latitude,
            tracking.longitude
        );


    partnerMarker.style.left =
        visualPosition.left + "%";


    partnerMarker.style.top =
        visualPosition.top + "%";


    /*
        Calculate rough route progress
        when pickup and destination
        coordinates are available.
    */

    if (
        delivery.pickup?.latitude &&
        delivery.pickup?.longitude &&
        delivery.destination?.latitude &&
        delivery.destination?.longitude
    ) {

        updateRouteProgress(
            delivery.pickup.latitude,
            delivery.pickup.longitude,

            delivery.destination.latitude,
            delivery.destination.longitude,

            tracking.latitude,
            tracking.longitude
        );

    }

}


/*
    SIMPLE VISUAL POSITION

    This keeps the partner marker
    inside the map area.
*/

function convertCoordinateToVisualPosition(
    lat,
    lng
) {

    /*
        These are deliberately only
        visual calculations.

        They do not represent a
        geographic projection.
    */

    const left =
        20 +
        (
            Math.abs(
                lng * 1000
            ) %
            60
        );


    const top =
        20 +
        (
            Math.abs(
                lat * 1000
            ) %
            60
        );


    return {

        left:
            left,

        top:
            top

    };

}


/*
    ROUTE PROGRESS
*/

function updateRouteProgress(
    pickupLat,
    pickupLng,

    destinationLat,
    destinationLng,

    currentLat,
    currentLng
) {

    const totalDistance =
        distanceBetweenCoordinates(
            pickupLat,
            pickupLng,
            destinationLat,
            destinationLng
        );


    const travelledDistance =
        distanceBetweenCoordinates(
            pickupLat,
            pickupLng,
            currentLat,
            currentLng
        );


    if (
        totalDistance <= 0
    ) {

        return;

    }


    let progress =
        (
            travelledDistance /
            totalDistance
        ) * 100;


    progress =
        Math.max(
            0,
            Math.min(
                100,
                progress
            )
        );


    document.getElementById(
        "partnerProgress"
    ).style.height =
        progress + "%";

}


/*
    DISTANCE BETWEEN GPS POINTS

    Haversine formula.
*/

function distanceBetweenCoordinates(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const earthRadius =
        6371;


    const dLat =
        toRadians(
            lat2 - lat1
        );


    const dLon =
        toRadians(
            lon2 - lon1
        );


    const a =

        Math.sin(
            dLat / 2
        ) *
        Math.sin(
            dLat / 2
        )

        +

        Math.cos(
            toRadians(lat1)
        ) *

        Math.cos(
            toRadians(lat2)
        ) *

        Math.sin(
            dLon / 2
        ) *

        Math.sin(
            dLon / 2
        );


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return (
        earthRadius * c
    );

}


function toRadians(
    degrees
) {

    return (
        degrees *
        Math.PI /
        180
    );

}


/*
    TIMELINE
*/

function renderTimeline(
    status
) {

    const confirmed =
        document.getElementById(
            "timelineConfirmed"
        );

    const assigned =
        document.getElementById(
            "timelineAssigned"
        );

    const pickup =
        document.getElementById(
            "timelinePickup"
        );

    const transit =
        document.getElementById(
            "timelineTransit"
        );

    const delivered =
        document.getElementById(
            "timelineDelivered"
        );


    [
        confirmed,
        assigned,
        pickup,
        transit,
        delivered
    ].forEach(
        function(item) {

            item.classList.remove(
                "active"
            );

        }
    );


    /*
        Confirmed
    */

    confirmed.classList.add(
        "active"
    );


    /*
        Assigned
    */

    if (
        [
            "PARTNER_ASSIGNED",
            "PICKED_UP",
            "IN_TRANSIT",
            "DELIVERED"
        ].includes(
            status
        )
    ) {

        assigned.classList.add(
            "active"
        );

    }


    /*
        Pickup
    */

    if (
        [
            "PICKED_UP",
            "IN_TRANSIT",
            "DELIVERED"
        ].includes(
            status
        )
    ) {

        pickup.classList.add(
            "active"
        );

    }


    /*
        Transit
    */

    if (
        [
            "IN_TRANSIT",
            "DELIVERED"
        ].includes(
            status
        )
    ) {

        transit.classList.add(
            "active"
        );

    }


    /*
        Delivered
    */

    if (
        status ===
        "DELIVERED"
    ) {

        delivered.classList.add(
            "active"
        );

    }

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
    TIME
*/

function formatTimestamp(
    timestamp
) {

    if (
        !timestamp
    ) {

        return "—";

    }


    try {

        let date;


        if (
            timestamp.toDate
        ) {

            date =
                timestamp.toDate();

        } else {

            date =
                new Date(
                    timestamp
                );

        }


        return date.toLocaleTimeString(
            "en-NG",
            {

                hour:
                    "2-digit",

                minute:
                    "2-digit"

            }
        );

    } catch (
        error
    ) {

        return "—";

    }

}


/*
    ERROR
*/

function showPageError(
    text
) {

    deliveryStatus.textContent =
        "Tracking Unavailable";


    statusDescription.textContent =
        text;


    locationStatus.textContent =
        "Unable to load tracking";


    mapMessage.textContent =
        text;

}


/*
    SUPPORT
*/

function contactSupport() {

    window.location.href =
        "support.html";

}


/*
    CLEANUP
*/

window.addEventListener(
    "beforeunload",
    function() {

        if (
            unsubscribeTracking
        ) {

            unsubscribeTracking();

        }

    }
);