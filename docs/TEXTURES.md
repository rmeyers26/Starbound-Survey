# Surface textures (NASA images)

The 3D view wraps a real picture around a body. **The Moon and Mars have one.** Earth, the Sun and the
other planets are still flat colours; the same folder and naming add them later.

## Provenance and credit: please confirm

There are two source files, both supplied by the project owner:

- **Moon:** `moon_small.glb` (below).
- **Mars:** `24881_Mars_1_6792.usdz`, a Mars model. Its name looks like a NASA 3D-resource file name, but the
  file itself contains **no credit or licence text** (only a mesh, a material and two images), so the
  same open question applies: where it is from, the credit line, and the usage terms. It was checked
  against a standard Viking-style Mars map the owner pasted into the chat (landmarks: Olympus Mons,
  Valles Marineris, Syrtis Major, Hellas all land in the right places, not mirrored). The model's colours
  are pinker than the classic orange-brown Viking mosaic; that is the model's own look.

The Moon picture comes from `moon_small.glb`, a Moon model supplied by the project owner, who pointed to
NASA's Scientific Visualization Studio page <https://svs.gsfc.nasa.gov/14959/>. Two things are **not**
confirmed:

- The `.glb` file has no credit or licence information inside it (its only metadata says it was exported
  from Blender), and the development container still cannot open NASA's page. So it is not verified that
  this exact file comes from that page, nor what credit line and terms NASA gives there.
- Because of that, the in-game credit line is **not shown yet** and the Moon's badge still says
  "Simulation". Once the source is confirmed: add the credit to the info panel and change the badge to
  "Observation" (the picture is a mosaic of real spacecraft photographs; orbits and lighting stay labelled
  as simulation).

| File                         | Source                                                                         | Credit line                     | Licence note                            |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------- |
| `moon-1k.jpg`, `moon-2k.jpg` | Moon model from NASA SVS (<https://svs.gsfc.nasa.gov/14959/>), per the owner   | _to fill in from the NASA page_ | _to fill in (check NASA's usage terms)_ |
| `mars-1k.jpg`, `mars-2k.jpg` | Mars model `24881_Mars_1_6792.usdz`, supplied by the owner; origin unconfirmed | _to fill in_                    | _to fill in_                            |

Derived images: the originals are a 4096 x 4096 PNG in "cube net" layout. We re-projected it (see below),
so these two files are **processed copies**, not NASA's file as published. Say so in any credit.

## How the picture gets into the game

- Image files live in `assets/textures/`, named `<body>-1k.jpg` and `<body>-2k.jpg`. "1k" is 1024 pixels
  wide, "2k" is 2048.
- The build finds them automatically; no code change is needed to switch a texture on. With no file, the
  body stays a flat colour and nothing is requested.
- Phones on **Balanced** or **Performance** load the 1k file; **High** loads the 2k file. If only one size
  exists, every profile uses it. (Sizes: `moon-1k.jpg` about 127 KB, `moon-2k.jpg` about 473 KB.)
- Files are cached for offline play, so keep each one **under 2 MB** or the offline cache skips it.
- The Moon is rotated so its near side always points at Earth, like the real Moon.
- A faint "Earthshine" glow (`nightGlow` in `src/engine/scale.ts`) keeps the Moon's night side from being
  pure black. It is an artistic effect, not a measurement.

## How the pictures were made

Both models store their picture as cube faces laid out in a cross, which cannot be wrapped onto
the game's sphere. `scripts/cubenet_to_equirect.py` reads the model's mesh (which records exactly where
each 3D point sits in the picture) and re-projects it into the flat 2:1 map the game expects. Orientation
was checked by eye: Mare Imbrium top left, Mare Crisium at the right, Tycho and its rays at the bottom
middle, north up, no mirroring. The script regenerates the shipped files byte for byte.

```bash
python3 -m venv .venv-tools && .venv-tools/bin/pip install numpy scipy pillow usd-core
.venv-tools/bin/python scripts/cubenet_to_equirect.py moon path/to/moon_small.glb
.venv-tools/bin/python scripts/cubenet_to_equirect.py mars path/to/24881_Mars_1_6792.usdz
```

The model files (13 MB and 0.9 MB) are deliberately **not** stored in the repository; keep your copies safe. The Moon script output
is byte-identical to the shipped files; Mars's turn of 90 degrees was found by comparing landmarks.

## Why JPEG and not KTX2

The spec prefers KTX2 (compressed textures that use less phone memory). That needs an extra conversion
tool and a decoder library. A 2k JPEG is simple, small to download, and fine for one or two bodies.
Revisit KTX2 when many large textures are added. The memory cost is still real: a 2k by 1k picture occupies
about 11 MB of GPU memory once loaded (about 3 MB for 1k), so watch it in the device tests.

## Later bodies

Earth (NASA "Blue Marble"), the Sun (NASA Solar Dynamics Observatory) and the planets use the same folder
and naming. Add `texture: 'earth'` to that body in `src/engine/scale.ts` and drop in `earth-1k.jpg` and
`earth-2k.jpg`. If a source arrives as a cube net, adapt the script above.

## Known limits

- The 2D fallback view does not draw textures (it is a simplified chart).
- Planets do not spin yet. Mars shows one face (Syrtis Major and Hellas, `startLongitudeDeg` in
  `src/engine/scale.ts`) until you turn the camera. A slow decorative spin could be added later.
- Mars's second image in the model (a "normal map" for surface relief) is almost flat and is not used.
- The texture size is chosen when the view starts. Switching profiles in Settings does not reload it.
- The Moon orbits Earth in under 3 seconds (a deliberate speed-up), so the camera sees all sides of it in
  quick succession.
- The picture is a low-contrast, true-to-life Moon (real maria are dark). It is not brightened.
