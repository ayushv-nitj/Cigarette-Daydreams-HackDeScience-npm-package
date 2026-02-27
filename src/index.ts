import { analyzeComplexity } from "./complexity/complexity";
import { analyzeRedundancy } from "./redundancy/redundancy";
import fs from "fs";

export interface FunctionComplexity {
  name: string;
  line: number;
  cyclomaticComplexity: number;
  length: number;
  nestingDepth: number;
  warnings: string[];
}

export interface RedundancyItem {
  name: string;
  line: number;
  duplicateOf: string;
}

export interface Report {
  complexity: FunctionComplexity[];
  redundancy: RedundancyItem[];
}

async function analyze(code: string): Promise<Report> {
  const complexityResult = analyzeComplexity(code);
  const redundancyResult = analyzeRedundancy(code);

  return {
    complexity: complexityResult.functions,
    redundancy: redundancyResult.duplicates
  };
}

async function analyzeFile(path: string): Promise<Report> {
  const code = fs.readFileSync(path, "utf-8");
  return analyze(code);
}

function diff(oldCode: string, newCode: string) {
  return {
    changed: oldCode !== newCode
  };
}

function version() {
  return "1.0.0";
}

function supportedLanguages() {
  return ["javascript", "typescript"];
}

function config() {
  // teammate will implement scoring config
}

export default {
  analyze,
  analyzeFile,
  diff,
  version,
  supportedLanguages,
  config
};