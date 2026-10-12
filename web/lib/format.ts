import { formatEther } from 'viem';

export function fmtToken(wei: bigint | undefined, digits = 3): string {
  if (wei === undefined) return '—';
  const n = Number(formatEther(wei));
  if (n !== 0 && Math.abs(n) < 10 ** -digits) return `<${10 ** -digits}`;
  return n.toLocaleString('en-US', { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits });
}

export const pct = (bps: number | undefined) => (bps === undefined ? '—' : `${(bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`);

export function short(s: string | undefined, head = 6, tail = 4): string {
  if (!s) return '—';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function shortId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}

export function timeAgo(ts: number | undefined, now = Date.now() / 1000): string {
  if (!ts) return '';
  const d = Math.max(0, Math.round(now - ts));
  if (d < 5) return 'just now';
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export function fmtDate(ts: number | undefined): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const txUrl = (explorer: string, hash?: string) => (explorer && hash ? `${explorer}/tx/${hash}` : undefined);
export const addrUrl = (explorer: string, a?: string) => (explorer && a ? `${explorer}/account/${a}` : undefined);

export function ratio(a: bigint, b: bigint): number {
  if (b === 0n) return 0;
  return Number((a * 10000n) / b) / 10000;
}
