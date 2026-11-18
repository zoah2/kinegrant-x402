import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = ctx.pages()[0];

const sel = 'input[type="text"]:not([placeholder])';
const box = p.locator(sel).first();
await box.click();
await box.fill("488657");
await p.waitForTimeout(800);
const val = await box.inputValue();
console.log("value now:", val);
await p.screenshot({ path: "code-typed2.png" });

await p.getByRole("button", { name: "确定", exact: true }).last().click();
await p.waitForTimeout(9000);
await p.screenshot({ path: "ns-final3.png" });
const t = await p.evaluate(() => document.body.innerText.slice(0, 500));
console.log(t);
await b.close();
