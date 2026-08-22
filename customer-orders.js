/*
==================================================
DREYPELLA RIDE
CUSTOMER MARKETPLACE ORDERS
==================================================
*/


const auth = firebase.auth();

const db = firebase.firestore();


let allOrders = [];

let currentFilter = "ALL";

let unsubscribeOrders = null;


/*
==================================================
ELEMENTS
==================================================
*/


const ordersList =
    document.getElementById(
        "ordersList"
    );


const orderMessage =
    document.getElementById(
        "orderMessage"
    );


const orderModal =
    document.getElementById(
        "orderModal"
    );


const orderDetails =
    document.getElementById(
        "orderDetails"
    );


const closeModal =
    document.getElementById(
        "closeModal"
    );


/*
==================================================
AUTHENTICATION
==================================================
*/


auth.onAuthStateChanged(
    function(user) {

        if (!user) {

            showError(
                "Please login to view your orders."
            );

            setTimeout(
                function() {

                    window.location.href =
                        "login.html";

                },
                1200
            );

            return;

        }


        startOrderListener(
            user.uid
        );

    }
);


/*
==================================================
REAL-TIME ORDERS
==================================================
*/


function startOrderListener(
    userId
) {

    if (
        unsubscribeOrders
    ) {

        unsubscribeOrders();

    }


    unsubscribeOrders =
        db
            .collection(
                "orders"
            )

            .where(
                "customerId",
                "==",
                userId
            )

            .onSnapshot(

                function(snapshot) {

                    allOrders = [];


                    snapshot.forEach(
                        function(doc) {

                            allOrders.push({

                                id:
                                    doc.id,

                                ...doc.data()

                            });

                        }
                    );


                    sortOrders();


                    renderOrders();

                },

                function(error) {

                    console.error(
                        "Order listener error:",
                        error
                    );


                    showError(
                        "Unable to load your orders."
                    );

                }

            );

}


/*
==================================================
SORT ORDERS
==================================================
*/


function sortOrders() {

    allOrders.sort(
        function(a, b) {

            const dateA =
                getTimestampValue(
                    a.createdAt
                );


            const dateB =
                getTimestampValue(
                    b.createdAt
                );


            return dateB - dateA;

        }
    );

}


/*
==================================================
FILTER BUTTONS
==================================================
*/


document
    .querySelectorAll(
        ".filter-btn"
    )
    .forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    document
                        .querySelectorAll(
                            ".filter-btn"
                        )
                        .forEach(
                            function(btn) {

                                btn.classList.remove(
                                    "active"
                                );

                            }
                        );


                    button.classList.add(
                        "active"
                    );


                    currentFilter =
                        button.dataset.status;


                    renderOrders();

                }
            );

        }
    );


/*
==================================================
RENDER ORDERS
==================================================
*/


function renderOrders() {

    ordersList.innerHTML = "";


    let orders =
        allOrders;


    if (
        currentFilter !==
        "ALL"
    ) {

        orders =
            allOrders.filter(
                function(order) {

                    return normalizeStatus(
                        order.status
                    ) ===
                    currentFilter;

                }
            );

    }


    if (
        orders.length === 0
    ) {

        ordersList.innerHTML = `

            <div class="empty-state">

                <h3>
                    No orders found
                </h3>

                <p>
                    You have no marketplace orders
                    in this category yet.
                </p>

                <a
                    href="marketplace.html"
                    class="shop-button"
                >
                    SHOP MARKETPLACE
                </a>

            </div>

        `;

        return;

    }


    orders.forEach(
        function(order) {

            ordersList.appendChild(
                createOrderCard(
                    order
                )
            );

        }
    );

}


/*
==================================================
CREATE ORDER CARD
==================================================
*/


