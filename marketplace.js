/*
    DREYPELLA RIDE
    MARKETPLACE
*/

const auth = firebase.auth();
const db = firebase.firestore();


const productGrid =
    document.getElementById("productGrid");

const productMessage =
    document.getElementById("productMessage");

const searchInput =
    document.getElementById("searchInput");

const searchButton =
    document.getElementById("searchButton");

const categoryList =
    document.getElementById("categoryList");

const sortProducts =
    document.getElementById("sortProducts");

const cartButton =
    document.getElementById("cartButton");

const cartPanel =
    document.getElementById("cartPanel");

const cartOverlay =
    document.getElementById("cartOverlay");

const closeCart =
    document.getElementById("closeCart");

const cartItems =
    document.getElementById("cartItems");

const cartCount =
    document.getElementById("cartCount");

const cartSubtotal =
    document.getElementById("cartSubtotal");

const cartPlatformFee =
    document.getElementById("cartPlatformFee");

const cartTotal =
    document.getElementById("cartTotal");

const checkoutButton =
    document.getElementById("checkoutButton");


let products = [];

let filteredProducts = [];

let cart = [];

let activeCategory = "ALL";


/*
    PLATFORM FEE

    IMPORTANT:

    This is for DISPLAY ONLY.

    The actual 5% must also be
    calculated securely on the
    server/backend before payment.
*/

const PLATFORM_FEE_PERCENTAGE = 5;


/*
    LOAD CART
*/

try {

    cart =
        JSON.parse(
            localStorage.getItem(
                "dreypellaCart"
            )
        ) || [];

}
catch(error) {

    cart = [];

}


/*
    LOAD PRODUCTS
*/

loadProducts();


function loadProducts() {

    showMessage(
        "Loading marketplace..."
    );

    db.collection("products")

        .where(
            "status",
            "==",
            "APPROVED"
        )

        .onSnapshot(

            function(snapshot) {

                products = [];

                snapshot.forEach(
                    function(doc) {

                        products.push({

                            id:
                                doc.id,

                            ...doc.data()

                        });

                    }
                );

                applyFilters();

            },

            function(error) {

                console.error(
                    error
                );

                showMessage(
                    "Unable to load marketplace products."
                );

            }

        );

}


/*
    CATEGORY
*/

categoryList.addEventListener(
    "click",
    function(event) {

        const button =
            event.target.closest(
                "button"
            );

        if (!button) {

            return;

        }

        activeCategory =
            button.dataset.category;

        document
            .querySelectorAll(
                ".category-list button"
            )
            .forEach(
                function(item) {

                    item.classList.remove(
                        "active"
                    );

                }
            );

        button.classList.add(
            "active"
        );

        applyFilters();

    }
);


/*
    SEARCH
*/

searchButton.addEventListener(
    "click",
    applyFilters
);


searchInput.addEventListener(
    "input",
    applyFilters
);


sortProducts.addEventListener(
    "change",
    applyFilters
);


function applyFilters() {

    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    filteredProducts =
        products.filter(
            function(product) {

                const matchesCategory =
                    activeCategory === "ALL" ||
                    product.category ===
                    activeCategory;


                const searchableText = (

                    product.name ||
                    ""

                ).toLowerCase();


                const description = (

                    product.description ||
                    ""

                ).toLowerCase();


                const matchesSearch =
                    !search ||
                    searchableText.includes(search) ||
                    description.includes(search);


                return (
                    matchesCategory &&
                    matchesSearch
                );

            }
        );


    sortProductsList();

    renderProducts();

}


/*
    SORT
*/

