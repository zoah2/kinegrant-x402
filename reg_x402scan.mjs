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
await p.waitForTimeout(8000);

const t = await p.evaluate(() => document.body.innerText.slice(0, 2000));
console.log("=== text ===");
console.log(t);

const inputs = await p.evaluate(() =>
  [...document.querySelectorAll("input, textarea, button")].map((e) => ({
    tag: e.tagName,
    type: e.type || "",
    name: e.name || "",
    placeholder: e.placeholder || "",
    text: e.tagName === "BUTTON" ? e.textContent.trim().slice(0, 40) : "",
  })),
);
console.log("=== controls ===");
console.log(JSON.stringify(inputs, null, 1));

await p.screenshot({ path: "x402scan_reg2.png", timeout: 20000 }).catch(() => {});
await browser.close();
