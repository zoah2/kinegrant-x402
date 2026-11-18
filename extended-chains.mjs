// 扩展链：TON / Tron / Sui / Aptos / Bitcoin + Aave 仓位
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";

const TON_API = "https://toncenter.com/api/v2";
const TRON_API = "https://api.trongrid.io";
const SUI_API = "https://fullnode.mainnet.sui.io:443";
const APTOS_API = "https://fullnode.mainnet.aptoslabs.com/v1";
const BTC_API = "https://blockstream.info/api";

const EVM_RPCS = {
  ethereum: ["https://eth.llamarpc.com", "https://ethereum-rpc.publicnode.com"],
  base: ["https://mainnet.base.org", "https://base.llamarpc.com"],
  arbitrum: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-rpc.publicnode.com"],
};

async function rpcOn(chain, method, params) {
  let lastErr;
  for (const url of EVM_RPCS[chain] || EVM_RPCS.ethereum) {
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

async function getJson(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}

async function postJson(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}

async function tonGet(path) { return getJson(`${TON_API}/${path}`); }
async function tronGet(path) { return getJson(`${TRON_API}${path}`, { headers: { "TRON-PRO-API-KEY": "" } }); }
async function suiRpc(method, params) { return postJson(SUI_API, { jsonrpc: "2.0", id: 1, method, params }); }
async function aptosGet(path) { return getJson(`${APTOS_API}${path}`); }
async function btcGet(path) { return getJson(`${BTC_API}${path}`); }

const validEvm = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
const encAddr = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const decodeUint = (hex) => (hex && hex !== "0x" ? BigInt(hex).toString() : null);

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18));
  const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

const P = (name, desc) => ({ name, in: "query", required: true, schema: { type: "string" }, description: desc });

