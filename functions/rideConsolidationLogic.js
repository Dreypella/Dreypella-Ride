function applyMemberResponse(proposal, uid, response) {
    const members = Array.isArray(proposal.members) ? proposal.members : [];
    const memberUids = Array.isArray(proposal.memberUids) ? proposal.memberUids : [];
    const member = members.find(item => item.userId === uid);
    if (!member || !memberUids.includes(uid)) throw new Error("You are not an active member of this proposal.");
    if (proposal.status !== "OPEN" || member.responseStatus !== "PENDING") throw new Error("This proposal is no longer awaiting your response.");
    if (!["ACCEPT", "DECLINE"].includes(response)) throw new Error("Invalid proposal response.");
    const nextMembers = response === "ACCEPT"
        ? members.map(item => item.userId === uid ? { ...item, responseStatus: "ACCEPTED" } : item)
        : members.filter(item => item.userId !== uid);
    const declinedMembers = response === "DECLINE"
        ? [...(Array.isArray(proposal.declinedMembers) ? proposal.declinedMembers : []), { bookingId: member.bookingId, userId: uid, passengerName: member.passengerName || "", responseStatus: "DECLINED" }]
        : (Array.isArray(proposal.declinedMembers) ? proposal.declinedMembers : []);
    const nextUids = response === "DECLINE" ? memberUids.filter(id => id !== uid) : [...memberUids];
    const pending = nextMembers.some(item => item.responseStatus === "PENDING");
    const accepted = nextMembers.some(item => item.responseStatus === "ACCEPTED");
    return { members: nextMembers, memberUids: nextUids, declinedMembers, status: pending ? "OPEN" : accepted ? "READY_FOR_ADMIN_REVIEW" : "DECLINED" };
}

module.exports = { applyMemberResponse };
