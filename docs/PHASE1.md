# Phase 1 progress (playable core)

Phase 1 is built in slices, each tested and merged on its own. **Gate exception:** the spec says Phase 1
starts only after the prototype passes real-phone testing. That testing has not happened yet. Phase 1 was
started early at the owner's request on 2026-11-02; the Phase 0 gate (see `GATE_REPORT.md`) is still open.

| Slice | Contents                                                                                  | Status                                                                         |
| ----- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A     | Game state machine, scan mechanic, scan tiers, XP and ranks, Logbook, tap-to-scan setting | **Done** (this slice)                                                          |
| B     | Flight School tutorial (8 beats), quizzes (bonus XP), first 3 missions                    | Not started                                                                    |
| C     | All planets, moons, belts and orbits with cited data                                      | **Started:** Mercury, Venus, Mars added (data unverified, see `DATA_CHECK.md`) |
| D     | Visual effects: bloom, atmosphere, warp (with Reduce motion fallbacks)                    | Not started                                                                    |
| E     | Full quality manager review and Canvas fallback parity                                    | Not started                                                                    |

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

- With six objects the most XP available is 120 (6 first scans at 20 XP), so **the first rank-up (200 XP) still
  cannot be reached**. Four more inner-system objects (Phobos, Deimos, Ceres, Vesta, from the spec's list) would make it
  exactly 200. Rank-up logic, messages and region unlocks are unit-tested but not yet reachable in play.
  Slices B and C add the XP sources (quizzes, missions, more objects).
- Detailed and spectral scans cannot be done until a player reaches Navigator, for the same reason.
- The scan has no 3D holographic sweep yet (slice D). The ring on the button is the only progress effect.
- Left-handed layout (spec) is not built; the SCAN button is bottom-right.
- `?scanSeconds=0.3` in the address shortens scans (used by the automated tests); it also works for players.
