// engine/semgrep-engine.ts — Semgrep integration
//
// Runs: semgrep --json --config=auto <tempfile>
// Timeout: 8 s (Promise.race guard)
// Graceful: returns [] if semgrep binary not found (ENOENT) or any error.
//
// Normalization:
//   semgrep result  →  CodeIssue
//   check_id        →  id
//   extra.message   →  message
//   extra.severity  →  severity (HIGH→error, MEDIUM→warning, LOW→info)
//   start.line      →  line




import { execFile } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync, existsSync, copyFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import type { CodeIssue } from "../detection/types";

// Bundled rules file — lives next to this .ts file (and gets copied to dist/ on build)
// Falls back to p/default (cloud) if not found.
const RULES_FILE = resolve(__dirname, "semgrep-rules.yml");
const SEMGREP_CONFIG = existsSync(RULES_FILE) ? RULES_FILE : "p/default";

const SEMGREP_TIMEOUT_MS = 8_000;

interface SemgrepResult {
    check_id: string;
    path: string;
    start: { line: number; col: number };
    end: { line: number; col: number };
    extra: {
        message: string;
        severity: string;
        metadata?: Record<string, unknown>;
    };
}

interface SemgrepOutput {
    results: SemgrepResult[];
    errors: unknown[];
}

function normalizeSeverity(raw: string): CodeIssue["severity"] {
    const upper = (raw ?? "").toUpperCase();
    if (upper === "ERROR" || upper === "HIGH" || upper === "CRITICAL") return "error";
    if (upper === "WARNING" || upper === "MEDIUM") return "warning";
    return "info";
}

function timeoutReject(ms: number): Promise<never> {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error("semgrep timeout")), ms)
    );
}

/**
 * Run semgrep on `code` written to a temp file.
 * Returns [] on any failure (binary missing, parse error, timeout).
 */
export async function runSemgrepEngine(
    code: string,
    language: string
): Promise<CodeIssue[]> {
    // Map internal language names to file extensions for temp file
    const EXT_MAP: Record<string, string> = {
        javascript: "js",
        typescript: "ts",
        python: "py",
        java: "java",
        c: "c",
        cpp: "cpp",
    };
    const ext = EXT_MAP[language] ?? "txt";

    // Write code to a temp file
    let tmpDir: string;
    let tmpFile: string;
    try {
        tmpDir = mkdtempSync(join(tmpdir(), "semgrep-"));
        tmpFile = join(tmpDir, `code.${ext}`);
        writeFileSync(tmpFile, code, "utf8");
    } catch {
        return [];
    }

    const semgrepPromise = new Promise<CodeIssue[]>((resolve) => {
        execFile(
            "semgrep",

            ["--json", `--config=${SEMGREP_CONFIG}`, "--no-git-ignore", tmpFile],
            { timeout: SEMGREP_TIMEOUT_MS },
            (err, stdout) => {
                try { unlinkSync(tmpFile); } catch { /* ignore */ }
                try { rmdirSync(tmpDir); } catch { /* ignore */ }

                // ENOENT means semgrep not installed — silent pass
                if (err && (err as NodeJS.ErrnoException).code === "ENOENT") {
                    resolve([]);
                    return;
                }

                try {
                    const parsed: SemgrepOutput = JSON.parse(stdout);
                    const issues: CodeIssue[] = (parsed.results ?? []).map((r, i) => ({
                        id: `semgrep-${r.check_id.replace(/[^a-zA-Z0-9]/g, "-")}-L${r.start.line}-${i}`,
                        category: "security" as CodeIssue["category"],
                        severity: normalizeSeverity(r.extra.severity),
                        message: `[Semgrep] ${r.extra.message}`,
                        line: r.start.line,
                        column: r.start.col,
                        suggestion: `Rule: ${r.check_id}`,
                    }));
                    resolve(issues);
                } catch {
                    resolve([]);
                }
            }
        );
    });

    try {
        return await Promise.race([semgrepPromise, timeoutReject(SEMGREP_TIMEOUT_MS).catch(() => [] as CodeIssue[])]);
    } catch {
        return [];
    }
}
