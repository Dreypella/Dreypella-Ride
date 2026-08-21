/*
====================================================
 DREYPELLA RIDE
 VENDOR DASHBOARD
====================================================

 Firebase collections expected:

 vendors
 products
 orders

 Vendor document example:

 vendors/{vendorId}

 {
     userId: "...",
     storeName: "...",
     email: "...",
     phone: "...",
     category: "...",
     status: "APPROVED",
     createdAt: ...
 }

 Product example:

 products/{productId}

 {
     vendorId: "...",
     name: "...",
     category: "...",
     price: 10000,
     customerPrice: 10500,
     platformFee: 500,
     platformFeeRate: 0.05,
     active: true,
     imageUrl: "...",
     createdAt: ...
 }

 Order example:

 orders/{orderId}

 {
     vendorId: "...",
     customerId: "...",
     totalAmount: 10500,
     vendorAmount: 10000,
     platformFee: 500,
     status: "PENDING",
     createdAt: ...
 }

====================================================
*/


/* =========================================
   FIREBASE
========================================= */

const auth =
    firebase.auth();

const db =
    firebase.firestore();


/* =========================================
   ELEMENTS
========================================= */

const vendorAvatar =
    document.getElementById(
        "vendorAvatar"
    );

const sidebarVendorName =
    document.getElementById(
        "sidebarVendorName"
    );

const storeName =
    document.getElementById(
        "storeName"
    );

const vendorEmail =
    document.getElementById(
        "vendorEmail"
    );

const storeStatus =
    document.getElementById(
        "storeStatus"
    );

const totalProducts =
    document.getElementById(
        "totalProducts"
    );

const activeProducts =
    document.getElementById(
        "activeProducts"
    );

const totalOrders =
    document.getElementById(
        "totalOrders"
    );

const completedOrders =
    document.getElementById(
        "completedOrders"
    );

const grossSales =
    document.getElementById(
        "grossSales"
    );

const platformFees =
    document.getElementById(
        "platformFees"
    );

const netRevenue =
    document.getElementById(
        "netRevenue"
    );

const displayNetRevenue =
    document.getElementById(
        "displayNetRevenue"
    );

const recentOrders =
    document.getElementById(
        "recentOrders"
    );

const recentProducts =
    document.getElementById(
        "recentProducts"
    );

const dashboardMessage =
    document.getElementById(
        "dashboardMessage"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );

const menuButton =
    document.getElementById(
        "menuButton"
    );

const sidebar =
    document.getElementById(
        "sidebar"
    );


/* =========================================
   VARIABLES
========================================= */

let currentVendor =
    null;

let vendorId =
    null;

let unsubscribeVendor =
    null;

let unsubscribeProducts =
    null;

let unsubscribeOrders =
    null;


/* =========================================
   START
========================================= */

auth.onAuthStateChanged(
    async function(user) {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        vendorId =
            user.uid;


        try {

            await loadVendor(
                user
            );


            startProductListener();


            startOrderListener();


        }
        catch(error) {

            console.error(
                "Vendor dashboard error:",
                error
            );


            showDashboardMessage(
                "Unable to load your vendor dashboard.",
                "error"
            );

        }

    }
);


/* =========================================
   LOAD VENDOR
========================================= */

async function loadVendor(user) {

    /*
        First try vendors/{uid}
    */

    const vendorDocument =
        await db
            .collection("vendors")
            .doc(user.uid)
            .get();


    if (
        vendorDocument.exists
    ) {

        currentVendor =
            vendorDocument.data();

    }
    else {

        /*
            If your vendor document
            uses another structure, the
            authenticated user's basic
            information is still used.
        */

        currentVendor = {

            userId:
                user.uid,

            storeName:
                user.displayName ||
                "Dreypella Vendor",

            email:
                user.email ||
                "",

            status:
                "PENDING"

        };

    }


    renderVendor(
        user
    );

}


/* =========================================
   RENDER VENDOR
========================================= */

function renderVendor(user) {

    const name =
        currentVendor.storeName ||
        currentVendor.businessName ||
        currentVendor.vendorName ||
        user.displayName ||
        "Dreypella Vendor";


    const email =
        currentVendor.email ||
        user.email ||
        "Vendor account";


    storeName.textContent =
        name;


    sidebarVendorName.textContent =
        name;


    vendorEmail.textContent =
        email;


    vendorAvatar.textContent =
        getInitial(
            name
        );


    const status =
        currentVendor.status ||
        "PENDING";


    storeStatus.textContent =
        status;


    if (
        status === "APPROVED" ||
        status === "ACTIVE"
    ) {

        storeStatus.style.background =
            "#E8F7EE";

        storeStatus.style.color =
            "#16803C";

    }
    else {

        storeStatus.style.background =
            "#FFF7D6";

        storeStatus.style.color =
            "#8A6A00";

    }

}


/* =========================================
   PRODUCT LISTENER
========================================= */

