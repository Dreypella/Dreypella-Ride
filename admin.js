// =====================================================
// DREYPELLA RIDE
// ADMIN DASHBOARD
// =====================================================


let currentAdmin = null;


// =====================================================
// AUTHENTICATION
// =====================================================

dreypellaAuth.onAuthStateChanged(

    async function (user) {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        try {

            const userDoc =

                await dreypellaDB

                    .collection("users")
                    .doc(user.uid)
                    .get();


            if (!userDoc.exists) {

                await dreypellaAuth.signOut();

                window.location.href =
                    "login.html";

                return;

            }


            const profile =
                userDoc.data();


            if (
                profile.role !== "ADMIN" &&
                profile.role !== "SUPER_ADMIN"
            ) {

                alert(
                    "You do not have administrator access."
                );

                await dreypellaAuth.signOut();

                window.location.href =
                    "login.html";

                return;

            }


            currentAdmin = {

                uid:
                    user.uid,

                ...profile

            };


            initializeAdmin();


        } catch (error) {

            console.error(error);

            alert(
                "Unable to verify administrator account."
            );

            await dreypellaAuth.signOut();

            window.location.href =
                "login.html";

        }

    }

);


// =====================================================
// INITIALIZE
// =====================================================

async function initializeAdmin() {

    setupNavigation();

    setupMobileMenu();

    setupLogout();

    setupRideModal();

    setupPricing();

    await loadDashboard();

    await loadPricing();

    await loadRides();

    await loadDeliveries();

    await loadUsers();

    await loadPartners();

    await loadVendors();

    await loadWithdrawals();

    await loadSupport();

    await loadFinance();

}


// =====================================================
// NAVIGATION
// =====================================================

function setupNavigation() {

    const buttons =
        document.querySelectorAll(
            ".nav-item"
        );


    buttons.forEach(

        function (button) {

            button.addEventListener(

                "click",

                function () {

                    const section =
                        button.dataset.section;

                    showSection(section);

                }

            );

        }

    );


    document
        .querySelectorAll(
            "[data-section-link]"
        )
        .forEach(

            function (button) {

                button.addEventListener(

                    "click",

                    function () {

                        showSection(
                            button.dataset.sectionLink
                        );

                    }

                );

            }

        );

}


function showSection(sectionId) {

    document
        .querySelectorAll(
            ".admin-section"
        )
        .forEach(

            function (section) {

                section.classList.remove(
                    "active"
                );

            }

        );


    const target =
        document.getElementById(
            sectionId
        );


    if (target) {

        target.classList.add(
            "active"
        );

    }


    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(

            function (button) {

                button.classList.toggle(

                    "active",

                    button.dataset.section ===
                    sectionId

                );

            }

        );


    document
        .getElementById(
            "sidebar"
        )
        .classList.remove(
            "open"
        );

}


// =====================================================
// MOBILE MENU
// =====================================================

function setupMobileMenu() {

    const menuButton =
        document.getElementById(
            "menuButton"
        );


    const sidebar =
        document.getElementById(
            "sidebar"
        );


    menuButton.addEventListener(

        "click",

        function () {

            sidebar.classList.toggle(
                "open"
            );

        }

    );

}


// =====================================================
// LOGOUT
// =====================================================

function setupLogout() {

    document
        .getElementById(
            "logoutButton"
        )
        .addEventListener(

            "click",

            async function () {

                await dreypellaAuth
                    .signOut();

                window.location.href =
                    "login.html";

            }

        );

}


// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard() {

    try {


        const usersSnapshot =

            await dreypellaDB
                .collection("users")
                .get();


        const ridesSnapshot =

            await dreypellaDB
                .collection("rides")
                .get();


        const deliveriesSnapshot =

            await dreypellaDB
                .collection("deliveries")
                .get();


        const vendorsSnapshot =

            await dreypellaDB
                .collection("vendors")
                .get();


        const withdrawalsSnapshot =

            await dreypellaDB
                .collection("withdrawals")
                .where(
                    "status",
                    "==",
                    "PENDING"
                )
                .get();


        const activeTripsSnapshot =

            await dreypellaDB
                .collection("rides")
                .where(
                    "status",
                    "==",
                    "ACTIVE"
                )
                .get();


        setText(
            "totalUsers",
            usersSnapshot.size
        );


        setText(
            "totalRides",
            ridesSnapshot.size
        );


        setText(
            "totalDeliveries",
            deliveriesSnapshot.size
        );


        setText(
            "totalVendors",
            vendorsSnapshot.size
        );


        setText(
            "pendingWithdrawals",
            withdrawalsSnapshot.size
        );


        setText(
            "activeTrips",
            activeTripsSnapshot.size
        );


        renderRecentRides(
            ridesSnapshot
        );


        renderRecentDeliveries(
            deliveriesSnapshot
        );


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }

}


