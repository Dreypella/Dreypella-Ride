// ======================================================
// DREYPELLA RIDE
// FIREBASE CONFIGURATION
// ======================================================

const firebaseConfig = {

    apiKey: "AIzaSyD69oJCXOSKzFGQoaVZ9AvOskfQ3qk-Xw0",

    authDomain: "dreypella-ride-4.firebaseapp.com",

    projectId: "dreypella-ride-4",

    storageBucket: "dreypella-ride-4.firebasestorage.app",

    messagingSenderId: "",

    appId: "1:995249347781:web:7db42289920840c98424ac"

};


// ======================================================
// INITIALIZE FIREBASE
// ======================================================

if (!firebase.apps.length) {

    firebase.initializeApp(firebaseConfig);

}


// ======================================================
// FIREBASE SERVICES
// ======================================================

const dreypellaAuth = firebase.auth();

const dreypellaDB = firebase.firestore();

const dreypellaStorage = typeof firebase.storage === "function" ? firebase.storage() : null;