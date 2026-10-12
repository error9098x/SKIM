// Deterministic demo replay driven by data/mock-state.json.
// stateAt(elapsedMs) returns the full SkimState for that moment of the loop.
import { keccak256, parseEther, toHex, type Hex } from 'viem';
import mock from '@/data/mock-state.json';
import { DEMO_NETWORK, SPEC_TERMS } from './config';
import type { Activity, Address, Loan, Session, SkimState } from './types';

const T = mock.timing;
const fakeHash = (s: string): Hex => keccak256(toHex(`skim-demo:${s}`));

const terms = SPEC_TERMS;
const startTerms = terms[mock.ratingStart.grade];
const principal = startTerms.principal;
const owed = (principal * BigInt(10000 + startTerms.feeBps)) / 10000n;
const skimBps = startTerms.skimBps;

interface Planned {
  at: number;
  amount: bigint;
  skimmed: bigint;
  forwarded: bigint;
  repaidAfter: bigint;
}

// Precompute the session schedule until the loan is repaid
const plan: Planned[] = [];
{
  let repaid = 0n;
  for (let i = 0; i < 200 && repaid < owed; i++) {
    const amt = parseEther(mock.sessionsPeaq[i % mock.sessionsPeaq.length]);
    const skim = (amt * BigInt(skimBps)) / 10000n;
    const applied = skim > owed - repaid ? owed - repaid : skim;
    repaid += applied;
    plan.push({ at: T.openAfterMs + (i + 1) * T.sessionEveryMs, amount: amt, skimmed: skim, forwarded: amt - skim, repaidAfter: repaid });
  }
}
const closeAt = plan[plan.length - 1].at + T.closeAfterMs;
const upgradeAt = closeAt + T.upgradeAfterMs;
export const LOOP_MS = closeAt + T.holdAfterCloseMs;

export function mockStateAt(elapsedMs: number, cycleStartSec: number): SkimState {
  const t = elapsedMs;
  const ts = (ms: number) => Math.floor(cycleStartSec + ms / 1000);
  const borrower = mock.borrower as Address;
  const vault = mock.contracts.vault as Address;
  const activity: Activity[] = [];

  activity.push({ key: 'r0', kind: 'rating', label: 'Rating posted: Provisioned', detail: 'score 0 · starter line unlocked', txHash: fakeHash('rating0'), timestamp: ts(0) });

  const opened = t >= T.openAfterMs;
  const closed = t >= closeAt;
  const upgraded = t >= upgradeAt;

  const sessions: Session[] = [];
  let repaid = 0n;
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    if (t < p.at) break;
    repaid = p.repaidAfter;
    const txHash = fakeHash(`session${i}`);
    sessions.push({
      key: `s${i}`,
      txHash,
      sessionId: fakeHash(`sid${i}`),
      payer: '0x8c2F1b6E0d9A4c7B3e5F2a1D8b0C6e9F4a7D2B15',
      amount: p.amount,
      skimmed: p.skimmed,
      forwarded: p.forwarded,
      timestamp: ts(p.at),
      verified: t >= p.at + T.verifyAfterMs ? { txHash: fakeHash(`ev${i}`), trustLevel: 1, valueCents: Math.round(Number(p.amount) / 1e18 * mock.peaqUsd * 100) } : null,
    });
  }
  sessions.reverse();

  if (opened) {
    activity.push({ key: 'nft-in', kind: 'nft', label: 'Machine NFT escrowed in vault', txHash: fakeHash('open'), timestamp: ts(T.openAfterMs) });
    activity.push({ key: 'open', kind: 'loan', label: 'Advance of 1.00 sent to machine wallet', detail: 'owed 1.10 · skim 30%', txHash: fakeHash('open'), timestamp: ts(T.openAfterMs) });
  }
  if (closed) {
    activity.push({ key: 'closed', kind: 'closed', label: 'Loan closed, NFT returned to machine', txHash: fakeHash('close'), timestamp: ts(closeAt) });
  }
  if (upgraded) {
    activity.push({ key: 'r1', kind: 'rating', label: 'Rating upgraded: B', detail: `score ${mock.ratingAfterPayoff.score} · next line 2.00`, txHash: fakeHash('rating1'), timestamp: ts(upgradeAt) });
  }
  activity.reverse();

  const loan: Loan | null = opened
    ? {
        borrower,
        machineWallet: mock.machineWallet as Address,
        principal,
        owed,
        repaid,
        skimBps,
        openedAt: ts(T.openAfterMs),
        dueAt: ts(T.openAfterMs) + mock.termDays * 86400,
        status: closed ? 2 : 1,
      }
    : null;

  const ratingNow = upgraded ? mock.ratingAfterPayoff : mock.ratingStart;
  const quote = terms[ratingNow.grade];
  const liquidity = parseEther(mock.vaultLiquidity) - (opened ? principal : 0n) + repaid;

  let phase = 'Rated Provisioned · starter line available';
  if (opened && !closed) phase = sessions.length ? `Repaying from revenue · session ${sessions.length}` : 'Advance sent · waiting for first session';
  if (closed) phase = upgraded ? 'Repaid · rating upgraded to B' : 'Repaid · NFT returned';

  return {
    source: 'mock',
    status: 'ok',
    network: DEMO_NETWORK,
    simulatedRating: true,
    machineId: mock.machineId,
    machineWallet: mock.machineWallet as Address,
    contracts: mock.contracts as SkimState['contracts'],
    rating: { ...ratingNow, updatedAt: ts(upgraded ? upgradeAt : 0), simulated: true },
    mcr: null,
    nftOwner: opened && !closed ? vault : borrower,
    quote,
    terms,
    termsSource: 'spec',
    loan,
    sessions,
    closed: closed ? { txHash: fakeHash('close'), timestamp: ts(closeAt) } : null,
    vaultBalance: liquidity,
    activity,
    updatedAt: Date.now(),
    demoPhase: phase,
  };
}

export const mockBorrower = mock.borrower as Address;
