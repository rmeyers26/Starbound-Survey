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

## More moons: Saturn's mid-sized moons and Uranus's five big moons

**Status: UNVERIFIED**, entered from memory. Sources to compare with: NASA's Saturnian and Uranian Satellite Fact
Sheets (NSSDC) and JPL's "Planetary Satellite Physical Parameters" (ssd.jpl.nasa.gov/sats/phys_par/). The two
sources **disagree** in places for the Uranian moons, especially mass and distance; the game uses the JPL-style
values below. Pick one source and make all of them match it.

| Value (as entered)                | Mimas     | Tethys    | Dione     | Rhea      | Iapetus   | Checked? |
| --------------------------------- | --------- | --------- | --------- | --------- | --------- | -------- |
| Mean diameter (km)                | 396.4     | 1,062.2   | 1,122.8   | 1,527.6   | 1,468.2   | [ ]      |
| Mass (kg)                         | 3.7493e19 | 6.1745e20 | 1.0955e21 | 2.3065e21 | 1.8056e21 | [ ]      |
| Average distance from Saturn (km) | 185,540   | 294,620   | 377,400   | 527,100   | 3,561,300 | [ ]      |
| Orbital period (days)             | 0.942422  | 1.887802  | 2.736915  | 4.5175    | 79.3215   | [ ]      |
| Surface gravity (m/s²)            | 0.064     | 0.146     | 0.232     | 0.264     | 0.223     | [ ]      |
| Mean density (kg/m³)              | 1,150     | 984       | 1,478     | 1,236     | 1,088     | [ ]      |

| Value (as entered)                | Miranda  | Ariel    | Umbriel  | Titania  | Oberon    | Checked? |
| --------------------------------- | -------- | -------- | -------- | -------- | --------- | -------- |
| Mean diameter (km)                | 471.6    | 1,157.8  | 1,169.4  | 1,576.8  | 1,522.8   | [ ]      |
| Mass (kg)                         | 6.59e19  | 1.251e21 | 1.275e21 | 3.42e21  | 3.08e21   | [ ]      |
| Average distance from Uranus (km) | 129,390  | 191,020  | 266,300  | 435,910  | 583,520   | [ ]      |
| Orbital period (days)             | 1.413479 | 2.520379 | 4.144176 | 8.705867 | 13.463234 | [ ]      |
| Surface gravity (m/s²)            | 0.079    | 0.269    | 0.2      | 0.379    | 0.347     | [ ]      |
| Mean density (kg/m³)              | 1,200    | 1,592    | 1,459    | 1,662    | 1,559     | [ ]      |

Quick-facts text to check: Mimas's crater Herschel being "about a third as wide as Mimas"; Tethys's canyon Ithaca Chasma
running "most of the way round"; Dione's "possible ocean" (a hint, not a confirmation); Iapetus's two faces and its
"20 kilometre" equatorial ridge; Miranda looking "smashed apart and put back together"; Ariel "the brightest" of the
big Uranian moons; Umbriel "the darkest" and the bright ring in the crater Wunda; Titania and Oberon being named
after the fairy queen and king in Shakespeare's _A Midsummer Night's Dream_.

**Mercury and Venus have no moons** (that is real, not a gap in the game). Earth has the Moon, Mars two, and each
giant now has several. Many dozens of smaller moons are not in the game.

## How fast the orbits are drawn (and why you are told)

At the game's speed (3 simulated days per second) Jupiter would take 24 minutes to go round the Sun and Neptune
5 and a half hours, so the outer planets looked frozen. Each far-out world is now drawn with a **faster** lap, and
each very fast moon with a **slower** one, always keeping the true order of speeds.

The outer laps must not be squeezed into the same few minutes, or the planets drift round as one pack (an earlier
version did: Jupiter 5.3 minutes, Neptune 7.3, although Neptune really takes 14 times longer). Beyond Mars the drawn
lap grows roughly as the real lap raised to the power 0.4 (about 14 times slower for real becomes about 3 times
slower on screen). The speeds are still compressed, but each planet keeps its own and the gaps between neighbours stay
clearly visible:

| World   | Real orbit | Drawn lap | Drawn as                   |
| ------- | ---------- | --------- | -------------------------- |
| Vesta   | 3.6 years  | 5 min     | 1.5 times faster than real |
| Ceres   | 4.6 years  | 5.5 min   | 1.7 times faster           |
| Jupiter | 11.9 years | 8 min     | 3 times faster             |
| Saturn  | 29.5 years | 11.5 min  | 5 times faster             |
| Uranus  | 84 years   | 17.5 min  | 10 times faster            |
| Neptune | 165 years  | 23 min    | 15 times faster            |

The planets from Mercury to Mars, the Moon and Iapetus keep their true speed. Whenever an orbit is drawn at a
different speed, the info panel says so ("Its orbit is drawn about 15 times faster than real, so you can watch it
move"), and a test checks that every changed orbit has that explanation.

## The Sun's layers (Layers tab)

The seven layers come from NASA's description of the Sun's structure, whose text the project owner pasted into the
chat. The **summary** line of each layer is that NASA wording (lightly punctuated). I recognise the wording as NASA's,
but the original page address is **not confirmed**, so the game says so under the tab ("not yet confirmed"). Please find
the page, confirm the wording, and add its address to `layersSource` in `data/objects.json`.

Everything I added is in the **detail** line and in the picture. It comes from general solar-physics knowledge, not
from the pasted text, so please check each one:

| Layer             | Added detail (from memory)                                                                                                                                           | Checked? |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| The Core          | about 15 million °C; the inner quarter of the Sun's radius; about 600 million tonnes of hydrogen turned into helium every second                                     | [ ]      |
| Radiative Zone    | light is absorbed and re-emitted again and again; energy takes tens of thousands of years or more to cross                                                           | [ ]      |
| Convection Zone   | hot gas rises, cools and sinks like boiling water; granules about 1,000 km, supergranules about 30,000 km                                                            | [ ]      |
| Photosphere       | a few hundred km thick; about 5,500 °C; nearly all visible light; sunspots are cooler, darker patches                                                                | [ ]      |
| Chromosphere      | "sphere of colour"; red-pink flash at a total eclipse; a few thousand km thick                                                                                       | [ ]      |
| Transition Region | temperature leaps from tens of thousands of degrees to about a million; seen in ultraviolet                                                                          | [ ]      |
| Corona            | over a million °C; millions of km into space; visible to the naked eye only at a total eclipse; source of the solar wind; why it is so hot is still being worked out | [ ]      |

**The picture's proportions** (also from memory): the core reaches about 25% of the Sun's radius, the radiative zone about
70%, and the convection zone the rest (so inside the Sun the bands are drawn to scale). The atmosphere layers are far thinner
than the picture shows, so they are drawn thicker on purpose (the caption says so).

**Game design choices (not facts):** the four atmosphere layers are revealed by a basic scan (they can be seen from
outside), the convection and radiative zones by a detailed scan (Navigator), and the core by a spectral scan (Surveyor).
Practice mode reveals them all. Only the Sun has layers so far; Earth (crust, mantle, core) and the gas giants could use the
same Layers tab later.

## Comet C/2026 A2 (Bok)

**Status: PARTLY CHECKED. The numbers below came from two secondary web pages, not from NASA/JPL itself, and most
values are missing.** The development container could not reach `ssd-api.jpl.nasa.gov`, `theskylive.com` or
`lesia.obspm.fr` (the network blocked them), so the orbit could only be read from a web search's summary of two
pages. The game says so in the info panel's source line. Please compare each number with JPL's own page and tick it off.

How to check: open
https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=C%2F2026%20A2 (JPL Small-Body Database) and compare.

| Value (as entered)                         | Entered as                     | Where it came from                                                                                                      | Checked? |
| ------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| Perihelion distance (closest to the Sun)   | 1.94 AU                        | LESIA comet database, record 31828                                                                                      | [ ]      |
| Inclination (orbit tilt)                   | 82 degrees                     | LESIA comet database, record 31828                                                                                      | [ ]      |
| Eccentricity (orbit shape)                 | 0.99761492 (epoch 2026 May 26) | JPL orbit data, as quoted by TheSkyLive                                                                                 | [ ]      |
| Orbital period                             | "about 23,000 years"           | **Calculated by the game**: a = q / (1 - e), period = a^1.5 years. Not published; very uncertain for an orbit like this | [ ]      |
| Date of closest approach (perihelion date) | **Not yet checked** (missing)  | not found                                                                                                               | [ ]      |
| Size of the nucleus                        | **Not yet checked** (missing)  | not found                                                                                                               | [ ]      |
| Longitude of the ascending node            | **Not yet checked** (missing)  | not found; **drawn as 0 degrees**                                                                                       | [ ]      |
| Argument of perihelion                     | **Not yet checked** (missing)  | not found; **drawn as 0 degrees**                                                                                       | [ ]      |

Also worth checking: the comet's name and discoverer (the page title said "C/2026 A2 (Bok)"; nothing else about the
discovery was found), and whether its eccentricity is really just under 1 (LESIA listed it as exactly 1, a parabola,
which would make the orbit open and never return; the game draws the JPL value, a very long closed orbit).

