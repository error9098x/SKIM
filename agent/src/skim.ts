// Core SKIM actions shared by keeper.ts, simulator.ts and demo.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeEventLog, formatEther, keccak256, parseAbiItem, toHex, type Address, type Hex, type Log } from "viem";
import {
  abis,
  fmt,
  GRADES,
  gradeFromMcr,
  log,
  peaqUsd,
  simulatedRating,
  txUrl,
  amountLabel,
  weiToUsdCents,
  weiToUsdMicro,
  type Clients,
  type Deployment,
} from "./lib.js";
import { eventSignerKey, sdkClient } from "./peaq.js";

const here = dirname(fileURLToPath(import.meta.url));

export const REVENUE_ROUTED = parseAbiItem(
  "event RevenueRouted(uint256 indexed machineId, address indexed payer, bytes32 indexed sessionId, uint256 amount, uint256 skimmed, uint256 forwarded)",
);

export const MOCK_EVENT_SUBMITTED = parseAbiItem(
  "event EventSubmitted(uint256 indexed machineId, uint8 eventType, uint256 value, string currency, uint64 timestamp, uint8 trustLevel, bytes32 indexed sourceTxHash)",
);

export interface LoanView {
  borrower: Address;
  machineWallet: Address;
  principal: bigint;
  owed: bigint;
  repaid: bigint;
  skimBps: number;
  openedAt: bigint;
  dueAt: bigint;
  status: number;
}
export const STATUS = ["none", "active", "repaid", "defaulted"];

export class Skim {
  constructor(
    public c: Clients,
    public d: Deployment,
    public machineId: bigint,
  ) {}

  get p() {
    return this.c.p;
  }

