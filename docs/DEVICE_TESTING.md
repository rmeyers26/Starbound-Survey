# Testing on a real phone

A few devices are enough to start; borrowing a friend's phone counts. Do each step on **one iPhone and
one Android phone**, and write the results into `docs/TESTING_LOG.md`.

## 1. Get the game onto the phone

**Option A, quickest (same Wi-Fi as your computer):**

```bash
npm run dev -- --host
```

Open the "Network" address it prints (for example `http://192.168.1.20:5173`) in Safari or Chrome on the
phone. Note: the dev server does not register the service worker, so it cannot test install or offline.

**Option B, needed for install and offline tests:** deploy the production build to a real HTTPS address.
This project is set up for **Netlify** (`netlify.toml` holds the build settings). Netlify's deploy previews give
each branch its own address, so you can test a change on your phone before merging it. Browsers only allow
installing and offline play on HTTPS.

## 2. Turn on the frame-rate readout

Open **Settings**, tick **Show frame rate**. The bottom-left shows, for example
`58 fps · High 100% · webgl2 · slow 1.2%`. That tells you the frame rate, the quality level the game chose, the share of frames that took over 50 ms (target: under 5%), and the
renderer in use (`webgl2` or `canvas2d`).

## 3. Checklist

Tick each one and note anything odd.

**Basics**

- [ ] Game loads in under about 5 seconds and shows the Sun, Earth and Moon moving.
- [ ] Readout says `webgl2` (if it says `canvas2d`, note the phone model and OS version).
- [ ] Which quality level did "Auto" settle on after 30 seconds? (Write it down.)

**Touch**

- [ ] One-finger drag rotates the view smoothly.
- [ ] Two-finger pinch zooms the **game**, not the whole page.
- [ ] Tapping the Moon (small!) selects it on the first or second try.
- [ ] Double-tap on an object flies the camera to it.
- [ ] Pulling down on the screen does **not** refresh the page.
- [ ] Info panel appears as a sheet from the bottom; swiping its handle up shows more.
- [ ] No buttons hidden behind the notch or the home bar. Try both portrait and landscape.
- [ ] No button feels too small to tap.

**Motion**

- [ ] The row of object buttons scrolls sideways with one finger (ten buttons, one line) and tapping one scrolls it into view.
- [ ] Phobos and Deimos are visible circling Mars (Phobos faster); neither is a blur.
- [ ] Seen from above, every planet circles the Sun **counter-clockwise**, and the Moon circles Earth the same way.
- [ ] The Moon takes about 9 seconds to go once round Earth and always shows the same face to Earth.
- [ ] Nothing looks frantic or frozen.
- [ ] Tap a planet: the Sun stays on the same side of it (it does not swing round), and only the stars drift.
- [ ] Tap the Moon: its surface stays still on screen while its lit part changes through the phases.

**Notifications**

- [ ] Turn practice mode on and off a few times in a row: never more than two messages show, and the Settings button is never hidden under them.

**The Sun's layers**

- [ ] Select the Sun: a third tab, **Layers**, appears (no other object has it). Before any scan it asks you to scan the Sun.
- [ ] After a basic scan the picture shows four coloured outer rings and dark unlit inner ones, and the list names the Photosphere, Chromosphere, Transition Region and Corona, with "A hidden layer" for the rest.
- [ ] With Practice mode on, three scans reveal all seven layers, the core in the middle of the picture.
- [ ] On a phone, the three tab names fit on one line and the sheet scrolls to the end of the list.

**Practice mode** (Settings)

- [ ] Switch **Practice mode** on: a gold "Practice" badge replaces the XP bar and Jupiter, Saturn, Uranus and Neptune appear straight away.
- [ ] Scan Jupiter three times: each scan reveals deeper data, the message says "Practice scan: no XP", and the badge never changes.
- [ ] Switch it off: the XP bar returns with your real XP, and the outer planets are locked again (if you are still a Cadet).
- [ ] Close the browser, reopen: practice mode is still on, but the practice scans are gone.

**Visual effects (graphics quality levels)**

- [ ] High or Balanced: the Sun has a soft glow. Settings > Graphics quality > Performance removes it.
- [ ] **Frame rate with effects on.** Note the frame rate on Balanced (phones start here) with the effects, then on
      Performance. If Balanced is clearly slower, tell me: bloom is the first thing to trim.
