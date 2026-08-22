/*
    =========================================
    DREYPELLA RIDE
    UNIFIED WALLET CONFIGURATION
    =========================================
*/

const WALLET_TYPES = {

    CUSTOMER: "CUSTOMER",

    VENDOR: "VENDOR",

    RIDER: "RIDER",

    WALKER: "WALKER",

    DRIVER: "DRIVER",

    AMBASSADOR: "AMBASSADOR"

};


const TRANSACTION_TYPES = {

    CREDIT: "CREDIT",

    DEBIT: "DEBIT"

};


const TRANSACTION_STATUS = {

    PENDING: "PENDING",

    COMPLETED: "COMPLETED",

    FAILED: "FAILED",

    REVERSED: "REVERSED",

    CANCELLED: "CANCELLED"

};


const TRANSACTION_CATEGORIES = {

    WALLET_FUNDING:
        "WALLET_FUNDING",

    RIDE_PAYMENT:
        "RIDE_PAYMENT",

    DELIVERY_PAYMENT:
        "DELIVERY_PAYMENT",

    MARKETPLACE_PAYMENT:
        "MARKETPLACE_PAYMENT",

    MARKETPLACE_SALE:
        "MARKETPLACE_SALE",

    PARTNER_EARNING:
        "PARTNER_EARNING",

    PLATFORM_REVENUE:
        "PLATFORM_REVENUE",

    REFERRAL_COMMISSION:
        "REFERRAL_COMMISSION",

    REFUND:
        "REFUND",

    WITHDRAWAL:
        "WITHDRAWAL",

    WITHDRAWAL_REVERSAL:
        "WITHDRAWAL_REVERSAL",

    ADJUSTMENT:
        "ADJUSTMENT"

};


const WALLET_CURRENCY = "NGN";


/*
    MARKETPLACE PLATFORM FEE

    Vendor uploads:
        ₦10,000

    Platform fee:
        5%

    Customer price:
        ₦10,500
*/

const DEFAULT_VENDOR_PLATFORM_FEE_PERCENT =
    5;


/*
    DELIVERY / RIDE REVENUE SPLIT

    Partner:
        70%

    Dreypella:
        30%
*/

const DEFAULT_PARTNER_SHARE_PERCENT =
    70;

const DEFAULT_PLATFORM_SHARE_PERCENT =
    30;


/*
    AMBASSADOR REWARDS

    These percentages are taken
    from Dreypella's 30% platform share.
*/

const AMBASSADOR_REWARDS = {

    CUSTOMER_REFERRAL:
        50,

    VENDOR_REFERRAL:
        20,

    PARTNER_REFERRAL:
        10

};