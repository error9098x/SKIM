#!/usr/bin/env bash
# Proves SkimVault can escrow and return a REAL peaq Economics 2.0 Machine NFT (MachineRegistry),
# on a local anvil fork of peaq mainnet. Nothing is broadcast to peaq.
#   anvil --fork-url https://quicknode1.peaq.xyz --port 8546 --hardfork london --no-storage-caching &
#   bash script/fork-escrow-check.sh <machineId>
set -euo pipefail
R=${FORK_RPC:-http://127.0.0.1:8546}
REG=${REGISTRY:-0x64b93Cc29b251fAFa83BD110cDB1C24207f85536}
ID=$1
K=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   # anvil dev key (fork only)
D=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
WALLET=0x000000000000000000000000000000000000bEEF
cast rpc --rpc-url $R anvil_setBalance $D 0x56BC75E2D63100000 >/dev/null
OWNER=$(cast call --rpc-url $R $REG 'ownerOf(uint256)(address)' $ID)
echo "machine $ID owner $OWNER"
dep() { forge create --rpc-url $R --private-key $K --broadcast "$@" 2>/dev/null | awk '/Deployed to/{print $3}'; }
ORACLE=$(dep src/MCROracle.sol:MCROracle --constructor-args $D)
VAULT=$(dep src/SkimVault.sol:SkimVault --constructor-args $REG $ORACLE)
ROUTER=$(dep src/RevenueRouter.sol:RevenueRouter --constructor-args $VAULT)
echo "oracle $ORACLE vault $VAULT router $ROUTER"
cast send -q --rpc-url $R --private-key $K $VAULT 'scaleTerms(uint256,uint256)' 1 100
cast send -q --rpc-url $R --private-key $K $VAULT 'deposit()' --value 1ether
cast rpc --rpc-url $R anvil_impersonateAccount $OWNER >/dev/null
cast rpc --rpc-url $R anvil_setBalance $OWNER 0x56BC75E2D63100000 >/dev/null
cast send -q --rpc-url $R --unlocked --from $OWNER $REG 'approve(address,uint256)' $VAULT $ID
cast send -q --rpc-url $R --unlocked --from $OWNER $VAULT 'openLoan(uint256,address,uint64)' $ID $WALLET 86400
echo "after openLoan: NFT owner = $(cast call --rpc-url $R $REG 'ownerOf(uint256)(address)' $ID)  (vault $VAULT)"
echo "machine wallet balance = $(cast balance --rpc-url $R $WALLET --ether)"
cast send -q --rpc-url $R --private-key $K $ROUTER 'pay(uint256,address,bytes32)' $ID $WALLET $(cast keccak fork-session) --value 0.1ether
echo "loan status (2=repaid): $(cast call --rpc-url $R $VAULT 'isActive(uint256)(bool)' $ID | sed 's/false/closed/;s/true/ACTIVE/')"
NEW=$(cast call --rpc-url $R $REG 'ownerOf(uint256)(address)' $ID)
echo "after payoff: NFT owner = $NEW"
[ "${NEW,,}" = "${OWNER,,}" ] && echo "PASS: real Machine NFT escrowed and returned" || { echo FAIL; exit 1; }
