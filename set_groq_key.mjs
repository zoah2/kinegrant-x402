// 把 GROQ_API_KEY 写入启动脚本（kine-signal.bat + start_all.ps1）
import fs from "node:fs";

const KEY = "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";

// 1. kine-signal.bat：在 NODE_USE_ENV_PROXY 之后加 set
let bat = fs.readFileSync("kine-signal.bat", "utf8");
if (!bat.includes("GROQ_API_KEY")) {
  bat = bat.replace(
    "set NODE_USE_ENV_PROXY=1",
    "set NODE_USE_ENV_PROXY=1\nset GROQ_API_KEY=" + KEY,
  );
  fs.writeFileSync("kine-signal.bat", bat, "utf8");
  console.log("bat patched");
}

// 2. start_all.ps1：同样加环境变量
let ps1 = fs.readFileSync("start_all.ps1", "utf8");
if (!ps1.includes("GROQ_API_KEY")) {
  ps1 = ps1.replace(
    '$env:USERPROFILE = "C:\\Users\\zoah\\Documents\\1\\x402-service\\cfhome"',
    '$env:USERPROFILE = "C:\\Users\\zoah\\Documents\\1\\x402-service\\cfhome"\n$env:GROQ_API_KEY = "' + KEY + '"',
  );
  fs.writeFileSync("start_all.ps1", ps1, "utf8");
  console.log("ps1 patched");
}

console.log("done");
