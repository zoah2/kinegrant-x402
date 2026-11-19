// 用 QQ 邮箱注册 yicode.ai
import { chromium } from "playwright";

const EMAIL = "2515516898@qq.com";
const PASSWORD = "Yico!2026x9";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto("https://www.yicode.ai/register", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(6000);

const agree = p.getByRole("button", { name: /同意并继续/ });
if ((await agree.count()) > 0) { await agree.first().click().catch(() => {}); console.log("terms agreed"); await p.waitForTimeout(3000); }

const inputs = p.locator("input");
const n = await inputs.count();
console.log("inputs:", n);
await inputs.nth(0).fill(EMAIL);
await inputs.nth(1).fill(PASSWORD);
await inputs.nth(2).fill(PASSWORD);
console.log("form filled with", EMAIL);

const next = p.getByRole("button", { name: /^继续$/ });
if ((await next.count()) > 0) { await next.first().click().catch(() => {}); console.log("continue clicked"); }
await p.waitForTimeout(6000);
console.log("url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 900));
console.log(t.replace(/\s+/g, " ").slice(0, 600));
const afterInputs = await p.evaluate(() => [...document.querySelectorAll("input")].map((e) => e.placeholder));
console.log("after inputs:", JSON.stringify(afterInputs));
await p.screenshot({ path: "yicode_reg2.png", timeout: 20000 }).catch(() => {});
await b.close();
