/*
    DREYPELLA RIDE
    DELIVERY SYSTEM

    Uses OpenStreetMap Nominatim for location search
    and OSRM for route/distance calculation.

    No Google Maps API key is required.
*/


const pickupInput =
    document.getElementById("pickup");

const pickupSuggestions =
    document.getElementById("pickupSuggestions");

const destinationsContainer =
    document.getElementById("destinationsContainer");

const addDestinationBtn =
    document.getElementById("addDestinationBtn");

const currentLocationBtn =
    document.getElementById("currentLocationBtn");

const calculateBtn =
    document.getElementById("calculateBtn");

const deliveryForm =
    document.getElementById("deliveryForm");

const deliveryResult =
    document.getElementById("deliveryResult");

const deliveryMessage =
    document.getElementById("deliveryMessage");


let pickupLocation = null;
let destinationLocations = [];


/*
    LOCATION SEARCH
*/

async function searchLocation(query) {
    return window.DreypellaLocation.searchLocation(query);
}
/*
    DISPLAY SUGGESTIONS
*/

function displaySuggestions(
    results,
    container,
    type
) {

    container.innerHTML = "";

    if (!results.length) {

        container.innerHTML = `
            <div class="suggestion">
                No exact result found. Try a nearby street, landmark or business.
            </div>
        `;

        return;
    }


    results.forEach(result => {

        const item =
            document.createElement("div");

        item.className = "suggestion";

        item.textContent =
            result.display_name;


        item.addEventListener(
            "click",
            () => {

                const location = {

                    lat:
                        parseFloat(result.lat),

                    lon:
                        parseFloat(result.lon),

                    name:
                        result.display_name,

                    address:
                        result.address || {},

                    state:
                        result.address?.state || "",

                    country:
                        result.address?.country || "",

                    countryCode:
                        result.address?.country_code || "",

                    city:
                        result.address?.city ||
                        result.address?.town ||
                        result.address?.municipality ||
                        result.address?.village ||
                        ""
                };


                if (type !== "pickup") {
                    return;
                }

                pickupLocation =
                    location;

                pickupInput.value =
                    result.display_name;

                pickupSuggestions.innerHTML =
                    "";

            }
        );


        container.appendChild(item);

    });
}


/*
    PICKUP SEARCH
*/

let pickupTimer;


pickupInput.addEventListener(
    "input",
    () => {

        pickupLocation = null;

        clearTimeout(pickupTimer);

        pickupTimer =
            setTimeout(
                async () => {

                    const results =
                        await searchLocation(
                            pickupInput.value
                        );

                    displaySuggestions(
                        results,
                        pickupSuggestions,
                        "pickup"
                    );

                },
                600
            );
    }
);


/*
    PICKUP CURRENT LOCATION
*/

if (currentLocationBtn) {

    currentLocationBtn.addEventListener(
        "click",
        async () => {

            currentLocationBtn.textContent = "⌛";

            try {

                const location =
                    await window.DreypellaLocation
                        .getCurrentLocation();

                pickupLocation = location;

                pickupInput.value =
                    location.name ||
                    location.address?.road ||
                    location.address?.city ||
                    "";

                pickupSuggestions.innerHTML = "";

            } catch (error) {

                console.error(
                    "Pickup current location error:",
                    error
                );

                if (
                    error &&
                    error.code === 1
                ) {

                    showMessage(
                        "Unable to access your location. Please allow location permission."
                    );

                } else {

                    showMessage(
                        "We could not identify your current location. Please try again or enter the address manually."
                    );
                }

            } finally {

                currentLocationBtn.textContent = "📍";
            }
        }
    );
}


/*
    DESTINATION SEARCH
*/

let destinationTimers = {};

function getDestinationCards() {
    return Array.from(
        document.querySelectorAll(".destination-card")
    );
}

function getDestinationIndex(card) {
    return Number(
        card.dataset.destinationIndex
    );
}

