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

- 318 unit tests (Vitest), including validation of every entry in the real `data/objects.json`.
- 99 browser tests (Playwright; 5 skipped by design) on desktop Chromium and a Pixel 7 emulation; 1 skipped by design (the
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
12. **The Sun circled any planet you focused on**, and the Moon looked like it spun. The camera followed the body
    but never turned with its orbit. It now turns along with the orbit while you are focused on anything that
    orbits something, so the Sun stays on one side of a planet and the Moon keeps its face still (its phases
    still change). Measured: Mercury's lit side moved 160 degrees in 10 s before and under 1 degree after.
13. **Ten object buttons made the phone layout too tall, and the first fix nudged the whole game sideways.**
    The buttons are now one row that scrolls. A first version let that row grow to 900 px on a 412 px phone, so
    tapping the last button scrolled the "hidden" game container and pushed "The Sun" and the camera buttons
    off the left edge. Fixed by clipping the container and stretching the row to the screen, with a test that
    was checked to fail without the fix.

14. **Regions were saved but never enforced.** Rank-ups recorded the unlocked regions, but nothing read them, so adding the
    outer planets would have let a brand-new player scan Jupiter and made the Navigator rank-up meaningless. Regions are
    now enforced: locked bodies are not drawn or tappable, their buttons explain themselves, scanning refuses them,
    and the Logbook counts only what you can reach. A unit test also checks that the inner region alone is enough XP
    to reach Navigator, so the game can never dead-end.

15. **Turning on bloom made the whole browser-test suite three times slower** (11 minutes instead of 3.6) and one
    unrelated scanning test failed under the load, because every desktop test was suddenly software-rendering heavy
    effects. Tests now load the game with `?effects=off`; only the effect tests turn them on. (A real GPU does not have
    this problem, but it is a reminder that bloom is the first thing to trim if a phone is slow.)
16. **A "should never happen" bad number (NaN) could have broken the warp streaks.** A test of silly inputs found it
    before any player could.

17. **The outer planets looked frozen.** At the game's speed Jupiter takes 24 minutes to go round and Neptune 5 and a
    half hours. Far worlds are now drawn with faster laps (4 to 7 minutes), keeping the true order, and the info panel
    says how much faster than real. The old rule "nothing is ever drawn faster than real" was replaced with: every lap
    is between 3 seconds and 10 minutes, no orbit is changed more than 60 times, and every change is explained.
18. **Uranus had no moons in the game** although it has five big ones. Added (with Saturn's five mid-sized moons).
    The object button row is now 32 long: grouping buttons by planet is the next interface job.

19. **Practice mode** (Settings): everything unlocked, every scan level available, no XP. Built as a virtual
    "overlay" record (`game/practice.ts`) that the game reads while practice is on, so the real save is never
    written to: turning practice off returns exactly to the real progress. Practice scans are kept in memory only.
    Tested as pure rules, in the scan controller, and end to end (including that real XP and "objects inspected"
    never change, and that the setting survives a reload).

20. **Warp-streak tests failed only in Safari's engine (WebKit) on CI.** They counted "bluish pixels", which differs between
    browsers even with no warp at all (3,000 to 4,000 on the Performance profile in WebKit, about 0 in Chromium), so the
    check did not carry over. The 3D view now publishes its warp strength as a read-only `data-warp` value and the tests
    read that. Whether the streaks are _drawn_ correctly in Safari could not be reproduced here (WebKit cannot be
    downloaded in this container): the iPhone test covers it.
21. **The Sun's layers** (core, radiative zone, convection zone, photosphere, chromosphere, transition region, corona) are a
    new Layers tab with a cutaway picture, revealed by scan level. The wording is NASA's as pasted by the owner (page address
    unconfirmed); the extra detail and the picture's proportions are from general knowledge and are listed for checking.

22. **Notifications could bury the Settings button on a small iPhone.** CI (WebKit, iPhone layout) could not tap Settings because
    a stack of toasts, including the iPhone install tip, sat on top of it. Toasts stacked without limit and also swallowed
    taps. Now at most two show at once (oldest dropped first, but a toast with an action button, such as "Reload", is kept),
    and a toast's text lets taps through to whatever is underneath, apart from its own buttons. Reproduced first (five toasts
    reached the Settings button on a 390 x 664 screen), and the new test was confirmed to fail with the cap switched off.

23. **A spacecraft you can fly** (Pilot ship, or the P key). Arcade flight, not real physics: a throttle lever, steering,
    a top speed that shrinks near worlds (so you cannot crash), and an autopilot that flies to the selected object, goes
    round the Sun, and stops in scanning range. Five camera views (Chase, Cockpit, Orbit, Map, and a self-directing
    **Cinematic** camera that cuts between four shots through a film-style lens with letterbox bars, and holds one
    still angle with Reduce motion; its shots are pure, tested functions in `engine/cinematic.ts`), keyboard controls
    (W/S, A/D or arrows, X, V, P) and on-screen hold-to-steer buttons for phones. Near a world the ship is carried along
    with it, otherwise orbiting planets slid away from a parked ship. Scanning now measures from the ship while piloting.
    The rules live in `engine/flight.ts`, `engine/pilot.ts` and `engine/shipViews.ts` (pure, no Three.js) and are unit
    tested, including: never inside a planet at full throttle, the same distance at 30 and 144 frames per second, the
    autopilot going round the Sun, and catching a moving planet. Two real bugs were caught by tests or screenshots
    while building it: the autopilot could never catch a planet that moves faster than it creeps in, and it overshot its
    stopping point (an under-damped speed law); a quick tap of X braked for only one frame.
    Why not free flight: the spec says orbit and fly-to are "much easier to control than free flight, especially on a
    phone", so the original camera stays the default and the ship is an extra mode. The phone layout was redesigned after
    a screenshot showed the controls hiding the ship and colliding with the top buttons (see the README).
    While building the Cinematic view, a screenshot showed its black bars hiding the object buttons; the first test for it
    passed anyway (the bars let taps through, so a click works under them), so it was rewritten to check the buttons'
    labels are visible in the picture, and confirmed to fail with the bug put back.
    Honesty: the ship's speeds are made up (u/s in scene units); the info panel's real values are unchanged.

