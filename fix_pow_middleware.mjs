// 注册 powFreeMiddleware（之前只导入了 verifyPow，中间件没挂）
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes("app.use(powFreeMiddleware")) { console.log("already"); process.exit(0); }

s = s.replace(
  'import { FREE_PATHS, issueChallenge, verifyPow } from "./pow.mjs";',
  'import { FREE_PATHS, issueChallenge, verifyPow, powFreeMiddleware } from "./pow.mjs";',
);
s = s.replace(
  'const app = express();\napp.set("trust proxy", true);',
  'const app = express();\napp.set("trust proxy", true);\napp.use(powFreeMiddleware);',
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("patched:", s.includes("app.use(powFreeMiddleware"));