// =====================================================
// RECENT RIDES
// =====================================================

function renderRecentRides(
    snapshot
) {

    const container =
        document.getElementById(
            "recentRides"
        );


    if (snapshot.empty) {

        container.innerHTML =
            "<p>No rides yet.</p>";

        return;

    }


    const rides =
        snapshot.docs
            .slice(0, 5)
            .map(
                doc => ({
                    id:
                        doc.id,

                    ...doc.data()
                })
            );


    container.innerHTML =
        rides.map(

            ride => `

                <div class="recent-item">

                    <strong>
                        ${escapeHTML(
                            ride.origin || "Unknown"
                        )}
                        →
                        ${escapeHTML(
                            ride.destination || "Unknown"
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            ride.status || "PENDING"
                        )}
                    </span>

                </div>

            `

        ).join("");

}


// =====================================================
// RECENT DELIVERIES
// =====================================================

function renderRecentDeliveries(
    snapshot
) {

    const container =
        document.getElementById(
            "recentDeliveries"
        );


    if (snapshot.empty) {

        container.innerHTML =
            "<p>No deliveries yet.</p>";

        return;

    }


    const deliveries =
        snapshot.docs
            .slice(0, 5)
            .map(
                doc => ({
                    id:
                        doc.id,

                    ...doc.data()
                })
            );


    container.innerHTML =
        deliveries.map(

            delivery => `

                <div class="recent-item">

                    <strong>
                        Delivery
                    </strong>

                    <span>
                        ${escapeHTML(
                            delivery.status ||
                            "PENDING"
                        )}
                    </span>

                </div>

            `

        ).join("");

}


// =====================================================
// PRICING
// =====================================================

async function loadPricing() {

    try {

        const snapshot =

            await dreypellaDB

                .collection("settings")
                .doc("pricing")
                .get();


        if (!snapshot.exists) {

            return;

        }


        const pricing =
            snapshot.data();


        setInput(
            "baseFare",
            pricing.baseFare
        );


        setInput(
            "pricePerKm",
            pricing.pricePerKm
        );


        setInput(
            "minimumDeliveryFee",
            pricing.minimumDeliveryFee
        );


        setInput(
            "maximumDeliveryFee",
            pricing.maximumDeliveryFee
        );


        setInput(
            "walkerDifference",
            pricing.walkerDifference
        );


        setInput(
            "mediumPackageFee",
            pricing.mediumPackageFee
        );


        setInput(
            "largePackageFee",
            pricing.largePackageFee
        );


        setInput(
            "extraWeightPerKg",
            pricing.extraWeightPerKg
        );


        setInput(
            "partnerPercentage",
            pricing.partnerPercentage
        );


        setInput(
            "platformPercentage",
            pricing.platformPercentage
        );


    } catch (error) {

        console.error(error);

    }

}


function setupPricing() {

    document
        .getElementById(
            "savePricing"
        )
        .addEventListener(

            "click",

            savePricing

        );

}


async function savePricing() {

    const pricing = {

        baseFare:
            numberInput("baseFare"),

        pricePerKm:
            numberInput("pricePerKm"),

        minimumDeliveryFee:
            numberInput("minimumDeliveryFee"),

        maximumDeliveryFee:
            numberInput("maximumDeliveryFee"),

        walkerDifference:
            numberInput("walkerDifference"),

        mediumPackageFee:
            numberInput("mediumPackageFee"),

        largePackageFee:
            numberInput("largePackageFee"),

        extraWeightPerKg:
            numberInput("extraWeightPerKg"),

        partnerPercentage:
            numberInput("partnerPercentage"),

        platformPercentage:
            numberInput("platformPercentage"),

        updatedAt:
            firebase.firestore
                .FieldValue
                .serverTimestamp(),

        updatedBy:
            currentAdmin.uid

    };


    const message =
        document.getElementById(
            "pricingMessage"
        );


    if (
        pricing.partnerPercentage +
        pricing.platformPercentage
        !==
        100
    ) {

        message.textContent =
            "Partner and Platform percentages must equal 100%.";

        message.style.color =
            "#E31B23";

        return;

    }


    if (
        pricing.walkerDifference < 100 ||
        pricing.walkerDifference > 200
    ) {

        message.textContent =
            "Walker difference should normally be between ₦100 and ₦200.";

        message.style.color =
            "#E31B23";

        return;

    }


    try {

        await dreypellaDB

            .collection("settings")
            .doc("pricing")

            .set(
                pricing,
                {
                    merge:
                        true
                }
            );


        await createAuditLog(

            "PRICING_UPDATED",

            "Admin updated delivery pricing."

        );


        message.textContent =
            "Pricing saved successfully.";

        message.style.color =
            "#16803C";


    } catch (error) {

        console.error(error);

        message.textContent =
            "Unable to save pricing.";

        message.style.color =
            "#E31B23";

    }

}


