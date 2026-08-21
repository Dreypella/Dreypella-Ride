/* =========================================
   DREYPELLA RIDE
   VENDOR PRODUCT MANAGEMENT
   ========================================= */


/* FIREBASE */

const auth =
    firebase.auth();

const db =
    firebase.firestore();


/* =========================================
   CONFIGURATION
   ========================================= */

const PLATFORM_FEE_RATE =
    0.05;


/* =========================================
   ELEMENTS
   ========================================= */

const productsGrid =
    document.getElementById(
        "productsGrid"
    );

const totalProducts =
    document.getElementById(
        "totalProducts"
    );

const activeProducts =
    document.getElementById(
        "activeProducts"
    );

const outOfStockProducts =
    document.getElementById(
        "outOfStockProducts"
    );

const categoryCount =
    document.getElementById(
        "categoryCount"
    );

const productSearch =
    document.getElementById(
        "productSearch"
    );

const categoryFilter =
    document.getElementById(
        "categoryFilter"
    );

const statusFilter =
    document.getElementById(
        "statusFilter"
    );

const addProductButton =
    document.getElementById(
        "addProductButton"
    );

const productModal =
    document.getElementById(
        "productModal"
    );

const closeModal =
    document.getElementById(
        "closeModal"
    );

const productForm =
    document.getElementById(
        "productForm"
    );

const modalTitle =
    document.getElementById(
        "modalTitle"
    );

const productId =
    document.getElementById(
        "productId"
    );

const productName =
    document.getElementById(
        "productName"
    );

const productCategory =
    document.getElementById(
        "productCategory"
    );

const productDescription =
    document.getElementById(
        "productDescription"
    );

const vendorPrice =
    document.getElementById(
        "vendorPrice"
    );

const stockQuantity =
    document.getElementById(
        "stockQuantity"
    );

const productVariants =
    document.getElementById(
        "productVariants"
    );

const productImage =
    document.getElementById(
        "productImage"
    );

const productStatus =
    document.getElementById(
        "productStatus"
    );

const formMessage =
    document.getElementById(
        "formMessage"
    );

const saveProductButton =
    document.getElementById(
        "saveProductButton"
    );

const vendorPricePreview =
    document.getElementById(
        "vendorPricePreview"
    );

const platformFeePreview =
    document.getElementById(
        "platformFeePreview"
    );

const customerPricePreview =
    document.getElementById(
        "customerPricePreview"
    );


let allProducts = [];


/* =========================================
   AUTHENTICATION
   ========================================= */

auth.onAuthStateChanged(
    function(user) {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        loadProducts();

    }
);


/* =========================================
   LOAD PRODUCTS
   ========================================= */

async function loadProducts() {

    productsGrid.innerHTML = `

        <div class="loading">
            Loading products...
        </div>

    `;


    try {

        /*
         * IMPORTANT:
         *
         * Products belong to the
         * currently authenticated vendor.
         */


        const snapshot =
            await db
                .collection("products")
                .where(
                    "vendorId",
                    "==",
                    auth.currentUser.uid
                )
                .get();


        allProducts = [];


        snapshot.forEach(
            function(doc) {

                allProducts.push({

                    id:
                        doc.id,

                    ...doc.data()

                });

            }
        );


        updateSummary();

        renderProducts();


    }
    catch(error) {

        console.error(
            "Product loading error:",
            error
        );


        productsGrid.innerHTML = `

            <div class="empty">

                Unable to load your products.

                <br><br>

                Please refresh the page.

            </div>

        `;

    }

}


/* =========================================
   SUMMARY
   ========================================= */

function updateSummary() {

    const total =
        allProducts.length;


    const active =
        allProducts.filter(
            function(product) {

                return (
                    product.status ===
                    "ACTIVE"
                );

            }
        ).length;


    const out =
        allProducts.filter(
            function(product) {

                return (
                    Number(
                        product.stockQuantity ||
                        0
                    ) <= 0
                );

            }
        ).length;


    const categories =
        new Set(
            allProducts.map(
                function(product) {

                    return product.category;

                }
            )
        );


    totalProducts.textContent =
        total;


    activeProducts.textContent =
        active;


    outOfStockProducts.textContent =
        out;


    categoryCount.textContent =
        categories.size;

}


