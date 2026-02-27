/**
 * JavaScript formatter.
 *
 * Applies:
 *  1. K&R brace style  — opening brace on same line as statement
 *  2. Import sorting   — builtin → external → relative, alpha within groups
 *  3. 2-space re-indent (brace-tracking, skips string literals & comments)
 *  4. Trailing whitespace removal
 *  5. Max 2 consecutive blank lines
 *  6. Single trailing newline
 */

import type { FormatterOptions } from '../types';

// ─── Node.js built-in module names ──────────────────────────────────────────

const NODE_BUILTINS = new Set<string>([
  'assert','async_hooks','buffer','child_process','cluster','console',
  'constants','crypto','dgram','diagnostics_channel','dns','domain',
  'events','fs','http','http2','https','inspector','module','net',
  'os','path','perf_hooks','process','punycode','querystring',
  'readline','repl','stream','string_decoder','sys','timers','tls',
  'trace_events','tty','url','util','v8','vm','wasi','worker_threads','zlib',
]);

type ImportGroup = 'builtin' | 'external' | 'relative';

function classifyImport(source: string): ImportGroup {
  if (source.startsWith('.') || source.startsWith('/')) return 'relative';
  const base = source.replace(/^node:/, '').split('/')[0];
  return NODE_BUILTINS.has(base) ? 'builtin' : 'external';
}

// ─── Import extraction ───────────────────────────────────────────────────────

interface ImportBlock {
  preamble: string[];
  imports:  string[];
  rest:     string[];
}

/** Check whether accumulated import lines form a complete statement (balanced brackets). */
function isComplete(lines: string[]): boolean {
  const src = lines.join('\n');
  let parens = 0, braces = 0;
  let inStr = false, strChar = '';
  for (const ch of src) {
    if (inStr) { if (ch === strChar) inStr = false; }
    else if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; }
    else if (ch === '(') parens++;
    else if (ch === ')') parens--;
    else if (ch === '{') braces++;
    else if (ch === '}') braces--;
  }
  return parens === 0 && braces === 0;
}

function extractImports(lines: string[]): ImportBlock {
  const preamble: string[] = [];
  let i = 0;

  // shebang
  if (lines[0]?.startsWith('#!')) { preamble.push(lines[0]); i++; }

  // leading blanks + 'use strict'
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '' || t === "'use strict';" || t === '"use strict";') {
      preamble.push(lines[i]); i++;
    } else break;
  }

  const imports: string[] = [];
  const accumulated: string[] = [];

  while (i < lines.length) {
    const t = lines[i].trim();
    const isImportLine =
      /^import\s/.test(t) ||
      /^(const|let|var)\s+\S.*=\s*require\s*\(/.test(t);
    const isContinuation = accumulated.length > 0 && !isComplete(accumulated);

    if (isImportLine || isContinuation) {
      accumulated.push(lines[i]);
      if (isComplete(accumulated)) {
        imports.push(...accumulated);
        accumulated.length = 0;
      }
      i++;
    } else if (t === '' && imports.length > 0) {
      // allow blank lines between imports only if next line is still an import
      const next = lines[i + 1]?.trim() ?? '';
      if (/^import\s/.test(next) || /^(const|let|var)\s+\S.*=\s*require\s*\(/.test(next)) {
        imports.push(lines[i]); i++;
      } else break;
    } else break;
  }

  return { preamble, imports, rest: lines.slice(i) };
}

// ─── Import sorting ──────────────────────────────────────────────────────────

function sortImports(importLines: string[]): string[] {
  const nonBlank = importLines.filter(l => l.trim() !== '');

  const parsed = nonBlank.map(line => {
    let m: RegExpMatchArray | null;
    m = line.match(/from\s+['"]([^'"]+)['"]/);
    if (m) return { source: m[1], line, group: classifyImport(m[1]) };
    m = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (m) return { source: m[1], line, group: classifyImport(m[1]) };
    m = line.match(/^import\s+['"]([^'"]+)['"]/);
    if (m) return { source: m[1], line, group: classifyImport(m[1]) };
    return { source: '', line, group: 'external' as ImportGroup };
  });

  const byGroup = (g: ImportGroup) =>
    parsed
      .filter(p => p.group === g)
      .sort((a, b) => a.source.localeCompare(b.source))
      .map(p => p.line);

  const builtins  = byGroup('builtin');
  const externals = byGroup('external');
  const relatives = byGroup('relative');

  const result: string[] = [];
  if (builtins.length)  { result.push(...builtins);  if (externals.length || relatives.length) result.push(''); }
  if (externals.length) { result.push(...externals); if (relatives.length) result.push(''); }
  if (relatives.length) { result.push(...relatives); }

  return result;
}

// ─── K&R brace enforcement ───────────────────────────────────────────────────

function enforceKRBraces(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (
      i + 1 < lines.length &&
      lines[i + 1].trim() === '{' &&
      lines[i].trim() !== ''
    ) {
      out.push(lines[i].trimEnd() + ' {');
      i++; // skip standalone '{'
    } else {
      out.push(lines[i]);
    }
  }
  return out;
}

// ─── Brace delta ─────────────────────────────────────────────────────────────

function braceDelta(line: string): number {
  let open = 0, close = 0;
  let inStr = false, strChar = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === strChar) inStr = false;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true; strChar = ch;
    } else if (ch === '/' && line[i + 1] === '/') {
      break;
    } else if ('({['.includes(ch)) open++;
    else if (')}]'.includes(ch)) close++;
  }
  return open - close;
}

// ─── Re-indent ───────────────────────────────────────────────────────────────

function reindent(lines: string[], size: number): string[] {
  const pad = ' '.repeat(size);
  const out: string[] = [];
  let level = 0;
  let inBlockComment = false;
  let inTemplateLiteral = false;

  for (const raw of lines) {
    const t = raw.trim();

    if (t === '') { out.push(''); continue; }

    if (!inTemplateLiteral) {
      if (inBlockComment) {
        out.push(pad.repeat(level) + ' ' + t.replace(/^\*\s?/, '* '));
        if (t.includes('*/')) inBlockComment = false;
        continue;
      }
      if (t.startsWith('/*') && !t.includes('*/')) {
        out.push(pad.repeat(level) + t);
        inBlockComment = true;
        continue;
      }
    }

    const closesFirst = /^[}\])]/.test(t);
    if (closesFirst && !inTemplateLiteral) level = Math.max(0, level - 1);

    out.push(pad.repeat(level) + t);

    if (!inTemplateLiteral) {
      const delta = braceDelta(t);
      level = Math.max(0, closesFirst ? level + delta + 1 : level + delta);
    }

    // track unmatched backticks
    const backticks = (t.match(/`/g) ?? []).length;
    if (backticks % 2 !== 0) inTemplateLiteral = !inTemplateLiteral;
  }

  return out;
}

// ─── Public format function ──────────────────────────────────────────────────

export function format(code: string, options: FormatterOptions): string {
  const {
    indentSize   = 2,
    sortImports: doSort = true,
    krBraces             = true,
  } = options;

  let lines = code.split('\n');

  if (krBraces) lines = enforceKRBraces(lines);

  if (doSort) {
    const { preamble, imports, rest } = extractImports(lines);
    const sorted = imports.length > 0 ? sortImports(imports) : [];
    lines = [...preamble, ...sorted, ...rest];
  }

  lines = reindent(lines, indentSize);
  lines = lines.map(l => l.trimEnd());

  // Collapse > 2 consecutive blank lines
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