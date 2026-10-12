'use client';
import { useEffect, useState } from 'react';
import type { Activity, Session, SkimState } from '@/lib/types';
import { fmtToken, ratio, timeAgo } from '@/lib/format';
import { HashRef } from './ui';
import { activityDetail, activityLabel, isDemo, sessionSplits, unitLabel, type Split } from './view';

function useNow() {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Fixed box height: the feed never grows as rows arrive (zero layout shift).
const FEED_BOX = 'h-[480px]';

type Row =
  | { kind: 'session'; key: string; ts?: number; s: Session; split: Split }
  | { kind: 'keeper'; key: string; ts?: number; s: Session }
  | { kind: 'action'; key: string; ts?: number; a: Activity };

/** One chronological feed, newest first: sessions, the keeper's revenue-event post for each, and loan actions. */
function buildRows(state: SkimState): Row[] {
  const splits = sessionSplits(state);
  const rows: { r: Row; ts: number; order: number }[] = [];
  state.sessions.forEach((s, i) => {
    const ts = s.timestamp ?? 0;
    const split = splits.get(s.key) ?? { key: s.key, vault: s.skimmed, machine: s.forwarded, excess: 0n, inLoan: false };
    rows.push({ r: { kind: 'session', key: s.key, ts: s.timestamp, s, split }, ts, order: 1000 - i });
    if (s.verified) rows.push({ r: { kind: 'keeper', key: `${s.key}:ev`, ts: s.timestamp, s }, ts, order: 1000 - i + 0.5 });
  });
  state.activity.forEach((a, i) => {
    rows.push({ r: { kind: 'action', key: `a:${a.key}`, ts: a.timestamp, a }, ts: a.timestamp ?? 0, order: 2000 - i });
  });
  rows.sort((x, y) => y.ts - x.ts || y.order - x.order);
  return rows.map((x) => x.r);
}

/** Split bar: vault share (skim, orange) vs machine share. Widths are the shares of this payment. */
function SplitBar({ amount, split }: { amount: bigint; split: Split }) {
  const v = amount ? ratio(split.vault, amount) * 100 : 0;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-paper-2" aria-hidden>
      <span className="h-full bg-skim" style={{ width: `${v}%` }} />
      <span className="h-full bg-ink-3/45" style={{ width: `${100 - v}%`, boxShadow: v > 0 ? 'inset 2px 0 0 rgb(var(--paper))' : undefined }} />
    </div>
  );
}

/** S3 wording rule: never "EventRegistry 2.0" bare outside mainnet. */
function registryNote(state: SkimState): string {
  if (state.network.isMainnet) return 'peaq EventRegistry 2.0';
  if (isDemo(state)) return 'mock registry in the demo · EventRegistry 2.0 on mainnet';
  return 'mock registry on testnet · EventRegistry 2.0 on mainnet';
}

/** JUDGE-N1: the AGNG amount is the headline; USD only as a hover note, never a fake price. */
function usdNote(state: SkimState, cents?: number): string | undefined {
  if (cents === undefined) return undefined;
  if (cents >= 1) return `Event value ≈ $${(cents / 100).toFixed(2)}`;
  return state.network.isMainnet ? 'Event value < $0.01' : 'Event value < $0.01 (testnet amounts; the mainnet MCR counts events ≥ $10)';
}

const ICON: Record<string, string> = { rating: '★', loan: '↗', repaid: '↺', closed: '✓', deposit: '＋', default: '!', nft: '◆' };

