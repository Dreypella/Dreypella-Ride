const assert = require("node:assert/strict");
const admin = require("firebase-admin");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Safety stop: Firestore Emulator is not configured.");
}

admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || "demo-dreypella-test"
});

const db = admin.firestore();
const api = require("./rideConsolidation");

async function main() {
    const adminId = "rc_test_admin";
    const customerA = "rc_test_customer_a";
    const customerB = "rc_test_customer_b";
    const customerC = "rc_test_customer_c";
    const otherCustomer = "rc_test_other";
    const requestIds = [
        "rc_test_request_a",
        "rc_test_request_b",
        "rc_test_request_c"
    ];

    await db.collection("users").doc(adminId).set({ role: "ADMIN" });
    for (const uid of [customerA, customerB, customerC, otherCustomer]) {
        await db.collection("users").doc(uid).set({ role: "CUSTOMER" });
    }

    const records = [
        { userId: customerA, travelDate: "2026-10-20" },
        { userId: customerB, travelDate: "2026-10-21" },
        { userId: customerC, travelDate: "2026-10-22" }
    ];

    for (let i = 0; i < requestIds.length; i++) {
        await db.collection("rideBookings").doc(requestIds[i]).set({
            ...records[i],
            requestType: "CUSTOM_REQUEST",
            status: "REQUESTED",
            tripId: null,
            consolidationStatus: "NONE",
            fromCity: "Ogbomoso",
            toCity: "Lagos"
        });
    }

    const proposal = await api.proposeRideConsolidation({
        requestIds,
        proposedTripDate: "2026-10-21",
        proposedTripTime: "10:00"
    }, { auth: { uid: adminId } });

    assert.equal(proposal.success, true);
    console.log("PASS: admin proposes consolidation");

    await assert.rejects(
        api.respondToRideConsolidation({
            requestId: requestIds[0],
            response: "ACCEPTED"
        }, { auth: { uid: otherCustomer } }),
        error => error.code === "permission-denied"
    );
    console.log("PASS: unrelated customer is denied");

    await api.respondToRideConsolidation({
        requestId: requestIds[0],
        response: "ACCEPTED"
    }, { auth: { uid: customerA } });

    assert.equal(
        (await db.collection("rideBookings").doc(requestIds[0]).get())
            .data().consolidationStatus,
        "ACCEPTED"
    );
    console.log("PASS: request owner can accept");

    const decline = await api.respondToRideConsolidation({
        requestId: requestIds[1],
        response: "DECLINED"
    }, { auth: { uid: customerB } });

    assert.equal(decline.success, true);
    assert.equal(decline.response, "DECLINED");
    assert.equal(decline.consolidationDissolved, false);

    const declinedRequest = await db.collection("rideBookings")
        .doc(requestIds[1]).get();
    assert.equal(declinedRequest.data().status, "REQUESTED");
    assert.equal(declinedRequest.data().tripId, null);
    assert.equal(declinedRequest.data().consolidationStatus, "NONE");
    assert.equal(declinedRequest.data().consolidationGroupId, null);
    assert.equal(declinedRequest.data().lastConsolidationResponse, "DECLINED");

    const acceptedRequest = await db.collection("rideBookings")
        .doc(requestIds[0]).get();
    assert.equal(acceptedRequest.data().consolidationStatus, "ACCEPTED");
    assert.equal(acceptedRequest.data().consolidationGroupId, proposal.consolidationGroupId);

    const pendingRequest = await db.collection("rideBookings")
        .doc(requestIds[2]).get();
    assert.equal(pendingRequest.data().status, "REQUESTED");
    assert.equal(pendingRequest.data().tripId, null);
    assert.equal(pendingRequest.data().consolidationStatus, "PROPOSED");
    assert.equal(pendingRequest.data().consolidationGroupId, proposal.consolidationGroupId);

    for (const requestId of requestIds) {
        const snap = await db.collection("rideBookings").doc(requestId).get();
        assert.equal(snap.data().status, "REQUESTED");
        assert.equal(snap.data().tripId, null);
    }

    const declinedNotice = await db.collection("notifications")
        .doc(proposal.consolidationGroupId + "__" + requestIds[1]).get();
    assert.equal(declinedNotice.exists, true);
    assert.equal(declinedNotice.data().read, true);

    const pendingNotice = await db.collection("notifications")
        .doc(proposal.consolidationGroupId + "__" + requestIds[2]).get();
    assert.equal(pendingNotice.exists, true);
    assert.equal(pendingNotice.data().read, false);

    const acceptedNotice = await db.collection("notifications")
        .doc(proposal.consolidationGroupId + "__" + requestIds[0]).get();
    assert.equal(acceptedNotice.exists, true);
    assert.equal(acceptedNotice.data().read, false);

    for (const requestId of requestIds) {
        const dissolutionNotice = await db.collection("notifications")
            .doc(proposal.consolidationGroupId + "__DISSOLVED__" + requestId).get();
        assert.equal(dissolutionNotice.exists, false);
    }

    await api.respondToRideConsolidation({
        requestId: requestIds[2],
        response: "ACCEPTED"
    }, { auth: { uid: customerC } });

    const customerCAfterResponse = await db.collection("rideBookings")
        .doc(requestIds[2]).get();
    assert.equal(customerCAfterResponse.data().consolidationStatus, "ACCEPTED");
    assert.equal(
        customerCAfterResponse.data().consolidationGroupId,
        proposal.consolidationGroupId
    );

    console.log("PASS: declining customer alone is removed from the proposal");
    console.log("PASS: accepted customer's state remains unchanged");
    console.log("PASS: remaining customer can accept after another customer declines");
    console.log("PASS: only the declining customer's proposal notification is marked read");
    console.log("PASS: no group-dissolution notifications are created");
    console.log("ALL INTEGRATION CHECKS PASSED");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("INTEGRATION TEST FAILED:", error);
        process.exit(1);
    });
