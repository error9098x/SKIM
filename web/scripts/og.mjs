// Renders scripts/og.html to public/og.png with headless Chrome (macOS path; override with CHROME=...).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
execFileSync(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1200,630',
  `--screenshot=${path.join(here, '..', 'public', 'og.png')}`,
  `file://${path.join(here, 'og.html')}`,
], { stdio: 'inherit' });
