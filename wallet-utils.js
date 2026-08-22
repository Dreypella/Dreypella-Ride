/*
    =========================================
    DREYPELLA RIDE
    WALLET UTILITIES
    =========================================
*/


function generateWalletTransactionId() {

    const random =
        Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();

    return (
        "WTX-" +
        Date.now() +
        "-" +
        random
    );

}


/*
    =========================================
    MONEY NORMALIZATION
    =========================================
*/

function normalizeMoney(amount) {

    const value =
        Number(amount);

    if (
        !Number.isFinite(value) ||
        value < 0
    ) {

        throw new Error(
            "Invalid monetary amount."
        );

    }

    return Math.round(
        value * 100
    ) / 100;

}


/*
    =========================================
    PERCENTAGE
    =========================================
*/

function calculatePercentage(
    amount,
    percentage
) {

    amount =
        normalizeMoney(amount);

    percentage =
        Number(percentage);

    if (
        !Number.isFinite(percentage) ||
        percentage < 0
    ) {

        throw new Error(
            "Invalid percentage."
        );

    }

    return normalizeMoney(
        amount *
        (
            percentage / 100
        )
    );

}


/*
    =========================================
    MARKETPLACE PRICE
    =========================================

    Vendor price:
        ₦10,000

    5% fee:
        ₦500

    Customer price:
        ₦10,500
*/

function calculateMarketplacePrice(
    vendorPrice,
    platformFeePercent =
        DEFAULT_VENDOR_PLATFORM_FEE_PERCENT
) {

    const price =
        normalizeMoney(
            vendorPrice
        );

    const platformFee =
        calculatePercentage(
            price,
            platformFeePercent
        );

    const customerPrice =
        normalizeMoney(
            price +
            platformFee
        );

    return {

        vendorPrice:
            price,

        platformFee:
            platformFee,

        customerPrice:
            customerPrice

    };

}


/*
    =========================================
    DELIVERY / RIDE SPLIT
    =========================================
*/

function calculatePartnerSplit(
    customerPayment,
    partnerPercent =
        DEFAULT_PARTNER_SHARE_PERCENT,
    platformPercent =
        DEFAULT_PLATFORM_SHARE_PERCENT
) {

    const amount =
        normalizeMoney(
            customerPayment
        );

    const partnerEarning =
        calculatePercentage(
            amount,
            partnerPercent
        );

    const platformRevenue =
        calculatePercentage(
            amount,
            platformPercent
        );

    return {

        grossCustomerPayment:
            amount,

        partnerEarning:
            partnerEarning,

        platformRevenue:
            platformRevenue

    };

}


/*
    =========================================
    AMBASSADOR COMMISSION
    =========================================
*/

function calculateAmbassadorCommission(
    platformRevenue,
    referralType
) {

    const rewardPercent =
        AMBASSADOR_REWARDS[
            referralType
        ];

    if (
        !rewardPercent
    ) {

        return 0;

    }

    return calculatePercentage(
        platformRevenue,
        rewardPercent
    );

}