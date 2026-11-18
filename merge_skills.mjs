// 合并 skill packs
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("SKILL_ROUTES")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { EXPAND, EXPAND_ROUTES, EXPAND_PATHS } from "./expand-rpc.mjs";',
  'import { EXPAND, EXPAND_ROUTES, EXPAND_PATHS } from "./expand-rpc.mjs";\nimport { SKILLS, SKILL_ROUTES, SKILL_PATHS } from "./skill-packs.mjs";',
);
s = s.replace(
  "app.use(paymentMiddleware(VERDICT_ROUTES, resourceServer));",
  "app.use(paymentMiddleware(SKILL_ROUTES, resourceServer));\nfor (const ep of SKILLS) {\n  app.get(ep.path, ep.handler);\n}\n\napp.use(paymentMiddleware(VERDICT_ROUTES, resourceServer));",
);
s = s.replace("...VERDICT_PATHS, ...EXPAND_PATHS },", "...VERDICT_PATHS, ...EXPAND_PATHS, ...SKILL_PATHS },");

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("SKILL_ROUTES"), s.includes("SKILL_PATHS"));
