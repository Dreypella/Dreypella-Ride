/*
====================================================
DREYPELLA RIDE
CUSTOMER MARKETPLACE CHECKOUT
====================================================

Handles:

- Cart loading
- Product quantities
- Vendor information
- Delivery address
- 5% marketplace platform charge
- Delivery fee
- Order creation
- Wallet payment
- Paystack preparation
- Firestore order record
*/


const auth = firebase.auth();

const db = firebase.firestore();



/*
====================================================
ELEMENTS
====================================================
*/

const cartItemsElement =
    document.getElementById(
        "cartItems"
    );


const itemCountElement =
    document.getElementById(
        "itemCount"
    );


const subtotalElement =
    document.getElementById(
        "subtotal"
    );


const deliveryFeeElement =
    document.getElementById(
        "deliveryFee"
    );


const platformFeeElement =
    document.getElementById(
        "platformFee"
    );


const grandTotalElement =
    document.getElementById(
        "grandTotal"
    );


const vendorNameElement =
    document.getElementById(
        "vendorName"
    );


const vendorCategoryElement =
    document.getElementById(
        "vendorCategory"
    );


const checkoutForm =
    document.getElementById(
        "checkoutForm"
    );


const checkoutMessage =
    document.getElementById(
        "checkoutMessage"
    );


const placeOrderButton =
    document.getElementById(
        "placeOrderButton"
    );



/*
====================================================
CHECKOUT STATE
====================================================
*/

let cartItems = [];

let vendorId = null;

let vendorData = null;

let deliveryFee = 0;

let subtotal = 0;

let platformFee = 0;

let grandTotal = 0;



/*
====================================================
START
====================================================
*/

