// 合并 DefiLlama + LLM 格式端点
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("LLAMA_ROUTES")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { POW_TOOLS3, POW3_PATHS } from "./pow-tools3.mjs";',
  'import { POW_TOOLS3, POW3_PATHS } from "./pow-tools3.mjs";\nimport { LLAMA_ENDPOINTS_M, LLAMA_ROUTES, LLAMA_PATHS } from "./defillama.mjs";',
);
s = s.replace(
  'app.get("/agents.md", (_req, res) => {',
  `app.use(paymentMiddleware(LLAMA_ROUTES, resourceServer));
for (const ep of LLAMA_ENDPOINTS_M) {
  if (ep.method === "POST") app.post(ep.path, ep.handler);
  else app.get(ep.path, ep.handler);
}

app.get("/agents.md", (_req, res) => {`,
);
s = s.replace(
  "...POW1_PATHS, ...POW2_PATHS, ...POW3_PATHS,",
  "...POW1_PATHS, ...POW2_PATHS, ...POW3_PATHS, ...LLAMA_PATHS,",
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("LLAMA_ROUTES"), s.includes("LLAMA_PATHS"));
