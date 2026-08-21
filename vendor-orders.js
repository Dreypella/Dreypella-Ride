/*
=========================================================
DREYPELLA RIDE
VENDOR ORDER MANAGEMENT
=========================================================

Handles:

- Vendor authentication
- Realtime vendor orders
- New orders
- Accept / reject orders
- Processing orders
- Ready for pickup
- Out for delivery
- Completed orders
- Cancelled orders
- Order details
- 5% platform fee
- Vendor net earnings
=========================================================
*/


/* =====================================================
   FIREBASE
===================================================== */

const auth = firebase.auth();
const db = firebase.firestore();


/* =====================================================
   VENDOR STATE
===================================================== */

let currentVendor = null;
let unsubscribeOrders = null;
let currentOrderId = null;


/* =====================================================
   PLATFORM FEE
===================================================== */

const PLATFORM_FEE_PERCENT = 5;


/* =====================================================
   PAGE ELEMENTS
===================================================== */

const ordersContainer =
    document.getElementById("ordersContainer");

const orderMessage =
    document.getElementById("orderMessage");

const orderModal =
    document.getElementById("orderModal");

const orderModalContent =
    document.getElementById("orderModalContent");

const closeOrderModal =
    document.getElementById("closeOrderModal");


/* =====================================================
   AUTHENTICATION
===================================================== */

