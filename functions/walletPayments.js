const admin = require("firebase-admin");

const {

    db,

    money,

    generateTransactionReference,

    generateIdempotencyKey,

    assertPositiveAmount

} = require("./walletHelpers");



/*
    PAY WITH WALLET

    Supported:

    RIDE
    DELIVERY
    MARKETPLACE
*/


async function payWithWallet(data, context) {
    if (!context.auth) {
        throw new Error("You must be logged in.");
    }

    const uid = context.auth.uid;

    const paymentType = String(data.paymentType || "").toUpperCase();
    const amount = assertPositiveAmount(data.amount);
    const reference = String(data.reference || "").trim();
    const orderId = String(data.orderId || "").trim();
    const item = String(data.item || "").trim();

    const allowedTypes = ["RIDE", "DELIVERY", "MARKETPLACE"];

    if (!allowedTypes.includes(paymentType)) {
        throw new Error("Invalid payment type.");
    }

    if (!reference) {
        throw new Error("Payment reference is required.");
    }

    if (!orderId) {
        throw new Error("Order or booking ID is required.");
    }

    let collectionName;

    if (paymentType === "RIDE") {
        collectionName = "rideBookings";
    } else if (paymentType === "DELIVERY") {
        collectionName = "deliveries";
    } else {
        collectionName = "marketplaceOrders";
    }

    const idempotencyKey = generateIdempotencyKey(uid, reference);
    const transactionRef = db.collection("walletTransactions").doc(idempotencyKey);
    const walletRef = db.collection("wallets").doc(uid);
    const recordRef = db.collection(collectionName).doc(orderId);

    const result = await db.runTransaction(async transaction => {
        const existing = await transaction.get(transactionRef);

        if (existing.exists) {
            return {
                alreadyProcessed: true,
                data: existing.data()
            };
        }

        /*
            IMPORTANT:
            Read and validate the business record BEFORE touching
            the customer's wallet.
        */
        const recordSnapshot = await transaction.get(recordRef);

        if (!recordSnapshot.exists) {
            throw new Error(
                `Payment record not found: ${collectionName}/${orderId}`
            );
        }

        const record = recordSnapshot.data();

        const ownerId =
            record.userId ||
            record.customerId ||
            null;

        if (!ownerId || ownerId !== uid) {
            throw new Error("You cannot pay for this record.");
        }

        if (
            record.paymentStatus === "PAID" ||
            record.paymentStatus === "SUCCESS"
        ) {
            throw new Error("This record has already been paid.");
        }

        /*
            Make sure the amount being charged matches
            the authoritative price stored by the application.
        */
        let expectedAmount = 0;
        let priceLabel = "payment";

        if (paymentType === "RIDE") {
            expectedAmount = money(record.totalFare || 0);
            priceLabel = "ride fare";
        }
        else if (paymentType === "DELIVERY") {
            expectedAmount = money(record.customerPrice || 0);
            priceLabel = "delivery price";
        }
        else if (paymentType === "MARKETPLACE") {
            expectedAmount = money(record.total || 0);
            priceLabel = "marketplace order total";
        }

        if (expectedAmount <= 0) {
            throw new Error(
                `The ${priceLabel} is invalid.`
            );
        }

        if (money(amount) !== expectedAmount) {
            throw new Error(
                `Payment amount does not match the ${priceLabel}.`
            );
        }

        const walletSnapshot = await transaction.get(walletRef);

        if (!walletSnapshot.exists) {
            throw new Error("Wallet does not exist.");
        }

        const wallet = walletSnapshot.data();
        const balance = money(wallet.availableBalance || 0);

        if (balance < amount) {
            const shortfall =
                money(amount - balance);

            const error =
                new Error(
                    "Insufficient wallet balance."
                );

            error.code =
                "INSUFFICIENT_WALLET_BALANCE";

            error.shortfall =
                shortfall;

            error.walletBalance =
                balance;

            error.requiredAmount =
                amount;

            throw error;
        }

        /*
            RIDE SEAT HOLD CONVERSION
            -------------------------
            Wallet payment must convert the temporary seat holds
            into permanent booked seats inside this SAME transaction
            as the wallet debit and booking payment update.

            Delivery and marketplace payments do not use ride seats.
        */
        let rideSeatHoldRefs = [];

        if (paymentType === "RIDE") {
            const isPayOnDepartureReservation =
                record.status ===
                "RESERVED" &&
                record.paymentMethod ===
                "PAY_ON_DEPARTURE";

            if (
                record.status !==
                "PENDING_PAYMENT" &&
                !isPayOnDepartureReservation
            ) {
                throw new Error(
                    "This ride booking is no longer awaiting payment."
                );
            }

            const tripId =
                String(
                    record.tripId ||
                    ""
                ).trim();

            const groupId =
                String(
                    record.groupId ||
                    ""
                ).trim();

            const assignedSeatNumbers =
                Array.isArray(
                    record.assignedSeatNumbers
                )
                    ? record.assignedSeatNumbers
                        .map(
                            seat =>
                                Number(seat)
                        )
                        .filter(
                            Number.isInteger
                        )
                    : [];

            const requestedSeats =
                Number(
                    record.seats
                );

            if (
                !tripId ||
                !groupId ||
                !Number.isInteger(
                    requestedSeats
                ) ||
                requestedSeats < 1 ||
                requestedSeats > 4 ||
                assignedSeatNumbers.length !==
                    requestedSeats ||
                new Set(
                    assignedSeatNumbers
                ).size !==
                    assignedSeatNumbers.length
            ) {
                throw new Error(
                    "Ride booking seat information is invalid."
                );
            }

            const tripRef =
                db
                    .collection("trips")
                    .doc(tripId);

            const tripSnapshot =
                await transaction.get(
                    tripRef
                );

            if (!tripSnapshot.exists) {
                throw new Error(
                    "Ride trip not found."
                );
            }

            const trip =
                tripSnapshot.data();

            if (
                isPayOnDepartureReservation
            ) {
                if (
                    trip.status !==
                    "AVAILABLE"
                ) {
                    throw new Error(
                        "This Pay on Departure reservation can no longer be paid because the trip has started."
                    );
                }

                const departureDate =
                    trip.departureTime &&
                    typeof trip.departureTime.toDate ===
                        "function"
                        ? trip.departureTime.toDate()
                        : new Date(
                            trip.departureTime ||
                            ""
                        );

                if (
                    !Number.isFinite(
                        departureDate.getTime()
                    ) ||
                    departureDate.getTime() <=
                        Date.now()
                ) {
                    throw new Error(
                        "This Pay on Departure reservation can no longer be paid because the trip has reached its departure time."
                    );
                }
            }

            if (
                !Array.isArray(
                    trip.groups
                )
            ) {
                throw new Error(
                    "Ride trip group information is invalid."
                );
            }

            const groupIndex =
                trip.groups.findIndex(
                    group =>
                        String(
                            group?.groupId ||
                            ""
                        ).trim() ===
                        groupId
                );

            if (
                groupIndex < 0
            ) {
                throw new Error(
                    "Selected ride group was not found."
                );
            }

            const selectedGroup =
                trip.groups[groupIndex];

            const capacity =
                Number(
                    selectedGroup.capacity
                );

            if (
                !Number.isInteger(
                    capacity
                ) ||
                capacity < 1
            ) {
                throw new Error(
                    "Ride group capacity is invalid."
                );
            }

            const rawBookedSeatNumbers =
                Array.isArray(
                    selectedGroup.bookedSeatNumbers
                )
                    ? selectedGroup.bookedSeatNumbers
                    : [];

            const bookedSeatNumbers =
                rawBookedSeatNumbers.map(
                    seat =>
                        Number(seat)
                );

            if (
                bookedSeatNumbers.some(
                    seat =>
                        !Number.isInteger(seat) ||
                        seat < 1 ||
                        seat > capacity
                )
            ) {
                throw new Error(
                    "Stored booked ride seat data is invalid."
                );
            }

            const bookedSet =
                new Set(
                    bookedSeatNumbers
                );

            if (
                bookedSet.size !==
                bookedSeatNumbers.length
            ) {
                throw new Error(
                    "Stored booked ride seat data contains duplicates."
                );
            }

            for (
                const seatNumber
                of assignedSeatNumbers
            ) {
                if (
                    seatNumber < 1 ||
                    seatNumber > capacity
                ) {
                    throw new Error(
                        "A booked ride seat is outside the group capacity."
                    );
                }

                if (
                    bookedSet.has(
                        seatNumber
                    )
                ) {
                    throw new Error(
                        "One or more selected ride seats are already booked."
                    );
                }
            }

            const holdCollection =
                db.collection(
                    "rideSeatHolds"
                );

            const holdKeyPrefix =
                encodeURIComponent(
                    tripId
                ) +
                "__" +
                encodeURIComponent(
                    groupId
                );

            const now =
                admin.firestore.Timestamp.now();

            for (
                const seatNumber
                of assignedSeatNumbers
            ) {
                const holdRef =
                    holdCollection.doc(
                        holdKeyPrefix +
                        "__" +
                        seatNumber
                    );

                const holdSnapshot =
                    await transaction.get(
                        holdRef
                    );

                if (
                    !holdSnapshot.exists
                ) {
                    throw new Error(
                        "One or more ride seat holds are missing or have expired."
                    );
                }

                const hold =
                    holdSnapshot.data();

                const expiresAt =
                    hold.expiresAt;

                const expectedHoldStatus =
                    isPayOnDepartureReservation
                        ? "RESERVED"
                        : "HELD";

                if (
                    hold.status !==
                    expectedHoldStatus ||
                    String(
                        hold.bookingId ||
                        ""
                    ) !==
                    orderId ||
                    String(
                        hold.userId ||
                        ""
                    ) !==
                    uid ||
                    String(
                        hold.tripId ||
                        ""
                    ) !==
                    tripId ||
                    String(
                        hold.groupId ||
                        ""
                    ) !==
                    groupId ||
                    Number(
                        hold.seatNumber
                    ) !==
                    seatNumber ||
                    !expiresAt ||
                    typeof expiresAt.toMillis !==
                        "function" ||
                    expiresAt.toMillis() <=
                        now.toMillis()
                ) {
                    throw new Error(
                        "One or more ride seat holds are invalid or have expired."
                    );
                }

                rideSeatHoldRefs.push(
                    holdRef
                );
            }

            const updatedBookedSeatNumbers =
                Array.from(
                    new Set([
                        ...bookedSeatNumbers,
                        ...assignedSeatNumbers
                    ])
                ).sort(
                    (a, b) =>
                        a - b
                );

            const updatedGroup = {
                ...selectedGroup,
                bookedSeatNumbers:
                    updatedBookedSeatNumbers,
                availableSeats:
                    capacity -
                    updatedBookedSeatNumbers.length
            };

            const updatedGroups =
                trip.groups.map(
                    (group, index) =>
                        index === groupIndex
                            ? updatedGroup
                            : group
                );

            const tripAvailableSeats =
                updatedGroups.reduce(
                    (total, group) => {
                        const groupCapacity =
                            Number(
                                group.capacity
                            );

                        const groupBooked =
                            Array.isArray(
                                group.bookedSeatNumbers
                            )
                                ? group.bookedSeatNumbers
                                    .map(
                                        seat =>
                                            Number(seat)
                                    )
                                    .filter(
                                        Number.isInteger
                                    ).length
                                : 0;

                        const groupAvailable =
                            groupCapacity -
                            groupBooked;

                        return (
                            total +
                            Math.max(
                                0,
                                groupAvailable
                            )
                        );
                    },
                    0
                );

            transaction.update(
                tripRef,
                {
                    groups:
                        updatedGroups,
                    availableSeats:
                        tripAvailableSeats,
                    updatedAt:
                        admin.firestore.FieldValue.serverTimestamp()
                }
            );

            for (
                const holdRef
                of rideSeatHoldRefs
            ) {
                transaction.delete(
                    holdRef
                );
            }
        }

        const newBalance = money(balance - amount);
        const transactionId = generateTransactionReference("DR-PAY");

        /*
            All transaction reads must be completed before any
            transaction write. The wallet debit, ride seat
            confirmation, and payment record update remain atomic.
        */
        transaction.set(transactionRef, {
            transactionId,
            userId: uid,
            type: "PAYMENT",
            paymentType,
            amount,
            direction: "DEBIT",
            status: "SUCCESS",
            reference,
            orderId,
            bookingId: paymentType === "RIDE" ? orderId : null,
            item,
            description: `${priceLabel} - ${orderId}`,
            balanceBefore: balance,
            balanceAfter: newBalance,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        transaction.update(walletRef, {
            availableBalance: newBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        /*
            Mark the actual business record paid inside the SAME
            Firestore transaction as the wallet debit and, for rides,
            the permanent seat assignment.
        */
        const paymentUpdate = {
            paymentStatus: "PAID",
            paymentMethod: "WALLET",
            paidAmount: amount,
            paymentReference: reference,
            walletTransactionId: transactionId,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (paymentType === "RIDE") {
            paymentUpdate.status = "CONFIRMED";
        }
        else if (paymentType === "DELIVERY") {
            paymentUpdate.status = "PAYMENT_CONFIRMED";
        }
        else {
            paymentUpdate.orderStatus = "CONFIRMED";
        }

        transaction.update(recordRef, paymentUpdate);

        return {
            alreadyProcessed: false,
            transactionId,
            newBalance
        };
    });

    return {
        success: true,
        transactionId:
            result.transactionId ||
            result.data?.transactionId,
        amount,
        status: "SUCCESS"
    };
}

module.exports = {

    payWithWallet

};