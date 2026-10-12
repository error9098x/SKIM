import { createPublicClient, http, formatEther, decodeFunctionData, parseAbi } from "viem";
import fs from "node:fs";
const pub = createPublicClient({ transport: http("https://peaq-agung.api.onfinality.io/public") });
const W = ["0x285a7ad23cdc47b11eefd1bb9a4905a120dc066e","0x0c9aa6ea0e037f33225a3d1110790867f841e39d"];
const names = {"0xa97b3c4f7cf5468db2507c5769ad973e02f33d20":"SkimVault","0xed420fd5ea0df60d2f873f13e34b4f5edbb99237":"RevenueRouter","0x90dd1c0c498243425de0b93b6c7aa79bde15b793":"MCROracle","0xb91b34b2a0e16fe3d0889edbc2f1a82d088c51e1":"MockEventRegistry","0x538da35489b1f0035799a8351e67835ae4abb377":"MachineRegistry"};
const abi = parseAbi(["function pay(uint256,address,bytes32)","function openLoan(uint256,address,uint64)","function approve(address,uint256)","function post(uint256,uint8,uint8,bool)","function submitEvent(uint256,uint8,uint256,string,uint64,uint8,bytes32,string)","function withdrawLiquidity(address,uint256)"]);
const from = 11138236n, to = await pub.getBlockNumber();
const out = [];
const blocks = [];
for (let b = from; b <= to; b++) blocks.push(b);
for (let i = 0; i < blocks.length; i += 25) {
  const bs = await Promise.all(blocks.slice(i, i + 25).map((b) => pub.getBlock({ blockNumber: b, includeTransactions: true })));
  for (const blk of bs) for (const tx of blk.transactions) {
    if (!W.includes(tx.from.toLowerCase())) continue;
    let fn = "transfer"; let args;
    try { const d = decodeFunctionData({ abi, data: tx.input }); fn = d.functionName; args = d.args; } catch {}
    const r = await pub.getTransactionReceipt({ hash: tx.hash });
    out.push({ block: Number(blk.number), nonce: tx.nonce, from: tx.from, to: tx.to, contract: names[tx.to?.toLowerCase()] ?? tx.to, fn, value: formatEther(tx.value), status: r.status, hash: tx.hash,
      args: args ? JSON.stringify(args, (k, v) => typeof v === "bigint" ? v.toString() : v).slice(0, 200) : undefined });
  }
}
fs.writeFileSync(process.argv[2], JSON.stringify({ scannedBlocks: [Number(from), Number(to)], txs: out }, null, 2));
for (const t of out) console.log(t.block, t.from.slice(0,6), t.nonce, t.contract, t.fn, t.value, t.status, t.hash);
