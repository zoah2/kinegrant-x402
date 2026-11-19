// /v1/models 合并三组模型（便宜 / Claude / GPT-6）
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("MODELS_ALL")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { GPT_ROUTES, GPT_PATHS, handleGpt } from "./gpt-upstream.mjs";',
  'import { GPT_ROUTES, GPT_PATHS, handleGpt, GPT_MODELS } from "./gpt-upstream.mjs";\nimport { MODEL_MAP } from "./openai-compat.mjs";\nimport { CLAUDE_MODELS } from "./claude-upstream.mjs";',
);

// 在 /v1/models 路由后覆盖（把三组都列出）
s = s.replace(
  'app.get("/v1/models", (req, res) => {',
  'app.get("/v1/models/all", (req, res) => {\n  const data = [\n    ...Object.entries(MODEL_MAP).map(([alias, e]) => ({ id: alias, endpoint: "/v1/chat/completions", price: "$0.002", provider: e.provider, upstream: e.upstream })),\n    ...Object.entries(CLAUDE_MODELS).map(([alias, up]) => ({ id: alias, endpoint: "/v1/claude", price: "$0.01", provider: "yicode", upstream: up })),\n    ...Object.entries(GPT_MODELS).map(([alias, up]) => ({ id: alias, endpoint: "/v1/gpt", price: "$0.02", provider: "yicode", upstream: up })),\n  ];\n  res.json({ object: "list", count: data.length, data });\n});\n\napp.get("/v1/models", (req, res) => {',
);
fs.writeFileSync("app.mjs", s, "utf8");
console.log("patched:", s.includes("MODELS_ALL") || s.includes("/v1/models/all"));
