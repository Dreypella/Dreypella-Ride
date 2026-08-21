/*
    =========================================
    DREYPELLA RIDE
    ADMIN MARKETPLACE MANAGEMENT
    =========================================

    Firestore collections:

        vendors
        products
        marketplaceOrders
        marketplaceCategories

    Vendor platform charge:

        5%

    Example:

        Vendor price = ₦10,000

        Platform fee = ₦500

        Customer price = ₦10,500

    IMPORTANT:

    This page is for ADMIN CONTROL.

    The customer should never be shown
    the internal vendor/platform split.
*/


const auth =
    firebase.auth();

const db =
    firebase.firestore();


/*
    =========================================
    ADMIN CONFIGURATION
    =========================================
*/


const PLATFORM_FEE_PERCENT =
    5;


/*
    =========================================
    ELEMENTS
    =========================================
*/


const totalVendors =
    document.getElementById(
        "totalVendors"
    );

const pendingVendors =
    document.getElementById(
        "pendingVendors"
    );

const totalProducts =
    document.getElementById(
        "totalProducts"
    );

const pendingProducts =
    document.getElementById(
        "pendingProducts"
    );

const totalOrders =
    document.getElementById(
        "totalOrders"
    );

const platformRevenue =
    document.getElementById(
        "platformRevenue"
    );


const vendorList =
    document.getElementById(
        "vendorList"
    );

const productList =
    document.getElementById(
        "productList"
    );

const orderList =
    document.getElementById(
        "orderList"
    );

const categoryList =
    document.getElementById(
        "categoryList"
    );


const vendorFilter =
    document.getElementById(
        "vendorFilter"
    );

const productFilter =
    document.getElementById(
        "productFilter"
    );

const orderFilter =
    document.getElementById(
        "orderFilter"
    );


const managementModal =
    document.getElementById(
        "managementModal"
    );

const modalContent =
    document.getElementById(
        "modalContent"
    );

const closeModal =
    document.getElementById(
        "closeModal"
    );


let vendorsCache = [];

let productsCache = [];

let ordersCache = [];

let categoriesCache = [];


/*
    =========================================
    ADMIN AUTHENTICATION
    =========================================
*/


auth.onAuthStateChanged(
    async function(user) {

        if (!user) {

            window.location.href =
                "admin-login.html";

            return;

        }


        /*
            IMPORTANT:

            Replace this check with your
            existing admin-role structure
            if your project already has one.
        */


        try {

            const adminDoc =
                await db
                    .collection("admins")
                    .doc(user.uid)
                    .get();


            if (
                !adminDoc.exists
            ) {

                console.error(
                    "User is not an administrator."
                );


                await auth.signOut();


                window.location.href =
                    "admin-login.html";


                return;

            }


            initializeAdminMarketplace();

        }
        catch(error) {

            console.error(
                "Admin verification error:",
                error
            );

        }

    }
);


/*
    =========================================
    INITIALIZE
    =========================================
*/


function initializeAdminMarketplace() {

    loadVendors();

    loadProducts();

    loadOrders();

    loadCategories();

}


/*
    =========================================
    VENDORS
    =========================================
*/


function loadVendors() {

    db.collection("vendors")

        .orderBy(
            "createdAt",
            "desc"
        )

        .onSnapshot(

            function(snapshot) {

                vendorsCache = [];


                snapshot.forEach(
                    function(doc) {

                        vendorsCache.push({

                            id:
                                doc.id,

                            ...doc.data()

                        });

                    }
                );


                renderVendors();

                updateVendorStats();

            },

            function(error) {

                console.error(
                    "Vendor loading error:",
                    error
                );


                vendorList.innerHTML =
                    errorMessage(
                        "Unable to load vendors."
                    );

            }

        );

}


