// 合并第三批 PoW 工具
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("POW_TOOLS3")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { POW_TOOLS2, POW2_PATHS } from "./pow-tools2.mjs";',
  'import { POW_TOOLS2, POW2_PATHS } from "./pow-tools2.mjs";\nimport { POW_TOOLS3, POW3_PATHS } from "./pow-tools3.mjs";',
);
s = s.replace(
  "const ALL_POW_TOOLS = [...POW_TOOLS1, ...POW_TOOLS2];",
  "const ALL_POW_TOOLS = [...POW_TOOLS1, ...POW_TOOLS2, ...POW_TOOLS3];",
);
s = s.replace(
  "...POW1_PATHS, ...POW2_PATHS,",
  "...POW1_PATHS, ...POW2_PATHS, ...POW3_PATHS,",
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("POW_TOOLS3"), s.includes("POW3_PATHS"));
