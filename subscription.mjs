// 订阅锁定：$1/天 unlimited（24h token，绕过按次付费）
import crypto from "node:crypto";

const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const TTL_MS = 24 * 3600 * 1000;

const tokens = new Map(); // token -> { expiry, created }

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18)), base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

export const SUB_ROUTES = {
  "GET /sub/daily": {
    accepts: acceptsFor(1),
    description: "Subscribe for 24h unlimited access: one $1 payment returns an X-Sub-Token valid for 24 hours on /skill/*, /verdict, /verdict/batch, /v1/chat/completions, /v1/claude, /v1/gpt, /bsc/*. Include header X-Sub-Token instead of paying per call.",
    mimeType: "application/json",
  },
};

export const SUB_PATHS = {
  "/sub/daily": {
    get: {
      summary: "Buy 24h unlimited subscription ($1) — returns X-Sub-Token",
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: "1" }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "{ token, expiresAt, covers: [...] }" }, "402": { description: "Payment Required" } },
    },
  },
};

// 受订阅保护的路径前缀（拿到 token 后免费调）
export const SUB_COVERED_PREFIXES = [
  "/skill/",
  "/verdict",
  "/bsc/",
  "/v1/chat/completions",
  "/v1/claude",
  "/v1/gpt",
];

export function isCovered(path) {
  return SUB_COVERED_PREFIXES.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(p + "?")));
}

export function issueToken() {
  const t = "sub_" + crypto.randomBytes(24).toString("hex");
  const expiry = Date.now() + TTL_MS;
  tokens.set(t, { expiry, created: Date.now() });
  // 清理过期
  for (const [k, v] of tokens) if (v.expiry <= Date.now()) tokens.delete(k);
  return { token: t, expiresAt: new Date(expiry).toISOString(), ttlHours: 24 };
}

export function isValidToken(t) {
  if (!t) return false;
  const rec = tokens.get(t);
  if (!rec) return false;
  if (rec.expiry <= Date.now()) { tokens.delete(t); return false; }
  return true;
}

// 早期中间件：有效 X-Sub-Token + 路径受保护 → 直接执行 handler（跳过按次付费）
export function makeSubMiddleware(handlerByPath) {
  return (req, res, next) => {
    const tok = req.headers["x-sub-token"];
    if (!tok || !isValidToken(tok)) return next();
    if (!isCovered(req.path)) return next();
    const h = handlerByPath[req.path];
    if (!h) return next();
    try {
      return h(req, res);
    } catch (e) {
      return res.status(500).json({ error: "handler_failed", message: String(e.message).slice(0, 200) });
    }
  };
}

// /sub/daily 的 handler（payer 拿到 token）
export function subHandler(req, res) {
  const r = issueToken();
  res.json({
    ...r,
    covers: SUB_COVERED_PREFIXES,
    howToUse: "Add header X-Sub-Token: <token> to any covered request — no per-call payment.",
    asOf: new Date().toISOString(),
  });
}
