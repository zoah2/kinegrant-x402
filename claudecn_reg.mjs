import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

await p.goto("https://claudecn.top/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(6000);

// 找"获取 ClaudeCN"/注册按钮
const btns = await p.evaluate(() => [...document.querySelectorAll("a,button")].map((e) => ({ t: e.textContent.trim().slice(0, 30), h: e.href || "" })).filter((x) => x.t));
console.log("links:", JSON.stringify(btns.slice(0, 20)));

const getBtn = p.getByText(/获取 ClaudeCN|注册|开始使用|Get started/).first();
if ((await getBtn.count()) > 0) {
  await getBtn.click().catch(() => {});
  await p.waitForTimeout(6000);
  console.log("clicked, url:", p.url());
}
const t = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log(t.replace(/\s+/g, " ").slice(0, 500));
const inputs = await p.evaluate(() => [...document.querySelectorAll("input")].map((e) => e.placeholder));
console.log("inputs:", JSON.stringify(inputs));
await p.screenshot({ path: "claudecn_reg.png", timeout: 15000 }).catch(() => {});
await b.close();
