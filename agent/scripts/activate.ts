// Activate the machine and record its machineId.
//
// Modes (ACTIVATE_MODE):
//   sdk  - peaqOS Economics 2.0 activateMachine (Entry tier, self-owned: the operator signs, owns the
//          Machine NFT, pays the bond and is DID controller). Writes deployments/<net>.machine.json.
//          Run BEFORE deploy.ts so the vault is deployed against the real MachineRegistry NFT.
//   mock - mint the machine on our MockMachineNFT (needs deploy.ts first). Default on local + agung.
//
//   NETWORK=local npm run activate
//   NETWORK=mainnet ACTIVATE_MODE=sdk OPERATOR_PRIVATE_KEY=0x.. [ACTIVATE_DRY_RUN=1] npm run activate
//
// Env: MACHINE_TYPE (default "EVCharger"), MACHINE_SERIAL (default "skim-ev-charger-001"),
//      MANUFACTURER (address recorded, unverified), DID_ED25519_SEED (hex, optional), ACTIVATE_DRY_RUN=1
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { toHex, type Address, type Hex } from "viem";
import {
  abis,
  clients,
  computeMachineId,
  DEPLOYMENTS_DIR,
  deploymentPath,
  keyFor,
  loadDeployment,
  log,
  machineFilePath,
  networkName,
  saveDeployment,
  txUrl,
} from "../src/lib.js";
import { ed25519Multibase, MACHINE_REGISTRY, sdkClient } from "../src/peaq.js";

const net = networkName();
const machineType = process.env.MACHINE_TYPE ?? "EVCharger";
const credentialSubject = toHex(process.env.MACHINE_SERIAL ?? "skim-ev-charger-001") as Hex;
const mode = (process.env.ACTIVATE_MODE ?? (net === "mainnet" ? "sdk" : "mock")).toLowerCase();

async function viaSdk() {
  const c = clients();
  const opKey = keyFor("operator");
  const { client } = await sdkClient(c.p, opKey);
  const operator = client.address as Address;
  const { multibase } = await ed25519Multibase(process.env.DID_ED25519_SEED);
  const params = {
    controller: operator,
    verificationMethods: [
      { id: "#key-1", methodType: "Ed25519VerificationKey2020", controller: operator, publicKeyMultibase: multibase },
    ],
    authentication: [0n],
    serviceEndpoints: [
      { id: "#docs", serviceType: "peaq-documentation", serviceEndpoint: process.env.DOCS_URL ?? "https://github.com/skim-credit" },
    ],
    machineType,
    credentialSubject,
    manufacturer: (process.env.MANUFACTURER as Address) ?? operator,
    tier: 0 as const, // Entry
  };
  const expected = computeMachineId(machineType, credentialSubject);
  log("activate", `SDK ${c.p.sdkDeploymentId}  operator=${operator}  expected machineId=${expected}`);
  const preview = await client.previewMachineActivation(params);
  log("activate", "preview", {
    machineId: preview.machineId.toString(),
    bondAmount: preview.bondAmount.toString(),
    voucherCredit: preview.voucherCredit.toString(),
    netPeaqAmount: preview.netPeaqAmount.toString(),
  });
  if (process.env.ACTIVATE_DRY_RUN === "1") {
    log("activate", "dry run: nothing submitted");
    return;
  }
  const res = await client.activateMachine({ ...params, expectedMachineId: preview.machineId });
  log("activate", `activated machineId=${res.machineId}  tx ${txUrl(c.p, res.transactionHash)}`);
  const out = {
    network: net,
    machineId: res.machineId.toString(),
    did: `did:peaq:${res.machineId}`,
    machineNft: MACHINE_REGISTRY[net as "agung" | "mainnet"],
    owner: res.owner,
    controller: res.controller,
    tier: res.tier,
    bondAmount: res.bondAmount.toString(),
    activationTx: res.transactionHash,
    machineType,
    credentialSubject,
  };
  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(machineFilePath(net), JSON.stringify(out, null, 2) + "\n");
  log("activate", `wrote ${machineFilePath(net)}; explorer https://machines.peaq.xyz/machine/${res.machineId}`);
  if (existsSync(deploymentPath(net))) {
    const d = loadDeployment(net);
    if (d.contracts.machineNft.toLowerCase() === out.machineNft.toLowerCase()) {
      d.machineId = out.machineId;
      saveDeployment(d);
    } else {
      log("activate", "WARNING: existing deployment uses a different Machine NFT; re-run deploy.ts to bind the vault to MachineRegistry");
    }
  }
  console.log(res.machineId.toString());
}

async function viaMock() {
  const c = clients();
  const d = loadDeployment(net);
  if (!d.machineNftIsMock) throw new Error("Deployment uses a real Machine NFT; use ACTIVATE_MODE=sdk");
  const machineId = process.env.MACHINE_ID ? BigInt(process.env.MACHINE_ID) : computeMachineId(machineType, credentialSubject);
  const operator = c.wallet("operator");
  const exists = (await c.pub.readContract({
    address: d.contracts.machineNft,
    abi: abis.machineNft,
    functionName: "exists",
    args: [machineId],
  })) as boolean;
  if (exists) {
    log("activate", `machine ${machineId} already minted on MockMachineNFT`);
  } else {
    const hash = await operator.writeContract({
      address: d.contracts.machineNft,
      abi: abis.machineNft,
      functionName: "mint",
      args: [operator.account.address, machineId],
    });
    await c.pub.waitForTransactionReceipt({ hash });
    log("activate", `SIMULATED activation: minted mock Machine NFT ${machineId} to ${operator.account.address}  ${txUrl(c.p, hash)}`);
  }
  d.machineId = machineId.toString();
  d.operator = operator.account.address;
  saveDeployment(d);
  log("activate", `did:peaq:${machineId} recorded in ${deploymentPath(net)}`);
  console.log(machineId.toString());
}

(mode === "sdk" ? viaSdk() : viaMock()).catch((e) => {
  console.error(e);
  process.exit(1);
});
