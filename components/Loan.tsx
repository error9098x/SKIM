'use client';
import type { SkimState } from '@/lib/types';
import { gradeName } from '@/lib/config';
import { fmtDate, fmtToken, pct, ratio, txUrl } from '@/lib/format';
import { Chip, ExtLink, SimBadge, Stat } from './ui';

const STATUS = ['No loan', 'Active', 'Repaid', 'Defaulted'];

export function PayoffBanner({ state }: { state: SkimState }) {
  if (!state.closed && state.loan?.status !== 2) return null;
  const tx = state.closed?.txHash;
  return (
    <div className="relative mb-5 animate-rise overflow-hidden rounded-2xl border border-mint-400/30 bg-gradient-to-r from-mint-400/[0.12] via-ink-900 to-peaq-600/[0.12] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-mint-400/40 bg-mint-400/15 text-xl text-mint-400">✓</div>
          <div>
            <div className="text-lg font-semibold text-fog-100">NFT returned to machine</div>
            <p className="text-sm text-fog-300">
              Loan repaid in full from {state.sessions.length} revenue session{state.sessions.length === 1 ? '' : 's'}. <span className="font-mono text-mint-400">LoanClosed</span> fired and the vault released the collateral.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {state.source === 'mock' && <SimBadge />}
          {tx && (
            <ExtLink href={state.source === 'live' ? txUrl(state.network.explorer, tx) : undefined} className="font-mono text-xs">
              {tx.slice(0, 10)}…
            </ExtLink>
          )}
        </div>
      </div>
    </div>
  );
}

export function LoanPanel({ state }: { state: SkimState }) {
  const tok = state.network.token;
  const loan = state.loan;
  const q = state.quote;
  const progress = loan ? ratio(loan.repaid, loan.owed) : 0;
  const remaining = loan ? (loan.owed > loan.repaid ? loan.owed - loan.repaid : 0n) : undefined;
  const status = loan ? STATUS[loan.status] ?? `#${loan.status}` : 'No loan';
  const tone = loan?.status === 2 ? 'mint' : loan?.status === 1 ? 'peaq' : loan?.status === 3 ? 'red' : 'default';
  const currentGrade = q?.grade ?? state.rating?.grade;
  const owedQuote = q ? (q.principal * BigInt(10000 + q.feeBps)) / 10000n : undefined;

  return (
    <div className="card h-full p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label">Credit line</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-semibold text-fog-100">Revenue-based advance</span>
            <Chip tone={tone as 'mint' | 'peaq' | 'red' | 'default'}>{status}</Chip>
          </div>
        </div>
        <div className="text-right">
          <div className="label">Due</div>
          <div className="num mt-1 text-sm text-fog-200">{fmtDate(loan?.dueAt)}</div>
        </div>
      </div>

      {/* Quote */}
      <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-white/[0.06] bg-ink-950/60 p-4 sm:grid-cols-4">
        <Stat label={`Quote · ${gradeName(currentGrade)}`} value={fmtToken(q?.principal, 2)} sub={tok} />
        <Stat label="Flat fee" value={pct(q?.feeBps)} sub={owedQuote !== undefined ? `owe ${fmtToken(owedQuote, 2)}` : undefined} />
        <Stat label="Revenue skim" value={pct(q?.skimBps)} sub="of every payment" accent />
        <Stat label="Vault liquidity" value={fmtToken(state.vaultBalance, 2)} sub={tok} />
      </div>

      {/* Progress */}
      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="label">Repaid</div>
            <div className="num mt-1 text-2xl font-medium text-fog-100 sm:text-3xl">
              {fmtToken(loan?.repaid ?? 0n, 3)} <span className="text-sm text-fog-400">/ {fmtToken(loan?.owed, 3)} {tok}</span>
            </div>
          </div>
          <div className="num text-right text-3xl font-medium text-peaq-300 sm:text-4xl">{Math.round(progress * 100)}%</div>
        </div>
        <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`relative h-full rounded-full transition-[width] duration-700 ${loan?.status === 2 ? 'bg-mint-400' : 'bg-gradient-to-r from-peaq-600 to-peaq-400'}`}
            style={{ width: `${progress * 100}%` }}
          >
            {loan?.status === 1 && <div className="bar-shimmer absolute inset-0" />}
          </div>
          {[25, 50, 75].map((m) => (
            <span key={m} className="absolute top-0 h-full w-px bg-ink-950/60" style={{ left: `${m}%` }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div className="min-w-0">
            <div className="text-fog-500">Principal</div>
            <div className="num truncate text-fog-200">{fmtToken(loan?.principal, 3)}</div>
          </div>
          <div className="min-w-0">
            <div className="text-fog-500">Remaining</div>
            <div className="num truncate text-fog-200">{fmtToken(remaining, 3)}</div>
          </div>
          <div className="min-w-0">
            <div className="text-fog-500">Locked skim</div>
            <div className="num truncate text-fog-200">{pct(loan?.skimBps)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TermsCurve({ state }: { state: SkimState }) {
  const tok = state.network.token;
  const current = state.quote?.grade ?? state.rating?.grade;
  const max = state.terms.reduce((m, t) => (t.principal > m ? t.principal : m), 0n);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
        <div>
          <div className="label">Terms curve</div>
          <div className="mt-1 text-sm text-fog-300">Better rating, bigger line, lighter skim.</div>
        </div>
        <Chip tone={state.termsSource === 'chain' ? 'mint' : 'default'} title={state.termsSource === 'chain' ? 'Read from SkimVault.terms()' : 'Spec table (vault does not expose terms())'}>
          {state.termsSource === 'chain' ? 'on-chain' : 'vault schedule'}
        </Chip>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-y border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-fog-500">
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
                <tr key={t.grade} className={`border-b border-white/[0.04] ${on ? 'bg-peaq-500/[0.09]' : ''}`}>
                  <td className="px-5 py-2.5 sm:px-6">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-semibold ${on ? 'text-peaq-300' : 'text-fog-200'}`}>{gradeName(t.grade)}</span>
                      {on && <Chip tone="peaq">current</Chip>}
                      {t.grade === 0 && !on && <span className="text-[11px] text-fog-500">starter line</span>}
                    </div>
                  </td>
                  <td className="num px-3 py-2.5 text-fog-100">
                    {fmtToken(t.principal, 2)} <span className="text-fog-500">{tok}</span>
                  </td>
                  <td className="num px-3 py-2.5 text-fog-300">{pct(t.feeBps)}</td>
                  <td className="num px-3 py-2.5 text-fog-300">{pct(t.skimBps)}</td>
                  <td className="px-5 py-2.5 sm:px-6">
                    <div className="h-1.5 rounded-full bg-white/[0.05]">
                      <div className={`h-full rounded-full ${on ? 'bg-peaq-400' : 'bg-fog-500/50'}`} style={{ width: `${max ? ratio(t.principal, max) * 100 : 0}%` }} />
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
