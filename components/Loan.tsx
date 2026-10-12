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

export function TermsCurve({ state }: { state: SkimState }) {
  const unit = unitLabel(state);
  const current = state.rating?.grade ?? state.quote?.grade;
  const max = state.terms.reduce((m, t) => (t.principal > m ? t.principal : m), 0n);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
        <div>
          <div className="label">Terms curve</div>
          <div className="mt-1 text-sm text-ink-2">Better rating, bigger line, lighter skim.</div>
        </div>
        <Chip title={state.termsSource === 'chain' ? 'Read from SkimVault.terms()' : 'Spec table (vault does not expose terms())'}>
          {state.termsSource === 'chain' ? 'on-chain' : 'vault schedule'}
        </Chip>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-y border-rule text-left text-[12px] text-ink-2">
              <th className="px-5 py-2.5 font-medium sm:px-6">Grade</th>
              <th className="px-3 py-2.5 font-medium">Principal</th>
              <th className="px-3 py-2.5 font-medium">Fee</th>
              <th className="px-3 py-2.5 font-medium">Skim</th>
              <th className="w-[34%] px-5 py-2.5 font-medium sm:px-6">Line size</th>
            </tr>
          </thead>
          <tbody>
            {state.terms.map((t) => {
              const on = t.grade === current;
              return (
                <tr key={t.grade} className={`border-b border-rule transition-colors duration-300 ${on ? 'bg-paper-2' : ''}`}>
                  <td className="px-5 py-2.5 sm:px-6">
                    {/* fixed-width tag slot so moving "current rating" never reflows the row */}
                    <div className="flex h-6 items-center gap-2">
                      <span className="w-[92px] font-mono font-semibold text-ink">{gradeName(t.grade)}</span>
                      {on ? <Chip tone="peaq">current rating</Chip> : t.grade === 0 ? <span className="text-[12px] text-ink-3">starter line</span> : null}
                    </div>
                  </td>
                  <td className="num whitespace-nowrap px-3 py-2.5 text-ink">
                    {fmtToken(t.principal, 2)} <span className="text-ink-3">{unit}</span>
                  </td>
                  <td className="num px-3 py-2.5 text-ink-2">{pct(t.feeBps)}</td>
                  <td className="num px-3 py-2.5 text-ink-2">{pct(t.skimBps)}</td>
                  <td className="px-5 py-2.5 sm:px-6">
                    <div className="h-1.5 rounded-full bg-paper-2">
                      <div className={`h-full rounded-full ${on ? 'bg-skim' : 'bg-ink-3/50'}`} style={{ width: `${max ? ratio(t.principal, max) * 100 : 0}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
