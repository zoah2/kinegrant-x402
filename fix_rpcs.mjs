// 替换需要 API key 的 ankr RPC 为 publicnode 等公共节点
import fs from "node:fs";

let mc = fs.readFileSync("multi-chain.mjs", "utf8");
mc = mc.replace(
  /const CHAINS = \{[\s\S]*?\n\};/,
  `const CHAINS = {
  bsc: { id: 56, native: "BNB", rpcs: ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org", "https://bsc-rpc.publicnode.com"] },
  base: { id: 8453, native: "ETH", rpcs: ["https://mainnet.base.org", "https://base.llamarpc.com", "https://base-rpc.publicnode.com"] },
  ethereum: { id: 1, native: "ETH", rpcs: ["https://eth.llamarpc.com", "https://ethereum-rpc.publicnode.com", "https://1rpc.io/eth"] },
  arbitrum: { id: 42161, native: "ETH", rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-rpc.publicnode.com"] },
  optimism: { id: 10, native: "ETH", rpcs: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"] },
  polygon: { id: 137, native: "POL", rpcs: ["https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com"] },
  avalanche: { id: 43114, native: "AVAX", rpcs: ["https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain-rpc.publicnode.com"] },
  linea: { id: 59144, native: "ETH", rpcs: ["https://rpc.linea.build", "https://linea-rpc.publicnode.com"] },
};`,
);
fs.writeFileSync("multi-chain.mjs", mc, "utf8");

for (const f of ["extra-endpoints.mjs", "extra-endpoints2.mjs", "app.mjs"]) {
  let s = fs.readFileSync(f, "utf8");
  const before = s;
  s = s.replace(/"https:\/\/rpc\.ankr\.com\/bsc",?/g, '"https://bsc-rpc.publicnode.com",');
  s = s.replace(/"https:\/\/rpc\.ankr\.com\/eth",?/g, '"https://ethereum-rpc.publicnode.com",');
  if (s !== before) fs.writeFileSync(f, s, "utf8");
  console.log(f, "patched:", s !== before);
}

// 验证语法
console.log("multi-chain chains:", (mc.match(/rpcs: \[/g) || []).length);
