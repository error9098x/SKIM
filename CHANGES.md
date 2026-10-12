# Changes vs SPEC.md (builder A: contracts, agent, deployments, README)

Each item is a deliberate deviation or addition. Nothing here changes the public names the web app relies on
(`RevenueRouted`, `LoanOpened`, `Repaid`, `LoanClosed`, `Defaulted`, `RatingPosted`, `EventSubmitted`,
`quote`, `loans`, `skimBpsOf`, `isActive`, `getRating`).

## Contracts
1. **MCROracle ownership.** The spec says "owned by the keeper". Implemented as `Ownable` (deployer) plus a separate
   `keeper` address that the owner can rotate with `setKeeper`. `post` is `onlyKeeper`. Reason: a keeper key is a hot
   key on a server, so the lender/admin should be able to rotate it without redeploying. `post` also rejects
   `grade > 6` and `score > 100`.
2. **NFT return uses `transferFrom`, not `safeTransferFrom`.** If the borrower were a contract without
   `onERC721Received`, a safe transfer would revert and the final repayment could never land. The borrower is the
   NFT's previous owner, so the receiver check adds nothing. Escrow on `openLoan` still uses `safeTransferFrom`.
3. **Router never over-skims.** `skim = min(msg.value * skimBps / 10000, outstanding)`. The excess-refund path in
   `vault.repay` still exists, as specified, for direct callers. This keeps `RevenueRouted.skimmed` equal to what the
   vault actually kept. When the skim rounds to 0 (dust payments), `repay` is skipped. Zero-value payments revert.
4. **Vault receiver is strict.** `onERC721Received` only accepts the configured Machine NFT and only during
   `openLoan`. Stray NFTs revert instead of getting stuck.
