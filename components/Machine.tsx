'use client';
import { useState } from 'react';
import type { SkimState } from '@/lib/types';
import { gradeName, machineExplorerUrl } from '@/lib/config';
import { addrUrl, fmtDate, short, timeAgo } from '@/lib/format';
import { Chip, CopyText, ExtLink, GradeBadge, SimBadge, LiveBadge } from './ui';

type Mcr = { mcr?: string; mcr_score?: number; event_count?: number; revenue_event_count?: number; bond_status?: string; total_revenue?: number; revenue_trend?: string };

export function MachineCard({ state }: { state: SkimState }) {
  const [showJson, setShowJson] = useState(false);
  const mcr = (state.mcr?.data ?? null) as Mcr | null;
  const useMcr = state.network.isMainnet && !!mcr;
  const grade = useMcr ? mcr?.mcr ?? '—' : gradeName(state.rating?.grade);
  const score = useMcr ? mcr?.mcr_score : state.rating?.score;
  const vault = state.contracts.vault?.toLowerCase();
  const owner = state.nftOwner;
  const inVault = !!owner && owner.toLowerCase() === vault;
  const did = `did:peaq:${state.machineId}`;

  return (
    <div className="card flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">Machine</div>
          <div className="mt-1 text-lg font-semibold text-fog-100">EV charger · DC 50 kW</div>
        </div>
        {state.source === 'mock' ? <SimBadge /> : <Chip tone="peaq">peaq ID</Chip>}
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-ink-950/60 p-3">
        <div className="label">DID</div>
        <CopyText text={did} display={`did:peaq:${state.machineId.slice(0, 10)}…${state.machineId.slice(-8)}`} className="mt-1 w-full text-[13px]" />
        <div className="mt-2">
          <ExtLink href={machineExplorerUrl(state.machineId)} className="text-xs">
            Machine Explorer
          </ExtLink>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <GradeBadge grade={grade === 'Provisioned' ? 'PRV' : grade} size="lg" />
        <div className="min-w-0">
          <div className="label">Machine Credit Rating</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl font-semibold text-fog-100">{grade}</span>
            <span className="num text-sm text-fog-400">score {score ?? '—'}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {useMcr ? (
              <LiveBadge label="MCR API" />
            ) : state.simulatedRating ? (
              <SimBadge title="No MCR on this network: keeper posts a simulated rating to MCROracle" />
            ) : (
              <Chip tone="peaq">MCROracle</Chip>
            )}
            {state.rating?.updatedAt ? <span className="text-[11px] text-fog-500">{timeAgo(state.rating.updatedAt)}</span> : null}
          </div>
        </div>
      </div>
      {state.network.isMainnet && state.rating && mcr && (
        <div className="mt-2 text-[11px] text-fog-500">
          On-chain oracle: {gradeName(state.rating.grade)} · score {state.rating.score} (posted by keeper)
        </div>
      )}

      <dl className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-fog-400">NFT holder</dt>
          <dd className="flex min-w-0 items-center gap-2">
            {owner ? (
              <>
                <Chip tone={inVault ? 'peaq' : 'mint'}>{inVault ? 'SkimVault (escrow)' : 'Borrower'}</Chip>
                <ExtLink href={addrUrl(state.network.explorer, owner)} className="truncate font-mono text-xs">
                  {short(owner)}
                </ExtLink>
              </>
            ) : (
              <span className="text-fog-500">—</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-fog-400">Machine wallet</dt>
          <dd className="min-w-0">
            <ExtLink href={addrUrl(state.network.explorer, state.machineWallet)} className="font-mono text-xs">
              {short(state.machineWallet)}
            </ExtLink>
          </dd>
        </div>
        {useMcr && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fog-400">Revenue events</dt>
            <dd className="num text-xs text-fog-200">
              {mcr?.revenue_event_count ?? mcr?.event_count ?? 0} · {mcr?.bond_status ?? '—'}
            </dd>
          </div>
        )}
        {state.rating?.updatedAt ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fog-400">Rated at</dt>
            <dd className="num text-xs text-fog-200">{fmtDate(state.rating.updatedAt)}</dd>
          </div>
        ) : null}
      </dl>

      {state.network.isMainnet && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowJson((v) => !v)} className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-fog-300 hover:border-peaq-400/40">
            <span>
              Raw MCR JSON <span className="text-fog-500">· {state.mcr?.via ?? 'not loaded'}</span>
            </span>
            <span>{showJson ? '−' : '+'}</span>
          </button>
          {showJson && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-white/[0.06] bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-fog-300">
              {state.mcr ? JSON.stringify(state.mcr.data, null, 2) : state.mcrError ?? 'Loading…'}
            </pre>
          )}
          {state.mcrError && !state.mcr && <p className="mt-2 text-[11px] text-amber-400">{state.mcrError}</p>}
        </div>
      )}
    </div>
  );
}
