// 独占数据：BSC 新币发射监控（PancakeSwap PairCreated 事件）
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";
const FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const PAIR_CREATED = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const RPCS = ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org", "https://bsc-rpc.publicnode.com"];

async function rpc(m, p) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }), signal: AbortSignal.timeout(10000) });
      const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("rpc failed");
}
const encAddr = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const validAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
const ethCall = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);
const decodeString = (hex) => { if (!hex || hex === "0x") return null; const h = hex.replace(/^0x/, ""); try { const len = parseInt(h.slice(64, 128), 16); return Buffer.from(h.slice(128, 128 + len * 2), "hex").toString("utf8"); } catch { return null; } };
const decodeAddr = (hex) => (hex && hex !== "0x" && hex.length >= 42 ? "0x" + hex.slice(-40) : null);

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18)), base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}
const P = (name, desc, required = false) => ({ name, in: "query", required, schema: { type: "string" }, description: desc });

export const BSC_EXCLUSIVE = [
  {
    path: "/bsc/new-pairs", usd: 0.01,
    summary: "Newly created PancakeSwap pairs in the last N blocks (fresh BSC token launches — the exclusive feed)",
    params: [P("blocks", "Lookback blocks, default 200 (max 1000)")],
    handler: async (req, res) => {
      const n = Math.min(Math.max(Number(req.query.blocks) || 200, 10), 1000);
      const latest = await rpc("eth_blockNumber", []);
      const end = parseInt(latest, 16);
      const from = "0x" + (end - n).toString(16);
      const to = "0x" + end.toString(16);
      const logs = await rpc("eth_getLogs", [{ address: FACTORY, fromBlock: from, toBlock: to, topics: [PAIR_CREATED] }]).catch(() => []);
      const pairs = logs.map((l) => {
        const h = (l.data || "").replace(/^0x/, "");
        const token0 = "0x" + h.slice(64, 104);
        const token1 = "0x" + h.slice(128, 168);
        const pair = "0x" + h.slice(192, 232);
        return { pair, token0, token1, block: parseInt(l.blockNumber, 16), tx: l.transactionHash };
      });
      res.json({ chain: "bsc", fromBlock: end - n, toBlock: end, count: pairs.length, pairs, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/bsc/new-pairs/enriched", usd: 0.05,
    summary: "New pairs + token symbols/names for the freshest launches",
    params: [P("blocks", "Lookback blocks, default 100")],
    handler: async (req, res) => {
      const n = Math.min(Math.max(Number(req.query.blocks) || 100, 10), 500);
      const latest = await rpc("eth_blockNumber", []);
      const end = parseInt(latest, 16);
      const logs = await rpc("eth_getLogs", [{ address: FACTORY, fromBlock: "0x" + (end - n).toString(16), toBlock: "0x" + end.toString(16), topics: [PAIR_CREATED] }]).catch(() => []);
      const out = [];
      for (const l of logs.slice(-30)) {
        const h = (l.data || "").replace(/^0x/, "");
        const token0 = "0x" + h.slice(64, 104);
        const token1 = "0x" + h.slice(128, 168);
        const pair = "0x" + h.slice(192, 232);
        const token = token0.toLowerCase() === WBNB.toLowerCase() ? token1 : token0;
        const quote = token === token0 ? token1 : token0;
        const [nameHex, symHex] = await Promise.all([ethCall(token, "0x06fdde03").catch(() => null), ethCall(token, "0x95d89b41").catch(() => null)]);
        out.push({ pair, token, quote, name: decodeString(nameHex), symbol: decodeString(symHex), block: parseInt(l.blockNumber, 16) });
      }
      res.json({ chain: "bsc", count: out.length, pairs: out, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/bsc/large-txs", usd: 0.02,
    summary: "Large-value transactions in a block range (whale watcher, BSC)",
    params: [P("blocks", "Lookback blocks, default 20 (max 100)"), P("minBNB", "Min value in BNB, default 100")],
    handler: async (req, res) => {
      const n = Math.min(Math.max(Number(req.query.blocks) || 20, 1), 100);
      const minWei = BigInt(Math.round((Number(req.query.minBNB) || 100) * 1e18));
      const latest = await rpc("eth_blockNumber", []);
      const end = parseInt(latest, 16);
      const out = [];
      for (let i = 0; i < n; i++) {
        const blk = await rpc("eth_getBlockByNumber", ["0x" + (end - i).toString(16), false]).catch(() => null);
        if (!blk) continue;
        for (const tx of blk.transactions || []) {
          if (tx.value && BigInt(tx.value) >= minWei) out.push({ hash: tx.hash, from: tx.from, to: tx.to, valueBNB: Number(BigInt(tx.value)) / 1e18, block: parseInt(blk.number, 16) });
        }
        if (out.length >= 50) break;
      }
      res.json({ chain: "bsc", fromBlock: end - n + 1, toBlock: end, count: out.length, txs: out.slice(0, 50), asOf: new Date().toISOString() });
    },
  },
];

export const BSC_EXCLUSIVE_ROUTES = Object.fromEntries(
  BSC_EXCLUSIVE.map((ep) => ["GET " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);
export const BSC_EXCLUSIVE_PATHS = Object.fromEntries(
  BSC_EXCLUSIVE.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params,
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
