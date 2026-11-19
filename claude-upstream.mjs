// Claude 上游（yicode 中转，Claude Max 0.6x 分组）：Opus 5.5 / Sonnet 5.5 / Fable 5.2
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const YICODE_URL = "https://vip2.yicode.ai/v1/chat/completions";
const MAX_CHARS = 4000;
const MAX_TOKENS = 512;

export const CLAUDE_MODELS = {
  "claude-opus-5.5": "claude-opus-5-5",
  "claude-opus-5": "claude-opus-5",
  "claude-opus-4.8": "claude-opus-4-8",
  "claude-sonnet-5.5": "claude-sonnet-5-5",
  "claude-sonnet-5": "claude-sonnet-5",
  "claude-fable-5.2": "claude-fable-5-2",
  "claude-fable-5.1": "claude-fable-5-1",
};

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18)), base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

export const CLAUDE_ROUTES = {
  "POST /v1/claude": {
    accepts: acceptsFor(0.01),
    description: "Claude Opus 5.5 / Sonnet 5.5 / Fable 5.2 via relay. $0.01 per call (USDT BSC / USDC Base). OpenAI-compatible format. Output capped at 1024 tokens.",
    mimeType: "application/json",
  },
};

export const CLAUDE_PATHS = {
  "/v1/claude": {
    post: {
      summary: "Claude Opus 5.5 / Sonnet 5.5 / Fable 5.2 (paid $0.01/call)",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["messages"],
              properties: {
                model: { type: "string", enum: Object.keys(CLAUDE_MODELS), default: "claude-opus-5.5" },
                messages: { type: "array", items: { type: "object", required: ["role", "content"], properties: { role: { type: "string", enum: ["system", "user", "assistant"] }, content: { type: "string" } } } },
                max_tokens: { type: "integer", default: 256, maximum: MAX_TOKENS },
                temperature: { type: "number", default: 0.7 },
              },
            },
          },
        },
      },
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: "0.01" }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OpenAI-format chat completion from Claude" }, "402": { description: "Payment Required" } },
    },
  },
};

export async function handleClaude(req, res) {
  const body = req.body || {};
  const alias = String(body.model || "claude-opus-5.5");
  const upstream = CLAUDE_MODELS[alias];
  if (!upstream) return res.status(400).json({ error: { type: "invalid_request_error", message: "unknown claude model: " + alias, allowed: Object.keys(CLAUDE_MODELS) } });
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return res.status(400).json({ error: { type: "invalid_request_error", message: "messages is required" } });
  const totalChars = messages.reduce((s, m) => s + String(m.content || "").length, 0);
  if (totalChars > MAX_CHARS) return res.status(400).json({ error: { type: "invalid_request_error", message: `input too long: ${totalChars}, limit ${MAX_CHARS}` } });
  const maxTokens = Math.min(Number(body.max_tokens || 512) || 512, MAX_TOKENS);

  const key = process.env.YICODE_API_KEY;
  if (!key) return res.status(503).json({ error: { type: "server_error", message: "YICODE_API_KEY not configured" } });

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
