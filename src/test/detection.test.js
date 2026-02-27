// ============================================================
// src/test/detection.test.js — FULL PIPELINE TEST
// Tests:
//   1. Language Detection (extension, shebang, syntax, edge cases)
//   2. Bug & Lint Detection (analyzeFile issues array)
//   3. Complexity Analysis (analyzeComplexity → functions[])
//   4. Redundancy Analysis (analyzeRedundancy → duplicates[])
//
// Run with: npm test  OR  node src/test/detection.test.js
// ============================================================

const { analyzeFile, detectLanguage, analyze } = require("../../dist/index.js");
const { analyzeComplexity } = require("../../dist/complexity/complexity.js");
const { analyzeRedundancy } = require("../../dist/redundancy/redundancy.js");


let passed = 0;
let failed = 0;
const results = [];

function assert(label, got, expected) {
    const ok = got === expected;
    if (ok) passed++; else failed++;
    results.push({ ok, label, got, expected });
}

// ── Print helpers  ──────────────────
const W = 63;
const bar = (c = "━") => c.repeat(W);
const dbar = (c = "═") => c.repeat(W);

function printCode(code) {
    console.log("  ┌─ code " + "─".repeat(W - 9));
    code.trim().split("\n").forEach(l => console.log("  │  " + l));
    console.log("  └" + "─".repeat(W - 2));
}

function printIssues(issues) {
    if (!issues || issues.length === 0) {
        console.log("  Issues    : (none)");
        return;
    }
    console.log(`  Issues (${issues.length}):`);
    issues.forEach(i => {
        console.log(`    [${i.severity.padEnd(7)}] [${i.category.padEnd(10)}] L${String(i.line ?? "?").padEnd(4)} ${i.message}`);
        if (i.suggestion) console.log(`              💡 ${i.suggestion}`);
    });
}

function printComplexity(result) {
    if (!result || result.functions.length === 0) {
        console.log("  Complexity : (no functions found)");
        return;
    }
    console.log(`  Complexity functions (${result.functions.length}):`);
    result.functions.forEach(f => {
        console.log(`    → ${f.name.padEnd(20)} L${String(f.line).padEnd(5)} cyclomatic:${f.cyclomaticComplexity}  lines:${f.length}  nesting:${f.nestingDepth}`);
        if (f.warnings.length > 0) {
            f.warnings.forEach(w => console.log(`      ⚠ ${w}`));
        }
    });
}

function printRedundancy(result) {
    if (!result || result.duplicates.length === 0) {
        console.log("  Redundancy : (no duplicates found)");
        return;
    }
    console.log(`  Redundancy duplicates (${result.duplicates.length}):`);
    result.duplicates.forEach(d => {
        console.log(`    → '${d.name}' (L${d.line}) duplicates '${d.duplicateOf}'`);
    });
}

function runSection(title) {
    console.log(`\n${bar()}`);
    console.log(`  ${title}`);
    console.log(bar());
}

// ══════════════════════════════════════════════════════════════════
// SECTION 1 — Extension-Based Detection
// ══════════════════════════════════════════════════════════════════
runSection("SECTION 1 — Extension-Based Detection (confidence: 1.0)");

const extCases = [
    { file: "app.js", expected: "javascript" },
    { file: "app.jsx", expected: "javascript" },
    { file: "app.mjs", expected: "javascript" },
    { file: "app.cjs", expected: "javascript" },
    { file: "app.ts", expected: "typescript" },
    { file: "app.tsx", expected: "typescript" },
    { file: "app.mts", expected: "typescript" },
    { file: "app.cts", expected: "typescript" },
    { file: "app.py", expected: "python" },
    { file: "app.pyw", expected: "python" },
    { file: "App.java", expected: "java" },
    { file: "main.c", expected: "c" },
    { file: "utils.h", expected: "c" },
    { file: "main.cpp", expected: "cpp" },
    { file: "main.cc", expected: "cpp" },
    { file: "main.hpp", expected: "cpp" },
];

for (const { file, expected } of extCases) {
    const d1 = analyzeFile("// code", { filename: file }).detection;
    const d2 = detectLanguage("// code", file);
    console.log(`  ${file.padEnd(12)} → ${d1.language.padEnd(12)} conf:${d1.confidence} method:${d1.method}`);
    assert(`[analyzeFile]    ext: ${file} → ${expected}`, d1.language, expected);
    assert(`[analyzeFile]    ext: ${file} conf = 1.0`, d1.confidence, 1.0);
    assert(`[analyzeFile]    ext: ${file} method=extension`, d1.method, "extension");
    assert(`[detectLanguage] ext: ${file} → ${expected}`, d2.language, expected);
}

