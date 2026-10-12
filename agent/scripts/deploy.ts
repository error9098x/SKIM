// Deploy SKIM: MCROracle, (MockMachineNFT), SkimVault, RevenueRouter, (MockEventRegistry).
// Seeds the vault with SEED_LIQUIDITY and writes deployments/<network>.json.
//
//   NETWORK=local npm run deploy
//   NETWORK=agung DEPLOYER_PRIVATE_KEY=0x.. KEEPER_ADDRESS=0x.. npm run deploy
//
// Env:
//   MACHINE_NFT        existing ERC-721 (peaq MachineRegistry). Unset -> deploy MockMachineNFT.
//   MACHINE_ID         existing machine id (decimal). Also read from deployments/<net>.machine.json (activate.ts).
//   EVENT_REGISTRY     override registry. Default: mainnet -> peaq 2.0 EventRegistry, else deploy MockEventRegistry.
//   SEED_LIQUIDITY     native tokens to deposit (default 5 on local, 0 elsewhere unless set).
//   TERMS_SCALE        "num/den" scale for the principal table (default 1/1; e.g. 1/10 for a cheap demo).
//   KEEPER_ADDRESS     oracle keeper (default: address of KEEPER_PRIVATE_KEY).
//   MACHINE_WALLET     where advances + forwarded revenue go (default: operator address).
import { existsSync, readFileSync } from "node:fs";
import type { Address } from "viem";
import {
  abis,
  accountFor,
  artifact,
  clients,
  deploymentPath,
  fmt,
  getAddress,
  log,
  machineFilePath,
  networkName,
  parseEther,
  saveDeployment,
  txUrl,
  type Deployment,
} from "../src/lib.js";

async function main() {
  const c = clients();
  const { p, pub } = c;
  const net = networkName();
  const deployer = c.wallet("deployer");
  const chainId = await pub.getChainId();
  if (chainId !== p.chainId) throw new Error(`RPC chainId ${chainId} != expected ${p.chainId} for ${net}`);

  const bal = await pub.getBalance({ address: deployer.account.address });
  log("deploy", `network=${net} chain=${chainId} deployer=${deployer.account.address} balance=${fmt(bal, p.nativeSymbol)}`);

  const keeperAddr = (process.env.KEEPER_ADDRESS as Address) || accountFor("keeper").address;
  let operatorAddr: Address;
  try {
    operatorAddr = (process.env.OPERATOR_ADDRESS as Address) || accountFor("operator").address;
  } catch {
    operatorAddr = deployer.account.address;
  }
  const machineWallet = (process.env.MACHINE_WALLET as Address) || operatorAddr;

  async function deployContract(name: Parameters<typeof artifact>[0], args: unknown[] = []): Promise<Address> {
    const a = artifact(name);
    const hash = await deployer.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
    const rcpt = await pub.waitForTransactionReceipt({ hash });
    if (rcpt.status !== "success" || !rcpt.contractAddress) throw new Error(`${name} deploy failed: ${hash}`);
    rcpt.contractAddress = getAddress(rcpt.contractAddress);
    log("deploy", `${name.padEnd(18)} ${rcpt.contractAddress}  ${txUrl(p, hash)}`);
    return rcpt.contractAddress;
  }
  async function send(addr: Address, abi: typeof abis.vault, fn: string, args: unknown[] = [], value?: bigint) {
    const hash = await deployer.writeContract({ address: addr, abi, functionName: fn, args, value } as never);
    const r = await pub.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`${fn} failed: ${hash}`);
    return hash;
  }

  // machine identity (from activate.ts on the real path)
  let machineNft = process.env.MACHINE_NFT as Address | undefined;
  let machineId: string | null = process.env.MACHINE_ID ?? null;
  const mf = machineFilePath(net);
  if (existsSync(mf)) {
    const m = JSON.parse(readFileSync(mf, "utf8"));
    machineNft ||= m.machineNft;
    machineId ||= m.machineId;
    log("deploy", `using activated machine from ${mf}: id=${m.machineId}`);
  }

  const startBlock = Number(await pub.getBlockNumber());
  const oracle = await deployContract("MCROracle", [keeperAddr]);
  const nftIsMock = !machineNft;
  if (!machineNft) machineNft = await deployContract("MockMachineNFT");
  const vault = await deployContract("SkimVault", [machineNft, oracle]);
  const router = await deployContract("RevenueRouter", [vault]);

  let eventRegistry = process.env.EVENT_REGISTRY as Address | undefined;
  if (!eventRegistry && !p.simulated && p.eventRegistry2) eventRegistry = p.eventRegistry2;
  const registryIsMock = !eventRegistry;
  if (!eventRegistry) eventRegistry = await deployContract("MockEventRegistry");

  // terms scale
  const [num, den] = (process.env.TERMS_SCALE ?? "1/1").split("/").map((x) => BigInt(x.trim()));
  if (num !== den) {
    await send(vault, abis.vault, "scaleTerms", [num, den]);
    log("deploy", `scaled principal table by ${num}/${den}`);
  }

  // seed liquidity
  const seed = process.env.SEED_LIQUIDITY ?? (net === "local" ? "5" : "0");
  if (Number(seed) > 0) {
    const h = await send(vault, abis.vault, "deposit", [], parseEther(seed));
    log("deploy", `seeded vault with ${seed} ${p.nativeSymbol}  ${txUrl(p, h)}`);
  }

  const d: Deployment = {
    network: net,
    chainId,
    rpc: p.rpc,
    explorer: p.explorer,
    nativeSymbol: p.nativeSymbol,
    contracts: { vault, router, oracle, machineNft, eventRegistry },
    machineNftIsMock: nftIsMock,
    eventRegistryIsMock: registryIsMock,
    machineId,
    machineWallet,
    operator: operatorAddr,
    keeper: keeperAddr,
    deployer: deployer.account.address,
    simulated: p.simulated || registryIsMock,
    mcrApi: p.simulated ? null : (p.mcrApi ?? null),
    deployBlock: startBlock,
    deployedAt: new Date().toISOString(),
    termsScale: { num: num.toString(), den: den.toString() },
    abis: {
      SkimVault: abis.vault,
      RevenueRouter: abis.router,
      MCROracle: abis.oracle,
      MachineNFT: abis.machineNft,
      EventRegistry: registryIsMock ? abis.eventRegistry : abis.peaqEventRegistry,
    },
  };
  saveDeployment(d);
  log("deploy", `wrote ${deploymentPath(net)}`);
  if (!machineId) log("deploy", "next: npm run activate   (mints/activates the machine and records machineId)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
