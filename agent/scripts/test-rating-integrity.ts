// Adversarial check for security finding F1: fake events spammed into the (permissionless) MockEventRegistry
// must NOT raise the SIMULATED rating. Needs a fresh local deployment (see scripts/test-rating-integrity.sh).
//   NETWORK=local npx tsx scripts/test-rating-integrity.ts
import { keccak256, toHex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abis, clients, loadDeployment, machineIdOf, parseEther, simulatedRating } from "../src/lib.js";
import { Skim } from "../src/skim.js";

const ATTACKER_KEY = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"; // anvil dev key #5 (local only)

async function main() {
  const c = clients();
  if (c.p.name !== "local") throw new Error("local only");
  const d = loadDeployment();
  const s = new Skim(c, d, machineIdOf(d));
  for (let i = 0; i < 3; i++) await s.paySession(parseEther("0.1"), `real-${i}`);
  await s.processRevenue(); // keeper writes 3 legit trust-1 events citing router txs

  const { createWalletClient, http } = await import("viem");
  const atk = createWalletClient({ account: privateKeyToAccount(ATTACKER_KEY), chain: c.chain, transport: http(c.p.rpc) });
  const now = BigInt(Math.floor(Date.now() / 1000));
  for (let i = 0; i < 20; i++) {
    const trust = i % 2; // half trust-0, half trust-1 citing fake tx hashes
    const h = await atk.writeContract({
      address: d.contracts.eventRegistry as Address,
      abi: abis.eventRegistry,
      functionName: "submitEvent",
      args: [s.machineId, 0, 1_000_000n, "USD", now, trust, keccak256(toHex(`fake-${i}-${Date.now()}`)), ""],
    } as never);
    await c.pub.waitForTransactionReceipt({ hash: h });
  }
  const raw = Number(await c.pub.readContract({ address: d.contracts.eventRegistry, abi: abis.eventRegistry, functionName: "revenueEventCount", args: [s.machineId] }));
  const counted = await s.revenueEventCount();
  const before = simulatedRating(raw), after = simulatedRating(counted);
  console.log(`raw registry count=${raw} (grade if trusted: ${before.grade}, score ${before.score})`);
  console.log(`keeper-counted=${counted} (grade ${after.grade}, score ${after.score})`);
  if (raw !== 23 || counted !== 3) { console.log("FAIL"); process.exit(1); }
  console.log("PASS: 20 spoofed events ignored; only router-backed trust-1 events count");
}
main().catch((e) => { console.error(e); process.exit(1); });