function renderVendors() {

    const filter =
        vendorFilter.value;


    const vendors =
        vendorsCache.filter(
            function(vendor) {

                if (
                    filter ===
                    "ALL"
                ) {

                    return true;

                }


                return (
                    normalizeStatus(
                        vendor.status
                    ) ===
                    filter
                );

            }
        );


    if (
        vendors.length === 0
    ) {

        vendorList.innerHTML =
            emptyMessage(
                "No vendors found."
            );

        return;

    }


    vendorList.innerHTML = "";


    vendors.forEach(
        function(vendor) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "data-card";


            const status =
                normalizeStatus(
                    vendor.status ||
                    "PENDING"
                );


            card.innerHTML = `

                <div class="data-main">

                    <h3>
                        ${escapeHTML(
                            vendor.businessName ||
                            vendor.storeName ||
                            vendor.name ||
                            "Unnamed Vendor"
                        )}
                    </h3>


                    <p>
                        Owner:
                        <strong>
                            ${escapeHTML(
                                vendor.ownerName ||
                                vendor.name ||
                                "—"
                            )}
                        </strong>
                    </p>


                    <p>
                        Category:
                        ${escapeHTML(
                            vendor.category ||
                            vendor.businessType ||
                            "General"
                        )}
                    </p>


                    <p>
                        Phone:
                        ${escapeHTML(
                            vendor.phone ||
                            vendor.phoneNumber ||
                            "—"
                        )}
                    </p>


                    <p>

                        Status:

                        <span class="
                            status
                            status-${status.toLowerCase()}
                        ">
                            ${status}
                        </span>

                    </p>

                </div>


                <div class="data-actions">

                    <button
                        class="action-button view"
                        data-action="view-vendor"
                        data-id="${vendor.id}"
                    >
                        VIEW
                    </button>


                    ${
                        status !== "APPROVED"
                        ?

                        `
                        <button
                            class="action-button approve"
                            data-action="approve-vendor"
                            data-id="${vendor.id}"
                        >
                            APPROVE
                        </button>
                        `

                        :

                        ""
                    }


                    ${
                        status !== "SUSPENDED"
                        ?

                        `
                        <button
                            class="action-button suspend"
                            data-action="suspend-vendor"
                            data-id="${vendor.id}"
                        >
                            SUSPEND
                        </button>
                        `

                        :

                        ""
                    }

                </div>

            `;


            vendorList.appendChild(
                card
            );

        }
    );

}


/*
    =========================================
    VENDOR ACTIONS
    =========================================
*/


async function updateVendorStatus(
    vendorId,
    status
) {

    try {

        await db
            .collection("vendors")
            .doc(vendorId)
            .update({

                status:
                    status,

                updatedAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            });


    }
    catch(error) {

        console.error(
            "Vendor status error:",
            error
        );


        alert(
            "Unable to update vendor."
        );

    }

}


/*
    =========================================
    PRODUCTS
    =========================================
*/


function loadProducts() {

    db.collection("products")

        .orderBy(
            "createdAt",
            "desc"
        )

        .onSnapshot(

            function(snapshot) {

                productsCache = [];


                snapshot.forEach(
                    function(doc) {

                        productsCache.push({

                            id:
                                doc.id,

                            ...doc.data()

                        });

                    }
                );


                renderProducts();

                updateProductStats();

            },

            function(error) {

                console.error(
                    "Product loading error:",
                    error
                );


                productList.innerHTML =
                    errorMessage(
                        "Unable to load products."
                    );

            }

        );

}


