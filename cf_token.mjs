import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

await p.goto("https://dash.cloudflare.com/profile/api-tokens", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(8000);
console.log("url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log(t.replace(/\s+/g, " ").slice(0, 500));

// 点 Create Token
const btn = p.getByRole("button", { name: /Create Token/i });
if ((await btn.count()) > 0) {
  await btn.first().click().catch(() => {});
  await p.waitForTimeout(5000);
  console.log("create clicked, url:", p.url());
  const t2 = await p.evaluate(() => document.body.innerText.slice(0, 1200));
  console.log(t2.replace(/\s+/g, " ").slice(0, 600));
}

await p.screenshot({ path: "cf_tokens.png", timeout: 20000 }).catch(() => {});
await b.close();
