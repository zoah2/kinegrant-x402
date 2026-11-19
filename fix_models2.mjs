// 让 /v1/models 返回全部 20 个模型（三档）
import fs from "node:fs";

let s = fs.readFileSync("openai-compat.mjs", "utf8");
if (s.includes("CLAUDE_MODELS")) { console.log("already"); process.exit(0); }

s = s.replace(
  '// OpenAI 兼容端点：Groq 免费层 + DeepSeek V4（双上游）',
  '// OpenAI 兼容端点：Groq 免费层 + DeepSeek V4 + Claude + GPT-6\nimport { CLAUDE_MODELS } from "./claude-upstream.mjs";\nimport { GPT_MODELS } from "./gpt-upstream.mjs";',
);

s = s.replace(
  `export function handleModels(req, res) {
  res.json({
    object: "list",
    data: Object.entries(MODEL_MAP).map(([alias, e]) => ({ id: alias, object: "model", owned_by: "kinegrant-x402", provider: e.provider, upstream: e.upstream })),
  });
}`,
  `export function handleModels(req, res) {
  const data = [
    ...Object.entries(MODEL_MAP).map(([alias, e]) => ({ id: alias, object: "model", endpoint: "/v1/chat/completions", price: "$0.002", provider: e.provider, upstream: e.upstream })),
    ...Object.entries(CLAUDE_MODELS).map(([alias, up]) => ({ id: alias, object: "model", endpoint: "/v1/claude", price: "$0.01", provider: "yicode", upstream: up })),
    ...Object.entries(GPT_MODELS).map(([alias, up]) => ({ id: alias, object: "model", endpoint: "/v1/gpt", price: "$0.02", provider: "yicode", upstream: up })),
  ];
  res.json({ object: "list", count: data.length, data });
}`,
);
fs.writeFileSync("openai-compat.mjs", s, "utf8");
console.log("patched:", s.includes("CLAUDE_MODELS") && s.includes("GPT_MODELS"));
