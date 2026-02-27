

import type { CodeIssue, DetectionResult, AnalysisWeights } from "../detection/types";
import type { FormattingResult } from "../detection/formatter";
import type { FunctionComplexity } from "../complexity/complexity";
import type { DuplicateFunction } from "../redundancy/redundancy";


export interface StageResult<T = unknown> {
    label: string;
    status: "fulfilled" | "rejected" | "timeout";
    value?: T;
    error?: unknown;
    durationMs: number;
}


export interface PipelineOptions {
    filename?: string;
    weights?: Partial<AnalysisWeights>;
    projectPath?: string;
    timeout?: number;
    diff?: { oldCode: string };
}


export interface DependencyVuln {
    packageName: string;
    version: string;
    vulnId: string;
    summary: string;
    severity: "critical" | "high" | "medium" | "low";
    aliases: string[];
}


export interface ComplexityMetrics {
    decisionPoints: number;
    maxDepth: number;
    issues: CodeIssue[];
    functions: FunctionComplexity[];
}


export interface AggregatedResult {
    issues: CodeIssue[];
    securityIssues: CodeIssue[];
    complexityMetrics: ComplexityMetrics;
    redundancy: {
        duplicateCount: number;
        issues: CodeIssue[];
        /** Full duplicate details from analyzeRedundancy() */
        duplicates: DuplicateFunction[];
    };
    formatting: FormattingResult;
    /** Per-engine timing info */
    stageTiming: Record<string, number>;
}


export interface PipelineSnapshot {
    timestamp: string; // ISO 8601
    score: number;
    issueCount: number;
}


export interface DiffResult {
    scoreDelta: number;
    newIssues: CodeIssue[];
    resolvedIssues: CodeIssue[];
}


export interface PipelineReport {
    detection: DetectionResult;
    issues: CodeIssue[];
    securityIssues: CodeIssue[];
    complexityMetrics: ComplexityMetrics;
    redundancy: AggregatedResult["redundancy"];
    formatting: FormattingResult;
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
    stageTiming: Record<string, number>;
    diff?: DiffResult;
}
