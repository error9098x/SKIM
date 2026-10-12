# SKIM: shared build spec (source of truth for every builder)

> Build-time spec, kept as written. Deviations are listed in `CHANGES.md`; current status and proof are in `README.md`.

SKIM is revenue-based credit for machines on peaq. A machine (a simulated EV charger) escrows its Machine NFT and gets an advance. Every charging payment then flows through a router that skims a share to repay the loan. A keeper records each routed payment as a peaq revenue event that cites the router tx. Once the loan is fully repaid, the NFT goes back to the machine. Loan terms come from the machine's Machine Credit Rating (MCR).

Pitch and research: ../work/pitch-machine-rbf.md. peaq docs copies: ../work/peaq/ and ../work/peaqdocs/.

## Networks
- **agung testnet** (build tonight): chain 9990, RPC https://peaq-agung.api.onfinality.io/public, explorer https://agung-testnet.subscan.io. Native token AGNG.
  - There is no MCR or Economics 2.0 EventRegistry here. The keeper runs in **simulated mode**: it posts simulated ratings and writes events to our own `MockEventRegistry`.
  - Everything shown in this mode is labelled SIMULATED in the UI.
- **peaq mainnet** (switch about 9 am IST 2026-10-13): chain 3338, RPC https://quicknode1.peaq.xyz, explorer https://peaq.subscan.io. Native token PEAQ.
  - EventRegistry 2.0: `0xA1e7F1d7B24dAb55Dc92491e6d9B89F6E925Ad1e`.
  - MCR API: `GET https://mcr.peaq.xyz/mcr/did:peaq:<decimal machineId>`.
  - Use `@peaqos/peaq-os-sdk` with deployment `peaq-mainnet`; agung uses `agung-2026-08-28`.
- All value moves in the **native token** (PEAQ/AGNG via msg.value). There are no ERC-20s.

## Repo layout (each builder owns only its folder)
```
skim/
  SPEC.md            (this file; don't edit without noting it in CHANGES.md)
  contracts/         Foundry project       -> builder A
  agent/             Node/TS scripts       -> builder A
  web/               Next.js app           -> builder B
  deployments/       <network>.json        -> written by agent/scripts/deploy, read by web
  README.md          -> builder A (judge-facing)
```

## Contracts (Solidity ^0.8.24, OpenZeppelin)
### MCROracle
- Owned by the keeper.
- `struct Rating { uint8 score; uint8 grade; uint64 updatedAt; bool simulated; }`
- `grade` enum: 0 = Provisioned/NR, 1 = B, 2 = BB, 3 = BBB, 4 = A, 5 = AA, 6 = AAA.
- `function post(uint256 machineId, uint8 score, uint8 grade, bool simulated) external onlyKeeper`
  - emits `RatingPosted(machineId, score, grade, simulated)`.
- `function getRating(uint256 machineId) external view returns (Rating memory)`

### SkimVault
- Holds lender liquidity: `deposit()` payable, emits `Deposited(lender, amount)`. Owner can `withdrawLiquidity`.
- Terms by grade, set in the constructor and changeable by the owner:
  | Grade | Principal | Fee | Skim |
  |---|---|---|---|
  | Provisioned | 1 PEAQ (starter line) | 10% | 30% |
  | B | 2 | 9% | 28% |
  | BB | 3 | 8% | 25% |
  | BBB | 5 | 7% | 22% |
  | A | 8 | 6% | 20% |
  | AA | 12 | 5% | 18% |
  | AAA | 20 | 4% | 15% |
  - Store principal in wei, fee and skim in bps. The owner can scale the table (keep the demo amounts small).
- `function quote(uint256 machineId) view returns (uint256 principal, uint16 feeBps, uint16 skimBps, uint8 grade)`
- `function openLoan(uint256 machineId, address payable machineWallet, uint64 termSeconds)`
  - The caller must own the NFT and must have approved the vault first.
  - The vault does `safeTransferFrom` of the NFT into itself.
  - The principal is sent to `machineWallet`.
  - Records `Loan { address borrower; address payable machineWallet; uint256 principal; uint256 owed; uint256 repaid; uint16 skimBps; uint64 openedAt; uint64 dueAt; uint8 status; }`
    - `owed = principal * (10000 + feeBps) / 10000`
    - status: 0 = none, 1 = active, 2 = repaid, 3 = defaulted
  - emits `LoanOpened(machineId, borrower, machineWallet, principal, owed, skimBps, dueAt)`.
- `function repay(uint256 machineId) payable`
  - Anyone can call it (the router uses it).
  - Caps the payment at what's still owed and refunds any excess to `machineWallet`.
  - emits `Repaid(machineId, amount, repaid, owed)`.
  - When fully repaid: status = 2, the NFT goes back to the borrower, and it emits `LoanClosed(machineId)`.
- `function markDefault(uint256 machineId)`
  - Only after `dueAt` and if not repaid. Status becomes 3 and the vault keeps the NFT.
  - emits `Defaulted(machineId)`.