  private async write(role: Parameters<Clients["wallet"]>[0], address: Address, abi: unknown, functionName: string, args: unknown[], value?: bigint) {
    const w = this.c.wallet(role);
    const hash = await w.writeContract({ address, abi, functionName, args, value } as never);
    const r = await this.c.pub.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`${functionName} reverted: ${hash}`);
    return { hash, receipt: r };
  }

  // ---------------------------------------------------------------- reads
  async loan(): Promise<LoanView> {
    return (await this.c.pub.readContract({
      address: this.d.contracts.vault,
      abi: abis.vault,
      functionName: "getLoan",
      args: [this.machineId],
    })) as LoanView;
  }
  async rating() {
    return (await this.c.pub.readContract({
      address: this.d.contracts.oracle,
      abi: abis.oracle,
      functionName: "getRating",
      args: [this.machineId],
    })) as { score: number; grade: number; updatedAt: bigint; simulated: boolean };
  }
  async quote() {
    const [principal, feeBps, skimBps, grade] = (await this.c.pub.readContract({
      address: this.d.contracts.vault,
      abi: abis.vault,
      functionName: "quote",
      args: [this.machineId],
    })) as [bigint, number, number, number];
    return { principal, feeBps, skimBps, grade };
  }
  async nftOwner(): Promise<Address> {
    return (await this.c.pub.readContract({
      address: this.d.contracts.machineNft,
      abi: abis.machineNft,
      functionName: "ownerOf",
      args: [this.machineId],
    })) as Address;
  }
  /** Revenue events that count toward the SIMULATED rating.
   *  MockEventRegistry.submitEvent is permissionless (like a public sink), so its raw
   *  revenueEventCount(machineId) can be inflated by anyone spamming fake events for our machine.
   *  We only count trust-level-1 revenue events whose sourceTxHash is a real RevenueRouter payment
   *  for this machine (security review 2026-10-12, finding F1). */
  async revenueEventCount(maxRange = 2000n): Promise<number> {
    if (!this.d.eventRegistryIsMock) return -1;
    const latest = await this.c.pub.getBlockNumber();
    const routed = new Set<string>();
    const cited: { src: string; trust: number; type: number }[] = [];
    for (let from = BigInt(this.d.deployBlock); from <= latest; from += maxRange) {
      const to = from + maxRange - 1n > latest ? latest : from + maxRange - 1n;
      const [r, e] = await Promise.all([
        this.c.pub.getLogs({ address: this.d.contracts.router, event: REVENUE_ROUTED, args: { machineId: this.machineId }, fromBlock: from, toBlock: to }),
        this.c.pub.getLogs({ address: this.d.contracts.eventRegistry, event: MOCK_EVENT_SUBMITTED, args: { machineId: this.machineId }, fromBlock: from, toBlock: to }),
      ]);
      for (const l of r) routed.add(l.transactionHash!.toLowerCase());
      for (const l of e) {
        const a = l.args as { sourceTxHash: Hex; trustLevel: number; eventType: number };
        cited.push({ src: a.sourceTxHash.toLowerCase(), trust: Number(a.trustLevel), type: Number(a.eventType) });
      }
    }
    // registry dedupes sourceTxHash, so each routed payment counts at most once
    return cited.filter((x) => x.type === 0 && x.trust === 1 && routed.has(x.src)).length;
  }

  async printStatus(tag = "status") {
    const [l, r, q, owner] = await Promise.all([this.loan(), this.rating(), this.quote(), this.nftOwner()]);
    const sym = this.p.nativeSymbol;
    const who = owner.toLowerCase() === this.d.contracts.vault.toLowerCase() ? "SkimVault (escrow)" : owner;
    log(tag, `machine did:peaq:${this.machineId}`);
    log(tag, `rating  ${GRADES[r.grade]} score=${r.score}${r.simulated ? " [SIMULATED]" : ""}  -> quote ${fmt(q.principal, sym)} fee ${q.feeBps / 100}% skim ${q.skimBps / 100}%`);
    log(tag, `loan    ${STATUS[l.status]}  repaid ${fmt(l.repaid, sym)} / owed ${fmt(l.owed, sym)}  NFT owner: ${who}`);
  }

  // ---------------------------------------------------------------- oracle (keeper)
  async postRating(score: number, grade: number, simulated: boolean) {
    const { hash } = await this.write("keeper", this.d.contracts.oracle, abis.oracle, "post", [this.machineId, score, grade, simulated]);
    log("oracle", `posted ${GRADES[grade]} (score ${score})${simulated ? " SIMULATED" : " from live MCR"}  ${txUrl(this.p, hash)}`);
    return hash;
  }

  /** Mainnet: relay live MCR. Simulated: derive from trust-1 revenue event count. Posts only on change. */
  async refreshRating(force = false) {
    let score: number, grade: number, simulated: boolean;
    if (this.d.simulated || !this.d.mcrApi) {
      const n = await this.revenueEventCount();
      ({ score, grade } = simulatedRating(Math.max(0, n)));
      simulated = true;
    } else {
      const url = `${this.d.mcrApi}/mcr/did:peaq:${this.machineId}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`MCR ${res.status}: ${await res.text()}`);
      const j = (await res.json()) as { mcr: string; mcr_score: number; revenue_event_count?: number; total_revenue?: number };
      score = Math.max(0, Math.min(100, Math.round(j.mcr_score)));
      grade = gradeFromMcr(j.mcr);
      simulated = false;
      log("mcr", `live MCR ${j.mcr} score=${j.mcr_score} revenueEvents=${j.revenue_event_count} totalRevenue=$${((j.total_revenue ?? 0) / 100).toFixed(2)}`);
    }
    const cur = await this.rating();
    if (!force && cur.updatedAt > 0n && cur.score === score && cur.grade === grade && cur.simulated === simulated) return null;
    return this.postRating(score, grade, simulated);
  }

  // ---------------------------------------------------------------- borrower (operator)
  async openLoan(termSeconds: bigint) {
    const owner = await this.nftOwner();
    const op = this.c.wallet("operator").account.address;
    if (owner.toLowerCase() !== op.toLowerCase()) throw new Error(`operator ${op} does not own machine NFT (owner ${owner})`);
    const approved = (await this.c.pub.readContract({
      address: this.d.contracts.machineNft,
      abi: abis.machineNft,
      functionName: "getApproved",
      args: [this.machineId],
    })) as Address;
    if (approved.toLowerCase() !== this.d.contracts.vault.toLowerCase()) {
      const { hash } = await this.write("operator", this.d.contracts.machineNft, abis.machineNft, "approve", [this.d.contracts.vault, this.machineId]);
      log("borrower", `approved vault for NFT  ${txUrl(this.p, hash)}`);
    }
    const { hash } = await this.write("operator", this.d.contracts.vault, abis.vault, "openLoan", [this.machineId, this.d.machineWallet, termSeconds]);
    const l = await this.loan();
    log("borrower", `LOAN OPENED: NFT escrowed, ${fmt(l.principal, this.p.nativeSymbol)} advanced to ${l.machineWallet}; owes ${fmt(l.owed, this.p.nativeSymbol)}, skim ${l.skimBps / 100}%  ${txUrl(this.p, hash)}`);
    return hash;
  }

  // ---------------------------------------------------------------- charger (customer)
  async paySession(value: bigint, label?: string) {
    const sessionId = keccak256(toHex(`${label ?? "session"}:${Date.now()}:${Math.random()}`)) as Hex;
    const { hash, receipt } = await this.write("customer", this.d.contracts.router, abis.router, "pay", [this.machineId, this.d.machineWallet, sessionId], value);
    const ev = receipt.logs
      .filter((l) => l.address.toLowerCase() === this.d.contracts.router.toLowerCase())
      .map((l) => decodeRouted(l))
      .find(Boolean);
    return { hash, sessionId, skimmed: ev?.skimmed ?? 0n, forwarded: ev?.forwarded ?? value, block: receipt.blockNumber };
  }

  // ---------------------------------------------------------------- keeper: revenue events
  statePath() {
    const dir = join(here, "../.state");
    mkdirSync(dir, { recursive: true });
    return join(dir, `keeper-${this.d.network}-${this.d.contracts.router.toLowerCase()}.json`);
  }
  loadState(): { lastBlock: number; submitted: Record<string, string> } {
    const f = this.statePath();
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
    return { lastBlock: this.d.deployBlock - 1, submitted: {} };
  }
  saveState(s: { lastBlock: number; submitted: Record<string, string> }) {
    writeFileSync(this.statePath(), JSON.stringify(s, null, 2));
  }

  /** Scan RevenueRouted since the last processed block and submit one trust-1 revenue event per router tx. */
  async processRevenue(maxRange = 2000n) {
    const st = this.loadState();
    const latest = await this.c.pub.getBlockNumber();
    let from = BigInt(st.lastBlock + 1);
    let submitted = 0;
    while (from <= latest) {
      const to = from + maxRange - 1n > latest ? latest : from + maxRange - 1n;
      const logs = await this.c.pub.getLogs({
        address: this.d.contracts.router,
        event: REVENUE_ROUTED,
        args: { machineId: this.machineId },
        fromBlock: from,
        toBlock: to,
      });
      for (const lg of logs) {
        const tx = lg.transactionHash!;
        if (st.submitted[tx]) continue;
        const evTx = await this.submitRevenueEvent(lg as never);
        st.submitted[tx] = evTx ?? "skipped";
        submitted++;
        this.saveState({ ...st, lastBlock: Number(lg.blockNumber) - 1 });
      }
      st.lastBlock = Number(to);
      this.saveState(st);
      from = to + 1n;
    }
    return submitted;
  }

  async submitRevenueEvent(lg: Log<bigint, number, false, typeof REVENUE_ROUTED>): Promise<string | null> {
    const { amount, skimmed, forwarded, sessionId, payer } = lg.args as {
      amount: bigint;
      skimmed: bigint;
      forwarded: bigint;
      sessionId: Hex;
      payer: Address;
    };
    const routerTx = lg.transactionHash as Hex;
    const block = await this.c.pub.getBlock({ blockNumber: lg.blockNumber! });
    const ts = Number(block.timestamp);
    const usd = await peaqUsd();
    const cents = weiToUsdCents(amount, usd);
    const sym = this.p.nativeSymbol;
    const amt = amountLabel(amount, usd, sym);
    // on-chain value stays ISO-4217 minor units (USD cents) like peaq's EventRegistry; the exact native
    // amount and micro-dollar value ride in metadata so a sub-cent testnet session never reads "$0.00".
    const centsNote = cents >= 1 ? `${cents}¢` : `value field 0¢ (sub-cent testnet session)`;
    const meta = { app: "skim", routerTx, sessionId, payer, amountWei: amount.toString(), amountNative: formatEther(amount), nativeSymbol: sym, usdMicro: weiToUsdMicro(amount, usd), skimmedWei: skimmed.toString(), forwardedWei: forwarded.toString(), peaqUsd: usd };

    if (this.d.eventRegistryIsMock) {
      const already = (await this.c.pub.readContract({
        address: this.d.contracts.eventRegistry,
        abi: abis.eventRegistry,
        functionName: "sourceTxRecorded",
        args: [routerTx],
      })) as boolean;
      if (already) return "already-recorded";
      const { hash } = await this.write("keeper", this.d.contracts.eventRegistry, abis.eventRegistry, "submitEvent", [
        this.machineId, 0, BigInt(cents), "USD", BigInt(ts), 1, routerTx, JSON.stringify({ ...meta, simulated: true }),
      ]);
      log("keeper", `revenue event (SIMULATED registry) ${amt} [${centsNote}] skim ${fmt(skimmed, sym)} payer ${payer.slice(0, 6)}…${payer.slice(-4)} trust=1 cites router tx ${routerTx.slice(0, 10)}…  ${txUrl(this.p, hash)}`);
      return hash;
    }

    // ---- peaq mainnet: Economics 2.0 EventRegistry via the peaqOS SDK
    if (cents < 1000) log("keeper", `WARNING: ${amt} < $10; the MCR ignores revenue events under 1,000 USD cents`);
    const { sdk, client } = await sdkClient(this.p, eventSignerKey());
    const params = {
      machineId: this.machineId,
      eventType: sdk.EVENT_TYPE_REVENUE,
      value: cents,
      currency: "USD",
      timestamp: ts,
      rawData: new TextEncoder().encode(JSON.stringify(meta)),
      trustLevel: sdk.TRUST_ON_CHAIN_VERIFIABLE,
      sourceChainId: sdk.SUPPORTED_CHAIN_IDS.peaq,
      sourceTxHash: routerTx,
      metadata: new TextEncoder().encode(JSON.stringify({ app: "skim", routerTx })),
    };
    sdk.validateSubmitEventParams(params as never);
    const { txHash, dataHash } = await client.submitEvent(params as never);
    log("keeper", `revenue event (peaq EventRegistry 2.0) ${amt} [${cents}¢] trust=1 cites ${routerTx.slice(0, 10)}…  ${txUrl(this.p, txHash)} dataHash=${dataHash.slice(0, 10)}…`);
    return txHash;
  }
}

export function decodeRouted(l: { topics: readonly Hex[]; data: Hex }) {
  try {
    const d = decodeEventLog({ abi: [REVENUE_ROUTED], topics: l.topics as never, data: l.data });
    return d.args as unknown as { amount: bigint; skimmed: bigint; forwarded: bigint };
  } catch {
    return null;
  }
}