// ══════════════════════════════════════════════════════════════════
// SECTION 2 — Shebang Detection
// ══════════════════════════════════════════════════════════════════
runSection("SECTION 2 — Shebang Detection");

const shebangCases = [
    { shebang: "#!/usr/bin/env python3\nprint('hello')", expected: "python", label: "python3 shebang" },
    { shebang: "#!/usr/bin/python\nprint('hello')", expected: "python", label: "python direct" },
    { shebang: "#!/usr/bin/env node\nconsole.log('hi')", expected: "javascript", label: "node shebang" },
    { shebang: "#!/usr/bin/env ts-node\nconst x: number = 1;", expected: "typescript", label: "ts-node shebang" },
];

for (const { shebang, expected, label } of shebangCases) {
    const d = analyzeFile(shebang).detection;
    console.log(`  ${label.padEnd(20)} → ${d.language.padEnd(12)} method:${d.method}`);
    assert(`shebang: ${label} → ${expected}`, d.language, expected);
    assert(`shebang: ${label} method=shebang`, d.method, "shebang");
}

// ══════════════════════════════════════════════════════════════════
// SECTION 3 — Syntax-Based Detection
// ══════════════════════════════════════════════════════════════════
runSection("SECTION 3 — Syntax-Based Detection");

const syntaxCases = [
    {
        label: "JavaScript", expected: "javascript",
        code: `var express = require('express');\nconsole.log('Server running');`
    },
    {
        label: "TypeScript", expected: "typescript",
        code: `interface User { id: number; name: string; }\nasync function getUser(id: number): Promise<User> { return {} as User; }`
    },
    {
        label: "Python", expected: "python",
        code: `import os\nclass FileProcessor:\n    def __init__(self):\n        self.path = ""\n    def process(self):\n        pass`
    },
    {
        label: "Java", expected: "java",
        code: `public class Animal {\n    private String name;\n    @Override\n    public String toString() { return name; }\n}`
    },
    {
        label: "C", expected: "c",
        code: `#include <stdio.h>\nint main(int argc, char *argv[]) {\n    printf("Hello\\n");\n    return 0;\n}`
    },
    {
        label: "C++", expected: "cpp",
        code: `#include <iostream>\n#include <vector>\nusing namespace std;\ntemplate<typename T>\nclass Stack { public: void push(T item); };`
    },
];

for (const { label, expected, code } of syntaxCases) {
    const d = analyzeFile(code).detection;
    console.log(`  ${label.padEnd(14)} → ${d.language.padEnd(12)} conf:${d.confidence.toFixed(2)} method:${d.method}`);
    printCode(code);
    assert(`syntax: ${label} → ${expected}`, d.language, expected);
    assert(`syntax: ${label} method=syntax`, d.method, "syntax");
}

// ══════════════════════════════════════════════════════════════════
// SECTION 4 — Edge Cases
// ══════════════════════════════════════════════════════════════════
runSection("SECTION 4 — Edge Cases");

const edgeCases = [
    { label: "Empty file", code: "", expectedLang: "unknown", expectedConf: 0 },
    { label: "Binary content", code: "\x00\x01\x02\x03\x04", expectedLang: "unknown" },
    { label: "Ext beats syntax", code: "print('python-looking')", expectedLang: "typescript", filename: "app.ts" },
];

for (const { label, code, expectedLang, filename } of edgeCases) {
    const d = analyzeFile(code, filename ? { filename } : {}).detection;
    console.log(`  ${label.padEnd(22)} → ${d.language.padEnd(12)} method:${d.method}`);
    assert(`edge: ${label} → ${expectedLang}`, d.language, expectedLang);
}

// ══════════════════════════════════════════════════════════════════
// SECTION 5 — Bug & Lint Detection (analyzeFile issues[])
// ══════════════════════════════════════════════════════════════════
runSection("SECTION 5 — Bug & Lint Detection (analyzeFile issues[])");

