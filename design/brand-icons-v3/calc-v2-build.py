"""Builds images/icons/calc.webp from calc-v2-source.png, the owner's replacement Calculator logo (v2.6.5).

    python3 design/brand-icons-v3/calc-v2-build.py

The v3 package's calc tile reads "x - x =" (no "+"); this one has a full keypad. It arrives as a 1254px RGB image
with the rounded tile on black. This finds the tile, crops it square, keeps the art as drawn, makes the area
outside its own rounded corner transparent (radius measured on the art), and adds the same 4/256 transparent
margin the rest of the v3 set has, then saves 192px WebP like build.py.
"""
import os
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "calc-v2-source.png")
OUT = os.path.join(HERE, "..", "..", "images", "icons", "calc.webp")
SIZE, MARGIN, QUALITY = 192, 4 / 256, 90


def main():
    im = Image.open(SRC).convert("RGB")
    a = np.asarray(im).astype(int).max(-1)
    on = a > 40
    rows, cols = on.mean(1), on.mean(0)
    t = next(i for i in range(len(rows)) if rows[i] > .3); b = max(i for i in range(len(rows)) if rows[i] > .3)
    l = next(i for i in range(len(cols)) if cols[i] > .3); r = max(i for i in range(len(cols)) if cols[i] > .3)
    side = max(r - l, b - t) + 1
    cx, cy = (l + r) / 2, (t + b) / 2
    x0, y0 = round(cx - side / 2), round(cy - side / 2)
    # Corner radius: first lit pixel along the top-left and top-right diagonals.
    ks = []
    for sx, dx in ((x0, 1), (x0 + side - 1, -1)):
        ks.append(next(k for k in range(side // 2) if on[y0 + k, sx + dx * k]))
    radius = (sum(ks) / len(ks)) / (1 - 2 ** -.5)
    tile = im.crop((x0, y0, x0 + side, y0 + side)).convert("RGBA")
    big = side * 2
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((2, 2, big - 3, big - 3), radius=round(radius * 2), fill=255)  # 1px inset: no black fringe
    tile.putalpha(mask.resize((side, side), Image.LANCZOS))
    inner = round(SIZE * (1 - 2 * MARGIN))
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    off = (SIZE - inner) // 2
    out.alpha_composite(tile.resize((inner, inner), Image.LANCZOS), (off, off))
    out.save(OUT, "WEBP", quality=QUALITY, method=6)
    print(f"tile {side}px at ({x0},{y0}), corner radius {radius:.0f}px ({radius / side:.3f}) -> {os.path.relpath(OUT)} {os.path.getsize(OUT)} B")


if __name__ == "__main__":
    main()
