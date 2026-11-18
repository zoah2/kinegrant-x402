// 修正 Base USDC amount：18 位 → 6 位（除以 10^12）
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");

const re = /(price: \{ amount: ")(\d+)("), asset: BASE_USDC \}/g;
let count = 0;
s = s.replace(re, (m, pre, amount, post) => {
  const usdc = BigInt(amount) / 1000000000000n; // 18 位 → 6 位
  count += 1;
  return pre + usdc.toString() + post;
});

fs.writeFileSync("app.mjs", s, "utf8");
console.log("base amounts fixed:", count);
for (const m of s.matchAll(/price: \{ amount: "(\d+)", asset: BASE_USDC \}/g)) {
  console.log("  base amount:", m[1]);
}
