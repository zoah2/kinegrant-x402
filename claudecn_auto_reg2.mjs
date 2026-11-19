// 自动注册 ClaudeCN v2：精确提取验证码（6 位数字，排除年份）
import { chromium } from "playwright";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function makeMailbox() {
  const dom = await (await fetch("https://api.mail.tm/domains")).json();
  const domain = dom["hydra:member"].find((d) => d.isActive)?.domain;
  const user = "kg" + Date.now().toString(36);
  const address = `${user}@${domain}`;
  const password = "KineP" + Math.random().toString(36).slice(2, 10) + "!9";
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
    // 找 6 位数字，排除 2020-2030 年份
    const codes = [...text.matchAll(/\b(\d{6})\b/g)].map((x) => x[1]).filter((c) => !/^20\d\d$/.test(c));
    if (codes.length) return codes[0];
    // 兜底：4-8 位
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
await p.goto("https://claudecn.top/register", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(5000);

const inputs = p.locator("input");
await inputs.nth(0).fill("kinegrant" + Date.now().toString(36).slice(-5));
await inputs.nth(1).fill("KineGrant!2026x");
await inputs.nth(2).fill("KineGrant!2026x");
await inputs.nth(3).fill(mail.address);
console.log("form filled");

const sendBtn = p.getByRole("button", { name: /发送验证码|获取验证码/ });
if ((await sendBtn.count()) > 0) { await sendBtn.first().click().catch(() => {}); console.log("code requested"); }
await p.waitForTimeout(3000);

let code = null;
for (let i = 0; i < 24; i++) {
  code = await fetchLatestCode(mail).catch(() => null);
  if (code) break;
  await sleep(5000);
}
console.log("code:", code);

if (code) {
  await inputs.nth(4).fill(code);
  const reg = p.getByRole("button", { name: /^注册$/ });
  if ((await reg.count()) > 0) await reg.first().click().catch(() => {});
  await p.waitForTimeout(8000);
  console.log("after reg url:", p.url());
  const t = await p.evaluate(() => document.body.innerText.slice(0, 800));
  console.log(t.replace(/\s+/g, " ").slice(0, 500));
}
await p.screenshot({ path: "claudecn_after_reg2.png", timeout: 20000 }).catch(() => {});
await b.close();