function renderProducts() {

    const filter =
        productFilter.value;


    const products =
        productsCache.filter(
            function(product) {

                if (
                    filter ===
                    "ALL"
                ) {

                    return true;

                }


                const status =
                    normalizeStatus(
                        product.status ||
                        "PENDING"
                    );


                if (
                    filter ===
                    "OUT_OF_STOCK"
                ) {

                    return Number(
                        product.stock || 0
                    ) <= 0;

                }


                return (
                    status ===
                    filter
                );

            }
        );


    if (
        products.length === 0
    ) {

        productList.innerHTML =
            emptyMessage(
                "No products found."
            );

        return;

    }


    productList.innerHTML = "";


    products.forEach(
        function(product) {

            const vendorPrice =
                Number(
                    product.vendorPrice ??
                    product.price ??
                    0
                );


            const platformFee =
                calculatePlatformFee(
                    vendorPrice
                );


            const customerPrice =
                Number(
                    product.customerPrice ??
                    (
                        vendorPrice +
                        platformFee
                    )
                );


            const status =
                normalizeStatus(
                    product.status ||
                    "PENDING"
                );


            const stock =
                Number(
                    product.stock || 0
                );


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "data-card";


            card.innerHTML = `

                <div class="data-main">

                    <h3>
                        ${escapeHTML(
                            product.name ||
                            product.productName ||
                            "Unnamed Product"
                        )}
                    </h3>


                    <p>
                        Vendor:
                        <strong>
                            ${escapeHTML(
                                product.vendorName ||
                                "Marketplace Vendor"
                            )}
                        </strong>
                    </p>


                    <p>
                        Category:
                        ${escapeHTML(
                            product.category ||
                            "General"
                        )}
                    </p>


                    <div class="product-price">

                        <span class="vendor-price">

                            Vendor:
                            ₦${formatMoney(
                                vendorPrice
                            )}

                        </span>


                        <span class="fee">

                            +5%:
                            ₦${formatMoney(
                                platformFee
                            )}

                        </span>


                        <span class="customer-price">

                            Customer:
                            ₦${formatMoney(
                                customerPrice
                            )}

                        </span>

                    </div>


                    <p>
                        Stock:
                        ${stock}
                    </p>


                    <p>

                        Status:

                        <span class="
                            status
                            status-${status.toLowerCase()}
                        ">
                            ${status}
                        </span>

                    </p>

                </div>


                <div class="data-actions">

                    <button
                        class="action-button view"
                        data-action="view-product"
                        data-id="${product.id}"
                    >
                        VIEW
                    </button>


                    ${
                        status !== "APPROVED"
                        ?

                        `
                        <button
                            class="action-button approve"
                            data-action="approve-product"
                            data-id="${product.id}"
                        >
                            APPROVE
                        </button>
                        `

                        :

                        ""
                    }


                    ${
                        status !== "REJECTED"
                        ?

                        `
                        <button
                            class="action-button reject"
                            data-action="reject-product"
                            data-id="${product.id}"
                        >
                            REJECT
                        </button>
                        `

                        :

                        ""
                    }

                </div>

            `;


            productList.appendChild(
                card
            );

        }
    );

}


/*
    =========================================
    PRODUCT ACTIONS
    =========================================
*/


async function updateProductStatus(
    productId,
    status
) {

    try {

        const product =
            productsCache.find(
                function(item) {

                    return (
                        item.id ===
                        productId
                    );

                }
            );


        const updates = {

            status:
                status,

            updatedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp()

        };


        /*
            When product is approved,
            automatically preserve the
            5% pricing structure.
        */


        if (
            product
        ) {

            const vendorPrice =
                Number(
                    product.vendorPrice ??
                    product.price ??
                    0
                );


            const fee =
                calculatePlatformFee(
                    vendorPrice
                );


            updates.platformFeePercent =
                PLATFORM_FEE_PERCENT;


            updates.platformFee =
                fee;


            updates.customerPrice =
                vendorPrice + fee;

        }


        await db
            .collection("products")
            .doc(productId)
            .update(
                updates
            );

    }
    catch(error) {

        console.error(
            "Product status error:",
            error
        );


        alert(
            "Unable to update product."
        );

    }

}


/*
    =========================================
    ORDERS
    =========================================
*/


function loadOrders() {

    db.collection(
        "marketplaceOrders"
    )

        .orderBy(
            "createdAt",
            "desc"
        )

        .onSnapshot(

            function(snapshot) {

                ordersCache = [];


                snapshot.forEach(
                    function(doc) {

                        ordersCache.push({

                            id:
                                doc.id,

                            ...doc.data()

                        });

                    }
                );


                renderOrders();

                updateOrderStats();

            },

            function(error) {

                console.error(
                    "Order loading error:",
                    error
                );


                orderList.innerHTML =
                    errorMessage(
                        "Unable to load marketplace orders."
                    );

            }

        );

}


