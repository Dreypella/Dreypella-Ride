/* =====================================================
   DREYPELLA RIDE
   ADMIN RIDE MANAGEMENT
   ===================================================== */


const db = firebase.firestore();
const auth = firebase.auth();



/* =====================================================
   DOM
   ===================================================== */

const requestsContainer =
    document.getElementById("requestsContainer");

const tripsContainer =
    document.getElementById("tripsContainer");

const pendingCount =
    document.getElementById("pendingCount");

const tripCount =
    document.getElementById("tripCount");

const activeCount =
    document.getElementById("activeCount");

const completedCount =
    document.getElementById("completedCount");

const tripModal =
    document.getElementById("tripModal");

const newTripButton =
    document.getElementById("newTripButton");

const closeModalButton =
    document.getElementById("closeModalButton");

const tripForm =
    document.getElementById("tripForm");

const tripFormMessage =
    document.getElementById("tripFormMessage");

const saveTripButton =
    document.getElementById("saveTripButton");

const addTripGroupButton =
    document.getElementById("addTripGroupButton");

const tripGroupsContainer =
    document.getElementById("tripGroupsContainer");

const logoutButton =
    document.getElementById("logoutButton");



/* =====================================================
   CURRENT ADMIN
   ===================================================== */

let currentAdmin = null;

let editingTripId = null;

/* Custom customer request currently being assigned */
let assigningRequestId = null;



/* =====================================================
   AUTHENTICATION
   ===================================================== */

auth.onAuthStateChanged(async function(user) {

    if (!user) {

        window.location.href =
            "login.html";

        return;

    }


    currentAdmin = user;


    /*
     IMPORTANT:

     The user document must contain:

     role: "ADMIN"

     or:

     role: "SUPER_ADMIN"
    */


    try {

        const userDoc =
            await db.collection("users")
            .doc(user.uid)
            .get();


        if (!userDoc.exists) {

            alert(
                "Admin profile not found."
            );

            await auth.signOut();

            window.location.href =
                "login.html";

            return;

        }


        const userData =
            userDoc.data();


        if (
            userData.role !== "ADMIN" &&
            userData.role !== "SUPER_ADMIN"
        ) {

            alert(
                "You do not have permission to access this page."
            );

            window.location.href =
                "customer-dashboard.html";

            return;

        }


        loadRequests();

        loadTrips();

    } catch (error) {

        console.error(
            "Admin verification error:",
            error
        );

    }

});



/* =====================================================
   CREATE TRIP MODAL
   ===================================================== */

newTripButton.addEventListener(
    "click",
    function() {

        editingTripId = null;
        assigningRequestId = null;

        tripForm.reset();

        resetTripGroups();

        saveTripButton.textContent =
            "CREATE TRIP";

        tripFormMessage.textContent =
            "";

        tripModal.classList.remove(
            "hidden"
        );

    }
);



/* =====================================================
   CLOSE MODAL
   ===================================================== */

closeModalButton.addEventListener(
    "click",
    function() {

        tripModal.classList.add(
            "hidden"
        );

    }
);


tripModal.addEventListener(
    "click",
    function(event) {

        if (
            event.target === tripModal
        ) {

            tripModal.classList.add(
                "hidden"
            );

        }

    }
);



/* =====================================================
   TRIP GROUP MANAGEMENT
   ===================================================== */

let tripGroupSequence = 0;

function createTripGroupId() {

    tripGroupSequence += 1;

    return (
        "GROUP-" +
        Date.now() +
        "-" +
        tripGroupSequence
    );
}


function getTripGroupElements() {

    if (!tripGroupsContainer) {
        return [];
    }

    return Array.from(
        tripGroupsContainer.querySelectorAll(
            ".trip-group-card"
        )
    );
}


function renderTripGroups(groups) {

    tripGroupsContainer.innerHTML = "";

    if (!Array.isArray(groups) || groups.length === 0) {

        tripGroupsContainer.innerHTML = `
            <div class="trip-group-empty">
                No trip groups added yet. Click
                <strong>+ ADD GROUP</strong>
                to add a bus or vehicle group.
            </div>
        `;

        return;
    }

    groups.forEach(function(group, index) {

        addTripGroup(group, index + 1);

    });

}


