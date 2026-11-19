// 把 PoW 工具的 paths 合并进 openapi
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("POW1_PATHS")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { POW_TOOLS1 } from "./pow-tools1.mjs";',
  'import { POW_TOOLS1, POW1_PATHS } from "./pow-tools1.mjs";',
);
s = s.replace(
  'import { POW_TOOLS2 } from "./pow-tools2.mjs";',
  'import { POW_TOOLS2, POW2_PATHS } from "./pow-tools2.mjs";',
);
s = s.replace(
  "...EXPAND_PATHS, ...SKILL_PATHS, ...SKILL2_PATHS,",
  "...EXPAND_PATHS, ...SKILL_PATHS, ...SKILL2_PATHS, ...POW1_PATHS, ...POW2_PATHS,",
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("patched:", s.includes("POW1_PATHS"), s.includes("POW2_PATHS"));
