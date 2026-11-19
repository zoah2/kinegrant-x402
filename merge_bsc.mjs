// 合并 BSC 独占数据端点
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("BSC_EXCLUSIVE_ROUTES")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { LLAMA_ENDPOINTS_M, LLAMA_ROUTES, LLAMA_PATHS } from "./defillama.mjs";',
  'import { LLAMA_ENDPOINTS_M, LLAMA_ROUTES, LLAMA_PATHS } from "./defillama.mjs";\nimport { BSC_EXCLUSIVE, BSC_EXCLUSIVE_ROUTES, BSC_EXCLUSIVE_PATHS } from "./bsc-exclusive.mjs";',
);
s = s.replace(
  "app.use(paymentMiddleware(LLAMA_ROUTES, resourceServer));",
  "app.use(paymentMiddleware(BSC_EXCLUSIVE_ROUTES, resourceServer));\nfor (const ep of BSC_EXCLUSIVE) {\n  app.get(ep.path, ep.handler);\n}\n\napp.use(paymentMiddleware(LLAMA_ROUTES, resourceServer));",
);
s = s.replace(
  "...POW3_PATHS, ...LLAMA_PATHS,",
  "...POW3_PATHS, ...LLAMA_PATHS, ...BSC_EXCLUSIVE_PATHS,",
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("BSC_EXCLUSIVE_ROUTES"), s.includes("BSC_EXCLUSIVE_PATHS"));