function addTripGroup(
    group = {},
    displayNumber = null
) {

    const existingBookedSeats =
        Array.isArray(group.bookedSeatNumbers)
            ? group.bookedSeatNumbers
                .map(number => Number(number))
                .filter(
                    number =>
                        Number.isInteger(number) &&
                        number > 0
                )
            : [];

    const groupId =
        String(
            group.groupId ||
            createTripGroupId()
        );

    const card =
        document.createElement("div");

    card.className =
        "trip-group-card";

    card.dataset.groupId =
        groupId;

    card.dataset.bookedSeatNumbers =
        JSON.stringify(
            existingBookedSeats
        );

    card.dataset.existingAvailableSeats =
        String(
            Number(
                group.availableSeats ??
                group.capacity ??
                0
            )
        );

    card.innerHTML = `

        <div class="trip-group-card-header">

            <strong>
                Trip Group ${
                    displayNumber ||
                    getTripGroupElements().length + 1
                }
            </strong>

            <button
                type="button"
                class="trip-group-remove"
            >
                REMOVE
            </button>

        </div>

        <div class="trip-group-fields">

            <div class="form-group full">

                <label>
                    Gathering / Pickup Point
                </label>

                <input
                    type="text"
                    class="trip-group-gathering-point"
                    placeholder="e.g. Under G"
                    value="${escapeHTML(
                        group.gatheringPoint ||
                        group.meetingPoint ||
                        ""
                    )}"
                    required
                >

            </div>

            <div class="form-group">

                <label>
                    Bus / Vehicle Details
                </label>

                <input
                    type="text"
                    class="trip-group-vehicle"
                    placeholder="e.g. Toyota Hiace - ABC 123"
                    value="${escapeHTML(
                        group.vehicle ||
                        ""
                    )}"
                    required
                >

            </div>

            <div class="form-group">

                <label>
                    Driver Name
                </label>

                <input
                    type="text"
                    class="trip-group-driver"
                    placeholder="Driver name"
                    value="${escapeHTML(
                        group.driverName ||
                        ""
                    )}"
                    required
                >

            </div>

            <div class="form-group">

                <label>
                    Passenger Capacity
                </label>

                <input
                    type="number"
                    class="trip-group-capacity"
                    min="1"
                    value="${
                        Number(
                            group.capacity ||
                            14
                        )
                    }"
                    required
                >

            </div>

            <div class="form-group">

                <label>
                    Group ID
                </label>

                <input
                    type="text"
                    value="${escapeHTML(groupId)}"
                    readonly
                >

            </div>

        </div>
    `;

    card
        .querySelector(
            ".trip-group-remove"
        )
        .addEventListener(
            "click",
            function() {

                card.remove();

                refreshTripGroupNumbers();

            }
        );

    tripGroupsContainer.appendChild(
        card
    );

}


function refreshTripGroupNumbers() {

    getTripGroupElements()
        .forEach(
            function(card, index) {

                const title =
                    card.querySelector(
                        ".trip-group-card-header strong"
                    );

                if (title) {

                    title.textContent =
                        "Trip Group " +
                        (index + 1);

                }

            }
        );

    if (
        getTripGroupElements().length === 0
    ) {

        tripGroupsContainer.innerHTML = `
            <div class="trip-group-empty">
                No trip groups added yet. Click
                <strong>+ ADD GROUP</strong>
                to add a bus or vehicle group.
            </div>
        `;

    }

}


function collectTripGroups() {

    const cards =
        getTripGroupElements();

    return cards.map(function(card) {

        const bookedSeatNumbers =
            JSON.parse(
                card.dataset.bookedSeatNumbers ||
                "[]"
            );

        const capacity =
            Number(
                card.querySelector(
                    ".trip-group-capacity"
                ).value
            );

        const bookedCount =
            bookedSeatNumbers.length;

        return {

            groupId:
                card.dataset.groupId ||
                createTripGroupId(),

            gatheringPoint:
                card.querySelector(
                    ".trip-group-gathering-point"
                ).value.trim(),

            vehicle:
                card.querySelector(
                    ".trip-group-vehicle"
                ).value.trim(),

            driverName:
                card.querySelector(
                    ".trip-group-driver"
                ).value.trim(),

            capacity,

            availableSeats:
                capacity - bookedCount,

            bookedSeatNumbers

        };

    });

}


