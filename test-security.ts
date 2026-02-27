// import { runSecurityAnalysis } from "./src/security";

// async function main(){
//   const files = [
//     // "temp-python-bad.py",
//     // "temp-python-good.py",
//     // "temp-java-bad.java",
//     // "temp-java-good.java",
//     "temp-node-bad.js",
//     // "temp-node-good.js",
//     // "test-command-bad.js",
//     // "test-path-bad.js"
//   ];
//   for (const file of files) {
//     console.log(`\n===== Scanning ${file} =====\n`);
//     const issues = await runSecurityAnalysis([file]);

//     if (issues.length === 0) {
//       console.log("✅ No issues detected.");
//     } else {
//       console.log(JSON.stringify(issues, null, 2));
//     }
//   }
// }

// main()


import { runSecurityAnalysis } from "./src/security";
import { clearDependencyCache } from "./src/security/dependency";

// this is the real osv api call, real dependency scan
// this is the real static scan, no simulation
// this is what your tool actually does in production
async function testNormal() {
  console.log("\n================ NORMAL OSV CHECK ================\n");

  clearDependencyCache();

  const issues = await runSecurityAnalysis(["test-c-bad.c"]);

  if (issues.length === 0) {
    console.log("✅ No issues detected.");
  } else {
    console.log(JSON.stringify(issues, null, 2));
  }
}

// this is when osv rate limit exceeded
// this is only for testing , we can't easily force osv to rate limit u
// async function testRateLimit() {
//   console.log("\n================ SIMULATED RATE LIMIT ================\n");

//   clearDependencyCache();

//   process.env.TEST_RATE_LIMIT = "true";

//   const issues = await runSecurityAnalysis(["temp-node-bad.js"]);

//   if (issues.length === 0) {
//     console.log("✅ No issues detected.");
//   } else {
//     console.log(JSON.stringify(issues, null, 2));
//   }

//   delete process.env.TEST_RATE_LIMIT;
// }


// this simulates when osv server down or no internet
// this proves rate-limit handling works
// async function testNetworkFailure() {
//   console.log("\n================ SIMULATED NETWORK FAILURE ================\n");

//   clearDependencyCache();

//   process.env.TEST_NETWORK_FAIL = "true";

//   const issues = await runSecurityAnalysis(["temp-node-bad.js"]);

//   if (issues.length === 0) {
//     console.log("✅ No issues detected.");
//   } else {
//     console.log(JSON.stringify(issues, null, 2));
//   }

//   delete process.env.TEST_NETWORK_FAIL;
// }

async function main() {
  await testNormal();
  // await testRateLimit();
  // await testNetworkFailure();
}

main().catch(err => {
  console.error("Error during testing:", err);
});