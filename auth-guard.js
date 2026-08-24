(function () {
    "use strict";

    const PUBLIC_PAGES = [
        "index.html",
        "login.html",
        "register.html",
        "forgot-password.html"
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

        window.location.replace(
            "login.html?returnUrl=" +
            encodeURIComponent(returnUrl)
        );
    }

    function startAuthGuard() {
        if (
            typeof firebase === "undefined" ||
            typeof firebase.auth !== "function"
        ) {
            console.error("Dreypella: Firebase Auth is unavailable.");
            return;
        }

        const auth = firebase.auth();

        auth.onAuthStateChanged(function (user) {
            if (user) {
                document.documentElement.classList.add(
                    "dreypella-authenticated"
                );
            } else {
                redirectToLogin();
            }
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