if (addTripGroupButton) {

    addTripGroupButton.addEventListener(
        "click",
        function() {

            const existingCards =
                getTripGroupElements();

            if (
                existingCards.length === 0
            ) {

                tripGroupsContainer.innerHTML =
                    "";

            }

            addTripGroup();

            refreshTripGroupNumbers();

        }
    );

}


function resetTripGroups() {

    tripGroupsContainer.innerHTML = `
        <div class="trip-group-empty">
            No trip groups added yet. Click
            <strong>+ ADD GROUP</strong>
            to add a bus or vehicle group.
        </div>
    `;

}


/* =====================================================
   CREATE / UPDATE TRIP
   ===================================================== */

tripForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const from =
            document.getElementById(
                "tripFrom"
            ).value;

        const to =
            document.getElementById(
                "tripTo"
            ).value;

        const date =
            document.getElementById(
                "tripDate"
            ).value;

        const departureTime =
            document.getElementById(
                "tripTime"
            ).value;

        const finalDestination =
            document.getElementById(
                "finalDestination"
            ).value.trim();

        const price =
            Number(
                document.getElementById(
                    "tripPrice"
                ).value
            );

        const status =
            document.getElementById(
                "tripStatus"
            ).value;

        const groups =
            collectTripGroups();

        /* VALIDATION */

        if (from === to) {

            showFormMessage(
                "Departure and destination cannot be the same.",
                true
            );

            return;
        }

        if (
            !Number.isFinite(price) ||
            price < 0
        ) {

            showFormMessage(
                "Price cannot be negative.",
                true
            );

            return;
        }

        if (
            !Array.isArray(groups) ||
            groups.length === 0
        ) {

            showFormMessage(
                "Add at least one trip group.",
                true
            );

            return;
        }

        for (
            let index = 0;
            index < groups.length;
            index++
        ) {

            const group =
                groups[index];

            const bookedSeatNumbers =
                Array.isArray(
                    group.bookedSeatNumbers
                )
                    ? group.bookedSeatNumbers
                    : [];

            const bookedCount =
                bookedSeatNumbers.length;

            if (
                !group.gatheringPoint ||
                !group.vehicle ||
                !group.driverName
            ) {

                showFormMessage(
                    "Complete all required details for Trip Group " +
                    (index + 1) +
                    ".",
                    true
                );

                return;
            }

            if (
                !Number.isInteger(
                    group.capacity
                ) ||
                group.capacity < 1
            ) {

                showFormMessage(
                    "Passenger capacity for Trip Group " +
                    (index + 1) +
                    " must be at least 1.",
                    true
                );

                return;
            }

            if (
                group.capacity <
                bookedCount
            ) {

                showFormMessage(
                    "Trip Group " +
                    (index + 1) +
                    " capacity cannot be lower than its existing booked seats.",
                    true
                );

                return;
            }

            if (
                bookedSeatNumbers.some(
                    seatNumber =>
                        seatNumber >
                        group.capacity
                )
            ) {

                showFormMessage(
                    "Trip Group " +
                    (index + 1) +
                    " capacity cannot be lower than an existing assigned seat number.",
                    true
                );

                return;
            }

        }

        const totalCapacity =
            groups.reduce(
                function(total, group) {
                    return total +
                        Number(
                            group.capacity
                        );
                },
                0
            );

        const totalAvailableSeats =
            groups.reduce(
                function(total, group) {
                    return total +
                        Number(
                            group.availableSeats
                        );
                },
                0
            );

        const firstGroup =
            groups[0];

        saveTripButton.disabled =
            true;

        saveTripButton.textContent =
            "SAVING...";

        try {

            const tripData = {

                from,
                fromCity: from,

                to,
                toCity: to,

                date,
                travelDate: date,

                departureTime,

                finalDestination,

                price,
                fare: price,

                /* NEW GROUP STRUCTURE */

                groups,

                /*
                    LEGACY COMPATIBILITY FIELDS

                    These mirror the first group so
                    older parts of the application
                    can continue reading the trip.
                */

                meetingPoint:
                    firstGroup.gatheringPoint,

                gatheringPoint:
                    firstGroup.gatheringPoint,

                vehicle:
                    firstGroup.vehicle,

                driverName:
                    firstGroup.driverName,

                capacity:
                    totalCapacity,

                availableSeats:
                    totalAvailableSeats,

                status,

                updatedAt:
                    firebase.firestore.FieldValue
                    .serverTimestamp()

            };

            if (editingTripId) {

                await db
                    .collection("trips")
                    .doc(editingTripId)
                    .update(tripData);

            } else {

                tripData.createdBy =
                    currentAdmin.uid;

                tripData.createdAt =
                    firebase.firestore.FieldValue
                    .serverTimestamp();

                const createdTrip =
                    await db
                        .collection("trips")
                        .add(tripData);

                /*
                 * If this trip was created from a
                 * customer's custom request, link
                 * that booking to the new trip.
                 */
                if (assigningRequestId) {

                    await db
                        .collection("rideBookings")
                        .doc(assigningRequestId)
                        .update({

                            tripId:
                                createdTrip.id,

                            status:
                                "PENDING_PAYMENT",

                            requestType:
                                "SCHEDULED_TRIP",

                            assignedAt:
                                firebase.firestore
                                .FieldValue
                                .serverTimestamp(),

                            assignedBy:
                                currentAdmin.uid

                        });

                    assigningRequestId = null;

                }

            }

            tripModal.classList.add(
                "hidden"
            );

            tripForm.reset();

            resetTripGroups();

            loadTrips();

        } catch (error) {

            console.error(
                "Trip save error:",
                error
            );

            showFormMessage(
                error.message || "Unable to save trip.",
                true
            );

        }

        saveTripButton.disabled =
            false;

        saveTripButton.textContent =
            editingTripId
                ? "UPDATE TRIP"
                : "CREATE TRIP";

    }
);


