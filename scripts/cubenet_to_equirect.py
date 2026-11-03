#!/usr/bin/env python3
"""Turn a planet/moon 3D model whose picture is a "cube net" into the flat maps the game uses.

WHY THIS EXISTS
  The game wraps a flat 2:1 picture ("equirectangular" map: longitude across, latitude down) around a
  sphere. Models we were given (NASA-style 3D files) store their picture differently: six faces of a cube
  laid out as a cross. Wrapping that cross onto a sphere would look broken, so this script re-projects it.

HOW IT WORKS
  1. Read the model (.glb or .usdz) and pull out its colour picture and its mesh.
  2. The mesh records, for every corner of every triangle, a 3D position AND where that point sits in the
     picture. That is the exact mapping, so we use it instead of guessing the cube layout.
  3. For every pixel of the new flat map, work out which 3D direction it points to, look up where that
     direction sits in the cube picture, and copy the colour (smoothly blended).
  4. Sample at 4096 x 2048, then shrink with a high-quality filter to 2048 x 1024 and 1024 x 512, which
     avoids jagged edges. Save as JPEG.

USAGE (one time, from the project folder)
  python3 -m venv .venv-tools && .venv-tools/bin/pip install numpy scipy pillow usd-core
  .venv-tools/bin/python scripts/cubenet_to_equirect.py moon path/to/moon_small.glb
  .venv-tools/bin/python scripts/cubenet_to_equirect.py mars path/to/24881_Mars_1_6792.usdz

  Writes assets/textures/<body>-2k.jpg and <body>-1k.jpg. The model files are NOT stored in the repository
  (they are large); keep them somewhere safe. `usd-core` is only needed for .usdz files.

ORIENTATION
  Each body below lists which way its prime-meridian side faces and which way is north, in the model's own
  coordinates. They were checked by eye against known landmarks. The finished map has longitude 0 in the
  middle, north at the top, and east (the direction of increasing longitude) to the right.
"""
import argparse
import io
import json
import struct
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
from scipy.ndimage import map_coordinates

Image.MAX_IMAGE_PIXELS = None  # the source pictures can be large; we trust our own input files

# Per body: the direction (in the model's own coordinates) that should end up in the MIDDLE of the map, and
# which way is north. Moon: the near side. Mars: set from landmarks (see docs/TEXTURES.md).
BODIES = {
    "moon": {"forward": (0.0, 0.0, -1.0), "north": (0.0, 1.0, 0.0)},
    "mars": {"forward": (-1.0, 0.0, 0.0), "north": (0.0, 1.0, 0.0)},
}


# --------------------------------------------------------------------------------------------------
# Reading models. Each reader returns:
#   corners  - array (T, 3, 3): the 3D position of the 3 corners of each of T triangles
#   uvs      - array (T, 3, 2): where each corner sits in the picture, 0..1, y measured DOWN from the top
#   picture  - the colour picture (PIL image)
# --------------------------------------------------------------------------------------------------
def read_glb(path):
    data = Path(path).read_bytes()
    magic, _version, _length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF":
        raise SystemExit("Not a .glb file")
    json_len, _ = struct.unpack("<I4s", data[12:20])
    meta = json.loads(data[20 : 20 + json_len])
    bin_start = 20 + json_len + 8  # skip the 8-byte header of the binary chunk

    def accessor(index, dtype, parts):
        acc = meta["accessors"][index]
        start = bin_start + meta["bufferViews"][acc["bufferView"]].get("byteOffset", 0) + acc.get("byteOffset", 0)
        arr = np.frombuffer(data, dtype=dtype, count=acc["count"] * parts, offset=start)
        return arr.reshape(acc["count"], parts) if parts > 1 else arr

    prim = meta["meshes"][0]["primitives"][0]
    positions = accessor(prim["attributes"]["POSITION"], "<f4", 3).astype(np.float64)
    uvs = accessor(prim["attributes"]["TEXCOORD_0"], "<f4", 2).astype(np.float64)
    triangles = accessor(prim["indices"], "<u2", 1).astype(np.int64).reshape(-1, 3)
    view = meta["bufferViews"][meta["images"][0]["bufferView"]]
    start = bin_start + view.get("byteOffset", 0)
    picture = Image.open(io.BytesIO(data[start : start + view["byteLength"]])).convert("RGB")
    return positions[triangles], uvs[triangles], picture  # glTF measures v downward already


