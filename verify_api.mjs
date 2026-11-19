// BscScan API 源码验证（standard-json）
import fs from "node:fs";

const ADDR = "0xb72a19E2D79cD2A4d5FB0B9221Ff280d445189DE";
const standardJson = fs.readFileSync("contracts/standard-input.json", "utf8");

const body = new URLSearchParams({
  module: "contract",
  action: "verifysourcecode",
  apikey: "",
  contractaddress: ADDR,
  sourceCode: standardJson,
  codeformat: "solidity-standard-json-input",
  contractname: "contracts/KineGrantRegistry.sol:KineGrantRegistry",
  compilerversion: "v0.8.26+commit.8a97fa7a",
  constructorArguements: "",
});

const r = await fetch("https://api.bscscan.com/api", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: body.toString(),
});
const j = await r.json().catch(() => null);
console.log("status:", r.status);
console.log(JSON.stringify(j).slice(0, 500));
