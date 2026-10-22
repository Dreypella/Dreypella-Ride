/*
    DREYPELLA RIDE
    DELIVERY CHECKOUT

    Supports:

    SENDER PAYS
    RECEIVER PAYS
*/


const bookingData =
    JSON.parse(
        localStorage.getItem(
            "dreypellaDeliveryBooking"
        )
    );


/* ELEMENTS */

const pickupText =
    document.getElementById(
        "pickupText"
    );

const destinationText =
    document.getElementById(
        "destinationText"
    );

const distanceText =
    document.getElementById(
        "distanceText"
    );

const timeText =
    document.getElementById(
        "timeText"
    );

const methodText =
    document.getElementById(
        "methodText"
    );

const packageText =
    document.getElementById(
        "packageText"
    );

const recipientsContainer =
    document.getElementById(
        "recipientsContainer"
    );

const senderChoice =
    document.getElementById(
        "senderChoice"
    );

const receiverChoice =
    document.getElementById(
        "receiverChoice"
    );

const receiverNotice =
    document.getElementById(
        "receiverNotice"
    );

const senderPaymentMethodSection =
    document.getElementById(
        "senderPaymentMethodSection"
    );

const priceText =
    document.getElementById(
        "priceText"
    );

const checkoutButton =
    document.getElementById(
        "checkoutButton"
    );

const backButton =
    document.getElementById(
        "backButton"
    );

const checkoutMessage =
    document.getElementById(
        "checkoutMessage"
    );


/* CHECK BOOKING */

if (!bookingData) {

    checkoutMessage.textContent =
        "Your delivery information could not be found.";

    checkoutButton.disabled =
        true;

} else {

    loadBooking();

}


/* LOAD DATA */

function loadBooking() {

    pickupText.textContent =
        bookingData.pickup?.name ||
        "Pickup location";


    destinationText.textContent =
        bookingData.destination?.name ||
        "Destination";


    distanceText.textContent =
        bookingData.distanceKm
            ? bookingData.distanceKm + " km"
            : "Calculating...";


    timeText.textContent =
        bookingData.durationMinutes
            ? formatTime(
                bookingData.durationMinutes
            )
            : "Calculating...";


    methodText.textContent =
        formatMethod(
            bookingData.method
        );


    packageText.textContent =
        formatCategory(
            bookingData.category
        );


    renderRecipients();


    if (bookingData.customerPrice) {

        priceText.textContent =
            formatCurrency(
                bookingData.customerPrice
            );

    } else {

        priceText.textContent =
            "Price unavailable";
    }


    updatePayerUI();

}


/*
    PAYMENT TYPE
*/

const payerInputs =
    document.querySelectorAll(
        'input[name="payer"]'
    );


payerInputs.forEach(
    input => {

        input.addEventListener(
            "change",
            updatePayerUI
        );

    }
);


/* UPDATE PAYMENT UI */

function updatePayerUI() {

    const selected =
        document.querySelector(
            'input[name="payer"]:checked'
        );


    if (!selected) {

        return;
    }


    senderChoice.classList.remove(
        "selected"
    );

    receiverChoice.classList.remove(
        "selected"
    );


    if (
        selected.value ===
        "SENDER"
    ) {

        senderChoice.classList.add(
            "selected"
        );


        receiverNotice.style.display =
            "none";

        senderPaymentMethodSection.style.display =
            "block";


        checkoutButton.textContent =
            "PAY NOW";

    }


    if (
        selected.value ===
        "RECEIVER"
    ) {

        receiverChoice.classList.add(
            "selected"
        );


        receiverNotice.style.display =
            "block";

        senderPaymentMethodSection.style.display =
            "none";


        checkoutButton.textContent =
            "CREATE PAYMENT REQUEST";

    }

}


/*
    CHECK RECEIVER DETAILS
*/

