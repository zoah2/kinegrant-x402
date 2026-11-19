// 把部署页挂到 /deploy（手机可访问 https://api.kinegrant.com/deploy）
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (s.includes('"/deploy"')) { console.log("already"); process.exit(0); }

s = s.replace(
  'app.get("/agents.md", (_req, res) => {',
  'app.get("/deploy", (_req, res) => {\n  try {\n    res.type("text/html").send(fs.readFileSync(new URL("./deploy_page.html", import.meta.url), "utf8"));\n  } catch (e) {\n    res.status(500).type("text/plain").send("deploy page unavailable");\n  }\n});\n\napp.get("/agents.md", (_req, res) => {',
);
fs.writeFileSync("app.mjs", s, "utf8");
console.log("patched:", s.includes('"/deploy"'));
