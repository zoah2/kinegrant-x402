// 分析 payai bazaar 服务（正确字段）
import fs from "node:fs";

const j = JSON.parse(fs.readFileSync("payai_resources.json", "utf8"));
const items = j.items || [];
console.log("total:", items.length);

const byHost = {}, byTag = {}, byPrice = {}, services = [];

function usdOf(a) {
  const amt = Number(a.amount || 0);
  const asset = String(a.asset || "").toLowerCase();
  const net = String(a.network || "");
  if (net === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp") return amt / 1e6; // USDC solana
  if (asset === "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") return amt / 1e6;
  if (asset === "0x55d398326f99059ff775485246999027b3197955") return amt / 1e18;
  return amt > 1e12 ? amt / 1e18 : amt / 1e6;
}

for (const it of items) {
  const url = String(it.resource || "");
  let host = "?";
  try { host = new URL(url).host; } catch {}
  byHost[host] = (byHost[host] || 0) + 1;
  for (const t of it.metadata?.tags || it.tags || []) byTag[t] = (byTag[t] || 0) + 1;
  const a = (it.accepts || [])[0] || {};
  const usd = usdOf(a);
  const bucket = usd < 0.01 ? "<0.01" : usd < 0.05 ? "0.01-0.05" : usd < 0.1 ? "0.05-0.1" : usd < 0.5 ? "0.1-0.5" : usd < 5 ? "0.5-5" : ">5";
  byPrice[bucket] = (byPrice[bucket] || 0) + 1;
  services.push({ name: it.serviceName || "?", host, usd: Number(usd.toFixed(4)), tags: (it.metadata?.tags || []).slice(0, 4).join(","), desc: String(it.metadata?.description || it.description || "").slice(0, 80) });
}

const top = (o, n = 15) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
console.log("\n=== hosts ===");
for (const [h, c] of top(byHost, 20)) console.log(String(c).padStart(3), h);
console.log("\n=== price buckets ===");
for (const [b, c] of top(byPrice, 10)) console.log(String(c).padStart(3), b);
console.log("\n=== tags ===");
for (const [t, c] of top(byTag, 20)) console.log(String(c).padStart(3), t);
console.log("\n=== services (sample 30) ===");
for (const s of services.slice(0, 30)) console.log(`$${s.usd} | ${s.name.slice(0, 40)} | ${s.host} | ${s.desc}`);
