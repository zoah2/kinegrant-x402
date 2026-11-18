// BTC 数据源：mempool.space（被墙）→ blockstream.info（可达）
import fs from "node:fs";

let s = fs.readFileSync("extended-chains.mjs", "utf8");
s = s.replace('const BTC_API = "https://mempool.space/api";', 'const BTC_API = "https://blockstream.info/api";');
s = s.replace('const j = await btcGet("/v1/fees/recommended");', 'const j = await btcGet("/fee-estimates");');
fs.writeFileSync("extended-chains.mjs", s, "utf8");
console.log("BTC_API:", s.includes("blockstream.info"));
console.log("fee path:", s.includes("/fee-estimates"));
