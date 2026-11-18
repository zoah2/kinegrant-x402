// 扩容：8 链 × RPC 标准方法矩阵（syncing/version/peer-count/priority-fee/block-tx/gas-history）
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";

const RPCS = {
  bsc: ["https://bsc-dataseed1.binance.org", "https://bsc-rpc.publicnode.com"],
  base: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"],
  ethereum: ["https://eth.llamarpc.com", "https://ethereum-rpc.publicnode.com"],
  arbitrum: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-rpc.publicnode.com"],
  optimism: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"],
  polygon: ["https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com"],
  avalanche: ["https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain-rpc.publicnode.com"],
  linea: ["https://rpc.linea.build", "https://linea-rpc.publicnode.com"],
};

async function rpcOn(chain, method, params) {
  let lastErr;
  for (const url of RPCS[chain] || RPCS.bsc) {
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
  throw lastErr || new Error("rpc failed");
}

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18));
  const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

const chainParam = { name: "chain", in: "query", required: false, schema: { type: "string", enum: Object.keys(RPCS), default: "bsc" }, description: "Chain key" };

export const EXPAND = [
  { path: "/chain/syncing", usd: 0.001, summary: "Node sync status for any chain", params: [chainParam],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const r = await rpcOn(c, "eth_syncing", []); res.json({ chain: c, syncing: r !== false, detail: r === false ? null : r, asOf: new Date().toISOString() }); } },
  { path: "/chain/version", usd: 0.001, summary: "Node client version for any chain", params: [chainParam],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const v = await rpcOn(c, "web3_clientVersion", []); res.json({ chain: c, client: v, asOf: new Date().toISOString() }); } },
  { path: "/chain/peer-count", usd: 0.001, summary: "Node peer count for any chain", params: [chainParam],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const n = await rpcOn(c, "net_peerCount", []); res.json({ chain: c, peers: parseInt(n, 16), asOf: new Date().toISOString() }); } },
  { path: "/chain/priority-fee", usd: 0.001, summary: "Max priority fee (EIP-1559) for any chain", params: [chainParam],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const h = await rpcOn(c, "eth_maxPriorityFeePerGas", []); res.json({ chain: c, priorityFeeWei: BigInt(h).toString(), gwei: Number(BigInt(h)) / 1e9, asOf: new Date().toISOString() }); } },
  { path: "/chain/block-tx-count", usd: 0.001, summary: "Transaction count of the latest block", params: [chainParam],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const b = await rpcOn(c, "eth_getBlockByNumber", ["latest", false]); res.json({ chain: c, blockNumber: parseInt(b.number, 16), txCount: b.transactions?.length ?? 0, asOf: new Date().toISOString() }); } },
  { path: "/chain/gas-history", usd: 0.002, summary: "Gas price across the last 10 blocks", params: [chainParam],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const latest = await rpcOn(c, "eth_blockNumber", []); const n = parseInt(latest, 16); const out = []; for (let i = 0; i < 10; i++) { const bn = "0x" + (n - i).toString(16); const b = await rpcOn(c, "eth_getBlockByNumber", [bn, false]).catch(() => null); if (b) out.push({ block: n - i, gasUsed: BigInt(b.gasUsed).toString(), gasLimit: BigInt(b.gasLimit).toString(), baseFee: b.baseFeePerGas ? BigInt(b.baseFeePerGas).toString() : null }); } res.json({ chain: c, blocks: out, asOf: new Date().toISOString() }); } },
  { path: "/chain/tx-count-in-block", usd: 0.001, summary: "Transaction count at a specific block", params: [chainParam, { name: "block", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const b = String(req.query.block || "latest"); const tag = b === "latest" ? "latest" : "0x" + parseInt(b, 10).toString(16); const blk = await rpcOn(c, "eth_getBlockByNumber", [tag, false]); res.json({ chain: c, blockNumber: blk ? parseInt(blk.number, 16) : null, txCount: blk?.transactions?.length ?? 0, asOf: new Date().toISOString() }); } },
  { path: "/chain/balance-multi", usd: 0.003, summary: "Native balances for up to 5 addresses on any chain", params: [chainParam, { name: "addresses", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated" }],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const list = String(req.query.addresses || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5); if (!list.length || !list.every((a) => /^0x[0-9a-fA-F]{40}$/.test(a))) return res.status(400).json({ error: "bad_addresses" }); const out = []; for (const a of list) { const w = await rpcOn(c, "eth_getBalance", [a, "latest"]).catch(() => "0x0"); out.push({ address: a.toLowerCase(), balance: Number(BigInt(w)) / 1e18 }); } res.json({ chain: c, balances: out, asOf: new Date().toISOString() }); } },
];

export const EXPAND_ROUTES = Object.fromEntries(
  EXPAND.map((ep) => ["GET " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);
export const EXPAND_PATHS = Object.fromEntries(
  EXPAND.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params,
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
