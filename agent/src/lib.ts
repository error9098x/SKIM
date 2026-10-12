// Shared config + helpers for SKIM agent scripts.
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  formatEther,
  getAddress,
  http,
  keccak256,
  parseEther,
  toHex,
  type Abi,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import artifactsJson from "./artifacts.json" with { type: "json" };
import peaqEventRegistryAbi from "./peaq-event-registry.abi.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));
export const DEPLOYMENTS_DIR = join(here, "../../deployments");

// ------------------------------------------------------------------ networks
export type NetworkName = "local" | "agung" | "mainnet";

export interface NetworkPreset {
  name: NetworkName;
  chainId: number;
  rpc: string;
  explorer: string;
  nativeSymbol: string;
  simulated: boolean; // no live MCR / 2.0 EventRegistry -> SIMULATED mode
  eventRegistry2?: Address; // real peaq Economics 2.0 EventRegistry
  mcrApi?: string;
  sdkDeploymentId?: "peaq-mainnet" | "agung-2026-08-28";
}

export const NETWORKS: Record<NetworkName, NetworkPreset> = {
  local: {
    name: "local",
    chainId: 31337,
    rpc: "http://127.0.0.1:8545",
    explorer: "",
    nativeSymbol: "ETH",
    simulated: true,
  },
  agung: {
    name: "agung",
    chainId: 9990,
    rpc: "https://peaq-agung.api.onfinality.io/public",
    explorer: "https://agung-testnet.subscan.io",
    nativeSymbol: "AGNG",
    simulated: true,
    sdkDeploymentId: "agung-2026-08-28",
  },
  mainnet: {
    name: "mainnet",
    chainId: 3338,
    rpc: "https://quicknode1.peaq.xyz",
    explorer: "https://peaq.subscan.io",
    nativeSymbol: "PEAQ",
    simulated: false,
    eventRegistry2: "0xA1e7F1d7B24dAb55Dc92491e6d9B89F6E925Ad1e",
    mcrApi: "https://mcr.peaq.xyz",
    sdkDeploymentId: "peaq-mainnet",
  },
};

export function networkName(): NetworkName {
  const n = (process.env.NETWORK ?? "local").toLowerCase();
  if (n !== "local" && n !== "agung" && n !== "mainnet") throw new Error(`NETWORK must be local|agung|mainnet, got ${n}`);
  return n;
}

export function preset(): NetworkPreset {
  const p = { ...NETWORKS[networkName()] };
  if (process.env.RPC_URL) p.rpc = process.env.RPC_URL;
  if (process.env.MCR_API_URL) p.mcrApi = process.env.MCR_API_URL;
  if (process.env.FORCE_SIMULATED === "1") p.simulated = true;
  return p;
}

export function chainFor(p: NetworkPreset): Chain {
  return defineChain({
    id: p.chainId,
    name: `peaq-${p.name}`,
    nativeCurrency: { name: p.nativeSymbol, symbol: p.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [p.rpc] } },
    blockExplorers: p.explorer ? { default: { name: "subscan", url: p.explorer } } : undefined,
  });
}

// ------------------------------------------------------------------ keys / roles
// Well-known anvil dev keys. ONLY used when NETWORK=local. Never real funds.
const ANVIL_KEYS: Hex[] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];

export type Role = "deployer" | "keeper" | "operator" | "customer";
const ROLE_ENV: Record<Role, string> = {
  deployer: "DEPLOYER_PRIVATE_KEY",
  keeper: "KEEPER_PRIVATE_KEY",
  operator: "OPERATOR_PRIVATE_KEY",
  customer: "CUSTOMER_PRIVATE_KEY",
};
const ROLE_INDEX: Record<Role, number> = { deployer: 0, keeper: 1, operator: 2, customer: 3 };

