// 多链引擎：8 条 EVM 链 + Solana 通用端点
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";

export const CHAINS = {
  bsc: { id: 56, native: "BNB", rpcs: ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org", "https://bsc-rpc.publicnode.com"] },
  base: { id: 8453, native: "ETH", rpcs: ["https://mainnet.base.org", "https://base.llamarpc.com", "https://base-rpc.publicnode.com"] },
  ethereum: { id: 1, native: "ETH", rpcs: ["https://eth.llamarpc.com", "https://ethereum-rpc.publicnode.com", "https://1rpc.io/eth"] },
  arbitrum: { id: 42161, native: "ETH", rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-rpc.publicnode.com"] },
  optimism: { id: 10, native: "ETH", rpcs: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"] },
  polygon: { id: 137, native: "POL", rpcs: ["https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com"] },
  avalanche: { id: 43114, native: "AVAX", rpcs: ["https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain-rpc.publicnode.com"] },
  linea: { id: 59144, native: "ETH", rpcs: ["https://rpc.linea.build", "https://linea-rpc.publicnode.com"] },
  monad: { id: 143, native: "MON", rpcs: ["https://rpc.monad.xyz", "https://rpc1.monad.xyz"] },
  celo: { id: 42220, native: "CELO", rpcs: ["https://forno.celo.org", "https://celo-rpc.publicnode.com"] },
  sei: { id: 1329, native: "SEI", rpcs: ["https://evm-rpc.sei-apis.com", "https://sei-evm-rpc.publicnode.com"] },
  ink: { id: 57073, native: "ETH", rpcs: ["https://rpc.inkonchain.com", "https://ink-rpc.publicnode.com"] },
  arc: { id: 5042, native: "USDC", rpcs: ["https://rpc.arc.network"] },
};
const SOL_RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

async function rpcOn(chainKey, method, params) {
  const chain = CHAINS[chainKey] || CHAINS.bsc;
  let lastErr;
  for (const url of chain.rpcs) {
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

async function solRpc(method, params) {
  let lastErr;
  for (const url of SOL_RPCS) {
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
  throw lastErr || new Error("solana rpc failed");
}

const validAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
const encAddr = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const validSol = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || "");

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18));
  const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

const chainParam = { name: "chain", in: "query", required: false, schema: { type: "string", enum: Object.keys(CHAINS), default: "bsc" }, description: "Chain key: bsc, base, ethereum, arbitrum, optimism, polygon, avalanche, linea" };
const addrParam = (n = "address") => ({ name: n, in: "query", required: true, schema: { type: "string" } });

async function evmCall(chainKey, to, data) {
  return rpcOn(chainKey, "eth_call", [{ to, data }, "latest"]);
}
const decodeString = (hex) => {
  if (!hex || hex === "0x") return null;
  const h = hex.replace(/^0x/, "");
  try { const len = parseInt(h.slice(64, 128), 16); return Buffer.from(h.slice(128, 128 + len * 2), "hex").toString("utf8"); } catch { return null; }
};
const decodeUint = (hex) => (hex && hex !== "0x" ? BigInt(hex).toString() : null);

export const MULTICHAIN = [
  { path: "/chain/balance", usd: 0.002, summary: "Native balance on any supported EVM chain", params: [chainParam, addrParam()],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const a = String(req.query.address || ""); if (!validAddr(a)) return res.status(400).json({ error: "bad_address" }); const wei = await rpcOn(c, "eth_getBalance", [a, "latest"]); res.json({ chain: c, chainId: CHAINS[c]?.id, address: a.toLowerCase(), native: CHAINS[c]?.native, balance: Number(BigInt(wei)) / 1e18, wei, asOf: new Date().toISOString() }); } },
  { path: "/chain/nonce", usd: 0.001, summary: "Transaction count (nonce) on any EVM chain", params: [chainParam, addrParam()],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const a = String(req.query.address || ""); if (!validAddr(a)) return res.status(400).json({ error: "bad_address" }); const n = await rpcOn(c, "eth_getTransactionCount", [a, "latest"]); res.json({ chain: c, address: a.toLowerCase(), nonce: parseInt(n, 16), asOf: new Date().toISOString() }); } },
  { path: "/chain/code", usd: 0.001, summary: "Whether an address is a contract on any EVM chain", params: [chainParam, addrParam()],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const a = String(req.query.address || ""); if (!validAddr(a)) return res.status(400).json({ error: "bad_address" }); const code = await rpcOn(c, "eth_getCode", [a, "latest"]); res.json({ chain: c, address: a.toLowerCase(), isContract: !!code && code !== "0x", codeSize: code ? (code.length - 2) / 2 : 0, asOf: new Date().toISOString() }); } },
  { path: "/chain/gas", usd: 0.001, summary: "Gas price on any EVM chain", params: [chainParam],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const hex = await rpcOn(c, "eth_gasPrice", []); res.json({ chain: c, gasPriceWei: BigInt(hex).toString(), gwei: Number(BigInt(hex)) / 1e9, asOf: new Date().toISOString() }); } },
  { path: "/chain/block", usd: 0.001, summary: "Latest block info on any EVM chain", params: [chainParam],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const blk = await rpcOn(c, "eth_getBlockByNumber", ["latest", false]); res.json({ chain: c, blockNumber: parseInt(blk.number, 16), timestamp: parseInt(blk.timestamp, 16), txCount: blk.transactions?.length ?? null, asOf: new Date().toISOString() }); } },
  { path: "/chain/chain-id", usd: 0.001, summary: "Chain id verification for any supported chain", params: [chainParam],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const id = await rpcOn(c, "eth_chainId", []); res.json({ chain: c, chainId: parseInt(id, 16), asOf: new Date().toISOString() }); } },
  { path: "/chain/token-info", usd: 0.002, summary: "ERC20 metadata on any EVM chain (name/symbol/decimals/supply)", params: [chainParam, addrParam("token")],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const t = String(req.query.token || ""); if (!validAddr(t)) return res.status(400).json({ error: "bad_token" }); const [n, s, d, sup] = await Promise.all([evmCall(c, t, "0x06fdde03").catch(() => null), evmCall(c, t, "0x95d89b41").catch(() => null), evmCall(c, t, "0x313ce567").catch(() => null), evmCall(c, t, "0x18160ddd").catch(() => null)]); const dec = d ? Number(BigInt(d)) : null; res.json({ chain: c, token: t.toLowerCase(), name: decodeString(n), symbol: decodeString(s), decimals: dec, supply: decodeUint(sup), asOf: new Date().toISOString() }); } },
  { path: "/chain/token-balance", usd: 0.002, summary: "ERC20 balance of an address on any EVM chain", params: [chainParam, addrParam("token"), addrParam("holder")],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const t = String(req.query.token || ""); const h = String(req.query.holder || ""); if (!validAddr(t) || !validAddr(h)) return res.status(400).json({ error: "bad_params" }); const raw = await evmCall(c, t, "0x70a08231" + encAddr(h)).catch(() => null); res.json({ chain: c, token: t.toLowerCase(), holder: h.toLowerCase(), raw: decodeUint(raw), asOf: new Date().toISOString() }); } },
  { path: "/chain/allowance", usd: 0.002, summary: "ERC20 allowance on any EVM chain", params: [chainParam, addrParam("token"), addrParam("owner"), addrParam("spender")],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const t = String(req.query.token || ""); const o = String(req.query.owner || ""); const s = String(req.query.spender || ""); if (!validAddr(t) || !validAddr(o) || !validAddr(s)) return res.status(400).json({ error: "bad_params" }); const raw = await evmCall(c, t, "0xdd62ed3e" + encAddr(o) + encAddr(s)).catch(() => null); res.json({ chain: c, token: t.toLowerCase(), owner: o.toLowerCase(), spender: s.toLowerCase(), allowance: decodeUint(raw), asOf: new Date().toISOString() }); } },
  { path: "/chain/tx", usd: 0.001, summary: "Transaction info on any EVM chain", params: [chainParam, { name: "hash", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const h = String(req.query.hash || ""); if (!/^0x[0-9a-fA-F]{64}$/.test(h)) return res.status(400).json({ error: "bad_hash" }); const tx = await rpcOn(c, "eth_getTransactionByHash", [h]).catch(() => null); if (!tx) return res.status(404).json({ error: "not_found" }); res.json({ chain: c, hash: h, from: tx.from, to: tx.to, value: tx.value ? BigInt(tx.value).toString() : null, blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : null, asOf: new Date().toISOString() }); } },
  { path: "/chain/tx-receipt", usd: 0.001, summary: "Transaction receipt/status on any EVM chain", params: [chainParam, { name: "hash", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const h = String(req.query.hash || ""); if (!/^0x[0-9a-fA-F]{64}$/.test(h)) return res.status(400).json({ error: "bad_hash" }); const rc = await rpcOn(c, "eth_getTransactionReceipt", [h]).catch(() => null); if (!rc) return res.status(404).json({ error: "not_found" }); res.json({ chain: c, hash: h, status: parseInt(rc.status, 16) === 1 ? "success" : "failed", gasUsed: BigInt(rc.gasUsed).toString(), logCount: rc.logs.length, blockNumber: parseInt(rc.blockNumber, 16), asOf: new Date().toISOString() }); } },
  { path: "/chain/gas-budget", usd: 0.001, summary: "Gas cost estimate on any EVM chain", params: [chainParam, { name: "gas", in: "query", required: false, schema: { type: "string", default: "21000" } }],
    handler: async (req, res) => { const c = String(req.query.chain || "bsc"); const gas = BigInt(String(req.query.gas || "21000")); const hex = await rpcOn(c, "eth_gasPrice", []); const cost = BigInt(hex) * gas; res.json({ chain: c, gas: gas.toString(), costNative: Number(cost) / 1e18, native: CHAINS[c]?.native, asOf: new Date().toISOString() }); } },

  // ---------- Solana ----------
  { path: "/sol/balance", usd: 0.002, summary: "Solana native SOL balance", params: [{ name: "address", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!validSol(a)) return res.status(400).json({ error: "bad_address" }); const r = await solRpc("getBalance", [a]); res.json({ address: a, lamports: r?.value ?? null, sol: (r?.value ?? 0) / 1e9, asOf: new Date().toISOString() }); } },
  { path: "/sol/account", usd: 0.002, summary: "Solana account info (owner, lamports, data size)", params: [{ name: "address", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!validSol(a)) return res.status(400).json({ error: "bad_address" }); const r = await solRpc("getAccountInfo", [a, { encoding: "base64" }]); const v = r?.value; res.json({ address: a, exists: !!v, owner: v?.owner ?? null, lamports: v?.lamports ?? null, dataLen: v?.data?.[0] ? Buffer.from(v.data[0], "base64").length : 0, executable: v?.executable ?? null, asOf: new Date().toISOString() }); } },
  { path: "/sol/token-balances", usd: 0.005, summary: "Solana SPL token balances for a wallet", params: [{ name: "address", in: "query", required: true, schema: { type: "string" } }],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!validSol(a)) return res.status(400).json({ error: "bad_address" }); const r = await solRpc("getTokenAccountsByOwner", [a, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }]); const list = (r?.value || []).map((x) => ({ mint: x.account?.data?.parsed?.info?.mint, amount: x.account?.data?.parsed?.info?.tokenAmount?.uiAmount, decimals: x.account?.data?.parsed?.info?.tokenAmount?.decimals })).filter((x) => x.mint); res.json({ address: a, count: list.length, tokens: list.slice(0, 50), asOf: new Date().toISOString() }); } },
];

export const MULTICHAIN_ROUTES = Object.fromEntries(
  MULTICHAIN.map((ep) => ["GET " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);

export const MULTICHAIN_PATHS = Object.fromEntries(
  MULTICHAIN.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params,
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
