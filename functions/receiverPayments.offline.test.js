const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
const writes = [];
const requestId = "request-old";
const token = "offline-test-token-01234567890123456789";

let request;
let delivery;
let paystackResult;

const requestRef = { id: requestId, update: async value => writes.push(["request-direct", value]) };
const deliveryRef = { id: "delivery-test" };
const reconciliationRef = { id: "reconciliation-test" };

const db = {
  collection(name) {
    return {
      where() {
        return {
          limit() {
            return {
              get: async () => ({
                empty: false,
                docs: [{ id: requestId, ref: requestRef, data: () => ({ ...request }) }]
              })
            };
          }
        };
      },
      doc(id) {
        if (name === "deliveries") return deliveryRef;
        if (name === "receiverPaymentReconciliations") return reconciliationRef;
        return { id };
      }
    };
  },
  async runTransaction(callback) {
    const tx = {
      get: async ref => ref === requestRef
        ? { exists: true, data: () => ({ ...request }) }
        : { exists: true, data: () => ({ ...delivery }) },
      update: (ref, value) => writes.push(["update", ref.id, value]),
      set: (ref, value) => writes.push(["set", ref.id, value])
    };
    return callback(tx);
  }
};

const adminMock = {
  firestore: Object.assign(() => db, {
    FieldValue: { serverTimestamp: () => "MOCK_TIMESTAMP" },
    Timestamp: {
      now: () => ({ toMillis: () => Date.now() }),
      fromMillis: ms => ({ toMillis: () => ms })
    }
  })
};

Module._load = function (name, parent, isMain) {
  if (name === "firebase-admin") return adminMock;
  if (name === "./walletHelpers" && parent?.filename.endsWith("/receiverPayments.js")) {
    return { db, money: value => Math.round(Number(value || 0) * 100) / 100 };
  }
  if (name === "./paystack" && parent?.filename.endsWith("/receiverPayments.js")) {
    return { paystackRequest: async () => ({ data: paystackResult }) };
  }
  return originalLoad.call(this, name, parent, isMain);
};

const { verifyReceiverPayment } = require("./receiverPayments");
Module._load = originalLoad;

function reset(status = "PENDING", allocation = {}) {
  writes.length = 0;
  request = {
    requestId,
    deliveryId: "delivery-test",
    destinationIndex: 0,
    amount: 100,
    tokenHash: require("node:crypto").createHash("sha256").update(token).digest("hex"),
    status,
    expiresAt: { toMillis: () => status === "EXPIRED" ? Date.now() - 1000 : Date.now() + 60000 }
  };
  delivery = {
    destinations: [{}],
    customerPrice: 100,
    paymentStatus: "PAYMENT_PENDING",
    recipientPaymentAllocations: [{
      destinationIndex: 0,
      amount: 100,
      paymentStatus: "PENDING",
      paymentRequestId: requestId,
      ...allocation
    }]
  };
  paystackResult = {
    status: "success",
    reference: "offline-reference",
    currency: "NGN",
    amount: 10000,
    id: 12345,
    channel: "card"
  };
}

async function run() {
  reset();
  const success = await verifyReceiverPayment({ token, reference: "offline-reference" });
  assert.equal(success.status, "SUCCESS");
  assert(writes.some(w => w[0] === "update" && w[1] === "delivery-test"));
  console.log("PASS: valid payment updates delivery.");

  reset("EXPIRED");
  const expired = await verifyReceiverPayment({ token, reference: "offline-reference" });
  assert.equal(expired.status, "RECONCILIATION_REQUIRED");
  assert(writes.some(w => w[0] === "set" && w[1] === "reconciliation-test"));
  console.log("PASS: expired payment is recorded for reconciliation.");

  reset("PENDING", { paymentRequestId: "request-new" });
  const replaced = await verifyReceiverPayment({ token, reference: "offline-reference" });
  assert.equal(replaced.status, "RECONCILIATION_REQUIRED");
  console.log("PASS: replaced link is recorded for reconciliation.");

  reset("PENDING", { paymentStatus: "PAID", paymentReference: "different-reference" });
  const alreadyPaid = await verifyReceiverPayment({ token, reference: "offline-reference" });
  assert.equal(alreadyPaid.status, "RECONCILIATION_REQUIRED");
  assert(writes.some(w => w[0] === "set" && w[2]?.reason === "ALLOCATION_ALREADY_PAID_DIFFERENT_REFERENCE"));
  assert(!writes.some(w => w[0] === "update" && w[1] === "delivery-test" && w[2]?.recipientPaymentAllocations?.[0]?.paymentReference === "offline-reference"));
  console.log("PASS: already-paid allocation with a different reference requires reconciliation.");

  reset();
  paystackResult.amount = 999;
  await assert.rejects(
    verifyReceiverPayment({ token, reference: "offline-reference" }),
    /amount does not match/
  );
  console.log("PASS: mismatched Paystack amount is rejected.");
}

run().catch(error => {
  console.error("FAIL:", error);
  process.exitCode = 1;
});
