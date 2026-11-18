// 鎵撳紑闃块噷浜戞帶鍒跺彴锛堝嚱鏁拌绠楋級锛岀敤鎴锋壂鐮佺櫥褰曪紝娴忚鍣ㄤ繚鎸佽繍琛屼緵鍚庣画鎿嶄綔
import { chromium } from "playwright";
import fs from "node:fs";

const profileDir = "C:\\Users\\zoah\\Documents\\1\\x402-service\\aliyun-profile";
const browser = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--remote-debugging-port=9333", "--start-maximized", "--proxy-server=http://127.0.0.1:7897"],
});

const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://fc.console.aliyun.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
console.log("browser opened, url =", page.url());
// 淇濇寔杩愯
await new Promise(() => {});