auth.onAuthStateChanged(
    function(user) {

        if (!user) {

            showMessage(
                "Please login before checking out.",
                "error"
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


        loadCheckout();

    }
);



/*
====================================================
LOAD CHECKOUT
====================================================
*/

async function loadCheckout() {

    try {

        /*
         * First attempt:
         * load cart from localStorage.
         */

        const storedCart =
            localStorage.getItem(
                "dreypellaCart"
            );


        if (storedCart) {

            cartItems =
                JSON.parse(
                    storedCart
                );

        }


        /*
         * If your marketplace uses
         * another localStorage key,
         * we also check "cart".
         */

        if (
            !Array.isArray(cartItems) ||
            cartItems.length === 0
        ) {

            const alternativeCart =
                localStorage.getItem(
                    "cart"
                );


            if (alternativeCart) {

                cartItems =
                    JSON.parse(
                        alternativeCart
                    );

            }

        }


        /*
         * No cart.
         */

        if (
            !Array.isArray(cartItems) ||
            cartItems.length === 0
        ) {

            showEmptyCart();

            return;

        }


        normalizeCart();


        await loadVendor();


        calculateTotals();


        renderCart();


    }
    catch(error) {

        console.error(
            "Checkout loading error:",
            error
        );


        showMessage(
            "Unable to load your checkout.",
            "error"
        );

    }

}



/*
====================================================
NORMALIZE CART
====================================================

Allows products from different vendor
categories to work with the same checkout.

Examples:

Food
Clothes
Shoes
Electronics
Groceries
Pharmacy
Books
Beauty
etc.
*/

function normalizeCart() {

    cartItems =
        cartItems.map(
            function(item) {

                return {

                    id:
                        item.id ||
                        item.productId,

                    productId:
                        item.productId ||
                        item.id,

                    name:
                        item.name ||
                        item.productName ||
                        "Marketplace Product",

                    vendorPrice:
                        Number(
                            item.vendorPrice ??
                            item.price ??
                            0
                        ),

                    platformFee:
                        Number(
                            item.platformFee ??
                            (
                                Number(
                                    item.vendorPrice ??
                                    item.price ??
                                    0
                                ) * 0.05
                            )
                        ),

                    customerPrice:
                        Number(
                            item.customerPrice ??
                            (
                                Number(
                                    item.vendorPrice ??
                                    item.price ??
                                    0
                                ) * 1.05
                            )
                        ),

                    // PRICE_COMPATIBILITY
                    price:
                        Number(
                            item.vendorPrice ??
                            item.price ??
                            0
                        ),

                    quantity:
                        Math.max(
                            1,
                            Number(
                                item.quantity ||
                                1
                            )
                        ),

                    image:
                        item.image ||
                        item.imageUrl ||
                        "",

                    vendorId:
                        item.vendorId ||
                        item.sellerId ||
                        null,

                    vendorName:
                        item.vendorName ||
                        item.sellerName ||
                        "Marketplace Vendor",

                    category:
                        item.category ||
                        "Marketplace"

                };

            }
        );


    /*
     * Detect vendor from first product.
     */

    if (
        cartItems.length > 0
    ) {

        vendorId =
            cartItems[0].vendorId ||
            null;

    }

}



/*
====================================================
LOAD VENDOR
====================================================
*/

async function loadVendor() {

    /*
     * Products from one vendor are
     * grouped into one checkout.

     * If your marketplace later supports
     * multiple vendors in one cart,
     * we will split the order automatically.
     */

    if (!vendorId) {

        vendorNameElement.textContent =
            cartItems[0]?.vendorName ||
            "Marketplace Vendor";

        vendorCategoryElement.textContent =
            cartItems[0]?.category ||
            "Marketplace";

        return;

    }


    try {

        const vendorDocument =
            await db
                .collection(
                    "vendors"
                )
                .doc(
                    vendorId
                )
                .get();


        if (
            vendorDocument.exists
        ) {

            vendorData =
                vendorDocument.data();


            vendorNameElement.textContent =
                vendorData.businessName ||
                vendorData.storeName ||
                vendorData.name ||
                "Marketplace Vendor";


            vendorCategoryElement.textContent =
                vendorData.category ||
                "Marketplace Vendor";

        }
        else {

            vendorNameElement.textContent =
                cartItems[0]?.vendorName ||
                "Marketplace Vendor";

            vendorCategoryElement.textContent =
                cartItems[0]?.category ||
                "Marketplace";

        }

    }
    catch(error) {

        console.error(
            "Vendor loading error:",
            error
        );

    }

}



/*
====================================================
CALCULATE TOTALS
====================================================
*/

function calculateTotals() {

    subtotal =
        cartItems.reduce(
            function(total, item) {

                return total +
                    (
                        Number(
                            item.vendorPrice
                        ) *
                        Number(
                            item.quantity
                        )
                    );

            },
            0
        );


    /*
     * DREYPELLA MARKETPLACE CHARGE
     *
     * 5% of vendor's uploaded product
     * price / product subtotal.
     */

    platformFee =
        Number(
            cartItems.reduce(
                function(total, item) {

                    return total +
                        (
                            Number(
                                item.vendorPrice
                            ) *
                            Number(
                                item.quantity
                            ) *
                            0.05
                        );

                },
                0
            )
        );


    /*
     * Delivery fee.
     *
     * This can later be replaced by
     * your actual distance-based
     * delivery pricing engine.
     */

    deliveryFee =
        calculateDeliveryFee();


    grandTotal =
        subtotal +
        platformFee +
        deliveryFee;


    subtotalElement.textContent =
        formatMoney(
            subtotal
        );


    platformFeeElement.textContent =
        formatMoney(
            platformFee
        );


    deliveryFeeElement.textContent =
        formatMoney(
            deliveryFee
        );


    grandTotalElement.textContent =
        formatMoney(
            grandTotal
        );

}



/*
====================================================
DELIVERY FEE
====================================================
*/

function calculateDeliveryFee() {

    /*
     * Temporary marketplace delivery fee.
     *
     * Replace this with Dreypella's
     * actual delivery pricing engine.
     */

    const storedDeliveryFee =
        localStorage.getItem(
            "dreypellaMarketplaceDeliveryFee"
        );


    if (
        storedDeliveryFee !== null
    ) {

        const fee =
            Number(
                storedDeliveryFee
            );


        if (
            Number.isFinite(fee) &&
            fee >= 0
        ) {

            return fee;

        }

    }


    return 0;

}



/*
====================================================
RENDER CART
====================================================
*/

function renderCart() {

    cartItemsElement.innerHTML =
        "";


    let totalQuantity = 0;


    cartItems.forEach(
        function(item, index) {

            totalQuantity +=
                item.quantity;


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "cart-item";


            const imageHTML =
                item.image

                    ?

                `
                <img
                    src="${escapeHTML(
                        item.image
                    )}"
                    alt="${escapeHTML(
                        item.name
                    )}"
                >
                `

                    :

                `
                <div class="no-image">
                    🛍️
                </div>
                `;


            element.innerHTML = `

                <div class="product-image">

                    ${imageHTML}

                </div>


                <div class="product-info">

                    <h3>
                        ${escapeHTML(
                            item.name
                        )}
                    </h3>


                    <p>
                        ${escapeHTML(
                            item.category
                        )}
                    </p>


                    <div class="product-price">

                        ₦${formatMoney(
                            item.customerPrice
                        )}

                    </div>


                    <div class="quantity-control">

                        <button
                            type="button"
                            data-action="decrease"
                            data-index="${index}"
                        >
                            −
                        </button>


                        <strong>
                            ${item.quantity}
                        </strong>


                        <button
                            type="button"
                            data-action="increase"
                            data-index="${index}"
                        >
                            +
                        </button>

                    </div>

                </div>


                <div class="item-total">

                    ₦${formatMoney(
                        item.customerPrice *
                        item.quantity
                    )}

                </div>

            `;


            cartItemsElement.appendChild(
                element
            );

        }
    );


    itemCountElement.textContent =
        totalQuantity +
        (
            totalQuantity === 1
                ? " item"
                : " items"
        );


    attachQuantityEvents();

}



/*
====================================================
QUANTITY EVENTS
====================================================
*/

function attachQuantityEvents() {

    const buttons =
        document.querySelectorAll(
            "[data-action]"
        );


    buttons.forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    const index =
                        Number(
                            button.dataset.index
                        );


                    const action =
                        button.dataset.action;


                    if (
                        action ===
                        "increase"
                    ) {

                        cartItems[index]
                            .quantity++;

                    }


                    if (
                        action ===
                        "decrease"
                    ) {

                        cartItems[index]
                            .quantity--;


                        if (
                            cartItems[index]
                                .quantity <= 0
                        ) {

                            cartItems.splice(
                                index,
                                1
                            );

                        }

                    }


                    saveCart();


                    if (
                        cartItems.length === 0
                    ) {

                        showEmptyCart();

                        return;

                    }


                    calculateTotals();

                    renderCart();

                }
            );

        }
    );

}



