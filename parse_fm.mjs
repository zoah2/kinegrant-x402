// 解析 four.meme agentic 页面的 RSC 数据
import fs from "node:fs";

const html = fs.readFileSync("fm_agentic.html", "utf8");
const parts = [];
const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
let m;
while ((m = re.exec(html))) {
  try {
    parts.push(JSON.parse('"' + m[1] + '"'));
  } catch {
    parts.push(m[1]);
  }
}
const payload = parts.join("");
fs.writeFileSync("fm_agentic_rsc.txt", payload, "utf8");
console.log("rsc length:", payload.length);

// 提取可能的 token 字段
const tokens = [];
const tokenRe = /"name":"([^"]{1,40})","symbol":"([^"]{1,20})"[^}]{0,400}?"address":"(0x[0-9a-fA-F]{40})"/g;
let t;
while ((t = tokenRe.exec(payload))) {
  tokens.push({ name: t[1], symbol: t[2], address: t[3] });
}
console.log("tokens found:", tokens.length);
for (const x of tokens.slice(0, 20)) console.log(x.symbol, "|", x.name, "|", x.address);

// 找 agent 相关关键词上下文
for (const kw of ["Agent", "agent", "agentic"]) {
  let idx = payload.indexOf(kw);
  if (idx >= 0) {
    console.log("--- context around first", kw, "---");
    console.log(payload.slice(Math.max(0, idx - 200), idx + 600));
    break;
  }
}
