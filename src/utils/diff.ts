/**
 * Pure-TypeScript unified diff generator.
 *
 * Implements Myers / LCS algorithm to produce standard unified diffs.
 * No external dependencies.
 */

import type { DiffLine, DiffHunk, ParsedDiff, DiffStats } from '../types';

// ─── Internal edit types ────────────────────────────────────────────────────

type EditType = 'equal' | 'insert' | 'delete';

interface Edit {
  type: EditType;
  line: string;
  /** 0-based index in the original array (equal/delete) */
  ai?: number;
  /** 0-based index in the formatted array (equal/insert) */
  bi?: number;
}

// ─── LCS via dynamic programming ────────────────────────────────────────────

/**
 * Build an LCS DP table for two line arrays.
 * Returns the flat Uint32Array and the width (n+1).
 */
function buildLCSTable(a: string[], b: string[]): { dp: Uint32Array; width: number } {
  const m = a.length;
  const n = b.length;
  const width = n + 1;
  const dp = new Uint32Array((m + 1) * width);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i * width + j] = dp[(i - 1) * width + (j - 1)] + 1;
      } else {
        const up   = dp[(i - 1) * width + j];
        const left = dp[i * width + (j - 1)];
        dp[i * width + j] = up > left ? up : left;
      }
    }
  }

  return { dp, width };
}

/**
 * Backtrack through the LCS table to produce a sequence of Edit operations.
 */
function backtrack(a: string[], b: string[]): Edit[] {
  const { dp, width } = buildLCSTable(a, b);
  const ops: Edit[] = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'equal', line: a[i - 1], ai: i - 1, bi: j - 1 });
      i--;
      j--;
    } else if (
      j > 0 &&
      (i === 0 || dp[i * width + (j - 1)] >= dp[(i - 1) * width + j])
    ) {
      ops.push({ type: 'insert', line: b[j - 1], bi: j - 1 });
      j--;
    } else {
      ops.push({ type: 'delete', line: a[i - 1], ai: i - 1 });
      i--;
    }
  }

  return ops.reverse();
}

// ─── Hunk grouping ──────────────────────────────────────────────────────────

function groupHunks(ops: Edit[], contextLines: number): Edit[][] {
  const n = ops.length;
  const changedIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (ops[i].type !== 'equal') changedIndices.push(i);
  }
  if (changedIndices.length === 0) return [];

  const ranges: Array<{ start: number; end: number }> = [];
  let start = Math.max(0, changedIndices[0] - contextLines);
  let end   = Math.min(n - 1, changedIndices[0] + contextLines);

  for (let k = 1; k < changedIndices.length; k++) {
    const ns = Math.max(0, changedIndices[k] - contextLines);
    const ne = Math.min(n - 1, changedIndices[k] + contextLines);
    if (ns <= end + 1) {
      end = ne;
    } else {
      ranges.push({ start, end });
      start = ns;
      end   = ne;
    }
  }
  ranges.push({ start, end });

  return ranges.map(r => ops.slice(r.start, r.end + 1));
}

// ─── Hunk header ────────────────────────────────────────────────────────────

function hunkHeader(hunkOps: Edit[]): string {
  let aStart = Infinity, bStart = Infinity;
  let aCount = 0, bCount = 0;

  for (const op of hunkOps) {
    if (op.type === 'equal' || op.type === 'delete') {
      if (op.ai !== undefined && op.ai + 1 < aStart) aStart = op.ai + 1;
      aCount++;
    }
    if (op.type === 'equal' || op.type === 'insert') {
      if (op.bi !== undefined && op.bi + 1 < bStart) bStart = op.bi + 1;
      bCount++;
    }
  }

  if (!isFinite(aStart)) aStart = 0;
  if (!isFinite(bStart)) bStart = 0;

  const aRange = aCount === 1 ? `${aStart}` : `${aStart},${aCount}`;
  const bRange = bCount === 1 ? `${bStart}` : `${bStart},${bCount}`;
  return `@@ -${aRange} +${bRange} @@`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface GenerateDiffOptions {
  originalFilename?: string;
  formattedFilename?: string;
  contextLines?: number;
}

/**
 * Generate a unified diff string between two code strings.
 * Returns an empty string when the inputs are identical.
 */
export function generateUnifiedDiff(
  originalCode: string,
  formattedCode: string,
  options: GenerateDiffOptions = {},
): string {
  const {
    originalFilename = 'original',
    formattedFilename = 'formatted',
    contextLines = 3,
  } = options;

  if (originalCode === formattedCode) return '';

  const aLines = originalCode.split('\n');
  const bLines = formattedCode.split('\n');
  const ops    = backtrack(aLines, bLines);
  const hunks  = groupHunks(ops, contextLines);

  if (hunks.length === 0) return '';

  const out: string[] = [
    `--- a/${originalFilename}`,
    `+++ b/${formattedFilename}`,
  ];

  for (const hunkOps of hunks) {
    out.push(hunkHeader(hunkOps));
    for (const op of hunkOps) {
      if (op.type === 'equal')  out.push(` ${op.line}`);
      if (op.type === 'delete') out.push(`-${op.line}`);
      if (op.type === 'insert') out.push(`+${op.line}`);
    }
  }

  return out.join('\n') + '\n';
}

/**
 * Parse a unified diff string into a structured {@link ParsedDiff} object.
 * Useful for rendering annotated diffs in a web UI.
 */
export function parseDiff(diffText: string): ParsedDiff {
  const lines = diffText.split('\n');
  let originalFile  = '';
  let formattedFile = '';
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;

  for (const line of lines) {
    if (line.startsWith('--- ')) {
      originalFile = line.slice(4);
    } else if (line.startsWith('+++ ')) {
      formattedFile = line.slice(4);
    } else if (line.startsWith('@@ ')) {
      if (current) hunks.push(current);
      const m = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      current = {
        header:          line,
        originalStart:   m ? parseInt(m[1])       : 0,
        originalCount:   m ? parseInt(m[2] ?? '1'): 0,
        formattedStart:  m ? parseInt(m[3])       : 0,
        formattedCount:  m ? parseInt(m[4] ?? '1'): 0,
        lines:           [],
      };
    } else if (current) {
      const diffLine: DiffLine | null =
        line.startsWith('+') ? { type: 'insert',  content: line.slice(1) } :
        line.startsWith('-') ? { type: 'delete',  content: line.slice(1) } :
        line.startsWith(' ') ? { type: 'context', content: line.slice(1) } :
        null;
      if (diffLine) current.lines.push(diffLine);
    }
  }
  if (current) hunks.push(current);

  return { originalFile, formattedFile, hunks };
}

/**
 * Count additions, deletions and whether anything changed.
 */
export function diffStats(diffText: string): DiffStats {
  let additions = 0;
  let deletions = 0;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { additions, deletions, changed: additions > 0 || deletions > 0 };
}