/**
 * TypeScript formatter.
 *
 * Extends the JavaScript formatter with TypeScript-specific passes:
 *  - Decorator blank-line removal (no blank line between @Decorator and its target)
 *  - Generic spacing normalisation  `Array <T>` → `Array<T>`
 *  - Type annotation colon spacing  `x:Type` → `x: Type`
 */

import type { FormatterOptions } from '../types';
import { format as jsFormat }    from './javascript';

// ─── Decorator cleanup ───────────────────────────────────────────────────────

/** Remove blank lines that appear between a decorator and the decorated item. */
function removeDecoratorGaps(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (lines[i].trim().startsWith('@') && lines[i + 1]?.trim() === '') {
      i++; // skip the blank line
    }
  }
  return out;
}

// ─── Generic spacing ─────────────────────────────────────────────────────────

/** `SomeType <T>` → `SomeType<T>` */
function fixGenericSpacing(line: string): string {
  return line.replace(/(\w)\s+<([A-Z])/g, (_m, id: string, t: string) => `${id}<${t}`);
}

// ─── Type annotation spacing ─────────────────────────────────────────────────

/**
 * `name:string` → `name: string`
 * `name :string` → `name: string`
 * Does NOT touch ternary `?:`, `::`, or `=>`.
 */
function fixTypeAnnotations(line: string): string {
  const t = line.trimStart();
  if (t.startsWith('//') || t.startsWith('*')) return line;
  // identifier followed by optional space, colon, optional space, then an uppercase type
  return line.replace(/(\w)\s*:\s*([A-Z][A-Za-z<\[\{(])/g, (_m, id: string, type: string) => `${id}: ${type}`);
}

// ─── Public format function ───────────────────────────────────────────────────

export function format(code: string, options: FormatterOptions): string {
  // 1. Apply full JS formatting pipeline
  let result = jsFormat(code, options);

  // 2. TypeScript-specific passes
  let lines = result.split('\n');
  lines = removeDecoratorGaps(lines);
  lines = lines.map(fixTypeAnnotations);
  lines = lines.map(fixGenericSpacing);

  // Ensure single trailing newline
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  lines.push('');

  return lines.join('\n');
}