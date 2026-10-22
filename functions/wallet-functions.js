const functions =
    require("firebase-functions");

const admin =
    require("firebase-admin");




const {

    createWallet,

    creditWallet,

    debitWallet

} = require("./wallet");


/*
    =========================================
    CREATE WALLET
    =========================================
*/

exports.createUserWallet =
    functions.https.onCall(
        async (
            data,
            context
        ) => {

            if (
                !context.auth
            ) {

                throw new functions
                    .https
                    .HttpsError(
                        "unauthenticated",
                        "Login required."
                    );

            }


            const userId =
                context.auth.uid;


            const walletType =
                data.walletType ||
                "CUSTOMER";


            const allowedTypes = [

                "CUSTOMER",

                "VENDOR",

                "RIDER",

                "WALKER",

                "DRIVER",

                "AMBASSADOR"

            ];


            if (
                !allowedTypes.includes(
                    walletType
                )
            ) {

                throw new functions
                    .https
                    .HttpsError(
                        "invalid-argument",
                        "Invalid wallet type."
                    );

            }


            const wallet =
                await createWallet(
                    userId,
                    walletType
                );


            return {

                success:
                    true,

                wallet:
                    wallet

            };

        }
    );


/*
    =========================================
    ADMIN-ONLY ADJUSTMENT
    =========================================
*/

exports.adminWalletAdjustment =
    functions.https.onCall(
        async (
            data,
            context
        ) => {

            if (
                !context.auth
            ) {

                throw new functions
                    .https
                    .HttpsError(
                        "unauthenticated",
                        "Login required."
                    );

            }


            /*
                Admin verification should
                ultimately come from your
                Firebase custom claims.
            */

            const userSnapshot =
                await admin
                    .firestore()
                    .collection("users")
                    .doc(
                        context.auth.uid
                    )
                    .get();


            if (
                !userSnapshot.exists ||
                userSnapshot.data().role !==
                    "ADMIN"
            ) {

                throw new functions
                    .https
                    .HttpsError(
                        "permission-denied",
                        "Admin access required."
                    );

            }


            const {

                targetUserId,

                amount,

                type,

                reason

            } = data;


            if (
                !targetUserId ||
                !amount ||
                !reason
            ) {

                throw new functions
                    .https
                    .HttpsError(
                        "invalid-argument",
                        "Incomplete adjustment information."
                    );

            }


            if (
                type === "CREDIT"
            ) {

                return creditWallet({

                    userId:
                        targetUserId,

                    amount:
                        amount,

                    category:
                        "ADJUSTMENT",

                    description:
                        reason,

                    metadata: {

                        performedBy:
                            context.auth.uid

                    }

                });

            }


            if (
                type === "DEBIT"
            ) {

                return debitWallet({

                    userId:
                        targetUserId,

                    amount:
                        amount,

                    category:
                        "ADJUSTMENT",

                    description:
                        reason,

                    metadata: {

                        performedBy:
                            context.auth.uid

                    }

                });

            }


            throw new functions
                .https
                .HttpsError(
                    "invalid-argument",
                    "Invalid adjustment type."
                );

        }
    );