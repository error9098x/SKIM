# Proof (captured 2026-10-12 IST)

| File | What it shows |
|---|---|
| [agung.md](agung.md) | **Live peaq agung testnet run:** real peaqOS SDK machine activation → contracts deployed → real MachineRegistry NFT escrowed as collateral → repaid by 8 routed payments → NFT auto-returned. 30/30 txs with subscan links. Spend 0.91 AGNG. **Loan #2 (flywheel):** grade B, 0.2 AGNG @ 9%/28%, repaid by 8 payments from a **separate customer wallet** `0x0c9A…E39d`, NFT returned, keeper re-rated B 46 → BB 54 → **BBB 62** (simulated) → next line 0.5 AGNG @ 7%/22%. 24 txs (block-scanned), spend 0.018 AGNG (= fee, sits in the vault). Read-back: `node agent/scripts/verify-agung.mjs`. |
| [mainnet-fork-escrow.txt](mainnet-fork-escrow.txt) | SkimVault escrows and returns a **real peaq mainnet** Machine NFT (MachineRegistry `0x64b9…5536`) on a local anvil fork. Nothing broadcast. PASS (re-run 2026-10-12 22:51 IST, fork block 11957700) |
| [forge-test.txt](forge-test.txt) | `forge test -vv`: 42/42 pass (fuzz, reentrancy, skim cap, NFT return, access control); re-run 2026-10-12 22:51 IST after a clean Foundry 1.8.5 reinstall. Reproduce from a fresh clone: `bash scripts/setup.sh --fork` |
| [security-review.md](security-review.md) | Review: 1 medium fixed (spoofable simulated rating), 1 medium open (openLoan slippage bounds), 2 low |
| [rating-integrity-test.txt](rating-integrity-test.txt) | Regression test for the fixed finding: 20 spoofed events ignored |
| [sdk-preview.txt](sdk-preview.txt) | peaqOS SDK on **mainnet**, read-only (throwaway key): `previewMachineActivation` Entry bond 0.4703 PEAQ, SDK machineId == our local derivation, keeper event shape passes `validateSubmitEventParams` |
| [mcr-api.txt](mcr-api.txt) | Live `GET mcr.peaq.xyz/mcr/did:peaq:<id>` for the real mainnet machine from the fork check: `mcr` Provisioned, `mcr_score` 0 |
| raw/ | Unedited agent logs (UTC timestamps), block-scanned tx list, launcher dry run |

Re-run everything: `cd contracts && forge test -vv` · `bash script/fork-escrow-check.sh <machineId>` (see contracts/README) · `cd agent && npm run agung:launch` (dry run; `-- --go` executes only the missing steps) · `npm run test:rating`
