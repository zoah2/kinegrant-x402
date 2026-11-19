// 填验证码完成 yicode 注册
import { chromium } from "playwright";

const CODE = "113561";
const EMAIL = "2515516898@qq.com";
const PASSWORD = "Yico!2026x9";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

// 直接去验证页
await p.goto("https://www.yicode.ai/email-verify", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(5000);

let t = await p.evaluate(() => document.body.innerText.slice(0, 400));
console.log("page:", t.replace(/\s+/g, " ").slice(0, 200));

// 填验证码
const codeInput = p.locator("input").first();
if ((await codeInput.count()) > 0) {
  await codeInput.fill(CODE);
  console.log("code filled");
}
const verifyBtn = p.getByRole("button", { name: /验证并创建账户|验证/ });
if ((await verifyBtn.count()) > 0) {
  await verifyBtn.first().click().catch(() => {});
  console.log("verify clicked");
}
await p.waitForTimeout(8000);
console.log("url:", p.url());
t = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log(t.replace(/\s+/g, " ").slice(0, 500));
await p.screenshot({ path: "yicode_verified.png", timeout: 20000 }).catch(() => {});
await b.close();
