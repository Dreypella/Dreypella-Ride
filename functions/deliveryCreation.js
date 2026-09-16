const admin = require("firebase-admin");

const db = admin.firestore();

function normalizeNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function normalizeCoordinate(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function validateCoordinates(latitude, longitude, label) {
    if (
        latitude === null ||
        longitude === null ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        throw new Error(
            `${label} coordinates are invalid.`
        );
    }
}
function normalizeDestinations(destinations) {
    if (!Array.isArray(destinations) || !destinations.length) {
        throw new Error(
            "At least one delivery destination is required."
        );
    }

    return destinations.map((item, index) => {
        const destination =
            item?.destination || item || {};

        const latitude =
            normalizeCoordinate(
                destination.lat ??
                destination.latitude
            );

        const longitude =
            normalizeCoordinate(
                destination.lon ??
                destination.longitude
            );

        validateCoordinates(
            latitude,
            longitude,
            `Destination ${index + 1}`
        );

        const countryCode =
            String(
                destination.countryCode || ""
            ).trim().toLowerCase();

        const state =
            String(
                destination.state || ""
            ).trim();

        if (!countryCode || !state) {
            throw new Error(
                `Destination ${index + 1} country/state information is required.`
            );
        }

        return {
            destination: {
                ...destination,
                lat: latitude,
                lon: longitude,
                latitude,
                longitude,
                countryCode,
                state,
                name: destination.name || "",
                address: destination.address || {},
                city: destination.city || ""
            },
            recipientName:
                item?.recipientName || "",
            recipientPhone:
                item?.recipientPhone || "",
            recipientEmail:
                item?.recipientEmail || "",
            instructions:
                item?.instructions ??
                item?.deliveryInstructions ??
                ""
        };
    });
}
  function determineDeliveryType(
    pickup,
    destination
) {
    const pickupCountry =
        String(
            pickup?.countryCode ||
            ""
        ).trim().toLowerCase();

    const destinationCountry =
        String(
            destination?.countryCode ||
            ""
        ).trim().toLowerCase();

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

async function calculateDrivingRoute(
    pickupLatitude,
    pickupLongitude,
    destinationLatitude,
    destinationLongitude
) {
    const url =
        "https://router.project-osrm.org/route/v1/driving/" +
        `${pickupLongitude},${pickupLatitude};` +
        `${destinationLongitude},${destinationLatitude}` +
        "?overview=false";

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            "Unable to calculate the delivery route."
        );
    }

    const result = await response.json();

    if (
        result.code !== "Ok" ||
        !Array.isArray(result.routes) ||
        !result.routes.length
    ) {
        throw new Error(
            "No valid driving route was found between the pickup and destination."
        );
    }

    const route = result.routes[0];

    const distanceKm =
        normalizeNumber(route.distance) / 1000;

    const durationMinutes =
        normalizeNumber(route.duration) / 60;

    if (
        !Number.isFinite(distanceKm) ||
        distanceKm < 0
    ) {
        throw new Error(
            "The calculated delivery distance is invalid."
        );
    }

    if (
        !Number.isFinite(durationMinutes) ||
        durationMinutes < 0
    ) {
        throw new Error(
            "The calculated delivery time is invalid."
        );
    }

    return {
        distanceKm,
        durationMinutes
    };
}

function generateDeliveryId() {
    return (
        "DEL-" +
        Date.now() +
        "-" +
        Math.floor(
            1000 +
            Math.random() * 9000
        )
    );
}

function generateBookingReference() {
    return (
        "DR-" +
        Date.now()
            .toString()
            .slice(-8) +
        "-" +
        Math.floor(
            100 +
            Math.random() * 900
        )
    );
}

