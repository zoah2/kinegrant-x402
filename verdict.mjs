// 独占端点：代币判决（AX1 Verdict 模式，$0.01 = 对手一半）
// 评级：BASED / MID / COOKED / RADIOACTIVE / DEAD + 一句话结论 + 关键数据
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const RPCS = [
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-rpc.publicnode.com",
];

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
  throw lastErr || new Error("all rpc failed");
}
const encAddr = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const validAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
const ethCall = (to, data) => rpcCall("eth_call", [{ to, data }, "latest"]);
const decodeString = (hex) => {
  if (!hex || hex === "0x") return null;
  const h = hex.replace(/^0x/, "");
  try { const len = parseInt(h.slice(64, 128), 16); return Buffer.from(h.slice(128, 128 + len * 2), "hex").toString("utf8"); } catch { return null; }
};
const decodeUint = (hex) => (hex && hex !== "0x" ? BigInt(hex).toString() : null);
const decodeAddr = (hex) => (hex && hex !== "0x" && hex.length >= 42 ? "0x" + hex.slice(-40) : null);

async function tokenInfo(t) {
  const [n, s, d, sup, o] = await Promise.all([
    ethCall(t, "0x06fdde03").catch(() => null),
    ethCall(t, "0x95d89b41").catch(() => null),
    ethCall(t, "0x313ce567").catch(() => null),
    ethCall(t, "0x18160ddd").catch(() => null),
    ethCall(t, "0x8da5cb5b").catch(() => null),
  ]);
  const dec = d ? Number(BigInt(d)) : null;
  const supply = decodeUint(sup);
  const owner = decodeAddr(o);
  return { name: decodeString(n), symbol: decodeString(s), decimals: dec, supply, supplyFmt: supply && dec !== null ? Number(supply) / 10 ** dec : null, owner, ownerRenounced: owner === null };
}

async function pairInfo(t, q) {
  const pairHex = await ethCall(FACTORY, "0xe6a43905" + encAddr(t) + encAddr(q));
  if (!pairHex || pairHex === "0x") return null;
  const pair = "0x" + pairHex.slice(-40);
  if (pair === "0x" + "0".repeat(40)) return null;
  const [t0Hex, resHex] = await Promise.all([
    ethCall(pair, "0x0dfe1681").catch(() => null),
    ethCall(pair, "0x0902f1ac").catch(() => null),
  ]);
  if (!resHex) return null;
  const h = resHex.replace(/^0x/, "");
  const r0 = BigInt("0x" + h.slice(0, 64));
  const r1 = BigInt("0x" + h.slice(64, 128));
  const t0 = t0Hex ? "0x" + t0Hex.slice(-40) : null;
  const tokenIs0 = t0 ? t0.toLowerCase() === t.toLowerCase() : t.toLowerCase() < q.toLowerCase();
  const [rToken, rQuote] = tokenIs0 ? [r0, r1] : [r1, r0];
  if (rToken === 0n) return null;
  return { pair, rToken, rQuote, price: Number(rQuote) / Number(rToken), token0: t0 };
}

// 评级逻辑（数据驱动，不是拍脑袋）
function grade(info, usdtPool, wbnbPool) {
  const liq = usdtPool ? Number(usdtPool.rQuote) / 1e18 : 0;
  const hasSupply = info.supplyFmt !== null && info.supplyFmt > 0;
  if (!usdtPool && !wbnbPool) {
    return { rating: "DEAD", line: "No DEX liquidity found — untradeable." };
  }
  if (liq < 500) {
    return { rating: "RADIOACTIVE", line: "Liquidity under $500 — a single sell can nuke it." };
  }
  if (liq < 5000) {
    return { rating: "COOKED", line: "Thin liquidity (<$5k) — exit will hurt." };
  }
  if (liq < 20000 || !info.ownerRenounced) {
    return { rating: "MID", line: info.ownerRenounced ? "Decent liquidity but still small." : "Owner still holds contract privileges." };
  }
  if (liq >= 20000 && info.ownerRenounced && hasSupply) {
    return { rating: "BASED", line: "Deep liquidity, ownership renounced, live supply — the clean setup." };
  }
  return { rating: "MID", line: "Mixed signals." };
}

export const VERDICT_ENDPOINTS = [
  {
    path: "/verdict",
    usd: 0.01,
    summary: "BSC token verdict: BASED / MID / COOKED / RADIOACTIVE / DEAD with one-line call and live metrics. $0.01 (half of AX1).",
    params: [{ name: "token", in: "query", required: true, schema: { type: "string" }, description: "BSC token address" }],
    handler: async (req, res) => {
      const t = String(req.query.token || "");
      if (!validAddr(t)) return res.status(400).json({ error: "bad_token" });
      const [info, usdtPool, wbnbPool] = await Promise.all([
        tokenInfo(t).catch(() => null),
        pairInfo(t, USDT).catch(() => null),
        pairInfo(t, WBNB).catch(() => null),
      ]);
      if (!info) return res.status(502).json({ error: "upstream_failed" });
      const g = grade(info, usdtPool, wbnbPool);
      res.json({
        token: t.toLowerCase(),
        symbol: info.symbol,
        name: info.name,
        rating: g.rating,
        verdict: g.line,
        metrics: {
          liquidityUSDT: usdtPool ? Number((Number(usdtPool.rQuote) / 1e18).toFixed(2)) : 0,
          priceUSDT: usdtPool ? Number(usdtPool.price.toFixed(12)) : null,
          ownerRenounced: info.ownerRenounced,
          owner: info.owner,
          supply: info.supplyFmt,
          pools: [usdtPool?.pair, wbnbPool?.pair].filter(Boolean),
        },
        asOf: new Date().toISOString(),
      });
    },
  },
  {
    path: "/verdict/batch",
    usd: 0.04,
    summary: "Batch verdict for up to 5 BSC tokens (comma-separated).",
    params: [{ name: "tokens", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated addresses" }],
    handler: async (req, res) => {
      const list = String(req.query.tokens || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
      if (!list.length || !list.every(validAddr)) return res.status(400).json({ error: "bad_tokens" });
      const out = [];
      for (const t of list) {
        const [info, usdtPool, wbnbPool] = await Promise.all([
          tokenInfo(t).catch(() => null),
          pairInfo(t, USDT).catch(() => null),
          pairInfo(t, WBNB).catch(() => null),
        ]);
        if (!info) { out.push({ token: t.toLowerCase(), error: "upstream_failed" }); continue; }
        const g = grade(info, usdtPool, wbnbPool);
        out.push({ token: t.toLowerCase(), symbol: info.symbol, rating: g.rating, verdict: g.line, liquidityUSDT: usdtPool ? Number((Number(usdtPool.rQuote) / 1e18).toFixed(2)) : 0 });
      }
      res.json({ count: out.length, verdicts: out, asOf: new Date().toISOString() });
    },
  },
];

export const VERDICT_ROUTES = Object.fromEntries(
  VERDICT_ENDPOINTS.map((ep) => ["GET " + ep.path, { accepts: (() => {
    const bsc = BigInt(Math.round(ep.usd * 1e18));
    const base = BigInt(Math.round(ep.usd * 1e6));
    return [
      { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
      { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
    ];
  })(), description: ep.summary, mimeType: "application/json" }]),
);

export const VERDICT_PATHS = Object.fromEntries(
  VERDICT_ENDPOINTS.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params,
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "Verdict" }, "402": { description: "Payment Required" } },
    },
  }]),
);
