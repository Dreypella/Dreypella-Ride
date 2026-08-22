/* =========================================
   DREYPELLA RIDE BOOKING SYSTEM
   ========================================= */


/* FIREBASE */

const auth = firebase.auth();

const db = firebase.firestore();


/* =========================================
   ELEMENTS
   ========================================= */

const fromLocation =
    document.getElementById("fromLocation");

const toLocation =
    document.getElementById("toLocation");

const travelDate =
    document.getElementById("travelDate");

const preferredTime =
    document.getElementById("preferredTime");

const findTripsButton =
    document.getElementById("findTripsButton");

const journeyMessage =
    document.getElementById("journeyMessage");

const tripResults =
    document.getElementById("tripResults");

const tripList =
    document.getElementById("tripList");

const requestRideButton =
    document.getElementById("requestRideButton");

const bookingSection =
    document.getElementById("bookingSection");

const selectedTrip =
    document.getElementById("selectedTrip");

const bookingForm =
    document.getElementById("bookingForm");

const passengerName =
    document.getElementById("passengerName");

const passengerPhone =
    document.getElementById("passengerPhone");

const seatCount =
    document.getElementById("seatCount");

const totalFare =
    document.getElementById("totalFare");

const bookingMessage =
    document.getElementById("bookingMessage");


let availableTrips = [];

let selectedTripData = null;


/* =========================================
   SUPPORTED LOCATIONS
   ========================================= */

const supportedLocations = [

    "Ogbomosho",
    "Iseyin",
    "Oyo",
    "Ibadan",
    "Lagos",
    "Ilorin"

];


/* =========================================
   SET MINIMUM DATE
   ========================================= */

function setMinimumDate() {

    const today =
        new Date();


    const year =
        today.getFullYear();


    const month =
        String(
            today.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            today.getDate()
        ).padStart(
            2,
            "0"
        );


    const dateString =
        `${year}-${month}-${day}`;


    travelDate.min =
        dateString;


    if (!travelDate.value) {

        travelDate.value =
            dateString;

    }

}


setMinimumDate();


/* =========================================
   FIND AVAILABLE TRIPS
   ========================================= */

findTripsButton.addEventListener(
    "click",
    findTrips
);


async function findTrips() {

    clearMessage(
        journeyMessage
    );


    const from =
        fromLocation.value.trim();


    const to =
        toLocation.value.trim();


    const date =
        travelDate.value;


    const time =
        preferredTime.value;


    /* VALIDATE LOCATION */

    if (
        !supportedLocations.includes(from) ||
        !supportedLocations.includes(to)
    ) {

        showMessage(
            journeyMessage,
            "Please select a valid location.",
            "error"
        );

        return;

    }


    /* SAME LOCATION */

    if (from === to) {

        showMessage(
            journeyMessage,
            "Departure and destination cannot be the same.",
            "error"
        );

        return;

    }


    /* DATE */

    if (!date) {

        showMessage(
            journeyMessage,
            "Please select your travel date.",
            "error"
        );

        return;

    }


    /* TIME */

    if (!time) {

        showMessage(
            journeyMessage,
            "Please select your preferred departure time.",
            "error"
        );

        return;

    }


    /* PREVENT PAST DATE */

    const selectedDate =
        new Date(
            date + "T00:00:00"
        );


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    if (
        selectedDate < today
    ) {

        showMessage(
            journeyMessage,
            "Please select today or a future date.",
            "error"
        );

        return;

    }


    findTripsButton.disabled =
        true;


    findTripsButton.textContent =
        "CHECKING...";


    try {

        /*
         * Look for trips published
         * by the administrator.
         *
         * IMPORTANT:
         *
         * If none exists, this is NOT
         * treated as an error.
         *
         * The customer can still
         * request the journey.
         */


        const snapshot =
            await db
                .collection("trips")
                .where(
                    "fromCity",
                    "==",
                    from
                )
                .where(
                    "toCity",
                    "==",
                    to
                )
                .where(
                    "status",
                    "==",
                    "AVAILABLE"
                )
                .get();


        availableTrips = [];


        snapshot.forEach(
            function(doc) {

                const trip =
                    doc.data();


                /*
                 * Only display trips
                 * matching customer's date.
                 */


                let tripDate = "";


                if (
                    trip.departureTime &&
                    trip.departureTime.toDate
                ) {

                    tripDate =
                        formatDateForInput(
                            trip.departureTime.toDate()
                        );

                }
                else if (
                    trip.travelDate
                ) {

                    tripDate =
                        trip.travelDate;

                }


                if (
                    !tripDate ||
                    tripDate === date
                ) {

                    availableTrips.push({

                        id: doc.id,

                        ...trip

                    });

                }

            }
        );


        displayTrips();


    }
    catch(error) {

        console.error(
            "Trip search error:",
            error
        );


        /*
         * Even if the trip collection
         * cannot be queried, allow the
         * customer to make a request.
         */


        availableTrips = [];


        displayTrips();


        showMessage(
            journeyMessage,
            "No scheduled trip found. You can still request this journey.",
            "success"
        );

    }
    finally {

        findTripsButton.disabled =
            false;

        findTripsButton.textContent =
            "CHECK AVAILABILITY";

    }

}


