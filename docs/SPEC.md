# Starbound Survey: Game Design and Technical Specification

Nov 1, 2026 · @Richard Meyers

Starbound Survey is a browser-based 3D astronomy exploration game in which the player pilots a science vessel through a scale model of the cosmos, scanning real objects to learn real science. This document holds the game design first, then the mobile and technical architecture, and it is the single reference for the build.

## Concept and pillars

**Premise:** you work for a research agency, flying a survey ship from the Sun and planets out to nebulae, clusters, galaxies, and black holes. You complete missions, scan objects, fill a Logbook, and earn ranks and upgrades.

**Audience (working assumption):** ages 12 to adult, with a gentle start and optional Advanced data for experienced players. Medium difficulty overall.

**Design pillars**

1. **Discover, don't read.** Facts are earned by scanning real objects.
2. **Scale is the star.** Players should feel distances, not just see numbers.
3. **Honest science.** Every visual is labeled Observation, Artist's Concept, or Simulation.
4. **Beginner first, depth on demand.** Each info panel has a Quick facts tab and an Advanced data tab.

**Game modes**

| Mode | Purpose |
| --- | --- |
| Flight School | A playable 5-minute tutorial covering movement, scanning, and the Logbook |
| Guided Missions | Structured science tasks with objectives and a final question |
| Free Explore | No objectives, with the whole unlocked cosmos open |
| Observatory Console | Telescope mode: filters, magnitude, light pollution, angular size |

## Core gameplay loop

Each loop takes about 3 to 8 minutes, which suits both mobile and desktop play.

1. **Choose a mission** from the Missions menu.
2. **Travel** to a destination on the Star Map. The ship warps and the scale bar updates.
3. **Scan objects:** select one and hold SCAN to receive measurements.
4. **Read the info panel:** Quick facts for beginners, Advanced data for depth, and an image-type label on every visual.
5. **Complete the objective** by answering a quiz or challenge that uses what you found.
6. **Get rewards:** XP, a Logbook entry, and possibly a rank-up, upgrade, or unlocked region.
7. **Repeat** with a new mission, or switch to Free Explore.

## Screens and navigation

| Screen | Purpose |
| --- | --- |
| Title | New Game, Continue, Settings, and Flight School |
| Exploration view | The 3D scene, the HUD, and clickable objects |
| Star Map | Choose destinations, with locked regions grayed out |
| Missions | Active and available missions with objectives |
| Logbook | Discovered objects, the encyclopedia, and quiz history |
| Observatory | Telescope mode |
| Ship | Rank, upgrades, achievements, and settings |

On desktop the info panel sits at the side. On phones the 3D view is full screen, a bottom bar holds the main buttons, and tapping an object slides up a bottom sheet.

**Desktop controls:** left-drag to look around, scroll or W/S to move, click to select, hold the SCAN button or Space to scan, M for the Star Map, Esc to go back. Touch controls are in the Touch-first navigation section below.

**Camera:** orbit and fly-to. Selecting an object flies the camera there over 2 to 4 seconds with an easing curve, then orbits around it. This is much easier to control than free flight, especially on a phone.

**Game state machine:** the game is always in exactly one state, which prevents impossible situations such as scanning while a menu is open.

| State | Can move to |
| --- | --- |
| BOOT | TITLE |
| TITLE | TUTORIAL, EXPLORE |
| TUTORIAL | EXPLORE |
| EXPLORE | MAP, MISSIONS, LOGBOOK, OBSERVATORY, SHIP, WARPING |
| MAP, MISSIONS, LOGBOOK, OBSERVATORY, SHIP | EXPLORE |
| WARPING | EXPLORE |

## Flight School (tutorial)

The tutorial is a scripted sequence of beats. Each beat has a prompt, a completion trigger, and a reward.

