"""Builds images/icons/<id>.webp, the TankOS 2.0 app logos, from TankOS App Brand Icons v3.

    python3 design/brand-icons-v3/build.py

Takes each app's 256px PNG from the package (icons/<category>/<id>/<id>-256.png, listed in manifest.json) and
saves it as a 192px WebP: enough for the largest use (60px desktop icon at 3x = 180px). The artwork, its rounded
frame and its 4px transparent margin are kept as drawn: no crop, recolour or extra shape (ICON_GUIDE.md).

PocketTrip is not in this package on purpose: it keeps its original logo, images/pocket-trip-icon.png.
The Calculator logo is replaced afterwards by calc-v2-build.py (full keypad; the package tile has no "+"),
so run that one after this.
"""
import json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "images", "icons")
SIZE, QUALITY = 192, 90


def main():
    icons = json.load(open(os.path.join(HERE, "manifest.json")))["icons"]
    os.makedirs(OUT, exist_ok=True)
    for id, spec in icons.items():
        if id == "calc":
            continue   # built by calc-v2-build.py
        im = Image.open(os.path.join(HERE, spec["files"]["256"])).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
        path = os.path.join(OUT, id + ".webp")
        im.save(path, "WEBP", quality=QUALITY, method=6)
        print(f"{id:13s} {spec['category']:10s} -> {os.path.relpath(path)} {os.path.getsize(path)} B")


if __name__ == "__main__":
    main()
