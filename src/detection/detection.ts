
import type { DetectionResult, SupportedLanguage } from "./types";

// extension part
const EXT_MAP: Record<string, SupportedLanguage> = {
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
    ".py": "python", ".pyw": "python",
    ".java": "java",
    ".c": "c", ".h": "c",
    ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".hpp": "cpp", ".hxx": "cpp",
};

export function detectByExtension(filename: string): DetectionResult | null {
    const match = filename.toLowerCase().match(/(\.[^.]+)$/);
    if (!match) return null;
    const lang = EXT_MAP[match[1]];
    if (!lang) return null;
    return { language: lang, confidence: 1.0, method: "extension" };
}

// ── shebang part 
const SHEBANG_PATTERNS: Array<{ pattern: RegExp; language: SupportedLanguage }> = [
    { pattern: /python3?/, language: "python" },
    { pattern: /ts-node/, language: "typescript" }, // must come before /node/
    { pattern: /node/, language: "javascript" },
];

export function detectByShebang(code: string): DetectionResult | null {
    const firstLine = code.split("\n")[0].trim();
    if (!firstLine.startsWith("#!")) return null;
    for (const { pattern, language } of SHEBANG_PATTERNS) {
        if (pattern.test(firstLine)) return { language, confidence: 0.95, method: "shebang" };
    }
    return null;
}

// Only samples first 5000 chars; confidence capped at 0.9
const SAMPLE_SIZE = 5000;
const MAX_CONFIDENCE = 0.9;

interface SyntaxSignature {
    patterns: RegExp[];
    weight: number;
}

