// BscScan 源码验证（网页表单，standard-json 方式）
import { chromium } from "playwright";
import fs from "node:fs";

const ADDR = "0xb72a19E2D79cD2A4d5FB0B9221Ff280d445189DE";
const standardJson = fs.readFileSync("contracts/standard-input.json", "utf8");

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto(`https://bscscan.com/verifyContract?a=${ADDR}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => console.log("nav:", e.message));
await p.waitForTimeout(10000);
console.log("url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 600));
console.log(t.replace(/\s+/g, " ").slice(0, 400));
const inputs = await p.evaluate(() => [...document.querySelectorAll("input,select,textarea")].map((e) => e.name || e.id || e.placeholder || e.type).slice(0, 30));
console.log("fields:", JSON.stringify(inputs));
await p.screenshot({ path: "bscscan_verify.png", timeout: 20000 }).catch(() => {});
await b.close();
