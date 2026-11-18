// 合并 verdict 端点
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("VERDICT_ROUTES")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { UTIL_ENDPOINTS, UTIL_ROUTES, UTIL_PATHS } from "./utility-xpay.mjs";',
  'import { UTIL_ENDPOINTS, UTIL_ROUTES, UTIL_PATHS } from "./utility-xpay.mjs";\nimport { VERDICT_ENDPOINTS, VERDICT_ROUTES, VERDICT_PATHS } from "./verdict.mjs";',
);

s = s.replace(
  "app.use(paymentMiddleware(UTIL_ROUTES, resourceServer));",
  "app.use(paymentMiddleware(VERDICT_ROUTES, resourceServer));\nfor (const ep of VERDICT_ENDPOINTS) {\n  app.get(ep.path, ep.handler);\n}\n\napp.use(paymentMiddleware(UTIL_ROUTES, resourceServer));",
);

s = s.replace(
  "...AI_PATHS, ...OPENAI_PATHS, ...UTIL_PATHS },",
  "...AI_PATHS, ...OPENAI_PATHS, ...UTIL_PATHS, ...VERDICT_PATHS },",
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("VERDICT_ROUTES"), s.includes("VERDICT_PATHS"));
