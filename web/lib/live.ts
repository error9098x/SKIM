// Live chain reader: incremental getLogs + view reads, polled by useSkim().
import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  http,
  type Abi,
  type AbiEvent,
  type Log,
  type PublicClient,
} from 'viem';
import { mergeAbis, type AbiSet } from './abis';
import { EVENT_REGISTRY_MAINNET, MCR_API, MCR_POLL_MS, NETWORKS, SPEC_TERMS } from './config';
import type { Activity, Address, Deployment, Hex, Loan, NetworkInfo, Rating, Session, SkimState, Terms } from './types';
import { fmtToken, pct } from './format';

const CHUNK = 5000n;
const LOOKBACK = 20000n;

type Decoded = { eventName: string; args: Record<string, unknown>; log: Log };

function asObj(r: unknown, keys: string[]): Record<string, unknown> {
  if (Array.isArray(r)) {
    if (r.length === 1 && typeof r[0] === 'object' && r[0] !== null) return asObj(r[0], keys);
    const o: Record<string, unknown> = {};
    keys.forEach((k, i) => (o[k] = r[i]));
    return o;
  }
  return (r ?? {}) as Record<string, unknown>;
}

/** Decode tolerant of an `indexed` layout that differs from our ABI. */
function tolerantDecode(abi: Abi, log: Log): Decoded | null {
  try {
    const d = decodeEventLog({ abi, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
    return { eventName: String(d.eventName), args: (d.args ?? {}) as Record<string, unknown>, log };
  } catch {
    const k = log.topics.length - 1;
    for (const item of abi) {
      if (item.type !== 'event') continue;
      const ev = item as AbiEvent;
      const variant: AbiEvent = { ...ev, inputs: ev.inputs.map((inp, i) => ({ ...inp, indexed: i < k })) };
      try {
        const d = decodeEventLog({ abi: [variant], data: log.data, topics: log.topics as [Hex, ...Hex[]] });
        return { eventName: String(d.eventName), args: (d.args ?? {}) as Record<string, unknown>, log };
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

const eqId = (a: unknown, id: bigint) => {
  try {
    return BigInt(a as bigint) === id;
  } catch {
    return false;
  }
};
const lc = (a?: string) => (a ?? '').toLowerCase();

export class LiveReader {
  dep: Deployment;
  net: NetworkInfo;
  client: PublicClient;
  abis: AbiSet;
  machineId: bigint;
  cursor: bigint | null = null;
  sessions = new Map<string, Session>();
  regLogs: Log[] = [];
  activity = new Map<string, Activity>();
  closed: SkimState['closed'] = null;
  blockTs = new Map<bigint, number>();
  terms: Terms[] | null = null;
  termsSource: 'chain' | 'spec' = 'spec';
  mcr: SkimState['mcr'] = null;
  mcrError?: string;
  lastMcr = 0;

  constructor(key: string, dep: Deployment, externalAbis?: unknown) {
    this.dep = dep;
    const base = NETWORKS[key] ?? NETWORKS.agung;
    this.net = {
      ...base,
      key,
      chainId: dep.chainId ?? base.chainId,
      rpc: process.env.NEXT_PUBLIC_RPC || dep.rpc || base.rpc,
      explorer: (dep.explorer || base.explorer).replace(/\/$/, ''),
      isMainnet: (dep.chainId ?? base.chainId) === 3338,
      token: (dep as { nativeSymbol?: string }).nativeSymbol || ((dep.chainId ?? base.chainId) === 3338 ? 'PEAQ' : base.token),
    };
    const chain = defineChain({
      id: this.net.chainId,
      name: this.net.name,
      nativeCurrency: { name: this.net.token, symbol: this.net.token, decimals: 18 },
      rpcUrls: { default: { http: [this.net.rpc] } },
    });
    this.client = createPublicClient({ chain, transport: http(this.net.rpc, { timeout: 15000, retryCount: 1 }) }) as PublicClient;
    this.abis = mergeAbis(externalAbis ?? dep.abis);
    this.machineId = BigInt(dep.machineId);
  }

  get registry(): Address | undefined {
    return (this.dep.contracts.eventRegistry as Address | undefined) ?? (this.net.isMainnet ? (EVENT_REGISTRY_MAINNET as Address) : undefined);
  }

  private async ts(block: bigint | null | undefined): Promise<number | undefined> {
    if (block === null || block === undefined) return undefined;
    if (this.blockTs.has(block)) return this.blockTs.get(block);
    try {
      const b = await this.client.getBlock({ blockNumber: block });
      const t = Number(b.timestamp);
      this.blockTs.set(block, t);
      return t;
    } catch {
      return undefined;
    }
  }

  private async scanLogs(latest: bigint) {
    const c = this.dep.contracts;
    const addrs = [c.vault, c.router, c.oracle, this.registry].filter(Boolean) as Address[];
    if (this.cursor === null) {
      const db = this.dep.deployBlock !== undefined ? BigInt(this.dep.deployBlock) : latest > LOOKBACK ? latest - LOOKBACK : 0n;
      this.cursor = db;
    }
    let from = this.cursor;
    const out: Log[] = [];
    while (from <= latest) {
      const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
      const logs = await this.client.getLogs({ address: addrs, fromBlock: from, toBlock: to });
      out.push(...logs);
      from = to + 1n;
    }
    this.cursor = latest + 1n;
    return out;
  }

  private async ingest(logs: Log[]) {
    const c = this.dep.contracts;
    const id = this.machineId;
    for (const log of logs) {
      const addr = lc(log.address);
      if (addr === lc(this.registry)) {
        this.regLogs.push(log);
        continue;
      }
      const abi = addr === lc(c.vault) ? this.abis.vault : addr === lc(c.router) ? this.abis.router : addr === lc(c.oracle) ? this.abis.oracle : null;
      if (!abi) continue;
      const d = tolerantDecode(abi, log);
      if (!d) continue;
      const a = d.args;
      const key = `${log.transactionHash}:${log.logIndex}`;
      const txHash = log.transactionHash as Hex;
      const timestamp = await this.ts(log.blockNumber);
      const tok = this.net.token;
      switch (d.eventName) {
        case 'RevenueRouted':
          if (!eqId(a.machineId, id)) break;
          this.sessions.set(key, {
            key,
            txHash,
            blockNumber: log.blockNumber ?? undefined,
            sessionId: a.sessionId as Hex,
            payer: a.payer as Address,
            amount: BigInt(a.amount as bigint),
            skimmed: BigInt(a.skimmed as bigint),
            forwarded: BigInt(a.forwarded as bigint),
            timestamp,
            verified: null,
          });
          break;
        case 'RatingPosted':
          if (!eqId(a.machineId, id)) break;
          this.activity.set(key, {
            key,
            kind: 'rating',
            label: `Rating posted: ${['Provisioned', 'B', 'BB', 'BBB', 'A', 'AA', 'AAA'][Number(a.grade)] ?? a.grade}`,
            detail: `score ${a.score}${a.simulated ? ' · simulated' : ''}`,
            txHash,
            timestamp,
          });
          break;
        case 'LoanOpened':
          if (!eqId(a.machineId, id)) break;
          this.activity.set(key, {
            key,
            kind: 'loan',
            label: `Advance of ${fmtToken(BigInt(a.principal as bigint), 2)} ${tok} sent to machine wallet`,
            detail: `owed ${fmtToken(BigInt(a.owed as bigint), 2)} · skim ${pct(Number(a.skimBps))} · NFT escrowed`,
            txHash,
            timestamp,
          });
          this.closed = null;
          break;
        case 'LoanClosed':
          if (!eqId(a.machineId, id)) break;
          this.activity.set(key, { key, kind: 'closed', label: 'Loan closed, NFT returned to machine', txHash, timestamp });
          this.closed = { txHash, timestamp };
          break;
        case 'Defaulted':
          if (!eqId(a.machineId, id)) break;
          this.activity.set(key, { key, kind: 'default', label: 'Loan defaulted, vault keeps NFT', txHash, timestamp });
          break;
        case 'Deposited':
          this.activity.set(key, {
            key,
            kind: 'deposit',
            label: `Lender deposit ${fmtToken(BigInt(a.amount as bigint), 2)} ${tok}`,
            detail: `${String(a.lender).slice(0, 8)}…`,
            txHash,
            timestamp,
          });
          break;
      }
    }
    await this.resolvePeaqRegistry();
    this.matchVerifications();
  }

  /** sourceTxHash -> verification, filled from peaq EventRegistry 2.0 via getEventAt */
  private bySource = new Map<string, { txHash: Hex; trustLevel?: number; valueCents?: number }>();
  private seenReg = new Set<string>();

  private async resolvePeaqRegistry() {
    const reg = this.registry;
    if (!reg) return;
    for (const log of this.regLogs) {
      const k = `${log.transactionHash}:${log.logIndex}`;
      if (this.seenReg.has(k)) continue;
      this.seenReg.add(k);
      // mock registry: sourceTxHash is in the log itself
      const m = tolerantDecode(this.abis.eventRegistry, log);
      if (m && m.args.sourceTxHash) {
        if (!eqId(m.args.machineId, this.machineId)) continue;
        this.bySource.set(String(m.args.sourceTxHash).toLowerCase(), {
          txHash: log.transactionHash as Hex,
          trustLevel: m.args.trustLevel !== undefined ? Number(m.args.trustLevel) : undefined,
          valueCents: m.args.value !== undefined ? Number(m.args.value) : undefined,
        });
        continue;
      }
      // peaq EventRegistry 2.0: read the stored event to get sourceTxHash
      const p = tolerantDecode(this.abis.peaqRegistry, log);
      if (!p || !eqId(p.args.machineId, this.machineId) || p.args.eventIndex === undefined) continue;
      const ev = await this.read<unknown>(reg, this.abis.peaqRegistry, 'getEventAt', [this.machineId, BigInt(p.args.eventIndex as bigint)]);
      if (!ev) {
        this.seenReg.delete(k); // retry next poll
        continue;
      }
      const o = asObj(ev, ['machineId', 'eventType', 'value', 'timestamp', 'dataHash', 'trustLevel', 'sourceChainId', 'sourceTxHash', 'metadata', 'currency']);
      if (o.sourceTxHash)
        this.bySource.set(String(o.sourceTxHash).toLowerCase(), {
          txHash: log.transactionHash as Hex,
          trustLevel: Number(o.trustLevel),
          valueCents: Number(o.value),
        });
    }
  }

  /** A session is "verified" when an EventRegistry entry cites its router tx hash as sourceTxHash. */
  private matchVerifications() {
    for (const s of this.sessions.values()) {
      if (s.verified || !s.txHash) continue;
      const v = this.bySource.get(s.txHash.toLowerCase());
      if (v) {
        s.verified = { txHash: v.txHash, trustLevel: v.trustLevel ?? 1, valueCents: v.valueCents };
        continue;
      }
      // signature-agnostic fallback: tx hash appears raw in a registry log
      const needle = s.txHash.slice(2).toLowerCase();
      const hit = this.regLogs.find((l) => l.data.toLowerCase().includes(needle) || l.topics.some((t) => t && t.toLowerCase().includes(needle)));
      if (hit) s.verified = { txHash: hit.transactionHash as Hex, trustLevel: 1 };
    }
  }

  private async read<T>(address: Address | undefined, abi: Abi, functionName: string, args: unknown[] = []): Promise<T | undefined> {
    if (!address) return undefined;
    try {
      return (await this.client.readContract({ address, abi, functionName, args })) as T;
    } catch {
      return undefined;
    }
  }

  private async loadTerms(): Promise<void> {
    if (this.terms) return;
    const vault = this.dep.contracts.vault as Address;
    const toTerms = (r: unknown, g: number): Terms => {
      const o = asObj(r, ['principal', 'feeBps', 'skimBps']);
      return { grade: g, principal: BigInt(o.principal as bigint), feeBps: Number(o.feeBps), skimBps: Number(o.skimBps) };
    };
    const all = await this.read<unknown[]>(vault, this.abis.vault, 'allTerms');
    if (Array.isArray(all) && all.length >= 7) {
      const arr = (all.length === 1 && Array.isArray(all[0]) ? all[0] : all) as unknown[];
      this.terms = arr.map((r, g) => toTerms(r, g));
      this.termsSource = 'chain';
      return;
    }
    const rows = await Promise.all(SPEC_TERMS.map((t) => this.read<unknown>(vault, this.abis.vault, 'termsFor', [t.grade])));
    if (rows.every((r) => r !== undefined)) {
      this.terms = rows.map((r, g) => toTerms(r, g));
      this.termsSource = 'chain';
    }
  }

  private async loadMcr() {
    if (!this.net.isMainnet) return;
    if (Date.now() - this.lastMcr < MCR_POLL_MS && this.mcr) return;
    this.lastMcr = Date.now();
    const path = `/mcr/did:peaq:${this.dep.machineId}`;
    const tries: [string, string][] = [
      [`${MCR_API}${path}`, 'mcr.peaq.xyz'],
      [`/mcr-proxy${path}`, 'mcr.peaq.xyz via proxy'],
    ];
    for (const [url, via] of tries) {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) continue;
        const data = await r.json();
        this.mcr = { data, via, fetchedAt: Date.now() };
        this.mcrError = undefined;
        return;
      } catch {
        /* CORS or offline: next */
      }
    }
    try {
      const r = await fetch('/deployments/mcr-snapshot.json', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        this.mcr = { data: j.data, via: `build-time snapshot (${j.fetchedAt})`, fetchedAt: Date.parse(j.fetchedAt) };
        return;
      }
    } catch {
      /* ignore */
    }
    this.mcrError = 'MCR API not reachable from this browser; showing the on-chain oracle value posted by the keeper.';
  }

  async poll(): Promise<SkimState> {
    const c = this.dep.contracts;
    const id = this.machineId;
    const latest = await this.client.getBlockNumber();
    const logs = await this.scanLogs(latest);
    await this.ingest(logs);
    await this.loadTerms();
    const [ratingR, quoteR, loanR, owner, bal] = await Promise.all([
      this.read<unknown>(c.oracle, this.abis.oracle, 'getRating', [id]),
      this.read<unknown>(c.vault, this.abis.vault, 'quote', [id]),
      this.read<unknown>(c.vault, this.abis.vault, 'loans', [id]),
      this.read<Address>(c.machineNft, this.abis.nft, 'ownerOf', [id]),
      this.read<bigint>(c.vault, this.abis.vault, 'availableLiquidity').then((v) =>
        v !== undefined || !c.vault ? v : this.client.getBalance({ address: c.vault as Address }).catch(() => undefined),
      ),
      this.loadMcr(),
    ]);

    let rating: Rating | null = null;
    if (ratingR !== undefined) {
      const o = asObj(ratingR, ['score', 'grade', 'updatedAt', 'simulated']);
      rating = { score: Number(o.score), grade: Number(o.grade), updatedAt: Number(o.updatedAt), simulated: Boolean(o.simulated) };
      if (rating.updatedAt === 0) rating = null;
    }
    let quote: Terms | undefined;
    if (quoteR !== undefined) {
      const o = asObj(quoteR, ['principal', 'feeBps', 'skimBps', 'grade']);
      quote = { principal: BigInt(o.principal as bigint), feeBps: Number(o.feeBps), skimBps: Number(o.skimBps), grade: Number(o.grade) };
    }
    let loan: Loan | null = null;
    if (loanR !== undefined) {
      const o = asObj(loanR, ['borrower', 'machineWallet', 'principal', 'owed', 'repaid', 'skimBps', 'openedAt', 'dueAt', 'status']);
      const status = Number(o.status);
      if (status !== 0)
        loan = {
          borrower: o.borrower as Address,
          machineWallet: o.machineWallet as Address,
          principal: BigInt(o.principal as bigint),
          owed: BigInt(o.owed as bigint),
          repaid: BigInt(o.repaid as bigint),
          skimBps: Number(o.skimBps),
          openedAt: Number(o.openedAt),
          dueAt: Number(o.dueAt),
          status,
        };
    }

    // terms curve: on-chain if exposed, else spec table (scaled to the live quote when it differs)
    let terms = this.terms ?? SPEC_TERMS;
    if (!this.terms && quote) {
      const spec = SPEC_TERMS[quote.grade];
      if (spec && spec.principal !== quote.principal && quote.principal > 0n) {
        terms = SPEC_TERMS.map((t) => ({ ...t, principal: (t.principal * quote!.principal) / spec.principal }));
      }
    }

    const sessions = [...this.sessions.values()].sort((a, b) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n)) || b.key.localeCompare(a.key));
    const activity = [...this.activity.values()].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    return {
      source: 'live',
      status: 'ok',
      network: this.net,
      simulatedRating: rating ? rating.simulated : this.dep.simulated,
      machineId: this.dep.machineId,
      machineWallet: (loan?.machineWallet ?? this.dep.machineWallet) as Address | undefined,
      contracts: { ...c, eventRegistry: this.registry },
      rating,
      mcr: this.mcr,
      mcrError: this.mcrError,
      nftOwner: owner,
      quote,
      terms,
      termsSource: this.terms ? 'chain' : 'spec',
      loan,
      sessions,
      closed: loan?.status === 2 ? (this.closed ?? { txHash: undefined }) : this.closed,
      vaultBalance: bal,
      activity,
      blockNumber: latest,
      updatedAt: Date.now(),
    };
  }
}