### How it is drawn (honest display choices)

- **The shape is real; the direction is a placeholder.** The perihelion distance, eccentricity and tilt are the entered
  numbers. The two missing angles say which way the orbit points, so the game draws both as 0 degrees. The comet's
  real path will point somewhere else: change `nodeDeg` and `argPerihelionDeg` in `src/engine/scale.ts` once checked.
  The info panel says "Not yet checked (drawn as 0 degrees for now)" next to each.
- **It is a replay.** A real comet like this passes the Sun once and does not come back for thousands of years, so the
  game replays the part of the flyby inside 3.5 AU on a loop (about 85 seconds at the game's clock, 3 days a second),
  fading in and out at the ends. The speeds follow Kepler's laws (fastest at the closest point). The game's clock is not
  tied to real dates, so this is not "where the comet is today".
- **Distances are compressed** like the planets' (a comet at Earth's distance is drawn where Earth is).
- **The tail is decorative.** It always points away from the Sun and is longest at the closest point, but its real
  length and brightness depend on how active the comet is, which the game does not know. Seen from far away, the glow
  and tail are drawn a little bigger so the comet can be found.
- **The nucleus is a lumpy, faceted "dirty snowball"** (dark crust with patches of bright ice, stretched like a peanut,
  as real comet nuclei are). Its size and shape are NOT known, so the size and shape mean nothing.
- **The broken rocks and ice** (about 140 pieces circling the nucleus and streaming into the tail) are decorative.
- **The tail is drawn for the whole replay**, longer nearer the Sun, because many real comets are already active well
  beyond 3 AU.

## Missions (data/missions.json)

**First mission: "Where does the Moon's light come from?"** Scan the Sun and the Moon, then answer a multiple-choice
question. The right answer is "The Moon reflects light from the Sun."

- **What it rests on.** The game's own entries say the Sun's "light and heat make life on Earth possible" and that the
  Moon's phases come from "how much of its sunlit half we can see". Both come from the NASA fact sheets already cited
  on those objects.
- **What is NOT checked.** The question, its four choices and the explanation (including the sentence about
  **Earthshine**, sunlight bounced off Earth lighting the Moon's dark side) are standard textbook astronomy that I wrote.
  I have **not** checked them against a specific NASA page, and the network here is restricted. The mission's source
  line says so on screen. **To check:** compare the explanation with NASA's Moon pages (for example the Moon overview
  and Earthshine pages) and tell me if any wording should change.
- **The rewards are design choices, not facts:** 50 XP for finishing plus 15 XP for a correct first answer (5 XP for a
  correct retry). The spec's range for a mission is 50 to 150 XP.
- **The wrong answers are plausible mistakes**, not jokes: the Moon makes its own light, it reflects Earth's cities
  and oceans, it glows because it is hot.