function buildLocationObject(result) {
    return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        name: result.display_name,
        address: result.address || {},
        state: result.address?.state || "",
        country: result.address?.country || "",
        countryCode: result.address?.country_code || "",
        city:
            result.address?.city ||
            result.address?.town ||
            result.address?.municipality ||
            result.address?.village ||
            ""
    };
}

function setupDestinationCard(card) {

    const index =
        getDestinationIndex(card);

    const input =
        card.querySelector(".destination-input");

    const suggestions =
        card.querySelector(".destination-suggestions");

    const locationButton =
        card.querySelector(".destination-location-btn");

    if (!input || !suggestions) {
        return;
    }

    input.addEventListener(
        "input",
        () => {

            destinationLocations[index] = null;

            clearTimeout(
                destinationTimers[index]
            );

            destinationTimers[index] =
                setTimeout(
                    async () => {

                        const query =
                            input.value.trim();

                        if (!query) {
                            suggestions.innerHTML = "";
                            return;
                        }

                        const results =
                            await searchLocation(query);

                        displayDestinationSuggestions(
                            results,
                            card,
                            index
                        );

                    },
                    600
                );
        }
    );

    if (locationButton) {

        locationButton.addEventListener(
            "click",
            async () => {

                locationButton.textContent = "⌛";

                try {

                    const location =
                        await window.DreypellaLocation
                            .getCurrentLocation();

                    destinationLocations[index] =
                        location;

                    input.value =
                        location.name;

                    suggestions.innerHTML = "";

                } catch (error) {

                    console.error(
                        "Destination current location error:",
                        error
                    );

                    if (
                        error &&
                        error.code === 1
                    ) {

                        showMessage(
                            "Unable to access your location. Please allow location permission."
                        );

                    } else {

                        showMessage(
                            "We could not identify your current location. Please try again or enter the address manually."
                        );
                    }

                } finally {

                    locationButton.textContent = "📍";
                }
            }
        );
    }
}

function displayDestinationSuggestions(
    results,
    card,
    index
) {

    const input =
        card.querySelector(".destination-input");

    const suggestions =
        card.querySelector(".destination-suggestions");

    if (!suggestions) {
        return;
    }

    suggestions.innerHTML = "";

    if (!results.length) {

        suggestions.innerHTML = `
            <div class="suggestion">
                No exact result found. Try a nearby street, landmark or business.
            </div>
        `;

        return;
    }

    results.forEach(result => {

        const item =
            document.createElement("div");

        item.className = "suggestion";

        item.textContent =
            result.display_name;

        item.addEventListener(
            "click",
            () => {

                destinationLocations[index] =
                    buildLocationObject(result);

                input.value =
                    result.display_name;

                suggestions.innerHTML =
                    "";
            }
        );

        suggestions.appendChild(item);
    });
}

getDestinationCards().forEach(
    setupDestinationCard
);


/*
    ADD DESTINATION
*/

function addDestinationCard() {

    const cards =
        getDestinationCards();

    if (!cards.length) {
        return null;
    }

    const lastCard =
        cards[cards.length - 1];

    const newIndex =
        cards.length;

    const newCard =
        lastCard.cloneNode(true);

    newCard.dataset.destinationIndex =
        String(newIndex);

    const header =
        newCard.querySelector(
            ".destination-card-header strong"
        );

    if (header) {
        header.textContent =
            `Destination ${newIndex + 1}`;
    }

    const fields = [
        [
            ".destination-input",
            `destination-${newIndex}`
        ],
        [
            ".recipient-name",
            `recipientName-${newIndex}`
        ],
        [
            ".recipient-phone",
            `recipientPhone-${newIndex}`
        ],
        [
            ".delivery-instructions",
            `instructions-${newIndex}`
        ]
    ];

    fields.forEach(
        ([selector, id]) => {

            const field =
                newCard.querySelector(
                    selector
                );

            if (!field) {
                return;
            }

            field.id = id;
            field.value = "";

            if (
                field.tagName === "INPUT" &&
                selector === ".destination-input"
            ) {
                field.name = id;
            }

            const label =
                newCard.querySelector(
                    `label[for="${field.id.replace(
                        /\\/g,
                        "\\\\"
                    )}"]`
                );

            if (label) {
                label.setAttribute(
                    "for",
                    id
                );
            }
        }
    );

    const suggestions =
        newCard.querySelector(
            ".destination-suggestions"
        );

    if (suggestions) {
        suggestions.id =
            `destinationSuggestions-${newIndex}`;

        suggestions.innerHTML = "";
    }

    const locationButton =
        newCard.querySelector(
            ".destination-location-btn"
        );

    if (locationButton) {
        locationButton.textContent =
            "📍";
    }

    destinationsContainer.appendChild(
        newCard
    );

    destinationLocations[newIndex] =
        null;

    setupDestinationCard(
        newCard
    );

    return newCard;
}


