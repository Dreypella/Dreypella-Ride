/*
    DREYPELLA RIDE
    CREATE DELIVERY IN FIRESTORE
*/


async function createDelivery(
    deliveryData
) {

    try {


        const user =
            firebase.auth().currentUser;


        /*
            User must be logged in.
        */

        if (!user) {

            throw new Error(
                "Please login before creating a delivery."
            );

        }


        /*
            Generate identifiers.
        */

        const deliveryId =
            generateDeliveryId();


        const bookingReference =
            generateBookingReference();


        /*
            Prepare Firestore document.
        */

        const delivery = {

            deliveryId:

                deliveryId,


            bookingReference:

                bookingReference,


            customerId:

                user.uid,


            customerEmail:

                user.email || "",


            payer:

                deliveryData.payer ||
                "SENDER",


            pickup: {

                name:
                    deliveryData.pickup?.name ||
                    "",

                address:
                    deliveryData.pickup?.address ||
                    "",

                latitude:
                    deliveryData.pickup?.latitude ||
                    null,

                longitude:
                    deliveryData.pickup?.longitude ||
                    null

            },


            destination: {

                name:
                    deliveryData.destination?.name ||
                    "",

                address:
                    deliveryData.destination?.address ||
                    "",

                latitude:
                    deliveryData.destination?.latitude ||
                    null,

                longitude:
                    deliveryData.destination?.longitude ||
                    null

            },


            method:

                deliveryData.method ||
                "RIDER",


            packageCategory:

                deliveryData.packageCategory ||
                "",


            packageDescription:

                deliveryData.packageDescription ||
                "",


            packageSize:

                deliveryData.packageSize ||
                "",


            packageWeight:

                Number(
                    deliveryData.packageWeight
                ) || 0,


            packageValue:

                Number(
                    deliveryData.packageValue
                ) || 0,


            recipientName:

                deliveryData.recipientName ||
                "",


            recipientPhone:

                deliveryData.recipientPhone ||
                "",


            deliveryInstructions:

                deliveryData.deliveryInstructions ||
                "",


            distanceKm:

                Number(
                    deliveryData.distanceKm
                ) || 0,


            estimatedTime:

                deliveryData.estimatedTime ||
                "",


            customerPrice:

                Number(
                    deliveryData.customerPrice
                ) || 0,


            /*
                Payment status.
            */

            paymentStatus:

                deliveryData.payer ===
                "RECEIVER"

                    ? "PAYMENT_PENDING"

                    : "PAYMENT_PENDING",


            /*
                Delivery status.
            */

            status:

                "PAYMENT_PENDING",


            /*
                No partner initially.
            */

            partnerId:

                null,


            partnerName:

                null,


            vehicleInfo:

                null,


            /*
                Tracking.
            */

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


            /*
                Security/verification.
            */

            pickupOtp:

                null,


            deliveryOtp:

                null,


            pickupVerified:

                false,


            deliveryVerified:

                false,


            /*
                Timestamps.
            */

            createdAt:

                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),


            updatedAt:

                firebase.firestore
                    .FieldValue
                    .serverTimestamp()

        };


        /*
            Save delivery.
        */

        await db
            .collection(
                "deliveries"
            )
            .doc(
                deliveryId
            )
            .set(
                delivery
            );


        /*
            Save local copy temporarily
            for the existing pages.
        */

        localStorage.setItem(

            "dreypellaDeliveryBooking",

            JSON.stringify({

                ...delivery,

                createdAt:
                    new Date()
                        .toISOString(),

                updatedAt:
                    new Date()
                        .toISOString()

            })

        );


        /*
            Return booking information.
        */

        return {

            success:
                true,

            deliveryId:
                deliveryId,

            bookingReference:
                bookingReference

        };


    } catch (error) {


        console.error(
            "Create delivery error:",
            error
        );


        return {

            success:
                false,

            message:
                error.message

        };

    }

}