import os   from 'os';
import path from 'path';
import { promises as fs } from 'fs';

import {
  format,
  formatFile,
  supportedLanguages,
  generateUnifiedDiff,
  diffStats,
} from '../src/index';

// ─── Tiny test harness ────────────────────────────────────────────────────────

let passed  = 0;
let failed  = 0;
const failures: Array<{ name: string; error: string }> = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push({ name, error: msg });
    console.error(`  ✗ ${name}`);
    console.error(`    ${msg}`);
  }
}

function assertEqual<T>(actual: T, expected: T, msg = ''): void {
  if (actual !== expected) {
    throw new Error(
      `${msg}\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`
    );
  }
}

function assertContains(haystack: string, needle: string, msg = ''): void {
  if (!haystack.includes(needle)) {
    throw new Error(
      `${msg}\nExpected to contain: ${JSON.stringify(needle)}\nIn: ${JSON.stringify(haystack)}`
    );
  }
}

function assertNotContains(haystack: string, needle: string, msg = ''): void {
  if (haystack.includes(needle)) {
    throw new Error(
      `${msg}\nExpected NOT to contain: ${JSON.stringify(needle)}\nIn: ${JSON.stringify(haystack)}`
    );
  }
}

function assertTrue(condition: unknown, msg = ''): void {
  if (!condition) throw new Error(msg || 'Expected true but got false');
}

