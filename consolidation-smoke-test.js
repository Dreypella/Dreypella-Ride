const assert = require("node:assert/strict");

try {
    const functions = require("./functions");
    const api = require("./functions/rideConsolidation");

    for (const name of [
        "findConsolidationCandidates",
        "proposeRideConsolidation",
        "respondToRideConsolidation"
    ]) {
        assert.equal(typeof api[name], "function", `${name} must be exported by rideConsolidation`);
        assert.equal(typeof functions[name], "function", `${name} must be exported by functions/index.js`);
        console.log(`PASS: ${name} is exported by the module and Functions entry point`);
    }

    console.log("SMOKE TEST PASSED");
} catch (error) {
    console.error("SMOKE TEST FAILED:", error);
    process.exitCode = 1;
}
