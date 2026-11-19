// 填新验证码完成注册（快速）
import { chromium } from "playwright";

const CODE = "754630";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
// 找 email-verify 页面
const pages = ctx.pages().filter((x) => !x.isClosed());
let p = pages.find((x) => x.url().includes("email-verify"));
if (!p) p = pages.find((x) => x.url().includes("yicode")) || await ctx.newPage();
await p.bringToFront();
console.log("page:", p.url());

const inputs = p.locator("input");
const n = await inputs.count();
console.log("inputs:", n);
if (n > 0) {
  await inputs.first().fill(CODE);
  console.log("code filled");
}
const btn = p.getByRole("button", { name: /验证并创建账户|验证/ });
if ((await btn.count()) > 0) {
  await btn.first().click().catch(() => {});
  console.log("verify clicked");
}
await p.waitForTimeout(8000);
console.log("url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log(t.replace(/\s+/g, " ").slice(0, 500));
await p.screenshot({ path: "yicode_done.png", timeout: 20000 }).catch(() => {});