if (addDestinationBtn) {

    addDestinationBtn.addEventListener(
        "click",
        () => {
            addDestinationCard();
        }
    );
}


/*
    ROUTE CALCULATION
*/

async function calculateRoute() {

    const method =
        document.querySelector(
            'input[name="deliveryMethod"]:checked'
        )?.value || "WALKER";

    if (!pickupLocation) {

        showMessage(
            "Please select a valid pickup location from the suggestions."
        );

        return null;
    }

    const destinations =
        destinationLocations.filter(Boolean);

    if (
        destinations.length === 0 ||
        destinations.length !== destinationLocations.length
    ) {

        showMessage(
            "Please select a valid location for every destination."
        );

        return null;
    }

    try {

        let currentLocation =
            pickupLocation;

        let totalDistanceKm = 0;
        let totalDurationMinutes = 0;

        const legs = [];

        for (
            let i = 0;
            i < destinations.length;
            i++
        ) {

            const nextLocation =
                destinations[i];

            const route =
                await window.DreypellaLocation
                    .calculateRoute(
                        currentLocation,
                        nextLocation,
                        method
                    );

            totalDistanceKm +=
                Number(route.distanceKm || 0);

            totalDurationMinutes +=
                Number(route.durationMinutes || 0);

            legs.push({
                from: currentLocation,
                to: nextLocation,
                distanceKm: route.distanceKm,
                durationMinutes: route.durationMinutes
            });

            currentLocation =
                nextLocation;
        }

        return {
            distanceKm:
                totalDistanceKm,

            durationMinutes:
                totalDurationMinutes,

            legs
        };

    } catch (error) {

        console.error(
            "Route calculation error:",
            error
        );

        showMessage(
            "We could not calculate the route right now. Please try again."
        );

        return null;
    }
}


/*
    DELIVERY PRICE

    Customer quote rates are stored separately from
    private Admin/platform pricing.
*/

async function calculateDeliveryPrice(
    distanceKm,
    method,
    size,
    weight
) {
    if (
        typeof firebase === "undefined" ||
        typeof firebase.functions !== "function"
    ) {
        throw new Error(
            "Delivery pricing service is unavailable."
        );
    }

    const functions =
        firebase.functions();

    const calculateDeliveryQuote =
        functions.httpsCallable(
            "calculateDeliveryQuote"
        );

    const response =
        await calculateDeliveryQuote({
            distanceKm,
            method,
            size,
            weight
        });

    if (
        !response ||
        !response.data ||
        response.data.success !== true
    ) {
        throw new Error(
            "Unable to calculate delivery price."
        );
    }

    const customerPrice =
        Number(
            response.data.customerPrice
        );

    if (
        !Number.isFinite(customerPrice) ||
        customerPrice <= 0
    ) {
        throw new Error(
            "Invalid delivery price returned by the server."
        );
    }

    return customerPrice;
}

/*
    CALCULATE BUTTON
*/

