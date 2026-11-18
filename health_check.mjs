// 全端点健康检查：每个路径发未付费请求，应返回 402（或 400 参数错误）
import fs from "node:fs";

const base = "http://127.0.0.1:3101";
const r = await fetch(base + "/openapi.json");
const spec = await r.json();
const paths = Object.keys(spec.paths);

const results = [];
for (const p of paths) {
  if (p === "/health" || p === "/openapi.json" || p === "/v1/models") {
    results.push({ path: p, status: "skip" });
    continue;
  }
  const method = spec.paths[p].post ? "POST" : "GET";
  const url = method === "GET" ? base + p + "?token=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c&address=0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E" : base + p;
  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "POST" ? JSON.stringify({ prompt: "hi", messages: [{ role: "user", content: "hi" }] }) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    results.push({ path: p, method, status: res.status, ok: res.status === 402 || res.status === 400 || res.status === 503 });
  } catch (e) {
    results.push({ path: p, method, status: "ERR", err: String(e.message).slice(0, 60) });
  }
}

const bad = results.filter((x) => x.status !== "skip" && !x.ok);
const good = results.filter((x) => x.ok);
console.log("total:", paths.length, "good:", good.length, "bad:", bad.length);
for (const b of bad) console.log("BAD:", b.method, b.path, "->", b.status, b.err || "");
const byStatus = {};
for (const x of results) byStatus[x.status] = (byStatus[x.status] || 0) + 1;
console.log("status distribution:", JSON.stringify(byStatus));
fs.writeFileSync("health_check.json", JSON.stringify(results, null, 1), "utf8");
