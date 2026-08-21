/*
    =========================================
    DREYPELLA RIDE
    CUSTOMER WALLET
    =========================================
*/


const auth =
    firebase.auth();

const db =
    firebase.firestore();

const functions =
    firebase.functions();



/* =========================================
   ELEMENTS
   ========================================= */

const availableBalance =
    document.getElementById(
        "availableBalance"
    );

const pendingBalance =
    document.getElementById(
        "pendingBalance"
    );

const lifetimeSpent =
    document.getElementById(
        "lifetimeSpent"
    );

const walletStatus =
    document.getElementById(
        "walletStatus"
    );

const walletType =
    document.getElementById(
        "walletType"
    );

const transactionList =
    document.getElementById(
        "transactionList"
    );

const emptyTransactions =
    document.getElementById(
        "emptyTransactions"
    );

const loadMoreButton =
    document.getElementById(
        "loadMoreButton"
    );

const fundWalletModal =
    document.getElementById(
        "fundWalletModal"
    );

const withdrawModal =
    document.getElementById(
        "withdrawModal"
    );

const transactionModal =
    document.getElementById(
        "transactionModal"
    );

const fundWalletForm =
    document.getElementById(
        "fundWalletForm"
    );

const withdrawForm =
    document.getElementById(
        "withdrawForm"
    );

const fundAmount =
    document.getElementById(
        "fundAmount"
    );

const withdrawAmount =
    document.getElementById(
        "withdrawAmount"
    );

const bankCode =
    document.getElementById(
        "bankCode"
    );

const accountNumber =
    document.getElementById(
        "accountNumber"
    );

const accountName =
    document.getElementById(
        "accountName"
    );

const fundMessage =
    document.getElementById(
        "fundMessage"
    );

const withdrawMessage =
    document.getElementById(
        "withdrawMessage"
    );

const transactionDetails =
    document.getElementById(
        "transactionDetails"
    );



/* =========================================
   STATE
   ========================================= */

let currentUser = null;

let walletListener = null;

let transactionListener = null;

let transactions = [];



/* =========================================
   AUTHENTICATION
   ========================================= */

auth.onAuthStateChanged(
    function(user) {

        currentUser =
            user;


        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        startWallet();

    }
);



/* =========================================
   START WALLET
   ========================================= */

function startWallet() {

    listenToWallet();

    listenToTransactions();

}



/* =========================================
   WALLET LISTENER
   ========================================= */

function listenToWallet() {

    if (
        walletListener
    ) {

        walletListener();

    }


    walletListener =
        db
            .collection("wallets")
            .doc(currentUser.uid)
            .onSnapshot(

                function(snapshot) {

                    if (
                        !snapshot.exists
                    ) {

                        showNoWallet();

                        return;

                    }


                    renderWallet(
                        snapshot.data()
                    );

                },

                function(error) {

                    console.error(
                        "Wallet listener error:",
                        error
                    );


                    walletStatus.textContent =
                        "Unable to load wallet";

                }

            );

}



/* =========================================
   RENDER WALLET
   ========================================= */

function renderWallet(
    wallet
) {

    availableBalance.textContent =
        formatMoney(
            wallet.availableBalance
        );


    pendingBalance.textContent =
        formatMoney(
            wallet.pendingBalance
        );


    lifetimeSpent.textContent =
        formatMoney(
            wallet.lifetimeSpent
        );


    walletStatus.textContent =
        wallet.status ||
        "ACTIVE";


    walletType.textContent =
        wallet.walletType ||
        "CUSTOMER";

}



/* =========================================
   NO WALLET
   ========================================= */

function showNoWallet() {

    availableBalance.textContent =
        "₦0.00";

    pendingBalance.textContent =
        "₦0.00";

    lifetimeSpent.textContent =
        "₦0.00";

    walletStatus.textContent =
        "Wallet not initialized";

}



/* =========================================
   TRANSACTION LISTENER
   ========================================= */

