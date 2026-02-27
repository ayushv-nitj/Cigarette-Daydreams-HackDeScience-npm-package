#!/usr/bin/env node
// examples/analyze.js — Interactive CLI analyzer
//
// Usage:
//   1. Paste code interactively:       node examples/analyze.js
//   2. Pipe a file in:                 cat myfile.js | node examples/analyze.js
//   3. Pass a file as argument:        node examples/analyze.js myfile.js
//   4. Pass a filename hint (language):node examples/analyze.js --filename myfile.ts

const path = require("path");
const fs = require("fs");
const { analyze, detectBySyntax } = require(path.join(__dirname, "../dist/index.js"));


// Map detected language → canonical file extension
const LANG_EXT = {
    javascript: ".js",
    typescript: ".ts",
    python: ".py",
    java: ".java",
    c: ".c",
    cpp: ".cpp",
};

/**
 * For stdin code: run syntax detection on content.
 * If it's confident AND disagrees with --filename hint, content wins.
 * Returns the effective filename to pass to analyze().
 */
function resolveFilenameForStdin(code, userHint) {
    let syntaxResult = null;
    try { syntaxResult = detectBySyntax(code); } catch { /* ignore */ }

    const syntaxLang = syntaxResult?.language;
    const syntaxConf = syntaxResult?.confidence ?? 0;

    // Only override when syntax is reasonably confident (> 0.4)
    if (!syntaxLang || syntaxLang === "unknown" || syntaxConf <= 0.4) {
        return userHint || "stdin.js";
    }

    const ext = LANG_EXT[syntaxLang] ?? ".js";
    const baseName = userHint
        ? path.basename(userHint, path.extname(userHint)) // strip old ext
        : "stdin";
    const effective = baseName + ext;

    // Tell the user if we overrode their hint
    if (userHint && path.extname(userHint) !== ext) {
        console.log(DIM +
            "  ℹ  Filename hint '" + userHint + "' overridden by content detection → '" + effective +
            "'  (syntax conf: " + syntaxConf.toFixed(2) + ")" + RESET);
    }

    return effective;
}


const W = 68;
const BAR = "═".repeat(W);
const DIV = "─".repeat(W);
const SEV_COLOR = {
    error: "\x1b[31m", // red
    warning: "\x1b[33m", // yellow
    info: "\x1b[36m", // cyan
};
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function colored(sev, text) {
    return (SEV_COLOR[sev] ?? "") + text + RESET;
}

function printCode(code) {
    const lines = code.split("\n").slice(0, 6);
    console.log(DIM + "  ┌─ code preview " + "─".repeat(W - 17));
    lines.forEach(l => console.log("  │  " + l));
    if (code.split("\n").length > 6) console.log("  │  … +" + (code.split("\n").length - 6) + " more lines");
    console.log("  └" + "─".repeat(W - 2) + RESET);
}

