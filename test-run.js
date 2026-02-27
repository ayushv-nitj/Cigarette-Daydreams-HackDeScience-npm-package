const { reviewer } = require("./dist/engine/reviewer");

async function runTest() {
  const fs = require("fs");
  const code = fs.readFileSync(filename, "utf-8");

  const r = reviewer.config();
  const report = await r.review(code, { filename });

  console.log("Language:", report.detection.language);
  console.log("Complexity:", report.complexityMetrics);
  console.log("Redundancy:", report.redundancy);
  console.log("Score:", report.score);
}

const filename = process.argv[2];

if (!filename) {
  console.error("Usage: node test-run.js <file-to-review>");
  process.exit(1);
}

runTest(filename).catch((err) => {
  console.error(err);
  process.exit(1);
});