function listenToTransactions() {

    if (
        transactionListener
    ) {

        transactionListener();

    }


    transactionListener =
        db
            .collection(
                "walletTransactions"
            )
            .where(
                "userId",
                "==",
                currentUser.uid
            )
            .orderBy(
                "createdAt",
                "desc"
            )
            .limit(30)
            .onSnapshot(

                function(snapshot) {

                    transactions = [];


                    snapshot.forEach(
                        function(doc) {

                            transactions.push({

                                id:
                                    doc.id,

                                ...doc.data()

                            });

                        }
                    );


                    renderTransactions();

                },

                function(error) {

                    console.error(
                        "Transaction listener error:",
                        error
                    );


                    transactionList.innerHTML = `

                        <div class="empty-state">

                            <h3>
                                Unable to load transactions
                            </h3>

                            <p>
                                Please refresh and try again.
                            </p>

                        </div>

                    `;

                }

            );

}



/* =========================================
   RENDER TRANSACTIONS
   ========================================= */

function renderTransactions() {

    transactionList.innerHTML = "";


    if (
        transactions.length === 0
    ) {

        emptyTransactions.classList.remove(
            "hidden"
        );

        loadMoreButton.classList.add(
            "hidden"
        );

        return;

    }


    emptyTransactions.classList.add(
        "hidden"
    );


    transactions.forEach(
        function(transaction) {

            transactionList.appendChild(
                createTransactionElement(
                    transaction
                )
            );

        }
    );

}



/* =========================================
   CREATE TRANSACTION ELEMENT
   ========================================= */

function createTransactionElement(
    transaction
) {

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "transaction-item";


    const isCredit =
        transaction.type ===
        "CREDIT";


    const icon =
        getTransactionIcon(
            transaction.category
        );


    const amountPrefix =
        isCredit
            ? "+"
            : "-";


    item.innerHTML = `

        <div class="transaction-left">

            <div class="
                transaction-icon
                ${isCredit ? "credit" : "debit"}
            ">

                ${icon}

            </div>


            <div>

                <div class="transaction-name">

                    ${escapeHTML(
                        formatCategory(
                            transaction.category
                        )
                    )}

                </div>


                <div class="transaction-date">

                    ${formatTransactionDate(
                        transaction.createdAt
                    )}

                </div>


                <span class="transaction-status">

                    ${escapeHTML(
                        transaction.status ||
                        "COMPLETED"
                    )}

                </span>

            </div>

        </div>


        <div class="
            transaction-amount
            ${isCredit ? "credit" : "debit"}
        ">

            ${amountPrefix}
            ${formatMoney(
                transaction.amount
            )}

        </div>

    `;


    item.addEventListener(
        "click",
        function() {

            openTransaction(
                transaction
            );

        }
    );


    return item;

}



/* =========================================
   TRANSACTION ICON
   ========================================= */

function getTransactionIcon(
    category
) {

    const icons = {

        WALLET_FUNDING:
            "+",

        RIDE_PAYMENT:
            "R",

        DELIVERY_PAYMENT:
            "D",

        MARKETPLACE_PAYMENT:
            "M",

        REFUND:
            "↩",

        WITHDRAWAL:
            "↓",

        WITHDRAWAL_REVERSAL:
            "↩",

        ADJUSTMENT:
            "A"

    };


    return (
        icons[category] ||
        "₦"
    );

}



/* =========================================
   CATEGORY NAME
   ========================================= */

function formatCategory(
    category
) {

    if (!category) {

        return "Wallet Transaction";

    }


    const names = {

        WALLET_FUNDING:
            "Wallet Funding",

        RIDE_PAYMENT:
            "Ride Payment",

        DELIVERY_PAYMENT:
            "Delivery Payment",

        MARKETPLACE_PAYMENT:
            "Marketplace Purchase",

        REFUND:
            "Refund",

        WITHDRAWAL:
            "Withdrawal",

        WITHDRAWAL_REVERSAL:
            "Withdrawal Reversal",

        ADJUSTMENT:
            "Account Adjustment"

    };


    return (
        names[category] ||
        category.replace(
            /_/g,
            " "
        )
    );

}



