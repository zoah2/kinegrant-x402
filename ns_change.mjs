import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = ctx.pages()[0];

const inputs = p.locator('input[placeholder*="dns2"]');
await inputs.first().fill("leif.ns.cloudflare.com");
await p.waitForTimeout(500);
await p.getByText("添加DNS", { exact: true }).click();
await p.waitForTimeout(1500);

const inputs2 = p.locator('input[placeholder*="dns2"]');
const count = await inputs2.count();
console.log("inputs:", count);
if (count > 1) {
  await inputs2.nth(1).fill("mira.ns.cloudflare.com");
}
await p.waitForTimeout(500);
await p.screenshot({ path: "ns-filled.png" });

await p.getByRole("button", { name: "确定", exact: true }).first().click();
await p.waitForTimeout(4000);
// 可能有二次确认弹窗
const okBtn = p.getByRole("button", { name: "确定", exact: true });
if (await okBtn.count() > 1) {
  await okBtn.last().click();
  await p.waitForTimeout(3000);
}
await p.screenshot({ path: "ns-submitted.png" });
console.log("submitted, url:", p.url());
await b.close();
