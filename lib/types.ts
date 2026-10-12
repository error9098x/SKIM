export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export interface NetworkInfo {
  key: string; // agung | mainnet | local | demo
  name: string;
  chainId: number;
  rpc: string;
  explorer: string;
  token: string; // PEAQ | AGNG
  isMainnet: boolean;
}

export interface Contracts {
  vault?: Address;
  router?: Address;
  oracle?: Address;
  machineNft?: Address;
  eventRegistry?: Address;
}

export interface Deployment {
  chainId: number;
  rpc: string;
  explorer: string;
  contracts: Contracts;
  machineId: string;
  machineWallet?: Address;
  simulated: boolean;
  deployBlock?: number | string;
  abis?: Record<string, unknown>;
  network?: string;
}

export interface Rating {
  score: number;
  grade: number;
  updatedAt: number; // unix seconds
  simulated: boolean;
}

export interface Terms {
  grade: number;
  principal: bigint; // wei
  feeBps: number;
  skimBps: number;
}

export interface Loan {
  borrower: Address;
  machineWallet: Address;
  principal: bigint;
  owed: bigint;
  repaid: bigint;
  skimBps: number;
  openedAt: number;
  dueAt: number;
  status: number; // 0 none, 1 active, 2 repaid, 3 defaulted
}

export interface Verification {
  txHash?: Hex;
  trustLevel?: number;
  valueCents?: number;
}

export interface Session {
  key: string;
  txHash?: Hex;
  blockNumber?: bigint;
  sessionId: Hex;
  payer: Address;
  amount: bigint;
  skimmed: bigint;
  forwarded: bigint;
  timestamp?: number;
  verified: Verification | null;
}

export type ActivityKind = 'rating' | 'loan' | 'repaid' | 'closed' | 'deposit' | 'default' | 'nft';
export interface Activity {
  key: string;
  kind: ActivityKind;
  label: string;
  detail?: string;
  txHash?: Hex;
  timestamp?: number;
}

export interface SkimState {
  source: 'mock' | 'live';
  status: 'loading' | 'ok' | 'error';
  network: NetworkInfo;
  simulatedRating: boolean;
  machineId: string;
  machineWallet?: Address;
  contracts: Contracts;
  rating: Rating | null;
  mcr: { data: unknown; via: string; fetchedAt: number } | null;
  mcrError?: string;
  nftOwner?: Address;
  quote?: Terms;
  terms: Terms[];
  termsSource: 'chain' | 'spec';
  loan: Loan | null;
  sessions: Session[];
  closed: { txHash?: Hex; timestamp?: number } | null;
  vaultBalance?: bigint;
  activity: Activity[];
  blockNumber?: bigint;
  updatedAt: number;
  error?: string;
  demoPhase?: string;
}
