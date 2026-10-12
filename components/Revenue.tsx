'use client';
import { useEffect, useState } from 'react';
import type { Session, SkimState } from '@/lib/types';
import { fmtToken, timeAgo } from '@/lib/format';
import { Chip, HashRef } from './ui';
import { activityDetail, activityLabel, isDemo, unitLabel } from './view';

function useNow() {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Verification cell: green tick only for a real EventRegistry entry; demo gets a neutral "demo hash" chip. */
function Verified({ state, s, compact = false }: { state: SkimState; s: Session; compact?: boolean }) {
  if (!s.verified) return <Chip>{compact ? 'pending' : 'pending keeper'}</Chip>;
  if (isDemo(state)) return <HashRef state={state} hash={s.verified.txHash ?? s.txHash} />;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Chip tone="repaid" title="EventRegistry entry cites this router tx as sourceTxHash">
        ✓ verified{compact ? '' : ` · trust ${s.verified.trustLevel ?? 1}`}
      </Chip>
      {/* USD only for real events; hidden in demo (we never reach here in demo) */}
      {!compact && s.verified.valueCents !== undefined && <span className="num text-[12px] text-ink-3">${(s.verified.valueCents / 100).toFixed(2)}</span>}
    </span>
  );
}

// Fixed box heights: the feed and the ledger never grow as rows arrive (zero layout shift).
const FEED_BOX = 'h-[440px]';
const LEDGER_CARD = 'h-[540px]';

export function RevenueFeed({ state }: { state: SkimState }) {
  const now = useNow();
  const unit = unitLabel(state);
  const demo = isDemo(state);
  const total = state.sessions.reduce((a, s) => a + s.amount, 0n);
  const skim = state.sessions.reduce((a, s) => a + s.skimmed, 0n);
  const fwd = state.sessions.reduce((a, s) => a + s.forwarded, 0n);
  const verified = state.sessions.filter((s) => s.verified).length;

  return (
    <div className="card min-w-0 overflow-hidden">
      <div className="grid grid-cols-2 gap-px border-b border-rule bg-rule sm:grid-cols-4">
        {[
          ['Sessions', String(state.sessions.length), demo ? `${verified} events posted` : `${verified} verified`, ''],
          ['Revenue routed', fmtToken(total, 3), unit, ''],
          ['Skimmed to vault', fmtToken(skim, 3), unit, 'text-skim-text'],
          ['Forwarded to machine', fmtToken(fwd, 3), unit, ''],
        ].map(([l, v, s, tone]) => (
          <div key={l} className="min-w-0 bg-paper px-5 py-4">
            <div className="label truncate">{l}</div>
            <div className={`num mt-1 truncate text-xl ${tone || 'text-ink'}`}>
              {v} <span className="text-[12px] text-ink-3">{s}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={`${FEED_BOX} overflow-y-auto overscroll-contain`}>
        {state.sessions.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-2">
            <p>
              Waiting for the first charging session to route through <span className="font-mono text-ink">RevenueRouter.pay()</span>…
            </p>
          </div>
        ) : (
          <>
            {/* desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="sticky top-0 bg-paper">
                <tr className="border-b border-rule text-left text-[12px] text-ink-2">
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
                  <tr key={s.key} className={`h-[57px] border-b border-rule ${i === 0 ? 'animate-rise' : ''}`}>
                    <td className="px-6 py-2">
                      <div className="font-mono text-[12px] text-ink">{s.sessionId.slice(0, 10)}…</div>
                      <div className="text-[12px] text-ink-3">{timeAgo(s.timestamp, now)}</div>
                    </td>
                    <td className="num px-3 py-2 text-right text-ink">{fmtToken(s.amount, 3)}</td>
                    <td className="num px-3 py-2 text-right text-skim-text">+{fmtToken(s.skimmed, 3)}</td>
                    <td className="num px-3 py-2 text-right text-ink-2">{fmtToken(s.forwarded, 3)}</td>
                    <td className="px-3 py-2">
                      <Verified state={state} s={s} />
                    </td>
                    <td className="px-6 py-2 text-right">
                      <HashRef state={state} hash={s.txHash} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* mobile list */}
            <ul className="divide-y divide-rule md:hidden">
              {state.sessions.map((s, i) => (
                <li key={s.key} className={`px-4 py-3 ${i === 0 ? 'animate-rise' : ''}`}>
                  <div className="flex h-7 items-center justify-between gap-2">
                    <span className="num whitespace-nowrap text-base text-ink">
                      {fmtToken(s.amount, 3)} <span className="text-[12px] text-ink-3">{unit}</span>
                    </span>
                    <Verified state={state} s={s} compact />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[12px]">
                    <span className="num text-skim-text">+{fmtToken(s.skimmed, 3)} skim</span>
                    <span className="num text-ink-2">{fmtToken(s.forwarded, 3)} → machine</span>
                  </div>
                  <div className="mt-1 flex h-6 items-center justify-between gap-2 text-[12px] text-ink-3">
                    <span>{timeAgo(s.timestamp, now)}</span>
                    {!demo && <HashRef state={state} hash={s.txHash} />}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

const ICON: Record<string, string> = { rating: '★', loan: '↗', repaid: '↺', closed: '✓', deposit: '＋', default: '!', nft: '◆' };

export function ActivityLog({ state }: { state: SkimState }) {
  const now = useNow();
  const live = !isDemo(state);
  return (
    <div className={`card flex ${LEDGER_CARD} min-w-0 flex-col p-5 sm:p-6`}>
      <div className="flex h-5 items-center justify-between">
        <div className="label">Loan ledger</div>
        {state.blockNumber !== undefined && <span className="num text-[12px] text-ink-3">block {state.blockNumber.toString()}</span>}
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {state.activity.length === 0 ? (
          <p className="text-sm text-ink-2">No loan events yet.</p>
        ) : (
          <ol className="relative ml-2.5 space-y-4 border-l border-rule pl-5">
            {state.activity.slice(0, 8).map((a) => (
              <li key={a.key} className="relative animate-rise">
                <span
                  className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border bg-paper text-[12px] ${
                    a.kind === 'closed' ? 'border-repaid text-repaid-text' : a.kind === 'default' ? 'border-danger text-danger' : a.kind === 'rating' ? 'border-peaq/60 text-peaq-text' : 'border-rule text-ink-2'
                  }`}
                >
                  {ICON[a.kind] ?? '•'}
                </span>
                <div className={`text-sm ${a.kind === 'closed' ? 'text-repaid-text' : 'text-ink'}`}>{activityLabel(state, a)}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                  {activityDetail(state, a) && <span>{activityDetail(state, a)}</span>}
                  <span suppressHydrationWarning>{timeAgo(a.timestamp, now)}</span>
                  {live && a.txHash && <HashRef state={state} hash={a.txHash} />}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
