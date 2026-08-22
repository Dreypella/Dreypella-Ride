/*
    DREYPELLA RIDE
    PARTNER DELIVERY DASHBOARD
*/


let currentUser = null;

let currentPartner = null;

let selectedDeliveryId = null;

let activeDeliveryId = null;

let unsubscribeAssigned = null;

let unsubscribeActive = null;

let gpsWatchId = null;

let gpsActive = false;


/*
    PAGE ELEMENTS
*/

const deliveryList =
    document.getElementById(
        "deliveryList"
    );

const message =
    document.getElementById(
        "message"
    );

const activeSection =
    document.getElementById(
        "activeDeliverySection"
    );

const activeDelivery =
    document.getElementById(
        "activeDelivery"
    );

const partnerName =
    document.getElementById(
        "partnerName"
    );

const partnerRole =
    document.getElementById(
        "partnerRole"
    );

const gpsStatus =
    document.getElementById(
        "gpsStatus"
    );

const gpsButton =
    document.getElementById(
        "gpsButton"
    );

const latitude =
    document.getElementById(
        "latitude"
    );

const longitude =
    document.getElementById(
        "longitude"
    );

const accuracy =
    document.getElementById(
        "accuracy"
    );

const pickupActions =
    document.getElementById(
        "pickupActions"
    );

const deliveryActions =
    document.getElementById(
        "deliveryActions"
    );


/*
    START
*/

firebase.auth()
    .onAuthStateChanged(
        async function(user) {

            if (!user) {

                window.location.href =
                    "login.html";

                return;

            }


            currentUser =
                user;


            await loadPartnerProfile();

        }
    );


/*
    LOAD PARTNER PROFILE
*/

async function loadPartnerProfile() {

    try {

        const document =
            await db
                .collection(
                    "users"
                )
                .doc(
                    currentUser.uid
                )
                .get();


        if (
            !document.exists
        ) {

            showMessage(
                "Your user profile could not be found."
            );

            return;

        }


        currentPartner =
            document.data();


        const allowedRoles = [

            "WALKER",
            "RIDER",
            "DRIVER"

        ];


        if (
            !allowedRoles.includes(
                currentPartner.role
            )
        ) {

            showMessage(
                "This page is only available to delivery partners."
            );

            return;

        }


        partnerName.textContent =
            currentPartner.fullName ||
            currentPartner.name ||
            "Partner";


        partnerRole.textContent =
            formatRole(
                currentPartner.role
            );


        loadDeliveries();


    } catch (error) {

        console.error(
            error
        );

        showMessage(
            "Unable to load your partner profile."
        );

    }

}


/*
    LOAD ASSIGNED DELIVERIES
*/

function loadDeliveries() {

    if (
        !currentUser ||
        !currentPartner
    ) {

        return;

    }


    if (
        unsubscribeAssigned
    ) {

        unsubscribeAssigned();

    }


    deliveryList.innerHTML =

        `<div class="loading">
            Loading deliveries...
        </div>`;


    unsubscribeAssigned =
        db
            .collection(
                "deliveries"
            )

            .where(
                "partnerId",
                "==",
                currentUser.uid
            )

            .onSnapshot(

                function(snapshot) {

                    renderDeliveries(
                        snapshot
                    );

                },

                function(error) {

                    console.error(
                        error
                    );

                    showMessage(
                        "Unable to load assigned deliveries."
                    );

                }

            );

}


/*
    RENDER DELIVERIES
*/

function renderDeliveries(
    snapshot
) {

    deliveryList.innerHTML = "";


    if (
        snapshot.empty
    ) {

        deliveryList.innerHTML =

            `<div class="loading">
                No assigned deliveries yet.
            </div>`;

        return;

    }


    let foundActive =
        false;


    snapshot.forEach(
        function(doc) {

            const delivery =
                doc.data();


            const card =
                createDeliveryCard(
                    doc.id,
                    delivery
                );


            deliveryList.appendChild(
                card
            );


            if (
                [
                    "PARTNER_ASSIGNED",
                    "PICKED_UP",
                    "IN_TRANSIT"
                ].includes(
                    delivery.status
                )
            ) {

                foundActive =
                    true;


                activateDelivery(
                    doc.id,
                    delivery
                );

            }

        }
    );


    if (!foundActive) {

        activeSection.style.display =
            "none";

    }

}


