import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = ctx.pages().find((x) => x.url().includes("groq.com"));
if (!p) { console.log("no groq page"); process.exit(1); }

await p.bringToFront();
await p.waitForTimeout(2000);

// 对话框已打开：填 Display Name
const box = p.getByPlaceholder(/display name/i);
if ((await box.count()) > 0) {
  await box.first().click();
  await box.first().fill("kinegrant-x402");
  console.log("name filled");
} else {
  // 兜底：任意可编辑输入
  const inputs = p.locator("input");
  const n = await inputs.count();
  console.log("input count:", n);
  if (n) {
    await inputs.first().click();
    await inputs.first().fill("kinegrant-x402");
    console.log("fallback filled");
  }
}
await p.waitForTimeout(1000);

// 列出所有按钮
const btns = await p.evaluate(() =>
  [...document.querySelectorAll("button")].map((e) => ({ t: e.textContent.trim(), disabled: e.disabled })),
);
console.log("buttons:", JSON.stringify(btns.filter((x) => x.t)));

// 点提交
for (const name of ["Submit", "Create", "Create Key", "Confirm", "创建"]) {
  const btn = p.getByRole("button", { name });
  if ((await btn.count()) > 0) {
    await btn.first().click().catch(() => {});
    console.log("clicked:", name);
    await p.waitForTimeout(5000);
    break;
  }
}

const after = await p.evaluate(() => document.body.innerText);
fs.writeFileSync("groq_after3.txt", after, "utf8");
console.log("=== after ===");
console.log(after.slice(0, 1800));
await p.screenshot({ path: "groq_key2.png", timeout: 15000 }).catch(() => {});
await b.close();
