import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const all = () => ctx.pages().filter((x) => !x.isClosed());

const p = all().find((x) => x.url().includes("openrouter.ai")) || (await ctx.newPage());
await p.bringToFront();
await p.waitForTimeout(1500);

// 点 Sign in
if (p.url().includes("sign-in")) {
  const si = p.getByRole("link", { name: /^Sign in$/i });
  if ((await si.count()) > 0) await si.first().click().catch(() => {});
  await p.waitForTimeout(3000);
}
const t1 = await p.evaluate(() => document.body.innerText.slice(0, 500));
console.log("sign-in page:", t1.replace(/\s+/g, " ").slice(0, 300));

// 点 Google
const g = p.getByText("Google", { exact: false });
const n = await g.count();
console.log("google matches:", n);
if (n) {
  await g.first().click().catch(() => {});
  await p.waitForTimeout(8000);
}
console.log("after google click url:", p.url().slice(0, 100));

// 处理 Google 账号选择
let gp = all().find((x) => x.url().includes("accounts.google.com"));
if (gp) {
  await gp.waitForTimeout(2000);
  const acct = gp.getByText("A0917212213@gmail.com", { exact: false });
  if ((await acct.count()) > 0) {
    await acct.first().click().catch(() => {});
    console.log("account clicked");
    await gp.waitForTimeout(5000);
  }
  for (const name of ["继续", "Continue", "允许", "Allow"]) {
    const btn = gp.getByRole("button", { name });
    if ((await btn.count()) > 0) {
      await btn.first().click().catch(() => {});
      console.log("clicked:", name);
      await gp.waitForTimeout(5000);
      break;
    }
  }
}

await p.waitForTimeout(6000);
console.log("final url:", p.url().slice(0, 100));
const t2 = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log(t2.replace(/\s+/g, " ").slice(0, 400));
await b.close();
