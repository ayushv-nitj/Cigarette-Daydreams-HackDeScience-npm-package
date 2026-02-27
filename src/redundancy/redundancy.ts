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
  return code.replace(/\s+/g, " ").trim();
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function analyzeRedundancy(code: string): RedundancyResult {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"]
  });

  const functionMap = new Map<string, { name: string; line: number }>();
  const duplicates: DuplicateFunction[] = [];

  traverse(ast, {
  FunctionDeclaration(path) {
    processFunction(path.node, path);
  },
  FunctionExpression(path) {
    processFunction(path.node, path);
  },
  ArrowFunctionExpression(path) {
    processFunction(path.node, path);
  }
});

function processFunction(node: any, path: any) {
  let rawFunction = "";

  if (
    node.body &&
    typeof node.body.start === "number" &&
    typeof node.body.end === "number"
  ) {
    rawFunction = code.slice(node.body.start, node.body.end);
  }

  const normalized = normalizeCode(rawFunction);
  const hash = hashCode(normalized);

  let name = "anonymous";

  if (node.id && node.id.name) {
    name = node.id.name;
  }

  if (
    path.parent &&
    path.parent.type === "VariableDeclarator" &&
    path.parent.id &&
    path.parent.id.name
  ) {
    name = path.parent.id.name;
  }

  const line = node.loc?.start.line ?? 0;

  if (functionMap.has(hash)) {
    const original = functionMap.get(hash)!;

    // Prevent self-duplicate
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

// --------- INTELLIGENT BLOCK SEQUENCE DETECTION ---------

const MIN_SEQUENCE = 3;

const allBlocks: {
  line: number;
  statements: string[];
}[] = [];

traverse(ast, {
  BlockStatement(path) {
    const statements = path.node.body;

    const normalizedStatements = statements.map((stmt: any) => {
      if (
        typeof stmt.start === "number" &&
        typeof stmt.end === "number"
      ) {
        const raw = code.slice(stmt.start, stmt.end);
        return normalizeCode(raw);
      }
      return "";
    });

    const startLine = path.node.loc?.start.line ?? 0;

    allBlocks.push({
      line: startLine,
      statements: normalizedStatements
    });
  }
});

// Compare every pair of blocks
for (let i = 0; i < allBlocks.length; i++) {
  for (let j = i + 1; j < allBlocks.length; j++) {
    const blockA = allBlocks[i];
    const blockB = allBlocks[j];

    const lenA = blockA.statements.length;
    const lenB = blockB.statements.length;

    for (let a = 0; a < lenA; a++) {
      for (let b = 0; b < lenB; b++) {
        let matchLength = 0;

        while (
          a + matchLength < lenA &&
          b + matchLength < lenB &&
          blockA.statements[a + matchLength] ===
            blockB.statements[b + matchLength]
        ) {
          matchLength++;
        }

        if (matchLength >= MIN_SEQUENCE) {
          const lineA = blockA.line + a;
          const lineB = blockB.line + b;

          duplicates.push({
            name: `Repeated block starting line ${lineB}`,
            line: lineB,
            duplicateOf: `Block starting line ${lineA}`
          });

          // Skip ahead to avoid overlapping matches
          a += matchLength - 1;
          break;
        }
      }
    }
  }
}
  return { duplicates };
}