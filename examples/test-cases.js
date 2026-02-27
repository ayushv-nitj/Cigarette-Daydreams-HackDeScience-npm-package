// test-cases.js — Canonical test file for the code analysis pipeline
// Contains all known bug/lint/security/complexity/redundancy patterns.
// Used as:
//   node examples/analyze.js examples/test-cases.js          ← full report
//   node examples/run-tests.js                               ← structured JSON per issue

// ── 1. Null Dereference ───────────────────────────────────────────────────────
// Expected: bug/warning — null passed to function that dereferences it
function printName(user) {
    return user.name.toUpperCase();
}
printName(null);

// ── 2. Off-by-One Error ───────────────────────────────────────────────────────
// Expected: bug/warning — i <= arr.length goes out of bounds
function printArray(arr) {
    for (let i = 0; i <= arr.length; i++) {
        console.log(arr[i]);
    }
}

// ── 3. Unreachable Code ───────────────────────────────────────────────────────
// Expected: bug/warning — console.log after return is never executed
function test() {
    return 5;
    console.log("This will never run");
}

// ── 4. Unused Variable ────────────────────────────────────────────────────────
// Expected: bug/warning — result declared but never used
function calculate() {
    let result = 10;
    return 5;
}

// ── 5. Shadowed Declaration ───────────────────────────────────────────────────
// Expected: bug/warning — inner count shadows outer count
let count = 10;
function update() {
    let count = 5;
    console.log(count);
}

// ── 6. Loose Equality (== instead of ===) ────────────────────────────────────
// Expected: bug/warning — use === to avoid type coercion
if ("5" == 5) {
    console.log("Loose equality");
}

// ── 7. Naming Convention Violation ───────────────────────────────────────────
// Expected: style/info — user_name violates camelCase convention
let user_name = "John";
console.log(user_name);

// ── 8. Multiple Issues (stress test) ─────────────────────────────────────────
// Expected: unused var + off-by-one + loose equality + unreachable code
function testMultiple(arr) {
    let unusedVar = 5;
    for (let i = 0; i <= arr.length; i++) {
        if ("5" == 5) {
            return arr[i];
            console.log("dead");
        }
    }
}

// ── 9. Clean Code (no issues) ─────────────────────────────────────────────────
// Expected: 0 issues — score stays at 100%
function sum(arr) {
    let total = 0;
    for (let i = 0; i < arr.length; i++) {
        total += arr[i];
    }
    return total;
}

// ── 10. Deep Nesting (>3 levels) ─────────────────────────────────────────────
// Expected: complexity/warning — nesting depth exceeds threshold
function deep(x) {
    if (x > 0) {
        if (x > 1) {
            if (x > 2) {
                if (x > 3) {
                    console.log("Too deep");
                }
            }
        }
    }
}

// ── 11. Long Function (>50 lines) ────────────────────────────────────────────
// Expected: complexity/warning — function body exceeds 50 lines
function longFunction() {
    console.log(1); console.log(2); console.log(3); console.log(4); console.log(5);
    console.log(6); console.log(7); console.log(8); console.log(9); console.log(10);
    console.log(11); console.log(12); console.log(13); console.log(14); console.log(15);
    console.log(16); console.log(17); console.log(18); console.log(19); console.log(20);
    console.log(21); console.log(22); console.log(23); console.log(24); console.log(25);
    console.log(26); console.log(27); console.log(28); console.log(29); console.log(30);
    console.log(31); console.log(32); console.log(33); console.log(34); console.log(35);
    console.log(36); console.log(37); console.log(38); console.log(39); console.log(40);
    console.log(41); console.log(42); console.log(43); console.log(44); console.log(45);
    console.log(46); console.log(47); console.log(48); console.log(49); console.log(50);
    console.log(51); console.log(52); console.log(53);
}

// ── 12. SQL Injection (security) ─────────────────────────────────────────────
// Expected: security/error — SQL_INJECTION: string concatenation with SQL keyword
function getUser(userId) {
    const query = "SELECT * FROM users WHERE id = " + userId;
    return query;
}

// ── 13. Hardcoded Secret (security) ──────────────────────────────────────────
// Expected: security/error — HARDCODED_SECRET: API key in source code
const api_key = "sk_live_abcdef1234567890XYZ";

// ── 14. Command Injection (security) ─────────────────────────────────────────
// Expected: security/error — COMMAND_INJECTION: exec with string concat
function runCmd(userInput) {
    exec("ls " + userInput);
}

// ── 15. XSS (security) ───────────────────────────────────────────────────────
// Expected: security/warning — XSS: innerHTML with user data
function renderContent(data) {
    document.getElementById("app").innerHTML = data;
}

// ── 16. Redundant Function Bodies ────────────────────────────────────────────
// Expected: redundancy — duplicateBlockA and duplicateBlockB are identical
function duplicateBlockA(x) {
    let s = 0;
    for (let i = 0; i < x.length; i++) { s += x[i]; }
    return s;
}
function duplicateBlockB(y) {
    let s = 0;
    for (let i = 0; i < y.length; i++) { s += y[i]; }
    return s;
}
