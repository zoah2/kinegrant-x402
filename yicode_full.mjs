// 一体化：发码 → 轮询 code.txt → 填码 → 注册（同一页面，不换会话）
import { chromium } from "playwright";
import fs from "node:fs";

const EMAIL = "2515516898@qq.com";
const PASSWORD = "Yico!2026x9";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto("https://www.yicode.ai/register", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(6000);

const agree = p.getByRole("button", { name: /同意并继续/ });
if ((await agree.count()) > 0) { await agree.first().click().catch(() => {}); await p.waitForTimeout(2500); }

const inputs = p.locator("input");
await inputs.nth(0).fill(EMAIL);
await inputs.nth(1).fill(PASSWORD);
await inputs.nth(2).fill(PASSWORD);
const next = p.getByRole("button", { name: /^继续$/ });
if ((await next.count()) > 0) { await next.first().click().catch(() => {}); }
await p.waitForTimeout(6000);
console.log("url:", p.url());
console.log("CODE_SENT");

// 清空旧 code.txt
try { fs.writeFileSync("yicode_code.txt", "", "utf8"); } catch {}

// 轮询 code.txt（最多 5 分钟）
let code = null;
for (let i = 0; i < 60; i++) {
  await sleep(3000);
  try {
    const v = fs.readFileSync("yicode_code.txt", "utf8").trim();
    if (/^\d{6}$/.test(v)) { code = v; break; }
  } catch {}
}
console.log("got code:", code);
if (!code) { await p.screenshot({ path: "yicode_timeout.png" }); process.exit(0); }

const ci = p.locator("input");
if ((await ci.count()) > 0) await ci.first().fill(code);
const btn = p.getByRole("button", { name: /验证并创建账户|验证/ });
if ((await btn.count()) > 0) await btn.first().click().catch(() => {});
await p.waitForTimeout(8000);
console.log("after verify url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log(t.replace(/\s+/g, " ").slice(0, 500));
await p.screenshot({ path: "yicode_final.png", timeout: 20000 }).catch(() => {});