function calculateCustomerPrice(
    distanceKm,
    method,
    size,
    weight,
    pricing
) {
    const normalizedMethod =
        String(method || "")
            .toUpperCase();

    let baseFare;

    switch (normalizedMethod) {
        case "WALKER":
            baseFare =
                Number(
                    pricing.walkerBaseFare
                );
            break;

        case "BICYCLIST":
            baseFare =
                Number(
                    pricing.bicyclistBaseFare
                );
            break;

        case "RIDER":
            baseFare =
                Number(
                    pricing.riderBaseFare
                );
            break;

        case "DRIVER":
        case "VEHICLE":
            baseFare =
                Number(
                    pricing.driverBaseFare
                );
            break;

        default:
            throw new Error(
                "Invalid delivery method."
            );
    }

    if (!Number.isFinite(baseFare)) {
        throw new Error(
            "Pricing for the selected delivery method is not configured."
        );
    }

    const km =
        Number(distanceKm);

    if (
        !Number.isFinite(km) ||
        km < 0
    ) {
        throw new Error(
            "Invalid delivery distance."
        );
    }

    let price =
        baseFare +
        (
            km *
            Number(
                pricing.pricePerKm || 0
            )
        );

    const normalizedSize =
        String(size || "")
            .toUpperCase();

    if (
        normalizedSize === "MEDIUM"
    ) {
        price +=
            Number(
                pricing.mediumPackageFee || 0
            );
    }

    if (
        normalizedSize === "LARGE"
    ) {
        price +=
            Number(
                pricing.largePackageFee || 0
            );
    }

    const weightKg =
        Number(weight);

    const extraWeightRate =
        Number(
            pricing.extraWeightPerKg || 0
        );

    if (
        Number.isFinite(weightKg) &&
        weightKg > 0 &&
        extraWeightRate > 0
    ) {
        const extraWeight =
            Math.max(
                0,
                weightKg - 1
            );

        price +=
            extraWeight *
            extraWeightRate;
    }

    const minimumFee =
        Number(
            pricing.minimumDeliveryFee || 0
        );

    const maximumFee =
        Number(
            pricing.maximumDeliveryFee || 0
        );

    if (
        Number.isFinite(minimumFee) &&
        minimumFee > 0
    ) {
        price =
            Math.max(
                price,
                minimumFee
            );
    }

    if (
        Number.isFinite(maximumFee) &&
        maximumFee > 0
    ) {
        price =
            Math.min(
                price,
                maximumFee
            );
    }

    return Math.ceil(
        price / 50
    ) * 50;
}


async function calculateDeliveryQuote(
    data,
    context
) {
    if (!context || !context.auth) {
        throw new Error(
            "Authentication is required."
        );
    }

    const booking =
        data || {};

    const distanceKm =
        Number(booking.distanceKm);

    if (
        !Number.isFinite(distanceKm) ||
        distanceKm < 0
    ) {
        throw new Error(
            "Invalid delivery distance."
        );
    }

    const method =
        String(
            booking.method || ""
        ).toUpperCase();

    const allowedMethods = [
        "WALKER",
        "BICYCLIST",
        "RIDER",
        "DRIVER",
        "VEHICLE"
    ];

    if (!allowedMethods.includes(method)) {
        throw new Error(
            "Invalid delivery method."
        );
    }

    const snapshot =
        await db
            .collection("settings")
            .doc("pricing")
            .get();

    if (!snapshot.exists) {
        throw new Error(
            "Delivery pricing has not been configured by Admin."
        );
    }

    const pricing =
        snapshot.data();

    const customerPrice =
        calculateCustomerPrice(
            distanceKm,
            method,
            booking.size,
            booking.weight,
            pricing
        );

    return {
        success: true,
        customerPrice
    };
}


