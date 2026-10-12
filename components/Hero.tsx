'use client';
import { useEffect, useState } from 'react';
import type { SkimState } from '@/lib/types';
import { gradeName } from '@/lib/config';
import { fmtToken, pct, ratio, shortId, addrUrl } from '@/lib/format';
import { GradeBadge } from './ui';
import { FlowStrip } from './Flow';
import { hasLoan, isDemo, isRepaid, loanFeeBps, loanGrade, nextLine, nftInVault, payoffSegments, realHref, unitLabel } from './view';

export function loopStep(s: SkimState): number {
  if (isRepaid(s)) return 4;
  if (!hasLoan(s)) return 0;
  if (s.sessions.length === 0) return 2;
  return 3;
}

const STEPS = [
  { t: 'Escrow NFT', d: 'Machine NFT locks in the vault as collateral.' },
  { t: 'Advance', d: 'Principal sized by MCR lands in the machine wallet.' },
  { t: 'Skim revenue', d: 'Every charging payment routes a share to repay.' },
  { t: 'NFT returned', d: 'Fully repaid: the NFT goes back to the operator.' },
];

export function LoopSteps({ state }: { state: SkimState }) {
  const step = loopStep(state);
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-rule bg-rule md:grid-cols-4">
      {STEPS.map((s, i) => {
        const n = i + 1;
        // step: 0 offer, 2 advance sent, 3 skimming, 4 returned
        const active = step === 0 ? n === 1 : step === 4 ? n === 4 : n === 3;
        const done = step === 4 ? true : step >= 2 && n <= 2;
        const final = step === 4 && n === 4;
        return (
          <li key={s.t} className={`relative p-4 sm:p-5 ${active ? 'bg-paper-2' : 'bg-paper'}`}>
            <div className="flex items-center gap-2">
              <span
                className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] transition-colors duration-300 ${
                  final ? 'border-repaid bg-repaid/10 text-repaid-text' : active ? 'border-ink bg-ink text-paper' : done ? 'border-ink-3 text-ink-2' : 'border-rule text-ink-3'
                }`}
              >
                {done && (!active || step === 4) ? '✓' : n}
              </span>
              <span className={`text-sm font-medium ${active || done ? 'text-ink' : 'text-ink-2'}`}>{s.t}</span>
              {i < 3 && <span className="ml-auto hidden text-ink-3 md:inline">→</span>}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{s.d}</p>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Count of payoff segments the TEXT may describe. Increases land 520ms late, the same delay as
 * `.seg-in`, so the label / % / big number move together with the segment (never one ahead).
 * Decreases (replay reset) and reduced-motion snap immediately.
 */
const SEG_DELAY_MS = 520;
function useShownSegs(n: number): number {
  const [shown, setShown] = useState(n);
  useEffect(() => {
    if (n <= shown) {
      if (n !== shown) setShown(n);
      return;
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(n);
      return;
    }
    const t = window.setTimeout(() => setShown(n), SEG_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [n, shown]);
  return Math.min(shown, n);
}

/** Payoff bar: one segment per session, each as wide as what that session repaid (capped). Σ segments = repaid. */
function PayoffBar({ state, repaid, shownN, shownRepaid }: { state: SkimState; repaid: boolean; shownN: number; shownRepaid: bigint }) {
  const loan = hasLoan(state) ? state.loan : null;
  const segs = payoffSegments(state);
  const owed = loan?.owed ?? 0n;
  const progress = loan ? Math.min(1, ratio(shownRepaid, loan.owed)) : 0;
  return (
    <div>
      <div className="flex h-5 items-center justify-between gap-3 text-[12px] leading-5">
        <span className="truncate text-ink-2">
          {loan ? `Repaid by ${shownN} session${shownN === 1 ? '' : 's'} · one segment each` : 'Payoff bar fills one segment per session'}
        </span>
        <span className={`num shrink-0 ${repaid ? 'text-repaid-text' : 'text-ink'}`}>{Math.round(progress * 100)}%</span>
      </div>
      <div
        className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-rule"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Repaid of owed"
      >
        {segs.map((sg, i) => (
          <span
            key={sg.key}
            className={`h-full shrink-0 transition-colors duration-300 ${i === segs.length - 1 && !repaid ? 'seg-in' : ''} ${repaid ? 'bg-repaid' : 'bg-skim'}`}
            style={{ width: `${owed ? ratio(sg.vault, owed) * 100 : 0}%`, boxShadow: i < segs.length - 1 ? 'inset -2px 0 0 rgb(var(--paper))' : undefined }}
            title={`Session ${i + 1}: ${fmtToken(sg.vault, 3)}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The dark instrument. Reads EITHER the loan (open or closed) OR the offer, never a mix:
 * every field comes from state.loan + its origination terms, or from state.quote when no loan exists.
 * Order: number → split flow → payoff bar, so each session's skim travels along the flow into the bar.
 * Payoff is a state of this card (fixed-height slots), never an inserted block.
 */
function FacilityCard({ state }: { state: SkimState }) {
  const unit = unitLabel(state);
  const loan = hasLoan(state) ? state.loan : null;
  const repaid = isRepaid(state);
  const q = state.quote;
  const gradeNum = loan ? loanGrade(state) : q?.grade ?? state.rating?.grade;
  const g = gradeName(gradeNum);
  const status = repaid ? 'Repaid' : loan?.status === 1 ? 'Active' : loan?.status === 3 ? 'Defaulted' : 'Offer';
  const statusTone = repaid ? 'text-repaid-text border-repaid/50' : status === 'Defaulted' ? 'text-danger border-danger/50' : 'text-ink-2 border-rule';
  const principal = loan ? loan.principal : q?.principal;
  const fee = loan ? loanFeeBps(state) : q?.feeBps;
  const skim = loan ? loan.skimBps : q?.skimBps;
  const next = nextLine(state);
  // After payoff the rating can move past the origination grade: show the transition, never a stale grade beside "Repaid".
  const cur = state.rating?.grade;
  const upgradedTo = loan && repaid && cur !== undefined && gradeNum !== undefined && cur > gradeNum ? gradeName(cur) : undefined;
  // Text lags the newest segment by its 520ms entrance (see useShownSegs).
  const segs = payoffSegments(state);
  const lagN = useShownSegs(segs.length);
  // Once repaid the last segment renders without .seg-in, so the text snaps with it.
  const shownN = repaid ? segs.length : lagN;
  const segSum = segs.slice(0, shownN).reduce((a, x) => a + x.vault, 0n);
  // Σ segments == loan.repaid (A1); fall back to loan.repaid once every segment is shown.
  const shownRepaid = loan ? (shownN >= segs.length ? loan.repaid : segSum) : 0n;
  const big = loan ? fmtToken(shownRepaid, 2) : fmtToken(principal, 2);

  let statusLine: { text: string; tone: string };
  if (repaid) statusLine = { text: 'Repaid ✓ · NFT returned to operator', tone: 'text-repaid-text' };
  else if (loan?.status === 3) statusLine = { text: 'Defaulted · vault keeps the Machine NFT', tone: 'text-danger' };
  else if (loan) statusLine = { text: nftInVault(state) ? 'Collateral: Machine NFT in escrow (vault)' : 'Collateral: Machine NFT', tone: 'text-ink-2' };
  else statusLine = { text: 'Collateral on draw: Machine NFT into escrow', tone: 'text-ink-2' };

  let nextText: string;
  if (next) nextText = `Next line unlocked: ${next}`;
  else if (repaid) nextText = 'Next line: rating update pending';
  else if (loan) nextText = 'Next line unlocks after repayment';
  else nextText = `Rated ${g} · starter line available`;

  return (
    <div id="loan-instrument" className="inst relative min-w-0 overflow-hidden rounded-[22px] border border-rule p-4 sm:p-6">
      {/* Row 1: what this card is + loan status. Row 2: machine DID + its rating (source labelled at every width). */}
      <div className="flex h-6 items-center justify-between gap-3">
        <div className="label min-w-0 truncate">
          {loan ? (
            <>
              Advance · {g}
              <span className="hidden sm:inline"> at origination</span>
            </>
          ) : (
            `Offer · ${g}`
          )}
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[12px] font-medium transition-colors duration-300 ${statusTone}`}>{status}</span>
      </div>
      <div className="mt-1.5 flex h-9 items-center justify-between gap-3">
        <div className="min-w-0 truncate font-mono text-[12px] text-ink-2">did:peaq:{shortId(state.machineId)}</div>
        <div className="flex shrink-0 items-center gap-2" title={upgradedTo ? 'Grade at origination → current Machine Credit Rating' : undefined}>
          <span className="text-[12px] text-ink-2">{state.simulatedRating ? 'MCR · simulated' : 'MCR'}</span>
          <GradeBadge grade={upgradedTo ? `${g} → ${upgradedTo}` : g} />
        </div>
      </div>

      <div className="mt-4 min-w-0 sm:mt-5">
        <div className="label">{loan ? 'Repaid of owed' : 'Available advance'}</div>
        <div id="hero-number" className="num mt-1 flex h-[48px] items-baseline whitespace-nowrap leading-none sm:h-[66px]">
          <span key={big} className="animate-rise text-[44px] font-medium tracking-[-0.02em] text-ink sm:text-[64px]">
            {big}
          </span>
          <span className="ml-2 truncate text-[14px] text-ink-2 sm:text-lg">{loan ? `/ ${fmtToken(loan.owed, 2)} ${unit}` : unit}</span>
        </div>
      </div>

      <div className="mt-4 sm:mt-5">
        <FlowStrip id="hero-flow" skimBps={skim} mode={repaid ? 'repaid' : loan ? 'active' : 'offer'} pulse={loan ? state.sessions.length : undefined} />
      </div>

      <div className="mt-4">
        <PayoffBar state={state} repaid={repaid} shownN={shownN} shownRepaid={shownRepaid} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-rule pt-3">
        <div className="min-w-0">
          <div className="label">Principal</div>
          <div className="num mt-0.5 truncate text-sm text-ink">{fmtToken(principal, 2)}</div>
        </div>
        <div className="min-w-0">
          <div className="label">Fee</div>
          <div className="num mt-0.5 text-sm text-ink">{pct(fee)}</div>
        </div>
        <div className="min-w-0">
          <div className="label">Skim</div>
          <div className="num mt-0.5 text-sm text-skim-text">{pct(skim)}</div>
        </div>
      </div>
      {/* Two fixed one-line slots: state changes rewrite them, never add rows. */}
      <div className="mt-3 h-5 truncate text-[12px] leading-5">
        <span className={`transition-colors duration-300 ${statusLine.tone}`}>{statusLine.text}</span>
      </div>
      <div className="h-5 truncate text-[12px] leading-5 text-ink-2">{nextText}</div>
    </div>
  );
}

export function Hero({ state, onReplay }: { state: SkimState; onReplay: () => void }) {
  const explorer = realHref(state, state.contracts.vault ? addrUrl(state.network.explorer, state.contracts.vault) : state.network.explorer);
  const demo = isDemo(state);
  const cta = 'rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-opacity duration-200 hover:opacity-90 sm:px-5 sm:py-3';
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6 sm:pt-10 lg:pb-14">
        <div className="grid items-center gap-5 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
          <div className="min-w-0">
            <p className="hidden text-[13px] text-ink-2 sm:block">Revenue-based financing on peaq · Machine Economy</p>
            <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:mt-4 sm:text-6xl lg:text-[60px]">
              Machines earn.
              <br />
              <span className="text-ink-2">Now they can borrow.</span>
            </h1>
            <p className="mt-2 text-[14px] leading-snug text-ink-2 sm:hidden">An advance against the Machine NFT, repaid by skimming every payment it earns.</p>
            <p className="mt-6 hidden max-w-xl text-lg leading-relaxed text-ink-2 sm:block">
              SKIM advances working capital to a machine against its Machine NFT, priced by its Machine Credit Rating, and repays itself by skimming a share of every on-chain payment the machine earns.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 sm:mt-8">
              {demo ? (
                <button
                  type="button"
                  className={cta}
                  onClick={() => {
                    onReplay();
                    document.getElementById('loan-instrument')?.scrollIntoView({ block: 'nearest' });
                  }}
                >
                  Watch a loan repay itself
                </button>
              ) : (
                <a href="?demo" className={cta}>
                  Watch a loan repay itself
                </a>
              )}
              {explorer && (
                <a href={explorer} target="_blank" rel="noreferrer" className="rounded-xl border border-rule px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink-3 sm:px-5 sm:py-3">
                  Open explorer ↗
                </a>
              )}
            </div>
          </div>
          <FacilityCard state={state} />
        </div>
      </div>
    </section>
  );
}