/* =====================================================
   LOAD CUSTOMER REQUESTS
   ===================================================== */

async function loadRequests() {

    requestsContainer.innerHTML =
        `<div class="loading">
            Loading requests...
        </div>`;


    try {

        const snapshot =
            await db
            .collection("rideBookings")
            .orderBy(
                "createdAt",
                "desc"
            )
            .limit(100)
            .get();

        const requestDocs =
            snapshot.docs.filter(function(doc) {
                const data = doc.data();

                return (
                    data.requestType === "CUSTOM_REQUEST" &&
                    data.status === "REQUESTED"
                );
            }).slice(0, 50);


        pendingCount.textContent =
            requestDocs.length;


        if (requestDocs.length === 0) {

            requestsContainer.innerHTML =
                `<div class="empty">
                    No ride requests yet.
                </div>`;

            return;

        }


        requestsContainer.innerHTML =
            "";


        requestDocs.forEach(function(doc) {

            renderRequest(
                doc.id,
                doc.data()
            );

        });


    } catch (error) {

        console.error(
            "Request loading error:",
            error
        );


        requestsContainer.innerHTML =
            `<div class="empty">
                Unable to load ride requests.
            </div>`;

    }

}



/* =====================================================
   RENDER REQUEST
   ===================================================== */

function renderRequest(
    requestId,
    request
) {

    const card =
        document.createElement("div");

    card.className =
        "request-card";


    const createdDate =
        request.createdAt
            ? request.createdAt
                .toDate()
                .toLocaleString()
            : "Unknown";


    const status =
        request.status ||
        "PENDING_ADMIN_REVIEW";


    card.innerHTML = `

        <div class="request-top">

            <div>

                <div class="route">

                    ${escapeHTML(request.fromCity || request.from || "" )}
                    →
                    ${escapeHTML(request.toCity || request.to || "" )}

                </div>

                <div class="reference">

                    ${escapeHTML(
                        request.bookingReference ||
                        request.requestReference ||
                        requestId
                    )}

                </div>

            </div>


            <span class="status">

                ${escapeHTML(status)}

            </span>

        </div>


        <div class="request-details">

            <div class="detail">

                <small>
                    SUGGESTED TRAVEL DATE
                </small>

                <strong>
                    ${escapeHTML(
                        request.travelDate ||
                        "Not specified"
                    )}
                </strong>

            </div>


            <div class="detail">

                <small>
                    SUGGESTED TIME
                </small>

                <strong>
                    ${escapeHTML(
                        request.preferredTime ||
                        "Not specified"
                    )}
                </strong>

            </div>


            <div class="detail">

                <small>
                    PASSENGERS
                </small>

                <strong>
                    ${request.seats || request.passengers || 1}
                </strong>

            </div>


            <div class="detail">

                <small>
                    CUSTOMER
                </small>

                <strong>
                    ${escapeHTML(
                        request.customerEmail ||
                        request.passengerName ||
                        "-"
                    )}
                </strong>

            </div>


            <div class="detail">

                <small>
                    REQUESTED
                </small>

                <strong>
                    ${escapeHTML(createdDate)}
                </strong>

            </div>

        </div>


        ${
            request.note
            ?
            `<div class="detail">
                <small>NOTE</small>
                <strong>
                    ${escapeHTML(request.note)}
                </strong>
            </div>`
            :
            ""
        }


        <div class="action-row">

            <button
                class="action-button approve"
                onclick="prepareTripFromRequest(
                    '${requestId}'
                )"
            >
                ASSIGN TRIP
            </button>


            <button
                class="action-button cancel"
                onclick="rejectRequest(
                    '${requestId}'
                )"
            >
                REJECT
            </button>

        </div>

    `;


    requestsContainer.appendChild(
        card
    );

}