function assertFalse(condition: unknown, msg = ''): void {
  if (condition) throw new Error(msg || 'Expected false but got true');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Supported Languages
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Supported Languages ===');

test('returns array of supported languages', () => {
  const langs = supportedLanguages();
  assertTrue(Array.isArray(langs));
  assertTrue(langs.length >= 6);
  (['javascript', 'typescript', 'python', 'java', 'c', 'cpp'] as const).forEach((l) =>
    assertTrue(langs.includes(l), `Missing language: ${l}`)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Unified Diff
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Unified Diff Utility ===');

test('generates empty diff for identical strings', () => {
  const diff = generateUnifiedDiff('hello\nworld\n', 'hello\nworld\n');
  assertEqual(diff, '', 'Identical strings should produce empty diff');
});

test('generates diff for changed line', () => {
  const diff = generateUnifiedDiff('hello\nworld\n', 'hello\nearth\n');
  assertContains(diff, '-world', 'Should contain deleted line');
  assertContains(diff, '+earth', 'Should contain inserted line');
  assertContains(diff, '@@', 'Should contain hunk header');
});

test('diff stats: counts additions and deletions', () => {
  const diff  = generateUnifiedDiff('a\nb\nc\n', 'a\nX\nY\nc\n');
  const stats = diffStats(diff);
  assertEqual(stats.additions, 2);
  assertEqual(stats.deletions, 1);
  assertTrue(stats.changed);
});

test('diff stats: no changes', () => {
  const stats = diffStats('');
  assertFalse(stats.changed);
  assertEqual(stats.additions, 0);
  assertEqual(stats.deletions, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: JavaScript Formatting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== JavaScript Formatter ===');

test('returns correct result shape', () => {
  const result = format('const x = 1;\n', 'javascript');
  assertTrue('language'   in result);
  assertTrue('original'   in result);
  assertTrue('formatted'  in result);
  assertTrue('diff'       in result);
  assertTrue('diffParsed' in result);
  assertTrue('stats'      in result);
  assertTrue(result.isNonDestructive);
  assertTrue(result.timestamp.length > 0);
});

test('JS: preserves correct code unchanged (idempotent)', () => {
  const code   = `'use strict';\n\nconst x = 1;\n`;
  const result = format(code, 'js');
  assertFalse(result.stats.changed, 'Well-formatted code should not change');
});

test('JS: removes trailing whitespace', () => {
  const result = format('const x = 1;   \nconst y = 2;  \n', 'javascript');
  assertNotContains(result.formatted, '   \n', 'Should remove trailing spaces');
});

test('JS: enforces K&R brace style', () => {
  const result = format('function foo()\n{\n  return 1;\n}\n', 'javascript');
  assertContains(result.formatted, 'function foo() {', 'Should merge brace to same line');
});

test('JS: re-indents with 2 spaces', () => {
  const result = format('function foo() {\n    const x = 1;\n    return x;\n}\n', 'javascript');
  assertContains(result.formatted, '\n  const x', 'Should use 2-space indent');
});

test('JS: sorts ES6 imports (builtins before external before relative)', () => {
  const code   = `import './local';\nimport 'lodash';\nimport 'fs';\n\nconst x = 1;\n`;
  const result = format(code, 'javascript');
  const lines  = result.formatted.split('\n');
  const fsIdx     = lines.findIndex((l: string) => l.includes("'fs'"));
  const lodashIdx = lines.findIndex((l: string) => l.includes("'lodash'"));
  const localIdx  = lines.findIndex((l: string) => l.includes("'./local'"));
  assertTrue(fsIdx < lodashIdx,     'builtin (fs) should come before external (lodash)');
  assertTrue(lodashIdx < localIdx,  'external (lodash) should come before relative (./local)');
});

test('JS: produces unified diff when code changes', () => {
  const result = format('function foo()\n{\n    return 1;\n}\n', 'javascript');
  if (result.stats.changed) {
    assertContains(result.diff, '@@',  'Should contain diff hunk');
    assertContains(result.diff, '--- ','Should have --- header');
    assertContains(result.diff, '+++ ','Should have +++ header');
  }
});

test('JS: diff is non-destructive (formatted is valid JS structure)', () => {
  const result = format('const obj = {\n  a: 1,\n  b: 2\n};\n', 'js');
  const open   = (result.formatted.match(/\{/g) ?? []).length;
  const close  = (result.formatted.match(/\}/g) ?? []).length;
  assertEqual(open, close, 'Formatted code should have balanced braces');
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: TypeScript Formatting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TypeScript Formatter ===');

test('TS: handles type annotations', () => {
  const result = format('function greet(name:string): void {\n  console.log(name);\n}\n', 'typescript');
  assertFalse(result.error, 'Should not error on TypeScript code');
  assertTrue(result.isNonDestructive);
});

test('TS: accepts tsx alias', () => {
  const result = format('const x: number = 1;\n', 'tsx');
  assertFalse(result.error, 'Should handle tsx alias');
});

test('TS: imports sorted correctly', () => {
  const code   = `import { z } from 'zod';\nimport { readFile } from 'fs';\nimport './styles';\n\nexport const x = 1;\n`;
  const result = format(code, 'ts');
  const lines  = result.formatted.split('\n');
  const fsIdx  = lines.findIndex((l: string) => l.includes("'fs'"));
  const zodIdx = lines.findIndex((l: string) => l.includes("'zod'"));
  assertTrue(fsIdx < zodIdx, 'stdlib (fs) before external (zod)');
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Python Formatting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Python Formatter ===');

test('Python: converts tabs to 4 spaces', () => {
  const result = format('def foo():\n\tx = 1\n\treturn x\n', 'python');
  assertNotContains(result.formatted, '\t',   'Should convert tabs to spaces');
  assertContains(result.formatted,    '    x', 'Should use 4-space indent');
});

test('Python: sorts imports by stdlib/thirdparty/local', () => {
  const code   = `import requests\nimport os\nimport sys\nfrom . import local\n\ndef foo():\n    pass\n`;
  const result = format(code, 'python');
  const lines  = result.formatted.split('\n');
  const osIdx    = lines.findIndex((l: string) => l.trim() === 'import os');
  const reqIdx   = lines.findIndex((l: string) => l.includes('import requests'));
  const localIdx = lines.findIndex((l: string) => l.includes('from . import'));
  assertTrue(osIdx  < reqIdx,   'stdlib (os) before thirdparty (requests)');
  assertTrue(reqIdx < localIdx, 'thirdparty (requests) before local (.)');
});

test('Python: adds 2 blank lines before top-level def', () => {
  const result = format('x = 1\ndef foo():\n    pass\n', 'py');
  assertContains(result.formatted, '\n\ndef foo', 'Should have 2 blank lines before def');
});

test('Python: removes trailing whitespace', () => {
  const result = format('x = 1   \ny = 2  \n', 'python');
  assertNotContains(result.formatted, '   \n');
  assertNotContains(result.formatted, '  \n');
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Java Formatting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Java Formatter ===');

test('Java: enforces K&R brace style', () => {
  const code   = `public class Foo\n{\n    public void bar()\n    {\n        int x = 1;\n    }\n}\n`;
  const result = format(code, 'java');
  assertContains(result.formatted, 'class Foo {', 'Class should have K&R brace');
  assertContains(result.formatted, 'void bar() {', 'Method should have K&R brace');
});

test('Java: sorts imports by java → javax → org → com → other', () => {
  const code   = `import com.example.Foo;\nimport java.util.List;\nimport org.apache.Logger;\n\npublic class Test {}\n`;
  const result = format(code, 'java');
  const lines  = result.formatted.split('\n');
  const javaIdx = lines.findIndex((l: string) => l.includes('java.util'));
  const orgIdx  = lines.findIndex((l: string) => l.includes('org.apache'));
  const comIdx  = lines.findIndex((l: string) => l.includes('com.example'));
  assertTrue(javaIdx < orgIdx, 'java.* before org.*');
  assertTrue(orgIdx  < comIdx, 'org.* before com.*');
});

test('Java: uses 4-space indentation', () => {
  const code   = `public class Foo {\n  public void bar() {\n    int x = 1;\n  }\n}\n`;
  const result = format(code, 'java');
  assertContains(result.formatted, '        int x', 'Should use 4-space indent (8 spaces for nested)');
});

test('Java: keyword spacing (if, for, while)', () => {
  const code   = `public class Foo {\n  void bar() {\n    if(x > 0) {\n      return;\n    }\n  }\n}\n`;
  const result = format(code, 'java');
  assertContains(result.formatted, 'if (x', 'Should have space after if keyword');
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: C Formatting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== C Formatter ===');

test('C: sorts #include system before local', () => {
  const code   = `#include "myheader.h"\n#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n  return 0;\n}\n`;
  const result = format(code, 'c');
  const lines  = result.formatted.split('\n');
  const stdioIdx = lines.findIndex((l: string) => l.includes('<stdio.h>'));
  const myIdx    = lines.findIndex((l: string) => l.includes('"myheader.h"'));
  assertTrue(stdioIdx < myIdx, 'System includes should come before local includes');
});

test('C: 4-space indentation', () => {
  const result = format('int main() {\n  int x = 0;\n  return x;\n}\n', 'c');
  assertContains(result.formatted, '    int x', 'Should use 4-space indent');
});

test('C: preserves preprocessor directives', () => {
  const result = format('#ifndef MYHEADER_H\n#define MYHEADER_H\n\nvoid foo(void);\n\n#endif\n', 'c');
  assertContains(result.formatted, '#ifndef MYHEADER_H');
  assertContains(result.formatted, '#define MYHEADER_H');
  assertContains(result.formatted, '#endif');
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: C++ Formatting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== C++ Formatter ===');

test('C++: handles namespace and class', () => {
  const code   = `#include <iostream>\n\nnamespace myns {\n  class Foo {\n  public:\n    void bar() {\n      int x = 1;\n    }\n  };\n}\n`;
  const result = format(code, 'cpp');
  assertFalse(result.error, 'Should not error on C++ code');
  assertTrue(result.isNonDestructive);
});

test('C++: accepts c++ and cxx aliases', () => {
  const result  = format('int x = 1;\n', 'c++');
  const result2 = format('int x = 1;\n', 'cxx');
  assertFalse(result.error);
  assertFalse(result2.error);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Edge Cases ===');

test('unsupported language: returns code unchanged with error', () => {
  const result = format('fn main() {}', 'rust');
  assertEqual(result.original, result.formatted, 'Unsupported lang: code should be unchanged');
  assertTrue(result.error?.includes('Unsupported'), 'Should have error message');
  assertFalse(result.stats.changed);
});

test('empty code: handles gracefully', () => {
  const result = format('', 'javascript');
  assertFalse(result.error, 'Empty code should not error');
});

test('whitespace-only code: handles gracefully', () => {
  const result = format('   \n  \n', 'python');
  assertFalse(result.error, 'Whitespace-only code should not error');
});

test('format() throws TypeError for non-string code', () => {
  let threw = false;
  try { format(null as unknown as string, 'js'); } catch { threw = true; }
  assertTrue(threw, 'Should throw TypeError for null code');
});

test('diffParsed has correct shape', () => {
  const result = format('function foo()\n{\nreturn 1;\n}\n', 'javascript');
  assertTrue('hunks' in result.diffParsed);
  assertTrue(Array.isArray(result.diffParsed.hunks));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: formatFile (async)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== formatFile (async) ===');

async function asyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push({ name, error: msg });
    console.error(`  ✗ ${name}`);
    console.error(`    ${msg}`);
  }
}

async function runAsync(): Promise<void> {
  const tmp = os.tmpdir();

  await asyncTest('formatFile: reads .js file and detects language from extension', async () => {
    const fp = path.join(tmp, `test_fmt_${Date.now()}.js`);
    await fs.writeFile(fp, 'function foo()\n{\n  return 1;\n}\n', 'utf-8');
    const result = await formatFile(fp);
    assertEqual(result.language, 'javascript', 'Should detect JS from .js extension');
    assertTrue(result.isNonDestructive);
    await fs.unlink(fp);
  });

  await asyncTest('formatFile: reads .py file and detects language', async () => {
    const fp = path.join(tmp, `test_fmt_${Date.now()}.py`);
    await fs.writeFile(fp, 'import os\nimport sys\n\ndef foo():\n    pass\n', 'utf-8');
    const result = await formatFile(fp);
    assertEqual(result.language, 'python');
    await fs.unlink(fp);
  });

  await asyncTest('formatFile: writeBack=true overwrites the file', async () => {
    const fp = path.join(tmp, `test_fmt_wb_${Date.now()}.js`);
    await fs.writeFile(fp, 'function foo()\n{\n  return 1;\n}\n', 'utf-8');
    const result = await formatFile(fp, { writeBack: true });
    if (result.stats.changed) {
      const written = await fs.readFile(fp, 'utf-8');
      assertEqual(written, result.formatted, 'File should contain formatted code after writeBack');
    }
    await fs.unlink(fp);
  });

  await asyncTest('formatFile: language override works', async () => {
    const fp = path.join(tmp, `test_fmt_${Date.now()}.txt`);
    await fs.writeFile(fp, 'const x = 1;\n', 'utf-8');
    const result = await formatFile(fp, { language: 'javascript' });
    assertEqual(result.language, 'javascript', 'Language override should be respected');
    await fs.unlink(fp);
  });

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(`  Tests passed:  ${passed}`);
  console.log(`  Tests failed:  ${failed}`);
  console.log("hello world");
  if (failures.length) {
    console.log('\nFailed tests:');
    failures.forEach((f: { name: string; error: string }) =>
      console.log(`  • ${f.name}: ${f.error}`)
    );
  }
  console.log('═'.repeat(50));

  if (failed > 0) process.exit(1);
}

runAsync().catch((err: unknown) => {
  console.error('Unexpected error in async tests:', err);
  process.exit(1);
});