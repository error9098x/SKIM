'use client';
import type { SkimState } from '@/lib/types';
import { LINKS } from '@/lib/config';
import { addrUrl } from '@/lib/format';
import { CopyText, ExtLink, SimBadge } from './ui';

type N = { x: number; y: number; w: number; t: string; s: string; tone?: 'peaq' | 'mint' | 'base' };

function Node({ n }: { n: N }) {
  const stroke = n.tone === 'peaq' ? '#8B6CFF' : n.tone === 'mint' ? '#4BE3B0' : 'rgba(255,255,255,0.16)';
  const fill = n.tone === 'peaq' ? 'rgba(139,108,255,0.12)' : n.tone === 'mint' ? 'rgba(75,227,176,0.08)' : 'rgba(255,255,255,0.03)';
  return (
    <g>
      <rect x={n.x} y={n.y} width={n.w} height={58} rx={12} fill={fill} stroke={stroke} strokeWidth={1.2} />
      <text x={n.x + n.w / 2} y={n.y + 25} textAnchor="middle" fill="#F4F3FA" fontSize={14} fontWeight={600} fontFamily="var(--font-sans)">
        {n.t}
      </text>
      <text x={n.x + n.w / 2} y={n.y + 43} textAnchor="middle" fill="#8E8AA8" fontSize={11} fontFamily="var(--font-mono)">
        {n.s}
      </text>
    </g>
  );
}

function Arrow({ d, label, lx, ly, color = '#8B6CFF', dashed = false }: { d: string; label?: string; lx?: number; ly?: number; color?: string; dashed?: boolean }) {
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1.5} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} className={dashed ? '' : 'flow-line'} strokeDasharray={dashed ? '3 5' : undefined} markerEnd="url(#arrow)" />
      {label && (
        <text x={lx} y={ly} textAnchor="middle" fill="#B5B2CA" fontSize={11} fontFamily="var(--font-mono)">
          {label}
        </text>
      )}
    </g>
  );
}

function Diagram() {
  // money lane (y=40) and data lane (y=230)
  const charger: N = { x: 10, y: 40, w: 150, t: 'EV charger', s: 'driver pays', tone: 'base' };
  const router: N = { x: 240, y: 40, w: 170, t: 'RevenueRouter', s: 'pay(machineId)', tone: 'peaq' };
  const vault: N = { x: 520, y: 0, w: 170, t: 'SkimVault', s: 'repay() · escrow NFT', tone: 'peaq' };
  const machine: N = { x: 520, y: 86, w: 170, t: 'Machine wallet', s: 'keeps the rest', tone: 'mint' };
  const owner: N = { x: 800, y: 0, w: 170, t: 'NFT returned', s: 'LoanClosed', tone: 'mint' };

  const keeper: N = { x: 10, y: 236, w: 150, t: 'Keeper', s: 'watches RevenueRouted', tone: 'base' };
  const registry: N = { x: 220, y: 236, w: 170, t: 'EventRegistry', s: 'revenue · trust 1', tone: 'base' };
  const mcr: N = { x: 430, y: 236, w: 150, t: 'MCR', s: 'mcr.peaq.xyz', tone: 'base' };
  const oracle: N = { x: 620, y: 236, w: 150, t: 'MCROracle', s: 'post(score, grade)', tone: 'peaq' };
  const terms: N = { x: 810, y: 236, w: 160, t: 'Loan terms', s: 'quote(machineId)', tone: 'peaq' };

  return (
    <svg viewBox="0 0 980 310" className="h-auto w-full" role="img" aria-label="SKIM architecture diagram">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#A48BFF" />
        </marker>
      </defs>
      <text x={10} y={20} fill="#6D6987" fontSize={10} letterSpacing={2} fontFamily="var(--font-sans)">
        MONEY · NATIVE PEAQ
      </text>
      <text x={10} y={216} fill="#6D6987" fontSize={10} letterSpacing={2} fontFamily="var(--font-sans)">
        DATA · CREDIT SIGNAL
      </text>
      <Arrow d="M160 69 H236" label="session" lx={198} ly={60} />
      <Arrow d="M410 60 C460 60 470 29 516 29" label="skim %" lx={462} ly={36} />
      <Arrow d="M410 78 C460 78 470 115 516 115" label="rest" lx={462} ly={112} color="#4BE3B0" />
      <Arrow d="M690 29 H796" label="paid off" lx={743} ly={20} color="#4BE3B0" />
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
  const rows: [string, string | undefined][] = [
    ['SkimVault', c.vault],
    ['RevenueRouter', c.router],
    ['MCROracle', c.oracle],
    ['Machine NFT', c.machineNft],
    [state.network.isMainnet ? 'EventRegistry 2.0' : 'MockEventRegistry', c.eventRegistry],
  ];
  const mock = state.source === 'mock';
  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <div className="card p-5 sm:p-6">
        <div className="hidden md:block">
          <Diagram />
        </div>
        <ol className="space-y-3 md:hidden">
          {MOBILE_STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-peaq-400/40 text-[11px] text-peaq-300">{i + 1}</span>
              <div>
                <div className="text-sm font-medium text-fog-100">{t}</div>
                <div className="text-xs leading-relaxed text-fog-400">{d}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 grid gap-3 border-t border-white/[0.06] pt-5 text-sm text-fog-300 sm:grid-cols-3">
          <p>
            <span className="font-medium text-fog-100">Collateral is identity.</span> The Machine NFT is escrowed, so a defaulted loan leaves the vault holding the machine’s on-chain identity.
          </p>
          <p>
            <span className="font-medium text-fog-100">Repayment is automatic.</span> No invoices or schedules: the router repays a fixed share of whatever the machine earns.
          </p>
          <p>
            <span className="font-medium text-fog-100">Credit compounds.</span> Verified revenue raises the MCR, and a better grade unlocks a bigger, cheaper next line.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="label">Contracts · {state.network.name}</div>
            {mock && <SimBadge title="Placeholder addresses from the demo replay" />}
          </div>
          <ul className="mt-3 space-y-2.5">
            {rows.map(([name, a]) => (
              <li key={name} className="flex items-center justify-between gap-3 text-sm">
                <span className="shrink-0 text-fog-300">{name}</span>
                {a ? (
                  mock ? (
                    <span className="truncate font-mono text-xs text-fog-500">{a.slice(0, 8)}…{a.slice(-6)}</span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2">
                      <CopyText text={a} display={`${a.slice(0, 8)}…${a.slice(-6)}`} className="text-xs" />
                      <ExtLink href={addrUrl(state.network.explorer, a)} className="text-xs">
                        {' '}
                      </ExtLink>
                    </span>
                  )
                ) : (
                  <span className="text-xs text-fog-500">—</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 text-[11px] text-fog-500">Chain {state.network.chainId} · all value in native {state.network.token}</div>
        </div>
        <div className="card grid grid-cols-3 divide-x divide-white/[0.06] overflow-hidden">
          {[
            ['GitHub', LINKS.github],
            ['README', LINKS.readme],
            ['Demo video', LINKS.video],
          ].map(([t, href]) => (
            <a key={t} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="px-3 py-4 text-center text-sm font-medium text-fog-200 transition hover:bg-peaq-500/10 hover:text-fog-100">
              {t} <span className="text-fog-500">↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