/* =====================================================
   PREPARE TRIP FROM REQUEST
   ===================================================== */

async function prepareTripFromRequest(
    requestId
) {

    try {

        const snapshot =
            await db
            .collection("rideBookings")
            .doc(requestId)
            .get();


        if (!snapshot.exists) {

            alert(
                "Ride request no longer exists."
            );

            return;

        }


        const request =
            snapshot.data();


        editingTripId = null;

        assigningRequestId =
            requestId;

        tripForm.reset();

        resetTripGroups();


        document.getElementById(
            "tripFrom"
        ).value =
            request.fromCity ||
            request.from ||
            "";


        document.getElementById(
            "tripTo"
        ).value =
            request.toCity ||
            request.to ||
            "";


        /*
         * Customer date/time are suggestions only.
         * The admin decides the actual trip schedule.
         *
         * Pre-fill the suggested date when available,
         * but the admin can change or replace it.
         */

        document.getElementById(
            "tripDate"
        ).value =
            request.travelDate || "";

        document.getElementById(
            "tripTime"
        ).value =
            request.preferredTime || "";


        saveTripButton.textContent =
            "CREATE TRIP";


        tripModal.classList.remove(
            "hidden"
        );


        /*
         After the admin creates the trip,
         the request remains stored.

         The next stage can link the
         customer's request to the trip
         and notify the customer.
        */


    } catch (error) {

        console.error(
            error
        );

        alert(
            "Unable to load request."
        );

    }

}



/* =====================================================
   REJECT REQUEST
   ===================================================== */

async function rejectRequest(
    requestId
) {

    const confirmed =
        confirm(
            "Reject this ride request?"
        );


    if (!confirmed) {

        return;

    }


    try {

        await db
            .collection("rideBookings")
            .doc(requestId)
            .update({

                status:
                    "REJECTED",

                reviewedBy:
                    currentAdmin.uid,

                reviewedAt:
                    firebase.firestore
                    .FieldValue
                    .serverTimestamp()

            });


        loadRequests();


    } catch (error) {

        console.error(
            "Reject request error:",
            error
        );

        alert(
            "Unable to reject request."
        );

    }

}



/* =====================================================
   LOAD TRIPS
   ===================================================== */

async function loadTrips() {

    tripsContainer.innerHTML =
        `<div class="loading">
            Loading trips...
        </div>`;


    try {

        const snapshot =
            await db
            .collection("trips")
            .orderBy(
                "date",
                "asc"
            )
            .limit(100)
            .get();


        tripCount.textContent =
            snapshot.size;


        let active = 0;

        let completed = 0;


        snapshot.forEach(function(doc) {

            const data =
                doc.data();


            if (
                data.status === "ACTIVE"
            ) {

                active++;

            }


            if (
                data.status === "COMPLETED"
            ) {

                completed++;

            }

        });


        activeCount.textContent =
            active;


        completedCount.textContent =
            completed;



        if (snapshot.empty) {

            tripsContainer.innerHTML =
                `<div class="empty">
                    No trips have been created.
                </div>`;

            return;

        }


        tripsContainer.innerHTML =
            "";


        snapshot.forEach(function(doc) {

            renderTrip(
                doc.id,
                doc.data()
            );

        });


    } catch (error) {

        console.error(
            "Trip loading error:",
            error
        );


        tripsContainer.innerHTML =
            `<div class="empty">
                Unable to load trips.
            </div>`;

    }

}



/* =====================================================
   RENDER TRIP
   ===================================================== */

