import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import crypto from "crypto";

export interface DuplicateFunction {
  name: string;
  line: number;
  duplicateOf: string;
}

export interface RedundancyResult {
  duplicates: DuplicateFunction[];
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, "").trim();
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function analyzeRedundancy(
  code: string,
  language?: string
): RedundancyResult {

  // ---------- JS / TS ----------
  if (language === "javascript" || language === "typescript") {

    const ast = parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"]
    });

    const functionMap = new Map<string, { name: string; line: number }>();
    const duplicates: DuplicateFunction[] = [];

    traverse(ast, {
      Function(path) {
        const node = path.node;

        if (!node.body?.start || !node.body?.end) return;

        const rawFunction =
          code.slice(node.body.start, node.body.end);

        const normalized = normalizeCode(rawFunction);
        const hash = hashCode(normalized);

        let name = "anonymous";
        if ((node as any).id?.name) name = (node as any).id.name;

        const line = node.loc?.start.line ?? 0;

        if (functionMap.has(hash)) {
          const original = functionMap.get(hash)!;
          if (original.name !== name) {
            duplicates.push({
              name,
              line,
              duplicateOf: original.name
            });
          }
        } else {
          functionMap.set(hash, { name, line });
        }
      }
    });

    return { duplicates };
  }

 // ---------- GENERIC (Python + C/C++/Java) ----------

const lines = code.split("\n");
const functionMap = new Map<string, { name: string; line: number }>();
const duplicates: DuplicateFunction[] = [];

for (let i = 0; i < lines.length; i++) {

  // -------- Python --------
  if (language === "python") {
    const match = lines[i].match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
    if (!match) continue;

    const name = match[1];
    const startLine = i + 1;
    const body: string[] = [];

    const baseIndent =
      lines[i].match(/^(\s*)/)?.[1].length ?? 0;

    i++;

    while (i < lines.length) {
      const current = lines[i];

      if (current.trim() === "") {
        i++;
        continue;
      }

      const indent =
        current.match(/^(\s*)/)?.[1].length ?? 0;

      if (indent <= baseIndent) break;

      body.push(current.trim());
      i++;
    }

    const normalized = normalizeCode(body.join(""));
    const hash = hashCode(normalized);

    if (functionMap.has(hash)) {
      const original = functionMap.get(hash)!;
      if (original.name !== name) {
        duplicates.push({
          name,
          line: startLine,
          duplicateOf: original.name
        });
      }
    } else {
      functionMap.set(hash, { name, line: startLine });
    }

    i--;
    continue;
  }

  // -------- C / C++ / Java --------
const match = lines[i].match(
  /^[a-zA-Z0-9_<>\*\s]+\s+([a-zA-Z0-9_]+)\s*\(.*\)\s*\{/
);
if (!match) continue;

const name = match[1];
const startLine = i + 1;

let braceDepth = 1;
let bodyLines: string[] = [];

i++;

while (i < lines.length && braceDepth > 0) {
  const current = lines[i];

  if (current.includes("{")) braceDepth++;
  if (current.includes("}")) braceDepth--;

  // Only store actual body lines, not closing brace
  if (braceDepth > 0) {
    bodyLines.push(current.trim());
  }

  i++;
}

const normalized = normalizeCode(bodyLines.join(""));
const hash = hashCode(normalized);

if (functionMap.has(hash)) {
  const original = functionMap.get(hash)!;
  if (original.name !== name) {
    duplicates.push({
      name,
      line: startLine,
      duplicateOf: original.name
    });
  }
} else {
  functionMap.set(hash, { name, line: startLine });
}

    i--;
  }

  return { duplicates };
}