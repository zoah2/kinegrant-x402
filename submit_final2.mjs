// 提交 293 个资源到 x402scan
import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: false,
  args: ["--proxy-server=http://127.0.0.1:7897", "--no-first-run"],
});
const ctx = await browser.newContext();
const p = await ctx.newPage();

await p.goto("https://www.x402scan.com/resources/register", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(6000);

const box = p.locator("input").first();
await box.click();
await box.type("https://api.kinegrant.com", { delay: 20 });

let clicked = false;
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(20000);
  const txt = await p.evaluate(() => document.body.innerText).catch(() => "");
  const verifying = txt.includes("Verifying");
  const addMatch = txt.match(/Add API \((\d+) resources\)/);
  console.log(`[${i}] verifying=${verifying} add=${addMatch ? addMatch[1] : "none"}`);
  if (!verifying && addMatch) {
    const btn = p.getByRole("button", { name: /Add API/ });
    if ((await btn.count()) > 0) {
      await btn.first().click().catch(() => {});
      clicked = true;
      console.log("clicked Add API");
      await p.waitForTimeout(12000);
      break;
    }
  }
}

const t = await p.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => "");
console.log("=== final ===");
console.log(t);
console.log("clicked:", clicked);
await browser.close();
