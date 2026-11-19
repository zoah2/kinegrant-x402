// 验证合约部署状态 + 准备 BscScan 验证参数
import fs from "node:fs";

const ADDR = "0xdB459f174DC156ad09d798828181E96f9d8Be335";
const RPC = "https://bsc-dataseed1.binance.org";

const code = await (await fetch(RPC, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [ADDR, "latest"] }),
})).json();
console.log("code length:", (code.result || "").length);
console.log("is contract:", code.result && code.result !== "0x");

const tx = await (await fetch(RPC, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_getTransactionReceipt", params: [ADDR] }),
})).json();
console.log("receipt:", tx.result ? "found" : "none (it's an address, expected)");

// 读合约状态（totalCalls）
const data = await (await fetch(RPC, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "eth_call", params: [{ to: ADDR, data: "0x60fe47b1" }, "latest"] }),
})).json();
console.log("totalCalls raw:", (data.result || "").slice(0, 66));

// 准备 standard-json（BscScan 验证用）
const source = fs.readFileSync("contracts/KineGrantRegistry.sol", "utf8");
const standardJson = {
  language: "Solidity",
  sources: { "contracts/KineGrantRegistry.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode"] } },
  },
};
fs.writeFileSync("contracts/standard-input.json", JSON.stringify(standardJson, null, 2), "utf8");
console.log("standard-input.json written (compiler 0.8.26)");
