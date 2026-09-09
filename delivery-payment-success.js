(function() {

    "use strict";

    const loadingState =
        document.getElementById(
            "paymentLoading"
        );

    const successState =
        document.getElementById(
            "paymentSuccess"
        );

    const errorState =
        document.getElementById(
            "paymentError"
        );

    const successAmount =
        document.getElementById(
            "successAmount"
        );

    const successDeliveryId =
        document.getElementById(
            "successDeliveryId"
        );

    const successReference =
        document.getElementById(
            "successReference"
        );

    const paymentErrorMessage =
        document.getElementById(
            "paymentErrorMessage"
        );

    const errorReference =
        document.getElementById(
            "errorReference"
        );


    const params =
        new URLSearchParams(
            window.location.search
        );

    const reference =
        String(
            params.get("reference") ||
            params.get("trxref") ||
            ""
        ).trim();


    function showSuccess(data) {

        loadingState.hidden =
            true;

        errorState.hidden =
            true;

        successState.hidden =
            false;


        const amount =
            Number(
                data &&
                data.amount
            );


        successAmount.textContent =
            Number.isFinite(amount)
                ? "₦" +
                  amount.toLocaleString(
                      "en-NG"
                  )
                : "—";


        successDeliveryId.textContent =
            data &&
            data.deliveryId
                ? data.deliveryId
                : "—";


        successReference.textContent =
            data &&
            data.reference
                ? data.reference
                : reference ||
                  "—";

    }


    function showError(message) {

        loadingState.hidden =
            true;

        successState.hidden =
            true;

        errorState.hidden =
            false;


        paymentErrorMessage.textContent =
            message ||
            "We could not confirm this payment.";


        errorReference.textContent =
            reference ||
            "Not available";

    }


    if (!reference) {

        showError(
            "No Paystack payment reference was supplied. We cannot verify this payment."
        );

        return;
    }


    firebase.auth()
        .onAuthStateChanged(
            async function(user) {

                if (!user) {

                    showError(
                        "Your account session could not be confirmed. Please log in and check your delivery payment."
                    );

                    return;
                }


                try {

                    const functions =
                        firebase.functions();


                    const verifyDeliveryPayment =
                        functions.httpsCallable(
                            "verifyDeliveryPayment"
                        );


                    const result =
                        await verifyDeliveryPayment({
                            reference:
                                reference
                        });


                    const data =
                        result.data ||
                        {};


                    if (
                        data.success !==
                            true ||
                        data.status !==
                            "SUCCESS"
                    ) {

                        throw new Error(
                            data.message ||
                            "Payment verification was not completed."
                        );

                    }


                    showSuccess(
                        data
                    );

                }

                catch(error) {

                    console.error(
                        "Delivery payment verification error:",
                        error
                    );


                    showError(
                        error.message ||
                        "We could not confirm this payment."
                    );

                }

            }
        );

})();
