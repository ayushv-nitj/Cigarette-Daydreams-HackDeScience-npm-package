// engine/osv-engine.ts — Dependency CVE lookup via OSV (https://osv.dev)
//
// Reads package.json at `projectPath`, queries https://api.osv.dev/v1/querybatch
// Timeout: 6 s. Returns [] on any error (missing file, network, timeout).
//
// Output normalised to CodeIssue[] with category: "security".

import { readFileSync } from "fs";
import { join } from "path";
import { request } from "https";
import type { CodeIssue } from "../detection/types";
import type { DependencyVuln } from "./types";

const OSV_TIMEOUT_MS = 6_000;
const OSV_ENDPOINT = "api.osv.dev";
const OSV_BATCH_PATH = "/v1/querybatch";

interface OsvPackageQuery {
    package: { name: string; ecosystem: string };
    version: string;
}

interface OsvVulnerability {
    id: string;
    summary?: string;
    aliases?: string[];
    severity?: Array<{ type: string; score: string }>;
}

interface OsvBatchResponse {
    results: Array<{ vulns?: OsvVulnerability[] }>;
}

function severityFromScore(score?: string): DependencyVuln["severity"] {
    const n = parseFloat(score ?? "0");
    if (n >= 9.0) return "critical";
    if (n >= 7.0) return "high";
    if (n >= 4.0) return "medium";
    return "low";
}

function severityToIssueSeverity(s: DependencyVuln["severity"]): CodeIssue["severity"] {
    if (s === "critical" || s === "high") return "error";
    if (s === "medium") return "warning";
    return "info";
}

/** Parse package.json deps → [{name, version, ecosystem}] */
function parseDependencies(projectPath: string): OsvPackageQuery[] {
    const pkgPath = join(projectPath, "package.json");
    let raw: string;
    try { raw = readFileSync(pkgPath, "utf8"); } catch { return []; }

    let pkg: Record<string, unknown>;
    try { pkg = JSON.parse(raw) as Record<string, unknown>; } catch { return []; }

    const deps: OsvPackageQuery[] = [];
    const allDeps = {
        ...(pkg["dependencies"] as Record<string, string> | undefined ?? {}),
        ...(pkg["devDependencies"] as Record<string, string> | undefined ?? {}),
    };

    for (const [name, version] of Object.entries(allDeps)) {
        // Strip semver range operators: ^1.0.0 → 1.0.0
        const ver = String(version).replace(/^[\^~>=<*]+/, "").split(" ")[0];
        if (ver && ver !== "*") {
            deps.push({ package: { name, ecosystem: "npm" }, version: ver });
        }
    }
    return deps;
}

/** POST to OSV querybatch endpoint */
function postOSV(queries: OsvPackageQuery[]): Promise<OsvBatchResponse> {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ queries });
        const options = {
            hostname: OSV_ENDPOINT,
            path: OSV_BATCH_PATH,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
            timeout: OSV_TIMEOUT_MS,
        };

        const req = request(options, (res) => {
            let data = "";
            res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
            res.on("end", () => {
                try { resolve(JSON.parse(data) as OsvBatchResponse); }
                catch { reject(new Error("OSV parse error")); }
            });
        });

        req.on("timeout", () => { req.destroy(); reject(new Error("OSV timeout")); });
        req.on("error", (e) => reject(e));
        req.write(body);
        req.end();
    });
}

/** Normalise OSV vulns → CodeIssue[] */
function normaliseVulns(
    queries: OsvPackageQuery[],
    response: OsvBatchResponse
): CodeIssue[] {
    const issues: CodeIssue[] = [];

    (response.results ?? []).forEach((result, idx) => {
        const query = queries[idx];
        if (!query) return;
        (result.vulns ?? []).forEach((vuln) => {
            const score = vuln.severity?.[0]?.score;
            const sevDep = severityFromScore(score);
            issues.push({
                id: `osv-${vuln.id}`,
                category: "security",
                severity: severityToIssueSeverity(sevDep),
                message: `Dependency '${query.package.name}@${query.version}' has known vulnerability ${vuln.id}: ${vuln.summary ?? "no summary"}`,
                suggestion: `Update '${query.package.name}' to a patched version. See https://osv.dev/vulnerability/${vuln.id}`,
            });
        });
    });

    return issues;
}

/**
 * Scan dependencies at projectPath for known CVEs via OSV.
 * Returns [] if projectPath is not provided, package.json missing, or any error.
 */
export async function runOsvEngine(projectPath?: string): Promise<CodeIssue[]> {
    if (!projectPath) return [];

    const queries = parseDependencies(projectPath);
    if (queries.length === 0) return [];

    try {
        const response = await postOSV(queries);
        return normaliseVulns(queries, response);
    } catch {
        return [];
    }
}
