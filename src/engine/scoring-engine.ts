// engine/scoring-engine.ts — Score calculation (runs AFTER aggregation)
//
// Scoring must be the LAST step because all penalty contributions (complexity,
// security, lint) must be fully resolved before computing the final score.
//
// Also stores an immutable snapshot: { timestamp, score, issueCount }.

import type { CodeIssue, AnalysisWeights } from "../detection/types";
import type { AggregatedResult, PipelineSnapshot } from "./types";
import { DEFAULT_WEIGHTS } from "../detection/types";

export interface ScoringResult {
    score: number;
    weights: AnalysisWeights;
    penaltyBreakdown: {
        bug: number;
        security: number;
        complexity: number;
        redundancy: number;
        style: number;
    };
    snapshot: PipelineSnapshot;
}

/** Count issues matching (category, severity) */
function count(issues: CodeIssue[], cat: string, sev: string): number {
    return issues.filter((i) => i.category === cat && i.severity === sev).length;
}

/**
 * Calculate score from aggregated issues.
 * Must be called AFTER all parallel stages have settled.
 */
export function score(
    aggregated: AggregatedResult,
    weightOverrides?: Partial<AnalysisWeights>
): ScoringResult {
    const weights: AnalysisWeights = { ...DEFAULT_WEIGHTS, ...weightOverrides };

    const all = [
        ...aggregated.issues,
        ...aggregated.securityIssues,
        ...aggregated.complexityMetrics.issues,
        ...aggregated.redundancy.issues,
    ];

    const penaltyBreakdown = {
        bug: Math.min(1, count(all, "bug", "error") * 0.15 + count(all, "bug", "warning") * 0.05),
        security: Math.min(1, count(all, "security", "error") * 0.20 + count(all, "security", "warning") * 0.08),
        complexity: Math.min(1, count(all, "complexity", "error") * 0.10 + count(all, "complexity", "warning") * 0.04),
        redundancy: Math.min(1, count(all, "redundancy", "warning") * 0.04),
        style: Math.min(1, count(all, "style", "warning") * 0.03 + count(all, "style", "info") * 0.01),
    };

    const finalScore = Math.max(
        0,
        1 -
        weights.bug * penaltyBreakdown.bug -
        weights.security * penaltyBreakdown.security -
        weights.complexity * penaltyBreakdown.complexity -
        weights.redundancy * penaltyBreakdown.redundancy -
        weights.style * penaltyBreakdown.style
    );

    const snapshot: PipelineSnapshot = {
        timestamp: new Date().toISOString(),
        score: Math.round(finalScore * 1000) / 1000, // 3 decimal places
        issueCount: all.length,
    };

    return {
        score: finalScore,
        weights,
        penaltyBreakdown,
        snapshot,
    };
}
