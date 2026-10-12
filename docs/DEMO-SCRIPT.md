# SKIM: demo video script

The final word-for-word script and shot list (2:30, timed to the web replay and the agung testnet run) is in
**[submission/VIDEO_SCRIPT.md](submission/VIDEO_SCRIPT.md)**. Screenshot and GIF plan: [submission/MEDIA_PLAN.md](submission/MEDIA_PLAN.md).
Submission form answers: [submission/SUBMISSION.md](submission/SUBMISSION.md).

Outline:
1. **0:00 Problem.** A charger earns daily but can't borrow.
2. **0:14 One loan, start to finish** (web replay, labelled SIMULATED): escrow → 9 router sessions → paid off at 0:39 → rating up to B at 0:41.
3. **0:48 Evidence on the page:** revenue feed (capped final skim, trust-1 event rows) and the terms staircase.
4. **1:05 What's real:** agung Subscan (SDK activation, NFT escrowed by openLoan, router session, NFT returned), then the mainnet-fork proof (controller unchanged, EventRegistry 2.0 trust-1 while escrowed) and `forge test`.
5. **1:45 Architecture:** router, vault, keeper, oracle. The loop closes on itself.
6. **2:10 Why it matters,** then the end card.

(Previous draft kept at DEMO-SCRIPT.md.bak-2305.)
