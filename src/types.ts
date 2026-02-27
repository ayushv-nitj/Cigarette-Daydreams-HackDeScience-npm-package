/**
 * Shared types for the Auto-Formatting & Diff module.
 */

// ─── Diff types ────────────────────────────────────────────────────────────

export type DiffLineType = 'insert' | 'delete' | 'context';

export interface DiffLine {
  type: DiffLineType;
  content: string;
}

export interface DiffHunk {
  header: string;
  originalStart: number;
  originalCount: number;
  formattedStart: number;
  formattedCount: number;
  lines: DiffLine[];
}

export interface ParsedDiff {
  originalFile: string;
  formattedFile: string;
  hunks: DiffHunk[];
}

export interface DiffStats {
  additions: number;
  deletions: number;
  changed: boolean;
}

// ─── Formatter types ────────────────────────────────────────────────────────

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'c'
  | 'cpp';

export interface FormatterOptions {
  /** Override default indentation size (JS/TS: 2, others: 4) */
  indentSize?: number;
  /** Sort import/include statements (default: true) */
  sortImports?: boolean;
  /** K&R brace style — opening brace on same line (default: true) */
  krBraces?: boolean;
  /** Number of context lines in unified diff (default: 3) */
  contextLines?: number;
  /** Filename used in diff headers (default: 'code') */
  filename?: string;
}

export interface FormatFileOptions extends FormatterOptions {
  /** Override language auto-detection from file extension */
  language?: string;
  /** Overwrite the file with formatted output (default: false) */
  writeBack?: boolean;
}

export interface FormatterResult {
  /** Canonical language name used for formatting */
  language: string;
  /** Original source code — never modified */
  original: string;
  /** Reformatted source code */
  formatted: string;
  /** Unified diff string (empty string if no changes) */
  diff: string;
  /** Structured diff object for programmatic rendering */
  diffParsed: ParsedDiff;
  /** Summary statistics */
  stats: DiffStats;
  /**
   * Always true — the formatter only modifies whitespace, import ordering,
   * and brace placement. Logic is never altered.
   */
  isNonDestructive: true;
  /** Set when language is unsupported; code is returned unchanged */
  error?: string;
  /** Options that were applied */
  options: FormatterOptions;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Only set when formatFile() is called with writeBack: true */
  writtenBack?: boolean;
}

// ─── Internal formatter function signature ─────────────────────────────────

export type FormatterFn = (code: string, options: FormatterOptions) => string;