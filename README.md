# Starbound Survey

A browser-based 3D astronomy exploration game: pilot a survey ship through a scale model of the
cosmos and scan real objects to learn real science. It runs in Safari (iPhone) and Chrome
(Android) with nothing to install, and can be added to the Home Screen to play offline.

**Status:** Phase 0 prototype is merged and waiting on real-phone testing (`docs/GATE_REPORT.md`).
Phase 1 has started early: **slice A (scanning, XP, ranks, Logbook) is done**. See `docs/PHASE1.md`.

## Documents

| File                     | What it is                                             |
| ------------------------ | ------------------------------------------------------ |
| `docs/SPEC.md`           | The full game design and technical specification       |
| `docs/GATE_REPORT.md`    | What is done, what is proven, open problems, go/no-go  |
| `docs/DEVICE_TESTING.md` | Step-by-step checklist for testing on a real phone     |
| `docs/TESTING_LOG.md`    | Results table (real-device rows are still empty)       |
| `docs/TEXTURES.md`       | How to add NASA surface images (Moon, and later more)  |
| `docs/DATA_CHECK.md`     | Values to compare with NASA's pages (still unverified) |
| `docs/FUN_REVIEW.md`     | Is it fun? Findings and a ranked list of next steps    |

## How to play

1. **Pick an object:** tap the Sun, Earth or Moon (or use the buttons at the top).
2. **Fly to it:** double-tap it, or use its button. You must be close to scan (otherwise: "Move closer to scan").
3. **Scan:** press and hold **SCAN** (bottom right), or hold the **Space** key, until the ring fills (3 seconds).
   Let go early and the scan is cancelled. Prefer not to hold? Settings > Scan control > "Tap once".
4. **Learn:** a scan reveals measurements in the **Advanced data** tab, with their source.
5. **Earn XP:** first scan of an object = **20 XP**, a deeper scan = 10 XP, re-scanning the same level = 0.
   The bar at the top right shows your rank (Cadet, Navigator, Surveyor, Astronomer, Director) and progress.
6. **Follow the Goal:** the line under the XP bar always names the next step (for example "Scan Mercury (+20 XP)"). Tap it
   to fly there. When you have scanned everything, it says so.
7. **Missions:** the **Missions** button lists guided missions. The first one, "Where does the Moon's light come from?",
   asks you to scan the Sun and the Moon, then answer a question. A wrong answer costs nothing and shows the
   explanation; a correct one earns XP (65 on the first try). Missions are paused in practice mode.
8. **Achievements:** First Light, Comet Chaser, Giant Hunter and seven more. A message appears when you earn one.
9. **Logbook:** open it to see what you have discovered and your achievements (locked ones say how to earn them).
10. **Find the comet:** C/2026 A2 (Bok) is the button after Ceres. Its flyby is replayed on a loop with its tail pointing away
    from the Sun. Only the numbers that could be found are in the game; the rest say "Not yet checked" (`docs/DATA_CHECK.md`).

Deeper scans (Detailed at Navigator, Spectral at Surveyor) need a higher rank. More ways to earn XP
(Flight School, quizzes, missions) arrive in the next Phase 1 slices.

### Fly the spacecraft

By default the camera orbits whatever you pick. To steer the ship yourself, press **Pilot ship** (or the **P** key).
The ship appears where the camera was. Scanning then measures the distance **from the ship**, so you have to fly there.

| Control                      | Keyboard                          | Touch / mouse                                         |
| ---------------------------- | --------------------------------- | ----------------------------------------------------- |
| Faster / slower (or reverse) | **W** / **S**, or the mouse wheel | **+** / **-** buttons (hold)                          |
| Turn left / right            | **A** / **D**, or **←** / **→**   | **◀** / **▶** buttons (hold), or drag                 |
| Nose up / down               | **↑** / **↓**                     | **▲** / **▼** buttons (hold), or drag                 |
| Stop                         | **X** (one tap)                   | **Stop** button                                       |
| Change camera view           | **V**                             | **Chase / Cockpit / Orbit / Map / Cinematic** buttons |
| Fly to the selected object   | an object button, or **Enter**    | an object button, or **Fly to ...**                   |
| Leave the ship               | **P** or **Esc**                  | **Leave ship**                                        |

- **Chase** (behind the ship), **Cockpit** (from the nose), **Orbit** (drag to swing round the ship), **Map**
  (looking straight down, your heading pointing up the screen) and **Cinematic**.
- **Cinematic** is a self-directing film camera. It cuts between four shots of your ship (a sweeping flyby, a low side
  track, a head-on shot and an overhead dolly), through a narrower film-style lens, with black bars top and bottom. You
  can keep steering while it films. With _Reduce motion_ on it holds one still angle instead of sweeping and cutting.
