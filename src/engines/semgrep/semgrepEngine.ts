import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

interface SemgrepResult {
  results: any[];
}

export interface SemgrepAnalysis {
  complexity: any[];
  redundancy: any[];
  warning?: string;
}

/**
 * Check if Semgrep is available in system.
 */
function isSemgrepAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    exec("semgrep --version", (error) => {
      if (error) resolve(false);
      else resolve(true);
    });
  });
}
// function isSemgrepAvailable(): Promise<boolean> {
//   return Promise.resolve(false);
// }

/**
 * Analyze non-JS languages using Semgrep
 */
export async function analyzeWithSemgrep(
  code: string,
  fileExtension: string
): Promise<SemgrepAnalysis> {

  const semgrepExists = await isSemgrepAvailable();

  if (!semgrepExists) {
    return {
      complexity: [],
      redundancy: [
        {
          name: "Semgrep not installed",
          line: 0,
          duplicateOf: "Install Semgrep to enable redundancy analysis"
        }
      ],
      warning: "Semgrep is not installed on this system."
    };
  }

  return new Promise((resolve, reject) => {

    const tempFilePath = path.join(
      os.tmpdir(),
      `temp_analysis_${Date.now()}.${fileExtension}`
    );

    fs.writeFileSync(tempFilePath, code);

    const command = `semgrep --config auto --json ${tempFilePath}`;

    exec(
      command,
      {
        env: {
          ...process.env,
          PYTHONUTF8: "1",
          LANG: "en_US.UTF-8"
        }
      },
      (error, stdout, stderr) => {

        if (error && !stdout) {
          return resolve({
            complexity: [],
            redundancy: [
              {
                name: "Semgrep execution failed",
                line: 0,
                duplicateOf: stderr || error.message
              }
            ]
          });
        }

        try {
          const parsed: SemgrepResult = JSON.parse(stdout);

          const redundancy: any[] = [];

          for (const result of parsed.results || []) {
            redundancy.push({
              name: result.check_id,
              line: result.start?.line || 0,
              duplicateOf: result.path || "unknown"
            });
          }

          fs.unlinkSync(tempFilePath);

          resolve({
            complexity: [],
            redundancy
          });

        } catch (err: any) {
          resolve({
            complexity: [],
            redundancy: [
              {
                name: "Semgrep parse error",
                line: 0,
                duplicateOf: err.message
              }
            ]
          });
        }
      }
    );
  });
}