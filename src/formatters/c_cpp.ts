/**
 * C / C++ formatter.
 *
 * Applies:
 *  1. K&R brace style (opening brace on same line)
 *  2. 4-space indentation (tabs → spaces); preprocessor directives never re-indented
 *  3. #include sorting: system <...> before local "...", alphabetical within groups
 *  4. Space after control-flow keywords (if, for, while, switch)
 *  5. access-specifier / case labels dedented by 1 level
 *  6. Trailing whitespace removal, single trailing newline
 */

import type { FormatterOptions } from '../types';

// ─── #include extraction & sorting ───────────────────────────────────────────

interface CExtracted {
  preamble: string[];
  includes: string[];
  rest:     string[];
}

function extractIncludes(lines: string[]): CExtracted {
  const preamble: string[] = [];
  const includes: string[] = [];
  let i = 0;

  // leading comments, pragma, header-guard
  while (i < lines.length) {
    const t = lines[i].trim();
    if (
      t === '' ||
      t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') ||
      t.startsWith('#pragma') || t.startsWith('#ifndef') || t.startsWith('#endif')
    ) {
      preamble.push(lines[i]); i++;
    } else if (t.startsWith('#define') && preamble.some(l => l.trim().startsWith('#ifndef'))) {
      preamble.push(lines[i]); i++; break;
    } else {
      break;
    }
  }

  // includes
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t.startsWith('#include') || t === '') { includes.push(lines[i]); i++; }
    else break;
  }

  return { preamble, includes, rest: lines.slice(i) };
}

function sortIncludes(includeLines: string[]): string[] {
  const nonBlank = includeLines.filter(l => l.trim().startsWith('#include'));
  const system   = nonBlank.filter(l => /^#include\s+</.test(l.trim())).sort((a, b) => a.trim().localeCompare(b.trim()));
  const local    = nonBlank.filter(l => /^#include\s+"/.test(l.trim())).sort((a, b) => a.trim().localeCompare(b.trim()));

  const out: string[] = [...system];
  if (system.length && local.length) out.push('');
  out.push(...local);
  return out;
}

// ─── Brace delta ─────────────────────────────────────────────────────────────

function braceDelta(line: string): number {
  let open = 0, close = 0;
  let inStr = false, inChar = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inChar) { if (ch === '\\') { i++; continue; } if (ch === "'") inChar = false; }
    else if (inStr) { if (ch === '\\') { i++; continue; } if (ch === '"') inStr = false; }
    else if (ch === '"') { inStr = true; }
    else if (ch === "'") { inChar = true; }
    else if (ch === '/' && line[i + 1] === '/') break;
    else if (ch === '{') open++;
    else if (ch === '}') close++;
  }
  return open - close;
}

// ─── K&R brace enforcement ────────────────────────────────────────────────────

function enforceKRBraces(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t    = lines[i].trim();
    const next = lines[i + 1]?.trim() ?? '';
    if (next === '{' && t !== '' && !t.endsWith(';') && !t.startsWith('#')) {
      out.push(lines[i].trimEnd() + ' {');
      i++;
    } else {
      out.push(lines[i]);
    }
  }
  return out;
}

// ─── Re-indent ────────────────────────────────────────────────────────────────

const LABEL_RE = /^(case\s.+|default\s*|public\s*|private\s*|protected\s*):/;

function reindent(lines: string[]): string[] {
  const pad = '    ';
  const out: string[] = [];
  let level = 0;
  let inBlock = false;

  for (const raw of lines) {
    // Expand tabs
    const expanded = raw.replace(/^\t+/, t => pad.repeat(t.length));
    const t = expanded.trim();

    if (t === '') { out.push(''); continue; }

    // Preprocessor directives stay at column 0
    if (t.startsWith('#')) { out.push(t); continue; }

    if (inBlock) {
      out.push(pad.repeat(level) + ' ' + t.replace(/^\*\s?/, '* '));
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('/*') && !t.includes('*/')) { out.push(pad.repeat(level) + t); inBlock = true; continue; }

    const closesFirst = t.startsWith('}');
    if (closesFirst) level = Math.max(0, level - 1);

    // labels dedented by 1 relative to their block
    const effectiveLevel = LABEL_RE.test(t) ? Math.max(0, level - 1) : level;
    out.push(pad.repeat(effectiveLevel) + t);

    const delta = braceDelta(t);
    level = Math.max(0, closesFirst ? level + delta + 1 : level + delta);
  }
  return out;
}

// ─── Keyword spacing ──────────────────────────────────────────────────────────

function keywordSpacing(line: string): string {
  const t = line.trimStart();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('#')) return line;
  return line
    .replace(/\b(if|for|while|switch)\s*\(/g, '$1 (')
    .replace(/,([^\s])/g, ', $1')
    .trimEnd();
}

// ─── Public format function ───────────────────────────────────────────────────

export function format(code: string, options: FormatterOptions): string {
  const { krBraces = true } = options;
  let lines = code.split('\n');

  if (krBraces) lines = enforceKRBraces(lines);

  const { preamble, includes, rest } = extractIncludes(lines);
  const sortedIncludes = includes.length > 0 ? sortIncludes(includes) : [];

  lines = [
    ...preamble,
    ...sortedIncludes,
    ...(sortedIncludes.length ? [''] : []),
    ...rest,
  ];

  lines = reindent(lines);
  lines = lines.map(keywordSpacing);
  lines = lines.map(l => l.trimEnd());

  const out: string[] = [];
  let blanks = 0;
  for (const l of lines) {
    if (l === '') { if (++blanks <= 2) out.push(l); }
    else          { blanks = 0; out.push(l); }
  }

  while (out.length && out[out.length - 1] === '') out.pop();
  out.push('');

  return out.join('\n');
}