function createOrderCard(
    order
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "order-card";


    const status =
        normalizeStatus(
            order.status
        );


    const items =
        Array.isArray(
            order.items
        )
            ? order.items
            : [];


    const vendorName =
        order.vendorName ||
        order.vendor?.name ||
        "Dreypella Marketplace Vendor";


    const total =
        getOrderTotal(
            order
        );


    const itemsHTML =
        items
            .slice(
                0,
                3
            )
            .map(
                function(item) {

                    const name =
                        item.name ||
                        item.productName ||
                        "Product";


                    const quantity =
                        Number(
                            item.quantity ||
                            1
                        );


                    const price =
                        Number(
                            item.price ||
                            item.customerPrice ||
                            0
                        );


                    return `

                        <div class="order-item">

                            <div>

                                <div class="item-name">
                                    ${escapeHTML(name)}
                                </div>

                                <div class="item-quantity">
                                    Qty: ${quantity}
                                </div>

                            </div>

                            <div class="item-price">
                                ₦${formatMoney(
                                    price * quantity
                                )}
                            </div>

                        </div>

                    `;

                }
            )
            .join("");


    const remaining =
        Math.max(
            0,
            items.length - 3
        );


    card.innerHTML = `

        <div class="order-top">

            <div>

                <div class="order-number">
                    ${escapeHTML(
                        order.orderNumber ||
                        order.orderReference ||
                        order.id
                    )}
                </div>

                <div class="order-date">
                    ${formatDate(
                        order.createdAt
                    )}
                </div>

            </div>


            <span
                class="status ${statusClass(status)}"
            >
                ${formatStatus(status)}
            </span>

        </div>


        <div class="order-vendor">

            Vendor:
            <strong>
                ${escapeHTML(vendorName)}
            </strong>

        </div>


        <div class="order-items">

            ${
                itemsHTML ||
                `
                    <div class="item-name">
                        Order items
                    </div>
                `
            }

            ${
                remaining > 0
                    ? `
                        <div class="item-quantity">
                            + ${remaining} more item(s)
                        </div>
                    `
                    : ""
            }

        </div>


        <div class="order-summary">

            <div class="order-total">

                <span>
                    CUSTOMER TOTAL
                </span>

                <strong>
                    ₦${formatMoney(total)}
                </strong>

            </div>


            <button
                class="view-order"
                type="button"
            >
                VIEW ORDER
            </button>

        </div>

    `;


    card
        .querySelector(
            ".view-order"
        )
        .addEventListener(
            "click",
            function() {

                openOrderDetails(
                    order
                );

            }
        );


    return card;

}


/*
==================================================
ORDER DETAILS
==================================================
*/


