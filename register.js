// ======================================================
// DREYPELLA RIDE
// REGISTRATION SYSTEM
// ======================================================


// ======================================================
// HTML ELEMENTS
// ======================================================

const registerForm =
    document.getElementById("registerForm");

const fullNameInput =
    document.getElementById("fullName");

const emailInput =
    document.getElementById("email");

const phoneInput =
    document.getElementById("phone");

const passwordInput =
    document.getElementById("password");

const roleInput =
    document.getElementById("role");

const referralInput =
    document.getElementById("referralCode");

const registerButton =
    document.getElementById("registerButton");

const registerMessage =
    document.getElementById("registerMessage");


// ======================================================
// MESSAGE
// ======================================================

function showMessage(message, type) {

    registerMessage.textContent = message;

    registerMessage.className = "";

    if (type) {

        registerMessage.classList.add(type);

    }

}


// ======================================================
// PHONE NUMBER
// ======================================================

function normalizePhone(phone) {

    phone = phone.trim();


    // 08012345678
    // becomes
    // +2348012345678

    if (phone.startsWith("0")) {

        return "+234" + phone.substring(1);

    }


    // 2348012345678
    // becomes
    // +2348012345678

    if (phone.startsWith("234")) {

        return "+" + phone;

    }


    return phone;

}


// ======================================================
// FORM VALIDATION
// ======================================================

function validateForm() {

    const name =
        fullNameInput.value.trim();

    const email =
        emailInput.value.trim();

    const phone =
        phoneInput.value.trim();

    const password =
        passwordInput.value;

    const role =
        roleInput.value;


    if (name.length < 3) {

        showMessage(
            "Please enter your full name.",
            "error"
        );

        return false;

    }


    if (!email) {

        showMessage(
            "Please enter your email address.",
            "error"
        );

        return false;

    }


    if (!phone) {

        showMessage(
            "Please enter your phone number.",
            "error"
        );

        return false;

    }


    if (password.length < 6) {

        showMessage(
            "Password must contain at least 6 characters.",
            "error"
        );

        return false;

    }


    if (!role) {

        showMessage(
            "Please select an account type.",
            "error"
        );

        return false;

    }


    return true;

}


// ======================================================
// REGISTER USER
// ======================================================

registerForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        // ----------------------------------------------
        // VALIDATE
        // ----------------------------------------------

        if (!validateForm()) {

            return;

        }


        // ----------------------------------------------
        // GET FORM DATA
        // ----------------------------------------------

        const fullName =
            fullNameInput.value.trim();

        const email =
            emailInput.value
                .trim()
                .toLowerCase();

        const phone =
            normalizePhone(
                phoneInput.value
            );

        const password =
            passwordInput.value;

        const role =
            roleInput.value;

        const referralCode =
            referralInput.value
                .trim()
                .toUpperCase();


        // ----------------------------------------------
        // DISABLE BUTTON
        // ----------------------------------------------

        registerButton.disabled = true;

        registerButton.textContent =
            "CREATING ACCOUNT...";


        try {

            // ==========================================
            // 1. CREATE FIREBASE AUTH ACCOUNT
            // ==========================================

            const userCredential =
                await dreypellaAuth
                    .createUserWithEmailAndPassword(
                        email,
                        password
                    );


            const user =
                userCredential.user;

            const uid =
                user.uid;


            console.log(
                "Dreypella User UID:",
                uid
            );


            // ==========================================
            // 2. CREATE USER DOCUMENT
            // ==========================================

            await dreypellaDB
                .collection("users")
                .doc(uid)
                .set({

                    uid: uid,

                    name: fullName,

                    email: email,

                    phone: phone,

                    role: role,

                    referralCode:
                        referralCode || null,

                    accountStatus: "ACTIVE",

                    verificationStatus:
                        "UNVERIFIED",

                    emailVerified: false,

                    phoneVerified: false,

                    profileCompleted: false,

                    createdAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp(),

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()

                });


            // ==========================================
            // 3. CREATE USER WALLET
            // ==========================================

            await dreypellaDB
                .collection("wallets")
                .doc(uid)
                .set({

                    userId: uid,

                    availableBalance: 0,

                    pendingBalance: 0,

                    totalEarnings: 0,

                    totalSpent: 0,

                    withdrawableBalance: 0,

                    currency: "NGN",

                    status: "ACTIVE",

                    createdAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp(),

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()

                });


            // ==========================================
            // 4. CREATE REFERRAL RECORD
            // ==========================================

            if (referralCode) {

                await dreypellaDB
                    .collection("referrals")
                    .add({

                        referredUserId: uid,

                        referralCode:
                            referralCode,

                        referredRole: role,

                        status: "PENDING",

                        createdAt:
                            firebase.firestore
                                .FieldValue
                                .serverTimestamp(),

                        updatedAt:
                            firebase.firestore
                                .FieldValue
                                .serverTimestamp()

                    });

            }


            // ==========================================
            // 5. SEND EMAIL VERIFICATION
            // ==========================================

            await user.sendEmailVerification();


            // ==========================================
            // 6. SUCCESS
            // ==========================================

            showMessage(
                "Account created successfully. Please check your email to verify your account.",
                "success"
            );


            // Clear password
            passwordInput.value = "";


            // ==========================================
            // 7. GO TO LOGIN
            // ==========================================

            setTimeout(
                function() {

                    window.location.href =
                        "login.html";

                },
                3000
            );


        }

        catch (error) {

            console.error(
                "Dreypella registration error:",
                error
            );


            let message =
                "Unable to create your account. Please try again.";


            switch (error.code) {

                case "auth/email-already-in-use":

                    message =
                        "This email already has an account.";

                    break;


                case "auth/invalid-email":

                    message =
                        "Please enter a valid email address.";

                    break;


                case "auth/weak-password":

                    message =
                        "Password must contain at least 6 characters.";

                    break;


                case "auth/operation-not-allowed":

                    message =
                        "Email/password authentication is not enabled in Firebase.";

                    break;


                case "auth/network-request-failed":

                    message =
                        "Network connection failed. Check your internet.";

                    break;


                case "permission-denied":

                    message =
                        "Firestore permission denied. Check your Firestore rules.";

                    break;

            }


            showMessage(
                message,
                "error"
            );

        }


        finally {

            registerButton.disabled = false;

            registerButton.textContent =
                "CREATE ACCOUNT";

        }

    }
);