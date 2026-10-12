# SKIM demo video: script + shot list (v5)

**Status:** v5 · story · 2026-10-12 23:45 IST · **conversational rewrite requested by Alan** after he watched the v4 render ("robotic and constrained"). Alan's request overrides lead's v4 VO lock. v4 is kept at `VIDEO_SCRIPT.md.bak-v4-2345`. Local only; nothing published.
**Exact VO text for TTS:** `swarm/proposals/story-vo-v5.json` (same text as below, 9 blocks `v01`–`v09`). **All 9 blocks are new**, so every v4 take is obsolete.
**Runtime:** 332 spoken words ≈ 2:18 at 144 wpm, plus about 6 s of breathing room between scenes, so **about 2:20–2:25** (brief: 1:45–2:30). If it runs long, the cut order is at the bottom. Never speed up the audio.
**Numbers source of truth:** `skim/docs/proof/agung.md`, `agent/logs/mainnet-fork-proof.txt`, `docs/proof/forge-test.txt`, `docs/submission/IMPACT.md`.

## What changed from v4, and why
- **Voice:** a founder explaining it to a smart friend, not a narrator reading a spec. Contractions, short and long sentences mixed, one aside per scene ("here's my favourite part", "that was the cartoon"), no lists read aloud.
- **Hook in the first 5 s:** "This charger makes money every single day… and it still can't get a loan."
- **Fewer numbers:** only four are spoken: *thirty percent*, *fifty-four*, *forty-two*, *tens of thousands of dollars*. The rest goes on screen as kinetic type.
- **Visual language:** animated explainer scenes carry the mechanism (0:15–1:18). Screen recordings appear only as **proof beats**: the live agung page, Subscan, the fork terminal, the tests.
- **Honesty kept, said like a person would say it:** "that was the cartoon, here's the real thing", "one honest caveat… on testnet we simulate those two", "a fork of peaq mainnet".

---

## Voiceover (word for word) + shot list

Tags in `[brackets]` are Eleven v4 direction and are not spoken. They're used sparingly (about one or two per block), and `...` marks a natural beat. No `[clear]` anywhere.

### v01 · Hook (0:00 – 0:15)
> "[amused] This charger makes money every single day... [pause] and it still can't get a loan. Banks don't lend to machines, and DeFi wants collateral a machine doesn't have. [confident] So we built SKIM, on peaq."

| Time | Type | Picture |
|---|---|---|
| 0:00 | **Animation** | A flat-style EV charger on a street corner. Cars come and go; each one drops a coin that stacks beside the charger, counter ticking up ("every single day" = a day/night sky cycling fast behind it). |
| 0:04 | **Animation** | On "can't get a loan": a loan form slides in front of the charger and gets a big red **DENIED** stamp. A small comic beat: the charger's screen shows a sad face for 6 frames. |
| 0:07 | **Animation** | Split: a bank building with a "PEOPLE ONLY" sign; a DeFi vault with a "COLLATERAL?" speech bubble. The charger shrugs (it tilts). |
| 0:11 | **Screen (proof)** | Hard cut to the **LIVE agung page** in a clean browser frame: green "Live · peaq agung testnet" bar, headline "Machines earn. Now they can borrow." Slow 105% push-in. Lower third: `SKIM · revenue-based credit for machines on peaq` → `LIVE · peaq agung testnet · rating + revenue registry simulated`. |

### v02 · The idea (0:15 – 0:28)
> "[warm] The idea's simple. The machine borrows against money it's about to earn. [pause] It puts up its peaq Machine NFT, which is basically its ID, as collateral, and gets an advance."

| Time | Type | Picture |
|---|---|---|
| 0:15 | **Animation** | Back to the charger. Ghosted "future coins" float in a dotted timeline to its right ("money it's about to earn"). |
| 0:20 | **Animation** | An ID-card-style **peaq Machine NFT** (peaq logo, `did:peaq:…`, "EVCharger") pops out of the charger and **slides into a vault** labelled `SkimVault`. The vault door closes with a soft click (SFX). |
| 0:25 | **Animation** | A coin stack drops from the vault into the charger's wallet. Kinetic type: `advance ✓`. |
Corner tag on every animation frame from here to 1:18: `How SKIM works · illustration`.

### v03 · Coins flow (0:28 – 0:44)
> "[relaxed] Then it goes back to work. Every time someone plugs in, the payment runs through our router. Thirty percent pays down the loan; the rest goes to the machine. And each payment's logged in peaq's revenue-event format."