async function run(code, filename) {
    const hint = filename || "input.js";

    console.log("\n" + BOLD + BAR);
    console.log("  🔍 Analyzing: " + hint);
    console.log(BAR + RESET);
    printCode(code);

    let report;
    try {
        report = await analyze(code, { filename: hint });
    } catch (err) {
        console.error("  ✗ Analysis failed:", err.message);
        process.exit(1);
    }

    // ── Score  ──────────────────────
    const pct = (report.score * 100).toFixed(1);
    const color = report.score >= 0.9 ? "\x1b[32m" : report.score >= 0.7 ? "\x1b[33m" : "\x1b[31m";
    console.log("\n  " + BOLD + "Score   : " + color + pct + "%" + RESET);
    console.log("  Language: " + report.detection.language + "  (method: " + report.detection.method + ", conf: " + report.detection.confidence.toFixed(2) + ")");

    // ── Bug / Lint / Complexity / Redundancy issues ────────────────────────────
    console.log("\n" + DIV);
    if (report.issues.length === 0) {
        console.log("  ✅ No bug/lint/complexity/redundancy issues found.");
    } else {
        console.log(BOLD + "  ISSUES (" + report.issues.length + "):" + RESET);
        report.issues.forEach(i => {
            const tag = "[" + i.severity.padEnd(7) + "]";
            const cat = "[" + i.category.padEnd(11) + "]";
            const line = "L" + String(i.line ?? "?").padEnd(3);
            console.log("  " + colored(i.severity, tag) + " " + cat + " " + line + "  " + i.message);
            if (i.suggestion) {
                console.log("  " + DIM + "           💡  " + i.suggestion + RESET);
            }
        });
    }

    // ── Security issues  ────────────
    if (report.securityIssues.length > 0) {
        console.log("\n" + DIV);
        console.log(BOLD + "  SECURITY (" + report.securityIssues.length + "):" + RESET);
        report.securityIssues.forEach(i => {
            console.log("  " + colored("error", "[" + i.severity.padEnd(7) + "]") + " " + "L" + String(i.line ?? "?").padEnd(3) + "  " + i.message);
            if (i.suggestion) console.log("  " + DIM + "           💡  " + i.suggestion + RESET);
        });
    }

    // ── Complexity  ─────────────────
    if (report.complexityMetrics.functions.length > 0) {
        console.log("\n" + DIV);
        console.log(BOLD + "  COMPLEXITY FUNCTIONS (" + report.complexityMetrics.functions.length + "):" + RESET);
        report.complexityMetrics.functions.forEach(f => {
            const hasWarn = f.warnings.length > 0;
            const icon = hasWarn ? "⚠ " : "✓ ";
            const warn = hasWarn ? colored("warning", "  ⚠ " + f.warnings.join(", ")) : "";
            console.log("  " + icon + f.name.padEnd(22) + "L" + String(f.line).padEnd(4) +
                " cyclomatic:" + f.cyclomaticComplexity +
                "  lines:" + f.length +
                "  nesting:" + f.nestingDepth + warn);
        });
    }

    // ── Redundancy  ─────────────────
    if (report.redundancy.duplicates.length > 0) {
        console.log("\n" + DIV);
        console.log(BOLD + "  REDUNDANCY DUPLICATES (" + report.redundancy.duplicates.length + "):" + RESET);
        report.redundancy.duplicates.forEach(d =>
            console.log("  → '" + d.name + "' (L" + d.line + ") duplicates '" + d.duplicateOf + "'")
        );
    }

    // ── Penalty breakdown  ─────────
    console.log("\n" + DIV);
    console.log(BOLD + "  PENALTY BREAKDOWN:" + RESET);
    const b = report.penaltyBreakdown;
    Object.entries(b).forEach(([cat, val]) =>
        console.log("  " + cat.padEnd(12) + " " + DIV.slice(0, Math.round(val * 30)).replace(/─/g, "█") + " " + (val * 100).toFixed(1) + "%")
    );

    // ── Stage timing  ───────────────
    console.log("\n" + DIV);
    console.log(BOLD + "  STAGE TIMING:" + RESET);
    Object.entries(report.stageTiming).forEach(([k, v]) =>
        console.log("  " + k.padEnd(22) + DIM + v + "ms" + RESET)
    );

    console.log("\n" + BOLD + BAR + RESET + "\n");
}

// ── Input handling  ─────────────────

const args = process.argv.slice(2);
let filename = null;
let inputFile = null;

// Parse --filename hint
const fnIdx = args.indexOf("--filename");
if (fnIdx !== -1 && args[fnIdx + 1]) {
    filename = args[fnIdx + 1];
    args.splice(fnIdx, 2);
}

// If a file path was passed as positional arg
if (args[0] && fs.existsSync(args[0])) {
    inputFile = args[0];
    filename = filename || path.basename(args[0]);
    const code = fs.readFileSync(inputFile, "utf8");
    run(code, filename);
} else {
    // Read from stdin — supports both pipe and interactive paste
    const isTTY = process.stdin.isTTY;
    if (isTTY) {
        console.log(BOLD + "\n  Paste your code below. Press Ctrl+D when done.\n" + RESET);
    }
    let code = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { code += chunk; });
    process.stdin.on("end", () => {
        if (!code.trim()) {
            console.error("  No code provided. Usage:\n" +
                "    node examples/analyze.js myfile.js         # analyze a file\n" +
                "    cat myfile.js | node examples/analyze.js   # pipe from stdin\n" +
                "    node examples/analyze.js [--filename hint] # paste interactively");
            process.exit(1);
        }
        // Content wins over --filename extension when pasting via stdin
        const effectiveFilename = resolveFilenameForStdin(code, filename);
        run(code, effectiveFilename);

    });
}
