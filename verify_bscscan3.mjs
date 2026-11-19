// BscScan 验证 v3：用 name 属性定位（ASP.NET 的 $ 分隔）
import { chromium } from "playwright";

const ADDR = "0xb72a19E2D79cD2A4d5FB0B9221Ff280d445189DE";
const N = (n) => `input[name="ctl00$ContentPlaceHolder1$${n}"], select[name="ctl00$ContentPlaceHolder1$${n}"], textarea[name="ctl00$ContentPlaceHolder1$${n}"]`;

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto(`https://bscscan.com/verifyContract?a=${ADDR}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
await p.waitForTimeout(8000);

const fillName = async (field, val) => {
  try { await p.locator(N(field)).first().fill(val, { timeout: 6000 }); return true; } catch { return false; }
};
const selName = async (field, val) => {
  try { await p.locator(N(field)).first().selectOption(val, { timeout: 6000 }); return true; } catch { return false; }
};

console.log("addr filled:", await fillName("txtContractAddress", ADDR));

// 编译器类型
const types = await p.locator(N("ddlCompilerType")).first().evaluate((e) => [...e.options].map((o) => ({ v: o.value, t: o.text }))).catch(() => []);
console.log("types:", JSON.stringify(types.slice(0, 6)));
const sol = types.find((o) => /solidity/i.test(o.t) || /solidity/i.test(o.v)) || types[0];
if (sol) console.log("type sel:", await selName("ddlCompilerType", sol.v));

await p.waitForTimeout(2500);
const vers = await p.locator(N("ddlCompilerVersions")).first().evaluate((e) => [...e.options].map((o) => ({ v: o.value, t: o.text }))).catch(() => []);
const v26 = vers.find((o) => o.t.includes("0.8.26") || o.v.includes("0.8.26")) || vers[0];
console.log("version:", v26?.t, "->", await selName("ddlCompilerVersions", v26?.v || ""));

const lics = await p.locator(N("ddlLicenseType")).first().evaluate((e) => [...e.options].map((o) => ({ v: o.value, t: o.text }))).catch(() => []);
const mit = lics.find((o) => /mit/i.test(o.t)) || lics[0];
console.log("license:", mit?.t, "->", await selName("ddlLicenseType", mit?.v || ""));

try { await p.locator("#chkTermsOfUse").check(); console.log("terms ok"); } catch {}

await p.screenshot({ path: "bscscan_v3_step1.png", timeout: 20000 }).catch(() => {});
try { await p.locator(N("btnSubmit")).first().click(); console.log("submit clicked"); } catch (e) { console.log("submit err:", e.message); }
await p.waitForTimeout(10000);
console.log("url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 600));
console.log(t.replace(/\s+/g, " ").slice(0, 400));
await b.close();