const lintCases = [
    {
        label: "1. Null Dereference (fn called with null)",
        code: `function printName(user) {\n    return user.name.toUpperCase();\n}\nprintName(null);`,
        filename: "test.js",
        check: r => r.issues.length > 0 || r.securityIssues.length > 0,
        expect: "issues.length > 0",
    },
    {
        label: "2. Off-by-One (i <= arr.length)",
        code: `function printArray(arr) {\n    for (let i = 0; i <= arr.length; i++) {\n        console.log(arr[i]);\n    }\n}`,
        filename: "test.js",
        check: r => r.issues.some(i => i.message.includes("off-by-one") || i.message.includes(".length")),
        expect: "off-by-one detected",
    },
    {
        label: "3. Unreachable Code",
        code: `function test() {\n    return 5;\n    console.log("This will never run");\n}`,
        filename: "test.js",
        check: r => r.issues.some(i => i.message.toLowerCase().includes("unreachable")),
        expect: "unreachable code detected",
    },
    {
        label: "4. Unused Variable",
        code: `function calculate() {\n    let result = 10;\n    return 5;\n}`,
        filename: "test.js",
        check: r => r.issues.some(i => i.message.includes("result") && (i.message.toLowerCase().includes("unused") || i.message.toLowerCase().includes("never used") || i.message.toLowerCase().includes("declared but"))),
        expect: "unused 'result' detected",
    },
    {
        label: "5. Shadowed Declaration",
        code: `let count = 10;\nfunction update() {\n    let count = 5;\n    console.log(count);\n}`,
        filename: "test.js",
        check: r => r.issues.some(i => i.message.toLowerCase().includes("shadow")),
        expect: "shadow detected",
    },
    {
        label: "6. Type Coercion (== instead of ===)",
        code: `if ("5" == 5) { console.log("Loose equality"); }`,
        filename: "test.js",
        check: r => r.issues.some(i => i.message.includes("===") || i.message.includes("==")),
        expect: "loose equality detected",
    },
    {
        label: "7. Naming Convention (user_name)",
        code: `let user_name = "John";\nconsole.log(user_name);`,
        filename: "test.js",
        check: r => r.issues.some(i => i.category === "style"),
        expect: "style/naming issue detected",
    },
    {
        label: "8. Multiple Issues (stress test)",
        code: `function testMultiple(arr) {\n    let unusedVar = 5;\n    for (let i = 0; i <= arr.length; i++) {\n        if ("5" == 5) {\n            return arr[i];\n            console.log("dead");\n        }\n    }\n}`,
        filename: "test.js",
        check: r => r.issues.length >= 3,
        expect: "≥3 issues detected",
    },
    {
        label: "9. Clean Code (0 issues)",
        code: `function sum(arr) {\n    let total = 0;\n    for (let i = 0; i < arr.length; i++) {\n        total += arr[i];\n    }\n    return total;\n}`,
        filename: "test.js",
        check: r => r.issues.filter(i => i.category !== "style").length === 0,
        expect: "0 bug/lint issues",
    },
    {
        label: "10. Deep Nesting",
        code: `function deep(x) {\n    if (x > 0) {\n        if (x > 1) {\n            if (x > 2) {\n                if (x > 3) {\n                    console.log("Too deep");\n                }\n            }\n        }\n    }\n}`,
        filename: "test.js",
        check: r => r.complexityMetrics?.functions?.some(f => f.nestingDepth >= 4)
            || r.issues.some(i => i.category === "complexity" || i.message.toLowerCase().includes("nest")),
        expect: "nesting depth ≥ 4 detected",
    },
];

