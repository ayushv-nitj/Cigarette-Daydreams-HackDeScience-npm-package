export interface GenericComplexity {
  name: string;
  line: number;
  cyclomaticComplexity: number;
  length: number;
  nestingDepth: number;
  warnings: string[];
}

export interface ExtractedFunction {
  name: string;
  startLine: number;
  body: string[];
}

/* ---------------- PYTHON ---------------- */

export function extractPythonFunctions(
  lines: string[]
): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const defMatch = lines[i].match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);

    if (!defMatch) continue;

    const name = defMatch[1];
    const startLine = i + 1;
    const body: string[] = [];

    const baseIndent =
      lines[i].match(/^(\s*)/)?.[1].length ?? 0;

    i++;

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim() === "") {
        i++;
        continue;
      }

      const indent =
        line.match(/^(\s*)/)?.[1].length ?? 0;

      if (indent <= baseIndent) break;

      body.push(line.trim());
      i++;
    }

    functions.push({ name, startLine, body });
    i--;
  }

  return functions;
}

/* ---------------- C / C++ / JAVA ---------------- */

export function extractCStyleFunctions(
  lines: string[]
): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /^[a-zA-Z0-9_<>\*\s]+\s+([a-zA-Z0-9_]+)\s*\(.*\)\s*\{/
    );

    if (!match) continue;

    const name = match[1];
    const startLine = i + 1;
    const body: string[] = [lines[i]];

    let braceDepth = 1;
    i++;

    while (i < lines.length && braceDepth > 0) {
      const line = lines[i];
      body.push(line);

      if (line.includes("{")) braceDepth++;
      if (line.includes("}")) braceDepth--;

      i++;
    }

    functions.push({ name, startLine, body });
    i--;
  }

  return functions;
}

/* ---------------- COMPLEXITY ---------------- */

function computeComplexity(block: string[]) {
  let complexity = 1;
  let nesting = 0;
  let maxNesting = 0;

  block.forEach((line) => {
    const trimmed = line.trim();

    if (
      trimmed.startsWith("if") ||
      trimmed.startsWith("for") ||
      trimmed.startsWith("while") ||
      trimmed.startsWith("switch") ||
      trimmed.includes(" case ") ||
      trimmed.includes("&&") ||
      trimmed.includes("||")
    ) {
      complexity++;
      nesting++;
      if (nesting > maxNesting) maxNesting = nesting;
    }

    if (trimmed.includes("}")) {
      nesting = Math.max(0, nesting - 1);
    }
  });

  return {
    cyclomaticComplexity: complexity,
    nestingDepth: maxNesting
  };
}

/* ---------------- MAIN ---------------- */

export function analyzeGenericComplexity(
  code: string,
  language: string
): GenericComplexity[] {

  const lines = code.split("\n");

  let functions: ExtractedFunction[] = [];

  if (language === "python") {
    functions = extractPythonFunctions(lines);
  } else {
    functions = extractCStyleFunctions(lines);
  }

  if (functions.length === 0) {
    return [
      {
        name: "global",
        line: 1,
        cyclomaticComplexity: 1,
        length: lines.length,
        nestingDepth: 0,
        warnings: []
      }
    ];
  }

  return functions.map((fn) => {
    const metrics = computeComplexity(fn.body);

    return {
      name: fn.name,
      line: fn.startLine,
      cyclomaticComplexity: metrics.cyclomaticComplexity,
      length: fn.body.length,
      nestingDepth: metrics.nestingDepth,
      warnings: []
    };
  });
}