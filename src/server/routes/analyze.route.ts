import { Router } from "express";
import multer from "multer";
import { handleAnalyze } from "../controllers/analyze.controller";

const router = Router();

const upload = multer({
  dest: "uploads/",
});

router.post("/", upload.single("file"), handleAnalyze);

export default router;