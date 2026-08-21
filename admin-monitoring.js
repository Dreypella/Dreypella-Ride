/*
=========================================================
DREYPELLA RIDE
ADMIN LIVE MONITORING
RIDE + DELIVERY MONITORING

Rides:
    rideBookings

Deliveries:
    deliveries

This file listens to Firestore in real time.
=========================================================
*/


/* =====================================================
   FIREBASE
===================================================== */

const auth = firebase.auth();
const db = firebase.firestore();


/* =====================================================
   ADMIN AUTHENTICATION
===================================================== */

auth.onAuthStateChanged(function(user) {

    if (!user) {

        window.location.href =
            "admin-login.html";

        return;

    }

    /*
        IMPORTANT:
        Your admin page should have its own
        admin authorization/security rules.

        Do not rely on this frontend check
        alone for security.
    */

    startRideMonitoring();
    startDeliveryMonitoring();

});


/* =====================================================
   VARIABLES
===================================================== */

let unsubscribeRides = null;
let unsubscribeDeliveries = null;


/* =====================================================
   START RIDE MONITORING
===================================================== */

function startRideMonitoring() {

    const rideQuery =
        db
            .collection("rideBookings")
            .orderBy(
                "createdAt",
                "desc"
            )
            .limit(100);


    unsubscribeRides =
        rideQuery.onSnapshot(

            function(snapshot) {

                const rides = [];

                snapshot.forEach(
                    function(doc) {

                        rides.push({

                            id:
                                doc.id,

                            ...doc.data()

                        });

                    }
                );


                renderRides(
                    rides
                );


                updateRideStatistics(
                    rides
                );

            },

            function(error) {

                console.error(
                    "Ride monitoring error:",
                    error
                );


                showMonitoringError(
                    "Unable to load live ride bookings."
                );

            }

        );

}


/* =====================================================
   START DELIVERY MONITORING
===================================================== */

function startDeliveryMonitoring() {

    const deliveryQuery =
        db
            .collection("deliveries")
            .orderBy(
                "createdAt",
                "desc"
            )
            .limit(100);


    unsubscribeDeliveries =
        deliveryQuery.onSnapshot(

            function(snapshot) {

                const deliveries = [];

                snapshot.forEach(
                    function(doc) {

                        deliveries.push({

                            id:
                                doc.id,

                            ...doc.data()

                        });

                    }
                );


                renderDeliveries(
                    deliveries
                );


                updateDeliveryStatistics(
                    deliveries
                );

            },

            function(error) {

                console.error(
                    "Delivery monitoring error:",
                    error
                );

            }

        );

}


/* =====================================================
   RENDER RIDES
===================================================== */

