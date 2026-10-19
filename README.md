# Tempo ⏱️

A **local-first productivity tracker** for your desktop — see what you actually do all day, categorize it, and get a 0–100 productivity score.

Windows-first, with experimental Linux support. All data stays **on your machine** — no account, no cloud, no telemetry.

## What it does

- **Tracks your active window** every 3s (app, title, domain) and merges it into sessions
- **3-category model**: Productive / Neutral / Unproductive, powered by a configurable rules engine (app, domain, and title regex rules)
- **Browser domains**: pair the bundled Chrome/Brave extension and the tracker records the *site* you're on (e.g. `instagram.com`), not just "Browser"
- **Idle, lock & sleep aware**: stays idle while you're away; sessions close cleanly
- **Dashboard**: hour-grid day timeline, productivity mix, focus time (25min+ productive streaks), score circle, top apps/sites with categories, week/month trends
- **Sessions view**: manually re-categorize anything; one-click re-apply rules to history
- **Export** to CSV/JSON, full data wipe from settings
- Lives quietly in the **system tray** with pause/resume

## Tech

Electron 32 + TypeScript + React 18 + Tailwind + better-sqlite3. Pure functions (scoring, merging, focus time) are unit-tested.

## Running from source

Prerequisites: [Node.js 20+](https://nodejs.org), git, npm.

```bash
git clone https://github.com/mmoolyaa/tempo-time-tracker.git
cd tempo-time-tracker
npm install
npm run dev
```

`npm install` uses prebuilt native binaries (no Visual Studio needed).

Pair the extension: load the `extension/` folder via `chrome://extensions` → *Load unpacked*, open the extension options, paste the token + port from Tempo's **Settings → General** panel, Test connection.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev app with hot reload |
| `npm run dist` | Build a **Windows NSIS installer** → `release/Tempo Setup x.y.z.exe` |
| `npm run test` | Unit tests (vitest, watch mode) |
| `npx vitest run` | Unit tests, single run |
| `npm run typecheck` | TypeScript checks across main/preload/renderer |

## Install on Windows (packaged)

`npm run dist` produces `release/Tempo Setup 0.1.0.exe` — a normal installer (choose install dir, desktop shortcut). The app auto-starts after login and logs to `%APPDATA%\Tempo\data\logs\tempo.log`. Tray → *Quit* fully exits.

## Fedora Linux (experimental)

Tracking (via `active-win`) and idle detection should work, but Linux is **untested** — expect flakiness if you find bugs. Known caveats: on Wayland, idle detection can under-report; X11 sessions work best.

```bash
# build tools for better-sqlite3's native module
sudo dnf install -y gcc-c++ make python3-devel git

# Node.js 20 (NodeSource)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# clone & run
git clone https://github.com/mmoolyaa/tempo-time-tracker.git
cd tempo-time-tracker
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
- [ ] Proper Linux/macOS support
- [ ] Weekly goals & timelines like Rize