// =====================================================
// RIDE MANAGEMENT
// =====================================================

function setupRideModal() {

    const modal =
        document.getElementById(
            "rideModal"
        );


    document
        .getElementById(
            "addRideButton"
        )
        .addEventListener(

            "click",

            function () {

                modal.classList.add(
                    "show"
                );

            }

        );


    document
        .getElementById(
            "closeRideModal"
        )
        .addEventListener(

            "click",

            function () {

                modal.classList.remove(
                    "show"
                );

            }

        );


    document
        .getElementById(
            "rideForm"
        )
        .addEventListener(

            "submit",

            createRide

        );

}


async function createRide(
    event
) {

    event.preventDefault();


    const ride = {

        origin:
            getValue("rideOrigin"),

        destination:
            getValue("rideDestination"),

        meetingPoint:
            getValue("meetingPoint"),

        finalDestination:
            getValue("finalDestination"),

        departureDate:
            getValue("rideDate"),

        departureTime:
            getValue("rideTime"),

        price:
            numberInput("ridePrice"),

        availableSeats:
            numberInput("rideSeats"),

        bookedSeats:
            0,

        vehicleInfo:
            getValue("vehicleInfo"),

        status:
            "AVAILABLE",

        createdBy:
            currentAdmin.uid,

        createdAt:
            firebase.firestore
                .FieldValue
                .serverTimestamp()

    };


    const message =
        document.getElementById(
            "rideMessage"
        );


    try {


        await dreypellaDB

            .collection("rides")

            .add(ride);


        await createAuditLog(

            "RIDE_CREATED",

            `Ride created: ${ride.origin} to ${ride.destination}`

        );


        message.textContent =
            "Ride created successfully.";

        message.style.color =
            "#16803C";


        document
            .getElementById(
                "rideForm"
            )
            .reset();


        await loadRides();


        setTimeout(

            function () {

                document
                    .getElementById(
                        "rideModal"
                    )
                    .classList.remove(
                        "show"
                    );

            },

            1000

        );


    } catch (error) {

        console.error(error);

        message.textContent =
            "Unable to create ride.";

        message.style.color =
            "#E31B23";

    }

}


// =====================================================
// LOAD RIDES
// =====================================================

async function loadRides() {

    const container =
        document.getElementById(
            "ridesTable"
        );


    try {

        const snapshot =

            await dreypellaDB

                .collection("rides")
                .get();


        if (snapshot.empty) {

            container.innerHTML =
                "<p>No rides available.</p>";

            return;

        }


        const rows =
            snapshot.docs.map(

                doc => {

                    const ride =
                        doc.data();


                    return `

                        <tr>

                            <td>
                                ${escapeHTML(doc.id)}
                            </td>

                            <td>
                                ${escapeHTML(
                                    ride.origin || ""
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    ride.destination || ""
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    ride.meetingPoint || ""
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    ride.departureDate || ""
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    ride.departureTime || ""
                                )}
                            </td>

                            <td>
                                ₦${formatMoney(
                                    ride.price || 0
                                )}
                            </td>

                            <td>
                                ${ride.bookedSeats || 0}
                                /
                                ${ride.availableSeats || 0}
                            </td>

                            <td>
                                <span class="status active">
                                    ${escapeHTML(
                                        ride.status || ""
                                    )}
                                </span>
                            </td>

                        </tr>

                    `;

                }

            ).join("");


        container.innerHTML = `

            <table class="data-table">

                <thead>

                    <tr>

                        <th>ID</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Gathering Point</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Price</th>
                        <th>Seats</th>
                        <th>Status</th>

                    </tr>

                </thead>

                <tbody>

                    ${rows}

                </tbody>

            </table>

        `;


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "Unable to load rides.";

    }

}


// =====================================================
// LOAD DELIVERIES
// =====================================================

