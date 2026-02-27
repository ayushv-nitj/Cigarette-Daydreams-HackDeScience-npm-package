// detection/rules/bug-lint.ts — Bug & Lint Detection rules

import type { CodeIssue } from "../types";

export function bugLintRules(code: string, language: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const ls = code.split("\n");

    ls.forEach((line, i) => {
        const ln = i + 1;
        const t = line.trim();

        // ── Unreachable code after return/break/throw ──
        if (/^\s*(return|break|throw)\b/.test(line)) {
            const next = ls[i + 1]?.trim();
            if (next && next !== "}" && next !== "" && !next.startsWith("//") && !next.startsWith("*")) {
                issues.push({
                    id: `bl-unreachable-${ln}`,
                    category: "bug", severity: "warning",
                    message: "Unreachable code — statements after return/break/throw are never executed.",
                    line: ln + 1, column: 1,
                    suggestion: "Remove or relocate the unreachable code.",
                });
            }
        }

        // ── Off-by-one: <= arr.length in loop condition ──
        if (/\b\w+\s*(<=|>=)\s*\w+\.length\b/.test(t)) {
            issues.push({
                id: `bl-obo-${ln}`,
                category: "bug", severity: "warning",
                message: "Possible off-by-one: using '<= .length' — array index is 0-based, last valid index is length-1.",
                line: ln,
                suggestion: "Use '< arr.length' instead of '<= arr.length'.",
            });
        }

        // ── parseInt without radix (JS/TS) ──
        if ((language === "javascript" || language === "typescript") && /\bparseInt\s*\([^,)]+\)/.test(t)) {
            issues.push({
                id: `bl-parseInt-${ln}`,
                category: "bug", severity: "info",
                message: "parseInt() called without a radix — always specify base 10 to avoid octal parsing.",
                line: ln,
                suggestion: "parseInt(x, 10)",
            });
        }

        // ── Naming convention: SCREAMING_CASE variable (non-constant) ──
        if ((language === "javascript" || language === "typescript") && /\b(let|var)\s+[A-Z][A-Z0-9_]+\s*=/.test(t)) {
            issues.push({
                id: `bl-naming-${ln}`,
                category: "style", severity: "info",
                message: "Variable names should use camelCase, not UPPER_CASE (reserved for constants).",
                line: ln,
                suggestion: "Rename to camelCase or use 'const' for true constants.",
            });
        }

        // ── Function called with literal null ────────────────────────────────
        // e.g. printName(null) → warn that the callee may not handle null
        if (/\b\w+\s*\(\s*null\s*\)/.test(t)) {
            const fn = t.match(/\b(\w+)\s*\(\s*null\s*\)/)?.[1] ?? "function";
            issues.push({
                id: `bl-nullcall-${ln}`,
                category: "bug", severity: "error",
                message: `Passing literal 'null' to '${fn}()' — the function may dereference it without a null check.`,
                line: ln,
                suggestion: `Add a null guard inside '${fn}': if (!param) return; or use optional chaining.`,
            });
        }

        void t; void language;
    });

    return issues;
}