/* =========================================
   DISPLAY TRIPS
   ========================================= */

function displayTrips() {

    tripList.innerHTML = "";


    tripResults.classList.remove(
        "hidden"
    );


    if (
        availableTrips.length === 0
    ) {

        tripList.innerHTML = `

            <div class="journey-card">

                <div class="empty-state">

                    <h3>
                        No scheduled trip yet
                    </h3>

                    <p>
                        You can still request this journey.
                        Dreypella Ride will confirm the
                        trip details with you.
                    </p>

                </div>

            </div>

        `;


        requestRideButton.classList.remove(
            "hidden"
        );


        showRequestForm();

        return;

    }


    availableTrips.forEach(
        function(trip) {

            const card =
                createTripCard(
                    trip
                );


            tripList.appendChild(
                card
            );

        }
    );


    requestRideButton.classList.remove(
        "hidden"
    );

}


/* =========================================
   CREATE TRIP CARD
   ========================================= */

function createTripCard(trip) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "trip-card";


    const fare =
        Number(
            trip.fare || 0
        );


    const seats =
        Number(
            trip.availableSeats || 0
        );


    card.innerHTML = `

        <div class="trip-top">

            <div class="trip-route">

                ${escapeHTML(
                    trip.fromCity
                )}

                <span>→</span>

                ${escapeHTML(
                    trip.toCity
                )}

            </div>


            <div class="trip-price">

                ₦${formatMoney(fare)}

            </div>

        </div>


        <div class="trip-details">


            <div class="trip-detail">

                <small>
                    Gathering Point
                </small>

                <strong>
                    ${escapeHTML(
                        trip.gatheringPoint ||
                        "To be confirmed"
                    )}
                </strong>

            </div>


            <div class="trip-detail">

                <small>
                    Final Destination
                </small>

                <strong>
                    ${escapeHTML(
                        trip.finalDestination ||
                        trip.toCity
                    )}
                </strong>

            </div>


            <div class="trip-detail">

                <small>
                    Departure
                </small>

                <strong>
                    ${formatDateTime(
                        trip.departureTime,
                        trip.travelDate,
                        trip.departureTimeText
                    )}
                </strong>

            </div>


            <div class="trip-detail">

                <small>
                    Available Seats
                </small>

                <strong>
                    ${seats}
                </strong>

            </div>


        </div>


        <button
            type="button"
            class="select-trip">

            SELECT THIS TRIP

        </button>

    `;


    const button =
        card.querySelector(
            ".select-trip"
        );


    button.addEventListener(
        "click",
        function(event) {

            event.stopPropagation();

            selectTrip(
                trip
            );

        }
    );


    return card;

}


/* =========================================
   SELECT ADMIN TRIP
   ========================================= */

function selectTrip(trip) {

    selectedTripData =
        trip;


    const fare =
        Number(
            trip.fare || 0
        );


    selectedTrip.innerHTML = `

        <h3>

            ${escapeHTML(
                trip.fromCity
            )}

            →

            ${escapeHTML(
                trip.toCity
            )}

        </h3>


        <div class="selected-row">

            <span>
                Gathering Point
            </span>

            <strong>
                ${escapeHTML(
                    trip.gatheringPoint ||
                    "To be confirmed"
                )}
            </strong>

        </div>


        <div class="selected-row">

            <span>
                Final Destination
            </span>

            <strong>
                ${escapeHTML(
                    trip.finalDestination ||
                    trip.toCity
                )}
            </strong>

        </div>


        <div class="selected-row">

            <span>
                Departure
            </span>

            <strong>
                ${formatDateTime(
                    trip.departureTime,
                    trip.travelDate,
                    trip.departureTimeText
                )}
            </strong>

        </div>


        <div class="selected-row">

            <span>
                Fare
            </span>

            <strong>
                ₦${formatMoney(fare)}
            </strong>

        </div>

    `;


    totalFare.textContent =
        "₦" +
        formatMoney(fare);


    bookingSection.classList.remove(
        "hidden"
    );


    bookingSection.scrollIntoView({
        behavior: "smooth"
    });

}


/* =========================================
   REQUEST JOURNEY WITHOUT TRIP
   ========================================= */

