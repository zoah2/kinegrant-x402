// powGate 与 powFreeMiddleware 重复消耗 PoW：powGate 先看 req.powBypass
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
const before = s;
s = s.replace(
  '  if (!FREE_PATHS.has(p)) return next();\n  if (verifyPow(req.headers["x-pow"]).ok) return next();',
  '  if (!FREE_PATHS.has(p)) return next();\n  if (req.powBypass) return next();\n  if (verifyPow(req.headers["x-pow"]).ok) return next();',
);
fs.writeFileSync("app.mjs", s, "utf8");
console.log("patched:", s !== before);
