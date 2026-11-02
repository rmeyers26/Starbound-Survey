# Surface textures (NASA images)

The 3D view can wrap a real picture around a body, such as NASA's map of the Moon. The code for this is
finished and tested. **The NASA image itself has not been added yet**, because the development container's
network policy blocks NASA's servers. Until a file is added, the Moon is drawn as a plain grey sphere and
nothing breaks.

## How it works (short version)

- Image files go in `assets/textures/`, named `<body>-1k.jpg` and `<body>-2k.jpg` (for the Moon:
  `moon-1k.jpg` and `moon-2k.jpg`). "1k" is 1024 pixels wide, "2k" is 2048.
- The build finds them automatically. No code change is needed to switch a texture on.
- Phones on **Balanced** or **Performance** load the 1k file; **High** loads the 2k file. If only one size
  exists, every profile uses it.
- Files are cached for offline play, so keep each one **under 2 MB** or the offline cache skips it.
- The Moon is rotated so its near side (the face we see from Earth) always points at Earth, like the real
  Moon. This works if the map has 0 degrees longitude in the middle of the picture (NASA's do).

## Why JPEG and not KTX2

The spec prefers KTX2 (compressed textures that use less phone memory). That needs an extra conversion
tool and a decoder library. A 2k JPEG is simple, small to download, and fine for one or two bodies.
Revisit KTX2 when many large textures are added (Phase 1, slice C). The memory cost is still real: a 2k
by 1k picture occupies about 11 MB of GPU memory once loaded, so watch it in the device tests.

## Adding the NASA Moon map

NASA's images are generally in the public domain, but the spec still requires a credit and a label, so
record the source below.

**Source (recommended):** NASA Scientific Visualization Studio, "CGI Moon Kit",
<https://svs.gsfc.nasa.gov/4720>. It offers a colour map of the Moon built from the Lunar Reconnaissance
Orbiter's camera (LROC), in several sizes. Pick the **colour map** (not the elevation map). File names on
that page may change over time, so use the file the page describes as the colour map.

1. Download the colour map (the 2k or 4k version is plenty) on your computer.
2. Open it in any image editor (Preview on Mac works) and export as **JPEG** at **2048 x 1024**
   (save as `moon-2k.jpg`) and again at **1024 x 512** (save as `moon-1k.jpg`). Quality 80 to 85 is fine.
3. Check each file is under about 1 MB.
4. Add both files to `assets/textures/` in the repository (GitHub's "Add file > Upload files" works).
5. Tell Claude. The follow-up work is small:
   - add the credit text to `docs/TEXTURES.md` and the info panel;
   - change the Moon's image label from "Simulation" to "Observation" (it would be a real LRO image),
     while keeping orbits and lighting honestly labelled as simulation;
   - test it on the iPhone.

**Quicker alternative:** in the environment's network settings, allow `svs.gsfc.nasa.gov`. Claude can then
download and convert the image itself (ImageMagick is installed in the container).

## Credits (fill in when the files are added)

| File                         | Source          | Credit line  | Licence note |
| ---------------------------- | --------------- | ------------ | ------------ |
| `moon-1k.jpg`, `moon-2k.jpg` | _not added yet_ | _to fill in_ | _to fill in_ |

## Later bodies

Earth (NASA "Blue Marble"), the Sun (NASA Solar Dynamics Observatory) and the planets use the same
folder and naming. Add `texture: 'earth'` to that body in `src/engine/scale.ts` and drop in
`earth-1k.jpg` and `earth-2k.jpg`.

## Known limits

- The 2D fallback view does not draw textures (it is a simplified chart).
- The texture size is chosen when the view starts. Switching profiles in Settings does not reload it.
- The Moon's unlit side is very dark, as in real life. If that is too hard to see in play, raise the
  ambient light in `buildLights` in `src/engine/webglView.ts`.
