// 解析币安公告富文本 body，提取纯文本
import fs from "node:fs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0";

const r = await fetch(
  "https://www.binance.com/bapi/composite/v1/public/cms/article/detail/query?articleCode=95f5dbe0ea674a48a739b59e046648bf",
  { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30000) },
);
const j = await r.json();
const body = JSON.parse(j.data.body);

const parts = [];
function walk(node) {
  if (!node) return;
  if (node.node === "text") {
    parts.push(node.text);
    return;
  }
  if (node.child) {
    for (const c of node.child) walk(c);
  }
}
walk(body);

const text = parts
  .join("")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .replace(/([.!?])\s+/g, "$1\n")
  .replace(/(Submission Period|Internal Review Period|Rewards|Judging|Terms|How to Submit|Eligibility|Requirements)/g, "\n$1");

fs.writeFileSync("hackathon.txt", text, "utf8");
console.log(text);
