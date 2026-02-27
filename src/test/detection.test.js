// ============================================================
// src/test/detection.test.js  —  SUPER DETECTION TEST
// Combines: src/test/detection.test.js + test/detection.test.js
// Run with: node src/test/detection.test.js   (from project root)
//       or: npm test
// ============================================================

// ── Two entry points under test ───────────────────────────────
// 1. analyzeFile(code, { filename? }) → AnalysisReport  (full pipeline)
// 2. detectLanguage(code, filename?)  → DetectionResult (detection only)
const { analyzeFile } = require("../dist/index.js");
const { detectLanguage } = require("../dist/detection/index.js");

let passed = 0;
let failed = 0;
const results = [];

function assert(label, got, expected) {
    const ok = got === expected;
    if (ok) passed++;
    else failed++;
    results.push({ ok, label, got, expected });
}

// ── Helpers ───────────────────────────────────────────────────
// detect via analyzeFile (full pipeline, options object)
function detectViaAnalyzeFile(code, filename) {
    return analyzeFile(code, filename ? { filename } : {}).detection;
}

// detect via detectLanguage (direct call, matches test/detection.test.js style)
function detectDirect(code, filename) {
    return detectLanguage(code, filename);
}

// ══════════════════════════════════════════════════════════════
// SECTION 1 — Extension-Based Detection
// Tested via BOTH entry points
// ══════════════════════════════════════════════════════════════
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  SECTION 1 — Extension-Based Detection (confidence: 1.0)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const extCases = [
    // JavaScript
    { file: "app.js", expected: "javascript" },
    { file: "app.jsx", expected: "javascript" },
    { file: "app.mjs", expected: "javascript" },
    { file: "app.cjs", expected: "javascript" },
    // TypeScript
    { file: "app.ts", expected: "typescript" },
    { file: "app.tsx", expected: "typescript" },
    { file: "app.mts", expected: "typescript" },
    { file: "app.cts", expected: "typescript" },
    // Python
    { file: "app.py", expected: "python" },
    { file: "app.pyw", expected: "python" },
    // Java
    { file: "App.java", expected: "java" },
    // C
    { file: "main.c", expected: "c" },
    { file: "utils.h", expected: "c" },
    // C++
    { file: "main.cpp", expected: "cpp" },
    { file: "main.cc", expected: "cpp" },
    { file: "main.cxx", expected: "cpp" },
    { file: "main.hpp", expected: "cpp" },
];

for (const { file, expected } of extCases) {
    // via analyzeFile  ─ full pipeline
    const d1 = detectViaAnalyzeFile("// code", file);
    assert(`[analyzeFile]    ext: ${file} → ${expected}`, d1.language, expected);
    assert(`[analyzeFile]    ext: ${file} confidence = 1.0`, d1.confidence, 1.0);
    assert(`[analyzeFile]    ext: ${file} method = extension`, d1.method, "extension");

    // via detectLanguage ─ direct
    const d2 = detectDirect("// code", file);
    assert(`[detectLanguage] ext: ${file} → ${expected}`, d2.language, expected);
    assert(`[detectLanguage] ext: ${file} confidence = 1.0`, d2.confidence, 1.0);
    assert(`[detectLanguage] ext: ${file} method = extension`, d2.method, "extension");
}

// ══════════════════════════════════════════════════════════════
// SECTION 2 — Shebang Detection
// ══════════════════════════════════════════════════════════════
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  SECTION 2 — Shebang Detection");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const shebangCases = [
    { shebang: "#!/usr/bin/env python3\nprint('hello')", expected: "python", label: "python3 shebang" },
    { shebang: "#!/usr/bin/python\nprint('hello')", expected: "python", label: "python shebang (direct)" },
    { shebang: "#!/usr/bin/env node\nconsole.log('hi')", expected: "javascript", label: "node shebang" },
    { shebang: "#!/usr/bin/node\nconsole.log('hi')", expected: "javascript", label: "node shebang (direct)" },
    { shebang: "#!/usr/bin/env ts-node\nconst x: number = 1;", expected: "typescript", label: "ts-node shebang" },
];

for (const { shebang, expected, label } of shebangCases) {
    const d1 = detectViaAnalyzeFile(shebang);
    assert(`[analyzeFile]    shebang: ${label} → ${expected}`, d1.language, expected);
    assert(`[analyzeFile]    shebang: ${label} method = shebang`, d1.method, "shebang");

    const d2 = detectDirect(shebang);
    assert(`[detectLanguage] shebang: ${label} → ${expected}`, d2.language, expected);
    assert(`[detectLanguage] shebang: ${label} method = shebang`, d2.method, "shebang");
}

