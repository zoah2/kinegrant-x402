// 端点矩阵：18 个细分数据端点（BSC + Base 双网络收款）
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const USDT = "0x55d398326f99059fF775485246999027B3197955";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
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

async function ethCall(to, data) {
  return rpcCall("eth_call", [{ to, data }, "latest"]);
}

function decodeString(hex) {
  if (!hex || hex === "0x") return null;
  const h = hex.replace(/^0x/, "");
  try {
    const len = parseInt(h.slice(64, 128), 16);
    return Buffer.from(h.slice(128, 128 + len * 2), "hex").toString("utf8");
  } catch { return null; }
}

function decodeUint(hex) {
  if (!hex || hex === "0x") return null;
  return BigInt(hex).toString();
}

async function tokenInfo(address) {
  const [nameHex, symbolHex, decHex, supplyHex, ownerHex] = await Promise.all([
    ethCall(address, "0x06fdde03").catch(() => null),
    ethCall(address, "0x95d89b41").catch(() => null),
    ethCall(address, "0x313ce567").catch(() => null),
    ethCall(address, "0x18160ddd").catch(() => null),
    ethCall(address, "0x8da5cb5b").catch(() => null),
  ]);
  const decimals = decHex ? Number(BigInt(decHex)) : null;
  const supply = decodeUint(supplyHex);
  const owner = ownerHex && ownerHex !== "0x" ? "0x" + ownerHex.slice(-40) : null;
  return {
    name: decodeString(nameHex),
    symbol: decodeString(symbolHex),
    decimals,
    supply,
    supplyFmt: supply && decimals !== null ? Number(supply) / 10 ** decimals : null,
    owner,
    ownerRenounced: owner === null,
  };
}

async function pairInfo(token, quote) {
  const pairHex = await ethCall(FACTORY, "0xe6a43905" + encAddr(token) + encAddr(quote));
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
  const tokenIs0 = t0 ? t0.toLowerCase() === token.toLowerCase() : token.toLowerCase() < quote.toLowerCase();
  const [rToken, rQuote] = tokenIs0 ? [r0, r1] : [r1, r0];
  if (rToken === 0n) return null;
  return { pair, rToken, rQuote, price: Number(rQuote) / Number(rToken) };
}

async function nativeBalance(holder) {
  const out = await rpcCall("eth_getBalance", [holder, "latest"]);
  return out ? BigInt(out).toString() : "0";
}

async function tokenBalance(token, holder) {
  const out = await ethCall(token, "0x70a08231" + encAddr(holder)).catch(() => null);
  return out ? BigInt(out).toString() : "0";
}

async function runBaw(args) {
  const r = await exec("baw", args, {
    timeout: 60000,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, HTTPS_PROXY: "http://127.0.0.1:7897", HTTP_PROXY: "http://127.0.0.1:7897", NODE_USE_ENV_PROXY: "1" },
    shell: true,
  });
  return JSON.parse(r.stdout);
}

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18));
  const base = BigInt(Math.round(usd * 1e6));
  return [
    {
      scheme: "exact",
      price: { amount: bsc.toString(), asset: USDT },
      network: NETWORK,
      payTo: PAY_TO,
      extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 },
    },
    {
      scheme: "exact",
      price: { amount: base.toString(), asset: BASE_USDC },
      network: BASE_NETWORK,
      payTo: PAY_TO,
      extra: { name: "USD Coin", version: "2" },
    },
  ];
}

