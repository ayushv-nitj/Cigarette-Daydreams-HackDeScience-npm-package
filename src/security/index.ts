import { scanFile } from "./scanner";
import { scanDependencies } from "./dependency";
import { SecurityIssue } from "./types";
import path from "path";

export async function runSecurityAnalysis(
  files: string[]
): Promise<SecurityIssue[]> {

  let results: SecurityIssue[] = [];

  for (const file of files) {
    const issues = scanFile(file);
    results = results.concat(issues);
  }

  // Dependency scan (project root assumed current working dir)
  const dependencyIssues = await scanDependencies(
    process.cwd()
  );

  results = results.concat(dependencyIssues);

  return results;
}