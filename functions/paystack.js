const PAYSTACK_BASE_URL =
    "https://api.paystack.co";

async function paystackRequest(
    endpoint,
    options = {}
) {
    const secretKey =
        process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
        throw new Error(
            "Paystack secret key is not configured."
        );
    }

    const response =
        await fetch(
            `${PAYSTACK_BASE_URL}${endpoint}`,
            {
                method:
                    options.method || "GET",

                headers: {
                    Authorization:
                        `Bearer ${secretKey}`,

                    "Content-Type":
                        "application/json"
                },

                body:
                    options.body
                        ? JSON.stringify(
                            options.body
                        )
                        : undefined
            }
        );

    let result;

    try {
        result =
            await response.json();
    }
    catch(error) {
        throw new Error(
            "Invalid response from Paystack."
        );
    }

    if (
        !response.ok ||
        !result.status
    ) {
        throw new Error(
            result.message ||
            "Paystack request failed."
        );
    }

    return result;
}

module.exports = {
    paystackRequest
};
