// 抄 X Pay 的 21 个 utility 端点（定价：基础 $0.002 / AI $0.005-0.01）
import crypto from "node:crypto";
import { keccak_256 } from "@noble/hashes/sha3.js";

const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18));
  const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

const P = (name, desc, required = true) => ({ name, in: "query", required, schema: { type: "string" }, description: desc });

async function llm(prompt, maxTokens = 256) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not configured");
  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0.3, stream: false }),
    signal: AbortSignal.timeout(60000),
  });
  if (r.status === 429) { const e = new Error("rate_limited"); e.code = 429; throw e; }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || "upstream_failed");
  return j?.choices?.[0]?.message?.content ?? "";
}

function textOf(req) {
  const q = req.query?.text;
  if (q) return String(q).slice(0, 4000);
  const b = req.body?.text;
  if (b) return String(b).slice(0, 4000);
  return "";
}

function safe(res, fn) {
  return async (req, r) => {
    try {
      const out = await fn(req, r);
      if (!r.headersSent) r.json(out);
    } catch (e) {
      const code = e.code === 429 ? 429 : 502;
      r.status(code).json({ error: code === 429 ? "rate_limited" : "failed", message: String(e.message || e) });
    }
  };
}

export const UTIL_ENDPOINTS = [
  // ---------- 基础工具 $0.002 ----------
  { method: "GET", path: "/x402/ping", usd: 0.002, summary: "Health check ping", params: [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }], handler: safe(null, async () => ({ pong: true, ts: Date.now(), service: "kinegrant-x402" })) },
  { method: "GET", path: "/x402/status", usd: 0.002, summary: "Service status", params: [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }], handler: safe(null, async () => ({ ok: true, service: "kinegrant-x402", version: 2, models: !!process.env.GROQ_API_KEY, ts: Date.now() })) },
  { method: "GET", path: "/x402/time", usd: 0.002, summary: "Current server time in UTC", params: [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }], handler: safe(null, async () => { const d = new Date(); return { iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), utc: d.toUTCString() }; }) },
  { method: "GET", path: "/x402/uuid", usd: 0.002, summary: "Generate a UUID v4", params: [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }], handler: safe(null, async () => ({ uuid: crypto.randomUUID() })) },
  { method: "GET", path: "/x402/random", usd: 0.002, summary: "Random integer and hex bytes", params: [P("max", "Max integer, default 1000000", false)], handler: safe(null, async (req) => { const max = Math.max(1, Math.min(Number(req.query.max || 1000000), 1e15)); return { int: crypto.randomInt(0, max), hex: crypto.randomBytes(16).toString("hex") }; }) },
  { method: "GET", path: "/x402/ip", usd: 0.002, summary: "Requester IP address", params: [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }], handler: safe(null, async (req) => ({ ip: req.ip || req.socket?.remoteAddress || null, xff: req.headers["x-forwarded-for"] || null })) },
  { method: "GET", path: "/x402/network", usd: 0.002, summary: "Payment network metadata (BSC USDT + Base USDC)", params: [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }], handler: safe(null, async () => ({ networks: [{ chain: "eip155:56", asset: USDT, name: "USDT" }, { chain: "eip155:8453", asset: BASE_USDC, name: "USDC" }], payTo: PAY_TO })) },
  { method: "GET", path: "/x402/payment", usd: 0.002, summary: "Payment config", params: [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }], handler: safe(null, async () => ({ scheme: "exact", networks: ["eip155:56", "eip155:8453"], payTo: PAY_TO, currency: ["USDT", "USDC"] })) },
  { method: "GET", path: "/x402/quote", usd: 0.002, summary: "Static quote for a call (price lookup)", params: [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }], handler: safe(null, async () => ({ note: "every paid call returns its exact price in the 402 quote", minPrice: "$0.001", maxPrice: "$0.15" })) },
  { method: "POST", path: "/x402/echo", usd: 0.002, summary: "Echo a JSON message", params: [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }], handler: safe(null, async (req) => ({ echo: req.body ?? null, receivedAt: new Date().toISOString() })) },
  { method: "POST", path: "/x402/hash", usd: 0.002, summary: "SHA-256 hash of text", params: [P("text", "Text to hash", false)], handler: safe(null, async (req) => { const t = textOf(req); if (!t) return { error: "empty_text" }; return { sha256: crypto.createHash("sha256").update(t).digest("hex"), length: t.length }; }) },
  { method: "POST", path: "/x402/keccak", usd: 0.002, summary: "Keccak-256 hash of text (EVM)", params: [P("text", "Text to hash", false)], handler: safe(null, async (req) => { const t = textOf(req); if (!t) return { error: "empty_text" }; return { keccak256: "0x" + Buffer.from(keccak_256(Buffer.from(t, "utf8"))).toString("hex") }; }) },
  { method: "POST", path: "/x402/base64", usd: 0.002, summary: "Base64 encode/decode", params: [P("text", "Text", false), P("mode", "encode|decode (default encode)", false)], handler: safe(null, async (req) => { const t = textOf(req); const mode = String(req.query.mode || req.body?.mode || "encode"); if (!t) return { error: "empty_text" }; if (mode === "decode") { try { return { decoded: Buffer.from(t, "base64").toString("utf8") }; } catch { return { error: "bad_base64" }; } } return { encoded: Buffer.from(t, "utf8").toString("base64") }; }) },
  { method: "POST", path: "/x402/slug", usd: 0.002, summary: "URL-friendly slug from text", params: [P("text", "Text", false)], handler: safe(null, async (req) => { const t = textOf(req); if (!t) return { error: "empty_text" }; const slug = t.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 120); return { slug }; }) },
  { method: "POST", path: "/x402/wordcount", usd: 0.002, summary: "Word/character statistics", params: [P("text", "Text", false)], handler: safe(null, async (req) => { const t = textOf(req); return { chars: t.length, words: t.trim() ? t.trim().split(/\s+/).length : 0, lines: t ? t.split(/\r?\n/).length : 0 }; }) },

  // ---------- AI 功能 $0.005-0.01（对手 $10-20） ----------
  { method: "POST", path: "/x402/summarize", usd: 0.01, summary: "Summarize text (LLM)", params: [P("text", "Text to summarize", false)], handler: safe(null, async (req) => { const t = textOf(req); if (t.length < 20) return { error: "text_too_short" }; const out = await llm("Summarize the following text in 2-3 sentences, output only the summary:\n\n" + t, 200); return { summary: out.trim() }; }) },
  { method: "POST", path: "/x402/rewrite", usd: 0.05, summary: "Rewrite text (LLM, clearer tone)", params: [P("text", "Text to rewrite", false)], handler: safe(null, async (req) => { const t = textOf(req); if (t.length < 10) return { error: "text_too_short" }; const out = await llm("Rewrite the following text to be clearer and more concise, keep the meaning, output only the rewritten text:\n\n" + t, 400); return { rewritten: out.trim() }; }) },
  { method: "POST", path: "/x402/sentiment", usd: 0.02, summary: "Sentiment analysis (positive/neutral/negative + score)", params: [P("text", "Text to analyze", false)], handler: safe(null, async (req) => { const t = textOf(req); if (t.length < 5) return { error: "text_too_short" }; const out = await llm('Analyze sentiment of this text. Respond ONLY with compact JSON: {"sentiment":"positive|neutral|negative","score":-1..1}\n\nText: ' + t, 60); return { raw: out.trim() }; }) },
  { method: "POST", path: "/x402/keywords", usd: 0.02, summary: "Extract keywords (LLM)", params: [P("text", "Text", false)], handler: safe(null, async (req) => { const t = textOf(req); if (t.length < 20) return { error: "text_too_short" }; const out = await llm("Extract 5-10 key keywords/phrases from this text. Output ONLY comma-separated keywords:\n\n" + t, 100); return { keywords: out.trim() }; }) },
  { method: "POST", path: "/x402/classify", usd: 0.05, summary: "Classify text into a category (LLM)", params: [P("text", "Text", false), P("labels", "Comma-separated labels, default crypto/tech/finance/other", false)], handler: safe(null, async (req) => { const t = textOf(req); const labels = String(req.query.labels || req.body?.labels || "crypto,tech,finance,other"); if (t.length < 5) return { error: "text_too_short" }; const out = await llm("Classify this text into exactly one of: " + labels + ". Output ONLY the label:\n\n" + t, 20); return { label: out.trim() }; }) },
  { method: "POST", path: "/x402/outline", usd: 0.05, summary: "Generate an outline from text/topic (LLM)", params: [P("text", "Topic or text", false)], handler: safe(null, async (req) => { const t = textOf(req); if (t.length < 5) return { error: "text_too_short" }; const out = await llm("Create a concise outline (5-8 bullet points) for this topic/text. Output ONLY the outline:\n\n" + t, 300); return { outline: out.trim() }; }) },
];

export const UTIL_ROUTES = Object.fromEntries(
  UTIL_ENDPOINTS.map((ep) => [ep.method + " " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);

export const UTIL_PATHS = Object.fromEntries(
  UTIL_ENDPOINTS.map((ep) => [ep.path, {
    [ep.method.toLowerCase()]: {
      summary: ep.summary,
      parameters: ep.params,
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
