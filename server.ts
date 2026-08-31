import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { generateCareLog } from "./api/_lib/geminiService.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

app.post("/api/generate", async (req, res) => {
  const headerApiKey = req.headers["x-api-key"] as string | undefined;

  try {
    const result = await generateCareLog({
      body: req.body,
      headerApiKey,
    });

    if (result.success) {
      res.status(200).json({ result: result.result });
    } else {
      res.status(result.status || 500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error("Express API Error:", error);
    res.status(500).json({ error: "기록 생성 중 일시적인 서버 오류가 발생했습니다. 다시 시도해 주십시오." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