function renderOrders() {

    const filter =
        orderFilter.value;


    const orders =
        ordersCache.filter(
            function(order) {

                if (
                    filter ===
                    "ALL"
                ) {

                    return true;

                }


                return (
                    normalizeStatus(
                        order.status ||
                        "PENDING"
                    ) ===
                    filter
                );

            }
        );


    if (
        orders.length === 0
    ) {

        orderList.innerHTML =
            emptyMessage(
                "No marketplace orders found."
            );

        return;

    }


    orderList.innerHTML = "";


    orders.forEach(
        function(order) {

            const customerTotal =
                Number(
                    order.totalAmount ??
                    order.customerTotal ??
                    order.amount ??
                    0
                );


            /*
                Prefer the stored platform
                fee created by checkout.

                Fallback calculates 5%.
            */


            const fee =
                Number(
                    order.platformFee ??
                    (
                        customerTotal *
                        (
                            PLATFORM_FEE_PERCENT /
                            105
                        )
                    )
                );


            const vendorAmount =
                Number(
                    order.vendorAmount ??
                    (
                        customerTotal -
                        fee
                    )
                );


            const status =
                normalizeStatus(
                    order.status ||
                    "PENDING"
                );


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "data-card";


            card.innerHTML = `

                <div class="data-main">

                    <h3>

                        Order

                        #${escapeHTML(
                            order.orderNumber ||
                            order.orderReference ||
                            order.id.substring(0,8)
                        )}

                    </h3>


                    <p>

                        Customer:

                        <strong>
                            ${escapeHTML(
                                order.customerName ||
                                "Customer"
                            )}
                        </strong>

                    </p>


                    <p>

                        Vendor:

                        ${escapeHTML(
                            order.vendorName ||
                            "Vendor"
                        )}

                    </p>


                    <p>

                        Customer Paid:

                        <strong>
                            ₦${formatMoney(
                                customerTotal
                            )}
                        </strong>

                    </p>


                    <p>

                        Vendor Amount:

                        ₦${formatMoney(
                            vendorAmount
                        )}

                    </p>


                    <p>

                        Dreypella Platform:

                        <strong>
                            ₦${formatMoney(
                                fee
                            )}
                        </strong>

                    </p>


                    <p>

                        Status:

                        <span class="
                            status
                            status-${status.toLowerCase()}
                        ">
                            ${status}
                        </span>

                    </p>

                </div>


                <div class="data-actions">

                    <button
                        class="action-button view"
                        data-action="view-order"
                        data-id="${order.id}"
                    >
                        VIEW
                    </button>

                </div>

            `;


            orderList.appendChild(
                card
            );

        }
    );

}


/*
    =========================================
    CATEGORIES
    =========================================
*/


function loadCategories() {

    db.collection(
        "marketplaceCategories"
    )

        .orderBy(
            "name"
        )

        .onSnapshot(

            function(snapshot) {

                categoriesCache = [];


                snapshot.forEach(
                    function(doc) {

                        categoriesCache.push({

                            id:
                                doc.id,

                            ...doc.data()

                        });

                    }
                );


                renderCategories();

            },

            function(error) {

                console.error(
                    "Category loading error:",
                    error
                );

            }

        );

}


function renderCategories() {

    if (
        categoriesCache.length === 0
    ) {

        categoryList.innerHTML =
            emptyMessage(
                "No categories created yet."
            );

        return;

    }


    categoryList.innerHTML = "";


    categoriesCache.forEach(
        function(category) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "category-card";


            card.innerHTML = `

                <strong>
                    ${escapeHTML(
                        category.name
                    )}
                </strong>


                <span>
                    ${Number(
                        category.productCount || 0
                    )}
                    products
                </span>

            `;


            categoryList.appendChild(
                card
            );

        }
    );

}


/*
    =========================================
    ADD CATEGORY
    =========================================
*/


document
    .getElementById(
        "addCategoryButton"
    )
    .addEventListener(
        "click",
        addCategory
    );


async function addCategory() {

    const input =
        document.getElementById(
            "categoryInput"
        );


    const name =
        input.value.trim();


    if (!name) {

        alert(
            "Enter a category name."
        );

        return;

    }


    try {

        await db
            .collection(
                "marketplaceCategories"
            )
            .add({

                name:
                    name,

                productCount:
                    0,

                createdAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()

            });


        input.value =
            "";

    }
    catch(error) {

        console.error(
            "Category error:",
            error
        );


        alert(
            "Unable to add category."
        );

    }

}


/*
    =========================================
    STATS
    =========================================
*/


function updateVendorStats() {

    totalVendors.textContent =
        vendorsCache.length;


    pendingVendors.textContent =
        vendorsCache.filter(
            function(vendor) {

                return (
                    normalizeStatus(
                        vendor.status ||
                        "PENDING"
                    ) ===
                    "PENDING"
                );

            }
        ).length;

}


function updateProductStats() {

    totalProducts.textContent =
        productsCache.length;


    pendingProducts.textContent =
        productsCache.filter(
            function(product) {

                return (
                    normalizeStatus(
                        product.status ||
                        "PENDING"
                    ) ===
                    "PENDING"
                );

            }
        ).length;

}


