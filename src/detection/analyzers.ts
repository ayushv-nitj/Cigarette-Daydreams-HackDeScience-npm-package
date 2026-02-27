// detection/analyzers.ts — Per-language analyzers + router

import type { CodeIssue, SupportedLanguage } from "./types";

type RuleFn = (code: string, lang: string) => CodeIssue[];
type ComplexityFn = (code: string, threshold?: number) => CodeIssue[];

let _issueCounter = 0;
const uid = () => `issue-${++_issueCounter}`;
const lines = (code: string) => code.split("\n");

// ── JavaScript 
export function analyzeJavaScript(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    lines(code).forEach((line, i) => {
        const ln = i + 1;
        const t = line.trim();
        if (/[^=!<>]={2}[^=]/.test(t) && !/=>/.test(t))
            issues.push({ id: uid(), category: "bug", severity: "warning", message: "Use === instead of ==.", line: ln, suggestion: "Replace == with ===" });
        if (/\beval\s*\(/.test(t))
            issues.push({ id: uid(), category: "security", severity: "error", message: "eval() is dangerous — arbitrary code execution risk.", line: ln, suggestion: "Avoid eval(); use JSON.parse() or safer alternatives." });
        if (/\bconsole\.(log|warn|error)\b/.test(t))
            issues.push({ id: uid(), category: "style", severity: "info", message: "Remove console statement before production.", line: ln });
        if (/\bvar\b/.test(t))
            issues.push({ id: uid(), category: "style", severity: "info", message: "Prefer const or let over var.", line: ln, suggestion: "Use const for immutable bindings, let for mutable." });
    });
    return issues;
}

// ── TypeScript 
export function analyzeTypeScript(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [...analyzeJavaScript(code)];
    lines(code).forEach((line, i) => {
        const ln = i + 1;
        const t = line.trim();
        if (/:\s*any\b/.test(t))
            issues.push({ id: uid(), category: "style", severity: "warning", message: "Avoid 'any' type — it defeats TypeScript's type safety.", line: ln, suggestion: "Use a specific type or 'unknown'." });
        if (/as\s+any\b/.test(t))
            issues.push({ id: uid(), category: "bug", severity: "warning", message: "Type assertion to 'any' bypasses type checking.", line: ln });
        if (/\/\/\s*@ts-ignore/.test(t))
            issues.push({ id: uid(), category: "style", severity: "info", message: "@ts-ignore suppresses type errors — fix the underlying issue.", line: ln });
    });
    return issues;
}

// ── Python 
export function analyzePython(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    lines(code).forEach((line, i) => {
        const ln = i + 1;
        const t = line.trim();
        if (/\bexcept\s*:/.test(t))
            issues.push({ id: uid(), category: "bug", severity: "warning", message: "Bare except catches all exceptions including SystemExit.", line: ln, suggestion: "Use 'except Exception as e:' or a specific exception type." });
        if (/\bprint\s*\(/.test(t))
            issues.push({ id: uid(), category: "style", severity: "info", message: "Remove print() before production — use logging module.", line: ln });
        if (/\beval\s*\(/.test(t))
            issues.push({ id: uid(), category: "security", severity: "error", message: "eval() is dangerous in Python.", line: ln, suggestion: "Use ast.literal_eval() for safe parsing." });
    });
    return issues;
}

// ── Java 
export function analyzeJava(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    lines(code).forEach((line, i) => {
        const ln = i + 1;
        const t = line.trim();
        if (/catch\s*\(\s*Exception\b/.test(t))
            issues.push({ id: uid(), category: "bug", severity: "warning", message: "Catching generic Exception hides specific errors.", line: ln, suggestion: "Catch the most specific exception type." });
        if (/==\s*(null|true|false)\b/.test(t))
            issues.push({ id: uid(), category: "bug", severity: "warning", message: "Use .equals() for object comparison, not ==.", line: ln });
        if (/System\.out\.print/.test(t))
            issues.push({ id: uid(), category: "style", severity: "info", message: "Use a logger instead of System.out.print in production.", line: ln });
    });
    return issues;
}

// ── 
export function analyzeC(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    lines(code).forEach((line, i) => {
        const ln = i + 1;
        const t = line.trim();
        if (/\bgets\s*\(/.test(t))
            issues.push({ id: uid(), category: "security", severity: "error", message: "gets() is unsafe — no bounds checking, leads to buffer overflow.", line: ln, suggestion: "Use fgets() instead." });
        if (/\bstrcpy\s*\(/.test(t))
            issues.push({ id: uid(), category: "security", severity: "warning", message: "strcpy() may overflow destination buffer.", line: ln, suggestion: "Use strncpy() or strlcpy()." });
        if (/\bprintf\s*\(\s*\w+\s*\)/.test(t))
            issues.push({ id: uid(), category: "security", severity: "warning", message: "Potential format string vulnerability.", line: ln, suggestion: 'Use printf("%s", str) instead of printf(str).' });
        if (/malloc\s*\(/.test(t) && !/free\s*\(/.test(code))
            issues.push({ id: uid(), category: "bug", severity: "warning", message: "malloc() detected but no free() found — possible memory leak.", line: ln });
    });
    return issues;
}

// ── C++ 
export function analyzeCpp(code: string): CodeIssue[] {
    const issues = analyzeC(code);
    lines(code).forEach((line, i) => {
        const ln = i + 1;
        const t = line.trim();
        if (/\bnew\b/.test(t) && !/\bdelete\b/.test(code))
            issues.push({ id: uid(), category: "bug", severity: "warning", message: "new without delete — potential memory leak.", line: ln, suggestion: "Use smart pointers (std::unique_ptr, std::shared_ptr) instead." });
        if (/using namespace std\s*;/.test(t))
            issues.push({ id: uid(), category: "style", severity: "info", message: "'using namespace std' pollutes the global namespace.", line: ln, suggestion: "Use std:: prefix explicitly." });
    });
    return issues;
}

// ── Router 
export function routeToAnalyzer(language: SupportedLanguage, code: string): CodeIssue[] {
    let base: CodeIssue[] = [];
    switch (language) {
        case "javascript": base = analyzeJavaScript(code); break;
        case "typescript": base = analyzeTypeScript(code); break;
        case "python": base = analyzePython(code); break;
        case "java": base = analyzeJava(code); break;
        case "c": base = analyzeC(code); break;
        case "cpp": base = analyzeCpp(code); break;
    }

    // Rule modules loaded at runtime via require() to prevent tree-shaking.
    const safeRun = (fn: unknown, ...args: unknown[]): CodeIssue[] => {
        if (typeof fn !== "function") return [];
        try { return (fn as (...a: unknown[]) => CodeIssue[])(...args) ?? []; }
        catch { return []; }
    };

    /* eslint-disable @typescript-eslint/no-require-imports */
    const bugLintFn = (require("./rules/bug-lint") as { bugLintRules: RuleFn }).bugLintRules;
    const securityFn = (require("./rules/security") as { securityRules: RuleFn }).securityRules;
    const complexFn = (require("./rules/complexity-rules") as { complexityRules: ComplexityFn }).complexityRules;
    /* eslint-enable @typescript-eslint/no-require-imports */

    return [
        ...base,
        ...safeRun(bugLintFn, code, language),
        ...safeRun(securityFn, code, language),
        ...safeRun(complexFn, code),
    ];
}
