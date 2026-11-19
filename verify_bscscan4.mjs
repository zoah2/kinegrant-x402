// BscScan 验证 step2：粘贴 standard-json 并提交
import { chromium } from "playwright";
import fs from "node:fs";

const standardJson = fs.readFileSync("contracts/standard-input.json", "utf8");

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const pages = ctx.pages().filter((p) => p.url().includes("verifyContract-solc"));
const p = pages.length ? pages[pages.length - 1] : await ctx.newPage();
if (!pages.length) {
  await p.goto("https://bscscan.com/verifyContract-solc?a=0xb72a19E2D79cD2A4d5FB0B9221Ff280d445189DE&c=v0.8.26%2bcommit.8a97fa7a&lictype=3", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(8000);
}
console.log("url:", p.url());

const fields = await p.evaluate(() => [...document.querySelectorAll("textarea,input[type=text],input:not([type])")].map((e) => ({ id: e.id, name: e.name, ph: e.placeholder, tag: e.tagName })));
console.log("fields:", JSON.stringify(fields.slice(0, 12)));

// 找 source code textarea（最大的那个）
let filled = false;
for (const f of fields) {
  const sel = f.id ? "#" + f.id : `[name="${f.name}"]`;
  if (f.tag === "TEXTAREA" || /code|source|json/i.test(f.name + f.id + f.ph)) {
    try {
      await p.locator(sel).first().fill(standardJson, { timeout: 8000 });
      console.log("filled:", sel);
      filled = true;
      break;
    } catch {}
  }
}
if (!filled) {
  // 兜底：填第一个 textarea
  const ta = p.locator("textarea").first();
  if (await ta.count()) { await ta.fill(standardJson); console.log("filled first textarea"); filled = true; }
}

await p.screenshot({ path: "bscscan_step2_filled.png", timeout: 20000 }).catch(() => {});

// 提交
for (const name of ["Submit", "Verify", "验证"]) {
  const btn = p.getByRole("button", { name: new RegExp(name, "i") });
  if (await btn.count()) { await btn.first().click().catch(() => {}); console.log("clicked:", name); break; }
}
const btn2 = p.locator('input[type="submit"], button[type="submit"]').first();
if (await btn2.count()) { await btn2.click().catch(() => {}); console.log("submit input clicked"); }

await p.waitForTimeout(12000);
console.log("after url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log(t.replace(/\s+/g, " ").slice(0, 500));
await p.screenshot({ path: "bscscan_step2_after.png", timeout: 20000 }).catch(() => {});
await b.close();
