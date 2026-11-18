// kinegrant-x402 链上数据服务 v2（不依赖钱包 session，可部署到阿里云函数计算）
// GET /health                       免费
// GET /token?address=0x...          付费 $0.02  BSC 代币尽调：元信息 + USDT 池价格 + 流动性深度 + owner 状态
// GET /price?token=0x...&amount=1   付费 $0.01  PancakeSwap USDT 池即时价格
import fs from "node:fs";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  declareDiscoveryExtension,
  bazaarResourceServerExtension,
} from "@x402/extensions/bazaar";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { EXTRA_ENDPOINTS, EXTRA_ROUTES, EXTRA_PATHS } from "./extra-endpoints.mjs";
import { MATRIX2, MATRIX2_ROUTES, MATRIX2_PATHS } from "./extra-endpoints2.mjs";
import { MULTICHAIN, MULTICHAIN_ROUTES, MULTICHAIN_PATHS } from "./multi-chain.mjs";
import { EXTENDED, EXTENDED_ROUTES, EXTENDED_PATHS } from "./extended-chains.mjs";
import { TOOLS, TOOLS_ROUTES, TOOLS_PATHS } from "./extended-tools.mjs";
import { AI_ENDPOINTS, AI_ROUTES, AI_PATHS } from "./ai-proxy.mjs";
import { OPENAI_ROUTES, OPENAI_PATHS, handleChatCompletions, handleModels } from "./openai-compat.mjs";
import { UTIL_ENDPOINTS, UTIL_ROUTES, UTIL_PATHS } from "./utility-xpay.mjs";
import { FREE_PATHS, issueChallenge, verifyPow } from "./pow.mjs";
import { VERDICT_ENDPOINTS, VERDICT_ROUTES, VERDICT_PATHS } from "./verdict.mjs";
import { EXPAND, EXPAND_ROUTES, EXPAND_PATHS } from "./expand-rpc.mjs";
import { SKILLS, SKILL_ROUTES, SKILL_PATHS } from "./skill-packs.mjs";
import { SKILLS2, SKILL2_ROUTES, SKILL2_PATHS } from "./skill-packs2.mjs";

const exec = promisify(execFile);
const PROXY = "http://127.0.0.1:7897";

const PORT = process.env.PORT || 3100;
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"; // PancakeSwap V2 Factory
const RPCS = [
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-rpc.publicnode.com",
];

const facilitator = new HTTPFacilitatorClient({
  url: "https://facilitator.payai.network",
});
const resourceServer = new x402ResourceServer(facilitator)
  .register(NETWORK, new ExactEvmScheme())
  .register(BASE_NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

const discovery = declareDiscoveryExtension({
  method: "GET",
  input: { address: "0x9A0D1C8B1B0E4D3C2A1F0E9D8C7B6A5F4E3D2C1B" },
  inputSchema: {
    type: "object",
    properties: {
      address: { type: "string", description: "BSC token contract address" },
    },
    required: ["address"],
  },
  output: {
    example: {
      address: "0x...", name: "Token", symbol: "TKN", decimals: 18,
      supply: "1000", priceUSDT: "0.42", liquidityUSDT: "12500",
      ownerRenounced: true, verdict: "LOW",
    },
  },
});

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "64kb" }));

