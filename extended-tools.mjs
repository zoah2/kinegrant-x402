// 工具矩阵：6 个零/低依赖端点（价格比对手低 50%）
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E";
const NETWORK = "eip155:56";
const BASE_NETWORK = "eip155:8453";

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("http " + r.status);
  return r.text();
}

function acceptsFor(usd) {
  const bsc = BigInt(Math.round(usd * 1e18));
  const base = BigInt(Math.round(usd * 1e6));
  return [
    { scheme: "exact", price: { amount: bsc.toString(), asset: USDT }, network: NETWORK, payTo: PAY_TO, extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 } },
    { scheme: "exact", price: { amount: base.toString(), asset: BASE_USDC }, network: BASE_NETWORK, payTo: PAY_TO, extra: { name: "USD Coin", version: "2" } },
  ];
}

const P = (name, desc, required = true) => ({ name, in: "query", required, schema: { type: "string" }, description: desc });

const SELECTORS = {
  "0xa9059cbb": "transfer(address,uint256)",
  "0x095ea7b3": "approve(address,uint256)",
  "0x23b872dd": "transferFrom(address,address,uint256)",
  "0x70a08231": "balanceOf(address)",
  "0xdd62ed3e": "allowance(address,address)",
  "0x18160ddd": "totalSupply()",
  "0x06fdde03": "name()",
  "0x95d89b41": "symbol()",
  "0x313ce567": "decimals()",
  "0x8da5cb5b": "owner()",
  "0x715018a6": "renounceOwnership()",
  "0xf2fde38b": "transferOwnership(address)",
  "0x5c19a95c": "delegate(address)",
  "0x2e1a7d4d": "withdraw(uint256)",
  "0xd0e30db0": "deposit()",
  "0x38ed1739": "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
  "0x7ff36ab5": "swapExactETHForTokens(uint256,address[],address,uint256)",
  "0xfb3bdb41": "swapETHForExactTokens(uint256,address[],address,uint256)",
  "0x18cbafe5": "swapExactTokensForETH(uint256,uint256,address[],address,uint256)",
  "0x8803dbee": "swapTokensForExactTokens(uint256,uint256,address[],address,uint256)",
  "0x5c11d795": "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
  "0x791ac947": "swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
  "0x4a25d94a": "swapTokensForExactETH(uint256,uint256,address[],address,uint256)",
  "0xa22cb465": "setApprovalForAll(address,bool)",
  "0x42842e0e": "safeTransferFrom(address,address,uint256)",
  "0xb88d4fde": "safeTransferFrom(address,address,uint256,bytes)",
  "0x6352211e": "ownerOf(uint256)",
  "0x0dfe1681": "token0()",
  "0xd21220a7": "token1()",
  "0x0902f1ac": "getReserves()",
  "0xe6a43905": "getPair(address,address)",
  "0xc87b56dd": "tokenURI(uint256)",
  "0xbf92857c": "getUserAccountData(address)",
  "0x8c5be1e5": "Approval(address,address,uint256) EVENT",
  "0xddf252ad": "Transfer(address,address,uint256) EVENT",
  "0x1c411e9a": "Sync(uint112,uint112) EVENT",
  "0x0d3648bd": "PairCreated(address,address,address,uint256) EVENT",
};

