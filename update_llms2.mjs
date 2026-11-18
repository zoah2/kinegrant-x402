// 更新 llms.txt 的 API 段落（23 端点矩阵 + 双网络）
import fs from "node:fs";

const base = fs.readFileSync("llms.txt", "utf8");
const marker = "## Paid BSC data API (x402)";
const marker2 = "## Paid BSC + Base data API (x402)";
let body = base;
for (const m of [marker, marker2]) {
  const idx = body.indexOf(m);
  if (idx >= 0) body = body.slice(0, idx).replace(/\s+$/, "\n");
}

const routes = [
  ["GET /health", "free", "Health check"],
  ["GET /token?address=0x..", "$0.02", "Token due diligence: metadata, USDT-pool price, liquidity, owner-renounce"],
  ["GET /price?token=0x..", "$0.01", "PancakeSwap V2 spot price"],
  ["GET /wallet?address=0x..", "$0.05", "Portfolio: BNB/USDT/USDC with USD valuation"],
  ["GET /signals", "$0.10", "Filtered meme launch signals (BUY candidates only)"],
  ["GET /token/liquidity?token=0x..", "$0.01", "Liquidity depth in USDT"],
  ["GET /token/owner?token=0x..", "$0.01", "Owner address and renounce status"],
  ["GET /token/supply?token=0x..", "$0.01", "Total supply raw + formatted"],
  ["GET /token/pairs?token=0x..", "$0.02", "USDT and WBNB pools"],
  ["GET /token/risk?token=0x..", "$0.03", "Risk score: liquidity, owner, pool presence"],
  ["GET /wallet/balance?address=0x..", "$0.01", "Native BNB balance"],
  ["GET /wallet/tokens?address=0x..", "$0.03", "USDT/USDC/WBNB balances"],
  ["GET /market/gas", "$0.005", "Current gas price (gwei)"],
  ["GET /market/block", "$0.005", "Latest block number and timestamp"],
  ["GET /market/wbnb", "$0.01", "WBNB price and pool liquidity"],
  ["GET /market/overview", "$0.02", "BNB price + gas + block"],
  ["GET /signals/fourmeme", "$0.10", "Four.meme signals only"],
  ["GET /signals/flap", "$0.10", "Flap signals only"],
  ["GET /signals/stats", "$0.05", "Signal statistics by source and gain"],
  ["GET /alpha", "$0.15", "Combined BUY screen: signals + risk + liquidity"],
  ["GET /due-diligence?token=0x..", "$0.05", "Complete due diligence: metadata + pools + risk"],
  ["GET /pair/price?tokenA=0x..&tokenB=0x..", "$0.01", "Spot price between any two BSC tokens"],
  ["GET /pair/reserves?tokenA=0x..&tokenB=0x..", "$0.01", "Raw pair reserves"],
];

const lines = [
  "",
  "## Paid BSC + Base data API (x402)",
  "",
  "KineGrant exposes a machine-payable BSC data API via HTTP 402 / x402. An unpaid request returns HTTP 402 with a base64 PAYMENT-REQUIRED header; sign and replay with PAYMENT-SIGNATURE. Payments settle in BSC USDT (eip155:56, permit2) or Base USDC (eip155:8453).",
  "",
  "- Base URL: https://api.kinegrant.com",
  "- Discovery: https://api.kinegrant.com/openapi.json (OpenAPI 3.1 with x-payment-info)",
  "- Payee: 0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E (kinee.ai)",
  "- Networks: eip155:56 (USDT 0x55d398326f99059fF775485246999027B3197955) and eip155:8453 (USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)",
  "",
  "### Endpoints",
  "",
  "| Route | Price | Description |",
  "|---|---|---|",
  ...routes.map(([r, p, d]) => `| \`${r}\` | ${p} | ${d} |`),
  "",
  "Every paid endpoint returns the full x402 challenge in the PAYMENT-REQUIRED header (accepts[] with network, asset, atomic amount, payTo) plus a bazaar discovery extension. 23 routes are indexed on x402scan.",
  "",
];

fs.writeFileSync("llms.txt", body + lines.join("\n"), "utf8");
console.log("llms.txt updated:", fs.statSync("llms.txt").size, "bytes,", routes.length, "routes");
