import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: false,
  args: ["--proxy-server=http://127.0.0.1:7897", "--no-first-run"],
});
const ctx = await browser.newContext();
const p = await ctx.newPage();

await p.goto("https://www.x402scan.com/resources/register", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
}).catch((e) => console.log("nav:", e.message));
await p.waitForTimeout(6000);

const box = p.locator("input").first();
await box.click();
await box.type("https://api.kinegrant.com", { delay: 30 });
await p.waitForTimeout(40000);

const t = await p.evaluate(() => document.body.innerText.slice(0, 2000));
console.log("=== after probe ===");
console.log(t);

// 若 Add 可用则点击
const state = await p.evaluate(() => {
  const add = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Add");
  return add ? { disabled: add.disabled } : { missing: true };
});
console.log("add state:", JSON.stringify(state));
if (!state.disabled) {
  await p.getByRole("button", { name: /^Add$/ }).first().click();
  console.log("Add clicked");
  await p.waitForTimeout(10000);
  const t2 = await p.evaluate(() => document.body.innerText.slice(0, 2000));
  console.log("=== after add ===");
  console.log(t2);
}
await p.screenshot({ path: "x402scan_reg3.png", timeout: 20000 }).catch(() => {});
await browser.close();
