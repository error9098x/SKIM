// One-command, idempotent SKIM launcher for peaq agung testnet.
//
//   npm run agung:launch              # DRY RUN (default): reads chain state, prints the plan + cost, sends nothing
//   npm run agung:launch -- --go      # executes only the steps that are still missing
//
// Steps (each skipped when already done on-chain):
//   1 activate  peaqOS SDK activateMachine (0.4 AGNG bond)   skip if MachineRegistry.ownerOf(machineId) exists
//   2 deploy    oracle/vault/router/mock registry + seed       skip if deployments/agung.json has code at the vault
//                                                             and is bound to the real MachineRegistry
//   3 rate      keeper posts the first (SIMULATED) rating      skip if the oracle already has a rating
//   4 loan      approve + openLoan (NFT escrow, advance)       skip if a loan is active or already repaid (REOPEN=1 forces)
//   5 run       keeper + EV simulator until repaid             skip if no loan is active
//   6 publish   web/scripts/sync.mjs -> web/public/deployments/agung.json
//
// Guards: chain id must be 9990; refuses to send if balance < estimated need; BUDGET (AGNG, default 2.5) caps the plan.
// Never prints private keys (reads them only through src/lib.ts).
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatEther, parseEther, type Address } from "viem";
import { abis, accountFor, clients, computeMachineId, DEPLOYMENTS_DIR, machineFilePath } from "../src/lib.js";
import { MACHINE_REGISTRY } from "../src/peaq.js";

process.env.NETWORK = "agung";
const GO = process.argv.includes("--go");
const BUDGET = parseEther(process.env.BUDGET ?? "2.5");
const BOND = parseEther("0.4");
const SEED = parseEther(process.env.SEED_LIQUIDITY ?? "0.5");
const GAS_PAD = parseEther("0.01"); // gas on agung is ~1e-8 AGNG per run at 1024 wei; generous pad
const here = join(DEPLOYMENTS_DIR, "..", "agent");
const run = (cmd: string, extra: Record<string, string> = {}) =>
  execSync(cmd, { cwd: here, stdio: "inherit", env: { ...process.env, NETWORK: "agung", ...extra } });

