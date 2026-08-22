/* =========================================
   DREYPELLA RIDE
   CUSTOMER DASHBOARD
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =========================================
       FIREBASE CHECK
    ========================================= */

    if (typeof firebase === "undefined") {
        console.error("Firebase has not loaded.");
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();


    /* =========================================
       ELEMENTS
    ========================================= */

    const sidebar = document.getElementById("sidebar");
    const menuButton = document.getElementById("menuButton");
    const logoutButton = document.getElementById("logoutButton");

    const profileName = document.getElementById("profileName");
    const profileAvatar = document.getElementById("profileAvatar");

    const walletBalance = document.getElementById("walletBalance");
    const activeOrders = document.getElementById("activeOrders");
    const completedTrips = document.getElementById("completedTrips");

    const notificationCount =
        document.getElementById("notificationCount");

    const activeTripSection =
        document.getElementById("activeTripSection");

    const activeTripStatus =
        document.getElementById("activeTripStatus");

    const activePickup =
        document.getElementById("activePickup");

    const activeDestination =
        document.getElementById("activeDestination");

    const activityList =
        document.getElementById("activityList");


    /* =========================================
       MOBILE MENU
    ========================================= */

    if (menuButton) {

        menuButton.addEventListener("click", function () {

            sidebar.classList.toggle("open");

        });

    }


    /* =========================================
       CLOSE MOBILE MENU WHEN LINK IS CLICKED
    ========================================= */

    document.querySelectorAll(".nav-link").forEach(function (link) {

        link.addEventListener("click", function () {

            if (window.innerWidth <= 700) {
                sidebar.classList.remove("open");
            }

        });

    });


    /* =========================================
       AUTHENTICATION
    ========================================= */

    auth.onAuthStateChanged(async function (user) {

        if (!user) {

            window.location.href = "login.html";

            return;
        }


        console.log("Customer logged in:", user.uid);


        await loadUserProfile(user);

        await loadWallet(user);

        await loadNotifications(user);

        await loadOrders(user);

        await loadCompletedTrips(user);

        await loadRecentActivity(user);

        await loadActiveTrip(user);

    });


    /* =========================================
       USER PROFILE
    ========================================= */

    async function loadUserProfile(user) {

        try {

            const userDoc = await db
                .collection("users")
                .doc(user.uid)
                .get();


            let name = "Customer";


            if (userDoc.exists) {

                const data = userDoc.data();

                name =
                    data.fullName ||
                    data.name ||
                    user.displayName ||
                    "Customer";

            } else {

                name =
                    user.displayName ||
                    "Customer";

            }


            profileName.textContent = name;


            const firstLetter =
                name.charAt(0).toUpperCase();


            profileAvatar.textContent = firstLetter;


        } catch (error) {

            console.error(
                "Could not load user profile:",
                error
            );

        }

    }


    /* =========================================
       WALLET
    ========================================= */

    async function loadWallet(user) {

        try {

            const walletDoc = await db
                .collection("wallets")
                .doc(user.uid)
                .get();


            if (!walletDoc.exists) {

                walletBalance.textContent = "₦0.00";

                return;
            }


            const data = walletDoc.data();


            const balance =
                Number(data.availableBalance || 0);


            walletBalance.textContent =
                formatNaira(balance);


        } catch (error) {

            console.error(
                "Wallet loading error:",
                error
            );

            walletBalance.textContent = "₦0.00";

        }

    }


    /* =========================================
       NOTIFICATIONS
    ========================================= */

    async function loadNotifications(user) {

        try {

            const snapshot = await db
                .collection("notifications")
                .where("userId", "==", user.uid)
                .where("read", "==", false)
                .limit(20)
                .get();


            notificationCount.textContent =
                snapshot.size;


        } catch (error) {

            console.error(
                "Notification error:",
                error
            );

            notificationCount.textContent = "0";

        }

    }


    /* =========================================
       ACTIVE ORDERS
    ========================================= */

    async function loadOrders(user) {

        try {

            const snapshot = await db
                .collection("orders")
                .where("customerId", "==", user.uid)
                .where("status", "in", [
                    "PENDING",
                    "ACCEPTED",
                    "PREPARING",
                    "READY",
                    "OUT_FOR_DELIVERY"
                ])
                .get();


            activeOrders.textContent =
                snapshot.size;


        } catch (error) {

            console.error(
                "Orders error:",
                error
            );

            activeOrders.textContent = "0";

        }

    }


    /* =========================================
       COMPLETED TRIPS
    ========================================= */

    async function loadCompletedTrips(user) {

        try {

            const snapshot = await db
                .collection("rides")
                .where("customerId", "==", user.uid)
                .where("status", "==", "COMPLETED")
                .get();


            completedTrips.textContent =
                snapshot.size;


        } catch (error) {

            console.error(
                "Completed rides error:",
                error
            );

            completedTrips.textContent = "0";

        }

    }


    /* =========================================
       ACTIVE TRIP
    ========================================= */

    async function loadActiveTrip(user) {

        try {

            const snapshot = await db
                .collection("rides")
                .where("customerId", "==", user.uid)
                .where("status", "in", [
                    "REQUESTED",
                    "CONFIRMED",
                    "ASSIGNED",
                    "DRIVER_ARRIVING",
                    "STARTED",
                    "IN_PROGRESS"
                ])
                .limit(1)
                .get();


            if (snapshot.empty) {

                activeTripSection.style.display =
                    "none";

                return;
            }


            const doc = snapshot.docs[0];

            const data = doc.data();


            activeTripSection.style.display =
                "block";


            activeTripStatus.textContent =
                formatStatus(data.status);


            activePickup.textContent =
                data.pickupLocation ||
                data.pickupAddress ||
                "Pickup location";


            activeDestination.textContent =
                data.destination ||
                data.destinationAddress ||
                "Destination";


        } catch (error) {

            console.error(
                "Active trip error:",
                error
            );

            activeTripSection.style.display =
                "none";

        }

    }


    /* =========================================
       RECENT ACTIVITY
    ========================================= */

    async function loadRecentActivity(user) {

        try {

            const snapshot = await db
                .collection("walletTransactions")
                .where("userId", "==", user.uid)
                .orderBy("createdAt", "desc")
                .limit(5)
                .get();


            if (snapshot.empty) {

                showEmptyActivity();

                return;
            }


            activityList.innerHTML = "";


            snapshot.forEach(function (doc) {

                const data = doc.data();

                const amount =
                    Number(data.amount || 0);


                const item =
                    document.createElement("div");


                item.className =
                    "activity-item";


                item.innerHTML = `

                    <div class="activity-icon">
                        ${getTransactionIcon(data.type)}
                    </div>

                    <div class="activity-info">

                        <strong>
                            ${escapeHTML(
                                data.description ||
                                data.type ||
                                "Transaction"
                            )}
                        </strong>

                        <span>
                            ${formatDate(data.createdAt)}
                        </span>

                    </div>

                    <strong class="activity-amount">
                        ${formatNaira(amount)}
                    </strong>

                `;


                activityList.appendChild(item);

            });


        } catch (error) {

            console.error(
                "Activity error:",
                error
            );

            showEmptyActivity();

        }

    }


    /* =========================================
       EMPTY ACTIVITY
    ========================================= */

    function showEmptyActivity() {

        activityList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🧾
                </div>

                <h3>No recent activity</h3>

                <p>
                    Your rides, deliveries and orders
                    will appear here.
                </p>

            </div>

        `;

    }


    /* =========================================
       LOGOUT
    ========================================= */

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async function () {

                try {

                    await auth.signOut();

                    window.location.href =
                        "index.html";

                } catch (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                    alert(
                        "Unable to logout. Please try again."
                    );

                }

            }
        );

    }


    /* =========================================
       FORMAT NAIRA
    ========================================= */

    function formatNaira(amount) {

        return "₦" +
            Number(amount || 0).toLocaleString(
                "en-NG",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );

    }


    /* =========================================
       FORMAT STATUS
    ========================================= */

    function formatStatus(status) {

        if (!status) {
            return "Processing";
        }


        return status
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(/\b\w/g, function (letter) {
                return letter.toUpperCase();
            });

    }


    /* =========================================
       TRANSACTION ICON
    ========================================= */

    function getTransactionIcon(type) {

        if (!type) {
            return "₦";
        }


        const value =
            type.toLowerCase();


        if (value.includes("ride")) {
            return "🚐";
        }

        if (value.includes("delivery")) {
            return "📦";
        }

        if (value.includes("order")) {
            return "🛍";
        }

        if (value.includes("withdraw")) {
            return "💸";
        }

        if (value.includes("referral")) {
            return "🎁";
        }

        return "₦";

    }


    /* =========================================
       DATE FORMAT
    ========================================= */

    function formatDate(timestamp) {

        if (!timestamp) {
            return "Recently";
        }


        try {

            let date;


            if (
                timestamp.toDate &&
                typeof timestamp.toDate === "function"
            ) {

                date = timestamp.toDate();

            } else {

                date = new Date(timestamp);

            }


            return date.toLocaleDateString(
                "en-NG",
                {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                }
            );

        } catch (error) {

            return "Recently";

        }

    }


    /* =========================================
       ESCAPE HTML
    ========================================= */

    function escapeHTML(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }

});