function sortProductsList() {

    const value =
        sortProducts.value;


    if (
        value === "priceLow"
    ) {

        filteredProducts.sort(
            function(a, b) {

                return Number(
                    a.customerPrice ??
                    a.vendorPrice ??
                    a.price ??
                    0
                ) -
                Number(
                    b.customerPrice ??
                    b.vendorPrice ??
                    b.price ??
                    0
                );

            }
        );

    }


    if (
        value === "priceHigh"
    ) {

        filteredProducts.sort(
            function(a, b) {

                return Number(
                    b.customerPrice ??
                    b.vendorPrice ??
                    b.price ??
                    0
                ) -
                Number(
                    a.customerPrice ??
                    a.vendorPrice ??
                    a.price ??
                    0
                );

            }
        );

    }


    if (
        value === "newest"
    ) {

        filteredProducts.sort(
            function(a, b) {

                return getTimestamp(
                    b.createdAt
                ) -
                getTimestamp(
                    a.createdAt
                );

            }
        );

    }

}


/*
    RENDER
*/

function renderProducts() {

    productGrid.innerHTML = "";


    if (
        filteredProducts.length === 0
    ) {

        productGrid.innerHTML = `

            <div class="message">

                No products found.

            </div>

        `;

        return;

    }


    filteredProducts.forEach(
        function(product) {

            productGrid.appendChild(
                createProductCard(
                    product
                )
            );

        }
    );

}


function createProductCard(product) {

    const card =
        document.createElement(
            "article"
        );


    const vendorPrice =
        Number(
            product.vendorPrice ??
            product.price ??
            0
        );

    const customerPrice =
        Number(
            product.customerPrice ??
            calculateCustomerPrice(
                vendorPrice
            )
        );


    card.className =
        "product-card";


    card.innerHTML = `

        <img
            class="product-image"
            src="${
                escapeHTML(
                    product.imageUrl ||
                    "https://via.placeholder.com/500x400?text=Dreypella"
                )
            }"
            alt="${
                escapeHTML(
                    product.name
                )
            }"
        >


        <div class="product-content">

            <span class="product-category">

                ${escapeHTML(
                    product.category
                )}

            </span>


            <h3 class="product-name">

                ${escapeHTML(
                    product.name
                )}

            </h3>


            <div class="product-vendor">

                ${
                    escapeHTML(
                        product.vendorName ||
                        "Dreypella Vendor"
                    )
                }

            </div>


            <div class="product-price">

                ₦${formatMoney(
                    customerPrice
                )}

            </div>


            <div class="platform-note">

                Includes marketplace platform charge

            </div>


            <button
                class="add-cart"
                data-id="${product.id}"
            >

                ADD TO CART

            </button>

        </div>

    `;


    card
        .querySelector(".add-cart")
        .addEventListener(
            "click",
            function() {

                addToCart(
                    product
                );

            }
        );


    return card;

}


/*
    5% PLATFORM FEE
*/

function calculatePlatformFee(
    vendorPrice
) {

    return (
        Number(vendorPrice || 0) *
        PLATFORM_FEE_PERCENTAGE /
        100
    );

}


function calculateCustomerPrice(
    vendorPrice
) {

    return (
        Number(vendorPrice || 0) +
        calculatePlatformFee(
            vendorPrice
        )
    );

}


/*
    CART
*/

function addToCart(product) {

    const existing =
        cart.find(
            function(item) {

                return item.productId ===
                    product.id;

            }
        );


    if (existing) {

        existing.quantity += 1;

    }
    else {

        cart.push({

            productId:
                product.id,

            name:
                product.name,

            vendorId:
                product.vendorId,

            vendorName:
                product.vendorName,

            vendorPrice:
                Number(
                    product.vendorPrice ??
                    product.price ??
                    0
                ),

            platformFee:
                Number(
                    product.platformFee ??
                    calculatePlatformFee(
                        product.vendorPrice ??
                        product.price ??
                        0
                    )
                ),

            customerPrice:
                Number(
                    product.customerPrice ??
                    calculateCustomerPrice(
                        product.vendorPrice ??
                        product.price ??
                        0
                    )
                ),

            quantity:
                1,

            imageUrl:
                product.imageUrl || "",

            category:
                product.category || ""

        });

    }


    saveCart();

    renderCart();

    openCart();

}


/*
    REMOVE
*/

