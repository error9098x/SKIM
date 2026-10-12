'use client';
import { useSkim } from '@/lib/useSkim';
import { Header, Logo } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { MachineCard } from '@/components/Machine';
import { LoanPanel, TermsCurve } from '@/components/Loan';
import { ActivityLog, RevenueFeed } from '@/components/Revenue';
import { HowItWorks } from '@/components/HowItWorks';
import { ModeBar, SectionHead, SimTag } from '@/components/ui';
import { isDemo } from '@/components/view';

export default function Page() {
  const { state, liveAvailable, liveError, restartDemo } = useSkim();
  const demo = isDemo(state);

  return (
    <>
      <Header state={state} />
      {/* The single mode indicator. Always rendered, fixed height, in both modes. */}
      <ModeBar state={state} liveAvailable={liveAvailable} liveError={liveError} />

      <main>
        <Hero state={state} onReplay={restartDemo} />

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHead
            id="loan"
            title="One machine, one advance, repaid by its own revenue"
            right={<span className="text-[12px] text-ink-2">{demo ? 'Replaying one loan cycle' : 'Polling every 5 s'}</span>}
          />
          <div id="machine" className="grid scroll-mt-24 gap-5 lg:grid-cols-[1fr_1.75fr]">
            <MachineCard state={state} />
            <LoanPanel state={state} />
          </div>
          <div className="mt-5">
            <TermsCurve state={state} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHead
            id="revenue"
            title="Every charging session pays the loan down"
            right={
              demo ? (
                <SimTag title="Demo replay: transactions and hashes are generated locally, not on chain">Simulated · hashes generated locally</SimTag>
              ) : (
                <span className="text-[12px] text-ink-2">Verified = peaq revenue event citing the router tx</span>
              )
            }
          />
          <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
            <RevenueFeed state={state} />
            <ActivityLog state={state} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHead id="how" title="Revenue in, credit out" />
          <HowItWorks state={state} />
        </section>
      </main>

      <footer className="mt-10 border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-[12px] text-ink-2 sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p>Built for the peaq Machine Economy hackathon. Testnet ratings are simulated; mainnet ratings come from the peaq MCR.</p>
        </div>
      </footer>
    </>
  );
}
