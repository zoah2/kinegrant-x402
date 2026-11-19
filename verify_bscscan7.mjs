// BscScan JSON 验证页：上传 standard-input.json → 提交
import { chromium } from "playwright";
import path from "node:path";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const pages = ctx.pages().filter((p) => p.url().includes("verifyContract-solc-json"));
const p = pages.length ? pages[pages.length - 1] : await ctx.newPage();
console.log("url:", p.url());

const fileInput = p.locator('[name="ctl00$ContentPlaceHolder1$FileUpload1"]');
if (await fileInput.count()) {
  await fileInput.setInputFiles(path.resolve("contracts/standard-input.json"));
  console.log("file uploaded");
} else { console.log("file input missing"); }

await p.waitForTimeout(2000);
await p.screenshot({ path: "json_uploaded.png", timeout: 20000 }).catch(() => {});

const btn = p.getByRole("button", { name: /Submit|Verify/i }).first();
if (await btn.count()) { await btn.click().catch(() => {}); console.log("submit clicked"); }
else {
  const b2 = p.locator('input[type="submit"]').first();
  if (await b2.count()) { await b2.click().catch(() => {}); console.log("submit input clicked"); }
}
await p.waitForTimeout(15000);
console.log("after url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 900));
console.log(t.replace(/\s+/g, " ").slice(0, 600));
await p.screenshot({ path: "json_after.png", timeout: 20000 }).catch(() => {});
await b.close();