async function main() {
  const c = clients();
  const chainId = await c.pub.getChainId();
  if (chainId !== 9990) throw new Error(`expected agung chain 9990, RPC returned ${chainId}`);
  const me = accountFor("operator").address;
  const bal = await c.pub.getBalance({ address: me });
  const reg = MACHINE_REGISTRY.agung;
  const machineType = process.env.MACHINE_TYPE ?? "EVCharger";
  const serial = process.env.MACHINE_SERIAL ?? "skim-ev-charger-001";
  const { toHex } = await import("viem");
  const id = existsSync(machineFilePath("agung"))
    ? BigInt(JSON.parse(readFileSync(machineFilePath("agung"), "utf8")).machineId)
    : computeMachineId(machineType, toHex(serial));

  const owner = (await c.pub
    .readContract({ address: reg, abi: abis.machineNft, functionName: "ownerOf", args: [id] })
    .catch(() => null)) as Address | null;
  const depPath = join(DEPLOYMENTS_DIR, "agung.json");
  const dep = existsSync(depPath) ? JSON.parse(readFileSync(depPath, "utf8")) : null;
  const vaultCode = dep ? await c.pub.getCode({ address: dep.contracts.vault }) : undefined;
  const deployed = !!dep && !!vaultCode && vaultCode !== "0x" && dep.contracts.machineNft.toLowerCase() === reg.toLowerCase() && dep.machineId === id.toString();
  const rating = deployed
    ? ((await c.pub.readContract({ address: dep.contracts.oracle, abi: abis.oracle, functionName: "getRating", args: [id] })) as { updatedAt: bigint })
    : null;
  const loan = deployed
    ? ((await c.pub.readContract({ address: dep.contracts.vault, abi: abis.vault, functionName: "getLoan", args: [id] })) as { status: number; owed: bigint; repaid: bigint })
    : null;
  const vaultBal = deployed ? await c.pub.getBalance({ address: dep.contracts.vault }) : 0n;
  const reopen = process.env.REOPEN === "1";

  const steps: { name: string; todo: boolean; cost: bigint; why: string }[] = [
    { name: "1 activate", todo: !owner, cost: BOND, why: owner ? `machine ${String(id).slice(0, 8)}… exists, owner ${owner}` : `activate machine ${String(id).slice(0, 8)}… (bond 0.4)` },
    { name: "2 deploy", todo: !deployed, cost: SEED, why: deployed ? `vault ${dep.contracts.vault} live, ${formatEther(vaultBal)} AGNG liquidity` : `deploy 4 contracts + seed ${formatEther(SEED)} AGNG` },
    { name: "3 rate", todo: !rating || rating.updatedAt === 0n, cost: 0n, why: rating && rating.updatedAt > 0n ? "rating already posted" : "post first SIMULATED rating" },
    { name: "4 loan", todo: !loan || loan.status === 0 || (loan.status === 2 && reopen), cost: 0n, why: loan ? `loan status ${["none", "active", "repaid", "defaulted"][loan.status]}${loan.status === 2 && !reopen ? " (REOPEN=1 to borrow again)" : ""}` : "open loan (advance comes back to wallet)" },
  ];
  const willHaveActive = (loan?.status === 1) || steps[3].todo;
  steps.push({ name: "5 run", todo: willHaveActive, cost: 0n, why: willHaveActive ? "keeper + simulator until repaid (sessions loop back to this wallet; fee ≈10% of principal)" : "no active loan" });
  steps.push({ name: "6 publish", todo: true, cost: 0n, why: "sync deployments/agung.json -> web/public/deployments" });

  const need = steps.filter((s) => s.todo).reduce((a, s) => a + s.cost, 0n) + GAS_PAD;
  console.log(`SKIM agung launcher  mode=${GO ? "GO (sends txs)" : "DRY RUN (sends nothing)"}`);
  console.log(`wallet ${me}  balance ${formatEther(bal)} AGNG  budget ${formatEther(BUDGET)} AGNG  estimated need ${formatEther(need)} AGNG`);
  for (const s of steps) console.log(`  [${s.todo ? "TODO" : "done"}] ${s.name.padEnd(11)} ${s.why}`);
  if (need > BUDGET) throw new Error(`estimated need ${formatEther(need)} > BUDGET ${formatEther(BUDGET)}; aborting`);
  if (need > bal) {
    console.log(`balance too low (${formatEther(bal)} < ${formatEther(need)}): fund ${me} first`);
    if (GO) process.exit(2);
  }
  if (!GO) {
    if (steps[0].todo) run("npx tsx scripts/activate.ts", { ACTIVATE_MODE: "sdk", ACTIVATE_DRY_RUN: "1" });
    console.log("dry run complete. Re-run with --go to execute the TODO steps.");
    return;
  }
  if (steps[0].todo) run("npx tsx scripts/activate.ts", { ACTIVATE_MODE: "sdk" });
  if (steps[1].todo) run("npx tsx scripts/deploy.ts");
  if (steps[2].todo) run("npx tsx src/keeper.ts", { KEEPER_ONCE: "1" });
  if (steps[3].todo) run("npx tsx scripts/open-loan.ts");
  if (steps[4].todo) {
    // keeper in the background for the simulator's lifetime, then one final pass
    run(`(KEEPER_POLL=5 RATING_POLL=30 timeout 900 npx tsx src/keeper.ts > /tmp/skim-agung-keeper.log 2>&1 &) ; STOP_WHEN_REPAID=1 npx tsx src/simulator.ts ; sleep 20 ; pkill -f "tsx src/[k]eeper" || true ; KEEPER_ONCE=1 npx tsx src/keeper.ts`);
  }
  run("node ../web/scripts/sync.mjs");
  console.log("published web/public/deployments/agung.json");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
