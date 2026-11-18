// 给多链引擎加 5 条链（Monad/Celo/Sei/Ink/Arc）
import fs from "node:fs";

let s = fs.readFileSync("multi-chain.mjs", "utf8");
if (s.includes("monad")) { console.log("already"); process.exit(0); }

const extra = `  monad: { id: 143, native: "MON", rpcs: ["https://rpc.monad.xyz", "https://rpc1.monad.xyz"] },
  celo: { id: 42220, native: "CELO", rpcs: ["https://forno.celo.org", "https://celo-rpc.publicnode.com"] },
  sei: { id: 1329, native: "SEI", rpcs: ["https://evm-rpc.sei-apis.com", "https://sei-evm-rpc.publicnode.com"] },
  ink: { id: 57073, native: "ETH", rpcs: ["https://rpc.inkonchain.com", "https://ink-rpc.publicnode.com"] },
  arc: { id: 5042, native: "USDC", rpcs: ["https://rpc.arc.network"] },
`;

s = s.replace(
  "  linea: { id: 59144, native: \"ETH\", rpcs: [\"https://rpc.linea.build\", \"https://linea-rpc.publicnode.com\"] },\n};",
  "  linea: { id: 59144, native: \"ETH\", rpcs: [\"https://rpc.linea.build\", \"https://linea-rpc.publicnode.com\"] },\n" + extra + "};",
);

fs.writeFileSync("multi-chain.mjs", s, "utf8");
console.log("chains added:", s.includes("monad"), s.includes("celo"), s.includes("sei"), s.includes("ink"), s.includes("arc"));
