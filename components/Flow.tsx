'use client';
import type { ReactNode } from 'react';
import { pct } from '@/lib/format';

/**
 * The split flow: Customer → Router → Vault | Machine.
 * Reused by the hero instrument (dark scope) and How it works (paper scope): colours are tokens,
 * so the same markup reads correctly in either.
 *
 * Motion: `pulse` is a value key (the session count). When it changes, the travelling dots and the
 * receiving node remount and play once: Customer→Router 260ms, then Router→Vault / Router→Machine
 * 260ms. Only transform/opacity animate, inside fixed boxes, so nothing reflows. With
 * prefers-reduced-motion the global guard collapses the travel to an instant end state (invisible).
 *
 * Layout: one row from `sm` up (Router forks into a stacked Vault/Machine column); two rows on
 * phones (Customer → Router, then Vault | Machine under a fork), so labels stay ≥14px.
 */
export type FlowMode = 'offer' | 'active' | 'repaid';

export function FlowStrip({ skimBps, mode, pulse, id }: { skimBps?: number; mode: FlowMode; pulse?: number; id?: string }) {
  const skim = skimBps ?? 0;
  const vaultLabel = mode === 'repaid' ? 'Vault · paid off' : `Vault ${pct(skim)}`;
  const machineLabel = mode === 'repaid' ? 'Machine 100%' : `Machine ${pct(10000 - skim)}`;
  const vaultSub = mode === 'repaid' ? 'loan closed' : mode === 'offer' ? 'repays on draw' : 'repays the loan';
  const machineSub = mode === 'repaid' ? 'keeps everything' : 'keeps the rest';
  const go = mode === 'active' && pulse !== undefined && pulse > 0;
  const vaultTone: Tone = mode === 'repaid' ? 'repaid' : 'skim';
  const nodes = {
    customer: <Node title="Customer" sub="pays per session" />,
    router: <Node title="Router" sub="pay(machineId)" mono />,
    vault: <Node title={vaultLabel} sub={vaultSub} tone={vaultTone} flash={go ? pulse : undefined} />,
    machine: <Node title={machineLabel} sub={machineSub} />,
  };
  const live = mode === 'active';

  return (
    <div id={id} className="min-w-0" aria-label={`Each payment: Customer to Router, then ${vaultLabel} to the vault and ${machineLabel} to the machine`} role="img">
      {/* sm and up: one row, router forks into a stacked column */}
      <div className="hidden grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)_minmax(0,1.15fr)] items-center sm:grid">
        {nodes.customer}
        <Wire dir="x" tone="ink" pulse={go ? pulse : undefined} delay={0} dashed={!live} />
        {nodes.router}
        <div className="relative grid grid-rows-2 gap-2">
          {/* fork stem joining the two legs */}
          <span aria-hidden className="absolute bottom-[25%] left-0 top-[25%] w-px bg-ink-3/60" />
          <div className="grid grid-cols-[22px_minmax(0,1fr)] items-center">
            <Wire dir="x" tone={vaultTone} pulse={go ? pulse : undefined} delay={260} dashed={!live} />
            {nodes.vault}
          </div>
          <div className="grid grid-cols-[22px_minmax(0,1fr)] items-center">
            <Wire dir="x" tone="ink" pulse={go ? pulse : undefined} delay={260} dashed={!live} />
            {nodes.machine}
          </div>
        </div>
      </div>

      {/* phones: two rows */}
      <div className="sm:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center">
          {nodes.customer}
          <Wire dir="x" tone="ink" pulse={go ? pulse : undefined} delay={0} dashed={!live} />
          {nodes.router}
        </div>
        {/* fork: stem down from Router, bar across, a drop into each node */}
        <div aria-hidden className="relative h-6">
          <span className="absolute left-[75%] top-0 h-2 w-px bg-ink-3/60" />
          <span className="absolute left-[25%] right-[25%] top-2 h-px bg-ink-3/60" />
          <div className="absolute left-[25%] top-2 h-4 w-px">
            <Wire dir="y" tone={vaultTone} pulse={go ? pulse : undefined} delay={260} dashed={!live} />
          </div>
          <div className="absolute left-[75%] top-2 h-4 w-px">
            <Wire dir="y" tone="ink" pulse={go ? pulse : undefined} delay={260} dashed={!live} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {nodes.vault}
          {nodes.machine}
        </div>
      </div>
    </div>
  );
}

type Tone = 'ink' | 'skim' | 'repaid';
const BORDER: Record<Tone, string> = { ink: 'border-rule', skim: 'border-skim/70', repaid: 'border-repaid/70' };
const TITLE: Record<Tone, string> = { ink: 'text-ink', skim: 'text-skim-text', repaid: 'text-repaid-text' };
const LINE: Record<Tone, string> = { ink: 'bg-ink-3/60', skim: 'bg-skim', repaid: 'bg-repaid' };
const DOT: Record<Tone, string> = { ink: 'bg-ink-2', skim: 'bg-skim', repaid: 'bg-repaid' };

function Node({ title, sub, tone = 'ink', mono = false, flash }: { title: ReactNode; sub: string; tone?: Tone; mono?: boolean; flash?: number }) {
  return (
    <div className={`relative h-[52px] min-w-0 overflow-hidden rounded-lg border bg-paper-2 px-2.5 py-1.5 transition-colors duration-300 ${BORDER[tone]}`}>
      {flash !== undefined && <span key={flash} aria-hidden className="flow-flash pointer-events-none absolute inset-0 bg-skim/20" />}
      <div className={`relative truncate text-[14px] font-semibold leading-5 transition-colors duration-300 ${TITLE[tone]}`}>{title}</div>
      <div className={`relative truncate text-[12px] leading-4 text-ink-2 ${mono ? 'font-mono' : ''}`}>{sub}</div>
    </div>
  );
}

/** A connector with an arrowhead and, when `pulse` changes, one dot travelling along it. */
function Wire({ dir, tone, pulse, delay, dashed }: { dir: 'x' | 'y'; tone: Tone; pulse?: number; delay: number; dashed?: boolean }) {
  if (dir === 'y') {
    return (
      <span aria-hidden className="relative block h-full w-px overflow-visible">
        <span className={`absolute inset-0 ${dashed ? 'opacity-50' : ''} ${LINE[tone]}`} />
        {pulse !== undefined && (
          <span key={pulse} className="flow-travel-y absolute inset-x-[-3px] inset-y-0" style={{ animationDelay: `${delay}ms` }}>
            <span className={`absolute bottom-0 left-0 h-[7px] w-[7px] rounded-full ${DOT[tone]}`} />
          </span>
        )}
      </span>
    );
  }
  return (
    <span aria-hidden className="relative mx-1 block h-[7px] overflow-hidden">
      <span className={`absolute left-0 right-[5px] top-[3px] h-px ${dashed ? 'opacity-50' : ''} ${LINE[tone]}`} />
      <span className={`absolute right-0 top-0 h-0 w-0 border-y-[3.5px] border-l-[6px] border-y-transparent ${tone === 'skim' ? 'border-l-skim' : tone === 'repaid' ? 'border-l-repaid' : 'border-l-ink-3'}`} />
      {pulse !== undefined && (
        <span key={pulse} className="flow-travel-x absolute inset-0" style={{ animationDelay: `${delay}ms` }}>
          <span className={`absolute right-0 top-0 h-[7px] w-[7px] rounded-full ${DOT[tone]}`} />
        </span>
      )}
    </span>
  );
}
