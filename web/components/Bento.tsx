'use client';
import type { MouseEvent, ReactNode } from 'react';
import { SPEC_TERMS, gradeName } from '@/lib/config';
import { fmtToken, pct } from '@/lib/format';
import { DottedGlow } from './DottedGlow';
import { Reveal } from './Reveal';

/** Dashed-grid tile with "+" corner markers and a cursor spotlight. */
function Tile({ className = '', children, glow = false, delay = 0 }: { className?: string; children: ReactNode; glow?: boolean; delay?: number }) {
  const move = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div className={`${className} min-w-0`}>
      <Reveal delay={delay} className="h-full">
        <div onMouseMove={move} className="spot group relative h-full min-w-0 overflow-hidden border-b border-r border-dashed border-rule p-5 sm:p-7">
          <span aria-hidden className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 text-[14px] leading-none text-ink-3">+</span>
          {glow && (
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-40 [mask-image:radial-gradient(circle_at_70%_40%,#000,transparent_60%)]">
              <DottedGlow gap={14} opacity={0.35} />
            </div>
          )}
          <div className="relative flex h-full flex-col">{children}</div>
        </div>
      </Reveal>
    </div>
  );
}

const Title = ({ children }: { children: ReactNode }) => <h3 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">{children}</h3>;
const Body = ({ children }: { children: ReactNode }) => <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-2">{children}</p>;
const Art = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`relative flex min-h-[150px] flex-1 items-center justify-center pt-6 ${className}`}>{children}</div>
);

/** Real SPEC curve as bars; hovering the tile lights them up in a wave. */
function Staircase() {
  const max = Number(SPEC_TERMS[SPEC_TERMS.length - 1].principal);
  return (
    <Art className="!items-end">
      <div className="flex h-40 w-full items-end gap-2" role="img" aria-label="Principal by grade">
        {SPEC_TERMS.map((t, i) => (
          <div key={t.grade} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="num text-[10px] text-ink-3 transition-colors duration-300 group-hover:text-ink-2">{fmtToken(t.principal, 0)}</span>
            <div
              style={{ height: `${Math.max(10, (Number(t.principal) / max) * 100)}%`, transitionDelay: `${i * 45}ms` }}
              className="relative w-full overflow-hidden rounded-t-md border border-b-0 border-peaq/30 bg-gradient-to-t from-peaq/5 to-peaq/30 transition-all duration-500 group-hover:border-peaq/50 group-hover:to-peaq/45"
            >
              <span className="absolute inset-x-0 top-0 h-px bg-peaq/80" />
            </div>
            <span className="num truncate text-[10px] text-ink-3">{t.grade === 0 ? 'Prov.' : gradeName(t.grade)}</span>
          </div>
        ))}
      </div>
    </Art>
  );
}

/** Three stacked layers floating out of phase: the NFT in escrow. */
function EscrowArt() {
  const layer = 'absolute left-1/2 top-1/2 h-24 w-24 rounded-xl border [transform:translate(-50%,-50%)_rotateX(60deg)_rotateZ(45deg)]';
  return (
    <Art>
      <div className="relative h-40 w-40">
        <div className="float-y-3 absolute inset-x-0 top-8 h-40"><div className={`${layer} border-rule bg-paper-2/40`} /></div>
        <div className="float-y-2 absolute inset-x-0 top-4 h-40"><div className={`${layer} border-rule bg-paper-2`} /></div>
        <div className="float-y absolute inset-x-0 top-0 h-40">
          <div className={`${layer} border-peaq/60 bg-[rgb(var(--paper-2))] shadow-[0_0_40px_-6px_rgb(var(--peaq)/0.55)]`}>
            <div className="absolute inset-0 rounded-xl bg-peaq/15" />
            <div className="absolute inset-3 rounded-lg border border-dashed border-peaq/40" />
          </div>
        </div>
        <span className="num absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-rule bg-paper px-2 py-0.5 text-[11px] text-ink-2">Machine NFT · escrowed</span>
      </div>
    </Art>
  );
}

/** Customer payment → router → splits to vault / machine, with travelling dots. */
function FlowArt() {
  const skim = SPEC_TERMS[0].skimBps / 100;
  const node = 'rounded-lg border border-rule bg-paper-2 px-2.5 py-1.5 text-[12px] font-medium text-ink';
  return (
    <Art>
      <div className="flex w-full items-center gap-2">
        <span className={node}>Customer</span>
        <div className="relative h-px flex-1 bg-rule">
          <span style={{ ['--dist' as string]: '80px' }} className="travel absolute -top-[2px] left-0 h-[5px] w-[5px] rounded-full bg-ink" />
          <span style={{ ['--dist' as string]: '80px', animationDelay: '1.1s' }} className="travel absolute -top-[2px] left-0 h-[5px] w-[5px] rounded-full bg-ink" />
        </div>
        <span className={`${node} border-peaq/50`}>Router</span>
        <div className="flex flex-col gap-2">
          <span className={`${node} border-skim/50 text-skim-text`}>Vault · {skim}%</span>
          <span className={node}>Machine · {100 - skim}%</span>
        </div>
      </div>
    </Art>
  );
}

