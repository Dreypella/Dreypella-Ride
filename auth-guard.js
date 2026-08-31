/*
======================================================
DREYPELLA RIDE — GLOBAL AUTHENTICATION GUARD
======================================================
Public pages:
- login.html
- register.html
- forgot-password.html

Every other customer-facing page requires authentication.
======================================================
*/

(function () {
    "use strict";

    const PUBLIC_PAGES = [
        "index.html",
        "login.html",
        "register.html",
        "forgot-password.html",
        "contact.html",
    ];

    const currentPage =
        window.location.pathname.split("/").pop() || "index.html";

    if (PUBLIC_PAGES.includes(currentPage)) {
        return;
    }

    function redirectToLogin() {
        const returnUrl =
            window.location.pathname +
            window.location.search +
            window.location.hash;

        const loginUrl =
            "login.html?returnUrl=" +
            encodeURIComponent(returnUrl);

        window.location.replace(loginUrl);
    }

    function startAuthGuard() {
        if (
            typeof firebase === "undefined" ||
            !firebase.auth
        ) {
            console.error(
                "Dreypella authentication could not be initialized."
            );
            redirectToLogin();
            return;
        }

        const auth = firebase.auth();

        auth.onAuthStateChanged(function (user) {
            if (!user) {
                redirectToLogin();
                return;
            }

            document.documentElement.classList.add(
                "dreypella-authenticated"
            );
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startAuthGuard
        );
    } else {
        startAuthGuard();
    }
})();
