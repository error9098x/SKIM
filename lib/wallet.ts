'use client';
import { createWalletClient, custom, defineChain, numberToHex, parseEther, type EIP1193Provider } from 'viem';
import { vaultAbi } from './abis';
import type { Address, Hex, NetworkInfo } from './types';

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export const hasInjected = () => typeof window !== 'undefined' && !!window.ethereum;

export async function depositToVault(net: NetworkInfo, vault: Address, amount: string): Promise<Hex> {
  const eth = window.ethereum;
  if (!eth) throw new Error('No injected wallet found. Install MetaMask or a peaq-compatible wallet.');
  const chain = defineChain({
    id: net.chainId,
    name: net.name,
    nativeCurrency: { name: net.token, symbol: net.token, decimals: 18 },
    rpcUrls: { default: { http: [net.rpc] } },
    blockExplorers: net.explorer ? { default: { name: 'Subscan', url: net.explorer } } : undefined,
  });
  const [account] = (await eth.request({ method: 'eth_requestAccounts' })) as Address[];
  const current = (await eth.request({ method: 'eth_chainId' })) as string;
  if (parseInt(current, 16) !== net.chainId) {
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: numberToHex(net.chainId) }] });
    } catch {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: numberToHex(net.chainId),
            chainName: net.name,
            nativeCurrency: { name: net.token, symbol: net.token, decimals: 18 },
            rpcUrls: [net.rpc],
            blockExplorerUrls: net.explorer ? [net.explorer] : [],
          },
        ],
      });
    }
  }
  const wallet = createWalletClient({ account, chain, transport: custom(eth) });
  return wallet.writeContract({ address: vault, abi: vaultAbi, functionName: 'deposit', value: parseEther(amount) });
}
