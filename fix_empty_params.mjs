// 给空参数端点补默认 input schema（x402scan 要求）
import fs from "node:fs";

const FILES = ["utility-xpay.mjs", "verdict.mjs", "expand-rpc.mjs", "multi-chain.mjs", "extended-tools.mjs", "ai-proxy.mjs", "openai-compat.mjs"];
const DEFAULT = `[{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56 (BNB Smart Chain)" }]`;

for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8");
  const before = s;
  // params: [] → 默认参数
  s = s.replace(/params: \[\]/g, "params: " + DEFAULT);
  if (s !== before) {
    fs.writeFileSync(f, s, "utf8");
    console.log("patched:", f);
  }
}
