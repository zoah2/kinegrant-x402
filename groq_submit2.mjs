import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = ctx.pages().find((x) => x.url().includes("groq.com"));
await p.bringToFront();
await p.waitForTimeout(1500);

// 用 data-testid 精确点击 Submit
const btn = p.locator('[data-testid="key-form-submit-button"]');
if ((await btn.count()) > 0) {
  await btn.first().click();
  console.log("submit clicked");
} else {
  console.log("submit button not found");
}
await p.waitForTimeout(6000);

const after = await p.evaluate(() => document.body.innerText);
fs.writeFileSync("groq_key_result.txt", after, "utf8");
console.log("=== after ===");
console.log(after.slice(0, 1500));

// 找 key（gsk_ 开头）
const m = after.match(/gsk_[A-Za-z0-9]{20,}/);
if (m) {
  fs.writeFileSync("groq_key.txt", m[0], "utf8");
  console.log("KEY FOUND:", m[0].slice(0, 12) + "...");
} else {
  console.log("no gsk_ key in text");
}
await p.screenshot({ path: "groq_key_done.png", timeout: 15000 }).catch(() => {});
await b.close();
