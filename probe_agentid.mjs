// 链上探测 Agent ID NFT：合约元信息 + tokenURI + owner
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const RPC = "https://bsc-dataseed1.binance.org";
const CONTRACT = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const TOKEN_ID = "70632380431696217506965022110235047726340297511615407330640013985333459458517";
const PROXY = "http://127.0.0.1:7897";

async function call(to, data) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json();
  return j.result;
}

function decString(hex) {
  if (!hex || hex === "0x") return null;
  const h = hex.replace(/^0x/, "");
  try {
    const len = parseInt(h.slice(64, 128), 16);
    return Buffer.from(h.slice(128, 128 + len * 2), "hex").toString("utf8");
  } catch { return null; }
}

const nameHex = await call(CONTRACT, "0x06fdde03");
const symHex = await call(CONTRACT, "0x95d89b41");
const uriHex = await call(CONTRACT, "0xc87b56dd" + BigInt(TOKEN_ID).toString(16).padStart(64, "0"));
const ownerHex = await call(CONTRACT, "0x6352211e" + BigInt(TOKEN_ID).toString(16).padStart(64, "0"));

console.log("contract:", CONTRACT);
console.log("name:", decString(nameHex));
console.log("symbol:", decString(symHex));
console.log("tokenURI:", decString(uriHex));
console.log("owner:", ownerHex && ownerHex !== "0x" ? "0x" + ownerHex.slice(-40) : null);
