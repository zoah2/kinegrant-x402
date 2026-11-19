// 上传 llms.txt 到阿里云 OSS（控制台，Edge 已登录）
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BUCKET = "oss-cn-hongkong/kinegrant-site";
const FILE = path.resolve("llms.txt");

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto(`https://oss.console.aliyun.com/bucket/${BUCKET}/object`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => console.log("nav:", e.message));
await p.waitForTimeout(12000);
console.log("url:", p.url());
const t = await p.evaluate(() => document.body.innerText.slice(0, 600));
console.log(t.replace(/\s+/g, " ").slice(0, 400));

// 找"上传"按钮
const upBtns = await p.evaluate(() => [...document.querySelectorAll("button, a, [role=button]")].map((e) => e.textContent.trim()).filter((x) => /上传|Upload/i.test(x)));
console.log("upload buttons:", JSON.stringify(upBtns.slice(0, 8)));

const uploadBtn = p.getByText(/上传文件|上传/).first();
if ((await uploadBtn.count()) > 0) {
  await uploadBtn.click().catch(() => {});
  console.log("upload clicked");
  await p.waitForTimeout(6000);
}

// 找 file input
const fileInput = p.locator('input[type="file"]');
const n = await fileInput.count();
console.log("file inputs:", n);
if (n > 0) {
  await fileInput.first().setInputFiles(FILE);
  console.log("file set:", FILE);
  await p.waitForTimeout(6000);
  // 确认上传按钮
  for (const name of ["上传", "确定", "开始上传", "Upload"]) {
    const btn = p.getByRole("button", { name: new RegExp(name) });
    if ((await btn.count()) > 0) {
      await btn.last().click().catch(() => {});
      console.log("confirm clicked:", name);
      await p.waitForTimeout(15000);
      break;
    }
  }
}
const t2 = await p.evaluate(() => document.body.innerText.slice(0, 500));
console.log("after:", t2.replace(/\s+/g, " ").slice(0, 300));
await p.screenshot({ path: "oss_upload.png", timeout: 20000 }).catch(() => {});
await b.close();
