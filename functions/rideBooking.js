const admin =
    require("firebase-admin");

const {
    db,
    generateTransactionReference
} =
    require("./walletHelpers");


/*
    =========================================
    CREATE SCHEDULED RIDE BOOKING
    =========================================

    Authoritative booking flow:

    Customer
        ↓
    createRideBooking
        ↓
    Validate trip
        ↓
    Validate group
        ↓
    Firestore transaction
        ├── verify availability
        ├── assign seats
        ├── reduce available seats
        └── create ride booking

    Seat numbers belong to the selected
    group/bus, never to the gathering point.
*/


async function createRideBooking(
    data,
    context
) {

    if (
        !context ||
        !context.auth
    ) {

        throw new Error(
            "You must be logged in."
        );

    }


    const uid =
        context.auth.uid;


    const booking =
        data || {};


    const tripId =
        String(
            booking.tripId ||
            ""
        ).trim();


    const groupId =
        String(
            booking.groupId ||
            ""
        ).trim();


    const passengerName =
        String(
            booking.passengerName ||
            ""
        ).trim();


    const passengerPhone =
        String(
            booking.passengerPhone ||
            ""
        ).trim();


    const requestedSeats =
        Number(
            booking.seats
        );


    if (!tripId) {

        throw new Error(
            "Ride trip is required."
        );

    }


    if (!passengerName) {

        throw new Error(
            "Passenger name is required."
        );

    }


    if (!passengerPhone) {

        throw new Error(
            "Passenger phone is required."
        );

    }


    if (
        !Number.isInteger(
            requestedSeats
        ) ||
        requestedSeats < 1 ||
        requestedSeats > 4
    ) {

        throw new Error(
            "Seat count must be between 1 and 4."
        );

    }


    const tripRef =
        db
            .collection("trips")
            .doc(tripId);


    const bookingRef =
        db
            .collection("rideBookings")
            .doc();


    const bookingReference =
        generateTransactionReference(
            "DR-RIDE"
        );


    const transactionResult =
        await db.runTransaction(
            async transaction => {

                const tripSnapshot =
                    await transaction.get(
                        tripRef
                    );


                if (
                    !tripSnapshot.exists
                ) {

                    throw new Error(
                        "The selected ride trip was not found."
                    );

                }


                const trip =
                    tripSnapshot.data();


                if (
                    trip.status !==
                    "AVAILABLE"
                ) {

                    throw new Error(
                        "This ride trip is not currently available."
                    );

                }


                /*
                    Support the new groups array.

                    During migration, a legacy trip
                    with no groups can still operate
                    through its existing single
                    gathering point / vehicle data.
                */

                let groups =
                    Array.isArray(
                        trip.groups
                    )
                        ? trip.groups.map(
                            group => ({
                                ...group
                            })
                        )
                        : [];


                if (
                    groups.length === 0
                ) {

                    groups = [
                        {
                            groupId:
                                "DEFAULT",
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
                            capacity:
                                Number(
                                    trip.capacity ||
                                    trip.availableSeats ||
                                    0
                                ),
                            availableSeats:
                                Number(
                                    trip.availableSeats ??
                                    trip.capacity ??
                                    0
                                ),
                            bookedSeatNumbers:
                                []
                        }
                    ];

                }


                /*
                    If the client has not supplied a
                    group yet, a trip containing exactly
                    one group may use that group.

                    Multiple-group trips must identify
                    the intended group explicitly.
                */

                let selectedGroupIndex =
                    -1;


                if (groupId) {

                    selectedGroupIndex =
                        groups.findIndex(
                            group =>
                                String(
                                    group.groupId ||
                                    ""
                                ) ===
                                groupId
                        );

                }
                else if (
                    groups.length === 1
                ) {

                    selectedGroupIndex =
                        0;

                }


                if (
                    selectedGroupIndex < 0
                ) {

                    throw new Error(
                        "Please select a valid gathering point and vehicle group."
                    );

                }


                const selectedGroup =
                    groups[
                        selectedGroupIndex
                    ];


                const capacity =
                    Number(
                        selectedGroup.capacity ??
                        selectedGroup.availableSeats ??
                        0
                    );


                const availableSeats =
                    Number(
                        selectedGroup.availableSeats ??
                        capacity
                    );


                if (
                    !Number.isInteger(
                        availableSeats
                    ) ||
                    availableSeats < requestedSeats
                ) {

                    throw new Error(
                        "There are not enough seats available in this group."
                    );

                }


                /*
                    Seat inventory.

                    Existing bookedSeatNumbers are
                    preserved. The lowest available
                    seat numbers are assigned first.
                */

                const bookedSeatNumbers =
                    Array.isArray(
                        selectedGroup.bookedSeatNumbers
                    )
                        ? selectedGroup.bookedSeatNumbers
                            .map(
                                number =>
                                    Number(number)
                            )
                            .filter(
                                number =>
                                    Number.isInteger(
                                        number
                                    ) &&
                                    number > 0
                            )
                        : [];


                const bookedSet =
                    new Set(
                        bookedSeatNumbers
                    );


                const assignedSeats =
                    [];


                for (
                    let seatNumber = 1;
                    seatNumber <= capacity;
                    seatNumber++
                ) {

                    if (
                        !bookedSet.has(
                            seatNumber
                        )
                    ) {

                        assignedSeats.push(
                            seatNumber
                        );

                        bookedSet.add(
                            seatNumber
                        );

                    }


                    if (
                        assignedSeats.length ===
                        requestedSeats
                    ) {

                        break;

                    }

                }


                if (
                    assignedSeats.length !==
                    requestedSeats
                ) {

                    throw new Error(
                        "The requested number of seats is no longer available."
                    );

                }


                const updatedGroup = {
                    ...selectedGroup,
                    groupId:
                        selectedGroup.groupId ||
                        "DEFAULT",
                    capacity,
                    availableSeats:
                        availableSeats -
                        requestedSeats,
                    bookedSeatNumbers:
                        Array.from(
                            bookedSet
                        ).sort(
                            (a, b) =>
                                a - b
                        )
                };


                groups[
                    selectedGroupIndex
                ] =
                    updatedGroup;


                const fare =
                    Number(
                        trip.fare ??
                        trip.price ??
                        0
                    );


                if (
                    !Number.isFinite(fare) ||
                    fare <= 0
                ) {

                    throw new Error(
                        "The selected ride does not have a valid fare."
                    );

                }


                const totalFare =
                    fare *
                    requestedSeats;


                const confirmedDeparture =
                    trip.departureTime ||
                    null;


                const gatheringPoint =
                    selectedGroup.gatheringPoint ||
                    selectedGroup.meetingPoint ||
                    trip.gatheringPoint ||
                    trip.meetingPoint ||
                    "";


                const vehicle =
                    selectedGroup.vehicle ||
                    trip.vehicle ||
                    "";


                const driverName =
                    selectedGroup.driverName ||
                    trip.driverName ||
                    "";


                const finalDestination =
                    trip.finalDestination ||
                    trip.toCity ||
                    trip.to ||
                    "";


                const bookingData = {

                    bookingReference,

                    userId:
                        uid,

                    passengerName,

                    passengerPhone,

                    fromCity:
                        trip.fromCity ||
                        trip.from ||
                        "",

                    toCity:
                        trip.toCity ||
                        trip.to ||
                        "",

                    travelDate:
                        trip.travelDate ||
                        trip.date ||
                        "",

                    preferredTime:
                        confirmedDeparture,

                    tripId,

                    groupId:
                        updatedGroup.groupId,

                    gatheringPoint,

                    finalDestination,

                    confirmedDeparture,

                    vehicle,

                    driverName,

                    seats:
                        requestedSeats,

                    assignedSeatNumbers:
                        assignedSeats,

                    farePerSeat:
                        fare,

                    totalFare,

                    status:
                        "PENDING_PAYMENT",

                    paymentStatus:
                        "UNPAID",

                    paymentMethod:
                        null,

                    requestType:
                        "SCHEDULED_TRIP",

                    createdAt:
                        admin.firestore
                            .FieldValue
                            .serverTimestamp(),

                    updatedAt:
                        admin.firestore
                            .FieldValue
                            .serverTimestamp()

                };


                transaction.update(
                    tripRef,
                    {
                        groups,

                        /*
                            Keep legacy aggregate
                            availability compatible.
                        */

                        availableSeats:
                            groups.reduce(
                                (
                                    total,
                                    group
                                ) =>
                                    total +
                                    Number(
                                        group.availableSeats ||
                                        0
                                    ),
                                0
                            ),

                        updatedAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp()
                    }
                );


                transaction.set(
                    bookingRef,
                    bookingData
                );


                return {
                    bookingId:
                        bookingRef.id,

                    bookingReference,

                    tripId,

                    groupId:
                        updatedGroup.groupId,

                    gatheringPoint,

                    assignedSeatNumbers:
                        assignedSeats,

                    farePerSeat:
                        fare,

                    totalFare,

                    status:
                        "PENDING_PAYMENT",

                    paymentStatus:
                        "UNPAID"
                };

            }
        );


    return {
        success:
            true,

        ...transactionResult
    };

}


module.exports = {
    createRideBooking
};