function openOrderDetails(
    order
) {

    const status =
        normalizeStatus(
            order.status
        );


    const items =
        Array.isArray(
            order.items
        )
            ? order.items
            : [];


    const total =
        getOrderTotal(
            order
        );


    const vendorName =
        order.vendorName ||
        order.vendor?.name ||
        "Marketplace Vendor";


    const itemHTML =
        items.map(
            function(item) {

                const name =
                    item.name ||
                    item.productName ||
                    "Product";


                const quantity =
                    Number(
                        item.quantity ||
                        1
                    );


                const price =
                    Number(
                        item.price ||
                        item.customerPrice ||
                        0
                    );


                return `

                    <div class="detail-row">

                        <span>
                            ${escapeHTML(name)}
                            × ${quantity}
                        </span>

                        <strong>
                            ₦${formatMoney(
                                price * quantity
                            )}
                        </strong>

                    </div>

                `;

            }
        )
        .join("");


    const platformFee =
        Number(
            order.platformFee ||
            order.vendorPlatformFee ||
            0
        );


    const subtotal =
        Number(
            order.subtotal ||
            0
        );


    const deliveryFee =
        Number(
            order.deliveryFee ||
            0
        );


    orderDetails.innerHTML = `

        <h2 class="details-title">
            Order Details
        </h2>

        <p class="details-subtitle">

            ${escapeHTML(
                order.orderNumber ||
                order.orderReference ||
                order.id
            )}

        </p>


        <div class="detail-row">

            <span>
                Vendor
            </span>

            <strong>
                ${escapeHTML(vendorName)}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Status
            </span>

            <strong>
                ${formatStatus(status)}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Payment
            </span>

            <strong>
                ${escapeHTML(
                    order.paymentStatus ||
                    "PAID"
                )}
            </strong>

        </div>


        ${
            order.deliveryAddress
                ? `

                    <div class="detail-row">

                        <span>
                            Delivery Address
                        </span>

                        <strong>
                            ${escapeHTML(
                                order.deliveryAddress
                            )}
                        </strong>

                    </div>

                `
                : ""
        }


        <div class="tracking-box">

            <h3>
                Order Progress
            </h3>


            ${createTrackingStep(
                "PENDING",
                status,
                "Order Received"
            )}


            ${createTrackingStep(
                "CONFIRMED",
                status,
                "Order Confirmed"
            )}


            ${createTrackingStep(
                "PROCESSING",
                status,
                "Preparing Order"
            )}


            ${createTrackingStep(
                "READY",
                status,
                "Ready for Delivery"
            )}


            ${createTrackingStep(
                "OUT_FOR_DELIVERY",
                status,
                "Out for Delivery"
            )}


            ${createTrackingStep(
                "DELIVERED",
                status,
                "Delivered"
            )}

        </div>


        <div class="order-items">

            ${itemHTML}

        </div>


        ${
            subtotal > 0
                ? `

                    <div class="detail-row">

                        <span>
                            Subtotal
                        </span>

                        <strong>
                            ₦${formatMoney(subtotal)}
                        </strong>

                    </div>

                `
                : ""
        }


        ${
            platformFee > 0
                ? `

                    <div class="detail-row">

                        <span>
                            Platform Charge
                        </span>

                        <strong>
                            ₦${formatMoney(platformFee)}
                        </strong>

                    </div>

                `
                : ""
        }


        ${
            deliveryFee > 0
                ? `

                    <div class="detail-row">

                        <span>
                            Delivery Fee
                        </span>

                        <strong>
                            ₦${formatMoney(deliveryFee)}
                        </strong>

                    </div>

                `
                : ""
        }


        <div class="detail-row">

            <span>
                Total
            </span>

            <strong>
                ₦${formatMoney(total)}
            </strong>

        </div>


        ${
            status === "OUT_FOR_DELIVERY"
                ? `

                    <button
                        class="track-button"
                        type="button"
                        onclick="trackOrder('${escapeAttribute(
                            order.id
                        )}')"
                    >
                        TRACK DELIVERY
                    </button>

                `
                : ""
        }

    `;


    orderModal.classList.remove(
        "hidden"
    );

}


/*
==================================================
TRACKING
==================================================
*/


function trackOrder(
    orderId
) {

    window.location.href =
        "delivery-tracking.html?order=" +
        encodeURIComponent(
            orderId
        );

}


/*
==================================================
TRACKING STEP
==================================================
*/


function createTrackingStep(
    step,
    currentStatus,
    title
) {

    const active =
        isStatusReached(
            step,
            currentStatus
        );


    return `

        <div
            class="tracking-step ${
                active
                    ? "active"
                    : ""
            }"
        >

            <span class="step-dot"></span>

            <span>
                ${title}
            </span>

        </div>

    `;

}


/*
==================================================
STATUS ORDER
==================================================
*/


const statusOrder = [

    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED"

];


function isStatusReached(
    step,
    current
) {

    if (
        current ===
        "CANCELLED"
    ) {

        return false;

    }


    const stepIndex =
        statusOrder.indexOf(
            step
        );


    const currentIndex =
        statusOrder.indexOf(
            current
        );


    if (
        stepIndex === -1 ||
        currentIndex === -1
    ) {

        return false;

    }


    return (
        stepIndex <=
        currentIndex
    );

}


/*
==================================================
NORMALIZE STATUS
==================================================
*/


function normalizeStatus(
    status
) {

    if (!status) {

        return "PENDING";

    }


    const value =
        String(
            status
        )
        .toUpperCase()
        .trim();


    const aliases = {

        PENDING_PAYMENT:
            "PENDING",

        ORDERED:
            "PENDING",

        ACCEPTED:
            "CONFIRMED",

        PREPARING:
            "PROCESSING",

        READY_FOR_PICKUP:
            "READY",

        DELIVERY:
            "OUT_FOR_DELIVERY",

        SHIPPED:
            "OUT_FOR_DELIVERY",

        COMPLETED:
            "DELIVERED",

        CANCEL:
            "CANCELLED",

        CANCELED:
            "CANCELLED"

    };


    return (
        aliases[value] ||
        value
    );

}


