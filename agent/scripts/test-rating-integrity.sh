#!/usr/bin/env bash
# Fresh anvil on :8547 -> deploy -> mock-activate -> adversarial rating test. Leaves nothing running.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:$HOME/.foundry/bin" NETWORK=local RPC_URL=http://127.0.0.1:8547
export DEPLOYER_PRIVATE_KEY= KEEPER_PRIVATE_KEY= OPERATOR_PRIVATE_KEY= CUSTOMER_PRIVATE_KEY= ACTIVATE_MODE=mock SEED_LIQUIDITY=5 TERMS_SCALE=1/1   # never use .env keys on anvil
TMPD=$(mktemp -d); trap 'kill $AP 2>/dev/null || true; rm -rf "$TMPD"' EXIT
anvil --silent --port 8547 & AP=$!; sleep 2
# isolate from the shared local deployment + keeper state
cp ../deployments/local.json "$TMPD/local.json.bak" 2>/dev/null || true
cp -r .state "$TMPD/state.bak" 2>/dev/null || true
restore() { [ -f "$TMPD/local.json.bak" ] && cp "$TMPD/local.json.bak" ../deployments/local.json; rm -rf .state; [ -d "$TMPD/state.bak" ] && cp -r "$TMPD/state.bak" .state; kill $AP 2>/dev/null || true; rm -rf "$TMPD"; }
trap restore EXIT
rm -rf .state
npx tsx scripts/deploy.ts >/dev/null
npx tsx scripts/activate.ts >/dev/null
npx tsx scripts/test-rating-integrity.ts
