// 准备开源仓库：.gitignore + README + 清理敏感信息
import fs from "node:fs";

const gitignore = `
node_modules/
*.log
*.out
*.err
*.txt
*.json.bak
local.out.log
local.err.log
cf-cert.pem
cfhome/
kine-signal.bat
start_all.ps1
kine-signal-autostart.vbs
baw_login*.out
baw_verify*.out
hdrs*.txt
body.json
payai_resources.json
binance_ann.json
fm.html
fm_agentic.html
fm_agentic_rsc.txt
fm_agentic_text.txt
groq_key*.txt
ds_after.txt
groq_after*.txt
groq_final.txt
hackathon.txt
gf-*.png
*.png
*.zip
fc-dist/
`;

fs.writeFileSync(".gitignore", gitignore.trim() + "\n", "utf8");

const exampleBat = `@echo off
rem kine-signal 环境启动模板（复制为 kine-signal.bat 并填入你的 key）
start "" /min "C:\\path\\to\\mihomo.exe" -d "C:\\path\\to\\mihomo" -f config.yaml
timeout /t 5 /nobreak >nul

set HTTPS_PROXY=http://127.0.0.1:7897
set HTTP_PROXY=http://127.0.0.1:7897
set NODE_USE_ENV_PROXY=1
set GROQ_API_KEY=YOUR_GROQ_API_KEY_HERE
start "" /min cmd /c "cd /d C:\\path\\to\\x402-service && node run_local.mjs >> local.out.log 2>> local.err.log"
timeout /t 6 /nobreak >nul

start "" /min "C:\\path\\to\\cloudflared.exe" tunnel --config "C:\\path\\to\\config.yml" run kine-signal
`;
fs.writeFileSync("kine-signal.bat.example", exampleBat, "utf8");

const readme = `# KineGrant x402

Machine-payable data API for AI agents: 138 endpoints across 19 chains, x402 payments (BSC USDT / Base USDC), free proof-of-work tier.

## What it is

- **138 endpoints**: token due diligence, verdicts, skill packs, cross-chain RPC, AI models (OpenAI-compatible), utility tools
- **19 chains**: BSC, Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche, Linea, Monad, Celo, Sei, Ink, Arc, Solana, TON, Tron, Sui, Aptos, Bitcoin
- **x402 payments**: HTTP 402 with a \`PAYMENT-REQUIRED\` header; sign and replay with \`PAYMENT-SIGNATURE\`. No account, no API key
- **Free PoW tier**: \`GET /pow/challenge\` + solve sha256 → call CPU-only tools free
- **OpenAI-compatible**: \`POST /v1/chat/completions\` backed by Groq free-tier models

## Quick start

\`\`\`bash
# free: proof of work
curl https://api.kinegrant.com/pow/challenge
# solve sha256(challenge + ':' + nonce) -> starts with N hex zeros, then:
curl https://api.kinegrant.com/x402/time -H "X-PoW: <challenge>:<nonce>"

# paid: x402
curl -i https://api.kinegrant.com/verdict?token=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
# -> 402 + PAYMENT-REQUIRED header; use any x402 client to pay and replay
\`\`\`

## Endpoints (highlights)

| Endpoint | Price | What |
|---|---|---|
| \`/verdict?token=0x..\` | $0.01 | BASED / MID / COOKED / RADIOACTIVE / DEAD |
| \`/skill/dd?token=0x..\` | $0.05 | metadata + pools + risk + verdict (4 tools) |
| \`/skill/full-report?token=0x..\` | $0.10 | 9 checks |
| \`/skill/meme?range=1h\` | $0.08 | filtered launch signals |
| \`POST /v1/chat/completions\` | $0.002 | OpenAI-compatible, 6 models |
| \`/chain/balance?chain=base&address=0x..\` | $0.002 | 13 EVM chains |
| \`/sol/balance?address=..\` | $0.002 | Solana |
| \`/btc/fees\` | $0.001 | Bitcoin fee rates |

Full list: \`GET /openapi.json\`.

## Architecture

\`\`\`
agent -> Cloudflare (api.kinegrant.com)
      -> cloudflared tunnel
      -> local Express server (x402 middleware + endpoints)
      -> x402 facilitator (payai) for settlement
\`\`\`

Modules: \`app.mjs\` (routes + x402 wiring), \`extra-endpoints.mjs\` / \`extra-endpoints2.mjs\` / \`multi-chain.mjs\` / \`extended-chains.mjs\` / \`extended-tools.mjs\` / \`ai-proxy.mjs\` / \`openai-compat.mjs\` / \`utility-xpay.mjs\` / \`verdict.mjs\` / \`expand-rpc.mjs\` / \`skill-packs.mjs\` / \`skill-packs2.mjs\` / \`pow.mjs\`.

## Run locally

\`\`\`bash
npm install
cp kine-signal.bat.example kine-signal.bat   # fill in paths + GROQ_API_KEY
node run_local.mjs                            # listens on :3101
\`\`\`

Env: \`GROQ_API_KEY\` (for /v1/chat/completions), \`HTTPS_PROXY\` (optional).

## License

MIT
`;
fs.writeFileSync("README.md", readme, "utf8");
console.log("prepared: .gitignore, README.md, kine-signal.bat.example");