function startProductListener() {

    unsubscribeProducts =
        db
            .collection("products")
            .where(
                "vendorId",
                "==",
                vendorId
            )
            .onSnapshot(

                function(snapshot) {

                    const products =
                        [];


                    snapshot.forEach(
                        function(doc) {

                            products.push({

                                id:
                                    doc.id,

                                ...doc.data()

                            });

                        }
                    );


                    updateProductStatistics(
                        products
                    );


                    renderRecentProducts(
                        products
                    );

                },

                function(error) {

                    console.error(
                        "Product listener error:",
                        error
                    );


                    /*
                        If the collection doesn't
                        exist yet, keep dashboard
                        usable.
                    */

                    totalProducts.textContent =
                        "0";

                    activeProducts.textContent =
                        "0";

                }

            );

}


/* =========================================
   PRODUCT STATISTICS
========================================= */

function updateProductStatistics(
    products
) {

    totalProducts.textContent =
        products.length;


    const active =
        products.filter(
            function(product) {

                return (
                    product.active === true ||
                    product.status === "ACTIVE" ||
                    product.status === "APPROVED"
                );

            }
        );


    activeProducts.textContent =
        active.length;

}


/* =========================================
   RECENT PRODUCTS
========================================= */

function renderRecentProducts(
    products
) {

    recentProducts.innerHTML =
        "";


    if (
        products.length === 0
    ) {

        recentProducts.innerHTML = `

            <div class="empty-state">

                You have not uploaded
                any products yet.

            </div>

        `;

        return;

    }


    const sortedProducts =
        products.sort(
            function(a,b) {

                return getMillis(
                    b.createdAt
                )
                -
                getMillis(
                    a.createdAt
                );

            }
        );


    sortedProducts
        .slice(0,4)
        .forEach(
            function(product) {

                recentProducts.appendChild(
                    createProductCard(
                        product
                    )
                );

            }
        );

}


/* =========================================
   PRODUCT CARD
========================================= */

function createProductCard(
    product
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "product-card";


    const image =
        product.imageUrl ||
        product.image ||
        product.images?.[0] ||
        "";


    const imageHTML =
        image
            ? `
                <img
                    class="product-image"
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name || "Product")}"
                >
              `
            : `
                <div class="product-image"></div>
              `;


    const price =
        Number(
            product.price || 0
        );


    card.innerHTML = `

        ${imageHTML}

        <div class="product-card-body">

            <h3>
                ${escapeHTML(
                    product.name ||
                    "Unnamed Product"
                )}
            </h3>

            <span class="product-category">

                ${escapeHTML(
                    product.category ||
                    "Product"
                )}

            </span>

            <div class="product-price">

                ₦${formatMoney(price)}

            </div>

        </div>

    `;


    return card;

}


/* =========================================
   ORDER LISTENER
========================================= */

function startOrderListener() {

    unsubscribeOrders =
        db
            .collection("orders")
            .where(
                "vendorId",
                "==",
                vendorId
            )
            .onSnapshot(

                function(snapshot) {

                    const orders =
                        [];


                    snapshot.forEach(
                        function(doc) {

                            orders.push({

                                id:
                                    doc.id,

                                ...doc.data()

                            });

                        }
                    );


                    updateOrderStatistics(
                        orders
                    );


                    calculateRevenue(
                        orders
                    );


                    renderRecentOrders(
                        orders
                    );

                },

                function(error) {

                    console.error(
                        "Order listener error:",
                        error
                    );


                    totalOrders.textContent =
                        "0";

                    completedOrders.textContent =
                        "0";


                    calculateRevenue(
                        []
                    );

                }

            );

}


/* =========================================
   ORDER STATISTICS
========================================= */

function updateOrderStatistics(
    orders
) {

    totalOrders.textContent =
        orders.length;


    const completed =
        orders.filter(
            function(order) {

                return [
                    "COMPLETED",
                    "DELIVERED"
                ].includes(
                    String(
                        order.status ||
                        ""
                    ).toUpperCase()
                );

            }
        );


    completedOrders.textContent =
        completed.length;

}


/* =========================================
   REVENUE
========================================= */

