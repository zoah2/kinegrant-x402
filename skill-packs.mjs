// Skill packs：一个价格跑多个子查询（抄 Agent402 模式，$0.02-0.08）
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const RPCS = ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org", "https://bsc-rpc.publicnode.com"];
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function rpcCall(method, params) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("rpc failed");
}
const encAddr = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const validAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
const ethCall = (to, data) => rpcCall("eth_call", [{ to, data }, "latest"]);
const decodeString = (hex) => { if (!hex || hex === "0x") return null; const h = hex.replace(/^0x/, ""); try { const len = parseInt(h.slice(64, 128), 16); return Buffer.from(h.slice(128, 128 + len * 2), "hex").toString("utf8"); } catch { return null; } };
const decodeUint = (hex) => (hex && hex !== "0x" ? BigInt(hex).toString() : null);
const decodeAddr = (hex) => (hex && hex !== "0x" && hex.length >= 42 ? "0x" + hex.slice(-40) : null);

async function tokenInfo(t) {
  const [n, s, d, sup, o] = await Promise.all([
    ethCall(t, "0x06fdde03").catch(() => null), ethCall(t, "0x95d89b41").catch(() => null),
    ethCall(t, "0x313ce567").catch(() => null), ethCall(t, "0x18160ddd").catch(() => null),
    ethCall(t, "0x8da5cb5b").catch(() => null),
  ]);
  const dec = d ? Number(BigInt(d)) : null; const supply = decodeUint(sup); const owner = decodeAddr(o);
  return { name: decodeString(n), symbol: decodeString(s), decimals: dec, supply, supplyFmt: supply && dec !== null ? Number(supply) / 10 ** dec : null, owner, ownerRenounced: owner === null };
}
async function pairInfo(t, q) {
  const pairHex = await ethCall(FACTORY, "0xe6a43905" + encAddr(t) + encAddr(q));
  if (!pairHex || pairHex === "0x") return null;
  const pair = "0x" + pairHex.slice(-40);
  if (pair === "0x" + "0".repeat(40)) return null;
  const [t0Hex, resHex] = await Promise.all([ethCall(pair, "0x0dfe1681").catch(() => null), ethCall(pair, "0x0902f1ac").catch(() => null)]);
  if (!resHex) return null;
  const h = resHex.replace(/^0x/, ""); const r0 = BigInt("0x" + h.slice(0, 64)); const r1 = BigInt("0x" + h.slice(64, 128));
  const t0 = t0Hex ? "0x" + t0Hex.slice(-40) : null;
  const is0 = t0 ? t0.toLowerCase() === t.toLowerCase() : t.toLowerCase() < q.toLowerCase();
  const [rt, rq] = is0 ? [r0, r1] : [r1, r0];
  if (rt === 0n) return null;
  return { pair, rToken: rt, rQuote: rq, price: Number(rq) / Number(rt), token0: t0 };
}
async function nativeBalance(a) { const w = await rpcCall("eth_getBalance", [a, "latest"]).catch(() => "0x0"); return BigInt(w).toString(); }
async function tokenBalance(t, h) { const o = await ethCall(t, "0x70a08231" + encAddr(h)).catch(() => null); return o ? BigInt(o).toString() : "0"; }
async function llm(prompt, maxTokens = 200) {
  const key = process.env.GROQ_API_KEY; if (!key) throw new Error("no key");
  const r = await fetch(GROQ_URL, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + key }, body: JSON.stringify({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0.2, stream: false }), signal: AbortSignal.timeout(60000) });
  if (r.status === 429) throw new Error("rate_limited");
  const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.error?.message || "upstream");
  return j?.choices?.[0]?.message?.content ?? "";
}
async function signalsOf(range = "1h") {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);
  const r = await exec("baw", ["signal", "list", "--chain-id", "56", "--time-range", range, "--page-size", "100", "--sort-by", "time", "--json"], { timeout: 60000, maxBuffer: 20 * 1024 * 1024, shell: true, env: { ...process.env, HTTPS_PROXY: "http://127.0.0.1:7897", HTTP_PROXY: "http://127.0.0.1:7897", NODE_USE_ENV_PROXY: "1" } });
  const j = JSON.parse(r.stdout);
  return j.success ? (j.data?.list || []) : [];
}

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18)); const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}
const P = (name, desc, required = true) => ({ name, in: "query", required, schema: { type: "string" }, description: desc });
const C = (res, obj) => res.json(obj);

