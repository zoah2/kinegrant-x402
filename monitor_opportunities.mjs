// 币安公告机会监控：抓 Binance 官方公告，过滤 Agent ID / Wallet / 空投 / 活动
// 输出：匹配公告列表（按时间倒序），并写入 last_seen.json 去重
import fs from "node:fs";

const KEYWORDS = [
  "agent id", "wallet", "airdrop", "hodler", "alpha", "campaign",
  "competition", "hackathon", "reward", "launchpool", "megadrop",
  "空投", "活动", "竞赛", "奖励", "钱包",
];
const STATE = "monitor_last_seen.json";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });
  return r.json();
}

const j = await fetchJson(
  "https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&pageNo=1&pageSize=15",
);
if (!j.success) {
  console.log("FETCH_FAIL:", JSON.stringify(j).slice(0, 300));
  process.exit(1);
}

let lastSeen = 0;
try {
  lastSeen = JSON.parse(fs.readFileSync(STATE, "utf8")).lastSeen || 0;
} catch {}

const hits = [];
for (const cat of j.data.catalogs) {
  for (const a of cat.articles) {
    const t = a.title || "";
    const low = t.toLowerCase();
    if (KEYWORDS.some((k) => low.includes(k))) {
      hits.push({
        cat: cat.catalogName,
        title: t,
        id: a.id,
        date: new Date(a.releaseDate).toISOString().slice(0, 16).replace("T", " "),
        url: "https://www.binance.com/zh-CN/support/announcement/" + a.code,
      });
    }
  }
}
hits.sort((x, y) => (y.id || 0) - (x.id || 0));

const fresh = hits.filter((h) => h.id > lastSeen);
if (hits.length) {
  fs.writeFileSync(STATE, JSON.stringify({ lastSeen: hits[0].id }), "utf8");
}

console.log("== NEW (since last run): " + fresh.length + " ==");
for (const h of fresh) {
  console.log(`[${h.date}] ${h.cat} | ${h.title}`);
  console.log("  " + h.url);
}
if (!fresh.length) {
  console.log("== NO NEW OPPORTUNITIES. Latest matches for reference: ==");
  for (const h of hits.slice(0, 5)) {
    console.log(`[${h.date}] ${h.cat} | ${h.title}`);
  }
}