/*
==================================================
STATUS TEXT
==================================================
*/


function formatStatus(
    status
) {

    const labels = {

        PENDING:
            "PENDING",

        CONFIRMED:
            "CONFIRMED",

        PROCESSING:
            "PROCESSING",

        READY:
            "READY",

        OUT_FOR_DELIVERY:
            "OUT FOR DELIVERY",

        DELIVERED:
            "DELIVERED",

        CANCELLED:
            "CANCELLED"

    };


    return (
        labels[status] ||
        status
            .replace(
                /_/g,
                " "
            )
    );

}


/*
==================================================
STATUS CSS
==================================================
*/


function statusClass(
    status
) {

    return String(
        status
    )
    .toLowerCase()
    .replace(
        /_/g,
        "-"
    );

}


/*
==================================================
ORDER TOTAL
==================================================
*/


function getOrderTotal(
    order
) {

    /*
     * The customer-facing total
     * should be used first.
     *
     * This prevents exposing the
     * vendor's internal revenue split.
     */


    if (
        order.total !== undefined &&
        order.total !== null
    ) {

        return Number(
            order.total
        );

    }


    if (
        order.customerTotal !== undefined &&
        order.customerTotal !== null
    ) {

        return Number(
            order.customerTotal
        );

    }


    if (
        order.totalAmount !== undefined &&
        order.totalAmount !== null
    ) {

        return Number(
            order.totalAmount
        );

    }


    const items =
        Array.isArray(
            order.items
        )
            ? order.items
            : [];


    return items.reduce(
        function(total, item) {

            const price =
                Number(
                    item.customerPrice ||
                    item.price ||
                    0
                );


            const quantity =
                Number(
                    item.quantity ||
                    1
                );


            return (
                total +
                price * quantity
            );

        },
        0
    );

}


/*
==================================================
DATE
==================================================
*/


function formatDate(
    timestamp
) {

    if (!timestamp) {

        return "Date unavailable";

    }


    try {

        const date =
            timestamp.toDate
                ? timestamp.toDate()
                : new Date(
                    timestamp
                );


        return date.toLocaleDateString(
            "en-NG",
            {
                day:
                    "numeric",

                month:
                    "short",

                year:
                    "numeric",

                hour:
                    "numeric",

                minute:
                    "2-digit"
            }
        );

    }
    catch(error) {

        return "Date unavailable";

    }

}


/*
==================================================
TIMESTAMP
==================================================
*/


function getTimestampValue(
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


        return new Date(
            timestamp
        ).getTime();

    }
    catch(error) {

        return 0;

    }

}


/*
==================================================
MONEY
==================================================
*/


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


/*
==================================================
ERROR
==================================================
*/


function showError(
    message
) {

    orderMessage.textContent =
        message;

    orderMessage.className =
        "message error";

}


/*
==================================================
ESCAPE HTML
==================================================
*/


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


/*
==================================================
ESCAPE ATTRIBUTE
==================================================
*/


function escapeAttribute(
    value
) {

    return String(
        value || ""
    )
    .replace(
        /'/g,
        "\\'"
    );

}


/*
==================================================
CLOSE MODAL
==================================================
*/


closeModal.addEventListener(
    "click",
    function() {

        orderModal.classList.add(
            "hidden"
        );

    }
);


orderModal.addEventListener(
    "click",
    function(event) {

        if (
            event.target ===
            orderModal
        ) {

            orderModal.classList.add(
                "hidden"
            );

        }

    }
);


/*
==================================================
CLEANUP
==================================================
*/


window.addEventListener(
    "beforeunload",
    function() {

        if (
            unsubscribeOrders
        ) {

            unsubscribeOrders();

        }

    }
);