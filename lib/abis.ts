// Hand-written ABIs from SPEC.md. If ../deployments/abis.json (or `abis` inside
// the deployment file) is present, those are preferred at runtime (see lib/live.ts).
import { parseAbi, type Abi } from 'viem';

export const oracleAbi = parseAbi([
  'event RatingPosted(uint256 indexed machineId, uint8 score, uint8 grade, bool simulated)',
  'function getRating(uint256 machineId) view returns ((uint8 score, uint8 grade, uint64 updatedAt, bool simulated))',
  'function post(uint256 machineId, uint8 score, uint8 grade, bool simulated)',
]);

export const vaultAbi = parseAbi([
  'event Deposited(address indexed lender, uint256 amount)',
  'event LoanOpened(uint256 indexed machineId, address indexed borrower, address machineWallet, uint256 principal, uint256 owed, uint16 skimBps, uint64 dueAt)',
  'event Repaid(uint256 indexed machineId, uint256 amount, uint256 repaid, uint256 owed)',
  'event LoanClosed(uint256 indexed machineId)',
  'event Defaulted(uint256 indexed machineId)',
  'function deposit() payable',
  'function quote(uint256 machineId) view returns (uint256 principal, uint16 feeBps, uint16 skimBps, uint8 grade)',
  'function loans(uint256 machineId) view returns (address borrower, address machineWallet, uint256 principal, uint256 owed, uint256 repaid, uint16 skimBps, uint64 openedAt, uint64 dueAt, uint8 status)',
  'function skimBpsOf(uint256 machineId) view returns (uint16)',
  'function isActive(uint256 machineId) view returns (bool)',
  'function availableLiquidity() view returns (uint256)',
  // terms curve getters (allTerms preferred; termsFor per grade as fallback)
  'function allTerms() view returns ((uint256 principal, uint16 feeBps, uint16 skimBps)[7])',
  'function termsFor(uint8 grade) view returns ((uint256 principal, uint16 feeBps, uint16 skimBps))',
]);

export const routerAbi = parseAbi([
  'event RevenueRouted(uint256 indexed machineId, address indexed payer, bytes32 sessionId, uint256 amount, uint256 skimmed, uint256 forwarded)',
  'function pay(uint256 machineId, address machineWallet, bytes32 sessionId) payable',
]);

export const nftAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

export const eventRegistryAbi = parseAbi([
  'event EventSubmitted(uint256 indexed machineId, uint8 eventType, uint256 value, string currency, uint64 timestamp, uint8 trustLevel, bytes32 sourceTxHash)',
]);

// peaq mainnet EventRegistry 2.0 (event does not carry sourceTxHash; read it via getEventAt)
export const peaqRegistryAbi = parseAbi([
  'event EventSubmitted(uint256 indexed machineId, uint256 indexed eventIndex, uint8 eventType, uint256 value, string indexed currency)',
  'function getEventAt(uint256 machineId, uint256 index) view returns ((uint256 machineId, uint8 eventType, uint256 value, uint256 timestamp, bytes32 dataHash, uint8 trustLevel, uint256 sourceChainId, bytes32 sourceTxHash, bytes metadata, string currency))',
  'function getEventCount(uint256 machineId) view returns (uint256)',
]);

export type AbiSet = { oracle: Abi; vault: Abi; router: Abi; nft: Abi; eventRegistry: Abi; peaqRegistry: Abi };

export const defaultAbis: AbiSet = {
  oracle: oracleAbi as Abi,
  vault: vaultAbi as Abi,
  router: routerAbi as Abi,
  nft: nftAbi as Abi,
  eventRegistry: eventRegistryAbi as Abi,
  peaqRegistry: peaqRegistryAbi as Abi,
};

const aliases: Record<keyof AbiSet, string[]> = {
  oracle: ['oracle', 'mcroracle', 'MCROracle'],
  vault: ['vault', 'skimvault', 'SkimVault'],
  router: ['router', 'revenuerouter', 'RevenueRouter'],
  nft: ['machineNft', 'nft', 'mockmachinenft', 'MockMachineNFT', 'machinenft'],
  eventRegistry: ['eventRegistry', 'mockeventregistry', 'MockEventRegistry', 'eventregistry'],
  peaqRegistry: ['PeaqEventRegistry', 'peaqEventRegistry'],
};

/** Merge external ABIs (abis.json or deployment.abis) over the hand-written ones. */
export function mergeAbis(external: unknown): AbiSet {
  const out: AbiSet = { ...defaultAbis };
  if (!external || typeof external !== 'object') return out;
  const ext = external as Record<string, unknown>;
  const lowered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ext)) lowered[k.toLowerCase()] = v;
  for (const key of Object.keys(aliases) as (keyof AbiSet)[]) {
    for (const name of aliases[key]) {
      let v = lowered[name.toLowerCase()];
      if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray((v as { abi?: unknown }).abi)) v = (v as { abi: unknown }).abi;
      if (Array.isArray(v) && v.length) {
        // keep our optional entries (e.g. terms()) that the external ABI may lack
        const names = new Set((v as { name?: string; type?: string }[]).map((e) => `${e.type}:${e.name}`));
        const extra = (defaultAbis[key] as readonly { name?: string; type?: string }[]).filter((e) => !names.has(`${e.type}:${e.name}`));
        out[key] = [...(v as unknown as Abi), ...(extra as unknown as Abi)] as Abi;
        break;
      }
    }
  }
  return out;
}
