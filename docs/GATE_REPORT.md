# Prototype gate report (Phase 0)

Status: **ready for real-phone testing. The gate is NOT passed yet**, because the spec requires measured
results on a real iPhone and a real Android phone, and none exist. The go or no-go decision is yours.

Date of this report: 2026-11-02.

> **Update:** Phase 1 slice A was started before this gate passed, at the owner's request. See `PHASE1.md`.
> The gate criteria below are unchanged and still open.

## Gate criteria

| #   | Criterion (from the spec)                                                     | Status                                                                          | Evidence                                                                                                                                    |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Performance targets measured on real devices and recorded in the testing log  | **Not done**                                                                    | Needs your phones. Checklist: `docs/DEVICE_TESTING.md`. Log: `docs/TESTING_LOG.md`.                                                         |
| 2   | Save survives closing and reopening the browser; an export restores correctly | **Passed in automated tests (Chromium). Real iPhone/Android still to confirm.** | `tests/e2e/save.spec.ts`: reload keeps progress; export, wipe all site data, import restores it; bad file rejected; corrupt save backed up. |
| 3   | Fallback verified with WebGL disabled                                         | **Passed (Chromium).** WebKit run pending in CI.                                | `tests/e2e/fallback*.spec.ts`: browser launched with WebGL really off; forced Canvas 2D; GPU loss twice (rebuild once, then fall back).     |
| 4   | Open problems and trade-offs written up; go or no-go decided                  | **Written below. Decision: yours.**                                             | This file.                                                                                                                                  |

## Prototype scope check

| Spec item                                                                                   | Done?                                   | Notes                                                                                                                   |
| ------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Earth, Moon, Sun orbiting on the compressed scale                                           | Yes                                     | Periods come from `data/objects.json`; "Not to scale" shown on screen                                                   |
| Camera: orbit, zoom, fly-to on touch and desktop                                            | Yes                                     | Unit-tested gesture logic; browser-tested mouse, keyboard, buttons and a real touch tap. **Pinch is unit-tested only.** |
| Tap-to-select, info panel (Quick facts / Advanced data), real JSON values, image-type label | Yes                                     | Bottom sheet on phones, side panel on desktop                                                                           |
| Renderer fallback chain                                                                     | **Partly**                              | WebGL2 then Canvas 2D, with GPU-loss recovery. **WebGPU is not implemented** (see problem 1)                            |
| Three profiles, switchable manually                                                         | Yes                                     | High / Balanced / Performance + Auto with adaptive step-down                                                            |
| Save: IndexedDB, export/import, reload test                                                 | Yes                                     | Migrations, corrupt-save backup, persistence request                                                                    |
| Installable PWA                                                                             | Yes (not installed on a real phone yet) | Manifest, icons, offline service worker, update prompt, iPhone install hint                                             |
| Running on a real iPhone and Android phone                                                  | **No**                                  | Needs you                                                                                                               |

## What was verified, and how

- 217 unit tests (Vitest), including validation of every entry in the real `data/objects.json`.
- 83 browser tests (Playwright) on desktop Chromium and a Pixel 7 emulation; 1 skipped by design (the
  bottom-sheet handle only exists on phone-width screens).
- Lint, type-check and production build pass. Production dependencies: 0 known vulnerabilities.
- Lighthouse on the production build: accessibility 100, best practices 100, SEO 91.
- By hand in a browser: offline reload; update prompt (and no surprise reload); hidden tab stops
  rendering (0 frames) and resumes; 75 s of use with flat JS memory; dev server works; production build
  prints nothing to the console.

## Bugs found and fixed while testing (so you know what the tests are guarding)

1. Vite embedded the small JSON data file into the code, so a failed load could never show the Retry screen.
2. After a pinch, the leftover finger started dragging on the first pixel of wobble.
3. On phones the open bottom sheet covered the Settings button.
4. Browsers only check for a new service worker on navigation every 24 hours, so installed players could
   stay on an old version. The game now checks when it returns to the foreground and hourly.
5. The update prompt's Reload button did nothing in some cases; fixed with the browser's own
   `controllerchange` signal.
6. The Sun's diameter was entered from a different source than the one cited; corrected to 1,391,400 km
   (2 x the IAU nominal radius, 695,700 km).
7. Vitest was also trying to run the Playwright files, which would have failed CI.
8. (Found by CI in WebKit) The game kept its IndexedDB connection open when another tab or the browser wanted
   to delete or upgrade the database, which blocks that forever. It now closes the connection on `versionchange`.
9. (Found by CI in WebKit) The accessibility test scanned while the info panel was still fading in and saw
   washed-out colours: a test race, not a real contrast problem. The scan now waits for animations to end.

