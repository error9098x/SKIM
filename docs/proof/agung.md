# SKIM on peaq agung testnet — live run proof

**Date:** 2026-10-12, ~22:18–22:22 IST (raw agent logs print UTC: 16:48–16:52).
**Network:** peaq agung testnet, chain 9990, RPC `https://peaq-agung.api.onfinality.io/public`, explorer https://agung-testnet.subscan.io
**Wallet (loan #1, all roles: operator, deployer, keeper, customer; loan #2 adds a separate customer, see below):** [`0x285a7ad23cdC47B11eefd1Bb9A4905a120dC066e`](https://agung-testnet.subscan.io/account/0x285a7ad23cdC47B11eefd1Bb9A4905a120dC066e)
**Result (2 loans):** loan #2 (bigger, cheaper, separate customer wallet, re-rated to BBB) is at the bottom. **Loan #1:** a real peaq Machine NFT was activated with the peaqOS SDK, escrowed in SkimVault as loan collateral, repaid by skims of 8 routed charging payments, and returned automatically. 30/30 transactions succeeded (status 1).

## What is real vs simulated

| Piece | Status on agung |
|---|---|
| Machine identity: peaqOS SDK `activateMachine`, Economics 2.0 **MachineRegistry** NFT `0x538da35489B1F0035799a8351E67835ae4ABb377`, DID `did:peaq:<machineId>` | **REAL** (testnet) |
| SkimVault / RevenueRouter / MCROracle contracts, NFT escrow + auto-return, skim math | **REAL** (testnet) |
| Customer payments (EV charging sessions) | Simulated customer (same wallet), real on-chain txs |
| Revenue events | Written to **MockEventRegistry** (agung has no Economics 2.0 EventRegistry; on mainnet the keeper targets peaq's EventRegistry `0xA1e7…Ad1e` via the SDK) |
| Machine Credit Rating | **SIMULATED**, derived by the keeper from the revenue-event count (no MCR API for agung); posted on-chain flagged `simulated=true` |

## Machine
- machineId (= NFT tokenId): `76267944138051173729075493922440340318793428579787092462435695099982000366194` (matches the pre-computed expected id)
- type `EVCharger`, tier 0 (Entry), bond 0.4 AGNG, owner = controller = wallet above
- activation tx: https://agung-testnet.subscan.io/tx/0x753718fee2bc5275e46138f094a34036e30897f501ffb433f905cb60e99c4ea8

## Contracts (deployed block 11138037–11138039)
| Contract | Address |
|---|---|
| SkimVault | [`0xA97b3C4F7cf5468dB2507C5769ad973e02F33D20`](https://agung-testnet.subscan.io/account/0xA97b3C4F7cf5468dB2507C5769ad973e02F33D20) |
| RevenueRouter | [`0xeD420FD5Ea0df60d2f873F13e34B4F5edbB99237`](https://agung-testnet.subscan.io/account/0xeD420FD5Ea0df60d2f873F13e34B4F5edbB99237) |
| MCROracle | [`0x90DD1c0C498243425dE0B93B6c7aa79bde15B793`](https://agung-testnet.subscan.io/account/0x90DD1c0C498243425dE0B93B6c7aa79bde15B793) |
| MockEventRegistry | [`0xB91b34B2a0e16fE3D0889eDBc2f1a82d088C51e1`](https://agung-testnet.subscan.io/account/0xB91b34B2a0e16fE3D0889eDBc2f1a82d088C51e1) |
| MachineRegistry (peaq, real) | [`0x538da35489B1F0035799a8351E67835ae4ABb377`](https://agung-testnet.subscan.io/account/0x538da35489B1F0035799a8351E67835ae4ABb377) |

## Loan lifecycle
1. Rating posted: Provisioned (score 0, SIMULATED) → terms: principal 0.1 AGNG (table scaled 1/10), fee 10%, skim 30%.
2. `openLoan`: NFT moved wallet → SkimVault; 0.1 AGNG advanced; owed 0.11 AGNG.
3. 8 sessions × 0.05 AGNG through RevenueRouter: 7 × 0.015 skim + final skim capped at the 0.005 outstanding → repaid 0.11/0.11.
4. On the final repayment the vault closed the loan and returned the NFT in the same tx.
5. Keeper wrote 8 revenue events (one per router tx) and re-rated: Provisioned 0 → 36 → **B 44 → B 46** (SIMULATED).

## Independent verification after the run (via `cast`, not the agent)
- `MachineRegistry.ownerOf(machineId)` = `0x285a…066e` (back with the borrower)
- `SkimVault.isActive(machineId)` = `false`
- SkimVault balance = 0.51 AGNG (0.5 seed + 0.01 fee earned by the lender)
- `MCROracle.getRating(machineId)` = (score 46, grade 1 = B, simulated true)

## Spend
Start 3.000 AGNG → end 2.090 AGNG: **0.91 AGNG** = 0.4 bond (held by peaq for the machine) + 0.51 sitting in SkimVault (owner can `withdrawLiquidity`) + ~1e-8 gas (gas price 1024 wei). Budget was 2.5.

## Known gaps (honest)
- Loan #1 revenue events carry a sub-cent USD value: each session is 0.05 AGNG ≈ $0.0022 (PEAQ_USD 0.043). The on-chain `value` field is integer USD cents (ISO-4217, like peaq's EventRegistry), so it holds 0 for these testnet amounts. The events are real txs; the AGNG amount and router tx of each are in the table below. Since loan #2 the keeper also writes the native amount + µUSD into event metadata and logs `0.1000 AGNG ≈ $0.0043`. On mainnet the simulator warns below $10 per session, and the README sizes sessions at ≥ $10 so the MCR counts them.
- One wallet plays every role, so payments loop back to the same address. Economically meaningless, mechanically complete.
- MCR is simulated on agung (no MCR API); revenue events go to our mock registry.

## Every transaction (nonce order)
| Nonce | Block | Step | Tx |
|---|---|---|---|
| 0 | 11138031 | peaqOS SDK: approve bond on PEAQ/AGNG ERC-20 precompile (0x…0809) | [0x99c819f7…af78](https://agung-testnet.subscan.io/tx/0x99c819f7a3e37ea2b25236d94c97e51e7218a8c3e37a626aa612e5b8f6dbaf78) |
| 1 | 11138032 | peaqOS SDK `activateMachine` (Entry tier, 0.4 AGNG bond) → Machine NFT minted on MachineRegistry | [0x753718fe…4ea8](https://agung-testnet.subscan.io/tx/0x753718fee2bc5275e46138f094a34036e30897f501ffb433f905cb60e99c4ea8) |
| 2 | 11138037 | deploy MCROracle | [0xb80a0f6e…168c](https://agung-testnet.subscan.io/tx/0xb80a0f6ebdae84f6ef4049386d291fed41e8b465de67458ef07e1949e306168c) |
| 3 | 11138037 | deploy SkimVault (bound to real agung MachineRegistry) | [0x184f7236…7b44](https://agung-testnet.subscan.io/tx/0x184f72362de83214f0408559429ae55e19a18a92ef3d79fd37dc4cc022507b44) |
| 4 | 11138038 | deploy RevenueRouter | [0x692516a4…0666](https://agung-testnet.subscan.io/tx/0x692516a4cbf174e64fb86b97e9d23d4f275f753b75827558b06fa833e3e80666) |
| 5 | 11138039 | deploy MockEventRegistry (agung has no Economics 2.0 EventRegistry) | [0x0832b83e…23b3](https://agung-testnet.subscan.io/tx/0x0832b83e6991841c8f867c3ae2de70d869abc2da23121c0f557a971efbc523b3) |
| 6 | 11138040 | vault.scaleTerms(1,10) (cheap demo: Provisioned line 1 → 0.1 AGNG) | [0x5cba62b0…f55a](https://agung-testnet.subscan.io/tx/0x5cba62b0947a7d322295ef28a7da28dc32c00e014eeb33f3698b18fb1467f55a) |
| 7 | 11138041 | vault.deposit 0.5 AGNG (lender seed) | [0xb8d05e21…8af8](https://agung-testnet.subscan.io/tx/0xb8d05e216e08238eb9557a988e41edf9a798689e76b1d435c80bd53457f28af8) |
| 8 | 11138045 | oracle.post Provisioned score 0 (SIMULATED rating) | [0xb11c0ac3…f99c](https://agung-testnet.subscan.io/tx/0xb11c0ac3b9825836316f47513f7a1e1b1d9549f2061b3afe6c72fc697eabf99c) |
| 9 | 11138047 | MachineRegistry.approve(vault, machineId) | [0xab5e0403…7e76](https://agung-testnet.subscan.io/tx/0xab5e0403e02f2df040e83e363eec4bb720762badac2103c80b7d876bb7407e76) |
| 10 | 11138048 | vault.openLoan → real Machine NFT escrowed, 0.1 AGNG advanced, owes 0.11 | [0x3e8bc253…09aa](https://agung-testnet.subscan.io/tx/0x3e8bc2539edd50c3ed55b5d967a77e913df07f8cfc7c555454af67f8f82309aa) |
| 11 | 11138053 | EV session #1: router.pay 0.05 AGNG → 30% skim to vault.repay | [0xec6c4a44…2261](https://agung-testnet.subscan.io/tx/0xec6c4a448a81f0b07070b944ddd9abcb96ad06a32d2f674e71ea225f00f42261) |
| 12 | 11138053 | keeper: revenue event to MockEventRegistry (trust 1, cites router tx) | [0x967da562…4d00](https://agung-testnet.subscan.io/tx/0x967da562b02d97b2e08024cd1c977d92a4b980a3aaacd16c6f05b0613c974d00) |
| 13 | 11138053 | EV session #2: router.pay 0.05 AGNG → 30% skim to vault.repay | [0x8e022964…c861](https://agung-testnet.subscan.io/tx/0x8e0229643b1924d797bd548ea687b1e3bf02ead54fa940133262968ef35dc861) |
| 14 | 11138055 | EV session #3: router.pay 0.05 AGNG → 30% skim to vault.repay | [0x33086a5c…a8eb](https://agung-testnet.subscan.io/tx/0x33086a5c33c08f8e5ac98bf3da3d4d47027dec652fcf97e43b591524f19ea8eb) |
| 15 | 11138055 | keeper: revenue event to MockEventRegistry (trust 1, cites router tx) | [0x16ada9e9…a9e9](https://agung-testnet.subscan.io/tx/0x16ada9e9d7abc894dee51b8a3d3d93903125d35a56a58c8239078a383f91a9e9) |
| 16 | 11138057 | keeper: revenue event to MockEventRegistry (trust 1, cites router tx) | [0x8b2b5a61…a85f](https://agung-testnet.subscan.io/tx/0x8b2b5a6114784e46aca945db24df5ed228ca76754c204643486b8f061026a85f) |
| 17 | 11138057 | EV session #4: router.pay 0.05 AGNG → 30% skim to vault.repay | [0xc95cb713…346c](https://agung-testnet.subscan.io/tx/0xc95cb7130a04e962a2a5fe833039069a7b1499cae2b2fbba8c0ed31dac02346c) |
| 18 | 11138058 | keeper: oracle.post rating (SIMULATED) | [0xfbab7a4b…977b](https://agung-testnet.subscan.io/tx/0xfbab7a4b81fef6ee7b13578e04455d4839035caceae2169b96f8f3d09862977b) |
| 19 | 11138059 | EV session #5: router.pay 0.05 AGNG → 30% skim to vault.repay | [0x14d6e6d4…ed66](https://agung-testnet.subscan.io/tx/0x14d6e6d49e365f5dcbd2cc296de592ed940e076a7beb2d620da358c1c211ed66) |
| 20 | 11138060 | keeper: revenue event to MockEventRegistry (trust 1, cites router tx) | [0xc2cc5a6e…ff97](https://agung-testnet.subscan.io/tx/0xc2cc5a6ee57ffaf489ae094862ca755fda4e6e05799cb976194a63809b49ff97) |
| 21 | 11138061 | EV session #6: router.pay 0.05 AGNG → 30% skim to vault.repay | [0x53549067…f93f](https://agung-testnet.subscan.io/tx/0x535490674eb1254b9b66334d987eda7c1e0f9507a6913a1792ceedd80380f93f) |
| 22 | 11138061 | keeper: revenue event to MockEventRegistry (trust 1, cites router tx) | [0xe66af908…353f](https://agung-testnet.subscan.io/tx/0xe66af9083ac79b24c567ab9d4232770a135b7f28f2df59b7eab6f2d98f68353f) |
| 23 | 11138063 | EV session #7: router.pay 0.05 AGNG → 30% skim to vault.repay | [0x35522e3f…4943](https://agung-testnet.subscan.io/tx/0x35522e3f327ae2ad8f7bc86c74d33f16ce90e482f7f432a38d16798cda684943) |
| 24 | 11138063 | keeper: revenue event to MockEventRegistry (trust 1, cites router tx) | [0x35dce8a9…210e](https://agung-testnet.subscan.io/tx/0x35dce8a9e70b878d5e5a68ab6b0a4209082b519e89dd3703c272b53dae4a210e) |
| 25 | 11138065 | EV session #8: router.pay 0.05 AGNG → 30% skim to vault.repay (final 0.005, capped) → **loan repaid, NFT auto-returned** | [0xb8fa6774…2995](https://agung-testnet.subscan.io/tx/0xb8fa6774b9388ae69a672739bc91c182fa68686da6dae011c5b3fc8a8b672995) |
| 26 | 11138065 | keeper: revenue event to MockEventRegistry (trust 1, cites router tx) | [0x3c4e600d…d1e4](https://agung-testnet.subscan.io/tx/0x3c4e600db3683af95d32eeefa0d79fba7308d2b9d331bf087cb3b3b5a908d1e4) |
| 27 | 11138066 | keeper: oracle.post rating (SIMULATED) | [0xffb58a97…dc42](https://agung-testnet.subscan.io/tx/0xffb58a97e734650a36c50d2e3c9483ba6353df576cd98ae88b678f718843dc42) |
| 28 | 11138068 | keeper: revenue event to MockEventRegistry (trust 1, cites router tx) | [0xa47e7dad…50a6](https://agung-testnet.subscan.io/tx/0xa47e7dada81fe1344ea302411202cbfbb96f422f681e99c9ff69772e08c150a6) |
| 29 | 11138073 | keeper: oracle.post rating (SIMULATED) | [0xd6ea5913…f615](https://agung-testnet.subscan.io/tx/0xd6ea59133b758f296cae3407caa82a8d7fa805011024a9a63d70f1c72b2cf615) |
Raw logs: `raw/agung-01-activate-dryrun.log`, `raw/agung-02-activate.log`, `raw/agung-03-deploy.log`, `raw/agung-04-keeper-initial.log`, `raw/agung-05-open-loan.log`, `raw/agung-06-keeper.log`, `raw/agung-07-simulator.log`, `raw/agung-txs.json` (block-scanned list of all wallet txs with receipts).

---

# Loan #2 — the flywheel, on-chain (2026-10-12 ~22:39–22:45 IST, raw logs print UTC 17:08–17:15)

**What it proves:** the same real machine, now rated B (SIMULATED) after loan #1, borrows a **bigger and cheaper** line (0.1 AGNG @ 10% fee / 30% skim → **0.2 AGNG @ 9% / 28%**). It is repaid by 8 routed payments from a **separate customer wallet**. The NFT comes back on its own, and the keeper re-rates the machine **B 46 → B 48 → BB 54 → BBB 60 → BBB 62**. That unlocks a third line of **0.5 AGNG @ 7% / 22%** (not drawn: we cap at two loans and one machine).
Same contracts as loan #1 (no redeploy), so every loan #1 link above stays valid.

| Role | Address |
|---|---|
| Customer (new throwaway testnet wallet; key only in `agent/.env` as `CUSTOMER_PRIVATE_KEY`) | [`0x0c9Aa6ea0e037F33225A3d1110790867F841E39d`](https://agung-testnet.subscan.io/account/0x0c9Aa6ea0e037F33225A3d1110790867F841E39d) |
| Operator / borrower, machine wallet, keeper | [`0x285a7ad23cdC47B11eefd1Bb9A4905a120dC066e`](https://agung-testnet.subscan.io/account/0x285a7ad23cdC47B11eefd1Bb9A4905a120dC066e) |

On subscan every `RevenueRouter.pay` now reads **customer `0x0c9A…` → router → vault (skim) + machine wallet (rest)**. Four distinct parties are visible. Loan #1 used a single wallet, so it read as a wash loop.

## Rating upgrade path (keeper, SIMULATED: score = 30 + 2 × router-backed trust-1 revenue events)
| After event | Score | Grade | Next line (vault terms ×1/10) | oracle.post tx |
|---|---|---|---|---|
| loan #1 end (8 events) | 46 | B | 0.2 AGNG · 9% · 28% | (loan #1 table) |
| 9 | 48 | B | 0.2 · 9% · 28% | [0xfecc5676…](https://agung-testnet.subscan.io/tx/0xfecc5676f7a12937ae46bf294b01a5478f2d4ac501ab1e78f345f75819572e8e) |
| 12 | 54 | **BB** | 0.3 · 8% · 25% | [0x828a06eb…](https://agung-testnet.subscan.io/tx/0x828a06eb61d52f922319a383ee9da08d49743888d08ee85327992454ff92808a) |
| 15 | 60 | **BBB** | 0.5 · 7% · 22% | [0x1eabe33e…](https://agung-testnet.subscan.io/tx/0x1eabe33eea446854c26c5f69a448498aadc8f7e217db3d17e87834eaba83c344) |
| 16 | 62 | BBB | **0.5 AGNG · 7% · 22%** (read back from `vault.quote`) | [0xfcaeb601…](https://agung-testnet.subscan.io/tx/0xfcaeb601758ad64fac3ad02eb0311dc3a66cdf4a17af979ecf1690e40515b592) |

(The keeper polls the rating every 20 s, so it posts at the event count it sees, not after every event. Terms per grade read back from `SkimVault.allTerms()`: Provisioned 0.1/10%/30%, B 0.2/9%/28%, BB 0.3/8%/25%, BBB 0.5/7%/22%, A 0.8/6%/20%.)

## Loan #2 transactions (24 txs, all status 1; block-scanned → `raw/agung-loan2-txs.json` (23) + the sweep tx from `raw/agung-15-sweep-customer.log`)
| Block | Signer nonce | Step | Tx |
|---|---|---|---|
| 11138238 | operator/keeper 30 | fund separate customer wallet 0.85 AGNG (deployer → customer) | [0x2eaf6d19…44f4](https://agung-testnet.subscan.io/tx/0x2eaf6d193ec46cbdad0ac2dffeca675372ac60701ac63ab4641c3021b96244f4) |
| 11138243 | operator/keeper 31 | MachineRegistry.approve(vault, machineId) | [0x073f008e…8a27](https://agung-testnet.subscan.io/tx/0x073f008ef99216e404a323a3c91bfa665c148c59a4003598d46a1c8657008a27) |
| 11138245 | operator/keeper 32 | vault.openLoan at grade **B** → real Machine NFT escrowed, **0.2 AGNG** advanced, owes 0.218, skim 28% | [0x35ccdad2…9692](https://agung-testnet.subscan.io/tx/0x35ccdad22846286067b810c7ff8cdc30029f1c5a569142256032fd1c7bea9692) |
| 11138249 | customer 0 | EV session #1: customer pays router 0.1 AGNG → skim 0.028 to vault, 0.072 to machine wallet · repaid 0.028/0.218 | [0xd654a2df…6b4e](https://agung-testnet.subscan.io/tx/0xd654a2df0e7400ba577e5f351747ce07856e6ebbbd2843d7f5561a11692e6b4e) |
| 11138250 | operator/keeper 33 | keeper: revenue event #1 (0.1 AGNG ≈ $0.0043, trust 1, cites router tx) → MockEventRegistry | [0x51187f0c…ae7f](https://agung-testnet.subscan.io/tx/0x51187f0c4acb135ad62cd6cdaf04e4df7c8c9d829602a5a4f5c885223fd4ae7f) |
| 11138252 | operator/keeper 34 | keeper: revenue event #2 (0.1 AGNG ≈ $0.0043, trust 1, cites router tx) → MockEventRegistry | [0x59710bfb…d072](https://agung-testnet.subscan.io/tx/0x59710bfb362710419b149c7596e0a7b17d97f8453453ea53b249677423ead072) |
| 11138253 | customer 1 | EV session #2: customer pays router 0.1 AGNG → skim 0.028 to vault, 0.072 to machine wallet · repaid 0.056/0.218 | [0x3861adf5…22b9](https://agung-testnet.subscan.io/tx/0x3861adf5a705abb7b7132789fbd58b5488f349c8bbbe25f4d474ab2bf09022b9) |
| 11138253 | operator/keeper 35 | keeper: oracle.post **B 48** (SIMULATED) | [0xfecc5676…2e8e](https://agung-testnet.subscan.io/tx/0xfecc5676f7a12937ae46bf294b01a5478f2d4ac501ab1e78f345f75819572e8e) |
| 11138253 | customer 2 | EV session #3: customer pays router 0.1 AGNG → skim 0.028 to vault, 0.072 to machine wallet · repaid 0.084/0.218 | [0x5203e0f3…04b7](https://agung-testnet.subscan.io/tx/0x5203e0f3561c047521ef7f807305a640c0c7c810ce48bb793076efbcebc504b7) |
| 11138255 | operator/keeper 36 | keeper: revenue event #3 (0.1 AGNG ≈ $0.0043, trust 1, cites router tx) → MockEventRegistry | [0xbd73e040…73bf](https://agung-testnet.subscan.io/tx/0xbd73e040ad6c1a769e9f1f8b2c6d81b79b2aa77207ef58ce2c3b52e6ba6773bf) |
| 11138255 | customer 3 | EV session #4: customer pays router 0.1 AGNG → skim 0.028 to vault, 0.072 to machine wallet · repaid 0.112/0.218 | [0xdc8bcba4…73b2](https://agung-testnet.subscan.io/tx/0xdc8bcba41944fb761bedcd683d60e9384259c2b436359da6b177583144d073b2) |
| 11138257 | operator/keeper 37 | keeper: revenue event #4 (0.1 AGNG ≈ $0.0043, trust 1, cites router tx) → MockEventRegistry | [0x6aceff60…5dc5](https://agung-testnet.subscan.io/tx/0x6aceff60594e3fd9c1d0a6141aa97ffe45a710e2ac04db87a86980db4d9f5dc5) |
| 11138257 | customer 4 | EV session #5: customer pays router 0.1 AGNG → skim 0.028 to vault, 0.072 to machine wallet · repaid 0.140/0.218 | [0xf51ce85c…78b6](https://agung-testnet.subscan.io/tx/0xf51ce85ce28744273de2644474ba75b0ee3d35ef56bd4ede41a95103ceec78b6) |
| 11138258 | operator/keeper 38 | keeper: oracle.post **BB 54** (SIMULATED) | [0x828a06eb…808a](https://agung-testnet.subscan.io/tx/0x828a06eb61d52f922319a383ee9da08d49743888d08ee85327992454ff92808a) |
| 11138259 | customer 5 | EV session #6: customer pays router 0.1 AGNG → skim 0.028 to vault, 0.072 to machine wallet · repaid 0.168/0.218 | [0xd128bfa3…097f](https://agung-testnet.subscan.io/tx/0xd128bfa3d140222691ae27ac3b4e95989602a3553eec70145f1dca8f04b4097f) |
| 11138260 | operator/keeper 39 | keeper: revenue event #5 (0.1 AGNG ≈ $0.0043, trust 1, cites router tx) → MockEventRegistry | [0x526f9d5f…9adb](https://agung-testnet.subscan.io/tx/0x526f9d5f3008e0db1f6a72ac1fdc186e2e975b2172b3c10de475fe411ed69adb) |
| 11138261 | operator/keeper 40 | keeper: revenue event #6 (0.1 AGNG ≈ $0.0043, trust 1, cites router tx) → MockEventRegistry | [0xa0596a91…50a8](https://agung-testnet.subscan.io/tx/0xa0596a91b51a35e02ff7e7a9508e4ac8eadff23f21c59d5a3175b74d5e3950a8) |
| 11138261 | customer 6 | EV session #7: customer pays router 0.1 AGNG → skim 0.028 to vault, 0.072 to machine wallet · repaid 0.196/0.218 | [0xf0657ad7…7a78](https://agung-testnet.subscan.io/tx/0xf0657ad73e36cbf50cb887a24a6d1a4af6f22691fac557bbe36cfb718fc57a78) |
| 11138263 | operator/keeper 41 | keeper: revenue event #7 (0.1 AGNG ≈ $0.0043, trust 1, cites router tx) → MockEventRegistry | [0x463b3dc7…d7c8](https://agung-testnet.subscan.io/tx/0x463b3dc7286dba564602b5cec049ef58cb73a67a4ec6e3eec380b00a7a37d7c8) |
| 11138265 | customer 7 | EV session #8: customer pays router 0.1 AGNG → skim 0.022 to vault, 0.078 to machine wallet · repaid 0.218/0.218 → **loan repaid, NFT auto-returned** | [0xf5f259c1…be46](https://agung-testnet.subscan.io/tx/0xf5f259c15a7ff6950c27475fc25cf66bc47a4a5793978b544eeec5cd77b1be46) |
| 11138265 | operator/keeper 42 | keeper: oracle.post **BBB 60** (SIMULATED) | [0x1eabe33e…c344](https://agung-testnet.subscan.io/tx/0x1eabe33eea446854c26c5f69a448498aadc8f7e217db3d17e87834eaba83c344) |
| 11138267 | operator/keeper 43 | keeper: revenue event #8 (0.1 AGNG ≈ $0.0043, trust 1, cites router tx) → MockEventRegistry | [0x7c6d2d7c…3028](https://agung-testnet.subscan.io/tx/0x7c6d2d7c60b9e919a4d1d774ec4b70bb35aade09bad978f49f4cb1fb594e3028) |
| 11138270 | operator/keeper 44 | keeper: oracle.post **BBB 62** (SIMULATED) | [0xfcaeb601…b592](https://agung-testnet.subscan.io/tx/0xfcaeb601758ad64fac3ad02eb0311dc3a66cdf4a17af979ecf1690e40515b592) |
| 11138300 | customer 8 | sweep customer leftover 0.05 AGNG back to deployer | [0x42f614db…be52](https://agung-testnet.subscan.io/tx/0x42f614db0c6a46b825c7d0ff5fb0df03e4ac64700915f2f9efd5ea81dfe7be52) |

Loan #2 closing tx: [0xf5f259c15a7ff6950c27475fc25cf66bc47a4a5793978b544eeec5cd77b1be46](https://agung-testnet.subscan.io/tx/0xf5f259c15a7ff6950c27475fc25cf66bc47a4a5793978b544eeec5cd77b1be46)

## Independent read-back after loan #2 (`node agent/scripts/verify-agung.mjs`, block 11138301 → `raw/agung-16-verify-after-loan2.txt`)
- `MachineRegistry.ownerOf(machineId)` = `0x285a…066e` (NFT back with the borrower)
- `SkimVault.isActive` = `false`; `totalRepaid` = 0.328 AGNG (0.11 + 0.218)
- `MCROracle.getRating` = score 62, grade 3 = **BBB**, simulated = true
- `SkimVault.quote` = 0.5 AGNG, 700 bps fee, 2200 bps skim, grade 3
- `MockEventRegistry.revenueEventCount` = 16 (8 + 8, each citing a distinct router tx)
- Balances: deployer 2.0720, customer ~0 (swept), SkimVault 0.528 AGNG (0.51 + the 0.018 fee earned by the lender)

## Loan #2 spend
Deployer 2.0900 → 2.0720 AGNG = **0.018 AGNG**, which is exactly the 9% fee. It now sits in SkimVault, and the owner can withdraw it. Session money only circled: 0.85 went to the customer, 0.576 came back to the machine wallet as revenue, the 0.2 advance came back, and the 0.05 leftover was swept back. Gas was ~1e-11 AGNG.

## Notes (honest)
- **Event values:** each session is 0.1 AGNG ≈ $0.0043. The on-chain `value` field is ISO-4217 USD **cents** (like peaq's EventRegistry), so it is 0 for a sub-cent testnet session. Since this run the keeper also writes `amountNative`, `nativeSymbol` and `usdMicro` (4300 µUSD) into each event's metadata. Its log line reads `0.1000 AGNG ≈ $0.0043 [value field 0¢ (sub-cent testnet session)]` and never prints "$0.00". The lead's later 0.25 AGNG/session sizing (≈1.1¢ → value 1) arrived after this run had finished. It was not re-run because of the no-loan-#3 cap.
- Session size 0.1 AGNG gives 8 sessions per loan, matching loan #1's bar (judge asked for 6–10). 0.25 AGNG would have repaid in 4.
- **Sandbox reset during the run:** the agent processes and logs stopped at 17:11:14 UTC, before session #8. The chain finished as designed: session #8 closed the loan, and the keeper had already posted events 7–8 and the BBB ratings. A final `KEEPER_ONCE=1` pass found both remaining events already recorded. The tx table above is block-scanned from the chain, not taken from the truncated logs. Logs `raw/agung-12…13` also show `repaid 0.0280` on sessions #2–#3. That is RPC read-after-write lag in the log line only; the router event amounts are correct.
- Rating and event registry are still SIMULATED on agung. F2 (borrower-side min/max terms on `openLoan`) is still open and documented as a known limitation (lead 22:36). Loan #2 terms equal `quote()` at open, so no front-run happened here.
