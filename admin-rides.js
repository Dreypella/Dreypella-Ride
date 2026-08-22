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

const logoutButton =
    document.getElementById("logoutButton");



/* =====================================================
   CURRENT ADMIN
   ===================================================== */

let currentAdmin = null;

let editingTripId = null;



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

        tripForm.reset();

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

        const meetingPoint =
            document.getElementById(
                "meetingPoint"
            ).value.trim();

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

        const vehicle =
            document.getElementById(
                "vehicle"
            ).value.trim();

        const driverName =
            document.getElementById(
                "driverName"
            ).value.trim();

        const capacity =
            Number(
                document.getElementById(
                    "capacity"
                ).value
            );

        const status =
            document.getElementById(
                "tripStatus"
            ).value;



        /* VALIDATION */

        if (from === to) {

            showFormMessage(
                "Departure and destination cannot be the same.",
                true
            );

            return;

        }


        if (price < 0) {

            showFormMessage(
                "Price cannot be negative.",
                true
            );

            return;

        }


        saveTripButton.disabled = true;

        saveTripButton.textContent =
            "SAVING...";



        try {

            const tripData = {

                from,

                to,

                date,

                departureTime,

                meetingPoint,

                finalDestination,

                price,

                vehicle,

                driverName,

                capacity,

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


                await db
                    .collection("trips")
                    .add(tripData);

            }



            tripModal.classList.add(
                "hidden"
            );


            tripForm.reset();


            loadTrips();


        } catch (error) {

            console.error(
                "Trip save error:",
                error
            );


            showFormMessage(
                "Unable to save trip.",
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
            .collection("rideRequests")
            .orderBy(
                "createdAt",
                "desc"
            )
            .limit(50)
            .get();


        pendingCount.textContent =
            snapshot.size;


        if (snapshot.empty) {

            requestsContainer.innerHTML =
                `<div class="empty">
                    No ride requests yet.
                </div>`;

            return;

        }


        requestsContainer.innerHTML =
            "";


        snapshot.forEach(function(doc) {

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

                    ${escapeHTML(request.from)}
                    →
                    ${escapeHTML(request.to)}

                </div>

                <div class="reference">

                    ${escapeHTML(
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
                    TRAVEL DATE
                </small>

                <strong>
                    ${escapeHTML(
                        request.travelDate ||
                        "-"
                    )}
                </strong>

            </div>


            <div class="detail">

                <small>
                    PASSENGERS
                </small>

                <strong>
                    ${request.passengers || 1}
                </strong>

            </div>


            <div class="detail">

                <small>
                    CUSTOMER
                </small>

                <strong>
                    ${escapeHTML(
                        request.customerEmail ||
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
            .collection("rideRequests")
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

        tripForm.reset();


        document.getElementById(
            "tripFrom"
        ).value =
            request.from || "";


        document.getElementById(
            "tripTo"
        ).value =
            request.to || "";


        document.getElementById(
            "tripDate"
        ).value =
            request.travelDate || "";


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
            .collection("rideRequests")
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

            <div class="detail">

                <small>
                    MEETING POINT
                </small>

                <strong>
                    ${escapeHTML(
                        trip.meetingPoint ||
                        "-"
                    )}
                </strong>

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
            trip.from || "";


        document.getElementById(
            "tripTo"
        ).value =
            trip.to || "";


        document.getElementById(
            "tripDate"
        ).value =
            trip.date || "";


        document.getElementById(
            "tripTime"
        ).value =
            trip.departureTime || "";


        document.getElementById(
            "meetingPoint"
        ).value =
            trip.meetingPoint || "";


        document.getElementById(
            "finalDestination"
        ).value =
            trip.finalDestination || "";


        document.getElementById(
            "tripPrice"
        ).value =
            trip.price || "";


        document.getElementById(
            "vehicle"
        ).value =
            trip.vehicle || "";


        document.getElementById(
            "driverName"
        ).value =
            trip.driverName || "";


        document.getElementById(
            "capacity"
        ).value =
            trip.capacity || 14;


        document.getElementById(
            "tripStatus"
        ).value =
            trip.status || "AVAILABLE";


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