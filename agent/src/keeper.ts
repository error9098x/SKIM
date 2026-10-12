// SKIM keeper. Two loops:
//  1. revenue: watch RevenueRouted and submit one revenue event per router tx
//     (eventType 0, value in USD cents, trustLevel 1, sourceTxHash = router tx).
//     mainnet -> peaq Economics 2.0 EventRegistry via @peaqos/peaq-os-sdk; testnet/local -> MockEventRegistry.
//  2. rating: poll the MCR API (mainnet) or derive a SIMULATED score from the event count, then oracle.post.
//
//   NETWORK=local npm run keeper            (KEEPER_POLL=5 seconds, RATING_POLL=30 seconds, KEEPER_ONCE=1 to run once)
import { clients, loadDeployment, log, machineIdOf, sleep } from "./lib.js";
import { Skim } from "./skim.js";

async function main() {
  const c = clients();
  const d = loadDeployment();
  const s = new Skim(c, d, machineIdOf(d));
  const poll = Number(process.env.KEEPER_POLL ?? 5) * 1000;
  const ratingPoll = Number(process.env.RATING_POLL ?? 30) * 1000;
  const once = process.env.KEEPER_ONCE === "1";
  log("keeper", `network=${d.network} mode=${d.simulated ? "SIMULATED (MockEventRegistry + derived rating)" : "LIVE (peaq EventRegistry 2.0 + MCR API)"} machine=${s.machineId}`);

  let lastRating = 0;
  let stop = false;
  process.on("SIGINT", () => (stop = true));
  process.on("SIGTERM", () => (stop = true));
  while (!stop) {
    try {
      const n = await s.processRevenue();
      if (n) log("keeper", `processed ${n} routed payment(s)`);
    } catch (e) {
      log("keeper", "revenue loop error:", (e as Error).message);
    }
    if (Date.now() - lastRating >= ratingPoll || once) {
      try {
        await s.refreshRating();
        lastRating = Date.now();
      } catch (e) {
        log("keeper", "rating loop error:", (e as Error).message);
      }
    }
    if (once) break;
    await sleep(poll);
  }
  log("keeper", "stopped");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
