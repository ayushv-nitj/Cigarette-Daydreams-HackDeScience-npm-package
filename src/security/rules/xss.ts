import { SecurityRule } from "../types";

export const xssRule: SecurityRule = {
  name: "XSS",
  description: "dangerouslySetInnerHTML usage.",
  severity: "medium",

  check: (line: string) => {
    const pattern = /(innerHTML\s*=|dangerouslySetInnerHTML)/;
    return pattern.test(line) ? line.match(pattern) : null;
  },

  remediation: "Sanitize input."
};