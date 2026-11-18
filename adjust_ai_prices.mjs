// AI 功能定价：summarize $0.01 / sentiment $0.02 / keywords $0.02 / rewrite $0.05 / classify $0.05 / outline $0.05
import fs from "node:fs";

let s = fs.readFileSync("utility-xpay.mjs", "utf8");
const prices = {
  summarize: 0.01,
  rewrite: 0.05,
  sentiment: 0.02,
  keywords: 0.02,
  classify: 0.05,
  outline: 0.05,
};

for (const [name, usd] of Object.entries(prices)) {
  const re = new RegExp(`(path: "/x402/${name}", usd: )[0-9.]+`);
  s = s.replace(re, `$1${usd}`);
}

fs.writeFileSync("utility-xpay.mjs", s, "utf8");
for (const [name] of Object.entries(prices)) {
  const m = s.match(new RegExp(`path: "/x402/${name}", usd: ([0-9.]+)`));
  console.log(name, "->", m ? m[1] : "?");
}
