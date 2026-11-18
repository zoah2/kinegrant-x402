// 修复：4byte/archive/upcitemdb 直连不通 → selector 用本地字典，删 wayback/barcode
import fs from "node:fs";

let s = fs.readFileSync("extended-tools.mjs", "utf8");

// 1. 删掉 wayback 和 barcode 两个端点（不可达数据源）
s = s.replace(/\n  \/\/ Wayback 快照[\s\S]*?\n  \},/, "\n");
s = s.replace(/\n  \/\/ 条码查询（UPCitemdb 免费）[\s\S]*?\n  \},/, "\n");

// 2. selector 改本地字典
const dict = `
const SELECTORS = {
  "0xa9059cbb": "transfer(address,uint256)",
  "0x095ea7b3": "approve(address,uint256)",
  "0x23b872dd": "transferFrom(address,address,uint256)",
  "0x70a08231": "balanceOf(address)",
  "0xdd62ed3e": "allowance(address,address)",
  "0x18160ddd": "totalSupply()",
  "0x06fdde03": "name()",
  "0x95d89b41": "symbol()",
  "0x313ce567": "decimals()",
  "0x8da5cb5b": "owner()",
  "0x715018a6": "renounceOwnership()",
  "0xf2fde38b": "transferOwnership(address)",
  "0x5c19a95c": "delegate(address)",
  "0x2e1a7d4d": "withdraw(uint256)",
  "0xd0e30db0": "deposit()",
  "0x38ed1739": "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
  "0x7ff36ab5": "swapExactETHForTokens(uint256,address[],address,uint256)",
  "0xfb3bdb41": "swapETHForExactTokens(uint256,address[],address,uint256)",
  "0x18cbafe5": "swapExactTokensForETH(uint256,uint256,address[],address,uint256)",
  "0x8803dbee": "swapTokensForExactTokens(uint256,uint256,address[],address,uint256)",
  "0x5c11d795": "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
  "0x791ac947": "swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
  "0x4a25d94a": "swapTokensForExactETH(uint256,uint256,address[],address,uint256)",
  "0xa22cb465": "setApprovalForAll(address,bool)",
  "0x42842e0e": "safeTransferFrom(address,address,uint256)",
  "0xb88d4fde": "safeTransferFrom(address,address,uint256,bytes)",
  "0x6352211e": "ownerOf(uint256)",
  "0x0dfe1681": "token0()",
  "0xd21220a7": "token1()",
  "0x0902f1ac": "getReserves()",
  "0xe6a43905": "getPair(address,address)",
  "0xc87b56dd": "tokenURI(uint256)",
  "0xbf92857c": "getUserAccountData(address)",
  "0x1cff79cd": "execute(address,bytes)",
  "0x23e30c8b": "execute(bytes,bytes[],uint256)",
  "0x8c5be1e5": "Approval(address,address,uint256) EVENT",
  "0xddf252ad": "Transfer(address,address,uint256) EVENT",
  "0x1c411e9a": "Sync(uint112,uint112) EVENT",
  "0x0d3648bd": "PairCreated(address,address,address,uint256) EVENT",
  "0x3e4a4b97": "swapExactTokensForAVAX(uint256,uint256,address[],address,uint256)",
  "0x9b521434": "addLiquidityETH(address,uint256,uint256,uint256,address,uint256)",
};
`;

// 在 getJson 定义前插入字典
s = s.replace("async function getJson(", dict + "\nasync function getJson(");

// 3. selector handler 改字典
s = s.replace(
  /const j = await getJson\("https:\/\/api\.4byte\.directory\/api\/v1\/signatures\/\?hex_signature=" \+ h\);\s*res\.json\(\{ selector: h, signatures: \(j\.results \|\| \[\]\)\.map\(\(r\) => r\.text\)\.slice\(0, 10\), asOf: new Date\(\)\.toISOString\(\) \}\);/,
  `const sig = SELECTORS[h] || null;\n      res.json({ selector: h, signature: sig, known: !!sig, asOf: new Date().toISOString() });`,
);

fs.writeFileSync("extended-tools.mjs", s, "utf8");
console.log("wayback removed:", !s.includes("/wayback"));
console.log("barcode removed:", !s.includes("/barcode"));
console.log("selector dict:", s.includes("SELECTORS"));
