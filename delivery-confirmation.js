/*
    DREYPELLA RIDE
    DELIVERY CONFIRMATION
*/


const bookingData =
    JSON.parse(
        localStorage.getItem(
            "dreypellaDeliveryBooking"
        )
    );


const functions =
    firebase.functions();

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

const categoryText =
    document.getElementById(
        "categoryText"
    );

const recipientsContainer =
    document.getElementById(
        "recipientsContainer"
    );

const instructionsText =
    document.getElementById(
        "instructionsText"
    );

const priceText =
    document.getElementById(
        "priceText"
    );

const confirmationMessage =
    document.getElementById(
        "confirmationMessage"
    );

const confirmButton =
    document.getElementById(
        "confirmButton"
    );

const backButton =
    document.getElementById(
        "backButton"
    );

const insurance =
    document.getElementById(
        "insurance"
    );

const insuranceInfo =
    document.getElementById(
        "insuranceInfo"
    );

const receiverPaymentLinks =
    document.getElementById(
        "receiverPaymentLinks"
    );


/*
    CHECK BOOKING
*/

if (!bookingData) {

    confirmationMessage.textContent =
        "No delivery booking was found.";

    confirmButton.disabled =
        true;

} else {

    loadBooking();

}


/*
    LOAD BOOKING
*/

function loadBooking() {

    pickupText.textContent =
        bookingData.pickup?.name ||
        "Pickup location";


    destinationText.textContent =
        bookingData.destination?.name ||
        "Destination";


renderRecipients();

    renderInstructions();


    categoryText.textContent =
        formatCategory(
            bookingData.category
        );


    methodText.textContent =
        formatMethod(
            bookingData.method
        );


    /*
        Distance and price are calculated
        again here from the selected
        locations.

        This is only for displaying the
        confirmation information.

        Final financial calculations
        will later be moved completely
        into Firebase Cloud Functions.
    */

    loadConfirmationDetails();
    renderPostCheckoutPaymentState();

}


/*
    DISPLAY ALL RECIPIENTS
*/

function renderRecipients() {

    if (!recipientsContainer) {
        return;
    }

    const destinations =
        Array.isArray(bookingData.destinations) &&
        bookingData.destinations.length
            ? bookingData.destinations
            : [{
                destination:
                    bookingData.destination || {},
                recipientName:
                    bookingData.recipientName || "",
                recipientPhone:
                    bookingData.recipientPhone || ""
            }];

    recipientsContainer.innerHTML = "";

    destinations.forEach(
        (item, index) => {

            const destination =
                item?.destination ||
                item ||
                {};

            const card =
                document.createElement("div");

            card.className =
                "recipient-box";

            card.innerHTML = `
                <div>
                    <span>
                        Destination ${index + 1}
                    </span>
                    <strong>
                        ${escapeHtml(
                            destination.name ||
                            destination.address ||
                            "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Recipient
                    </span>
                    <strong>
                        ${escapeHtml(
                            item?.recipientName ||
                            "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Phone
                    </span>
                    <strong>
                        ${escapeHtml(
                            item?.recipientPhone ||
                            "—"
                        )}
                    </strong>
                </div>
            `;

            recipientsContainer.appendChild(card);
        }
    );
}

/*
    DISPLAY DELIVERY INSTRUCTIONS
*/

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function renderInstructions() {

    if (!instructionsText) {
        return;
    }

    const destinations =
        Array.isArray(bookingData.destinations) &&
        bookingData.destinations.length
            ? bookingData.destinations
            : [{
                instructions:
                    bookingData.instructions || ""
            }];

    const instructions = destinations
        .map((item, index) => {
            const text =
                item?.instructions ||
                "No special instructions";

            return `Destination ${index + 1}: ${escapeHtml(text)}`;
        });

    instructionsText.innerHTML =
        instructions.join("<br><br>");
}

/*
    DISPLAY BOOKING DETAILS
*/

function loadConfirmationDetails() {

    const destinations =
        Array.isArray(bookingData.destinations) &&
        bookingData.destinations.length
            ? bookingData.destinations
            : [{
                destination:
                    bookingData.destination || {}
            }];

    const destinationNames =
        destinations.map(
            (item, index) => {

                const destination =
                    item?.destination ||
                    item ||
                    {};

                return (
                    destination.name ||
                    destination.address ||
                    `Destination ${index + 1}`
                );

            }
        );

    destinationText.textContent =
        destinationNames.join(" | ");

    distanceText.textContent =
        bookingData.distanceKm
            ? Number(
                bookingData.distanceKm
              ).toFixed(1) + " km"
            : "—";

    timeText.textContent =
        bookingData.durationMinutes
            ? formatTime(
                bookingData.durationMinutes
              )
            : "—";

    priceText.textContent =
        bookingData.customerPrice
            ? formatCurrency(
                bookingData.customerPrice
              )
            : "—";
}


/*
    POST-CHECKOUT PAYMENT STATE
*/