- Views: `loans(machineId)`, `skimBpsOf(machineId)` (0 if not active), `isActive(machineId)`.
- Implements `IERC721Receiver`.
- The constructor takes `(IERC721 machineNft, MCROracle oracle)`.

### RevenueRouter
- `function pay(uint256 machineId, address payable machineWallet, bytes32 sessionId) payable`
  - If the vault has an active loan: `skim = msg.value * skimBps / 10000`. It calls `vault.repay{value: skim}` and forwards the rest to `machineWallet`.
    - Use the loan's `machineWallet` when a loan is active, and ignore the argument.
  - If there's no loan, it forwards everything.
  - emits `RevenueRouted(machineId, payer, sessionId, amount, skimmed, forwarded)`.
- Reentrancy guarded.

### MockMachineNFT (testnet/tests only)
- ERC-721 whose `mint(to, tokenId)` is open on testnet. It stands in when the real MachineRegistry NFT can't be used.
- The deploy script takes `MACHINE_NFT` from env. If it's unset, the script deploys the mock.

### MockEventRegistry (testnet only)
- Mimics peaq's EventRegistry shape:
  - `submitEvent(uint256 machineId, uint8 eventType, uint256 value, string currency, uint64 timestamp, uint8 trustLevel, bytes32 sourceTxHash, string metadata)`
  - emits `EventSubmitted(machineId, eventType, value, currency, timestamp, trustLevel, sourceTxHash)`.

## Agent (Node 22 + TypeScript + viem; peaq-os-sdk for mainnet)
- **`scripts/deploy.ts`**: deploys everything, seeds the vault with liquidity (env `SEED_LIQUIDITY`), and writes `deployments/<network>.json`. The file holds: `{chainId, rpc, explorer, contracts:{vault,router,oracle,machineNft,eventRegistry}, machineId, machineWallet, simulated:boolean, abis:{...}}`.
- **`scripts/activate.ts`**: activates the machine via the peaqos SDK (Entry tier) on the chosen network and prints machineId. On agung without 2.0 support, it falls back to minting a mock NFT.
- **`keeper.ts`**: runs two loops.
  - It watches `RevenueRouted` and submits a revenue event (eventType 0, value in USD cents, trustLevel 1, sourceTxHash = router tx).
    - On mainnet it submits through the peaqos SDK. On testnet it writes to MockEventRegistry.
    - The USD value comes from env `PEAQ_USD` or a CoinGecko fetch.
  - It polls the MCR API (or, when simulated, derives a score from the event count) and calls `oracle.post`.
- **`simulator.ts`**: an EV charger. Every `SESSION_INTERVAL` seconds it pays `router.pay` with a session value from env (big enough to be ≥ $10 on mainnet). It logs each session.
- **`demo.ts`**: one-shot scripted demo. It posts a rating, opens a loan, runs N sessions until repaid, and shows the NFT coming back.
- Config lives in `.env.example`. Private keys come only from env, never committed.

## Web (builder B)
- Stack: Next.js (App Router) + Tailwind + viem, static-exportable and deployable to Vercel.
- Reads `deployments/<network>.json`; the frontend copies it via a sync script. Network is chosen by `NEXT_PUBLIC_NETWORK`.
- No wallet connection is required to view anything. An optional deposit control, labelled "Vault liquidity · owner-managed" (originally specced as a "Fund the vault" button; renamed because there are no LP shares yet, see CHANGES.md #21), uses an injected wallet.
- Polls the chain about every 5s.
- One page, with these sections:
  1. **Landing hero**: "Machines earn. Now they can borrow." It shows a one-line pitch, the 4-step loop (Escrow NFT → Advance → Skim revenue → NFT returned), and buttons to scroll to the live loan and open the explorer.
  2. **Machine card**: the DID `did:peaq:<id>` with a Machine Explorer link (`https://machines.peaq.xyz/machine/<id>`), the rating grade/score (live MCR JSON on mainnet, oracle on testnet with a SIMULATED badge), and the current NFT owner (vault or borrower).
  3. **Loan panel**: the quote by grade (principal, fee, skim %), the full terms-curve table for all grades, and the loan status, with a progress bar of repaid vs. owed and the due date.
  4. **Live revenue feed**: `RevenueRouted` events showing amount, skim to vault, forwarded to machine, and the tx link. The matching revenue event (trust 1) gets a "verified" chip.
  5. **Payoff state**: when `LoanClosed` fires, show "NFT returned to machine".
  6. **How it works**: a diagram (charger → router → vault/machine; keeper → EventRegistry → MCR → oracle → terms), contract addresses, and GitHub/README/video links (placeholders).
- Design: dark, technical, confident, using peaq-ish purple accents. It should look like a credit product, not a fleet dashboard.
- When `deployments/<network>.json` is missing, render from a bundled `mock-state.json` so the page still demos.
