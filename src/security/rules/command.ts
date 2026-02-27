import { SecurityRule } from "../types";

export const commandInjectionRule: SecurityRule = {
  name: "COMMAND_INJECTION",
  description: "Possible command injection via string concatenation.",
  severity: "critical",

  check: (line: string) => {
    /**
     * Detect:
     * exec("ls " + input)
     * system("rm " + userInput)
     * Runtime.getRuntime().exec(...)
     */

    const commandCall = /(exec|system|Runtime\.getRuntime\(\)\.exec)\s*\(/i;
    const concatenation = /\+/;

    if (commandCall.test(line) && concatenation.test(line)) {
      return line.match(commandCall);
    }

    return null;
  },

  remediation: "Avoid string concatenation in system commands. Use argument arrays or strict validation."
};