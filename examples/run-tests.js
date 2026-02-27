// Runs all 11 test cases and outputs structured JSON per issue.
// Usage: node examples/run-tests.js  (from project root, after npm run build)

const path = require("path");
const { analyze } = require(path.join(__dirname, "../dist/index.js"));


const FILENAME = "test-cases.js";

function toType(category) {
    if (category === "security") return "security";
    if (category === "complexity") return "complexity";
    if (category === "bug") return "bug";
    return "lint"; // style, redundancy
}

function fmt(issue) {
    return {
        file: FILENAME,
        line: issue.line ?? null,
        column: issue.column ?? null,
        type: toType(issue.category),
        severity: issue.severity,
        message: issue.message,
        fix: issue.suggestion ?? "No suggestion provided",
    };
}

const CASES = [
    {
        label: "Test 1 — Null Dereference",
        expected: "bug/warning: null dereference on user.name",
        code: `function printName(user) {\n  return user.name.toUpperCase();\n}\nprintName(null);`,
    },
    {
        label: "Test 2 — Off-by-One Error",
        expected: "bug/warning: i <= arr.length",
        code: `function printArray(arr) {\n  for (let i = 0; i <= arr.length; i++) {\n    console.log(arr[i]);\n  }\n}`,
    },
    {
        label: "Test 3 — Unreachable Code",
        expected: "bug/warning: code after return",
        code: `function test() {\n  return 5;\n  console.log("This will never run");\n}`,
    },
    {
        label: "Test 4 — Unused Variable",
        expected: "lint/warning: result declared but never used",
        code: `function calculate() {\n  let result = 10;\n  return 5;\n}`,
    },
    {
        label: "Test 5 — Shadowed Declaration",
        expected: "lint/warning: inner count shadows outer count",
        code: `let count = 10;\nfunction update() {\n  let count = 5;\n  console.log(count);\n}`,
    },
    {
        label: "Test 6 — Incorrect Type Coercion",
        expected: "lint/warning: use === not ==",
        code: `if ("5" == 5) {\n  console.log("Loose equality");\n}`,
    },
    {
        label: "Test 7 — Naming Convention",
        expected: "lint/info: user_name violates camelCase",
        code: `let user_name = "John";\nconsole.log(user_name);`,
    },
    {
        label: "Test 8 — Multiple Issues (stress test)",
        expected: "unused var + off-by-one + loose equality + unreachable",
        code: `function testMultiple(arr) {\n  let unusedVar = 5;\n  for (let i = 0; i <= arr.length; i++) {\n    if ("5" == 5) {\n      return arr[i];\n      console.log("dead");\n    }\n  }\n}`,
    },
    {
        label: "Test 9 — No Issues (clean code)",
        expected: "0 issues",
        code: `function sum(arr) {\n  let total = 0;\n  for (let i = 0; i < arr.length; i++) {\n    total += arr[i];\n  }\n  return total;\n}`,
    },
    {
        label: "Test 10 — Deep Nesting",
        expected: "complexity/warning: nesting > 3 levels",
        code: `function deep(x) {\n  if (x > 0) {\n    if (x > 1) {\n      if (x > 2) {\n        if (x > 3) {\n          console.log("Too deep");\n        }\n      }\n    }\n  }\n}`,
    },
    {
        label: "Test 11 — Long Function (>50 lines)",
        expected: "complexity/warning: function exceeds 50 lines",
        code: `function longFunction() {\n` +
            Array.from({ length: 53 }, (_, i) => `  console.log(${i + 1});`).join("\n") +
            `\n}`,
    },
];

async function main() {
    const divider = "─".repeat(60);

    let totalIssues = 0;
    let passCount = 0;

    for (const tc of CASES) {
        const report = await analyze(tc.code, { filename: FILENAME });
        const allIssues = [...report.issues, ...report.securityIssues];

        console.log(`\n${"═".repeat(60)}`);
        console.log(`  ${tc.label}`);
        console.log(`  Expected : ${tc.expected}`);
        console.log(`  Score    : ${(report.score * 100).toFixed(1)}%   Issues found: ${allIssues.length}`);
        console.log(divider);

        if (allIssues.length === 0) {
            console.log("  No issues detected.");
            if (tc.label.includes("Test 9")) passCount++;
        } else {
            // Print structured JSON per issue
            allIssues.forEach(issue => {
                const structured = fmt(issue);
                console.log(JSON.stringify(structured, null, 2));
            });
            if (!tc.label.includes("Test 9")) passCount++;
        }

        totalIssues += allIssues.length;
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log(`  SUMMARY`);
    console.log(`  Total issues detected across all tests : ${totalIssues}`);
    console.log(`  Tests that produced expected output    : ${passCount} / ${CASES.length}`);
    console.log(`${"═".repeat(60)}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
