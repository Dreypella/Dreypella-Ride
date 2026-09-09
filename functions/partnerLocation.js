const admin = require("firebase-admin");

const db = admin.firestore();

const ALLOWED_ROLES = ["WALKER", "RIDER", "DRIVER"];

function normalizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

async function updatePartnerLocation(data, context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new Error("You must be logged in.");
    }

    const uid = context.auth.uid;

    const partnerRef = db.collection("users").doc(uid);
    const locationRef = db.collection("partnerLocations").doc(uid);

    const partnerSnap = await partnerRef.get();

    if (!partnerSnap.exists) {
        throw new Error("Partner account was not found.");
    }

    const partner = partnerSnap.data();

    if (!ALLOWED_ROLES.includes(partner.role)) {
        throw new Error("Only delivery partners can update delivery availability.");
    }

    if (
        partner.accountStatus &&
        String(partner.accountStatus).toUpperCase() !== "ACTIVE"
    ) {
        throw new Error("Your partner account is not currently active.");
    }

    if (partner.suspended === true || partner.disabled === true) {
        throw new Error("Your partner account is not currently operational.");
    }

    const online = data?.online === true;
    const available = online && data?.available === true;

    const latitude = normalizeNumber(data?.latitude);
    const longitude = normalizeNumber(data?.longitude);
    const accuracy = normalizeNumber(data?.accuracy);

    if (online) {
        if (latitude === null || longitude === null) {
            throw new Error("A valid GPS location is required while online.");
        }

        if (latitude < -90 || latitude > 90) {
            throw new Error("Invalid latitude.");
        }

        if (longitude < -180 || longitude > 180) {
            throw new Error("Invalid longitude.");
        }
    }

    if (!online) {
        await locationRef.set({
            partnerId: uid,
            role: partner.role,
            online: false,
            available: false,
            latitude: null,
            longitude: null,
            accuracy: null,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return {
            success: true,
            online: false,
            available: false
        };
    }

    const activeSnapshot = await db.collection("deliveries")
        .where("partnerId", "==", uid)
        .where("status", "in", [
            "PARTNER_ASSIGNED",
            "PICKED_UP",
            "IN_TRANSIT"
        ])
        .limit(1)
        .get();

    const hasActiveDelivery = !activeSnapshot.empty;
    const effectiveAvailable = available && !hasActiveDelivery;

    await locationRef.set({
        partnerId: uid,
        role: partner.role,
        online: true,
        available: effectiveAvailable,
        latitude,
        longitude,
        accuracy,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return {
        success: true,
        online: true,
        available: effectiveAvailable,
        activeDelivery: hasActiveDelivery
    };
}

module.exports = {
    updatePartnerLocation
};
