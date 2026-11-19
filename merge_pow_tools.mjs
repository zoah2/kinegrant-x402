// 合并 100 个 PoW 免费工具
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("POW_TOOLS1")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { FREE_PATHS, issueChallenge, verifyPow } from "./pow.mjs";',
  'import { FREE_PATHS, issueChallenge, verifyPow } from "./pow.mjs";\nimport { POW_TOOLS1 } from "./pow-tools1.mjs";\nimport { POW_TOOLS2 } from "./pow-tools2.mjs";',
);

// 扩展 FREE_PATHS 并注册 handler（在 /pow/challenge 路由后）
s = s.replace(
  'app.get("/pow/challenge", (_req, res) => res.json(issueChallenge()));',
  `app.get("/pow/challenge", (_req, res) => res.json(issueChallenge()));

// 100 个 PoW 免费工具
const ALL_POW_TOOLS = [...POW_TOOLS1, ...POW_TOOLS2];
for (const t of ALL_POW_TOOLS) FREE_PATHS.add(t.path);
for (const t of ALL_POW_TOOLS) {
  app.get(t.path, (req, res) => {
    if (!verifyPow(req.headers["x-pow"]).ok) {
      return res.status(402).json({ error: "pow_required", hint: "GET /pow/challenge then retry with X-PoW: challenge:nonce" });
    }
    try {
      res.json(t.handler(req.query || {}));
    } catch (e) {
      res.status(400).json({ error: "bad_input", message: String(e.message).slice(0, 200) });
    }
  });
}`,
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes("POW_TOOLS1"), s.includes("ALL_POW_TOOLS"));
