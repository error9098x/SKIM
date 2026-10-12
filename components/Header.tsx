'use client';
import { useState } from 'react';
import type { SkimState } from '@/lib/types';
import { depositToVault, hasInjected } from '@/lib/wallet';
import { txUrl } from '@/lib/format';
import { ExtLink, LiveBadge, SimBadge } from './ui';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#C4B5FF" />
            <stop offset="1" stopColor="#7350F5" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="#10101A" stroke="url(#lg)" strokeWidth="1.5" />
        <path d="M8 20.5c0 2 2.4 3 5.6 3 3.6 0 5.6-1.4 5.6-3.6 0-4.8-10.6-2.6-10.6-7.4 0-2 2-3.5 5.2-3.5 2.8 0 4.8 1 5.2 2.8" fill="none" stroke="url(#lg)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M22 10.5l3 0M22 15.5h3M22 20.5h3" stroke="#8B6CFF" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      </svg>
      <span className="text-[17px] font-semibold tracking-[0.18em] text-fog-100">SKIM</span>
    </div>
  );
}

export function FundVault({ state, compact = false }: { state: SkimState; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; hash?: string } | null>(null);
  const live = state.source === 'live' && !!state.contracts.vault;

  const submit = async () => {
    if (!state.contracts.vault) return;
    setBusy(true);
    setMsg(null);
    try {
      const hash = await depositToVault(state.network, state.contracts.vault, amount);
      setMsg({ ok: true, text: 'Deposit submitted', hash });
    } catch (e) {
      setMsg({ ok: false, text: ((e as Error).message || 'Failed').split('\n')[0].slice(0, 160) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`whitespace-nowrap rounded-lg border border-peaq-400/40 bg-peaq-600/90 font-medium text-white shadow-[0_8px_30px_-10px_rgba(115,80,245,0.8)] transition hover:bg-peaq-500 ${compact ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-sm'}`}
      >
        Fund the vault
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-white/10 bg-ink-850 p-4 shadow-2xl">
          <div className="text-sm font-medium text-fog-100">Lend to machines</div>
          <p className="mt-1 text-xs leading-relaxed text-fog-400">
            Deposits go to <span className="font-mono">SkimVault.deposit()</span> and fund advances. Uses your injected wallet; viewing never needs one.
          </p>
          {!live ? (
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-2.5 text-xs text-amber-400">
              This page is showing the demo replay. Deposits unlock once a deployment is synced.
            </p>
          ) : !hasInjected() ? (
            <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-xs text-fog-300">No injected wallet detected in this browser.</p>
          ) : (
            <div className="mt-3 flex gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded-lg border border-white/10 bg-ink-950 px-2.5">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  className="num w-full min-w-0 bg-transparent py-2 text-sm text-fog-100 outline-none"
                  aria-label="Amount"
                />
                <span className="text-xs text-fog-400">{state.network.token}</span>
              </div>
              <button disabled={busy || !Number(amount)} onClick={submit} className="rounded-lg bg-peaq-600 px-3 text-sm font-medium text-white disabled:opacity-50">
                {busy ? '…' : 'Deposit'}
              </button>
            </div>
          )}
          {msg && (
            <div className={`mt-2 text-xs ${msg.ok ? 'text-mint-400' : 'text-red-300'}`}>
              {msg.text} {msg.hash && <ExtLink href={txUrl(state.network.explorer, msg.hash)}>view tx</ExtLink>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ state, liveError }: { state: SkimState; liveError?: string }) {
  const mock = state.source === 'mock';
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Logo />
          <nav className="hidden items-center gap-5 text-[13px] text-fog-400 md:flex">
            <a href="#machine" className="hover:text-fog-100">Machine</a>
            <a href="#loan" className="hover:text-fog-100">Credit line</a>
            <a href="#revenue" className="hover:text-fog-100">Revenue</a>
            <a href="#how" className="hover:text-fog-100">How it works</a>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${mock ? 'bg-amber-400' : liveError ? 'bg-red-400' : 'bg-mint-400'}`} />
            <span className="whitespace-nowrap text-xs text-fog-300">{mock ? 'Demo replay' : state.network.name}</span>
          </div>
          {mock ? <SimBadge title="No deployment synced: the page is replaying bundled mock-state.json" /> : <LiveBadge />}
          <FundVault state={state} compact />
        </div>
      </div>
    </header>
  );
}
