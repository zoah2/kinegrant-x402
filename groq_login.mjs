import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const pages = ctx.pages();
const p = pages[pages.length - 1];

await p.goto("https://console.groq.com/keys", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(4000);

// 点 Continue with Google
const g = p.getByText("Continue with Google", { exact: true });
if ((await g.count()) > 0) {
  await g.first().click();
  console.log("google clicked");
} else {
  console.log("no google button");
}

await p.waitForTimeout(8000);
console.log("url after:", p.url());

// 可能在弹窗里选账号
const acct = p.getByText("A0917212213@gmail.com", { exact: false });
if ((await acct.count()) > 0) {
  await acct.first().click();
  console.log("account clicked");
  await p.waitForTimeout(8000);
}

console.log("final url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log(t);
await p.screenshot({ path: "groq_after.png", timeout: 15000 }).catch(() => {});
await b.close();