function validateReceiver() {

    const destinations =
        Array.isArray(bookingData.destinations)
            ? bookingData.destinations
            : [];

    if (!destinations.length) {
        showMessage(
            "No delivery recipients were found."
        );
        return false;
    }

    const names =
        recipientsContainer.querySelectorAll(
            ".checkout-recipient-name"
        );

    const phones =
        recipientsContainer.querySelectorAll(
            ".checkout-recipient-phone"
        );

    const emails =
        recipientsContainer.querySelectorAll(
            ".checkout-recipient-email"
        );

    for (
        let index = 0;
        index < destinations.length;
        index++
    ) {

        const name =
            names[index]?.value.trim() || "";

        const phone =
            phones[index]?.value.trim() || "";

        const email =
            emails[index]?.value.trim() || "";

        if (!name) {
            showMessage(
                `Enter the receiver's name for Destination ${index + 1}.`
            );
            names[index]?.focus();
            return false;
        }

        if (!phone) {
            showMessage(
                `Enter the receiver's phone number for Destination ${index + 1}.`
            );
            phones[index]?.focus();
            return false;
        }

        if (
            phone.replace(/\D/g, "").length < 10
        ) {
            showMessage(
                `Enter a valid receiver phone number for Destination ${index + 1}.`
            );
            phones[index]?.focus();
            return false;
        }

        if (email) {
            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(email)) {
                showMessage(
                    `Enter a valid receiver email for Destination ${index + 1}, or leave it blank.`
                );
                emails[index]?.focus();
                return false;
            }
        }

        destinations[index].recipientName = name;
        destinations[index].recipientPhone = phone;
        destinations[index].recipientEmail = email;
    }

    return true;
}


function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/*
    RENDER ALL RECIPIENTS
*/

function renderRecipients() {

    recipientsContainer.innerHTML = "";

    const destinations =
        Array.isArray(bookingData.destinations)
            ? bookingData.destinations
            : [];

    if (!destinations.length) {
        recipientsContainer.textContent =
            "No recipients were found.";
        return;
    }

    destinations.forEach(
        (item, index) => {

            const destination =
                item.destination || {};

            const card =
                document.createElement("div");

            card.className =
                "recipient-checkout-card";

            card.innerHTML = `
                <h3>Destination ${index + 1}</h3>

                <p class="recipient-destination">
                    ${escapeHtml(
                        destination.name ||
                        destination.address ||
                        "Destination"
                    )}
                </p>

                <div class="input-group">
                    <label>Receiver Name</label>
                    <input
                        type="text"
                        class="checkout-recipient-name"
                        data-index="${index}"
                        value="${escapeHtml(
                            item.recipientName || ""
                        )}"
                        placeholder="Receiver's full name"
                        required
                    >
                </div>

                <div class="input-group">
                    <label>Receiver Phone</label>
                    <input
                        type="tel"
                        class="checkout-recipient-phone"
                        data-index="${index}"
                        value="${escapeHtml(
                            item.recipientPhone || ""
                        )}"
                        placeholder="08012345678"
                        required
                    >
                </div>

                <div class="input-group">
                    <label>
                        Receiver Email
                        <span>Optional</span>
                    </label>
                    <input
                        type="email"
                        class="checkout-recipient-email"
                        data-index="${index}"
                        value="${escapeHtml(
                            item.recipientEmail || ""
                        )}"
                        placeholder="receiver@email.com"
                    >
                </div>
            `;

            recipientsContainer.appendChild(card);
        }
    );
}


/*
    CHECKOUT BUTTON
*/

