# Nova Hop — project guide for Claude

Original vertical-bounce arcade game (HTML5 canvas, vanilla JS, no build step). Plays on desktop, Android and iPhone; installable as a PWA.
Formerly a "Doodle Jump" clone — rebranded to **Nova Hop** with all-original procedural art. **Do not** reintroduce Doodle Jump names, sprites or look; old files live in `legacy/` for reference only and are not loaded.

## Run
- Static (no leaderboard): open `index.html`, or `npm run static` → http://localhost:8080 (any static host works: GitHub Pages, Vercel, Netlify).
- Full (with leaderboard): `npm install && npm start` → http://localhost:3000. Needs MongoDB (`MONGO_URL`, default `mongodb://localhost:27017/novahop`). If Mongo is down, the API returns 503 and the game hides the leaderboard panel.
- Service worker only registers over http(s). It is network-first; bump `CACHE` in `sw.js` when adding/renaming cached files.

## Files
| Path | Role |
|---|---|
| `index.html` | DOM: canvas, HUD, menu / pause / game-over screens, side "How to play" card |
| `css/style.css` | Design tokens in `:root`, glass panels, chunky 3D buttons, screen transitions, responsive rules |
| `js/game.js` | Whole game in one IIFE: state machine, physics, generation, rendering, input, HUD, persistence |
| `js/audio.js` | `window.Sfx` — Web Audio synthesized sound effects (no audio files) |
| `sw.js`, `manifest.webmanifest`, `assets/icon*.{svg,png}` | PWA install/offline |
| `sarver.js` | Express server: static files + `/api/leaderboard`, `/api/submit-score` (legacy `/leaderboard`, `/submit-score` kept). Spelling "sarver" is intentional — keep it. |
| `legacy/` | Original clone code/assets + duplicate lockfile copies. Unused. |

## Game architecture (`js/game.js`)
- **Coordinates**: world is always `W = 400` units wide; `H` = screen height in units (aspect-dependent). `y` grows downward; climbing = more negative `y`. `camY` = world y at top of screen. `alt` = max height reached (px); score = `alt/3 + bonus`.
- **Fixed timestep**: `update()` runs at 60 ticks/s via accumulator in `frame()`; `draw()` every rAF. Tune physics per-tick (`G`, `JUMP`, `SPRING`).
- **States**: `menu` (attract mode, blob hops on ground only) → `play` → `dying` (camera follows fall ~80 ticks) → `over`; `paused` freezes simulation. Auto-pause on blur / tab hidden.
- **Reachability rule**: row gap ≤ ~136 < jump peak (~160). Only `normal`, `moving`, `cloud` (vanishes after one bounce) are on the main path; `crumble` platforms are extra decoys. Keep this invariant when tuning `spawnRow()`.
- **Difficulty** `diff() = alt/40000` (0..1) drives gap, platform width, moving/cloud/crumble/enemy odds.
- **Zones** (`ZONES`): Cotton Sky 0, Sunset Drift 6000, Aurora Reach 16000, Deep Cosmos 30000 — background blends over 2000 px before each.
- **Entities**: platforms, items (`spring` on platform; `rocket`/`shield`/`magnet` floating orbs), `coins` (stardust stars, combo multiplier up to x5), `enemies` (Spikers: stomp from above, rocket/shield destroys, otherwise death).
- **FX**: `part()` particles (dot/ring/star/rect/smoke, capped 420), `popup()` floating text, `shake`, squash & stretch on player, trail at high speed, `confetti()` on new best.
- **Input**: keyboard (A/D, arrows, Space/Enter, P/Esc, M), pointer hold left/right half of canvas (touch + mouse), optional tilt (`deviceorientation`; iOS asks permission on tap). Haptics via `navigator.vibrate` (Android only).
- **Persistence**: `localStorage` keys prefixed `novahop.` — `best`, `wallet` (stardust), `owned`, `skin`, `muted`, `control`, `name`. Skins in `SKINS` unlock with stardust.

## Repo & deploy
- Vercel (primary): https://nova-hop.vercel.app — project `nova-hop`, team `nikhilrana2715s-projects`, git-linked to `main` (auto-deploy on push). Config: `vercel.json` (static, headers), `.vercelignore`. Vercel MCP lacks project-create permission; account uses 2FA.
- GitHub: https://github.com/nikhilrana2715/Doodle-Jump-website-Game (branch `main`). Live: https://nikhilrana2715.github.io/Doodle-Jump-website-Game/ (GitHub Pages from `main` root, `.nojekyll`).
- Drive is exFAT/no-ownership → run git as `git -c safe.directory=E:/Doodle-Jump-website-Game ...`. `gh` CLI is not installed.
- README screenshots live in `docs/` (`hero.png`, `desktop.png`); design tokens/components documented in `docs/DESIGN-SYSTEM.md` — update its changelog when tokens change.
- `?autopilot` URL param = demo AI steering (used to record the trailer; `media/` is gitignored and holds the 30s LinkedIn trailer).
- v2.1 extras: dashed BEST height flag (`save.bestAlt`), Share button (Web Share / clipboard), Haptics toggle (`save.haptics`).

## Conventions
- Vanilla JS, no frameworks/bundlers; keep it loadable from `file://`.
- All art is drawn on canvas or CSS — no image sprites. CSS uses token scales only (`--fs-*`, `--sp-*`, `--r-*`, colors); no raw px spacing/font sizes in components.
- Respect `prefers-reduced-motion` (CSS kills animations; JS disables screen shake).
- Layout: stage is a portrait column (`#stage`, ~0.6 aspect) on desktop, full-bleed ≤600px wide, compact column on landscape phones (≤520px tall).
- Verify changes with `node --check js/game.js` and by playing in a browser at desktop + phone sizes.
