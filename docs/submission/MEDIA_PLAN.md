# SKIM: GIF + screenshot plan

**Status:** RECAPTURED 2026-10-12 23:05 IST by story (one pass after the 22:55 freeze lift) from an isolated build of web HEAD **0cae706** (≥ fc4bd64: proof row "2 loans · 54/54 ok"; `git archive` → /tmp/storyweb, `next build` green, 217 kB). Order: live agung first, then the labelled replay. Re-run: `WEB_OUT=<out dir> LIVE=1 SKIP_STILLS=1 NO_GIF=1 LIVE_WAIT=25 python3 capture_media.py` (~70 s, live, RPC routed through python so sandbox Chromium reaches agung), then `WEB_OUT=… NO_GIF=1 PAR=5 …` (stills, ~60 s), then `WEB_OUT=… SKIP_STILLS=1 …` (GIF, ~35 s). Separate shell calls (120 s cap).
**LIVE agung (lead's #1, README hero candidate):** `stills/10-live-agung-1440.png` (2× DPR, 2880×1800: green "Live · peaq agung testnet · block 11138478 · rating simulated (no MCR on this network)", hero 0.22 / 0.22 AGNG Repaid, seal B → BBB, 0.20 · 9% · 28%, "Next line unlocked → BBB · 0.50 · 7% · 22%", KPIs "16 posted · 2 loans") + `-full.png`; `stills/11-live-agung-390.png` + `-full.png`. The mode bar is the honesty label in these frames: keep it in any crop, or caption "rating + revenue registry simulated".
**Subscan tabs (lead's #2):** captured by swarm-video in `brag-output/capture/subscan/` (not story's).
**Output (stable paths, docs embeds these):** `skim/docs/media/skim-loop.gif` (720×714, 30 s, ~280 kB, caption strip "Demo replay (simulated) · SKIM on peaq" burned in) and `skim/docs/media/stills/01…09-*.png` (2× DPR). `media/frames/` is scratch (PNG frames deleted after encoding).
**GIF method:** playwright's video recorder needs its own ffmpeg (absent), so the script takes timestamped element screenshots (~3.5 fps at 2× DPR) and encodes them with ffmpeg concat using the real frame durations: timing is true to the replay, motion is steppy but the loop's beats (a session every 2.4 s) all land.
**Replay clock:** see the table in `VIDEO_SCRIPT.md`. The replay starts at page mount, so times are approximate (±0.5 s).

## Where each asset is used
| # | Asset | Replay t | Use | Why it earns its place |
|---|---|---|---|---|
| L1 | **`stills/10-live-agung-1440.png`**: LIVE agung page, two loans done, B → BBB | live | README hero (docs), video shot 1 reference, submission cover | Proves the mechanism ran on peaq with real txs; opens on the real thing, not the replay |
| G1 | **`skim-loop.gif`**: hero instrument only, offer → escrow → 9 sessions → repaid → B, 720 px, 10 fps, ≤ 5 MB | 0 → 30 s | README top (directly under the 3-line "what/why"), Superteam gallery, X/Telegram preview later | The whole mechanism in 30 s with no reading. It answers "is there an economic mechanism?" at a glance. |
| G2 | `skim-proof.gif` (optional): terminal running `fork-escrow-check.sh`, lines appearing, PASS at the end. Record with `asciinema` + `agg`, or screen-record a terminal | n/a | README "Proof" section | Turns "verified on mainnet fork" from a claim into something visible |
| S1 | `03-hero-repaid-1440.png` (toast "Loan repaid · NFT returned to operator") | 25.6 | Submission cover / thumbnail; video thumbnail base | The payoff moment: green bar, 1.10 / 1.10 |
| S2 | `02-hero-repaying-1440.png` (0.53 / 1.10 · 48%, flow mid-pulse) | 12.6 | README "How it works" | Shows the 30/70 split while repaying |
| S3 | `04-hero-upgraded-1440.png` (toast "Provisioned → B · next line 2.00") | 28.0 | README "The loop" + gallery | The credit flywheel, the part judges remember |
| S4 | `06-revenue-feed-1440.png` (session 9 "+0.017 to vault · capped" + keeper event rows) | 25.8 | README "Verified revenue" | peaq EventRegistry is central to the mechanism, not tacked on |
| S5 | `07-terms-staircase-1440.png` | 28.5 | README terms table companion | Rating → terms in one picture |
| S6 | `08-how-it-works-1440.png` | 28.5 | Gallery | Architecture in product language |
| S7 | `09-mobile-hero-390.png` | 14.0 | Gallery (one mobile shot) | Shows polish and responsiveness |
| S8 | `05-instrument-close-2x.png` (card only) | 28.0 | Video end card, social image | A crisp, brandable crop |

## Video thumbnail (YouTube/Loom)
S1 cropped to 16:9 with the left half overlaid in big type: **"This loan repays itself."** Small "peaq · Machine Economy" tag. ImageMagick one-liner, once S1 exists:
`convert ../media/stills/03-hero-repaid-1440.png -resize 1280x720^ -gravity east -extent 1280x720 -gravity west -fill '#111' -font Inter-SemiBold -pointsize 84 -annotate +60+0 'This loan\nrepays itself.' ../media/thumbnail.png`

## Rules for every asset
- The **Simulated** mode bar or corner tag must be visible in every web still and GIF. Crops of the instrument alone (G1, S8) need a caption "Demo replay (simulated)" wherever they are placed.
- No placeholder links visible (the page hides them already).
- File names stay stable so README image paths don't break: `skim/docs/media/...`. docs owns README embeds.
- Check sizes: GIF ≤ 5 MB, PNG ≤ 1.5 MB each (`pngquant --quality 80-95` if larger).
