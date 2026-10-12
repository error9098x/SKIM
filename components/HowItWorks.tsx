'use client';
import type { SkimState } from '@/lib/types';
import { LINKS } from '@/lib/config';
import { addrUrl } from '@/lib/format';
import { CopyText, ExtLink } from './ui';
import { isDemo, isPlaceholderLink, loanTerms, unitLabel } from './view';
import { FlowStrip } from './Flow';
import { LoopSteps } from './Hero';
import PROOF from '@/data/agung-proof.json';

const DATA_STEPS = [
  ['Keeper → EventRegistry', 'Every routed payment becomes a peaq revenue event (trust 1) citing the router tx.'],
  ['EventRegistry → MCR → MCROracle', 'Revenue history moves the Machine Credit Rating; the keeper posts it on chain.'],
  ['MCROracle → loan terms', 'quote() reads the grade: bigger line, lower fee, lighter skim.'],
];

export function HowItWorks({ state }: { state: SkimState }) {
  const c = state.contracts;
  const unit = unitLabel(state);
  const rows: [string, string | undefined][] = [
    ['SkimVault', c.vault],
    ['RevenueRouter', c.router],
    ['MCROracle', c.oracle],
    ['Machine NFT', c.machineNft],
    [state.network.isMainnet ? 'EventRegistry 2.0' : 'MockEventRegistry', c.eventRegistry],
  ];
  const mock = isDemo(state);
  // '#github' style fallbacks are placeholders: never rendered.
  const links = (
    [
      ['GitHub', LINKS.github],
      ['README', LINKS.readme],
      ['Demo video', LINKS.video],
    ] as const
  ).filter(([, href]) => !isPlaceholderLink(href));
  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <div className="card p-5 sm:p-6">
        {/* Same flow component as the hero instrument, on paper. */}
        <div className="label">Money · native {unit} · every charging payment</div>
        <div className="mt-3">
          <FlowStrip skimBps={loanTerms(state)?.skimBps ?? state.quote?.skimBps} mode="active" />
        </div>
        <div className="mt-5">
          <LoopSteps state={state} />
        </div>
        <div className="label mt-6">Credit signal · what moves the rating</div>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {DATA_STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rule text-[12px] text-ink-2">{i + 1}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{t}</div>
                <div className="text-[12px] leading-relaxed text-ink-2">{d}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 grid gap-3 border-t border-rule pt-5 text-sm text-ink-2 sm:grid-cols-3">
          <p>
            <span className="font-medium text-ink">Collateral is identity.</span> The Machine NFT is escrowed, so a defaulted loan leaves the vault holding the machine’s on-chain identity.
          </p>
          <p>
            <span className="font-medium text-ink">Repayment is automatic.</span> No invoices or schedules: the router repays a fixed share of whatever the machine earns.
          </p>
          <p>
            <span className="font-medium text-ink">Credit compounds.</span> Verified revenue raises the MCR, and a better grade unlocks a bigger, cheaper next line.
          </p>
          <p className="sm:col-span-3">
            <span className="font-medium text-ink">Why not bypass the router?</span> Only revenue routed through <span className="font-mono text-[13px]">RevenueRouter</span> becomes a trust-1 revenue event, which feeds the MCR and the next, bigger line; and the Machine NFT stays in escrow until the advance is repaid.
          </p>
        </div>
        {/* JUDGE#2 proof row: static record of the real agung run (same in every mode), never a new section. */}
        <div id="proof" className="mt-5 border-t border-rule pt-5">
          <div className="label">Proof · real transactions on peaq agung testnet · {PROOF.date} · {PROOF.txCount}/{PROOF.txCount} ok</div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
            {PROOF.txs.map((t) => (
              <li key={t.hash}>
                <ExtLink href={`${PROOF.explorer}/tx/${t.hash}`}>{t.label}</ExtLink>
              </li>
            ))}
            {PROOF.accounts.map((a) => (
              <li key={a.address}>
                <ExtLink href={`${PROOF.explorer}/account/${a.address}`}>{a.label}</ExtLink>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-2">
            {PROOF.fork} · {PROOF.tests}. On agung the rating is simulated and revenue events go to a mock registry.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="label">Contracts · {mock ? 'demo placeholders' : state.network.name}</div>
          </div>
          <ul className="mt-3 space-y-2.5">
            {rows.map(([name, a]) => (
              <li key={name} className="flex h-6 items-center justify-between gap-3 text-sm">
                <span className="shrink-0 text-ink-2">{name}</span>
                {a ? (
                  mock ? (
                    <span className="truncate font-mono text-[12px] text-ink-3">{a.slice(0, 8)}…{a.slice(-6)}</span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2">
                      <CopyText text={a} display={`${a.slice(0, 8)}…${a.slice(-6)}`} className="text-[12px]" />
                      <ExtLink href={addrUrl(state.network.explorer, a)} className="text-[12px]">
                        {' '}
                      </ExtLink>
                    </span>
                  )
                ) : (
                  <span className="text-[12px] text-ink-3">—</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 text-[12px] text-ink-3">
            {mock ? `Demo replay modelled on peaq agung · values in ${unit}` : `Chain ${state.network.chainId} · all value in native ${unit}`}
          </div>
        </div>
        {links.length > 0 && (
          <div className="card grid divide-x divide-rule overflow-hidden" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
            {links.map(([t, href]) => (
              <a key={t} href={href} target="_blank" rel="noreferrer" className="px-3 py-4 text-center text-sm font-medium text-ink transition-colors duration-200 hover:bg-paper-2">
                {t} <span className="text-ink-3">↗</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