(async () => {
    for (const { label, code, filename, check, expect } of lintCases) {
        // Use the full async pipeline (analyze) so AST-based rules (unused vars, shadows) are included
        const report = await (async () => {
            const r = await analyze(code, { filename });
            return {
                issues: [...r.issues, ...r.securityIssues],
                score: r.score,
                complexityMetrics: r.complexityMetrics,
            };
        })();
        const allIssues = report.issues;
        const ok = check(report);

        console.log(`\n  ── ${label}`);
        printCode(code);
        console.log(`  Score   : ${(report.score * 100).toFixed(1)}%`);
        printIssues(allIssues);
        console.log(`  Check   : ${ok ? "✅" : "❌"} (expected: ${expect})`);
        assert(`lint: ${label}`, ok, true);
    }

    // ══════════════════════════════════════════════════════════════════
    // SECTION 6 — Complexity Analysis (analyzeComplexity)
    // ══════════════════════════════════════════════════════════════════
    runSection("SECTION 6 — Complexity Analysis (analyzeComplexity → functions[])");

    const complexityCases = [
        {
            label: "Simple function — low complexity",
            code: `function add(a, b) { return a + b; }`,
            check: r => r.functions.length > 0 && r.functions[0].cyclomaticComplexity === 1,
            expect: "cyclomaticComplexity = 1",
        },
        {
            label: "Deep nesting function",
            code: `function deep(x) {\n    if (x > 0) {\n        if (x > 1) {\n            if (x > 2) {\n                if (x > 3) { return x; }\n            }\n        }\n    }\n}`,
            check: r => r.functions.length > 0 && r.functions[0].nestingDepth >= 3,
            expect: "nestingDepth ≥ 3",
        },
        {
            label: "High cyclomatic complexity",
            code: `function grade(score) {\n    if (score >= 90) return 'A';\n    else if (score >= 80) return 'B';\n    else if (score >= 70) return 'C';\n    else if (score >= 60) return 'D';\n    else if (score >= 50) return 'E';\n    else return 'F';\n}`,
            check: r => r.functions.length > 0 && r.functions[0].cyclomaticComplexity > 4,
            expect: "cyclomaticComplexity > 4",
        },
        {
            label: "Multiple functions",
            code: `function foo(a) { return a + 1; }\nfunction bar(b) { return b * 2; }\nfunction baz(c) { if (c > 0) return c; return -c; }`,
            check: r => r.functions.length === 3,
            expect: "3 functions detected",
        },
    ];

    for (const { label, code, check, expect } of complexityCases) {
        const result = analyzeComplexity(code);
        const ok = check(result);

        console.log(`\n  ── ${label}`);
        printCode(code);
        printComplexity(result);
        console.log(`  Check : ${ok ? "✅" : "❌"} (expected: ${expect})`);
        assert(`complexity: ${label}`, ok, true);
    }

    // ══════════════════════════════════════════════════════════════════
    // SECTION 7 — Redundancy Analysis (analyzeRedundancy)
    // ══════════════════════════════════════════════════════════════════
    runSection("SECTION 7 — Redundancy Analysis (analyzeRedundancy → duplicates[])");

    const redundancyCases = [
        {
            label: "Identical function bodies",
            code: `function alpha() {\n    console.log('x');\n    console.log('y');\n    console.log('z');\n}\nfunction beta() {\n    console.log('x');\n    console.log('y');\n    console.log('z');\n}`,
            check: r => r.duplicates.length > 0,
            expect: "duplicate detected",
        },

        {
            label: "No duplicates",
            code: `function foo(a) { return a + 1; }\nfunction bar(b) { return b * 2; }`,
            check: r => r.duplicates.length === 0,
            expect: "no duplicates (0)",
        },
        {
            label: "Repeated code blocks (≥3 statements)",
            code: [
                "function alpha() {",
                "    console.log('a');",
                "    console.log('b');",
                "    console.log('c');",
                "}",
                "function beta() {",
                "    console.log('a');",
                "    console.log('b');",
                "    console.log('c');",
                "}",
            ].join("\n"),
            check: r => r.duplicates.length > 0,
            expect: "repeated block detected",
        },
    ];

    for (const { label, code, check, expect } of redundancyCases) {
        const result = analyzeRedundancy(code);
        const ok = check(result);

        console.log(`\n  ── ${label}`);
        printCode(code);
        printRedundancy(result);
        console.log(`  Check : ${ok ? "✅" : "❌"} (expected: ${expect})`);
        assert(`redundancy: ${label}`, ok, true);
    }

    // ══════════════════════════════════════════════════════════════════
    // RESULTS SUMMARY
    // ══════════════════════════════════════════════════════════════════
    console.log(`\n${dbar()}`);
    console.log(`  RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} total assertions`);
    console.log(dbar());

    if (failed > 0) {
        console.log("\n  FAILURES:");
        results.filter(r => !r.ok).forEach(r =>
            console.log(`  ✗ ${r.label}\n    got: ${JSON.stringify(r.got)}, expected: ${JSON.stringify(r.expected)}`)
        );
        console.log();
        process.exit(1);
    } else {
        console.log("\n  All tests passed ✓");
        process.exit(0);
    }
})().catch(err => { console.error("Test runner error:", err); process.exit(1); });

