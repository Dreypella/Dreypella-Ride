const {
    paystackRequest
} = require("./paystack");

async function getBanks() {

    const result =
        await paystackRequest(
            "/bank"
        );

    return result.data || [];
}

async function verifyBankAccount(
    bankCode,
    accountNumber
) {

    const result =
        await paystackRequest(
            `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
        );

    if (
        !result.data ||
        !result.data.account_name
    ) {
        throw new Error(
            "Paystack could not verify this bank account."
        );
    }

    return {
        accountName:
            result.data.account_name,

        accountNumber:
            result.data.account_number,

        bankCode:
            result.data.bank_id
                ? String(result.data.bank_id)
                : bankCode
    };
}

module.exports = {
    getBanks,
    verifyBankAccount
};
