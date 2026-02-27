/**
 * Python formatter (PEP 8).
 *
 * Applies:
 *  1. Tab → 4-space conversion
 *  2. Import sorting: stdlib → third-party → local, alphabetical within groups
 *  3. Two blank lines before top-level def/class/async def
 *  4. Trailing whitespace removal
 *  5. Max 2 consecutive blank lines
 *  6. Single trailing newline
 */

import type { FormatterOptions } from '../types';

// ─── stdlib module list ──────────────────────────────────────────────────────

const STDLIB = new Set<string>([
  'abc','ast','asyncio','base64','binascii','builtins','cmath',
  'collections','concurrent','contextlib','copy','csv','dataclasses',
  'datetime','decimal','difflib','email','enum','errno','fnmatch',
  'fractions','ftplib','functools','gc','glob','gzip','hashlib',
  'heapq','hmac','html','http','imaplib','importlib','inspect',
  'io','ipaddress','itertools','json','keyword','linecache','locale',
  'logging','math','mimetypes','multiprocessing','numbers','operator',
  'os','pathlib','pickle','platform','pprint','queue','random',
  're','shlex','shutil','signal','socket','sqlite3','ssl','stat',
  'statistics','string','struct','subprocess','sys','tempfile',
  'textwrap','threading','time','timeit','traceback','typing',
  'unicodedata','unittest','urllib','uuid','warnings','weakref',
  'xml','xmlrpc','zipfile','zipimport','zlib','__future__',
]);

type PyImportCategory = 'stdlib' | 'thirdparty' | 'local';

function classifyModule(name: string): PyImportCategory {
  const base = name.split('.')[0];
  if (!base || name.startsWith('.')) return 'local';
  return STDLIB.has(base) ? 'stdlib' : 'thirdparty';
}

// ─── Import extraction & sorting ─────────────────────────────────────────────

interface PyImportParsed {
  module: string;
  line:   string;
  cat:    PyImportCategory;
}

function parseImportLine(line: string): PyImportParsed | null {
  const t = line.trim();
  let m: RegExpMatchArray | null;
  m = t.match(/^from\s+(\S+)\s+import\s+/);
  if (m) return { module: m[1], line, cat: classifyModule(m[1]) };
  m = t.match(/^import\s+(\S+)/);
  if (m) return { module: m[1], line, cat: classifyModule(m[1]) };
  return null;
}

interface PyExtracted {
  preamble:      string[];
  sortedImports: string[];
  rest:          string[];
}

function extractAndSort(lines: string[]): PyExtracted {
  let i = 0;
  const preamble: string[] = [];

  // shebang / encoding comment
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t.startsWith('#!') || t.startsWith('# -*-') || t.startsWith('# coding') || t === '') {
      preamble.push(lines[i]); i++;
    } else break;
  }

  // module-level docstring
  if (i < lines.length) {
    const t = lines[i].trim();
    if (t.startsWith('"""') || t.startsWith("'''")) {
      const q = t.startsWith('"""') ? '"""' : "'''";
      const re = new RegExp(q, 'g');
      preamble.push(lines[i]); i++;
      if ((t.match(re) ?? []).length < 2) {
        while (i < lines.length && !lines[i].includes(q)) { preamble.push(lines[i]); i++; }
        if (i < lines.length) { preamble.push(lines[i]); i++; }
      }
    }
  }

  // gather import lines
  const importLines: string[] = [];
  while (i < lines.length) {
    const t = lines[i].trim();
    if (/^(import|from)\s/.test(t) || (t === '' && importLines.some(l => l.trim()))) {
      importLines.push(lines[i]); i++;
    } else break;
  }

  const parsed = importLines
    .filter(l => l.trim() !== '')
    .map(parseImportLine)
    .filter((p): p is PyImportParsed => p !== null);

  const sorted = (cat: PyImportCategory) =>
    parsed.filter(p => p.cat === cat).sort((a, b) => a.module.localeCompare(b.module)).map(p => p.line);

  const stdlib     = sorted('stdlib');
  const thirdparty = sorted('thirdparty');
  const local      = sorted('local');

  const sortedImports: string[] = [];
  if (stdlib.length)     { sortedImports.push(...stdlib);     if (thirdparty.length || local.length) sortedImports.push(''); }
  if (thirdparty.length) { sortedImports.push(...thirdparty); if (local.length) sortedImports.push(''); }
  if (local.length)      { sortedImports.push(...local); }

  return { preamble, sortedImports, rest: lines.slice(i) };
}

// ─── PEP 8 blank lines ───────────────────────────────────────────────────────

function enforceBlankLines(lines: string[]): string[] {
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t    = line.trim();
    const isTopLevel = /^(def |class |async def )/.test(t);

    if (isTopLevel && out.length > 0) {
      // strip trailing blanks then add exactly 2
      while (out.length && out[out.length - 1].trim() === '') out.pop();
      out.push('', '');
    }

    out.push(line);
  }

  return out;
}

// ─── Tab normalisation ───────────────────────────────────────────────────────

function expandTabs(lines: string[]): string[] {
  return lines.map(l => l.replace(/^\t+/g, tabs => '    '.repeat(tabs.length)));
}

// ─── Public format function ───────────────────────────────────────────────────

export function format(code: string, _options: FormatterOptions): string {
  let lines = code.split('\n');

  lines = expandTabs(lines);

  const { preamble, sortedImports, rest } = extractAndSort(lines);
  const formattedRest = enforceBlankLines(rest);

  const separator = preamble.length > 0 && sortedImports.length > 0 ? [''] : [];
  const gap       = sortedImports.length > 0 ? ['', ''] : [];

  lines = [...preamble, ...separator, ...sortedImports, ...gap, ...formattedRest];
  lines = lines.map(l => l.trimEnd());

  // Collapse > 2 blank lines
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