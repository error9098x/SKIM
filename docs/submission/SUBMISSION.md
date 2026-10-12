# SKIM: submission form draft (Superteam Earn · peaq "Advance the Machine Economy")

**Status:** draft v4 · story · 2026-10-12 23:05 IST (v4: two loans on agung: loan #2 at grade B paid by a separate customer wallet, re-rated to BBB (simulated), 54/54 txs; numbers from `docs/proof/agung.md`). **Not submitted.** The user approves and submits.
**Open for the user:** the listing is a *Germany-only regional listing*. Eligibility must be confirmed before submitting.
**Listing:** https://superteam.fun/earn/listing/build-solutions-advancing-the-machine-economy-with-peaq/
(Requirements: a working demo or compelling prototype; say clearly how it contributes to the Machine Economy; explain functionality and purpose; in English.)

---

## Title
**SKIM: Revenue-based credit for machines on peaq**

## One-liner (≤ 120 chars)
**Machines earn. Now they can borrow: an advance against the Machine NFT, repaid by skimming every payment it earns.**

Alternates:
- "Working capital for machines: escrow the Machine NFT, get an advance, repay automatically from revenue."
- "The debt side of the Machine Economy: MCR-priced loans that repay themselves from machine revenue."

## Description (≤ 150 words)
> An EV charger earns every day, yet it cannot borrow to buy a second one. Banks don't underwrite devices, and DeFi wants collateral machines don't hold. SKIM gives a working machine an advance against its future revenue. The operator escrows the machine's peaq Machine NFT in SkimVault. Because peaq separates NFT ownership from the DID controller, the machine keeps operating while escrowed. Every customer payment passes through RevenueRouter, which skims a fixed share to repay the loan. A keeper records each payment as a trust-1 peaq revenue event citing the router transaction. On repayment the NFT returns automatically, the rating rises, and a bigger, cheaper line unlocks. On peaq's agung testnet, one real activated machine repaid two loans: 0.10 AGNG (Provisioned → B), then 0.20 AGNG paid by a separate customer wallet (B → BBB, unlocking 0.50; ratings simulated). All 54 transactions succeeded.

*(Word count: 143 by whitespace split, 141 excluding the two arrows. Limit 150. Re-check if edited.)*

## How it advances the Machine Economy
- **It finances the hardware gap.** One public DC fast-charging connector costs $38,000–$90,000 plus $20,000–$60,000 to install ([US DOE AFDC](https://afdc.energy.gov/fuels/electricity-infrastructure-development)), while peaq's financing rails serve "medium-to-large" projects through IMOs and "large-scale deployment" through structured debt ([peaq Machine Financing](https://www.peaq.xyz/machine-financing)). SKIM is the per-machine line in between. Sources and more figures: `docs/submission/IMPACT.md`.
- **It fills the missing financial primitive.** peaq machines can already have an identity, a wallet, revenue and a credit rating. SKIM turns that rating into **capital**: the step from "machines earn" to "machines grow". That is the listing's *DeFi for Machines → lending, credit* track, built as one working mechanism rather than a dashboard.
- **Collateral is the machine's identity, not tokens it doesn't hold.** The Machine NFT carries the machine's on-chain history. On default the lender keeps it. On payoff it comes back without anyone pressing a button.
- **Repayment needs no human.** No invoices and no schedules. The router takes a share of whatever the machine earns, so a slow week means a smaller payment, not a default.
- **It creates a credit flywheel for the network.** Rating → terms → router repayment → trust-1 revenue events → better rating → bigger, cheaper line. Every repaid loan adds trust-1 revenue history to peaq that any other app can read.
- **It generalises.** It works for any machine with payable revenue: chargers, compute nodes, robotaxis, sensors. It is the debt-side complement to peaq Tokenize / Machine Markets (equity-like).

## peaq integration (what is used, and its honest status)
| peaq primitive | How SKIM uses it | Status in this build |
|---|---|---|
| **Machine NFT** (Economics 2.0 MachineRegistry ERC-721) | The loan collateral, escrowed in SkimVault and returned on payoff | **On agung testnet**: the activated machine's real MachineRegistry NFT is escrowed by SkimVault (openLoan tx below). **On a local fork of peaq mainnet**: a real registered Machine NFT was escrowed and returned (`contracts/script/fork-escrow-check.sh`; nothing broadcast). |
| **Owner / DID-controller split** | Escrow moves ownership but the operator keeps control, so the machine keeps running | **Verified on the same fork**: `controllerOf` was unchanged while `ownerOf` = SkimVault |
| **EventRegistry 2.0**, trust levels | Keeper submits a trust-1 revenue event per router payment, with `sourceTxHash` = the router tx | **Verified on the fork**: a trust-1 event from the controller succeeded *while the NFT was escrowed*. The mainnet keeper path uses SDK `submitEvent`. Testnet/local use `MockEventRegistry` (labelled SIMULATED). |
| **Machine Credit Rating (MCR) API** `mcr.peaq.xyz` | Rating → grade → loan terms, posted on chain by the keeper to `MCROracle` | Live API call verified. agung has no MCR, so testnet ratings are **simulated** and flagged `simulated=true` on chain and in the UI. |
| **peaqOS SDK** `@peaqos/peaq-os-sdk` 0.11.2 · `activateMachine` (Entry tier) | Gives the machine its `did:peaq:` identity and Machine NFT | **Done on agung testnet**: machine `did:peaq:76267944…366194` (EVCharger) activated, tx `0x753718fee2bc5275e46138f094a34036e30897f501ffb433f905cb60e99c4ea8`, 0.4 AGNG bond. Not activated on mainnet. |
| **Full loan loop on agung, twice** (real MachineRegistry NFT, SkimVault, RevenueRouter) | Loan #1 at Provisioned, then a bigger, cheaper loan #2 at the grade loan #1 earned: escrow → advance → router-skimmed sessions → payoff → NFT returned | **Completed on agung, two loans, 54/54 txs status 1** (30 + 24; terms scaled 1/10 of the demo). **Loan #1, Provisioned:** 0.10 AGNG advance, 10% fee (owes 0.11), 30% skim. openLoan `0x3e8bc253…09aa` escrowed the real NFT; 8 router sessions of 0.05 AGNG; session #8 `0xb8fa6774…2995` capped the last skim, closed the loan and returned the NFT in the same tx. One wallet played operator, keeper and customer (loan #1 only). **Loan #2, grade B:** 0.20 AGNG, 9% fee (owes 0.218), 28% skim. openLoan `0x35ccdad2…9692`; 8 sessions of 0.10 AGNG paid by a **separate customer wallet** `0x0c9A…E39d`; session #8 `0xf5f259c1…be46` closed it and returned the NFT. Checked afterwards (`verify-agung.mjs`, block 11138301): `ownerOf` = operator, `isActive` = false, `totalRepaid` 0.328 AGNG, `quote()` = 0.50 AGNG · 7% · 22% at BBB. Revenue events go to MockEventRegistry, and the rating path (Provisioned → B 46 → BBB 62) is derived by the keeper: both **SIMULATED** (agung has neither service). The 0.50 line is unlocked but not drawn (cap: two loans, one machine). |
| **Machine Explorer** `machines.peaq.xyz` | Linked from the app | agung machine activated; explorer page https://machines.peaq.xyz/machine/76267944138051173729075493922440340318793428579787092462435695099982000366194 (not verified to render agung machines; check before citing) |

**What is simulated, stated plainly:** the web app's `?demo` replay uses locally generated hashes and is labelled "Simulated" on every view. Without `?demo` it reads the real agung deployment. On agung, revenue events (MockEventRegistry) and the rating are simulated, because agung has no EventRegistry 2.0 or MCR; those two are proven on a mainnet fork instead. Contracts are a hackathon MVP and unaudited.

## Tech stack
Solidity 0.8.24 + Foundry (42 tests) · OpenZeppelin 5.1 · Node 22 / TypeScript / viem keeper and EV-charger simulator · peaqOS SDK · Next.js static web app.

## Links (pending publish; filled only after the user approves publishing)
- GitHub repo: *pending publish*
- Live app: *pending publish* (reads the agung deployment; `?demo` shows the labelled replay)
- Demo video (2:16, under 3:00): *pending publish* (unlisted YouTube or Loom)
- agung machine activation: https://agung-testnet.subscan.io/tx/0x753718fee2bc5275e46138f094a34036e30897f501ffb433f905cb60e99c4ea8
- agung loan #1 opened (NFT escrowed): https://agung-testnet.subscan.io/tx/0x3e8bc2539edd50c3ed55b5d967a77e913df07f8cfc7c555454af67f8f82309aa
- agung SkimVault: https://agung-testnet.subscan.io/account/0xA97b3C4F7cf5468dB2507C5769ad973e02F33D20
- agung loan #1 closed / NFT returned (session #8): https://agung-testnet.subscan.io/tx/0xb8fa6774b9388ae69a672739bc91c182fa68686da6dae011c5b3fc8a8b672995
- agung loan #2 opened at grade B (NFT escrowed): https://agung-testnet.subscan.io/tx/0x35ccdad22846286067b810c7ff8cdc30029f1c5a569142256032fd1c7bea9692
- agung loan #2 closed / NFT returned (paid by separate customer wallet): https://agung-testnet.subscan.io/tx/0xf5f259c15a7ff6950c27475fc25cf66bc47a4a5793978b544eeec5cd77b1be46
- agung customer wallet (loan #2): https://agung-testnet.subscan.io/account/0x0c9Aa6ea0e037F33225A3d1110790867F841E39d
- Full proof (every tx, real vs simulated, spend): `docs/proof/agung.md` in the repo (*link pending publish*)

## Form-field checklist before submitting (user)
- [ ] Eligibility (Germany listing) confirmed
- [ ] Repo public, README judge-first, no `.env` in history
- [ ] Video uploaded (unlisted is fine) and plays without sign-in
- [ ] Live link opens the demo with no wallet needed
- [ ] Every "verified" claim above still matches `docs/proof/`
- [ ] Contact handle / Telegram for follow-up
