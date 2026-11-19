// 抓取并分析 4 个头部服务的接口清单
import fs from "node:fs";

const targets = [
  { name: "blockrun", url: "https://blockrun.ai/openapi.json" },
  { name: "blockrun-llms", url: "https://blockrun.ai/llms.txt" },
  { name: "zerion", url: "https://api.zerion.io/openapi.json" },
  { name: "pocket", url: "https://agent.pocket.network/services" },
  { name: "stableenrich", url: "https://stableenrich.dev/openapi.json" },
];

for (const t of targets) {
  try {
    const r = await fetch(t.url, { signal: AbortSignal.timeout(30000) });
    const text = await r.text();
    fs.writeFileSync(`head_${t.name}.txt`, text, "utf8");
    console.log(t.name, "saved", text.length, "bytes");
  } catch (e) {
    console.log(t.name, "ERR", e.message);
  }
}

// 分析 openapi 的 paths
for (const [name, file] of [["blockrun", "head_blockrun.txt"], ["zerion", "head_zerion.txt"], ["stableenrich", "head_stableenrich.txt"]]) {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    const paths = Object.keys(j.paths || {});
    console.log(`\n=== ${name}: ${paths.length} paths ===`);
    for (const p of paths.slice(0, 40)) console.log(" ", p);
  } catch (e) {
    console.log(name, "parse ERR", e.message);
  }
}

// pocket services（HTML/JSON）
try {
  const p = fs.readFileSync("head_pocket.txt", "utf8");
  const m = p.match(/"slug":"[^"]+"/g) || [];
  console.log("\n=== pocket service slugs (first 30) ===");
  console.log([...new Set(m)].slice(0, 30).join("\n"));
} catch {}
