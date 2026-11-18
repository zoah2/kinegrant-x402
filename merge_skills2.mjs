// 合并 skill packs v2
import fs from "node:fs";
let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("SKILL2_ROUTES")) { console.log("already"); process.exit(0); }
s = s.replace(
  'import { SKILLS, SKILL_ROUTES, SKILL_PATHS } from "./skill-packs.mjs";',
  'import { SKILLS, SKILL_ROUTES, SKILL_PATHS } from "./skill-packs.mjs";\nimport { SKILLS2, SKILL2_ROUTES, SKILL2_PATHS } from "./skill-packs2.mjs";',
);
s = s.replace(
  "app.use(paymentMiddleware(SKILL_ROUTES, resourceServer));",
  "app.use(paymentMiddleware(SKILL2_ROUTES, resourceServer));\nfor (const ep of SKILLS2) {\n  app.get(ep.path, ep.handler);\n}\n\napp.use(paymentMiddleware(SKILL_ROUTES, resourceServer));",
);
s = s.replace("...EXPAND_PATHS, ...SKILL_PATHS },", "...EXPAND_PATHS, ...SKILL_PATHS, ...SKILL2_PATHS },");
fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("SKILL2_ROUTES"), s.includes("SKILL2_PATHS"));
