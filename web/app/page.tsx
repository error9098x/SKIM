'use client';
import { useSkim } from '@/lib/useSkim';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { MachineCard } from '@/components/Machine';
import { LoanPanel, TermsCurve } from '@/components/Loan';
import { RevenueFeed } from '@/components/Revenue';
import { Toasts } from '@/components/Toasts';
import { CtaBand, Footer } from '@/components/Footer';
import { BentoGrid } from '@/components/Bento';
import { HowItWorks } from '@/components/HowItWorks';
import { ModeBar, SectionHead, SimTag } from '@/components/ui';
import { isDemo } from '@/components/view';

export default function Page() {
  const { state, demoState, liveAvailable, liveError, restartDemo, connecting } = useSkim();
  const demo = isDemo(state);

  return (
    <>
      <Header state={state} />
      {/* The single mode indicator. Always rendered, fixed height, in both modes. */}
      <ModeBar state={state} liveAvailable={liveAvailable} liveError={liveError} connecting={connecting} />

      <main>
        <Hero state={state} demoState={demoState} onReplay={restartDemo} />

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <SectionHead id="why" title="Credit built for machines" />
          <BentoGrid />
        </section>

        {/* Order: hero instrument → revenue feed → terms staircase → credit line report → how it works */}
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <SectionHead
            id="revenue"
            title="Every charging session pays the loan down"
            right={
              demo ? (
                <SimTag title="Demo replay: transactions and hashes are generated locally, not on chain">Simulated · hashes generated locally</SimTag>
              ) : (
                <span className="truncate text-[12px] text-ink-2">
                  {state.network.isMainnet ? (
                    'Verified = peaq revenue event citing the router tx'
                  ) : (
                    <>
                      <span className="sm:hidden">Posted = trust-1 event · mock registry (testnet)</span>
                      <span className="hidden sm:inline">Posted = revenue event (trust 1) citing the router tx · mock registry on testnet</span>
                    </>
                  )}
                </span>
              )
            }
          />
          <RevenueFeed state={state} />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <SectionHead id="terms" title="Repay, get rated up, borrow more" />
          <TermsCurve state={state} />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <SectionHead
            id="loan"
            title="Credit line report"
            right={<span className="text-[12px] text-ink-2">{demo ? 'Replaying one loan cycle' : 'Polling every 5 s'}</span>}
          />
          <div id="machine" className="grid scroll-mt-24 gap-5 lg:grid-cols-[1fr_1.75fr]">
            <MachineCard state={state} />
            <LoanPanel state={state} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHead id="how" title="Revenue in, credit out" />
          <HowItWorks state={state} />
        </section>
      </main>

      <CtaBand />
      <Footer />
      <Toasts state={state} />
    </>
  );
}
