#!/usr/bin/env python3
"""Turn a Moon .glb model (texture laid out as a "cube net") into the flat maps the game uses.

WHY THIS EXISTS
  The game wraps a flat 2:1 picture ("equirectangular" map: longitude across, latitude down) around a
  sphere. The Moon model we were given stores its picture differently: six square faces of a cube laid
  out as a cross. Wrapping that cross onto a sphere would look broken, so this script re-projects it.

HOW IT WORKS
  1. Read the .glb file (a single binary file holding a mesh and its picture) and pull out the picture.
  2. The mesh records, for every vertex, a 3D position AND where that point sits in the picture. That is
     the exact mapping, so we use it instead of guessing the cube layout.
  3. For every pixel of the new flat map, work out which 3D direction it points to, look up where that
     direction sits in the cube picture, and copy the colour (smoothly blended).
  4. Sample at 4096 x 2048, then shrink with a high-quality filter to 2048 x 1024 and 1024 x 512, which
     avoids jagged edges. Save as JPEG.

USAGE (one time, from the project folder)
  python3 -m venv .venv-tools && .venv-tools/bin/pip install numpy scipy pillow
  .venv-tools/bin/python scripts/moon-cubenet-to-equirect.py path/to/moon_small.glb

  Writes assets/textures/moon-2k.jpg and moon-1k.jpg. The .glb itself is NOT stored in the repository
  (13 MB); keep it somewhere safe. The orientation values below were checked by eye: the near side of
  the Moon (Mare Imbrium top left, Mare Crisium right, Tycho with its rays at the bottom) ends up in the
  middle of the map with north at the top, which is what the game expects.
"""
import argparse
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
from scipy.ndimage import map_coordinates

Image.MAX_IMAGE_PIXELS = None  # the source picture is large; we trust our own input file

# Which way the model's near side faces, and which way is "up", in the model's own coordinates.
NEAR_SIDE_DIRECTION = (0.0, 0.0, -1.0)
NORTH_DIRECTION = (0.0, 1.0, 0.0)


def read_glb(path):
    """Returns (vertex positions, vertex picture coordinates, triangle indices, the picture)."""
    data = Path(path).read_bytes()
    magic, _version, _length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF":
        raise SystemExit("Not a .glb file")
    json_len, _ = struct.unpack("<I4s", data[12:20])
    meta = json.loads(data[20 : 20 + json_len])
    bin_start = 20 + json_len + 8  # skip the 8-byte header of the binary chunk

    def view_bytes(view_index):
        view = meta["bufferViews"][view_index]
        start = bin_start + view.get("byteOffset", 0)
        return data[start : start + view["byteLength"]]

    def accessor(index, dtype, parts):
        acc = meta["accessors"][index]
        start = bin_start + meta["bufferViews"][acc["bufferView"]].get("byteOffset", 0) + acc.get("byteOffset", 0)
        arr = np.frombuffer(data, dtype=dtype, count=acc["count"] * parts, offset=start)
        return arr.reshape(acc["count"], parts) if parts > 1 else arr

    prim = meta["meshes"][0]["primitives"][0]
    positions = accessor(prim["attributes"]["POSITION"], "<f4", 3).astype(np.float64)
    uvs = accessor(prim["attributes"]["TEXCOORD_0"], "<f4", 2).astype(np.float64)
    triangles = accessor(prim["indices"], "<u2", 1).astype(np.int64).reshape(-1, 3)
    picture = Image.open(io.BytesIO(view_bytes(meta["images"][0]["bufferView"]))).convert("RGB")
    return positions, uvs, triangles, picture


