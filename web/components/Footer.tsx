import { Logo } from './Header';
import { DottedGlow } from './DottedGlow';

const COLUMNS: { title: string; links: [string, string, boolean?][] }[] = [
  {
    title: 'Product',
    links: [
      ['Why SKIM', '#why'],
      ['Revenue feed', '#revenue'],
      ['Loan terms', '#terms'],
      ['Credit line', '#loan'],
      ['How it works', '#how'],
    ],
  },
  {
    title: 'Protocol',
    links: [
      ['Proof of run', '#proof'],
      ['Spec', 'https://github.com/error9098x/SKIM/blob/main/SPEC.md', true],
      ['Contracts', 'https://github.com/error9098x/SKIM/tree/main/contracts', true],
      ['Keeper agent', 'https://github.com/error9098x/SKIM/tree/main/agent', true],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['GitHub', 'https://github.com/error9098x/SKIM', true],
      ['README', 'https://github.com/error9098x/SKIM#readme', true],
      ['Docs', 'https://github.com/error9098x/SKIM/tree/main/docs', true],
      ['peaq network', 'https://www.peaq.network', true],
    ],
  },
];

/** "Ready to…" call-to-action band on a dotted glow, sits above the footer. */
export function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <div className="relative overflow-hidden rounded-[28px] border border-rule bg-paper-2 p-2">
        <div className="relative overflow-hidden rounded-[22px] border border-rule bg-paper px-6 py-14 sm:px-12 sm:py-20">
          <div aria-hidden className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]">
            <DottedGlow gap={14} opacity={0.7} />
          </div>
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-5xl">
                <span className="text-ink-2">Ready to put a machine</span> on credit?
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-2">Watch a loan repay itself from real revenue, or read the contracts that make it work.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <a href="#loan" className="press inline-flex h-11 items-center rounded-xl bg-ink px-5 text-sm font-semibold text-paper hover:opacity-90">
                See the loan live
              </a>
              <a
                href="https://github.com/error9098x/SKIM"
                target="_blank"
                rel="noreferrer"
                className="press inline-flex h-11 items-center rounded-xl border border-rule bg-paper-2 px-5 text-sm font-semibold text-ink hover:border-ink-3"
              >
                View on GitHub ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto mt-6 max-w-6xl px-4 pb-4 sm:px-6">
      <div className="relative overflow-hidden rounded-[28px] border border-rule bg-paper-2 p-2">
        <div className="relative overflow-hidden rounded-[22px] border border-rule bg-paper px-6 pt-12 sm:px-12">
          <div className="relative grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
            <div className="max-w-xs">
              <Logo />
              <p className="mt-4 text-[14px] leading-relaxed text-ink-2">Revenue-based credit for machines on peaq. Machines earn. Now they can borrow.</p>
              <p className="mt-6 text-[12px] text-ink-3">© {new Date().getFullYear()} SKIM. Built for the peaq “Advance the Machine Economy” track.</p>
            </div>
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <div className="text-[13px] font-semibold text-ink">{col.title}</div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map(([label, href, ext]) => (
                    <li key={label}>
                      <a
                        href={href}
                        {...(ext ? { target: '_blank', rel: 'noreferrer' } : {})}
                        className="group inline-flex items-center text-[14px] text-ink-2 transition-colors duration-200 hover:text-ink"
                      >
                        <span className="transition-transform duration-200 group-hover:translate-x-0.5">{label}</span>
                        {ext && <span aria-hidden className="ml-1 text-[0.8em] opacity-0 transition-opacity duration-200 group-hover:opacity-70">↗</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <p className="relative mt-10 text-[12px] text-ink-3">Testnet ratings are simulated; mainnet ratings come from the peaq MCR.</p>
          {/* Giant wordmark, clipped by the frame and faded toward its base. */}
          <div
            aria-hidden
            className="pointer-events-none relative -mb-[0.16em] mt-2 select-none overflow-hidden text-center font-semibold leading-[0.85] tracking-[-0.06em] text-[clamp(6rem,27vw,23rem)] [mask-image:linear-gradient(to_bottom,#000_20%,transparent_95%)]"
          >
            <span className="bg-gradient-to-b from-ink/20 to-ink/[0.03] bg-clip-text text-transparent">SKIM</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
