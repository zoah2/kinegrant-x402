// 生成手机部署页 v2：强制 BSC(56) 切链 + 部署
import fs from "node:fs";

const abi = fs.readFileSync("contracts/build/contracts_KineGrantRegistry_sol_KineGrantRegistry.abi", "utf8").trim();
const bytecode = "0x" + fs.readFileSync("contracts/build/contracts_KineGrantRegistry_sol_KineGrantRegistry.bin", "utf8").trim();

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deploy KineGrantRegistry on BSC</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#0b0e14;color:#e6e6e6}
h1{font-size:20px;margin-bottom:8px}
p{color:#8a94a6;font-size:13px;line-height:1.6}
button{width:100%;padding:14px;margin:8px 0;border:0;border-radius:10px;font-size:16px;font-weight:600;color:#fff;background:#1e6fff}
button:disabled{background:#2a3140;color:#5a6478}
pre{background:#11151d;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-all;min-height:60px;color:#7ee787}
.warn{color:#f0883e}
</style>
</head>
<body>
<h1>KineGrantRegistry → BSC</h1>
<p>在币安 App 的 DApp 浏览器里打开本页。点「连接钱包」→ 自动切到 BNB Chain →「部署合约」。</p>
<button id="connect">① 连接钱包</button>
<button id="deploy" disabled>② 部署合约（BSC 56）</button>
<pre id="log">等待操作…</pre>
<script src="https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js"></script>
<script>
const ABI = ${abi};
const BYTECODE = "${bytecode}";
const BSC = "0x38";
const log = (m) => { document.getElementById('log').textContent = m; };
let provider, signer;

async function ensureBsc() {
  const cur = await window.ethereum.request({ method: "eth_chainId" });
  if (cur === BSC) return true;
  log("当前链 " + cur + "，正在切换到 BNB Chain…");
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC }] });
    return true;
  } catch (e) {
    if (e.code === 4902 || /Unrecognized chain/i.test(e.message || "")) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: BSC, chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed1.binance.org"], blockExplorerUrls: ["https://bscscan.com"] }],
      });
      return true;
    }
    throw e;
  }
}

document.getElementById('connect').onclick = async () => {
  try {
    if (!window.ethereum) { log("未检测到钱包。请在币安 App 的 DApp 浏览器中打开本页。"); return; }
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    await ensureBsc();
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const addr = await signer.getAddress();
    const net = await provider.getNetwork();
    log("已连接：" + addr + "\\n链 ID：" + net.chainId + (net.chainId === 56n ? " ✅ BSC" : " ❌ 不是 BSC"));
    document.getElementById('deploy').disabled = net.chainId !== 56n;
  } catch (e) { log("连接失败：" + (e.message || e)); }
};

document.getElementById('deploy').onclick = async () => {
  try {
    document.getElementById('deploy').disabled = true;
    await ensureBsc();
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const net = await provider.getNetwork();
    if (net.chainId !== 56n) { log("仍在链 " + net.chainId + "，请手动切到 BNB Chain 后重试"); document.getElementById('deploy').disabled = false; return; }
    log("部署中（约 0.002 BNB gas）…");
    const factory = new ethers.ContractFactory(ABI, BYTECODE, signer);
    const c = await factory.deploy({ gasLimit: 800000 });
    log("交易已发出：" + c.deploymentTransaction().hash + "\\n等待确认…");
    await c.waitForDeployment();
    const addr = await c.getAddress();
    log("✅ 部署成功（BSC）！\\n合约地址：" + addr + "\\n\\nhttps://bscscan.com/address/" + addr + "\\n\\n把这个地址发回对话。");
    window.__REGISTRY = addr;
  } catch (e) { log("部署失败：" + (e.message || e)); document.getElementById('deploy').disabled = false; }
};
</script>
</body>
</html>`;

fs.writeFileSync("deploy_page.html", html, "utf8");
console.log("deploy_page.html v2 written", html.length, "bytes");
