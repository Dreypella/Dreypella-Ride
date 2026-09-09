const admin = require("firebase-admin");

const db = admin.firestore();

const NORMAL_RADII_KM = {
    WALKER: 3,
    RIDER: 5,
    DRIVER: 10
};

const OPERATIONAL_MAX_RADII_KM = {
    WALKER: 15,
    RIDER: 25,
    DRIVER: 50
};

const GPS_FRESHNESS_SECONDS = 60;

const ROLE_METHODS = {
    WALKER: "WALKER",
    RIDER: "RIDER",
    DRIVER: "VEHICLE"
};

function normalizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function calculateDistanceKm(latitude1, longitude1, latitude2, longitude2) {
    const lat1 = Number(latitude1);
    const lon1 = Number(longitude1);
    const lat2 = Number(latitude2);
    const lon2 = Number(longitude2);

    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
        return null;
    }

    const earthRadiusKm = 6371;

    const toRadians = degrees => degrees * Math.PI / 180;

    const deltaLatitude = toRadians(lat2 - lat1);
    const deltaLongitude = toRadians(lon2 - lon1);

    const a =
        Math.sin(deltaLatitude / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(deltaLongitude / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
}

function isFreshTimestamp(timestamp) {
    if (!timestamp) {
        return false;
    }

    const timestampMillis =
        typeof timestamp.toMillis === "function"
            ? timestamp.toMillis()
            : new Date(timestamp).getTime();

    if (!Number.isFinite(timestampMillis)) {
        return false;
    }

    const ageSeconds = (Date.now() - timestampMillis) / 1000;

    return ageSeconds >= 0 && ageSeconds <= GPS_FRESHNESS_SECONDS;
}

function isOperablePartner(partner) {
    if (!partner) {
        return false;
    }

    if (!["WALKER", "RIDER", "DRIVER"].includes(partner.role)) {
        return false;
    }

    if (partner.accountStatus &&
        !["ACTIVE"].includes(String(partner.accountStatus).toUpperCase())) {
        return false;
    }

    if (partner.suspended === true ||
        partner.disabled === true) {
        return false;
    }

    return true;
}

function isPaymentEligible(delivery) {
    if (!delivery) {
        return false;
    }

    const payer = String(delivery.payer || "").toUpperCase();

    if (payer === "SENDER") {
        return (
            delivery.paymentStatus === "PAID" &&
            delivery.status === "PAYMENT_CONFIRMED"
        );
    }

    if (payer === "RECEIVER") {
        return (
            delivery.deliveryType === "LOCAL" &&
            delivery.paymentMethod === "POD"
        );
    }

    return false;
}

async function acceptDelivery(data, context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new Error("You must be logged in to accept a delivery.");
    }

    const partnerUid = context.auth.uid;
    const deliveryId = data && data.deliveryId;

    if (!deliveryId || typeof deliveryId !== "string") {
        throw new Error("A valid delivery ID is required.");
    }

    const partnerRef = db.collection("users").doc(partnerUid);
    const deliveryRef = db.collection("deliveries").doc(deliveryId);
    const locationRef = db.collection("partnerLocations").doc(partnerUid);

    const [partnerSnap, deliverySnap, locationSnap] = await Promise.all([
        partnerRef.get(),
        deliveryRef.get(),
        locationRef.get()
    ]);

    if (!partnerSnap.exists) {
        throw new Error("Partner account was not found.");
    }

    if (!deliverySnap.exists) {
        throw new Error("Delivery was not found.");
    }

    if (!locationSnap.exists) {
        throw new Error("Your current location is not available.");
    }

    const partner = partnerSnap.data();
    const delivery = deliverySnap.data();
    const location = locationSnap.data();

    if (!isOperablePartner(partner)) {
        throw new Error("Your partner account is not currently eligible to accept deliveries.");
    }

    if (location.online !== true || location.available !== true) {
        throw new Error("You must be online and available to accept a delivery.");
    }

    if (!isPaymentEligible(delivery)) {
        throw new Error("This delivery is not yet eligible for partner assignment.");
    }

    if (delivery.partnerId) {
        throw new Error("This delivery has already been assigned.");
    }

    if (String(delivery.payer || "").toUpperCase() === "SENDER" && delivery.status !== "PAYMENT_CONFIRMED") {
        throw new Error("This delivery is not available for assignment.");
    }

    const latitude = normalizeNumber(location.latitude);
    const longitude = normalizeNumber(location.longitude);

    if (latitude === null || longitude === null) {
        throw new Error("Your current GPS coordinates are invalid.");
    }

    if (!isFreshTimestamp(location.lastUpdated)) {
        throw new Error("Your GPS location is too old. Please refresh your location.");
    }

    const pickupLatitude = normalizeNumber(delivery.pickup?.latitude);
    const pickupLongitude = normalizeNumber(delivery.pickup?.longitude);

    if (pickupLatitude === null || pickupLongitude === null) {
        throw new Error("This delivery does not have valid pickup coordinates.");
    }

    const distanceKm = calculateDistanceKm(
        latitude,
        longitude,
        pickupLatitude,
        pickupLongitude
    );

    if (distanceKm === null) {
        throw new Error("Unable to calculate your distance from the pickup location.");
    }

    const normalRadiusKm =
        NORMAL_RADII_KM[partner.role];

    if (!normalRadiusKm) {
        throw new Error("Your partner role is not eligible for delivery assignment.");
    }

    const operationalMaxRadiusKm = OPERATIONAL_MAX_RADII_KM[partner.role];

    if (distanceKm > operationalMaxRadiusKm) {
        throw new Error(
            `You are ${distanceKm.toFixed(2)} km from the pickup location. ` +
            `The maximum operational distance for this role is ${operationalMaxRadiusKm} km.`
        );
    }

    await db.runTransaction(async transaction => {
        const freshDeliverySnap = await transaction.get(deliveryRef);

        if (!freshDeliverySnap.exists) {
            throw new Error("Delivery was not found.");
        }

        const freshDelivery = freshDeliverySnap.data();

        if (freshDelivery.partnerId) {
            throw new Error("This delivery has already been assigned to another partner.");
        }

        const activeDeliveriesQuery = db.collection("deliveries")
            .where("partnerId", "==", partnerUid)
            .where("status", "in", [
                "PARTNER_ASSIGNED",
                "PICKED_UP",
                "IN_TRANSIT"
            ])
            .limit(1);

        const activeDeliveriesSnap =
            await transaction.get(activeDeliveriesQuery);

        if (!activeDeliveriesSnap.empty) {
            throw new Error(
                "You already have an active delivery. Complete it before accepting another delivery."
            );
        }

        if (!isPaymentEligible(freshDelivery)) {
            throw new Error("This delivery is not eligible for assignment.");
        }

        if (String(freshDelivery.payer || "").toUpperCase() === "SENDER" && freshDelivery.status !== "PAYMENT_CONFIRMED") {
            throw new Error("This delivery is no longer available for assignment.");
        }

        transaction.update(deliveryRef, {
            partnerId: partnerUid,
            partnerName:
                partner.fullName ||
                partner.name ||
                "Partner",
            vehicleInfo:
                partner.vehicleInfo ||
                null,
            partnerAccepted: true,
            partnerAcceptedAt:
                admin.firestore.FieldValue.serverTimestamp(),
            status: "PARTNER_ASSIGNED",
            updatedAt:
                admin.firestore.FieldValue.serverTimestamp()
        });
    });

    return {
        success: true,
        deliveryId,
        partnerId: partnerUid,
        distanceKm: Number(distanceKm.toFixed(2)),
        status: "PARTNER_ASSIGNED"
    };
}

