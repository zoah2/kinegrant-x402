// 抄 BlockRun/Zerion 的数据品类：DefiLlama 免费 API（6 个端点）+ LLM 多格式（2 个）
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b";
const MAX_CHARS = 4000;
const MAX_TOKENS = 512;

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18)), base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}
const P = (name, desc, required = true) => ({ name, in: "query", required, schema: { type: "string" }, description: desc });
async function jget(url) { const r = await fetch(url, { signal: AbortSignal.timeout(25000) }); if (!r.ok) throw new Error("http " + r.status); return r.json(); }
async function llm(messages, maxTokens = 256) {
  const key = process.env.GROQ_API_KEY; if (!key) throw new Error("no key");
  const r = await fetch(GROQ_URL, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + key }, body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.7, stream: false }), signal: AbortSignal.timeout(60000) });
  if (r.status === 429) throw new Error("rate_limited");
  const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.error?.message || "upstream");
  return j;
}

export const LLAMA_ENDPOINTS = [
  { path: "/defillama/protocols", usd: 0.005, summary: "Top DeFi protocols by TVL (DefiLlama)", params: [P("limit", "Top N, default 20", false)],
    handler: async (req, res) => { const n = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100); const list = await jget("https://api.llama.fi/protocols"); const top = list.sort((a, b) => (b.tvl || 0) - (a.tvl || 0)).slice(0, n).map((p) => ({ name: p.name, tvl: p.tvl, chain: p.chain, category: p.category, change1d: p.change_1d ?? null })); res.json({ count: top.length, protocols: top, asOf: new Date().toISOString() }); } },
  { path: "/defillama/chains", usd: 0.005, summary: "Chains ranked by DeFi TVL", params: [P("limit", "Top N, default 20", false)],
    handler: async (req, res) => { const n = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100); const list = await jget("https://api.llama.fi/v2/chains"); const top = list.sort((a, b) => (b.tvl || 0) - (a.tvl || 0)).slice(0, n).map((c) => ({ name: c.name, tvl: c.tvl, tokenSymbol: c.tokenSymbol ?? null })); res.json({ count: top.length, chains: top, asOf: new Date().toISOString() }); } },
  { path: "/defillama/protocol", usd: 0.01, summary: "Detailed TVL history for one protocol", params: [P("name", "Protocol slug, e.g. aave")],
    handler: async (req, res) => { const name = String(req.query.name || ""); if (!name) return res.status(400).json({ error: "bad_name" }); const p = await jget("https://api.llama.fi/protocol/" + encodeURIComponent(name)); const tvl = p.tvl || []; res.json({ name: p.name, symbol: p.symbol ?? null, category: p.category ?? null, chains: p.chains ?? [], currentTvl: tvl.length ? tvl[tvl.length - 1].totalLiquidityUSD : null, points: tvl.length, asOf: new Date().toISOString() }); } },
  { path: "/defillama/yields", usd: 0.01, summary: "Top yield pools by APY", params: [P("limit", "Top N, default 10", false), P("chain", "Filter by chain, e.g. BSC", false)],
    handler: async (req, res) => { const n = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50); const chain = String(req.query.chain || "").toLowerCase(); const data = await jget("https://yields.llama.fi/pools"); let pools = data.data || []; if (chain) pools = pools.filter((p) => String(p.chain || "").toLowerCase().includes(chain)); const top = pools.sort((a, b) => (b.apy || 0) - (a.apy || 0)).slice(0, n).map((p) => ({ pool: p.pool, project: p.project, chain: p.chain, symbol: p.symbol, apy: p.apy, tvlUsd: p.tvlUsd })); res.json({ count: top.length, pools: top, asOf: new Date().toISOString() }); } },
  { path: "/defillama/price", usd: 0.002, summary: "Token price via DefiLlama coins API", params: [P("coins", "e.g. coingecko:bitcoin or bsc:0x55d3...")],
    handler: async (req, res) => { const coins = String(req.query.coins || ""); if (!coins) return res.status(400).json({ error: "bad_coins" }); const j = await jget("https://coins.llama.fi/prices/current/" + encodeURIComponent(coins)); res.json({ coins: j.coins || {}, asOf: new Date().toISOString() }); } },
  { path: "/defillama/stablecoins", usd: 0.005, summary: "Stablecoins with supply and peg type", params: [P("limit", "Top N, default 20", false)],
    handler: async (req, res) => { const n = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100); const data = await jget("https://stablecoins.llama.fi/stablecoins?includePrices=true"); const list = (data.peggedAssets || []).sort((a, b) => (b.circulating?.peggedUSD || 0) - (a.circulating?.peggedUSD || 0)).slice(0, n).map((s) => ({ name: s.name, symbol: s.symbol, pegType: s.pegType, circulatingUSD: s.circulating?.peggedUSD ?? null, price: s.price ?? null })); res.json({ count: list.length, stablecoins: list, asOf: new Date().toISOString() }); } },

  // LLM 多格式（Anthropic Messages / OpenAI Responses）——抄 BlockRun
  { path: "/v1/messages", usd: 0.002, summary: "Anthropic-style messages endpoint (Groq-backed, capped)", params: [],
    handler: async (req, res) => {
      const body = req.body || {};
      const msgs = Array.isArray(body.messages) ? body.messages : [];
      if (!msgs.length) return res.status(400).json({ error: { type: "invalid_request_error", message: "messages required" } });
      const total = msgs.reduce((s, m) => s + String(m.content || "").length, 0);
      if (total > MAX_CHARS) return res.status(400).json({ error: { type: "invalid_request_error", message: "input too long" }});
      const sys = body.system ? [{ role: "system", content: String(body.system) }] : [];
      const chat = [...sys, ...msgs.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }))];
      const j = await llm(chat, Math.min(Number(body.max_tokens) || 256, MAX_TOKENS));
      const text = j?.choices?.[0]?.message?.content ?? "";
      res.json({ id: "msg_" + Date.now(), type: "message", role: "assistant", content: [{ type: "text", text }], model: j?.model || MODEL, stop_reason: "end_turn", usage: { input_tokens: j?.usage?.prompt_tokens ?? null, output_tokens: j?.usage?.completion_tokens ?? null } });
    } },
  { path: "/v1/responses", usd: 0.002, summary: "OpenAI Responses-style endpoint (Groq-backed, capped)", params: [],
    handler: async (req, res) => {
      const body = req.body || {};
      const input = body.input;
      const text = typeof input === "string" ? input : Array.isArray(input) ? input.map((i) => i?.content || "").join("\n") : "";
      if (!text || text.length > MAX_CHARS) return res.status(400).json({ error: { type: "invalid_request_error", message: "input required / too long" }});
      const j = await llm([{ role: "user", content: text }], Math.min(Number(body.max_output_tokens) || 256, MAX_TOKENS));
      res.json({ id: "resp_" + Date.now(), object: "response", model: j?.model || MODEL, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: j?.choices?.[0]?.message?.content ?? "" }] }], usage: j?.usage ?? null });
    } },
];

export const LLAMA_ENDPOINTS_M = LLAMA_ENDPOINTS.map((ep) => ({
  ...ep,
  method: ep.path.startsWith("/v1/") ? "POST" : "GET",
}));

export const LLAMA_ROUTES = Object.fromEntries(
  LLAMA_ENDPOINTS_M.map((ep) => [ep.method + " " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);
export const LLAMA_PATHS = Object.fromEntries(
  LLAMA_ENDPOINTS_M.map((ep) => [ep.path, {
    [ep.method.toLowerCase()]: {
      summary: ep.summary,
      parameters: ep.params.length ? ep.params : [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id" }],
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