export const EXTENDED = [
  // ---------- TON ----------
  { path: "/ton/balance", usd: 0.002, summary: "TON native balance for an address", params: [P("address", "TON address (EQ... / UQ...)")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!a) return res.status(400).json({ error: "bad_address" }); const j = await tonGet("getAddressBalance?address=" + encodeURIComponent(a)); res.json({ chain: "ton", address: a, balanceNano: j.result ?? null, balance: j.result ? Number(j.result) / 1e9 : null, asOf: new Date().toISOString() }); } },
  { path: "/ton/account", usd: 0.002, summary: "TON account state (status, seqno, balance)", params: [P("address", "TON address")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!a) return res.status(400).json({ error: "bad_address" }); const j = await tonGet("getAddressInformation?address=" + encodeURIComponent(a)); const r = j.result || {}; res.json({ chain: "ton", address: a, status: r.state ?? null, balance: r.balance ? Number(r.balance) / 1e9 : null, lastTxLt: r.last_transaction_lt ?? null, asOf: new Date().toISOString() }); } },
  { path: "/ton/tx-count", usd: 0.002, summary: "Recent transaction count for a TON address", params: [P("address", "TON address")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!a) return res.status(400).json({ error: "bad_address" }); const j = await tonGet("getAddressTransactions?address=" + encodeURIComponent(a) + "&limit=20"); res.json({ chain: "ton", address: a, count: Array.isArray(j.result) ? j.result.length : 0, asOf: new Date().toISOString() }); } },

  // ---------- Tron ----------
  { path: "/tron/account", usd: 0.002, summary: "Tron account info (TRX balance, resources)", params: [P("address", "Tron address (T...)")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!a) return res.status(400).json({ error: "bad_address" }); const j = await tronGet("/v1/accounts/" + encodeURIComponent(a)); const acct = j.data?.[0] || {}; res.json({ chain: "tron", address: a, balanceTRX: acct.balance ? acct.balance / 1e6 : 0, frozenTRX: acct.frozen_balance ? acct.frozen_balance / 1e6 : 0, asOf: new Date().toISOString() }); } },
  { path: "/tron/trc20", usd: 0.003, summary: "Tron TRC20 token balances for an address", params: [P("address", "Tron address")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!a) return res.status(400).json({ error: "bad_address" }); const j = await tronGet("/v1/accounts/" + encodeURIComponent(a)); const acct = j.data?.[0] || {}; const list = (acct.trc20 || []).flatMap((m) => Object.entries(m).map(([k, v]) => ({ contract: k, amount: v }))); res.json({ chain: "tron", address: a, count: list.length, tokens: list.slice(0, 30), asOf: new Date().toISOString() }); } },
  { path: "/tron/tx", usd: 0.002, summary: "Tron transaction by hash", params: [P("hash", "Tron transaction hash")],
    handler: async (req, res) => { const h = String(req.query.hash || ""); if (!/^[0-9a-fA-F]{64}$/.test(h)) return res.status(400).json({ error: "bad_hash" }); const j = await tronGet("/v1/transactions/" + h); const t = j.data?.[0] || {}; res.json({ chain: "tron", hash: h, found: !!j.data?.length, block: t.blockNumber ?? null, ret: t.ret?.[0]?.contractRet ?? null, asOf: new Date().toISOString() }); } },

  // ---------- Sui ----------
  { path: "/sui/balance", usd: 0.002, summary: "Sui native SUI balance", params: [P("address", "Sui address (0x..)")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!/^0x[0-9a-fA-F]{1,64}$/.test(a)) return res.status(400).json({ error: "bad_address" }); const j = await suiRpc("suix_getBalance", [a]); res.json({ chain: "sui", address: a, balanceMist: j.result?.totalBalance ?? null, balance: j.result?.totalBalance ? Number(j.result.totalBalance) / 1e9 : null, asOf: new Date().toISOString() }); } },
  { path: "/sui/coins", usd: 0.003, summary: "Sui coin balances (all coin types)", params: [P("address", "Sui address")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!/^0x[0-9a-fA-F]{1,64}$/.test(a)) return res.status(400).json({ error: "bad_address" }); const j = await suiRpc("suix_getAllBalances", [a]); res.json({ chain: "sui", address: a, count: (j.result || []).length, coins: (j.result || []).slice(0, 30), asOf: new Date().toISOString() }); } },
  { path: "/sui/object", usd: 0.003, summary: "Sui object info (type, owner, version)", params: [P("objectId", "Sui object id")],
    handler: async (req, res) => { const o = String(req.query.objectId || ""); if (!/^0x[0-9a-fA-F]{1,64}$/.test(o)) return res.status(400).json({ error: "bad_object" }); const j = await suiRpc("sui_getObject", [o, { showType: true, showOwner: true }]); const d = j.result?.data || {}; res.json({ chain: "sui", objectId: o, type: d.type ?? null, owner: d.owner ?? null, version: d.version ?? null, asOf: new Date().toISOString() }); } },

  // ---------- Aptos ----------
  { path: "/aptos/account", usd: 0.002, summary: "Aptos account info (APT balance, auth key)", params: [P("address", "Aptos address (0x..)")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!/^0x[0-9a-fA-F]{1,64}$/.test(a)) return res.status(400).json({ error: "bad_address" }); const acc = await aptosGet("/accounts/" + a).catch(() => null); const coins = await aptosGet(`/accounts/${a}/resource/0x1::coin::CoinStore%3C0x1::aptos_coin::AptosCoin%3E`).catch(() => null); res.json({ chain: "aptos", address: a, exists: !!acc, sequenceNumber: acc?.sequence_number ?? null, aptBalance: coins?.data?.coin?.value ? Number(coins.data.coin.value) / 1e8 : null, asOf: new Date().toISOString() }); } },
  { path: "/aptos/resources", usd: 0.005, summary: "Aptos account resources (count + names)", params: [P("address", "Aptos address")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!/^0x[0-9a-fA-F]{1,64}$/.test(a)) return res.status(400).json({ error: "bad_address" }); const list = await aptosGet("/accounts/" + a + "/resources").catch(() => null); const arr = Array.isArray(list) ? list : []; res.json({ chain: "aptos", address: a, count: arr.length, types: arr.slice(0, 30).map((r) => r.type), asOf: new Date().toISOString() }); } },
  { path: "/aptos/tx", usd: 0.002, summary: "Aptos transaction by hash", params: [P("hash", "Aptos transaction hash")],
    handler: async (req, res) => { const h = String(req.query.hash || ""); if (!/^0x[0-9a-fA-F]{1,64}$/.test(h)) return res.status(400).json({ error: "bad_hash" }); const t = await aptosGet("/transactions/by_hash/" + h).catch(() => null); res.json({ chain: "aptos", hash: h, found: !!t, success: t?.success ?? null, version: t?.version ?? null, gasUsed: t?.gas_used ?? null, asOf: new Date().toISOString() }); } },

  // ---------- Bitcoin ----------
  { path: "/btc/address", usd: 0.003, summary: "Bitcoin address stats (balance, tx count)", params: [P("address", "Bitcoin address")],
    handler: async (req, res) => { const a = String(req.query.address || ""); if (!/^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(a)) return res.status(400).json({ error: "bad_address" }); const j = await btcGet("/address/" + a); const cs = j.chain_stats || {}; res.json({ chain: "bitcoin", address: a, balanceSats: (cs.funded_txo_sum || 0) - (cs.spent_txo_sum || 0), txCount: cs.tx_count || 0, asOf: new Date().toISOString() }); } },
  { path: "/btc/tx", usd: 0.002, summary: "Bitcoin transaction status (confirmations, fee)", params: [P("txid", "Bitcoin txid")],
    handler: async (req, res) => { const h = String(req.query.txid || ""); if (!/^[0-9a-fA-F]{64}$/.test(h)) return res.status(400).json({ error: "bad_txid" }); const j = await btcGet("/tx/" + h); const st = j.status || {}; res.json({ chain: "bitcoin", txid: h, confirmed: st.confirmed ?? null, blockHeight: st.block_height ?? null, fee: j.fee ?? null, size: j.size ?? null, asOf: new Date().toISOString() }); } },
  { path: "/btc/fees", usd: 0.001, params: [{ name: "network", in: "query", required: false, schema: { type: "string", default: "mainnet" }, description: "Bitcoin network" }], summary: "Bitcoin recommended fee rates (sat/vB)", handler: async (_req, res) => {
    const j = await btcGet("/fee-estimates"); res.json({ chain: "bitcoin", fees: j, asOf: new Date().toISOString() }); } },

  // ---------- Aave V3 仓位（Ethereum/Base/Arbitrum） ----------
  { path: "/aave/account", usd: 0.005, summary: "Aave V3 account data (health factor, collateral, debt)", params: [
    { name: "chain", in: "query", required: false, schema: { type: "string", enum: ["ethereum", "base", "arbitrum"], default: "ethereum" } },
    P("address", "EVM address"),
  ],
    handler: async (req, res) => {
      const chain = String(req.query.chain || "ethereum");
      const a = String(req.query.address || "");
      if (!validEvm(a)) return res.status(400).json({ error: "bad_address" });
      const POOL = { ethereum: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", base: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", arbitrum: "0x794a61358D6845594F94dc1DB02A252b5b4814aD" }[chain];
      const data = await rpcOn(chain, "eth_call", [{ to: POOL, data: "0xbf92857c" + encAddr(a) }, "latest"]).catch(() => null);
      if (!data || data === "0x") return res.status(404).json({ error: "no_data" });
      const h = data.replace(/^0x/, "");
      const words = [];
      for (let i = 0; i < h.length; i += 64) words.push(BigInt("0x" + h.slice(i, i + 64)));
      res.json({
        chain, address: a.toLowerCase(),
        totalCollateralBase: words[0]?.toString(),
        totalDebtBase: words[1]?.toString(),
        availableBorrowsBase: words[2]?.toString(),
        currentLiquidationThreshold: words[3]?.toString(),
        ltv: words[4]?.toString(),
        healthFactor: words[5] ? Number(words[5]) / 1e18 : null,
        asOf: new Date().toISOString(),
      });
    } },
];

export const EXTENDED_ROUTES = Object.fromEntries(
  EXTENDED.map((ep) => ["GET " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);

export const EXTENDED_PATHS = Object.fromEntries(
  EXTENDED.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params,
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
