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
- [ ] After the rank-up the outer planets visibly creep round the Sun (Jupiter about 5 minutes a lap) and their info panel says the orbit is drawn faster than real.
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
