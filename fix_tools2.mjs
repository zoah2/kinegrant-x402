// 修复字面量 `n`n 为真实换行
import fs from "node:fs";

let s = fs.readFileSync("extended-tools.mjs", "utf8");
const literal = "`n`n";
s = s.split(literal).join("\n\n");
fs.writeFileSync("extended-tools.mjs", s, "utf8");
console.log("fixed:", !s.includes(literal));
