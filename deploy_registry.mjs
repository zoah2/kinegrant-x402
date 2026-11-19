// 部署 KineGrantRegistry 到 BSC（私钥只从本机环境变量读，不写入任何文件）
// 用法：PRIVATE_KEY=0x... node deploy_registry.mjs
import { ethers } from "ethers";
import fs from "node:fs";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("缺少 PRIVATE_KEY 环境变量。用法：PRIVATE_KEY=0x... node deploy_registry.mjs");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
console.log("deployer:", wallet.address);
const bal = await provider.getBalance(wallet.address);
console.log("balance:", ethers.formatEther(bal), "BNB");
if (bal < ethers.parseEther("0.003")) {
  console.error("余额不足 0.003 BNB，部署需要约 0.002-0.003 BNB gas");
  process.exit(1);
}

const abi = JSON.parse(fs.readFileSync("contracts/build/contracts_KineGrantRegistry_sol_KineGrantRegistry.abi", "utf8"));
const bytecode = "0x" + fs.readFileSync("contracts/build/contracts_KineGrantRegistry_sol_KineGrantRegistry.bin", "utf8").trim();

const factory = new ethers.ContractFactory(abi, bytecode, wallet);
console.log("deploying...");
const contract = await factory.deploy({ gasLimit: 800000 });
await contract.waitForDeployment();
const addr = await contract.getAddress();
console.log("DEPLOYED:", addr);
console.log("BscScan:", "https://bscscan.com/address/" + addr);
fs.writeFileSync("registry_address.txt", addr, "utf8");

// 自测：记录一次调用 + 读回
const tx = await contract.record(ethers.id("/verdict"), 10000000000000000n, { gasLimit: 100000 });
await tx.wait();
const s = await contract.stats(ethers.id("/verdict"));
console.log("test record ok: calls=" + s.calls.toString() + " volume=" + s.volume.toString());
