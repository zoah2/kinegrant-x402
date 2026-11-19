// 重新开始注册流程并发送新验证码（保持页面打开等用户给码）
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
await p.waitForTimeout(6000);

console.log("url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 600));
console.log(t.replace(/\s+/g, " ").slice(0, 400));
// 不关浏览器，页面留在 email-verify