async function calculateRecipientPaymentAllocations(
    pickup,
    destinations,
    customerPrice
) {
    if (
        !pickup ||
        !Array.isArray(destinations) ||
        !destinations.length
    ) {
        throw new Error(
            "Valid pickup and destinations are required for recipient payment allocation."
        );
    }

    if (
        !Number.isFinite(Number(customerPrice)) ||
        Number(customerPrice) <= 0
    ) {
        throw new Error(
            "A valid delivery price is required for recipient payment allocation."
        );
    }

    const pickupLatitude =
        normalizeCoordinate(
            pickup.latitude ??
            pickup.lat
        );

    const pickupLongitude =
        normalizeCoordinate(
            pickup.longitude ??
            pickup.lon
        );

    validateCoordinates(
        pickupLatitude,
        pickupLongitude,
        "Pickup"
    );

    const directDistances = [];

    for (
        let index = 0;
        index < destinations.length;
        index += 1
    ) {
        const destination =
            destinations[index]?.destination ||
            destinations[index] ||
            {};

        const latitude =
            normalizeCoordinate(
                destination.latitude ??
                destination.lat
            );

        const longitude =
            normalizeCoordinate(
                destination.longitude ??
                destination.lon
            );

        validateCoordinates(
            latitude,
            longitude,
            `Destination ${index + 1}`
        );

        const route =
            await calculateDrivingRoute(
                pickupLatitude,
                pickupLongitude,
                latitude,
                longitude
            );

        directDistances.push(
            route.distanceKm
        );
    }

    const totalDirectDistance =
        directDistances.reduce(
            (total, distance) =>
                total + distance,
            0
        );

    if (
        !Number.isFinite(
            totalDirectDistance
        ) ||
        totalDirectDistance <= 0
    ) {
        throw new Error(
            "Unable to calculate recipient payment distances."
        );
    }

    const totalAmount =
        Math.round(
            Number(customerPrice) * 100
        );

    const allocations =
        directDistances.map(
            (distanceKm, index) => {
                const exactAmount =
                    (
                        distanceKm /
                        totalDirectDistance
                    ) *
                    totalAmount;

                return {
                    destinationIndex: index,
                    directDistanceKm:
                        distanceKm,
                    exactAmount
                };
            }
        );

    const roundedAllocations =
        allocations.map(
            item => ({
                ...item,
                amountKobo:
                    Math.floor(
                        item.exactAmount
                    )
            })
        );

    let allocatedKobo =
        roundedAllocations.reduce(
            (total, item) =>
                total + item.amountKobo,
            0
        );

    let remainder =
        totalAmount -
        allocatedKobo;

    const fractionalOrder =
        allocations
            .map((item, index) => ({
                index,
                fraction:
                    item.exactAmount -
                    Math.floor(
                        item.exactAmount
                    )
            }))
            .sort(
                (a, b) =>
                    b.fraction -
                    a.fraction
            );

    for (
        let index = 0;
        index < fractionalOrder.length &&
        remainder > 0;
        index += 1
    ) {
        roundedAllocations[
            fractionalOrder[index].index
        ].amountKobo += 1;

        allocatedKobo += 1;
        remainder -= 1;
    }

    if (
        allocatedKobo !== totalAmount
    ) {
        throw new Error(
            "Recipient payment allocation could not be balanced."
        );
    }

    return roundedAllocations.map(
        item => ({
            destinationIndex:
                item.destinationIndex,
            directDistanceKm:
                item.directDistanceKm,
            amount:
                item.amountKobo / 100,
            paymentStatus:
                "PENDING",
            paymentRequestId:
                null
        })
    );
}

function formatEstimatedTime(
    durationMinutes
) {
    if (durationMinutes < 60) {
        return (
            Math.round(
                durationMinutes
            ) +
            " mins"
        );
    }

    const hours =
        Math.floor(
            durationMinutes / 60
        );

    const remaining =
        Math.round(
            durationMinutes % 60
        );

    if (remaining === 0) {
        return hours + " hr";
    }

    return (
        hours +
        " hr " +
        remaining +
        " mins"
    );
}

