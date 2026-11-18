import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = ctx.pages().find((x) => x.url().includes("groq.com"));
if (!p) { console.log("no groq page"); process.exit(1); }

await p.bringToFront();
await p.getByText("Create API Key", { exact: true }).first().click({ timeout: 20000 });
await p.waitForTimeout(3000);

const t = await p.evaluate(() => document.body.innerText.slice(0, 600));
console.log("=== dialog ===");
console.log(t);

// 找输入框填名称
const inputs = await p.evaluate(() =>
  [...document.querySelectorAll("input")].map((e, i) => ({ i, placeholder: e.placeholder, value: e.value })),
);
console.log("inputs:", JSON.stringify(inputs));

if (inputs.length) {
  const inp = p.locator("input").first();
  await inp.click();
  await inp.fill("kinegrant-x402");
  await p.waitForTimeout(800);
}

const btns = await p.evaluate(() =>
  [...document.querySelectorAll("button")].map((e) => e.textContent.trim()).filter(Boolean),
);
console.log("buttons:", JSON.stringify(btns));

const submit = p.getByRole("button", { name: /^(Submit|Create|Save|确认)$/ });
if ((await submit.count()) > 0) {
  await submit.first().click();
  console.log("submit clicked");
} else {
  console.log("no submit button");
}
await p.waitForTimeout(5000);

const after = await p.evaluate(() => document.body.innerText);
fs.writeFileSync("groq_after2.txt", after, "utf8");
console.log("=== after ===");
console.log(after.slice(0, 1500));
await p.screenshot({ path: "groq_key.png", timeout: 15000 }).catch(() => {});
await b.close();
