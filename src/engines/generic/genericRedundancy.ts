interface ExtractedFunction {
  name: string;
  startLine: number;
  body: string[];
}

/**
 * Normalize function body for comparison
 */
function normalizeBody(body: string[]): string {
  return body
    .map((line) =>
      line
        .replace(/\/\/.*$/g, "")     // remove C-style comments
        .replace(/#.*$/g, "")        // remove Python comments
        .trim()                     // remove indentation
    )
    .filter((line) => line !== "")  // remove empty lines
    .join("");
}

/**
 * Detect duplicate functions
 */
export function analyzeGenericRedundancy(
  functions: ExtractedFunction[]
) {
  const seen = new Map<string, ExtractedFunction>();
  const duplicates: any[] = [];

  for (const fn of functions) {
    const normalized = normalizeBody(fn.body);

    if (seen.has(normalized)) {
      const original = seen.get(normalized)!;

      duplicates.push({
        name: fn.name,
        line: fn.startLine,
        duplicateOf: original.name
      });
    } else {
      seen.set(normalized, fn);
    }
  }

  return duplicates;
}