function SessionRow({ state, row, n, now, unit, fresh }: { state: SkimState; row: Extract<Row, { kind: 'session' }>; n: number; now: number; unit: string; fresh: boolean }) {
  const { s, split } = row;
  const capped = split.excess > 0n;
  return (
    <li className={`flex h-[72px] items-center gap-4 px-4 sm:px-5 md:h-[60px] ${fresh ? 'animate-rise' : ''}`}>
      <span suppressHydrationWarning className="hidden w-16 shrink-0 text-[12px] text-ink-3 md:block">
        {timeAgo(s.timestamp, now)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 text-[13px] leading-5">
          <span className="min-w-0 truncate text-ink">
            Session {n} <span className="font-mono text-[12px] text-ink-3">{s.sessionId.slice(0, 8)}…</span>
            <span suppressHydrationWarning className="text-[12px] text-ink-3 md:hidden"> · {timeAgo(s.timestamp, now)}</span>
          </span>
          <span className="num shrink-0 text-ink">
            {fmtToken(s.amount, 3)} <span className="text-[12px] text-ink-3">{unit}</span>
          </span>
        </div>
        <div className="mt-1.5">
          <SplitBar amount={s.amount} split={split} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-[12px] leading-4">
          <span className="num truncate text-skim-text">
            +{fmtToken(split.vault, 3)} to vault{capped ? ' · capped' : ''}
          </span>
          <span className="num shrink-0 text-ink-2">
            {fmtToken(split.machine, 3)} to machine{capped && <span className="hidden sm:inline"> (incl. {fmtToken(split.excess, 3)} excess)</span>}
          </span>
        </div>
      </div>
      <span className="hidden w-[150px] shrink-0 justify-end md:flex">
        <HashRef state={state} hash={s.txHash} />
      </span>
    </li>
  );
}

/** Plain on-chain action row (keeper post or loan event). No agent styling: what happened, where, which tx. */
function ActionRow({ state, glyph, text, short, detail, tone, hash, ts, now, indent, title }: { state: SkimState; glyph: string; text: string; short?: string; detail?: string; tone: string; hash?: string; ts?: number; now: number; indent?: boolean; title?: string }) {
  return (
    <li title={title ?? (detail ? `${text} · ${detail}` : text)} className="flex h-10 items-center gap-4 bg-paper-2/60 px-4 sm:px-5">
      <span suppressHydrationWarning className="hidden w-16 shrink-0 text-[12px] text-ink-3 md:block">
        {timeAgo(ts, now)}
      </span>
      <div className={`flex min-w-0 flex-1 items-center gap-2 text-[12px] leading-4 ${indent ? 'md:pl-4' : ''}`}>
        <span aria-hidden className={`w-4 shrink-0 text-center ${tone}`}>
          {glyph}
        </span>
        {/* QA-7, 390px: two 16px lines inside the same 40px row (no height change), so the detail
            (where the honesty note lives: 'mock registry …', 'NFT escrowed') is never the part cut off. */}
        <span className="flex min-w-0 flex-1 flex-col sm:hidden">
          <span className={`truncate ${tone}`}>{short ?? text}</span>
          {detail && <span className="truncate text-ink-3">{detail}</span>}
        </span>
        <span className={`hidden min-w-0 truncate sm:inline ${tone}`}>
          {text}
          {detail && <span className="text-ink-3"> · {detail}</span>}
        </span>
      </div>
      <span className="hidden w-[150px] shrink-0 justify-end md:flex">
        <HashRef state={state} hash={hash} />
      </span>
    </li>
  );
}

export function RevenueFeed({ state }: { state: SkimState }) {
  const now = useNow();
  const unit = unitLabel(state);
  const demo = isDemo(state);
  const splits = sessionSplits(state);
  const total = state.sessions.reduce((a, s) => a + s.amount, 0n);
  let toVault = 0n;
  let toMachine = 0n;
  let excess = 0n;
  for (const sp of splits.values()) {
    toVault += sp.vault;
    toMachine += sp.machine;
    excess += sp.excess;
  }
  const verified = state.sessions.filter((s) => s.verified).length;
  const rows = buildRows(state);
  const sessionNo = new Map(state.sessions.map((s, i) => [s.key, state.sessions.length - i]));
  const newest = state.sessions[0]?.key;

  const pending = state.sessions.length - verified;
  // "3 posted · 1 pending" while the keeper has not yet posted the newest event (never reads as a mismatch).
  // "verified" only where the event lands in peaq's real EventRegistry 2.0 (mainnet); agung/local/demo write to a mock.
  const realRegistry = state.network.isMainnet && !demo;
  const sessionsSub = pending > 0 ? `${verified} ${realRegistry ? 'verified' : 'posted'} · ${pending} pending` : realRegistry ? `${verified} verified` : `${verified} events posted`;
  // KPIs are cumulative over every loan this machine has had; say so once there is more than one.
  const nLoans = state.activity.filter((a) => a.kind === 'loan').length;
  const scope = nLoans > 1 ? ` · ${nLoans} loans` : '';
  const kpis: [string, string, string, string][] = [
    ['Sessions', String(state.sessions.length), nLoans > 1 ? `${verified} posted${pending > 0 ? ` · ${pending} pending` : ''}${scope}` : sessionsSub, 'text-ink'],
    ['Revenue routed', fmtToken(total, 3), `${unit}${scope}`, 'text-ink'],
    ['Repaid to vault', fmtToken(toVault, 3), scope ? `${unit}${scope}` : excess > 0n ? `${unit} · skim capped at owed` : `${unit} · skim share`, 'text-skim-text'],
    ['Forwarded to machine', fmtToken(toMachine, 3), `${unit}${scope}`, 'text-ink'],
  ];

  return (
    <div className="card min-w-0 overflow-hidden">
      <div className="grid grid-cols-2 gap-px border-b border-rule bg-rule sm:grid-cols-4">
        {kpis.map(([l, v, s, tone]) => (
          <div key={l} className="min-w-0 bg-paper px-4 py-3 sm:px-5 sm:py-4">
            <div className="label truncate">{l}</div>
            <div className={`num mt-1 truncate text-xl ${tone}`}>{v}</div>
            <div className="truncate text-[12px] text-ink-3">{s}</div>
          </div>
        ))}
      </div>

      <div className="flex h-9 items-center gap-4 border-b border-rule px-4 text-[12px] text-ink-2 sm:px-5">
        <span className="hidden w-16 shrink-0 md:block">When</span>
        <span className="flex min-w-0 flex-1 items-center gap-3 truncate">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-sm bg-skim" />
            vault share
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-sm bg-ink-3/45" />
            machine share
          </span>
          <span className="hidden truncate text-ink-3 sm:inline">· on-chain actions inline</span>
        </span>
        <span className="hidden w-[150px] shrink-0 text-right md:block">{demo ? 'Tx (demo)' : 'Tx'}</span>
      </div>

      <div className={`${FEED_BOX} overflow-y-auto overscroll-contain`}>
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-2">
            <p>
              Waiting for the first charging session to route through <span className="font-mono text-ink">RevenueRouter.pay()</span>…
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {rows.map((r) => {
              if (r.kind === 'session')
                return <SessionRow key={r.key} state={state} row={r} n={sessionNo.get(r.s.key) ?? 0} now={now} unit={unit} fresh={r.s.key === newest} />;
              if (r.kind === 'keeper')
                return (
                  <ActionRow
                    key={r.key}
                    state={state}
                    glyph={realRegistry ? '✓' : '↳'}
                    text={`Keeper posted peaq-format revenue event · ${fmtToken(r.s.amount, 3)} ${unit} · trust ${r.s.verified?.trustLevel ?? 1} · cites router tx`}
                    short={`Keeper event · ${fmtToken(r.s.amount, 3)} ${unit} · trust ${r.s.verified?.trustLevel ?? 1} · cites router tx`}
                    detail={registryNote(state)}
                    title={usdNote(state, r.s.verified?.valueCents)}
                    tone={realRegistry ? 'text-repaid-text' : 'text-ink-2'}
                    hash={r.s.verified?.txHash}
                    ts={r.ts}
                    now={now}
                    indent
                  />
                );
              const a = r.a;
              const tone = a.kind === 'closed' ? 'text-repaid-text' : a.kind === 'default' ? 'text-danger' : a.kind === 'rating' ? 'text-peaq-text' : 'text-ink';
              return <ActionRow key={r.key} state={state} glyph={ICON[a.kind] ?? '•'} text={activityLabel(state, a)} detail={activityDetail(state, a)} tone={tone} hash={a.txHash} ts={a.timestamp} now={now} />;
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
