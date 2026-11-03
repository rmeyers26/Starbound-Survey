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

## Jupiter, Saturn, Uranus and Neptune

**Status: UNVERIFIED**, entered from memory. Source pages (NASA NSSDC fact sheets):

| Object  | Source page                                                      |
| ------- | ---------------------------------------------------------------- |
| Jupiter | https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html |
| Saturn  | https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html  |
| Uranus  | https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html  |
| Neptune | https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html |

| Value (as entered)                | Jupiter   | Saturn    | Uranus   | Neptune   | Checked? |
| --------------------------------- | --------- | --------- | -------- | --------- | -------- |
| Mean diameter (km)                | 139,822   | 116,464   | 50,724   | 49,244    | [ ]      |
| Mass (kg)                         | 1.8982e27 | 5.6834e26 | 8.681e25 | 1.0241e26 | [ ]      |
| Average distance from Sun (km)    | 778.5e6   | 1,432e6   | 2,867e6  | 4,515e6   | [ ]      |
| Orbital period (days)             | 4,332.59  | 10,759.22 | 30,688.5 | 60,182    | [ ]      |
| Rotation period (hours)           | 9.925     | 10.656    | 17.24\*  | 16.11     | [ ]      |
| Gravity at the 1-bar level (m/s²) | 24.79     | 10.44     | 8.87     | 11.15     | [ ]      |
| Temperature at 1 bar (K)          | 165       | 134       | 76       | 72        | [ ]      |

\* Uranus spins backwards ("retrograde"; its axis is tilted about 98 degrees). The fact sheet shows 17.24 hours with a
minus sign; the game shows the number and says "retrograde" in the label.

Notes:

- **Gas and ice giants have no solid surface.** Their "gravity" and "temperature" are quoted at the level where the
  air pressure equals 1 bar (about Earth's sea-level pressure), which is why the labels say so.
- **Mean diameter** is twice the volumetric mean radius (Jupiter 69,911 km, Saturn 58,232 km, Uranus 25,362 km,
  Neptune 24,622 km). Planets that spin fast are flattened, so the equatorial diameter is larger (Saturn: 120,536 km).
- **Rotation periods** of gas giants are defined by their magnetic fields or cloud tops and differ by source.
- Quick-facts text to check: Jupiter "more than twice the mass of all the other planets put together" and the Great
  Red Spot "wider than Earth ... watched for more than 150 years"; Saturn "less dense than water"; Uranus "tipped on
  its side" with methane giving the colour; Neptune "the farthest planet" with winds "more than 1,800 kilometres per hour".

## How the outer planets are drawn and unlocked

- **Locked until Navigator.** The spec unlocks the Outer Solar System at 200 XP. Until then the four planets are not
  drawn, cannot be tapped, and their buttons are dimmed and dashed (they still announce "locked" and explain how to
  unlock them when tapped). Rank-up makes them appear and widens the overview camera. Scanning also refuses locked
  objects as a second line of defence.
- **Saturn's rings** are a decorative flat disc (1.3 to 2.3 planet radii, tilted 26.7 degrees), not a measurement.
- **Distances are compressed hard**: Jupiter, Saturn, Uranus and Neptune are drawn at 140, 165, 190 and 212 units from
  the Sun (Earth is 60), where the true ratios would put Neptune 30 times farther out than Earth. The true ORDER and
  size order are kept and tested.
- All four are flat-colour spheres with no cloud bands yet.

## The outer moons: Io, Europa, Ganymede, Callisto, Titan, Enceladus and Triton

**Status: UNVERIFIED**, entered from memory. Sources to compare with: NASA's Jovian, Saturnian and Neptunian
Satellite Fact Sheets (NSSDC) and JPL's "Planetary Satellite Physical Parameters" (ssd.jpl.nasa.gov/sats/phys_par/).
As with the other moons, I am not sure of the exact fact-sheet page addresses, so the `source` text names the
resource instead of a link that might be wrong.

| Value (as entered)                | Io        | Europa    | Ganymede  | Callisto  | Titan     | Enceladus | Triton     | Checked? |
| --------------------------------- | --------- | --------- | --------- | --------- | --------- | --------- | ---------- | -------- |
| Mean diameter (km)                | 3,643.2   | 3,121.6   | 5,262.4   | 4,820.6   | 5,149.4   | 504.2     | 2,706.8    | [ ]      |
| Mass (kg)                         | 8.9319e22 | 4.7998e22 | 1.4819e23 | 1.0759e23 | 1.3452e23 | 1.08e20   | 2.139e22   | [ ]      |
| Average distance from planet (km) | 421,800   | 671,100   | 1,070,400 | 1,882,700 | 1,221,870 | 238,020   | 354,759    | [ ]      |
| Orbital period (days)             | 1.769138  | 3.551181  | 7.154553  | 16.689017 | 15.945421 | 1.370218  | 5.876854\* | [ ]      |
| Surface gravity (m/s²)            | 1.796     | 1.315     | 1.428     | 1.235     | 1.352     | 0.113     | 0.779      | [ ]      |
| Mean density (kg/m³)              | 3,528     | 3,013     | 1,942     | 1,834     | 1,881     | 1,609     | 2,061      | [ ]      |

\* Triton orbits Neptune backwards ("retrograde"). The game draws it going the opposite way round to every other
moon, and the label says "retrograde".

Quick-facts text to check: Io "hundreds of volcanoes" and tidal heating; Europa "possibly more water than all of
Earth's oceans put together"; Ganymede "bigger than Mercury" and "the only moon known to have its own magnetic
field"; Callisto "one of the most heavily cratered"; Titan "the only moon with a dense atmosphere" and methane and ethane
lakes; Enceladus water jets from the south pole; Triton "orbits backwards", "captured from the Kuiper Belt" and
nitrogen plumes seen by Voyager 2.

**How they are drawn:** real laps range from 1.4 to 17 days, a blur at game speed, so each moon is drawn with a
slowed display period of 9 to 33 days (3 to 11 seconds a lap). The info panel shows the real periods. The order
of speed around each planet is true and tested. They unlock with their planet at Navigator.

## The asteroid belt

A decorative band of up to 3,000 small dots between Mars and Jupiter (fewer on weaker graphics levels). It is **not
data**: the real belt holds millions of rocks, spread much more thinly than any picture can show. Ceres and Vesta are
the real, scannable members.
