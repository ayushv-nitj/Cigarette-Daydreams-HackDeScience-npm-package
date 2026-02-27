// src/index.ts — Main entry point for the npm package
// Merged: Formatter + Detection + Complexity + Redundancy

import { promises as fs } from "fs";
import path from "path";

/* ─────────────────────────────────────────────────────────────
   FORMATTER IMPORTS
───────────────────────────────────────────────────────────── */

import {
  getFormatter,
  normaliseLanguage,
  SUPPORTED_LANGUAGES,
} from "./formatters/index";

import {
  generateUnifiedDiff,
  parseDiff,
  diffStats,
} from "./utils/diff";

import type {
  FormatterOptions,
  FormatFileOptions,
  FormatterResult,
  SupportedLanguage,
} from "./types";

/* ─────────────────────────────────────────────────────────────
   ANALYSIS IMPORTS
───────────────────────────────────────────────────────────── */

import { analyzeComplexity } from "./complexity/complexity";
import { analyzeRedundancy } from "./redundancy/redundancy";
import {
  detectLanguage,
  routeToAnalyzer,
  DEFAULT_WEIGHTS,
} from "./detection/index";

import type {
  AnalysisReport,
  AnalysisWeights,
} from "./detection/types";

/* ─────────────────────────────────────────────────────────────
   EXTENSION → LANGUAGE MAP
───────────────────────────────────────────────────────────── */

const EXT_MAP: Record<string, string> = {
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

function detectLangFromExt(filePath: string): string | null {
  return EXT_MAP[path.extname(filePath).toLowerCase()] ?? null;
}

/* ─────────────────────────────────────────────────────────────
   FORMAT FUNCTION
───────────────────────────────────────────────────────────── */

export function format(
  code: string,
  language: string,
  options: FormatterOptions = {}
): FormatterResult {
  if (typeof code !== "string") {
    throw new TypeError('format(): "code" must be a string');
  }

  const {
    indentSize,
    sortImports = true,
    krBraces = true,
    contextLines = 3,
    filename = "code",
  } = options;

  const normLang = normaliseLanguage(language);
  const formatter = normLang ? getFormatter(normLang) : null;

  if (!formatter || !normLang) {
    return {
      language,
      original: code,
      formatted: code,
      diff: "",
      diffParsed: {
        originalFile: filename,
        formattedFile: filename,
        hunks: [],
      },
      stats: { additions: 0, deletions: 0, changed: false },
      isNonDestructive: true,
      error: `Unsupported language: "${language}". Supported: ${SUPPORTED_LANGUAGES.join(
        ", "
      )}`,
      options,
      timestamp: new Date().toISOString(),
    };
  }

  const fmtOptions: FormatterOptions = {
    sortImports,
    krBraces,
    ...(indentSize !== undefined ? { indentSize } : {}),
  };

  const formatted = formatter(code, fmtOptions);

  const diff = generateUnifiedDiff(code, formatted, {
    originalFilename: `a/${filename}`,
    formattedFilename: `b/${filename}`,
    contextLines,
  });

  return {
    language: normLang,
    original: code,
    formatted,
    diff,
    diffParsed: parseDiff(diff),
    stats: diffStats(diff),
    isNonDestructive: true,
    options: fmtOptions,
    timestamp: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────────────────
   FORMAT FILE
───────────────────────────────────────────────────────────── */

export async function formatFile(
  filePath: string,
  options: FormatFileOptions = {}
): Promise<FormatterResult> {
  const { language: langOverride, writeBack = false, ...fmtOptions } = options;

  const code = await fs.readFile(filePath, "utf-8");
  const language = langOverride ?? detectLangFromExt(filePath) ?? "unknown";
  const filename = path.basename(filePath);

  const result = format(code, language, { ...fmtOptions, filename });

  if (writeBack && result.stats.changed && !result.error) {
    await fs.writeFile(filePath, result.formatted, "utf-8");
    return { ...result, writtenBack: true };
  }

  return result;
}

/* ─────────────────────────────────────────────────────────────
   ANALYZE FILE (Detection + Scoring)
───────────────────────────────────────────────────────────── */

export function analyzeFile(
  code: string,
  options: { filename?: string; weights?: Partial<AnalysisWeights> } = {}
): AnalysisReport {
  const { filename, weights: weightOverrides } = options;

  const detection = detectLanguage(code, filename);

  const issues =
    detection.language !== "unknown"
      ? routeToAnalyzer(detection.language as SupportedLanguage, code)
      : [];

  const weights: AnalysisWeights = { ...DEFAULT_WEIGHTS, ...weightOverrides };

  const countBySeverity = (cat: string, sev: string) =>
    issues.filter((i) => i.category === cat && i.severity === sev).length;

  const penaltyBreakdown = {
    bug: Math.min(
      1,
      countBySeverity("bug", "error") * 0.15 +
        countBySeverity("bug", "warning") * 0.05
    ),
    security: Math.min(
      1,
      countBySeverity("security", "error") * 0.2 +
        countBySeverity("security", "warning") * 0.08
    ),
    complexity: Math.min(
      1,
      countBySeverity("complexity", "error") * 0.1 +
        countBySeverity("complexity", "warning") * 0.04
    ),
    redundancy: Math.min(
      1,
      countBySeverity("redundancy", "warning") * 0.04
    ),
    style: Math.min(
      1,
      countBySeverity("style", "warning") * 0.03 +
        countBySeverity("style", "info") * 0.01
    ),
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

/* ─────────────────────────────────────────────────────────────
   ANALYZE CODE (Complexity + Redundancy)
───────────────────────────────────────────────────────────── */

export async function analyzeCode(code: string) {
  const complexityResult = analyzeComplexity(code);
  const redundancyResult = analyzeRedundancy(code);

  return {
    complexity: complexityResult.functions,
    redundancy: redundancyResult.duplicates,
  };
}

/* ─────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────── */

export function version() {
  return "1.0.0";
}

export function supportedLanguagesList(): SupportedLanguage[] {
  return [...SUPPORTED_LANGUAGES];
}

export function diff(oldCode: string, newCode: string) {
  return { changed: oldCode !== newCode };
}

/* ─────────────────────────────────────────────────────────────
   RE-EXPORTS
───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   TYPE RE-EXPORTS
───────────────────────────────────────────────────────────── */

export type {
  FormatterOptions,
  FormatFileOptions,
  FormatterResult,
  SupportedLanguage,
} from "./types";
export { generateUnifiedDiff, parseDiff, diffStats };

export default {
  analyzeFile,
  analyzeCode,
  format,
  formatFile,
  diff,
  version,
  supportedLanguagesList,
};