// 简单静态服务器：deploy_page.html on :8080
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
http.createServer((req, res) => {
  const name = req.url === "/" ? "deploy_page.html" : decodeURIComponent(req.url.slice(1));
  const f = path.join(root, name);
  try {
    const b = fs.readFileSync(f);
    res.writeHead(200, { "content-type": name.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(8080, "0.0.0.0", () => console.log("serving deploy page on :8080"));
