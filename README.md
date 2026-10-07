# portfolio

Tank Yang 的個人網站 — 經歷、個人專案與開源工具的集合。

> Live: [tankfinal.github.io/portfolio](https://tankfinal.github.io/portfolio/)

## About

同一份內容做成兩個版本，都有中英雙語切換：

- **TankOS**（首頁 `/`）：macOS 風格的桌面，作品以 App 視窗開啟、直接跑 live 站。見下方 TankOS 一節。
- **經典版**（[`/classic/`](https://tankfinal.github.io/portfolio/classic/)）：一頁式排版，收錄六段工作經歷、四個自己在用的個人網站，以及三個開源工具。

`/os/` 是 TankOS 搬到首頁前的網址，已經分享出去過，現在只負責轉址回首頁。

**沒有 build step。** 兩個版本各是一個 HTML 檔（CSS 與 JS 都內嵌），加四張截圖。改完 push 就是部署。

## 設計語彙

排版優先的瑞士風。改版面時照著這幾條走，不然很快會走鐘（只管經典版，TankOS 是另一套，見 TankOS 一節）：

- **色**：白底黑字加一個紅色 accent（`--accent`）。深色模式反轉成近黑底。沒有第三個顏色。
- **不用的東西**：漸層、陰影、圓角、hover 位移動畫。層次靠字級、留白與 1px 細線。
- **字**：拉丁走 Helvetica Neue，中文走 PingFang TC。日期、URL、技術名詞、編號一律套 `.mono`。
- **格線**：每個 section 都是 `64px` 編號欄加內容欄。編號欄在 900px 以下縮成 `44px`。
- **子元素數量要對得上欄數**，否則內容會掉進錯的欄位。欄數不一致時用 `grid-column` 明確指派，不要塞空的 spacer 元素。
- **經歷的細節**：每個職位是「一段概述（`.j-body`）+ 若干 `.j-grp` 分組」。分組小標走 mono 感的大寫小字，條目用 em dash 開頭而非圓點，組與組之間只用 1px 細線分開。只有一組時仍然保留小標，層級才不會在職位之間跳動。

## Structure

```
index.html          # 首頁 TankOS：CSS、JS、i18n 字典都在裡面
classic/index.html  # 經典版，同樣單檔
os/index.html       # 只做轉址回首頁，讓已分享出去的 /os/ 連結不失效
images/
├── fukuoka-trip.jpg      # 經典版的作品縮圖（截自 live 站）
├── busan-trip.jpg
├── yangmingshan-trip.jpg
├── wallpaper-komezuka.jpg     # TankOS 桌布（1920px）
├── wallpaper-komezuka-sm.jpg  # 手機版桌布（1200px）
└── averlyn-vaccine.jpg
```

## 雙語切換

文案不寫死在 markup，而是集中在每頁各自的 `I18N` 字典（`{key: {zh, en}}`）。
markup 上用兩種屬性標記要翻譯的元素：

| 屬性 | 套用方式 | 用在 |
|---|---|---|
| `data-i18n` | `textContent` | 純文字 |
| `data-i18n-html` | `innerHTML` | 文案含 `<strong>` / `<em>` / `<code>` |

首次進站依 `navigator.language` 判斷語言，之後記在 `localStorage.lang`。

**加新文案時**：markup 標 key、字典補 `{zh, en}` 兩邊，缺一邊該處會渲染成 `undefined`。
經典版可用這段檢查 key 有沒有對齊：

```bash
python3 - <<'PY'
import re
h = open('classic/index.html', encoding='utf-8').read()
used = set(re.findall(r'data-i18n(?:-html)?="([^"]+)"', h))
d = h[h.index('var I18N = {'):h.index('var btnZh')]
defined = set(re.findall(r'"([a-zA-Z0-9._]+)"\s*:\s*\{zh:', d))
print("missing:", sorted(used - defined) or "none")
print("unused :", sorted(defined - used) or "none")
PY
```

## TankOS（首頁 `/`）

macOS 風格的桌面版，就是網站首頁，整個是根目錄的 `index.html`。經典版從選單列的「經典版」或 Dock 的 T 進去，經典版 hero 的 TankOS 連結再連回來。

- **設計語彙跟經典版相反**：漸層桌布、毛玻璃選單列與 Dock、圓角、陰影都在這裡用。桌布是九州自駕時拍的阿蘇米塚（`images/wallpaper-komezuka.jpg`，手機版吃 `-sm`），`background-size:cover` 滿版，上面疊一層白色漸層淡化，讓 icon 和視窗字好讀。
- **視窗**：紅黃綠三顆鈕分別是關閉、縮到 Dock、放大（雙擊標題列也是放大）。標題列可拖曳，右下角可縮放。768px 以下視窗一律全螢幕、不可拖曳，桌面 icon 改成點一下就開。
- **桌面分區**：icon 依類型分三區，各區有小標（`os.zone.*`，中英雙語）：左上「作品」放 live 站、其下「實驗區」放活動監視器與方塊消除、左下「關於我」放 README、終端機、聯絡我。三區都是兩欄，不會伸進預設開啟的 README 視窗底下。新增 App 時放進對應區塊的 `<ul class="icons">`。768px 以下三區改成由上往下排，每列四顆。
- **App 視窗用 iframe 直接跑 live 站**，左側欄是經典版同一份作品介紹。新增 App：在 `APPS` 加一筆（`k` 指向經典版的作品 key、`url`、`src`、`spec`），再補桌面 icon 和 Dock 各一顆按鈕；要讓活動監視器和 `kubectl` 看得到，`SERVICES` 也加一筆；Spotlight 的別名寫在 `KW`。被嵌的站不能送 `X-Frame-Options` / `frame-ancestors`，GitHub Pages 預設沒有。
- **私人桌面**（`private`，只放 Dock 右側、經典版旁邊，跟私人版 Dock 放公開版入口的位置對稱；Spotlight 與 `open private` 也能開）：唯一不開視窗的 App，`APPS` 裡用 `link` 標記，`open()` 直接開新分頁到 [portfolio-private](https://github.com/tankfinal/portfolio-private)（Cloudflare Access 保護）。Access 登入頁不能放進 iframe，所以不嵌。私人內容一律不進這個 repo，這裡只有入口。
- **鎖定畫面**：每次進站都會出現（米塚模糊背景、時鐘、Tank Yang），點一下或按任意鍵解鎖。markup 帶 `hidden`，由 JS 打開，所以沒有 JS 時不會擋住頁面。
- **Spotlight**：⌘K / Ctrl+K、`/`，或選單列的放大鏡。索引在 `index()`：App、經歷（`e1`–`e6`）、技術名詞、動作（切語言、經典版、GitHub）。
- **活動監視器**（`activity`，只在桌面和 Spotlight，不放 Dock）：瀏覽器直接對 `SERVICES` 每個站發 `fetch(no-store)`，顯示狀態、延遲、趨勢線、HTML 大小、`Last-Modified` 當作最後部署時間，每 15 秒更新，關視窗就停。CORS 被擋時退回 `no-cors`，只能判斷有沒有活著。
- **方塊消除**（`blocks`，桌面與 Spotlight）：8×8 盤面、一次給三塊，拖曳放置，填滿整排或整列就消除，連擊加分，三塊都放不下就結束。開窗先出現玩法說明卡，按「開始遊戲」才發牌。方塊是純 CSS 的寶石切面（四邊 border 做斜面＋`::after` 高光，顏色在 `.j-*` 的變數）。消除特效：碎片噴散、整排光束掃過、盤面震動（多條或連擊震更大），`prefers-reduced-motion` 時全部關掉。最佳分數存在 `localStorage.blocks.best`。手機拖曳時方塊會浮在手指上方，避免被擋住。
- **Terminal** 是假的，指令寫死在 `run()` 裡；開視窗時會先列出 `HELP`。有幾個吃真資料：`git log [repo]`（GitHub API，未登入每小時 60 次）、`kubectl get pods`（跟活動監視器同一個 `probe()`）、`neofetch`、`top`。Tab 會補指令、`open` 的 App 名稱和 `git log` 的 repo。彩蛋（不列在 help）：`sudo`、`sudo rm -rf /`、`rm`、`deploy`（禮拜五不同）、`乖乖`、`vim`、`咖啡`、`hi`、`fortune`、`bug`，中文在上、英文在下。

### 文案與經典版同步

TankOS 的 `I18N` 開頭那段是從經典版字典**原樣複製**的，key 名稱一樣；TankOS 自己的 key 以 `app.` / `os.` / `mb.` 開頭。改了經典版文案之後，跑這段找出兩邊不一致的 key，照經典版改回去：

```bash
python3 - <<'PY'
import re
def load(p):
    h = open(p, encoding='utf-8').read()
    d = h[h.index('var I18N = {'):]
    d = d[:d.index('};')]
    return {k: re.sub(r'\s+', ' ', v) for k, v in re.findall(r'"([a-zA-Z0-9._]+)"\s*:\s*(\{zh:.*?\})', d, re.S)}
main, tos = load('classic/index.html'), load('index.html')
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