async function createDelivery(
    data,
    context
) {
    if (
        !context ||
        !context.auth ||
        !context.auth.uid
    ) {
        throw new Error(
            "You must be logged in to create a delivery."
        );
    }

    const uid =
        context.auth.uid;

    const booking =
        data || {};

    const pickup =
        booking.pickup || {};

const destinations =
    normalizeDestinations(
        booking.destinations
    );
    const method =
        String(
            booking.method || ""
        ).trim().toUpperCase();

    if (
        ![
            "WALKER",
            "BICYCLIST",
            "RIDER",
            "DRIVER",
            "VEHICLE"
        ].includes(method)
    ) {
        throw new Error(
            "Invalid delivery method."
        );
    }









    const pickupLatitude =
        normalizeCoordinate(
            pickup.lat ??
            pickup.latitude
        );

    const pickupLongitude =
        normalizeCoordinate(
            pickup.lon ??
            pickup.longitude
        );

    validateCoordinates(
        pickupLatitude,
        pickupLongitude,
        "Pickup"
    );

    const pickupCountry =
        String(
            pickup.countryCode || ""
        ).trim().toLowerCase();

    const pickupState =
        String(
            pickup.state || ""
        ).trim();

    if (
        !pickupCountry ||
        !pickupState
    ) {
        throw new Error(
            "Pickup country/state information is required."
        );
    }

    let currentLatitude =
        pickupLatitude;

    let currentLongitude =
        pickupLongitude;

    let totalDistanceKm = 0;

    let totalDurationMinutes = 0;

    const routeLegs = [];

    let deliveryType =
        "LOCAL";

    for (
        let index = 0;
        index < destinations.length;
        index++
    ) {
        const destination =
            destinations[index];

        const route =
            await calculateDrivingRoute(
                currentLatitude,
                currentLongitude,
                destination.destination.latitude,
                destination.destination.longitude
            );

        totalDistanceKm +=
            route.distanceKm;

        totalDurationMinutes +=
            route.durationMinutes;

        routeLegs.push({
            sequence:
                index + 1,

            distanceKm:
                route.distanceKm,

            durationMinutes:
                route.durationMinutes,

            destinationIndex:
                index
        });

        const legDeliveryType =
            determineDeliveryType(
                pickup,
                destination.destination
            );

        if (!legDeliveryType) {
            throw new Error(
                `Destination ${index + 1} country/state information is required.`
            );
        }

        if (
            legDeliveryType ===
            "INTERNATIONAL"
        ) {
            deliveryType =
                "INTERNATIONAL";
        } else if (
            legDeliveryType ===
            "INTERSTATE" &&
            deliveryType !==
                "INTERNATIONAL"
        ) {
            deliveryType =
                "INTERSTATE";
        }

        currentLatitude =
            destination.destination.latitude;

        currentLongitude =
            destination.destination.longitude;
    }

    const route = {
        distanceKm:
            totalDistanceKm,

        durationMinutes:
            totalDurationMinutes
    };
    const pricingSnapshot =
        await db
            .collection("settings")
            .doc("pricing")
            .get();

    if (!pricingSnapshot.exists) {
        throw new Error(
            "Delivery pricing has not been configured by Admin."
        );
    }

    const pricing =
        pricingSnapshot.data();

    const packageSize =
        booking.size ??
        booking.packageSize ??
        "";

    const packageWeight =
        booking.weight ??
        booking.packageWeight ??
        0;

    const customerPrice =
        calculateCustomerPrice(
            route.distanceKm,
            method,
            packageSize,
            packageWeight,
            pricing
        );

    if (
        !Number.isFinite(customerPrice) ||
        customerPrice <= 0
    ) {
        throw new Error(
            "Unable to calculate a valid delivery price."
        );
    }

    const deliveryId =
        generateDeliveryId();

    const bookingReference =
        generateBookingReference();

    const payer =
        String(
            booking.payer || "SENDER"
        ).trim().toUpperCase();

    if (
        payer !== "SENDER" &&
        payer !== "RECEIVER"
    ) {
        throw new Error(
            "Invalid payment payer."
        );
    }

    if (
        payer === "RECEIVER" &&
        deliveryType !== "LOCAL"
    ) {
        throw new Error(
            "Receiver payment is only available for local deliveries."
        );
    }

    const paymentMethod =
        booking.paymentMethod
            ? String(
                booking.paymentMethod
            ).trim().toUpperCase()
            : null;

    if (payer === "RECEIVER") {
        if (paymentMethod !== "POD") {
            throw new Error(
                "Receiver payment must use Pay on Delivery."
            );
        }
    } else {
        if (
            paymentMethod !== "WALLET" &&
            paymentMethod !== "PAYSTACK"
        ) {
            throw new Error(
                "Sender payment method must be WALLET or PAYSTACK."
            );
        }
    }

    let recipientPaymentAllocations = [];

    if (payer === "RECEIVER") {
        recipientPaymentAllocations =
            await calculateRecipientPaymentAllocations(
                pickup,
                destinations,
                customerPrice
            );
    }

    const firstDestination =
        destinations[0];

    const delivery = {
        deliveryId,

        bookingReference,

        customerId:
            uid,

        customerEmail:
            context.auth.token?.email ||
            "",

        payer,

        paymentMethod,

        pickup: {
            name:
                pickup.name ||
                "",

            address:
                pickup.address ||
                "",

            latitude:
                pickupLatitude,

            longitude:
                pickupLongitude
        },

        destinations,

        recipientPaymentAllocations,

        routeLegs,

        destination: {
            name:
                firstDestination.destination.name ||
                "",

            address:
                firstDestination.destination.address ||
                "",

            latitude:
                firstDestination.destination.latitude,

            longitude:
                firstDestination.destination.longitude
        },

        method,

        packageCategory:
            booking.category ??
            booking.packageCategory ??
            "",

        packageDescription:
            booking.description ??
            booking.packageDescription ??
            "",

        packageSize,

        packageWeight:
            Number(packageWeight) || 0,

        packageValue:
            Number(
                booking.packageValue || 0
            ),

        recipientName:
            firstDestination.recipientName,

        recipientPhone:
            firstDestination.recipientPhone,

        recipientEmail:
            firstDestination.recipientEmail,

        deliveryInstructions:
            firstDestination.instructions,

        distanceKm:
            route.distanceKm,

        estimatedTime:
            formatEstimatedTime(
                route.durationMinutes
            ),

        customerPrice,

        deliveryType,

        paymentStatus:
            "PAYMENT_PENDING",

        status:
            "PAYMENT_PENDING",

        partnerId:
            null,

        partnerName:
            null,

        vehicleInfo:
            null,

        tracking: {
            active:
                false,

            latitude:
                null,

            longitude:
                null,

            heading:
                null,

            speed:
                null,

            accuracy:
                null,

            lastUpdated:
                null
        },

        pickupOtp:
            null,

        deliveryOtp:
            null,

        pickupVerified:
            false,

        deliveryVerified:
            false,

        createdAt:
            admin.firestore
                .FieldValue
                .serverTimestamp(),

        updatedAt:
            admin.firestore
                .FieldValue
                .serverTimestamp()
    };

    await db
        .collection("deliveries")
        .doc(deliveryId)
        .create(delivery);

    return {
        success:
            true,

        deliveryId,

        bookingReference,

        distanceKm:
            route.distanceKm,

        durationMinutes:
            route.durationMinutes,

        estimatedTime:
            delivery.estimatedTime,

        customerPrice,

        deliveryType
    };
}

module.exports = {
    normalizeNumber,
    normalizeCoordinate,
    validateCoordinates,
    determineDeliveryType,
    calculateDrivingRoute,
    calculateCustomerPrice,
    calculateDeliveryQuote,
    createDelivery
};
