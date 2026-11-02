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
