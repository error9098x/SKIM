'use client';
import { useState } from 'react';
import type { SkimState } from '@/lib/types';
import { gradeName, machineExplorerUrl } from '@/lib/config';
import { addrUrl, fmtDate, short, timeAgo } from '@/lib/format';
import { Chip, CopyText, ExtLink, GradeBadge } from './ui';
import { hasLoan, isDemo, isRepaid, nftInVault, realHref } from './view';
import { ChargerArt } from './ChargerArt';

type Mcr = { mcr?: string; mcr_score?: number; event_count?: number; revenue_event_count?: number; bond_status?: string; total_revenue?: number; revenue_trend?: string };

export function MachineCard({ state }: { state: SkimState }) {
  const [showJson, setShowJson] = useState(false);
  const mcr = (state.mcr?.data ?? null) as Mcr | null;
  const useMcr = state.network.isMainnet && !!mcr;
  const grade = useMcr ? mcr?.mcr ?? '—' : gradeName(state.rating?.grade);
  const score = useMcr ? mcr?.mcr_score : state.rating?.score;
  const owner = state.nftOwner;
  const inVault = nftInVault(state);
  const returned = !inVault && isRepaid(state);
  const did = `did:peaq:${state.machineId}`;
  const demo = isDemo(state);
  const explorerHref = realHref(state, machineExplorerUrl(state.machineId));

  return (
    <div className="card flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">Machine</div>
          <div className="mt-1 text-lg font-semibold text-ink">EV charger · DC 50 kW</div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {!demo && <Chip tone="peaq">peaq ID</Chip>}
          <ChargerArt charging={hasLoan(state) && !isRepaid(state)} className="-my-3 h-20 w-20" />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-rule bg-paper-2 p-3">
        <div className="label">DID</div>
        {/* 390: a shorter display so digits survive truncation (full DID is what gets copied). */}
        <CopyText text={did} display={`did:peaq:${state.machineId.slice(0, 6)}…${state.machineId.slice(-6)}`} className="mt-1 w-full text-[13px] sm:hidden" />
        <CopyText text={did} display={`did:peaq:${state.machineId.slice(0, 10)}…${state.machineId.slice(-8)}`} className="mt-1 hidden w-full text-[13px] sm:inline-flex" />
        <div className="mt-2 h-5 text-[12px]">
          {explorerHref ? <ExtLink href={explorerHref}>Machine Explorer</ExtLink> : <span className="text-ink-3">Demo machine · not on chain</span>}
        </div>
      </div>

      <div className="mt-4 flex min-w-0 items-center gap-4">
        {/* The hatched grade seal lives on the hero instrument; this one stays plain to keep the hatch budget at two. */}
        <GradeBadge grade={grade} size="lg" />
        <div className="min-w-0">
          <div className="label">Machine Credit Rating</div>
          <div className="mt-1 flex h-7 min-w-0 items-baseline gap-x-2 overflow-hidden whitespace-nowrap">
            {/* mobile: the seal beside already names the grade, so only the score shows (no "Provision…" ellipsis) */}
            <span className="hidden truncate text-xl font-semibold text-ink sm:inline">{grade}</span>
            <span className="num shrink-0 text-sm text-ink-2">score {score ?? '—'}</span>
          </div>
          <div className="mt-1.5 flex h-6 min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] text-ink-2">
            {useMcr ? <Chip tone="peaq">MCR API</Chip> : state.simulatedRating ? <span className="truncate">Simulated · MCROracle</span> : <Chip tone="peaq">MCROracle</Chip>}
            {state.rating?.updatedAt ? <span suppressHydrationWarning className="shrink-0 text-ink-3">{timeAgo(state.rating.updatedAt)}</span> : null}
          </div>
        </div>
      </div>
      {state.network.isMainnet && state.rating && mcr && (
        <div className="mt-2 text-[12px] text-ink-3">
          On-chain oracle: {gradeName(state.rating.grade)} · score {state.rating.score} (posted by keeper)
        </div>
      )}

      <dl className="mt-5 space-y-2.5 border-t border-rule pt-4 text-sm">
        <div className="flex h-6 items-center justify-between gap-3">
          <dt className="text-ink-2">NFT owner</dt>
          <dd className="flex min-w-0 items-center gap-2">
            {owner ? (
              <>
                <Chip tone={returned ? 'repaid' : 'default'}>{inVault ? 'Vault (escrow)' : 'Operator'}</Chip>
                <ExtLink href={realHref(state, addrUrl(state.network.explorer, owner))} className="truncate font-mono text-[12px] text-ink-2">
                  {short(owner)}
                </ExtLink>
              </>
            ) : (
              <span className="text-ink-3">—</span>
            )}
          </dd>
        </div>
        {/* Controller is a design fact of the escrow (cited, not read live): no tick, no live styling. */}
        <div className="flex h-6 items-center justify-between gap-3">
          <dt className="text-ink-2">NFT controller</dt>
          <dd className="min-w-0 truncate text-[12px] text-ink-2" title="SkimVault escrows ownership only; the operator keeps operating the machine">
            Operator · unchanged by escrow
          </dd>
        </div>
        <div className="flex h-6 items-center justify-between gap-3">
          <dt className="text-ink-2">Machine wallet</dt>
          <dd className="min-w-0">
            <ExtLink href={realHref(state, addrUrl(state.network.explorer, state.machineWallet))} className="font-mono text-[12px] text-ink-2">
              {short(state.machineWallet)}
            </ExtLink>
          </dd>
        </div>
        {useMcr && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">Revenue events</dt>
            <dd className="num text-[12px] text-ink">
              {mcr?.revenue_event_count ?? mcr?.event_count ?? 0} · {mcr?.bond_status ?? '—'}
            </dd>
          </div>
        )}
        <div className="flex h-6 items-center justify-between gap-3">
          <dt className="text-ink-2">Rated at</dt>
          <dd suppressHydrationWarning className="num text-[12px] text-ink">{fmtDate(state.rating?.updatedAt || undefined)}</dd>
        </div>
      </dl>

      {state.network.isMainnet && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowJson((v) => !v)} className="flex w-full items-center justify-between rounded-lg border border-rule bg-paper-2 px-3 py-2 text-[12px] text-ink-2 hover:border-ink-3">
            <span>
              Raw MCR JSON <span className="text-ink-3">· {state.mcr?.via ?? 'not loaded'}</span>
            </span>
            <span>{showJson ? '−' : '+'}</span>
          </button>
          {showJson && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-rule bg-paper-2 p-3 font-mono text-[12px] leading-relaxed text-ink-2">
              {state.mcr ? JSON.stringify(state.mcr.data, null, 2) : state.mcrError ?? 'Loading…'}
            </pre>
          )}
          {state.mcrError && !state.mcr && <p className="mt-2 text-[12px] text-ink-2">{state.mcrError}</p>}
        </div>
      )}
    </div>
  );
}
