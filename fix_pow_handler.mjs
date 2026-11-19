// 修复：PoW 中间件已消耗 challenge，handler 不应再验证（改查 req.powBypass）
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
const before = s;
s = s.replace(
  'if (!verifyPow(req.headers["x-pow"]).ok) {\n      return res.status(402).json({ error: "pow_required", hint: "GET /pow/challenge then retry with X-PoW: challenge:nonce" });\n    }',
  'if (!req.powBypass) {\n      return res.status(402).json({ error: "pow_required", hint: "GET /pow/challenge then retry with X-PoW: challenge:nonce" });\n    }',
);
fs.writeFileSync("app.mjs", s, "utf8");
console.log("patched:", s !== before);