checkoutButton.addEventListener(
    "click",
    async () => {

        if (!bookingData) {
            return;
        }

        if (!validateReceiver()) {
            return;
        }

        const selectedPayer =
            document.querySelector(
                'input[name="payer"]:checked'
            );

        if (!selectedPayer) {
            showMessage(
                "Please select who will pay."
            );
            return;
        }

        const originalText =
            checkoutButton.textContent;

        checkoutButton.disabled = true;
        checkoutButton.textContent =
            "PROCESSING...";

        try {

            bookingData.payer =
                selectedPayer.value;

            if (
                selectedPayer.value ===
                "SENDER"
            ) {

                const selectedPaymentMethod =
                    document.querySelector(
                        'input[name="senderPaymentMethod"]:checked'
                    );

                if (!selectedPaymentMethod) {
                    showMessage(
                        "Please select how the sender will pay."
                    );

                    checkoutButton.disabled =
                        false;

                    checkoutButton.textContent =
                        originalText;

                    return;
                }

                bookingData.paymentMethod =
                    selectedPaymentMethod.value;

            } else {

                if (
                    bookingData.deliveryType !==
                    "LOCAL"
                ) {
                    showMessage(
                        "Pay on Delivery is only available for eligible local deliveries. Interstate and international deliveries must be paid upfront."
                    );

                    checkoutButton.disabled =
                        false;

                    checkoutButton.textContent =
                        originalText;

                    return;
                }

                bookingData.paymentMethod =
                    "POD";
            }

            const functions =
                firebase.functions();

            const createDelivery =
                functions.httpsCallable(
                    "createDelivery"
                );

            showMessage(
                "Creating your delivery..."
            );

            const createResult =
                await createDelivery(
                    bookingData
                );

            const created =
                createResult.data || {};

            if (
                created.success !==
                true ||
                !created.deliveryId
            ) {
                throw new Error(
                    created.message ||
                    "The delivery could not be created."
                );
            }

            bookingData.deliveryId =
                created.deliveryId;

            bookingData.bookingReference =
                created.bookingReference ||
                "";

            bookingData.customerPrice =
                Number(
                    created.customerPrice
                );

            bookingData.distanceKm =
                created.distanceKm;

            bookingData.durationMinutes =
                created.durationMinutes;

            bookingData.deliveryType =
                created.deliveryType ||
                bookingData.deliveryType;

            if (
                selectedPayer.value ===
                "RECEIVER"
            ) {

                bookingData.paymentStatus =
                    "PENDING";

                bookingData.status =
                    "PAYMENT_PENDING";

                showMessage(
                    "Creating secure receiver payment link..."
                );

                const createReceiverPaymentRequest =
                    functions.httpsCallable(
                        "createReceiverPaymentRequest"
                    );

                const destinations =
                    Array.isArray(
                        bookingData.destinations
                    )
                        ? bookingData.destinations
                        : [];

                if (!destinations.length) {
                    throw new Error(
                        "No delivery destinations were found."
                    );
                }

                const receiverPaymentRequests = [];

                for (
                    let destinationIndex = 0;
                    destinationIndex < destinations.length;
                    destinationIndex++
                ) {
                    const receiverPaymentResult =
                        await createReceiverPaymentRequest({
                            deliveryId:
                                bookingData.deliveryId,
                            destinationIndex
                        });

                    const receiverPayment =
                        receiverPaymentResult.data ||
                        {};

                    if (
                        receiverPayment.success !==
                            true ||
                        !receiverPayment.paymentUrl
                    ) {
                        throw new Error(
                            receiverPayment.message ||
                            "A receiver payment link could not be created."
                        );
                    }

                    receiverPaymentRequests.push({
                        requestId:
                            receiverPayment.requestId,
                        destinationIndex,
                        amount:
                            Number(
                                receiverPayment.amount || 0
                            ),
                        paymentUrl:
                            receiverPayment.paymentUrl,
                        expiresAt:
                            receiverPayment.expiresAt ||
                            null,
                        recipientName:
                            receiverPayment.recipientName ||
                            destinations[destinationIndex]
                                .recipientName ||
                            null,
                        recipientPhone:
                            receiverPayment.recipientPhone ||
                            destinations[destinationIndex]
                                .recipientPhone ||
                            null,
                        recipientEmail:
                            receiverPayment.recipientEmail ||
                            destinations[destinationIndex]
                                .recipientEmail ||
                            null
                    });
                }

                bookingData.receiverPaymentRequests =
                    receiverPaymentRequests;

                /*
                    Keep the first request in the legacy
                    singular fields for compatibility with
                    existing confirmation/payment code.
                */
                const firstReceiverPayment =
                    receiverPaymentRequests[0];

                bookingData.receiverPaymentRequestId =
                    firstReceiverPayment.requestId;

                bookingData.receiverPaymentUrl =
                    firstReceiverPayment.paymentUrl;

                bookingData.receiverPaymentExpiresAt =
                    firstReceiverPayment.expiresAt;

                localStorage.setItem(
                    "dreypellaDeliveryBooking",
                    JSON.stringify(
                        bookingData
                    )
                );

                window.location.href =
                    "delivery-confirmation.html";

                return;
            }

            /*
                SENDER PAYS
            */

            bookingData.status =
                "AWAITING_PAYMENT";

            bookingData.paymentStatus =
                "PENDING";

            bookingData.paymentRequestedAt =
                new Date().toISOString();

            localStorage.setItem(
                "dreypellaDeliveryBooking",
                JSON.stringify(
                    bookingData
                )
            );

            showMessage(
                "Preparing secure payment..."
            );

            if (
                bookingData.paymentMethod ===
                "WALLET"
            ) {
                const paymentReference =
                    "DR-WALLET-" +
                    bookingData.deliveryId +
                    "-" +
                    Date.now();

                const payWithWallet =
                    functions.httpsCallable(
                        "payWithWallet"
                    );

                const walletResult =
                    await payWithWallet({
                        paymentType:
                            "DELIVERY",
                        amount:
                            bookingData.customerPrice,
                        reference:
                            paymentReference,
                        orderId:
                            bookingData.deliveryId,
                        item:
                            bookingData.bookingReference ||
                            "Dreypella delivery"
                    });

                const walletPayment =
                    walletResult.data || {};

                if (
                    walletPayment.success !==
                    true ||
                    walletPayment.status !==
                    "SUCCESS"
                ) {
                    throw new Error(
                        walletPayment.message ||
                        "Wallet payment could not be completed."
                    );
                }

                bookingData.paymentStatus =
                    "PAID";

                bookingData.status =
                    "PAYMENT_CONFIRMED";

                bookingData.paymentReference =
                    paymentReference;

                bookingData.walletTransactionId =
                    walletPayment.transactionId || "";

                localStorage.setItem(
                    "dreypellaDeliveryBooking",
                    JSON.stringify(
                        bookingData
                    )
                );

                window.location.href =
                    "delivery-confirmation.html";

            } else if (
                bookingData.paymentMethod ===
                "PAYSTACK"
            ) {
                const initializeDeliveryPayment =
                    functions.httpsCallable(
                        "initializeDeliveryPayment"
                    );

                const paymentResult =
                    await initializeDeliveryPayment({
                        deliveryId:
                            bookingData.deliveryId
                    });

                const payment =
                    paymentResult.data || {};

                if (
                    payment.success !==
                    true ||
                    !payment.authorizationUrl
                ) {
                    throw new Error(
                        payment.message ||
                        "Secure payment could not be initialized."
                    );
                }

                bookingData.paymentReference =
                    payment.reference || "";

                bookingData.paymentAuthorizationUrl =
                    payment.authorizationUrl;

                localStorage.setItem(
                    "dreypellaDeliveryBooking",
                    JSON.stringify(
                        bookingData
                    )
                );

                window.location.href =
                    payment.authorizationUrl;
            }

        }

        catch(error) {

            console.error(
                "Secure delivery checkout error:",
                error
            );

            showMessage(
                error.message ||
                "We could not process your delivery. Please try again."
            );

            checkoutButton.disabled =
                false;

            checkoutButton.textContent =
                originalText;
        }

    }
);

