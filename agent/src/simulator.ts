// EV-charger simulator: every SESSION_INTERVAL seconds a customer pays router.pay for one charging session.
//
//   NETWORK=local SESSION_VALUE=0.2 SESSION_INTERVAL=3 npm run simulator
// Env: SESSION_VALUE (native tokens per session), SESSION_INTERVAL (s), MAX_SESSIONS (0 = forever),
//      STOP_WHEN_REPAID=1 (stop once the active loan closes). On mainnet keep each session >= $10 so the MCR counts it.
import { amountLabel, clients, fmt, loadDeployment, log, machineIdOf, parseEther, peaqUsd, sleep, txUrl, weiToUsdCents } from "./lib.js";
import { Skim } from "./skim.js";

async function main() {
  const c = clients();
  const d = loadDeployment();
  const s = new Skim(c, d, machineIdOf(d));
  const value = parseEther(process.env.SESSION_VALUE ?? "0.2");
  const interval = Number(process.env.SESSION_INTERVAL ?? 10) * 1000;
  const max = Number(process.env.MAX_SESSIONS ?? 0);
  const stopWhenRepaid = process.env.STOP_WHEN_REPAID === "1";
  const sym = c.p.nativeSymbol;

  if (!d.simulated) {
    const cents = weiToUsdCents(value, await peaqUsd());
    if (cents < 1000) log("charger", `WARNING: session worth ${amountLabel(value, await peaqUsd(), c.p.nativeSymbol)} < $10; raise SESSION_VALUE so the MCR counts it`);
  }
  log("charger", `EV charger online: machine ${s.machineId}, ${fmt(value, sym)} per session every ${interval / 1000}s`);

  let n = 0;
  let stop = false;
  process.on("SIGINT", () => (stop = true));
  while (!stop && (max === 0 || n < max)) {
    const before = await s.loan();
    const r = await s.paySession(value, `charge-${n}`);
    n++;
    const after = await s.loan();
    log(
      "charger",
      `session #${n} kWh≈${(Math.random() * 20 + 10).toFixed(1)} paid ${fmt(value, sym)} by ${c.wallet("customer").account.address.slice(0, 6)}…${c.wallet("customer").account.address.slice(-4)} -> skim ${fmt(r.skimmed, sym)} to vault, ${fmt(r.forwarded, sym)} to machine` +
        (after.status === 1 || before.status === 1 ? `  [repaid ${fmt(after.repaid, sym)}/${fmt(after.owed, sym)}]` : "") +
        `  ${txUrl(c.p, r.hash)}`,
    );
    if (before.status === 1 && after.status === 2) {
      log("charger", "LOAN REPAID IN FULL: Machine NFT returned to borrower");
      if (stopWhenRepaid) break;
    }
    if (stopWhenRepaid && before.status !== 1 && after.status !== 1) {
      log("charger", "no active loan; stopping (STOP_WHEN_REPAID=1)");
      break;
    }
    if (!stop && (max === 0 || n < max)) await sleep(interval);
  }
  log("charger", `done after ${n} sessions`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
