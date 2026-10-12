"""Layout-shift + honesty smoke test against the static export (out/).
Needs python playwright + /usr/bin/chromium. Run after `npm run build`: python3 scripts/qa_layout.py
Checks scrollHeight/scrollWidth at 3/14/25.5/28/33.5 s (1440 + 390), ETH/PRV/USD/verified-tick absence, hatch count, placeholder links."""
import asyncio, json, subprocess, sys, time, os
from playwright.async_api import async_playwright
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','out')
SHOTS=os.environ.get('SHOTS','/tmp/skim-shots')
os.makedirs(SHOTS, exist_ok=True)
TIMES=[3,14,25.5,28,33.5]
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
  bg: getComputedStyle(document.body).backgroundColor,
 }}'''
async def run(pw, url, w, h, tag, reduced=False):
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
  ctx=await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1 if w>500 else 2, reduced_motion='reduce' if reduced else 'no-preference')
  p=await ctx.new_page()
  errs=[]; p.on('pageerror', lambda e: errs.append(str(e)))
  t0=time.time(); await p.goto(url); res=[]
  for T in TIMES:
    await asyncio.sleep(max(0, T-(time.time()-t0)))
    r=await p.evaluate(JS); r['t']=T; res.append(r)
    await p.screenshot(path=f'{SHOTS}/{tag}-{w}-{T}s.png', full_page=(T==28))
  await b.close(); return res, errs
async def main():
  srv=subprocess.Popen([sys.executable,'-m','http.server','4173','--bind','127.0.0.1'],cwd=OUT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  time.sleep(1)
  try:
    async with async_playwright() as pw:
      jobs=[run(pw,'http://127.0.0.1:4173/?demo',1440,900,'demo'),run(pw,'http://127.0.0.1:4173/?demo',390,844,'demo'),
            run(pw,'http://127.0.0.1:4173/',1440,900,'live'),run(pw,'http://127.0.0.1:4173/?demo',390,844,'reduced',True)]
      out=await asyncio.gather(*jobs)
    print(json.dumps([{'job':i,'errs':e,'res':r} for i,(r,e) in enumerate(out)],indent=1,ensure_ascii=False))
  finally: srv.terminate()
asyncio.run(main())
