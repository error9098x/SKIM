'use client';
import { useEffect, useState } from 'react';
import type { SkimState } from '@/lib/types';
import { depositToVault, hasInjected } from '@/lib/wallet';
import { txUrl } from '@/lib/format';
import { ExtLink } from './ui';
import { unitLabel } from './view';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="9" className="fill-ink" />
        <path d="M8 20.5c0 2 2.4 3 5.6 3 3.6 0 5.6-1.4 5.6-3.6 0-4.8-10.6-2.6-10.6-7.4 0-2 2-3.5 5.2-3.5 2.8 0 4.8 1 5.2 2.8" fill="none" className="stroke-paper" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M22 10.5l3 0M22 15.5h3M22 20.5h3" className="stroke-skim" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight text-ink">SKIM</span>
    </div>
  );
}

/** Demoted, honestly labelled (owner-managed liquidity, no LP shares): a quiet secondary control. The primary CTA is "Watch a loan repay itself" in the hero. */
export function FundVault({ state }: { state: SkimState }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; hash?: string } | null>(null);
  const live = state.source === 'live' && !!state.contracts.vault;
  const unit = unitLabel(state);

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
        aria-expanded={open}
        className="press whitespace-nowrap rounded-lg border border-rule bg-paper-2/60 px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors duration-200 hover:border-ink-3 hover:text-ink"
      >
        Vault liquidity
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-rule bg-paper p-4 shadow-lg">
          <div className="text-sm font-medium text-ink">Vault liquidity · owner-managed</div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
            <span className="font-mono">SkimVault.deposit()</span> adds liquidity that funds advances. There are no LP shares yet: only the vault owner can withdraw, so this is the operator&apos;s own capital, not an outside-lender product. Uses your injected wallet; viewing never needs one.
          </p>
          {!live ? (
            <p className="mt-3 rounded-lg border border-rule bg-paper-2 p-2.5 text-[12px] text-ink-2">This page is showing the demo replay. Deposits unlock once a deployment is synced.</p>
          ) : !hasInjected() ? (
            <p className="mt-3 rounded-lg border border-rule bg-paper-2 p-2.5 text-[12px] text-ink-2">No injected wallet detected in this browser.</p>
          ) : (
            <div className="mt-3 flex gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded-lg border border-rule bg-paper-2 px-2.5">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  className="num w-full min-w-0 bg-transparent py-2 text-sm text-ink outline-none"
                  aria-label="Amount"
                />
                <span className="whitespace-nowrap text-[12px] text-ink-2">{unit}</span>
              </div>
              <button disabled={busy || !Number(amount)} onClick={submit} className="rounded-lg bg-ink px-3 text-sm font-medium text-paper disabled:opacity-50">
                {busy ? '…' : 'Deposit'}
              </button>
            </div>
          )}
          {msg && (
            <div className={`mt-2 text-[12px] ${msg.ok ? 'text-repaid-text' : 'text-danger'}`}>
              {msg.text} {msg.hash && <ExtLink href={txUrl(state.network.explorer, msg.hash)}>view tx</ExtLink>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const NAV = [
  ['why', 'Why SKIM'],
  ['revenue', 'Revenue'],
  ['terms', 'Terms'],
  ['loan', 'Credit line'],
  ['how', 'How it works'],
] as const;

/** Tracks which section sits under the sticky header. */
function useActiveSection(): string {
  const [active, setActive] = useState('');
  useEffect(() => {
    const els = NAV.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-20% 0px -65% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return active;
}

export function Header({ state }: { state: SkimState }) {
  const active = useActiveSection();
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <a href="#" aria-label="SKIM home" className="press">
            <Logo />
          </a>
          <nav aria-label="Sections" className="hidden items-center gap-0.5 rounded-full border border-rule bg-paper-2/60 p-1 text-[13px] md:flex">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={active === id ? 'true' : undefined}
                className={`rounded-full px-3 py-1 transition-all duration-300 ${active === id ? 'bg-paper text-ink shadow-[0_0_0_1px_rgb(var(--rule))]' : 'text-ink-2 hover:text-ink'}`}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
        <FundVault state={state} />
      </div>
    </header>
  );
}
