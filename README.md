# Starbound Survey

A browser-based 3D astronomy exploration game: pilot a survey ship through a scale model of the
cosmos and scan real objects to learn real science. It runs in Safari (iPhone) and Chrome
(Android) with nothing to install.

**Status:** Phase 0, the prototype. See the design spec for the full plan; nothing larger gets built
until the prototype passes its gate (real-phone performance, reliable saves, graphics fallback).

## What you need installed

- [Node.js](https://nodejs.org) 20 or newer (this also installs `npm`, the package manager)
- [Git](https://git-scm.com)

## Run it

```bash
npm install        # download the libraries listed in package.json (first time only)
npm run dev        # start the local dev server and open the printed address
```

To try it on your phone, run `npm run dev -- --host` and open the "Network" address it prints
(your phone must be on the same Wi-Fi).

## Other commands

| Command              | What it does                            |
| -------------------- | --------------------------------------- |
| `npm test`           | Run the unit tests once (Vitest)        |
| `npm run test:watch` | Re-run tests whenever you save a file   |
| `npm run typecheck`  | Check TypeScript types without building |
| `npm run build`      | Create the production build in `dist/`  |
| `npm run format`     | Auto-format all files with Prettier     |

## Project layout

| Folder          | Responsibility                                           |
| --------------- | -------------------------------------------------------- |
| `src/engine/`   | Renderer, camera, quality manager, fallback chain, `log` |
| `src/shaders/`  | Visual-effect shaders (later phases)                     |
| `src/game/`     | Missions, XP, scanning, state machine (later phases)     |
| `src/save/`     | Save service (IndexedDB, export/import, migrations)      |
| `src/ui/`       | HUD, info panels, menus                                  |
| `src/fallback/` | Canvas 2D star chart for devices without 3D              |
| `data/`         | JSON content: objects, missions, quizzes                 |
| `assets/`       | Textures, with a credits file                            |
| `tests/`        | Unit tests (and browser tests later)                     |