/*
====================================================
SAVE CART
====================================================
*/

function saveCart() {

    localStorage.setItem(
        "dreypellaCart",
        JSON.stringify(
            cartItems
        )
    );

}



/*
====================================================
SUBMIT ORDER
====================================================
*/

checkoutForm.addEventListener(
    "submit",
    submitOrder
);



async function submitOrder(event) {

    event.preventDefault();


    const user =
        auth.currentUser;


    if (!user) {

        showMessage(
            "Please login before placing an order.",
            "error"
        );

        return;

    }


    if (
        cartItems.length === 0
    ) {

        showMessage(
            "Your cart is empty.",
            "error"
        );

        return;

    }


    const name =
        document
            .getElementById(
                "customerName"
            )
            .value
            .trim();


    const phone =
        document
            .getElementById(
                "customerPhone"
            )
            .value
            .trim();


    const email =
        document
            .getElementById(
                "customerEmail"
            )
            .value
            .trim();


    const address =
        document
            .getElementById(
                "deliveryAddress"
            )
            .value
            .trim();


    const city =
        document
            .getElementById(
                "deliveryCity"
            )
            .value
            .trim();


    const state =
        document
            .getElementById(
                "deliveryState"
            )
            .value
            .trim();


    const note =
        document
            .getElementById(
                "orderNote"
            )
            .value
            .trim();


    const paymentMethod =
        document.querySelector(
            "input[name='paymentMethod']:checked"
        )?.value ||
        "PAYSTACK";



    if (
        !name ||
        !phone ||
        !email ||
        !address ||
        !city ||
        !state
    ) {

        showMessage(
            "Please complete your delivery information.",
            "error"
        );

        return;

    }


    placeOrderButton.disabled =
        true;


    placeOrderButton.textContent =
        "CREATING ORDER...";


    try {

        /*
         * Generate order reference.
         */

        const orderReference =
            generateOrderReference();


        /*
         * Create immutable item snapshot.
         *
         * This is important because
         * the vendor might change the
         * product price later.
         */

        const orderItems =
            cartItems.map(
                function(item) {

                    return {

                        productId:
                            item.productId,

                        name:
                            item.name,

                        category:
                            item.category,

                        quantity:
                            item.quantity,

                        vendorPrice:
                            Number(
                                item.vendorPrice
                            ),

                        platformFee:
                            Number(
                                item.vendorPrice
                            ) *
                            0.05,

                        customerPrice:
                            Number(
                                item.customerPrice
                            ),

                        unitPrice:
                            Number(
                                item.customerPrice
                            ),

                        total:
                            Number(
                                item.customerPrice
                            ) *
                            item.quantity

                    };

                }
            );


        /*
         * Customer-facing order.
         */

        const orderData = {

            orderReference:

                orderReference,


            customerId:

                user.uid,


            customerName:

                name,


            customerPhone:

                phone,


            customerEmail:

                email,


            vendorId:

                vendorId,


            vendorName:

                vendorData?.businessName ||
                vendorData?.storeName ||
                cartItems[0]?.vendorName ||
                "Marketplace Vendor",


            vendorCategory:

                vendorData?.category ||
                cartItems[0]?.category ||
                "Marketplace",


            items:

                orderItems,


            subtotal:

                subtotal,


            /*
             * 5% Dreypella platform charge.
             */

            platformFeeRate:

                0.05,


            platformFee:

                platformFee,


            // PRICING_BREAKDOWN

            deliveryFee:

                deliveryFee,


            total:

                grandTotal,


            deliveryAddress: {

                address:
                    address,

                city:
                    city,

                state:
                    state

            },


            customerNote:

                note,


            paymentMethod:

                paymentMethod,


            paymentStatus:

                "UNPAID",


            orderStatus:

                "PENDING_PAYMENT",


            /*
             * Important accounting
             * information.
             *
             * Vendor should receive
             * product subtotal.
             *
             * Dreypella receives
             * 5% platform charge.
             */

            vendorGross:

                subtotal,


            dreypellaPlatformRevenue:

                platformFee,


            createdAt:

                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),

            updatedAt:

                firebase.firestore
                    .FieldValue
                    .serverTimestamp()

        };


        /*
         * SAVE ORDER
         */

        const orderDocument =
            await db
                .collection(
                    "marketplaceOrders"
                )
                .add(
                    orderData
                );


        /*
         * Clear cart only after
         * Firestore successfully creates
         * the order.
         */

        localStorage.removeItem(
            "dreypellaCart"
        );


        localStorage.removeItem(
            "cart"
        );


        /*
         * PAYMENT
         */

        if (
            paymentMethod ===
            "WALLET"
        ) {

            await processWalletPayment(
                orderDocument.id,
                orderData
            );

            return;

        }


        /*
         * Paystack should be initialized
         * here through your secure backend.
         */

        await startPaystackPayment(
            orderDocument.id,
            orderData
        );


    }
    catch(error) {

        console.error(
            "Order creation error:",
            error
        );


        showMessage(
            "Unable to create your order. Please try again.",
            "error"
        );


        placeOrderButton.disabled =
            false;


        placeOrderButton.textContent =
            "PLACE ORDER";

    }

}



