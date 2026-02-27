export type Severity = "low" | "medium" | "high" | "critical";

export interface SecurityIssue {
  rule: string;
  file: string;
  line: number;
  severity: Severity;
  message: string;
  remediation: string;
}

export interface SecurityRule {
  name: string; // SQL_INJECTION, XSS, etc.
  description: string;
  severity: Severity;
  check: (line: string) => RegExpMatchArray | null;
  remediation: string;
}
