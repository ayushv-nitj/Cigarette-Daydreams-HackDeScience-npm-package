import { Request, Response } from "express";
import fs from "fs";
import { analyzeService } from "../services/analyze.service";

export const handleAnalyze = async (req: Request, res: Response) => {
  try {
    let code = "";
    let filename = "unknown.js";

    // Case 1: User sends code snippet
    if (req.body.code) {
      code = req.body.code;
      filename = req.body.filename || "snippet.js";
    }

    // Case 2: User uploads file
    if (req.file) {
      code = fs.readFileSync(req.file.path, "utf-8");
      filename = req.file.originalname;
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "No code provided"
      });
    }

    const report = await analyzeService(code, filename);

    return res.json({
      success: true,
      report
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};