function removeFromCart(
    productId
) {

    cart =
        cart.filter(
            function(item) {

                return item.productId !==
                    productId;

            }
        );


    saveCart();

    renderCart();

}


/*
    QUANTITY
*/

function changeQuantity(
    productId,
    amount
) {

    const item =
        cart.find(
            function(item) {

                return item.productId ===
                    productId;

            }
        );


    if (!item) {

        return;

    }


    item.quantity += amount;


    if (
        item.quantity <= 0
    ) {

        removeFromCart(
            productId
        );

        return;

    }


    saveCart();

    renderCart();

}


/*
    RENDER CART
*/

function renderCart() {

    cartItems.innerHTML = "";


    let subtotal = 0;

    let fee = 0;


    cart.forEach(
        function(item) {

            const itemSubtotal =
                item.vendorPrice *
                item.quantity;


            const itemFee =
                calculatePlatformFee(
                    itemSubtotal
                );


            subtotal +=
                itemSubtotal;

            fee +=
                itemFee;


            const customerItemTotal =
                itemSubtotal +
                itemFee;


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "cart-item";


            element.innerHTML = `

                <div>

                    <strong>
                        ${escapeHTML(
                            item.name
                        )}
                    </strong>

                    <div>
                        ₦${formatMoney(
                            customerItemTotal
                        )}
                    </div>

                    <small>
                        Quantity:
                        ${item.quantity}
                    </small>

                </div>


                <div>

                    <button
                        onclick="changeQuantity(
                            '${item.productId}',
                            -1
                        )"
                    >
                        −
                    </button>


                    <button
                        onclick="changeQuantity(
                            '${item.productId}',
                            1
                        )"
                    >
                        +
                    </button>


                    <button
                        onclick="removeFromCart(
                            '${item.productId}'
                        )"
                    >
                        ×
                    </button>

                </div>

            `;


            cartItems.appendChild(
                element
            );

        }
    );


    cartSubtotal.textContent =
        "₦" +
        formatMoney(
            subtotal
        );


    cartPlatformFee.textContent =
        "₦" +
        formatMoney(
            fee
        );


    cartTotal.textContent =
        "₦" +
        formatMoney(
            subtotal + fee
        );


    cartCount.textContent =
        cart.reduce(
            function(total, item) {

                return total +
                    item.quantity;

            },
            0
        );

}


/*
    SAVE CART
*/

function saveCart() {

    localStorage.setItem(
        "dreypellaCart",
        JSON.stringify(
            cart
        )
    );

}


/*
    CART UI
*/

cartButton.addEventListener(
    "click",
    openCart
);


closeCart.addEventListener(
    "click",
    closeCartPanel
);


cartOverlay.addEventListener(
    "click",
    closeCartPanel
);


function openCart() {

    cartPanel.classList.remove(
        "hidden"
    );

    cartOverlay.classList.remove(
        "hidden"
    );

    renderCart();

}


function closeCartPanel() {

    cartPanel.classList.add(
        "hidden"
    );

    cartOverlay.classList.add(
        "hidden"
    );

}


/*
    CHECKOUT
*/

checkoutButton.addEventListener(
    "click",
    function() {

        if (
            cart.length === 0
        ) {

            alert(
                "Your cart is empty."
            );

            return;

        }


        if (
            !auth.currentUser
        ) {

            window.location.href =
                "login.html?redirect=marketplace.html";

            return;

        }


        /*
            We will connect this to
            the secure checkout/payment
            system next.
        */

        window.location.href =
            "marketplace-checkout.html";

    }
);


/*
    HELPERS
*/

function showMessage(message) {

    productMessage.textContent =
        message;

}


function formatMoney(amount) {

    return Number(
        amount
    ).toLocaleString(
        "en-NG",
        {
            maximumFractionDigits:
                2
        }
    );

}


function getTimestamp(value) {

    if (
        value &&
        value.toMillis
    ) {

        return value.toMillis();

    }


    return 0;

}


function escapeHTML(value) {

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


renderCart();