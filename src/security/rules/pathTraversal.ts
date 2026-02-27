import { SecurityRule } from "../types";

export const pathTraversalRule: SecurityRule = {
  name: "PATH_TRAVERSAL",
  description: "Possible path traversal vulnerability.",
  severity: "high",

  check: (line: string) => {
    /**
     * Detect:
     * fs.readFile("../" + filename)
     * open("../../etc/passwd")
     */

    const fileAccess = /(readFile|open|File|new File)\s*\(/i;
    const traversal = /\.\.\//;

    if (fileAccess.test(line) && traversal.test(line)) {
      return line.match(fileAccess);
    }

    return null;
  },

  remediation: "Validate and sanitize file paths. Avoid using '../' in dynamic file access."
};