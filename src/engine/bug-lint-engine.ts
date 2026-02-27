// engine/bug-lint-engine.ts — Unified Bug & Lint engine
//
// Single entry point: runBugLintEngine(code, language)
// Combines two complementary layers:
//   Layer A — AST (Babel/traverse, JS/TS only):
//     1. Incorrect type coercions  (== / !=)
//     2. Unreachable code          (statements after return/throw/break)
//     3. Unused variables          (two-pass: declare → reference)
//     4. Shadowed declarations     (ScopeStack: warn if name re-declared in child scope)
//     5. Null dereference risk     (VariableStateTracker: var = null then .prop access)
//     6. Naming convention violations (camelCase / PascalCase / UPPER_CASE)
//   Layer B — Regex (bug-lint.ts rules, all languages):
//     7. Off-by-one (<= .length)
//     8. parseInt without radix
//     9. SCREAMING_CASE non-constant variable
//    10. Function called with literal null argument

import type { CodeIssue } from "../detection/types";
import { bugLintRules } from "../detection/rules/bug-lint";

// ── Babel imports (CommonJS compat)  ────
/* eslint-disable @typescript-eslint/no-require-imports */
const babelParser = require("@babel/parser") as typeof import("@babel/parser");
const traverse = (require("@babel/traverse").default ?? require("@babel/traverse")) as typeof import("@babel/traverse").default;
/* eslint-enable @typescript-eslint/no-require-imports */

// ── Naming convention regexes  ─────
const NAMING = {
    camelCase: /^[a-z][a-zA-Z0-9]*$/,
    UPPER_CASE: /^[A-Z][A-Z0-9_]*$/,
    PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
};

let _uid = 0;
const uid = (prefix: string) => `ast-${prefix}-${++_uid}`;

class VariableStateTracker {
    private nullable = new Map<string, boolean>();

    markNullable(name: string) { this.nullable.set(name, true); }
    markAssigned(name: string) { this.nullable.delete(name); }
    isNullable(name: string) { return this.nullable.get(name) ?? false; }
}

class ScopeStack {
    private stack: Set<string>[] = [new Set()];

    push() { this.stack.push(new Set()); }
    pop() { this.stack.pop(); }

    /** Returns true if the name exists in ANY parent scope (shadow check). */
    existsInParent(name: string): boolean {
        for (let i = 0; i < this.stack.length - 1; i++) {
            if (this.stack[i].has(name)) return true;
        }
        return false;
    }

    /** Declare in current (innermost) scope. */
    declare(name: string) {
        this.stack[this.stack.length - 1].add(name);
    }
}


