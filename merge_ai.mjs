// 把 AI 端点合并进 app.mjs
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("AI_ROUTES")) {
  console.log("already merged");
  process.exit(0);
}

s = s.replace(
  'import { TOOLS, TOOLS_ROUTES, TOOLS_PATHS } from "./extended-tools.mjs";',
  'import { TOOLS, TOOLS_ROUTES, TOOLS_PATHS } from "./extended-tools.mjs";\nimport { AI_ENDPOINTS, AI_ROUTES, AI_PATHS } from "./ai-proxy.mjs";',
);

s = s.replace(
  "app.use(paymentMiddleware(TOOLS_ROUTES, resourceServer));",
  "app.use(paymentMiddleware(AI_ROUTES, resourceServer));\nfor (const ep of AI_ENDPOINTS) {\n  app.get(ep.path, ep.handler);\n}\n\napp.use(paymentMiddleware(TOOLS_ROUTES, resourceServer));",
);

s = s.replace(
  "...EXTENDED_PATHS, ...TOOLS_PATHS },",
  "...EXTENDED_PATHS, ...TOOLS_PATHS, ...AI_PATHS },",
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("AI_ROUTES"), s.includes("AI_PATHS"));
