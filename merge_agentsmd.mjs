// 部署 /agents.md（agent 引导页）
import fs from "node:fs";
let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes('"/agents.md"')) { console.log("already"); process.exit(0); }

// 加 fs import
if (!s.includes('import fs from "node:fs"')) {
  s = s.replace('import express from "express";', 'import fs from "node:fs";\nimport express from "express";');
}

// 加路由（在 /health 附近）
s = s.replace(
  'app.get("/health", (_req, res) => {',
  'app.get("/agents.md", (_req, res) => {\n  try {\n    const md = fs.readFileSync(new URL("./agents.md", import.meta.url), "utf8");\n    res.type("text/markdown").send(md);\n  } catch (e) {\n    res.status(500).type("text/plain").send("agents.md unavailable");\n  }\n});\n\napp.get("/health", (_req, res) => {',
);

fs.writeFileSync("app.mjs", s, "utf8");
console.log("merged:", s.includes('"/agents.md"'), s.includes('import fs from "node:fs"'));