export function runBugLintEngine(code: string, language: string): CodeIssue[] {
    //AST analysis on JS/TS
    if (language !== "javascript" && language !== "typescript") return [];

    const issues: CodeIssue[] = [];
    let ast: ReturnType<typeof babelParser.parse>;

    try {
        ast = babelParser.parse(code, {
            sourceType: "module",
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
            errorRecovery: true,
            plugins: language === "typescript"
                ? ["typescript", "jsx", "decorators-legacy", "classProperties"]
                : ["jsx", "decorators-legacy", "classProperties"],
        });
    } catch {
        // Unparseable — fall back silently
        return [];
    }

    const nullTracker = new VariableStateTracker();
    const scopeStack = new ScopeStack();

    // Two-pass for unused variables
    const declared = new Map<string, number>(); // name → line
    const referenced = new Set<string>();

    traverse(ast, {

        BlockStatement: {
            enter() { scopeStack.push(); },
            exit() { scopeStack.pop(); },
        },
        Function: {
            enter() { scopeStack.push(); },
            exit() { scopeStack.pop(); },
        },

        BinaryExpression(path) {
            const { operator, loc } = path.node;
            if (operator === "==" || operator === "!=") {
                const ln = loc?.start.line;
                issues.push({
                    id: uid("coerce"),
                    category: "bug",
                    severity: "warning",
                    message: `Use '${operator}=' instead of '${operator}' to avoid type coercion bugs.`,
                    line: ln,
                    suggestion: `Replace '${operator}' with '${operator}='`,
                });
            }
        },

        ReturnStatement(path) { checkUnreachable(path as import("@babel/traverse").NodePath, issues); },
        ThrowStatement(path) { checkUnreachable(path as import("@babel/traverse").NodePath, issues); },
        BreakStatement(path) { checkUnreachable(path as import("@babel/traverse").NodePath, issues); },
        ContinueStatement(path) { checkUnreachable(path as import("@babel/traverse").NodePath, issues); },

        // Unused variables (pass 1: declare) 
        VariableDeclarator(path) {
            const id = path.node.id;
            if (id.type === "Identifier") {
                declared.set(id.name, id.loc?.start.line ?? 0);

                // Shadowed declarations 
                if (scopeStack.existsInParent(id.name)) {
                    issues.push({
                        id: uid("shadow"),
                        category: "bug",
                        severity: "warning",
                        message: `Variable '${id.name}' shadows a declaration in an outer scope.`,
                        line: id.loc?.start.line,
                        suggestion: `Rename '${id.name}' to avoid shadowing.`,
                    });
                }
                scopeStack.declare(id.name);

                // ── 5. Null dereference tracking 
                const init = path.node.init;
                if (init && (init.type === "NullLiteral" || (init.type === "Identifier" && init.name === "undefined"))) {
                    nullTracker.markNullable(id.name);
                }

                // ── 6. Naming conventions 
                const parent = path.parent;
                const isConst = parent.type === "VariableDeclaration" && parent.kind === "const";
                if (isConst && id.name.length > 1 && !NAMING.UPPER_CASE.test(id.name) && !NAMING.camelCase.test(id.name)) {
                    issues.push({
                        id: uid("name-const"),
                        category: "style",
                        severity: "info",
                        message: `Constant '${id.name}' should use UPPER_CASE or camelCase rather than mixed/other casing.`,
                        line: id.loc?.start.line,
                        suggestion: "Use UPPER_CASE for true constants, camelCase for computed values.",
                    });
                }
                if (!isConst && id.name.length > 1 && !NAMING.camelCase.test(id.name) && !NAMING.UPPER_CASE.test(id.name)) {
                    issues.push({
                        id: uid("name-var"),
                        category: "style",
                        severity: "info",
                        message: `Variable '${id.name}' should use camelCase.`,
                        line: id.loc?.start.line,
                        suggestion: "Rename to camelCase.",
                    });
                }
            }
        },

        // ── 3. Unused variables (pass 2: references) 
        Identifier(path) {
            // Count as referenced unless this IS the declarator LHS
            if (path.parent.type !== "VariableDeclarator" || path.parent.id !== path.node) {
                referenced.add(path.node.name);
            }
        },

        // ── 5. Null dereference: member access on nullable var 
        MemberExpression(path) {
            const obj = path.node.object;
            if (obj.type === "Identifier" && nullTracker.isNullable(obj.name)) {
                issues.push({
                    id: uid("null-deref"),
                    category: "bug",
                    severity: "warning",
                    message: `Possible null dereference: '${obj.name}' may be null/undefined when accessing '.${path.node.property.type === "Identifier" ? path.node.property.name : "?"
                        }'.`,
                    line: obj.loc?.start.line,
                    suggestion: `Guard with optional chaining: '${obj.name}?.${path.node.property.type === "Identifier" ? path.node.property.name : "prop"
                        }'`,
                });
            }
        },

        // ── Variable assignment (tracks null reset) 
        AssignmentExpression(path) {
            const left = path.node.left;
            if (left.type === "Identifier") {
                const right = path.node.right;
                if (right.type === "NullLiteral" || (right.type === "Identifier" && right.name === "undefined")) {
                    nullTracker.markNullable(left.name);
                } else {
                    nullTracker.markAssigned(left.name);
                }
            }
        },

        // class declarations: PascalCase check 
        ClassDeclaration(path) {
            const name = path.node.id?.name;
            const ln = path.node.id?.loc?.start.line;
            if (name && !NAMING.PascalCase.test(name)) {
                issues.push({
                    id: uid("name-class"),
                    category: "style",
                    severity: "warning",
                    message: `Class '${name}' should use PascalCase.`,
                    line: ln,
                    suggestion: `Rename '${name}' to PascalCase.`,
                });
            }
        },
    });

    //post-traverse: report unused variables 
    for (const [name, line] of declared.entries()) {
        if (!referenced.has(name) && !name.startsWith("_")) {
            issues.push({
                id: uid("unused"),
                category: "bug",
                severity: "warning",
                message: `Variable '${name}' is declared but never used.`,
                line: line || undefined,
                suggestion: `Remove '${name}' or prefix with '_' to suppress this warning.`,
            });
        }
    }

    // ── Layer B: regex-based rules (all languages, fast) ────────────────────
    // Complements the AST layer with cross-language pattern checks.
    const regexIssues = bugLintRules(code, language);

    return [...issues, ...regexIssues];
}

// helper for unreachable
function checkUnreachable(
    path: import("@babel/traverse").NodePath,
    issues: CodeIssue[]
): void {
    const parent = path.parent;
    if (parent.type !== "BlockStatement" && parent.type !== "Program") return;

    const siblings = (parent as { body: import("@babel/types").Statement[] }).body;
    const idx = siblings.indexOf(path.node as import("@babel/types").Statement);
    if (idx === -1 || idx === siblings.length - 1) return;

    const next = siblings[idx + 1];
    const ln = (next as { loc?: { start: { line: number } } }).loc?.start.line;
    issues.push({
        id: uid("unreachable"),
        category: "bug",
        severity: "warning",
        message: `Unreachable code — statements after '${path.node.type.replace("Statement", "").toLowerCase()}' are never executed.`,
        line: ln,
        suggestion: "Remove or relocate the unreachable statements.",
    });
}
