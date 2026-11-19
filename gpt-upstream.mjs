// GPT-6 上游（yicode GPT 0.16x 分组）：GPT-6 Astra / GPT-6.2 / GPT-5.6 Sol
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const YICODE_URL = "https://vip2.yicode.ai/v1/chat/completions";
const MAX_CHARS = 3000;
const MAX_TOKENS = 512;

export const GPT_MODELS = {
  "gpt-6": "gpt-6-astra",
  "gpt-6.2": "gpt-6.2-astra",
  "gpt-5.6": "gpt-5.6-sol",
  "gpt-6-astra": "gpt-6-astra",
};

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18)), base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

export const GPT_ROUTES = {
  "POST /v1/gpt": {
    accepts: acceptsFor(0.02),
    description: "GPT-6 Astra / GPT-6.2 / GPT-5.6 Sol (OpenAI-compatible, $0.02/call). Note: upstream injects a full system prompt (~4200 tokens/call) for non-degraded quality.",
    mimeType: "application/json",
  },
};

export const GPT_PATHS = {
  "/v1/gpt": {
    post: {
      summary: "GPT-6 Astra / GPT-6.2 / GPT-5.6 Sol (paid $0.02/call)",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["messages"],
              properties: {
                model: { type: "string", enum: Object.keys(GPT_MODELS), default: "gpt-6" },
                messages: { type: "array", items: { type: "object", required: ["role", "content"], properties: { role: { type: "string", enum: ["system", "user", "assistant"] }, content: { type: "string" } } } },
                max_tokens: { type: "integer", default: 256, maximum: MAX_TOKENS },
                temperature: { type: "number", default: 0.7 },
              },
            },
          },
        },
      },
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: "0.02" }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OpenAI-format chat completion from GPT-6" }, "402": { description: "Payment Required" } },
    },
  },
};

export async function handleGpt(req, res) {
  const body = req.body || {};
  const alias = String(body.model || "gpt-6");
  const upstream = GPT_MODELS[alias];
  if (!upstream) return res.status(400).json({ error: { type: "invalid_request_error", message: "unknown gpt model: " + alias, allowed: Object.keys(GPT_MODELS) } });
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return res.status(400).json({ error: { type: "invalid_request_error", message: "messages is required" } });
  const totalChars = messages.reduce((s, m) => s + String(m.content || "").length, 0);
  if (totalChars > MAX_CHARS) return res.status(400).json({ error: { type: "invalid_request_error", message: `input too long: ${totalChars}, limit ${MAX_CHARS}` } });
  const maxTokens = Math.min(Number(body.max_tokens || 256) || 256, MAX_TOKENS);

  const key = process.env.YICODE_GPT_KEY;
  if (!key) return res.status(503).json({ error: { type: "server_error", message: "YICODE_GPT_KEY not configured" } });

  const r = await fetch(YICODE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({ model: upstream, messages: messages.map((m) => ({ role: m.role, content: String(m.content || "") })), max_tokens: maxTokens, temperature: Number(body.temperature ?? 0.7), stream: false }),
    signal: AbortSignal.timeout(120000),
  });
  if (r.status === 429) return res.status(429).json({ error: { type: "rate_limit_exceeded", message: "upstream rate limit", charged: false } });
  const j = await r.json().catch(() => null);
  if (!r.ok) return res.status(r.status).json({ error: { type: "upstream_error", message: j?.error?.message || "upstream failed", status: r.status } });
  res.json(j);
}
