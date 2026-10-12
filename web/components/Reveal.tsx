'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Fades/slides children in once they scroll into view. Arms after mount so SSR content is never hidden. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9) return; // already in view: no flash
    el.classList.add('reveal-armed');
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add('reveal-in');
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ ['--d' as string]: `${delay}ms` }} className={className}>
      {children}
    </div>
  );
}
