import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");
if (!s.includes("const WBNB")) {
  s = s.replace(
    'const USDT = "0x55d398326f99059fF775485246999027B3197955";',
    'const USDT = "0x55d398326f99059fF775485246999027B3197955";\nconst WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";',
  );
  fs.writeFileSync("app.mjs", s, "utf8");
  console.log("WBNB added");
} else {
  console.log("already there");
}
