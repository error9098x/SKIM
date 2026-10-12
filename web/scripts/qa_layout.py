"""Layout-shift + honesty smoke test against the static export (out/).
Needs python playwright + /usr/bin/chromium. Run after `npm run build`: python3 scripts/qa_layout.py
Checks scrollHeight/scrollWidth at 3/14/25.5/28/33.5 s (1440 + 390), ETH/PRV/USD/verified-tick absence, hatch count, placeholder links."""
import asyncio, json, subprocess, sys, time, os
from playwright.async_api import async_playwright
OUT=os.environ.get('QA_OUT') or os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','out')
SHOTS=os.environ.get('SHOTS','/tmp/skim-shots'); PREFIX=os.environ.get('PREFIX','')
os.makedirs(SHOTS, exist_ok=True)
TIMES=[3,14,25.5,28,30,33.5]  # 30 s added in phase 2: the upgrade beat lands ~28.5 s after goto (≈1.2 s hydration lag)
JS='''() => {
 const t=document.body.innerText;
 const vis=[...document.querySelectorAll('.sim-hatch,.sim-hatch-paper')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});
 const inst=document.getElementById('loan-instrument');
 return {sh:document.documentElement.scrollHeight, sw:document.documentElement.scrollWidth, eth:/\\bETH\\b/.test(t), prv:/\\bPRV\\b/.test(t), usd:/\\$\\d/.test(t),
  verifiedTick:t.includes('✓ verified'), hatches:vis.length, hatchClasses:vis.map(e=>e.className.split(' ')[0]+':'+e.textContent.slice(0,30)),
  placeholder:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>h==='#'||/^#(github|readme|video)/.test(h)),
  inst: inst? inst.innerText.replace(/\\n+/g,' | '):null,
  loanStatus: document.querySelector('.card .h-10')?.innerText,
  modebar: document.querySelector('[role=status]')?.innerText,
  modebarH: document.querySelector('[role=status]')?.getBoundingClientRect().height,
  instTop: inst?.getBoundingClientRect().bottom,
  font: getComputedStyle(document.body).fontFamily,
  flowBottom: document.getElementById('hero-flow')?.getBoundingClientRect().bottom,
  numBottom: document.getElementById('hero-number')?.getBoundingClientRect().bottom,
  numFont: (()=>{const e=document.querySelector('#hero-number span');return e?getComputedStyle(e).fontSize:null})(),
  flowLabelMin: Math.min(...[...document.querySelectorAll('#hero-flow div')].filter(e=>e.offsetParent&&e.children.length===0&&e.textContent.trim()).map(e=>parseFloat(getComputedStyle(e).fontSize))),
  flowTitleMin: Math.min(...[...document.querySelectorAll('#hero-flow [class*="text-[14px]"]')].filter(e=>e.offsetParent).map(e=>parseFloat(getComputedStyle(e).fontSize))),
  toast: document.querySelector('[aria-live=polite]')?.innerText||'',
  marker: (t.match(/You are here: (\\S+)/)||[])[1],
  barPct: document.querySelector('#loan-instrument [role=progressbar]')?.getAttribute('aria-valuenow'),
  segSum: [...document.querySelectorAll('#loan-instrument [role=progressbar] > span')].reduce((a,e)=>a+parseFloat(e.style.width||0),0),
  segN: document.querySelectorAll('#loan-instrument [role=progressbar] > span').length,
  kpi: [...document.querySelectorAll('#revenue ~ div .label')].slice(0,4).map(e=>e.parentElement.innerText.replace(/\\n/g,' ')),
  bg: getComputedStyle(document.body).backgroundColor,
 }}'''
def _proxy():
  # Sandbox egress goes through HTTPS_PROXY; python/curl honour it, Chromium does not unless told.
  # Without it the live job shows 'Chain unreachable' (test artefact, QA-5).
  raw=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
  if not raw: return None
  from urllib.parse import urlparse
  u=urlparse(raw)
  return {'server':f'http://{u.hostname}:{u.port}','username':u.username or '','password':u.password or '','bypass':'127.0.0.1,localhost'}
async def run(pw, url, w, h, tag, reduced=False):
  kw={'proxy':_proxy()} if _proxy() else {}
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'], **kw)
  ctx=await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1 if w>500 else 2, reduced_motion='reduce' if reduced else 'no-preference')
  p=await ctx.new_page()
  errs=[]; p.on('pageerror', lambda e: errs.append(str(e)))
  t0=time.time(); await p.goto(url); res=[]
  for T in TIMES:
    await asyncio.sleep(max(0, T-(time.time()-t0)))
    r=await p.evaluate(JS); r['t']=T; res.append(r)
    await p.screenshot(path=f'{SHOTS}/{PREFIX}{tag}-{w}-{T}s.png', full_page=(T==28))
  await b.close(); return res, errs
async def main():
  srv=subprocess.Popen([sys.executable,'-m','http.server','4173','--bind','127.0.0.1'],cwd=OUT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  time.sleep(1)
  try:
    async with async_playwright() as pw:
      jobs=[run(pw,'http://127.0.0.1:4173/?demo',1440,900,'demo'),run(pw,'http://127.0.0.1:4173/?demo',390,844,'demo'),
            run(pw,'http://127.0.0.1:4173/',1440,900,'live'),run(pw,'http://127.0.0.1:4173/',390,844,'live'),
            run(pw,'http://127.0.0.1:4173/?demo',390,844,'reduced',True)]
      out=await asyncio.gather(*jobs)
    print(json.dumps([{'job':i,'errs':e,'res':r} for i,(r,e) in enumerate(out)],indent=1,ensure_ascii=False))
    # Cross-mode invariant (JUDGE-C2-4): page height must be equal demo vs live at each width, and constant over time.
    H=lambda j:{r.get('sh') or r.get('scrollHeight') for r in out[j][0]}
    pairs={'1440':(0,2),'390':(1,3)}; ok=True
    for wd,(d,l) in pairs.items():
      hd,hl=H(d),H(l); good=len(hd)==1 and hd==hl; ok&=good
      print(f'HEIGHT {wd}: demo={sorted(hd)} live={sorted(hl)} -> {"OK" if good else "FAIL"}')
    if any('unreachable' in str(r) for r in out[2][0]+out[3][0]): print('WARN live job saw "unreachable" (proxy missing?)')
    sys.exit(0 if ok else 1)
  finally: srv.terminate()
asyncio.run(main())
