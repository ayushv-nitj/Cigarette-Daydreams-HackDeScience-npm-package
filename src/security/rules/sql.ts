// import { SecurityRule } from "../types";

// export const sqlInjectionRule: SecurityRule = {
//   name: "SQL_INJECTION",
//   description: "Possible SQL injection.",
//   severity: "high",

//   check: (line: string) => {
//     /**
//      * Detect SQL keywords + string concatenation
//      * Works for JS, Python, Java
//      */

//     const sqlKeyword = /(SELECT|INSERT|UPDATE|DELETE)\s+/i;
//     const concatenation = /\+/;

//     if (sqlKeyword.test(line) && concatenation.test(line)) {
//       return line.match(sqlKeyword);
//     }

//     return null;
//   },

//   remediation: "Use parameterized queries."
// };


import { SecurityRule } from "../types";

export const sqlInjectionRule: SecurityRule = {
  name: "SQL_INJECTION",
  description: "Possible SQL injection.",
  severity: "high",

  check: (line: string) => {
  const sqlKeyword = /\b(SELECT|INSERT|UPDATE|DELETE)\b/i;
  const stringConcat = /\+\s*\w+/;
  const cStrcat = /\bstrcat\s*\(/i;
  const cSprintf = /\bsprintf\s*\(/i;
  const cppConcat = /\+=\s*\w+/;
  const pythonFString = /f["'`].*{.*}.*["'`]/i;

  // Case 1: SQL + concatenation on same line
  if (sqlKeyword.test(line) && stringConcat.test(line)) {
    return line.match(sqlKeyword);
  }

  // Case 2: C-style string building (assume unsafe if strcat/sprintf used)
  if (cStrcat.test(line) || cSprintf.test(line) || cppConcat.test(line)) {
    return ["SQL_CONCAT_DETECTED"] as unknown as RegExpMatchArray;
  }

  // Case 3: Python f-string
  if (pythonFString.test(line)) {
    return ["SQL_FSTRING_DETECTED"] as unknown as RegExpMatchArray;
  }

  return null;
}
,
  remediation: "Use parameterized queries or prepared statements."
};