| Time | Type | Picture |
|---|---|---|
| 0:28 | **Animation** | A car plugs in. A coin leaves the car, travels along a line to a box labelled `RevenueRouter`. |
| 0:33 | **Animation** | The coin **splits**: a 30% slice flies to the vault, a 70% slice to the charger's wallet. Kinetic type at the split: **`30% → vault`** / **`70% → machine`**. Repeat three times, faster each time (sessions speeding up). |
| 0:40 | **Animation** | With each payment a small receipt chip pops up and drifts to a stack labelled `revenue event · trust 1 · peaq format`. |
Number note: 30% is the Provisioned skim, the same in the demo and on agung loan #1. Don't reuse this 30/70 graphic over loan #2 footage (loan #2 was 28%).

### v04 · Payoff (0:44 – 0:55)
> "No invoices, nobody chasing anyone. [pause] The last payment only takes what's left, and the moment the loan's paid off, [warm] the NFT slides right back."

| Time | Type | Picture |
|---|---|---|
| 0:44 | **Animation** | A horizontal **payoff bar** under the vault fills segment by segment as coins land. An empty inbox icon ("no invoices") floats by and pops. |
| 0:49 | **Animation** | The last coin shrinks mid-flight to fit the last gap (kinetic tag `capped`); the bar turns green: **`Repaid ✓`**. |
| 0:52 | **Animation** | The vault door opens; the NFT card **slides back** into the charger. |
| (optional 3 s insert) | **Screen (proof)** | The app's labelled demo replay at the same moment: hero instrument at 100%, toast "Loan repaid · NFT returned to operator". Corner tag `Demo replay · simulated`. |

### v05 · Rating stairs (0:55 – 1:08)
> "[confident] And here's my favourite part. Paying it back lifts the machine's credit rating, so next time it borrows more, for less. [pause] It's building a credit history, just like a person would."

| Time | Type | Picture |
|---|---|---|
| 0:55 | **Animation** | A **staircase**: `Provisioned → B → BB → BBB`. The charger hops up from Provisioned to B, then B → BB → BBB. |
| 0:59 | **Animation** | Beside each step a terms card grows taller while its fee number shrinks. Kinetic type: **`borrow more, for less`**. |
| 1:04 | **Screen (proof)** | 3 s on the LIVE agung hero: seal **B → BBB**, "Next line unlocked → BBB · 0.50 · 7% · 22%". Burned-in label (mandatory): **`Rating B → BBB · SIMULATED on testnet (no MCR on agung) · 0.50 line unlocked, not drawn`**. |

### v06 · Why the router (1:08 – 1:18)
> "[amused] Could it skip the router? Sure. But then that money doesn't count toward its rating, and its NFT's still sitting in our vault."

| Time | Type | Picture |
|---|---|---|
| 1:08 | **Animation** | The charger sneaks a coin around the router along a dotted side path (cartoon tiptoe). |
| 1:12 | **Animation** | That coin turns grey with a tag `doesn't count`; the staircase dims. Cut to the vault: the NFT card behind bars with a small padlock. |

### v07 · Proof on agung (1:18 – 1:43)
> "[grounded] Okay, that was the cartoon. Here's the real thing, on peaq's agung testnet. Our test charger got a real peaq machine ID through the peaqOS SDK, took out a loan, paid it off, and got its NFT back. [building] Then it did it again: bigger, cheaper, and paid by a separate customer wallet. Fifty-four transactions, every one went through."

Lower third on every Subscan frame: `peaq agung testnet · real transactions · amounts 1/10 of the demo`. Subscan at 125% with highlight boxes. Never show the demo's 1.00 / 2.00 over this footage, and don't show `docs/proof/raw/agung-13*`.

