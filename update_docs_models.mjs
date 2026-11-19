// 更新 agents.md + llms.txt：加 20 模型三档
import fs from "node:fs";

const MODEL_SECTION = `
## AI models (20, three price tiers)

| Endpoint | Price | Models |
|---|---|---|
| \`POST /v1/gpt\` | **$0.02** | GPT-6 Astra, GPT-6.2, GPT-5.6 Sol |
| \`POST /v1/claude\` | **$0.01** | Claude Opus 5.5 / Opus 5 / Opus 4.8 / Sonnet 5.5 / Sonnet 5 / Fable 5.2 / Fable 5.1 |
| \`POST /v1/chat/completions\` | **$0.002** | gpt-oss-120b, gpt-oss-20b, gpt-4o, gpt-4o-mini, qwen3, allam-2-7b, deepseek-v4, deepseek-chat, deepseek-reasoner |

\`GET /v1/models\` returns all 20 with endpoint + price + provider (free, no payment).
All three are OpenAI-format: \`{"model": "...", "messages": [{"role": "user", "content": "..."}], "max_tokens": 256}\`.
`;

// agents.md
let a = fs.readFileSync("agents.md", "utf8");
if (!a.includes("AI models (20")) {
  a = a.replace("## How to pay (x402)", MODEL_SECTION + "\n## How to pay (x402)");
  fs.writeFileSync("agents.md", a, "utf8");
  console.log("agents.md updated");
}

// llms.txt
let l = fs.readFileSync("llms.txt", "utf8");
if (!l.includes("AI models (20")) {
  const idx = l.indexOf("### Paid (x402, BSC USDT or Base USDC)");
  const insert = MODEL_SECTION + "\n### Paid (x402, BSC USDT or Base USDC)";
  l = idx >= 0 ? l.slice(0, idx) + insert + l.slice(idx + "### Paid (x402, BSC USDT or Base USDC)".length) : l + "\n" + MODEL_SECTION;
  fs.writeFileSync("llms.txt", l, "utf8");
  console.log("llms.txt updated");
}