class CubeNetMoon:
    """Looks up the picture colour for any 3D direction."""

    def __init__(self, positions, uvs, triangles, picture):
        self.image = np.asarray(picture, dtype=np.float32)
        self.height, self.width, _ = self.image.shape
        # Which of the cube's 6 faces is each triangle on? The axis (x, y or z) where its centre is largest.
        centres = positions[triangles].mean(axis=1)
        axis = np.argmax(np.abs(centres), axis=1)
        negative = np.take_along_axis(centres, axis[:, None], 1)[:, 0] < 0
        face_of_triangle = axis * 2 + negative
        self.interpolators = {}
        self.uv_box = {}
        for face in range(6):
            main = face // 2
            others = [k for k in range(3) if k != main]
            vertices = np.unique(triangles[face_of_triangle == face].ravel())
            p = positions[vertices]
            # Position on the cube face, from -1 to 1 in each direction ("gnomonic" coordinates).
            flat = np.stack([p[:, others[0]] / p[:, main], p[:, others[1]] / p[:, main]], axis=1)
            flat, keep = np.unique(np.round(flat, 7), axis=0, return_index=True)
            uv = uvs[vertices][keep]
            self.interpolators[face] = (LinearNDInterpolator(flat, uv), NearestNDInterpolator(flat, uv))
            self.uv_box[face] = (uv[:, 0].min(), uv[:, 0].max(), uv[:, 1].min(), uv[:, 1].max())

    def colours(self, directions):
        """directions: (N, 3) unit vectors -> (N, 3) RGB values 0..255."""
        d = np.asarray(directions, dtype=np.float64)
        main_axis = np.argmax(np.abs(d), axis=1)
        negative = np.take_along_axis(d, main_axis[:, None], 1)[:, 0] < 0
        face_of_direction = main_axis * 2 + negative
        out = np.zeros((len(d), 3), dtype=np.float32)
        for face in range(6):
            chosen = np.where(face_of_direction == face)[0]
            if len(chosen) == 0:
                continue
            main = face // 2
            others = [k for k in range(3) if k != main]
            flat = np.stack([d[chosen, others[0]] / d[chosen, main], d[chosen, others[1]] / d[chosen, main]], axis=1)
            linear, nearest = self.interpolators[face]
            uv = linear(flat)
            outside = np.isnan(uv[:, 0])  # a hair beyond the mesh edge: use the closest known point
            if outside.any():
                uv[outside] = nearest(flat[outside])
            u0, u1, v0, v1 = self.uv_box[face]
            # Stay half a pixel inside this face's square so blending never reaches the black border.
            x = np.clip(uv[:, 0], u0 + 0.5 / self.width, u1 - 0.5 / self.width) * self.width - 0.5
            y = np.clip(uv[:, 1], v0 + 0.5 / self.height, v1 - 0.5 / self.height) * self.height - 0.5
            for channel in range(3):
                out[chosen, channel] = map_coordinates(self.image[:, :, channel], [y, x], order=1, mode="nearest")
        return out


def make_equirectangular(moon, width, height):
    """Flat map: near side in the middle, north up, east (toward Mare Crisium) to the right."""
    forward = np.asarray(NEAR_SIDE_DIRECTION, dtype=float)
    forward /= np.linalg.norm(forward)
    up = np.asarray(NORTH_DIRECTION, dtype=float)
    up = up - forward * (up @ forward)
    up /= np.linalg.norm(up)
    east = np.cross(-forward, up)
    longitude = ((np.arange(width) + 0.5) / width * 2 - 1) * np.pi
    latitude = (0.5 - (np.arange(height) + 0.5) / height) * np.pi
    lon, lat = np.meshgrid(longitude, latitude)
    directions = (
        forward * (np.cos(lat) * np.cos(lon))[..., None]
        + east * (np.cos(lat) * np.sin(lon))[..., None]
        + up * np.sin(lat)[..., None]
    ).reshape(-1, 3)
    pixels = np.zeros((len(directions), 3), dtype=np.float32)
    step = 200_000  # work in chunks so memory stays modest
    for i in range(0, len(directions), step):
        pixels[i : i + step] = moon.colours(directions[i : i + step])
    return Image.fromarray(pixels.reshape(height, width, 3).clip(0, 255).astype(np.uint8))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("glb", help="path to the Moon .glb file")
    parser.add_argument("--out-dir", default="assets/textures", help="where to write moon-2k.jpg and moon-1k.jpg")
    args = parser.parse_args()

    moon = CubeNetMoon(*read_glb(args.glb))
    big = make_equirectangular(moon, 4096, 2048)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for width, name in ((2048, "moon-2k.jpg"), (1024, "moon-1k.jpg")):
        small = big.resize((width, width // 2), Image.LANCZOS)
        small.save(out_dir / name, quality=85, optimize=True, progressive=True)
        print(f"wrote {out_dir / name}  {(out_dir / name).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
