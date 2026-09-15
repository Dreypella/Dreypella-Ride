const admin = require("firebase-admin");

const db = admin.firestore();

const ACTIVE_DELIVERY_STATUSES = [
    "PARTNER_ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT"
];

const PARTNER_ROLES = [
    "WALKER",
    "RIDER",
    "DRIVER"
];

const PARTNER_PERCENTAGE = 0.65;

function isOperablePartner(partner) {
    if (!partner) {
        return false;
    }

    if (!PARTNER_ROLES.includes(partner.role)) {
        return false;
    }

    if (
        partner.accountStatus &&
        String(partner.accountStatus).toUpperCase() !== "ACTIVE"
    ) {
        return false;
    }

    if (partner.suspended === true || partner.disabled === true) {
        return false;
    }

    return true;
}

async function completeDelivery(data, context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new Error("You must be logged in to complete a delivery.");
    }

    const partnerUid = context.auth.uid;
    const deliveryId = data && data.deliveryId;
    const deliveryOtp = data && data.deliveryOtp;

    if (
        typeof deliveryId !== "string" ||
        !deliveryId.trim()
    ) {
        throw new Error("A valid delivery ID is required.");
    }

    if (
        typeof deliveryOtp !== "string" ||
        !/^\d{6}$/.test(deliveryOtp.trim())
    ) {
        throw new Error("A valid 6-digit delivery OTP is required.");
    }

    const deliveryRef = db
        .collection("deliveries")
        .doc(deliveryId);

    const partnerRef = db
        .collection("users")
        .doc(partnerUid);

    const walletRef = db
        .collection("wallets")
        .doc(partnerUid);

    const earningsTransactionRef = db
        .collection("walletTransactions")
        .doc(`PARTNER_EARNINGS-${deliveryId}`);

    return db.runTransaction(async transaction => {
        const [
            deliverySnapshot,
            partnerSnapshot,
            walletSnapshot,
            earningsSnapshot
        ] = await Promise.all([
            transaction.get(deliveryRef),
            transaction.get(partnerRef),
            transaction.get(walletRef),
            transaction.get(earningsTransactionRef)
        ]);

        if (!deliverySnapshot.exists) {
            throw new Error("Delivery was not found.");
        }

        if (!partnerSnapshot.exists) {
            throw new Error("Partner account was not found.");
        }

        if (!walletSnapshot.exists) {
            throw new Error("Partner wallet does not exist.");
        }

        const delivery = deliverySnapshot.data();
        const partner = partnerSnapshot.data();
        const wallet = walletSnapshot.data();

        if (!isOperablePartner(partner)) {
            throw new Error(
                "Your partner account is not currently eligible to complete deliveries."
            );
        }

        if (delivery.partnerId !== partnerUid) {
            throw new Error(
                "You are not assigned to this delivery."
            );
        }

        if (
            !ACTIVE_DELIVERY_STATUSES.includes(
                String(delivery.status || "").toUpperCase()
            )
        ) {
            throw new Error(
                "This delivery is not in a completable state."
            );
        }

        if (
            typeof delivery.deliveryOtp !== "string" ||
            !/^\d{6}$/.test(delivery.deliveryOtp)
        ) {
            throw new Error(
                "This delivery does not have a valid delivery OTP."
            );
        }

        if (delivery.deliveryOtp !== deliveryOtp.trim()) {
            throw new Error("Incorrect delivery OTP.");
        }

        if (delivery.paymentStatus !== "PAID") {
            throw new Error(
                "Delivery payment has not been confirmed."
            );
        }

        const payer =
            String(delivery.payer || "").toUpperCase();

        const paymentMethod =
            String(delivery.paymentMethod || "").toUpperCase();

        const validSenderPayment =
            payer === "SENDER" &&
            delivery.paymentStatus === "PAID" &&
            ["WALLET", "PAYSTACK"].includes(paymentMethod);

        const validReceiverPayment =
            payer === "RECEIVER" &&
            delivery.deliveryType === "LOCAL" &&
            paymentMethod === "PAYSTACK" &&
            delivery.paymentStatus === "PAID";

        if (!validSenderPayment && !validReceiverPayment) {
            throw new Error(
                "Delivery payment confirmation is invalid."
            );
        }

        if (!delivery.paymentReference) {
            throw new Error(
                "Delivery payment could not be verified."
            );
        }

        if (earningsSnapshot.exists) {
            throw new Error(
                "Partner earnings have already been recorded for this delivery."
            );
        }

        const customerPrice = Number(delivery.customerPrice);

        if (
            !Number.isFinite(customerPrice) ||
            customerPrice <= 0
        ) {
            throw new Error(
                "Delivery has an invalid customer price."
            );
        }

        const partnerEarnings =
            Number(
                (customerPrice * PARTNER_PERCENTAGE).toFixed(2)
            );

        if (
            !Number.isFinite(partnerEarnings) ||
            partnerEarnings <= 0
        ) {
            throw new Error(
                "Unable to calculate partner earnings."
            );
        }

        const balanceBefore =
            Number(wallet.availableBalance || 0);

        const balanceAfter =
            balanceBefore + partnerEarnings;

        const lifetimeEarned =
            Number(wallet.lifetimeEarned || 0) +
            partnerEarnings;

        const now =
            admin.firestore.FieldValue.serverTimestamp();

        transaction.update(deliveryRef, {
            status: "DELIVERED",
            deliveryVerified: true,
            deliveryVerifiedAt: now,
            tracking: {
                ...(delivery.tracking || {}),
                active: false
            },
            deliveredAt: now,
            updatedAt: now
        });

        transaction.update(walletRef, {
            availableBalance: balanceAfter,
            lifetimeEarned,
            updatedAt: now
        });

        transaction.create(
            earningsTransactionRef,
            {
                transactionId:
                    earningsTransactionRef.id,
                userId: partnerUid,
                walletId: partnerUid,
                type: "CREDIT",
                category: "PARTNER_EARNINGS",
                amount: partnerEarnings,
                balanceBefore,
                balanceAfter,
                reference:
                    delivery.bookingReference ||
                    deliveryId,
                description:
                    "Partner earnings for completed delivery.",
                status: "COMPLETED",
                metadata: {
                    deliveryId,
                    bookingReference:
                        delivery.bookingReference || null,
                    customerPrice,
                    partnerPercentage:
                        PARTNER_PERCENTAGE * 100,
                    platformPercentage: 35,
                    paymentReference:
                        delivery.paymentReference
                },
                createdAt: now
            }
        );

        return {
            success: true,
            deliveryId,
            bookingReference:
                delivery.bookingReference || null,
            status: "DELIVERED",
            partnerEarnings,
            walletBalance: balanceAfter
        };
    });
}

module.exports = {
    completeDelivery
};
