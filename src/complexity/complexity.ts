import { parse } from "@babel/parser";
import traverse from "@babel/traverse";

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
    plugins: ["typescript", "jsx"]
  });

  const functions: FunctionComplexity[] = [];

  traverse(ast, {
    Function(path) {
      const node = path.node;

      let name = "anonymous";

if ((node as any).id && (node as any).id.name) {
  name = (node as any).id.name;
} else if (
  path.parentPath &&
  path.parentPath.node.type === "VariableDeclarator" &&
  (path.parentPath.node as any).id &&
  (path.parentPath.node as any).id.name
) {
  name = (path.parentPath.node as any).id.name;
}

      const startLine = node.loc?.start.line || 0;
      const endLine = node.loc?.end.line || 0;
      const length = endLine - startLine + 1;

      let complexity = 1; // base complexity
      let maxNesting = 0;

     let currentNesting = 0;

path.traverse({
  enter(innerPath) {
    const controlTypes = [
      "IfStatement",
      "ForStatement",
      "WhileStatement",
      "DoWhileStatement",
      "SwitchStatement",
      "CatchClause"
    ];

    if (controlTypes.includes(innerPath.node.type)) {
      currentNesting++;
      if (currentNesting > maxNesting) {
        maxNesting = currentNesting;
      }
      complexity++;
    }

    if (
      innerPath.node.type === "LogicalExpression" &&
      (innerPath.node.operator === "&&" ||
        innerPath.node.operator === "||")
    ) {
      complexity++;
    }
  },
  exit(innerPath) {
    const controlTypes = [
      "IfStatement",
      "ForStatement",
      "WhileStatement",
      "DoWhileStatement",
      "SwitchStatement",
      "CatchClause"
    ];

    if (controlTypes.includes(innerPath.node.type)) {
      currentNesting--;
    }
  }
});

      const warnings: string[] = [];

      if (complexity > 10) {
        warnings.push("High cyclomatic complexity (>10)");
      }

      if (length > 50) {
        warnings.push("Function too long (>50 lines)");
      }

      if (maxNesting > 20) {
        warnings.push("Deep nesting detected");
      }

      functions.push({
        name,
        line: startLine,
        cyclomaticComplexity: complexity,
        length,
        nestingDepth: maxNesting,
        warnings
      });
    }
  });

  return { functions };
}