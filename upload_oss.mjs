import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = await ctx.newPage();

await p.goto(
  "https://oss.console.aliyun.com/bucket/oss-cn-hongkong/kinegrant-site/object",
  { waitUntil: "domcontentloaded", timeout: 60000 },
).catch((e) => console.log("nav:", e.message));
await p.waitForTimeout(8000);

await p.getByRole("button", { name: "上传文件", exact: true }).first().click({ timeout: 20000 });
await p.waitForTimeout(3000);

const inputs = p.locator("input[type=file]");
const n = await inputs.count();
console.log("file inputs:", n);
// 第一个是普通文件 input（第二个是 webkitdirectory）
await inputs.first().setInputFiles("C:\\Users\\zoah\\Documents\\1\\x402-service\\llms.txt");
await p.waitForTimeout(3000);

// 点对话框底部的上传按钮（第二个"上传文件"）
await p.getByRole("button", { name: "上传文件", exact: true }).last().click({ timeout: 20000 });
await p.waitForTimeout(8000);
console.log("upload clicked");
await p.screenshot({ path: "upload_done2.png", timeout: 15000 }).catch(() => {});
await p.close();
await b.close();