export const TOOLS = [
  {
    path: "/holidays",
    usd: 0.001,
    summary: "Public holidays for any country and year (110+ countries)",
    params: [P("country", "ISO country code, e.g. CN"), P("year", "Year, e.g. 2026", false)],
    handler: async (req, res) => {
      const c = String(req.query.country || "CN").toUpperCase();
      const y = String(req.query.year || new Date().getFullYear());
      const list = await getJson(`https://date.nager.at/api/v3/PublicHolidays/${y}/${c}`);
      res.json({ country: c, year: Number(y), count: list.length, holidays: list.map((h) => ({ date: h.date, name: h.localName || h.name })), asOf: new Date().toISOString() });
    },
  },
  {
    path: "/db-migration/scan",
    usd: 0.002,
    summary: "SQL migration risk scan: destructive statements, locks, missing WHERE",
    params: [P("sql", "SQL migration text")],
    handler: async (req, res) => {
      const sql = String(req.query.sql || "");
      if (!sql) return res.status(400).json({ error: "empty_sql" });
      const findings = [];
      const rules = [
        [/DROP\s+(TABLE|DATABASE|SCHEMA)/i, "DESTRUCTIVE_DROP", "drops objects and data permanently"],
        [/TRUNCATE\s+TABLE/i, "DESTRUCTIVE_TRUNCATE", "removes all rows"],
        [/ALTER\s+TABLE[\s\S]*?DROP\s+COLUMN/i, "DESTRUCTIVE_DROP_COLUMN", "drops a column and its data"],
        [/UPDATE\s+[^\s;]+\s+SET/i, "UPDATE_WITHOUT_WHERE", "UPDATE without WHERE touches every row"],
        [/DELETE\s+FROM\s+[^\s;]+\s*;/i, "DELETE_WITHOUT_WHERE", "DELETE without WHERE removes all rows"],
        [/ADD\s+(CONSTRAINT|FOREIGN\s+KEY)/i, "LOCKING_ADD_CONSTRAINT", "may lock the table during migration"],
        [/CREATE\s+INDEX/i, "INDEX_CREATION", "can block writes on large tables"],
        [/NOT\s+NULL/i, "NOT_NULL_ADD", "adding NOT NULL may fail on existing NULL rows"],
      ];
      for (const [re, code, why] of rules) if (re.test(sql)) findings.push({ code, why });
      const verdict = findings.some((f) => f.code.startsWith("DESTRUCTIVE")) ? "HIGH_RISK" : findings.length ? "REVIEW" : "LOW";
      res.json({ verdict, findings, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/deploy-config/scan",
    usd: 0.002,
    summary: "Deployment config risk scan for YAML/Docker/K8s snippets",
    params: [P("text", "Config text")],
    handler: async (req, res) => {
      const t = String(req.query.text || "");
      if (!t) return res.status(400).json({ error: "empty_text" });
      const findings = [];
      const rules = [
        [/privileged:\s*true/i, "PRIVILEGED_CONTAINER", "container runs privileged"],
        [/hostNetwork:\s*true/i, "HOST_NETWORK", "shares host network namespace"],
        [/hostPID:\s*true/i, "HOST_PID", "shares host process namespace"],
        [/image:\s*[^\s]+:latest/i, "LATEST_TAG", "mutable latest tag"],
        [/runAsUser:\s*0/i, "ROOT_USER", "runs as root"],
        [/allowPrivilegeEscalation:\s*true/i, "PRIV_ESCALATION", "privilege escalation allowed"],
        [/capabilities:[\s\S]*?add:[\s\S]*?ALL/i, "ALL_CAPS", "all capabilities added"],
        [/FROM\s+\S+:latest/i, "BASE_LATEST", "Dockerfile base image uses latest"],
        [/chmod\s+777/i, "CHMOD_777", "world-writable permissions"],
      ];
      for (const [re, code, why] of rules) if (re.test(t)) findings.push({ code, why });
      const verdict = findings.length > 2 ? "HIGH_RISK" : findings.length ? "REVIEW" : "LOW";
      res.json({ verdict, findings, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/robots/check",
    usd: 0.001,
    summary: "Check if a user agent may fetch a path per robots.txt",
    params: [P("host", "Hostname, e.g. example.com"), P("path", "Path, e.g. /admin", false), P("ua", "User agent, default Mozilla", false)],
    handler: async (req, res) => {
      const host = String(req.query.host || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
      const path = String(req.query.path || "/");
      const ua = String(req.query.ua || "Mozilla");
      if (!host) return res.status(400).json({ error: "bad_host" });
      const txt = await getText(`https://${host}/robots.txt`).catch(() => "");
      if (!txt) return res.json({ host, path, ua, robotsFound: false, allowed: true, note: "no robots.txt — treat as allowed", asOf: new Date().toISOString() });
      const groups = [];
      let cur = null;
      for (const line of txt.split(/\r?\n/)) {
        const l = line.replace(/#.*/, "").trim();
        if (/^user-agent:/i.test(l)) {
          if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
          cur.agents.push(l.split(":")[1].trim());
        } else if (/^disallow:/i.test(l) && cur) {
          const p = l.split(":").slice(1).join(":").trim();
          if (p) cur.rules.push({ type: "disallow", path: p });
        } else if (/^allow:/i.test(l) && cur) {
          const p = l.split(":").slice(1).join(":").trim();
          if (p) cur.rules.push({ type: "allow", path: p });
        }
      }
      const mine = groups.filter((g) => g.agents.some((a) => a === "*" || ua.toLowerCase().includes(a.toLowerCase())));
      let best = null;
      for (const g of mine) for (const r of g.rules) {
        const pat = r.path.replace(/\*/g, ".*");
        if (new RegExp("^" + pat).test(path)) {
          if (!best || r.path.length > best.path.length) best = r;
        }
      }
      res.json({ host, path, ua, robotsFound: true, allowed: best ? best.type === "allow" : true, matchedRule: best, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/selector",
    usd: 0.001,
    summary: "Resolve a 4-byte function selector to its signature (built-in dictionary)",
    params: [P("hex", "0x + 8 hex chars")],
    handler: async (req, res) => {
      const h = String(req.query.hex || "").toLowerCase();
      if (!/^0x[0-9a-f]{8}$/.test(h)) return res.status(400).json({ error: "bad_selector" });
      const sig = SELECTORS[h] || null;
      res.json({ selector: h, signature: sig, known: !!sig, asOf: new Date().toISOString() });
    },
  },
  {
    path: "/text/wordcount",
    usd: 0.001,
    summary: "Word, character and line statistics for text",
    params: [P("text", "Text to analyze")],
    handler: async (req, res) => {
      const t = String(req.query.text || "");
      const chars = t.length;
      const words = t.trim() ? t.trim().split(/\s+/).length : 0;
      const lines = t ? t.split(/\r?\n/).length : 0;
      res.json({ chars, charsNoSpaces: t.replace(/\s/g, "").length, words, lines, asOf: new Date().toISOString() });
    },
  },
];

export const TOOLS_ROUTES = Object.fromEntries(
  TOOLS.map((ep) => ["GET " + ep.path, { accepts: acceptsFor(ep.usd), description: ep.summary, mimeType: "application/json" }]),
);

export const TOOLS_PATHS = Object.fromEntries(
  TOOLS.map((ep) => [ep.path, {
    get: {
      summary: ep.summary,
      parameters: ep.params,
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: String(ep.usd) }, protocols: [{ x402: {} }] },
      responses: { "200": { description: "OK" }, "402": { description: "Payment Required" } },
    },
  }]),
);