requestRideButton.addEventListener(
    "click",
    function() {

        selectedTripData =
            null;


        selectedTrip.innerHTML = `

            <h3>
                Journey Request
            </h3>


            <div class="selected-row">

                <span>
                    From
                </span>

                <strong>
                    ${escapeHTML(
                        fromLocation.value
                    )}
                </strong>

            </div>


            <div class="selected-row">

                <span>
                    To
                </span>

                <strong>
                    ${escapeHTML(
                        toLocation.value
                    )}
                </strong>

            </div>


            <div class="selected-row">

                <span>
                    Travel Date
                </span>

                <strong>
                    ${formatReadableDate(
                        travelDate.value
                    )}
                </strong>

            </div>


            <div class="selected-row">

                <span>
                    Preferred Time
                </span>

                <strong>
                    ${formatTime(
                        preferredTime.value
                    )}
                </strong>

            </div>

        `;


        totalFare.textContent =
            "To be confirmed";


        bookingSection.classList.remove(
            "hidden"
        );


        bookingSection.scrollIntoView({
            behavior: "smooth"
        });

    }
);


/* =========================================
   SHOW REQUEST FORM
   ========================================= */

function showRequestForm() {

    selectedTripData =
        null;


    selectedTrip.innerHTML = `

        <h3>
            Journey Request
        </h3>


        <div class="selected-row">

            <span>
                From
            </span>

            <strong>
                ${escapeHTML(
                    fromLocation.value
                )}
            </strong>

        </div>


        <div class="selected-row">

            <span>
                To
            </span>

            <strong>
                ${escapeHTML(
                    toLocation.value
                )}
            </strong>

        </div>


        <div class="selected-row">

            <span>
                Travel Date
            </span>

            <strong>
                ${formatReadableDate(
                    travelDate.value
                )}
            </strong>

        </div>


        <div class="selected-row">

            <span>
                Preferred Time
            </span>

            <strong>
                ${formatTime(
                    preferredTime.value
                )}
            </strong>

        </div>

    `;


    totalFare.textContent =
        "To be confirmed";


    bookingSection.classList.remove(
        "hidden"
    );

}


/* =========================================
   SEAT COUNT
   ========================================= */

seatCount.addEventListener(
    "change",
    updateTotalFare
);


function updateTotalFare() {

    if (
        !selectedTripData
    ) {

        totalFare.textContent =
            "To be confirmed";

        return;

    }


    const fare =
        Number(
            selectedTripData.fare || 0
        );


    const seats =
        Number(
            seatCount.value || 1
        );


    totalFare.textContent =
        "₦" +
        formatMoney(
            fare * seats
        );

}


/* =========================================
   SUBMIT BOOKING
   ========================================= */

bookingForm.addEventListener(
    "submit",
    submitBooking
);


