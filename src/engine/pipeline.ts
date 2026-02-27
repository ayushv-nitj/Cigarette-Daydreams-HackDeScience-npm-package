// engine/pipeline.ts — Main async pipeline orchestrator
//
// Flow:
//   Stage 1: detectLanguage(code, filename)           [sync]
//   Stage 2: ParallelStage.run()                      [async, Promise.allSettled semantics]
//      ├─ bugLintEngine    (AST, JS/TS only)
//      ├─ semgrepEngine    (all langs, optional binary)
//      ├─ osvEngine        (dep CVE, optional projectPath)
//      ├─ complexityRules  (existing rule engine)
//      ├─ redundancyRules  (existing module)
//      ├─ baseAnalyzer     (existing per-language rule patterns)
//      └─ formatter        (existing formatter)
//   Stage 3: aggregate(stageResults)                  [sync]
//   Stage 4: score(aggregated)                        [sync — MUST be after all stages]
//   Stage 5: diff (only if options.diff provided)     [sync]
//   Return: PipelineReport

import { detectLanguage } from "../detection/detection";
import { routeToAnalyzer } from "../detection/analyzers";
import { formatCode } from "../detection/formatter";
import { analyzeComplexity } from "../complexity/complexity";
import { analyzeRedundancy } from "../redundancy/redundancy";

import { securityRules } from "../detection/rules/security";
import { runBugLintEngine } from "./bug-lint-engine";
import { runSemgrepEngine } from "./semgrep-engine";
import { runOsvEngine } from "./osv-engine";
import { ParallelStage } from "./task-runner";
import { aggregate } from "./aggregator";
import { score as scoreResult } from "./scoring-engine";
import { diffReports } from "./diff-engine";

import type { SupportedLanguage } from "../detection/types";
import type { PipelineOptions, PipelineReport, StageResult } from "./types";

// (old runRedundancyAsIssues adapter removed — now using analyzeRedundancy directly)


/**
 * Main entry point for the full analysis pipeline.
 *
 * @example
 * const report = await analyze(code, { filename: "app.ts", projectPath: "/my/project" });
 * console.log(report.score, report.issues, report.securityIssues);
 */
export async function analyze(
    code: string,
    options: PipelineOptions = {}
): Promise<PipelineReport> {
    const {
        filename,
        weights,
        projectPath,
        timeout: totalTimeout = 15_000,
        diff: diffOptions,
    } = options;

    //Language Detection (sync, instant)
    const detection = detectLanguage(code, filename);
    const language = detection.language;

    //Parallel Execution 
    const stage = new ParallelStage();

    if (language !== "unknown") {
        stage.add("baseAnalyzer", () =>
            routeToAnalyzer(language as SupportedLanguage, code)
        );
    }

    stage.add("bugLintEngine", () =>
        runBugLintEngine(code, language)
    );

    stage.add("securityRules", () => {
        try { return securityRules(code, language); }
        catch { return []; }
    });

    stage.add("semgrepEngine", () =>
        runSemgrepEngine(code, language)
    );

    stage.add("osvEngine", () =>
        runOsvEngine(projectPath)
    );

    stage.add("complexityEngine", () => {
        try {
            return analyzeComplexity(code);
        } catch {
            return { functions: [] };
        }
    });


    stage.add("redundancyEngine", () => {
        try {
            return analyzeRedundancy(code);
        } catch {
            return { duplicates: [] };
        }
    });

    // Auto-formatter (existing formatter.ts)
    stage.add("formatter", () =>
        formatCode(code, language !== "unknown" ? language : undefined)
    );

    // Run all in parallel — per-task timeout 8 s, total stage timeout via options
    const stageResults: StageResult[] = await stage.run({
        taskTimeoutMs: 8_000,
        stageTimeoutMs: totalTimeout,
    });

    const aggregated = aggregate(stageResults);

    const {
        score,
        weights: finalWeights,
        penaltyBreakdown,
        snapshot,
    } = scoreResult(aggregated, weights);

    const report: PipelineReport = {
        detection,
        issues: aggregated.issues,
        securityIssues: aggregated.securityIssues,
        complexityMetrics: aggregated.complexityMetrics,
        redundancy: aggregated.redundancy,
        formatting: aggregated.formatting,
        score,
        weights: finalWeights,
        penaltyBreakdown,
        snapshot,
        stageTiming: aggregated.stageTiming,
    };

    // ── Stage 5: Diff (optional)  ──
    if (diffOptions?.oldCode !== undefined) {
        const oldReport = await analyze(diffOptions.oldCode, {
            filename,
            weights,
            timeout: totalTimeout,
            // Don't recurse diff on old report
        });
        report.diff = diffReports(oldReport, report);
    }

    return report;
}