5. **Re-borrowing.** A machine can open a new loan after a repaid one (it picks up its new grade's terms). It cannot
   after a default.
6. **Added to SkimVault:** `seizeCollateral(machineId, to)` (owner only, defaulted loans only, so the lender can sell
   or liquidate the escrowed machine); `setTerms`, `scaleTerms(num, den)`, `termsFor`, `allTerms`; `getLoan` (struct
   view, easier to decode than the `loans` tuple getter); `outstandingOf`, `machineWalletOf`, `availableLiquidity`;
   `totalDeposited`, `totalRepaid`, `totalOutstandingPrincipal`, `activeLoanCount`; `receive()` counts as a deposit.
   `withdrawLiquidity(to, amount)` takes an explicit recipient.
7. **MockEventRegistry.** It follows the spec's `submitEvent` signature. `EventSubmitted` indexes `machineId` and
   `sourceTxHash`, so the web app can match a router tx with one filtered `getLogs`. Additions: duplicate-source-tx
   protection (`sourceTxRecorded`), `eventCount` / `revenueEventCount` / `totalRevenue` per machine, and `getEvent`.
   Validation mirrors peaq: event type 0/1, trust 0-2, trust 1 needs a source tx, no future timestamps, metadata
   ≤ 4096 bytes.
8. **The real peaq EventRegistry 2.0 has a different ABI from the mock.** Its signature is
   `submitEvent(uint256 machineId, uint8 eventType, uint256 value, string currency, uint256 timestamp, bytes32 dataHash, uint8 trustLevel, uint256 sourceChainId, bytes32 sourceTxHash, bytes metadata)`,
   and its event is `EventSubmitted(uint256 indexed machineId, uint256 indexed eventIndex, uint8 eventType, uint256 value, string indexed currency)`,
   which has **no `sourceTxHash` in the log**. The mainnet keeper submits through the SDK, not this ABI directly. The
   ABI (taken from `@peaqos/peaq-os-sdk` 0.11.2) is exported as `PeaqEventRegistry` in `deployments/abis.json`, and as
   `abis.EventRegistry` in `deployments/mainnet.json`. On mainnet the web app should read
   `getEventCount(machineId)` + `getEventAt(machineId, i)`, which return `sourceTxHash` and `trustLevel`, to show the
   "verified" chip. This was checked against the live 2.0 registry on a mainnet fork.
9. **Toolchain.** OpenZeppelin **5.1.0** and `evm_version = paris`. OZ 5.7 uses `mcopy` (Cancun), and I did not want to
   depend on peaq's EVM fork level.

## Agent
10. **File locations.** `agent/scripts/deploy.ts`, `agent/scripts/activate.ts`, `agent/src/keeper.ts`,
    `agent/src/simulator.ts`, `agent/src/demo.ts`. Extras: `scripts/open-loan.ts`, `scripts/status.ts`,
    `scripts/build-artifacts.ts`, `scripts/sdk-smoke.ts` (read-only mainnet/agung SDK check), and
    `scripts/local-e2e.sh`.
11. **Activation order depends on the mode.** With `ACTIVATE_MODE=mock` you deploy first, then activate (it mints on
    the deployed MockMachineNFT). With `ACTIVATE_MODE=sdk` you activate first: it writes
    `deployments/<net>.machine.json`, and deploy.ts binds the vault to the real MachineRegistry from that file.
12. **agung *does* have Economics 2.0 activation.** The `agung-2026-08-28` deployment includes MachineRegistry. A
    read-only `previewMachineActivation` succeeded today with an Entry bond of 0.4 AGNG. What agung lacks is the MCR
    and a 2.0 EventRegistry. So `ACTIVATE_MODE=sdk` works on agung too and is the recommended rehearsal for mainnet.
    The default stays `mock`, as the spec says.
13. **Simulated rating formula** (agung/local only, labelled SIMULATED on-chain via `simulated = true`): fewer than 3
    trust-1 revenue events → Provisioned. Otherwise `score = min(100, 30 + 2 × events)`, with grade bands at
    40 B / 50 BB / 60 BBB / 70 A / 80 AA / 90 AAA.
14. **Deployment JSON** keeps the spec fields (`chainId, rpc, explorer, contracts{vault,router,oracle,machineNft,eventRegistry}, machineId, machineWallet, simulated, abis`)
    and adds `network, nativeSymbol, machineNftIsMock, eventRegistryIsMock, operator, keeper, deployer, mcrApi, deployBlock, deployedAt, termsScale`.
    `machineId` is a **decimal string**, because uint256 machine IDs exceed JS number precision. Keys of `abis`:
    `SkimVault, RevenueRouter, MCROracle, MachineNFT, EventRegistry`.
15. **USD value.** The keeper reports `value = round(amountWei × PEAQ_USD × 100 / 1e18)` USD cents. The price comes
    from env `PEAQ_USD`, then CoinGecko `peaq-2`, then a fallback of 0.043 (the 12 Oct 2026 price). CoinGecko's free
    API rate-limited us during testing, so set `PEAQ_USD` for the demo.
16. **Mainnet event signer = operator (DID controller), not the keeper key.** EventRegistry 2.0 requires the
    machine's owner or controller. While the NFT is escrowed the vault is the owner, but the controller is retained.
    This was verified on a mainnet fork: the controller stayed the same during escrow, and a trust-1 `submitEvent`
    from the controller succeeded while the NFT sat in SkimVault.

## Runs and docs (swarm, 2026-10-12 evening)
17. **agung run used the real activation path, not the mock.** The spec's agung default is `ACTIVATE_MODE=mock`. The
    public run used `ACTIVATE_MODE=sdk` (Economics 2.0 `activateMachine`, Entry tier, 0.4 AGNG bond), so the vault
    is bound to agung's real MachineRegistry (`machineNftIsMock: false` in `deployments/agung.json`). Events and
    ratings stay SIMULATED (MockEventRegistry, derived rating), as the spec says.
18. **agung terms scaled 1/10** (`termsScale 1/10`, starter line 0.1 AGNG) and the vault seeded with 0.5 AGNG, to fit
    a 3-AGNG testnet budget with a reserve for a re-run.
19. **README ownership.** The spec assigns README.md to builder A; it is now maintained by the docs role and is
    judge-first: a 60-second summary, a real-vs-simulated table, and a proof section citing the agung txs, the
    mainnet-fork transcript and the test run. The 3-minute demo script moved to `docs/submission/VIDEO_SCRIPT.md`
    (`docs/DEMO-SCRIPT.md` is a pointer). Publish prep lives in `docs/PUBLISH-CHECKLIST.md`.
20. **Contract dependencies are not vendored.** `contracts/lib/` (OpenZeppelin 5.1.0, forge-std) must be installed
    once with `forge install` on a fresh checkout; the README states the exact command.
21. **"Fund the vault" button renamed "Vault liquidity"** (web 1601a25). SPEC.md line 105 describes an optional
    "Fund the vault" deposit button; the app now labels it "Vault liquidity · owner-managed" because there are no LP
    shares and the owner can `withdrawLiquidity`, so it is not a lender product. How it works also answers
    "Why not bypass the router?". README wording matches (diagram node "Vault liquidity (owner-managed)").
22. **Proof files live in `docs/proof/`.** `agung.md` (+ `raw/`), `forge-test.txt` (42/42 as of cycle 3, run in place) and
    `mainnet-fork-escrow.txt` (re-run at fork block 11957700, 22:51 IST, after a sandbox reset). The README cites these; `agent/logs/` keeps the older
    fork transcript with the controller and EventRegistry 2.0 checks.
23. **Pinned one-command setup: `scripts/setup.sh`** (chain, 22:53). `contracts/lib/` is not committed; the script
    installs Foundry 1.8.5, OpenZeppelin v5.1.0 and forge-std v1.17.0 (the versions behind `docs/proof/`), then
    builds and runs the 42 tests; `--fork` adds the mainnet-fork escrow check, `--node` runs `npm ci`. It sends no
    transactions and reads no keys. README *Run it* step 0 points to it (replaces the unpinned `forge install` line).
