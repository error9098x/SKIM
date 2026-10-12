'use client';
import { useSkim } from '@/lib/useSkim';
import { Header, Logo } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { MachineCard } from '@/components/Machine';
import { LoanPanel, PayoffBanner, TermsCurve } from '@/components/Loan';
import { ActivityLog, RevenueFeed } from '@/components/Revenue';
import { HowItWorks } from '@/components/HowItWorks';
import { SectionHead, SimBadge, LiveBadge } from '@/components/ui';

export default function Page() {
  const { state, liveAvailable, liveError, restartDemo } = useSkim();
  const mock = state.source === 'mock';

  return (
    <>
      <Header state={state} liveError={liveError} />
      {mock && (
        <div className="border-b border-amber-400/15 bg-amber-400/[0.05]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-amber-400 sm:px-6">
            <span className="flex items-center gap-2">
              <SimBadge />
              <span className="text-fog-300">
                {liveAvailable ? `Connecting to chain${liveError ? ` (retrying: ${liveError.slice(0, 80)})` : '…'} Showing the demo replay meanwhile.` : 'Demo replay of one full loan cycle. Connect a deployment to show live chain data.'}
              </span>
            </span>
            <span className="flex items-center gap-3">
              {state.demoPhase && <span className="hidden font-mono text-fog-400 sm:inline">{state.demoPhase}</span>}
              <button onClick={restartDemo} className="rounded-md border border-amber-400/30 px-2 py-0.5 text-amber-400 hover:bg-amber-400/10">
                Replay
              </button>
            </span>
          </div>
        </div>
      )}
      {!mock && liveError && (
        <div className="border-b border-red-400/20 bg-red-400/[0.06] px-4 py-2 text-center text-xs text-red-300">RPC hiccup, retrying every 5s: {liveError.slice(0, 120)}</div>
      )}

      <main>
        <Hero state={state} />

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHead
            id="loan"
            eyebrow="01 · Live credit line"
            title="One machine, one advance, repaid by its own revenue"
            right={mock ? <SimBadge /> : <LiveBadge label="polling 5s" />}
          />
          <PayoffBanner state={state} />
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
            eyebrow="02 · Revenue feed"
            title="Every charging session pays the loan down"
            right={<span className="text-xs text-fog-400">RevenueRouted events · verified = peaq revenue event citing the router tx</span>}
          />
          <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
            <RevenueFeed state={state} />
            <ActivityLog state={state} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHead id="how" eyebrow="03 · How it works" title="Revenue in, credit out" />
          <HowItWorks state={state} />
        </section>
      </main>

      <footer className="mt-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-xs text-fog-500 sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p>Built for the peaq Machine Economy hackathon. Testnet ratings are simulated; mainnet ratings come from the peaq MCR.</p>
        </div>
      </footer>
    </>
  );
}
