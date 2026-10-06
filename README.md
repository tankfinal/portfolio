# portfolio

Tank Yang（楊政宇）的個人網站 — 經歷、個人專案與開源工具的集合。

> Live: [tankfinal.github.io/portfolio](https://tankfinal.github.io/portfolio/)

## About

一頁式靜態站，中英雙語切換。收錄六段工作經歷、三個自己在用的個人網站，以及三個開源工具。
另有一個桌面風格的版本 TankOS（[`/os/`](https://tankfinal.github.io/portfolio/os/)），見下方。

**沒有 build step。** 整個網站是一個 `index.html`（CSS 與 JS 都內嵌）加三張截圖。改完 push 就是部署。

## 設計語彙

排版優先的瑞士風。改版面時照著這幾條走，不然很快會走鐘（只管首頁，`/os/` 是另一套，見 TankOS 一節）：

- **色**：白底黑字加一個紅色 accent（`--accent`）。深色模式反轉成近黑底。沒有第三個顏色。
- **不用的東西**：漸層、陰影、圓角、hover 位移動畫。層次靠字級、留白與 1px 細線。
- **字**：拉丁走 Helvetica Neue，中文走 PingFang TC。日期、URL、技術名詞、編號一律套 `.mono`。
- **格線**：每個 section 都是 `64px` 編號欄加內容欄。編號欄在 900px 以下縮成 `44px`。
- **子元素數量要對得上欄數**，否則內容會掉進錯的欄位。欄數不一致時用 `grid-column` 明確指派，不要塞空的 spacer 元素。
- **經歷的細節**：每個職位是「一段概述（`.j-body`）+ 若干 `.j-grp` 分組」。分組小標走 mono 感的大寫小字，條目用 em dash 開頭而非圓點，組與組之間只用 1px 細線分開。只有一組時仍然保留小標，層級才不會在職位之間跳動。

## Structure

```
index.html          # 整個網站：CSS、JS、i18n 字典都在裡面
os/index.html       # TankOS 桌面版，同樣單檔、無 build step
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

## TankOS（`/os/`）

macOS 風格的桌面版，入口在首頁 hero 的 TankOS 連結。跟首頁一樣沒有 build step，整個是 `os/index.html`。

- **設計語彙跟首頁相反**：漸層桌布、毛玻璃選單列與 Dock、圓角、陰影都在這裡用。桌布是內嵌 SVG，不吃外部圖檔。
- **視窗**：紅黃綠三顆鈕分別是關閉、縮到 Dock、放大（雙擊標題列也是放大）。標題列可拖曳，右下角可縮放。768px 以下視窗一律全螢幕、不可拖曳，桌面 icon 改成點一下就開。
- **App 視窗用 iframe 直接跑 live 站**，左側欄是首頁同一份作品介紹。新增 App：在 `APPS` 加一筆（`k` 指向首頁的作品 key、`url`、`src`、`spec`），再補桌面 icon 和 Dock 各一顆按鈕。被嵌的站不能送 `X-Frame-Options` / `frame-ancestors`，GitHub Pages 預設沒有。
- **Terminal** 是假的，指令寫死在 `run()` 裡。

### 文案與首頁同步

OS 版的 `I18N` 開頭那段是從首頁字典**原樣複製**的，key 名稱一樣；OS 自己的 key 以 `app.` / `os.` / `mb.` 開頭。改了首頁文案之後，跑這段找出兩邊不一致的 key，照首頁改回去：

```bash
python3 - <<'PY'
import re
def load(p):
    h = open(p, encoding='utf-8').read()
    d = h[h.index('var I18N = {'):]
    d = d[:d.index('};')]
    return {k: re.sub(r'\s+', ' ', v) for k, v in re.findall(r'"([a-zA-Z0-9._]+)"\s*:\s*(\{zh:.*?\})', d, re.S)}
main, tos = load('index.html'), load('os/index.html')
print("drift:", sorted(k for k in tos if k in main and tos[k] != main[k]) or "none")
PY
```

語言偏好兩頁共用 `localStorage.lang`，在其中一頁切了語言，另一頁會跟著。

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

同一個 push 也會觸發 Cloudflare Worker `tank-portfolio`（Workers Builds，repo 根目錄整個當靜態檔上傳）。Workers 不會自動略過 `.git` 這類檔案，不是網站的檔案要列進 `.assetsignore`。