calculateBtn.addEventListener(
    "click",
    async () => {

        clearMessage();

        if (!pickupInput.value.trim()) {

            showMessage(
                "Enter your pickup location."
            );

            return;
        }

        const destinationCards =
            getDestinationCards();

        if (!destinationCards.length) {

            showMessage(
                "Please add at least one destination."
            );

            return;
        }

        const missingDestination =
            destinationCards.some(
                card => {

                    const index =
                        getDestinationIndex(card);

                    const input =
                        card.querySelector(
                            ".destination-input"
                        );

                    return (
                        !input ||
                        !input.value.trim() ||
                        !destinationLocations[index]
                    );
                }
            );

        if (missingDestination) {

            showMessage(
                "Please select a valid location for every destination from the suggestions."
            );

            return;
        }

        calculateBtn.disabled =
            true;

        calculateBtn.textContent =
            "CALCULATING...";

        try {

            const route =
                await calculateRoute();

            if (!route) {
                return;
            }

            const method =
                document.querySelector(
                    'input[name="deliveryMethod"]:checked'
                )?.value || "WALKER";

            const price =
                await calculateDeliveryPrice(
                    route.distanceKm,
                    method,
                    document.getElementById(
                        "packageSize"
                    ).value,
                    document.getElementById(
                        "packageWeight"
                    ).value
                );

            document.getElementById(
                "resultPickup"
            ).textContent =
                shortenLocation(
                    pickupLocation.name
                );

            const resultDestination =
                document.getElementById(
                    "resultDestination"
                );

            if (resultDestination) {

                resultDestination.textContent =
                    destinationLocations
                        .map(
                            (location, index) =>
                                `${index + 1}. ${shortenLocation(location.name)}`
                        )
                        .join(" • ");
            }

            document.getElementById(
                "distanceDisplay"
            ).textContent =
                route.distanceKm.toFixed(1) +
                " km";

            document.getElementById(
                "timeDisplay"
            ).textContent =
                formatTime(
                    route.durationMinutes
                );

            document.getElementById(
                "priceDisplay"
            ).textContent =
                formatCurrency(price);

            deliveryResult.classList.remove(
                "hidden"
            );

            deliveryResult.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

        } catch (error) {

            console.error(
                "Delivery calculation error:",
                error
            );

            showMessage(
                "We could not calculate the delivery price right now. Please try again."
            );

        } finally {

            calculateBtn.disabled =
                false;

            calculateBtn.textContent =
                "CALCULATE DELIVERY";
        }
    }
);



/*
    DETERMINE DELIVERY TYPE
*/
function determineDeliveryType(
    pickup,
    destinations
) {
    const pickupCountry =
        String(
            pickup?.countryCode ||
            ""
        ).trim().toLowerCase();

    if (!pickupCountry) {
        return null;
    }

    if (
        !Array.isArray(destinations) ||
        destinations.length === 0
    ) {
        return null;
    }

    const destinationCountries =
        destinations.map(
            destination =>
                String(
                    destination?.countryCode ||
                    ""
                ).trim().toLowerCase()
        );

    if (
        destinationCountries.some(
            country => !country
        )
    ) {
        return null;
    }

    if (
        pickupCountry !== "ng" ||
        destinationCountries.some(
            country => country !== "ng"
        )
    ) {
        return "INTERNATIONAL";
    }

    const pickupState =
        String(
            pickup?.state ||
            ""
        ).trim().toLowerCase();

    if (!pickupState) {
        return null;
    }

    const destinationStates =
        destinations.map(
            destination =>
                String(
                    destination?.state ||
                    ""
                ).trim().toLowerCase()
        );

    if (
        destinationStates.some(
            state => !state
        )
    ) {
        return null;
    }

    return destinationStates.some(
        state => state !== pickupState
    )
        ? "INTERSTATE"
        : "LOCAL";
}


/*
    SUBMIT BOOKING
*/

deliveryForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        if (!pickupLocation) {
            showMessage(
                "Please calculate your delivery route first."
            );

            return;
        }

        const destinationCards =
            getDestinationCards();

        if (!destinationCards.length) {
            showMessage(
                "Please add at least one destination."
            );

            return;
        }

        const destinations = [];

        for (const card of destinationCards) {

            const index =
                getDestinationIndex(card);

            const destination =
                destinationLocations[index];

            const destinationInput =
                card.querySelector(
                    ".destination-input"
                );

            const recipientName =
                card.querySelector(
                    ".recipient-name"
                );

            const recipientPhone =
                card.querySelector(
                    ".recipient-phone"
                );

            const instructions =
                card.querySelector(
                    ".delivery-instructions"
                );

            if (
                !destination ||
                !destinationInput ||
                !destinationInput.value.trim()
            ) {
                showMessage(
                    "Please select a valid location for every destination."
                );

                return;
            }

            if (
                !recipientName ||
                !recipientName.value.trim()
            ) {
                showMessage(
                    "Please enter the recipient name for every destination."
                );

                return;
            }

            if (
                !recipientPhone ||
                !recipientPhone.value.trim()
            ) {
                showMessage(
                    "Please enter the recipient phone number for every destination."
                );

                return;
            }

            destinations.push({
                destination,
                recipientName:
                    recipientName.value.trim(),
                recipientPhone:
                    recipientPhone.value.trim(),
                instructions:
                    instructions?.value.trim() || ""
            });
        }

        const destinationLocationsForType =
            destinations.map(
                item => item.destination
            );

        const deliveryType =
            determineDeliveryType(
                pickupLocation,
                destinationLocationsForType
            );

        if (!deliveryType) {
            showMessage(
                "We could not determine the delivery type. Please select your pickup and destination locations again."
            );

            return;
        }

        const method =
            document.querySelector(
                'input[name="deliveryMethod"]:checked'
            )?.value || "WALKER";

        const booking = {

            pickup:
                pickupLocation,

            deliveryType:
                deliveryType,

            destinations,

            category:
                document.getElementById(
                    "packageCategory"
                ).value,

            size:
                document.getElementById(
                    "packageSize"
                ).value,

            weight:
                document.getElementById(
                    "packageWeight"
                ).value,

            method,

            createdAt:
                new Date().toISOString()
        };

        /*
            Save temporary booking locally.

            Firebase booking storage will be added
            when we connect this page to your
            Firestore database.
        */

        localStorage.setItem(
            "dreypellaDeliveryBooking",
            JSON.stringify(booking)
        );

        window.location.href =
            "delivery-confirmation.html";
    }
);


/*
    FORMAT CURRENCY
*/

function formatCurrency(amount) {

    return "₦" +
        Number(amount).toLocaleString(
            "en-NG"
        );
}


/*
    FORMAT TIME
*/

function formatTime(minutes) {

    if (minutes < 60) {

        return Math.round(minutes) +
            " mins";
    }


    const hours =
        Math.floor(minutes / 60);

    const remaining =
        Math.round(minutes % 60);


    if (remaining === 0) {

        return hours +
            " hr";
    }


    return hours +
        " hr " +
        remaining +
        " mins";
}


/*
    SHORTEN LONG LOCATION
*/

function shortenLocation(
    location
) {

    if (!location) {
        return "Location";
    }


    if (location.length <= 55) {

        return location;
    }


    return location.substring(
        0,
        55
    ) + "...";
}


/*
    MESSAGE
*/

function showMessage(message) {

    deliveryMessage.textContent =
        message;

    deliveryMessage.style.color =
        "#E31B23";
}


function clearMessage() {

    deliveryMessage.textContent =
        "";
}


/*
    CLOSE SUGGESTIONS WHEN CLICKING
    OUTSIDE THE INPUT
*/