function renderRides(
    rides
) {

    const container =
        document.getElementById(
            "rideMonitoringList"
        );


    if (!container) {

        console.warn(
            "rideMonitoringList element not found."
        );

        return;

    }


    container.innerHTML = "";


    if (
        rides.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-monitoring">

                <strong>
                    No ride bookings
                </strong>

                <p>
                    New ride bookings will appear here automatically.
                </p>

            </div>

        `;

        return;

    }


    rides.forEach(
        function(ride) {

            container.appendChild(
                createRideCard(
                    ride
                )
            );

        }
    );

}


/* =====================================================
   CREATE RIDE CARD
===================================================== */

function createRideCard(
    ride
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "monitor-card";


    const status =
        ride.status ||
        "REQUESTED";


    const payment =
        ride.paymentStatus ||
        "UNKNOWN";


    const fare =
        ride.totalFare !== null &&
        ride.totalFare !== undefined
            ? "₦" +
              Number(
                  ride.totalFare
              ).toLocaleString(
                  "en-NG"
              )
            : "To be confirmed";


    card.innerHTML = `

        <div class="monitor-card-top">

            <div>

                <span class="monitor-label">
                    RIDE BOOKING
                </span>

                <h3>
                    ${escapeHTML(
                        ride.bookingReference ||
                        ride.id
                    )}
                </h3>

            </div>


            <span class="
                status-badge
                ${getStatusClass(status)}
            ">

                ${formatStatus(status)}

            </span>

        </div>


        <div class="monitor-route">

            <div class="monitor-location">

                <span class="location-dot pickup">
                    A
                </span>

                <div>

                    <small>
                        FROM
                    </small>

                    <strong>
                        ${escapeHTML(
                            ride.fromCity ||
                            "—"
                        )}
                    </strong>

                </div>

            </div>


            <div class="route-arrow">
                →
            </div>


            <div class="monitor-location">

                <span class="location-dot destination">
                    B
                </span>

                <div>

                    <small>
                        TO
                    </small>

                    <strong>
                        ${escapeHTML(
                            ride.toCity ||
                            "—"
                        )}
                    </strong>

                </div>

            </div>

        </div>


        <div class="monitor-details">

            <div>

                <span>
                    Passenger
                </span>

                <strong>
                    ${escapeHTML(
                        ride.passengerName ||
                        "—"
                    )}
                </strong>

            </div>


            <div>

                <span>
                    Phone
                </span>

                <strong>
                    ${escapeHTML(
                        ride.passengerPhone ||
                        "—"
                    )}
                </strong>

            </div>


            <div>

                <span>
                    Travel Date
                </span>

                <strong>
                    ${formatDate(
                        ride.travelDate
                    )}
                </strong>

            </div>


            <div>

                <span>
                    Preferred Time
                </span>

                <strong>
                    ${escapeHTML(
                        ride.preferredTime ||
                        "—"
                    )}
                </strong>

            </div>


            <div>

                <span>
                    Seats
                </span>

                <strong>
                    ${ride.seats || 0}
                </strong>

            </div>


            <div>

                <span>
                    Fare
                </span>

                <strong>
                    ${fare}
                </strong>

            </div>


            <div>

                <span>
                    Payment
                </span>

                <strong>
                    ${formatStatus(
                        payment
                    )}
                </strong>

            </div>


            <div>

                <span>
                    Request Type
                </span>

                <strong>
                    ${formatRequestType(
                        ride.requestType
                    )}
                </strong>

            </div>

        </div>


        <div class="monitor-actions">

            <button
                type="button"
                onclick="viewRideDetails('${ride.id}')"
            >
                VIEW DETAILS
            </button>


            ${
                status !== "CANCELLED" &&
                status !== "COMPLETED"
                    ? `
                        <button
                            type="button"
                            class="secondary-action"
                            onclick="updateRideStatus(
                                '${ride.id}'
                            )"
                        >
                            UPDATE STATUS
                        </button>
                      `
                    : ""
            }

        </div>

    `;


    return card;

}


/* =====================================================
   RENDER DELIVERIES
===================================================== */

function renderDeliveries(
    deliveries
) {

    const container =
        document.getElementById(
            "deliveryMonitoringList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    if (
        deliveries.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-monitoring">

                <strong>
                    No deliveries
                </strong>

                <p>
                    New deliveries will appear here.
                </p>

            </div>

        `;

        return;

    }


    deliveries.forEach(
        function(delivery) {

            container.appendChild(
                createDeliveryCard(
                    delivery
                )
            );

        }
    );

}


/* =====================================================
   CREATE DELIVERY CARD
===================================================== */

