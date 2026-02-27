export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "c"
  | "cpp"
  | "java"
  | "unknown";

/**
 * Detect language based on file extension.
 */
export function detectLanguage(filePath?: string): {
  language: SupportedLanguage;
  confidence: number;
} {
  if (!filePath) {
    return { language: "unknown", confidence: 0 };
  }

  if (filePath.endsWith(".js"))
    return { language: "javascript", confidence: 0.95 };

  if (filePath.endsWith(".ts"))
    return { language: "typescript", confidence: 0.95 };

  if (filePath.endsWith(".py"))
    return { language: "python", confidence: 0.95 };

  if (filePath.endsWith(".c"))
    return { language: "c", confidence: 0.95 };

  if (filePath.endsWith(".cpp") || filePath.endsWith(".cc"))
    return { language: "cpp", confidence: 0.95 };

  if (filePath.endsWith(".java"))
    return { language: "java", confidence: 0.95 };

  return { language: "unknown", confidence: 0.5 };
}