/** Rating curve that redraws itself on loop. */
function CurveArt() {
  return (
    <Art>
      <svg viewBox="0 0 300 120" className="h-full w-full max-w-[420px]" aria-hidden>
        {[30, 60, 90].map((y) => (
          <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="rgb(var(--rule))" strokeDasharray="3 5" />
        ))}
        <path d="M0 105 C 60 100, 90 85, 140 62 S 240 18, 292 12" fill="none" stroke="rgb(var(--ink))" strokeWidth="2" strokeLinecap="round" pathLength={1} className="draw" />
        <g transform="translate(292 12)">
          <circle r="4" fill="rgb(var(--repaid))" />
          <circle r="4" fill="none" stroke="rgb(var(--repaid))" className="ring" />
        </g>
      </svg>
    </Art>
  );
}

/** Terminal that replays a repayment, line by line. */
function TerminalArt() {
  const lines: [string, string][] = [
    ['$ skim route --payment 0.74', 'text-ink'],
    ['✓ RevenueRouter split 28% → vault', 'text-repaid-text'],
    ['✓ EventRegistry trust-1 event posted', 'text-repaid-text'],
    ['✓ MCROracle grade B → BBB', 'text-peaq-text'],
  ];
  return (
    <Art className="!items-stretch">
      <div className="w-full rounded-xl border border-rule bg-paper p-4 font-mono text-[12px]">
        <div className="mb-3 flex items-center gap-1.5" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-rule" />
          <span className="h-2 w-2 rounded-full bg-rule" />
          <span className="h-2 w-2 rounded-full bg-rule" />
          <span className="ml-auto text-[11px] text-ink-3">agung · run 2</span>
        </div>
        <ul className="space-y-1.5">
          {lines.map(([t, c], i) => (
            <li key={t} style={{ animationDelay: `${i * 0.7}s` }} className={`line-in ${c}`}>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </Art>
  );
}

/** Two roles, one machine: NFT holder (vault) vs DID controller (operator). */
function RolesArt() {
  const chip = 'rounded-lg border bg-paper-2 px-3 py-1.5 text-[12px] font-medium';
  return (
    <Art>
      <div className="relative flex w-full flex-col items-center gap-3">
        <span className={`${chip} float-y border-peaq/50 text-peaq-text`}>Vault · holds NFT</span>
        <span aria-hidden className="h-6 w-px bg-gradient-to-b from-rule to-transparent" />
        <span className={`${chip} float-y-2 border-repaid/50 text-repaid-text`}>Operator · controls DID</span>
      </div>
    </Art>
  );
}

export function BentoGrid() {
  const first = SPEC_TERMS[0];
  const top = SPEC_TERMS[SPEC_TERMS.length - 1];
  return (
    <div className="relative grid border-l border-t border-dashed border-rule md:grid-cols-6">
      <Tile glow className="md:col-span-4">
        <Title>Repay once. Borrow bigger and cheaper.</Title>
        <Body>
          Every trust-1 revenue event lifts the Machine Credit Rating. Principal climbs from {fmtToken(first.principal, 0)} to {fmtToken(top.principal, 0)}; the fee falls {pct(first.feeBps)} → {pct(top.feeBps)} and the skim {pct(first.skimBps)} → {pct(top.skimBps)}.
        </Body>
        <Staircase />
      </Tile>
      <Tile className="md:col-span-2" delay={80}>
        <Title>Identity as collateral</Title>
        <Body>The Machine NFT locks in the vault and returns to the operator on the last repayment.</Body>
        <EscrowArt />
      </Tile>

      <Tile className="md:col-span-3" delay={0}>
        <Title>Repayment is automatic</Title>
        <Body>No invoices or schedules. The router sends a fixed share of every payment to the vault.</Body>
        <FlowArt />
      </Tile>
      <Tile glow className="md:col-span-3" delay={80}>
        <Title>Credit that compounds</Title>
        <Body>Better history, better grade. A bigger line with a lighter skim unlocks after each repayment.</Body>
        <CurveArt />
      </Tile>

      <Tile className="md:col-span-4" delay={0}>
        <Title>Every payment, verifiable</Title>
        <Body>Revenue events cite the router transaction, so the rating rests on checkable history. Ran twice on peaq agung, both loans repaid.</Body>
        <TerminalArt />
      </Tile>
      <Tile className="md:col-span-2" delay={80}>
        <Title>The machine keeps running</Title>
        <Body>Owning the NFT and controlling the DID are separate roles, so the charger never goes offline.</Body>
        <RolesArt />
      </Tile>
    </div>
  );
}