document.addEventListener(
    "click",
    event => {

        if (
            !pickupInput.contains(event.target) &&
            !pickupSuggestions.contains(event.target)
        ) {

            pickupSuggestions.innerHTML =
                "";
        }

        getDestinationCards().forEach(
            card => {

                const input =
                    card.querySelector(
                        ".destination-input"
                    );

                const suggestions =
                    card.querySelector(
                        ".destination-suggestions"
                    );

                if (
                    input &&
                    suggestions &&
                    !input.contains(event.target) &&
                    !suggestions.contains(event.target)
                ) {

                    suggestions.innerHTML =
                        "";
                }
            }
        );
    }
);

/*
    RESTORE DELIVERY FOR EDIT MODE
*/

(function restoreDeliveryEditMode() {

    const editMode =
        localStorage.getItem(
            "dreypellaDeliveryEditMode"
        );

    if (editMode !== "true") {
        return;
    }

    const savedBookingRaw =
        localStorage.getItem(
            "dreypellaDeliveryBooking"
        );

    if (!savedBookingRaw) {
        localStorage.removeItem(
            "dreypellaDeliveryEditMode"
        );
        return;
    }

    let savedBooking;

    try {
        savedBooking =
            JSON.parse(savedBookingRaw);
    } catch (error) {
        console.error(
            "Unable to restore delivery booking:",
            error
        );

        localStorage.removeItem(
            "dreypellaDeliveryEditMode"
        );

        return;
    }

    pickupLocation =
        savedBooking.pickup || null;

    if (pickupLocation) {
        pickupInput.value =
            pickupLocation.name ||
            pickupLocation.address?.road ||
            pickupLocation.address ||
            "";
    }

    const savedDestinations =
        Array.isArray(savedBooking.destinations)
            ? savedBooking.destinations
            : [];

    if (savedDestinations.length > 0) {

        destinationLocations.length = 0;

        destinationLocations[0] = null;

        const existingCards =
            getDestinationCards();

        existingCards.forEach(
            (card, index) => {

                if (index > 0) {
                    card.remove();
                }
            }
        );

        for (
            let i = 1;
            i < savedDestinations.length;
            i++
        ) {
            addDestinationCard();
        }

        const destinationCards =
            getDestinationCards();

        savedDestinations.forEach(
            (savedDestination, index) => {

                const card =
                    destinationCards[index];

                if (!card) {
                    return;
                }

                const destination =
                    savedDestination.destination || null;

                destinationLocations[index] =
                    destination;

                const destinationInput =
                    card.querySelector(
                        ".destination-input"
                    );

                const recipientName =
                    card.querySelector(
                        ".recipient-name"
                    );

                const recipientPhone =
                    card.querySelector(
                        ".recipient-phone"
                    );

                const instructions =
                    card.querySelector(
                        ".delivery-instructions"
                    );

                if (destinationInput) {
                    destinationInput.value =
                        destination?.name ||
                        destination?.address?.road ||
                        destination?.address ||
                        "";
                }

                if (recipientName) {
                    recipientName.value =
                        savedDestination.recipientName ||
                        "";
                }

                if (recipientPhone) {
                    recipientPhone.value =
                        savedDestination.recipientPhone ||
                        "";
                }

                if (instructions) {
                    instructions.value =
                        savedDestination.instructions ||
                        "";
                }
            }
        );
    }

    const category =
        document.getElementById(
            "packageCategory"
        );

    if (category) {
        category.value =
            savedBooking.category || "";
    }

    const size =
        document.getElementById(
            "packageSize"
        );

    if (size) {
        size.value =
            savedBooking.size || "";
    }

    const weight =
        document.getElementById(
            "packageWeight"
        );

    if (weight) {
        weight.value =
            savedBooking.weight || "";
    }

    const methodRadio =
        document.querySelector(
            'input[name="deliveryMethod"][value="' +
            savedBooking.method +
            '"]'
        );

    if (methodRadio) {
        methodRadio.checked = true;
    }

    localStorage.removeItem(
        "dreypellaDeliveryEditMode"
    );

})();