| Time | Type | Picture |
|---|---|---|
| 1:18 | **Transition** | The cartoon frame "peels" away to reveal a browser: kinetic type `that was the cartoon → this is the chain`. |
| 1:21 | **Screen (proof)** | **Activation** [`0x753718fe…4ea8`](https://agung-testnet.subscan.io/tx/0x753718fee2bc5275e46138f094a34036e30897f501ffb433f905cb60e99c4ea8): peaqOS SDK `activateMachine`, EVCharger. Highlight the MachineRegistry NFT mint to the operator (the Tokens Transfer row, not the blank strip: V1 note from lead 23:21). |
| 1:26 | **Screen (proof)** | **Loan #1 close** [`0xb8fa6774…2995`](https://agung-testnet.subscan.io/tx/0xb8fa6774b9388ae69a672739bc91c182fa68686da6dae011c5b3fc8a8b672995): highlight both transfers in the **same tx**: final capped repayment + NFT back to operator `0x285a…066e`. Caption `Loan #1 · repaid · NFT returned`. |
| 1:31 | **Screen (proof)** | **Loan #2 session #1** [`0xd654a2df…6b4e`](https://agung-testnet.subscan.io/tx/0xd654a2df0e7400ba577e5f351747ce07856e6ebbbd2843d7f5561a11692e6b4e): highlight **from customer `0x0c9A…E39d`** → RevenueRouter → vault + machine wallet. Caption `Loan #2 · rated B · bigger, cheaper · separate customer wallet`. |
| 1:36 | **Screen (proof)** | **Loan #2 close** [`0xf5f259c1…be46`](https://agung-testnet.subscan.io/tx/0xf5f259c15a7ff6950c27475fc25cf66bc47a4a5793978b544eeec5cd77b1be46): NFT back to operator again. |
| 1:39 | **Kinetic type** | Over a blurred Subscan background: **`54 / 54`** counts up, subtitle `transactions succeeded · 2 loans · 1 real machine`. |

### v08 · Caveat + fork (1:43 – 2:07)
> "[candid] One honest caveat: agung doesn't have peaq's credit rating service or its revenue event registry, so on testnet we simulate those two. [pause] The real registry we tested on a fork of peaq mainnet, nothing broadcast: with the NFT in the vault, the operator keeps control of the machine's ID, and it still reports revenue. And forty-two tests pass."

| Time | Type | Picture |
|---|---|---|
| 1:43 | **Animated card** | Two-column card, plain and calm: **Real on agung:** peaq ID · Machine NFT · vault · router · repayments. **Simulated on agung:** credit rating · revenue event registry. Hold it long enough to read (≈ 6 s). |
| 1:52 | **Screen (proof)** | Terminal, large font: **`agent/logs/mainnet-fork-proof.txt`** (this file has the controller + EventRegistry lines; `docs/proof/mainnet-fork-escrow.txt` only has the escrow re-run). Highlight `controller during loan: 0x8725…068f (unchanged)` and `submitEvent(trust 1 …) from controller while escrowed: status 1`. Caption **`fork of peaq mainnet · nothing broadcast`**. |
| 2:02 | **Screen (proof)** | `forge test` ending on `42 tests passed, 0 failed` (from `docs/proof/forge-test.txt`). Kinetic type **`42 / 42`**. |

### v09 · Close (2:07 – 2:24)
> "[warm] A fast charger costs tens of thousands of dollars before anyone plugs in. With SKIM, it pays for the next one out of what it earns. No paperwork, no loan officer. [pause] [confident] Machines earn. Now they can borrow."

| Time | Type | Picture |
|---|---|---|
| 2:07 | **Animation** | The charger from the opening, with a price tag swinging off it. Source lower third, 4 s: `One DC fast-charging connector: $38k–90k hardware + $20k–60k install · US DOE AFDC`. |
| 2:12 | **Animation** | Coins from the charger flow into a second charger that builds itself next to it, piece by piece. |
| 2:18 | **End card** | SKIM · "Machines earn. Now they can borrow." · `github · app: links in the description (pending publish)` · "Built on peaq · Machine Economy track" · credit line `Music: Sascha Ende – Happy Beats/Business Moves (ende.app), CC BY 4.0 · SFX: Kenney (CC0)`. |

**Screen-vs-animation balance:** proof beats (live page, Subscan, terminal, tests, live hero) ≈ 50 s of ~2:24, about 35%. That's the line I wouldn't go under: the judges mark down "a deck instead of a demo". If the edit needs to cut, cut animation seconds, not proof seconds.

---

## Notes for swarm-video (Eleven v4)
- **Re-TTS all nine blocks** from `swarm/proposals/story-vo-v5.json`, one clip per block, max 2 takes each (~2.0k characters per full pass). Same voice (Brian `nPczCjzI2devNBz1zQrb`, `eleven_v4`) unless Alan wants a different one. Suggest stability **0.4** (was 0.5) so the conversational tags land. Go back to 0.5 if takes get erratic.
- **Tags used (sparingly):** `[amused] [warm] [confident] [relaxed] [grounded] [building] [candid] [pause]`. No compound tags this time. No `[clear]` (it makes the voice clear its throat). If a tag overacts (e.g. `[amused]` turns into a laugh), drop it and re-take once; the writing carries the tone on its own.
- **Pronunciation:** peaq = "peak"; peaqOS = "peak O S"; agung = "AH-goong"; SKIM = "skim"; NFT = "N F T"; SDK = "S D K"; DeFi = "dee-fye". No hashes or addresses are spoken.
- **Ellipses** (`...`) in v01 are a deliberate beat. Keep them in the generation text.
- **Captions:** burn in English subtitles from the script text (tags removed). Judges often watch muted.
- **Music:** keep it under the VO (duck to about −18 dB). A tiny sting on "DENIED" and on "slides right back" is fine.

## Honesty checklist (must pass before export)
1. Every animated frame 0:15–1:18 carries `How SKIM works · illustration`. Every web frame carries its live/replay label (QA-10); every Subscan frame carries the agung lower third.
2. Nothing over animation or replay says "live", "deployed" or "mainnet".
3. The mainnet proof is called a **fork**, with `nothing broadcast` on screen.
4. The rating and the revenue event registry on agung are **SIMULATED**: VO v08 says so, the 1:43 card says so, and the B → BBB frame at 1:04 says so.
5. Loan #2's customer is a "separate customer wallet", never "a real customer" (it's a throwaway testnet wallet). Loan #1 used one wallet for every role, so the visuals don't imply a third party there.
6. Agung amounts are 1/10 of the demo (loan #1 0.10, loan #2 0.20, next 0.50 AGNG). Don't put the demo's 1.00 / 2.00 next to agung footage. The VO speaks no AGNG amounts.
7. "Thirty percent" (v03) is the Provisioned skim: true for the demo and agung loan #1. Loan #2's 28% is never labelled 30%.
8. The fork claim ("operator keeps control of the machine's ID, still reports revenue") is shown from `agent/logs/mainnet-fork-proof.txt` lines 8–10, the file that contains it.

## Fact map (spoken line → source)
| Spoken | Source |
|---|---|
| "a real peaq ID through the peaqOS SDK" | agung.md, activation tx 0x753718fe… (`activateMachine`, MachineRegistry NFT) |
| "took out a loan, paid it off, got its NFT back" | agung.md loan #1: openLoan 0x3e8bc253…, close + NFT return 0xb8fa6774… (same tx) |
| "bigger, cheaper, paid by a separate customer wallet" | agung.md loan #2: 0.2 @ 9%/28% vs 0.1 @ 10%/30%; customer 0x0c9Aa6ea…E39d; close 0xf5f259c1… |
| "fifty-four transactions, every one went through" | agung.md: 30 + 24 = 54, all status 1 |
| "simulate those two" | agung.md "What is real vs simulated": MockEventRegistry; rating SIMULATED, posted `simulated=true` |
| "operator keeps control… still reports revenue" (fork) | agent/logs/mainnet-fork-proof.txt l.8–10: controller unchanged; EventRegistry 2.0 `submitEvent(trust 1)` while escrowed, status 1; README §2 |
| "forty-two tests pass" | docs/proof/forge-test.txt: 42 passed, 0 failed |
| "thirty percent" | SPEC Provisioned skim 30%; agung loan #1 30% |
| "its NFT's still sitting in our vault" | the NFT stays escrowed while the loan is active (SkimVault; default/seize after due date is tested, README §3) |
| "tens of thousands of dollars" | IMPACT.md / US DOE AFDC ($38k–90k hardware + $20k–60k install per DC fast connector) |

## If it runs long (cut order, never speed up)
1. v05: drop "It's building a credit history, just like a person would." (−9 words, ≈4 s)
2. v03: drop "And each payment's logged in peaq's revenue-event format." (−9 words). Keep the receipt-chip animation; on-screen text carries it.
3. v06 whole scene (−23 words, ≈10 s).
Don't cut anything in v07 or v08: that's the proof and the honesty.

## Word count
Counted by script (tags excluded): v01 38 · v02 30 · v03 37 · v04 24 · v05 31 · v06 23 · v07 56 · v08 56 · v09 37 = **332 words** ≈ 2:18 at 144 wpm.
