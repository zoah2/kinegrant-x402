// 加最强免费模型：gpt-oss-120b（Groq 免费层最强）
import fs from "node:fs";

// openai-compat.mjs
let s = fs.readFileSync("openai-compat.mjs", "utf8");
if (!s.includes('"gpt-oss-120b"')) {
  s = s.replace(
    '"gpt-oss-20b": "openai/gpt-oss-20b",',
    '"gpt-oss-20b": "openai/gpt-oss-20b",\n  "gpt-oss-120b": "openai/gpt-oss-120b",',
  );
  fs.writeFileSync("openai-compat.mjs", s, "utf8");
  console.log("openai-compat: gpt-oss-120b added");
}

// ai-proxy.mjs
let a = fs.readFileSync("ai-proxy.mjs", "utf8");
if (!a.includes('"gpt-oss-120b"')) {
  a = a.replace(
    '"gpt-oss-20b": "openai/gpt-oss-20b",',
    '"gpt-oss-20b": "openai/gpt-oss-20b",\n  "gpt-oss-120b": "openai/gpt-oss-120b",',
  );
  fs.writeFileSync("ai-proxy.mjs", a, "utf8");
  console.log("ai-proxy: gpt-oss-120b added");
}

// defillama 的 MODEL 保持 gpt-oss-20b（快）
console.log("done");
