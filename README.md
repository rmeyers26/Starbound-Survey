# Starbound Survey

A browser-based 3D astronomy exploration game: pilot a survey ship through a scale model of the
cosmos and scan real objects to learn real science. It runs in Safari (iPhone) and Chrome
(Android) with nothing to install, and can be added to the Home Screen to play offline.

**Status: Phase 0, the prototype.** Earth, Moon and Sun with orbit camera, info panels, saves,
graphics fallbacks and PWA support. It is waiting on real-phone testing before the gate can pass.
Read `docs/GATE_REPORT.md` first.

## Documents

| File                     | What it is                                            |
| ------------------------ | ----------------------------------------------------- |
| `docs/SPEC.md`           | The full game design and technical specification      |
| `docs/GATE_REPORT.md`    | What is done, what is proven, open problems, go/no-go |
| `docs/DEVICE_TESTING.md` | Step-by-step checklist for testing on a real phone    |
| `docs/TESTING_LOG.md`    | Results table (real-device rows are still empty)      |

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

In **Settings** you can choose the graphics quality, turn on a frame-rate readout, change control
speeds and Reduce motion, and export or import a backup of your progress.

## Project layout

| Folder                      | Responsibility                                                              |
| --------------------------- | --------------------------------------------------------------------------- |
| `src/engine/`               | 3D renderer, camera, input, quality manager, renderer fallback (`ViewHost`) |
| `src/fallback/`             | Canvas 2D star chart for devices without 3D                                 |
| `src/game/`                 | Data types, validation and loading, settings, progress, event bus           |
| `src/save/`                 | Save service (IndexedDB), migrations, preferences                           |
| `src/ui/`                   | HUD, info panel, settings, toasts, error screen                             |
| `src/shaders/`              | Reserved for visual-effect shaders (later phases)                           |
| `data/`                     | JSON content with cited sources                                             |
| `tests/unit/`, `tests/e2e/` | Vitest unit tests and Playwright browser tests                              |
| `docs/`                     | Spec, gate report, device checklist, testing log                            |
| `scripts/`                  | Icon generator and Lighthouse check                                         |

## How the pieces fit

Modules talk through a small event bus (`src/game/events.ts`): a tap, a button and a key press all
announce "object selected", and the info panel, the 3D view and the save system each react without
knowing about each other. The renderer is hidden behind one `View` interface, so the game does not
care whether it is drawing with WebGL or the 2D fallback.

## Version control tips

Commit after each working step with a message saying what and why. Never commit `node_modules`,
`dist` or secrets (already in `.gitignore`). CI (`.github/workflows/ci.yml`) runs lint, types, unit
tests, browser tests (Chrome and Safari engines) and a Lighthouse check on every push.
