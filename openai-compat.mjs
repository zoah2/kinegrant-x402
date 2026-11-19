// OpenAI 兼容端点：Groq 免费层 + DeepSeek V4 + Claude + GPT-6
import { CLAUDE_MODELS } from "./claude-upstream.mjs";
import { GPT_MODELS } from "./gpt-upstream.mjs";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MAX_TOTAL_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 512;

// model alias -> { provider, upstream }
export const MODEL_MAP = {
  "gpt-4o-mini": { provider: "groq", upstream: "openai/gpt-oss-20b" },
  "gpt-4o": { provider: "groq", upstream: "openai/gpt-oss-120b" },
  "gpt-oss-20b": { provider: "groq", upstream: "openai/gpt-oss-20b" },
  "gpt-oss-120b": { provider: "groq", upstream: "openai/gpt-oss-120b" },
  "qwen3": { provider: "groq", upstream: "qwen/qwen3.8-27b" },
  "allam-2-7b": { provider: "groq", upstream: "allam-2-7b" },
  "deepseek-chat": { provider: "deepseek", upstream: "deepseek-chat" },
  "deepseek-v4": { provider: "deepseek", upstream: "deepseek-chat" },
  "deepseek-reasoner": { provider: "deepseek", upstream: "deepseek-reasoner" },
  "deepseek-uncensored": { provider: "yicode-ds", upstream: "deepseek-v4.1-flash-abliterated" },
  "deepseek-uncensored-fast": { provider: "yicode-ds", upstream: "deepseek-v4.1-flash-abliterated-fast" },
};

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18)), base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

export const OPENAI_ROUTES = {
  "POST /v1/chat/completions": {
    accepts: acceptsFor(0.002),
    description: "OpenAI-compatible chat completions. $0.002 per call (USDT BSC / USDC Base). 9 models: gpt-oss-120b/20b, qwen3, allam, deepseek-chat (V4), deepseek-v4, deepseek-reasoner. Output capped at 512 tokens.",
    mimeType: "application/json",
  },
};

export const OPENAI_PATHS = {
  "/v1/chat/completions": {
    post: {
      summary: "OpenAI-compatible chat completions (paid per call, 9 models)",
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
                  items: { type: "object", required: ["role", "content"], properties: { role: { type: "string", enum: ["system", "user", "assistant"] }, content: { type: "string" } } },
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
      responses: { "200": { description: "OpenAI-format chat completion" }, "402": { description: "Payment Required" } },
    },
  },
};

export async function handleChatCompletions(req, res) {
  const body = req.body || {};
  const modelKey = String(body.model || "gpt-4o-mini");
  const entry = MODEL_MAP[modelKey];
  if (!entry) {
    return res.status(400).json({ error: { type: "invalid_request_error", message: "unknown model: " + modelKey, allowed: Object.keys(MODEL_MAP) } });
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return res.status(400).json({ error: { type: "invalid_request_error", message: "messages is required" } });
  const totalChars = messages.reduce((s, m) => s + String(m.content || "").length, 0);
  if (totalChars > MAX_TOTAL_CHARS) return res.status(400).json({ error: { type: "invalid_request_error", message: `input too long: ${totalChars} chars, limit ${MAX_TOTAL_CHARS}` } });
  const maxTokens = Math.min(Number(body.max_tokens || 256) || 256, MAX_OUTPUT_TOKENS);
  if (body.stream === true) return res.status(400).json({ error: { type: "invalid_request_error", message: "stream:true not supported" } });

  const key = entry.provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : entry.provider === "yicode-ds" ? process.env.YICODE_DS_KEY : process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: { type: "server_error", message: `API key not configured for provider ${entry.provider}` } });

  const url = entry.provider === "deepseek" ? DEEPSEEK_URL : entry.provider === "yicode-ds" ? "https://vip2.yicode.ai/v1/chat/completions" : GROQ_URL;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({ model: entry.upstream, messages: messages.map((m) => ({ role: m.role, content: String(m.content || "") })), max_tokens: maxTokens, temperature: Number(body.temperature ?? 0.7), stream: false }),
    signal: AbortSignal.timeout(60000),
  });
  if (r.status === 429) return res.status(429).json({ error: { type: "rate_limit_exceeded", message: "upstream rate limit", charged: false } });
  const j = await r.json().catch(() => null);
  if (!r.ok) return res.status(r.status).json({ error: { type: "upstream_error", message: j?.error?.message || "upstream failed", status: r.status } });
  res.json(j);
}

export function handleModels(req, res) {
  const data = [
    ...Object.entries(MODEL_MAP).map(([alias, e]) => ({ id: alias, object: "model", endpoint: "/v1/chat/completions", price: "$0.002", provider: e.provider, upstream: e.upstream })),
    ...Object.entries(CLAUDE_MODELS).map(([alias, up]) => ({ id: alias, object: "model", endpoint: "/v1/claude", price: "$0.01", provider: "yicode", upstream: up })),
    ...Object.entries(GPT_MODELS).map(([alias, up]) => ({ id: alias, object: "model", endpoint: "/v1/gpt", price: "$0.02", provider: "yicode", upstream: up })),
  ];
  res.json({ object: "list", count: data.length, data });
}
