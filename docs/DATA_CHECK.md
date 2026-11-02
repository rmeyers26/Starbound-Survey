# Data check: Mercury, Venus and Mars

**Status: UNVERIFIED.** These values were entered from memory of NASA's planetary fact sheets, because
the development container could not read NASA's pages when they were added. One earlier error (the Sun's
diameter) was found this way, so please compare every number below with the cited page and tick it off.

How to check: open the page in the "Source" column, find the row, and compare. Differences in the last digit
are usually rounding; anything bigger needs fixing in `data/objects.json`.

| Object  | Source page (NASA NSSDC fact sheet)                              |
| ------- | ---------------------------------------------------------------- |
| Mercury | https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html |
| Venus   | https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html   |
| Mars    | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html    |

| Value (as entered)             | Mercury | Venus     | Mars      | Checked? |
| ------------------------------ | ------- | --------- | --------- | -------- |
| Mean diameter (km)             | 4,879.4 | 12,103.6  | 6,779     | [ ]      |
| Mass (kg)                      | 3.3e23  | 4.8675e24 | 6.4171e23 | [ ]      |
| Average distance from Sun (km) | 57.9e6  | 108.2e6   | 227.9e6   | [ ]      |
| Orbital period (days)          | 87.969  | 224.701   | 686.98    | [ ]      |
| Rotation period (hours)        | 1,407.6 | 5,832.5\* | 24.6229   | [ ]      |
| Surface gravity (m/s²)         | 3.7     | 8.87      | 3.73      | [ ]      |
| Mean surface temperature (K)   | 440     | 737       | 208       | [ ]      |

\* Venus spins backwards ("retrograde"). The fact sheet shows 5,832.5 hours with a minus sign; the game
shows the number and says "retrograde" in the label.

Things most likely to differ, because sources disagree:

- **Mars diameter and gravity.** The game uses the _mean_ diameter (6,779 km) to match Earth's "mean
  diameter" entry; NASA's headline figure is the _equatorial_ 6,792 km. Gravity is quoted as 3.71 or 3.73 in
  different places.
- **Mass.** The fact sheets round (for example 0.330e24 for Mercury); the game uses 3.3e23.
- **Mean temperature.** This is a global average and is defined differently on different pages.

The wording in each "Quick facts" paragraph (for example "the Sun would rise in the west" on Venus and
"tallest volcano in the Solar System" for Mars's Olympus Mons) should also be checked against NASA's
Venus and Mars pages.

## Phobos, Deimos, Vesta and Ceres

**Status: UNVERIFIED**, entered from memory (NASA's pages were unreachable). These four also have a weaker
source trail than the planets: I am not certain of the exact fact-sheet page addresses, so the `source` text
in `data/objects.json` names the NASA / JPL resource rather than a page address that may be wrong. Find the
right page and tighten the `source` field as you check.

| Value (as entered)                | Phobos       | Deimos        | Vesta         | Ceres         | Checked? |
| --------------------------------- | ------------ | ------------- | ------------- | ------------- | -------- |
| Mean diameter (km)                | 22.2         | 12.4          | 525.4         | 939.4         | [ ]      |
| Mass (kg)                         | 1.0659e16    | 1.4762e15     | 2.59e20       | 9.38e20       | [ ]      |
| Average distance from parent (km) | 9,376 (Mars) | 23,463 (Mars) | 353.3e6 (Sun) | 413.7e6 (Sun) | [ ]      |
| Orbital period (days)             | 0.31891      | 1.26244       | 1,325.8       | 1,681.6       | [ ]      |
| Rotation period (hours)           | n/a          | n/a           | 5.34          | 9.07          | [ ]      |
| Surface gravity (m/s²)            | 0.0057       | 0.003         | 0.25          | 0.28          | [ ]      |
| Mean density (kg/m³)              | 1,876        | 1,471         | 3,456         | 2,162         | [ ]      |

Where to look: NASA's Planetary Satellite Fact Sheet and JPL's "Planetary Satellite Physical Parameters" for the
two Mars moons; NASA Solar System Exploration pages and JPL's Small-Body Database for Vesta (4) and Ceres (1).

Notes and likely differences:

- **Diameters of Phobos and Deimos** are _mean_ values of lumpy shapes (Phobos about 27 x 22 x 18 km). The game
  draws them as spheres.
- **Distances** are semi-major axes. Mars's moons are measured from Mars's centre.
- **Mass of Vesta and Ceres** differs in the third digit between sources.
- The quick-facts text should be checked too: Phobos "slowly spiralling toward the planet", Deimos "looks smooth
  because loose dust has filled in many of its craters", Vesta "brightest asteroid in our sky" and the
  giant south-pole crater and Dawn visit in 2011 and 2012, Ceres "largest object in the asteroid belt", "the
  only dwarf planet in the inner Solar System" and bright salt patches.

## How these are drawn (honest display choices)

- **Phobos and Deimos are slowed on screen.** Phobos really circles Mars in 0.32 days, which at the game's speed
  is about 9 laps every second. They are drawn with display periods of 12 and 21 days (4 s and 7 s per lap)
  so you can see them. The info panel still shows the real periods. The order of speeds is true (Phobos fastest,
  then Deimos, then the Moon) and a unit test keeps it that way.
- Sizes and orbit distances are compressed, as for everything else. All objects are drawn as flat-colour spheres
  with no photos yet.
