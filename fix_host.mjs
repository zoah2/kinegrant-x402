import { chromium } from "playwright";
import fs from "node:fs";

// 1. app.mjs 加 trust proxy
let app = fs.readFileSync("app.mjs", "utf8");
if (!app.includes('trust proxy')) {
  app = app.replace(
    "const app = express();",
    'const app = express();\napp.set("trust proxy", true);',
  );
  fs.writeFileSync("app.mjs", app, "utf8");
  console.log("app.mjs: trust proxy added");
}

// 2. handler.mjs 用 x-forwarded-host 作为对外 Host
let h = fs.readFileSync("handler.mjs", "utf8");
h = h.replace(
  /const origHost = headers\.Host \|\| headers\.host \|\| rc\.domainName \|\| "";/,
  'const fwdHost = headers["x-forwarded-host"] || headers["X-Forwarded-Host"] || "";\n  const origHost = fwdHost || headers.Host || headers.host || rc.domainName || "";',
);
fs.writeFileSync("handler.mjs", h, "utf8");
console.log("handler.mjs updated:", h.includes("fwdHost"));

// 3. 部署（上传到 FC）
const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = b.contexts()[0];
const p = ctx.pages()[0];
await p.goto(
  "https://fc.console.aliyun.com/cn-hongkong/functions/kinegrant-x402?tab=detail&section=code",
  { waitUntil: "domcontentloaded", timeout: 60000 },
);
await p.waitForTimeout(5000);
await p.getByRole("button", { name: /上传代码/ }).first().click();
await p.waitForTimeout(1500);
await p.getByText("上传 ZIP 包", { exact: true }).first().click();
await p.waitForTimeout(1500);
await p.locator("input[type=file]").last().setInputFiles("C:\\Users\\zoah\\Documents\\1\\x402-service\\fc-dist.zip");
await p.waitForTimeout(2000);
await p.getByRole("button", { name: /保存并部署/ }).first().click();
await p.waitForTimeout(12000);
console.log("deployed");
await b.close();