- [ ] Earth, Venus and the giants have a thin glowing edge on the side facing the Sun.
- [ ] Tap Ceres from the overview: streaks rush past during the flight, then stop. Tap the Moon from Earth: no streaks (a short hop).
- [ ] With **Reduce motion** on (Settings), no streaks appear and flights are instant.
- [ ] After the rank-up the outer planets visibly creep round the Sun (Jupiter about 8 minutes a lap, Neptune about 23) and their info panel says the orbit is drawn faster than real.
- [ ] **Goal line.** A new game shows "Goal: Welcome, Cadet! Tap Earth..." under the XP bar. Tapping it flies to Earth. After a scan it names the next object. It does not cover any button, also on your smallest phone, and it disappears in practice mode.
- [ ] **Missions.** A **Missions** button sits beside Logbook and Settings. Opening it shows "Where does the Moon's light come from?" with two unticked objectives and no question. After you scan the Sun and the Moon the Goal line says "Mission ready", tapping it opens the question, and all four answers are easy to tap and fully on screen. A wrong answer shows the explanation and costs no XP; the right one says "Mission complete" and the XP bar moves. Close and reopen the game: it is still complete.
- [ ] **Achievements.** The first scan shows "Achievement earned: First Light." The Logbook lists 10 achievements with the earned ones marked.
- [ ] **Planets do not move in step.** At the start no two planets are in a straight line with the Sun. Watch Mercury, Venus
      and Earth for a minute: Mercury clearly gains on Venus, and Venus on Earth. After the rank-up, Jupiter, Saturn, Uranus
      and Neptune each creep at their own pace (Neptune the slowest). The four big moons of Jupiter are spread round it.
- [ ] Uranus and Saturn each have a family of moons orbiting them; Uranus's five go round it quickly.
- [ ] The asteroid belt is a band of dots between Mars and Jupiter and turns slowly.
- [ ] After the rank-up, the moons of Jupiter, Saturn and Neptune orbit their planets; Triton goes the opposite way to the others.

**Regions**

- [ ] On a new save the Jupiter, Saturn, Uranus and Neptune buttons are dim with dashed borders and the outer planets are not drawn.
- [ ] Tapping a locked button shows "... Reach Navigator to unlock it." and selects nothing.
- [ ] After the rank-up the planets appear, the camera pulls back, Saturn's rings are visible, and you can scan Jupiter.

**Scanning (press and hold)**

- [ ] Fly to the Moon (tap its name), then press and hold SCAN for 3 seconds: the ring fills and you earn 20 XP.
- [ ] Holding the button does **not** pop up a text-selection or copy/share menu.
- [ ] The page does not scroll or zoom while you hold.
- [ ] Letting go early cancels the scan with no reward.
- [ ] Settings > "Tap once to scan" works with a single tap.
- [ ] The SCAN button is not covered by the notch, the home bar, or a message, in portrait and landscape.
- [ ] Close and reopen the browser: the XP is still there.

**Surface images** (only once `assets/textures/` has files; see `docs/TEXTURES.md`)

- [ ] The Moon shows a real surface (grey with darker patches), not a plain grey ball.
- [ ] Mars shows a real surface (rusty, with dark patches and a bright basin), not a plain orange ball.
- [ ] The same face of the Moon always points at Earth as it orbits.
- [ ] The frame rate with the image is still near 60 (note it before and after if you can).
- [ ] Settings > Graphics quality > Performance still looks acceptable.

**Spacecraft** (tap **Pilot ship**, bottom left)

