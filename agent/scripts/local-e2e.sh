#!/usr/bin/env bash
# Full SKIM loop on a local anvil chain:
#   build -> deploy -> activate (mock NFT) -> demo (rating, loan, sessions until repaid, NFT back, re-rate)
#   -> second loan at the better grade, driven by the standalone keeper + simulator processes (left mid-repayment).
# Usage: bash scripts/local-e2e.sh            (FRESH=1 restarts anvil first)
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:$HOME/.foundry/bin"
export NETWORK=local
RPC=http://127.0.0.1:8545
up() { curl -s -m 2 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' $RPC >/dev/null 2>&1; }
if [ "${FRESH:-0}" = "1" ] && up; then pkill -x anvil || true; sleep 1; fi
if ! up; then
  echo "starting anvil (block time 1s)"; (setsid nohup anvil --silent --block-time 1 > /tmp/anvil.log 2>&1 &); sleep 2
fi
rm -rf .state
(cd ../contracts && forge build -q)
npx tsx scripts/build-artifacts.ts
npx tsx scripts/deploy.ts
npx tsx scripts/activate.ts
DEMO_SESSION_VALUE=${DEMO_SESSION_VALUE:-0.5} npx tsx src/demo.ts
echo "--- second loan via standalone keeper + simulator ---"
npx tsx scripts/open-loan.ts
(KEEPER_POLL=2 RATING_POLL=600 timeout 30 npx tsx src/keeper.ts > /tmp/skim-keeper.log 2>&1 &)
SESSION_VALUE=0.5 SESSION_INTERVAL=1 MAX_SESSIONS=${SECOND_LOAN_SESSIONS:-6} npx tsx src/simulator.ts
sleep 8
tail -n 8 /tmp/skim-keeper.log
npx tsx scripts/status.ts
echo "deployments/local.json + deployments/abis.json are ready for the web app"
