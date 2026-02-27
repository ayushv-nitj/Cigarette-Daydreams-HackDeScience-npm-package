import fs from "fs";
import path from "path";
import axios from "axios";
import { SecurityIssue } from "./types";

const OSV_API = "https://api.osv.dev/v1/query";
let warningIssued = false;
interface OfflineDB {
  [pkg: string]: {
    [version: string]: {
      severity: string;
      message: string;
      fixed: string;
    };
  };
}

// 🔹 In-memory cache
const osvCache: Record<string, any[]> = {};

// 🔹 Export cache clear function (for testing)
export function clearDependencyCache() {
  for (const key in osvCache) {
    delete osvCache[key];
  }
}

export async function scanDependencies(
  projectRoot: string
): Promise<SecurityIssue[]> {

  const issues: SecurityIssue[] = [];
  const packageJsonPath = path.join(projectRoot, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return issues;
  }

  const packageData = JSON.parse(
    fs.readFileSync(packageJsonPath, "utf-8")
  );

  const dependencies = {
    ...packageData.dependencies,
    ...packageData.devDependencies
  };

  const offlinePath = path.join(__dirname, "offline-vuln-db.json");

  const offlineDB: OfflineDB = fs.existsSync(offlinePath)
    ? JSON.parse(fs.readFileSync(offlinePath, "utf-8"))
    : {};

  for (const pkg in dependencies) {

    const version = dependencies[pkg].replace(/[\^~]/, "");
    const cacheKey = `${pkg}@${version}`;

    try {

      // ✅ Use cache first
      if (osvCache[cacheKey]) {
        if (osvCache[cacheKey].length > 0) {
          issues.push({
            rule: "INSECURE_DEPENDENCY",
            file: "package.json",
            line: 0,
            severity: "high",
            message: `${pkg}@${version} has known vulnerabilities.`,
            remediation: "Upgrade to latest secure version."
          });
        }
        continue;
      }

      if (process.env.TEST_RATE_LIMIT === "true") {
        const error: any = new Error("Simulated rate limit");
        error.response = { status: 429 };
        throw error;
    }

    if (process.env.TEST_NETWORK_FAIL === "true") {
        throw new Error("Simulated network failure");
    }

      const response = await axios.post(
        OSV_API,
        {
          package: { name: pkg, ecosystem: "npm" },
          version
        },
        { timeout: 4000 }
      );

      const vulns = response.data.vulns || [];

      // Cache result
      osvCache[cacheKey] = vulns;

      if (vulns.length > 0) {
        issues.push({
          rule: "INSECURE_DEPENDENCY",
          file: "package.json",
          line: 0,
          severity: "high",
          message: `${pkg}@${version} has known vulnerabilities.`,
          remediation: "Upgrade to latest secure version."
        });
      }

    } 
    catch (err: any) {

  if (!warningIssued) {

    if (err.response && err.response.status === 429) {
      issues.push({
        rule: "DEPENDENCY_SCAN_WARNING",
        file: "package.json",
        line: 0,
        severity: "low",
        message: "OSV rate limit exceeded. Using offline vulnerability data.",
        remediation: "Retry later or reduce scan frequency."
      });
    } else {
      issues.push({
        rule: "DEPENDENCY_SCAN_WARNING",
        file: "package.json",
        line: 0,
        severity: "low",
        message: "OSV service unavailable. Using offline fallback.",
        remediation: "Check internet connection or OSV availability."
      });
    }

    warningIssued = true;
  }

  // 🔹 Offline fallback check remains unchanged
  if (offlineDB[pkg] && offlineDB[pkg][version]) {
    const vuln = offlineDB[pkg][version];

    issues.push({
      rule: "INSECURE_DEPENDENCY",
      file: "package.json",
      line: 0,
      severity: vuln.severity as any,
      message: `${pkg}@${version} vulnerable: ${vuln.message}`,
      remediation: `Upgrade to >=${vuln.fixed}`
    });
  }
}
  }

  return issues;
}