app.use(
  paymentMiddleware(
    {
      "GET /token": {
        accepts: [{
          scheme: "exact",
          price: { amount: "20000000000000000", asset: USDT }, // 0.02 USDT (18 dec)
          network: NETWORK,
          payTo: PAY_TO,
          extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 },
        },
        {
          scheme: "exact",
          price: { amount: "20000", asset: BASE_USDC },
          network: BASE_NETWORK,
          payTo: PAY_TO,
          extra: { name: "USD Coin", version: "2" },
        }],
        description: "BSC token due-diligence: name/symbol/decimals/supply, PancakeSwap USDT-pool price, liquidity depth in USDT, owner-renounce check.",
        mimeType: "application/json",
        extensions: discovery,
      },
      "GET /price": {
        accepts: [{
          scheme: "exact",
          price: { amount: "10000000000000000", asset: USDT }, // 0.01 USDT
          network: NETWORK,
          payTo: PAY_TO,
          extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 },
        },
        {
          scheme: "exact",
          price: { amount: "10000", asset: BASE_USDC },
          network: BASE_NETWORK,
          payTo: PAY_TO,
          extra: { name: "USD Coin", version: "2" },
        }],
        description: "PancakeSwap V2 USDT-pool spot price for any BSC token.",
        mimeType: "application/json",
      },
      "GET /wallet": {
        accepts: [{
          scheme: "exact",
          price: { amount: "50000000000000000", asset: USDT }, // 0.05 USDT
          network: NETWORK,
          payTo: PAY_TO,
          extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 },
        },
        {
          scheme: "exact",
          price: { amount: "50000", asset: BASE_USDC },
          network: BASE_NETWORK,
          payTo: PAY_TO,
          extra: { name: "USD Coin", version: "2" },
        }],
        description: "BSC wallet portfolio snapshot: BNB native balance, USDT+USDC token balances with USD valuation at live PancakeSwap prices.",
        mimeType: "application/json",
      },
      "GET /signals": {
        accepts: [{
          scheme: "exact",
          price: { amount: "100000000000000000", asset: USDT }, // 0.10 USDT
          network: NETWORK,
          payTo: PAY_TO,
          extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 },
        },
        {
          scheme: "exact",
          price: { amount: "100000", asset: BASE_USDC },
          network: BASE_NETWORK,
          payTo: PAY_TO,
          extra: { name: "USD Coin", version: "2" },
        }],
        description: "BSC live meme launch signals (Four.meme/Flap) filtered for due diligence: no high-tax token, no dev-closed position, no low liquidity, market cap < $150K, signal age < 30 min. Returns BUY candidates only.",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

// ---------- 链上工具 ----------
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
const SEL = {
  name: "0x06fdde03", symbol: "0x95d89b41", decimals: "0x313ce567",
  totalSupply: "0x18160ddd", owner: "0x8da5cb5b", token0: "0x0dfe1681",
};
async function ethCall(to, data) { return rpcCall("eth_call", [{ to, data }, "latest"]); }
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
  const [nameHex, symHex, decHex, supHex, ownHex] = await Promise.all([
    ethCall(address, SEL.name).catch(() => null),
    ethCall(address, SEL.symbol).catch(() => null),
    ethCall(address, SEL.decimals).catch(() => null),
    ethCall(address, SEL.totalSupply).catch(() => null),
    ethCall(address, SEL.owner).catch(() => null),
  ]);
  const decimals = decHex ? parseInt(decHex, 16) : 18;
  const supply = decodeUint(supHex);
  const ownerRaw = ownHex && ownHex !== "0x" ? ownHex.replace(/^0x/, "") : null;
  const owner = ownerRaw && ownerRaw !== "0".repeat(64) ? "0x" + ownerRaw.slice(-40) : null;
  return {
    address: address.toLowerCase(),
    name: decodeString(nameHex),
    symbol: decodeString(symHex),
    decimals,
    supply,
    supplyFmt: supply ? Number(supply) / 10 ** decimals : null,
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
    ethCall(pair, SEL.token0).catch(() => null),
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

function validAddr(a) { return /^0x[0-9a-fA-F]{40}$/.test(a); }

app.get("/agents.md", (_req, res) => {
  try {
    const md = fs.readFileSync(new URL("./agents.md", import.meta.url), "utf8");
    res.type("text/markdown").send(md);
  } catch (e) {
    res.status(500).type("text/plain").send("agents.md unavailable");
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "kinegrant-x402", version: 2, ts: Date.now() });
});

