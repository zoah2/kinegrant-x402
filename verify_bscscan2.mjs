// BscScan 验证 step1: 地址 + Solidity 0.8.26 + MIT + 同意条款 → 提交
import { chromium } from "playwright";

const ADDR = "0xb72a19E2D79cD2A4d5FB0B9221Ff280d445189DE";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto(`https://bscscan.com/verifyContract?a=${ADDR}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
await p.waitForTimeout(8000);

// 填地址
const addrIn = p.locator("#ctl00_ContentPlaceHolder1_txtContractAddress");
if (await addrIn.count()) { await addrIn.fill(ADDR); console.log("address filled"); } else { console.log("address input missing"); }

// 编译器类型（Solidity）
const typeSel = p.locator("#ctl00_ContentPlaceHolder1_ddlCompilerType");
if (await typeSel.count()) {
  const opts = await typeSel.evaluate((e) => [...e.options].map((o) => ({ v: o.value, t: o.text })));
  console.log("compiler types:", JSON.stringify(opts.slice(0, 6)));
  const solidity = opts.find((o) => /solidity/i.test(o.t) || /solidity/i.test(o.v));
  if (solidity) { await typeSel.selectOption(solidity.v).catch(() => {}); console.log("compiler:", solidity.t); }
}

// 版本
await p.waitForTimeout(2000);
const verSel = p.locator("#ctl00_ContentPlaceHolder1_ddlCompilerVersions");
if (await verSel.count()) {
  const vs = await verSel.evaluate((e) => [...e.options].map((o) => ({ v: o.value, t: o.text })));
  const want = vs.find((o) => o.t.includes("0.8.26") || o.v.includes("0.8.26")) || vs[0];
  if (want) { await verSel.selectOption(want.v).catch(() => {}); console.log("version:", want.t); }
}

// 许可证
const licSel = p.locator("#ctl00_ContentPlaceHolder1_ddlLicenseType");
if (await licSel.count()) {
  const ls = await licSel.evaluate((e) => [...e.options].map((o) => ({ v: o.value, t: o.text })));
  const mit = ls.find((o) => /mit/i.test(o.t) || /3/i.test(o.v)) || ls[0];
  if (mit) { await licSel.selectOption(mit.v).catch(() => {}); console.log("license:", mit.t); }
}

// 同意
const terms = p.locator("#chkTermsOfUse");
if (await terms.count()) { await terms.check().catch(() => {}); console.log("terms checked"); }

await p.waitForTimeout(1000);
await p.screenshot({ path: "bscscan_step1.png", timeout: 20000 }).catch(() => {});

// 提交
const submit = p.locator("#ctl00_ContentPlaceHolder1_btnSubmit");
if (await submit.count()) { await submit.click().catch(() => {}); console.log("submitted step1"); }
await p.waitForTimeout(10000);
console.log("url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 800));
console.log(t.replace(/\s+/g, " ").slice(0, 500));
const fields = await p.evaluate(() => [...document.querySelectorAll("input,select,textarea")].map((e) => e.name || e.id).slice(0, 20));
console.log("step2 fields:", JSON.stringify(fields));
await p.screenshot({ path: "bscscan_step2.png", timeout: 20000 }).catch(() => {});
await b.close();
