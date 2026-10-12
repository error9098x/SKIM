// peaqOS SDK glue (@peaqos/peaq-os-sdk 0.11.x). Loaded lazily so the local/simulated path never needs it.
import type { Address, Hex } from "viem";
import { keyFor, type NetworkName, type NetworkPreset } from "./lib.js";

// Tokenomics 1.0 addresses: the SDK constructor still requires them in Tokenomics 2.0 mode
// (docs.peaq.xyz/peaqos/concepts/contracts). `eventRegistry` is what submitEvent writes to, so on
// mainnet we point it at the Economics 2.0 EventRegistry as the docs instruct for 2.0 machines.
const LEGACY_CONTRACTS: Record<"agung" | "mainnet", Record<string, Address>> = {
  mainnet: {
    identityRegistry: "0xb53Af985765031936311273599389b5B68aC9956",
    identityStaking: "0x11c05A650704136786253e8685f56879A202b1C7",
    eventRegistry: "0xA1e7F1d7B24dAb55Dc92491e6d9B89F6E925Ad1e", // Economics 2.0 EventRegistry
    machineNft: "0x2943F80e9DdB11B9Dd275499C661Df78F5F691F9",
    didRegistry: "0x0000000000000000000000000000000000000800",
    batchPrecompile: "0x0000000000000000000000000000000000000805",
  },
  agung: {
    identityRegistry: "0x9E9463a65c7B74623b3b6Cdc39F71be7274e5971",
    identityStaking: "0x55f336714aDb0749DbFE33b057a1702405564E3d",
    eventRegistry: "0x2DAD8905380993940e340C5cE6d313d5c2780040", // 1.0 only; agung has no 2.0 EventRegistry
    machineNft: "0xB41C2A4f1c19b6B06beaAce0F5CD8439e77C4b1c",
    didRegistry: "0x0000000000000000000000000000000000000800",
    batchPrecompile: "0x0000000000000000000000000000000000000805",
  },
};

/** Economics 2.0 MachineRegistry (the Machine NFT, machineId == tokenId). */
export const MACHINE_REGISTRY: Record<"agung" | "mainnet", Address> = {
  mainnet: "0x64b93Cc29b251fAFa83BD110cDB1C24207f85536",
  agung: "0x538da35489B1F0035799a8351E67835ae4ABb377",
};

export async function sdkClient(p: NetworkPreset, privateKey: Hex) {
  if (p.name === "local") throw new Error("peaqOS SDK is not available on a local anvil chain");
  const sdk = await import("@peaqos/peaq-os-sdk");
  const net = p.name as Exclude<NetworkName, "local">;
  const client = new sdk.PeaqosClient<"tokenomics20">({
    rpcUrl: p.rpc,
    privateKey,
    contracts: LEGACY_CONTRACTS[net] as never,
    apiUrl: p.mcrApi ?? "https://mcr.peaq.xyz",
    tokenomics20: { deploymentId: p.sdkDeploymentId! },
  });
  return { sdk, client };
}

/** Signer for revenue events: must be the machine's owner or DID controller.
 *  While the NFT is escrowed in SkimVault the owner is the vault, so this is the operator,
 *  which stays the DID controller (transferring the NFT "moves ownership and retains the controller"). */
export function eventSignerKey(): Hex {
  const k = process.env.EVENT_SIGNER_PRIVATE_KEY;
  if (k) return (k.startsWith("0x") ? k : `0x${k}`) as Hex;
  return keyFor("operator");
}

// ---- tiny base58btc for the DID verification method (publicKeyMultibase = "z" + b58(0xed01 || pub))
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}

export async function ed25519Multibase(seedHex?: string): Promise<{ multibase: string; seed: Hex }> {
  const { ed25519 } = await import("@noble/curves/ed25519.js");
  const seed = seedHex
    ? Uint8Array.from(Buffer.from(seedHex.replace(/^0x/, ""), "hex"))
    : ed25519.utils.randomSecretKey();
  const pub = ed25519.getPublicKey(seed);
  const prefixed = new Uint8Array([0xed, 0x01, ...pub]);
  return { multibase: "z" + base58(prefixed), seed: ("0x" + Buffer.from(seed).toString("hex")) as Hex };
}