// ---------- 端点定义 ----------
export const EXTRA_ENDPOINTS = [
  {
    path: "/token/liquidity", usd: 0.01,
    summary: "BSC token liquidity depth (USDT pool, USD value)",
    params: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => {
      const token = String(req.query.token || "");
      if (!validAddr(token)) return res.status(400).json({ error: "bad_token" });
      const pair = await pairInfo(token, USDT).catch(() => null);
      if (!pair) return res.status(404).json({ error: "no_usdt_pool" });
      res.json({ token: token.toLowerCase(), pair: pair.pair, liquidityUSDT: Number((Number(pair.rQuote) / 1e18).toFixed(2)), depthToken: Number(pair.rToken) / 1e18, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/token/owner", usd: 0.01,
    summary: "BSC token owner address and renounce status",
    params: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => {
      const token = String(req.query.token || "");
      if (!validAddr(token)) return res.status(400).json({ error: "bad_token" });
      const ownerHex = await ethCall(token, "0x8da5cb5b").catch(() => null);
      const owner = ownerHex && ownerHex !== "0x" ? "0x" + ownerHex.slice(-40) : null;
      res.json({ token: token.toLowerCase(), owner, renounced: owner === null, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/token/supply", usd: 0.01,
    summary: "BSC token total supply (raw + formatted)",
    params: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => {
      const token = String(req.query.token || "");
      if (!validAddr(token)) return res.status(400).json({ error: "bad_token" });
      const [supHex, decHex] = await Promise.all([
        ethCall(token, "0x18160ddd").catch(() => null),
        ethCall(token, "0x313ce567").catch(() => null),
      ]);
      const supply = decodeUint(supHex);
      const decimals = decHex ? Number(BigInt(decHex)) : null;
      res.json({ token: token.toLowerCase(), supply, decimals, supplyFmt: supply && decimals !== null ? Number(supply) / 10 ** decimals : null, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/token/pairs", usd: 0.02,
    summary: "BSC token pools against USDT and WBNB",
    params: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => {
      const token = String(req.query.token || "");
      if (!validAddr(token)) return res.status(400).json({ error: "bad_token" });
      const [usdtPool, wbnbPool] = await Promise.all([
        pairInfo(token, USDT).catch(() => null),
        pairInfo(token, WBNB).catch(() => null),
      ]);
      const fmt = (p) => (p ? { pair: p.pair, price: Number(p.price.toFixed(12)), quoteReserve: Number(p.rQuote) / 1e18 } : null);
      res.json({ token: token.toLowerCase(), usdtPool: fmt(usdtPool), wbnbPool: fmt(wbnbPool), asOf: new Date().toISOString() });
    },
  },
  {
    path: "/token/risk", usd: 0.03,
    summary: "BSC token risk score: liquidity, owner renounce, pool presence",
    params: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => {
      const token = String(req.query.token || "");
      if (!validAddr(token)) return res.status(400).json({ error: "bad_token" });
      const [info, pair] = await Promise.all([tokenInfo(token), pairInfo(token, USDT).catch(() => null)]);
      const liq = pair ? Number(pair.rQuote) / 1e18 : 0;
      let score = 100;
      const findings = [];
      if (!pair) { score -= 50; findings.push("NO_USDT_POOL"); }
      else if (liq < 1000) { score -= 40; findings.push("LIQUIDITY_LT_1K"); }
      else if (liq < 20000) { score -= 20; findings.push("LIQUIDITY_LT_20K"); }
      if (!info.ownerRenounced) { score -= 30; findings.push("OWNER_NOT_RENOUNCED"); }
      if (info.decimals === null) { score -= 10; findings.push("NO_DECIMALS"); }
      res.json({ token: token.toLowerCase(), score: Math.max(0, score), findings, liquidityUSDT: Number(liq.toFixed(2)), ownerRenounced: info.ownerRenounced, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/wallet/balance", usd: 0.01,
    summary: "BSC native BNB balance for an address",
    params: [{ name: "address", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => {
      const address = String(req.query.address || "");
      if (!validAddr(address)) return res.status(400).json({ error: "bad_address" });
      const wei = await nativeBalance(address);
      res.json({ address: address.toLowerCase(), bnb: Number(wei) / 1e18, wei, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/wallet/tokens", usd: 0.03,
    summary: "BSC token balances for an address (USDT/USDC/WBNB)",
    params: [{ name: "address", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => {
      const address = String(req.query.address || "");
      if (!validAddr(address)) return res.status(400).json({ error: "bad_address" });
      const [usdt, usdc, wbnb] = await Promise.all([
        tokenBalance(USDT, address),
        tokenBalance(USDC_BSC, address),
        tokenBalance(WBNB, address),
      ]);
      res.json({
        address: address.toLowerCase(),
        tokens: [
          { symbol: "USDT", raw: usdt, amount: Number(usdt) / 1e18 },
          { symbol: "USDC", raw: usdc, amount: Number(usdc) / 1e18 },
          { symbol: "WBNB", raw: wbnb, amount: Number(wbnb) / 1e18 },
        ],
        asOf: new Date().toISOString(),
      });
    },
  },
  {
    path: "/market/gas", usd: 0.005,
    summary: "BSC current gas price (gwei)",
    handler: async (_req, res) => {
      const hex = await rpcCall("eth_gasPrice", []);
      const wei = BigInt(hex);
      res.json({ gasPriceWei: wei.toString(), gwei: Number(wei) / 1e9, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/market/block", usd: 0.005,
    summary: "BSC latest block number and timestamp",
    handler: async (_req, res) => {
      const hex = await rpcCall("eth_blockNumber", []);
      const n = parseInt(hex, 16);
      const block = await rpcCall("eth_getBlockByNumber", [hex, false]).catch(() => null);
      res.json({ blockNumber: n, timestamp: block?.timestamp ? parseInt(block.timestamp, 16) : null, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/market/wbnb", usd: 0.01,
    summary: "WBNB price in USDT and pool liquidity",
    handler: async (_req, res) => {
      const pair = await pairInfo(WBNB, USDT).catch(() => null);
      if (!pair) return res.status(502).json({ error: "no_pool" });
      res.json({ wbnbUSDT: Number(pair.price.toFixed(6)), liquidityUSDT: Number((Number(pair.rQuote) / 1e18).toFixed(2)), pair: pair.pair, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/market/overview", usd: 0.02,
    summary: "BSC market overview: BNB price, gas, latest block",
    handler: async (_req, res) => {
      const [pair, gasHex, blockHex] = await Promise.all([
        pairInfo(WBNB, USDT).catch(() => null),
        rpcCall("eth_gasPrice", []).catch(() => null),
        rpcCall("eth_blockNumber", []).catch(() => null),
      ]);
      res.json({
        bnbUSDT: pair ? Number(pair.price.toFixed(6)) : null,
        gasGwei: gasHex ? Number(BigInt(gasHex)) / 1e9 : null,
        blockNumber: blockHex ? parseInt(blockHex, 16) : null,
        asOf: new Date().toISOString(),
      });
    },
  },
  {
    path: "/signals/fourmeme", usd: 0.10,
    summary: "Four.meme launch signals only (filtered)",
    handler: async (req, res) => {
      const raw = await runBaw(["signal", "list", "--chain-id", "56", "--time-range", String(req.query.range || "1h"), "--page-size", "100", "--sort-by", "time", "--json"]);
      if (!raw.success) return res.status(502).json({ error: "signal_source_failed" });
      const list = Array.isArray(raw.data?.list) ? raw.data.list : [];
      res.json({ source: "fourmeme", count: list.length, signals: list.map((s) => ({ ticker: s.ticker, contract: s.contractAddress, marketCap: s.alertMarketCap, maxGain: s.maxGain, ts: s.signalTriggerTime })).slice(0, 50), asOf: new Date().toISOString() });
    },
  },
  {
    path: "/signals/flap", usd: 0.10,
    summary: "Flap launch signals only (filtered)",
    handler: async (req, res) => {
      const raw = await runBaw(["signal", "list", "--chain-id", "56", "--time-range", String(req.query.range || "1h"), "--page-size", "100", "--sort-by", "time", "--json"]);
      if (!raw.success) return res.status(502).json({ error: "signal_source_failed" });
      const list = (Array.isArray(raw.data?.list) ? raw.data.list : []).filter((s) => String(s.signalSource || "").toLowerCase().includes("flap"));
      res.json({ source: "flap", count: list.length, signals: list.map((s) => ({ ticker: s.ticker, contract: s.contractAddress, marketCap: s.alertMarketCap, maxGain: s.maxGain, ts: s.signalTriggerTime })).slice(0, 50), asOf: new Date().toISOString() });
    },
  },
  {
    path: "/signals/stats", usd: 0.05,
    summary: "Signal statistics: counts by source and gain buckets",
    handler: async (_req, res) => {
      const raw = await runBaw(["signal", "list", "--chain-id", "56", "--time-range", "24h", "--page-size", "100", "--sort-by", "time", "--json"]);
      if (!raw.success) return res.status(502).json({ error: "signal_source_failed" });
      const list = Array.isArray(raw.data?.list) ? raw.data.list : [];
      const bySource = {};
      let withGain = 0, bigWin = 0;
      for (const s of list) {
        const src = s.signalSource || "unknown";
        bySource[src] = (bySource[src] || 0) + 1;
        const g = Number(s.maxGain || 0);
        if (g > 0) withGain += 1;
        if (g >= 3) bigWin += 1;
      }
      res.json({ total: list.length, bySource, withGain, bigWin3x: bigWin, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/alpha", usd: 0.15,
    summary: "Combined BUY-candidate screen: signals + risk filter + liquidity check",
    handler: async (req, res) => {
      const raw = await runBaw(["signal", "list", "--chain-id", "56", "--time-range", String(req.query.range || "1h"), "--page-size", "100", "--sort-by", "time", "--json"]);
      if (!raw.success) return res.status(502).json({ error: "signal_source_failed" });
      const now = Date.now();
      const list = Array.isArray(raw.data?.list) ? raw.data.list : [];
      const out = [];
      for (const s of list.slice(0, 20)) {
        const tags = Object.values(s.tokenTag || {}).flat().map((t) => t.tagName);
        const ageMin = s.signalTriggerTime ? Math.round((now - Number(s.signalTriggerTime)) / 60000) : null;
        const mc = Number(s.alertMarketCap || 0);
        if (tags.includes("High Tax Token") || tags.includes("DEV Close Position") || tags.includes("Low Liquidity")) continue;
        if (ageMin !== null && ageMin > 30) continue;
        if (mc > 150000) continue;
        const pair = await pairInfo(s.contractAddress, USDT).catch(() => null);
        const liq = pair ? Number(pair.rQuote) / 1e18 : 0;
        out.push({ ticker: s.ticker, contract: s.contractAddress, marketCap: mc, ageMin, liquidityUSDT: Number(liq.toFixed(2)), maxGain: s.maxGain ?? null });
      }
      res.json({ candidates: out.length, list: out, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/due-diligence", usd: 0.05,
    summary: "Complete token due diligence: metadata + pools + risk score",
    params: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => {
      const token = String(req.query.token || "");
      if (!validAddr(token)) return res.status(400).json({ error: "bad_token" });
      const [info, usdtPool, wbnbPool] = await Promise.all([
        tokenInfo(token),
        pairInfo(token, USDT).catch(() => null),
        pairInfo(token, WBNB).catch(() => null),
      ]);
      const liq = usdtPool ? Number(usdtPool.rQuote) / 1e18 : 0;
      let score = 100;
      if (!usdtPool) score -= 50;
      else if (liq < 1000) score -= 40;
      else if (liq < 20000) score -= 20;
      if (!info.ownerRenounced) score -= 30;
      res.json({
        token: token.toLowerCase(),
        info,
        usdtPool: usdtPool ? { pair: usdtPool.pair, priceUSDT: Number(usdtPool.price.toFixed(12)), liquidityUSDT: Number(liq.toFixed(2)) } : null,
        wbnbPool: wbnbPool ? { pair: wbnbPool.pair, priceWBNB: Number(wbnbPool.price.toFixed(12)) } : null,
        riskScore: Math.max(0, score),
        asOf: new Date().toISOString(),
      });
    },
  },
  {
    path: "/pair/price", usd: 0.01,
    summary: "Spot price between any two BSC tokens via PancakeSwap V2",
    params: [
      { name: "tokenA", in: "query", required: true, schema: { type: "string" } },
      { name: "tokenB", in: "query", required: true, schema: { type: "string" } },
    ],
    handler: async (req, res) => {
      const a = String(req.query.tokenA || "");
      const b = String(req.query.tokenB || "");
      if (!validAddr(a) || !validAddr(b)) return res.status(400).json({ error: "bad_tokens" });
      const pair = await pairInfo(a, b).catch(() => null);
      if (!pair) return res.status(404).json({ error: "no_pool" });
      res.json({ tokenA: a.toLowerCase(), tokenB: b.toLowerCase(), pair: pair.pair, price: Number(pair.price.toFixed(12)), asOf: new Date().toISOString() });
    },
  },
  {
    path: "/pair/reserves", usd: 0.01,
    summary: "Raw reserves of a token pair on PancakeSwap V2",
    params: [
      { name: "tokenA", in: "query", required: true, schema: { type: "string" } },
      { name: "tokenB", in: "query", required: true, schema: { type: "string" } },
    ],
    handler: async (req, res) => {
      const a = String(req.query.tokenA || "");
      const b = String(req.query.tokenB || "");
      if (!validAddr(a) || !validAddr(b)) return res.status(400).json({ error: "bad_tokens" });
      const pair = await pairInfo(a, b).catch(() => null);
      if (!pair) return res.status(404).json({ error: "no_pool" });
      res.json({ pair: pair.pair, reserveA: pair.rToken.toString(), reserveB: pair.rQuote.toString(), asOf: new Date().toISOString() });
    },
  },
];

export const EXTRA_ROUTES = Object.fromEntries(
  EXTRA_ENDPOINTS.map((ep) => [
    "GET " + ep.path,
    { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" },
  ]),
);

export const EXTRA_PATHS = Object.fromEntries(
  EXTRA_ENDPOINTS.map((ep) => [
    ep.path,
    {
      get: {
        summary: ep.summary,
        parameters:
          ep.params ||
          [
            {
              name: "chain",
              in: "query",
              required: false,
              schema: { type: "string", default: "56" },
              description: "Chain id, default 56 (BNB Smart Chain mainnet)",
            },
          ],
        "x-payment-info": {
          price: { mode: "fixed", currency: "USD", amount: String(ep.usd) },
          protocols: [{ x402: {} }],
        },
        responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
      },
    },
  ]),
);
