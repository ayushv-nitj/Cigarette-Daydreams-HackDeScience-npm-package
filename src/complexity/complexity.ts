import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export interface FunctionComplexity {
  name: string;
  line: number;
  cyclomaticComplexity: number;
  length: number;
  nestingDepth: number;
  warnings: string[];
}

export interface ComplexityResult {
  functions: FunctionComplexity[];
}

/* ---------- GENERIC FUNCTION EXTRACTION ---------- */

function extractGenericFunctions(
  code: string,
  language?: string
) {
  const lines = code.split("\n");
  const functions: {
    name: string;
    startLine: number;
    body: string[];
  }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Python
    if (language === "python") {
      const match = line.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
      if (!match) continue;

      const name = match[1];
      const startLine = i + 1;
      const body: string[] = [];
      const baseIndent =
        line.match(/^(\s*)/)?.[1].length ?? 0;

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

      functions.push({ name, startLine, body });
      i--;
    }

    // C / C++ / Java
    else {
      const match = line.match(
        /^[a-zA-Z0-9_<>\*\s]+\s+([a-zA-Z0-9_]+)\s*\(.*\)\s*\{/
      );
      if (!match) continue;

      const name = match[1];
      const startLine = i + 1;
      const body: string[] = [line];
      let braceDepth = 1;
      i++;

      while (i < lines.length && braceDepth > 0) {
        const current = lines[i];
        body.push(current);

        if (current.includes("{")) braceDepth++;
        if (current.includes("}")) braceDepth--;
        i++;
      }

      functions.push({ name, startLine, body });
      i--;
    }
  }

  return functions;
}

function computeGenericComplexity(body: string[]) {
  let complexity = 1;
  let nesting = 0;
  let maxNesting = 0;

  const controlRegex = /\b(if|elif|else if|for|while|switch|case|catch|except|try)\b/;
  const logicalRegex = /(&&|\|\|)/;

  body.forEach((line) => {
    const trimmed = line.trim();

    // Cyclomatic increment
    if (controlRegex.test(trimmed)) {
      complexity++;
      nesting++;
      maxNesting = Math.max(maxNesting, nesting);
    }

    if (logicalRegex.test(trimmed)) {
      const matches = trimmed.match(logicalRegex);
      if (matches) complexity += matches.length;
    }

    // Python block end via indentation drop handled externally
    // C/Java block end via brace
    if (trimmed.includes("}")) {
      nesting = Math.max(0, nesting - 1);
    }
  });

  return { complexity, maxNesting };
}

/* ---------- MAIN ---------- */

export function analyzeComplexity(
  code: string,
  language?: string
): ComplexityResult {

  if (language === "javascript" || language === "typescript") {
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });

    const functions: FunctionComplexity[] = [];

    traverse(ast, {
      Function(path: NodePath<t.Function>) {
        const node = path.node;

        let name = "anonymous";

        if (t.isFunctionDeclaration(node) && node.id?.name) {
          name = node.id.name;
        } else if (
          path.parentPath &&
          t.isVariableDeclarator(path.parentPath.node) &&
          t.isIdentifier(path.parentPath.node.id)
        ) {
          name = path.parentPath.node.id.name;
        }

        const startLine = node.loc?.start.line ?? 0;
        const endLine = node.loc?.end.line ?? 0;
        const length = endLine - startLine + 1;

        let complexity = 1;
        let maxNesting = 0;
        let currentNesting = 0;

        const controlTypes = new Set([
          "IfStatement",
          "ForStatement",
          "WhileStatement",
          "DoWhileStatement",
          "SwitchStatement",
          "CatchClause",
        ]);

        path.traverse({
          enter(innerPath: NodePath) {
            if (controlTypes.has(innerPath.node.type)) {
              currentNesting++;
              maxNesting = Math.max(maxNesting, currentNesting);
              complexity++;
            }

            if (
              t.isLogicalExpression(innerPath.node) &&
              (innerPath.node.operator === "&&" ||
                innerPath.node.operator === "||")
            ) {
              complexity++;
            }
          },
          exit(innerPath: NodePath) {
            if (controlTypes.has(innerPath.node.type)) {
              currentNesting--;
            }
          },
        });

        functions.push({
          name,
          line: startLine,
          cyclomaticComplexity: complexity,
          length,
          nestingDepth: maxNesting,
          warnings: [],
        });
      },
    });

    return { functions };
  }

  // ---------- GENERIC LANGUAGES ----------
  const genericFunctions =
    extractGenericFunctions(code, language);

  const result: FunctionComplexity[] =
    genericFunctions.map((fn) => {
      const metrics =
        computeGenericComplexity(fn.body);

      return {
        name: fn.name,
        line: fn.startLine,
        cyclomaticComplexity: metrics.complexity,
        length: fn.body.length,
        nestingDepth: metrics.maxNesting,
        warnings: [],
      };
    });

  return { functions: result };
}