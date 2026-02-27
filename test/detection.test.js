// test/detection.test.js
// Language Detection Accuracy Tests for the merged npm package
// Run with: node test/detection.test.js

const { detectLanguage } = require("../dist/detection/index.js");

let passed = 0;
let failed = 0;

function assert(label, got, expected) {
    const ok = got === expected;
    if (ok) { passed++; }
    else { failed++; console.log(`  ✗ ${label}\n    got: ${JSON.stringify(got)}, expected: ${JSON.stringify(expected)}`); }
}

console.log("\n── Layer 1: Extension-Based Detection ──────────────────────────");
const extCases = [
    { file: "app.js", expected: "javascript" },
    { file: "app.jsx", expected: "javascript" },
    { file: "app.ts", expected: "typescript" },
    { file: "app.tsx", expected: "typescript" },
    { file: "main.py", expected: "python" },
    { file: "Main.java", expected: "java" },
    { file: "main.c", expected: "c" },
    { file: "main.cpp", expected: "cpp" },
    { file: "main.hpp", expected: "cpp" },
];
for (const { file, expected } of extCases) {
    const d = detectLanguage("// code", file);
    assert(`ext: ${file} → ${expected}`, d.language, expected);
    assert(`ext: ${file} confidence = 1.0`, d.confidence, 1.0);
    assert(`ext: ${file} method = extension`, d.method, "extension");
}

console.log("\n── Layer 2: Shebang Detection ───────────────────────────────────");
const shebangCases = [
    { shebang: "#!/usr/bin/env python3\nprint('hi')", expected: "python", label: "python3" },
    { shebang: "#!/usr/bin/env node\nconsole.log(1)", expected: "javascript", label: "node" },
    { shebang: "#!/usr/bin/env ts-node\nconst x:number=1;", expected: "typescript", label: "ts-node" },
];
for (const { shebang, expected, label } of shebangCases) {
    const d = detectLanguage(shebang);
    assert(`shebang: ${label} → ${expected}`, d.language, expected);
    assert(`shebang: ${label} method = shebang`, d.method, "shebang");
}

console.log("\n── Layer 3: Syntax-Based Detection ─────────────────────────────");
const syntaxCases = [
    {
        label: "JavaScript (require, console.log)",
        expected: "javascript",
        code: `var express = require('express');\nconsole.log('running');\napp.get('/', function(req,res){ res.send('hi'); });`
    },
    {
        label: "TypeScript (interface, type annotation)",
        expected: "typescript",
        code: `interface User { id: number; name: string; }\nasync function get(id: number): Promise<User> { return {} as User; }\nconst users: User[] = [];`
    },
    {
        label: "Python (def, self, import)",
        expected: "python",
        code: `import os\nclass Proc:\n    def __init__(self):\n        self.data = []\n    def run(self):\n        for f in os.listdir('.'):\n            if f.endswith('.py'):\n                pass\n        elif True:\n            pass`
    },
    {
        label: "Java (public class, System.out)",
        expected: "java",
        code: `import java.util.ArrayList;\npublic class Main {\n    private String name;\n    public static void main(String[] args) {\n        System.out.println("hello");\n    }\n    @Override\n    public String toString() { return name; }\n}`
    },
    {
        label: "C (#include stdio, printf, malloc)",
        expected: "c",
        code: `#include <stdio.h>\n#include <stdlib.h>\nint main(int argc, char *argv[]) {\n    char *p = malloc(64);\n    printf("hello %s\\n", p);\n    free(p);\n    return 0;\n}`
    },
    {
        label: "C++ (iostream, cout, template)",
        expected: "cpp",
        code: `#include <iostream>\n#include <vector>\nusing namespace std;\ntemplate<typename T>\nclass Stack {\npublic:\n    void push(const T& v) { data.push_back(v); }\nprivate:\n    vector<T> data;\n};\nint main() { cout << "hi" << endl; return 0; }`
    },
];
for (const { label, expected, code } of syntaxCases) {
    const d = detectLanguage(code);
    assert(`syntax: ${label} → ${expected}`, d.language, expected);
    assert(`syntax: ${label} method = syntax`, d.method, "syntax");
    assert(`syntax: ${label} conf ≤ 0.9`, d.confidence <= 0.9, true);
}

console.log("\n── Edge Cases ───────────────────────────────────────────────────");
assert("empty file → unknown", detectLanguage("").language, "unknown");
assert("empty confidence = 0", detectLanguage("").confidence, 0);
assert("ext beats syntax (ts file)",
    detectLanguage("print('python')", "app.ts").language, "typescript");
assert("ext method = extension",
    detectLanguage("print('python')", "app.ts").method, "extension");

console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
console.log("═══════════════════════════════════════════════════════════════\n");
if (failed > 0) process.exit(1);
else console.log("  All detection tests passed ✓");
