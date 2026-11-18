import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

await p.goto("https://platform.deepseek.com/api_keys", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(6000);

// 点创建 API key
await p.getByRole("button", { name: /创建 API key/ }).first().click({ timeout: 20000 });
await p.waitForTimeout(3000);

const t = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log("=== dialog ===");
console.log(t);

// 输入名称
const inputs = await p.evaluate(() =>
  [...document.querySelectorAll("input")].map((e, i) => ({ i, placeholder: e.placeholder, type: e.type, value: e.value })),
);
console.log("inputs:", JSON.stringify(inputs));

const nameInput = p.locator("input").first();
await nameInput.click();
await nameInput.fill("kinegrant-x402");
await p.waitForTimeout(1000);

// 点确认/创建按钮
const btns = await p.evaluate(() =>
  [...document.querySelectorAll("button")].map((e) => e.textContent.trim()).filter(Boolean),
);
console.log("buttons:", JSON.stringify(btns));

const createBtn = p.getByRole("button", { name: /^(确认|创建|确定|Create)$/ });
if ((await createBtn.count()) > 0) {
  await createBtn.first().click();
  console.log("create clicked");
} else {
  console.log("no create button matched");
}
await p.waitForTimeout(5000);

const after = await p.evaluate(() => document.body.innerText);
console.log("=== after ===");
console.log(after.slice(0, 1200));
fs.writeFileSync("ds_after.txt", after, "utf8");
await p.screenshot({ path: "ds_key_created.png", timeout: 15000 }).catch(() => {});
await b.close();