/*
    CREATE DELIVERY CARD
*/

function createDeliveryCard(
    id,
    delivery
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "delivery-card";


    const pickup =
        delivery.pickup?.address ||
        delivery.pickup?.name ||
        "Pickup";


    const destination =
        delivery.destination?.address ||
        delivery.destination?.name ||
        "Destination";


    const status =
        formatStatus(
            delivery.status
        );


    const canAccept =
        delivery.status ===
        "PARTNER_ASSIGNED";


    card.innerHTML = `

        <div class="delivery-card-top">

            <div>

                <h3>
                    ${escapeHtml(
                        delivery.bookingReference ||
                        "Delivery"
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        formatMethod(
                            delivery.method
                        )
                    )}
                </p>

            </div>

            <span class="status-badge">
                ${escapeHtml(status)}
            </span>

        </div>


        <div class="card-route">

            <div class="card-location">

                <div class="location-dot"></div>

                <div>

                    <strong>
                        Pickup
                    </strong>

                    <span>
                        ${escapeHtml(
                            pickup
                        )}
                    </span>

                </div>

            </div>


            <div class="card-location">

                <div class="location-dot"></div>

                <div>

                    <strong>
                        Destination
                    </strong>

                    <span>
                        ${escapeHtml(
                            destination
                        )}
                    </span>

                </div>

            </div>

        </div>


        <div class="card-bottom">

            <span class="price">
                ₦${formatMoney(
                    delivery.customerPrice
                )}
            </span>

            ${
                canAccept

                    ? `<button
                        class="primary-btn"
                        onclick="openAcceptModal('${id}')"
                    >
                        ACCEPT DELIVERY
                    </button>`

                    : `<span>
                        ${escapeHtml(
                            status
                        )}
                    </span>`
            }

        </div>

    `;


    return card;

}


/*
    OPEN ACCEPT MODAL
*/

async function openAcceptModal(
    deliveryId
) {

    selectedDeliveryId =
        deliveryId;


    try {

        const document =
            await db
                .collection(
                    "deliveries"
                )
                .doc(
                    deliveryId
                )
                .get();


        if (
            !document.exists
        ) {

            showMessage(
                "Delivery no longer exists."
            );

            return;

        }


        const delivery =
            document.data();


        const pickup =
            delivery.pickup?.address ||
            delivery.pickup?.name ||
            "Pickup";


        const destination =
            delivery.destination?.address ||
            delivery.destination?.name ||
            "Destination";


        document.getElementById(
            "acceptDetails"
        ).innerHTML = `

            <div class="detail-row">

                <span>
                    Booking
                </span>

                <strong>
                    ${escapeHtml(
                        delivery.bookingReference
                    )}
                </strong>

            </div>


            <div class="detail-row">

                <span>
                    Pickup
                </span>

                <strong>
                    ${escapeHtml(
                        pickup
                    )}
                </strong>

            </div>


            <div class="detail-row">

                <span>
                    Destination
                </span>

                <strong>
                    ${escapeHtml(
                        destination
                    )}
                </strong>

            </div>


            <div class="detail-row">

                <span>
                    Package
                </span>

                <strong>
                    ${escapeHtml(
                        delivery.packageCategory ||
                        "Package"
                    )}
                </strong>

            </div>


            <div class="detail-row">

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

        `;


        document.getElementById(
            "acceptModal"
        ).style.display =
            "flex";


    } catch (error) {

        console.error(
            error
        );

        showMessage(
            "Unable to open delivery."
        );

    }

}


/*
    CLOSE MODAL
*/

function closeAcceptModal() {

    document.getElementById(
        "acceptModal"
    ).style.display =
        "none";

}


