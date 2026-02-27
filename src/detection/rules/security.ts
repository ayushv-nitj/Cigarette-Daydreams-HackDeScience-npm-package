// detection/rules/security.ts — Security Analysis rules

import type { CodeIssue } from "../types";

const SEV_MAP = {
    critical: "error",
    high: "error",
    medium: "warning",
    low: "info",
} as const;

export function securityRules(code: string, language: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const ls = code.split("\n");

    ls.forEach((line, i) => {
        const ln = i + 1;
        const t = line.trim();
        //abhi ke liye hardcoded, need to integrate after actual working model
        // ── Hardcoded secrets / API keys ──
        if (/\b(password|passwd|api_key|apikey|secret|token|auth_token)\s*=\s*["'][^"']{3,}["']/.test(t)) {
            issues.push({
                id: `sec-secret-${ln}`,
                category: "security",
                severity: SEV_MAP["critical"],
                message: "Hardcoded credential detected — never store secrets in source code.",
                line: ln,
                column: t.indexOf("=") + 1,
                suggestion: "Use environment variables: process.env.MY_SECRET",
            });
        }

        // ── SQL injection ──
        if (/\b(query|execute|select|insert|update|delete|where)\b.*\+\s*(req\.|request\.|params\.|body\.|input)/i.test(t)) {
            issues.push({
                id: `sec-sqli-${ln}`,
                category: "security",
                severity: SEV_MAP["high"],
                message: "Possible SQL injection — user input concatenated into query string.",
                line: ln,
                suggestion: "Use parameterised queries / prepared statements.",
            });
        }

        // ── XSS: innerHTML ──
        if (/\.(innerHTML|outerHTML)\s*[+]?=/.test(t)) {
            issues.push({
                id: `sec-xss-inner-${ln}`,
                category: "security",
                severity: SEV_MAP["high"],
                message: "Setting innerHTML can lead to XSS.",
                line: ln,
                suggestion: "Use textContent or createElement() instead.",
            });
        }

        // ── Python shell injection ──
        if (language === "python" && /\bsubprocess\.(call|run|Popen)\s*\(.*shell\s*=\s*True/.test(t)) {
            issues.push({
                id: `sec-shell-${ln}`,
                category: "security",
                severity: SEV_MAP["medium"],
                message: "subprocess with shell=True is vulnerable to shell injection.",
                line: ln,
                suggestion: "Use shell=False and pass a list of arguments.",
            });
        }

        void t; void language;
    });

    return issues;
}
