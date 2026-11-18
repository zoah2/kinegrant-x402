import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = ctx.pages().find((x) => x.url().includes("groq.com"));
if (!p) { console.log("no groq page"); process.exit(1); }
await p.bringToFront();

// 等 Cloudflare 验证完成
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(5000);
  const txt = await p.evaluate(() => document.body.innerText);
  const verifying = txt.includes("正在验证") || txt.includes("Verifying");
  const btns = await p.evaluate(() =>
    [...document.querySelectorAll("button")].map((e) => ({ t: e.textContent.trim(), d: e.disabled })).filter((x) => x.t),
  );
  console.log(`[${i}] verifying=${verifying} buttons=`, JSON.stringify(btns.filter((x) => /Create|Submit|Close|Cancel/i.test(x.t))));
  if (!verifying) break;
}

// 列出当前按钮
const btns = await p.evaluate(() =>
  [...document.querySelectorAll("button")].map((e) => e.textContent.trim()).filter(Boolean),
);
console.log("final buttons:", JSON.stringify(btns));

// 点对话框里的 Create API Key（不是页面顶部的那个）
const dialogBtn = p.locator(".dialog, [role=dialog], [class*=modal]").getByRole("button", { name: /Create/i });
if ((await dialogBtn.count()) > 0) {
  await dialogBtn.last().click().catch(() => {});
  console.log("dialog create clicked");
} else {
  // 顶部按钮兜底
  const top = p.getByRole("button", { name: /Create API Key/i });
  if ((await top.count()) > 0) {
    await top.last().click().catch(() => {});
    console.log("fallback create clicked");
  }
}
await p.waitForTimeout(6000);

const after = await p.evaluate(() => document.body.innerText);
fs.writeFileSync("groq_final.txt", after, "utf8");
console.log("=== after ===");
console.log(after.slice(0, 1500));
await p.screenshot({ path: "groq_final.png", timeout: 15000 }).catch(() => {});
await b.close();
