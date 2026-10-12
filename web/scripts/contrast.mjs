#!/usr/bin/env node
// Contrast gate: parses the token blocks in app/globals.css and fails (exit 1)
// if any text pairing drops below WCAG AA 4.5:1 or a graphic fill below 3:1.
// Runs in prebuild, so a bad token value breaks `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.resolve(here, '../app/globals.css'), 'utf8');

function block(selector) {
  const re = new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`contrast: selector ${selector} not found in globals.css`);
  const vars = {};
  for (const [, k, r, g, b] of m[2].matchAll(/--([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) vars[k] = [Number(r), Number(g), Number(b)];
  return vars;
}
const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const root = block(':root');
const scopes = {
  'light page': root,
  'light instrument': { ...root, ...block('.inst') },
  'dark page': { ...root, ...block('html.theme-dark') },
};
scopes['dark instrument'] = { ...scopes['dark page'], ...block('html.theme-dark .inst') };

const TEXT = ['ink', 'ink-2', 'ink-3', 'skim-text', 'repaid-text', 'peaq-text', 'red'];
const BG = ['paper', 'paper-2'];
let fail = 0;
const rows = [];
for (const [name, t] of Object.entries(scopes)) {
  for (const fg of TEXT) for (const bg of BG) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= 4.5;
    if (!ok) fail++;
    rows.push(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(17)} text ${fg.padEnd(12)} on ${bg.padEnd(8)} ${r.toFixed(2)}`);
  }
  // simulated label (ink-2) on the darker hatch stripe
  const s = ratio(t['ink-2'], t.hatch);
  if (s < 4.5) fail++;
  rows.push(`${s >= 4.5 ? 'ok  ' : 'FAIL'} ${name.padEnd(17)} text ink-2        on hatch    ${s.toFixed(2)}`);
  // primary button: paper text on ink fill
  const btn = ratio(t.paper, t.ink);
  if (btn < 4.5) fail++;
  rows.push(`${btn >= 4.5 ? 'ok  ' : 'FAIL'} ${name.padEnd(17)} button paper on ink       ${btn.toFixed(2)}`);
  // graphics (WCAG 1.4.11) on the base surface
  for (const g of ['skim', 'repaid', 'peaq']) {
    const r = ratio(t[g], t.paper);
    if (r < 3) fail++;
    rows.push(`${r >= 3 ? 'ok  ' : 'FAIL'} ${name.padEnd(17)} fill ${g.padEnd(12)} on paper    ${r.toFixed(2)}`);
  }
}
if (process.argv.includes('--verbose') || fail) console.log(rows.join('\n'));
if (fail) {
  console.error(`[contrast] ${fail} pairing(s) below threshold. Fix the tokens in app/globals.css.`);
  process.exit(1);
}
console.log(`[contrast] ${rows.length} pairings checked across ${Object.keys(scopes).length} scopes, all pass.`);
