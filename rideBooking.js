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
        ├── verify permanent availability
        ├── assign temporary seats
        ├── create seat holds
        └── create pending ride booking

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

                  /*
                      Temporary seat holds use one
                      deterministic document per
                      trip/group/seat so concurrent
                      bookings cannot claim the same
                      temporarily held seat.
                  */
                  const seatHoldRefs = [];

                  const holdCollection =
                      db.collection("rideSeatHolds");

                  const holdKeyPrefix =
                      encodeURIComponent(tripId) +
                      "__" +
                      encodeURIComponent(
                          String(
                              selectedGroup.groupId ||
                              "DEFAULT"
                          )
                      );

                  for (
                      let seatNumber = 1;
                      seatNumber <= capacity;
                      seatNumber++
                  ) {

                      if (!bookedSet.has(seatNumber)) {
                          seatHoldRefs.push({
                              seatNumber,
                              ref:
                                  holdCollection.doc(
                                      holdKeyPrefix +
                                      "__" +
                                      seatNumber
                                  )
                          });
                      }


                  }

                  const seatHoldSnapshots = [];

                  for (
                      const hold of seatHoldRefs
                  ) {
                      seatHoldSnapshots.push({
                          ...hold,
                          snapshot:
                              await transaction.get(
                                  hold.ref
                              )
                      });
                  }


                  for (
                      const hold of seatHoldSnapshots
                  ) {

                      if (
                          assignedSeats.length >=
                          requestedSeats
                      ) {
                          break;
                      }

                      const holdData =
                          hold.snapshot.exists
                              ? hold.snapshot.data()
                              : null;

                      const expiresAt =
                          holdData &&
                          holdData.expiresAt
                              ? holdData.expiresAt.toDate
                                  ? holdData.expiresAt.toDate()
                                  : new Date(
                                      holdData.expiresAt
                                  )
                              : null;

                      const isActiveStatus =
                          holdData &&
                          (
                              holdData.status === "HELD" ||
                              holdData.status === "RESERVED"
                          );

                      const hasValidExpiry =
                          expiresAt &&
                          Number.isFinite(
                              expiresAt.getTime()
                          );

                      const isActiveHold =
                          isActiveStatus &&
                          hasValidExpiry &&
                          expiresAt.getTime() >
                              Date.now();

                      const isInvalidHoldRecord =
                          isActiveStatus &&
                          !hasValidExpiry;

                      if (
                          isActiveHold ||
                          isInvalidHoldRecord
                      ) {
                          continue;
                      }

                      assignedSeats.push(
                          hold.seatNumber
                      );
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
                          "DEFAULT"
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


                  const seatHoldExpiresAt =
                      new Date(
                          Date.now() + 10 * 60 * 1000
                      );

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

                  seatHoldExpiresAt:
                      admin.firestore.Timestamp.fromDate(
                          seatHoldExpiresAt
                      ),

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




                  for (
                      const seatNumber of assignedSeats
                  ) {

                      const hold =
                          seatHoldSnapshots.find(
                              item =>
                                  item.seatNumber ===
                                  seatNumber
                          );

                      if (!hold) {
                          throw new Error(
                              "Unable to create the seat hold."
                          );
                      }

                      transaction.set(
                          hold.ref,
                          {
                              bookingId:
                                  bookingRef.id,
                              tripId,
                              groupId:
                                  updatedGroup.groupId,
                              seatNumber,
                              userId: uid,
                              status: "HELD",
                              expiresAt:
                                  admin.firestore.Timestamp.fromDate(
                                      seatHoldExpiresAt
                                  ),
                              createdAt:
                                  admin.firestore.FieldValue.serverTimestamp(),
                              updatedAt:
                                  admin.firestore.FieldValue.serverTimestamp()
                          }
                      );
                  }

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
