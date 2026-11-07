# TankOS App Icons v3 — design & integration guide

- Product Brands: `wordtrailer`, `averlyn`; `pockettrip` **keep / restore original icon**. Do not force matching OS colors.
- Travel Projects: `fukuoka`, `busan`, `yangmingshan`: travel destinations and unique scenery.
- Games / Interactive Experiences: `blocks`, `nightmarket`, `shachiku`, `trace`: mechanics/character/interactive request journey.
- Utilities / System: `terminal`, `activity`, `calc`, `calendar`, `settings`, `launcher`, `readme`, `contact`, `about`, `classic`, `private`: functional legibility.

The provided PNGs are concept-board crops, with 512, 256, 128, 64 sized exports. Native effective detail is limited by source board (~90-135px per tile); use primarily in 48px interfaces and do not claim full 512px source-quality design. PocketTrip original image must come from the repo's historic `images/pocket-trip-icon.png`, not from this pack.

## Must preserve
- App IDs, links, actions, i18n, storage, settings, background/wallpaper, window behavior.
- Classic v2.4 mode (`?ui=1`) unchanged, including its 7 visual baseline screenshots.
- Source images may include designed rounded frames. Do not apply an additional opaque background or icon-shape crop inside the new visual.
- `pockettrip` original must apply in Desktop, Dock, Launcher, Spotlight, titlebar for `?ui=2`, not only Desktop.

## Asset hygiene
- Prefer optimized 128px PNG for 48px Dock if quality adequate; 256px for HiDPI.
- Set images via central per-App icon mapping or CSS design token to ensure every surface uses the same file.
- Update asset allowlist and tests if needed. Ensure screenshots with intentional icon changes are reviewed, do not simply widen thresholds.
