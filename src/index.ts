// src/index.ts — Main entry point for the npm package
// Merges: complexity (Ayush) + redundancy (teammate) + detection (Shanawaz)

import { analyzeComplexity } from "./complexity/complexity";
import { analyzeRedundancy } from "./redundancy/redundancy";
import { detectLanguage, routeToAnalyzer, DEFAULT_WEIGHTS } from "./detection/index";
import type { AnalysisReport, AnalysisWeights } from "./detection/types";

//pipeline (full multi-stage async analysis) 
export { analyze } from "./engine/pipeline";
export type { PipelineReport, PipelineOptions, DiffResult, PipelineSnapshot } from "./engine/types";

// ── Reviewer api — reviewer.config() with custom weights 
export { reviewer } from "./engine/reviewer";
export type { Reviewer, ReviewerConfig, ReviewerWeights, ReviewOptions } from "./engine/reviewer";


// bug & lint+ security rule functions  
export { bugLintRules } from "./detection/rules/bug-lint";
export { securityRules } from "./detection/rules/security";

// ── Re-export detection module (Language Detection) 
export {
  detectLanguage,
  detectByExtension,
  detectByShebang,
  detectBySyntax,
  routeToAnalyzer,
  formatCode,
  DEFAULT_WEIGHTS,
} from "./detection/index";

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
  FormattingResult,
} from "./detection/index";

// ── Complexity & Redundancy types 
export type { FunctionComplexity, ComplexityResult } from "./complexity/complexity";
export type { DuplicateFunction, RedundancyResult } from "./redundancy/redundancy";

export interface Report {
  complexity: import("./complexity/complexity").FunctionComplexity[];
  redundancy: import("./redundancy/redundancy").DuplicateFunction[];
}



//basic analyzeFile function for testing that accepts source coude + optional filename and returns as analysisreport with a .detection field at top level
export function analyzeFile(
  code: string,
  options: { filename?: string; weights?: Partial<AnalysisWeights> } = {}
): AnalysisReport {
  const { filename, weights: weightOverrides } = options;

  const detection = detectLanguage(code, filename);

  const issues =
    detection.language !== "unknown"
      ? routeToAnalyzer(detection.language as import("./detection/types").SupportedLanguage, code)
      : [];

  const weights: AnalysisWeights = { ...DEFAULT_WEIGHTS, ...weightOverrides };

  const countBySeverity = (cat: string, sev: string) =>
    issues.filter((i) => i.category === cat && i.severity === sev).length;

  const penaltyBreakdown = {
    bug: Math.min(1, (countBySeverity("bug", "error") * 0.15 + countBySeverity("bug", "warning") * 0.05)),
    security: Math.min(1, (countBySeverity("security", "error") * 0.20 + countBySeverity("security", "warning") * 0.08)),
    complexity: Math.min(1, (countBySeverity("complexity", "error") * 0.10 + countBySeverity("complexity", "warning") * 0.04)),
    redundancy: Math.min(1, (countBySeverity("redundancy", "warning") * 0.04)),
    style: Math.min(1, (countBySeverity("style", "warning") * 0.03 + countBySeverity("style", "info") * 0.01)),
  };

  const score = Math.max(
    0,
    1 -
    weights.bug * penaltyBreakdown.bug -
    weights.security * penaltyBreakdown.security -
    weights.complexity * penaltyBreakdown.complexity -
    weights.redundancy * penaltyBreakdown.redundancy -
    weights.style * penaltyBreakdown.style
  );

  return { detection, issues, score, weights, penaltyBreakdown };
}

export async function analyzeCode(code: string): Promise<Report> {
  const complexityResult = analyzeComplexity(code);
  const redundancyResult = analyzeRedundancy(code);
  return {
    complexity: complexityResult.functions,
    redundancy: redundancyResult.duplicates,
  };
}

export function version() {
  return "1.0.0";
}

export function supportedLanguages() {
  return ["javascript", "typescript", "python", "java", "c", "cpp"];
}

export function diff(oldCode: string, newCode: string) {
  return { changed: oldCode !== newCode };
}

export default {
  analyzeFile,
  analyzeCode,
  diff,
  version,
  supportedLanguages,
};