// 自动注册 yicode.ai（忆のAI）：mail.tm 邮箱 + 条款 + 验证码
import { chromium } from "playwright";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function makeMailbox() {
  const dom = await (await fetch("https://api.mail.tm/domains")).json();
  const domain = dom["hydra:member"].find((d) => d.isActive)?.domain;
  const user = "yc" + Date.now().toString(36);
  const address = `${user}@${domain}`;
  const password = "Yico" + Math.random().toString(36).slice(2, 10) + "!9";
  const r = await fetch("https://api.mail.tm/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, password }) });
  if (!r.ok) throw new Error("mail create failed: " + r.status);
  const tok = await (await fetch("https://api.mail.tm/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, password }) })).json();
  return { address, token: tok.token };
}

async function fetchLatestCode(mail) {
  const r = await fetch("https://api.mail.tm/messages", { headers: { authorization: "Bearer " + mail.token } });
  const j = await r.json();
  for (const m of j["hydra:member"] || []) {
    const d = await (await fetch("https://api.mail.tm/messages/" + m.id, { headers: { authorization: "Bearer " + mail.token } })).json();
    const text = (d.text || "") + "\n" + (Array.isArray(d.html) ? d.html.join(" ") : d.html || "") + "\n" + (d.subject || "");
    const codes = [...text.matchAll(/\b(\d{6})\b/g)].map((x) => x[1]).filter((c) => !/^20\d\d$/.test(c));
    if (codes.length) return codes[0];
    const any = [...text.matchAll(/\b(\d{4,8})\b/g)].map((x) => x[1]).filter((c) => !/^20\d\d$/.test(c));
    if (any.length) return any[0];
  }
  return null;
}

const mail = await makeMailbox();
console.log("mailbox:", mail.address);

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto("https://www.yicode.ai/register", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(6000);

// 同意条款
const agree = p.getByRole("button", { name: /同意并继续/ });
if ((await agree.count()) > 0) { await agree.first().click().catch(() => {}); console.log("terms agreed"); await p.waitForTimeout(3000); }

// 填表
const inputs = p.locator("input");
const n = await inputs.count();
console.log("inputs:", n);
await inputs.nth(0).fill(mail.address);
await inputs.nth(1).fill("Yico!2026x9");
await inputs.nth(2).fill("Yico!2026x9");
console.log("form filled");

// 继续
const next = p.getByRole("button", { name: /^继续$|继续/ });
if ((await next.count()) > 0) { await next.first().click().catch(() => {}); console.log("continue clicked"); }
await p.waitForTimeout(5000);
console.log("after continue url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 700));
console.log(t.replace(/\s+/g, " ").slice(0, 500));

// 找验证码
let code = null;
for (let i = 0; i < 24; i++) {
  code = await fetchLatestCode(mail).catch(() => null);
  if (code) break;
  await sleep(5000);
}
console.log("code:", code);
if (code) {
  const codeput = p.locator("input").last();
  await codeput.fill(code).catch(() => {});
  const btn = p.getByRole("button", { name: /继续|验证|提交/ });
  if ((await btn.count()) > 0) await btn.first().click().catch(() => {});
  await p.waitForTimeout(8000);
  console.log("after code url:", p.url());
  const t2 = await p.evaluate(() => document.body.innerText.slice(0, 700));
  console.log(t2.replace(/\s+/g, " ").slice(0, 500));
}
await p.screenshot({ path: "yicode_after.png", timeout: 20000 }).catch(() => {});
await b.close();
