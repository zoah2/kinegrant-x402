// 修复 fix_base_amount 丢掉的 asset: BASE_USDC
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
const re = /(price: \{ amount: "\d+"),\n(\s+)network: BASE_NETWORK,/g;
let count = 0;
s = s.replace(re, (m, head, indent) => {
  count += 1;
  return head + ", asset: BASE_USDC },\n" + indent + "network: BASE_NETWORK,";
});
fs.writeFileSync("app.mjs", s, "utf8");
console.log("fixed:", count);
