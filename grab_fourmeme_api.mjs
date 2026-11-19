// 抓 Four.meme 的 API（浏览器走新加坡节点）
import { chromium } from "playwright";
import fs from "node:fs";

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
  if (u.includes("meme-api") && !/\.(js|css|png|jpg|svg|woff2?|ico|webp)(\?|$)/.test(u)) {
    apis.push(req.method() + " " + u);
  }
});

await p.goto("https://four.meme/en", { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("nav:", e.message));
await p.waitForTimeout(15000);

console.log("=== API calls ===");
for (const a of [...new Set(apis)].slice(0, 40)) console.log(a);

fs.writeFileSync("fourmeme_apis.txt", [...new Set(apis)].join("\n"), "utf8");
await p.screenshot({ path: "fm_capture.png", timeout: 20000 }).catch(() => {});
await browser.close();
