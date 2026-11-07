"""Builds images/icons/<id>.webp, the TankOS 2.0 app logos, from the Brand Icons v1 contact sheet.

    python3 design/brand-icons-v1/build.py

Why from the sheet and not the package's 512px PNGs (kept here unchanged for reference): those were cut on a grid
that drifts across the sheet, so most carry a band of the sheet's dark background on the right or bottom and some
(trace, launcher, activity, ...) lose their left edge. Here each tile is located on the sheet itself (outside-in edge
scan against the local background, which has a vignette), cropped square at its own position, and given back the
rounded corner it already has (radius 22.5% of the side, measured 22.6% on the art and the same ratio .ic uses).
Nothing in the artwork is redrawn, recoloured or restyled. The sheet's tiles are ~182px, more than the largest use
(60px desktop icon at 3x = 180px), so the output is 192px.
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "images", "icons")
SIZE, RADIUS, QUALITY = 192, 0.225, 88
# Top-left corner of each grid cell on the sheet (approximate; refined per tile below). 7 columns x 3 rows.
XS, YS = [47, 261, 472, 679, 889, 1099, 1309], [146, 417, 688]


def locate(S, cx, cy, R=104):
    for _ in range(3):
        x0, y0 = cx - R, cy - R
        W = S[y0:y0 + 2 * R, x0:x0 + 2 * R]
        ring = np.concatenate([W[:5].reshape(-1, 3), W[-5:].reshape(-1, 3), W[:, :5].reshape(-1, 3), W[:, -5:].reshape(-1, 3)])
        m = np.sqrt(((W - np.median(ring, axis=0)) ** 2).sum(-1)) > 22
        col, row = m[R - 45:R + 45, :].mean(0), m[:, R - 45:R + 45].mean(1)
        l = next(j for j in range(2 * R) if col[j] > .6)
        r = next(j for j in range(2 * R - 1, -1, -1) if col[j] > .6)
        t = next(j for j in range(2 * R) if row[j] > .6)
        b = next(j for j in range(2 * R - 1, -1, -1) if row[j] > .6)
        cx, cy = x0 + (l + r) // 2, y0 + (t + b) // 2
    # Width and the top edge are reliable; some bottoms have a dark rim, so the crop is square from the top.
    return x0 + l, y0 + t, r - l + 1


def main():
    ids = [i["id"] for i in json.load(open(os.path.join(HERE, "manifest.json")))["icons"]]
    sheet = Image.open(os.path.join(HERE, "source-contact-sheet.png")).convert("RGB")
    S = np.asarray(sheet).astype(float)
    big = SIZE * 4
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=round(big * RADIUS), fill=255)
    mask = mask.resize((SIZE, SIZE), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    for k, id in enumerate(ids):
        x, y, w = locate(S, XS[k % 7] + 92, YS[k // 7] + 92)
        tile = sheet.crop((x + 1, y + 1, x + w - 1, y + w - 1)).resize((SIZE, SIZE), Image.LANCZOS).convert("RGBA")
        tile.putalpha(mask)
        path = os.path.join(OUT, id + ".webp")
        tile.save(path, "WEBP", quality=QUALITY, method=6)
        print(f"{id:13s} sheet ({x},{y}) {w}px -> {os.path.relpath(path)} {os.path.getsize(path)} B")


if __name__ == "__main__":
    main()
