// Reads Foundry output (../contracts/out) and writes:
//   agent/src/artifacts.json   (abi + bytecode, used by deploy.ts)
//   deployments/abis.json      (abis only, for the web app)
// Run after `forge build`:  npm run artifacts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../contracts/out");
const names = ["SkimVault", "RevenueRouter", "MCROracle", "MockMachineNFT", "MockEventRegistry"] as const;

const artifacts: Record<string, { abi: unknown; bytecode: string }> = {};
const abis: Record<string, unknown> = {};
for (const n of names) {
  const j = JSON.parse(readFileSync(join(out, `${n}.sol`, `${n}.json`), "utf8"));
  artifacts[n] = { abi: j.abi, bytecode: j.bytecode.object };
  abis[n] = j.abi;
}
abis.PeaqEventRegistry = JSON.parse(readFileSync(join(here, "../src/peaq-event-registry.abi.json"), "utf8"));
writeFileSync(join(here, "../src/artifacts.json"), JSON.stringify(artifacts, null, 2));
mkdirSync(join(here, "../../deployments"), { recursive: true });
writeFileSync(join(here, "../../deployments/abis.json"), JSON.stringify(abis, null, 2));
console.log(`wrote artifacts for ${names.join(", ")}`);