/*
====================================================
WALLET PAYMENT
====================================================
*/

async function processWalletPayment(
    orderId,
    orderData
) {

    try {

        const functions =
            firebase.functions();

        const payWithWallet =
            functions.httpsCallable(
                "payWithWallet"
            );

        const reference =
            orderData.orderReference ||
            ("DRM-WALLET-" + Date.now());

        const result =
            await payWithWallet({

                paymentType:
                    "MARKETPLACE",

                amount:
                    Number(orderData.total),

                reference,

                orderId,

                item:
                    "Marketplace Order"

            });

        if (
            !result.data ||
            result.data.success !== true
        ) {

            throw new Error(
                "Wallet payment was not completed."
            );

        }

        await db
            .collection("marketplaceOrders")
            .doc(orderId)
            .update({

                paymentStatus:
                    "PAID",

                orderStatus:
                    "CONFIRMED",

                paymentReference:
                    reference,

                walletTransactionId:
                    result.data.transactionId,

                paidAmount:
                    Number(orderData.total),

                paidAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp(),

                updatedAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            });

        showMessage(
            "Payment successful. Your order has been confirmed.",
            "success"
        );

        setTimeout(
            function() {
                window.location.href =
                    "customer-orders.html";
            },
            1200
        );

    }
    catch (error) {

        console.error(
            "Wallet payment error:",
            error
        );

        showMessage(
            error.message ||
            "Wallet payment failed.",
            "error"
        );

        placeOrderButton.disabled =
            false;

        placeOrderButton.textContent =
            "PLACE ORDER";

    }

}