/*
    ACCEPT DELIVERY
*/

async function acceptSelectedDelivery() {

    if (
        !selectedDeliveryId
    ) {

        return;

    }


    try {

        const ref =
            db
                .collection(
                    "deliveries"
                )
                .doc(
                    selectedDeliveryId
                );


        const document =
            await ref.get();


        if (
            !document.exists
        ) {

            throw new Error(
                "Delivery not found."
            );

        }


        const delivery =
            document.data();


        /*
            Prevent two partners from
            accepting the same delivery.
        */

        if (
            delivery.status !==
            "PARTNER_ASSIGNED"
        ) {

            throw new Error(
                "This delivery has already been accepted."
            );

        }


        await ref.update({

            status:
                "PARTNER_ASSIGNED",

            partnerAccepted:
                true,

            partnerAcceptedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),

            updatedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp()

        });


        closeAcceptModal();


        showMessage(
            "Delivery accepted successfully.",
            true
        );


        /*
            Activate it immediately.
        */

        activeDeliveryId =
            selectedDeliveryId;


    } catch (error) {

        console.error(
            error
        );

        showMessage(
            error.message
        );

    }

}


/*
    ACTIVATE DELIVERY
*/

function activateDelivery(
    id,
    delivery
) {

    activeDeliveryId =
        id;


    activeSection.style.display =
        "block";


    renderActiveDelivery(
        delivery
    );


    if (
        unsubscribeActive
    ) {

        unsubscribeActive();

    }


    unsubscribeActive =
        db
            .collection(
                "deliveries"
            )
            .doc(
                id
            )

            .onSnapshot(

                function(doc) {

                    if (
                        !doc.exists
                    ) {

                        return;

                    }


                    renderActiveDelivery(
                        doc.data()
                    );

                }

            );

}


/*
    RENDER ACTIVE DELIVERY
*/

function renderActiveDelivery(
    delivery
) {

    const pickup =
        delivery.pickup?.address ||
        delivery.pickup?.name ||
        "Pickup";


    const destination =
        delivery.destination?.address ||
        delivery.destination?.name ||
        "Destination";


    activeDelivery.innerHTML = `

        <div class="route">

            <div class="route-box">

                <small>
                    PICKUP
                </small>

                <strong>
                    ${escapeHtml(
                        pickup
                    )}
                </strong>

            </div>


            <div class="route-arrow">
                →
            </div>


            <div class="route-box">

                <small>
                    DESTINATION
                </small>

                <strong>
                    ${escapeHtml(
                        destination
                    )}
                </strong>

            </div>

        </div>


        <div class="delivery-meta">

            <div class="meta-item">

                <span>
                    Booking
                </span>

                <strong>
                    ${escapeHtml(
                        delivery.bookingReference
                    )}
                </strong>

            </div>


            <div class="meta-item">

                <span>
                    Method
                </span>

                <strong>
                    ${escapeHtml(
                        formatMethod(
                            delivery.method
                        )
                    )}
                </strong>

            </div>


            <div class="meta-item">

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

        </div>

    `;


    document.getElementById(
        "activeStatus"
    ).textContent =
        formatStatus(
            delivery.status
        );


    /*
        Show correct action.
    */

    if (
        delivery.status ===
        "PICKED_UP" ||
        delivery.status ===
        "IN_TRANSIT"
    ) {

        pickupActions.style.display =
            "none";


        deliveryActions.style.display =
            "block";

    } else {

        pickupActions.style.display =
            "block";


        deliveryActions.style.display =
            "none";

    }

}


/*
    VERIFY PICKUP OTP
*/

