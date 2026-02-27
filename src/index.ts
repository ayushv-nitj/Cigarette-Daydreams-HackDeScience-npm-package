// src/index.ts — Main entry point for the npm package
// Merges: complexity (Ayush) + redundancy (teammate) + detection (Shanawaz) + formatting & diff module

import { analyzeComplexity } from "./complexity/complexity";
import { analyzeRedundancy } from "./redundancy/redundancy";
import { detectLanguage, routeToAnalyzer, DEFAULT_WEIGHTS } from "./detection/index";
import type { AnalysisReport, AnalysisWeights } from "./detection/types";
import * as fs from "fs/promises";
import * as path from "path";
import { getFormatter, normaliseLanguage, SUPPORTED_LANGUAGES } from "./formatters/index";
import { generateUnifiedDiff, parseDiff, diffStats } from "./utils/diff";
import type { ParsedDiff } from "./utils/diff";

// ── Pipeline (full multi-stage async analysis)
export { analyze } from "./engine/pipeline";
export type { PipelineReport, PipelineOptions, DiffResult, PipelineSnapshot } from "./engine/types";

// ── Reviewer API — reviewer.config() with custom weights
export { reviewer } from "./engine/reviewer";
export type { Reviewer, ReviewerConfig, ReviewerWeights, ReviewOptions } from "./engine/reviewer";

// ── Bug & lint + security rule functions
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

// ── Formatter types
export interface FormatterStats {
  additions: number;
  deletions: number;
  changed: boolean;
}

// BEFORE
export interface FormatterResult {
  language: string | null;
  original: string;
  formatted: string;
  diff: string;
  diffParsed: ParsedDiff;    // ← fix
  stats: FormatterStats;
  isNonDestructive: boolean;
  error?: string;
  options: object;
  timestamp: string;
  writtenBack?: boolean;
}

// ── Extension → language map for file-based detection
const EXT_LANGUAGE_MAP: Record<string, string> = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".pyw": "python",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".cc": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
};

/**
 * Detect language from file extension.
 */
function detectLanguageFromExtension(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_LANGUAGE_MAP[ext] || null;
}

/**
 * Format a code string.
 */
export function format(
  code: string,
  language: string,
  options: {
    indentSize?: number;
    sortImports?: boolean;
    krBraces?: boolean;
    contextLines?: number;
    filename?: string;
  } = {}
): FormatterResult {
  if (typeof code !== "string") throw new TypeError('format(): "code" must be a string');
  if (typeof language !== "string") throw new TypeError('format(): "language" must be a string');

  const {
    indentSize,
    sortImports = true,
    krBraces = true,
    contextLines = 3,
    filename = "code",
  } = options;

  const normLang: string = normaliseLanguage(language) ?? language.toLowerCase();
  const formatter = getFormatter(normLang);

  if (!formatter) {
    return {
      language: normLang,
      original: code,
      formatted: code,
      diff: "",
      diffParsed: { originalFile: filename, formattedFile: filename, hunks: [] },
      stats: { additions: 0, deletions: 0, changed: false },
      isNonDestructive: true,
      error: `Unsupported language: "${language}". Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
      options,
      timestamp: new Date().toISOString(),
    };
  }

  const formatterOptions = { sortImports, krBraces, ...(indentSize ? { indentSize } : {}) };
  const formatted = formatter(code, formatterOptions);

  const diffText = generateUnifiedDiff(code, formatted, {
    originalFilename: `a/${filename}`,
    formattedFilename: `b/${filename}`,
    contextLines,
  });

  const parsed = parseDiff(diffText);
  const stats = diffStats(diffText);

  return {
    language: normLang,
    original: code,
    formatted,
    diff: diffText,
    diffParsed: parsed,
    stats,
    isNonDestructive: true,
    options: formatterOptions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a file on disk.
 */
export async function formatFile(
  filePath: string,
  options: {
    language?: string;
    writeBack?: boolean;
    indentSize?: number;
    sortImports?: boolean;
    krBraces?: boolean;
    contextLines?: number;
  } = {}
): Promise<FormatterResult> {
  const { language: langOverride, writeBack = false, ...fmtOptions } = options;

  const code = await fs.readFile(filePath, "utf-8");
  const language = langOverride || detectLanguageFromExtension(filePath) || "unknown";
  const filename = path.basename(filePath);
  const result = format(code, language, { ...fmtOptions, filename });

  if (writeBack && result.stats.changed && !result.error) {
    await fs.writeFile(filePath, result.formatted, "utf-8");
    result.writtenBack = true;
  }

  return result;
}

/**
 * Analyze a file/code string for quality issues.
 */
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
    bug: Math.min(1, countBySeverity("bug", "error") * 0.15 + countBySeverity("bug", "warning") * 0.05),
    security: Math.min(1, countBySeverity("security", "error") * 0.2 + countBySeverity("security", "warning") * 0.08),
    complexity: Math.min(1, countBySeverity("complexity", "error") * 0.1 + countBySeverity("complexity", "warning") * 0.04),
    redundancy: Math.min(1, countBySeverity("redundancy", "warning") * 0.04),
    style: Math.min(1, countBySeverity("style", "warning") * 0.03 + countBySeverity("style", "info") * 0.01),
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

/**
 * Analyze code for complexity and redundancy.
 */
export async function analyzeCode(code: string): Promise<Report> {
  const complexityResult = analyzeComplexity(code);
  const redundancyResult = analyzeRedundancy(code);
  return {
    complexity: complexityResult.functions,
    redundancy: redundancyResult.duplicates,
  };
}

// ── Re-export diff utilities for programmatic use
export { generateUnifiedDiff, parseDiff, diffStats } from "./utils/diff";

// ── Utilities
export function version(): string {
  return "1.0.0";
}

export function supportedLanguages(): string[] {
  return [...SUPPORTED_LANGUAGES];
}

export function diff(oldCode: string, newCode: string) {
  return { changed: oldCode !== newCode };
}

export default {
  analyzeFile,
  analyzeCode,
  format,
  formatFile,
  diff,
  version,
  supportedLanguages,
};