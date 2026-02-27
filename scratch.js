// scratch.js — paste any code snippet into `CODE` and run:
//   node scratch.js
// from the project root (after npm run build)

const { analyze } = require("./src/dist/index.js");

// ─── PASTE YOUR CODE HERE ────────────────────────────────────────────────────
const CODE = `
var user = null;
if (user == null) {
  var PASSWORD = "mySecret123";
  eval("doSomething()");
}
console.log(user.name);
`;

const FILENAME = "test.js";
(async () => {
    const report = await analyze(CODE, { filename: FILENAME });

    console.log(
        `${report.detection.language}
        ${report.detection.method}
        ${(report.detection.confidence)}
        `);

    console.log(`${(report.score * 100)}`);
    console.log("penalties:", report.penaltyBreakdown);

    if (report.issues.length === 0) {
        console.log("  (none)");
    } else {
        report.issues.forEach(i =>
            console.log(`  [${i.severity.padEnd(7)}] L${String(i.line ?? "?").padEnd(4)} [${i.category}] ${i.message}`)
        );
    }

    console.log("\n━━━━━━━━━━━━ SECURITY ISSUES ━━━━━");
    if (report.securityIssues.length === 0) {
        console.log("  (none)");
    } else {
        report.securityIssues.forEach(i =>
            console.log(`  [${i.severity.padEnd(7)}] L${String(i.line ?? "?").padEnd(4)} ${i.message}`)
        );
    }

    console.log("\n━━━━━━━━━━━━ COMPLEXITY ━━━━━━━━━━");
    console.log(`  Decision points : ${report.complexityMetrics.decisionPoints}`);
    console.log(`  Max nesting     : ${report.complexityMetrics.maxDepth}`);

    console.log("\n━━━━━━━━━━━━ STAGE TIMING ━━━━━━━━");
    for (const [engine, ms] of Object.entries(report.stageTiming)) {
        console.log(`  ${engine.padEnd(20)} ${ms}ms`);
    }

    console.log("\n━━━━━━━━━━━━ SNAPSHOT ━━━━━━━━━━━━");
    console.log(report.snapshot);
    console.log();
})();