async function verifyPickup() {

    if (!activeDeliveryId) {

        showMessage(
            "There is no active delivery."
        );

        return;

    }


    const input =
        document.getElementById(
            "pickupOtp"
        );


    const otp =
        input.value.trim();


    if (
        otp.length !== 6
    ) {

        showMessage(
            "Enter the 6-digit pickup OTP."
        );

        return;

    }


    try {

        const ref =
            db
                .collection(
                    "deliveries"
                )
                .doc(
                    activeDeliveryId
                );


        const document =
            await ref.get();


        if (
            !document.exists
        ) {

            throw new Error(
                "Delivery not found."
            );

        }


        const delivery =
            document.data();


        /*
            In production the OTP should be
            verified server-side.

            This frontend check is only for
            the current development stage.
        */

        if (
            delivery.pickupOtp &&
            delivery.pickupOtp !== otp
        ) {

            throw new Error(
                "Incorrect pickup OTP."
            );

        }


        await ref.update({

            status:
                "PICKED_UP",

            pickupVerified:
                true,

            pickupVerifiedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),

            updatedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp()

        });


        input.value = "";


        showMessage(
            "Pickup verified. Package is now in transit.",
            true
        );


        startGPS();


    } catch (error) {

        console.error(
            error
        );

        showMessage(
            error.message
        );

    }

}


/*
    VERIFY DELIVERY OTP
*/

async function verifyDelivery() {

    if (!activeDeliveryId) {

        return;

    }


    const input =
        document.getElementById(
            "deliveryOtp"
        );


    const otp =
        input.value.trim();


    if (
        otp.length !== 6
    ) {

        showMessage(
            "Enter the 6-digit delivery OTP."
        );

        return;

    }


    try {

        const ref =
            db
                .collection(
                    "deliveries"
                )
                .doc(
                    activeDeliveryId
                );


        const document =
            await ref.get();


        if (
            !document.exists
        ) {

            throw new Error(
                "Delivery not found."
            );

        }


        const delivery =
            document.data();


        if (
            delivery.deliveryOtp &&
            delivery.deliveryOtp !== otp
        ) {

            throw new Error(
                "Incorrect delivery OTP."
            );

        }


        await ref.update({

            deliveryVerified:
                true,

            deliveryVerifiedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),

            updatedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp()

        });


        input.value = "";


        showMessage(
            "Delivery OTP verified.",
            true
        );


    } catch (error) {

        console.error(
            error
        );

        showMessage(
            error.message
        );

    }

}


/*
    COMPLETE DELIVERY
*/

async function completeDelivery() {

    if (!activeDeliveryId) {

        return;

    }


    try {

        const ref =
            db
                .collection(
                    "deliveries"
                )
                .doc(
                    activeDeliveryId
                );


        const document =
            await ref.get();


        if (
            !document.exists
        ) {

            throw new Error(
                "Delivery not found."
            );

        }


        const delivery =
            document.data();


        if (
            !delivery.deliveryVerified
        ) {

            throw new Error(
                "Verify the recipient's delivery OTP first."
            );

        }


        /*
            Stop GPS.
        */

        stopGPS();


        /*
            Complete delivery.
        */

        await ref.update({

            status:
                "DELIVERED",

            "tracking.active":
                false,

            deliveredAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),

            updatedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp()

        });


        /*
            Record partner earnings.

            NOTE:
            This is currently a transaction record
            for development. The final financial
            version should move this calculation
            into a Firebase Cloud Function.
        */

        const customerPrice =
            Number(
                delivery.customerPrice
            ) || 0;


        const partnerEarnings =
            customerPrice *
            0.70;


        await db
            .collection(
                "walletTransactions"
            )
            .add({

                userId:
                    currentUser.uid,

                deliveryId:
                    activeDeliveryId,

                bookingReference:
                    delivery.bookingReference,

                type:
                    "PARTNER_EARNINGS",

                amount:
                    partnerEarnings,

                status:
                    "PENDING",

                description:
                    "Delivery partner earnings",

                createdAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            });


        showMessage(
            "Delivery completed successfully.",
            true
        );


        activeSection.style.display =
            "none";


        activeDeliveryId =
            null;


        loadDeliveries();


    } catch (error) {

        console.error(
            error
        );

        showMessage(
            error.message
        );

    }

}


/*
    GPS
*/

function toggleGPS() {

    if (gpsActive) {

        stopGPS();

    } else {

        startGPS();

    }

}


