// 点击 DeepSeek key 复制按钮，从剪贴板读 key
import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

await p.goto("https://platform.deepseek.com/api_keys", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(8000);

// 找 kinegrant-x402 行的复制按钮（通常是图标按钮或"复制"文字）
const btnTexts = await p.evaluate(() => [...document.querySelectorAll("button, [role=button]")].map((e) => e.textContent.trim()).filter(Boolean));
console.log("buttons:", JSON.stringify(btnTexts.slice(0, 30)));

// 尝试点行内的复制图标
const copied = await p.evaluate(() => {
  const rows = [...document.querySelectorAll("tr")].filter((r) => r.textContent.includes("kinegrant-x402"));
  if (!rows.length) return "no row";
  const btns = [...rows[0].querySelectorAll("button, [role=button], svg")];
  if (!btns.length) return "no btn in row";
  btns[btns.length - 1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return "clicked " + btns.length;
});
console.log(copied);
await p.waitForTimeout(3000);

// 读剪贴板（浏览器权限可能受限）
const clip = await p.evaluate(async () => {
  try { return await navigator.clipboard.readText(); } catch (e) { return "ERR: " + e.message; }
}).catch(() => "ERR");
console.log("clipboard:", clip.slice(0, 60));

if (clip.startsWith("sk-")) {
  fs.writeFileSync("ds_api_key.txt", clip, "utf8");
  console.log("KEY SAVED");
}
await b.close();
