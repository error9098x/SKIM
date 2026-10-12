#!/usr/bin/env bash
# SKIM — reproducible setup for a fresh clone (or a sandbox that lost ~/.foundry).
# Read-only with respect to any chain: sends NO transactions, reads NO private keys, never touches .env.
#
#   bash scripts/setup.sh            # Foundry 1.8.5 + Solidity deps (pinned) + forge build + forge test (42 tests)
#   bash scripts/setup.sh --fork     # ...plus the peaq MAINNET-FORK escrow check (local anvil fork, nothing broadcast)
#   bash scripts/setup.sh --node     # ...plus `npm ci` for agent/ and web/ (Node >= 22)
#   bash scripts/setup.sh --all      # all of the above
#
# Pinned versions (the ones the proof transcripts in docs/proof/ were produced with):
#   Foundry 1.8.5 · solc 0.8.24 (evm paris, auto-downloaded by forge) · OpenZeppelin v5.1.0 · forge-std v1.17.0
set -euo pipefail

FOUNDRY_VERSION=${FOUNDRY_VERSION:-v1.8.5}
OZ_TAG=v5.1.0
FORGE_STD_TAG=v1.17.0
FORK_RPC_UPSTREAM=${FORK_RPC_UPSTREAM:-https://quicknode1.peaq.xyz}
FORK_PORT=${FORK_PORT:-8546}
# A real, activated peaq-mainnet Machine NFT (MachineRegistry 0x64b9…5536). Any activated machine id works.
FORK_MACHINE_ID=${FORK_MACHINE_ID:-72561575582965553683137700019813286209432074009315708090931442830464877630283}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DO_FORK=0; DO_NODE=0
for a in "$@"; do
  case "$a" in
    --fork) DO_FORK=1 ;;
    --node) DO_NODE=1 ;;
    --all)  DO_FORK=1; DO_NODE=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done
say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# 1. Foundry --------------------------------------------------------------------------------
export PATH="$HOME/.foundry/bin:$PATH"
if ! command -v forge >/dev/null 2>&1 || ! forge --version | grep -q "${FOUNDRY_VERSION#v}"; then
  say "Installing Foundry $FOUNDRY_VERSION"
  command -v foundryup >/dev/null 2>&1 || curl -sSL https://foundry.paradigm.xyz | bash
  foundryup --install "$FOUNDRY_VERSION"
fi
forge --version | head -1

# 2. Solidity dependencies (contracts/lib is not vendored in git) ---------------------------
cd "$ROOT/contracts"
if [ ! -f lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol ]; then
  say "Installing OpenZeppelin $OZ_TAG into contracts/lib"
  rm -rf lib/openzeppelin-contracts
  forge install --no-git "OpenZeppelin/openzeppelin-contracts@$OZ_TAG"
fi
if [ ! -f lib/forge-std/src/Test.sol ]; then
  say "Installing forge-std $FORGE_STD_TAG into contracts/lib"
  rm -rf lib/forge-std
  forge install --no-git "foundry-rs/forge-std@$FORGE_STD_TAG"
fi
grep -q '"version": "5.1.0"' lib/openzeppelin-contracts/package.json \
  || { echo "contracts/lib/openzeppelin-contracts is not 5.1.0 (5.2+ needs Cancun/mcopy; peaq target is paris)" >&2; exit 1; }

# 3. Build + test ---------------------------------------------------------------------------
say "forge build && forge test"
forge build
forge test -vv | tee /tmp/skim-forge-test.txt | tail -3
grep -q "42 passed; 0 failed" /tmp/skim-forge-test.txt || { echo "expected 42 passing tests" >&2; exit 1; }

# 4. Optional: peaq mainnet-fork escrow check -----------------------------------------------
if [ "$DO_FORK" = 1 ]; then
  say "Mainnet-fork escrow check (anvil fork of $FORK_RPC_UPSTREAM on :$FORK_PORT; nothing broadcast to peaq)"
  # --no-storage-caching: a stale fork cache can show MachineRegistry with no code.
  anvil --fork-url "$FORK_RPC_UPSTREAM" --port "$FORK_PORT" --hardfork london --no-storage-caching \
    > /tmp/skim-anvil-fork.log 2>&1 &
  ANVIL_PID=$!
  trap 'kill $ANVIL_PID 2>/dev/null || true' EXIT
  for _ in $(seq 1 60); do cast chain-id --rpc-url "http://127.0.0.1:$FORK_PORT" >/dev/null 2>&1 && break; sleep 1; done
  echo "fork: chain $(cast chain-id --rpc-url http://127.0.0.1:$FORK_PORT) block $(cast block-number --rpc-url http://127.0.0.1:$FORK_PORT)"
  FORK_RPC="http://127.0.0.1:$FORK_PORT" bash script/fork-escrow-check.sh "$FORK_MACHINE_ID"
fi

# 5. Optional: Node deps --------------------------------------------------------------------
if [ "$DO_NODE" = 1 ]; then
  node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' \
    || { echo "Node >= 22 required (found $(node -v))" >&2; exit 1; }
  say "npm ci (agent, web)"
  (cd "$ROOT/agent" && npm ci)
  (cd "$ROOT/web" && npm ci)
fi

say "Done. Next: cd web && npm run dev   (http://localhost:3000, ?demo = labelled replay)"
echo "     or:  cd agent && npm run local:e2e   (full loop on a local anvil chain, no funds)"
