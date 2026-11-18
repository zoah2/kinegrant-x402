import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = ctx.pages()[0].constructor.name === "Page" ? ctx.pages()[0] : await ctx.newPage();
await p.getByText("全部域名", { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(6000);
const rows = await p.evaluate(() => {
  return [...document.querySelectorAll("tr")]
    .map((tr) => tr.textContent.slice(0, 80))
    .filter((t) => t.includes("kinegrant") || t.includes("kineworld"));
});
console.log(JSON.stringify(rows));
await p.screenshot({ path: "domain-tab.png" });
await b.close();
