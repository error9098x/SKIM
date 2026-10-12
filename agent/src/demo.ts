// One-shot scripted SKIM demo: rating -> terms -> escrow + advance -> skimmed revenue -> payoff -> NFT back -> better rating.
// Runs keeper steps in-process after every session so the whole loop is visible in one terminal.
//
//   NETWORK=local npm run demo
// Env: DEMO_SESSION_VALUE (default 0.5), DEMO_MAX_SESSIONS (default 60), LOAN_TERM_SECONDS (default 30 days),
//      DEMO_DELAY_MS (pause between sessions, default 0), DEMO_INITIAL_RATING="score,grade" to post a specific
//      simulated rating first (default: derived/Provisioned).
import { clients, fmt, GRADES, loadDeployment, log, machineIdOf, parseEther, sleep } from "./lib.js";
import { Skim } from "./skim.js";

async function main() {
  const c = clients();
  const d = loadDeployment();
  const s = new Skim(c, d, machineIdOf(d));
  const sym = c.p.nativeSymbol;
  const value = parseEther(process.env.DEMO_SESSION_VALUE ?? "0.5");
  const maxSessions = Number(process.env.DEMO_MAX_SESSIONS ?? 60);
  const term = BigInt(process.env.LOAN_TERM_SECONDS ?? 30 * 24 * 3600);
  const delay = Number(process.env.DEMO_DELAY_MS ?? 0);

  log("demo", `=== SKIM demo on ${d.network}${d.simulated ? " (SIMULATED rating + event registry)" : ""} ===`);
  await s.printStatus("demo");

  // 1. rating -> terms
  log("demo", "--- step 1: keeper posts the machine's credit rating ---");
  if (process.env.DEMO_INITIAL_RATING) {
    const [score, grade] = process.env.DEMO_INITIAL_RATING.split(",").map(Number);
    await s.postRating(score, grade, d.simulated);
  } else {
    await s.refreshRating(true);
  }
  const q = await s.quote();
  log("demo", `terms for ${GRADES[q.grade]}: principal ${fmt(q.principal, sym)}, fee ${q.feeBps / 100}%, skim ${q.skimBps / 100}%`);

  // 2. escrow + advance
  log("demo", "--- step 2: operator escrows the Machine NFT and takes the advance ---");
  const existing = await s.loan();
  if (existing.status === 1) log("demo", "loan already active; continuing to repay it");
  else await s.openLoan(term);
  await s.printStatus("demo");

  // 3. revenue sessions until repaid
  log("demo", "--- step 3: EV charging sessions pay through the RevenueRouter ---");
  let n = 0;
  while ((await s.loan()).status === 1 && n < maxSessions) {
    const r = await s.paySession(value, `demo-${n}`);
    n++;
    const l = await s.loan();
    log("demo", `session #${n}: ${fmt(value, sym)} -> skim ${fmt(r.skimmed, sym)} | machine ${fmt(r.forwarded, sym)} | repaid ${fmt(l.repaid, sym)}/${fmt(l.owed, sym)}`);
    await s.processRevenue(); // keeper: trust-1 revenue event citing this router tx
    if (delay) await sleep(delay);
  }
  const l = await s.loan();
  if (l.status !== 2) throw new Error(`loan not repaid after ${n} sessions (status ${l.status}); raise DEMO_MAX_SESSIONS`);

  // 4. payoff
  log("demo", "--- step 4: loan repaid, NFT returned ---");
  const owner = await s.nftOwner();
  log("demo", `NFT owner is now ${owner} (operator ${c.wallet("operator").account.address}) -> ${owner.toLowerCase() === c.wallet("operator").account.address.toLowerCase() ? "RETURNED ✔" : "NOT RETURNED ✘"}`);

  // 5. rating loop: repayment history -> better terms
  log("demo", "--- step 5: verified revenue feeds the rating, which unlocks better terms ---");
  const cnt = await s.revenueEventCount();
  if (cnt >= 0) log("demo", `MockEventRegistry holds ${cnt} trust-1 revenue events for this machine`);
  await s.refreshRating();
  const q2 = await s.quote();
  log("demo", `new terms for ${GRADES[q2.grade]}: principal ${fmt(q2.principal, sym)}, fee ${q2.feeBps / 100}%, skim ${q2.skimBps / 100}%`);
  await s.printStatus("demo");
  log("demo", `=== done in ${n} sessions ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
