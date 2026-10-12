'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveReader } from './live';
import { LOOP_MS, mockStateAt } from './mock';
import { POLL_MS } from './config';
import type { Deployment, SkimState } from './types';

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export interface SkimHook {
  state: SkimState;
  liveAvailable: boolean;
  liveError?: string;
  restartDemo: () => void;
  deployment: Deployment | null;
}

export function useSkim(): SkimHook {
  const startRef = useRef<number>(Date.now());
  const [state, setState] = useState<SkimState>(() => mockStateAt(0, Math.floor(Date.now() / 1000)));
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [liveError, setLiveError] = useState<string | undefined>();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const liveOk = useRef(false);

  const restartDemo = useCallback(() => {
    startRef.current = Date.now();
  }, []);

  // Live mode
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.has('demo')) return;
      const index = await getJson<{ networks: string[]; abis: boolean; preferred: string | null }>('/deployments/index.json');
      if (!index || !index.networks.length) return;
      const want = params.get('network') || process.env.NEXT_PUBLIC_NETWORK || index.preferred || '';
      const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const usable = index.networks.filter((n) => n !== 'local' || want === 'local' || isLocalHost);
      if (!usable.length) return;
      const key = usable.includes(want) ? want : usable.includes('mainnet') && !want ? 'mainnet' : usable.includes('agung') ? 'agung' : usable[0];
      const dep = await getJson<Deployment>(`/deployments/${key}.json`);
      if (!dep || !dep.contracts || !dep.machineId) return;
      const abis = index.abis ? await getJson<unknown>('/deployments/abis.json') : null;
      setDeployment(dep);
      setLiveAvailable(true);
      const reader = new LiveReader(key, dep, abis ?? undefined);
      const tick = async () => {
        try {
          const s = await reader.poll();
          if (stop) return;
          liveOk.current = true;
          setLiveError(undefined);
          setState(s);
        } catch (e) {
          if (stop) return;
          setLiveError((e as Error).message?.split('\n')[0] ?? 'RPC error');
        }
        if (!stop) timer = setTimeout(tick, POLL_MS);
      };
      tick();
    })();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Demo replay (runs until live data has arrived)
  useEffect(() => {
    const id = setInterval(() => {
      if (liveOk.current) return;
      const elapsed = Date.now() - startRef.current;
      if (elapsed > LOOP_MS) startRef.current = Date.now();
      setState(mockStateAt(Math.min(elapsed, LOOP_MS), Math.floor(startRef.current / 1000)));
    }, 200);
    return () => clearInterval(id);
  }, []);

  return { state, liveAvailable, liveError, restartDemo, deployment };
}
