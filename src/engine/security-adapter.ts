// engine/security-adapter.ts — Full bridge for teammate's src/security/ module
//
// Replaces our default securityRules (regex) + osvEngine (batch OSV)
// with the teammate's complete security pipeline:
//   1. scanFile()          → SQL injection, XSS, hardcoded secrets,
//                            command injection, path traversal (5 rule categories)
//   2. scanDependencies()  → OSV API via axios, in-memory cache,
//                            offline vuln-db fallback
//
// Input:  code string  (we write to a temp file for scanFile)
// Output: CodeIssue[]  (normalised from SecurityIssue[])

import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { CodeIssue } from "../detection/types";
import type { Severity } from "../security/types";
import { scanFile } from "../security/scanner";
import { scanDependencies } from "../security/dependency";

/** Map teammate severity (low/medium/high/critical) → our pipeline severity */
function mapSeverity(s: Severity): CodeIssue["severity"] {
    if (s === "critical" || s === "high") return "error";
    if (s === "medium") return "warning";
    return "info";
}

/** Extension mapping for scanFile rule matching */
const EXT_MAP: Record<string, string> = {
    javascript: ".js", typescript: ".ts",
    python: ".py", java: ".java",
    c: ".c", cpp: ".cpp",
};

/**
 * Full team security engine — replaces securityRules + osvEngine.
 *
 * Runs:
 *   ① scanFile()         (static AST-free regex rules from src/security/rules/)
 *   ② scanDependencies() (OSV API dep scan — only when projectPath is provided)
 *
 * Returns CodeIssue[] with category:"security".
 */
export async function runTeamSecurityEngine(
    code: string,
    language: string,
    projectPath?: string
): Promise<CodeIssue[]> {
    const ext = EXT_MAP[language] ?? ".txt";

    // ① Write temp file so scanFile() can read it
    const tmpDir = mkdtempSync(join(tmpdir(), "team-sec-"));
    const tmpFile = join(tmpDir, `code${ext}`);
    let staticIssues: ReturnType<typeof scanFile> = [];

    try {
        writeFileSync(tmpFile, code, "utf8");
        staticIssues = scanFile(tmpFile);
    } catch { /* graceful */ }
    finally {
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
        try { rmdirSync(tmpDir); } catch { /* ignore */ }
    }

    // ② Dependency CVE scan (only if projectPath given)
    let depIssues: Awaited<ReturnType<typeof scanDependencies>> = [];
    if (projectPath) {
        try { depIssues = await scanDependencies(projectPath); }
        catch { /* graceful */ }
    }

    // Normalise everything → CodeIssue[]
    const all = [...staticIssues, ...depIssues];

    return all.map((si, idx): CodeIssue => ({
        id: `team-sec-${si.rule}-L${si.line}-${idx}`,
        category: "security",
        severity: mapSeverity(si.severity),
        message: `[${si.rule}] ${si.message}`,
        line: si.line > 0 ? si.line : undefined,
        suggestion: si.remediation,
    }));
}
