// Operator opens a loan: approves the vault for the Machine NFT, escrows it and receives the advance.
//   NETWORK=local [LOAN_TERM_SECONDS=2592000] npm run open-loan
import { clients, loadDeployment, machineIdOf } from "../src/lib.js";
import { Skim } from "../src/skim.js";

const c = clients();
const d = loadDeployment();
const s = new Skim(c, d, machineIdOf(d));
s.openLoan(BigInt(process.env.LOAN_TERM_SECONDS ?? 30 * 24 * 3600))
  .then(() => s.printStatus())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
