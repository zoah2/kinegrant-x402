// 重新发送 yicode 验证码
import { chromium } from "playwright";

const EMAIL = "2515516898@qq.com";
const PASSWORD = "Yico!2026x9";

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
await p.waitForTimeout(5000);
console.log("url:", p.url());

// 如果在 email-verify 页，点"重新发送"
const resend = p.getByRole("button", { name: /重新发送|重发/ });
if ((await resend.count()) > 0) {
  await resend.first().click().catch(() => {});
  console.log("resend clicked");
}
await p.waitForTimeout(3000);
const t = await p.evaluate(() => document.body.innerText.slice(0, 600));
console.log(t.replace(/\s+/g, " ").slice(0, 400));
await b.close();
