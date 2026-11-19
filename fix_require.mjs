// ESM 里不能用 require：把 pow-tools2/3 的 require("node:crypto") 改成顶部 import
import fs from "node:fs";

for (const f of ["pow-tools2.mjs", "pow-tools3.mjs"]) {
  let s = fs.readFileSync(f, "utf8");
  const before = s;
  if (!s.includes('import crypto from "node:crypto"')) {
    s = 'import crypto from "node:crypto";\n' + s;
  }
  s = s.replace(/const \{ createHash \} = require\("node:crypto"\);/g, "");
  s = s.replace(/const \{ createHmac \} = require\("node:crypto"\);/g, "");
  s = s.replace(/const \{ randomBytes \} = require\("node:crypto"\);/g, "const randomBytes = crypto.randomBytes;");
  s = s.replace(/createHash\("sha256"\)/g, "crypto.createHash(\"sha256\")");
  s = s.replace(/createHmac\("sha1", key\)/g, "crypto.createHmac(\"sha1\", key)");
  fs.writeFileSync(f, s, "utf8");
  console.log(f, "patched:", s !== before, "require left:", s.includes("require("));
}
