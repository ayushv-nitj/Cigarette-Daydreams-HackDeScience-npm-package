import fs from "fs";
import path from "path";
import { SecurityIssue } from "./types";
import { securityRules } from "./rules";

export function scanFile(filePath: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    securityRules.forEach(rule => {
      const match = rule.check(line);

      if (match) {
        issues.push({
          rule: rule.name,
          file: path.basename(filePath), // only filename
          line: index + 1,
          severity: rule.severity,
          message: rule.description,
          remediation: rule.remediation
        });
      }
    });
  });

  return issues;
}