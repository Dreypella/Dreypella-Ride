/*
    DREYPELLA RIDE
    RECEIVER PAYMENT SUCCESS

    Public page.

    The receiver does not need a Dreypella account.

    Secure verification is performed by the backend
    using the payment token and Paystack reference.
*/

const paymentLoading =
    document.getElementById("paymentLoading");

const paymentSuccess =
    document.getElementById("paymentSuccess");

const successAmount =
    document.getElementById("successAmount");

const successDeliveryId =
    document.getElementById("successDeliveryId");

const successReference =
    document.getElementById("successReference");

const paymentError =
    document.getElementById("paymentError");

const paymentErrorMessage =
    document.getElementById(
        "paymentErrorMessage"
    );

const errorReference =
    document.getElementById("errorReference");

const functions =
    firebase.functions();

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const paymentToken =
    urlParams.get("token");

const paymentReference =
    urlParams.get("reference") ||
    urlParams.get("trxref");

if (!paymentToken) {
    showError(
        "This payment confirmation link is missing its secure payment token."
    );
}
else if (paymentToken.length < 32) {
    showError(
        "This payment confirmation link is invalid."
    );
}
else if (!paymentReference) {
    showError(
        "The Paystack payment reference is missing."
    );
}
else {
    verifyPayment();
}

async function verifyPayment() {

    try {

        const verifyReceiverPayment =
            functions.httpsCallable(
                "verifyReceiverPayment"
            );

        const result =
            await verifyReceiverPayment({
                token:
                    paymentToken,

                reference:
                    paymentReference
            });

        const data =
            result.data;

        if (
            !data ||
            !data.success
        ) {
            throw new Error(
                "Unable to verify this payment."
            );
        }

        showSuccess(data);

    }
    catch(error) {

        console.error(
            "Receiver payment verification error:",
            error
        );

        showError(
            getErrorMessage(error)
        );
    }
}

function showSuccess(data) {

    paymentLoading.style.display =
        "none";

    paymentError.style.display =
        "none";

    paymentSuccess.style.display =
        "block";

    successAmount.textContent =
        formatCurrency(
            data.amount
        );

    successDeliveryId.textContent =
        data.deliveryId ||
        "—";

    successReference.textContent =
        data.reference ||
        paymentReference ||
        "—";
}

function showError(message) {

    paymentLoading.style.display =
        "none";

    paymentSuccess.style.display =
        "none";

    paymentError.style.display =
        "block";

    paymentErrorMessage.textContent =
        message;

    errorReference.textContent =
        paymentReference ||
        "—";
}

function getErrorMessage(error) {

    if (
        error &&
        error.message
    ) {
        return error.message;
    }

    return (
        "Unable to verify this payment. " +
        "Please contact Dreypella Ride for assistance."
    );
}

function formatCurrency(amount) {

    const numericAmount =
        Number(amount);

    if (
        !Number.isFinite(
            numericAmount
        )
    ) {
        return "₦0";
    }

    return "₦" +
        numericAmount.toLocaleString(
            "en-NG"
        );
}
