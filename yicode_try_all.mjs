// 给所有 email-verify 页面填验证码并验证（总有一个会话是新的）
import { chromium } from "playwright";

const CODE = process.argv[2] || "113561";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const pages = ctx.pages().filter((p) => !p.isClosed() && p.url().includes("email-verify"));
console.log("verify pages:", pages.length);

for (let i = 0; i < pages.length; i++) {
  const p = pages[i];
  try {
    await p.bringToFront();
    const inputs = p.locator("input");
    const n = await inputs.count();
    if (!n) { console.log(`[${i}] no input`); continue; }
    await inputs.first().fill(CODE);
    const btn = p.getByRole("button", { name: /验证并创建账户/ });
    if ((await btn.count()) > 0) await btn.first().click().catch(() => {});
    await p.waitForTimeout(5000);
    const url = p.url();
    const t = await p.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => "");
    console.log(`[${i}] url=${url.slice(0, 60)} text=${t.replace(/\s+/g, " ").slice(0, 80)}`);
    if (!url.includes("email-verify")) {
      console.log(`[${i}] SUCCESS -> ${url}`);
      const t2 = await p.evaluate(() => document.body.innerText.slice(0, 800)).catch(() => "");
      console.log(t2.replace(/\s+/g, " ").slice(0, 400));
      break;
    }
  } catch (e) {
    console.log(`[${i}] ERR`, String(e.message).slice(0, 100));
  }
}
await b.close();
