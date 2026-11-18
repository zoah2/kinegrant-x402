// 合并 X Pay 抄来的 21 个 utility 端点
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("UTIL_ROUTES")) {
  console.log("already merged");
  process.exit(0);
}

s = s.replace(
  'import { OPENAI_ROUTES, OPENAI_PATHS, handleChatCompletions, handleModels } from "./openai-compat.mjs";',
  'import { OPENAI_ROUTES, OPENAI_PATHS, handleChatCompletions, handleModels } from "./openai-compat.mjs";\nimport { UTIL_ENDPOINTS, UTIL_ROUTES, UTIL_PATHS } from "./utility-xpay.mjs";',
);

s = s.replace(
  "app.use(paymentMiddleware(OPENAI_ROUTES, resourceServer));",
  "app.use(paymentMiddleware(UTIL_ROUTES, resourceServer));\nfor (const ep of UTIL_ENDPOINTS) {\n  if (ep.method === \"POST\") app.post(ep.path, ep.handler);\n  else app.get(ep.path, ep.handler);\n}\n\napp.use(paymentMiddleware(OPENAI_ROUTES, resourceServer));",
);

s = s.replace(
  "...TOOLS_PATHS, ...AI_PATHS, ...OPENAI_PATHS },",
  "...TOOLS_PATHS, ...AI_PATHS, ...OPENAI_PATHS, ...UTIL_PATHS },",
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("UTIL_ROUTES"), s.includes("UTIL_PATHS"));
