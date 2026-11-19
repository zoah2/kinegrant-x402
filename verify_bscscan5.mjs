// BscScan 验证 step2b：贴单文件 Solidity 源码（Single file 模式）
import { chromium } from "playwright";
import fs from "node:fs";

const source = fs.readFileSync("contracts/KineGrantRegistry.sol", "utf8");

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const pages = ctx.pages().filter((p) => p.url().includes("verifyContract-solc"));
const p = pages.length ? pages[pages.length - 1] : await ctx.newPage();
console.log("url:", p.url());

const ta = p.locator("#ContentPlaceHolder1_txtSourceCode");
if (await ta.count()) {
  await ta.fill("");               // 清空
  await ta.fill(source);           // 贴源码
  console.log("source pasted, length:", source.length);
} else { console.log("textarea missing"); }

await p.waitForTimeout(1000);
await p.screenshot({ path: "bscscan_v5_filled.png", timeout: 20000 }).catch(() => {});

// 提交
const btn = p.getByRole("button", { name: /Submit|Verify/i }).first();
if (await btn.count()) { await btn.click().catch(() => {}); console.log("submit clicked"); }
else {
  const b2 = p.locator('input[type="submit"]').first();
  if (await b2.count()) { await b2.click().catch(() => {}); console.log("submit input"); }
}

await p.waitForTimeout(15000);
console.log("after url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 900));
console.log(t.replace(/\s+/g, " ").slice(0, 600));
await p.screenshot({ path: "bscscan_v5_after.png", timeout: 20000 }).catch(() => {});
await b.close();