function updateOrderStats() {

    totalOrders.textContent =
        ordersCache.length;


    let revenue =
        0;


    ordersCache.forEach(
        function(order) {

            /*
                Revenue is taken from
                the stored platform fee.

                If unavailable, calculate
                the 5% portion from the
                customer-facing total.
            */


            const customerTotal =
                Number(
                    order.totalAmount ??
                    order.customerTotal ??
                    order.amount ??
                    0
                );


            const fee =
                Number(
                    order.platformFee ??
                    (
                        customerTotal *
                        5 /
                        105
                    )
                );


            revenue +=
                fee;

        }
    );


    platformRevenue.textContent =
        "₦" +
        formatMoney(
            revenue
        );

}


/*
    =========================================
    FILTER EVENTS
    =========================================
*/


vendorFilter.addEventListener(
    "change",
    renderVendors
);


productFilter.addEventListener(
    "change",
    renderProducts
);


orderFilter.addEventListener(
    "change",
    renderOrders
);


/*
    =========================================
    TAB SYSTEM
    =========================================
*/


document
    .querySelectorAll(
        ".tab-button"
    )
    .forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    document
                        .querySelectorAll(
                            ".tab-button"
                        )
                        .forEach(
                            function(item) {

                                item.classList.remove(
                                    "active"
                                );

                            }
                        );


                    document
                        .querySelectorAll(
                            ".management-section"
                        )
                        .forEach(
                            function(section) {

                                section.classList.remove(
                                    "active"
                                );

                            }
                        );


                    button.classList.add(
                        "active"
                    );


                    const section =
                        document.getElementById(
                            button.dataset.section +
                            "Section"
                        );


                    if (
                        section
                    ) {

                        section.classList.add(
                            "active"
                        );

                    }

                }
            );

        }
    );


/*
    =========================================
    ACTION DELEGATION
    =========================================
*/


document.addEventListener(
    "click",
    async function(event) {

        const button =
            event.target.closest(
                "[data-action]"
            );


        if (!button) {

            return;

        }


        const action =
            button.dataset.action;


        const id =
            button.dataset.id;


        if (
            action ===
            "approve-vendor"
        ) {

            await updateVendorStatus(
                id,
                "APPROVED"
            );

        }


        if (
            action ===
            "suspend-vendor"
        ) {

            await updateVendorStatus(
                id,
                "SUSPENDED"
            );

        }


        if (
            action ===
            "approve-product"
        ) {

            await updateProductStatus(
                id,
                "APPROVED"
            );

        }


        if (
            action ===
            "reject-product"
        ) {

            await updateProductStatus(
                id,
                "REJECTED"
            );

        }


        if (
            action ===
            "view-vendor"
        ) {

            const vendor =
                vendorsCache.find(
                    function(item) {

                        return (
                            item.id ===
                            id
                        );

                    }
                );


            if (vendor) {

                showVendorModal(
                    vendor
                );

            }

        }


        if (
            action ===
            "view-product"
        ) {

            const product =
                productsCache.find(
                    function(item) {

                        return (
                            item.id ===
                            id
                        );

                    }
                );


            if (product) {

                showProductModal(
                    product
                );

            }

        }


        if (
            action ===
            "view-order"
        ) {

            const order =
                ordersCache.find(
                    function(item) {

                        return (
                            item.id ===
                            id
                        );

                    }
                );


            if (order) {

                showOrderModal(
                    order
                );

            }

        }

    }
);


/*
    =========================================
    MODALS
    =========================================
*/


function showVendorModal(
    vendor
) {

    modalContent.innerHTML = `

        <h2>
            ${escapeHTML(
                vendor.businessName ||
                vendor.storeName ||
                vendor.name ||
                "Vendor"
            )}
        </h2>


        <p>
            Owner:
            ${escapeHTML(
                vendor.ownerName ||
                vendor.name ||
                "—"
            )}
        </p>


        <p>
            Business Type:
            ${escapeHTML(
                vendor.businessType ||
                vendor.category ||
                "—"
            )}
        </p>


        <p>
            Phone:
            ${escapeHTML(
                vendor.phone ||
                vendor.phoneNumber ||
                "—"
            )}
        </p>


        <p>
            Email:
            ${escapeHTML(
                vendor.email ||
                "—"
            )}
        </p>


        <p>
            Status:
            ${escapeHTML(
                vendor.status ||
                "PENDING"
            )}
        </p>

    `;


    openModal();

}