export const SKILLS = [
  {
    path: "/skill/dd", usd: 0.05,
    summary: "Full due-diligence pack: metadata + USDT/WBNB pools + risk score + verdict (one payment, 4 tools).",
    params: [P("token", "BSC token address")],
    handler: async (req, res) => {
      const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" });
      const [info, usdtPool, wbnbPool] = await Promise.all([tokenInfo(t).catch(() => null), pairInfo(t, USDT).catch(() => null), pairInfo(t, WBNB).catch(() => null)]);
      const liq = usdtPool ? Number(usdtPool.rQuote) / 1e18 : 0;
      let score = 100;
      if (!usdtPool) score -= 50; else if (liq < 1000) score -= 40; else if (liq < 20000) score -= 20;
      if (info && !info.ownerRenounced) score -= 30;
      const rating = !usdtPool && !wbnbPool ? "DEAD" : liq < 500 ? "RADIOACTIVE" : liq < 5000 ? "COOKED" : liq < 20000 || !info?.ownerRenounced ? "MID" : "BASED";
      C(res, { skill: "dd", token: t.toLowerCase(), info, pools: { usdt: usdtPool ? { pair: usdtPool.pair, priceUSDT: Number(usdtPool.price.toFixed(12)), liquidityUSDT: Number(liq.toFixed(2)) } : null, wbnb: wbnbPool ? { pair: wbnbPool.pair, priceWBNB: Number(wbnbPool.price.toFixed(12)) } : null }, riskScore: Math.max(0, score), rating, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/wallet", usd: 0.05,
    summary: "Wallet profile pack: BNB balance + USDT/USDC/WBNB balances + nonce + contract check (one payment, 4 tools).",
    params: [P("address", "EVM address")],
    handler: async (req, res) => {
      const a = String(req.query.address || ""); if (!validAddr(a)) return res.status(400).json({ error: "bad_address" });
      const [bnb, usdt, usdc, wbnb, nonceHex, code] = await Promise.all([
        nativeBalance(a), tokenBalance(USDT, a), tokenBalance(USDC_BSC, a), tokenBalance(WBNB, a),
        rpcCall("eth_getTransactionCount", [a, "latest"]).catch(() => "0x0"),
        rpcCall("eth_getCode", [a, "latest"]).catch(() => "0x"),
      ]);
      C(res, { skill: "wallet", address: a.toLowerCase(), bnb: Number(bnb) / 1e18, tokens: { USDT: Number(usdt) / 1e18, USDC: Number(usdc) / 1e18, WBNB: Number(wbnb) / 1e18 }, nonce: parseInt(nonceHex, 16), isContract: code !== "0x", asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/chain", usd: 0.02,
    summary: "Chain status pack: gas + latest block + BNB price + peers + base fee (one payment, 5 tools).",
    params: [],
    handler: async (req, res) => {
      const [gasHex, blk, wbnbPair, peersHex] = await Promise.all([
        rpcCall("eth_gasPrice", []).catch(() => null), rpcCall("eth_getBlockByNumber", ["latest", false]).catch(() => null),
        pairInfo(WBNB, USDT).catch(() => null), rpcCall("net_peerCount", []).catch(() => null),
      ]);
      C(res, { skill: "chain", chain: "bsc", gasGwei: gasHex ? Number(BigInt(gasHex)) / 1e9 : null, block: blk ? { number: parseInt(blk.number, 16), timestamp: parseInt(blk.timestamp, 16), txCount: blk.transactions?.length ?? null, baseFeeGwei: blk.baseFeePerGas ? Number(BigInt(blk.baseFeePerGas)) / 1e9 : null } : null, bnbUSDT: wbnbPair ? Number(wbnbPair.price.toFixed(6)) : null, peers: peersHex ? parseInt(peersHex, 16) : null, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/market", usd: 0.03,
    summary: "Market snapshot pack: BNB price + gas + signal stats (24h) + top movers (one payment, 3 tools).",
    params: [],
    handler: async (req, res) => {
      const [wbnbPair, gasHex, sigs] = await Promise.all([pairInfo(WBNB, USDT).catch(() => null), rpcCall("eth_gasPrice", []).catch(() => null), signalsOf("24h").catch(() => [])]);
      const bySrc = {}; let big = 0;
      for (const s of sigs) { const k = s.signalSource || "?"; bySrc[k] = (bySrc[k] || 0) + 1; if (Number(s.maxGain || 0) >= 3) big += 1; }
      C(res, { skill: "market", chain: "bsc", bnbUSDT: wbnbPair ? Number(wbnbPair.price.toFixed(6)) : null, gasGwei: gasHex ? Number(BigInt(gasHex)) / 1e9 : null, signals24h: { total: sigs.length, bySource: bySrc, bigWin3x: big }, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/meme", usd: 0.08,
    summary: "Meme sniper pack: filtered signals + per-candidate verdict + liquidity (one payment, 4 tools).",
    params: [P("range", "Lookback: 5m|1h|24h, default 1h", false)],
    handler: async (req, res) => {
      const sigs = await signalsOf(String(req.query.range || "1h")).catch(() => []);
      const now = Date.now(); const out = [];
      for (const s of sigs.slice(0, 20)) {
        const tags = Object.values(s.tokenTag || {}).flat().map((t) => t.tagName);
        const ageMin = s.signalTriggerTime ? Math.round((now - Number(s.signalTriggerTime)) / 60000) : null;
        const mc = Number(s.alertMarketCap || 0);
        if (tags.includes("High Tax Token") || tags.includes("DEV Close Position") || tags.includes("Low Liquidity")) continue;
        if (ageMin !== null && ageMin > 30) continue; if (mc > 150000) continue;
        const [info, pool] = await Promise.all([tokenInfo(s.contractAddress).catch(() => null), pairInfo(s.contractAddress, USDT).catch(() => null)]);
        const liq = pool ? Number(pool.rQuote) / 1e18 : 0;
        out.push({ ticker: s.ticker, contract: s.contractAddress, marketCap: mc, ageMin, liquidityUSDT: Number(liq.toFixed(2)), rating: !pool ? "DEAD" : liq < 500 ? "RADIOACTIVE" : liq < 5000 ? "COOKED" : liq < 20000 || !info?.ownerRenounced ? "MID" : "BASED", maxGain: s.maxGain ?? null });
      }
      C(res, { skill: "meme", candidates: out.length, list: out, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/ai-dd", usd: 0.08,
    summary: "AI due-diligence pack: full token data + LLM written verdict (data + model, one payment).",
    params: [P("token", "BSC token address")],
    handler: async (req, res) => {
      const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" });
      const [info, usdtPool] = await Promise.all([tokenInfo(t).catch(() => null), pairInfo(t, USDT).catch(() => null)]);
      const liq = usdtPool ? Number(usdtPool.rQuote) / 1e18 : 0;
      const data = { symbol: info?.symbol, name: info?.name, liquidityUSDT: Number(liq.toFixed(2)), priceUSDT: usdtPool ? Number(usdtPool.price.toFixed(12)) : null, ownerRenounced: info?.ownerRenounced, supply: info?.supplyFmt };
      let verdict = null;
      try {
        verdict = await llm("You are a crypto risk analyst. Based ONLY on this data, write a 2-sentence verdict (risk level + one action recommendation): " + JSON.stringify(data), 150);
      } catch (e) { verdict = "LLM unavailable: " + e.message; }
      C(res, { skill: "ai-dd", token: t.toLowerCase(), data, verdict: verdict?.trim(), asOf: new Date().toISOString() });
    },
  },
];

export const SKILL_ROUTES = Object.fromEntries(
  SKILLS.map((ep) => ["GET " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);
export const SKILL_PATHS = Object.fromEntries(
  SKILLS.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params.length ? ep.params : [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id" }],
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
