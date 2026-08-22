/*
    DREYPELLA RIDE
    FIREBASE DELIVERY CONNECTION
*/

if (
    !firebase.apps.length
) {

    firebase.initializeApp(
        firebaseConfig
    );

}

const db =
    firebase.firestore();

const auth =
    firebase.auth();


function getCurrentUser() {

    return auth.currentUser;

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