/*
    BACK
*/

backButton.addEventListener(
    "click",
    () => {

        window.location.href =
            "delivery-confirmation.html";

    }
);


/*
    BOOKING REFERENCE
*/

function generateBookingReference() {

    const now =
        Date.now()
        .toString()
        .slice(-8);


    const random =
        Math.floor(
            100 +
            Math.random() * 900
        );


    return (
        "DR-" +
        now +
        "-" +
        random
    );

}


/*
    FORMATTING
*/

function formatCurrency(amount) {

    return "₦" +
        Number(
            amount
        ).toLocaleString(
            "en-NG"
        );

}


function formatTime(minutes) {

    if (
        Number(minutes) < 60
    ) {

        return Math.round(
            minutes
        ) + " mins";

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const remaining =
        Math.round(
            minutes % 60
        );


    if (
        remaining === 0
    ) {

        return hours +
            " hr";

    }


    return hours +
        " hr " +
        remaining +
        " mins";

}


function formatMethod(method) {

    const methods = {

        WALKER: "Walker",

        RIDER: "Rider",

        VEHICLE: "Vehicle"

    };


    return methods[method] ||
        method ||
        "Delivery Partner";

}


function formatCategory(category) {

    const categories = {

        food: "Food",

        document: "Document",

        clothing: "Clothing",

        electronics: "Electronics",

        medicine: "Medicine",

        parcel: "General Parcel",

        other: "Other"

    };


    return categories[
        category
    ] || "Parcel";

}


function showMessage(message) {

    checkoutMessage.textContent =
        message;

}