async function submitBooking(event) {

    event.preventDefault();


    clearMessage(
        bookingMessage
    );


    const user =
        auth.currentUser;


    if (!user) {

        showMessage(
            bookingMessage,
            "Please login before booking a ride.",
            "error"
        );


        setTimeout(
            function() {

                window.location.href =
                    "login.html";

            },
            1200
        );


        return;

    }


    const name =
        passengerName.value.trim();


    const phone =
        passengerPhone.value.trim();


    const seats =
        Number(
            seatCount.value
        );


    const from =
        fromLocation.value;


    const to =
        toLocation.value;


    const date =
        travelDate.value;


    const time =
        preferredTime.value;


    if (
        !name ||
        !phone
    ) {

        showMessage(
            bookingMessage,
            "Please enter your passenger details.",
            "error"
        );

        return;

    }


    if (
        !from ||
        !to ||
        !date ||
        !time
    ) {

        showMessage(
            bookingMessage,
            "Please complete your journey details.",
            "error"
        );

        return;

    }


    if (
        from === to
    ) {

        showMessage(
            bookingMessage,
            "Departure and destination cannot be the same.",
            "error"
        );

        return;

    }


    /*
     * If an admin trip was selected,
     * check available seats.
     */


    if (
        selectedTripData
    ) {

        const availableSeats =
            Number(
                selectedTripData.availableSeats ||
                0
            );


        if (
            seats > availableSeats
        ) {

            showMessage(
                bookingMessage,
                "There are not enough seats available.",
                "error"
            );

            return;

        }

    }


    const submitButton =
        bookingForm.querySelector(
            "button[type='submit']"
        );


    submitButton.disabled =
        true;


    submitButton.textContent =
        "SUBMITTING...";


    try {

        const bookingReference =
            generateBookingReference();


        let totalFare =
            null;


        let bookingStatus =
            "REQUESTED";


        let tripId =
            null;


        let gatheringPoint =
            "";


        let finalDestination =
            "";


        let confirmedDeparture =
            null;


        /*
         * ADMIN TRIP EXISTS
         */


        if (
            selectedTripData
        ) {

            const fare =
                Number(
                    selectedTripData.fare ||
                    0
                );


            totalFare =
                fare * seats;


            bookingStatus =
                "PENDING_PAYMENT";


            tripId =
                selectedTripData.id;


            gatheringPoint =
                selectedTripData.gatheringPoint ||
                "";


            finalDestination =
                selectedTripData.finalDestination ||
                to;


            confirmedDeparture =
                selectedTripData.departureTime ||
                null;

        }


        /*
         * CREATE BOOKING
         */


        await db
            .collection("rideBookings")
            .add({

                bookingReference:

                    bookingReference,


                userId:

                    user.uid,


                passengerName:

                    name,


                passengerPhone:

                    phone,


                fromCity:

                    from,


                toCity:

                    to,


                travelDate:

                    date,


                preferredTime:

                    time,


                tripId:

                    tripId,


                gatheringPoint:

                    gatheringPoint,


                finalDestination:

                    finalDestination,


                confirmedDeparture:

                    confirmedDeparture,


                seats:

                    seats,


                totalFare:

                    totalFare,


                status:

                    bookingStatus,


                paymentStatus:

                    totalFare !== null
                        ? "UNPAID"
                        : "WAITING_CONFIRMATION",


                requestType:

                    selectedTripData
                        ? "SCHEDULED_TRIP"
                        : "CUSTOM_REQUEST",


                createdAt:

                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            });


        /*
         * SUCCESS MESSAGE
         */


        if (
            selectedTripData
        ) {

            showMessage(
                bookingMessage,
                "Ride booking created. Continue to payment.",
                "success"
            );

        }
        else {

            showMessage(
                bookingMessage,
                "Ride request sent. Dreypella Ride will confirm the trip details.",
                "success"
            );

        }


        /*
         * Redirect later to booking page.
         *
         * For now we send the customer
         * to their dashboard.
         */


        setTimeout(
            function() {

                window.location.href =
                    "customer-dashboard.html";

            },
            1800
        );


    }
    catch(error) {

        console.error(
            "Booking error:",
            error
        );


        showMessage(
            bookingMessage,
            "Unable to submit your request. Please try again.",
            "error"
        );

    }
    finally {

        submitButton.disabled =
            false;


        submitButton.textContent =
            "SUBMIT RIDE REQUEST";

    }

}


/* =========================================
   BOOKING REFERENCE
   ========================================= */

function generateBookingReference() {

    const random =
        Math.random()
            .toString(36)
            .substring(
                2,
                8
            )
            .toUpperCase();


    return (
        "DR-" +
        Date.now()
            .toString()
            .slice(-6) +
        "-" +
        random
    );

}


/* =========================================
   MONEY
   ========================================= */

function formatMoney(amount) {

    return Number(
        amount
    ).toLocaleString(
        "en-NG",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    );

}


/* =========================================
   DATE
   ========================================= */

function formatDateForInput(date) {

    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        year +
        "-" +
        month +
        "-" +
        day
    );

}


/* =========================================
   READABLE DATE
   ========================================= */

function formatReadableDate(value) {

    if (!value) {

        return "Not selected";

    }


    const date =
        new Date(
            value + "T00:00:00"
        );


    return date.toLocaleDateString(
        "en-NG",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================
   TIME
   ========================================= */

function formatTime(value) {

    if (!value) {

        return "Not selected";

    }


    const parts =
        value.split(":");


    let hour =
        Number(parts[0]);


    const minute =
        parts[1];


    const period =
        hour >= 12
            ? "PM"
            : "AM";


    hour =
        hour % 12 || 12;


    return (
        hour +
        ":" +
        minute +
        " " +
        period
    );

}


/* =========================================
   DATETIME
   ========================================= */

function formatDateTime(
    timestamp,
    travelDate,
    departureTimeText
) {

    if (
        timestamp &&
        timestamp.toDate
    ) {

        return timestamp
            .toDate()
            .toLocaleString(
                "en-NG",
                {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit"
                }
            );

    }


    if (
        travelDate
    ) {

        return (
            formatReadableDate(
                travelDate
            ) +
            (
                departureTimeText
                    ? " • " +
                      departureTimeText
                    : ""
            )
        );

    }


    return "To be confirmed";

}


/* =========================================
   MESSAGE
   ========================================= */

function showMessage(
    element,
    message,
    type
) {

    element.textContent =
        message;

    element.className =
        "message " +
        type;

}


function clearMessage(element) {

    element.textContent =
        "";

    element.className =
        "message";

}


/* =========================================
   HTML SECURITY
   ========================================= */

function escapeHTML(value) {

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