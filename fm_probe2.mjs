import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: false,
  args: ["--proxy-server=http://127.0.0.1:7897", "--no-first-run"],
});
const ctx = await browser.newContext();
const p = await ctx.newPage();

const apis = [];
p.on("request", (req) => {
  const u = req.url();
  if (u.includes("four.meme") && !/\.(js|css|png|jpg|svg|woff2?|ico|webp)(\?|$)/.test(u)) {
    apis.push(req.method() + " " + u.slice(0, 180));
  }
});

await p.goto("https://four.meme/en", { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("nav:", e.message));
await p.waitForTimeout(12000);

const text = await p.evaluate(() => document.body.innerText.slice(0, 1500));
console.log("text:", text);
console.log("--- api ---");
for (const a of [...new Set(apis)].slice(0, 40)) console.log(a);

await p.screenshot({ path: "fourmeme4.png", timeout: 20000 }).catch(() => {});
await browser.close();
