const assert = require("node:assert/strict");
const { applyMemberResponse } = require("./rideConsolidationLogic");

let proposal = {
    status: "OPEN",
    memberUids: ["customerB", "customerC"],
    members: [
        { bookingId: "bookingB", userId: "customerB", passengerName: "B", responseStatus: "PENDING" },
        { bookingId: "bookingC", userId: "customerC", passengerName: "C", responseStatus: "PENDING" }
    ]
};

const afterDecline = applyMemberResponse(proposal, "customerB", "DECLINE");
assert.equal(afterDecline.status, "OPEN");
assert.deepEqual(afterDecline.memberUids, ["customerC"]);
assert.deepEqual(afterDecline.members.map(member => member.userId), ["customerC"]);
assert.equal(afterDecline.declinedMembers[0].userId, "customerB");

proposal = {
    ...proposal,
    members: afterDecline.members,
    memberUids: afterDecline.memberUids,
    declinedMembers: afterDecline.declinedMembers,
    status: afterDecline.status
};

const afterAccept = applyMemberResponse(proposal, "customerC", "ACCEPT");
assert.equal(afterAccept.status, "READY_FOR_ADMIN_REVIEW");
assert.equal(afterAccept.members[0].userId, "customerC");
assert.equal(afterAccept.members[0].responseStatus, "ACCEPTED");
assert.equal(afterAccept.declinedMembers[0].userId, "customerB");

assert.throws(
    () => applyMemberResponse(proposal, "stranger", "ACCEPT"),
    /not an active member/
);
assert.throws(
    () => applyMemberResponse(proposal, "customerC", "MAYBE"),
    /Invalid proposal response/
);

console.log("PASS: declining removes only that customer and preserves an audit record.");
console.log("PASS: remaining customer can accept and proposal advances for admin review.");
console.log("PASS: non-members and invalid responses are rejected.");
