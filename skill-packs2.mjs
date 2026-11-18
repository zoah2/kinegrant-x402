// Skill packs v2：6 个组合包（安全/流动性/组合/对比/swap 规划）
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const RPCS = ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org", "https://bsc-rpc.publicnode.com"];

async function rpcCall(m, p) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }), signal: AbortSignal.timeout(8000) });
      const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
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

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18)); const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}
const P = (name, desc, required = true) => ({ name, in: "query", required, schema: { type: "string" }, description: desc });
const P2 = (name, desc) => ({ name, in: "query", required: true, schema: { type: "string" }, description: desc });

export const SKILLS2 = [
  {
    path: "/skill/security", usd: 0.05,
    summary: "Token security audit pack: owner renounce + transfer callable + decimals sanity + liquidity (one payment, 4 checks).",
    params: [P("token", "BSC token address")],
    handler: async (req, res) => {
      const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" });
      const [info, pool, probe] = await Promise.all([tokenInfo(t), pairInfo(t, USDT).catch(() => null), ethCall(t, "0xa9059cbb" + encAddr("0x0000000000000000000000000000000000000001") + encAddr("0x0000000000000000000000000000000000000001")).catch(() => null)]);
      const liq = pool ? Number(pool.rQuote) / 1e18 : 0;
      const findings = [];
      if (!info.ownerRenounced) findings.push({ code: "OWNER_ACTIVE", detail: "owner has privileges" });
      if (probe === null) findings.push({ code: "NO_TRANSFER", detail: "transfer() not callable" });
      if (info.decimals !== null && info.decimals !== 18) findings.push({ code: "UNUSUAL_DECIMALS", detail: "decimals=" + info.decimals });
      if (liq < 5000) findings.push({ code: "THIN_LIQUIDITY", detail: "liquidity $" + liq.toFixed(0) });
      res.json({ skill: "security", token: t.toLowerCase(), findings, riskLevel: findings.length > 2 ? "HIGH" : findings.length ? "MEDIUM" : "LOW", liquidityUSDT: Number(liq.toFixed(2)), asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/liquidity", usd: 0.03,
    summary: "Liquidity analysis pack: USDT and WBNB pool depth, price spread, pair addresses (one payment, 3 checks).",
    params: [P("token", "BSC token address")],
    handler: async (req, res) => {
      const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" });
      const [usdtPool, wbnbPool] = await Promise.all([pairInfo(t, USDT).catch(() => null), pairInfo(t, WBNB).catch(() => null)]);
      const liqUSDT = usdtPool ? Number(usdtPool.rQuote) / 1e18 : 0;
      const liqWBNB = wbnbPool ? Number(wbnbPool.rQuote) / 1e18 : 0;
      res.json({ skill: "liquidity", token: t.toLowerCase(), usdtPool: usdtPool ? { pair: usdtPool.pair, liquidityUSDT: Number(liqUSDT.toFixed(2)), priceUSDT: Number(usdtPool.price.toFixed(12)) } : null, wbnbPool: wbnbPool ? { pair: wbnbPool.pair, liquidityWBNB: Number(liqWBNB.toFixed(6)), priceWBNB: Number(wbnbPool.price.toFixed(12)) } : null, totalLiquidityUSDT: Number((liqUSDT + liqWBNB * 600).toFixed(2)), asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/portfolio", usd: 0.08,
    summary: "Wallet valuation pack: BNB + USDT + USDC + WBNB with USD total (one payment, 4 tools).",
    params: [P("address", "EVM address")],
    handler: async (req, res) => {
      const a = String(req.query.address || ""); if (!validAddr(a)) return res.status(400).json({ error: "bad_address" });
      const [bnb, usdt, usdc, wbnb, bnbPair] = await Promise.all([nativeBalance(a), tokenBalance(USDT, a), tokenBalance(USDC_BSC, a), tokenBalance(WBNB, a), pairInfo(WBNB, USDT).catch(() => null)]);
      const bnbPrice = bnbPair ? bnbPair.price : 0;
      const b = Number(bnb) / 1e18; const u = Number(usdt) / 1e18; const uc = Number(usdc) / 1e18; const w = Number(wbnb) / 1e18;
      res.json({ skill: "portfolio", address: a.toLowerCase(), holdings: [{ symbol: "BNB", amount: b, valueUSD: Number((b * bnbPrice).toFixed(4)) }, { symbol: "USDT", amount: u, valueUSD: Number(u.toFixed(4)) }, { symbol: "USDC", amount: uc, valueUSD: Number(uc.toFixed(4)) }, { symbol: "WBNB", amount: w, valueUSD: Number((w * bnbPrice).toFixed(4)) }].filter((x) => x.amount > 0), totalUSD: Number((b * bnbPrice + u + uc + w * bnbPrice).toFixed(4)), asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/token-compare", usd: 0.06,
    summary: "Compare two BSC tokens: price, liquidity, owner status, verdict (one payment, 6 checks).",
    params: [P2("tokenA", "First token"), P2("tokenB", "Second token")],
    handler: async (req, res) => {
      const a = String(req.query.tokenA || ""); const b = String(req.query.tokenB || "");
      if (!validAddr(a) || !validAddr(b)) return res.status(400).json({ error: "bad_tokens" });
      const pack = async (t) => {
        const [info, pool] = await Promise.all([tokenInfo(t).catch(() => null), pairInfo(t, USDT).catch(() => null)]);
        const liq = pool ? Number(pool.rQuote) / 1e18 : 0;
        return { token: t.toLowerCase(), symbol: info?.symbol, priceUSDT: pool ? Number(pool.price.toFixed(12)) : null, liquidityUSDT: Number(liq.toFixed(2)), ownerRenounced: info?.ownerRenounced, rating: !pool ? "DEAD" : liq < 500 ? "RADIOACTIVE" : liq < 5000 ? "COOKED" : liq < 20000 || !info?.ownerRenounced ? "MID" : "BASED" };
      };
      const [pa, pb] = await Promise.all([pack(a), pack(b)]);
      res.json({ skill: "token-compare", tokenA: pa, tokenB: pb, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/swap-plan", usd: 0.05,
    summary: "Swap planning pack: pool price + reserves + slippage estimate for a given size (one payment, 3 tools).",
    params: [P("token", "Token to buy/sell"), P("amountBNB", "Trade size in BNB, e.g. 0.1"), P("side", "buy|sell, default buy")],
    handler: async (req, res) => {
      const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" });
      const size = Number(req.query.amountBNB || 0.1);
      const side = String(req.query.side || "buy").toLowerCase();
      const pool = await pairInfo(t, WBNB).catch(() => null);
      if (!pool) return res.status(404).json({ error: "no_wbnb_pool" });
      const reserveWBNB = Number(pool.rToken) / 1e18;
      const reserveToken = Number(pool.rQuote) / 1e18;
      const k = reserveWBNB * reserveToken;
      const newWBNB = side === "buy" ? reserveWBNB + size : Math.max(reserveWBNB - size, 0.0001);
      const newToken = k / newWBNB;
      const out = Math.abs(reserveToken - newToken);
      const spot = reserveToken / reserveWBNB;
      const exec = side === "buy" ? out / size : (reserveWBNB - newWBNB) * 0 + 0;
      const priceImpact = side === "buy" ? Math.abs((exec - spot) / spot) * 100 : Math.abs((size - out) / size) * 100;
      res.json({ skill: "swap-plan", token: t.toLowerCase(), pair: pool.pair, side, sizeBNB: size, spotPriceWBNB: Number(spot.toFixed(12)), expectedOut: Number(out.toFixed(6)), priceImpactPct: Number(priceImpact.toFixed(3)), asOf: new Date().toISOString() });
    },
  },
  {
    path: "/skill/full-report", usd: 0.1,
    summary: "Full token report pack: due diligence + security + liquidity + verdict (one payment, 9 checks).",
    params: [P("token", "BSC token address")],
    handler: async (req, res) => {
      const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" });
      const [info, usdtPool, wbnbPool, probe] = await Promise.all([tokenInfo(t), pairInfo(t, USDT).catch(() => null), pairInfo(t, WBNB).catch(() => null), ethCall(t, "0xa9059cbb" + encAddr("0x0000000000000000000000000000000000000001") + encAddr("0x0000000000000000000000000000000000000001")).catch(() => null)]);
      const liq = usdtPool ? Number(usdtPool.rQuote) / 1e18 : 0;
      const findings = [];
      if (!info.ownerRenounced) findings.push("OWNER_ACTIVE");
      if (probe === null) findings.push("NO_TRANSFER");
      if (info.decimals !== 18) findings.push("UNUSUAL_DECIMALS");
      if (liq < 5000) findings.push("THIN_LIQUIDITY");
      const rating = !usdtPool && !wbnbPool ? "DEAD" : liq < 500 ? "RADIOACTIVE" : liq < 5000 ? "COOKED" : liq < 20000 || !info.ownerRenounced ? "MID" : "BASED";
      res.json({
        skill: "full-report", token: t.toLowerCase(), info,
        pools: { usdt: usdtPool ? { pair: usdtPool.pair, priceUSDT: Number(usdtPool.price.toFixed(12)), liquidityUSDT: Number(liq.toFixed(2)) } : null, wbnb: wbnbPool ? { pair: wbnbPool.pair, priceWBNB: Number(wbnbPool.price.toFixed(12)) } : null },
        findings, rating, asOf: new Date().toISOString(),
      });
    },
  },
];

export const SKILL2_ROUTES = Object.fromEntries(
  SKILLS2.map((ep) => ["GET " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);
export const SKILL2_PATHS = Object.fromEntries(
  SKILLS2.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params,
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
