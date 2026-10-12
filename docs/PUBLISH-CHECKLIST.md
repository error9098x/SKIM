# SKIM: GitHub + Vercel publish checklist (local prep only)

Written by docs, 2026-10-12 ~23:10 IST. **Nothing here has been published.** Publishing needs the user's approval
and their own GitHub/Vercel accounts. Tick items as they are done.

## 1. Repo shape (decide before the first push)
State found today:
- `skim/` itself is **not** a git repo.
- `skim/web/` **is** a git repo with the UI history (commits `72cc9ee` … `2bb82fe`).
- `skim/contracts/` has an empty `.git` (no commits) and **no `lib/`** (OpenZeppelin + forge-std not vendored), so a
  fresh clone cannot `forge build` until deps are installed.

Recommended (simplest for judges: one repo, one URL):
- [ ] Back up: `tar czf ~/skim-web-git-backup.tgz -C skim/web .git`
- [ ] `rm -rf skim/contracts/.git` (empty) and either drop `skim/web/.git` (history kept in the tarball) or import it
      with `git subtree add` into a new root repo. Lead decides.
- [ ] `cd skim && git init && git add . && git status` and review every path (see §2) before the first commit.
- [ ] Contracts deps: `contracts/lib/` is NOT committed (lead's staging script `swarm/publish/build-staging.sh` excludes it;
      `scripts/` is included). Cloners run `bash scripts/setup.sh` (chain, 22:53: pinned Foundry 1.8.5, OZ v5.1.0,
      forge-std v1.17.0; verified on an empty copy → 42/42 + fork PASS). README §Run it step 0 says exactly this.
      Manual fallback (pinned, no drift): `cd contracts && forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.1.0 foundry-rs/forge-std@v1.17.0`.

## 2. Secrets audit (done 22:50 IST)
- `agent/.env` holds the real agung hot key. It is ignored by `skim/.gitignore` (`.env`, `.env.*`, `**/.env`,
  `!.env.example`). ✅
- `web/.gitignore` had **no** `.env` rule (web is its own repo, so the root rule did not apply). Fixed in web commit
  `2bb82fe`. ✅
- `agent/.state/` (keeper cursors) is ignored. ✅ `contracts/out|cache|broadcast` ignored. ✅
- 64-hex strings elsewhere are tx hashes, machine IDs or the **public anvil dev keys** in `agent/src/lib.ts` and
  `contracts/script/fork-escrow-check.sh` (fork/local only). ✅
- `*.bak-*` backups are now ignored at the root. ✅
- [ ] Pre-push gate, run in the new root repo; both must print nothing:
  ```bash
  git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'
  git grep -nE '0x[0-9a-fA-F]{64}' -- ':!*.json' ':!*.log' ':!*.txt' ':!*.md' | grep -viE 'ac0974be|59c6995e|5de4111a|7c852118|keccak|hash|tx'
  ```
- [ ] Never reuse the agung key on mainnet. Mainnet keys go only in a local `.env`.

## 3. Vercel (static export)
- `web/vercel.json`: build `npm run build`, output `out`, rewrite `/mcr-proxy/*` → `https://mcr.peaq.xyz/*`
  (the MCR API sends no CORS header). ✅
- [ ] Project **Root Directory = `skim/web`** (or `web` if the repo root is `skim/`). Keep "Include files outside
      the root directory" **on**: `prebuild` runs `scripts/sync.mjs`, which reads `../deployments/*.json`.
- [ ] `deployments/agung.json` (+ `agung.machine.json`, `abis.json`) committed, so the deployed app has live agung
      data. `local.json` is harmless: the app ignores `local` off localhost.
- [ ] Env vars (all public, build-time):
  | Var | Value |
  |---|---|
  | `NEXT_PUBLIC_NETWORK` | `agung` (open on the real agung deployment; demo replay stays the fallback and `?demo` forces it) |
  | `NEXT_PUBLIC_GITHUB_URL` | repo URL |
  | `NEXT_PUBLIC_VIDEO_URL` | demo video URL |
  | `NEXT_PUBLIC_README_URL` | README URL on GitHub |
  | `NEXT_PUBLIC_RPC` | optional; default `https://peaq-agung.api.onfinality.io/public` |
- [ ] `prebuild` also runs `scripts/contrast.mjs` (fails the build if AA contrast regresses). Node only, works on Vercel.
- [ ] After deploy: open `/` and `/?demo`, check the hero, subscan links, AGNG units, no "Chain unreachable"
      (public RPC `getLogs` range limits are the likely failure).

## 4. Links to fill after publishing
- [ ] README top line + repo map: replace "pending publish" with GitHub, video and live-app URLs.
- [ ] `docs/submission/SUBMISSION.md` link placeholders.
- [ ] Vercel env vars above, then redeploy.

## 5. Not for the public repo
- `../swarm/`, `../ui-libs/`, `../qa/` live outside `skim/` and stay local.
- `web/screenshots/` are pre-redesign and stale; delete or replace with fresh captures before publishing.
