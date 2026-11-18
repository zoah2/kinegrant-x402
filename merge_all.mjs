// 一次性合并 verdict + expand
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
let changed = false;

// verdict
if (!s.includes("VERDICT_ROUTES")) {
  s = s.replace(
    'import { UTIL_ENDPOINTS, UTIL_ROUTES, UTIL_PATHS } from "./utility-xpay.mjs";',
    'import { UTIL_ENDPOINTS, UTIL_ROUTES, UTIL_PATHS } from "./utility-xpay.mjs";\nimport { VERDICT_ENDPOINTS, VERDICT_ROUTES, VERDICT_PATHS } from "./verdict.mjs";',
  );
  s = s.replace(
    "app.use(paymentMiddleware(UTIL_ROUTES, resourceServer));",
    "app.use(paymentMiddleware(VERDICT_ROUTES, resourceServer));\nfor (const ep of VERDICT_ENDPOINTS) {\n  app.get(ep.path, ep.handler);\n}\n\napp.use(paymentMiddleware(UTIL_ROUTES, resourceServer));",
  );
  s = s.replace("...OPENAI_PATHS, ...UTIL_PATHS },", "...OPENAI_PATHS, ...UTIL_PATHS, ...VERDICT_PATHS },");
  changed = true;
}

// expand
if (!s.includes("EXPAND_ROUTES")) {
  s = s.replace(
    'import { VERDICT_ENDPOINTS, VERDICT_ROUTES, VERDICT_PATHS } from "./verdict.mjs";',
    'import { VERDICT_ENDPOINTS, VERDICT_ROUTES, VERDICT_PATHS } from "./verdict.mjs";\nimport { EXPAND, EXPAND_ROUTES, EXPAND_PATHS } from "./expand-rpc.mjs";',
  );
  s = s.replace(
    "app.use(paymentMiddleware(VERDICT_ROUTES, resourceServer));",
    "app.use(paymentMiddleware(EXPAND_ROUTES, resourceServer));\nfor (const ep of EXPAND) {\n  app.get(ep.path, ep.handler);\n}\n\napp.use(paymentMiddleware(VERDICT_ROUTES, resourceServer));",
  );
  s = s.replace("...UTIL_PATHS, ...VERDICT_PATHS },", "...UTIL_PATHS, ...VERDICT_PATHS, ...EXPAND_PATHS },");
  changed = true;
}

fs.writeFileSync("app.mjs", s, "utf8");
console.log("changed:", changed, "verdict:", s.includes("VERDICT_ROUTES"), "expand:", s.includes("EXPAND_ROUTES"));
