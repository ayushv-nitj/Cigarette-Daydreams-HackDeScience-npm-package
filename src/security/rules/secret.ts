import { SecurityRule } from "../types";

export const hardcodedSecretRule: SecurityRule = {
  name: "HARDCODED_SECRET",
  description: "Hardcoded API key detected.",
  severity: "critical",

  check: (line: string) => {
    /**
     * Detect patterns like:
     * const API_KEY = "sk_test_123456..."
     * const secret = "abcd1234..."
     * apiKey: "longstring"
     */

    const pattern =
      /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i;

    return pattern.test(line) ? line.match(pattern) : null;
  },

  remediation: "Move to environment variable."
};