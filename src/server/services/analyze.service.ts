const { analyze } = require("../../../dist/index.js");

export const analyzeService = async (code: string, filename: string) => {

  // 🔥 Main security analysis
  const report = await analyze(code, { filename });

  // 🔥 Start background processes (non-blocking)
  setImmediate(() => {
    runBackgroundProcesses(report);
  });

  return report;
};

function runBackgroundProcesses(report: any) {
  try {
    // Example background tasks:
    // - Store report in DB
    // - Trigger scoring engine
    // - Send notification
    // - Generate summary

    console.log("Background process started...");

  } catch (err) {
    console.error("Background process failed:", err);
  }
}