// 全品类矩阵 2：链上细分 + 开发工具 + 外部品类（40 个端点）
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const USDT = "0x55d398326f99059fF775485246999027B3197955";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const RPCS = [
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-rpc.publicnode.com",
];

async function rpcCall(method, params) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("all rpc failed");
}
const encAddr = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const validAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
const ethCall = (to, data) => rpcCall("eth_call", [{ to, data }, "latest"]);

function decodeString(hex) {
  if (!hex || hex === "0x") return null;
  const h = hex.replace(/^0x/, "");
  try {
    const len = parseInt(h.slice(64, 128), 16);
    return Buffer.from(h.slice(128, 128 + len * 2), "hex").toString("utf8");
  } catch { return null; }
}
const decodeUint = (hex) => (hex && hex !== "0x" ? BigInt(hex).toString() : null);
const decodeAddr = (hex) => (hex && hex !== "0x" && hex.length >= 42 ? "0x" + hex.slice(-40) : null);

async function tokenInfo(address) {
  const [nameHex, symbolHex, decHex, supplyHex, ownerHex] = await Promise.all([
    ethCall(address, "0x06fdde03").catch(() => null),
    ethCall(address, "0x95d89b41").catch(() => null),
    ethCall(address, "0x313ce567").catch(() => null),
    ethCall(address, "0x18160ddd").catch(() => null),
    ethCall(address, "0x8da5cb5b").catch(() => null),
  ]);
  const decimals = decHex ? Number(BigInt(decHex)) : null;
  const supply = decodeUint(supplyHex);
  const owner = decodeAddr(ownerHex);
  return {
    name: decodeString(nameHex), symbol: decodeString(symbolHex), decimals,
    supply, supplyFmt: supply && decimals !== null ? Number(supply) / 10 ** decimals : null,
    owner, ownerRenounced: owner === null,
  };
}

async function pairInfo(token, quote) {
  const pairHex = await ethCall(FACTORY, "0xe6a43905" + encAddr(token) + encAddr(quote));
  if (!pairHex || pairHex === "0x") return null;
  const pair = "0x" + pairHex.slice(-40);
  if (pair === "0x" + "0".repeat(40)) return null;
  const [t0Hex, resHex] = await Promise.all([
    ethCall(pair, "0x0dfe1681").catch(() => null),
    ethCall(pair, "0x0902f1ac").catch(() => null),
  ]);
  if (!resHex) return null;
  const h = resHex.replace(/^0x/, "");
  const r0 = BigInt("0x" + h.slice(0, 64));
  const r1 = BigInt("0x" + h.slice(64, 128));
  const t0 = t0Hex ? "0x" + t0Hex.slice(-40) : null;
  const tokenIs0 = t0 ? t0.toLowerCase() === token.toLowerCase() : token.toLowerCase() < quote.toLowerCase();
  const [rToken, rQuote] = tokenIs0 ? [r0, r1] : [r1, r0];
  if (rToken === 0n) return null;
  return { pair, rToken, rQuote, price: Number(rQuote) / Number(rToken), token0: t0 };
}

async function nativeBalance(holder) {
  const out = await rpcCall("eth_getBalance", [holder, "latest"]);
  return out ? BigInt(out).toString() : "0";
}
async function tokenBalance(token, holder) {
  const out = await ethCall(token, "0x70a08231" + encAddr(holder)).catch(() => null);
  return out ? BigInt(out).toString() : "0";
}
async function runBaw(args) {
  const r = await exec("baw", args, {
    timeout: 60000, maxBuffer: 20 * 1024 * 1024, shell: true,
    env: { ...process.env, HTTPS_PROXY: "http://127.0.0.1:7897", HTTP_PROXY: "http://127.0.0.1:7897", NODE_USE_ENV_PROXY: "1" },
  });
  return JSON.parse(r.stdout);
}

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18));
  const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

const P1 = [{ name: "token", in: "query", required: true, schema: { type: "string" } }];
const PA = [{ name: "address", in: "query", required: true, schema: { type: "string" } }];
const PAB = [
  { name: "tokenA", in: "query", required: true, schema: { type: "string" } },
  { name: "tokenB", in: "query", required: true, schema: { type: "string" } },
];

