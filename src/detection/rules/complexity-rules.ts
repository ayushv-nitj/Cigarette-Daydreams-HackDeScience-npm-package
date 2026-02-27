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

    // ── Function length > 50 lines ──
    const fnRegex = /\bfunction\s+\w*\s*\([^)]*\)\s*\{/g;
    let match: RegExpExecArray | null;
    while ((match = fnRegex.exec(code)) !== null) {
        const startLine = code.slice(0, match.index).split("\n").length;
        // Walk forward to find the closing brace
        let depth = 0;
        let endLine = startLine;
        for (let j = match.index; j < code.length; j++) {
            if (code[j] === "{") depth++;
            else if (code[j] === "}") {
                depth--;
                if (depth === 0) {
                    endLine = code.slice(0, j).split("\n").length;
                    break;
                }
            }
        }
        const fnLines = endLine - startLine + 1;
        if (fnLines > 50) {
            issues.push({
                id: `cplx-fnlen-L${startLine}`,
                category: "complexity", severity: "warning",
                message: `Function is ${fnLines} lines long (recommended max: 50). Long functions are hard to test and maintain.`,
                line: startLine,
                suggestion: "Break this function into smaller, focused helper functions.",
            });
        }
    }

    return issues;
}