- [ ] The ship appears where the camera was, with no jump. You can see the ship above the controls (not hidden behind them).
- [ ] The ship looks like detailed hardware (panel seams, a glossy canopy, gold foil, twin engines, solar panels, a dish) in the Chase, Orbit and Cinematic views, and its red and green wingtip lights blink.
- [ ] The first time you tap **Pilot ship** there may be a very short pause (the ship is built then): note how long it is. The frame rate while flying is still near 60.
- [ ] The engine flames grow when you raise the throttle, and are short when you reverse.
- [ ] Holding **+** speeds the ship up; letting go keeps the speed; **Stop** brings it to zero.
- [ ] Holding **◀** and **▶** turns the ship, and it stops turning the moment you let go (try with two fingers: one turning, one on **+**).
- [ ] **▲** and **▼** tilt the nose; dragging on the picture also steers in Chase and Cockpit.
- [ ] All five views work (Chase, Cockpit, Orbit, Map, Cinematic). In Orbit, dragging swings round the ship.
- [ ] Cinematic: the camera cuts between four shots about every 6 seconds, the black bars are thin, the object buttons at the top are still visible and work, and the ship is easy to see in every shot. Does it feel smooth, or does the cutting feel jarring?
- [ ] Cinematic with Settings > Reduce motion on: one still angle, no cutting.
- [ ] Tap an object button: the autopilot flies there, goes round the Sun if needed, and stops. "Arrived at ..." appears.
- [ ] Hold **SCAN** after arriving: the scan works. Fly away from the planet and the scan says "Move closer".
- [ ] With the info sheet open the steering pad hides but **Cancel flight** stays; closing the sheet brings the pad back.
- [ ] The frame rate while flying fast (with the warp streaks) is still near 60. Note it on High, Balanced and Performance.
- [ ] Nothing overlaps the SCAN button in portrait and landscape, and the page does not slide sideways.
- [ ] Settings > Reduce motion: the autopilot jumps straight to the planet and there are no streaks.
- [ ] Leave ship: the zoom / Overview / Logbook / Settings buttons come back and everything works as before.

**Comet C/2026 A2 (Bok)**

- [ ] The comet button sits right after Ceres. Tap it: the camera flies to a small dark dot with a soft glow.
- [ ] The nucleus looks like a lumpy, dark rock with bright ice on it (not a smooth round moon), with small pieces of rock and ice circling it and trailing behind.
- [ ] The tails (a blue one and a paler tan one) are there from the moment it fades in, point away from the Sun, and get longer as it nears the Sun.
- [ ] In the whole-system overview you can find the comet, its glow and its long path coming up from far below the planets.
- [ ] The info panel's Advanced data says "Not yet checked" for the missing values and lists where the numbers came from.
- [ ] Pilot ship, then tap the comet button: the autopilot catches it even though it moves, and you can scan it.
- [ ] The comet fades in and out at the ends of each loop (about every 85 seconds), with no jump you can see.
- [ ] Frame rate with the comet and its tails on screen is still near 60.

**Settings**

- [ ] The Settings window has a Close button at the top. Scroll the settings right down: the Close button stays at the top, in reach of your thumb.

**Saving**

- [ ] Select two objects. Close the browser completely, reopen: Settings shows 2 inspected.
- [ ] Export a backup (Settings), clear the site's data, reopen, import it: progress returns.
- [ ] iPhone: Share > Add to Home Screen. Open it from the Home Screen: full screen, progress still there.

**Fallbacks and offline**

- [ ] Visit once online, wait for "Ready to play offline", switch on airplane mode, reopen: it works.
- [ ] Settings > Graphics quality > Performance: still looks acceptable.
- [ ] Add `?renderer=canvas2d` to the address: the simplified chart works and shows the same data.

## 4. The 20-minute test (thermal and stability)

1. Settings: Graphics quality **Auto**, Show frame rate **on**.
2. Note the starting frame rate, the time, and the battery percentage.
3. Use the game continuously for 20 minutes (keep selecting objects and flying around).
4. Note the ending frame rate, battery percentage, whether the phone feels hot, and whether the tab
   crashed or reloaded.
5. Pass: frame rate fell by no more than 20%, no overheating warning, no crash.

## 5. Looking at memory

- **Android:** on a computer with Chrome, open `chrome://inspect`, connect the phone by USB, inspect the
  page, and use the Memory tab. Take a snapshot at the start and after 20 minutes.
- **iPhone:** on a Mac, enable Develop menu in Safari, connect the phone, Develop > your iPhone > the
  page > Timelines. Watch memory over 20 minutes.

## 6. Record the result

Add one row per device to `docs/TESTING_LOG.md`. Then fill in the final section of
`docs/GATE_REPORT.md` (go or no-go).
