//Shared TypeScript types for the language detection module

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
    confidence: number;
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
    //default values added in excaldraw

    bug: number;
    security: number;
    complexity: number;
    redundancy: number;
    style: number;
}

export interface AnalysisConfig {
    weights?: Partial<AnalysisWeights>;
}

export interface AnalysisReport {
    detection: DetectionResult;
    issues: CodeIssue[];
    // finally calculating overall quality score
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
