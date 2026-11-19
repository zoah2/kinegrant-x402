// 提交 KineGrant 到 x402-list.com
import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto("https://x402-list.com/submit", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(8000);

const inputs = p.locator("input, textarea, select");
const n = await inputs.count();
console.log("inputs:", n);

const set = async (idxOrSel, val) => {
  try { await p.locator(idxOrSel).first().fill(val, { timeout: 5000 }); return true; } catch { return false; }
};

// 按 placeholder 填
const fill = async (ph, val) => {
  try { await p.getByPlaceholder(new RegExp(ph)).first().fill(val, { timeout: 5000 }); console.log("filled:", ph); } catch (e) { console.log("miss:", ph); }
};

await fill("My x402 Service", "KineGrant x402");
await fill("https://api.example.com", "https://api.kinegrant.com");
await fill("https://example.com", "https://kinegrant.com");
await fill("you@example.com", "founder@kineworld.com");
await fill("Briefly describe", "307 machine-payable x402 endpoints: token due-diligence verdicts, BSC new-pair launch monitor, DefiLlama DeFi data, 22 AI models (GPT-6 Astra, Claude Opus 5.5, uncensored DeepSeek V4), 156 free proof-of-work CPU tools. $0.002-$0.02 per call, USDT on BSC (eip155:56) or USDC on Base (eip155:8453), no signup. 24h unlimited subscription $1.");
await fill("POST /v1/generate", "GET /verdict?token=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c\nGET /skill/dd?token=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c\nGET /bsc/new-pairs\nGET /defillama/protocols\nPOST /v1/claude\nPOST /v1/gpt\nPOST /v1/chat/completions");
await fill("wallet_address", '{"wallet_address":"0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E"}');

// 选 category（select）
const sel = p.locator("select").first();
if (await sel.count()) {
  const opts = await sel.evaluate((e) => [...e.options].map((o) => o.value));
  console.log("categories:", JSON.stringify(opts.slice(0, 20)));
  const pick = opts.find((o) => /data|crypto|finance/i.test(o)) || opts[3] || opts[0];
  await sel.selectOption(pick).catch(() => {});
  console.log("category picked:", pick);
}

await p.waitForTimeout(1000);
await p.screenshot({ path: "x402list_filled.png", timeout: 15000 }).catch(() => {});

// 提交
for (const name of ["Submit", "提交", "Submit for review"]) {
  const btn = p.getByRole("button", { name: new RegExp(name, "i") });
  if (await btn.count()) { await btn.first().click().catch(() => {}); console.log("clicked:", name); break; }
}
await p.waitForTimeout(10000);
const t = await p.evaluate(() => document.body.innerText.slice(0, 600));
console.log("after:", t.replace(/\s+/g, " ").slice(0, 400));
await p.screenshot({ path: "x402list_after.png", timeout: 15000 }).catch(() => {});
await b.close();
