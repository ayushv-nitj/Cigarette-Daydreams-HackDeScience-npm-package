// engine/reviewer.ts — reviewer.config() API
//
// Creates a configured Reviewer instance with custom weights per category.
//
// ┌ ─────────────────────┐
// │                    SCORING FORMULA                              │
// │                                                                 │
// │  score = max(0,  1  −  Σ  weight[i] × penalty[i] )             │
// │                       i ∈ {bug, security, complexity,           │
// │                             redundancy, style}                  │
// │                                                                 │
// │  penalty[i] = min(1.0, Σ  issues[j] × severityMultiplier[j])   │
// │                        j                                        │
// │                                                                 │
// │  Severity multipliers (fixed, per category):                    │
// │    bug:        error×0.15,  warning×0.05                        │
// │    security:   error×0.20,  warning×0.08                        │
// │    complexity: error×0.10,  warning×0.04                        │
// │    redundancy: warning×0.04                                     │
// │    style:      warning×0.03, info×0.01                          │
// │                                                                 │
// │  Default weights (sum = 1.0):                                   │
// │    bug=0.35  security=0.30  complexity=0.15                     │
// │    redundancy=0.10  style=0.10                                  │
// │                                                                 │
// │  Example — a single security error with default weights:        │
// │    penalty[security] = min(1, 1 × 0.20) = 0.20                 │
// │    score = 1 − (0.30 × 0.20) = 1 − 0.06 = 0.94  (94%)         │
// └ ─────────────────────┘

import { analyze } from "./pipeline";
import { DEFAULT_WEIGHTS } from "../detection/types";
import type { AnalysisWeights } from "../detection/types";
import type { PipelineOptions, PipelineReport } from "./types";

// ── Types  ─────────────────────────

/**
 * Custom weight configuration for each issue category.
 * Each value must be in [0, 1]. Values do not need to sum to 1 —
 * the scoring formula allows any combination.
 *
 * @example
 * // Security-first profile (penalise security heavily, relax style)
 * const cfg = reviewer.config({
 *   weights: { security: 0.50, bug: 0.30, complexity: 0.10, redundancy: 0.05, style: 0.05 }
 * });
 */
export interface ReviewerWeights {
    /** Weight applied to bug penalty  (default: 0.35) */
    bug?: number;
    /** Weight applied to security penalty  (default: 0.30) */
    security?: number;
    /** Weight applied to complexity penalty  (default: 0.15) */
    complexity?: number;
    /** Weight applied to redundancy penalty  (default: 0.10) */
    redundancy?: number;
    /** Weight applied to style penalty  (default: 0.10) */
    style?: number;
}

export interface ReviewerConfig {
    /**
     * Custom weights per category. Only the keys you provide are overridden;
     * the rest stay at their defaults.
     */
    weights?: ReviewerWeights;
    /** Default filename hint passed to every review() call (overridable per call) */
    defaultFilename?: string;
    /** Default project path for OSV CVE scanning (overridable per call) */
    defaultProjectPath?: string;
    /** Pipeline timeout in ms (default: 15_000) */
    timeout?: number;
}

export interface ReviewOptions {
    /** Filename hint for language detection — overrides the config default */
    filename?: string;
    /** Project path for CVE scanning — overrides the config default */
    projectPath?: string;
    /** Pass old code to get a diff result in report.diff */
    oldCode?: string;
}

/**
 * A configured Reviewer instance returned by reviewer.config().
 */
export interface Reviewer {
    /**
     * Analyse `code` using this reviewer's weights.
     *
     * Scoring formula:
     *   score = max(0, 1 − Σ weight[i] × penalty[i])
     *   penalty[i] = min(1.0, Σ issues × severityMultiplier)
     *
     * @param code   Source code string
     * @param opts   Per-call overrides (filename, projectPath, oldCode for diff)
     */
    review(code: string, opts?: ReviewOptions): Promise<PipelineReport>;

    /**
     * Returns the effective weights this reviewer uses (defaults merged with overrides).
     */
    getWeights(): AnalysisWeights;

    /**
     * Returns a human-readable summary of the scoring formula and active weights.
     */
    describeWeights(): string;
}

// ── Factory  ───────────────────────

/**
 * Create a configured Reviewer instance with custom category weights.
 *
 * @example — strict security profile:
 * ```ts
 * const strict = reviewer.config({
 *   weights: { security: 0.60, bug: 0.25, complexity: 0.10, redundancy: 0.03, style: 0.02 }
 * });
 * const report = await strict.review(code, { filename: "app.ts" });
 * console.log(report.score, report.weights);
 * ```
 *
 * @example — style-first profile:
 * ```ts
 * const linter = reviewer.config({ weights: { style: 0.50, bug: 0.30 } });
 * const report = await linter.review(code);
 * ```
 */
function config(cfg: ReviewerConfig = {}): Reviewer {
    const effectiveWeights: AnalysisWeights = {
        ...DEFAULT_WEIGHTS,
        ...(cfg.weights ?? {}),
    };

    const review = async (
        code: string,
        opts: ReviewOptions = {}
    ): Promise<PipelineReport> => {
        const pipelineOpts: PipelineOptions = {
            filename: opts.filename ?? cfg.defaultFilename,
            projectPath: opts.projectPath ?? cfg.defaultProjectPath,
            weights: effectiveWeights,
            timeout: cfg.timeout,
            ...(opts.oldCode !== undefined ? { diff: { oldCode: opts.oldCode } } : {}),
        };
        return analyze(code, pipelineOpts);
    };

    const getWeights = (): AnalysisWeights => ({ ...effectiveWeights });

    const describeWeights = (): string => {
        const w = effectiveWeights;
        const lines = [
            "┌ ─────────────┐",
            "│  SCORING FORMULA                                        │",
            "│                                                         │",
            "│  score = max(0, 1 − Σ weight[i] × penalty[i])          │",
            "│  penalty[i] = min(1.0, Σ issues × severityMultiplier)  │",
            "│                                                         │",
            "│  Severity multipliers:                                  │",
            "│    bug:        error×0.15,  warning×0.05                │",
            "│    security:   error×0.20,  warning×0.08                │",
            "│    complexity: error×0.10,  warning×0.04                │",
            "│    redundancy: warning×0.04                             │",
            "│    style:      warning×0.03, info×0.01                  │",
            "│                                                         │",
            "│  Active weights:                                        │",
            `│    bug        = ${String(w.bug.toFixed(2)).padEnd(6)}  (default: 0.35)         │`,
            `│    security   = ${String(w.security.toFixed(2)).padEnd(6)}  (default: 0.30)         │`,
            `│    complexity = ${String(w.complexity.toFixed(2)).padEnd(6)}  (default: 0.15)         │`,
            `│    redundancy = ${String(w.redundancy.toFixed(2)).padEnd(6)}  (default: 0.10)         │`,
            `│    style      = ${String(w.style.toFixed(2)).padEnd(6)}  (default: 0.10)         │`,
            "└ ─────────────┘",
        ];
        return lines.join("\n");
    };

    return { review, getWeights, describeWeights };
}

// ── Singleton API  ─────────────────

/**
 * `reviewer` — the top-level namespace for the reviewer API.
 *
 * Usage:
 *   const r = reviewer.config({ weights: { security: 0.5 } });
 *   const report = await r.review(code, { filename: "app.py" });
 *   console.log(r.describeWeights());
 */
export const reviewer = { config } as const;
