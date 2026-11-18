import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = ctx.pages()[0];

const ok = await p.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")].filter(
    (i) =>
      i.offsetParent !== null &&
      !i.placeholder &&
      !["radio", "checkbox", "hidden"].includes(i.type),
  );
  if (!inputs.length) return "no input";
  const el = inputs[0];
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  ).set;
  setter.call(el, "488657");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.focus();
  return "set value: " + el.value;
});
console.log(ok);
await p.waitForTimeout(1000);
await p.screenshot({ path: "code-typed3.png" });

const btns = p.getByRole("button", { name: "确定", exact: true });
await btns.last().click();
await p.waitForTimeout(9000);
await p.screenshot({ path: "ns-final4.png" });
const t = await p.evaluate(() => document.body.innerText.slice(0, 500));
console.log(t);
await b.close();
