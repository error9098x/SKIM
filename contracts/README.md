# SKIM contracts (Foundry)

| Contract | Role |
|---|---|
| `MCROracle` | Keeper-posted mirror of the machine's Machine Credit Rating (`score`, `grade` 0=Provisioned..6=AAA, `simulated`). |
| `SkimVault` | Lender liquidity, grade → terms table, NFT escrow, loan lifecycle (`openLoan`, `repay`, `markDefault`, `seizeCollateral`). |
| `RevenueRouter` | Payment endpoint. Skims `skimBps` of each payment into `vault.repay`, forwards the rest to the machine wallet. |
| `MockMachineNFT` | Open-mint ERC-721 stand-in for peaq's MachineRegistry (testnet/tests only). |
| `MockEventRegistry` | peaq EventRegistry-shaped event sink for networks without Economics 2.0 events (agung/local). |

## Fresh clone → green tests (reproducible)

`contracts/lib/` is **not** in git. One command from the repo root installs pinned Foundry + deps, builds, and runs the tests
(sends no transactions, reads no keys):

```bash
bash scripts/setup.sh            # Foundry 1.8.5 + OZ v5.1.0 + forge-std v1.17.0 → forge build → forge test (expects 42 passed)
bash scripts/setup.sh --fork     # + real MachineRegistry NFT escrow check on a local fork of peaq mainnet
bash scripts/setup.sh --all      # + npm ci in agent/ and web/ (Node >= 22)
```

The same thing by hand (exact commands the script runs; verified on an empty copy 2026-10-12 22:53 IST):

```bash
curl -sSL https://foundry.paradigm.xyz | bash && ~/.foundry/bin/foundryup --install v1.8.5
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts
forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.1.0 foundry-rs/forge-std@v1.17.0
forge build
forge test -vv            # 42 tests: open loan, skim math (+fuzz), partial/excess repay, close returns NFT,
                          # default after due, seize, no-loan forwarding, reentrancy, access control, registry
# Real MachineRegistry NFT escrow check on a local fork of peaq mainnet (broadcasts nothing to peaq):
anvil --fork-url https://quicknode1.peaq.xyz --port 8546 --hardfork london --no-storage-caching &   # stale fork cache can hide code
bash script/fork-escrow-check.sh 72561575582965553683137700019813286209432074009315708090931442830464877630283   # or any activated machine id
```

Expected output: [`docs/proof/forge-test.txt`](../docs/proof/forge-test.txt) (42/42) and
[`docs/proof/mainnet-fork-escrow.txt`](../docs/proof/mainnet-fork-escrow.txt) (`PASS: real Machine NFT escrowed and returned`).

Compiled with solc 0.8.24 (forge downloads it), `evm_version = paris`, OpenZeppelin **5.1.0** (newer OZ such as 5.7 needs `mcopy`/Cancun; this build targets paris).
