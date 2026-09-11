/*
    DREYPELLA RIDE
    DELIVERY SYSTEM

    Uses OpenStreetMap Nominatim for location search
    and OSRM for route/distance calculation.

    No Google Maps API key is required.
*/


const pickupInput =
    document.getElementById("pickup");

const destinationInput =
    document.getElementById("destination");

const pickupSuggestions =
    document.getElementById("pickupSuggestions");

const destinationSuggestions =
    document.getElementById("destinationSuggestions");

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
let destinationLocation = null;


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


                if (type === "pickup") {

                    pickupLocation =
                        location;

                    pickupInput.value =
                        result.display_name;

                    pickupSuggestions.innerHTML =
                        "";

                } else {

                    destinationLocation =
                        location;

                    destinationInput.value =
                        result.display_name;

                    destinationSuggestions.innerHTML =
                        "";
                }

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
    DESTINATION SEARCH
*/

let destinationTimer;


destinationInput.addEventListener(
    "input",
    () => {

        destinationLocation = null;

        clearTimeout(
            destinationTimer
        );

        destinationTimer =
            setTimeout(
                async () => {

                    const results =
                        await searchLocation(
                            destinationInput.value
                        );

                    displaySuggestions(
                        results,
                        destinationSuggestions,
                        "destination"
                    );

                },
                600
            );
    }
);


/*
    CURRENT LOCATION
*/

const destinationLocationBtn =
    document.getElementById("destinationLocationBtn");


async function useCurrentLocation(type) {
    const button =
        type === "pickup"
            ? currentLocationBtn
            : destinationLocationBtn;

    const input =
        type === "pickup"
            ? pickupInput
            : destinationInput;

    if (!button) {
        return;
    }

    button.textContent = "⌛";

    try {
        const location =
            await window.DreypellaLocation.getCurrentLocation();

        input.value = location.name;

        if (type === "pickup") {
            pickupLocation = location;
            pickupSuggestions.innerHTML = "";
        } else {
            destinationLocation = location;
            destinationSuggestions.innerHTML = "";
        }
    } catch (error) {
        console.error("Current location error:", error);

        if (error && error.code === 1) {
            showMessage(
                "Unable to access your location. Please allow location permission."
            );
        } else {
            showMessage(
                "We could not identify your current location. Please try again or enter the address manually."
            );
        }
    } finally {
        button.textContent = "📍";
    }
}

currentLocationBtn.addEventListener(
    "click",
    () => useCurrentLocation("pickup")
);


if (destinationLocationBtn) {

    destinationLocationBtn.addEventListener(
        "click",
        () => useCurrentLocation("destination")
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

    if (!destinationLocation) {
        showMessage(
            "Please select a valid destination from the suggestions."
        );
        return null;
    }

    try {
        return await window.DreypellaLocation.calculateRoute(
            pickupLocation,
            destinationLocation,
            method
        );
    } catch (error) {
        console.error("Route calculation error:", error);
        showMessage(
            "We could not calculate the route right now. Please try again."
        );
        return null;
    }
}

/*
    DELIVERY PRICE

    IMPORTANT:

    These are temporary frontend defaults.

    Later, these values should come from
    your Firebase Admin pricing settings.

    Customers only see the final price.
*/

const pricing = {

    baseFare: 500,

    perKm: 120,

    vehicleSurcharge: 300,

    riderSurcharge: 150,

    walkerDifference: 150
};


/*
    CALCULATE CUSTOMER PRICE
*/

function calculateDeliveryPrice(
    distanceKm,
    method
) {

    let price =
        pricing.baseFare +
        (distanceKm * pricing.perKm);


    if (method === "VEHICLE") {

        price +=
            pricing.vehicleSurcharge;
    }


    if (method === "RIDER") {

        price +=
            pricing.riderSurcharge;
    }


    if (method === "WALKER") {

        price -=
            pricing.walkerDifference;
    }


    /*
        Prevent extremely low prices.
    */

    if (price < 700) {

        price = 700;
    }


    /*
        Round to nearest ₦50
    */

    price =
        Math.ceil(price / 50) * 50;


    return price;
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


        if (!destinationInput.value.trim()) {

            showMessage(
                "Enter your destination."
            );

            return;
        }


        calculateBtn.disabled =
            true;

        calculateBtn.textContent =
            "CALCULATING...";


        const route =
            await calculateRoute();


        calculateBtn.disabled =
            false;

        calculateBtn.textContent =
            "CALCULATE DELIVERY";


        if (!route) {
            return;
        }


        const method =
            document.querySelector(
                'input[name="deliveryMethod"]:checked'
            ).value;


        const price =
            calculateDeliveryPrice(
                route.distanceKm,
                method
            );


        document.getElementById(
            "resultPickup"
        ).textContent =
            shortenLocation(
                pickupLocation.name
            );


        document.getElementById(
            "resultDestination"
        ).textContent =
            shortenLocation(
                destinationLocation.name
            );


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

    }
);


/*
    DETERMINE DELIVERY TYPE
*/
function determineDeliveryType(
    pickup,
    destination
) {
    const pickupCountry =
        String(
            pickup?.countryCode ||
            ""
        ).toLowerCase();

    const destinationCountry =
        String(
            destination?.countryCode ||
            ""
        ).toLowerCase();

    if (
        !pickupCountry ||
        !destinationCountry
    ) {
        return null;
    }

    if (
        pickupCountry !== "ng" ||
        destinationCountry !== "ng"
    ) {
        return "INTERNATIONAL";
    }

    const pickupState =
        String(
            pickup?.state ||
            ""
        ).trim().toLowerCase();

    const destinationState =
        String(
            destination?.state ||
            ""
        ).trim().toLowerCase();

    if (
        !pickupState ||
        !destinationState
    ) {
        return null;
    }

    return pickupState === destinationState
        ? "LOCAL"
        : "INTERSTATE";
}


/*
    SUBMIT BOOKING
*/

deliveryForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if (!pickupLocation ||
            !destinationLocation) {

            showMessage(
                "Please calculate your delivery route first."
            );

            return;
        }


        const deliveryType =
            determineDeliveryType(
                pickupLocation,
                destinationLocation
            );

        if (!deliveryType) {
            showMessage(
                "We could not determine the delivery type. Please select your pickup and destination again."
            );

            return;
        }


        const booking = {

            pickup:
                pickupLocation,

            deliveryType:
                deliveryType,

            destination:
                destinationLocation,

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

            recipientName:
                document.getElementById(
                    "recipientName"
                ).value.trim(),

            recipientPhone:
                document.getElementById(
                    "recipientPhone"
                ).value.trim(),

            instructions:
                document.getElementById(
                    "instructions"
                ).value.trim(),

            method:
                document.querySelector(
                    'input[name="deliveryMethod"]:checked'
                ).value,

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


        if (
            !destinationInput.contains(event.target) &&
            !destinationSuggestions.contains(event.target)
        ) {

            destinationSuggestions.innerHTML =
                "";
        }

    }
);
