// 分析 payai bazaar 里的服务：谁在卖什么、定价多少
import fs from "node:fs";

const raw = JSON.parse(fs.readFileSync("payai_resources.json", "utf8"));
const items = raw.items || [];
console.log("total resources:", items.length);

const byHost = {};
const byPrice = {};
const byPath = {};
let noPayTo = 0;

for (const it of items) {
  const accepts = it.accepts || [];
  const a = accepts[0] || {};
  const url = it.resource?.url || it.url || "";
  let host = "unknown";
  try { host = new URL(url).host; } catch {}
  byHost[host] = (byHost[host] || 0) + 1;
  const amount = a.amount ? Number(a.amount) : 0;
  const asset = (a.asset || "").toLowerCase();
  // 归一化到 USD（USDC 6 位 / USDT 18 位）
  let usd = null;
  if (asset === "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") usd = amount / 1e6;
  else if (asset === "0x55d398326f99059ff775485246999027b3197955") usd = amount / 1e18;
  else if (amount > 1e12) usd = amount / 1e18;
  else usd = amount / 1e6;
  const bucket = usd < 0.01 ? "<0.01" : usd < 0.05 ? "0.01-0.05" : usd < 0.1 ? "0.05-0.1" : usd < 0.5 ? "0.1-0.5" : usd < 1 ? "0.5-1" : usd < 5 ? "1-5" : ">5";
  byPrice[bucket] = (byPrice[bucket] || 0) + 1;
  let path = "?";
  try { path = new URL(url).pathname; } catch {}
  const seg = path.split("/").filter(Boolean)[0] || "/";
  byPath[seg] = (byPath[seg] || 0) + 1;
}

const top = (obj, n = 15) =>
  Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

console.log("\n=== hosts (who hosts most resources) ===");
for (const [h, c] of top(byHost, 20)) console.log(String(c).padStart(4), h);

console.log("\n=== price buckets (USD) ===");
for (const [b, c] of top(byPrice, 12)) console.log(String(c).padStart(4), b);

console.log("\n=== path segments (service categories) ===");
for (const [p, c] of top(byPath, 25)) console.log(String(c).padStart(4), p);

console.log("\n=== sample resources ===");
for (const it of items.slice(0, 12)) {
  const a = (it.accepts || [])[0] || {};
  const url = (it.resource?.url || it.url || "").slice(0, 90);
  console.log(`${a.network || "?"} ${a.amount || "?"} ${url}`);
}
