'use client';
import type { SkimState } from '@/lib/types';
import { gradeName } from '@/lib/config';
import { fmtToken, pct, ratio, shortId, addrUrl } from '@/lib/format';
import { GradeBadge, SimBadge } from './ui';

export function loopStep(s: SkimState): number {
  if (s.closed || s.loan?.status === 2) return 4;
  if (!s.loan || s.loan.status === 0) return 0;
  if (s.sessions.length === 0) return 2;
  return 3;
}

const STEPS = [
  { t: 'Escrow NFT', d: 'Machine NFT locks in the vault as collateral.' },
  { t: 'Advance', d: 'Principal sized by MCR lands in the machine wallet.' },
  { t: 'Skim revenue', d: 'Every charging payment routes a share to repay.' },
  { t: 'NFT returned', d: 'Fully repaid: the NFT goes back automatically.' },
];

export function LoopSteps({ state }: { state: SkimState }) {
  const step = loopStep(state);
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] md:grid-cols-4">
      {STEPS.map((s, i) => {
        const n = i + 1;
        // step: 0 offer, 2 advance sent, 3 skimming, 4 returned
        const active = step === 0 ? n === 1 : step === 4 ? n === 4 : n === 3;
        const done = step === 4 ? true : step >= 2 && n <= 2;
        return (
          <li key={s.t} className={`relative bg-ink-900 p-4 sm:p-5 ${active ? 'bg-gradient-to-b from-peaq-600/15 to-ink-900' : ''}`}>
            <div className="flex items-center gap-2">
              <span
                className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  active ? 'border-peaq-400 bg-peaq-500 text-white' : done ? 'border-mint-400/50 bg-mint-400/10 text-mint-400' : 'border-white/15 text-fog-400'
                }`}
              >
                {done && (!active || step === 4) ? '✓' : n}
              </span>
              <span className={`text-sm font-medium ${active || done ? 'text-fog-100' : 'text-fog-300'}`}>{s.t}</span>
              {i < 3 && <span className="ml-auto hidden text-fog-500 md:inline">→</span>}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-fog-400">{s.d}</p>
            {active && <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-peaq-400 to-transparent" />}
          </li>
        );
      })}
    </ol>
  );
}

function FacilityCard({ state }: { state: SkimState }) {
  const tok = state.network.token;
  const loan = state.loan;
  const progress = loan ? ratio(loan.repaid, loan.owed) : 0;
  const g = gradeName(state.rating?.grade ?? state.quote?.grade);
  const status = state.closed || loan?.status === 2 ? 'Repaid' : loan?.status === 1 ? 'Active' : loan?.status === 3 ? 'Defaulted' : 'Offer';
  const statusTone = status === 'Repaid' ? 'text-mint-400 border-mint-400/30 bg-mint-400/10' : status === 'Active' ? 'text-peaq-300 border-peaq-400/30 bg-peaq-500/10' : status === 'Defaulted' ? 'text-red-300 border-red-400/30 bg-red-400/10' : 'text-fog-200 border-white/10 bg-white/5';
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[32px] bg-peaq-600/20 blur-3xl" aria-hidden />
      <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-5 shadow-2xl sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-peaq-500/20 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label">Revenue-based credit line</div>
            <div className="mt-1 truncate font-mono text-[13px] text-fog-300">did:peaq:{shortId(state.machineId)}</div>
          </div>
          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${statusTone}`}>{status}</span>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="label">{loan ? 'Repaid of owed' : 'Available advance'}</div>
            <div className="num mt-1 text-[32px] font-medium leading-none text-fog-100 sm:text-[40px]">
              {loan ? fmtToken(loan.repaid, 2) : fmtToken(state.quote?.principal, 2)}
              <span className="ml-2 text-base text-fog-400">{loan ? `/ ${fmtToken(loan.owed, 2)} ${tok}` : tok}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <GradeBadge grade={g === 'Provisioned' ? 'PRV' : g} />
            <span className="text-[10px] uppercase tracking-wider text-fog-400">MCR</span>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="relative h-full rounded-full bg-gradient-to-r from-peaq-600 via-peaq-400 to-mint-400 transition-[width] duration-700" style={{ width: `${Math.max(progress * 100, loan ? 1.5 : 0)}%` }}>
            {loan?.status === 1 && <div className="bar-shimmer absolute inset-0" />}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
          <div className="min-w-0">
            <div className="label">Principal</div>
            <div className="num mt-1 truncate text-sm text-fog-100">{fmtToken(loan?.principal ?? state.quote?.principal, 2)}</div>
          </div>
          <div className="min-w-0">
            <div className="label">Fee</div>
            <div className="num mt-1 text-sm text-fog-100">{pct(loan && loan.principal > 0n ? Number(((loan.owed - loan.principal) * 10000n) / loan.principal) : state.quote?.feeBps)}</div>
          </div>
          <div className="min-w-0">
            <div className="label">Skim</div>
            <div className="num mt-1 text-sm text-peaq-300">{pct(loan?.skimBps ?? state.quote?.skimBps)}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-fog-400">
          <span className="truncate">
            Collateral: Machine NFT{' '}
            {state.nftOwner && state.contracts.vault && state.nftOwner.toLowerCase() === state.contracts.vault.toLowerCase() ? (
              <span className="text-peaq-300">in escrow</span>
            ) : (
              <span className="text-mint-400">with machine</span>
            )}
          </span>
          {state.simulatedRating && <SimBadge title="Rating is simulated (no MCR on this network)" />}
        </div>
      </div>
    </div>
  );
}

export function Hero({ state }: { state: SkimState }) {
  const explorer = state.contracts.vault ? addrUrl(state.network.explorer, state.contracts.vault) : state.network.explorer;
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0" aria-hidden />
      <div className="glow absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20 lg:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-peaq-400/25 bg-peaq-500/10 px-3 py-1 text-xs text-peaq-300">
              <span className="h-1.5 w-1.5 rounded-full bg-peaq-400" />
              Revenue-based financing on peaq · Machine Economy
            </div>
            <h1 className="mt-6 text-[42px] font-semibold leading-[1.02] tracking-[-0.03em] text-fog-100 sm:text-6xl lg:text-[68px]">
              Machines earn.
              <br />
              <span className="bg-gradient-to-r from-peaq-300 via-peaq-400 to-peaq-600 bg-clip-text text-transparent">Now they can borrow.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-fog-300 sm:text-lg">
              SKIM advances working capital to a machine against its Machine NFT, priced by its Machine Credit Rating, and repays itself by skimming a share of every on-chain payment the machine earns.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#loan" className="rounded-xl bg-fog-100 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-white">
                See the live loan
              </a>
              <a
                href={explorer || '#how'}
                target={explorer ? '_blank' : undefined}
                rel="noreferrer"
                className="rounded-xl border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-fog-100 transition hover:border-peaq-400/50 hover:bg-peaq-500/10"
              >
                Open explorer ↗
              </a>
            </div>
          </div>
          <FacilityCard state={state} />
        </div>
        <div className="mt-14">
          <LoopSteps state={state} />
        </div>
      </div>
    </section>
  );
}
