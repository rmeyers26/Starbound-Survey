# Phase 1 progress (playable core)

Phase 1 is built in slices, each tested and merged on its own. **Gate exception:** the spec says Phase 1
starts only after the prototype passes real-phone testing. That testing has not happened yet. Phase 1 was
started early at the owner's request on 2026-11-02; the Phase 0 gate (see `GATE_REPORT.md`) is still open.

| Slice | Contents                                                                                  | Status                                                                                                                                                                                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Game state machine, scan mechanic, scan tiers, XP and ranks, Logbook, tap-to-scan setting | **Done** (this slice)                                                                                                                                                                                                                                                                         |
| B     | Flight School tutorial (8 beats), quizzes (bonus XP), first 3 missions                    | Not started                                                                                                                                                                                                                                                                                   |
| C     | All planets, moons, belts and orbits with cited data                                      | **Done** for the planets, 17 major moons (Phobos, Deimos, the Galilean four, Saturn's seven big ones, Uranus's five, Triton), Ceres, Vesta and the asteroid belt (data unverified, see `DATA_CHECK.md`). Not done: a comet, the Kuiper Belt region (Pluto and others), the many smaller moons |
| D     | Visual effects: bloom, atmosphere, warp (with Reduce motion fallbacks)                    | **Done** (bloom, atmosphere haze, warp streaks). Not done: nebula shaders (Phase 2 content), sun surface detail                                                                                                                                                                               |
| E     | Full quality manager review and Canvas fallback parity                                    | Not started                                                                                                                                                                                                                                                                                   |

## Slice A: how the pieces fit

```
SCAN button / Space key --(scan:request)--> ScanController --(checks)--> checkScan (pure rules)
                                               |  every frame: still in range? still selected? still EXPLORE?
                                               v
                                          applyScan (pure scoring) --> SaveService (IndexedDB)
                                               |
   events: scan:progress, scan:completed, xp:changed, rank:up, progress:changed
                                               v
                         SCAN ring, XP bar, info panel (unlocks data), Logbook, rank-up message
```

Design choices (all tunable numbers are in one place each):

- **Rules are pure functions** (`src/game/scanner.ts`, `scoring.ts`, `ranks.ts`, `tiers.ts`), so they are
  tested with exact numbers. `scanController.ts` is the only part that needs a clock and animation frames,
  and those are injected, so tests "run" a 3-second scan instantly.
- **Scan range** is twice the camera's focus distance for an object (`src/engine/scale.ts`), so flying to an
  object always puts it in range, while the overview is always too far. The 2D fallback approximates distance
  from its zoom level.
- **XP** (spec table): first scan 20, deeper tier 10, repeat scan 0 (no farming). The scan is blocked with a
  message instead of wasting the player's time when there is nothing new to learn.
- **Tiers:** each measurement in `data/objects.json` has a `tier` (basic, detailed, spectral). Cadet scans reveal
  basic only; Navigator adds detailed; Surveyor adds spectral.
- **Saves:** `scannedObjects` (deepest tier per object), `xp`, `rank`, `unlockedRegions` were already in the save
  format, so no migration was needed.
- **Accessibility:** a "tap once to scan" setting avoids having to hold a button; the button's accessible name is
  its visible text (WCAG "label in name"); notifications never cover the SCAN button.

## Known limits of slice A

- **The first rank-up is now reachable:** ten objects at 20 XP for a first scan is exactly the 200 XP Navigator needs
  (an end-to-end test scans all ten). Navigator unlocks the Outer Solar System: Jupiter, Saturn, Uranus and Neptune now appear. Reaching Surveyor (600 XP) needs
  more than the 14 first scans available (280 XP), so the XP sources of slices B and C (quizzes, missions, moons) are still needed.
- Detailed and spectral scans cannot be done until a player reaches Navigator, for the same reason.
- The scan has no 3D holographic sweep yet (slice D). The ring on the button is the only progress effect.
- Left-handed layout (spec) is not built; the SCAN button is bottom-right.
- `?scanSeconds=0.3` in the address shortens scans (used by the automated tests); it also works for players.

## Slices C and D: what was built and the choices behind it

**Slice C (content)**

- Seven moons (Io, Europa, Ganymede, Callisto, Titan, Enceladus, Triton) join their planets in the Outer Solar System,
  so they unlock at Navigator. Triton orbits **backwards**, as in real life.
- Fast moons are drawn with slowed laps (3 to 11 seconds) so none is a blur. Order of speed around each planet is true.
- A decorative asteroid belt of up to 3,000 dots (one draw call, fewer on weaker graphics levels).
- With 21 objects, **Surveyor (600 XP) is now reachable**: 21 x (20 first-scan + 10 detailed-scan) = 630 XP. A test guards it.

**Slice D (effects)**, each tied to the graphics profile (spec table) and none of them a measurement:

| Effect                              | High | Balanced                    | Performance                           | Reduce motion                   |
| ----------------------------------- | ---- | --------------------------- | ------------------------------------- | ------------------------------- |
| Bloom (glow around the Sun)         | full | reduced (half-size, dimmer) | off, and the code is never downloaded | no change (it does not move)    |
| Atmosphere haze (8 worlds with air) | on   | on                          | off                                   | no change                       |
| Warp streaks (long flights only)    | on   | on                          | off                                   | **off** (the flight is instant) |

- Bloom is a separate 19 KB download (about 5 KB compressed), fetched only when the profile needs it.
- Warp strength depends on how far the flight goes: short hops (Earth to the Moon) get none.
- The 2D fallback chart has none of these effects, by design (it is a simplified chart).

**Practice mode** (added after slice D): a Settings option that unlocks every region and every scan level with no XP,
without touching saved progress (see `game/practice.ts`). It is a learning and exploring tool, and a handy way to see
the whole game while the quizzes and missions (slice B) are still unbuilt.

**Still ahead:** slice B (Flight School, quizzes, first 3 missions), slice E (quality-manager review, 2D parity).
