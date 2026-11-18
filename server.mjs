import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  declareDiscoveryExtension,
  bazaarResourceServerExtension,
} from "@x402/extensions/bazaar";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const PORT = 3100;
const PAY_TO = "0x466D98F63B495Be89Cf7aD4f47CB499e8DCe0a7E"; // kinee.ai EVM address
const PROXY = "http://127.0.0.1:7897";
const NETWORK = "eip155:56"; // BSC mainnet
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const PRICE_AMOUNT = { amount: "50000000000000000", asset: USDT_BSC }; // 0.05 USDT, BSC USDT has 18 decimals

const facilitator = new HTTPFacilitatorClient({
  url: "https://facilitator.payai.network",
});
const resourceServer = new x402ResourceServer(facilitator)
  .register(NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

const discovery = declareDiscoveryExtension({
  method: "GET",
  input: { chain: "56", range: "1h" },
  inputSchema: {
    type: "object",
    properties: {
      chain: { type: "string", description: "BSC chain id; default 56" },
      range: {
        type: "string",
        enum: ["5m", "1h", "24h"],
        description: "signal lookback window; default 1h",
      },
    },
  },
  output: {
    example: {
      scanned: 1,
      candidates: 0,
      buy: [],
      rejected: 1,
      asOf: "2026-11-18T05:00:00.000Z",
    },
    schema: {
      type: "object",
      properties: {
        scanned: { type: "number" },
        candidates: { type: "number" },
        buy: { type: "array" },
        rejected: { type: "number" },
        asOf: { type: "string" },
      },
    },
  },
});

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /signal": {
        accepts: [
          {
            scheme: "exact",
            price: PRICE_AMOUNT,
            network: NETWORK,
            payTo: PAY_TO,
            extra: { assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 },
          },
        ],
        description:
          "BSC live meme signal screen. Filters: no high-tax token, no dev-closed position, market cap < $150K, signal age < 30 min. Returns BUY candidates or empty list.",
        mimeType: "application/json",
        extensions: discovery,
      },
    },
    resourceServer,
  ),
);

function runBaw(args) {
  return exec("baw", args, {
    timeout: 60000,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, HTTPS_PROXY: PROXY, HTTP_PROXY: PROXY, NODE_USE_ENV_PROXY: "1" },
    shell: true,
  }).then((r) => JSON.parse(r.stdout));
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "kinee-signal", ts: Date.now() });
});

app.get("/signal", async (req, res) => {
  try {
    const chain = String(req.query.chain || "56");
    const range = String(req.query.range || "1h");
    const raw = await runBaw([
      "signal", "list", "--chain-id", chain, "--time-range", range,
      "--page-size", "100", "--sort-by", "time", "--json",
    ]);
    if (!raw.success) {
      return res.status(502).json({ error: "signal_source_failed", detail: raw.error });
    }
    const now = Date.now();
    const list = Array.isArray(raw.data?.list) ? raw.data.list : [];
    const rows = list.map((s) => {
      const tags = [];
      for (const k of Object.keys(s.tokenTag || {})) {
        for (const t of s.tokenTag[k] || []) tags.push(t.tagName);
      }
      const ageMin = s.signalTriggerTime
        ? Math.round((now - Number(s.signalTriggerTime)) / 60000)
        : null;
      const mc = s.alertMarketCap ? Number(s.alertMarketCap) : 0;
      const reasons = [];
      if (tags.includes("High Tax Token")) reasons.push("HIGH_TAX");
      if (tags.includes("DEV Close Position")) reasons.push("DEV_CLOSED");
      if (tags.includes("Low Liquidity")) reasons.push("LOW_LIQ");
      if (ageMin !== null && ageMin > 30) reasons.push("STALE");
      if (mc > 150000) reasons.push("MC_HIGH");
      return {
        ticker: s.ticker,
        contract: s.contractAddress,
        chainId: s.chainId,
        ageMin,
        alertMarketCap: mc,
        maxGain: s.maxGain ?? null,
        source: s.signalSource,
        smartMoneyCount: s.smartMoneyCount ?? null,
        verdict: reasons.length === 0 ? "BUY_CANDIDATE" : "REJECT",
        reasons,
      };
    });
    const candidates = rows.filter((r) => r.verdict === "BUY_CANDIDATE");
    res.json({
      scanned: rows.length,
      candidates: candidates.length,
      buy: candidates,
      rejected: rows.length - candidates.length,
      asOf: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: "scan_failed", message: String(e?.message || e) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `kinee-signal x402 on :${PORT} payTo=${PAY_TO} network=${NETWORK} price=0.05 USDT bazaar=on`,
  );
});


