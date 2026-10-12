#!/usr/bin/env python3
"""Capture submission stills + GIF frames from the static web build (demo replay).

Prereqs: python playwright + chromium (sandbox: /usr/bin/chromium, used automatically; else set CHROMIUM=)
  ffmpeg (present at /usr/bin/ffmpeg)
Usage:
  cd skim/web && npm run build            # produces out/
  python3 ../docs/submission/capture_media.py
Output: skim/docs/media/{stills,frames}/ + skim/docs/media/skim-loop.gif (ffmpeg run automatically).
LIVE=1 also captures a still of the default URL (agung live data via public RPC).
Timings come from web/data/mock-state.json (see VIDEO_SCRIPT.md). Replay t=0 is page load (or the CTA click).
"""
import asyncio, functools, http.server, os, pathlib, subprocess, threading

HERE = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(os.environ['WEB_OUT']) if os.environ.get('WEB_OUT') else HERE.parent.parent / 'web' / 'out'  # WEB_OUT = isolated build (git archive) so ui's tree is untouched
MEDIA = HERE.parent / 'media'
STILLS, FRAMES = MEDIA / 'stills', MEDIA / 'frames'
PORT = int(os.environ.get('PORT', '0'))  # 0 = free port (qa may hold 8765)

# (name, viewport, replay_seconds, selector to screenshot or None for viewport, scroll target id or None)
STILL_PLAN = [
    ('01-hero-offer-1440', (1440, 900), 1.0, None, None),
    ('02-hero-repaying-1440', (1440, 900), 12.6, None, None),            # 0.53 / 1.10 · 48%
    ('03-hero-repaid-1440', (1440, 900), 25.6, None, None),              # 100%, toast 1
    ('04-hero-upgraded-1440', (1440, 900), 28.0, None, None),            # toast 2 · next line B
    ('05-instrument-close-2x', (1440, 900), 28.0, '#loan-instrument', None),
    ('06-revenue-feed-1440', (1440, 900), 25.8, None, 'revenue'),        # session 9 capped row
    ('07-terms-staircase-1440', (1440, 900), 28.5, None, 'terms'),
    ('08-how-it-works-1440', (1440, 900), 28.5, None, 'how'),
    ('09-mobile-hero-390', (390, 844), 14.0, None, None),
]


def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(OUT))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def _rpc_via_python(route):
    # lead 22:35 live_probe_proxy pattern: python urllib honours HTTPS_PROXY, headless Chromium does not
    import urllib.request
    req = route.request
    cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST'}
    if req.method == 'OPTIONS':
        return await route.fulfill(status=204, headers=cors)
    r = urllib.request.Request(req.url, data=req.post_data_buffer, headers={'content-type': 'application/json'}, method='POST')
    body = await asyncio.to_thread(lambda: urllib.request.urlopen(r, timeout=30).read())
    await route.fulfill(status=200, body=body, headers={'content-type': 'application/json', **cors})


async def main():
    from playwright.async_api import async_playwright
    STILLS.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(parents=True, exist_ok=True)
    global PORT
    srv = serve()
    PORT = srv.server_address[1]
    url = f'http://127.0.0.1:{PORT}/?demo'
    async with async_playwright() as pw:
        kw = {'args': ['--no-sandbox']}
        exe = os.environ.get('CHROMIUM') or ('/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None)
        if exe:
            kw['executable_path'] = exe
        b = await pw.chromium.launch(**kw)
        sem = asyncio.Semaphore(int(os.environ.get('PAR', '3')))  # stills run concurrently (each page has its own replay clock)

        async def still(name, w, h, t, sel, scroll):
            async with sem:
                p = await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2)
                await p.goto(url, wait_until='networkidle')
                await p.evaluate('document.fonts.ready')
                await p.wait_for_timeout(int(t * 1000))  # replay t counts from page load
                if scroll:  # scrolling does not affect the replay clock
                    await p.evaluate(f"document.getElementById('{scroll}')?.scrollIntoView({{block:'start'}})")
                    await p.wait_for_timeout(300)
                target = p.locator(sel) if sel else p
                await target.screenshot(path=str(STILLS / f'{name}.png'))
                print('still', name, flush=True)
                await p.close()

        if not os.environ.get('SKIP_STILLS'):
            only = os.environ.get('ONLY')
            await asyncio.gather(*(still(n, w, h, t, sel, sc) for n, (w, h), t, sel, sc in STILL_PLAN
                                   if not only or n[:2] in only.split(',')))
        if os.environ.get('LIVE'):
            for name, (w, h) in [('10-live-agung-1440', (1440, 900)), ('11-live-agung-390', (390, 844))]:
                p = await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2)
                await p.route(lambda u: 'onfinality' in u, _rpc_via_python)  # sandbox Chromium has no egress proxy
                await p.goto(f'http://127.0.0.1:{PORT}/', wait_until='networkidle')
                await p.wait_for_timeout(int(os.environ.get('LIVE_WAIT', '20')) * 1000)
                await p.screenshot(path=str(STILLS / f'{name}.png'))
                await p.screenshot(path=str(STILLS / f'{name}-full.png'), full_page=True)
                print('still', name)
                await p.close()
        if os.environ.get('NO_GIF'):
            await b.close(); srv.shutdown(); return

        # GIF A: timestamped element screenshots of #loan-instrument (playwright video needs its own ffmpeg,
        # absent in the sandbox), then ffmpeg concat with the real per-frame durations -> no drift.
        import time
        for f in FRAMES.glob('*.png'):
            f.unlink()
        p = await b.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
        await p.goto(url, wait_until='networkidle')
        await p.evaluate('document.fonts.ready')
        await p.click('text=Watch a loan repay itself')  # restartDemo(): replay t = 0 here
        t0 = time.monotonic()
        await p.wait_for_timeout(300)
        inst = p.locator('#loan-instrument')
        stamps, i = [], 0
        dur = float(os.environ.get('GIF_S', '30'))  # through toast 2 (27.3 s + 2 s); restart is at 34.1 s
        while time.monotonic() - t0 < dur:
            await inst.screenshot(path=str(FRAMES / f'f{i:04d}.png'), animations='allow')
            stamps.append(time.monotonic() - t0); i += 1
            await p.wait_for_timeout(60)
        await b.close()
    srv.shutdown()
    lst = FRAMES / 'frames.txt'
    with open(lst, 'w') as fh:
        for k in range(len(stamps)):
            d = (stamps[k + 1] - stamps[k]) if k + 1 < len(stamps) else 2.5  # hold last frame
            fh.write(f"file 'f{k:04d}.png'\nduration {d:.3f}\n")
        fh.write(f"file 'f{len(stamps)-1:04d}.png'\n")
    print(len(stamps), 'frames over', round(stamps[-1], 1), 's')
    # honesty rule: the crop loses the page's Simulated mode bar, so burn a caption strip into the GIF
    font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    cap = (f"pad=iw:ih+44:0:0:color=0x0d0e11,drawtext=fontfile={font}:text='Demo replay (simulated) · SKIM on peaq':"
           "fontcolor=0xb8bcc6:fontsize=17:x=(w-text_w)/2:y=h-30")
    vf = f"scale=720:-2:flags=lanczos,{cap},fps=10,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-vf', vf, str(MEDIA / 'skim-loop.gif')]
    print(' '.join(cmd)); subprocess.run(cmd, check=True)
    print('GIF', MEDIA / 'skim-loop.gif', os.path.getsize(MEDIA / 'skim-loop.gif') // 1024, 'kB (target <= 5 MB; else fps=8 or scale=640)')


if __name__ == '__main__':
    asyncio.run(main())