- **The throttle is a lever.** It stays where you leave it, so the ship keeps cruising when you let go of **W**.
- **You cannot crash.** The top speed shrinks as you get near a world, and the ship stops at its surface.
- **Autopilot** flies to the selected object, goes round the Sun if it is in the way, and stops in scanning range.
  Steering by hand cancels it. With _Reduce motion_ on it jumps straight there.
- Near a world the ship is carried along with it as it orbits, so you can stay beside a planet to scan it.
- On a phone the steering pad hides while the info sheet is open (close the sheet to steer; the autopilot button stays).
- **Speeds are not real.** "u/s" is the game's made-up unit (see _Not to scale_). Real spacecraft take months or years.
- Needs 3D graphics: the simplified 2D chart has no ship.

## What you need installed

- [Node.js](https://nodejs.org) 22 or newer (this also installs `npm`, the package manager)
- [Git](https://git-scm.com)

## Run it

```bash
npm install        # download the libraries listed in package.json (first time only)
npm run dev        # start the local dev server and open the printed address
```

To try it on your phone, run `npm run dev -- --host` and open the "Network" address it prints (your
phone must be on the same Wi-Fi). Install and offline play need the production build on HTTPS: see
`docs/DEVICE_TESTING.md`.

## Commands

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Development server with live reload (no service worker)          |
| `npm run build`     | Production build into `dist/` (includes the service worker)      |
| `npm run preview`   | Serve the production build locally (port 4173)                   |
| `npm test`          | Unit tests (Vitest), including validation of `data/objects.json` |
| `npm run test:e2e`  | Browser tests (Playwright). Builds and serves the game itself    |
| `npm run lint`      | Check code for likely mistakes (ESLint)                          |
| `npm run typecheck` | Check TypeScript types                                           |
| `npm run format`    | Auto-format all files (Prettier)                                 |
| `npm run test:all`  | Lint, types, unit and browser tests together                     |

First time running browser tests: `npx playwright install chromium` (add `webkit` to also test Safari's
engine, then run with `PW_WEBKIT=1 npm run test:e2e`). Regenerate app icons with
`node scripts/generate-icons.mjs`.

## Handy URL options (for testing)

- `?renderer=canvas2d` forces the simplified 2D chart, as if WebGL were unavailable.
- `?scanSeconds=0.5` changes how long a scan takes (0.2 to 10 seconds; default 3). Used by the automated tests.
- `?effects=off` turns off the glow, atmosphere haze and warp streaks whatever the graphics level. The automated tests use it so the software-rendered 3D stays fast; the effect tests themselves use `?effects=on` (which changes nothing).

In **Settings** you can choose the graphics quality, turn on a frame-rate readout, change control
speeds and Reduce motion, and export or import a backup of your progress.

**Practice mode** (Settings): explore everything with no XP needed. Every region is unlocked and every scan level
is available straight away. Practice scans still reveal data, but they give no XP, never change your saved
progress, and are forgotten when you close the page. Turn it off and you are back exactly where you were.

## Project layout

| Folder                      | Responsibility                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/engine/`               | 3D renderer, camera, spacecraft flight rules, input, quality manager, renderer fallback (`ViewHost`) |
| `src/fallback/`             | Canvas 2D star chart for devices without 3D                                                          |
| `src/game/`                 | Data types, validation and loading, settings, progress, event bus                                    |
| `src/save/`                 | Save service (IndexedDB), migrations, preferences                                                    |
| `src/ui/`                   | HUD, info panel, settings, toasts, error screen                                                      |
| `src/shaders/`              | Reserved for visual-effect shaders (later phases)                                                    |
| `data/`                     | JSON content with cited sources                                                                      |
| `tests/unit/`, `tests/e2e/` | Vitest unit tests and Playwright browser tests                                                       |
| `docs/`                     | Spec, gate report, device checklist, testing log                                                     |
| `scripts/`                  | Icon generator and Lighthouse check                                                                  |

## How the pieces fit

Modules talk through a small event bus (`src/game/events.ts`): a tap, a button and a key press all
announce "object selected", and the info panel, the 3D view and the save system each react without
knowing about each other. The renderer is hidden behind one `View` interface, so the game does not
care whether it is drawing with WebGL or the 2D fallback.

## Version control tips

Commit after each working step with a message saying what and why. Never commit `node_modules`,
`dist` or secrets (already in `.gitignore`). CI (`.github/workflows/ci.yml`) runs lint, types, unit
tests, browser tests (Chrome and Safari engines) and a Lighthouse check on every push.
