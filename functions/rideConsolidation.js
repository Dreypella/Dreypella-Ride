const admin = require("firebase-admin");
const db = admin.firestore();

function normalizeLocation(value) {
    const text = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    return text === "ogbomosho" ? "ogbomoso" : text;
}

function routeKey(from, to) {
    return normalizeLocation(from) + "->" + normalizeLocation(to);
}

async function requireAdmin(context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new Error("Authentication is required.");
    }

    const user = await db.collection("users").doc(context.auth.uid).get();
    const role = user.exists ? user.data().role : "";

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
        throw new Error("Administrator permission is required.");
    }

    return context.auth.uid;
}

async function createConsolidationProposal(data, context) {
    const adminUid = await requireAdmin(context);
    const ids = Array.isArray(data && data.requestIds)
        ? [...new Set(data.requestIds.map(String))]
        : [];

    if (ids.length < 2 || ids.length > 8 || ids.some(id => !id.trim())) {
        throw new Error("Select between 2 and 8 valid ride requests.");
    }

    const refs = ids.map(id => db.collection("rideBookings").doc(id));
    const proposalRef = db.collection("rideConsolidationProposals").doc();

    await db.runTransaction(async tx => {
        const snapshots = [];

        for (const ref of refs) {
            snapshots.push(await tx.get(ref));
        }

        const requests = snapshots.map((snap, index) => {
            if (!snap.exists) throw new Error("A selected ride request no longer exists.");

            const item = snap.data();
            if (item.requestType !== "CUSTOM_REQUEST" || item.status !== "REQUESTED") {
                throw new Error("Only pending custom ride requests can be proposed.");
            }
            if (!item.userId || !item.travelDate || !item.routeKey) {
                throw new Error("Each request needs a customer, route and travel date.");
            }
            if (item.consolidationProposalId) {
                throw new Error("A selected request already has a consolidation proposal.");
            }

            return { id: refs[index].id, ...item };
        });

        const first = requests[0];
        const key = routeKey(first.fromCity, first.toCity);

        if (requests.some(item =>
            routeKey(item.fromCity, item.toCity) !== key ||
            
            item.travelDate !== first.travelDate
        )) {
            throw new Error("Requests must have the same route and travel date.");
        }

        const members = requests.map(item => ({
            bookingId: item.id,
            userId: item.userId,
            passengerName: item.passengerName || "",
            seats: Number(item.seats || 1),
            responseStatus: "PENDING"
        }));

        tx.set(proposalRef, {
            routeKey: key,
            fromCity: first.fromCity,
            toCity: first.toCity,
            travelDate: first.travelDate,
            status: "OPEN",
            members,
            memberUids: members.map(member => member.userId),
            createdBy: adminUid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        refs.forEach(ref => tx.update(ref, {
            consolidationProposalId: proposalRef.id,
            consolidationStatus: "PROPOSED"
        }));
    });

    return { success: true, proposalId: proposalRef.id, status: "OPEN" };
}

async function getMyConsolidationProposals(data, context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new Error("You must be logged in.");
    }

    const uid = context.auth.uid;
    const snapshot = await db.collection("rideConsolidationProposals")
        .where("memberUids", "array-contains", uid)
        .limit(30)
        .get();

    return {
        success: true,
        proposals: snapshot.docs.map(doc => {
            const proposal = doc.data();
            return {
                proposalId: doc.id,
                routeKey: proposal.routeKey,
                fromCity: proposal.fromCity,
                toCity: proposal.toCity,
                travelDate: proposal.travelDate,
                status: proposal.status,
                createdAt: proposal.createdAt || null,
                members: (proposal.members || []).filter(member => member.userId === uid)
            };
        })
    };
}

const { applyMemberResponse } = require("./rideConsolidationLogic");

async function respondToConsolidationProposal(data, context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new Error("You must be logged in.");
    }

    const uid = context.auth.uid;
    const proposalId = String(data && data.proposalId || "").trim();
    const response = String(data && data.response || "").trim().toUpperCase();

    if (!proposalId || !["ACCEPT", "DECLINE"].includes(response)) {
        throw new Error("A valid proposal and ACCEPT or DECLINE response are required.");
    }

    const proposalRef = db.collection("rideConsolidationProposals").doc(proposalId);

    return db.runTransaction(async tx => {
        const proposalSnap = await tx.get(proposalRef);
        if (!proposalSnap.exists) throw new Error("This proposal no longer exists.");

        const proposal = proposalSnap.data();
        const members = Array.isArray(proposal.members) ? proposal.members : [];
        const member = members.find(item => item.userId === uid);

        if (!member || !(proposal.memberUids || []).includes(uid)) {
            throw new Error("You are not an active member of this proposal.");
        }
        if (proposal.status !== "OPEN" || member.responseStatus !== "PENDING") {
            throw new Error("This proposal is no longer awaiting your response.");
        }

        const bookingRef = db.collection("rideBookings").doc(member.bookingId);
        const bookingSnap = await tx.get(bookingRef);

        if (!bookingSnap.exists || bookingSnap.data().userId !== uid ||
            bookingSnap.data().consolidationProposalId !== proposalId) {
            throw new Error("The linked ride request could not be verified.");
        }

        const transition = applyMemberResponse(proposal, uid, response);
        const { members: nextMembers, memberUids: nextUids, declinedMembers, status: nextStatus } = transition;

        tx.update(proposalRef, {
            members: nextMembers,
            memberUids: nextUids,
            declinedMembers,
            status: nextStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        tx.update(bookingRef, {
            consolidationStatus: response === "ACCEPT" ? "ACCEPTED" : "DECLINED",
            consolidationRespondedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, response, proposalStatus: nextStatus };
    });
}

module.exports = {
    applyMemberResponse,
    createConsolidationProposal,
    getMyConsolidationProposals,
    respondToConsolidationProposal
};
