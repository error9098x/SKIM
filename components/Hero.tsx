'use client';
import type { SkimState } from '@/lib/types';
import { gradeName } from '@/lib/config';
import { fmtToken, pct, ratio, shortId, addrUrl } from '@/lib/format';
import { GradeBadge } from './ui';
import { hasLoan, isDemo, isRepaid, loanFeeBps, loanGrade, nextLine, nftInVault, realHref, unitLabel } from './view';

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
 * The dark instrument. Reads EITHER the loan (open or closed) OR the offer, never a mix:
 * every field comes from state.loan + its origination terms, or from state.quote when no loan exists.
 * Payoff is a state of this card (fixed-height slots), never an inserted block.
 */
function FacilityCard({ state }: { state: SkimState }) {
  const unit = unitLabel(state);
  const loan = hasLoan(state) ? state.loan : null;
  const repaid = isRepaid(state);
  const progress = loan ? Math.min(1, ratio(loan.repaid, loan.owed)) : 0;
  const q = state.quote;
  const gradeNum = loan ? loanGrade(state) : q?.grade ?? state.rating?.grade;
  const g = gradeName(gradeNum);
  const status = repaid ? 'Repaid' : loan?.status === 1 ? 'Active' : loan?.status === 3 ? 'Defaulted' : 'Offer';
  const statusTone = repaid ? 'text-repaid-text border-repaid/50' : status === 'Defaulted' ? 'text-danger border-danger/50' : 'text-ink-2 border-rule';
  const principal = loan ? loan.principal : q?.principal;
  const fee = loan ? loanFeeBps(state) : q?.feeBps;
  const skim = loan ? loan.skimBps : q?.skimBps;
  const next = nextLine(state);

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
    <div id="loan-instrument" className="inst relative min-w-0 overflow-hidden rounded-[22px] border border-rule p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label truncate">{loan ? `Advance · ${g} at origination` : `Offer · ${g}`}</div>
          <div className="mt-1 truncate font-mono text-[13px] text-ink-2">did:peaq:{shortId(state.machineId)}</div>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[12px] font-medium transition-colors duration-300 ${statusTone}`}>{status}</span>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="label">{loan ? 'Repaid of owed' : 'Available advance'}</div>
          <div className="num mt-1 whitespace-nowrap text-[32px] font-medium leading-none text-ink sm:text-[40px]">
            {loan ? fmtToken(loan.repaid, 2) : fmtToken(principal, 2)}
            <span className="ml-2 text-[13px] text-ink-2 sm:text-base">{loan ? `/ ${fmtToken(loan.owed, 2)} ${unit}` : unit}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <GradeBadge grade={g} sim={state.simulatedRating} />
          <span className="text-[12px] text-ink-2">{state.simulatedRating ? 'MCR · simulated' : 'MCR'}</span>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Repaid">
        <div className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${repaid ? 'bg-repaid' : 'bg-skim'}`} style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-rule pt-4">
        <div className="min-w-0">
          <div className="label">Principal</div>
          <div className="num mt-1 truncate text-sm text-ink">{fmtToken(principal, 2)}</div>
        </div>
        <div className="min-w-0">
          <div className="label">Fee</div>
          <div className="num mt-1 text-sm text-ink">{pct(fee)}</div>
        </div>
        <div className="min-w-0">
          <div className="label">Skim</div>
          <div className="num mt-1 text-sm text-skim-text">{pct(skim)}</div>
        </div>
      </div>
      {/* Two fixed one-line slots: state changes rewrite them, never add rows. */}
      <div className="mt-4 h-5 truncate text-[12px] leading-5">
        <span className={`transition-colors duration-300 ${statusLine.tone}`}>{statusLine.text}</span>
      </div>
      <div className="h-5 truncate text-[12px] leading-5 text-ink-2">{nextText}</div>
    </div>
  );
}

export function Hero({ state, onReplay }: { state: SkimState; onReplay: () => void }) {
  const explorer = realHref(state, state.contracts.vault ? addrUrl(state.network.explorer, state.contracts.vault) : state.network.explorer);
  const demo = isDemo(state);
  const cta = 'rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-paper transition-opacity duration-200 hover:opacity-90';
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:pb-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <div className="min-w-0">
            <p className="text-[13px] text-ink-2">Revenue-based financing on peaq · Machine Economy</p>
            <h1 className="mt-4 text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-ink sm:text-6xl lg:text-[64px]">
              Machines earn.
              <br />
              <span className="text-ink-2">Now they can borrow.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
              SKIM advances working capital to a machine against its Machine NFT, priced by its Machine Credit Rating, and repays itself by skimming a share of every on-chain payment the machine earns.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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
                <a href={explorer} target="_blank" rel="noreferrer" className="rounded-xl border border-rule px-5 py-3 text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink-3">
                  Open explorer ↗
                </a>
              )}
            </div>
          </div>
          <FacilityCard state={state} />
        </div>
        <div className="mt-12">
          <LoopSteps state={state} />
        </div>
      </div>
    </section>
  );
}
