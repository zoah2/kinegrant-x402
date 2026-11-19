// 验证降难度后的 PoW 全流程
import crypto from "node:crypto";

const base = "http://127.0.0.1:3101";
const ch = await (await fetch(base + "/pow/challenge")).json();
console.log("challenge:", ch.challenge.slice(0, 12), "difficulty:", ch.difficulty, "bits:", ch.difficultyBits);

const target = "0".repeat(ch.difficulty);
let nonce = 0, hash = "";
const t0 = Date.now();
while (true) {
  hash = crypto.createHash("sha256").update(ch.challenge + ":" + nonce).digest("hex");
  if (hash.startsWith(target)) break;
  nonce++;
}
console.log("solved:", nonce, "hashes in", Date.now() - t0, "ms");

const r = await fetch(base + "/pow/uuid", { headers: { "x-pow": ch.challenge + ":" + nonce } });
console.log("free /pow/uuid:", r.status, (await r.text()).slice(0, 120));

const r2 = await fetch(base + "/pow/json-format?text=" + encodeURIComponent('{"a":1,"b":[2,3]}'), { headers: { "x-pow": ch.challenge + ":" + nonce } });
console.log("replay same pow (expect 402):", r2.status);
