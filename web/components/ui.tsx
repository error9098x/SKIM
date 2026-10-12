'use client';
import { useState, type ReactNode } from 'react';
import type { SkimState } from '@/lib/types';
import { txUrl } from '@/lib/format';
import { isDemo } from './view';

type Tone = 'default' | 'peaq' | 'repaid' | 'skim' | 'danger';

export function Chip({ children, tone = 'default', title, className = '' }: { children: ReactNode; tone?: Tone; title?: string; className?: string }) {
  const tones: Record<Tone, string> = {
    default: 'border-rule bg-paper-2 text-ink-2',
    peaq: 'border-peaq/40 bg-peaq/10 text-peaq-text',
    repaid: 'border-repaid/50 bg-repaid/10 text-repaid-text',
    skim: 'border-skim/50 bg-skim/10 text-skim-text',
    danger: 'border-danger/40 bg-danger/10 text-danger',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[12px] font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Hatched "simulated" mark. Budget: at most two on screen (grade seal + feed header). */
export function SimTag({ children = 'Simulated', title }: { children?: ReactNode; title?: string }) {
  return (
    <span title={title} className="sim-hatch inline-flex items-center whitespace-nowrap rounded-md border border-rule px-1.5 py-0.5 text-[12px] font-medium text-ink-2">
      {children}
    </span>
  );
}

/** A tx hash: real ones link to the explorer; demo ones are a neutral "demo hash" chip with no link and no tick. */
export function HashRef({ state, hash, className = '' }: { state: SkimState; hash?: string; className?: string }) {
  if (!hash) return null;
  const shortHash = `${hash.slice(0, 10)}…`;
  if (isDemo(state)) {
    return (
      <span title="Generated locally by the demo replay, not on chain" className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[12px] text-ink-3 ${className}`}>
        demo hash <span className="text-ink-3">{hash.slice(0, 6)}…</span>
      </span>
    );
  }
  return (
    <ExtLink href={txUrl(state.network.explorer, hash)} className={`font-mono text-[12px] ${className}`}>
      {shortHash}
    </ExtLink>
  );
}

export function ExtLink({ href, children, className = '' }: { href?: string; children: ReactNode; className?: string }) {
  if (!href || href.startsWith('#')) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`link ${className}`}>
      {children}
      <span aria-hidden className="ml-0.5 inline-block text-[0.8em] opacity-70">↗</span>
    </a>
  );
}

export function CopyText({ text, display, className = '' }: { text: string; display?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${text}`}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className={`group inline-flex min-w-0 items-center gap-1.5 font-mono text-ink hover:text-ink-2 ${className}`}
    >
      <span className="truncate">{display ?? text}</span>
      {/* fixed width so "copy" -> "copied" never shifts the row */}
      <span className="inline-block w-[44px] shrink-0 text-left text-[12px] text-ink-3 group-hover:text-peaq-text">{done ? 'copied' : 'copy'}</span>
    </button>
  );
}

export function SectionHead({ title, right, id }: { title: string; right?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-5 flex scroll-mt-24 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h2>
      {right && <div className="flex h-7 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">{right}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: 'skim' }) {
  return (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className={`num mt-1 truncate text-xl font-medium sm:text-2xl ${accent === 'skim' ? 'text-skim-text' : 'text-ink'}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** Grade seal. Full grade names only ("Provisioned", never "PRV"). `sim` adds the hatched mark. */
export function GradeBadge({ grade, size = 'md', sim = false }: { grade: string; size?: 'md' | 'lg'; sim?: boolean }) {
  const long = grade.length > 3;
  const s =
    size === 'lg'
      ? `h-16 min-w-16 px-3 ${long ? 'text-base' : 'text-2xl'}`
      : `h-9 min-w-9 px-2 ${long ? 'text-[13px]' : 'text-sm'}`;
  return (
    <span
      title={sim ? 'Simulated rating (no MCR on this network)' : undefined}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-peaq/60 font-mono font-semibold text-ink ${sim ? 'sim-hatch' : 'bg-peaq/10'} ${s}`}
    >
      {grade}
    </span>
  );
}

/**
 * The single mode bar. Replaces the scattered SIMULATED/LIVE badges and the RPC-error strip.
 * Fixed height, one line, truncates instead of wrapping, so phase changes never shift layout.
 */
export function ModeBar({ state, liveAvailable, liveError }: { state: SkimState; liveAvailable: boolean; liveError?: string }) {
  const demo = isDemo(state);
  let text: string;
  let short: string | undefined;
  if (demo) {
    const lead = liveAvailable ? (liveError ? 'Chain unreachable, retrying · showing demo replay' : 'Connecting to chain · showing demo replay') : 'Simulated · demo replay of one loan cycle';
    text = state.demoPhase ? `${lead} · ${state.demoPhase}` : lead;
    // 390px: one short line so the phase is never ellipsised ("Simulated · demo · Repaying · session 4").
    const ph = state.demoPhase
      ?.replace('Repaying from revenue', 'Repaying')
      .replace(' · waiting for first session', '')
      .replace(' · starter line available', '')
      .replace('rating upgraded to', 'upgraded to');
    const sl = liveAvailable ? (liveError ? 'Chain unreachable · demo' : 'Connecting · demo') : 'Simulated · demo';
    short = ph ? `${sl} · ${ph}` : sl;
  } else {
    const parts = [state.network.name];
    if (state.blockNumber !== undefined) parts.push(`block ${state.blockNumber.toString()}`);
    if (state.simulatedRating) parts.push('rating simulated (no MCR on this network)');
    if (liveError) parts.push('RPC hiccup, retrying every 5s');
    text = `Live · ${parts.join(' · ')}`;
    // QA-7, 390px: keep 'rating simulated' visible (short network key, no parenthetical).
    const sp = [state.network.key || state.network.name];
    if (state.blockNumber !== undefined) sp.push(`block ${state.blockNumber.toString()}`);
    if (state.simulatedRating) sp.push('rating simulated');
    if (liveError) sp.push('RPC retrying');
    short = `Live · ${sp.join(' · ')}`;
  }
  return (
    <div role="status" aria-live="off" className={`h-9 border-b border-rule ${demo ? 'sim-hatch-paper' : 'bg-paper-2'}`}>
      <div className="mx-auto flex h-full max-w-6xl items-center gap-2 px-4 text-[12px] text-ink-2 sm:px-6">
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${demo ? 'bg-ink-3' : liveError ? 'bg-danger' : 'bg-repaid'}`} />
        {short ? (
          <>
            <span className="min-w-0 truncate sm:hidden">{short}</span>
            <span className="hidden min-w-0 truncate sm:inline">{text}</span>
          </>
        ) : (
          <span className="min-w-0 truncate">{text}</span>
        )}
      </div>
    </div>
  );
}
