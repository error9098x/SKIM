'use client';
import { useState, type ReactNode } from 'react';

export function SimBadge({ title = 'Simulated data', className = '' }: { title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-400 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Simulated
    </span>
  );
}

export function LiveBadge({ label = 'Live' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-mint-400/30 bg-mint-400/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-mint-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
      </span>
      {label}
    </span>
  );
}

export function Chip({ children, tone = 'default', title }: { children: ReactNode; tone?: 'default' | 'peaq' | 'mint' | 'amber' | 'red'; title?: string }) {
  const tones = {
    default: 'border-white/10 bg-white/[0.04] text-fog-200',
    peaq: 'border-peaq-400/30 bg-peaq-500/10 text-peaq-300',
    mint: 'border-mint-400/30 bg-mint-400/10 text-mint-400',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
    red: 'border-red-400/30 bg-red-400/10 text-red-300',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ExtLink({ href, children, className = '' }: { href?: string; children: ReactNode; className?: string }) {
  if (!href) return <span className={className}>{children}</span>;
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
      className={`group inline-flex min-w-0 items-center gap-1.5 font-mono text-fog-200 hover:text-fog-100 ${className}`}
    >
      <span className="truncate">{display ?? text}</span>
      <span className="shrink-0 text-[10px] text-fog-500 group-hover:text-peaq-300">{done ? 'copied' : 'copy'}</span>
    </button>
  );
}

export function SectionHead({ eyebrow, title, right, id }: { eyebrow: string; title: string; right?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-5 flex scroll-mt-24 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="label text-peaq-300">{eyebrow}</div>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-fog-100 sm:text-[28px]">{title}</h2>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className={`num mt-1 truncate text-xl font-medium sm:text-2xl ${accent ? 'text-peaq-300' : 'text-fog-100'}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-fog-400">{sub}</div>}
    </div>
  );
}

export function GradeBadge({ grade, size = 'md' }: { grade: string; size?: 'md' | 'lg' }) {
  const s = size === 'lg' ? 'h-16 min-w-16 px-3 text-2xl' : 'h-9 min-w-9 px-2 text-sm';
  return (
    <span className={`inline-flex items-center justify-center rounded-xl border border-peaq-400/40 bg-gradient-to-b from-peaq-500/30 to-peaq-700/20 font-mono font-semibold text-fog-100 shadow-[0_0_30px_-8px_rgba(139,108,255,0.7)] ${s}`}>
      {grade}
    </span>
  );
}
