(function() {

    const loadingState =
        document.getElementById("loadingState");

    const successState =
        document.getElementById("successState");

    const errorState =
        document.getElementById("errorState");

    const successAmount =
        document.getElementById("successAmount");

    const successReference =
        document.getElementById("successReference");

    const successMessage =
        document.getElementById("successMessage");

    const errorMessage =
        document.getElementById("errorMessage");

    const errorReference =
        document.getElementById("errorReference");

    const walletButton =
        document.getElementById("walletButton");

    const retryWalletButton =
        document.getElementById("retryWalletButton");


    function showSuccess(data) {

        loadingState.classList.add("hidden");

        errorState.classList.add("hidden");

        successState.classList.remove("hidden");


        const amount =
            Number(data.amount || 0);


        successAmount.textContent =
            new Intl.NumberFormat(
                "en-NG",
                {
                    style: "currency",
                    currency: "NGN",
                    minimumFractionDigits: 2
                }
            ).format(amount);


        successReference.textContent =
            data.reference || "—";


        successMessage.textContent =
            data.alreadyProcessed
                ? "This payment had already been verified and your wallet remains safely credited."
                : "Your payment has been verified successfully and the funds are now available in your wallet.";

    }


    function showError(message, reference) {

        loadingState.classList.add("hidden");

        successState.classList.add("hidden");

        errorState.classList.remove("hidden");


        errorMessage.textContent =
            message ||
            "We could not confirm this payment.";


        errorReference.textContent =
            reference || "—";

    }


    function getReference() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        return (
            params.get("reference") ||
            params.get("trxref") ||
            ""
        ).trim();

    }


    async function verifyPayment() {

        const reference =
            getReference();


        if (!reference) {

            showError(
                "No payment reference was found. Your wallet has not been credited.",
                ""
            );

            return;

        }


        errorReference.textContent =
            reference;


        try {

            if (
                typeof firebase ===
                "undefined"
            ) {

                throw new Error(
                    "Firebase could not be loaded."
                );

            }


            const functions =
                firebase.functions();


            const callable =
                functions.httpsCallable(
                    "verifyWalletFunding"
                );


            const result =
                await callable({
                    reference:
                        reference
                });


            const data =
                result.data;


            if (
                !data ||
                data.success !== true
            ) {

                throw new Error(
                    "Payment verification was unsuccessful."
                );

            }


            showSuccess(
                data
            );

        }
        catch(error) {

            console.error(
                "Wallet funding verification error:",
                error
            );


            const message =
                error &&
                error.message
                    ? error.message
                    : "We could not confirm your payment. Please contact Dreypella Ride support if money was deducted.";

            showError(
                message,
                reference
            );

        }

    }


    walletButton.addEventListener(
        "click",
        function() {

            window.location.href =
                "customer-wallet.html";

        }
    );


    retryWalletButton.addEventListener(
        "click",
        function() {

            window.location.href =
                "customer-wallet.html";

        }
    );


    verifyPayment();

})();
