// 修复被注释吃掉的对象头（第 75 行）
import fs from "node:fs";

let s = fs.readFileSync("extended-tools.mjs", "utf8");
const bad = s.split("\n")[74]; // 第 75 行（0-based 74）
console.log("line 75:", bad.slice(0, 80));
// 找 { path: 在注释行内的位置
const idx = bad.indexOf("{ path:");
if (idx > 0) {
  const head = "  // holidays";
  const tail = bad.slice(idx);
  s = s.replace(bad, head + "\n  " + tail);
  fs.writeFileSync("extended-tools.mjs", s, "utf8");
  console.log("fixed");
} else {
  console.log("no object on line 75");
}