function createDeliveryCard(
    delivery
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "monitor-card";


    const status =
        delivery.status ||
        "PROCESSING";


    card.innerHTML = `

        <div class="monitor-card-top">

            <div>

                <span class="monitor-label">
                    DELIVERY
                </span>

                <h3>
                    ${escapeHTML(
                        delivery.bookingReference ||
                        delivery.id
                    )}
                </h3>

            </div>


            <span class="
                status-badge
                ${getStatusClass(status)}
            ">

                ${formatStatus(
                    status
                )}

            </span>

        </div>


        <div class="monitor-route">

            <div class="monitor-location">

                <span class="location-dot pickup">
                    P
                </span>

                <div>

                    <small>
                        PICKUP
                    </small>

                    <strong>
                        ${escapeHTML(
                            getLocationName(
                                delivery.pickup
                            )
                        )}
                    </strong>

                </div>

            </div>


            <div class="route-arrow">
                →
            </div>


            <div class="monitor-location">

                <span class="location-dot destination">
                    D
                </span>

                <div>

                    <small>
                        DESTINATION
                    </small>

                    <strong>
                        ${escapeHTML(
                            getLocationName(
                                delivery.destination
                            )
                        )}
                    </strong>

                </div>

            </div>

        </div>


        <div class="monitor-details">

            <div>

                <span>
                    Method
                </span>

                <strong>
                    ${formatMethod(
                        delivery.method
                    )}
                </strong>

            </div>


            <div>

                <span>
                    Partner
                </span>

                <strong>
                    ${escapeHTML(
                        delivery.partnerName ||
                        "Not assigned"
                    )}
                </strong>

            </div>


            <div>

                <span>
                    Distance
                </span>

                <strong>
                    ${
                        delivery.distanceKm
                            ? Number(
                                delivery.distanceKm
                              ).toFixed(1) +
                              " km"
                            : "—"
                    }
                </strong>

            </div>


            <div>

                <span>
                    GPS
                </span>

                <strong>
                    ${
                        delivery.tracking
                            ? "LIVE"
                            : "OFFLINE"
                    }
                </strong>

            </div>

        </div>


        <div class="monitor-actions">

            <button
                type="button"
                onclick="viewDeliveryDetails(
                    '${delivery.id}'
                )"
            >
                VIEW DELIVERY
            </button>

        </div>

    `;


    return card;

}


/* =====================================================
   RIDE STATISTICS
===================================================== */

function updateRideStatistics(
    rides
) {

    setText(
        "totalRides",
        rides.length
    );


    setText(
        "requestedRides",
        countStatus(
            rides,
            "REQUESTED"
        )
    );


    setText(
        "pendingPaymentRides",
        countStatus(
            rides,
            "PENDING_PAYMENT"
        )
    );


    setText(
        "confirmedRides",
        countStatus(
            rides,
            "CONFIRMED"
        )
    );


    setText(
        "completedRides",
        countStatus(
            rides,
            "COMPLETED"
        )
    );

}


/* =====================================================
   DELIVERY STATISTICS
===================================================== */

function updateDeliveryStatistics(
    deliveries
) {

    setText(
        "totalDeliveries",
        deliveries.length
    );


    setText(
        "activeDeliveries",
        deliveries.filter(
            function(item) {

                return [
                    "PARTNER_ASSIGNED",
                    "PICKED_UP",
                    "IN_TRANSIT"
                ].includes(
                    item.status
                );

            }
        ).length
    );


    setText(
        "deliveredCount",
        countStatus(
            deliveries,
            "DELIVERED"
        )
    );


    setText(
        "pendingDeliveries",
        deliveries.filter(
            function(item) {

                return [
                    "PAYMENT_PENDING",
                    "PAYMENT_CONFIRMED"
                ].includes(
                    item.status
                );

            }
        ).length
    );

}


/* =====================================================
   COUNT STATUS
===================================================== */

function countStatus(
    array,
    status
) {

    return array.filter(
        function(item) {

            return item.status === status;

        }
    ).length;

}


/* =====================================================
   VIEW RIDE
===================================================== */

function viewRideDetails(
    id
) {

    window.location.href =
        "admin-ride-details.html?id=" +
        encodeURIComponent(id);

}


/* =====================================================
   VIEW DELIVERY
===================================================== */

function viewDeliveryDetails(
    id
) {

    window.location.href =
        "admin-delivery-details.html?id=" +
        encodeURIComponent(id);

}


