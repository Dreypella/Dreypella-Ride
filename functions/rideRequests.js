const admin = require("firebase-admin");

const db = admin.firestore();

async function createCustomRideRequest(data, context) {

    if (!context.auth) {
        throw new Error(
            "You must be logged in to submit a ride request."
        );
    }

    const uid = context.auth.uid;

    const passengerName =
        String(data?.passengerName || "").trim();

    const passengerPhone =
        String(data?.passengerPhone || "").trim();

    const fromCity =
        String(data?.fromCity || "").trim();

    const toCity =
        String(data?.toCity || "").trim();

    const travelDate =
        String(data?.travelDate || "").trim();

    const preferredTime =
        String(data?.preferredTime || "").trim();

    const seats =
        Number(data?.seats);

    if (!passengerName) {
        throw new Error("Passenger name is required.");
    }

    if (!passengerPhone) {
        throw new Error("Passenger phone number is required.");
    }

    if (!fromCity) {
        throw new Error("Departure location is required.");
    }

    if (!toCity) {
        throw new Error("Destination is required.");
    }

    if (!travelDate) {
        throw new Error("Travel date is required.");
    }

    if (!preferredTime) {
        throw new Error("Preferred time is required.");
    }

    if (
        !Number.isInteger(seats) ||
        seats < 1 ||
        seats > 4
    ) {
        throw new Error(
            "The number of passengers must be between 1 and 4."
        );
    }

    const requestRef =
        db
            .collection("rideBookings")
            .doc();

    const bookingReference =
        typeof data?.bookingReference === "string" &&
        data.bookingReference.trim()
            ? data.bookingReference.trim()
            : "DR-" + requestRef.id;

    await requestRef.set({

        bookingReference,

        userId:
            uid,

        passengerName,

        passengerPhone,

        fromCity,

        toCity,

        travelDate,

        preferredTime,

        tripId:
            null,

        gatheringPoint:
            "",

        finalDestination:
            "",

        confirmedDeparture:
            null,

        seats,

        totalFare:
            null,

        status:
            "REQUESTED",

        paymentStatus:
            "WAITING_CONFIRMATION",

        requestType:
            "CUSTOM_REQUEST",

        createdAt:
            admin.firestore
                .FieldValue
                .serverTimestamp()

    });

    return {
        success:
            true,

        bookingId:
            requestRef.id,

        bookingReference,

        status:
            "REQUESTED",

        requestType:
            "CUSTOM_REQUEST"
    };
}

module.exports = {
    createCustomRideRequest
};