/* =========================================
   FUND WALLET MODAL
   ========================================= */

document
    .getElementById(
        "fundWalletButton"
    )
    .addEventListener(
        "click",
        function() {

            openModal(
                fundWalletModal
            );

        }
    );



/* =========================================
   QUICK AMOUNTS
   ========================================= */

document
    .querySelectorAll(
        "[data-amount]"
    )
    .forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    fundAmount.value =
                        button.dataset.amount;

                }
            );

        }
    );



/* =========================================
   FUND WALLET
   ========================================= */

fundWalletForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        clearFormMessage(
            fundMessage
        );


        const amount =
            Number(
                fundAmount.value
            );


        if (
            !Number.isFinite(amount) ||
            amount < 100
        ) {

            showFormMessage(
                fundMessage,
                "Minimum wallet funding is ₦100.",
                "error"
            );

            return;

        }


        const button =
            document.getElementById(
                "fundSubmitButton"
            );


        button.disabled =
            true;

        button.textContent =
            "PROCESSING...";


        try {

            /*
                IMPORTANT:

                The backend/payment gateway
                must verify the payment before
                the wallet receives any credit.
            */

            const callable =
                functions.httpsCallable(
                    "initializeWalletFunding"
                );


            const result =
                await callable({

                    amount:
                        amount

                });


            const data =
                result.data;


            if (
                data &&
                data.authorizationUrl
            ) {

                window.location.href =
                    data.authorizationUrl;

                return;

            }


            showFormMessage(
                fundMessage,
                "Payment initialization completed.",
                "success"
            );

        }
        catch(error) {

            console.error(
                "Wallet funding error:",
                error
            );


            showFormMessage(
                fundMessage,
                getErrorMessage(error),
                "error"
            );

        }
        finally {

            button.disabled =
                false;

            button.textContent =
                "CONTINUE TO PAYMENT";

        }

    }
);



/* =========================================
   WITHDRAW MODAL
   ========================================= */

document
    .getElementById(
        "withdrawButton"
    )
    .addEventListener(
        "click",
        function() {

            clearFormMessage(
                withdrawMessage
            );

            openModal(
                withdrawModal
            );

        }
    );



/* =========================================
   WITHDRAWAL
   ========================================= */

withdrawForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        clearFormMessage(
            withdrawMessage
        );


        const amount =
            Number(
                withdrawAmount.value
            );


        const bank =
            bankCode.value;


        const account =
            accountNumber.value.trim();


        const name =
            accountName.value.trim();


        if (
            !Number.isFinite(amount) ||
            amount < 100
        ) {

            showFormMessage(
                withdrawMessage,
                "Minimum withdrawal is ₦100.",
                "error"
            );

            return;

        }


        if (
            !bank ||
            account.length !== 10 ||
            !name
        ) {

            showFormMessage(
                withdrawMessage,
                "Please provide valid bank details.",
                "error"
            );

            return;

        }


        const button =
            document.getElementById(
                "withdrawSubmitButton"
            );


        button.disabled =
            true;

        button.textContent =
            "SUBMITTING...";


        try {

            const callable =
                functions.httpsCallable(
                    "requestWalletWithdrawal"
                );


            await callable({

                amount:
                    amount,

                bankDetails: {

                    bankCode:
                        bank,

                    accountNumber:
                        account,

                    accountName:
                        name

                }

            });


            showFormMessage(
                withdrawMessage,
                "Withdrawal request submitted for review.",
                "success"
            );


            withdrawForm.reset();


            setTimeout(
                function() {

                    closeModal(
                        withdrawModal
                    );

                },
                1800
            );

        }
        catch(error) {

            console.error(
                "Withdrawal error:",
                error
            );


            showFormMessage(
                withdrawMessage,
                getErrorMessage(error),
                "error"
            );

        }
        finally {

            button.disabled =
                false;

            button.textContent =
                "REQUEST WITHDRAWAL";

        }

    }
);



/* =========================================
   TRANSACTION DETAILS
   ========================================= */

