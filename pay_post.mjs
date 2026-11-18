// POST 支付测试（OpenAI 兼容端点）
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const URL = "http://127.0.0.1:3101/v1/chat/completions";
const BODY = JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: "Reply exactly OK" }], max_tokens: 20 });

const r1 = await fetch(URL, { method: "POST", headers: { "content-type": "application/json" }, body: BODY });
console.log("status:", r1.status);
const hdr = r1.headers.get("payment-required");
if (!hdr) { console.log("no payment header"); process.exit(1); }

const env = { ...process.env, HTTPS_PROXY: "http://127.0.0.1:7897", HTTP_PROXY: "http://127.0.0.1:7897", NODE_USE_ENV_PROXY: "1" };
const prev = JSON.parse((await exec("baw", ["x402-payment", "preview", "--paymentRequirements", hdr, "--json"], { env, maxBuffer: 20 * 1024 * 1024, shell: true })).stdout);
console.log("preview:", prev.success, "amount:", prev.data?.options?.[0]?.amount);

const sign = JSON.parse((await exec("baw", ["x402-payment", "sign", "--paymentId", prev.data.paymentId, "--selectedIndex", String(prev.data.options[0].index), "--json"], { env, maxBuffer: 20 * 1024 * 1024, shell: true })).stdout);
console.log("sign:", sign.success);

const r2 = await fetch(URL, {
  method: "POST",
  headers: { "content-type": "application/json", [sign.data.paymentHeaderName]: sign.data.paymentHeaderValue },
  body: BODY,
});
console.log("replay status:", r2.status);
const txt = await r2.text();
console.log("body:", txt.slice(0, 500));
