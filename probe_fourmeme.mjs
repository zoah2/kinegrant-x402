import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

const apis = [];
p.on("request", (req) => {
  const u = req.url();
  if (u.includes("four.meme") && !/\.(js|css|png|jpg|svg|woff2?|ico)(\?|$)/.test(u)) {
    apis.push(req.method() + " " + u.slice(0, 160));
  }
});

await p.goto("https://four.meme/en", { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("nav:", e.message));
await p.waitForTimeout(12000);

const title = await p.title();
const text = await p.evaluate(() => document.body.innerText.slice(0, 2000));
console.log("title:", title);
console.log("text:", text);
console.log("--- api calls ---");
for (const a of [...new Set(apis)].slice(0, 30)) console.log(a);

await p.screenshot({ path: "fourmeme3.png", timeout: 20000 }).catch(() => {});
await p.close();
await b.close();