async function getAvailableDeliveries(data, context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new Error("You must be logged in to view available deliveries.");
    }

    const partnerUid = context.auth.uid;

    const partnerRef =
        db.collection("users").doc(partnerUid);

    const locationRef =
        db.collection("partnerLocations").doc(partnerUid);

    const [partnerSnap, locationSnap] =
        await Promise.all([
            partnerRef.get(),
            locationRef.get()
        ]);

    if (!partnerSnap.exists) {
        throw new Error("Partner account was not found.");
    }

    if (!locationSnap.exists) {
        throw new Error("Your current location is not available.");
    }

    const partner = partnerSnap.data();
    const location = locationSnap.data();

    if (!isOperablePartner(partner)) {
        throw new Error(
            "Your partner account is not currently eligible for deliveries."
        );
    }

    if (location.role !== partner.role) {
        throw new Error(
            "Your location profile does not match your partner role."
        );
    }

    if (location.online !== true ||
        location.available !== true) {
        throw new Error(
            "You must be online and available to view available deliveries."
        );
    }

    if (!isFreshTimestamp(location.lastUpdated)) {
        throw new Error(
            "Your GPS location is too old. Please refresh your location."
        );
    }

    const latitude =
        normalizeNumber(location.latitude);

    const longitude =
        normalizeNumber(location.longitude);

    if (latitude === null ||
        longitude === null ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180) {
        throw new Error(
            "Your current GPS coordinates are invalid."
        );
    }

    const activeDeliveriesSnapshot =
        await db.collection("deliveries")
            .where("partnerId", "==", partnerUid)
            .where("status", "in", [
                "PARTNER_ASSIGNED",
                "PICKED_UP",
                "IN_TRANSIT"
            ])
            .limit(1)
            .get();

    if (!activeDeliveriesSnapshot.empty) {
        throw new Error(
            "You already have an active delivery."
        );
    }

    const normalRadiusKm =
        NORMAL_RADII_KM[partner.role];

    const operationalMaxRadiusKm =
        OPERATIONAL_MAX_RADII_KM[partner.role];

    if (!normalRadiusKm ||
        !operationalMaxRadiusKm) {
        throw new Error(
            "Your partner role is not eligible for delivery assignment."
        );
    }

    const deliveriesSnapshot =
        await db.collection("deliveries")
            .where("partnerId", "==", null)
            .where("status", "in", [
                "PAYMENT_CONFIRMED",
                "PAYMENT_PENDING"
            ])
            .limit(100)
            .get();

    const availableDeliveries = [];

    deliveriesSnapshot.forEach(doc => {
        const delivery = doc.data();

        if (delivery.partnerId) {
            return;
        }

        if (!isPaymentEligible(delivery)) {
            return;
        }

        const pickupLatitude =
            normalizeNumber(delivery.pickup?.latitude);

        const pickupLongitude =
            normalizeNumber(delivery.pickup?.longitude);

        if (pickupLatitude === null ||
            pickupLongitude === null) {
            return;
        }

        const distanceKm =
            calculateDistanceKm(
                latitude,
                longitude,
                pickupLatitude,
                pickupLongitude
            );

        if (distanceKm === null ||
            distanceKm > operationalMaxRadiusKm) {
            return;
        }

        const withinNormalRadius =
            distanceKm <= normalRadiusKm;

        availableDeliveries.push({
            deliveryId: doc.id,
            bookingReference:
                delivery.bookingReference || null,
            pickup: delivery.pickup || null,
            destination: delivery.destination || null,
            method: delivery.method || null,
            packageType: delivery.packageType || null,
            packageSize: delivery.packageSize || null,
            distanceKm:
                Number(distanceKm.toFixed(2)),
            radiusType:
                withinNormalRadius
                    ? "NORMAL_RADIUS"
                    : "EXTENDED_RADIUS",
            normalRadiusKm,
            operationalMaxRadiusKm,
            payer:
                String(
                    delivery.payer || ""
                ).toUpperCase(),
            customerPrice:
                delivery.customerPrice ?? null,
            paymentStatus:
                delivery.paymentStatus || null,
            status:
                delivery.status || null,
            createdAt:
                delivery.createdAt || null
        });
    });

    availableDeliveries.sort(
        (a, b) => {
            if (
                a.radiusType !==
                b.radiusType
            ) {
                return a.radiusType ===
                    "NORMAL_RADIUS"
                    ? -1
                    : 1;
            }

            return a.distanceKm -
                b.distanceKm;
        }
    );

    return {
        success: true,
        partnerId: partnerUid,
        role: partner.role,
        normalRadiusKm,
        operationalMaxRadiusKm,
        deliveryCount:
            availableDeliveries.length,
        deliveries:
            availableDeliveries
    };
}

module.exports = {
    acceptDelivery,
    getAvailableDeliveries,
    calculateDistanceKm
};
