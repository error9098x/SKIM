'use client';
import type { SkimState } from '@/lib/types';
import { LINKS } from '@/lib/config';
import { addrUrl } from '@/lib/format';
import { CopyText, ExtLink } from './ui';
import { isDemo, isPlaceholderLink, unitLabel } from './view';

type Tone = 'peaq' | 'repaid' | 'skim' | 'base';
type N = { x: number; y: number; w: number; t: string; s: string; tone?: Tone };

const NODE_STROKE: Record<Tone, string> = { peaq: 'stroke-peaq', repaid: 'stroke-repaid', skim: 'stroke-skim', base: 'stroke-ink-3' };
const NODE_FILL: Record<Tone, string> = { peaq: 'fill-peaq/10', repaid: 'fill-repaid/10', skim: 'fill-skim/10', base: 'fill-paper-2' };

function Node({ n }: { n: N }) {
  const tone = n.tone ?? 'base';
  return (
    <g>
      <rect x={n.x} y={n.y} width={n.w} height={58} rx={12} className={`${NODE_FILL[tone]} ${NODE_STROKE[tone]}`} strokeWidth={1.2} />
      <text x={n.x + n.w / 2} y={n.y + 25} textAnchor="middle" className="fill-ink" fontSize={14} fontWeight={600} fontFamily="var(--font-sans)">
        {n.t}
      </text>
      <text x={n.x + n.w / 2} y={n.y + 43} textAnchor="middle" className="fill-ink-2" fontSize={12} fontFamily="var(--font-mono)">
        {n.s}
      </text>
    </g>
  );
}

type ArrowTone = 'ink' | 'skim' | 'repaid';
const ARROW_STROKE: Record<ArrowTone, string> = { ink: 'stroke-ink-3', skim: 'stroke-skim', repaid: 'stroke-repaid' };

function Arrow({ d, label, lx, ly, tone = 'ink', dashed = false }: { d: string; label?: string; lx?: number; ly?: number; tone?: ArrowTone; dashed?: boolean }) {
  return (
    <g>
      {/* static dashes: no ambient motion */}
      <path d={d} fill="none" className={ARROW_STROKE[tone]} strokeWidth={1.5} strokeDasharray={dashed ? '3 5' : undefined} markerEnd={`url(#arrow-${tone})`} />
      {label && (
        <text x={lx} y={ly} textAnchor="middle" className="fill-ink-2" fontSize={12} fontFamily="var(--font-mono)">
          {label}
        </text>
      )}
    </g>
  );
}

function Diagram({ unit }: { unit: string }) {
  // money lane (y=40) and data lane (y=230)
  const charger: N = { x: 10, y: 40, w: 150, t: 'EV charger', s: 'driver pays' };
  const router: N = { x: 240, y: 40, w: 170, t: 'RevenueRouter', s: 'pay(machineId)' };
  const vault: N = { x: 520, y: 0, w: 170, t: 'SkimVault', s: 'repay() · escrow NFT', tone: 'skim' };
  const machine: N = { x: 520, y: 86, w: 170, t: 'Machine wallet', s: 'keeps the rest' };
  const owner: N = { x: 800, y: 0, w: 170, t: 'NFT returned', s: 'LoanClosed', tone: 'repaid' };

  const keeper: N = { x: 10, y: 236, w: 150, t: 'Keeper', s: 'watches RevenueRouted' };
  const registry: N = { x: 220, y: 236, w: 170, t: 'EventRegistry', s: 'revenue · trust 1' };
  const mcr: N = { x: 430, y: 236, w: 150, t: 'MCR', s: 'mcr.peaq.xyz', tone: 'peaq' };
  const oracle: N = { x: 620, y: 236, w: 150, t: 'MCROracle', s: 'post(score, grade)', tone: 'peaq' };
  const terms: N = { x: 810, y: 236, w: 160, t: 'Loan terms', s: 'quote(machineId)' };

  return (
    <svg viewBox="0 0 980 310" className="h-auto w-full" role="img" aria-label="SKIM architecture diagram">
      <defs>
        {(['ink', 'skim', 'repaid'] as const).map((t) => (
          <marker key={t} id={`arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className={t === 'ink' ? 'fill-ink-3' : t === 'skim' ? 'fill-skim' : 'fill-repaid'} />
          </marker>
        ))}
      </defs>
      <text x={10} y={20} className="fill-ink-2" fontSize={12} fontFamily="var(--font-sans)">
        Money · native {unit}
      </text>
      <text x={10} y={216} className="fill-ink-2" fontSize={12} fontFamily="var(--font-sans)">
        Data · credit signal
      </text>
      <Arrow d="M160 69 H236" label="session" lx={198} ly={60} />
      <Arrow d="M410 60 C460 60 470 29 516 29" label="skim %" lx={462} ly={36} tone="skim" />
      <Arrow d="M410 78 C460 78 470 115 516 115" label="rest" lx={462} ly={112} />
      <Arrow d="M690 29 H796" label="paid off" lx={743} ly={20} tone="repaid" />
      {/* router -> keeper (event) */}
      <Arrow d="M300 98 C300 170 85 170 85 232" label="RevenueRouted" lx={190} ly={166} dashed />
      <Arrow d="M160 265 H216" />
      <Arrow d="M390 265 H426" />
      <Arrow d="M580 265 H616" />
      <Arrow d="M770 265 H806" />
      {/* terms -> vault */}
      <Arrow d="M890 236 C890 170 640 190 620 62" label="sizes the next advance" lx={800} ly={180} dashed />
      {[charger, router, vault, machine, owner, keeper, registry, mcr, oracle, terms].map((n) => (
        <Node key={n.t} n={n} />
      ))}
    </svg>
  );
}

const MOBILE_STEPS = [
  ['EV charger → RevenueRouter', 'Each charging session is paid through pay(machineId, …).'],
  ['RevenueRouter → SkimVault + machine', 'The router skims the loan’s share to repay() and forwards the rest.'],
  ['SkimVault → NFT returned', 'Fully repaid: LoanClosed, the Machine NFT goes back.'],
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
        <div className="hidden md:block">
          <Diagram unit={unit} />
        </div>
        <ol className="space-y-3 md:hidden">
          {MOBILE_STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rule text-[12px] text-ink-2">{i + 1}</span>
              <div>
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
