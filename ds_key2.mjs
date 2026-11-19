import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

await p.goto("https://platform.deepseek.com/api_keys", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(8000);
console.log("url:", p.url());

// 点创建 API key
const create = p.getByRole("button", { name: /创建 API key|Create API key/ });
if ((await create.count()) > 0) {
  await create.first().click().catch(() => {});
  await p.waitForTimeout(4000);
  console.log("create clicked");
}

// 填名称
const inputs = await p.evaluate(() => [...document.querySelectorAll("input")].map((e) => ({ ph: e.placeholder, v: e.value })));
console.log("inputs:", JSON.stringify(inputs));
const nameInput = p.getByPlaceholder(/名称|name/i);
if ((await nameInput.count()) > 0) {
  await nameInput.first().fill("kinegrant-x402");
  console.log("name filled");
} else if (inputs.length) {
  await p.locator("input").first().fill("kinegrant-x402");
  console.log("fallback filled");
}
await p.waitForTimeout(1000);

// 提交（按钮可能叫"创建"/"确定"/"确认"）
for (const name of ["创建", "确定", "确认", "Create", "Submit"]) {
  const btn = p.getByRole("button", { name });
  if ((await btn.count()) > 0) {
    await btn.first().click().catch(() => {});
    console.log("clicked:", name);
    await p.waitForTimeout(6000);
    break;
  }
}

const after = await p.evaluate(() => document.body.innerText);
fs.writeFileSync("ds_key_result.txt", after, "utf8");
console.log("=== after ===");
console.log(after.slice(0, 1500));
const m = after.match(/sk-[A-Za-z0-9]{20,}/);
if (m) {
  fs.writeFileSync("ds_api_key.txt", m[0], "utf8");
  console.log("KEY FOUND:", m[0].slice(0, 10) + "...");
}
await p.screenshot({ path: "ds_key_page.png", timeout: 20000 }).catch(() => {});
await b.close();
