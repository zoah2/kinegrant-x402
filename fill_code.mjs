import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = ctx.pages()[0];

// 找到弹窗里的验证码输入框（无 placeholder 的可见 input）
const info = await p.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")].filter(
    (i) => i.offsetParent !== null && !i.placeholder,
  );
  return inputs.map((i) => ({ type: i.type, cls: i.className.slice(0, 50), val: i.value }));
});
console.log("candidates:", JSON.stringify(info));

const inputs = p.locator("input").filter({ hasNot: p.locator("[placeholder]") });
// 更稳妥：直接用 JS 定位并 focus，再 keyboard.type
const focused = await p.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")].filter(
    (i) => i.offsetParent !== null && !i.placeholder,
  );
  if (!inputs.length) return false;
  inputs[0].focus();
  return true;
});
console.log("focused:", focused);
if (focused) {
  await p.keyboard.type("488657", { delay: 60 });
  await p.waitForTimeout(800);
}
await p.screenshot({ path: "code-typed.png" });

// 点击弹窗"确定"
const btns = p.getByRole("button", { name: "确定", exact: true });
await btns.last().click();
await p.waitForTimeout(8000);
await p.screenshot({ path: "ns-final2.png" });
const t = await p.evaluate(() => document.body.innerText.slice(0, 600));
console.log(t);
await b.close();