/* =========================================
   RENDER PRODUCTS
   ========================================= */

function renderProducts() {

    const search =
        productSearch.value
            .trim()
            .toLowerCase();


    const category =
        categoryFilter.value;


    const status =
        statusFilter.value;


    const filtered =
        allProducts.filter(
            function(product) {


                const matchesSearch =
                    !search ||
                    String(
                        product.name ||
                        ""
                    )
                    .toLowerCase()
                    .includes(search);


                const matchesCategory =
                    category ===
                    "ALL" ||
                    product.category ===
                    category;


                let matchesStatus =
                    true;


                if (
                    status ===
                    "ACTIVE"
                ) {

                    matchesStatus =
                        product.status ===
                        "ACTIVE" &&
                        Number(
                            product.stockQuantity ||
                            0
                        ) > 0;

                }


                if (
                    status ===
                    "INACTIVE"
                ) {

                    matchesStatus =
                        product.status ===
                        "INACTIVE";

                }


                if (
                    status ===
                    "OUT_OF_STOCK"
                ) {

                    matchesStatus =
                        Number(
                            product.stockQuantity ||
                            0
                        ) <= 0;

                }


                return (
                    matchesSearch &&
                    matchesCategory &&
                    matchesStatus
                );

            }
        );


    productsGrid.innerHTML = "";


    if (
        filtered.length === 0
    ) {

        productsGrid.innerHTML = `

            <div class="empty">

                No products found.

                <br><br>

                <button
                    class="primary-button"
                    onclick="openAddProduct()"
                >
                    ADD YOUR FIRST PRODUCT
                </button>

            </div>

        `;

        return;

    }


    filtered.forEach(
        function(product) {

            productsGrid.appendChild(
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
            "article"
        );


    card.className =
        "product-card";


    const vendorAmount =
        Number(
            product.vendorPrice ||
            product.price ||
            0
        );


    const platformFee =
        Number(
            product.platformFee ||
            vendorAmount *
            PLATFORM_FEE_RATE
        );


    const customerAmount =
        Number(
            product.customerPrice ||
            vendorAmount +
            platformFee
        );


    const stock =
        Number(
            product.stockQuantity ||
            0
        );


    let statusClass =
        "active";


    let statusText =
        "ACTIVE";


    if (
        stock <= 0
    ) {

        statusClass =
            "out";

        statusText =
            "OUT OF STOCK";

    }
    else if (
        product.status !==
        "ACTIVE"
    ) {

        statusClass =
            "inactive";

        statusText =
            "INACTIVE";

    }


    const imageHTML =
        product.imageUrl
            ? `

                <img
                    src="${escapeHTML(
                        product.imageUrl
                    )}"
                    alt="${escapeHTML(
                        product.name
                    )}"
                >

              `
            : `

                <div class="image-placeholder">
                    🛍️
                </div>

              `;


    card.innerHTML = `

        <div class="product-image">

            ${imageHTML}

        </div>


        <div class="product-body">


            <span class="product-category">

                ${escapeHTML(
                    formatCategory(
                        product.category
                    )
                )}

            </span>


            <h3 class="product-name">

                ${escapeHTML(
                    product.name ||
                    "Unnamed Product"
                )}

            </h3>


            <p class="product-description">

                ${escapeHTML(
                    product.description ||
                    "No description"
                )}

            </p>


            <div class="price-row">

                <span class="vendor-price">

                    Vendor:
                    ₦${formatMoney(
                        vendorAmount
                    )}

                </span>


                <span class="customer-price">

                    ₦${formatMoney(
                        customerAmount
                    )}

                </span>

            </div>


            <div class="stock">

                Stock:
                ${stock}

            </div>


            <span class="status ${statusClass}">

                ${statusText}

            </span>


            <div class="product-actions">

                <button
                    type="button"
                    class="edit-button"
                >
                    EDIT
                </button>


                <button
                    type="button"
                    class="delete"
                >
                    DELETE
                </button>

            </div>


        </div>

    `;


    card
        .querySelector(
            ".edit-button"
        )
        .addEventListener(
            "click",
            function() {

                openEditProduct(
                    product
                );

            }
        );


    card
        .querySelector(
            ".delete"
        )
        .addEventListener(
            "click",
            function() {

                deleteProduct(
                    product.id
                );

            }
        );


    return card;

}


/* =========================================
   OPEN ADD PRODUCT
   ========================================= */

addProductButton.addEventListener(
    "click",
    openAddProduct
);


function openAddProduct() {

    productForm.reset();


    productId.value =
        "";


    modalTitle.textContent =
        "Add Product";


    saveProductButton.textContent =
        "SAVE PRODUCT";


    productModal.classList.remove(
        "hidden"
    );


    updatePricePreview();

}


/* =========================================
   OPEN EDIT PRODUCT
   ========================================= */

function openEditProduct(
    product
) {

    productId.value =
        product.id;


    productName.value =
        product.name ||
        "";


    productCategory.value =
        product.category ||
        "";


    productDescription.value =
        product.description ||
        "";


    vendorPrice.value =
        product.vendorPrice ||
        product.price ||
        "";


    stockQuantity.value =
        product.stockQuantity ||
        0;


    productVariants.value =
        Array.isArray(
            product.variants
        )
            ? product.variants.join(", ")
            : product.variants ||
              "";


    productImage.value =
        product.imageUrl ||
        "";


    productStatus.value =
        product.status ||
        "ACTIVE";


    modalTitle.textContent =
        "Edit Product";


    saveProductButton.textContent =
        "UPDATE PRODUCT";


    formMessage.textContent =
        "";


    productModal.classList.remove(
        "hidden"
    );


    updatePricePreview();

}


/* =========================================
   CLOSE MODAL
   ========================================= */

closeModal.addEventListener(
    "click",
    closeProductModal
);


productModal.addEventListener(
    "click",
    function(event) {

        if (
            event.target ===
            productModal
        ) {

            closeProductModal();

        }

    }
);


function closeProductModal() {

    productModal.classList.add(
        "hidden"
    );

}


/* =========================================
   PRICE CALCULATION
   ========================================= */

vendorPrice.addEventListener(
    "input",
    updatePricePreview
);


function updatePricePreview() {

    const price =
        Number(
            vendorPrice.value ||
            0
        );


    const platformFee =
        price *
        PLATFORM_FEE_RATE;


    const customerPrice =
        price +
        platformFee;


    vendorPricePreview.textContent =
        "₦" +
        formatMoney(
            price
        );


    platformFeePreview.textContent =
        "₦" +
        formatMoney(
            platformFee
        );


    customerPricePreview.textContent =
        "₦" +
        formatMoney(
            customerPrice
        );

}


/* =========================================
   SAVE PRODUCT
   ========================================= */

productForm.addEventListener(
    "submit",
    saveProduct
);


async function saveProduct(
    event
) {

    event.preventDefault();


    clearMessage(
        formMessage
    );


    const user =
        auth.currentUser;


    if (!user) {

        showFormMessage(
            "Please login again.",
            "error"
        );

        return;

    }


    const name =
        productName.value.trim();


    const category =
        productCategory.value;


    const description =
        productDescription.value.trim();


    const price =
        Number(
            vendorPrice.value
        );


    const stock =
        Number(
            stockQuantity.value
        );


    if (
        !name ||
        !category ||
        !description
    ) {

        showFormMessage(
            "Please complete all required product fields.",
            "error"
        );

        return;

    }


    if (
        price < 0 ||
        !Number.isFinite(price)
    ) {

        showFormMessage(
            "Please enter a valid product price.",
            "error"
        );

        return;

    }


    if (
        stock < 0 ||
        !Number.isInteger(stock)
    ) {

        showFormMessage(
            "Stock quantity must be a whole number.",
            "error"
        );

        return;

    }


    const platformFee =
        Number(
            (
                price *
                PLATFORM_FEE_RATE
            ).toFixed(2)
        );


    const customerPrice =
        Number(
            (
                price +
                platformFee
            ).toFixed(2)
        );


    const variantsText =
        productVariants.value.trim();


    const variants =
        variantsText
            ? variantsText
                .split(",")
                .map(
                    function(item) {

                        return item.trim();

                    }
                )
                .filter(Boolean)
            : [];


    const productData = {

        name:
            name,

        category:
            category,

        description:
            description,

        vendorId:
            user.uid,

        vendorPrice:
            price,

        platformFeeRate:
            5,

        platformFee:
            platformFee,

        customerPrice:
            customerPrice,

        stockQuantity:
            stock,

        variants:
            variants,

        imageUrl:
            productImage.value.trim() ||
            "",

        status:
            productStatus.value,

        updatedAt:
            firebase.firestore
                .FieldValue
                .serverTimestamp()

    };


    saveProductButton.disabled =
        true;


    saveProductButton.textContent =
        "SAVING...";


    try {

        if (
            productId.value
        ) {

            /*
             * UPDATE
             */

            await db
                .collection("products")
                .doc(
                    productId.value
                )
                .update(
                    productData
                );


            showFormMessage(
                "Product updated successfully.",
                "success"
            );

        }
        else {

            /*
             * CREATE
             */

            productData.createdAt =
                firebase.firestore
                    .FieldValue
                    .serverTimestamp();


            await db
                .collection("products")
                .add(
                    productData
                );


            showFormMessage(
                "Product added successfully.",
                "success"
            );

        }


        await loadProducts();


        setTimeout(
            function() {

                closeProductModal();

            },
            700
        );


    }
    catch(error) {

        console.error(
            "Product save error:",
            error
        );


        showFormMessage(
            "Unable to save product. Please try again.",
            "error"
        );

    }
    finally {

        saveProductButton.disabled =
            false;


        saveProductButton.textContent =
            productId.value
                ? "UPDATE PRODUCT"
                : "SAVE PRODUCT";

    }

}


/* =========================================
   DELETE PRODUCT
   ========================================= */

async function deleteProduct(
    id
) {

    const confirmed =
        window.confirm(
            "Are you sure you want to delete this product?"
        );


    if (!confirmed) {

        return;

    }


    try {

        await db
            .collection("products")
            .doc(id)
            .delete();


        showMessage(
            "Product deleted successfully.",
            "success"
        );


        await loadProducts();

    }
    catch(error) {

        console.error(
            "Delete product error:",
            error
        );


        showMessage(
            "Unable to delete product.",
            "error"
        );

    }

}


/* =========================================
   FILTER EVENTS
   ========================================= */

productSearch.addEventListener(
    "input",
    renderProducts
);


categoryFilter.addEventListener(
    "change",
    renderProducts
);


statusFilter.addEventListener(
    "change",
    renderProducts
);


/* =========================================
   CATEGORY
   ========================================= */

function formatCategory(
    category
) {

    const categories = {

        FOOD:
            "Food",

        FASHION:
            "Clothes / Fashion",

        ELECTRONICS:
            "Electronics",

        GROCERIES:
            "Groceries",

        BEAUTY:
            "Beauty / Cosmetics",

        ACCESSORIES:
            "Accessories",

        SERVICES:
            "Services",

        OTHER:
            "Other"

    };


    return (
        categories[category] ||
        "Other"
    );

}


/* =========================================
   MONEY
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
   MESSAGE
   ========================================= */

function showMessage(
    message,
    type
) {

    const element =
        document.getElementById(
            "productMessage"
        );


    element.textContent =
        message;


    element.className =
        "message " +
        type;

}


function showFormMessage(
    message,
    type
) {

    formMessage.textContent =
        message;


    formMessage.className =
        "message " +
        type;

}


function clearMessage(
    element
) {

    element.textContent =
        "";

    element.className =
        "message";

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