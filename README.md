# portfolio

Tank Yang（楊政宇）的個人網站 — 經歷、個人專案與開源工具的集合。

> Live: [tankfinal.github.io/portfolio](https://tankfinal.github.io/portfolio/)

## About

一頁式靜態站，中英雙語切換。收錄五段工作經歷、三個自己在用的個人網站，以及三個開源工具。

**沒有 build step。** 整個網站是一個 `index.html`（CSS 與 JS 都內嵌）加三張截圖。改完 push 就是部署。

## Structure

```
index.html          # 整個網站：CSS、JS、i18n 字典都在裡面
images/
├── fukuoka-trip.jpg      # 作品卡片縮圖（截自 live 站）
├── busan-trip.jpg
└── averlyn-vaccine.jpg
```

## 雙語切換

文案不寫死在 markup，而是集中在 `index.html` 的 `I18N` 字典（`{key: {zh, en}}`）。
markup 上用兩種屬性標記要翻譯的元素：

| 屬性 | 套用方式 | 用在 |
|---|---|---|
| `data-i18n` | `textContent` | 純文字 |
| `data-i18n-html` | `innerHTML` | 文案含 `<strong>` / `<em>` / `<code>` |

首次進站依 `navigator.language` 判斷語言，之後記在 `localStorage.lang`。

**加新文案時**：markup 標 key、字典補 `{zh, en}` 兩邊，缺一邊該處會渲染成 `undefined`。
可用這段檢查 key 有沒有對齊：

```bash
python3 - <<'PY'
import re
h = open('index.html', encoding='utf-8').read()
used = set(re.findall(r'data-i18n(?:-html)?="([^"]+)"', h))
d = h[h.index('var I18N = {'):h.index('var btnZh')]
defined = set(re.findall(r'"([a-zA-Z0-9._]+)"\s*:\s*\{zh:', d))
print("missing:", sorted(used - defined) or "none")
print("unused :", sorted(defined - used) or "none")
PY
```

## 更新作品縮圖

縮圖是 headless 瀏覽器截 live 站的首屏，1280×800 CSS px，再壓成 jpg：

```bash
sips -Z 900 shot.png                                   # 長邊縮到 900
sips -s format jpeg -s formatOptions 78 shot.png --out out.jpg
```

## Local

```bash
python3 -m http.server 4321   # http://localhost:4321
```

## Deploy

Push 到 `main` → GitHub Pages（Deploy from a branch，`main` / root）自動發佈。
