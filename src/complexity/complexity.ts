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

export function analyzeComplexity(code: string): ComplexityResult {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  const functions: FunctionComplexity[] = [];

  traverse(ast, {
    Function(path: NodePath<t.Function>) {
      const node = path.node;

      let name = "anonymous";

      // FunctionDeclaration name
      if (t.isFunctionDeclaration(node) && node.id?.name) {
        name = node.id.name;
      }

      // VariableDeclarator (arrow function / function expression)
      else if (
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

      const warnings: string[] = [];

      if (complexity > 10) {
        warnings.push("High cyclomatic complexity (>10)");
      }

      if (length > 50) {
        warnings.push("Function too long (>50 lines)");
      }

      if (maxNesting > 5) {
        warnings.push("Deep nesting detected (>5)");
      }

      functions.push({
        name,
        line: startLine,
        cyclomaticComplexity: complexity,
        length,
        nestingDepth: maxNesting,
        warnings,
      });
    },
  });

  return { functions };
}