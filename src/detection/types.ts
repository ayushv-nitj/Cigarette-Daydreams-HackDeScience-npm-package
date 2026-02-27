// types.ts — Shared TypeScript types for the language detection module

export type SupportedLanguage =
    | "javascript"
    | "typescript"
    | "python"
    | "java"
    | "c"
    | "cpp";

export type DetectionMethod = "extension" | "shebang" | "syntax" | "unknown";

export type IssueSeverity = "error" | "warning" | "info";

export type IssueCategory = "bug" | "security" | "complexity" | "style" | "redundancy";

export interface DetectionResult {
    language: SupportedLanguage | "unknown";
    confidence: number; // 0.0 – 1.0
    method: DetectionMethod;
}

export interface CodeIssue {
    id: string;
    category: IssueCategory;
    severity: IssueSeverity;
    message: string;
    line?: number;
    column?: number;
    suggestion?: string;
}

export interface AnalysisWeights {
    /** Weight for bug penalties (w_bug). Default: 0.35 */
    bug: number;
    /** Weight for security penalties (w_sec). Default: 0.30 */
    security: number;
    /** Weight for complexity penalties (w_cplx). Default: 0.15 */
    complexity: number;
    /** Weight for redundancy penalties (w_red). Default: 0.10 */
    redundancy: number;
    /** Weight for style/lint penalties (w_lint). Default: 0.10 */
    style: number;
}

export interface AnalysisConfig {
    weights?: Partial<AnalysisWeights>;
}

export interface AnalysisReport {
    detection: DetectionResult;
    issues: CodeIssue[];
    // overall quality score
    score: number;
    weights: AnalysisWeights;
    penaltyBreakdown: {
        bug: number;
        security: number;
        complexity: number;
        redundancy: number;
        style: number;
    };
}

export const DEFAULT_WEIGHTS: AnalysisWeights = {
    bug: 0.35,
    security: 0.30,
    complexity: 0.15,
    redundancy: 0.10,
    style: 0.10,
};
