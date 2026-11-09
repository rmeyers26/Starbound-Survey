# Is the game fun? A review, and what to do about it

Date of this review: 2026-11-09. It comes from reading the game's code and data and from playing it in a browser
(desktop and phone sizes). It has **not** been play-tested by real players on a real phone, so treat "fun" here as
informed opinion, not measurement.

## What already works

- **Looking and flying feel good.** Real data with sources, a flyable spacecraft with five views, a comet that replays
  its flyby, 20 moons, planets that move at their own speeds, and honest "Not yet checked" labels.
- **Scanning is a clear verb:** select, fly close, hold. Deeper scans unlock with rank.

## What gets in the way of fun (found in the code and data)

1. **Nothing tells a new player what to do.** There was no welcome, no "next step". The first screen is a model of the
   Sun and a row of 32 buttons. _Fixed in this slice: the Goal line._
2. **No recognition.** Scanning gave XP and a message, and nothing else. No milestones, no "well done".
   _Fixed in this slice: 10 achievements, toasts and a Logbook section._
3. **The XP ladder dead-ends.** All 32 objects together are worth at most **1,280 XP** (440 inner, 840 outer), but
   Astronomer needs 1,400 and Director 2,800. **The top two ranks cannot be reached with the current content.**
   _Not fixed: it needs more XP sources or more objects (see below). The Goal line now ends honestly ("you have scanned
   everything in the game so far") instead of leaving a dead end._
4. **Rank-ups announced empty places.** Surveyor says "New region unlocked: Kuiper Belt, stars", but no object lives
   in those regions yet. _Fixed: the message only names regions that contain objects._
5. **Missions, quizzes and achievements were in the spec but never built.** The save file has an empty `missions`
   slot waiting for them. _Achievements are done (derived from your scans, so no save change). Missions and quizzes are
   the biggest remaining gap._
6. **32 buttons in one scrolling row** is a lot to browse, especially on a phone.
7. **The outer planets are slow to watch** (Jupiter about 8 minutes a lap, Neptune about 23).

## What was built in this slice

- **Goal line** (`src/game/goals.ts` has the rules, `src/ui/goalChip.ts` the screen part). Always names the next step,
  and tapping it flies to the target. Hidden in practice mode (no XP there, so nothing to chase).
- **10 achievements**: First Light, Home Sweet Home, Rising Star, Inner System Surveyor, Comet Chaser, Giant Hunter,
  Moon Collector, Deep Look, Full Spectrum, The Whole System. They are worked out from what you have scanned, a toast
  appears when one is earned, and the Logbook lists all of them (locked ones say how to earn them). Practice scans
  never count.
- **Honest rank-up message** (`rankUpMessage`).

## Recommended next, in order

| #   | Idea                                                                               | Why it is fun                                       | Needs                                                           |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 1   | **Missions and quizzes** (spec: 15 XP per first-try answer, 50 to 150 per mission) | A reason to look at the data; teaches the science   | Written content, sources. Fixes the XP ceiling at the same time |
| 2   | **Rebalance ranks after #1** so every rank is reachable                            | Removes the dead end                                | #1 done first, then tune numbers                                |
| 3   | **Flying achievements** ("Grand Tour": arrive at every planet by ship)             | Rewards the spacecraft, which has no goal right now | Small: the ship already reports arrivals                        |
| 4   | **Fast-forward time control**                                                      | Watch the outer planets and moons really move       | Small to medium                                                 |
| 5   | **Group the object buttons** (by planet, with its moons)                           | Less scrolling, easier to find things on a phone    | Medium (layout work)                                            |
| 6   | **Content for the empty regions** (Pluto and the Kuiper Belt, nearby stars)        | Gives the higher ranks something to unlock          | Verified data from NASA or JPL; network access to check it      |
| 7   | **Sound and a photo mode**                                                         | Atmosphere, and something to share                  | Assets and licences                                             |

## Questions for the owner

- Should rank thresholds be lowered to match the content, or should missions supply the missing XP? (Recommended: missions.)
- Which missions would you like first? Suggested: "Where does the Moon's light come from?", "Which planet is the biggest?",
  "Find the comet".