function renderTrip(
    tripId,
    trip
) {

    const card =
        document.createElement("div");

    card.className =
        "trip-card";


    const status =
        trip.status ||
        "AVAILABLE";


    let statusClass =
        "";


    if (status === "AVAILABLE") {

        statusClass =
            "available";

    }


    if (status === "ACTIVE") {

        statusClass =
            "active";

    }


    card.innerHTML = `

        <div class="trip-top">

            <div>

                <div class="route">

                    ${escapeHTML(trip.from)}
                    →
                    ${escapeHTML(trip.to)}

                </div>

                <div class="reference">

                    ${escapeHTML(
                        trip.date || "-"
                    )}

                </div>

            </div>


            <span
                class="status ${statusClass}"
            >

                ${escapeHTML(status)}

            </span>

        </div>


        <div class="trip-details">

            <div class="detail trip-groups-detail">

                <small>
                    TRIP GROUPS / GATHERING POINTS
                </small>

                <div class="admin-trip-groups">

                    ${
                        Array.isArray(trip.groups) &&
                        trip.groups.length > 0
                            ?
                            trip.groups.map(
                                function(group, index) {

                                    const capacity =
                                        Number(
                                            group.capacity || 0
                                        );

                                    const availableSeats =
                                        Number(
                                            group.availableSeats ??
                                            capacity
                                        );

                                    return `
                                        <div class="admin-trip-group">

                                            <strong>
                                                Trip Group ${index + 1}
                                            </strong>

                                            <span>
                                                Gathering:
                                                ${escapeHTML(
                                                    group.gatheringPoint ||
                                                    group.meetingPoint ||
                                                    "-"
                                                )}
                                            </span>

                                            <span>
                                                Vehicle:
                                                ${escapeHTML(
                                                    group.vehicle ||
                                                    "-"
                                                )}
                                            </span>

                                            <span>
                                                Driver:
                                                ${escapeHTML(
                                                    group.driverName ||
                                                    "-"
                                                )}
                                            </span>

                                            <span>
                                                Seats:
                                                ${availableSeats}
                                                available /
                                                ${capacity}
                                                total
                                            </span>

                                            <span>
                                                Group ID:
                                                ${escapeHTML(
                                                    String(
                                                        group.groupId ||
                                                        "-"
                                                    )
                                                )}
                                            </span>

                                        </div>
                                    `;
                                }
                            ).join("")
                            :
                            `
                                <div class="admin-trip-group">

                                    <span>
                                        Gathering:
                                        ${escapeHTML(
                                            trip.meetingPoint ||
                                            trip.gatheringPoint ||
                                            "-"
                                        )}
                                    </span>

                                    <span>
                                        Vehicle:
                                        ${escapeHTML(
                                            trip.vehicle ||
                                            "-"
                                        )}
                                    </span>

                                    <span>
                                        Driver:
                                        ${escapeHTML(
                                            trip.driverName ||
                                            "-"
                                        )}
                                    </span>

                                    <span>
                                        Seats:
                                        ${Number(
                                            trip.availableSeats ??
                                            trip.capacity ??
                                            0
                                        )}
                                        available /
                                        ${Number(
                                            trip.capacity ||
                                            0
                                        )}
                                        total
                                    </span>

                                </div>
                            `
                    }

                </div>

            </div>


            <div class="detail">

                <small>
                    DEPARTURE
                </small>

                <strong>
                    ${escapeHTML(
                        trip.departureTime ||
                        "-"
                    )}
                </strong>

            </div>


            <div class="detail">

                <small>
                    FINAL DESTINATION
                </small>

                <strong>
                    ${escapeHTML(
                        trip.finalDestination ||
                        "-"
                    )}
                </strong>

            </div>


            <div class="detail">

                <small>
                    CUSTOMER FARE
                </small>

                <strong>
                    ₦${Number(
                        trip.price || 0
                    ).toLocaleString()}
                </strong>

            </div>

        </div>


        <div class="action-row">

            <button
                class="action-button edit"
                onclick="editTrip(
                    '${tripId}'
                )"
            >
                EDIT
            </button>


            ${
                status === "AVAILABLE"
                ?
                `<button
                    class="action-button approve"
                    onclick="changeTripStatus(
                        '${tripId}',
                        'ACTIVE'
                    )"
                >
                    START TRIP
                </button>`
                :
                ""
            }


            ${
                status === "ACTIVE"
                ?
                `<button
                    class="action-button approve"
                    onclick="changeTripStatus(
                        '${tripId}',
                        'COMPLETED'
                    )"
                >
                    COMPLETE
                </button>`
                :
                ""
            }


            ${
                status !== "COMPLETED" &&
                status !== "CANCELLED"
                ?
                `<button
                    class="action-button cancel"
                    onclick="changeTripStatus(
                        '${tripId}',
                        'CANCELLED'
                    )"
                >
                    CANCEL
                </button>`
                :
                ""
            }

        </div>

    `;


    tripsContainer.appendChild(
        card
    );

}



