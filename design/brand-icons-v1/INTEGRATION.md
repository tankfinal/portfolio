# TankOS Brand Icons v1

21 independent app identity illustrations based on each app concept, not matched to the OS theme.

* Format: 512×512 transparent-corner PNG files.
* Source: original generated contact-sheet art (included). These are raster derivatives; **do not claim they are SVG**.
* Map app IDs from `manifest.json` to the repo’s `APPS` and icon rendering.
* The `launcher.png` represents the special Launcher button (not an APPS registry entry).
* `classic.png` represents classic link; `private.png` represents private link.
* All 21 PNGs have a common export size, but different independent art directions.
* Some small-size icons may benefit from optimization: check on real 48px Dock and 18px title bar.
* Keep legacy `?ui=1` icons unchanged unless otherwise requested.
* Ensure image asset paths are publicly deployed via Cloudflare; update asset allowlist/checks appropriately.
* Verify accessible names stay in existing i18n and keep decorative images aria-hidden.