function renderPostCheckoutPaymentState() {

    if (!bookingData) {
        return;
    }

    const receiverRequests =
        Array.isArray(
            bookingData.receiverPaymentRequests
        )
            ? bookingData.receiverPaymentRequests
            : [];

    const walletPaymentCompleted =
        bookingData.paymentStatus === "PAID" &&
        bookingData.status === "PAYMENT_CONFIRMED";

    if (
        !receiverRequests.length &&
        !walletPaymentCompleted
    ) {
        return;
    }

    confirmButton.disabled = true;
    backButton.style.display = "none";

    if (walletPaymentCompleted) {

        confirmButton.textContent =
            "PAYMENT CONFIRMED";

        confirmationMessage.textContent =
            "Payment successful. Your delivery has been confirmed.";

        return;
    }

    receiverPaymentLinks.style.display =
        "block";

    receiverPaymentLinks.textContent = "";

    const heading =
        document.createElement("h2");

    heading.textContent =
        "Receiver Payment Links";

    receiverPaymentLinks.appendChild(
        heading
    );

    const message =
        document.createElement("p");

    message.textContent =
        "Send each recipient their secure payment link. All required receiver payments must be completed before the delivery can be fully confirmed.";

    receiverPaymentLinks.appendChild(
        message
    );

    receiverRequests.forEach(
        (request, index) => {

            const card =
                document.createElement("div");

            card.className =
                "recipient-box";

            const recipient =
                document.createElement("strong");

            recipient.textContent =
                request.recipientName ||
                `Recipient ${index + 1}`;

            card.appendChild(recipient);

            const destination =
                Array.isArray(
                    bookingData.destinations
                )
                    ? bookingData.destinations[
                        Number(
                            request.destinationIndex
                        )
                    ]
                    : null;

            const destinationText =
                document.createElement("p");

            destinationText.textContent =
                destination?.destination?.address ||
                destination?.destination?.name ||
                "Destination";

            card.appendChild(
                destinationText
            );

            const amount =
                document.createElement("p");

            amount.textContent =
                `Amount: ₦${Number(
                    request.amount || 0
                ).toLocaleString()}`;

            card.appendChild(amount);

            if (request.paymentUrl) {

                const link =
                    document.createElement("a");

                link.href =
                    request.paymentUrl;

                link.target =
                    "_blank";

                link.rel =
                    "noopener noreferrer";

                link.className =
                    "confirm-button";

                link.textContent =
                    "OPEN PAYMENT LINK";

                card.appendChild(link);

            } else {

                const unavailable =
                    document.createElement("p");

                unavailable.textContent =
                    "Payment link unavailable.";

                card.appendChild(
                    unavailable
                );
            }

            receiverPaymentLinks.appendChild(
                card
            );
        }
    );

    confirmationMessage.textContent =
        "Delivery created. Send each secure payment link to the corresponding recipient.";

    confirmButton.textContent =
        "PAYMENT LINKS CREATED";
}

/*
    INITIAL CONFIRMATION DISPLAY
*/

if (bookingData) {
    loadConfirmationDetails();
}


/*
    INSURANCE
*/

insurance.addEventListener(
    "change",
    () => {

        if (insurance.checked) {

            insuranceInfo.style.display =
                "block";

        } else {

            insuranceInfo.style.display =
                "none";
        }

    }
);


/*
    CONTINUE TO PAYMENT
*/

confirmButton.addEventListener(
    "click",
    () => {
        if (!bookingData) {
            return;
        }

        if (
            Array.isArray(
                bookingData.receiverPaymentRequests
            ) &&
            bookingData.receiverPaymentRequests.length
        ) {
            return;
        }

        if (
            bookingData.paymentStatus === "PAID" &&
            bookingData.status === "PAYMENT_CONFIRMED"
        ) {
            return;
        }

        if (!bookingData.customerPrice) {
            confirmationMessage.textContent =
                "Please wait for the delivery price to load.";
            return;
        }

        bookingData.insurance =
            insurance.checked;

        localStorage.setItem(
            "dreypellaDeliveryBooking",
            JSON.stringify(bookingData)
        );

        window.location.href =
            "delivery-checkout.html";
    }
);

backButton.addEventListener(
    "click",
    () => {

        localStorage.setItem(
            "dreypellaDeliveryEditMode",
            "true"
        );

        window.location.href =
            "delivery.html";

    }
);


/*
    HELPERS
*/

function formatCurrency(amount) {

    return "₦" +
        Number(amount).toLocaleString(
            "en-NG"
        );
}


function formatTime(minutes) {

    if (minutes < 60) {

        return Math.round(minutes) +
            " mins";
    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const remaining =
        Math.round(
            minutes % 60
        );


    if (remaining === 0) {

        return hours +
            " hr";
    }


    return hours +
        " hr " +
        remaining +
        " mins";
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


    return categories[category] ||
        "Parcel";
}


function formatMethod(method) {

    const methods = {

        WALKER: "Walker",

        RIDER: "Rider",

        VEHICLE: "Vehicle"

    };


    return methods[method] ||
        method;
}