auth.onAuthStateChanged(
    async function(user) {

        if (!user) {

            showMessage(
                "Please login as a vendor."
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


        currentVendor = user;


        startVendorOrders();

    }
);


/* =====================================================
   START REALTIME ORDERS
===================================================== */

function startVendorOrders() {

    if (!currentVendor) {

        return;

    }


    if (unsubscribeOrders) {

        unsubscribeOrders();

    }


    unsubscribeOrders =
        db
            .collection("marketplaceOrders")

            .where(
                "vendorId",
                "==",
                currentVendor.uid
            )

            .orderBy(
                "createdAt",
                "desc"
            )

            .onSnapshot(

                function(snapshot) {

                    const orders = [];


                    snapshot.forEach(
                        function(doc) {

                            orders.push({

                                id:
                                    doc.id,

                                ...doc.data()

                            });

                        }
                    );


                    renderOrders(
                        orders
                    );

                },

                function(error) {

                    console.error(
                        "Vendor order listener error:",
                        error
                    );


                    /*
                     * Some Firestore projects may
                     * require a composite index for
                     * vendorId + createdAt.
                     *
                     * Retry without orderBy.
                     */

                    startSimpleOrderListener();

                }

            );

}


/* =====================================================
   FALLBACK ORDER LISTENER
===================================================== */

function startSimpleOrderListener() {

    if (!currentVendor) {

        return;

    }


    if (unsubscribeOrders) {

        unsubscribeOrders();

    }


    unsubscribeOrders =
        db
            .collection("marketplaceOrders")

            .where(
                "vendorId",
                "==",
                currentVendor.uid
            )

            .onSnapshot(

                function(snapshot) {

                    const orders = [];


                    snapshot.forEach(
                        function(doc) {

                            orders.push({

                                id:
                                    doc.id,

                                ...doc.data()

                            });

                        }
                    );


                    orders.sort(
                        function(a, b) {

                            return getMillis(
                                b.createdAt
                            )
                            -
                            getMillis(
                                a.createdAt
                            );

                        }
                    );


                    renderOrders(
                        orders
                    );

                },

                function(error) {

                    console.error(
                        "Unable to load vendor orders:",
                        error
                    );


                    showMessage(
                        "Unable to load your orders."
                    );

                }

            );

}


/* =====================================================
   RENDER ORDERS
===================================================== */

function renderOrders(
    orders
) {

    if (!ordersContainer) {

        return;

    }


    ordersContainer.innerHTML = "";


    if (orders.length === 0) {

        ordersContainer.innerHTML = `

            <div class="empty-orders">

                <h3>
                    No orders yet
                </h3>

                <p>
                    Customer orders will appear here
                    when they purchase your products.
                </p>

            </div>

        `;

        return;

    }


    orders.forEach(
        function(order) {

            const card =
                createOrderCard(
                    order
                );


            ordersContainer.appendChild(
                card
            );

        }
    );

}


/* =====================================================
   CREATE ORDER CARD
===================================================== */

function createOrderCard(
    order
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "vendor-order-card";


    const customerName =
        escapeHTML(
            order.customerName ||
            "Customer"
        );


    const status =
        order.status ||
        "PENDING";


    const total =
        Number(
            order.customerTotal ||
            order.totalAmount ||
            0
        );


    const platformFee =
        calculatePlatformFee(
            total
        );


    const vendorNet =
        calculateVendorNet(
            total
        );


    card.innerHTML = `

        <div class="order-card-top">

            <div>

                <span class="order-label">
                    ORDER
                </span>

                <h3>
                    ${escapeHTML(
                        order.orderReference ||
                        order.id
                    )}
                </h3>

            </div>


            <span class="
                order-status
                status-${status.toLowerCase()}
            ">

                ${formatStatus(status)}

            </span>

        </div>


        <div class="order-customer">

            <strong>
                ${customerName}
            </strong>

            <span>
                ${escapeHTML(
                    order.customerPhone ||
                    "Phone unavailable"
                )}
            </span>

        </div>


        <div class="order-summary">

            <div>

                <span>
                    Items
                </span>

                <strong>
                    ${getItemCount(order)}
                </strong>

            </div>


            <div>

                <span>
                    Customer Total
                </span>

                <strong>
                    ₦${formatMoney(total)}
                </strong>

            </div>


            <div>

                <span>
                    Your Earnings
                </span>

                <strong>
                    ₦${formatMoney(vendorNet)}
                </strong>

            </div>

        </div>


        <div class="order-card-actions">

            <button
                type="button"
                class="view-order"
            >

                VIEW ORDER

            </button>


            ${getPrimaryAction(
                order
            )}

        </div>

    `;


    const viewButton =
        card.querySelector(
            ".view-order"
        );


    viewButton.addEventListener(
        "click",
        function() {

            openOrderDetails(
                order
            );

        }
    );


    const actionButton =
        card.querySelector(
            ".order-primary-action"
        );


    if (actionButton) {

        actionButton.addEventListener(
            "click",
            function() {

                updateOrderStatus(
                    order.id,
                    getNextStatus(
                        order.status
                    )
                );

            }
        );

    }


    const rejectButton =
        card.querySelector(
            ".reject-order"
        );


    if (rejectButton) {

        rejectButton.addEventListener(
            "click",
            function() {

                rejectOrder(
                    order.id
                );

            }
        );

    }


    return card;

}


/* =====================================================
   PRIMARY ACTION
===================================================== */

function getPrimaryAction(
    order
) {

    const status =
        order.status ||
        "PENDING";


    switch (status) {

        case "PENDING":

            return `

                <button
                    type="button"
                    class="order-primary-action"
                >

                    ACCEPT ORDER

                </button>

                <button
                    type="button"
                    class="reject-order"
                >

                    REJECT

                </button>

            `;


        case "ACCEPTED":

            return `

                <button
                    type="button"
                    class="order-primary-action"
                >

                    START PROCESSING

                </button>

            `;


        case "PROCESSING":

            return `

                <button
                    type="button"
                    class="order-primary-action"
                >

                    READY FOR PICKUP

                </button>

            `;


        case "READY_FOR_PICKUP":

            return `

                <button
                    type="button"
                    class="order-primary-action"
                >

                    MARK OUT FOR DELIVERY

                </button>

            `;


        case "OUT_FOR_DELIVERY":

            return `

                <button
                    type="button"
                    class="order-primary-action"
                >

                    COMPLETE ORDER

                </button>

            `;


        default:

            return "";

    }

}


/* =====================================================
   NEXT STATUS
===================================================== */

function getNextStatus(
    status
) {

    switch (status) {

        case "PENDING":
            return "ACCEPTED";

        case "ACCEPTED":
            return "PROCESSING";

        case "PROCESSING":
            return "READY_FOR_PICKUP";

        case "READY_FOR_PICKUP":
            return "OUT_FOR_DELIVERY";

        case "OUT_FOR_DELIVERY":
            return "COMPLETED";

        default:
            return null;

    }

}


/* =====================================================
   UPDATE ORDER STATUS
===================================================== */

async function updateOrderStatus(
    orderId,
    newStatus
) {

    if (!orderId || !newStatus) {

        return;

    }


    try {

        const orderReference =
            db
                .collection(
                    "marketplaceOrders"
                )
                .doc(
                    orderId
                );


        await orderReference.update({

            status:
                newStatus,

            updatedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),

            statusHistory:
                firebase.firestore
                    .FieldValue
                    .arrayUnion({

                        status:
                            newStatus,

                        changedBy:
                            currentVendor.uid,

                        changedAt:
                            new Date()

                    })

        });


        showMessage(
            "Order updated successfully."
        );


    }
    catch(error) {

        console.error(
            "Order status update error:",
            error
        );


        showMessage(
            "Unable to update this order."
        );

    }

}


/* =====================================================
   REJECT ORDER
===================================================== */

async function rejectOrder(
    orderId
) {

    const confirmed =
        window.confirm(
            "Are you sure you want to reject this order?"
        );


    if (!confirmed) {

        return;

    }


    try {

        await db
            .collection(
                "marketplaceOrders"
            )
            .doc(
                orderId
            )
            .update({

                status:
                    "CANCELLED",

                cancellationReason:
                    "Rejected by vendor",

                cancelledBy:
                    "VENDOR",

                updatedAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp(),

                statusHistory:
                    firebase.firestore
                        .FieldValue
                        .arrayUnion({

                            status:
                                "CANCELLED",

                            changedBy:
                                currentVendor.uid,

                            changedAt:
                                new Date()

                        })

            });


        showMessage(
            "Order rejected."
        );

    }
    catch(error) {

        console.error(
            "Reject order error:",
            error
        );


        showMessage(
            "Unable to reject order."
        );

    }

}


/* =====================================================
   ORDER DETAILS
===================================================== */

function openOrderDetails(
    order
) {

    if (!orderModal) {

        return;

    }


    currentOrderId =
        order.id;


    const customerTotal =
        Number(
            order.customerTotal ||
            order.totalAmount ||
            0
        );


    /*
     * IMPORTANT:
     *
     * The 5% fee is calculated
     * automatically.
     */

    const platformFee =
        calculatePlatformFee(
            customerTotal
        );


    const vendorNet =
        calculateVendorNet(
            customerTotal
        );


    orderModalContent.innerHTML = `

        <div class="order-details">

            <div class="order-details-header">

                <span>
                    ORDER REFERENCE
                </span>

                <strong>
                    ${escapeHTML(
                        order.orderReference ||
                        order.id
                    )}
                </strong>

            </div>


            <div class="order-detail-section">

                <h3>
                    Customer
                </h3>

                <p>
                    ${escapeHTML(
                        order.customerName ||
                        "Customer"
                    )}
                </p>

                <p>
                    ${escapeHTML(
                        order.customerPhone ||
                        "Phone unavailable"
                    )}
                </p>

            </div>


            <div class="order-detail-section">

                <h3>
                    Delivery Address
                </h3>

                <p>
                    ${escapeHTML(
                        getDeliveryAddress(
                            order
                        )
                    )}
                </p>

            </div>


            <div class="order-detail-section">

                <h3>
                    Products
                </h3>

                ${renderOrderItems(
                    order.items
                )}

            </div>


            <div class="order-financials">

                <div>

                    <span>
                        Customer Paid
                    </span>

                    <strong>
                        ₦${formatMoney(
                            customerTotal
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Platform Charge (5%)
                    </span>

                    <strong>
                        ₦${formatMoney(
                            platformFee
                        )}
                    </strong>

                </div>


                <div class="vendor-total">

                    <span>
                        Vendor Earnings
                    </span>

                    <strong>
                        ₦${formatMoney(
                            vendorNet
                        )}
                    </strong>

                </div>

            </div>


            <div class="order-detail-section">

                <h3>
                    Status
                </h3>

                <strong>
                    ${formatStatus(
                        order.status
                    )}
                </strong>

            </div>

        </div>

    `;


    orderModal.classList.remove(
        "hidden"
    );

}


/* =====================================================
   ORDER ITEMS
===================================================== */

function renderOrderItems(
    items
) {

    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        return `

            <p>
                Product information unavailable.
            </p>

        `;

    }


    return items.map(
        function(item) {

            const quantity =
                Number(
                    item.quantity || 1
                );


            const price =
                Number(
                    item.price || 0
                );


            return `

                <div class="order-product">

                    <strong>
                        ${escapeHTML(
                            item.name ||
                            "Product"
                        )}
                    </strong>

                    <span>
                        ${quantity}
                        ×
                        ₦${formatMoney(price)}
                    </span>

                </div>

            `;

        }
    ).join("");

}


