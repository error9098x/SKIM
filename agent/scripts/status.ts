// Print rating, quote, loan and NFT custody for the configured machine.
//   NETWORK=local npm run status
import { clients, loadDeployment, machineIdOf } from "../src/lib.js";
import { Skim } from "../src/skim.js";

const c = clients();
const d = loadDeployment();
new Skim(c, d, machineIdOf(d)).printStatus().catch((e) => {
  console.error(e);
  process.exit(1);
});
