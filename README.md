# Re:Rise ∴↗

A **local-first productivity tracker** for your desktop — see what you actually do all day, categorize it, and get a 0–100 productivity score.

Windows-first, with experimental Linux support. All data stays **on your machine** — no account, no cloud, no telemetry.

## What it does

- **Tracks your active window** every 3s (app, title, domain) and merges it into sessions
- **3-category model**: Productive / Neutral / Unproductive, powered by a configurable rules engine (app, domain, and title regex rules)
- **Browser domains**: pair the bundled Chrome/Brave extension and the tracker records the *site* you're on (e.g. `instagram.com`), not just "Browser"
- **Idle, lock & sleep aware**: stays idle while you're away; sessions close cleanly
- **Dashboard**: hour-grid day timeline, productivity mix, stat cards — focus time, longest focus session, context switches, streak — with the productivity score centered in the category donut, plus top apps/sites with categories, week/month trends
  - **Focus time** (Rize-inspired window model): a focus session is continuous productive work; neutral detours of up to 5 min each bridge it, while distracting activity, longer neutral runs, or an untracked gap (idle/lock/pause/sleep) end it. A session qualifies when its best rolling 15-minute window reaches ≥ 75 % productive coverage; then **all productive time in the session counts** (11:15 min exact threshold). Switching between productive apps never hurts.
  - **Longest focus session**: span of the longest qualifying session, from first productive moment to last; tolerated neutral bridges inside are included, leading/trailing neutral is excluded. `--` if nothing qualified.
  - **Context switches**: transitions between distinct consecutive apps/websites; repeated observations of the same window and same-domain navigation are not counted. Sub-label shows switches per productive hour (`--` when no productive time)
- **Sessions view**: manually re-categorize anything; one-click re-apply rules to history
- **Day digests** (Summary tab): each day is rendered as a local, deterministic write-up — headline stat cards plus short factual prose (longest qualifying focus stretch, active span, peak hour, top apps/sites, unproductive time). Today stays a live draft; days finalize at local midnight and past days (up to 30) backfill on launch. Regenerate or copy any digest.
- **Export** to CSV/JSON, full data wipe from settings
- Lives quietly in the **system tray** with pause/resume

## Tech

Electron 32 + TypeScript + React 18 + Tailwind + better-sqlite3. Pure functions (scoring, merging, focus time) are unit-tested.

## Running from source

Prerequisites: [Node.js 20+](https://nodejs.org), git, npm.

```bash
git clone https://github.com/mmoolyaa/rerise.git
cd rerise
npm install
npm run dev
```

`npm install` uses prebuilt native binaries (no Visual Studio needed).

Pair the extension: load the `extension/` folder via `chrome://extensions` → *Load unpacked*, open the extension options, paste the token + port from Re:Rise's **Settings → General** panel, Test connection.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev app with hot reload |
| `npm run dist` | Build a **Windows NSIS installer** → `release/ReRise Setup x.y.z.exe` |
| `npm run test` | Unit tests (vitest, watch mode) |
| `npx vitest run` | Unit tests, single run |
| `npm run typecheck` | TypeScript checks across main/preload/renderer |

### Building the installer (Windows)

1. Close any running instance (`Task Manager` or `taskkill /F /IM ReRise.exe`) — a locked exe fails the build.
2. `npm run dist` — output lands in `release/`.
3. First-build caveat: electron-builder downloads `winCodeSign` and can fail on its 7z self-check. If you see a `winCodeSign` cache error, extract the archive manually so `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0` exists; the 2 darwin symlink warnings are ignorable.

## Install on Windows (packaged)

Grab the latest installer from the [Releases page](https://github.com/mmoolyaa/rerise/releases), or build it yourself (above). It's a normal installer (choose install dir, desktop shortcut). The app **auto-starts after login** (toggle in Settings → General), closes to the system tray, and logs to `%APPDATA%\Tempo\data\logs\tempo.log` (data folder keeps the legacy `Tempo` name for continuity). Tray → *Quit* fully exits.

## Changing app/site categories

- **Fastest**: **Sessions** tab → click `app→rule` / `site→rule` on a row → pick a category. This creates a permanent rule and immediately re-categorizes all past + future sessions from that app/site.
- **Earlier rules**: **Settings → Rules** lists everything grouped (apps, sites, title patterns), supports editing/removal, and has **Apply rules to history** to re-match all stored sessions after rule changes.
- Higher-priority rules win; notes in the rules tab explain defaults.

## Fedora Linux (experimental)

Tracking (via `active-win`) and idle detection should work, but Linux is **untested** — expect flakiness if you find bugs. Known caveats: on Wayland, idle detection can under-report; X11 sessions work best.

```bash
# build tools for better-sqlite3's native module
sudo dnf install -y gcc-c++ make python3-devel git

# Node.js 20 (NodeSource)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# clone & run
git clone https://github.com/mmoolyaa/rerise.git
cd rerise
npm install
npm run dev
```

If Electron fails to start with a sandbox error, run `npm run dev -- --no-sandbox`.

## Privacy

- Everything is stored locally in SQLite at `%APPDATA%\Tempo\` (Windows)
- The extension talks **only** to `127.0.0.1` on your machine, over a pairing token
- Incognito tabs are never recorded; excluded apps/domains are never saved
- No network activity except to localhost

## Rules engine

Higher priority wins (first match on priority-desc sort). Defaults live in `src/main/db/migrations.ts`. Examples:

| Rule type | Pattern | Matches on |
|---|---|---|
| `domain` | `instagram.com` | Exact domain from the extension |
| `app` | `Code.exe` | Loose app-name match (with/without `.exe`) |
| `title_regex` | `vscode` | Window title (case-insensitive regex) |

Categories are weighted: Productive = +2, Neutral = 0, Unproductive = −2 → time-weighted average mapped to 0–100.

## Roadmap

- [x] Windows MVP (tracker, dashboard, extension, export, installer)
- [x] 3-category consolidation + Rize-style UI
- [x] Day digests (local template summarizer) — pluggable engine for an LLM upgrade later
- [ ] Proper Linux/macOS support
- [ ] Weekly goals & timelines like Rize
