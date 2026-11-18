// 测试 PoW 免费流程：拿 challenge → 算 nonce → 带 X-PoW 调用免费端点
import crypto from "node:crypto";

const base = "http://127.0.0.1:3101";
const ch = await (await fetch(base + "/pow/challenge")).json();
console.log("challenge:", ch.challenge, "difficulty:", ch.difficulty);

const target = "0".repeat(ch.difficulty);
let nonce = 0;
let hash = "";
const t0 = Date.now();
while (true) {
  hash = crypto.createHash("sha256").update(ch.challenge + ":" + nonce).digest("hex");
  if (hash.startsWith(target)) break;
  nonce++;
}
console.log("solved nonce:", nonce, "hash:", hash.slice(0, 16), "ms:", Date.now() - t0);

const r = await fetch(base + "/x402/time", { headers: { "x-pow": ch.challenge + ":" + nonce } });
console.log("free call status:", r.status);
console.log("body:", (await r.text()).slice(0, 300));

// 复用同一 PoW 应被拒（一次性）
const r2 = await fetch(base + "/x402/time", { headers: { "x-pow": ch.challenge + ":" + nonce } });
console.log("replay status (should 402):", r2.status);
