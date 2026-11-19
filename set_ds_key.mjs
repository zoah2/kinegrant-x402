// 把 DEEPSEEK_API_KEY 写入启动脚本
import fs from "node:fs";

const KEY = fs.readFileSync("ds_api_key.txt", "utf8").trim();

let bat = fs.readFileSync("kine-signal.bat", "utf8");
if (!bat.includes("DEEPSEEK_API_KEY")) {
  bat = bat.replace("set GROQ_API_KEY=", "set GROQ_API_KEY=");
  // 在 GROQ 行之后加 DS 行
  bat = bat.replace(/(set GROQ_API_KEY=.+)/, "$1\nset DEEPSEEK_API_KEY=" + KEY);
  fs.writeFileSync("kine-signal.bat", bat, "utf8");
  console.log("bat patched:", bat.includes("DEEPSEEK_API_KEY"));
}

let ps1 = fs.readFileSync("start_all.ps1", "utf8");
if (!ps1.includes("DEEPSEEK_API_KEY")) {
  ps1 = ps1.replace(
    /\$env:GROQ_API_KEY = ".+"/,
    '$env:GROQ_API_KEY = "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"\n$env:DEEPSEEK_API_KEY = "' + KEY + '"',
  );
  fs.writeFileSync("start_all.ps1", ps1, "utf8");
  console.log("ps1 patched:", ps1.includes("DEEPSEEK_API_KEY"));
}
console.log("key prefix:", KEY.slice(0, 8));
