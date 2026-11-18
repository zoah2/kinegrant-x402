// kinegrant-x402 链上数据服务 v2（不依赖钱包 session，可部署到阿里云函数计算）
// GET /health                       免费
// GET /token?address=0x...          付费 $0.02  BSC 代币尽调：元信息 + USDT 池价格 + 流动性深度 + owner 状态
// GET /price?token=0x...&amount=1   付费 $0.01  PancakeSwap USDT 池即时价格
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  declareDiscoveryExtension,
  bazaarResourceServerExtension,
} from "@x402/extensions/bazaar";

const PORT = process.env.PORT || 3100;
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
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
        }],
        description: "PancakeSwap V2 USDT-pool spot price for any BSC token.",
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

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "kinegrant-x402", version: 2, ts: Date.now() });
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`kinegrant-x402 v2 on :${PORT} payTo=${PAY_TO}`);
});