/* =====================================================
   UPDATE RIDE STATUS
===================================================== */

async function updateRideStatus(
    id
) {

    const newStatus =
        prompt(
            "Enter new ride status:\n\n" +
            "REQUESTED\n" +
            "PENDING_PAYMENT\n" +
            "CONFIRMED\n" +
            "IN_PROGRESS\n" +
            "COMPLETED\n" +
            "CANCELLED"
        );


    if (!newStatus) {

        return;

    }


    const status =
        newStatus
            .trim()
            .toUpperCase();


    const allowedStatuses = [

        "REQUESTED",

        "PENDING_PAYMENT",

        "CONFIRMED",

        "IN_PROGRESS",

        "COMPLETED",

        "CANCELLED"

    ];


    if (
        !allowedStatuses.includes(
            status
        )
    ) {

        alert(
            "Invalid ride status."
        );

        return;

    }


    try {

        await db
            .collection(
                "rideBookings"
            )
            .doc(id)
            .update({

                status:
                    status,

                updatedAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            });


        alert(
            "Ride status updated."
        );

    }
    catch(error) {

        console.error(
            error
        );


        alert(
            "Unable to update ride status."
        );

    }

}


/* =====================================================
   HELPERS
===================================================== */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


function formatStatus(
    status
) {

    if (!status) {

        return "Unknown";

    }


    return status
        .replace(
            /_/g,
            " "
        )
        .toLowerCase()
        .replace(
            /\b\w/g,
            function(letter) {

                return letter.toUpperCase();

            }
        );

}


function getStatusClass(
    status
) {

    switch (
        status
    ) {

        case "CONFIRMED":
        case "DELIVERED":
        case "COMPLETED":

            return "success";


        case "IN_PROGRESS":
        case "IN_TRANSIT":
        case "PICKED_UP":
        case "PARTNER_ASSIGNED":

            return "active";


        case "PENDING_PAYMENT":
        case "PAYMENT_PENDING":
        case "REQUESTED":

            return "pending";


        case "CANCELLED":

            return "cancelled";


        default:

            return "default";

    }

}


function formatRequestType(
    type
) {

    if (
        type ===
        "SCHEDULED_TRIP"
    ) {

        return "Scheduled Trip";

    }


    if (
        type ===
        "CUSTOM_REQUEST"
    ) {

        return "Custom Request";

    }


    return "—";

}


function formatMethod(
    method
) {

    const methods = {

        WALKER:
            "Walker",

        RIDER:
            "Rider",

        VEHICLE:
            "Vehicle",

        DRIVER:
            "Vehicle Driver"

    };


    return (
        methods[method] ||
        "Delivery Partner"
    );

}


function getLocationName(
    location
) {

    if (!location) {

        return "—";

    }


    return (
        location.address ||
        location.name ||
        "Location"
    );

}


function formatDate(
    date
) {

    if (!date) {

        return "—";

    }


    try {

        const parsed =
            new Date(
                date + "T00:00:00"
            );


        if (
            isNaN(
                parsed.getTime()
            )
        ) {

            return date;

        }


        return parsed.toLocaleDateString(
            "en-NG",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );

    }
    catch(error) {

        return date;

    }

}


function escapeHTML(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }


    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =====================================================
   ERROR
===================================================== */

function showMonitoringError(
    message
) {

    const container =
        document.getElementById(
            "rideMonitoringList"
        );


    if (
        container
    ) {

        container.innerHTML = `

            <div class="monitor-error">

                ${escapeHTML(
                    message
                )}

            </div>

        `;

    }

}


/* =====================================================
   CLEANUP
===================================================== */

window.addEventListener(
    "beforeunload",
    function() {

        if (
            unsubscribeRides
        ) {

            unsubscribeRides();

        }


        if (
            unsubscribeDeliveries
        ) {

            unsubscribeDeliveries();

        }

    }
);