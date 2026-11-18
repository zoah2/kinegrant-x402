// 修复 Base 注入产生的语法：把 }],\n { ...BASE_USDC... 改成 },\n { ...BASE_USDC...
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");

// 模式：}], 后面紧跟 { scheme: "exact", price: { amount: "...", asset: BASE_USDC }
const re = /}\],(\n\s+\{\n\s+scheme: "exact",\n\s+price: \{ amount: "\d+", asset: BASE_USDC \})/g;

let count = 0;
s = s.replace(re, (m, tail) => {
  count += 1;
  return "}," + tail;
});

fs.writeFileSync("app.mjs", s, "utf8");
console.log("fixed:", count);
