// =====================================================
// DREYPELLA RIDE
// LOGIN SYSTEM
// =====================================================


// =====================================================
// HTML ELEMENTS
// =====================================================

const loginForm =
    document.getElementById("loginForm");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const loginButton =
    document.getElementById("loginButton");

const loginMessage =
    document.getElementById("loginMessage");

const togglePassword =
    document.getElementById("togglePassword");


// =====================================================
// SHOW MESSAGE
// =====================================================

function showLoginMessage(
    message,
    type = "error"
) {

    loginMessage.textContent =
        message;

    loginMessage.className =
        "message show " + type;

}


// =====================================================
// CLEAR MESSAGE
// =====================================================

function clearLoginMessage() {

    loginMessage.textContent = "";

    loginMessage.className =
        "message";

}


// =====================================================
// SHOW / HIDE PASSWORD
// =====================================================

togglePassword.addEventListener(
    "click",
    function() {

        if (
            passwordInput.type ===
            "password"
        ) {

            passwordInput.type =
                "text";

            togglePassword.textContent =
                "Hide";

        } else {

            passwordInput.type =
                "password";

            togglePassword.textContent =
                "Show";

        }

    }
);


// =====================================================
// GET USER ROLE
// =====================================================

async function getUserRole(uid) {

    const userDocument =
        await dreypellaDB
            .collection("users")
            .doc(uid)
            .get();


    if (!userDocument.exists) {

        throw new Error(
            "USER_DOCUMENT_NOT_FOUND"
        );

    }


    const userData =
        userDocument.data();


    return userData.role;

}


// =====================================================
// ROLE REDIRECTION
// =====================================================

function redirectUser(role) {

    switch (role) {


        // ---------------------------------------------
        // CUSTOMER
        // ---------------------------------------------

        case "CUSTOMER":

            window.location.href =
                "customer-dashboard.html";

            break;


        // ---------------------------------------------
        // WALKER
        // ---------------------------------------------

        case "WALKER":

            window.location.href =
                "walker-dashboard.html";

            break;


        // ---------------------------------------------
        // RIDER
        // ---------------------------------------------

        case "RIDER":

            window.location.href =
                "rider-dashboard.html";

            break;


        // ---------------------------------------------
        // DRIVER
        // ---------------------------------------------

        case "DRIVER":

            window.location.href =
                "driver-dashboard.html";

            break;


        // ---------------------------------------------
        // VENDOR
        // ---------------------------------------------

        case "VENDOR":

            window.location.href =
                "vendor-dashboard.html";

            break;


        // ---------------------------------------------
        // AMBASSADOR
        // ---------------------------------------------

        case "AMBASSADOR":

            window.location.href =
                "ambassador-dashboard.html";

            break;


        // ---------------------------------------------
        // SUPPORT
        // ---------------------------------------------

        case "SUPPORT":

            window.location.href =
                "support-dashboard.html";

            break;


        // ---------------------------------------------
        // ADMIN
        // ---------------------------------------------

        case "ADMIN":

            window.location.href =
                "admin-dashboard.html";

            break;


        // ---------------------------------------------
        // SUPER ADMIN
        // ---------------------------------------------

        case "SUPER_ADMIN":

            window.location.href =
                "admin-dashboard.html";

            break;


        // ---------------------------------------------
        // UNKNOWN ROLE
        // ---------------------------------------------

        default:

            throw new Error(
                "UNKNOWN_USER_ROLE"
            );

    }

}


// =====================================================
// LOGIN
// =====================================================

loginForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        clearLoginMessage();


        const email =
            emailInput.value
                .trim()
                .toLowerCase();

        const password =
            passwordInput.value;


        // ---------------------------------------------
        // BASIC VALIDATION
        // ---------------------------------------------

        if (!email) {

            showLoginMessage(
                "Please enter your email address."
            );

            return;

        }


        if (!password) {

            showLoginMessage(
                "Please enter your password."
            );

            return;

        }


        // ---------------------------------------------
        // DISABLE BUTTON
        // ---------------------------------------------

        loginButton.disabled = true;

        loginButton.textContent =
            "LOGGING IN...";


        try {


            // =========================================
            // FIREBASE LOGIN
            // =========================================

            const userCredential =
                await dreypellaAuth
                    .signInWithEmailAndPassword(
                        email,
                        password
                    );


            const user =
                userCredential.user;


            // =========================================
            // REFRESH USER INFORMATION
            // =========================================

            await user.reload();


            // =========================================
            // EMAIL VERIFICATION
            // =========================================

            if (!user.emailVerified) {

                showLoginMessage(
                    "Please verify your email before continuing. Check your inbox for the verification email.",
                    "warning"
                );


                // Send another verification email

                try {

                    await user.sendEmailVerification();

                } catch (verificationError) {

                    console.log(
                        "Verification email:",
                        verificationError
                    );

                }


                await dreypellaAuth.signOut();


                return;

            }


            // =========================================
            // GET ROLE FROM FIRESTORE
            // =========================================

            const role =
                await getUserRole(
                    user.uid
                );


            console.log(
                "Logged in role:",
                role
            );


            // =========================================
            // REDIRECT
            // =========================================

            showLoginMessage(
                "Login successful. Opening your dashboard...",
                "success"
            );


            setTimeout(
                function() {

                    redirectUser(role);

                },
                500
            );


        }

        catch (error) {

            console.error(
                "Dreypella login error:",
                error
            );


            let message =
                "Unable to login. Please try again.";


            switch (error.code) {


                case "auth/invalid-email":

                    message =
                        "Please enter a valid email address.";

                    break;


                case "auth/user-not-found":

                    message =
                        "No Dreypella account was found with this email.";

                    break;


                case "auth/wrong-password":

                    message =
                        "Incorrect email or password.";

                    break;


                case "auth/invalid-credential":

                    message =
                        "Incorrect email or password.";

                    break;


                case "auth/user-disabled":

                    message =
                        "This account has been suspended. Please contact Dreypella Support.";

                    break;


                case "auth/too-many-requests":

                    message =
                        "Too many login attempts. Please wait a while and try again.";

                    break;


                case "auth/network-request-failed":

                    message =
                        "Network connection failed. Check your internet connection.";

                    break;

            }


            if (
                error.message ===
                "USER_DOCUMENT_NOT_FOUND"
            ) {

                message =
                    "Your account exists, but your Dreypella profile is missing. Please contact support.";

            }


            if (
                error.message ===
                "UNKNOWN_USER_ROLE"
            ) {

                message =
                    "Your account role has not been configured correctly. Please contact Dreypella Support.";

            }


            showLoginMessage(
                message,
                "error"
            );

        }


        finally {

            loginButton.disabled =
                false;

            loginButton.textContent =
                "LOGIN";

        }

    }
);