def read_usdz(path):
    try:
        from pxr import Usd, UsdGeom, UsdShade
    except ImportError:
        raise SystemExit("Reading .usdz files needs the usd-core package: pip install usd-core")
    stage = Usd.Stage.Open(str(path))
    mesh = next(UsdGeom.Mesh(p) for p in stage.Traverse() if p.IsA(UsdGeom.Mesh))
    points = np.array(mesh.GetPointsAttr().Get(), dtype=np.float64)
    counts = np.array(mesh.GetFaceVertexCountsAttr().Get())
    indices = np.array(mesh.GetFaceVertexIndicesAttr().Get())
    if not (counts == 3).all():
        raise SystemExit("Expected a mesh made only of triangles")
    st = np.array(UsdGeom.PrimvarsAPI(mesh).GetPrimvar("st0").Get(), dtype=np.float64)
    # UVs are stored either once per corner or once per vertex.
    uv_per_corner = st if len(st) == len(indices) else st[indices]
    # Find the base-colour texture the material uses (the file name inside the .usdz archive).
    texture_name = None
    for prim in stage.Traverse():
        if prim.GetTypeName() == "Shader" and prim.GetName() == "tex_base":
            texture_name = prim.GetAttribute("inputs:file").Get().path
    if texture_name is None:
        raise SystemExit("Could not find the base colour texture in the model")
    with zipfile.ZipFile(path) as archive:
        picture = Image.open(io.BytesIO(archive.read(texture_name))).convert("RGB")
    uv_per_corner = uv_per_corner.copy()
    uv_per_corner[:, 1] = 1.0 - uv_per_corner[:, 1]  # USD measures v UP from the bottom; flip to "down"
    return points[indices].reshape(-1, 3, 3), uv_per_corner.reshape(-1, 3, 2), picture


# --------------------------------------------------------------------------------------------------
# Looking up the picture colour for any 3D direction.
# --------------------------------------------------------------------------------------------------
class CubeNetSurface:
    def __init__(self, corners, uvs, picture):
        self.image = np.asarray(picture, dtype=np.float32)
        self.height, self.width, _ = self.image.shape
        # Which of the cube's 6 faces is each triangle on? The axis (x, y or z) where its centre is largest.
        centres = corners.mean(axis=1)
        axis = np.argmax(np.abs(centres), axis=1)
        negative = np.take_along_axis(centres, axis[:, None], 1)[:, 0] < 0
        face_of_triangle = axis * 2 + negative
        self.interpolators = {}
        self.uv_box = {}
        for face in range(6):
            main = face // 2
            others = [k for k in range(3) if k != main]
            p = corners[face_of_triangle == face].reshape(-1, 3)
            uv_face = uvs[face_of_triangle == face].reshape(-1, 2)
            # Position on the cube face, from -1 to 1 in each direction ("gnomonic" coordinates).
            flat = np.stack([p[:, others[0]] / p[:, main], p[:, others[1]] / p[:, main]], axis=1)
            flat, keep = np.unique(np.round(flat, 7), axis=0, return_index=True)
            uv_face = uv_face[keep]
            self.interpolators[face] = (LinearNDInterpolator(flat, uv_face), NearestNDInterpolator(flat, uv_face))
            self.uv_box[face] = (uv_face[:, 0].min(), uv_face[:, 0].max(), uv_face[:, 1].min(), uv_face[:, 1].max())

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
            # Stay half a pixel inside this face's square so blending never reaches the border padding.
            x = np.clip(uv[:, 0], u0 + 0.5 / self.width, u1 - 0.5 / self.width) * self.width - 0.5
            y = np.clip(uv[:, 1], v0 + 0.5 / self.height, v1 - 0.5 / self.height) * self.height - 0.5
            for channel in range(3):
                out[chosen, channel] = map_coordinates(self.image[:, :, channel], [y, x], order=1, mode="nearest")
        return out


def make_equirectangular(surface, forward, north, width, height):
    """Flat map: `forward` in the middle, north up, east (increasing longitude) to the right."""
    forward = np.asarray(forward, dtype=float)
    forward /= np.linalg.norm(forward)
    up = np.asarray(north, dtype=float)
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
        pixels[i : i + step] = surface.colours(directions[i : i + step])
    return Image.fromarray(pixels.reshape(height, width, 3).clip(0, 255).astype(np.uint8))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("body", choices=sorted(BODIES), help="which body the model shows")
    parser.add_argument("model", help="path to the .glb or .usdz model file")
    parser.add_argument("--out-dir", default="assets/textures", help="where to write <body>-2k.jpg and <body>-1k.jpg")
    parser.add_argument("--forward", type=float, nargs=3, metavar=("X", "Y", "Z"), help="override the map-centre direction")
    parser.add_argument("--big-png", help="also save the full 4096 x 2048 map here (for inspection)")
    args = parser.parse_args()

    suffix = Path(args.model).suffix.lower()
    reader = {".glb": read_glb, ".usdz": read_usdz}.get(suffix)
    if reader is None:
        raise SystemExit("Model must be a .glb or .usdz file")
    surface = CubeNetSurface(*reader(args.model))
    settings = BODIES[args.body]
    big = make_equirectangular(surface, args.forward or settings["forward"], settings["north"], 4096, 2048)
    if args.big_png:
        Path(args.big_png).parent.mkdir(parents=True, exist_ok=True)
        big.save(args.big_png)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for width, label in ((2048, "2k"), (1024, "1k")):
        target = out_dir / f"{args.body}-{label}.jpg"
        big.resize((width, width // 2), Image.LANCZOS).save(target, quality=85, optimize=True, progressive=True)
        print(f"wrote {target}  {target.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
