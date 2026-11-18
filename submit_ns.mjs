import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = ctx.pages()[0];

const input = p.locator('input[placeholder*="验证码"]').first();
await input.fill("488657");
await p.waitForTimeout(600);

// 弹窗里的"确定"（蓝色按钮）
const btns = p.getByRole("button", { name: "确定", exact: true });
const n = await btns.count();
console.log("confirm buttons:", n);
await btns.last().click();
await p.waitForTimeout(7000);

await p.screenshot({ path: "ns-done.png" });
const t = await p.evaluate(() => document.body.innerText.slice(0, 500));
console.log(t);
await b.close();