// ══════════════════════════════════════════════════════════════
// SECTION 3 — Syntax-Based Detection
// ══════════════════════════════════════════════════════════════
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  SECTION 3 — Syntax-Based Detection");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const syntaxCases = [
    {
        label: "JavaScript (require, console.log, var)",
        expected: "javascript",
        code: `
var express = require('express');
var app = express();
console.log('Server running');
app.get('/', function(req, res) {
  res.send('Hello World');
});
app.listen(3000);
`
    },
    {
        label: "TypeScript (interface, type annotation, generics)",
        expected: "typescript",
        code: `
interface User {
  id: number;
  name: string;
  email: string;
}
async function getUser(id: number): Promise<User> {
  const response = await fetch('/api/users/' + id);
  return response.json() as User;
}
const users: User[] = [];
`
    },
    {
        label: "Python (def, self, elif, import)",
        expected: "python",
        code: `
import os
from pathlib import Path

class FileProcessor:
    def __init__(self, path):
        self.path = path

    def process(self):
        for file in os.listdir(self.path):
            if file.endswith('.txt'):
                self._handle(file)
            elif file.endswith('.csv'):
                self._handle_csv(file)
            else:
                pass

    def _handle(self, f):
        with open(f) as fh:
            return fh.read()
`
    },
    {
        label: "Java (public class, System.out, extends, @Override)",
        expected: "java",
        code: `
import java.util.ArrayList;
import java.util.List;

public class Animal {
    private String name;
    private int age;

    public Animal(String name, int age) {
        this.name = name;
        this.age = age;
    }

    public String getName() { return this.name; }

    @Override
    public String toString() {
        return "Animal(" + name + ", " + age + ")";
    }
}

public class Dog extends Animal implements Runnable {
    public void run() {
        System.out.println("Dog is running");
    }
}
`
    },
    {
        label: "C (include stdio, printf, malloc, int main)",
        expected: "c",
        code: `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char name[50];
    int age;
} Person;

int main(int argc, char *argv[]) {
    Person *p = malloc(sizeof(Person));
    strcpy(p->name, "Alice");
    p->age = 30;
    printf("Name: %s, Age: %d\\n", p->name, p->age);
    free(p);
    return 0;
}
`
    },
    {
        label: "C++ (iostream, cout, class, template)",
        expected: "cpp",
        code: `
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

template<typename T>
class Stack {
private:
    vector<T> data;
public:
    void push(const T& item) { data.push_back(item); }
    T pop() {
        T item = data.back();
        data.pop_back();
        return item;
    }
    bool empty() const { return data.empty(); }
};

int main() {
    Stack<int> s;
    s.push(1);
    cout << s.pop() << endl;
    return 0;
}
`
    },
];

for (const { label, expected, code } of syntaxCases) {
    const d1 = detectViaAnalyzeFile(code);
    assert(`[analyzeFile]    syntax: ${label} → ${expected}`, d1.language, expected);
    assert(`[analyzeFile]    syntax: ${label} method = syntax`, d1.method, "syntax");
    assert(`[analyzeFile]    syntax: ${label} confidence ≤ 0.9`, d1.confidence <= 0.9, true);
    assert(`[analyzeFile]    syntax: ${label} confidence > 0`, d1.confidence > 0, true);

    const d2 = detectDirect(code);
    assert(`[detectLanguage] syntax: ${label} → ${expected}`, d2.language, expected);
    assert(`[detectLanguage] syntax: ${label} method = syntax`, d2.method, "syntax");
    assert(`[detectLanguage] syntax: ${label} conf ≤ 0.9`, d2.confidence <= 0.9, true);
}

// ══════════════════════════════════════════════════════════════
// SECTION 4 — Edge Cases
// ══════════════════════════════════════════════════════════════
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  SECTION 4 — Edge Cases");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// Empty file → unknown
const emptyD1 = detectViaAnalyzeFile("");
const emptyD2 = detectDirect("");
assert("[analyzeFile]    edge: empty file → unknown", emptyD1.language, "unknown");
assert("[analyzeFile]    edge: empty file confidence = 0", emptyD1.confidence, 0);
assert("[detectLanguage] edge: empty file → unknown", emptyD2.language, "unknown");
assert("[detectLanguage] edge: empty file confidence = 0", emptyD2.confidence, 0);

// Unknown extension → falls back to syntax (not extension method)
const unknownExt1 = detectViaAnalyzeFile("def foo():\n    return 42\n", "script.rb");
const unknownExt2 = detectDirect("def foo():\n    return 42\n", "script.rb");
assert("[analyzeFile]    edge: .rb extension → not 'extension' method", unknownExt1.method !== "extension", true);
assert("[detectLanguage] edge: .rb extension → not 'extension' method", unknownExt2.method !== "extension", true);

