import { parseEther } from 'viem';
import type { NetworkInfo, Terms } from './types';

export const GRADES = ['Provisioned', 'B', 'BB', 'BBB', 'A', 'AA', 'AAA'] as const;
export const gradeName = (g: number | undefined) => (g === undefined ? '—' : GRADES[g] ?? `#${g}`);
export const gradeShort = (g: number | undefined) => (g === 0 ? 'PRV' : gradeName(g));

/** Terms curve exactly as in SPEC.md (principal in PEAQ). */
export const SPEC_TERMS: Terms[] = [
  { grade: 0, principal: parseEther('1'), feeBps: 1000, skimBps: 3000 },
  { grade: 1, principal: parseEther('2'), feeBps: 900, skimBps: 2800 },
  { grade: 2, principal: parseEther('3'), feeBps: 800, skimBps: 2500 },
  { grade: 3, principal: parseEther('5'), feeBps: 700, skimBps: 2200 },
  { grade: 4, principal: parseEther('8'), feeBps: 600, skimBps: 2000 },
  { grade: 5, principal: parseEther('12'), feeBps: 500, skimBps: 1800 },
  { grade: 6, principal: parseEther('20'), feeBps: 400, skimBps: 1500 },
];

export const NETWORKS: Record<string, NetworkInfo> = {
  agung: {
    key: 'agung',
    name: 'peaq agung testnet',
    chainId: 9990,
    rpc: 'https://peaq-agung.api.onfinality.io/public',
    explorer: 'https://agung-testnet.subscan.io',
    token: 'AGNG',
    isMainnet: false,
  },
  mainnet: {
    key: 'mainnet',
    name: 'peaq mainnet',
    chainId: 3338,
    rpc: 'https://quicknode1.peaq.xyz',
    explorer: 'https://peaq.subscan.io',
    token: 'PEAQ',
    isMainnet: true,
  },
  local: {
    key: 'local',
    name: 'local anvil',
    chainId: 31337,
    rpc: 'http://127.0.0.1:8545',
    explorer: '',
    token: 'ETH',
    isMainnet: false,
  },
};

export const DEMO_NETWORK: NetworkInfo = { ...NETWORKS.agung, key: 'demo', name: 'Demo replay' };

export const EVENT_REGISTRY_MAINNET = '0xA1e7F1d7B24dAb55Dc92491e6d9B89F6E925Ad1e';
export const MCR_API = 'https://mcr.peaq.xyz';
export const machineExplorerUrl = (id: string) => `https://machines.peaq.xyz/machine/${id}`;

export const LINKS = {
  github: process.env.NEXT_PUBLIC_GITHUB_URL || '#github',
  readme: process.env.NEXT_PUBLIC_README_URL || '#readme',
  video: process.env.NEXT_PUBLIC_VIDEO_URL || '#video',
};

export const POLL_MS = 5000;
export const MCR_POLL_MS = 30000;