/** Role key from env; falls back to PRIVATE_KEY (single-key setups), then anvil keys on local. */
export function keyFor(role: Role): Hex {
  // On local anvil ignore the shared PRIVATE_KEY from .env (a funded testnet key has 0 ETH on anvil and
  // would break local:e2e); role-specific keys or LOCAL_USE_ENV_KEYS=1 still override.
  const local = networkName() === "local" && process.env.LOCAL_USE_ENV_KEYS !== "1";
  const k = process.env[ROLE_ENV[role]] || (local ? undefined : process.env.PRIVATE_KEY);
  if (k) return (k.startsWith("0x") ? k : `0x${k}`) as Hex;
  if (networkName() === "local") return ANVIL_KEYS[ROLE_INDEX[role]];
  throw new Error(`Missing ${ROLE_ENV[role]} (or PRIVATE_KEY) for NETWORK=${networkName()}`);
}

export function accountFor(role: Role) {
  return privateKeyToAccount(keyFor(role));
}

export interface Clients {
  p: NetworkPreset;
  chain: Chain;
  pub: PublicClient;
  wallet(role: Role): WalletClient<Transport, Chain, Account>;
}

export function clients(): Clients {
  const p = preset();
  const chain = chainFor(p);
  const transport = http(p.rpc, { retryCount: 3, timeout: 30_000 });
  const pub = createPublicClient({ chain, transport, pollingInterval: p.name === "local" ? 250 : 3000 }) as PublicClient;
  const cache = new Map<Role, WalletClient<Transport, Chain, Account>>();
  return {
    p,
    chain,
    pub,
    wallet(role: Role) {
      if (!cache.has(role)) cache.set(role, createWalletClient({ chain, transport, account: accountFor(role) }));
      return cache.get(role)!;
    },
  };
}

// ------------------------------------------------------------------ artifacts / deployments
type ArtifactName = "SkimVault" | "RevenueRouter" | "MCROracle" | "MockMachineNFT" | "MockEventRegistry";
const artifacts = artifactsJson as unknown as Record<ArtifactName, { abi: Abi; bytecode: Hex }>;
export function artifact(name: ArtifactName) {
  return artifacts[name];
}
export const abis = {
  vault: artifacts.SkimVault.abi,
  router: artifacts.RevenueRouter.abi,
  oracle: artifacts.MCROracle.abi,
  machineNft: artifacts.MockMachineNFT.abi, // standard ERC-721 surface (+ mint on the mock)
  eventRegistry: artifacts.MockEventRegistry.abi,
  /** peaq EventRegistry (submitEvent/getEventAt/EventSubmitted) extracted from @peaqos/peaq-os-sdk 0.11.2 */
  peaqEventRegistry: peaqEventRegistryAbi as unknown as Abi,
};

export interface Deployment {
  network: NetworkName;
  chainId: number;
  rpc: string;
  explorer: string;
  nativeSymbol: string;
  contracts: { vault: Address; router: Address; oracle: Address; machineNft: Address; eventRegistry: Address };
  machineNftIsMock: boolean;
  eventRegistryIsMock: boolean;
  machineId: string | null; // decimal string (uint256)
  machineWallet: Address;
  operator: Address;
  keeper: Address;
  deployer: Address;
  simulated: boolean;
  mcrApi: string | null;
  deployBlock: number;
  deployedAt: string;
  termsScale: { num: string; den: string };
  abis: Record<string, Abi>;
}

export function deploymentPath(n: NetworkName = networkName()) {
  return join(DEPLOYMENTS_DIR, `${n}.json`);
}
export function machineFilePath(n: NetworkName = networkName()) {
  return join(DEPLOYMENTS_DIR, `${n}.machine.json`);
}

export function loadDeployment(n: NetworkName = networkName()): Deployment {
  const f = deploymentPath(n);
  if (!existsSync(f)) throw new Error(`No deployment at ${f}. Run: NETWORK=${n} npm run deploy`);
  return JSON.parse(readFileSync(f, "utf8"));
}

export function saveDeployment(d: Deployment) {
  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(deploymentPath(d.network), JSON.stringify(d, null, 2) + "\n");
}