function calculateRevenue(
    orders
) {

    let sales =
        0;

    let fees =
        0;

    let earnings =
        0;


    orders.forEach(
        function(order) {

            const status =
                String(
                    order.status ||
                    ""
                ).toUpperCase();


            /*
                Only completed/delivered
                orders count as finalized
                vendor revenue.
            */

            if (
                ![
                    "COMPLETED",
                    "DELIVERED"
                ].includes(status)
            ) {

                return;

            }


            /*
                Customer total.
            */

            const customerTotal =
                Number(
                    order.totalAmount ||
                    order.customerTotal ||
                    0
                );


            /*
                Platform fee.

                Prefer the amount saved
                by the order system.

                If missing, calculate 5%
                from vendor amount.
            */

            let fee =
                Number(
                    order.platformFee ||
                    0
                );


            let vendorAmount =
                Number(
                    order.vendorAmount ||
                    order.vendorTotal ||
                    0
                );


            if (
                fee <= 0 &&
                vendorAmount > 0
            ) {

                fee =
                    vendorAmount *
                    0.05;

            }


            /*
                If old order records don't
                have vendorAmount, calculate
                the vendor portion from
                customer total.
            */

            if (
                vendorAmount <= 0 &&
                customerTotal > 0
            ) {

                vendorAmount =
                    customerTotal /
                    1.05;

                fee =
                    customerTotal -
                    vendorAmount;

            }


            sales +=
                customerTotal;


            fees +=
                fee;


            earnings +=
                vendorAmount;

        }
    );


    grossSales.textContent =
        "₦" +
        formatMoney(
            sales
        );


    platformFees.textContent =
        "₦" +
        formatMoney(
            fees
        );


    netRevenue.textContent =
        "₦" +
        formatMoney(
            earnings
        );


    displayNetRevenue.textContent =
        "₦" +
        formatMoney(
            earnings
        );

}


/* =========================================
   RECENT ORDERS
========================================= */

function renderRecentOrders(
    orders
) {

    recentOrders.innerHTML =
        "";


    if (
        orders.length === 0
    ) {

        recentOrders.innerHTML = `

            <div class="empty-state">

                No orders yet.

                Your customer orders
                will appear here.

            </div>

        `;

        return;

    }


    const sortedOrders =
        orders.sort(
            function(a,b) {

                return getMillis(
                    b.createdAt
                )
                -
                getMillis(
                    a.createdAt
                );

            }
        );


    sortedOrders
        .slice(0,5)
        .forEach(
            function(order) {

                recentOrders.appendChild(
                    createOrderRow(
                        order
                    )
                );

            }
        );

}


/* =========================================
   ORDER ROW
========================================= */

function createOrderRow(
    order
) {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "order-row";


    const reference =
        order.orderReference ||
        order.bookingReference ||
        order.id.substring(
            0,
            8
        );


    const customer =
        order.customerName ||
        "Customer";


    const status =
        String(
            order.status ||
            "PENDING"
        ).toUpperCase();


    const amount =
        Number(
            order.vendorAmount ||
            order.vendorTotal ||
            0
        );


    row.innerHTML = `

        <strong>

            ${escapeHTML(
                reference
            )}

        </strong>


        <span>

            ${escapeHTML(
                customer
            )}

        </span>


        <strong>

            ₦${formatMoney(
                amount
            )}

        </strong>


        <span
            class="order-status"
        >

            ${escapeHTML(
                status
            )}

        </span>

    `;


    return row;

}


/* =========================================
   MOBILE MENU
========================================= */

if (
    menuButton
) {

    menuButton.addEventListener(
        "click",
        function() {

            sidebar.classList.toggle(
                "open"
            );

        }
    );

}


/* =========================================
   LOGOUT
========================================= */

logoutButton.addEventListener(
    "click",
    async function() {

        try {

            await auth.signOut();


            window.location.href =
                "login.html";

        }
        catch(error) {

            console.error(
                "Logout error:",
                error
            );

        }

    }
);


/* =========================================
   MESSAGE
========================================= */

function showDashboardMessage(
    message,
    type
) {

    dashboardMessage.textContent =
        message;


    dashboardMessage.className =
        "dashboard-message show " +
        type;


    setTimeout(
        function() {

            dashboardMessage.className =
                "dashboard-message";

        },
        5000
    );

}


/* =========================================
   FORMAT MONEY
========================================= */

function formatMoney(
    amount
) {

    return Number(
        amount || 0
    ).toLocaleString(
        "en-NG",
        {

            minimumFractionDigits:
                0,

            maximumFractionDigits:
                2

        }
    );

}


/* =========================================
   TIMESTAMP
========================================= */

function getMillis(
    timestamp
) {

    if (!timestamp) {

        return 0;

    }


    try {

        if (
            timestamp.toMillis
        ) {

            return timestamp.toMillis();

        }


        if (
            timestamp.toDate
        ) {

            return timestamp
                .toDate()
                .getTime();

        }


        return new Date(
            timestamp
        ).getTime();

    }
    catch(error) {

        return 0;

    }

}


/* =========================================
   INITIAL
========================================= */

function getInitial(
    name
) {

    if (!name) {

        return "V";

    }


    return String(
        name
    )
        .trim()
        .charAt(0)
        .toUpperCase();

}


/* =========================================
   HTML SECURITY
========================================= */

function escapeHTML(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }


    return String(value)

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


/* =========================================
   CLEANUP
========================================= */

window.addEventListener(
    "beforeunload",
    function() {

        if (
            unsubscribeVendor
        ) {

            unsubscribeVendor();

        }


        if (
            unsubscribeProducts
        ) {

            unsubscribeProducts();

        }


        if (
            unsubscribeOrders
        ) {

            unsubscribeOrders();

        }

    }
);