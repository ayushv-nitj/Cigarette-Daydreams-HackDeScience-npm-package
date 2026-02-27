// detection/formatter.ts — Auto-Formatting & Diff

export interface FormattingResult {
    formatted: string;
    diff: string;
    changesCount: number;
}

export function formatCode(code: string, language?: string): FormattingResult {
    const originalLines = code.split("\n");
    const formattedLines = originalLines.map(line =>
        line.replace(/\t/g, "  ").trimEnd()
    );

    // Collapse 3+ consecutive blank lines into 2
    const collapsed: string[] = [];
    let blankRun = 0;
    for (const l of formattedLines) {
        if (l.trim() === "") {
            blankRun++;
            if (blankRun <= 2) collapsed.push(l);
        } else {
            blankRun = 0;
            collapsed.push(l);
        }
    }

    const formatted = collapsed.join("\n");

    let changesCount = 0;
    const maxLen = Math.max(originalLines.length, collapsed.length);
    for (let i = 0; i < maxLen; i++) {
        if (originalLines[i] !== collapsed[i]) changesCount++;
    }

    const diffLines: string[] = ["--- original", "+++ formatted"];
    for (let i = 0; i < maxLen; i++) {
        const orig = originalLines[i];
        const fmt = collapsed[i];
        if (orig === undefined) {
            diffLines.push(`+${fmt}`);
        } else if (fmt === undefined) {
            diffLines.push(`-${orig}`);
        } else if (orig !== fmt) {
            diffLines.push(`-${orig}`);
            diffLines.push(`+${fmt}`);
        } else {
            diffLines.push(` ${orig}`);
        }
    }

    void language;
    return { formatted, diff: diffLines.join("\n"), changesCount };
}
