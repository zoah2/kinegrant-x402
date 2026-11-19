// BscScan 完整验证 v6：step1 明确选 Standard-Json-Input(3) → step2 贴 json
import { chromium } from "playwright";
import fs from "node:fs";

const ADDR = "0xb72a19E2D79cD2A4d5FB0B9221Ff280d445189DE";
const standardJson = fs.readFileSync("contracts/standard-input.json", "utf8");
const N = (n) => `[name="ctl00$ContentPlaceHolder1$${n}"]`;

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

// ---- step 1 ----
await p.goto(`https://bscscan.com/verifyContract?a=${ADDR}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
await p.waitForTimeout(8000);
await p.locator(N("txtContractAddress")).fill(ADDR);
await p.waitForTimeout(800);
const sel = p.locator(N("ddlCompilerType"));
const opts = await sel.evaluate((e) => [...e.options].map((o) => ({ v: o.value, t: o.text })));
const jsonOpt = opts.find((o) => /Standard-Json-Input/i.test(o.t));
console.log("json option:", JSON.stringify(jsonOpt));
await sel.selectOption(jsonOpt.v);
await p.waitForTimeout(2500);
const vs = await p.locator(N("ddlCompilerVersions")).evaluate((e) => [...e.options].map((o) => ({ v: o.value, t: o.text })));
const v26 = vs.find((o) => o.t.includes("0.8.26") || o.v.includes("0.8.26")) || vs[0];
await p.locator(N("ddlCompilerVersions")).selectOption(v26.v);
const ls = await p.locator(N("ddlLicenseType")).evaluate((e) => [...e.options].map((o) => ({ v: o.value, t: o.text })));
const mit = ls.find((o) => /mit/i.test(o.t)) || ls[0];
await p.locator(N("ddlLicenseType")).selectOption(mit.v);
await p.locator("#chkTermsOfUse").check().catch(() => {});
console.log("step1:", v26.t, mit.t);
await p.locator(N("btnSubmit")).click();
await p.waitForTimeout(10000);
console.log("step2 url:", p.url());

// ---- step 2 ----
const ta = p.locator("#ContentPlaceHolder1_txtSourceCode");
if (await ta.count()) {
  await ta.fill(standardJson);
  console.log("json pasted, len:", standardJson.length);
} else { console.log("textarea missing (step2)"); }
await p.waitForTimeout(1000);
await p.screenshot({ path: "bscscan_v6_filled.png", timeout: 20000 }).catch(() => {});

const btn = p.getByRole("button", { name: /Submit|Verify/i }).first();
if (await btn.count()) { await btn.click().catch(() => {}); console.log("submit clicked"); }
await p.waitForTimeout(15000);
console.log("after url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 900));
console.log(t.replace(/\s+/g, " ").slice(0, 600));
await p.screenshot({ path: "bscscan_v6_after.png", timeout: 20000 }).catch(() => {});
await b.close();
