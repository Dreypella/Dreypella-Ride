const admin = require("firebase-admin");

admin.initializeApp();

const walletFunctions = require("./wallet-functions");
const walletPayments = require("./firebase-functions");
const adminWallet = require("./adminWallet");
const adminWithdrawals = require("./adminWithdrawals");

module.exports = {
    ...walletFunctions,
    ...walletPayments,
    ...adminWallet,
    ...adminWithdrawals
};
