// 给每个付费端点加 Base 网络（eip155:8453 + USDC）收款选项（v2：允许注释行）
import fs from "node:fs";

let s = fs.readFileSync("app.mjs", "utf8");

if (!s.includes("BASE_NETWORK")) {
  s = s.replace(
    'const NETWORK = "eip155:56";',
    'const NETWORK = "eip155:56";\nconst BASE_NETWORK = "eip155:8453";\nconst BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";',
  );
}

// 匹配：price 行（可带注释）→ network → payTo → extra → }],
const re =
  /(price: \{ amount: "(\d+)", asset: USDT \},[^\n]*\n\s+network: NETWORK,\n\s+payTo: PAY_TO,\n\s+extra: \{ assetTransferMethod: "permit2", name: "USDT", version: "1", decimals: 18 \},\n\s+\}\])/g;

let count = 0;
s = s.replace(re, (m, whole, amount) => {
  count += 1;
  return (
    whole +
    `,\n        {\n          scheme: "exact",\n          price: { amount: "${amount}", asset: BASE_USDC },\n          network: BASE_NETWORK,\n          payTo: PAY_TO,\n          extra: { name: "USD Coin", version: "2" },\n        }]`
  );
});

fs.writeFileSync("app.mjs", s, "utf8");
console.log("routes patched:", count);
