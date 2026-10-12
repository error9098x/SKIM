'use client';
import { useEffect, useRef, useState } from 'react';
import type { SkimState } from '@/lib/types';
import { gradeName } from '@/lib/config';
import { fmtToken } from '@/lib/format';
import { isRepaid, loanGrade, unitLabel } from './view';

/**
 * Exactly two hand-built toasts per cycle, as two separate beats:
 *   1. on the repay transition:  "Loan repaid · NFT returned to operator"
 *   2. on the rating upgrade:    "Rating upgraded: Provisioned → B · next line 2.00 AGNG"
 * One always-mounted aria-live region, position: fixed (never affects layout), one slot, so the two
 * can never share a frame. Each shows for 2 s; in the demo the beats are 2.2 s apart.
 * Transitions are detected only within the same data source, so switching demo → live (or a page
 * load on an already-repaid loan) never fires a toast.
 */
const SHOW_MS = 2000;

type Toast = { id: number; tone: 'repaid' | 'peaq'; text: string };

export function Toasts({ state }: { state: SkimState }) {
  const repaid = isRepaid(state);
  const grade = state.rating?.grade;
  const prev = useRef({ source: state.source, repaid, grade, origin: loanGrade(state) });
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const p = prev.current;
    let next: Toast | null = null;
    if (p.source === state.source) {
      if (!p.repaid && repaid) {
        next = { id: Date.now(), tone: 'repaid', text: 'Loan repaid · NFT returned to operator' };
      } else if (p.repaid && repaid && grade !== undefined && p.grade !== undefined && grade > p.grade) {
        const from = gradeName(p.origin ?? p.grade);
        const line = state.quote ? ` · next line ${fmtToken(state.quote.principal, 2)} ${unitLabel(state)}` : '';
        next = { id: Date.now(), tone: 'peaq', text: `Rating upgraded: ${from} → ${gradeName(grade)}${line}` };
      }
    }
    prev.current = { source: state.source, repaid, grade, origin: loanGrade(state) ?? p.origin };
    if (next) {
      setToast(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), SHOW_MS);
    } else if (!repaid && p.repaid) {
      // demo restart: clear any toast from the previous cycle
      setToast(null);
    }
  }, [repaid, grade, state]);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  return (
    <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      {toast && (
        <div key={toast.id} data-toast={toast.tone} className="animate-rise flex max-w-full items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-[14px] font-medium text-paper shadow-lg shadow-ink/20">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${toast.tone === 'repaid' ? 'bg-repaid' : 'bg-peaq'}`} />
          <span className="min-w-0 leading-snug sm:whitespace-nowrap">{toast.text}</span>
        </div>
      )}
    </div>
  );
}
