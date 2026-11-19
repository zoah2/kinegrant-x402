// 创建 DeepSeek API key（邮箱已绑定）
import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

await p.goto("https://platform.deepseek.com/api_keys", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(8000);
console.log("url:", p.url());

const create = p.getByRole("button", { name: /创建 API key|Create API key/ });
if ((await create.count()) > 0) {
  await create.first().click().catch(() => {});
  await p.waitForTimeout(4000);
}
console.log("dialog inputs:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("input")].map((e) => e.placeholder))));

const nameInput = p.getByPlaceholder(/输入 API key 的名称|API key 的名称/);
if ((await nameInput.count()) > 0) {
  await nameInput.first().fill("kinegrant-x402");
  console.log("name filled");
} else {
  const inp = p.locator("input").first();
  if ((await inp.count()) > 0) { await inp.fill("kinegrant-x402"); console.log("fallback filled"); }
}
await p.waitForTimeout(1000);

for (const name of ["创建", "确定", "确认", "Create"]) {
  const btn = p.getByRole("button", { name });
  if ((await btn.count()) > 0) { await btn.first().click().catch(() => {}); console.log("clicked:", name); break; }
}
await p.waitForTimeout(6000);

const after = await p.evaluate(() => document.body.innerText);
fs.writeFileSync("ds_key3_result.txt", after, "utf8");
console.log("=== after ===");
console.log(after.slice(0, 1500));
const m = after.match(/sk-[A-Za-z0-9]{20,}/);
if (m) {
  fs.writeFileSync("ds_api_key.txt", m[0], "utf8");
  console.log("KEY FOUND:", m[0].slice(0, 10) + "...");
} else {
  console.log("no sk- key found");
}
await p.screenshot({ path: "ds_key3.png", timeout: 20000 }).catch(() => {});
await b.close();
