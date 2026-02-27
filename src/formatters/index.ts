/**
 * Language router.
 * Accepts language strings from the teammate's language-detection module
 * and returns the correct formatter function.
 */

import type { FormatterFn, SupportedLanguage } from '../types';
import { format as jsFormat }   from './javascript';
import { format as tsFormat }   from './typescript';
import { format as pyFormat }   from './python';
import { format as javaFormat } from './java';
import { format as cppFormat }  from './c_cpp';

// ─── Alias map ───────────────────────────────────────────────────────────────

const ALIASES: Record<string, SupportedLanguage> = {
  javascript: 'javascript', js:    'javascript', jsx:  'javascript',
  node:       'javascript', nodejs:'javascript',
  typescript: 'typescript', ts:    'typescript', tsx:  'typescript',
  python:     'python',     py:    'python',     python3: 'python', python2: 'python',
  java:       'java',
  c:          'c',
  cpp:        'cpp',        'c++': 'cpp',        cxx:  'cpp', cc: 'cpp',
  'c/c++':    'cpp',
};

// ─── Formatter registry ──────────────────────────────────────────────────────

const FORMATTERS: Record<SupportedLanguage, FormatterFn> = {
  javascript: jsFormat,
  typescript: tsFormat,
  python:     pyFormat,
  java:       javaFormat,
  c:          cppFormat,
  cpp:        cppFormat,
};

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Normalise any language string to a canonical SupportedLanguage key, or null. */
export function normaliseLanguage(lang: string): SupportedLanguage | null {
  return ALIASES[lang.toLowerCase().trim()] ?? null;
}

/** Return the formatter function for a language string, or null if unsupported. */
export function getFormatter(lang: string): FormatterFn | null {
  const canonical = normaliseLanguage(lang);
  return canonical ? FORMATTERS[canonical] : null;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'javascript','typescript','python','java','c','cpp',
];