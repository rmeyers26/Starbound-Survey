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

**Option B, needed for install and offline tests:** deploy the production build to a real HTTPS address
(for example Cloudflare Pages, as in the spec). Browsers only allow installing and offline play on HTTPS.

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
