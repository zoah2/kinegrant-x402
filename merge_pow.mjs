// 合并 PoW 免费层：免费路径从付费路由移除，改由 PoW gate 控制
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("powGate")) { console.log("already"); process.exit(0); }

// 1. import
s = s.replace(
  'import { UTIL_ENDPOINTS, UTIL_ROUTES, UTIL_PATHS } from "./utility-xpay.mjs";',
  'import { UTIL_ENDPOINTS, UTIL_ROUTES, UTIL_PATHS } from "./utility-xpay.mjs";\nimport { FREE_PATHS, issueChallenge, verifyPow } from "./pow.mjs";',
);

// 2. UTIL_ROUTES 过滤掉免费路径
s = s.replace(
  "app.use(paymentMiddleware(UTIL_ROUTES, resourceServer));",
  `const UTIL_ROUTES_PAID = Object.fromEntries(
  Object.entries(UTIL_ROUTES).filter(([k]) => !FREE_PATHS.has(k.replace("GET ", ""))),
);
app.use(paymentMiddleware(UTIL_ROUTES_PAID, resourceServer));

// PoW gate：免费路径 = PoW 有效则放行，否则 402（提示去 /pow/challenge）
app.use((req, res, next) => {
  const p = req.path;
  if (!FREE_PATHS.has(p)) return next();
  if (verifyPow(req.headers["x-pow"]).ok) return next();
  res.status(402).json({
    error: "payment_required_or_pow",
    hint: "GET /pow/challenge, solve sha256(challenge + ':' + nonce) to start with N hex zeros, then retry with header X-PoW: <challenge>:<nonce>",
    powEndpoint: "/pow/challenge",
    asOf: new Date().toISOString(),
  });
});

app.get("/pow/challenge", (_req, res) => res.json(issueChallenge()));`,
);

// 3. openapi 加 /pow/challenge
s = s.replace(
  "...EXPAND_PATHS, ...SKILL_PATHS, ...SKILL2_PATHS },",
  `...EXPAND_PATHS, ...SKILL_PATHS, ...SKILL2_PATHS,
    "/pow/challenge": {
      get: {
        summary: "Get a proof-of-work challenge to call CPU-only endpoints for free",
        security: [],
        responses: { "200": { description: "challenge + difficulty" } },
      },
    },`,
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("powGate"), s.includes("UTIL_ROUTES_PAID"), s.includes("/pow/challenge"));