const LANGUAGE_SIGNATURES: Record<SupportedLanguage, SyntaxSignature[]> = {
    javascript: [
        { patterns: [/\bconsole\.log\b/, /\brequire\s*\(/, /\bmodule\.exports\b/], weight: 2 },
        { patterns: [/\bvar\b/, /\blet\b/, /\bconst\b/], weight: 1 },
        { patterns: [/\bfunction\b/, /=>/], weight: 1 },
        { patterns: [/\bPromise\b/, /\basync\b/, /\bawait\b/], weight: 2 },
        { patterns: [/\bdocument\.\w+/, /\bwindow\.\w+/], weight: 2 },
        { patterns: [/\.then\s*\(/, /\.catch\s*\(/], weight: 1.5 },
    ],
    typescript: [
        { patterns: [/:\s*(string|number|boolean|any|void|never|unknown)\b/], weight: 3 },
        { patterns: [/\binterface\b/, /\btype\s+\w+\s*=/], weight: 3 },
        { patterns: [/<[A-Z]\w*>/, /\bgeneric\b/], weight: 2 },
        { patterns: [/\benum\b/, /\bnamespace\b/], weight: 3 },
        { patterns: [/\bimport\s+type\b/, /\bas\s+\w+/], weight: 2 },
        { patterns: [/\bReadonly\b/, /\bPartial\b/, /\bRecord\b/], weight: 2 },
    ],
    python: [
        { patterns: [/\bdef\s+\w+\s*\(/, /\bclass\s+\w+\s*(\(|:)/], weight: 3 },
        { patterns: [/\bimport\s+\w+/, /\bfrom\s+\w+\s+import\b/], weight: 2 },
        { patterns: [/\bprint\s*\(/, /\binput\s*\(/], weight: 2 },
        { patterns: [/\bself\b/, /\bcls\b/], weight: 3 },
        { patterns: [/\belif\b/, /\bpass\b/, /\byield\b/], weight: 3 },
        { patterns: [/:\s*$|:\s*#/m, /^\s{4}/m], weight: 1 },
    ],
    java: [
        { patterns: [/\bpublic\s+class\b/, /\bprivate\s+\w+\s+\w+\s*;/], weight: 3 },
        { patterns: [/\bSystem\.out\.print/, /\bScanner\b/], weight: 3 },
        { patterns: [/\bextends\b/, /\bimplements\b/], weight: 2 },
        { patterns: [/@Override\b/, /@SuppressWarnings/], weight: 3 },
        { patterns: [/\bvoid\b/, /\bthrows\b/, /\bthrow\s+new\b/], weight: 2 },
        { patterns: [/\bArrayList\b/, /\bHashMap\b/, /\bIterator\b/], weight: 2 },
    ],
    c: [
        { patterns: [/#include\s*<(stdio|stdlib|string|math)\.h>/, /#include\s*"[^"]+\.h"/], weight: 3 },
        { patterns: [/\bprintf\s*\(/, /\bscanf\s*\(/, /\bmalloc\s*\(/, /\bfree\s*\(/], weight: 3 },
        { patterns: [/\bint\s+main\s*\(/, /\bvoid\s+main\s*\(/], weight: 3 },
        { patterns: [/\btypedef\s+struct\b/, /\bstruct\s+\w+\s*\{/], weight: 2 },
        { patterns: [/\bNULL\b/, /\bEOF\b/], weight: 1.5 },
    ],
    cpp: [
        { patterns: [/#include\s*<(iostream|vector|string|map|algorithm|memory)>/, /\busing\s+namespace\s+std\b/], weight: 3 },
        { patterns: [/\bcout\s*<</, /\bcin\s*>>/, /\bendl\b/], weight: 3 },
        { patterns: [/\bclass\s+\w+\s*\{/, /\bpublic:|private:|protected:/], weight: 2 },
        { patterns: [/\btemplate\s*</, /\bstd::\w+/], weight: 3 },
        { patterns: [/\bnew\s+\w+/, /\bdelete\s+\w+/], weight: 2 },
        { patterns: [/\bvector\s*</, /\bshared_ptr\s*</, /\bunique_ptr\s*</], weight: 2 },
    ],
};

function scoreLanguage(sample: string, lang: SupportedLanguage): number {
    const sigs = LANGUAGE_SIGNATURES[lang];
    let total = 0, matched = 0;
    for (const sig of sigs) {
        total += sig.weight;
        for (const pattern of sig.patterns) {
            if (pattern.test(sample)) { matched += sig.weight; break; }
        }
    }
    return total === 0 ? 0 : matched / total;
}

export function detectBySyntax(code: string): DetectionResult | null {
    const sample = code.slice(0, SAMPLE_SIZE);
    const languages = Object.keys(LANGUAGE_SIGNATURES) as SupportedLanguage[];
    const scores = languages
        .map((lang) => ({ language: lang, raw: scoreLanguage(sample, lang) }))
        .sort((a, b) => b.raw - a.raw);

    const best = scores[0];
    const second = scores[1];
    if (best.raw === 0) return null;

    // Tie-breaking: prefer more specific languages (TS over JS, C++ over C)
    const isTie = second && Math.abs(best.raw - second.raw) < 0.05;
    if (isTie) {
        const preferOrder: SupportedLanguage[] = ["typescript", "cpp", "java", "python", "javascript", "c"];
        for (const preferred of preferOrder) {
            if (preferred === best.language || preferred === second.language) {
                const winner = preferred === best.language ? best : second;
                return { language: winner.language, confidence: Math.min(winner.raw * 0.9, MAX_CONFIDENCE), method: "syntax" };
            }
        }
    }

    return { language: best.language, confidence: Math.min(best.raw * 0.95, MAX_CONFIDENCE), method: "syntax" };
}

// ── Orchestrator 
export function detectLanguage(code: string, filename?: string): DetectionResult {
    if (!code || code.trim().length === 0)
        return { language: "unknown", confidence: 0, method: "unknown" };

    const sample512 = code.slice(0, 512);
    const nonPrintable = sample512.split("").filter((c) => {
        const n = c.charCodeAt(0);
        return n < 32 && n !== 9 && n !== 10 && n !== 13;
    }).length;
    if (nonPrintable / sample512.length > 0.1)
        return { language: "unknown", confidence: 0, method: "unknown" };

    if (filename) {
        const ext = detectByExtension(filename);
        if (ext) return ext;
    }

    const shebang = detectByShebang(code);
    if (shebang) return shebang;

    const syntax = detectBySyntax(code);
    if (syntax) return syntax;

    return { language: "unknown", confidence: 0, method: "unknown" };
}
