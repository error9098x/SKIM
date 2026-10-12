'use client';
import type { SkimState } from '@/lib/types';
import { gradeName } from '@/lib/config';
import { fmtDate, fmtToken, pct, ratio } from '@/lib/format';
import { Chip, HashRef, Stat } from './ui';
import { hasLoan, isRepaid, loanFeeBps, loanGrade, nextLine, unitLabel } from './view';

const STATUS = ['No loan', 'Active', 'Repaid', 'Defaulted'];

/**
 * Credit line card. One loan, one state: with a loan, every number comes from state.loan
 * (+ its origination terms); without one, from the offer. The payoff is a state of this card
 * (the fixed-height status row), not an inserted banner.
 */
export function LoanPanel({ state }: { state: SkimState }) {
  const unit = unitLabel(state);
  const loan = hasLoan(state) ? state.loan : null;
  const repaid = isRepaid(state);
  const q = state.quote;
  const progress = loan ? Math.min(1, ratio(loan.repaid, loan.owed)) : 0;
  const remaining = loan ? (loan.owed > loan.repaid ? loan.owed - loan.repaid : 0n) : undefined;
  const status = repaid ? 'Repaid' : loan ? STATUS[loan.status] ?? `#${loan.status}` : 'No loan';
  const tone = repaid ? 'repaid' : loan?.status === 3 ? 'danger' : 'default';

  const grade = loan ? loanGrade(state) : q?.grade;
  const principal = loan ? loan.principal : q?.principal;
  const feeBps = loan ? loanFeeBps(state) : q?.feeBps;
  const skimBps = loan ? loan.skimBps : q?.skimBps;
  const owed = loan ? loan.owed : q ? (q.principal * BigInt(10000 + q.feeBps)) / 10000n : undefined;
  const next = nextLine(state);

  return (
    <div className="card h-full p-5 sm:p-6">
      <div className="flex flex-nowrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">Credit line</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-lg font-semibold text-ink">Revenue-based advance</span>
            <Chip tone={tone}>{status}</Chip>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="label">Due</div>
          <div suppressHydrationWarning className="num mt-1 text-sm text-ink">{fmtDate(loan?.dueAt)}</div>
        </div>
      </div>

      {/* Terms of THIS loan (or of the offer when there is no loan). Never quote fields beside a loan. */}
      <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-rule bg-paper-2 p-4 sm:grid-cols-4">
        <Stat label={loan ? `Loan · ${gradeName(grade)}` : `Offer · ${gradeName(grade)}`} value={fmtToken(principal, 2)} sub={unit} />
        <Stat label="Flat fee" value={pct(feeBps)} sub={owed !== undefined ? `owe ${fmtToken(owed, 2)}` : undefined} />
        <Stat label="Revenue skim" value={pct(skimBps)} sub="of every payment" accent="skim" />
        <Stat label="Vault liquidity" value={fmtToken(state.vaultBalance, 2)} sub={unit} />
      </div>

      {/* Progress */}
      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="label">Repaid</div>
            <div className="num mt-1 whitespace-nowrap text-2xl font-medium text-ink sm:text-3xl">
              {fmtToken(loan?.repaid ?? 0n, 3)} <span className="text-sm text-ink-2">/ {fmtToken(loan?.owed, 3)} {unit}</span>
            </div>
          </div>
          <div className={`num text-right text-3xl font-medium sm:text-4xl ${repaid ? 'text-repaid-text' : 'text-ink'}`}>{Math.round(progress * 100)}%</div>
        </div>
        <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-paper-2">
          <div className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${repaid ? 'bg-repaid' : 'bg-skim'}`} style={{ width: `${progress * 100}%` }} />
          {[25, 50, 75].map((m) => (
            <span key={m} className="absolute top-0 h-full w-px bg-paper" style={{ left: `${m}%` }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
          <div className="min-w-0">
            <div className="text-ink-2">Principal</div>
            <div className="num truncate text-ink">{fmtToken(loan?.principal, 3)}</div>
          </div>
          <div className="min-w-0">
            <div className="text-ink-2">Remaining</div>
            <div className="num truncate text-ink">{fmtToken(remaining, 3)}</div>
          </div>
          <div className="min-w-0">
            <div className="text-ink-2">Locked skim</div>
            <div className="num truncate text-ink">{pct(loan?.skimBps)}</div>
          </div>
        </div>
      </div>

      {/* Fixed-height status row: this IS the payoff moment (no banner inserted above the grid). */}
      <div className={`mt-5 flex h-10 items-center justify-between gap-3 rounded-lg border px-3 transition-colors duration-300 ${repaid ? 'border-repaid/50 bg-repaid/10' : 'border-rule bg-paper-2'}`}>
        <span className={`min-w-0 truncate text-[13px] ${repaid ? 'font-medium text-repaid-text' : 'text-ink-2'}`}>
          {repaid
            ? `Repaid ✓ · NFT returned to operator · ${state.sessions.length} revenue session${state.sessions.length === 1 ? '' : 's'}`
            : loan?.status === 3
              ? 'Defaulted · vault keeps the Machine NFT'
              : loan
                ? `Repaying from revenue · ${state.sessions.length} session${state.sessions.length === 1 ? '' : 's'} so far`
                : 'No advance drawn yet'}
        </span>
        <span className="hidden shrink-0 sm:inline-flex">{repaid && <HashRef state={state} hash={state.closed?.txHash} />}</span>
      </div>
      {/* Next offer: its own labelled line, never inside the loan block. Always reserved. */}
      <div className="mt-2 h-5 truncate text-[12px] leading-5 text-ink-2">{next ? `Next line unlocked: ${next}` : '\u00a0'}</div>
    </div>
  );
}

/**
 * Terms: one series (line size per grade) drawn as a staircase, best grade on top so a rating
 * upgrade moves the marker UP one step (transform only, 320ms). fee · skim labels only on the
 * current and the next grade. Exact table: beside the chart on desktop, in a <details> (closed)
 * on mobile.
 */
const ROW_H = 34;
export function TermsCurve({ state }: { state: SkimState }) {
  const unit = unitLabel(state);
  const current = state.rating?.grade ?? state.quote?.grade ?? 0;
  const max = state.terms.reduce((m, t) => (t.principal > m ? t.principal : m), 0n);
  const rows = [...state.terms].sort((a, b) => b.grade - a.grade); // best on top
  const idx = Math.max(0, rows.findIndex((t) => t.grade === current));
  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-rule text-left text-[12px] text-ink-2">
          <th className="py-2 pr-3 font-medium">Grade</th>
          <th className="px-3 py-2 text-right font-medium">Principal</th>
          <th className="px-3 py-2 text-right font-medium">Fee</th>
          <th className="py-2 pl-3 text-right font-medium">Skim</th>
        </tr>
      </thead>
      <tbody>
        {state.terms.map((t) => (
          <tr key={t.grade} className={`border-b border-rule transition-colors duration-300 ${t.grade === current ? 'bg-paper-2' : ''}`}>
            <td className="h-8 py-1 pr-3 font-mono text-[13px] font-semibold text-ink">{gradeName(t.grade)}</td>
            <td className="num whitespace-nowrap px-3 py-1 text-right text-ink">
              {fmtToken(t.principal, 2)} <span className="text-[12px] text-ink-3">{unit}</span>
            </td>
            <td className="num px-3 py-1 text-right text-ink-2">{pct(t.feeBps)}</td>
            <td className="num py-1 pl-3 text-right text-ink-2">{pct(t.skimBps)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="card overflow-hidden p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">Line size by grade</div>
          <div className="mt-1 text-sm text-ink-2">Better rating, bigger line, lighter skim.</div>
        </div>
        <Chip title={state.termsSource === 'chain' ? 'Read from SkimVault.terms()' : 'Spec table (vault does not expose terms())'}>
          {state.termsSource === 'chain' ? 'on-chain' : 'vault schedule'}
        </Chip>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[1.5fr_1fr] md:gap-8">
        <div id="terms-staircase" className="relative" style={{ height: rows.length * ROW_H }} role="img" aria-label={`Line size per grade; current grade ${gradeName(current)}`}>
          {/* marker: steps up one row on upgrade */}
          <div
            aria-hidden
            className="step-marker absolute inset-x-0 top-0 rounded-md border border-skim/70 bg-skim/10"
            style={{ height: ROW_H, transform: `translateY(${idx * ROW_H}px)` }}
          />
          {rows.map((t) => {
            const on = t.grade === current;
            const isNext = t.grade === current + 1;
            const w = max ? Math.max(1.5, ratio(t.principal, max) * 100) : 0;
            return (
              <div key={t.grade} className="relative grid grid-cols-[92px_minmax(0,1fr)_72px] items-center gap-2 px-2 sm:grid-cols-[104px_minmax(0,1fr)_96px] sm:gap-3" style={{ height: ROW_H }}>
                <span className={`truncate font-mono text-[13px] font-semibold ${on ? 'text-ink' : 'text-ink-2'}`}>{gradeName(t.grade)}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`block h-3.5 shrink-0 rounded-sm transition-colors duration-300 ${on ? 'bg-skim' : 'bg-ink-3/40'}`} style={{ width: `calc(${w}% - ${w * 0.5}px)` }} />
                  <span className={`num shrink-0 text-[12px] ${on ? 'text-ink' : 'text-ink-2'}`}>{fmtToken(t.principal, 2)}</span>
                </div>
                {/* fixed slot: fee · skim only on current and next */}
                <span className={`num truncate text-right text-[12px] ${on ? 'text-skim-text' : 'text-ink-2'}`}>
                  {on || isNext ? `${pct(t.feeBps)} · ${pct(t.skimBps)}` : ''}
                </span>
              </div>
            );
          })}
        </div>
        <div className="hidden md:block">{table}</div>
        <details className="group md:hidden">
          <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg border border-rule bg-paper-2 px-3 text-[13px] text-ink-2">
            <span>Exact terms table · principal in {unit}, fee, skim</span>
            <span aria-hidden className="text-ink-3 group-open:rotate-45">＋</span>
          </summary>
          <div className="mt-2">{table}</div>
        </details>
      </div>
      <div className="mt-3 h-5 truncate text-[12px] leading-5 text-ink-3">
        <span className="text-skim-text">You are here: {gradeName(current)}</span> · labels show fee · skim for the current and next grade
      </div>
    </div>
  );
}
