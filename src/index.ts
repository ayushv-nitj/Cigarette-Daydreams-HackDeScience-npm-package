import fs from "fs";
import {
  extractPythonFunctions,
  extractCStyleFunctions
} from "./engines/generic/genericComplexity";

import { analyzeGenericRedundancy } from "./engines/generic/genericRedundancy";
import { analyzeGenericComplexity } from "./engines/generic/genericComplexity";
import { analyzeComplexity } from "./complexity/complexity";
import { analyzeRedundancy } from "./redundancy/redundancy";
import { analyzeWithSemgrep } from "./engines/semgrep/semgrepEngine";
import { detectLanguage } from "./router/languageRouter";

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
  language?: string;
  confidence?: number;
}

/**
 * Main analyze function
 */
async function analyze(
  code: string,
  filePath?: string
): Promise<Report> {
    // console.log("File path received:", filePath);
  const { language, confidence } = detectLanguage(filePath);

  // JS / TS → Use internal AST engine
  if (language === "javascript" || language === "typescript") {
    const complexityResult = analyzeComplexity(code);
    const redundancyResult = analyzeRedundancy(code);

    return {
      complexity: complexityResult.functions,
      redundancy: redundancyResult.duplicates,
      language,
      confidence
    };
  }

  // Other languages → Use Semgrep
  if (
    language === "python" ||
    language === "c" ||
    language === "cpp" ||
    language === "java"
  ) {
    const extension = filePath?.split(".").pop() || "";
const semgrepResult = await analyzeWithSemgrep(
  code,
  extension
);

// Complexity
const genericComplexity = analyzeGenericComplexity(code, language);

// Extract functions for redundancy
const lines = code.split("\n");

let extractedFunctions;

if (language === "python") {
  extractedFunctions = extractPythonFunctions(lines);
} else {
  extractedFunctions = extractCStyleFunctions(lines);
}

// Generic redundancy
const genericDuplicates =
  analyzeGenericRedundancy(extractedFunctions);

// Merge semgrep + generic redundancy
const combinedRedundancy = [
  ...genericDuplicates,
  ...semgrepResult.redundancy
];

return {
  complexity: genericComplexity,
  redundancy: combinedRedundancy,
  language,
  confidence
};
  }

  return {
    complexity: [],
    redundancy: [],
    language,
    confidence
  };
}

/**
 * Analyze file from disk
 */
async function analyzeFile(filePath: string): Promise<Report> {
  const code = fs.readFileSync(filePath, "utf-8");
  return analyze(code, filePath);
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
  return ["javascript", "typescript", "python", "c", "cpp", "java"];
}

function config() {
  // scoring handled by teammate
}

export default {
  analyze,
  analyzeFile,
  diff,
  version,
  supportedLanguages,
  config
};