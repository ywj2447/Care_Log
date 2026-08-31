import { generateCareLog } from "./_lib/geminiService.js";

export default async function handler(req: any, res: any) {
  // Ensure response is always JSON with proper headers
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }

  if (req.method !== "POST") {
    if (typeof res.status === "function") {
      return res.status(405).json({
        error: "Method not allowed. Only POST requests are accepted."
      });
    }
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed. Only POST requests are accepted." }));
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      if (typeof res.status === "function") {
        return res.status(400).json({ error: "올바르지 않은 JSON 요청 형식입니다." });
      }
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "올바르지 않은 JSON 요청 형식입니다." }));
      return;
    }
  }

  if (!body || typeof body !== "object") {
    if (typeof res.status === "function") {
      return res.status(400).json({ error: "요청 본문(Body) 데이터가 필요합니다." });
    }
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "요청 본문(Body) 데이터가 필요합니다." }));
    return;
  }

  const headerApiKey = (req.headers?.["x-api-key"] || req.headers?.["X-API-KEY"]) as string | undefined;

  try {
    const result = await generateCareLog({
      body,
      headerApiKey,
    });

    const statusCode = result.success ? 200 : (result.status || 500);
    const responsePayload = result.success 
      ? { result: result.result } 
      : { error: result.error };

    if (typeof res.status === "function") {
      return res.status(statusCode).json(responsePayload);
    }
    res.statusCode = statusCode;
    res.end(JSON.stringify(responsePayload));
  } catch (err: any) {
    console.error("Vercel Serverless Function Error:", err);
    if (typeof res.status === "function") {
      return res.status(500).json({
        error: "서버리스 함수 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주십시오."
      });
    }
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: "서버리스 함수 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주십시오."
    }));
  }
}