function showProductModal(
    product
) {

    const vendorPrice =
        Number(
            product.vendorPrice ??
            product.price ??
            0
        );


    const fee =
        calculatePlatformFee(
            vendorPrice
        );


    const customerPrice =
        Number(
            product.customerPrice ??
            vendorPrice + fee
        );


    modalContent.innerHTML = `

        <h2>
            ${escapeHTML(
                product.name ||
                product.productName ||
                "Product"
            )}
        </h2>


        <p>
            Vendor:
            ${escapeHTML(
                product.vendorName ||
                "—"
            )}
        </p>


        <p>
            Category:
            ${escapeHTML(
                product.category ||
                "—"
            )}
        </p>


        <p>
            Vendor Price:
            ₦${formatMoney(
                vendorPrice
            )}
        </p>


        <p>
            Platform Fee (5%):
            ₦${formatMoney(
                fee
            )}
        </p>


        <p>
            Customer Price:
            ₦${formatMoney(
                customerPrice
            )}
        </p>


        <p>
            Stock:
            ${Number(
                product.stock || 0
            )}
        </p>


        <p>
            Status:
            ${escapeHTML(
                product.status ||
                "PENDING"
            )}
        </p>

    `;


    openModal();

}


function showOrderModal(
    order
) {

    const total =
        Number(
            order.totalAmount ??
            order.customerTotal ??
            order.amount ??
            0
        );


    const fee =
        Number(
            order.platformFee ??
            total * 5 / 105
        );


    const vendorAmount =
        Number(
            order.vendorAmount ??
            total - fee
        );


    modalContent.innerHTML = `

        <h2>
            Marketplace Order
        </h2>


        <p>
            Order:
            ${escapeHTML(
                order.orderNumber ||
                order.orderReference ||
                order.id
            )}
        </p>


        <p>
            Customer:
            ${escapeHTML(
                order.customerName ||
                "—"
            )}
        </p>


        <p>
            Vendor:
            ${escapeHTML(
                order.vendorName ||
                "—"
            )}
        </p>


        <p>
            Customer Paid:
            ₦${formatMoney(
                total
            )}
        </p>


        <p>
            Vendor Amount:
            ₦${formatMoney(
                vendorAmount
            )}
        </p>


        <p>
            Dreypella Platform:
            ₦${formatMoney(
                fee
            )}
        </p>


        <p>
            Status:
            ${escapeHTML(
                order.status ||
                "PENDING"
            )}
        </p>

    `;


    openModal();

}


function openModal() {

    managementModal.classList.add(
        "active"
    );

}


function closeManagementModal() {

    managementModal.classList.remove(
        "active"
    );

}


closeModal.addEventListener(
    "click",
    closeManagementModal
);


managementModal.addEventListener(
    "click",
    function(event) {

        if (
            event.target ===
            managementModal
        ) {

            closeManagementModal();

        }

    }
);


/*
    =========================================
    LOGOUT
    =========================================
*/


document
    .getElementById(
        "logoutButton"
    )
    .addEventListener(
        "click",
        async function() {

            try {

                await auth.signOut();

                window.location.href =
                    "admin-login.html";

            }
            catch(error) {

                console.error(
                    error
                );

            }

        }
    );


/*
    =========================================
    5% PLATFORM FEE
    =========================================
*/


function calculatePlatformFee(
    vendorPrice
) {

    return (
        Number(vendorPrice || 0) *
        PLATFORM_FEE_PERCENT /
        100
    );

}


/*
    =========================================
    HELPERS
    =========================================
*/


function normalizeStatus(
    status
) {

    return String(
        status ||
        ""
    )
        .trim()
        .toUpperCase()
        .replace(
            /[\s-]+/g,
            "_"
        );

}


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


function emptyMessage(
    message
) {

    return `

        <div class="loading">

            ${escapeHTML(
                message
            )}

        </div>

    `;

}


function errorMessage(
    message
) {

    return `

        <div class="loading">

            ${escapeHTML(
                message
            )}

        </div>

    `;

}