/* =====================================================
   DELIVERY ADDRESS
===================================================== */

function getDeliveryAddress(
    order
) {

    if (
        order.deliveryAddress
    ) {

        if (
            typeof order.deliveryAddress ===
            "string"
        ) {

            return order.deliveryAddress;

        }


        return [

            order.deliveryAddress.address,

            order.deliveryAddress.city,

            order.deliveryAddress.state

        ]

        .filter(Boolean)

        .join(", ");

    }


    return (
        order.address ||
        "Delivery address unavailable"
    );

}


/* =====================================================
   PLATFORM FEE
===================================================== */

function calculatePlatformFee(
    amount
) {

    const value =
        Number(
            amount || 0
        );


    return (
        value *
        PLATFORM_FEE_PERCENT /
        100
    );

}


/* =====================================================
   VENDOR NET
===================================================== */

function calculateVendorNet(
    amount
) {

    const value =
        Number(
            amount || 0
        );


    const fee =
        calculatePlatformFee(
            value
        );


    return (
        value -
        fee
    );

}


/* =====================================================
   FORMAT STATUS
===================================================== */

function formatStatus(
    status
) {

    const statuses = {

        PENDING:
            "New Order",

        ACCEPTED:
            "Accepted",

        PROCESSING:
            "Processing",

        READY_FOR_PICKUP:
            "Ready for Pickup",

        OUT_FOR_DELIVERY:
            "Out for Delivery",

        COMPLETED:
            "Completed",

        CANCELLED:
            "Cancelled"

    };


    return (
        statuses[status] ||
        "Processing"
    );

}


