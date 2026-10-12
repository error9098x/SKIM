// Read-only smoke test of the mainnet/agung peaqOS path. Uses a throwaway random key, submits NOTHING.
//   NETWORK=mainnet npx tsx scripts/sdk-smoke.ts
// Checks: SDK client construction with our config, previewMachineActivation with our params,
// validateSubmitEventParams with the keeper's event shape, and the MCR API response shape.
import { generatePrivateKey } from "viem/accounts";
import { toHex, keccak256, type Hex } from "viem";
import { computeMachineId, preset } from "../src/lib.js";
import { ed25519Multibase, sdkClient } from "../src/peaq.js";

async function main() {
  const p = preset();
  const { sdk, client } = await sdkClient(p, generatePrivateKey());
  console.log("client ok:", client.address, "mode:", (client as { mode?: string }).mode);
  const credentialSubject = toHex("skim-ev-charger-001") as Hex;
  const { multibase } = await ed25519Multibase();
  const params = {
    controller: client.address,
    verificationMethods: [{ id: "#key-1", methodType: "Ed25519VerificationKey2020", controller: client.address, publicKeyMultibase: multibase }],
    authentication: [0n],
    serviceEndpoints: [{ id: "#docs", serviceType: "peaq-documentation", serviceEndpoint: "https://github.com/skim-credit" }],
    machineType: "EVCharger",
    credentialSubject,
    manufacturer: client.address,
    tier: 0 as const,
  };
  sdk.validateActivateMachineParams(params as never);
  console.log("activate params valid; local machineId =", computeMachineId("EVCharger", credentialSubject).toString());
  try {
    const pv = await client.previewMachineActivation(params);
    console.log("preview:", { machineId: pv.machineId.toString(), bond: pv.bondAmount.toString(), net: pv.netPeaqAmount.toString() });
    console.log("sdk machineId matches local derivation:", pv.machineId === computeMachineId("EVCharger", credentialSubject));
  } catch (e) {
    console.log("preview error (expected for an unfunded key on some checks):", (e as { code?: string }).code, (e as Error).message.slice(0, 300));
  }
  const ev = {
    machineId: 1n,
    eventType: sdk.EVENT_TYPE_REVENUE,
    value: 1234,
    currency: "USD",
    timestamp: Math.floor(Date.now() / 1000) - 10,
    rawData: new TextEncoder().encode(JSON.stringify({ app: "skim" })),
    trustLevel: sdk.TRUST_ON_CHAIN_VERIFIABLE,
    sourceChainId: sdk.SUPPORTED_CHAIN_IDS.peaq,
    sourceTxHash: keccak256(toHex("router-tx")),
    metadata: new TextEncoder().encode("{}"),
  };
  sdk.validateSubmitEventParams(ev as never);
  console.log("submitEvent params valid (trust 1, sourceChainId", sdk.SUPPORTED_CHAIN_IDS.peaq, ")");
  if (p.mcrApi) {
    const id = "108934426058480933785963234320575706003575332367737915173645220784539698794848";
    const r = await fetch(`${p.mcrApi}/mcr/did:peaq:${id}`);
    console.log("MCR API", r.status, (await r.text()).slice(0, 400));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