10. **Every orbit ran clockwise** (seen from above the north pole), the opposite of the real Solar System.
    Found by the owner, then confirmed by measuring Earth's motion on screen. Fixed in `orbits.ts` (`z = -sin`)
    and locked in by unit tests plus an on-screen check of both the 3D view and the 2D chart.
11. **The Moon went round Earth in 2.7 s**, which looked frantic because it also turns once per orbit to keep
    its near side toward Earth. The clock now runs at 3 days per second (Moon about 9 s, Earth's year about 2 min).

## Open problems and trade-offs

1. **WebGPU is not implemented.** The spec asks for WebGPU first. Three.js's WebGPU API is still moving
   and phones mostly use WebGL2 anyway, so the prototype is WebGL2 plus Canvas 2D. The renderer sits behind
   the `View` interface, so a WebGPU view can be added later without touching game code.
2. **No real-device data.** Frame rate, heat, whole-tab memory, load time on a phone network and the 20-minute
   stability test are all unmeasured. Emulated numbers in the log are labelled and must not count.
3. **WebKit (Safari engine) results come from CI only, and are emulation.** The dev container has no WebKit.
   CI's first full run (desktop and iPhone 13 emulation) passed 102 tests with 2 needing a retry. Both were
   root-caused and fixed (bugs 8 and 9 below). Emulated WebKit is not a real iPhone: GPU, memory and storage
   behaviour still need a real device.
4. **Minimum iPhone version is unverified.** Vite's default build target is modern browsers, which probably
   excludes iOS 15 (the spec says WebGL2 works on iOS 15+). Test on an older iPhone. If iOS 15 matters,
   set `build.target` lower and re-test, at some cost in size.
5. **Data needs your spot-check** (Mercury, Venus and Mars are listed in `DATA_CHECK.md`). The container could not reach NASA's pages (blocked by network policy),
   so values were entered from knowledge, then cross-checked only against my own recollection. One error was
   already found (problem 6 above). Please compare every number with the cited fact sheet before it ships.
6. **Settings live in `localStorage`, not in the save record.** The spec's example save contains settings,
   but its storage table puts preferences in `localStorage`. I followed the table. A consequence: an
   exported backup holds progress only, not settings (which are device-specific anyway). Easy to change if
   you prefer settings to travel with the backup.
7. **Android install prompt is not built.** Only the iPhone "Add to Home Screen" hint exists. Chrome on
   Android offers its own Install option in the menu.
8. **Hosting: Netlify (development).** The game is deployed on Netlify, which serves from the site root over
   HTTPS and fits the manifest. `netlify.toml` pins Node 22 and the cache rules. A sub-folder host such as
   GitHub Pages would need `base` set in `vite.config.ts`.
9. **Cache recovery is partial.** A missing cached file falls back to the network, and a failed data load
   shows the Retry screen. A corrupted cached _script_ is not detected and could show a blank page. Rare, but
   not handled.
10. **Bundle size.** 587 KB of JavaScript (150 KB compressed), mostly Three.js. Fine for the 5 MB target;
    code-splitting is a later optimisation.
11. **Visuals are mostly placeholders.** The Moon now has a real surface picture (JPEG, size chosen by graphics
    profile; see `TEXTURES.md`). Its **credit and licence are not yet confirmed** (the supplied file has no credit
    inside and NASA's page could not be opened), so no in-game credit is shown. The other bodies are flat colours.
    KTX2 is still not used, and texture memory and frame rate on a real phone are untested.
12. **Cosmetic:** the "Ready to play offline" message can overlap the bottom sheet for a few seconds on phones.
13. **Tooling pins:** TypeScript is pinned to 6.0 because `typescript-eslint` does not support 7 yet.
    `npm audit` lists moderate advisories in `workbox-build`, a build-time tool that is not shipped to players
    (production dependencies: 0).
14. **Pinch and swipe** are proven by unit tests and one manual run, not automated browser tests
    (Playwright cannot easily fake two-finger gestures). Real-phone checklist covers them.

## Trade-offs accepted (all from the spec)

- Two renderer paths to test, in exchange for working everywhere.
- Compressed scale, in exchange for visible planets. It is disclosed on screen and in the info panel.
- IndexedDB plus export/import is more code than `localStorage`, in exchange for reliability.
- A service worker to maintain, in exchange for offline play and protection from Safari clearing data.

## Recommendation

Proceed to real-phone testing now using `docs/DEVICE_TESTING.md`. Get the first CI run green (it brings
the Safari-engine tests). If the phones hold the targets, **go** to Phase 1; the main risks to watch are
problems 2, 3 and 4.

## Decision (fill in after the phone tests)

- Date:
- Devices tested:
- Targets met? (yes / no / partly):
- Decision (go / no-go):
- Notes:
