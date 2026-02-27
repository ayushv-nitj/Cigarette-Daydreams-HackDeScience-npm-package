//basic complexity detection rules for implementing everywhere
// NOTE: named complexity-rules.ts to avoid conflict with src/complexity/ teammate folder

import type { CodeIssue } from "../types";

export function complexityRules(code: string, threshold = 10): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const ls = code.split("\n");

    // ── Nesting depth > 3 ──
    ls.forEach((line, i) => {
        const indent = line.match(/^(\s*)/)?.[1] ?? "";
        const depth = indent.includes("\t")
            ? indent.split("\t").length - 1
            : Math.floor(indent.length / 4);
        if (depth > 3 && line.trim().length > 0) {
            issues.push({
                id: `cplx-nest-${i + 1}`,
                category: "complexity", severity: "warning",
                message: `Code nested ${depth} levels deep (max recommended: 3).`,
                line: i + 1,
                suggestion: "Extract inner blocks into named helper functions.",
            });
        }
    });

    // ── Cyclomatic complexity ──
    const decisionPoints = (code.match(/\b(if|else\s+if|for|while|case|catch)\b|&&|\|\||\?:/g) || []).length;
    if (decisionPoints > threshold) {
        issues.push({
            id: "cplx-cyclomatic",
            category: "complexity", severity: "warning",
            message: `High cyclomatic complexity: ${decisionPoints} decision points (threshold: ${threshold}).`,
            suggestion: `Refactor branching logic into smaller functions.`,
        });
    }

    return issues;
}
