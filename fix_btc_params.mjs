// 给 /btc/fees 加 input schema
import fs from "node:fs";

let s = fs.readFileSync("extended-chains.mjs", "utf8");
const target = 'path: "/btc/fees", usd: 0.001,';
const idx = s.indexOf(target);
if (idx < 0) { console.log("target not found"); process.exit(0); }
// 找 summary 后的 "params:" 是否存在
const seg = s.slice(idx, idx + 200);
if (seg.includes("params:")) { console.log("already has params"); process.exit(0); }
// 在 summary 之后插入 params（summary 以逗号结尾）
const insert = ' params: [{ name: "network", in: "query", required: false, schema: { type: "string", default: "mainnet" }, description: "Bitcoin network" }],';
s = s.slice(0, idx) + target + insert + s.slice(idx + target.length);
fs.writeFileSync("extended-chains.mjs", s, "utf8");
console.log("patched:", s.includes("Bitcoin network"));