function openTransaction(
    transaction
) {

    const createdAt =
        formatTransactionDate(
            transaction.createdAt
        );


    transactionDetails.innerHTML = `

        <div class="detail-row">

            <span>
                Transaction
            </span>

            <strong>
                ${escapeHTML(
                    transaction.transactionId ||
                    transaction.id
                )}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Type
            </span>

            <strong>
                ${escapeHTML(
                    transaction.type
                )}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Category
            </span>

            <strong>
                ${escapeHTML(
                    formatCategory(
                        transaction.category
                    )
                )}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Amount
            </span>

            <strong>
                ₦${formatMoney(
                    transaction.amount
                )}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Balance Before
            </span>

            <strong>
                ₦${formatMoney(
                    transaction.balanceBefore
                )}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Balance After
            </span>

            <strong>
                ₦${formatMoney(
                    transaction.balanceAfter
                )}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Status
            </span>

            <strong>
                ${escapeHTML(
                    transaction.status ||
                    "COMPLETED"
                )}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Reference
            </span>

            <strong>
                ${escapeHTML(
                    transaction.reference ||
                    "—"
                )}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Date
            </span>

            <strong>
                ${escapeHTML(
                    createdAt
                )}
            </strong>

        </div>


        <div class="detail-row">

            <span>
                Description
            </span>

            <strong>
                ${escapeHTML(
                    transaction.description ||
                    "—"
                )}
            </strong>

        </div>

    `;


    openModal(
        transactionModal
    );

}



/* =========================================
   REFRESH
   ========================================= */

document
    .getElementById(
        "refreshWalletButton"
    )
    .addEventListener(
        "click",
        function() {

            this.textContent =
                "…";


            setTimeout(
                () => {

                    this.textContent =
                        "↻";

                },
                700
            );

        }
    );



/* =========================================
   MODAL FUNCTIONS
   ========================================= */

function openModal(
    modal
) {

    modal.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";

}


function closeModal(
    modal
) {

    modal.classList.add(
        "hidden"
    );

    document.body.style.overflow =
        "";

}


document
    .querySelectorAll(
        "[data-close]"
    )
    .forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    const id =
                        button.dataset.close;


                    closeModal(
                        document.getElementById(
                            id
                        )
                    );

                }
            );

        }
    );


document
    .querySelectorAll(
        ".modal-overlay"
    )
    .forEach(
        function(overlay) {

            overlay.addEventListener(
                "click",
                function() {

                    const modal =
                        overlay.parentElement;

                    closeModal(
                        modal
                    );

                }
            );

        }
    );



/* =========================================
   FORM MESSAGE
   ========================================= */

function showFormMessage(
    element,
    message,
    type
) {

    element.textContent =
        message;

    element.className =
        "form-message " +
        type;

}


function clearFormMessage(
    element
) {

    element.textContent =
        "";

    element.className =
        "form-message";

}



/* =========================================
   MONEY
   ========================================= */

function formatMoney(
    amount
) {

    const value =
        Number(amount || 0);


    return "₦" +
        value.toLocaleString(
            "en-NG",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}



/* =========================================
   DATE
   ========================================= */

function formatTransactionDate(
    timestamp
) {

    if (
        !timestamp
    ) {

        return "Date unavailable";

    }


    let date;


    if (
        timestamp.toDate
    ) {

        date =
            timestamp.toDate();

    }
    else if (
        timestamp instanceof Date
    ) {

        date =
            timestamp;

    }
    else {

        date =
            new Date(timestamp);

    }


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Date unavailable";

    }


    return date.toLocaleString(
        "en-NG",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );

}



/* =========================================
   ERROR MESSAGE
   ========================================= */

function getErrorMessage(
    error
) {

    if (
        error &&
        error.message
    ) {

        return error.message;

    }


    return "Something went wrong. Please try again.";

}



/* =========================================
   HTML SECURITY
   ========================================= */

function escapeHTML(
    value
) {

    if (
        value === null ||
        value === undefined
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
            walletListener
        ) {

            walletListener();

        }


        if (
            transactionListener
        ) {

            transactionListener();

        }

    }
);