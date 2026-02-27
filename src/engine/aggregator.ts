// engine/aggregator.ts — Merge all StageResult[] into a unified AggregatedResult
//
// Consumes the real analyzeComplexity() and analyzeRedundancy() output shapes.
// Runs synchronously — no async, no network.

import type { CodeIssue } from "../detection/types";
import type { FormattingResult } from "../detection/formatter";
import type { FunctionComplexity } from "../complexity/complexity";
import type { DuplicateFunction } from "../redundancy/redundancy";
import type { StageResult, AggregatedResult, ComplexityMetrics } from "./types";

/** Deduplicate issues by (line, message) — same line + same message = duplicate */
function deduplicate(issues: CodeIssue[]): CodeIssue[] {
    const seen = new Set<string>();
    return issues.filter((issue) => {
        const key = `${issue.line ?? 0}:${issue.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Smarter dedup for security issues.
 * Semgrep is authoritative — if it already flagged a line, suppress any
 * regex-based securityRules finding on the same line to avoid duplicates.
 * OSV findings (no line number) are always kept.
 */
function deduplicateSecurity(
    semgrep: CodeIssue[],
    osv: CodeIssue[],
    regexSecurity: CodeIssue[]
): CodeIssue[] {
    // Lines already covered by Semgrep
    const semgrepLines = new Set<number>(
        semgrep.filter(i => i.line !== undefined).map(i => i.line!)
    );

    // Only keep regex security issues on lines NOT already covered by Semgrep
    const filteredRegex = regexSecurity.filter(
        i => i.line === undefined || !semgrepLines.has(i.line)
    );

    return deduplicate([...semgrep, ...osv, ...filteredRegex]);
}

/** Safe value extractor from StageResult */
function getValue<T>(result: StageResult | undefined, fallback: T): T {
    if (!result || result.status !== "fulfilled") return fallback;
    return (result.value as T) ?? fallback;
}

/** Convert FunctionComplexity[] → CodeIssue[] for downstream scoring */
function complexityFunctionsToIssues(fns: FunctionComplexity[]): CodeIssue[] {
    const issues: CodeIssue[] = [];
    for (const fn of fns) {
        if (fn.warnings.length === 0) continue;
        for (const warning of fn.warnings) {
            issues.push({
                id: `cplx-${fn.name}-L${fn.line}`,
                category: "complexity",
                severity: "warning",
                message: `Function '${fn.name}': ${warning} (cyclomatic: ${fn.cyclomaticComplexity}, lines: ${fn.length}, nesting: ${fn.nestingDepth})`,
                line: fn.line,
                suggestion: "Refactor into smaller, focused functions.",
            });
        }
        // Flag deep nesting even without a warning threshold breach
        if (fn.nestingDepth > 3 && fn.warnings.length === 0) {
            issues.push({
                id: `cplx-nest-${fn.name}-L${fn.line}`,
                category: "complexity",
                severity: "warning",
                message: `Function '${fn.name}' has nesting depth ${fn.nestingDepth} (recommended max: 3).`,
                line: fn.line,
                suggestion: "Extract inner blocks into named helper functions.",
            });
        }
    }
    return issues;
}

/** Convert DuplicateFunction[] → CodeIssue[] for downstream scoring */
function duplicatesToIssues(duplicates: DuplicateFunction[]): CodeIssue[] {
    return duplicates.map((dup, i) => ({
        id: `redundancy-dup-${i}-L${dup.line}`,
        category: "redundancy" as const,
        severity: "warning" as const,
        message: `'${dup.name}' (L${dup.line}) is a duplicate of '${dup.duplicateOf}'.`,
        line: dup.line,
        suggestion: "Extract shared logic into a single reusable function.",
    }));
}

/** Build AggregatedResult from parallel-stage outputs */
export function aggregate(results: StageResult[]): AggregatedResult {
    const byLabel = new Map<string, StageResult>(results.map((r) => [r.label, r]));

    //Collect issues from each engine  
    const bugLintEngineIssues = getValue<CodeIssue[]>(byLabel.get("bugLintEngine"), []);
    const semgrepIssues = getValue<CodeIssue[]>(byLabel.get("semgrepEngine"), []);
    const teamSecurityIssues = getValue<CodeIssue[]>(byLabel.get("teamSecurityEngine"), []);
    const baseAnalyzerIssues = getValue<CodeIssue[]>(byLabel.get("baseAnalyzer"), []);


    // Real AST complexity output  
    const complexityResult = getValue<{ functions: FunctionComplexity[] }>(
        byLabel.get("complexityEngine"), { functions: [] }
    );
    const complexityFns = complexityResult.functions ?? [];
    const complexityIssues = complexityFunctionsToIssues(complexityFns);

    //  Real AST redundancy output  
    const redundancyResult = getValue<{ duplicates: DuplicateFunction[] }>(
        byLabel.get("redundancyEngine"), { duplicates: [] }
    );
    const duplicates = redundancyResult.duplicates ?? [];
    const redundancyIssues = duplicatesToIssues(duplicates);

    // ── Formatting result  ─────────
    const formatting = getValue<FormattingResult>(byLabel.get("formatter"), {
        formatted: "",
        diff: "",
        changesCount: 0,
    });

    // ── Complexity metrics — real AST data ────────────────────────────────────
    const complexityMetrics: ComplexityMetrics = {
        decisionPoints: complexityFns.reduce((sum, f) => sum + f.cyclomaticComplexity - 1, 0),
        maxDepth: complexityFns.reduce((max, f) => Math.max(max, f.nestingDepth), 0),
        issues: complexityIssues,
        functions: complexityFns,
    };

    // ── Redundancy aggregation — real AST data ────────────────────────────────
    const redundancy = {
        duplicateCount: duplicates.length,
        issues: redundancyIssues,
        duplicates,
    };

    // ── Merge all issues (security separated below) ───────────────────────────
    const allIssues = deduplicate([
        ...baseAnalyzerIssues,
        ...bugLintEngineIssues,
        ...complexityIssues,
        ...redundancyIssues,
    ]);

    // ── Security issues: Semgrep (authoritative) > teammate's full engine ──
    // teamSecurityEngine = scanFile() + scanDependencies() → all in one
    // Semgrep wins on same-line collisions (suppresses teamSec on same line)
    const securityIssues = deduplicateSecurity(semgrepIssues, [], teamSecurityIssues);


    const nonSecurityIssues = allIssues.filter((i) => i.category !== "security");

    // ── Stage timing map  ──────────
    const stageTiming: Record<string, number> = {};
    for (const r of results) {
        stageTiming[r.label] = r.durationMs;
    }

    return {
        issues: nonSecurityIssues,
        securityIssues,
        complexityMetrics,
        redundancy,
        formatting,
        stageTiming,
    };
}
