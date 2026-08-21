/*
    DREYPELLA RIDE
    ADMIN LIVE DELIVERY & RIDE MONITORING

    Collections:
        deliveries
        rides

    Features:
        - Real-time delivery monitoring
        - Real-time ride monitoring
        - Search
        - Type filter
        - Status filter
        - Active delivery count
        - Active ride count
        - Online partner count
        - Attention count
        - Partner information
        - GPS coordinates
        - Last location update
        - Customer tracking link
*/


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let deliveryUnsubscribe = null;
let rideUnsubscribe = null;

let deliveries = [];
let rides = [];

let allOperations = [];

let selectedOperation = null;


/* =========================================================
   PAGE ELEMENTS
========================================================= */

const operationsList =
    document.getElementById(
        "operationsList"
    );

const resultCount =
    document.getElementById(
        "resultCount"
    );

const activeDeliveries =
    document.getElementById(
        "activeDeliveries"
    );

const activeRides =
    document.getElementById(
        "activeRides"
    );

const onlinePartners =
    document.getElementById(
        "onlinePartners"
    );

const attentionCount =
    document.getElementById(
        "attentionCount"
    );

const typeFilter =
    document.getElementById(
        "typeFilter"
    );

const statusFilter =
    document.getElementById(
        "statusFilter"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const connectionStatus =
    document.getElementById(
        "connectionStatus"
    );


/* =========================================================
   MODAL ELEMENTS
========================================================= */

const detailsModal =
    document.getElementById(
        "detailsModal"
    );

const closeModal =
    document.getElementById(
        "closeModal"
    );

const modalReference =
    document.getElementById(
        "modalReference"
    );

const modalType =
    document.getElementById(
        "modalType"
    );

const modalStatus =
    document.getElementById(
        "modalStatus"
    );

const modalCustomer =
    document.getElementById(
        "modalCustomer"
    );

const modalPartner =
    document.getElementById(
        "modalPartner"
    );

const modalPickup =
    document.getElementById(
        "modalPickup"
    );

const modalDestination =
    document.getElementById(
        "modalDestination"
    );

const modalLatitude =
    document.getElementById(
        "modalLatitude"
    );

const modalLongitude =
    document.getElementById(
        "modalLongitude"
    );

const modalUpdated =
    document.getElementById(
        "modalUpdated"
    );

const openTracking =
    document.getElementById(
        "openTracking"
    );


/* =========================================================
   START MONITORING
========================================================= */

startDeliveryMonitoring();

startRideMonitoring();


/* =========================================================
   DELIVERY MONITORING
========================================================= */

function startDeliveryMonitoring() {

    if (
        typeof db === "undefined"
    ) {

        console.error(
            "Firestore database is not available."
        );

        showConnectionError();

        return;

    }


    deliveryUnsubscribe =
        db
            .collection(
                "deliveries"
            )

            .onSnapshot(

                function(snapshot) {

                    deliveries = [];


                    snapshot.forEach(
                        function(doc) {

                            const data =
                                doc.data();


                            deliveries.push({

                                id:
                                    doc.id,

                                ...data,

                                operationType:
                                    "DELIVERY"

                            });

                        }
                    );


                    rebuildOperations();

                    showConnected();

                },

                function(error) {

                    console.error(
                        "Delivery monitoring error:",
                        error
                    );

                    showConnectionError();

                }

            );

}


/* =========================================================
   RIDE MONITORING
========================================================= */

function startRideMonitoring() {

    if (
        typeof db === "undefined"
    ) {

        return;

    }


    rideUnsubscribe =
        db
            .collection(
                "rides"
            )

            .onSnapshot(

                function(snapshot) {

                    rides = [];


                    snapshot.forEach(
                        function(doc) {

                            const data =
                                doc.data();


                            rides.push({

                                id:
                                    doc.id,

                                ...data,

                                operationType:
                                    "RIDE"

                            });

                        }
                    );


                    rebuildOperations();

                    showConnected();

                },

                function(error) {

                    console.error(
                        "Ride monitoring error:",
                        error
                    );

                }

            );

}


/* =========================================================
   COMBINE OPERATIONS
========================================================= */

function rebuildOperations() {

    allOperations = [

        ...deliveries,

        ...rides

    ];


    updateSummary();


    renderOperations();

}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary() {

    const activeDeliveryList =
        deliveries.filter(
            isActiveDelivery
        );


    const activeRideList =
        rides.filter(
            isActiveRide
        );


    activeDeliveries.textContent =
        activeDeliveryList.length;


    activeRides.textContent =
        activeRideList.length;


    /*
        Find partners that are currently
        assigned to active operations.
    */

    const partnerIds =
        new Set();


    allOperations.forEach(
        function(operation) {

            if (
                !isActiveOperation(
                    operation
                )
            ) {

                return;

            }


            const partnerId =
                operation.partnerId ||
                operation.driverId ||
                operation.riderId ||
                operation.walkerId;


            if (
                partnerId
            ) {

                partnerIds.add(
                    partnerId
                );

            }

        }
    );


    onlinePartners.textContent =
        partnerIds.size;


    /*
        Attention count.
    */

    const attention =
        allOperations.filter(
            function(operation) {

                return isAttentionRequired(
                    operation
                );

            }
        );


    attentionCount.textContent =
        attention.length;

}


/* =========================================================
   ACTIVE DELIVERY
========================================================= */

function isActiveDelivery(
    delivery
) {

    const status =
        normalizeStatus(
            delivery.status
        );


    return ![

        "DELIVERED",
        "CANCELLED",
        "COMPLETED",
        "FAILED"

    ].includes(
        status
    );

}


/* =========================================================
   ACTIVE RIDE
========================================================= */

function isActiveRide(
    ride
) {

    const status =
        normalizeStatus(
            ride.status
        );


    return ![

        "COMPLETED",
        "CANCELLED",
        "CANCELLED_BY_CUSTOMER",
        "CANCELLED_BY_DRIVER",
        "FINISHED",
        "FAILED"

    ].includes(
        status
    );

}


/* =========================================================
   ACTIVE OPERATION
========================================================= */

function isActiveOperation(
    operation
) {

    if (
        operation.operationType ===
        "DELIVERY"
    ) {

        return isActiveDelivery(
            operation
        );

    }


    return isActiveRide(
        operation
    );

}


/* =========================================================
   ATTENTION
========================================================= */

function isAttentionRequired(
    operation
) {

    const status =
        normalizeStatus(
            operation.status
        );


    /*
        Unassigned operations.
    */

    const partnerId =
        operation.partnerId ||
        operation.driverId ||
        operation.riderId ||
        operation.walkerId;


    if (
        isActiveOperation(
            operation
        ) &&
        !partnerId
    ) {

        return true;

    }


    /*
        Explicit attention statuses.
    */

    if (

        status ===
        "DELAYED"

        ||

        status ===
        "PAYMENT_ISSUE"

        ||

        status ===
        "LOCATION_LOST"

        ||

        status ===
        "NO_DRIVER"

        ||

        status ===
        "NO_PARTNER"

    ) {

        return true;

    }


    return false;

}


/* =========================================================
   RENDER OPERATIONS
========================================================= */

function renderOperations() {

    const type =
        typeFilter.value;


    const status =
        statusFilter.value;


    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    let filtered =
        allOperations.filter(
            function(operation) {

                /*
                    Type
                */

                if (
                    type !== "ALL" &&
                    operation.operationType !== type
                ) {

                    return false;

                }


                /*
                    Status
                */

                if (
                    status !== "ALL" &&
                    normalizeStatus(
                        operation.status
                    ) !== status
                ) {

                    return false;

                }


                /*
                    Search
                */

                if (
                    search
                ) {

                    const searchable = [

                        operation.bookingReference,

                        operation.reference,

                        operation.customerName,

                        operation.customerEmail,

                        operation.phone,

                        operation.customerPhone,

                        operation.partnerName,

                        operation.driverName,

                        operation.riderName,

                        getLocationText(
                            operation.pickup
                        ),

                        getLocationText(
                            operation.destination
                        ),

                        getLocationText(
                            operation.origin

                        )

                    ]

                    .filter(
                        Boolean
                    )

                    .join(
                        " "
                    )

                    .toLowerCase();


                    if (
                        !searchable.includes(
                            search
                        )
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );


    /*
        Sort newest/updated first.
    */

    filtered.sort(
        function(a, b) {

            const aTime =
                getOperationTime(
                    a
                );


            const bTime =
                getOperationTime(
                    b
                );


            return bTime - aTime;

        }
    );


    resultCount.textContent =
        filtered.length +
        (
            filtered.length === 1
                ? " operation"
                : " operations"
        );


    if (
        filtered.length === 0
    ) {

        operationsList.innerHTML = `

            <div class="empty-state">

                <strong>
                    No operations found
                </strong>

                <p>
                    There are no operations matching your current filters.
                </p>

            </div>

        `;

        return;

    }


    operationsList.innerHTML =
        filtered
            .map(
                createOperationHTML
            )
            .join(
                ""
            );


    attachViewButtons();

}


/* =========================================================
   OPERATION HTML
========================================================= */

function createOperationHTML(
    operation
) {

    const reference =
        getReference(
            operation
        );


    const customer =
        getCustomerName(
            operation
        );


    const pickup =
        getPickup(
            operation
        );


    const destination =
        getDestination(
            operation
        );


    const partner =
        getPartnerName(
            operation
        );


    const status =
        normalizeStatus(
            operation.status
        );


    const statusText =
        formatStatus(
            status
        );


    const badgeClass =
        getStatusClass(
            status
        );


    return `

        <div
            class="operation-row"
            data-id="${escapeHTML(
                operation.id
            )}"
            data-type="${escapeHTML(
                operation.operationType
            )}"
        >

            <div class="operation-main">

                <strong>
                    ${escapeHTML(
                        reference
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        operation.operationType
                    )}
                </span>

            </div>


            <div class="operation-route">

                <span>
                    ROUTE
                </span>

                <strong>
                    ${escapeHTML(
                        pickup
                    )}
                </strong>

                <strong>
                    ↓ ${escapeHTML(
                        destination
                    )}
                </strong>

            </div>


            <div class="operation-partner">

                <span>
                    CUSTOMER / PARTNER
                </span>

                <strong>
                    ${escapeHTML(
                        customer
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        partner
                    )}
                </span>

            </div>


            <div>

                <span
                    class="status-badge ${badgeClass}"
                >
                    ${escapeHTML(
                        statusText
                    )}
                </span>

            </div>


            <div>

                <button
                    class="view-button"
                    data-operation-id="${escapeHTML(
                        operation.id
                    )}"
                    data-operation-type="${escapeHTML(
                        operation.operationType
                    )}"
                >
                    VIEW
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   VIEW BUTTONS
========================================================= */

function attachViewButtons() {

    const buttons =
        document.querySelectorAll(
            ".view-button"
        );


    buttons.forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    const id =
                        button.dataset.operationId;


                    const type =
                        button.dataset.operationType;


                    openOperationDetails(
                        id,
                        type
                    );

                }
            );

        }
    );

}


/* =========================================================
   OPEN DETAILS
========================================================= */

function openOperationDetails(
    id,
    type
) {

    selectedOperation =
        allOperations.find(
            function(operation) {

                return (

                    operation.id === id &&

                    operation.operationType ===
                        type

                );

            }
        );


    if (
        !selectedOperation
    ) {

        return;

    }


    const operation =
        selectedOperation;


    modalReference.textContent =
        getReference(
            operation
        );


    modalType.textContent =
        operation.operationType;


    modalStatus.textContent =
        formatStatus(
            operation.status
        );


    modalCustomer.textContent =
        getCustomerName(
            operation
        );


    modalPartner.textContent =
        getPartnerName(
            operation
        );


    modalPickup.textContent =
        getPickup(
            operation
        );


    modalDestination.textContent =
        getDestination(
            operation
        );


    const tracking =
        getTracking(
            operation
        );


    if (
        tracking
    ) {

        modalLatitude.textContent =
            formatCoordinate(
                tracking.latitude
            );


        modalLongitude.textContent =
            formatCoordinate(
                tracking.longitude
            );


        modalUpdated.textContent =
            formatTimestamp(
                tracking.lastUpdated ||
                tracking.updatedAt
            );

    } else {

        modalLatitude.textContent =
            "—";


        modalLongitude.textContent =
            "—";


        modalUpdated.textContent =
            "—";

    }


    detailsModal.classList.add(
        "show"
    );

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeDetailsModal() {

    detailsModal.classList.remove(
        "show"
    );


    selectedOperation =
        null;

}


if (
    closeModal
) {

    closeModal.addEventListener(
        "click",
        closeDetailsModal
    );

}


const modalOverlay =
    document.querySelector(
        ".modal-overlay"
    );


if (
    modalOverlay
) {

    modalOverlay.addEventListener(
        "click",
        closeDetailsModal
    );

}


/* =========================================================
   CUSTOMER TRACKING
========================================================= */

if (
    openTracking
) {

    openTracking.addEventListener(
        "click",
        function() {

            if (
                !selectedOperation
            ) {

                return;

            }


            const reference =
                getReference(
                    selectedOperation
                );


            if (
                !reference
            ) {

                return;

            }


            /*
                Deliveries use the customer
                delivery tracking page.

                Rides use the ride tracking
                page.
            */

            let trackingPage;


            if (
                selectedOperation.operationType ===
                "DELIVERY"
            ) {

                trackingPage =
                    "customer-delivery-tracking.html";

            } else {

                trackingPage =
                    "ride-tracking.html";

            }


            window.open(
                trackingPage +
                "?booking=" +
                encodeURIComponent(
                    reference
                ),
                "_blank"
            );

        }
    );

}


/* =========================================================
   FILTER EVENTS
========================================================= */

if (
    typeFilter
) {

    typeFilter.addEventListener(
        "change",
        renderOperations
    );

}


if (
    statusFilter
) {

    statusFilter.addEventListener(
        "change",
        renderOperations
    );

}


if (
    searchInput
) {

    searchInput.addEventListener(
        "input",
        renderOperations
    );

}


/* =========================================================
   HELPERS
========================================================= */

function getReference(
    operation
) {

    return (

        operation.bookingReference ||

        operation.reference ||

        operation.bookingId ||

        operation.id ||

        "No Reference"

    );

}


function getCustomerName(
    operation
) {

    return (

        operation.customerName ||

        operation.customer?.name ||

        operation.userName ||

        operation.name ||

        operation.customerEmail ||

        operation.customerPhone ||

        "Customer"

    );

}


function getPartnerName(
    operation
) {

    return (

        operation.partnerName ||

        operation.driverName ||

        operation.riderName ||

        operation.walkerName ||

        operation.partner?.name ||

        operation.driver?.name ||

        operation.rider?.name ||

        operation.walker?.name ||

        "Unassigned"

    );

}


function getPickup(
    operation
) {

    if (
        operation.pickup
    ) {

        return getLocationText(
            operation.pickup
        );

    }


    if (
        operation.origin
    ) {

        return getLocationText(
            operation.origin
        );

    }


    return (

        operation.pickupLocation ||

        operation.originLocation ||

        "Pickup / Origin unavailable"

    );

}


function getDestination(
    operation
) {

    if (
        operation.destination
    ) {

        return getLocationText(
            operation.destination
        );

    }


    return (

        operation.destinationLocation ||

        operation.dropoffLocation ||

        operation.finalDestination ||

        "Destination unavailable"

    );

}


function getLocationText(
    location
) {

    if (
        !location
    ) {

        return "";

    }


    if (
        typeof location ===
        "string"
    ) {

        return location;

    }


    return (

        location.address ||

        location.name ||

        location.place ||

        location.location ||

        location.formattedAddress ||

        ""

    );

}


function getTracking(
    operation
) {

    return (

        operation.tracking ||

        operation.liveLocation ||

        operation.location ||

        operation.currentLocation ||

        null

    );

}


function getOperationTime(
    operation
) {

    const tracking =
        getTracking(
            operation
        );


    const value =

        tracking?.lastUpdated ||

        tracking?.updatedAt ||

        operation.updatedAt ||

        operation.createdAt;


    return timestampToMilliseconds(
        value
    );

}


/* =========================================================
   STATUS
========================================================= */

function normalizeStatus(
    status
) {

    if (
        !status
    ) {

        return "PROCESSING";

    }


    return String(
        status
    )
        .trim()
        .toUpperCase();

}


function formatStatus(
    status
) {

    const formatted =
        normalizeStatus(
            status
        )
            .replaceAll(
                "_",
                " "
            );


    return formatted;

}


function getStatusClass(
    status
) {

    const normalized =
        normalizeStatus(
            status
        );


    if (

        normalized ===
            "CANCELLED"

        ||

        normalized ===
            "FAILED"

        ||

        normalized ===
            "PAYMENT_PENDING"

    ) {

        return "danger";

    }


    if (

        normalized ===
            "DELAYED"

        ||

        normalized ===
            "NO_PARTNER"

        ||

        normalized ===
            "NO_DRIVER"

    ) {

        return "warning";

    }


    return "";

}


/* =========================================================
   TIMESTAMP
========================================================= */

function timestampToMilliseconds(
    timestamp
) {

    if (
        !timestamp
    ) {

        return 0;

    }


    try {

        if (
            typeof timestamp.toMillis ===
            "function"
        ) {

            return timestamp.toMillis();

        }


        if (
            typeof timestamp.toDate ===
            "function"
        ) {

            return timestamp
                .toDate()
                .getTime();

        }


        if (
            timestamp.seconds
        ) {

            return (
                Number(
                    timestamp.seconds
                ) * 1000
            );

        }


        const date =
            new Date(
                timestamp
            );


        return date.getTime();

    } catch (
        error
    ) {

        return 0;

    }

}


function formatTimestamp(
    timestamp
) {

    const milliseconds =
        timestampToMilliseconds(
            timestamp
        );


    if (
        !milliseconds
    ) {

        return "—";

    }


    try {

        return new Date(
            milliseconds
        ).toLocaleString(
            "en-NG",
            {

                day:
                    "2-digit",

                month:
                    "short",

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


function formatCoordinate(
    coordinate
) {

    if (
        coordinate ===
        undefined ||
        coordinate ===
        null
    ) {

        return "—";

    }


    const number =
        Number(
            coordinate
        );


    if (
        Number.isNaN(
            number
        )
    ) {

        return "—";

    }


    return number.toFixed(
        6
    );

}


/* =========================================================
   HTML SECURITY
========================================================= */

function escapeHTML(
    value
) {

    if (
        value ===
        undefined ||
        value ===
        null
    ) {

        return "";

    }


    return String(
        value
    )
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


/* =========================================================
   CONNECTION STATUS
========================================================= */

function showConnected() {

    if (
        !connectionStatus
    ) {

        return;

    }


    connectionStatus.innerHTML = `

        <span class="connection-dot"></span>

        LIVE

    `;

}


function showConnectionError() {

    if (
        !connectionStatus
    ) {

        return;

    }


    connectionStatus.innerHTML = `

        <span class="connection-dot"></span>

        CONNECTION ERROR

    `;

}


/* =========================================================
   FIRESTORE CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function() {

        if (
            deliveryUnsubscribe
        ) {

            deliveryUnsubscribe();

        }


        if (
            rideUnsubscribe
        ) {

            rideUnsubscribe();

        }

    }
);