// ---------- OpenAPI discovery 文档（x402scan 要求 /openapi.json） ----------
const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "KineGrant BSC Data API",
    version: "1.0.0",
    description:
      "Machine-payable BSC data API (x402). GET /health is free. Paid endpoints return HTTP 402 with a base64 PAYMENT-REQUIRED header describing a USDT payment on BNB Smart Chain (eip155:56, permit2). Sign and replay the same request with the PAYMENT-SIGNATURE header. Prices in x-payment-info are decimal USD; runtime accepts[].amount uses token atomic units (18 decimals).",
    "x-guidance":
      "Call any paid endpoint without a payment header first: the 402 response carries the full challenge in the PAYMENT-REQUIRED header (base64 JSON, accepts[] with network eip155:56, asset 0x55d398326f99059fF775485246999027B3197955, atomic amount, payTo 0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E). Use an x402-capable client (or baw x402-payment preview/sign) to settle, then replay the identical request with PAYMENT-SIGNATURE. All responses are JSON.",
    contact: { email: "founder@kineworld.com" },
  },
  servers: [{ url: "https://api.kinegrant.com" }],
  paths: {
    "/health": {
      get: {
        summary: "Health check (free)",
        security: [],
        responses: { "200": { description: "Service status" } },
      },
    },
    "/token": {
      get: {
        summary: "BSC token due diligence",
        description: "Token metadata, USDT-pool price, liquidity depth, owner-renounce status.",
        parameters: [
          { name: "address", in: "query", required: true, schema: { type: "string" }, description: "BSC token contract address (0x + 40 hex)" },
        ],
        "x-payment-info": {
          price: { mode: "fixed", currency: "USD", amount: "0.02" },
          protocols: [{ x402: {} }],
        },
        responses: {
          "200": { description: "Token report" },
          "402": { description: "Payment Required" },
        },
      },
    },
    "/price": {
      get: {
        summary: "PancakeSwap V2 USDT-pool spot price",
        description: "Live spot price and liquidity for any BSC token with a USDT pool.",
        parameters: [
          { name: "token", in: "query", required: true, schema: { type: "string" }, description: "BSC token contract address" },
        ],
        "x-payment-info": {
          price: { mode: "fixed", currency: "USD", amount: "0.01" },
          protocols: [{ x402: {} }],
        },
        responses: {
          "200": { description: "Price and liquidity" },
          "402": { description: "Payment Required" },
        },
      },
    },
    "/wallet": {
      get: {
        summary: "BSC wallet portfolio snapshot",
        description: "BNB/USDT/USDC balances with USD valuation at live PancakeSwap prices.",
        parameters: [
          { name: "address", in: "query", required: true, schema: { type: "string" }, description: "BSC wallet address" },
        ],
        "x-payment-info": {
          price: { mode: "fixed", currency: "USD", amount: "0.05" },
          protocols: [{ x402: {} }],
        },
        responses: {
          "200": { description: "Portfolio snapshot" },
          "402": { description: "Payment Required" },
        },
      },
    },
    "/signals": {
      get: {
        summary: "BSC live meme launch signals (filtered)",
        description:
          "Four.meme/Flap launch signals filtered for due diligence: no high-tax token, no dev-closed position, no low liquidity, market cap < $150K, signal age < 30 min. Returns BUY candidates only.",
        parameters: [
          { name: "range", in: "query", required: false, schema: { type: "string", enum: ["5m", "1h", "24h"] }, description: "Lookback window, default 1h" },
        ],
        "x-payment-info": {
          price: { mode: "fixed", currency: "USD", amount: "0.10" },
          protocols: [{ x402: {} }],
        },
        responses: {
          "200": { description: "Signal screen result" },
          "402": { description: "Payment Required" },
        },
      },
    },
  },
};
app.use(paymentMiddleware(EXTRA_ROUTES, resourceServer));
for (const ep of EXTRA_ENDPOINTS) {
  app.get(ep.path, ep.handler);
}

app.use(paymentMiddleware(MATRIX2_ROUTES, resourceServer));
for (const ep of MATRIX2) {
  app.get(ep.path, ep.handler);
}

app.use(paymentMiddleware(MULTICHAIN_ROUTES, resourceServer));
for (const ep of MULTICHAIN) {
  app.get(ep.path, ep.handler);
}

app.use(paymentMiddleware(EXTENDED_ROUTES, resourceServer));
for (const ep of EXTENDED) {
  app.get(ep.path, ep.handler);
}

app.use(paymentMiddleware(AI_ROUTES, resourceServer));
for (const ep of AI_ENDPOINTS) {
  app.get(ep.path, ep.handler);
}

app.use(paymentMiddleware(EXPAND_ROUTES, resourceServer));
for (const ep of EXPAND) {
  app.get(ep.path, ep.handler);
}

app.use(paymentMiddleware(SKILL2_ROUTES, resourceServer));
for (const ep of SKILLS2) {
  app.get(ep.path, ep.handler);
}

app.use(paymentMiddleware(SKILL_ROUTES, resourceServer));
for (const ep of SKILLS) {
  app.get(ep.path, ep.handler);
}