/*
====================================================
PAYSTACK
====================================================
*/

async function startPaystackPayment(
    orderId,
    orderData
) {

    /*
     * DO NOT put Paystack secret keys
     * inside this JavaScript.
     *
     * The server should create the
     * Paystack transaction and return
     * the authorization URL/reference.
     */


    showMessage(
        "Order created. Payment gateway connection will now be opened.",
        "success"
    );


    /*
     * Temporary redirect.
     *
     * Once Paystack Cloud Function/API
     * is connected, this function will
     * launch the actual payment.
     */

    setTimeout(
        function() {

            window.location.href =
                "customer-orders.html";

        },
        1500
    );

}



/*
====================================================
ORDER REFERENCE
====================================================
*/

function generateOrderReference() {

    const random =
        Math.random()
            .toString(36)
            .substring(
                2,
                8
            )
            .toUpperCase();


    return (
        "DRM-" +
        Date.now()
            .toString()
            .slice(-7) +
        "-" +
        random
    );

}



/*
====================================================
EMPTY CART
====================================================
*/

function showEmptyCart() {

    cartItemsElement.innerHTML = `

        <div class="empty-cart">

            <strong>
                Your cart is empty
            </strong>

            <p>
                Add products from the Dreypella
                Marketplace before checking out.
            </p>

        </div>

    `;


    itemCountElement.textContent =
        "0 items";


    subtotalElement.textContent =
        "₦0";


    platformFeeElement.textContent =
        "₦0";


    deliveryFeeElement.textContent =
        "₦0";


    grandTotalElement.textContent =
        "₦0";


    placeOrderButton.disabled =
        true;


    placeOrderButton.textContent =
        "CART IS EMPTY";

}



/*
====================================================
MESSAGE
====================================================
*/

function showMessage(
    message,
    type
) {

    checkoutMessage.textContent =
        message;

    checkoutMessage.className =
        "checkout-message " +
        type;


}



/*
====================================================
MONEY
====================================================
*/

function formatMoney(
    amount
) {

    return Number(
        amount || 0
    ).toLocaleString(
        "en-NG",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    );

}



/*
====================================================
HTML SECURITY
====================================================
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