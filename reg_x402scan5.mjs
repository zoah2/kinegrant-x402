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
await p.waitForTimeout(180000);

const t = await p.evaluate(() => document.body.innerText.slice(0, 1200));
console.log("=== probe ===");
console.log(t);

const btn = p.getByRole("button", { name: /Add API \(\d+ resources\)/ });
if ((await btn.count()) > 0) {
  await btn.first().click();
  console.log("Add API clicked");
  await p.waitForTimeout(12000);
  const t2 = await p.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log("=== after ===");
  console.log(t2);
} else {
  console.log("no Add API button");
}
await p.screenshot({ path: "x402scan_reg4.png", timeout: 20000 }).catch(() => {});
await browser.close();



