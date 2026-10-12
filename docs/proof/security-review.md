# SKIM security review (chain role, 2026-10-12)

Scope: `contracts/src/{SkimVault,RevenueRouter,MCROracle,MockEventRegistry}.sol` and the keeper's use of them (`agent/src/skim.ts`, `agent/src/lib.ts`).
Not a professional audit. It is a focused review of reentrancy, rounding, the skim cap, NFT return and access control, with tests.

## Summary
| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | **Medium** (SIMULATED mode) | Anyone could inflate the machine's simulated credit grade (and its loan size) by spamming fake events into the permissionless MockEventRegistry | **Fixed** in keeper + regression test |
| F2 | Medium (trust) | `openLoan` has no borrower-side bounds. The owner (`setTerms`/`scaleTerms`) or keeper (re-grade) can change the terms between the borrower's `approve` and `openLoan` (fee/skim up to 100%) | **Open**: proposal filed (needs ABI change + redeploy) |
| F3 | Low | `withdrawLiquidity` does not decrement `totalDeposited`, so that figure is a lifetime total, not current liquidity (`availableLiquidity()` is correct) | Open, informational |
| F4 | Low (dev UX) | With `PRIVATE_KEY` in agent/.env, `NETWORK=local` signed with that key instead of anvil dev keys, which broke `local:e2e` (0 ETH on anvil) | **Fixed** in `agent/src/lib.ts` |

## Details

**F1: spoofable simulated rating.** `MockEventRegistry.submitEvent` has no access control (deliberately, it mirrors a public sink). The keeper derived the SIMULATED MCR from `revenueEventCount(machineId)`, which counts every submitter, every trust level and fake `sourceTxHash` values. Reproduced on anvil: 20 spoofed events → grade 4 (A, score 70) instead of Provisioned, which would raise the next loan's principal 8×.
*Fix:* `Skim.revenueEventCount()` now counts only `eventType 0`, `trustLevel 1` events whose `sourceTxHash` is a `RevenueRouted` transaction of **our** router for **this** machine. The registry already dedupes `sourceTxHash`, so each real payment counts at most once.
*Test:* `agent/scripts/test-rating-integrity.sh` (`npm run test:rating`): raw count 23, keeper counts 3, PASS (`docs/proof/rating-integrity-test.txt`). On the live agung deployment the fixed counter returns 8, which matches the 8 real sessions.
On mainnet this path is unused: the rating comes from peaq's MCR API, which applies its own trust levels.

**F2: no slippage bounds on openLoan.** Terms are read at execution time. Once a loan is open its terms are snapshotted, so changes cannot touch an active loan (new test `test_activeLoan_termsSnapshotted_againstOwnerAndKeeperChanges`). Before opening, a malicious owner or keeper could front-run. Suggested fix: `openLoan(machineId, wallet, term, minPrincipal, maxFeeBps, maxSkimBps)`, reverting when the quote is worse. This changes the ABI (agent + web) and needs an agung redeploy, so it was not done unilaterally (BOARD proposal).

## Checked and OK
- **Reentrancy:** `openLoan`, `repay` and `withdrawLiquidity` are `nonReentrant`. The router's `pay` is `nonReentrant`. State is updated before native transfers. `onERC721Received` only accepts the configured NFT while `_expectingNft` is set. Covered by `test_reentrancy_routerViaMachineWallet`, `test_reentrancy_vaultRefund` and `test_vault_rejectsStrayNfts`.
- **Rounding:** the skim floors (`amount*bps/10000`), so dust payments skim 0 (`test_router_tinyPaymentRoundsSkimToZero`). `owed` floors in the borrower's favour by under 1 wei. The fuzz test `testFuzz_skim_conservesValue` shows skimmed + forwarded == paid.
- **Skim cap:** the router caps the skim at the outstanding amount (`test_router_capsFinalSkim`; live on agung, the final skim was 0.005, not 0.015). `repay` caps and refunds any excess to the machine wallet (`test_excessRepay_refundsMachineWallet_andCloses`).
- **NFT return:** on full repayment the vault calls `transferFrom` (not `safeTransferFrom`) back to the borrower, so a borrower contract cannot block closing. Verified with a **real** peaq MachineRegistry NFT on a mainnet fork (`mainnet-fork-escrow.txt`) and live on agung (`agung.md`).
- **Access control:** oracle `post` is keeper-only and `setKeeper` is owner-only. Vault terms, liquidity and `seizeCollateral` are owner-only. `seizeCollateral` requires default. `markDefault` is permissionless but only after `dueAt`. `repay` is permissionless by design.
- **Web feed:** `web/lib/live.ts` only marks a router session as verified when a registry event cites that session's tx hash. Spoofed events with no matching router tx never appear (so there is no web-side variant of F1).
- **Owner trust (by design):** the vault owner is the lender and can withdraw idle liquidity at any time. That cannot affect escrowed NFTs or active-loan terms.
