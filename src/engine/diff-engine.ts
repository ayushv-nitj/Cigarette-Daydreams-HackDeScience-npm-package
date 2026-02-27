// engine/diff-engine.ts — Compare two code snapshots or PipelineReport pairs
//
// Used either:
//   A) In the pipeline when options.diff.oldCode is provided — runs analyze on
//      both codes and compares issues
//   B) Externally via diffReports(oldReport, newReport)

import type { CodeIssue } from "../detection/types";
import type { PipelineReport, DiffResult } from "./types";

/** Create a stable key for a CodeIssue so we can diff sets */
function issueKey(issue: CodeIssue): string {
    return `${issue.category}:${issue.severity}:${issue.line ?? 0}:${issue.message}`;
}

/**
 * Compare two PipelineReport objects.
 * Returns:
 *   scoreDelta     — newReport.score − oldReport.score  (positive = improved)
 *   newIssues      — issues in new but not in old
 *   resolvedIssues — issues in old but not in new
 */
export function diffReports(
    oldReport: PipelineReport,
    newReport: PipelineReport
): DiffResult {
    const oldAll = [...oldReport.issues, ...oldReport.securityIssues];
    const newAll = [...newReport.issues, ...newReport.securityIssues];

    const oldKeys = new Set(oldAll.map(issueKey));
    const newKeys = new Set(newAll.map(issueKey));

    const newIssues = newAll.filter((i) => !oldKeys.has(issueKey(i)));
    const resolvedIssues = oldAll.filter((i) => !newKeys.has(issueKey(i)));

    return {
        scoreDelta: newReport.score - oldReport.score,
        newIssues,
        resolvedIssues,
    };
}

/**
 * Lightweight string-level diff: compare two code strings returning
 * a simple DiffResult without running the full pipeline a second time.
 * Used when we only have raw issues from a single run and want to diff
 * against a previous issue list.
 */
export function diffIssues(
    oldIssues: CodeIssue[],
    newIssues: CodeIssue[],
    oldScore: number,
    newScore: number
): DiffResult {
    const oldKeys = new Set(oldIssues.map(issueKey));
    const newKeys = new Set(newIssues.map(issueKey));

    return {
        scoreDelta: newScore - oldScore,
        newIssues: newIssues.filter((i) => !oldKeys.has(issueKey(i))),
        resolvedIssues: oldIssues.filter((i) => !newKeys.has(issueKey(i))),
    };
}
