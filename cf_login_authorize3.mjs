import { chromium } from "playwright";

const url =
  "https://dash.cloudflare.com/argotunnel?aud=&callback=https%3A%2F%2Flogin.cloudflareaccess.org%2F1TEQ-pcRQl_rgNsE4JXg-pU4Wki0EVrWEz7l-SXTnSk%3D";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = ctx.pages()[0];

await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(6000);

await p.evaluate(() => {
  const rows = [...document.querySelectorAll("a,tr,div")].filter(
    (e) => e.textContent.trim() === "kinegrant.com" && e.offsetParent,
  );
  if (rows.length) rows[0].click();
});
await p.waitForTimeout(5000);

const authBtn = p.getByRole("button", { name: "授权", exact: true });
if ((await authBtn.count()) > 0) {
  await authBtn.first().click();
  console.log("authorize clicked");
} else {
  console.log("no authorize button");
}
await p.waitForTimeout(8000);
console.log("final url:", p.url());
await b.close();