/* =====================================================
   ITEM COUNT
===================================================== */

function getItemCount(
    order
) {

    if (
        !Array.isArray(
            order.items
        )
    ) {

        return 0;

    }


    return order.items.reduce(
        function(total, item) {

            return (
                total +
                Number(
                    item.quantity || 1
                )
            );

        },
        0
    );

}


/* =====================================================
   MONEY
===================================================== */

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


/* =====================================================
   TIMESTAMP
===================================================== */

function getMillis(
    timestamp
) {

    if (
        !timestamp
    ) {

        return 0;

    }


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


    const date =
        new Date(
            timestamp
        );


    return isNaN(
        date.getTime()
    )
        ? 0
        : date.getTime();

}


/* =====================================================
   MESSAGE
===================================================== */

function showMessage(
    message
) {

    if (!orderMessage) {

        return;

    }


    orderMessage.textContent =
        message;


    orderMessage.className =
        "order-message";


    setTimeout(
        function() {

            orderMessage.textContent =
                "";

        },
        3500
    );

}


/* =====================================================
   CLOSE MODAL
===================================================== */

if (closeOrderModal) {

    closeOrderModal.addEventListener(
        "click",
        function() {

            orderModal.classList.add(
                "hidden"
            );

            currentOrderId =
                null;

        }
    );

}


/* =====================================================
   CLOSE WHEN CLICKING OUTSIDE
===================================================== */

if (orderModal) {

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

                currentOrderId =
                    null;

            }

        }
    );

}


/* =====================================================
   HTML SECURITY
===================================================== */

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


/* =====================================================
   CLEANUP
===================================================== */

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