app.use(paymentMiddleware(VERDICT_ROUTES, resourceServer));
for (const ep of VERDICT_ENDPOINTS) {
  app.get(ep.path, ep.handler);
}

const UTIL_ROUTES_PAID = Object.fromEntries(
  Object.entries(UTIL_ROUTES).filter(([k]) => !FREE_PATHS.has(k.replace("GET ", ""))),
);
app.use(paymentMiddleware(UTIL_ROUTES_PAID, resourceServer));

// PoW gate：免费路径 = PoW 有效则放行，否则 402（提示去 /pow/challenge）
app.use((req, res, next) => {
  const p = req.path;
  if (!FREE_PATHS.has(p)) return next();
  if (verifyPow(req.headers["x-pow"]).ok) return next();
  res.status(402).json({
    error: "payment_required_or_pow",
    hint: "GET /pow/challenge, solve sha256(challenge + ':' + nonce) to start with N hex zeros, then retry with header X-PoW: <challenge>:<nonce>",
    powEndpoint: "/pow/challenge",
    asOf: new Date().toISOString(),
  });
});

app.get("/pow/challenge", (_req, res) => res.json(issueChallenge()));
for (const ep of UTIL_ENDPOINTS) {
  if (ep.method === "POST") app.post(ep.path, ep.handler);
  else app.get(ep.path, ep.handler);
}

app.use(paymentMiddleware(OPENAI_ROUTES, resourceServer));
app.post("/v1/chat/completions", handleChatCompletions);
app.get("/v1/models", handleModels);

app.use(paymentMiddleware(TOOLS_ROUTES, resourceServer));
for (const ep of TOOLS) {
  app.get(ep.path, ep.handler);
}

app.get("/openapi.json", (_req, res) => {
  const merged = {
    ...OPENAPI,
    paths: { ...OPENAPI.paths, ...EXTRA_PATHS, ...MATRIX2_PATHS, ...MULTICHAIN_PATHS, ...EXTENDED_PATHS, ...TOOLS_PATHS, ...AI_PATHS, ...OPENAI_PATHS, ...UTIL_PATHS, ...VERDICT_PATHS, ...EXPAND_PATHS, ...SKILL_PATHS, ...SKILL2_PATHS,
    "/pow/challenge": {
      get: {
        summary: "Get a proof-of-work challenge to call CPU-only endpoints for free",
        security: [],
        responses: { "200": { description: "challenge + difficulty" } },
      },
    },
    },
  };
  res.json(merged);
});

app.get("/token", async (req, res) => {
  try {
    const address = String(req.query.address || "");
    if (!validAddr(address)) return res.status(400).json({ error: "bad_address" });
    const [info, pair] = await Promise.all([
      tokenInfo(address),
      pairInfo(address, USDT).catch(() => null),
    ]);
    let verdict = "NO_USDT_POOL";
    if (pair) {
      const liq = Number(pair.rQuote) / 1e18;
      if (liq < 1000) verdict = "LOW_LIQ";
      else if (liq < 20000) verdict = "THIN_LIQ";
      else if (!info.ownerRenounced) verdict = "DEV_OWNS";
      else verdict = "LOW";
    }
    res.json({
      ...info,
      pool: pair ? { pair: pair.pair, priceUSDT: Number(pair.price.toFixed(12)), liquidityUSDT: Number((Number(pair.rQuote) / 1e18).toFixed(2)) } : null,
      risk: { verdict },
      asOf: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: "upstream_failed", message: String(e?.message || e) });
  }
});

app.get("/price", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!validAddr(token)) return res.status(400).json({ error: "bad_token" });
    const pair = await pairInfo(token, USDT).catch(() => null);
    if (!pair) return res.status(404).json({ error: "no_usdt_pool" });
    res.json({
      token: token.toLowerCase(),
      priceUSDT: Number(pair.price.toFixed(12)),
      liquidityUSDT: Number((Number(pair.rQuote) / 1e18).toFixed(2)),
      asOf: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: "upstream_failed", message: String(e?.message || e) });
  }
});

// ---------- /wallet：BSC 钱包持仓快照 ----------
const ERC20_BALANCE_OF = "0x70a08231";
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

async function nativeBalance(holder) {
  const out = await rpcCall("eth_getBalance", [holder, "latest"]);
  return out ? BigInt(out).toString() : "0";
}