// TypeScript vs JavaScript tie-break: TS wins with type annotations
const tsAmbiguous1 = detectViaAnalyzeFile(`
const x: number = 5;
let y: string = "hello";
interface Foo { bar: string; }
async function fetchData(): Promise<Foo> {
  return { bar: "test" };
}
`);
const tsAmbiguous2 = detectDirect(`
const x: number = 5;
let y: string = "hello";
interface Foo { bar: string; }
async function fetchData(): Promise<Foo> {
  return { bar: "test" };
}
`);
assert("[analyzeFile]    tie-break: TS annotations → typescript", tsAmbiguous1.language, "typescript");
assert("[detectLanguage] tie-break: TS annotations → typescript", tsAmbiguous2.language, "typescript");

// C++ vs C tie-break: C++ wins with iostream
const cppAmbiguous1 = detectViaAnalyzeFile(`
#include <iostream>
#include <vector>
using namespace std;
int main() {
    vector<int> v = {1, 2, 3};
    cout << v.size() << endl;
    return 0;
}
`);
const cppAmbiguous2 = detectDirect(`
#include <iostream>
#include <vector>
using namespace std;
int main() {
    vector<int> v = {1, 2, 3};
    cout << v.size() << endl;
    return 0;
}
`);
assert("[analyzeFile]    tie-break: iostream → cpp", cppAmbiguous1.language, "cpp");
assert("[detectLanguage] tie-break: iostream → cpp", cppAmbiguous2.language, "cpp");

// Binary-like content → unknown
const binaryD1 = detectViaAnalyzeFile("\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C");
const binaryD2 = detectDirect("\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C");
assert("[analyzeFile]    edge: binary content → unknown", binaryD1.language, "unknown");
assert("[detectLanguage] edge: binary content → unknown", binaryD2.language, "unknown");

// Extension beats syntax — python-looking code in a .ts file → typescript
const wrongSyntax1 = detectViaAnalyzeFile("print('this looks like python')", "app.ts");
const wrongSyntax2 = detectDirect("print('this looks like python')", "app.ts");
assert("[analyzeFile]    priority: extension beats syntax → typescript", wrongSyntax1.language, "typescript");
assert("[analyzeFile]    priority: method = extension", wrongSyntax1.method, "extension");
assert("[analyzeFile]    priority: confidence = 1.0", wrongSyntax1.confidence, 1.0);
assert("[detectLanguage] priority: extension beats syntax → typescript", wrongSyntax2.language, "typescript");
assert("[detectLanguage] priority: method = extension", wrongSyntax2.method, "extension");
assert("[detectLanguage] priority: confidence = 1.0", wrongSyntax2.confidence, 1.0);

// ══════════════════════════════════════════════════════════════
// SECTION 5 — analyzeFile Full Pipeline (score, issues, weights)
// ══════════════════════════════════════════════════════════════
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  SECTION 5 — analyzeFile Full Pipeline (score & issues)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// Clean code → score close to 1.0
const cleanReport = analyzeFile("const x = 1;\nconst y = 2;\n", { filename: "clean.ts" });
assert("pipeline: clean TS → detection language = typescript", cleanReport.detection.language, "typescript");
assert("pipeline: clean TS → score ≥ 0.9", cleanReport.score >= 0.9, true);
assert("pipeline: report has weights", typeof cleanReport.weights === "object", true);
assert("pipeline: report has penaltyBreakdown", typeof cleanReport.penaltyBreakdown === "object", true);

// Code with issues → issues array populated
const dirtyCode = `
var x = 1;
eval("alert('xss')");
console.log(x);
`;
const dirtyReport = analyzeFile(dirtyCode, { filename: "dirty.js" });
assert("pipeline: dirty JS → detection language = javascript", dirtyReport.detection.language, "javascript");
assert("pipeline: dirty JS → issues.length > 0", dirtyReport.issues.length > 0, true);
assert("pipeline: dirty JS → score ≤ 1.0", dirtyReport.score <= 1.0, true);
assert("pipeline: dirty JS → score ≥ 0", dirtyReport.score >= 0, true);

// Unknown language → empty issues array
const unknownReport = analyzeFile("");
assert("pipeline: empty code → detection language = unknown", unknownReport.detection.language, "unknown");
assert("pipeline: empty code → issues = []", unknownReport.issues.length, 0);

// ══════════════════════════════════════════════════════════════
// RESULTS SUMMARY
// ══════════════════════════════════════════════════════════════
const divider = "═".repeat(63);
console.log(`\n${divider}`);
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
console.log(`${divider}\n`);

if (failed > 0) {
    console.log("FAILURES:");
    results
        .filter(r => !r.ok)
        .forEach(r =>
            console.log(`  ✗ ${r.label}\n    got: ${JSON.stringify(r.got)}, expected: ${JSON.stringify(r.expected)}`)
        );
    console.log();
    process.exit(1);
} else {
    console.log("  All detection tests passed ✓");
    process.exit(0);
}
