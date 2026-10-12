'use client';
import { useEffect, useState } from 'react';
import type { SkimState } from '@/lib/types';
import { fmtToken, timeAgo, txUrl } from '@/lib/format';
import { Chip, ExtLink, SimBadge } from './ui';

function useNow() {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function RevenueFeed({ state }: { state: SkimState }) {
  const now = useNow();
  const tok = state.network.token;
  const live = state.source === 'live';
  const total = state.sessions.reduce((a, s) => a + s.amount, 0n);
  const skim = state.sessions.reduce((a, s) => a + s.skimmed, 0n);
  const fwd = state.sessions.reduce((a, s) => a + s.forwarded, 0n);
  const verified = state.sessions.filter((s) => s.verified).length;

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-2 gap-px border-b border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
        {[
          ['Sessions', String(state.sessions.length), `${verified} verified`],
          ['Revenue routed', fmtToken(total, 3), tok],
          ['Skimmed to vault', fmtToken(skim, 3), tok],
          ['Forwarded to machine', fmtToken(fwd, 3), tok],
        ].map(([l, v, s]) => (
          <div key={l} className="bg-ink-900 px-5 py-4">
            <div className="label">{l}</div>
            <div className="num mt-1 truncate text-xl text-fog-100">
              {v} <span className="text-xs text-fog-500">{s}</span>
            </div>
          </div>
        ))}
      </div>

      {state.sessions.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-fog-400">
          Waiting for the first charging session to route through <span className="font-mono text-fog-200">RevenueRouter.pay()</span>…
        </div>
      ) : (
        <div className="max-h-[440px] overflow-auto">
          {/* desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="sticky top-0 bg-ink-900">
              <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-fog-500">
                <th className="px-6 py-2.5 font-medium">Session</th>
                <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                <th className="px-3 py-2.5 text-right font-medium">Skim → vault</th>
                <th className="px-3 py-2.5 text-right font-medium">→ machine</th>
                <th className="px-3 py-2.5 font-medium">peaq revenue event</th>
                <th className="px-6 py-2.5 text-right font-medium">Router tx</th>
              </tr>
            </thead>
            <tbody>
              {state.sessions.map((s, i) => (
                <tr key={s.key} className={`border-b border-white/[0.04] ${i === 0 ? 'animate-rise' : ''}`}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-xs">⚡</span>
                      <div>
                        <div className="font-mono text-xs text-fog-200">{s.sessionId.slice(0, 10)}…</div>
                        <div className="text-[11px] text-fog-500">{timeAgo(s.timestamp, now)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num px-3 py-3 text-right text-fog-100">{fmtToken(s.amount, 3)}</td>
                  <td className="num px-3 py-3 text-right text-peaq-300">+{fmtToken(s.skimmed, 3)}</td>
                  <td className="num px-3 py-3 text-right text-fog-300">{fmtToken(s.forwarded, 3)}</td>
                  <td className="px-3 py-3">
                    {s.verified ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Chip tone="mint" title="EventRegistry entry cites this router tx as sourceTxHash">✓ verified · trust {s.verified.trustLevel ?? 1}</Chip>
                        {s.verified.valueCents !== undefined && <span className="num text-[11px] text-fog-500">${(s.verified.valueCents / 100).toFixed(2)}</span>}
                      </span>
                    ) : (
                      <Chip>pending keeper</Chip>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <ExtLink href={live ? txUrl(state.network.explorer, s.txHash) : undefined} className="font-mono text-xs">
                      {s.txHash?.slice(0, 10)}…
                    </ExtLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* mobile list */}
          <ul className="divide-y divide-white/[0.05] md:hidden">
            {state.sessions.map((s, i) => (
              <li key={s.key} className={`px-4 py-3 ${i === 0 ? 'animate-rise' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-base text-fog-100">
                    {fmtToken(s.amount, 3)} <span className="text-xs text-fog-500">{tok}</span>
                  </span>
                  {s.verified ? <Chip tone="mint">✓ verified</Chip> : <Chip>pending</Chip>}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <span className="num text-peaq-300">+{fmtToken(s.skimmed, 3)} skim</span>
                  <span className="num text-fog-400">{fmtToken(s.forwarded, 3)} → machine</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-fog-500">
                  <span>{timeAgo(s.timestamp, now)}</span>
                  <ExtLink href={live ? txUrl(state.network.explorer, s.txHash) : undefined} className="font-mono">
                    {s.txHash?.slice(0, 10)}…
                  </ExtLink>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!live && (
        <div className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-3 text-[11px] text-fog-500">
          <SimBadge /> Demo replay: transactions and hashes are generated locally, not on chain.
        </div>
      )}
    </div>
  );
}

const ICON: Record<string, string> = { rating: '★', loan: '↗', repaid: '↺', closed: '✓', deposit: '＋', default: '!', nft: '◆' };

export function ActivityLog({ state }: { state: SkimState }) {
  const now = useNow();
  const live = state.source === 'live';
  return (
    <div className="card flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="label">Loan ledger</div>
        {state.blockNumber !== undefined && <span className="num text-[11px] text-fog-500">block {state.blockNumber.toString()}</span>}
      </div>
      {state.activity.length === 0 ? (
        <p className="mt-4 text-sm text-fog-400">No loan events yet.</p>
      ) : (
        <ol className="relative mt-4 space-y-4 border-l border-white/[0.08] pl-5">
          {state.activity.slice(0, 8).map((a) => (
            <li key={a.key} className="relative animate-rise">
              <span
                className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  a.kind === 'closed' ? 'border-mint-400/50 bg-mint-400/15 text-mint-400' : a.kind === 'default' ? 'border-red-400/50 bg-red-400/10 text-red-300' : 'border-peaq-400/40 bg-ink-900 text-peaq-300'
                }`}
              >
                {ICON[a.kind] ?? '•'}
              </span>
              <div className="text-sm text-fog-100">{a.label}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-fog-500">
                {a.detail && <span>{a.detail}</span>}
                <span>{timeAgo(a.timestamp, now)}</span>
                {live && a.txHash && <ExtLink href={txUrl(state.network.explorer, a.txHash)} className="font-mono">tx</ExtLink>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
