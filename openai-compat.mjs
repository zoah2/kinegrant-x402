// OpenAI 兼容端点（BlockRun 模式）：/v1/chat/completions + /v1/models
// 后端 Groq 免费层，成本 0；输入 ≤ 4000 字符、max_tokens ≤ 512
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_TOTAL_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 512;

export const MODEL_MAP = {
  // OpenAI-ish aliases → Groq ids
  "gpt-4o-mini": "openai/gpt-oss-20b",
  "gpt-4o": "openai/gpt-oss-120b",
  "gpt-oss-20b": "openai/gpt-oss-20b",
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "qwen3": "qwen/qwen3.8-27b",
  "allam-2-7b": "allam-2-7b",
};

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18));
  const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

export const OPENAI_ROUTES = {
  "POST /v1/chat/completions": {
    accepts: acceptsFor(0.002),
    description: "OpenAI-compatible chat completions. Pay $0.002 per call in USDT (BSC) or USDC (Base); no API key, no signup. Models: gpt-4o-mini, gpt-4o, gpt-oss-20b, gpt-oss-120b, qwen3, allam-2-7b. Output capped at 512 tokens, input at 4000 chars.",
    mimeType: "application/json",
  },
};

export const OPENAI_PATHS = {
  "/v1/chat/completions": {
    post: {
      summary: "OpenAI-compatible chat completions (paid per call)",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["messages"],
              properties: {
                model: { type: "string", enum: Object.keys(MODEL_MAP), default: "gpt-4o-mini" },
                messages: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["role", "content"],
                    properties: {
                      role: { type: "string", enum: ["system", "user", "assistant"] },
                      content: { type: "string" },
                    },
                  },
                },
                max_tokens: { type: "integer", default: 256, maximum: MAX_OUTPUT_TOKENS },
                temperature: { type: "number", default: 0.7 },
                stream: { type: "boolean", default: false },
              },
            },
          },
        },
      },
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: "0.002" }, protocols: [{ x402: {} }] },
      responses: {
        "200": { description: "OpenAI-format chat completion" },
        "402": { description: "Payment Required" },
        "400": { description: "Invalid request (input too long / bad model)" },
      },
    },
  },
};

export async function handleChatCompletions(req, res) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: { type: "server_error", message: "GROQ_API_KEY not configured" } });

  const body = req.body || {};
  const modelKey = String(body.model || "gpt-4o-mini");
  const model = MODEL_MAP[modelKey];
  if (!model) {
    return res.status(400).json({ error: { type: "invalid_request_error", message: "unknown model: " + modelKey, allowed: Object.keys(MODEL_MAP) } });
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) {
    return res.status(400).json({ error: { type: "invalid_request_error", message: "messages is required" } });
  }
  const totalChars = messages.reduce((s, m) => s + String(m.content || "").length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return res.status(400).json({ error: { type: "invalid_request_error", message: `input too long: ${totalChars} chars, limit ${MAX_TOTAL_CHARS}` } });
  }
  const maxTokens = Math.min(Number(body.max_tokens || 256) || 256, MAX_OUTPUT_TOKENS);
  if (body.stream === true) {
    return res.status(400).json({ error: { type: "invalid_request_error", message: "stream:true not supported; use stream:false" } });
  }

  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: String(m.content || "") })),
      max_tokens: maxTokens,
      temperature: Number(body.temperature ?? 0.7),
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (r.status === 429) {
    return res.status(429).json({ error: { type: "rate_limit_exceeded", message: "free-tier rate limit reached, retry later", charged: false } });
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    return res.status(r.status).json({ error: { type: "upstream_error", message: j?.error?.message || "upstream failed", status: r.status } });
  }
  // Groq 返回已是 OpenAI 格式，透传
  res.json(j);
}

export function handleModels(req, res) {
  res.json({
    object: "list",
    data: Object.entries(MODEL_MAP).map(([alias, upstream]) => ({
      id: alias,
      object: "model",
      owned_by: "kinegrant-x402",
      upstream,
    })),
  });
}