/* =====================================================
   EDIT TRIP
   ===================================================== */

async function editTrip(
    tripId
) {

    try {

        const snapshot =
            await db
            .collection("trips")
            .doc(tripId)
            .get();

        if (!snapshot.exists) {

            alert(
                "Trip no longer exists."
            );

            return;
        }

        const trip =
            snapshot.data();

        editingTripId =
            tripId;

        document.getElementById(
            "tripFrom"
        ).value =
            trip.from ||
            trip.fromCity ||
            "";

        document.getElementById(
            "tripTo"
        ).value =
            trip.to ||
            trip.toCity ||
            "";

        document.getElementById(
            "tripDate"
        ).value =
            trip.date ||
            trip.travelDate ||
            "";

        document.getElementById(
            "tripTime"
        ).value =
            trip.departureTime ||
            "";

        document.getElementById(
            "finalDestination"
        ).value =
            trip.finalDestination ||
            "";

        document.getElementById(
            "tripPrice"
        ).value =
            trip.price ??
            trip.fare ??
            "";

        document.getElementById(
            "tripStatus"
        ).value =
            trip.status ||
            "AVAILABLE";

        let groups =
            Array.isArray(trip.groups)
                ? trip.groups
                : [];

        /*
            LEGACY TRIP COMPATIBILITY

            Older trips may not have a groups
            array. Convert their existing single
            vehicle details into one group so the
            Admin can edit them using the new
            structure.
        */

        if (groups.length === 0) {

            const capacity =
                Number(
                    trip.capacity ||
                    trip.availableSeats ||
                    14
                );

            const availableSeats =
                Number(
                    trip.availableSeats ??
                    capacity
                );

            const bookedCount =
                Math.max(
                    0,
                    capacity -
                    availableSeats
                );

            const bookedSeatNumbers = [];

            for (
                let seat = 1;
                seat <= bookedCount;
                seat++
            ) {

                bookedSeatNumbers.push(
                    seat
                );
            }

            groups = [
                {
                    groupId:
                        trip.groupId ||
                        createTripGroupId(),

                    gatheringPoint:
                        trip.gatheringPoint ||
                        trip.meetingPoint ||
                        "",

                    vehicle:
                        trip.vehicle ||
                        "",

                    driverName:
                        trip.driverName ||
                        "",

                    capacity,

                    availableSeats,

                    bookedSeatNumbers
                }
            ];

        }

        renderTripGroups(
            groups
        );

        saveTripButton.textContent =
            "UPDATE TRIP";

        tripModal.classList.remove(
            "hidden"
        );

    } catch (error) {

        console.error(
            error
        );

        alert(
            "Unable to edit trip."
        );

    }

}


/* =====================================================
   CHANGE TRIP STATUS
   ===================================================== */

async function changeTripStatus(
    tripId,
    status
) {

    try {

        await db
            .collection("trips")
            .doc(tripId)
            .update({

                status,

                updatedAt:
                    firebase.firestore
                    .FieldValue
                    .serverTimestamp()

            });


        loadTrips();


    } catch (error) {

        console.error(
            "Status update error:",
            error
        );

        alert(
            "Unable to update trip status."
        );

    }

}



/* =====================================================
   FORM MESSAGE
   ===================================================== */

function showFormMessage(
    message,
    error = false
) {

    tripFormMessage.textContent =
        message;


    tripFormMessage.style.color =
        error
            ? "#E31B23"
            : "#187333";

}



/* =====================================================
   LOGOUT
   ===================================================== */

logoutButton.addEventListener(
    "click",
    async function() {

        await auth.signOut();

        window.location.href =
            "login.html";

    }
);



/* =====================================================
   SECURITY HELPER
   ===================================================== */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
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