export const MATRIX2 = [
  // ---------- 代币细分（每项 $0.001） ----------
  { path: "/token/name", usd: 0.001, summary: "Token name string (ERC20 name())", params: P1,
    handler: async (req, res) => { const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" }); res.json({ token: t.toLowerCase(), name: decodeString(await ethCall(t, "0x06fdde03").catch(() => null)), asOf: new Date().toISOString() }); } },
  { path: "/token/symbol", usd: 0.001, summary: "Token symbol string (ERC20 symbol())", params: P1,
    handler: async (req, res) => { const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" }); res.json({ token: t.toLowerCase(), symbol: decodeString(await ethCall(t, "0x95d89b41").catch(() => null)), asOf: new Date().toISOString() }); } },
  { path: "/token/decimals", usd: 0.001, summary: "Token decimals (ERC20 decimals())", params: P1,
    handler: async (req, res) => { const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" }); const hex = await ethCall(t, "0x313ce567").catch(() => null); res.json({ token: t.toLowerCase(), decimals: hex ? Number(BigInt(hex)) : null, asOf: new Date().toISOString() }); } },
  { path: "/token/exists", usd: 0.001, summary: "Check if address has contract code (ERC20 candidate)", params: P1,
    handler: async (req, res) => { const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" }); const code = await rpcCall("eth_getCode", [t, "latest"]).catch(() => "0x"); res.json({ token: t.toLowerCase(), isContract: !!code && code !== "0x", codeSize: code ? (code.length - 2) / 2 : 0, asOf: new Date().toISOString() }); } },
  { path: "/token/total-supply-raw", usd: 0.001, summary: "Raw totalSupply() as decimal string", params: P1,
    handler: async (req, res) => { const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" }); res.json({ token: t.toLowerCase(), totalSupply: decodeUint(await ethCall(t, "0x18160ddd").catch(() => null)), asOf: new Date().toISOString() }); } },
  { path: "/token/allowance", usd: 0.002, summary: "ERC20 allowance(owner, spender)", params: [...P1, { name: "owner", in: "query", required: true, schema: { type: "string" } }, { name: "spender", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const t = String(req.query.token || ""); const o = String(req.query.owner || ""); const s = String(req.query.spender || ""); if (!validAddr(t) || !validAddr(o) || !validAddr(s)) return res.status(400).json({ error: "bad_params" }); const hex = await ethCall(t, "0xdd62ed3e" + encAddr(o) + encAddr(s)).catch(() => null); res.json({ token: t.toLowerCase(), owner: o.toLowerCase(), spender: s.toLowerCase(), allowance: decodeUint(hex), asOf: new Date().toISOString() }); } },

  // ---------- 钱包细分 ----------
  { path: "/wallet/nonce", usd: 0.001, summary: "Transaction count (nonce) of an address", params: PA,
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!validAddr(a)) return res.status(400).json({ error: "bad_address" }); const n = await rpcCall("eth_getTransactionCount", [a, "latest"]); res.json({ address: a.toLowerCase(), nonce: parseInt(n, 16), asOf: new Date().toISOString() }); } },
  { path: "/wallet/is-contract", usd: 0.001, summary: "Whether an address is a contract", params: PA,
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!validAddr(a)) return res.status(400).json({ error: "bad_address" }); const code = await rpcCall("eth_getCode", [a, "latest"]).catch(() => "0x"); res.json({ address: a.toLowerCase(), isContract: !!code && code !== "0x", codeSize: code ? (code.length - 2) / 2 : 0, asOf: new Date().toISOString() }); } },
  { path: "/wallet/gas-price", usd: 0.001, summary: "Recommended gas price for an address operation (current base)", params: PA,
    handler: async (_req, res) => { const hex = await rpcCall("eth_gasPrice", []); res.json({ gasPriceGwei: Number(BigInt(hex)) / 1e9, asOf: new Date().toISOString() }); } },

  // ---------- 市场细分 ----------
  { path: "/market/base-fee", usd: 0.001, summary: "Latest block base fee (EIP-1559)", handler: async (_req, res) => {
    const blk = await rpcCall("eth_getBlockByNumber", ["latest", false]).catch(() => null);
    res.json({ baseFeeWei: blk?.baseFeePerGas ? BigInt(blk.baseFeePerGas).toString() : null, baseFeeGwei: blk?.baseFeePerGas ? Number(BigInt(blk.baseFeePerGas)) / 1e9 : null, asOf: new Date().toISOString() }); } },
  { path: "/market/tx-count", usd: 0.002, summary: "Transaction count in latest block", handler: async (_req, res) => {
    const blk = await rpcCall("eth_getBlockByNumber", ["latest", false]).catch(() => null);
    res.json({ blockNumber: blk ? parseInt(blk.number, 16) : null, txCount: blk?.transactions?.length ?? null, asOf: new Date().toISOString() }); } },
  { path: "/market/gas-budget", usd: 0.002, summary: "Gas cost estimate in BNB for a given gas amount", params: [{ name: "gas", in: "query", required: false, schema: { type: "string", default: "21000" } }],
    handler: async (req, res) => { const gas = BigInt(String(req.query.gas || "21000")); const hex = await rpcCall("eth_gasPrice", []); const wei = BigInt(hex) * gas; res.json({ gas: gas.toString(), gasPriceGwei: Number(BigInt(hex)) / 1e9, costBNB: Number(wei) / 1e18, asOf: new Date().toISOString() }); } },
  { path: "/market/chain-id", usd: 0.001, summary: "RPC chain id", handler: async (_req, res) => {
    const id = await rpcCall("eth_chainId", []); res.json({ chainId: parseInt(id, 16), asOf: new Date().toISOString() }); } },
  { path: "/market/bnb-usdt", usd: 0.005, summary: "BNB price in USDT (WBNB/USDT pool)", handler: async (_req, res) => {
    const pair = await pairInfo(WBNB, USDT).catch(() => null); if (!pair) return res.status(502).json({ error: "no_pool" });
    res.json({ bnbUSDT: Number(pair.price.toFixed(6)), asOf: new Date().toISOString() }); } },

  // ---------- 池子细分 ----------
  { path: "/pair/address", usd: 0.002, summary: "PancakeSwap V2 pair address for two tokens", params: PAB,
    handler: async (req, res) => { const a = String(req.query.tokenA || ""); const b = String(req.query.tokenB || ""); if (!validAddr(a) || !validAddr(b)) return res.status(400).json({ error: "bad_tokens" }); const hex = await ethCall(FACTORY, "0xe6a43905" + encAddr(a) + encAddr(b)).catch(() => null); const pair = decodeAddr(hex); res.json({ tokenA: a.toLowerCase(), tokenB: b.toLowerCase(), pair: pair && pair !== "0x0000000000000000000000000000000000000000" ? pair : null, asOf: new Date().toISOString() }); } },
  { path: "/pair/token0", usd: 0.001, summary: "PancakeSwap V2 pair token0", params: PAB,
    handler: async (req, res) => { const a = String(req.query.tokenA || ""); const b = String(req.query.tokenB || ""); if (!validAddr(a) || !validAddr(b)) return res.status(400).json({ error: "bad_tokens" }); const pair = await pairInfo(a, b).catch(() => null); res.json({ pair: pair?.pair || null, token0: pair?.token0 || null, asOf: new Date().toISOString() }); } },
  { path: "/pair/liquidity", usd: 0.002, summary: "Pool reserve depths (both tokens raw)", params: PAB,
    handler: async (req, res) => { const a = String(req.query.tokenA || ""); const b = String(req.query.tokenB || ""); if (!validAddr(a) || !validAddr(b)) return res.status(400).json({ error: "bad_tokens" }); const pair = await pairInfo(a, b).catch(() => null); if (!pair) return res.status(404).json({ error: "no_pool" }); res.json({ pair: pair.pair, reserveA: pair.rToken.toString(), reserveB: pair.rQuote.toString(), asOf: new Date().toISOString() }); } },

  // ---------- 交易细分 ----------
  { path: "/tx/status", usd: 0.002, summary: "Transaction status (pending/confirmed) and block", params: [{ name: "hash", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const h = String(req.query.hash || ""); if (!/^0x[0-9a-fA-F]{64}$/.test(h)) return res.status(400).json({ error: "bad_hash" }); const rc = await rpcCall("eth_getTransactionReceipt", [h]).catch(() => null); const tx = await rpcCall("eth_getTransactionByHash", [h]).catch(() => null); res.json({ hash: h, found: !!tx, blockNumber: rc ? parseInt(rc.blockNumber, 16) : null, status: rc ? (parseInt(rc.status, 16) === 1 ? "success" : "failed") : null, gasUsed: rc ? BigInt(rc.gasUsed).toString() : null, asOf: new Date().toISOString() }); } },
  { path: "/tx/value", usd: 0.002, summary: "Transaction value and fee in BNB", params: [{ name: "hash", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const h = String(req.query.hash || ""); if (!/^0x[0-9a-fA-F]{64}$/.test(h)) return res.status(400).json({ error: "bad_hash" }); const tx = await rpcCall("eth_getTransactionByHash", [h]).catch(() => null); if (!tx) return res.status(404).json({ error: "not_found" }); res.json({ hash: h, valueBNB: Number(BigInt(tx.value || "0x0")) / 1e18, gasPriceGwei: Number(BigInt(tx.gasPrice || "0x0")) / 1e9, asOf: new Date().toISOString() }); } },
  { path: "/tx/log-count", usd: 0.002, summary: "Number of logs emitted by a transaction", params: [{ name: "hash", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const h = String(req.query.hash || ""); if (!/^0x[0-9a-fA-F]{64}$/.test(h)) return res.status(400).json({ error: "bad_hash" }); const rc = await rpcCall("eth_getTransactionReceipt", [h]).catch(() => null); res.json({ hash: h, logCount: rc ? rc.logs.length : null, asOf: new Date().toISOString() }); } },

  // ---------- 区块细分 ----------
  { path: "/block/timestamp", usd: 0.001, summary: "Timestamp of a block (latest if omitted)", params: [{ name: "block", in: "query", required: false, schema: { type: "string" } }],
    handler: async (req, res) => { const b = String(req.query.block || "latest"); const tag = b === "latest" ? "latest" : "0x" + parseInt(b, 10).toString(16); const blk = await rpcCall("eth_getBlockByNumber", [tag, false]).catch(() => null); res.json({ block: blk ? parseInt(blk.number, 16) : null, timestamp: blk ? parseInt(blk.timestamp, 16) : null, asOf: new Date().toISOString() }); } },
  { path: "/block/gas-used", usd: 0.002, summary: "Gas used and limit of a block", params: [{ name: "block", in: "query", required: false, schema: { type: "string" } }],
    handler: async (req, res) => { const b = String(req.query.block || "latest"); const tag = b === "latest" ? "latest" : "0x" + parseInt(b, 10).toString(16); const blk = await rpcCall("eth_getBlockByNumber", [tag, false]).catch(() => null); res.json({ block: blk ? parseInt(blk.number, 16) : null, gasUsed: blk ? BigInt(blk.gasUsed).toString() : null, gasLimit: blk ? BigInt(blk.gasLimit).toString() : null, asOf: new Date().toISOString() }); } },

  // ---------- 安全细分 ----------
  { path: "/security/renounce", usd: 0.005, summary: "Owner renounce status + owner address", params: P1,
    handler: async (req, res) => { const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" }); const o = decodeAddr(await ethCall(t, "0x8da5cb5b").catch(() => null)); res.json({ token: t.toLowerCase(), owner: o, renounced: o === null, asOf: new Date().toISOString() }); } },
  { path: "/security/transfer-function", usd: 0.005, summary: "Check ERC20 transfer function presence (basic honeypot heuristic)", params: P1,
    handler: async (req, res) => { const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" }); const probe = await ethCall(t, "0xa9059cbb" + encAddr("0x0000000000000000000000000000000000000001") + encAddr("0x0000000000000000000000000000000000000001")).catch(() => null); res.json({ token: t.toLowerCase(), transferCallable: probe !== null, note: "call result only indicates the function exists; not a full honeypot audit", asOf: new Date().toISOString() }); } },
  { path: "/security/decimals-match", usd: 0.002, summary: "Compare token decimals to 18 (mismatch = unusual)", params: P1,
    handler: async (req, res) => { const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" }); const hex = await ethCall(t, "0x313ce567").catch(() => null); const d = hex ? Number(BigInt(hex)) : null; res.json({ token: t.toLowerCase(), decimals: d, matches18: d === 18, asOf: new Date().toISOString() }); } },

  // ---------- 组合/批量 ----------
  { path: "/batch/token", usd: 0.01, summary: "Batch token info for up to 5 addresses", params: [{ name: "tokens", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated addresses" }],
    handler: async (req, res) => { const list = String(req.query.tokens || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5); if (!list.every(validAddr)) return res.status(400).json({ error: "bad_tokens" }); const out = []; for (const t of list) { const [info, pair] = await Promise.all([tokenInfo(t).catch(() => null), pairInfo(t, USDT).catch(() => null)]); out.push({ token: t.toLowerCase(), info, priceUSDT: pair ? Number(pair.price.toFixed(12)) : null, liquidityUSDT: pair ? Number((Number(pair.rQuote) / 1e18).toFixed(2)) : null }); } res.json({ count: out.length, list: out, asOf: new Date().toISOString() }); } },
  { path: "/batch/balance", usd: 0.01, summary: "Batch BNB+token balances for up to 5 addresses", params: [{ name: "addresses", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated addresses" }],
    handler: async (req, res) => { const list = String(req.query.addresses || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5); if (!list.every(validAddr)) return res.status(400).json({ error: "bad_addresses" }); const out = []; for (const a of list) { const [bnb, usdt] = await Promise.all([nativeBalance(a).catch(() => "0"), tokenBalance(USDT, a)]); out.push({ address: a.toLowerCase(), bnb: Number(bnb) / 1e18, usdt: Number(usdt) / 1e18 }); } res.json({ count: out.length, list: out, asOf: new Date().toISOString() }); } },

  // ---------- 外部品类（市场验证过的需求） ----------
  { path: "/cve/lookup", usd: 0.003, summary: "CVE severity lookup via OSV.dev", params: [{ name: "cve", in: "query", required: true, schema: { type: "string" }, description: "CVE id, e.g. CVE-2024-3094" }],
    handler: async (req, res) => { const cve = String(req.query.cve || "").toUpperCase(); if (!/^CVE-\d{4}-\d{4,}$/.test(cve)) return res.status(400).json({ error: "bad_cve" }); const r = await fetch("https://api.osv.dev/v1/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ package: { name: cve, ecosystem: "npm" } }), signal: AbortSignal.timeout(15000) }).catch(() => null); const j = r ? await r.json().catch(() => null) : null; res.json({ cve, vulns: (j?.vulns || []).slice(0, 3).map((v) => ({ id: v.id, summary: v.summary, severity: v.severity })), asOf: new Date().toISOString() }); } },
  { path: "/npm/package", usd: 0.002, summary: "npm package metadata (latest version, deps, license)", params: [{ name: "name", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const n = String(req.query.name || ""); if (!n) return res.status(400).json({ error: "bad_name" }); const r = await fetch("https://registry.npmjs.org/" + encodeURIComponent(n) + "/latest", { signal: AbortSignal.timeout(15000) }).catch(() => null); if (!r || !r.ok) return res.status(404).json({ error: "package_not_found" }); const j = await r.json(); res.json({ name: j.name, version: j.version, license: j.license || null, deps: Object.keys(j.dependencies || {}).length, description: (j.description || "").slice(0, 200), asOf: new Date().toISOString() }); } },
  { path: "/github/health", usd: 0.005, summary: "GitHub repository health (stars, archive, recency, license)", params: [{ name: "repo", in: "query", required: true, schema: { type: "string" }, description: "owner/name" }],
    handler: async (req, res) => { const repo = String(req.query.repo || ""); if (!/^[^/]+\/[^/]+$/.test(repo)) return res.status(400).json({ error: "bad_repo" }); const r = await fetch("https://api.github.com/repos/" + repo, { headers: { "user-agent": "kinegrant-x402" }, signal: AbortSignal.timeout(15000) }).catch(() => null); if (!r || !r.ok) return res.status(404).json({ error: "repo_not_found" }); const j = await r.json(); res.json({ repo, stars: j.stargazers_count, forks: j.forks_count, archived: j.archived, license: j.license?.spdx_id || null, pushedAt: j.pushed_at, openIssues: j.open_issues_count, asOf: new Date().toISOString() }); } },
  { path: "/url/extract", usd: 0.002, summary: "Extract readable text from a public web page (basic strip)", params: [{ name: "url", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const u = String(req.query.url || ""); if (!/^https?:\/\//.test(u)) return res.status(400).json({ error: "bad_url" }); const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) }).catch(() => null); if (!r || !r.ok) return res.status(502).json({ error: "fetch_failed" }); const html = await r.text(); const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000); res.json({ url: u, text, length: text.length, asOf: new Date().toISOString() }); } },
];

export const MATRIX2_ROUTES = Object.fromEntries(
  MATRIX2.map((ep) => ["GET " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);

export const MATRIX2_PATHS = Object.fromEntries(
  MATRIX2.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params || [{ name: "chain", in: "query", required: false, schema: { type: "string", default: "56" }, description: "Chain id, default 56" }],
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
