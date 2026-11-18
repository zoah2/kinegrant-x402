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

const inputs = await p.evaluate(() =>
  [...document.querySelectorAll("input")].map((e, i) => ({
    i,
    type: e.type,
    placeholder: e.placeholder,
    value: e.value,
  })),
);
console.log("inputs:", JSON.stringify(inputs));

// 填 URL
if (inputs.length) {
  const box = p.locator("input").first();
  await box.click();
  await box.fill("api.kinegrant.com");
  await p.waitForTimeout(1000);
}

// 点 Add
const addBtn = p.getByRole("button", { name: /^Add$/ });
if ((await addBtn.count()) > 0) {
  await addBtn.first().click();
  console.log("Add clicked");
} else {
  console.log("no Add button");
}

await p.waitForTimeout(8000);
const t = await p.evaluate(() => document.body.innerText.slice(0, 1500));
console.log("=== result ===");
console.log(t);
await p.screenshot({ path: "x402scan_result.png", timeout: 20000 }).catch(() => {});
await browser.close();
