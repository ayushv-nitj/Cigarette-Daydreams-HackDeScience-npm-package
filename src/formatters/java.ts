/**
 * Java formatter (Google Java Style / OTBS).
 *
 * Applies:
 *  1. K&R / OTBS brace style
 *  2. 4-space indentation
 *  3. Import sorting: static → java.* → javax.* → org.* → com.* → other
 *  4. Space after control-flow keywords (if, for, while, switch, catch)
 *  5. Space after commas
 *  6. Trailing whitespace removal
 *  7. Single trailing newline
 */

import type { FormatterOptions } from '../types';

// ─── Import classification ────────────────────────────────────────────────────

function javaImportRank(path: string): number {
  if (path.startsWith('java.'))  return 0;
  if (path.startsWith('javax.')) return 1;
  if (path.startsWith('org.'))   return 2;
  if (path.startsWith('com.'))   return 3;
  return 4;
}

// ─── Import extraction ────────────────────────────────────────────────────────

interface JavaExtracted {
  packageLines: string[];
  importLines:  string[];
  rest:         string[];
}

function extractImports(lines: string[]): JavaExtracted {
  const packageLines: string[] = [];
  const importLines:  string[] = [];
  const rest:         string[] = [];
  let phase: 'package' | 'imports' | 'rest' = 'package';

  for (const line of lines) {
    const t = line.trim();
    if (phase === 'package') {
      if (t.startsWith('package '))      { packageLines.push(line); }
      else if (t.startsWith('import '))  { phase = 'imports'; importLines.push(line); }
      else if (t !== '')                 { phase = 'rest'; rest.push(line); }
      else                               { packageLines.push(line); }
    } else if (phase === 'imports') {
      if (t.startsWith('import ') || t === '') { importLines.push(line); }
      else { phase = 'rest'; rest.push(line); }
    } else {
      rest.push(line);
    }
  }

  return { packageLines, importLines, rest };
}

function sortJavaImports(importLines: string[]): string[] {
  const getPath = (line: string): string => {
    const m = line.trim().match(/^import\s+(?:static\s+)?([^;]+);/);
    return m ? m[1].trim() : '';
  };

  const nonBlank = importLines.filter(l => l.trim() !== '');
  const statics  = nonBlank.filter(l => l.trim().startsWith('import static'))
                            .sort((a, b) => getPath(a).localeCompare(getPath(b)));
  const normal   = nonBlank.filter(l => !l.trim().startsWith('import static'));

  const groups: string[][] = [[], [], [], [], []];
  for (const line of normal) {
    const rank = javaImportRank(getPath(line));
    groups[rank].push(line);
  }
  groups.forEach(g => g.sort((a, b) => getPath(a).localeCompare(getPath(b))));

  const out: string[] = [];
  if (statics.length) { out.push(...statics); out.push(''); }
  for (const g of groups) {
    if (g.length) { out.push(...g); out.push(''); }
  }
  while (out.length && out[out.length - 1] === '') out.pop();
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
    const next = lines[i + 1]?.trim() ?? '';
    if (next === '{' && lines[i].trim() !== '' && !lines[i].trim().endsWith(';')) {
      out.push(lines[i].trimEnd() + ' {');
      i++;
    } else {
      out.push(lines[i]);
    }
  }
  return out;
}

// ─── Re-indent ────────────────────────────────────────────────────────────────

function reindent(lines: string[]): string[] {
  const pad = '    '; // 4 spaces
  const out: string[] = [];
  let level = 0;
  let inBlock = false;

  for (const raw of lines) {
    const t = raw.trim();
    if (t === '') { out.push(''); continue; }

    if (inBlock) {
      out.push(pad.repeat(level) + ' ' + t.replace(/^\*\s?/, '* '));
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('/*') && !t.includes('*/')) { out.push(pad.repeat(level) + t); inBlock = true; continue; }

    const closesFirst = t.startsWith('}');
    if (closesFirst) level = Math.max(0, level - 1);

    out.push(pad.repeat(level) + t);

    const delta = braceDelta(t);
    level = Math.max(0, closesFirst ? level + delta + 1 : level + delta);
  }
  return out;
}

// ─── Keyword spacing ──────────────────────────────────────────────────────────

function keywordSpacing(line: string): string {
  const t = line.trimStart();
  if (t.startsWith('//') || t.startsWith('*')) return line;
  return line
    .replace(/\b(if|for|while|switch|catch)\s*\(/g, '$1 (')
    .replace(/,([^\s])/g, ', $1')
    .trimEnd();
}

// ─── Public format function ───────────────────────────────────────────────────

export function format(code: string, options: FormatterOptions): string {
  const { krBraces = true } = options;
  let lines = code.split('\n');

  if (krBraces) lines = enforceKRBraces(lines);

  const { packageLines, importLines, rest } = extractImports(lines);
  const sortedImports = importLines.length > 0 ? sortJavaImports(importLines) : [];
  const hasPkg = packageLines.some(l => l.trim().startsWith('package '));

  lines = [
    ...packageLines,
    ...(hasPkg && sortedImports.length ? [''] : []),
    ...sortedImports,
    ...(sortedImports.length ? [''] : []),
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