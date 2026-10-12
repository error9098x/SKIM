#!/usr/bin/env node
// Copies ../deployments/<network>.json (+ abis.json) into public/deployments/
// and writes public/deployments/index.json listing what is available.
// On mainnet it also snapshots the MCR JSON (the MCR API sends no CORS header,
// so the browser falls back to this snapshot / the Vercel rewrite).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..');
const src = path.resolve(web, process.env.DEPLOYMENTS_DIR || '../deployments');
const dst = path.join(web, 'public', 'deployments');
fs.mkdirSync(dst, { recursive: true });

// clear stale copies
for (const f of fs.readdirSync(dst)) if (f.endsWith('.json')) fs.rmSync(path.join(dst, f));

const available = [];
let abis = false;
if (fs.existsSync(src)) {
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith('.json')) continue;
    const full = path.join(src, f);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      console.warn(`[sync] skipping ${f}: invalid JSON (${e.message})`);
      continue;
    }
    fs.copyFileSync(full, path.join(dst, f));
    if (f === 'abis.json') abis = true;
    else if (parsed && parsed.contracts) available.push(f.replace(/\.json$/, ''));
  }
}

// Proof row test count: read from the captured forge run, never hardcoded (QA-6).
// Falls back to the committed data/forge-tests.json when docs/ is absent (e.g. web-only checkout).
{
  const forgeTxt = path.resolve(web, process.env.FORGE_PROOF || '../docs/proof/forge-test.txt');
  const out = path.join(web, 'data', 'forge-tests.json');
  if (fs.existsSync(forgeTxt)) {
    const t = fs.readFileSync(forgeTxt, 'utf8');
    const m = [...t.matchAll(/(\d+) tests passed, (\d+) failed, (\d+) skipped \((\d+) total tests\)/g)].pop();
    if (m) {
      const rec = { passed: Number(m[1]), failed: Number(m[2]), total: Number(m[4]), source: 'skim/docs/proof/forge-test.txt' };
      const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
      const next = JSON.stringify(rec, null, 2) + '\n';
      if (prev !== next) fs.writeFileSync(out, next);
      console.log(`[sync] forge ${rec.passed}/${rec.total} (from ${path.relative(web, forgeTxt)})`);
    } else console.warn('[sync] forge-test.txt has no summary line; keeping data/forge-tests.json');
  }
}

const preferred = process.env.NEXT_PUBLIC_NETWORK || null;
fs.writeFileSync(
  path.join(dst, 'index.json'),
  JSON.stringify({ networks: available, abis, preferred, syncedAt: new Date().toISOString() }, null, 2),
);

// Optional MCR snapshot for mainnet deployments
const mainnet = available.includes('mainnet') ? JSON.parse(fs.readFileSync(path.join(dst, 'mainnet.json'), 'utf8')) : null;
if (mainnet?.machineId) {
  try {
    const r = await fetch(`https://mcr.peaq.xyz/mcr/did:peaq:${mainnet.machineId}`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      fs.writeFileSync(path.join(dst, 'mcr-snapshot.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), data: await r.json() }, null, 2));
      console.log('[sync] MCR snapshot written');
    }
  } catch (e) {
    console.warn('[sync] MCR snapshot failed:', e.message);
  }
}

console.log(
  available.length
    ? `[sync] deployments: ${available.join(', ')}${abis ? ' (+ abis.json)' : ''}`
    : `[sync] no deployments found in ${src}; the app will run on bundled mock-state.json (SIMULATED)`,
);
