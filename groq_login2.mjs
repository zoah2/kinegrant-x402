import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];

const all = () => ctx.pages().filter((x) => !x.isClosed());

// 找 Google 授权页
let googlePage = all().find((x) => x.url().includes("accounts.google.com"));
if (googlePage) {
  console.log("google page:", googlePage.url().slice(0, 80));
  const txt = await googlePage.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => "");
  console.log("content:", txt.replace(/\s+/g, " ").slice(0, 300));
  // 点继续/允许
  for (const name of ["继续", "Continue", "允许", "Allow", "允许访问"]) {
    const btn = googlePage.getByRole("button", { name });
    if ((await btn.count()) > 0) {
      await btn.first().click().catch(() => {});
      console.log("clicked:", name);
      await googlePage.waitForTimeout(5000);
      break;
    }
  }
  await googlePage.waitForTimeout(5000);
  console.log("google page after:", all().find((x) => x.url().includes("accounts.google.com"))?.url().slice(0, 60) || "closed");
}

// 找 Groq 页（OAuth 完成后）
const groqPage = all().find((x) => x.url().includes("groq.com"));
if (groqPage) {
  await groqPage.waitForTimeout(6000);
  console.log("groq url:", groqPage.url());
  const t = await groqPage.evaluate(() => document.body.innerText.slice(0, 1200)).catch(() => "");
  console.log(t);
} else {
  console.log("no groq page; pages:", all().map((x) => x.url().slice(0, 60)));
}
await b.close();
