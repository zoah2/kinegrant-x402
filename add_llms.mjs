import fs from "node:fs";

const base = fs.readFileSync("llms.txt", "utf8");
const marker = "## Paid BSC data API (x402)";
let body = base;
// 去掉上一次追加的段落（如果存在）
const idx = body.indexOf(marker);
if (idx >= 0) body = body.slice(0, idx).replace(/\s+$/, "\n");

const section = [
  "",
  "## Paid BSC data API (x402)",
  "",
  "KineGrant exposes a machine-payable data API on BNB Smart Chain via the HTTP 402 / x402 protocol. Any HTTP client can call it; an unpaid request returns HTTP 402 with a base64 PAYMENT-REQUIRED header describing a USDT payment (BSC eip155:56, permit2). Sign and replay the request with the PAYMENT-SIGNATURE header to receive data.",
  "",
  "- Base URL: https://api.kinegrant.com",
  "- Network: BNB Smart Chain, eip155:56",
  "- Payment asset: USDT 0x55d398326f99059fF775485246999027B3197955",
  "- Scheme: x402 exact via payai facilitator",
  "- Payee: 0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E",
  "",
  "Endpoints:",
  "",
  "- GET /health - free health check",
  "- GET /price?token=0x... - PancakeSwap V2 USDT-pool spot price ($0.01)",
  "- GET /token?address=0x... - token due-diligence: metadata, USDT-pool price, liquidity depth, owner-renounce status ($0.02)",
  "- GET /wallet?address=0x... - BSC portfolio snapshot: BNB/USDT/USDC balances with USD valuation at live pool prices ($0.05)",
  "",
  "Every paid endpoint returns the complete x402 challenge inline in the PAYMENT-REQUIRED response header plus a bazaar discovery extension describing the input and output shape, so an agent can discover pricing and replay semantics from a single 402 response.",
  "",
].join("\n");

fs.writeFileSync("llms.txt", body + section, "utf8");
console.log("llms.txt updated, size:", fs.statSync("llms.txt").size);
