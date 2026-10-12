// Fund (or sweep back) the separate simulated-customer wallet used for loan #2 on agung (judge gap C2-1).
// The customer key lives ONLY in agent/.env as CUSTOMER_PRIVATE_KEY; this script never prints it.
//
//   NETWORK=agung AMOUNT=0.85 npx tsx scripts/fund-customer.ts          # dry run: balances + gas estimate
//   NETWORK=agung AMOUNT=0.85 npx tsx scripts/fund-customer.ts --go     # deployer -> customer
//   NETWORK=agung npx tsx scripts/fund-customer.ts --sweep --go         # customer -> deployer (all but gas)
import { formatEther, parseEther } from "viem";
import { clients, log, txUrl } from "../src/lib.js";

async function main() {
  const c = clients();
  if (c.p.chainId !== 9990 && process.env.NETWORK !== "local") throw new Error(`refusing: chain ${c.p.chainId} is not agung (9990)`);
  const go = process.argv.includes("--go");
  const sweep = process.argv.includes("--sweep");
  const dep = c.wallet("deployer");
  const cus = c.wallet("customer");
  const a = dep.account.address;
  const b = cus.account.address;
  if (a.toLowerCase() === b.toLowerCase()) throw new Error("CUSTOMER_PRIVATE_KEY missing: customer == deployer");
  const [ba, bb, gp] = await Promise.all([c.pub.getBalance({ address: a }), c.pub.getBalance({ address: b }), c.pub.getGasPrice()]);
  log("fund", `deployer ${a} ${formatEther(ba)} ${c.p.nativeSymbol}`);
  log("fund", `customer ${b} ${formatEther(bb)} ${c.p.nativeSymbol}  gasPrice ${gp} wei`);
  const from = sweep ? cus : dep;
  const to = sweep ? a : b;
  const gas = await c.pub.estimateGas({ account: from.account, to, value: 1n });
  const fee = gas * gp * 2n;
  const value = sweep ? bb - fee : parseEther(process.env.AMOUNT ?? "0.85");
  if (value <= 0n) throw new Error("nothing to send");
  log("fund", `${sweep ? "sweep customer -> deployer" : "fund deployer -> customer"} ${formatEther(value)} ${c.p.nativeSymbol}, est gas ${gas} (fee ≤ ${formatEther(fee)})`);
  if (!go) return log("fund", "dry run (add --go to send)");
  const hash = await from.sendTransaction({ to, value, gas, gasPrice: gp } as never);
  const r = await c.pub.waitForTransactionReceipt({ hash });
  log("fund", `status ${r.status} block ${r.blockNumber}  ${txUrl(c.p, hash)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