24. **Comet C/2026 A2 (Bok)** is the 32nd object (inner region, right after Ceres). A new object type, "comet", with a
    real Kepler orbit (`engine/comet.ts`, pure and unit tested against the laws of physics: Kepler's equation, the
    energy equation, the tilt, direction of travel) instead of a circle, a height above the planets' plane (a new optional
    `y`), a glowing coma and two tails that point away from the Sun, and its path drawn as a line. The flyby is
    replayed on a loop at the game's clock. **Only the numbers I could find are in the data** (perihelion 1.94 AU,
    tilt 82 degrees, eccentricity 0.99761492, from two web pages summarised by a search); everything else says "Not yet
    checked", and the two missing orbit angles are drawn as 0 degrees and labelled as placeholders (see `DATA_CHECK.md`).
    The host that has the full orbit (JPL) was blocked from the container. While building it: a unit test showed my
    claim that a comet is "slow far out" was overstated inside 3.5 AU (real speed varies by about 35% there); a ship
    parked beside the comet would have been dragged across the map when the replay loops, so a body that jumps is now
    ignored by the "carry the ship along" rule (tested, and the test confirmed to fail without the rule); and the first
    version of the glow (a flat polygon) and tails (hard-edged cones) looked wrong in a screenshot and were reworked.

25. **A much more realistic spacecraft** (owner feedback: "need much more photo realistic space craft"). The first ship was a
    cone, two boxes and a ball. It is now a detailed model built from code (`engine/shipModel.ts`; its proportions are
    pure, tested data in `engine/shipDesign.ts`): a smooth lathed fuselage with drawn panel seams, rivets, soot and
    markings (also used as a bump map so the seams catch the light), a glossy canopy, swept delta wings with winglets,
    a tail fin, a gold thermal-foil service ring, twin engine housings with flared bells and soft blue flames, solar
    panels on booms, an antenna dish, vents, thruster blocks and blinking red/green/white navigation lights. It uses
    physically based materials (metalness and roughness) lit by the Sun plus reflections of a small made-up space
    (Sun, an Earthshine-blue glow, stars), and a faint self-lit glow so the side facing away from the Sun does not turn
    black. It is built only the first time you step into the ship (71 ms here), so players who never fly it pay nothing.
    **Honest limit: this is detailed, shaded game art, not a photograph.** True photo-realism needs a modelled and
    textured asset made by an artist. I could not download one here, so if you can supply a licensed `.glb` spacecraft
    I can load that instead. While building it, measuring the model showed my own `SHIP_HEIGHT` constant was wrong (0.26;
    really 0.36) and a unit test caught that the first tail-fin outline was a stub barely above the hull.
25. **The comet looked like a moon** (owner's feedback: needs a tail and more broken-up rocks and ice). The nucleus was a
    smooth grey ball and the tail only appeared inside 3.2 AU, so the first third of every loop was a bare ball. Now: a
    lumpy, faceted, stretched nucleus with a dark crust and bright ice patches (`engine/cometNucleus.ts` has the pure
    rules, tested: it is not round, it is stretched, ice covers only part of it), 140 pieces of broken rock and ice
    circling it and streaming down the tail, a glow that is drawn only BEHIND the nucleus (drawn over it, it washed the
    nucleus out to white in a screenshot), and a tail that is there for the whole replay, brighter and softer-edged.
    A screenshot also showed the first chunks were bigger than the nucleus; they are now small.
    **Settings now has a Close button at the top**, pinned there while the list scrolls (the one at the bottom stays).
    **CI's Lighthouse check then failed (performance 48, minimum 50), and it was real, not noise.** Measured locally the same
    way: `main` scored 49, 51 and 53; the new comet scored 46 three times (largest paint 4.0 s against about 3.3 s). Cause:
    drawing the tails, glow and rocks from the first second made the page compile extra shader programs while it was still
    loading, and a software renderer is slow at that. Fix: the comet's visuals are now built only after the page has had 6
    seconds to settle, their shaders are compiled while still hidden, and then it fades in (a test checks nothing is built
    in the first seconds). Measured afterwards: 54, 53 and 54. Lesson: optional eye candy must not run during startup.

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
11. **Visuals are partly placeholders.** (Bloom, atmosphere haze and warp streaks now exist, are decorative, and
    their cost on a real phone is unmeasured.) The Moon and Mars now have real surface pictures (JPEG, size chosen by graphics
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
