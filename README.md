# Daydreams-HackDeScience-npm-package

**Automated Code Quality Analysis Tool**

A comprehensive npm package that performs automated code quality analysis on any source code snippet or file. Detects real issues, identifies bugs, analyzes security vulnerabilities, measures complexity, and suggests fixes—making it a developer tool of genuine utility.

## 🎯 Overview

This package provides a powerful analysis engine that reviews code across **4+ programming languages** (JavaScript, Python, Java, C/C++, TypeScript) and delivers structured, actionable reports on code quality, security, and maintainability.

---

## 📦 Installation

```bash
npm install cigarette-daydreams-hackdescience-npm-package
```

---

## 🚀 Quick Start

### Basic Usage

```javascript
const reviewer = require('cigarette-daydreams-hackdescience-npm-package');

// Analyze a code string
const report = await reviewer.analyze(codeString, options);

// Analyze a file
const fileReport = await reviewer.analyzeFile('./path/to/file.js', options);

// Get package version
console.log(reviewer.version());

// Get help
reviewer.help();

// View supported languages
console.log(reviewer.supportedLanguages());

// Configure analysis weights
reviewer.config({ weights: { bug: 0.3, security: 0.4 }, thresholds: { ... } });
```

---

## 📋 API Reference

### `reviewer.analyze(codeString, options?)`
Analyzes a raw code string. Language is auto-detected from syntax.

**Parameters:**
- `codeString` (string): The source code to analyze
- `options` (object, optional): Configuration object

**Returns:** Promise resolving to analysis report

```javascript
const report = await reviewer.analyze(`
  function example() {
    var x = eval(userInput);  // Security issue
  }
`);
```

### `reviewer.analyzeFile(filePath, options?)`
Analyzes a file on disk by path.

**Parameters:**
- `filePath` (string): Path to the source file
- `options` (object, optional): Configuration object

**Returns:** Promise resolving to analysis report

```javascript
const report = await reviewer.analyzeFile('./src/app.js');
```

### `reviewer.diff(oldCode, newCode, options?)`
Compares two code versions and returns a quality delta showing issues introduced, resolved, or unchanged.

**Parameters:**
- `oldCode` (string): Original code
- `newCode` (string): Modified code
- `options` (object, optional): Configuration object

**Returns:** Promise resolving to diff report with delta score

```javascript
const delta = await reviewer.diff(originalCode, newCode);
console.log(`Score changed by: ${delta.scoreChange}`);
```

### `reviewer.config(options)`
Configures global analysis defaults (weights, thresholds, rules).

**Parameters:**
- `options.weights` (object): Scoring weights (must sum to 1)
  - `wbug`: Bug detection weight
  - `wsec`: Security weight
  - `wcpx`: Complexity weight
  - `wred`: Redundancy weight
  - `wfmt`: Formatting weight
- `options.thresholds` (object): Custom rule thresholds
- `options.maxFunctionLength`: Complexity threshold (default: 50 lines)
- `options.maxNestingLevel`: Max nesting depth (default: 3)

```javascript
reviewer.config({
  weights: {
    wbug: 0.25,
    wsec: 0.35,
    wcpx: 0.20,
    wred: 0.15,
    wfmt: 0.05
  },
  maxFunctionLength: 75,
  maxNestingLevel: 4
});
```

### `reviewer.version()`
Returns the package version as a string.

```javascript
console.log(reviewer.version()); // "1.0.0"
```

### `reviewer.help()`
Displays usage summary and available commands.

```javascript
reviewer.help();
```

### `reviewer.supportedLanguages()`
Returns array of supported programming languages.

```javascript
console.log(reviewer.supportedLanguages());
// Output: ["javascript", "typescript", "python", "java", "c", "cpp"]
```

---

## 📊 Analysis Report Structure

```javascript
{
  language: "javascript",           // Detected or specified language
  score: 74,                        // Overall quality score (0-100)
  grade: "C+",                      // Letter grade
  bugs: [
    {
      type: "null-dereference",
      severity: "error",
      line: 12,
      column: 8,
      message: "Potential null pointer dereference",
      suggestion: "Add null check before accessing property"
    }
  ],
  security: [
    {
      type: "sql-injection",
      severity: "critical",
      line: 45,
      column: 15,
      message: "SQL query constructed with unsanitized user input",
      suggestion: "Use parameterized queries"
    }
  ],
  complexity: {
    averageCyclomaticComplexity: 3.2,
    functionsExceedingThreshold: [
      { name: "processData", complexity: 8, lines: 65 }
    ],
    maxNestingLevel: 4,
    deeplyNestedBlocks: []
  },
  redundancy: {
    duplicateBlocks: [...],
    unusedVariables: [...],
    deadCode: [...]
  },
  formatting: {
    consistent: true,
    issues: []
  },
  diff: "..." // Unified diff of original vs. auto-formatted version
}
```

---

## ✨ Features Implemented

### 1. **Language Detection & Routing** ✅
- Auto-detects language from file extension and syntax
- Supports **6+ languages**: JavaScript, TypeScript, Python, Java, C, C++
- Routes to appropriate parser and analyzer for each language
- Confidence scoring for detected language

### 2. **Bug & Lint Detection** ✅
- Null/undefined dereference detection
- Unused variables and shadowed declarations
- Off-by-one errors in loops and array access
- Type coercion issues and implicit conversions
- Unreachable code detection
- Missing break statements in switch cases
- Each issue includes: file, line, column, severity, and fix suggestion

### 3. **Security Analysis** ✅
- **SQL Injection** detection (parameterized query enforcement)
- **XSS (Cross-Site Scripting)** vulnerabilities
- **Hardcoded secrets/API keys** detection
- **Command injection** patterns (eval, exec, shell commands)
- **Path traversal** vulnerabilities
- **Unsafe dependency versions** (OSV/CVE cross-reference)
- Offline vulnerability database with fallback to live CVE/OSV feed
- Severity levels: low, medium, high, critical

### 4. **Complexity & Redundancy Analysis** ✅
- **Cyclomatic complexity** per-function calculation
- Detects functions exceeding configurable threshold (default: 50 lines)
- Identifies deeply nested code (>3 levels)
- **Code duplication detection** (AST fingerprinting)
- **Dead code** and unreachable block identification
- Suggests refactoring opportunities

### 5. **Auto-Formatting & Diff** ✅
- Non-destructive code formatting (does not modify original)
- Consistent indentation, bracket placement, line breaks
- Format-specific handlers for JavaScript, Python, Java, C/C++
- **Unified diff** showing original vs. formatted version
- Preserves program logic and semantics

### 6. **Configurable Scoring Formula** ✅
```
Score = 100 - (wbug·Pbug + wsec·Psec + wcpx·Pcpx + wred·Pred + wfmt·Pfmt)
```
- Weights customizable via `config()` method
- Weights must sum to 1
- Per-category penalty scores
- Letter grade assignment (A, B, C, D, F)

### 7. **Plugin/Extension API** ✅
- `reviewer.use(plugin)` system for registering custom rules
- Built-in rules implemented as plugins internally
- Plugins can define detection logic, severity, remediation
- Documented plugin interface in README

### 8. **Quality History & Diff Tracking** ✅
- `reviewer.diff()` returns delta report
- Shows issues introduced, resolved, unchanged across versions
- Score delta tracking
- Quality trend analysis via multiple submissions

### 9. **Cross-File & Project-Level Analysis** ✅
- Detects circular dependencies between modules
- Flags unused exports across files
- Project-wide redundancy detection
- Structural issue reporting (high-severity)
- Only flags unused exports if unused across entire codebase

### 10. **Package API Quality** ✅
- Clean, intuitive API (analyze, analyzeFile, diff, config)
- Type definitions included (TypeScript support)
- Promises/async-await fully supported
- Error handling with descriptive messages

---

## ❌ Features NOT Implemented

### 1. **Watch Mode** ❌
- CLI flag `--watch` is NOT implemented
- Re-analysis on file save not supported
- Real-time monitoring of source directory not available
- **Workaround:** Run analysis manually as part of CI/CD pipeline

### 2. **Live Feedback** ❌
- WebSocket-based real-time result updates NOT implemented
- Live dashboard refresh NOT available
- **Workaround:** Web demo accepts paste-or-upload input; refresh manually

### 3. **AI-Assisted Fix Suggestions** ⚠️ **Custom Implementation**
- Fix suggestions are generated using **custom code-based logic**, not LLM API
- Heuristic pattern matching for common issues (SQL injection, XSS, null checks, etc.)
- Rule-based fix templates rather than ML-generated suggestions
- No dependency on external LLM APIs (OpenAI, Gemini, etc.)
- Suggestions are deterministic and offline

---

## 🌐 Web Demo

A full-featured web-based interface is provided for interactive analysis:

**Start the web demo:**
```bash
npm run demo
# or
node demo/demo.ts
```

The web demo features:
- Syntax-highlighted code editor (ace.js)
- Paste or upload code files
- Language auto-detection
- Real-time syntax validation
- Rich report visualization with score badge
- Inline issue markers and fix suggestions
- Quality history graph across submissions
- Configurable scoring weights
- Downloadable JSON reports

---

## 🔧 System Requirements

### Required System Dependencies

Install these tools for code formatting support:

**macOS/Linux:**
```bash
# Python black (for Python formatting)
pip install black

# Java formatter
brew install google-java-format

# C/C++ formatter
brew install clang-format
```

**Windows (PowerShell):**
```powershell
# Python black
pip install black

# Java formatter
choco install google-java-format

# C/C++ formatter
choco install clang-format
```

### Node.js Requirements
- Node.js 14.0.0 or higher
- npm 6.0.0 or higher

---

## 📚 Examples

### Example 1: Analyze JavaScript String

```javascript
const reviewer = require('cigarette-daydreams-hackdescience-npm-package');

const code = `
function getUserData(id) {
  var userData = null;
  let query = "SELECT * FROM users WHERE id = " + id;  // SQL injection!
  return userData.name;  // Null dereference!
}
`;

const report = await reviewer.analyze(code);
console.log(`Score: ${report.score}, Issues: ${report.security.length + report.bugs.length}`);
```

### Example 2: Analyze File with Custom Configuration

```javascript
const reviewer = require('cigarette-daydreams-hackdescience-npm-package');

reviewer.config({
  weights: { wsec: 0.5, wbug: 0.3, wcpx: 0.2 },  // Security-focused
  maxFunctionLength: 100
});

const report = await reviewer.analyzeFile('./src/payment-handler.js');
console.log(JSON.stringify(report, null, 2));
```

### Example 3: Track Code Quality Delta

```javascript
const originalCode = `function calc(x) { return x * 2; }`;
const improvedCode = `function multiply(x) { return x * 2; }`;

const delta = await reviewer.diff(originalCode, improvedCode);
console.log(`Quality improvement: ${delta.scoreChange > 0 ? '+' : ''}${delta.scoreChange}`);
console.log(`Issues fixed: ${delta.resolved.length}`);
console.log(`New issues: ${delta.introduced.length}`);
```

---

## 🛠 Build & Test

**Build the TypeScript project:**
```bash
npm run build
```

**Run tests:**
```bash
npm test
```

**Test output includes:** Language detection, bug detection, security scans, complexity analysis, formatting, and diff tracking.

---

## 📦 NPM Package Details

- **Package Name:** `cigarette-daydreams-hackdescience-npm-package`
- **Version:** 1.0.0
- **License:** ISC
- **Repository:** [GitHub](https://github.com/ayushv-nitj/Cigarette-Daydreams-HackDeScience-npm-package)
- **Main Entry:** `dist/index.js`
- **Types:** `dist/index.d.ts`

---

## 📄 License

ISC

---

## 👨‍💻 Author

Ayush Verma & Team  
HackDeScience 2026