async function loadDeliveries() {

    const container =
        document.getElementById(
            "deliveriesTable"
        );


    try {

        const snapshot =

            await dreypellaDB

                .collection("deliveries")
                .get();


        if (snapshot.empty) {

            container.innerHTML =
                "<p>No deliveries yet.</p>";

            return;

        }


        container.innerHTML = `

            <table class="data-table">

                <thead>

                    <tr>

                        <th>ID</th>
                        <th>Customer</th>
                        <th>Pickup</th>
                        <th>Destination</th>
                        <th>Distance</th>
                        <th>Method</th>
                        <th>Status</th>

                    </tr>

                </thead>

                <tbody>

                    ${snapshot.docs.map(

                        doc => {

                            const data =
                                doc.data();


                            return `

                                <tr>

                                    <td>
                                        ${escapeHTML(doc.id)}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            data.customerName || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            data.pickupAddress || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            data.destinationAddress || ""
                                        )}
                                    </td>

                                    <td>
                                        ${
                                            data.distanceKm || 0
                                        } km
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            data.deliveryMethod || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            data.status || "PENDING"
                                        )}
                                    </td>

                                </tr>

                            `;

                        }

                    ).join("")}

                </tbody>

            </table>

        `;


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "Unable to load deliveries.";

    }

}


// =====================================================
// USERS
// =====================================================

async function loadUsers() {

    const container =
        document.getElementById(
            "usersTable"
        );


    try {

        const snapshot =

            await dreypellaDB
                .collection("users")
                .get();


        if (snapshot.empty) {

            container.innerHTML =
                "<p>No users found.</p>";

            return;

        }


        container.innerHTML = `

            <table class="data-table">

                <thead>

                    <tr>

                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Status</th>

                    </tr>

                </thead>

                <tbody>

                    ${snapshot.docs.map(

                        doc => {

                            const user =
                                doc.data();


                            return `

                                <tr>

                                    <td>
                                        ${escapeHTML(
                                            user.fullName || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            user.email || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            user.phone || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            user.role || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            user.accountStatus || ""
                                        )}
                                    </td>

                                </tr>

                            `;

                        }

                    ).join("")}

                </tbody>

            </table>

        `;


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "Unable to load users.";

    }

}


// =====================================================
// PARTNERS
// =====================================================

async function loadPartners() {

    const container =
        document.getElementById(
            "partnersTable"
        );


    try {

        const snapshot =

            await dreypellaDB

                .collection("users")

                .where(
                    "role",
                    "in",
                    [
                        "WALKER",
                        "RIDER",
                        "DRIVER"
                    ]
                )

                .get();


        if (snapshot.empty) {

            container.innerHTML =
                "<p>No partners found.</p>";

            return;

        }


        container.innerHTML = `

            <table class="data-table">

                <thead>

                    <tr>

                        <th>Name</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Verification</th>
                        <th>Status</th>

                    </tr>

                </thead>

                <tbody>

                    ${snapshot.docs.map(

                        doc => {

                            const partner =
                                doc.data();


                            return `

                                <tr>

                                    <td>
                                        ${escapeHTML(
                                            partner.fullName || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            partner.phone || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            partner.role || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            partner.verificationStatus || "PENDING"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            partner.accountStatus || ""
                                        )}
                                    </td>

                                </tr>

                            `;

                        }

                    ).join("")}

                </tbody>

            </table>

        `;


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "Unable to load partners.";

    }

}


// =====================================================
// VENDORS
// =====================================================

async function loadVendors() {

    const container =
        document.getElementById(
            "vendorsTable"
        );


    try {

        const snapshot =

            await dreypellaDB

                .collection("vendors")
                .get();


        if (snapshot.empty) {

            container.innerHTML =
                "<p>No vendors found.</p>";

            return;

        }


        container.innerHTML = `

            <table class="data-table">

                <thead>

                    <tr>

                        <th>Vendor</th>
                        <th>Shop</th>
                        <th>Phone</th>
                        <th>Status</th>

                    </tr>

                </thead>

                <tbody>

                    ${snapshot.docs.map(

                        doc => {

                            const vendor =
                                doc.data();


                            return `

                                <tr>

                                    <td>
                                        ${escapeHTML(
                                            vendor.ownerName || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            vendor.shopName || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            vendor.phone || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            vendor.status || "PENDING"
                                        )}
                                    </td>

                                </tr>

                            `;

                        }

                    ).join("")}

                </tbody>

            </table>

        `;


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "Unable to load vendors.";

    }

}


// =====================================================
// WITHDRAWALS
// =====================================================