function startGPS() {

    if (
        !navigator.geolocation
    ) {

        showMessage(
            "GPS is not supported on this device."
        );

        return;

    }


    if (!activeDeliveryId) {

        showMessage(
            "No active delivery."
        );

        return;

    }


    gpsActive =
        true;


    gpsButton.textContent =
        "STOP GPS";


    gpsStatus.textContent =
        "GPS is active";


    gpsWatchId =
        navigator.geolocation.watchPosition(

            function(position) {

                updateGPS(
                    position
                );

            },

            function(error) {

                console.error(
                    error
                );


                gpsStatus.textContent =
                    "Unable to access GPS";


                showMessage(
                    "Please allow location access."
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

}


function stopGPS() {

    if (
        gpsWatchId !== null
    ) {

        navigator.geolocation
            .clearWatch(
                gpsWatchId
            );

    }


    gpsWatchId =
        null;


    gpsActive =
        false;


    gpsButton.textContent =
        "START GPS";


    gpsStatus.textContent =
        "GPS not started";


    if (
        activeDeliveryId
    ) {

        db
            .collection(
                "deliveries"
            )
            .doc(
                activeDeliveryId
            )
            .update({

                "tracking.active":
                    false,

                updatedAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            })
            .catch(
                console.error
            );

    }

}


/*
    SEND GPS TO FIRESTORE
*/

async function updateGPS(
    position
) {

    if (
        !activeDeliveryId
    ) {

        return;

    }


    const coords =
        position.coords;


    latitude.textContent =
        coords.latitude.toFixed(6);


    longitude.textContent =
        coords.longitude.toFixed(6);


    accuracy.textContent =
        Math.round(
            coords.accuracy
        ) +
        " m";


    gpsStatus.textContent =
        "Location sharing active";


    try {

        await db
            .collection(
                "deliveries"
            )
            .doc(
                activeDeliveryId
            )
            .update({

                "tracking.active":
                    true,

                "tracking.latitude":
                    coords.latitude,

                "tracking.longitude":
                    coords.longitude,

                "tracking.accuracy":
                    coords.accuracy,

                "tracking.heading":
                    coords.heading,

                "tracking.speed":
                    coords.speed,

                "tracking.lastUpdated":
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp(),

                updatedAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            });

    } catch (error) {

        console.error(
            "GPS update failed:",
            error
        );

    }

}


/*
    FORMAT ROLE
*/

function formatRole(
    role
) {

    const roles = {

        WALKER:
            "Walker",

        RIDER:
            "Rider",

        DRIVER:
            "Vehicle Driver"

    };


    return (
        roles[role] ||
        "Delivery Partner"
    );

}


/*
    FORMAT METHOD
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
            "Assigned",

        PICKED_UP:
            "Picked Up",

        IN_TRANSIT:
            "In Transit",

        DELIVERED:
            "Delivered",

        CANCELLED:
            "Cancelled"

    };


    return (
        statuses[status] ||
        "Processing"
    );

}


/*
    FORMAT MONEY
*/

function formatMoney(
    amount
) {

    return Number(
        amount || 0
    ).toLocaleString(
        "en-NG"
    );

}


/*
    MESSAGE
*/

function showMessage(
    text,
    success = false
) {

    message.textContent =
        text;


    message.style.display =
        "block";


    if (success) {

        message.style.background =
            "#E8F7EE";

        message.style.color =
            "#16803C";

    } else {

        message.style.background =
            "#FFF3F3";

        message.style.color =
            "#E31B23";

    }


    setTimeout(
        function() {

            message.style.display =
                "none";

        },
        5000
    );

}


/*
    BASIC HTML ESCAPING
*/

function escapeHtml(
    value
) {

    return String(
        value || ""
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


/*
    CLEANUP
*/

window.addEventListener(
    "beforeunload",
    function() {

        if (
            unsubscribeAssigned
        ) {

            unsubscribeAssigned();

        }


        if (
            unsubscribeActive
        ) {

            unsubscribeActive();

        }


        stopGPS();

    }
);