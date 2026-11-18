// AI 代理端点：Groq 免费层模型（成本 0，卖 $0.002 → 全利润）
// 输入 ≤ 2000 字符、输出 max_tokens 512；429 限流时明确报错不扣费
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_INPUT_CHARS = 2000;
const MAX_OUTPUT_TOKENS = 512;
const MODELS = {
  "gpt-oss-20b": "openai/gpt-oss-20b",
  "allam-2-7b": "allam-2-7b",
  "qwen-3.8": "qwen/qwen3.8-27b",
};

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18));
  const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

const P = (name, desc, required = true) => ({ name, in: "query", required, schema: { type: "string" }, description: desc });

export const AI_ENDPOINTS = [
  {
    path: "/ai/chat",
    usd: 0.002,
    summary: "LLM chat completion (Groq free-tier models: gpt-oss-20b, allam-2-7b, qwen-3.8). Output capped at 512 tokens, input at 2000 chars.",
    params: [
      P("prompt", "Prompt text, max 2000 chars"),
      P("system", "Optional system prompt, max 500 chars", false),
      P("model", "gpt-oss-20b | allam-2-7b | qwen-3.8 (default gpt-oss-20b)", false),
    ],
    handler: async (req, res) => {
      const key = process.env.GROQ_API_KEY;
      if (!key) return res.status(503).json({ error: "model_unavailable", message: "GROQ_API_KEY not configured" });
      const prompt = String(req.query.prompt || "");
      const system = String(req.query.system || "");
      const modelKey = String(req.query.model || "gpt-oss-20b");
      const model = MODELS[modelKey];
      if (!prompt) return res.status(400).json({ error: "empty_prompt" });
      if (prompt.length > MAX_INPUT_CHARS) return res.status(400).json({ error: "prompt_too_long", limit: MAX_INPUT_CHARS });
      if (system.length > 500) return res.status(400).json({ error: "system_too_long", limit: 500 });
      if (!model) return res.status(400).json({ error: "bad_model", allowed: Object.keys(MODELS) });

      const messages = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });

      const r = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + key },
        body: JSON.stringify({ model, messages, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.7, stream: false }),
        signal: AbortSignal.timeout(60000),
      });
      if (r.status === 429) return res.status(429).json({ error: "rate_limited", message: "free-tier rate limit reached, retry later", charged: false });
      const j = await r.json().catch(() => null);
      if (!r.ok) return res.status(502).json({ error: "upstream_failed", status: r.status, detail: j?.error?.message || null });
      res.json({
        model: j?.model || model,
        content: j?.choices?.[0]?.message?.content ?? null,
        usage: j?.usage || null,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        asOf: new Date().toISOString(),
      });
    },
  },
  {
    path: "/ai/models",
    usd: 0.001,
    summary: "List models and pricing for this AI proxy",
    handler: async (_req, res) => {
      res.json({
        models: Object.keys(MODELS),
        pricing: { perCall: "$0.002", note: "output capped at 512 tokens, input at 2000 chars" },
        asOf: new Date().toISOString(),
      });
    },
  },
];

export const AI_ROUTES = Object.fromEntries(
  AI_ENDPOINTS.map((ep) => ["GET " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);

export const AI_PATHS = Object.fromEntries(
  AI_ENDPOINTS.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params || [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id" }],
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
