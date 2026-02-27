// detection/index.ts — Public entry point for the Language Detection module
//
// Exports:
//   detectLanguage(code, filename?) → DetectionResult   (3-layer detection)
//   routeToAnalyzer(language, code) → CodeIssue[]       (per-language analysis)
//   formatCode(code, language?)     → FormattingResult   (auto-formatting)
//   DEFAULT_WEIGHTS                    (scoring weights)
//
// Types:
//   SupportedLanguage, DetectionResult, CodeIssue, AnalysisReport, etc.

export { detectLanguage, detectByExtension, detectByShebang, detectBySyntax } from "./detection";
export { routeToAnalyzer } from "./analyzers";
export { formatCode } from "./formatter";
export type { FormattingResult } from "./formatter";

export type {
    SupportedLanguage,
    DetectionMethod,
    IssueSeverity,
    IssueCategory,
    DetectionResult,
    CodeIssue,
    AnalysisWeights,
    AnalysisConfig,
    AnalysisReport,
} from "./types";

export { DEFAULT_WEIGHTS } from "./types";