| Beat | Prompt | Completes when | Teaches |
| --- | --- | --- | --- |
| 1 | "Drag to look around." | Camera rotated about 45 degrees | Camera control |
| 2 | "Scroll or pinch to move closer to the Moon." | Distance to the Moon drops below a threshold | Zoom and navigation |
| 3 | "Tap the Moon to select it." | Moon selected | Object selection |
| 4 | "Hold SCAN until the ring fills." | Scan reaches 100% | Scan mechanic |
| 5 | "Open the Quick Facts tab." | Tab opened | Info panel |
| 6 | "Open your Logbook." | Logbook opened, with the Moon entry visible | Discovery log |
| 7 | Quiz: "What causes the Moon's phases?" | Any answer given | Quiz system |
| 8 | "Rank up! You're a Cadet." | Automatic | Progression |

- The player can skip the tutorial and replay it from Settings.
- A wrong quiz answer shows the explanation with no penalty, and a correct one gives bonus XP.
- Beat text lives in JSON, so wording can change without touching code.

## Scan mechanic

Scanning is the core action, so its rules are precise.

1. **Range check:** the object must be within scanner range, otherwise the HUD says "Move closer."
2. **Hold to scan:** a progress ring fills over 3 seconds (a default, adjustable per object type).
3. **Layered results:** each scan reveals data in tiers.
4. **Rewards:** a first scan of an object gives full XP, and a re-scan for a new tier gives less, so players are not rewarded for farming one object.

| Tier | Unlocked by | Example for Mars |
| --- | --- | --- |
| Basic | Any scan | Name, type, diameter, distance |
| Detailed | Scanner level 2 | Mass, orbital period, gravity |
| Spectral | Spectrometer upgrade | Temperature, atmosphere composition |

Visual effect: a holographic grid sweeps across the object while the ring fills, then a data panel assembles beside it. With Reduce motion on, the sweep becomes a simple fade.

## Progression

All numbers here are design choices to tune in play-testing, not facts. The aim is a rank-up every 20 to 30 minutes early on, slowing later.

**XP sources**

| Action | XP |
| --- | --- |
| First scan of an object (basic tier) | 20 |
| Higher-tier scan | 10 |
| Quiz correct, first try | 15 |
| Quiz correct, retry | 5 |
| Mission complete | 50 to 150 |
| Observatory challenge | 30 |

**Ranks**

| Rank | XP needed | Unlocks |
| --- | --- | --- |
| Cadet | 0 | Inner Solar System |
| Navigator | 200 | Outer Solar System, scanner level 2 |
| Surveyor | 600 | Kuiper Belt, Local Stars, Spectrometer |
| Astronomer | 1,400 | Nebulae, Clusters, larger telescope |
| Director | 2,800 | Galaxies, Extreme Objects |

Achievements add recognition, for example First Light (first scan), Comet Chaser, and Light-Year Traveller.

## Content catalog by region

This maps the astronomy scope onto unlockable regions.