async function loadWithdrawals() {

    const container =
        document.getElementById(
            "withdrawalsTable"
        );


    try {

        const snapshot =

            await dreypellaDB

                .collection("withdrawals")
                .get();


        if (snapshot.empty) {

            container.innerHTML =
                "<p>No withdrawal requests.</p>";

            return;

        }


        container.innerHTML = `

            <table class="data-table">

                <thead>

                    <tr>

                        <th>User</th>
                        <th>Amount</th>
                        <th>Bank</th>
                        <th>Account</th>
                        <th>Status</th>

                    </tr>

                </thead>

                <tbody>

                    ${snapshot.docs.map(

                        doc => {

                            const item =
                                doc.data();


                            return `

                                <tr>

                                    <td>
                                        ${escapeHTML(
                                            item.userName || item.userId || ""
                                        )}
                                    </td>

                                    <td>
                                        ₦${formatMoney(
                                            item.amount || 0
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            item.bankName || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            item.accountNumber || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            item.status || "PENDING"
                                        )}
                                    </td>

                                </tr>

                            `;

                        }

                    ).join("")}

                </tbody>

            </table>

        `;


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "Unable to load withdrawals.";

    }

}


// =====================================================
// SUPPORT
// =====================================================

async function loadSupport() {

    const container =
        document.getElementById(
            "supportTable"
        );


    try {

        const snapshot =

            await dreypellaDB

                .collection("supportTickets")
                .get();


        if (snapshot.empty) {

            container.innerHTML =
                "<p>No support tickets.</p>";

            return;

        }


        container.innerHTML = `

            <table class="data-table">

                <thead>

                    <tr>

                        <th>Ticket</th>
                        <th>Category</th>
                        <th>User</th>
                        <th>Status</th>

                    </tr>

                </thead>

                <tbody>

                    ${snapshot.docs.map(

                        doc => {

                            const ticket =
                                doc.data();


                            return `

                                <tr>

                                    <td>
                                        ${escapeHTML(doc.id)}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            ticket.category || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            ticket.userId || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            ticket.status || "OPEN"
                                        )}
                                    </td>

                                </tr>

                            `;

                        }

                    ).join("")}

                </tbody>

            </table>

        `;


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "Unable to load support tickets.";

    }

}


// =====================================================
// FINANCE
// =====================================================

async function loadFinance() {

    try {

        const snapshot =

            await dreypellaDB

                .collection(
                    "walletTransactions"
                )

                .get();


        let gross =
            0;

        let partner =
            0;

        let platform =
            0;


        snapshot.docs.forEach(

            doc => {

                const transaction =
                    doc.data();


                gross +=
                    Number(
                        transaction.grossAmount || 0
                    );


                partner +=
                    Number(
                        transaction.partnerAmount || 0
                    );


                platform +=
                    Number(
                        transaction.platformAmount || 0
                    );

            }

        );


        const expensesSnapshot =

            await dreypellaDB

                .collection("expenses")
                .get();


        let expenses =
            0;


        expensesSnapshot.docs.forEach(

            doc => {

                expenses +=
                    Number(
                        doc.data().amount || 0
                    );

            }

        );


        const net =

            platform -

            expenses;


        setText(
            "grossRevenue",
            "₦" + formatMoney(gross)
        );


        setText(
            "partnerPayouts",
            "₦" + formatMoney(partner)
        );


        setText(
            "platformRevenue",
            "₦" + formatMoney(platform)
        );


        setText(
            "expenses",
            "₦" + formatMoney(expenses)
        );


        setText(
            "netRevenue",
            "₦" + formatMoney(net)
        );


    } catch (error) {

        console.error(
            "Finance error:",
            error
        );

    }

}


// =====================================================
// AUDIT LOG
// =====================================================

async function createAuditLog(
    action,
    description
) {

    try {

        await dreypellaDB

            .collection(
                "auditLogs"
            )

            .add({

                action:
                    action,

                description:
                    description,

                adminId:
                    currentAdmin.uid,

                adminName:
                    currentAdmin.fullName || "",

                createdAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            });

    } catch (error) {

        console.error(
            "Audit log error:",
            error
        );

    }

}


// =====================================================
// HELPERS
// =====================================================

function getValue(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.value.trim()
        : "";

}


function numberInput(id) {

    const value =
        getValue(id);

    return Number(value || 0);

}


function setInput(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (
        element &&
        value !== undefined
    ) {

        element.value =
            value;

    }

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            value;

    }

}


function formatMoney(
    amount
) {

    return Number(
        amount || 0
    ).toLocaleString(
        "en-NG"
    );

}


function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}