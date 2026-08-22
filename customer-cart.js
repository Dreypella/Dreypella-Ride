/*
=========================================================
DREYPELLA RIDE
CUSTOMER MARKETPLACE CART
=========================================================
*/


/* =====================================================
   FIREBASE
===================================================== */

const auth = firebase.auth();

const db = firebase.firestore();


/* =====================================================
   PLATFORM FEE
===================================================== */

const PLATFORM_FEE_PERCENT = 5;


/* =====================================================
   ELEMENTS
===================================================== */

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
        "cartSubtotal"
    );


const platformFeeElement =
    document.getElementById(
        "platformFee"
    );


const totalElement =
    document.getElementById(
        "cartTotal"
    );


const checkoutButton =
    document.getElementById(
        "checkoutButton"
    );


const cartMessage =
    document.getElementById(
        "cartMessage"
    );


/* =====================================================
   CART
===================================================== */

let cart = [];


/* =====================================================
   LOAD CART
===================================================== */

loadCart();


function loadCart() {

    try {

        const savedCart =
            localStorage.getItem(
                "dreypellaCart"
            );


        if (savedCart) {

            cart =
                JSON.parse(
                    savedCart
                );

        }

    }
    catch(error) {

        console.error(
            "Cart loading error:",
            error
        );

        cart = [];

    }


    if (
        !Array.isArray(cart)
    ) {

        cart = [];

    }


    normalizeCart();

    saveCart();

    renderCart();

}


/* =====================================================
   NORMALIZE CART
===================================================== */

function normalizeCart() {

    cart =
        cart.map(
            function(item) {

                const vendorPrice =
                    Number(
                        item.vendorPrice ??
                        item.price ??
                        0
                    );


                const platformFee =
                    vendorPrice *
                    PLATFORM_FEE_PERCENT /
                    100;


                const customerPrice =
                    vendorPrice +
                    platformFee;


                return {

                    ...item,

                    quantity:
                        Math.max(
                            1,
                            Number(
                                item.quantity ||
                                1
                            )
                        ),

                    vendorPrice:
                        vendorPrice,

                    platformFee:
                        platformFee,

                    customerPrice:
                        customerPrice

                };

            }
        );

}


/* =====================================================
   SAVE CART
===================================================== */

function saveCart() {

    localStorage.setItem(
        "dreypellaCart",
        JSON.stringify(
            cart
        )
    );

}


/* =====================================================
   RENDER CART
===================================================== */

function renderCart() {

    cartItemsElement.innerHTML =
        "";


    if (
        cart.length === 0
    ) {

        renderEmptyCart();

        updateSummary();

        return;

    }


    cart.forEach(
        function(item, index) {

            cartItemsElement.appendChild(
                createCartItem(
                    item,
                    index
                )
            );

        }
    );


    updateSummary();

}


/* =====================================================
   CREATE CART ITEM
===================================================== */

function createCartItem(
    item,
    index
) {

    const element =
        document.createElement(
            "article"
        );


    element.className =
        "cart-item";


    const image =
        item.image ||
        item.imageUrl ||
        "images/product-placeholder.png";


    const vendorName =
        item.vendorName ||
        item.storeName ||
        "Marketplace Vendor";


    const quantity =
        Number(
            item.quantity || 1
        );


    const customerPrice =
        Number(
            item.customerPrice || 0
        );


    const itemTotal =
        customerPrice *
        quantity;


    element.innerHTML = `

        <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(
                item.name ||
                "Product"
            )}"
            class="product-image"
            onerror="
                this.src='images/product-placeholder.png'
            "
        >


        <div class="product-info">

            <h3>
                ${escapeHTML(
                    item.name ||
                    "Product"
                )}
            </h3>


            <span class="product-vendor">

                ${escapeHTML(
                    vendorName
                )}

            </span>


            <div class="product-price">

                ₦${formatMoney(
                    customerPrice
                )}

            </div>


            <div class="product-controls">

                <button
                    type="button"
                    class="quantity-button decrease"
                >
                    −
                </button>


                <span class="quantity">

                    ${quantity}

                </span>


                <button
                    type="button"
                    class="quantity-button increase"
                >
                    +
                </button>


                <button
                    type="button"
                    class="remove-button"
                >
                    REMOVE
                </button>

            </div>

        </div>


        <strong class="item-total">

            ₦${formatMoney(
                itemTotal
            )}

        </strong>

    `;


    element
        .querySelector(
            ".decrease"
        )
        .addEventListener(
            "click",
            function() {

                changeQuantity(
                    index,
                    -1
                );

            }
        );


    element
        .querySelector(
            ".increase"
        )
        .addEventListener(
            "click",
            function() {

                changeQuantity(
                    index,
                    1
                );

            }
        );


    element
        .querySelector(
            ".remove-button"
        )
        .addEventListener(
            "click",
            function() {

                removeItem(
                    index
                );

            }
        );


    return element;

}


/* =====================================================
   CHANGE QUANTITY
===================================================== */

function changeQuantity(
    index,
    change
) {

    if (
        !cart[index]
    ) {

        return;

    }


    cart[index].quantity =
        Number(
            cart[index].quantity ||
            1
        ) +
        change;


    if (
        cart[index].quantity <= 0
    ) {

        cart.splice(
            index,
            1
        );

    }


    saveCart();

    renderCart();

}


/* =====================================================
   REMOVE ITEM
===================================================== */

function removeItem(
    index
) {

    if (
        !cart[index]
    ) {

        return;

    }


    cart.splice(
        index,
        1
    );


    saveCart();

    renderCart();

}


/* =====================================================
   SUMMARY
===================================================== */

function updateSummary() {

    let itemCount = 0;

    let subtotal = 0;

    let platformFee = 0;


    cart.forEach(
        function(item) {

            const quantity =
                Number(
                    item.quantity ||
                    1
                );


            const vendorPrice =
                Number(
                    item.vendorPrice ||
                    0
                );


            const itemFee =
                vendorPrice *
                PLATFORM_FEE_PERCENT /
                100;


            itemCount +=
                quantity;


            subtotal +=
                vendorPrice *
                quantity;


            platformFee +=
                itemFee *
                quantity;

        }
    );


    const total =
        subtotal +
        platformFee;


    itemCountElement.textContent =
        itemCount;


    subtotalElement.textContent =
        "₦" +
        formatMoney(
            subtotal
        );


    platformFeeElement.textContent =
        "₦" +
        formatMoney(
            platformFee
        );


    totalElement.textContent =
        "₦" +
        formatMoney(
            total
        );


    checkoutButton.disabled =
        cart.length === 0;

}


/* =====================================================
   EMPTY CART
===================================================== */

function renderEmptyCart() {

    cartItemsElement.innerHTML = `

        <div class="empty-cart">

            <h2>
                Your cart is empty
            </h2>

            <p>
                Browse the Dreypella Marketplace
                and add products to your cart.
            </p>

            <a
                href="marketplace.html"
                class="shop-button"
            >
                BROWSE MARKETPLACE
            </a>

        </div>

    `;

}


/* =====================================================
   CHECKOUT
===================================================== */

checkoutButton.addEventListener(
    "click",
    function() {

        if (
            cart.length === 0
        ) {

            showMessage(
                "Your cart is empty."
            );

            return;

        }


        if (
            !auth.currentUser
        ) {

            showMessage(
                "Please login before checkout."
            );


            setTimeout(
                function() {

                    window.location.href =
                        "login.html?redirect=customer-cart.html";

                },
                1000
            );

            return;

        }


        /*
         * Save the latest cart before
         * moving to checkout.
         */

        saveCart();


        window.location.href =
            "customer-checkout.html";

    }
);


/* =====================================================
   MESSAGE
===================================================== */

function showMessage(
    message
) {

    cartMessage.textContent =
        message;

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

        saveCart();

    }
);