| Region | Objects |
| --- | --- |
| Inner Solar System | Sun (sunspots, flares, solar wind), Mercury, Venus, Earth, Moon, Mars with Phobos and Deimos, asteroid belt (Ceres, Vesta) |
| Outer Solar System | Jupiter and the Galilean moons, Saturn (rings, Titan, Enceladus), Uranus, Neptune (Triton), a comet encounter |
| Kuiper Belt | Pluto and Charon, Eris, Makemake, Haumea |
| Local Stars | Proxima Centauri and its planet, Sirius, Betelgeuse, an exoplanet system with a habitable-zone world |
| Nebulae | Orion Nebula (star formation), Crab Nebula (supernova remnant), a planetary nebula (Ring or Helix) |
| Clusters | Pleiades (open cluster), Omega Centauri or M13 (globular cluster) |
| Galaxies | Andromeda, the Virgo galaxy cluster, a spiral and elliptical comparison |
| Extreme Objects | Crab Pulsar, a neutron star, Sagittarius A\* (the galaxy's central black hole), a stellar-mass black hole |

Each object's data carries an `imageType`:

- **Observation:** a real telescope image, with credit.
- **Artist's Concept:** where no photo exists, such as exoplanet surfaces and black hole close-ups.
- **Simulation:** computed visuals, such as orbits and the procedural Sun.

The label appears as a badge on every image and 3D view.

## Sample missions

Each mission is a JSON entry with an ID, required rank, objectives, and a final question, so the code stays generic.

| Mission | Region | Objectives | Concept taught |
| --- | --- | --- | --- |
| First Light | Inner | Scan the Moon, Earth, and Mars | Basics |
| Hot or Not | Inner | Scan Mercury and Venus, then answer which is hotter | The greenhouse effect: Venus is hotter despite being farther from the Sun |
| Moon Hunter | Outer | Find and scan all four Galilean moons | Moons and orbital mechanics |
| The Long Way Home | Kuiper | Scan Pluto and note the light travel time | Distance and light-time |
| Stellar Nursery | Nebulae | Scan the Orion Nebula and identify a protostar | Star formation |
| Death of a Star | Nebulae and Extreme | Compare the Crab Nebula and the Crab Pulsar | Supernovae and neutron stars |

## Observatory mode

This mode teaches real observational astronomy using real formulas.

- **Apparent magnitude:** a lower number is brighter, and a difference of 5 magnitudes is a 100 times brightness difference. The player sees this as a visibility meter.
- **Light pollution (Bortle scale):** sites run from Bortle 1 (pristine) to 9 (inner city). The faintest visible stars drop from about magnitude 7.5 under the darkest skies to about 4 in a city, and the game renders the same sky with more or fewer stars for the chosen site.
- **Angular size:** computed from diameter and distance, as shown below. This explains why a small nearby object can look larger than a huge faraway one.

```latex
\theta = 2 \arctan\left(\frac{d}{2D}\right)
```

Here d is the object's diameter and D is its distance.

**Filters**

| Filter | What it shows | Example |
| --- | --- | --- |
| Visible | What the eye sees | The Orion Nebula's soft glow |
| H-alpha | Ionized hydrogen glowing red | Star-forming gas stands out |
| Infrared | Dust-hidden stars | Stars inside dusty clouds |
| X-ray | Extremely hot or energetic objects | Black hole accretion, pulsars |

**Telescope mini-challenges**

1. **Can you see it?** Given an object's magnitude, aperture, and Bortle level, decide whether it is visible.
2. **Pick the filter.** Choose the best filter to reveal a given feature.
3. **Find it in the sky.** Identify a constellation, then star-hop to a target.

## Code structure and data flow

JSON content feeds a data loader that validates it, which feeds the game state, which drives both the 3D scene and the UI. Progress is saved through one save module.

**Planned project structure**

| Folder | Responsibility |
| --- | --- |
| `src/engine/` | Renderer, camera, quality manager, fallback chain |
| `src/shaders/` | Sun, atmosphere, nebula, star field, warp, and scanner effects |
| `src/game/` | Missions, XP and ranks, scanning logic, state machine |
| `src/save/` | The save service (IndexedDB, export/import, migrations) |
| `src/ui/` | HUD, info panels, Logbook, menus, tutorial prompts |
| `src/fallback/` | Canvas 2D star chart for devices without 3D |
| `data/` | `objects.json`, `missions.json`, `quizzes.json`, tutorial text |
| `assets/` | Textures, with a credits file |

**Events.** A small event system connects the modules, so the scanner does not need to know the Logbook exists.

| Event | Fired when | Listeners |
| --- | --- | --- |
| `object:selected` | The player selects an object | Info panel, camera |
| `scan:progress` | Each frame during a scan | HUD ring, scan effect |
| `scan:completed` | The ring reaches 100% | XP, Logbook, missions, save |
| `xp:changed` | XP is awarded | HUD bar, rank checker |
| `rank:up` | A threshold is crossed | Unlock manager, celebration UI |
| `mission:completed` | The final objective is done | XP, achievements, next-mission offer |
| `quality:changed` | The graphics profile shifts | Renderer, settings UI |

**Frame cycle (about 60 times per second):** read input, update the simulation (orbits, ship, scan progress), check game rules, render with post-processing, then measure the frame rate so the quality manager can adjust.

**Scale handling.** Game scale compresses distances so travel feels good. Real values appear in the info panels (distance, diameter, mass, temperature, orbital period, apparent magnitude, light travel time). Both come from the same JSON entry so they stay consistent.

**Data shapes.** TypeScript types catch data typos before the game runs. An object entry looks like this:

```ts
interface CelestialObject {
  id: string;            // unique key, e.g. "mars"
  name: string;          // display name
  type: "star" | "planet" | "moon" | "nebula" | "galaxy" | "blackHole";
  imageType: "observation" | "artistConcept" | "simulation";
  region: string;        // which region unlocks it
  quick: string;         // beginner summary
  data: Record<string, number | string>;  // measurements
  source: string;        // where the measurements come from
}
```

**Save record (example).**

```json
{
  "version": 1,
  "updatedAt": "2026-11-01T12:00:00Z",
  "xp": 340,
  "rank": "Navigator",
  "scannedObjects": { "moon": 1, "mars": 2 },
  "unlockedRegions": ["inner", "outer"],
  "missions": { "first-light": "complete", "hot-or-not": "active" },
  "settings": { "profile": "auto", "reduceMotion": false }
}
```

The `version` field lets a migration function upgrade old saves instead of breaking them.

**Errors and logging.** A failed JSON load shows a friendly error screen with Retry. A small `log()` helper writes to the console in development and stays silent in production.

## Mobile compatibility: short answer

Yes: Starbound Survey will run on iPhone and Android because it is a browser game with nothing to install. Players open a link in Safari (iPhone) or Chrome (Android). A few details need care, and flagging them now is cheaper than discovering them late.

## What works well

The core stack runs on both platforms without special handling.

| Feature | iPhone (Safari) | Android (Chrome) |
| --- | --- | --- |
| WebGL2 (main renderer) | Supported on iOS 15 and later | Supported on nearly all modern phones |
| Touch controls (drag, pinch, tap) | Yes | Yes |
| `localStorage` saves | Yes, with a caveat (see below) | Yes |
| Three.js, TypeScript, Vite | Fully compatible | Fully compatible |
| Add to Home Screen (full-screen, app-like) | Yes | Yes |

## Where phones differ

Nine differences from desktop need design work from Step 1.

1. **WebGPU support is uneven.** It depends on OS and browser version, and it is newer on iPhone than on Android. The plan is WebGPU where available, WebGL2 as the main fallback, and Canvas 2D last. Phones will most likely run WebGL2 in practice. Check current support at caniuse.com before relying on it.
2. **iPhone can clear saved data.** Safari may delete `localStorage` for sites the user has not visited in a while (roughly a week of inactivity under some privacy settings). Mitigations:
   - Encourage "Add to Home Screen," which is treated more kindly.
   - Add Export/Import save (a text code or file the player keeps).
   - Optional cloud saves in Phase 2 via Supabase.
3. **Phones are weaker than laptops.** Heavy bloom, big textures, and 100,000 stars can overheat a phone and drain the battery. The quality manager starts phones on Medium and lowers star count and effects if the frame rate drops. It also caps the pixel ratio, since rendering at full 3x density is wasteful.
4. **Memory limits.** Mobile browsers can reload a tab that uses too much memory. That is why we planned compressed textures and on-demand loading.
5. **Touch needs its own design.** There is no hover, so tooltips become taps. Buttons need to be at least about 44 px, and the Hold to SCAN button must sit where a thumb can reach it. Info panels become bottom sheets rather than side panels.
6. **Screen rotation and notches.** The UI must handle portrait and landscape and stay clear of notches and home bars, using CSS `safe-area-inset`.
7. **Browser gestures can interfere.** Pinch-zoom might zoom the whole page, and pull-down can refresh it. We disable both inside the game canvas with CSS `touch-action: none`.
8. **Audio needs a tap first.** iOS blocks sound until the player interacts, so music and effects start after the first tap on the title screen.
9. **Warp effects and motion comfort.** Fast streaks can be uncomfortable on a small screen held close, so the Reduce motion option matters here.

## Architecture decisions

The engine is Three.js, and every decision below is a first-version choice that can be revisited if testing disproves it.

| Decision | Choice | Why | Trade-off accepted |
| --- | --- | --- | --- |
| 3D engine | Three.js, used alone | Code-first and Git-friendly, the most shader examples, and the rendering stays in one module. PlayCanvas was evaluated and is the better fit only if a visual scene editor were wanted. | We build game structure (input, state, UI) ourselves. |
| Renderer | WebGPU first, WebGL2 fallback, Canvas 2D last resort | Newest tech where it works, with a reliable baseline everywhere else. | Two code paths to test. |
| Language and build | TypeScript + Vite | Catches data typos before runtime and keeps the build step nearly invisible. | A small learning curve. |
| UI | Plain DOM (HTML/CSS) over the canvas | Fewest dependencies, and bottom sheets and safe-area CSS work natively. | More manual wiring than a UI framework. |
| Content | JSON files, never hard-coded facts | Scientific data can be reviewed separately from game code. | Needs a validation step at load time. |
| Saves | IndexedDB, with export/import and optional cloud sync | Handles structured, larger data and supports a sync-ready design. | More code than a simple localStorage save. |
| Delivery | Progressive Web App (PWA) | Offline play, Add to Home Screen, and protection against iOS storage clearing. | A service worker to maintain and a cache that must be able to recover. |

One engine is used consistently. Babylon.js, PlayCanvas, CesiumJS, and WebAssembly are out of the first version.

## Graphics: renderer startup and quality profiles

The game picks a renderer at startup, then picks a profile, and can recover if either fails.

**Renderer startup sequence**

1. Check whether WebGPU exists in the browser.
2. Try to initialize the WebGPU renderer.
3. If it is missing or fails (error, lost device, or no adapter), switch to WebGL2 with the same scene.
4. If WebGL2 also fails, show the Canvas 2D star chart. Missions and data still work.
5. If the GPU is lost mid-session, rebuild the renderer once, restore the camera and scene state, and fall back one level if it happens again.
6. Log which path was chosen so test reports show it.

**Graphics profiles**

| Profile | Target | Intended devices | Settings |
| --- | --- | --- | --- |
| High | 60 FPS | Recent flagship phones, desktops | Full bloom, atmosphere and nebula shaders, full star count, high-resolution textures |
| Balanced | 30 to 60 FPS | Typical phones and tablets | Reduced bloom, no nebula volume, about half the stars, medium textures |
| Performance | 30 FPS minimum | Older or low-power devices | No post-processing, simple lighting, few particles, low render resolution |

The star counts and settings are starting values to tune in testing. Phones start on Balanced, desktops on High, and the player can override the profile manually in Settings.

**Techniques used to hold those targets**

- **Dynamic resolution scaling:** if the frame rate drops, render at a lower internal resolution first (for example 100% to 85% to 70%) before turning off effects. The pixel ratio is also capped at 2.
- **GPU instancing and efficient star rendering:** all stars are drawn as one batched points object, not 100,000 separate objects. Star count scales with the profile.
- **Compressed textures:** KTX2 (Basis) textures use less memory and load faster on phones than PNG or JPG.
- **Adaptive particle counts:** dust, solar wind, and warp streaks scale with the profile.
- **Background tab throttling:** rendering pauses when the tab is hidden.
- **Adaptive step-down rule:** if the average frame rate stays under the profile's target for 3 seconds, move down one level. A step back up needs a longer stable period to avoid flicker.

## Performance targets

These are design targets, not measured results. Each one gets a pass or fail in the testing log once a real device has been tried.

| Area | Target | How it is measured |
| --- | --- | --- |
| Sustained frame rate | 30 FPS minimum on the baseline phone, 60 FPS on capable devices | Frame-time log over a 20-minute session |
| Frame consistency | Fewer than 5% of frames over 50 ms | The same frame-time log |
| Memory | Under about 500 MB for the tab on the baseline phone, with no growth over a session | Browser dev tools memory profile, with a long-run check for leaks |
| First load | Playable scene in under 5 seconds on a typical mobile connection, first download under about 5 MB | Lighthouse and a throttled network test |
| Repeat load | Under 2 seconds once the PWA cache is warm | Same tools, second visit |
| Thermal behavior | No sustained frame-rate drop of more than 20% over 20 minutes, and no device overheating warning | A 20-minute continuous test on a real phone, noting the starting and ending frame rate |
| Stability | No crashes or tab reloads in a 20-minute exploration session | Manual and scripted play-through |

The memory and load numbers are first estimates. They are set before testing so that we can tell whether we hit them, and we adjust them with evidence.

## Touch-first navigation

The camera uses an orbit-and-fly-to model, so one finger is enough for most actions.

| Gesture | Action |
| --- | --- |
| One-finger drag | Rotate the camera around the selected object |
| Two-finger pinch | Zoom in and out |
| Single tap | Select an object |
| Double tap | Fly to and focus the selected object |
| Hold the SCAN button | Scan the selected object |
| Info panel handle | Drag the bottom sheet up for Advanced data |

Pan is left out of the first version, because the orbit camera does not need it. Long-press is also avoided, since it would conflict with Hold to SCAN.

**Configurable options (in Settings)**

- **Handedness:** left- or right-handed layout, which moves the SCAN button and the main controls to the matching side of the screen.
- **Sensitivity:** separate sliders for rotation and zoom speed.
- **Gesture toggles:** double-tap focus can be turned off if it triggers by accident.

**Rules**

- Every tappable control is at least 44 CSS pixels, and larger where practical.
- Information appears in bottom sheets, not side panels.
- `touch-action: none` is applied to the game canvas only, not the whole page. Menus and the Logbook scroll normally, and overscroll behavior is set so pull-down does not refresh the page during play.
- Every gesture has a keyboard or button alternative.

## Save system

Progress is stored locally first, and cloud sync is an optional layer added later. Switching from localStorage to IndexedDB does not by itself avoid Safari's clearing of unused site data, so the protection comes from several layers together.

| Layer | Purpose |
| --- | --- |
| IndexedDB | Main store for progress, scanned objects, and discovery records |
| localStorage | Small preferences only (profile, handedness, sensitivity) |
| Persistent storage request | The game asks the browser not to evict its data (`navigator.storage.persist()`), but the request can be declined, so nothing depends on it |
| Home Screen install | Installed web apps are exempt from Safari's inactivity clearing |
| Export/Import | A backup file or code the player can keep and restore |
| Supabase (optional, later) | Cloud sync across devices |

**Design rules that keep sync possible later**

- Every record carries a `version`, an `updatedAt` timestamp, and a stable ID.
- All reads and writes go through one `SaveService` module, so the storage layer can change without touching game logic.
- Old saves are upgraded by a migration function and never discarded.
- A corrupted save is backed up, and the game starts fresh instead of failing.
- The game works fully with no account and no network.

On cloud sync, a conflict rule is needed before it ships, for example keeping the record with the later `updatedAt`. Accounts also raise privacy questions if younger players are expected, so that decision is deferred.

## Progressive Web App (PWA)

The game is installable and playable offline once its assets have been downloaded.

- **Web app manifest:** name, icons, full-screen display mode, and theme color for the Home Screen install.
- **Service worker:** caches the game shell (HTML, code, JSON data) up front, and caches large textures the first time they are used.
- **Versioned caches:** each release uses a new cache name, and old caches are deleted on activation.
- **Update flow:** a quiet "update available" prompt rather than a surprise reload mid-session.
- **Recovery:** if a cached file is missing or corrupt, the game re-fetches it, and falls back to a clear error screen with a Retry button if the network is also down.
- **Install hint:** an optional prompt explaining Add to Home Screen, shown once and especially on iPhone.

Push notifications are left out. The game does not need them.

## Responsive layout and accessibility

- **Layouts:** portrait phone, landscape phone, tablet, and desktop. Phones use bottom sheets, and desktop uses a side panel.
- **Safe areas:** CSS `env(safe-area-inset-*)` keeps controls clear of notches, rounded corners, and the home indicator.
- **Reduced motion:** a Settings toggle (defaulting to the device's own setting) turns off camera shake, warp streaks, and flashing effects.
- **Scalable text:** adjustable text size, with layouts that do not break at larger sizes.
- **Contrast:** text and controls meet WCAG AA contrast against the dark interface, and information is never conveyed by color alone.
- **Keyboard and screen readers:** every button is reachable by keyboard, with labels on controls and live announcements for scan results.
- **Audio:** sound starts after the first tap (an iOS requirement), and every sound has a mute option.

## Scientific accuracy rules

Visual effects must never change the facts shown to the player.

- **Data and visuals are separate.** Measurements (distance, diameter, mass, temperature, orbital period, apparent magnitude, light travel time) come only from the JSON data files, never from shader or rendering code.
- **Every visual is labeled** as Observation, Artist's Concept, or Simulation, with an image credit where one applies.
- **Compressed scale is disclosed.** Distances and sizes in the 3D view are scaled for playability. The info panel shows true values, and the HUD says when the view is not to scale.
- **Effects are decorative.** Bloom, the procedural Sun, and warp streaks are marked as artistic or simulated, not as observations.
- **Review step:** each data entry is checked against a cited source (for example NASA fact sheets) before it ships, and the source is stored with the entry.

## Do we need an app store app?

No. A browser game with Add to Home Screen meets the goal of "no installation required." If you ever want a store app, the same web game can be wrapped for iOS or Android (for example with Capacitor), but that adds developer accounts, review processes, and fees.

## Quick checks while building

You do not need a pile of devices.

1. **Desktop browser dev tools** have a phone-emulation mode for quick layout checks.
2. **Your own phone** is the real test. During development, Vite's local server can be opened from your phone on the same Wi-Fi network.
3. **The hosted link** (for example on Cloudflare Pages) lets you test the real site on both platforms.

Emulation does not reproduce real GPU performance, so a real-phone check at each build step matters.

## Testing strategy

Automated tests catch regressions on every change, and real devices catch what emulation cannot: GPU speed, heat, battery, and memory limits.

**Automated (run on every commit)**

- **Unit tests (Vitest):** orbital math, angular size, unit conversion, XP and rank rules, save migrations.
- **Data validation:** every JSON entry has required fields, a valid `imageType`, and a source.
- **Browser tests (Playwright):** the game loads and the select, scan, and save flow works in Chromium, WebKit (Safari's engine), and a mobile-emulated viewport, including a run with WebGL disabled to check the fallback.
- **Lighthouse:** load time, PWA installability, and accessibility checks.

**Physical devices (before each milestone)**

| Device category | What it checks |
| --- | --- |
| Older iPhone | Compatibility and the Performance profile |
| Recent iPhone | WebGPU and the High profile |
| Older Android phone | WebGL2 fallback and memory limits |
| Recent Android flagship | High-performance graphics |
| iPad or Android tablet | Touch and landscape layouts |
| Desktop Chrome | Full experience |
| Desktop Safari | Apple browser compatibility |

A few devices are enough to start, and borrowing a friend's phone counts.

**Acceptance criteria:** the performance targets above, plus no lost progress after closing the browser normally, no controls hidden by notches or the home indicator, and the game still playable offline after one online visit.

## Prototype gate

No full-scale implementation starts until this prototype is built, tested, and approved.

**Prototype scope**

- Earth, Moon, and Sun, with Earth and Moon orbiting on the compressed scale.
- Camera navigation: orbit, zoom, and fly-to on touch and desktop.
- Tap-to-select with an info panel (Quick facts and Advanced data) using real values from JSON, with an image-type label.
- The renderer fallback chain and the three profiles, switchable manually.
- A working save system: IndexedDB progress, export/import, and a reload test.
- Installable as a PWA and running on at least one real iPhone and one real Android phone.

**Gate to pass**

1. Performance targets measured on the real devices and recorded in the testing log below.
2. Save survives closing and reopening the browser, and an export restores correctly.
3. Fallback verified with WebGL disabled.
4. Open problems and trade-offs written up here, and a go or no-go decision made before the next phase.

## Dependencies

The list is kept short on purpose. Exact versions get pinned in `package.json` when the project is created.

| Dependency | Phase | Purpose |
| --- | --- | --- |
| Three.js | Prototype | 3D rendering (WebGPU and WebGL2) and KTX2 texture loading |
| TypeScript | Prototype | Typed code |
| Vite | Prototype | Dev server and build |
| Vitest | Prototype | Unit tests |
| Playwright | Prototype | Browser and mobile-emulation tests |
| A PWA plugin or Workbox | Prototype | Service worker and manifest generation |
| Supabase client | Later, optional | Cloud sync and accounts |
| LLM API through a Cloudflare Worker | Later, optional | Astronomy guide, with the key kept server-side |

The Three.js WebGPU renderer is still evolving, so its API is checked against the current documentation when we start rather than assumed.

## Performance trade-offs

| Choice | Benefit | Cost |
| --- | --- | --- |
| WebGPU with WebGL2 fallback | Best performance where supported | Two renderer paths to test |
| Dynamic resolution before dropping effects | Keeps the look sharp longer | Slight softness on weak devices |
| Compressed KTX2 textures | Less memory and faster loads | An extra asset-conversion step |
| Compressed game scale | Planets are visible and travel feels good | Not to scale, so it must be disclosed |
| IndexedDB plus export/import | More reliable, richer saves | More code than localStorage |
| PWA offline caching | Offline play and faster repeat loads | Cache versioning and recovery logic |
| Plain DOM UI | Few dependencies and native mobile behavior | More manual UI code |

## Testing log

No tests have been run yet, because nothing has been built. Results go here as each device is tried, newest first.

| Date | Device and browser | Renderer and profile | Frame rate | Memory | Result and notes |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Development roadmap

The prototype gate comes first. Each later step is built and tested on a real phone before the next one starts.

| Phase | Scope |
| --- | --- |
| 0. Prototype | Project setup and Git, then Earth, Moon, Sun, camera navigation, info panel, save system, and PWA on real devices. Ends at the gate. |
| 1. Playable core | Star field, all planets and orbits, click-to-select, scan and Logbook, XP and ranks, Flight School with the first 3 missions, then bloom, atmosphere, and warp effects, then the full quality manager and Canvas fallback |
| 2. Content | The remaining regions, missions, quizzes, and Observatory challenges, each checked against a cited source |
| 3. Online features | An AI astronomy guide through a Cloudflare Worker (the API key stays server-side, answers grounded in our JSON data), and optional Supabase accounts, cloud sync, and leaderboards |
| 4. Extras | WebXR planetarium mode |

## Common beginner mistakes

- Designing only on a desktop and "fixing mobile at the end." Layout and performance problems cost far more to fix late.
- Assuming a feature works because it works in Chrome on a laptop. Safari on iPhone is a different engine.
- Forgetting that mobile saves can disappear without an export option.

## Summary and next steps

Starbound Survey is a 3D astronomy exploration game built on a scan, learn, and reward loop, with a Flight School tutorial, regions that unlock by rank, and an Observatory mode. It will work on iPhone and Android through the browser, with WebGL2 as the reliable baseline. The engine is Three.js. The main design points are WebGPU with automatic fallback, three adaptive graphics profiles, measurable performance targets, touch-first controls, IndexedDB saves with export/import, and an installable offline PWA. Scientific data stays separate from visual effects, and a validated prototype comes before any full build. Mobile is built in from Step 1 rather than patched in later.

Two questions are still open before building starts:

- [ ] Do you approve this specification, or is there anything to change before the prototype starts?
- [ ] Where should the project be built: in a folder on your computer (add one from the "+" menu in the desktop app), or here with the finished project sent to you?

If you tell me which phone you will test on (iPhone model or Android brand), I can tune the quality defaults for it.
