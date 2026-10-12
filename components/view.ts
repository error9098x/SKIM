// Component-level view helpers. lib/ and useSkim() are frozen, so every
// correctness/honesty fix that reinterprets SkimState for display lives here.
import type { Activity, SkimState, Terms } from '@/lib/types';
import { gradeName } from '@/lib/config';
import { fmtToken, pct } from '@/lib/format';

/** True when the page is rendering the bundled demo replay, not chain data. */
export const isDemo = (s: SkimState) => s.source === 'mock';

/**
 * Display unit. Never "ETH": live.ts prefers deployments/local.json `nativeSymbol: "ETH"`,
 * so we decide from the chain instead of trusting network.token.
 */
export function unitLabel(s: SkimState): string {
  const n = s.network;
  if (n.chainId === 3338 || n.isMainnet) return 'PEAQ';
  if (n.key === 'local' || n.chainId === 31337) return 'PEAQ (local)';
  return 'AGNG'; // agung testnet and the demo replay (which models agung)
}

/** Replace any raw native symbol a lib-generated label carries with the display unit. */
export function withUnit(s: SkimState, text: string): string {
  const unit = unitLabel(s);
  let out = text.replace(/\bETH\b/g, unit);
  const tok = s.network.token;
  if (tok && tok !== unit && tok !== 'PEAQ' && tok !== 'AGNG') out = out.split(tok).join(unit);
  return out;
}

/** Activity row label as shown: unit-safe and with operator wording. */
export function activityLabel(s: SkimState, a: Activity): string {
  if (a.kind === 'closed') return 'Loan closed · NFT returned to operator';
  return withUnit(s, a.label);
}
export const activityDetail = (s: SkimState, a: Activity) => (a.detail ? withUnit(s, a.detail) : undefined);

/** Terms row the open/closed loan was originated on (grade at origination, from state.terms). */
export function loanTerms(s: SkimState): Terms | undefined {
  const l = s.loan;
  if (!l || l.status === 0) return undefined;
  return (
    s.terms.find((t) => t.principal === l.principal && t.skimBps === l.skimBps) ??
    s.terms.find((t) => t.principal === l.principal)
  );
}
export const loanGrade = (s: SkimState): number | undefined => loanTerms(s)?.grade;

export const hasLoan = (s: SkimState) => !!s.loan && s.loan.status !== 0;
export const isRepaid = (s: SkimState) => !!s.closed || s.loan?.status === 2;

/** Flat fee in bps derived from the loan itself (never from quote). */
export function loanFeeBps(s: SkimState): number | undefined {
  const l = s.loan;
  if (!l || l.principal === 0n) return undefined;
  return Number(((l.owed - l.principal) * 10000n) / l.principal);
}

/** "B · 2.00 · 9% · 28%" — the next line, shown only as its own labelled line after repayment+upgrade. */
export function nextLine(s: SkimState): string | undefined {
  const q = s.quote;
  const g = loanGrade(s);
  if (!q || !isRepaid(s) || g === undefined || q.grade <= g) return undefined;
  return `${gradeName(q.grade)} · ${fmtToken(q.principal, 2)} · ${pct(q.feeBps)} · ${pct(q.skimBps)}`;
}

/** Placeholder links (LINKS fallbacks like "#github") are never rendered. */
export const isPlaceholderLink = (href?: string) => !href || href.startsWith('#');

/** External explorer links only for real chain data; demo addresses/hashes are fake. */
export const realHref = (s: SkimState, href?: string) => (isDemo(s) ? undefined : href || undefined);

/** Is the NFT currently held by the vault? */
export function nftInVault(s: SkimState): boolean {
  const v = s.contracts.vault?.toLowerCase();
  return !!s.nftOwner && !!v && s.nftOwner.toLowerCase() === v;
}

/**
 * Per-session split as the contract settles it. RevenueRouter caps the skim at the amount still
 * outstanding and forwards the excess to the machine wallet ("never over-skim the final payment").
 * The bundled demo replay reports the uncapped final skim, so we re-apply the cap here (a no-op on
 * live data, which already carries the capped value). Sessions before the current loan opened keep
 * their raw split.
 */
export interface Split {
  key: string;
  vault: bigint; // applied to the loan
  machine: bigint; // forwarded + any capped excess
  excess: bigint; // skim beyond what was owed, routed to the machine instead
  inLoan: boolean; // counts toward the current loan
}
export function sessionSplits(s: SkimState): Map<string, Split> {
  const out = new Map<string, Split>();
  const loan = hasLoan(s) ? s.loan : null;
  let left = loan ? loan.owed : 0n;
  // sessions arrive newest-first; settle oldest-first
  for (let i = s.sessions.length - 1; i >= 0; i--) {
    const x = s.sessions[i];
    const inLoan = !!loan && (!x.timestamp || !loan.openedAt || x.timestamp >= loan.openedAt) && x.skimmed > 0n;
    if (!inLoan) {
      out.set(x.key, { key: x.key, vault: x.skimmed, machine: x.forwarded, excess: 0n, inLoan: false });
      continue;
    }
    const vault = x.skimmed > left ? left : x.skimmed;
    left -= vault;
    const excess = x.skimmed - vault;
    out.set(x.key, { key: x.key, vault, machine: x.forwarded + excess, excess, inLoan: true });
  }
  return out;
}

/** Oldest-first segments of the current loan's payoff bar: one per session that repaid something. */
export function payoffSegments(s: SkimState): Split[] {
  const m = sessionSplits(s);
  const segs: Split[] = [];
  for (let i = s.sessions.length - 1; i >= 0; i--) {
    const sp = m.get(s.sessions[i].key);
    if (sp && sp.inLoan && sp.vault > 0n) segs.push(sp);
  }
  return segs;
}
