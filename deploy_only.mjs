import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = ctx.pages()[0];

// 关闭可能存在的日志侧栏
await p.keyboard.press("Escape");
await p.waitForTimeout(1200);
await p.evaluate(() => {
  const wrap = document.querySelector(".wind-slide-panel-wrapper.opened");
  if (wrap) {
    const btn = wrap.querySelector(".next-dialog-close, [class*=close]");
    if (btn) btn.click();
  }
});
await p.waitForTimeout(1200);
console.log("page:", p.url());

await p.getByRole("button", { name: /上传代码/ }).first().click({ timeout: 20000 });
await p.waitForTimeout(1500);
await p.getByText("上传 ZIP 包", { exact: true }).first().click();
await p.waitForTimeout(1500);
await p.locator("input[type=file]").last().setInputFiles(
  "C:\\Users\\zoah\\Documents\\1\\x402-service\\fc-dist.zip",
);
await p.waitForTimeout(2500);
await p.getByRole("button", { name: /保存并部署/ }).first().click();
await p.waitForTimeout(14000);
console.log("deployed");
await p.screenshot({ path: "deployed3.png" });
await b.close();
