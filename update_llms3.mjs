// 更新 llms.txt：54 端点矩阵（类别汇总 + 主端点表）
import fs from "node:fs";

const base = fs.readFileSync("llms.txt", "utf8");
let body = base;
for (const m of ["## Paid BSC data API (x402)", "## Paid BSC + Base data API (x402)"]) {
  const idx = body.indexOf(m);
  if (idx >= 0) body = body.slice(0, idx).replace(/\s+$/, "\n");
}

const lines = [
  "",
  "## Paid BSC + Base data API (x402)",
  "",
  "KineGrant exposes a 54-endpoint machine-payable BSC data API via HTTP 402 / x402. An unpaid request returns HTTP 402 with a base64 PAYMENT-REQUIRED header; sign and replay with PAYMENT-SIGNATURE. Payments settle in BSC USDT (eip155:56, permit2) or Base USDC (eip155:8453). Prices range from $0.001 (atomic lookups) to $0.15 (combined alpha screen).",
  "",
  "- Base URL: https://api.kinegrant.com",
  "- Discovery: https://api.kinegrant.com/openapi.json (OpenAPI 3.1 with x-payment-info)",
  "- Payee: 0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E (kinee.ai)",
  "- Networks: eip155:56 (USDT 0x55d398326f99059fF775485246999027B3197955) and eip155:8453 (USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)",
  "",
  "### Categories",
  "",
  "| Category | Endpoints | Price range |",
  "|---|---|---|",
  "| Token | /token, /token/liquidity, /token/owner, /token/supply, /token/pairs, /token/risk, /token/name, /token/symbol, /token/decimals, /token/exists, /token/total-supply-raw, /token/allowance, /price | $0.001-0.03 |",
  "| Wallet | /wallet, /wallet/balance, /wallet/tokens, /wallet/nonce, /wallet/is-contract | $0.001-0.05 |",
  "| Market | /market/gas, /market/block, /market/wbnb, /market/overview, /market/base-fee, /market/tx-count, /market/gas-budget, /market/chain-id, /market/bnb-usdt | $0.001-0.02 |",
  "| Pools | /pair/price, /pair/reserves, /pair/address, /pair/token0, /pair/liquidity | $0.001-0.02 |",
  "| Transactions | /tx/status, /tx/value, /tx/log-count | $0.002 |",
  "| Blocks | /block/timestamp, /block/gas-used | $0.001-0.002 |",
  "| Security | /security/renounce, /security/transfer-function, /security/decimals-match | $0.002-0.005 |",
  "| Signals | /signals, /signals/fourmeme, /signals/flap, /signals/stats, /alpha | $0.05-0.15 |",
  "| Batch | /batch/token, /batch/balance | $0.01 |",
  "| Due diligence | /due-diligence | $0.05 |",
  "| Agent dev tools | /cve/lookup, /npm/package, /github/health, /url/extract | $0.002-0.005 |",
  "",
  "### Notes",
  "",
  "- All endpoints accept GET with query parameters; every paid route returns a 402 challenge with the full payment requirement inline.",
  "- x402scan has 54 registered resources for this origin (merchant page: tryponcho.com/m/api.kinegrant.com).",
  "- Free: GET /health and GET /openapi.json.",
  "",
];

fs.writeFileSync("llms.txt", body + lines.join("\n"), "utf8");
console.log("llms.txt updated:", fs.statSync("llms.txt").size, "bytes");
