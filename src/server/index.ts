import express from "express";
import cors from "cors";
import analyzeRoute from "./routes/analyze.route";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/api/analyze", analyzeRoute);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});