async function tokenBalance(token, holder) {
  const out = await ethCall(token, ERC20_BALANCE_OF + encAddr(holder)).catch(() => null);
  return out ? BigInt(out).toString() : "0";
}

app.get("/wallet", async (req, res) => {
  try {
    const address = String(req.query.address || "");
    if (!validAddr(address)) return res.status(400).json({ error: "bad_address" });

    const [bnbWei, usdtRaw, usdcRaw, bnbPair] = await Promise.all([
      nativeBalance(address).catch(() => "0"),
      tokenBalance(USDT, address),
      tokenBalance(USDC_BSC, address),
      pairInfo(WBNB, USDT).catch(() => null),
    ]);

    const bnb = Number(bnbWei) / 1e18;
    const usdt = Number(usdtRaw) / 1e18;
    const usdc = Number(usdcRaw) / 1e18;
    const bnbPrice = bnbPair ? bnbPair.price : 0;

    const holdings = [
      { symbol: "BNB", amount: bnb, priceUSDT: Number(bnbPrice.toFixed(6)), valueUSD: Number((bnb * bnbPrice).toFixed(4)) },
      { symbol: "USDT", amount: usdt, priceUSDT: 1, valueUSD: Number(usdt.toFixed(4)) },
      { symbol: "USDC", amount: usdc, priceUSDT: 1, valueUSD: Number(usdc.toFixed(4)) },
    ].filter((h) => h.amount > 0);

    res.json({
      address: address.toLowerCase(),
      chain: "BSC (eip155:56)",
      holdings,
      totalUSD: Number(holdings.reduce((s, h) => s + h.valueUSD, 0).toFixed(4)),
      bnbPriceUSDT: Number(bnbPrice.toFixed(6)),
      asOf: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: "upstream_failed", message: String(e?.message || e) });
  }
});

// ---------- /signals：BSC meme 发射信号（baw signal 数据源，筛选后） ----------
async function runBaw(args) {
  const r = await exec("baw", args, {
    timeout: 60000,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, HTTPS_PROXY: PROXY, HTTP_PROXY: PROXY, NODE_USE_ENV_PROXY: "1" },
    shell: true,
  });
  return JSON.parse(r.stdout);
}

app.get("/signals", async (req, res) => {
  try {
    const range = String(req.query.range || "1h");
    const raw = await runBaw([
      "signal", "list", "--chain-id", "56", "--time-range", range,
      "--page-size", "100", "--sort-by", "time", "--json",
    ]);
    if (!raw.success) {
      return res.status(502).json({ error: "signal_source_failed", detail: raw.error });
    }
    const now = Date.now();
    const list = Array.isArray(raw.data?.list) ? raw.data.list : [];
    const rows = list.map((s) => {
      const tags = [];
      for (const k of Object.keys(s.tokenTag || {})) {
        for (const t of s.tokenTag[k] || []) tags.push(t.tagName);
      }
      const ageMin = s.signalTriggerTime
        ? Math.round((now - Number(s.signalTriggerTime)) / 60000)
        : null;
      const mc = s.alertMarketCap ? Number(s.alertMarketCap) : 0;
      const reasons = [];
      if (tags.includes("High Tax Token")) reasons.push("HIGH_TAX");
      if (tags.includes("DEV Close Position")) reasons.push("DEV_CLOSED");
      if (tags.includes("Low Liquidity")) reasons.push("LOW_LIQ");
      if (ageMin !== null && ageMin > 30) reasons.push("STALE");
      if (mc > 150000) reasons.push("MC_HIGH");
      return {
        ticker: s.ticker,
        contract: s.contractAddress,
        ageMin,
        alertMarketCap: mc,
        maxGain: s.maxGain ?? null,
        source: s.signalSource,
        smartMoneyCount: s.smartMoneyCount ?? null,
        verdict: reasons.length === 0 ? "BUY_CANDIDATE" : "REJECT",
        reasons,
      };
    });
    const candidates = rows.filter((r) => r.verdict === "BUY_CANDIDATE");
    res.json({
      scanned: rows.length,
      candidates: candidates.length,
      buy: candidates,
      rejected: rows.length - candidates.length,
      asOf: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: "signal_source_failed", message: String(e?.message || e) });
  }
});

export { app };