export function machineIdOf(d: Deployment): bigint {
  const env = process.env.MACHINE_ID;
  if (env) return BigInt(env);
  if (!d.machineId) throw new Error("No machineId yet. Run: npm run activate");
  return BigInt(d.machineId);
}

// ------------------------------------------------------------------ peaq domain helpers
/** Economics 2.0 machine ID: uint256(keccak256(abi.encode(machineType, credentialSubject))). */
export function computeMachineId(machineType: string, credentialSubject: Hex): bigint {
  return BigInt(keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes" }], [machineType, credentialSubject])));
}

export const GRADES = ["Provisioned", "B", "BB", "BBB", "A", "AA", "AAA"] as const;

/** MCR letter -> oracle grade. NR and Provisioned both map to 0 (starter line). */
export function gradeFromMcr(letter: string): number {
  const i = GRADES.indexOf(letter as (typeof GRADES)[number]);
  return i < 0 ? 0 : i;
}

/** Simulated MCR (agung/local only): derived from the count of trust-1 revenue events. */
export function simulatedRating(revenueEvents: number): { score: number; grade: number } {
  if (revenueEvents < 3) return { score: 0, grade: 0 }; // Provisioned: not enough history
  const score = Math.min(100, 30 + revenueEvents * 2);
  const grade = score >= 90 ? 6 : score >= 80 ? 5 : score >= 70 ? 4 : score >= 60 ? 3 : score >= 50 ? 2 : score >= 40 ? 1 : 0;
  return { score, grade };
}

let cachedPrice: { usd: number; at: number } | null = null;
/** PEAQ/USD from env PEAQ_USD, else CoinGecko (cached 10 min), else fallback 0.043 (~12 Oct 2026). */
export async function peaqUsd(): Promise<number> {
  if (process.env.PEAQ_USD) return Number(process.env.PEAQ_USD);
  if (cachedPrice && Date.now() - cachedPrice.at < 600_000) return cachedPrice.usd;
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=peaq-2&vs_currencies=usd", {
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as Record<string, { usd?: number }>;
    const usd = j["peaq-2"]?.usd;
    if (typeof usd === "number" && usd > 0) {
      cachedPrice = { usd, at: Date.now() };
      return usd;
    }
  } catch {
    /* fall through */
  }
  log("price", "CoinGecko unavailable; using fallback PEAQ_USD=0.043 (set PEAQ_USD to override)");
  return 0.043;
}

/** wei -> USD cents (integer, ISO 4217 minor units) */
export function weiToUsdCents(wei: bigint, usd: number): number {
  // use 1e6 fixed point for the price to stay in bigint math
  const price6 = BigInt(Math.round(usd * 1e6));
  return Number((wei * price6 * 100n) / (10n ** 18n * 1_000_000n));
}

/** wei -> USD micro-dollars (integer). Testnet sessions are worth < 1 cent, so cents alone would read "$0.00". */
export function weiToUsdMicro(wei: bigint, usd: number): number {
  const price6 = BigInt(Math.round(usd * 1e6));
  return Number((wei * price6) / 10n ** 18n);
}

/** Human amount for logs: "0.1000 AGNG ≈ $0.0043" (never "$0.00"; 4 decimals below $1). */
export function amountLabel(wei: bigint, usd: number, sym = ""): string {
  const micro = weiToUsdMicro(wei, usd);
  const dollars = micro / 1e6;
  const usdTxt = dollars >= 1 ? `$${dollars.toFixed(2)}` : dollars >= 0.0001 ? `$${dollars.toFixed(4)}` : `${micro} µUSD`;
  return `${fmt(wei, sym)} ≈ ${usdTxt}`;
}

export function txUrl(p: { explorer: string }, hash: string) {
  return p.explorer ? `${p.explorer}/tx/${hash}` : hash;
}

export function log(tag: string, ...args: unknown[]) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${tag.padEnd(9)}`, ...args);
}

export const fmt = (wei: bigint, sym = "") => `${Number(formatEther(wei)).toFixed(4)}${sym ? " " + sym : ""}`;
export { parseEther, getAddress, toHex };

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
