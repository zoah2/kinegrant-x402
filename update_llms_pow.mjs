// 更新 llms.txt：加入 PoW 免费层
import fs from "node:fs";

let s = fs.readFileSync("llms.txt", "utf8");
const idx = s.indexOf("## Paid multi-chain data API (x402)");
const head = idx >= 0 ? s.slice(0, idx) : s;

const tail = [
  "",
  "## KineGrant x402 — 138 endpoints + free PoW tier",
  "",
  "**Agents: read https://api.kinegrant.com/agents.md first.**",
  "",
  "### Free tier (proof-of-work, no wallet needed)",
  "",
  "GET /pow/challenge returns {challenge, difficulty}. Find a nonce where sha256(challenge + ':' + nonce) starts with N hex zeros, then call any CPU-only tool with header `X-PoW: <challenge>:<nonce>` — free, one-time use.",
  "",
  "Free CPU tools: /x402/time, /x402/uuid, /x402/random, /x402/echo, /x402/hash, /x402/keccak, /x402/base64, /x402/slug, /x402/wordcount, /x402/ping, /x402/status, /x402/network, /x402/payment, /x402/quote, /text/wordcount, /selector",
  "",
  "### Paid (x402, BSC USDT or Base USDC)",
  "",
  "- /verdict?token=0x.. $0.01 | /skill/* $0.02-0.10 (12 packs) | /v1/chat/completions $0.002 | /chain/* $0.001-0.003 | /signals $0.05-0.15 | 11 chains",
  "",
  "### Links",
  "",
  "- Agents: https://api.kinegrant.com/agents.md",
  "- Discovery: https://api.kinegrant.com/openapi.json",
  "- Payee: 0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E (kinee.ai)",
  "",
  "x402scan: 138 resources.",
  "",
].join("\n");

fs.writeFileSync("llms.txt", head + tail, "utf8");
console.log("llms:", fs.statSync("llms.txt").size);
