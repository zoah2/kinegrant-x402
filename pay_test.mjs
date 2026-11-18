// 用 Node 直接完成 x402 支付测试（避免 PowerShell 管道问题）
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const URL = process.argv[2] || "https://api.kinegrant.com/signals";

const proxied = (url, opts = {}) => fetch(url, { ...opts, redirect: "follow" });

const r1 = await proxied(URL);
console.log("status:", r1.status);
const hdr = r1.headers.get("payment-required");
console.log("payment-required header:", hdr ? hdr.slice(0, 60) + "..." : "MISSING");
if (!hdr) process.exit(1);

const prevRaw = await exec("baw", ["x402-payment", "preview", "--paymentRequirements", hdr, "--json"], {
  env: { ...process.env, HTTPS_PROXY: "http://127.0.0.1:7897", HTTP_PROXY: "http://127.0.0.1:7897", NODE_USE_ENV_PROXY: "1" },
  maxBuffer: 20 * 1024 * 1024,
  shell: true,
});
const prev = JSON.parse(prevRaw.stdout);
console.log("preview success:", prev.success, "amount:", prev.data?.options?.[0]?.amount, prev.data?.options?.[0]?.tokenSymbol);

const signRaw = await exec(
  "baw",
  ["x402-payment", "sign", "--paymentId", prev.data.paymentId, "--selectedIndex", String(prev.data.options[0].index), "--json"],
  {
    env: { ...process.env, HTTPS_PROXY: "http://127.0.0.1:7897", HTTP_PROXY: "http://127.0.0.1:7897", NODE_USE_ENV_PROXY: "1" },
    maxBuffer: 20 * 1024 * 1024,
  },
);
const sign = JSON.parse(signRaw.stdout);
console.log("sign success:", sign.success);

const r2 = await proxied(URL, {
  headers: { [sign.data.paymentHeaderName]: sign.data.paymentHeaderValue },
});
const body = await r2.text();
console.log("replay status:", r2.status);
console.log("body:", body.slice(0, 800));
