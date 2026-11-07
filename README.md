# portfolio

Tank Yang 的個人網站 — 經歷、個人專案與開源工具的集合。

> Live: [portfolio.xarenvich.com](https://portfolio.xarenvich.com/)（`xarenvich.com` 目前也是 TankOS；舊網址 portfolio.xarenvich.workers.dev 照常可用，tankfinal.github.io/portfolio 會轉到這裡）

## About

同一份內容做成兩個版本，都有中英雙語切換：

- **TankOS**（首頁 `/`）：macOS 風格的桌面，作品以 App 視窗開啟、直接跑 live 站。見下方 TankOS 一節。
- **經典版**（[`/classic/`](https://portfolio.xarenvich.com/classic/)）：一頁式排版，收錄六段工作經歷、四個自己在用的個人網站，以及三個開源工具。

`/os/` 是 TankOS 搬到首頁前的網址，已經分享出去過，現在只負責轉址回首頁。

**沒有 build step。** 兩個版本各是一個 HTML 檔（CSS 與 JS 都內嵌），加四張截圖；比較大的 TankOS App 另外放在 `apps/<id>.js`，開視窗時才載入。整個網站加上 `/api` 是同一個 Cloudflare Worker（`portfolio`），改完 push 就是部署。`package.json` 只放測試用的開發工具（Playwright），網站本身不用安裝任何東西，見「Tests」。

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
apps/               # 自己一個檔案的 TankOS App，開視窗時才載入，見 TankOS 一節的「獨立檔案 App」
└── trace.js        # Request 的一生
images/
├── fukuoka-trip.jpg      # 經典版的作品縮圖（截自 live 站）
├── busan-trip.jpg
├── yangmingshan-trip.jpg
├── wallpaper-komezuka.jpg     # TankOS 桌布（1920px）
├── wallpaper-komezuka-sm.jpg  # 手機版桌布（1200px）
├── wallpaper-pixelverse-lakeside-night.png   # TankOS 2.0（?ui=2）桌布原檔，1672×941，核准的素材，不要重新匯出或修改
├── wallpaper-pixelverse-lakeside-night.webp  # 由上面那張轉的 WebP q90（300 KB），2.0 實際載入這張
├── shachiku.jpg
├── open-tonight.jpg
├── wordtrailer.jpg
├── pocket-trip.jpg            # 經典版作品圖（口袋旅行的登入畫面）
├── pocket-trip-icon.png       # 口袋旅行的桌面 icon（App 自己的 logo）
├── averlyn-vaccine.jpg        # 經典版作品圖（Averlyn 疫苗的登入畫面）
└── averlyn-icon.png           # Averlyn 疫苗的桌面 icon（App 自己的 logo）
api/                # /api 的程式：排行榜、線上訪客、Request 的一生，見「API」
├── src/index.js    # Worker 的程式（只有 /api/* 會執行它，其他都直接送靜態檔）
└── schema.sql      # D1 `portfolio` 的表
wrangler.jsonc      # Worker `portfolio`：靜態檔（repo 根目錄）＋ api/src/index.js ＋ D1 綁定
package.json        # 只有 devDependencies（@playwright/test），不部署
playwright.config.js
tests/              # Playwright 回歸測試，不部署，見「Tests」
├── e2e/            # window manager、Dock 與 App、版面、基準截圖
├── __screenshots__/  # 基準截圖（在固定版本的 Playwright Docker image 裡產生）
├── support/        # 測試用靜態伺服器、共用 fixture（固定時間、mock 網路）
└── assets/check-assets.mjs  # 用 wrangler dry-run 確認測試與開發工具不會變成公開檔案
.github/workflows/e2e.yml   # 每次 push 跑上面兩種檢查，不部署
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
- **桌面分區**：icon 依類型分四區，各區有小標（`os.zone.*`，中英雙語）。左欄由上往下是「作品」（live 站）、「遊戲區」（方塊消除、Request 的一生、我是社畜、今晚出攤）；右欄由上往下是「小工具」（終端機、活動監視器、計算機、日曆）、「下個連假」小工具、「關於我」（README 與聯絡我）。四區都是兩欄，不會伸進預設開啟的 README 視窗底下。兩欄都從上往下排、沒有貼底的區塊。作品有三列以後，左欄底部約在 598px；視窗高度 720px 以下（常見的 1366×768 筆電扣掉瀏覽器工具列只剩約 625–657px）icon 縮成 48px、間距收緊，左欄底部約在 488px、右欄約 478px，不會被 Dock 擋到。加 icon 前先在 1366×657 和 1440×760 量一下各欄底部，別碰到 Dock。「關於 TankOS」沒有桌面 icon，由選單列左上的 T、Spotlight、`open about` 開，跟 macOS 一樣。新增 App 時放進對應區塊的 `<ul class="icons">`。768px 以下四區改成由上往下排，每列四顆。
- **App 視窗用 iframe 直接跑 live 站**，左側欄是經典版同一份作品介紹。新增 App：在 `APPS` 加一筆（`k` 指向經典版的作品 key、`url`、`src`、`spec`），再補桌面 icon 和 Dock 各一顆按鈕；要讓活動監視器和 `kubectl` 看得到，`SERVICES` 也加一筆；Spotlight 的別名寫在 `KW`。被嵌的站不能送 `X-Frame-Options` / `frame-ancestors`，GitHub Pages 預設沒有。
- **獨立檔案 App**（`APPS` 裡帶 `file` 的，目前有 `trace`）：程式、CSS、中英字串都在 `apps/<id>.js`，第一次開視窗才用 `<script>` 載入（網址帶 `?v=<版號>`，升版就不會吃到舊快取；`file` 也可以是陣列，幾支檔案同時載入，其中一支呼叫 `TankOS.define`），載入中顯示轉圈，失敗顯示重試。檔案呼叫 `TankOS.define(id, {html, css, i18n, init})` 登記自己：`html` 是視窗內容（根元素帶 `body` class），`css` 第一次載入時注入一次，`i18n` 併進 `I18N`（key 用自己的前綴），`init(body, os)` 可以回傳一個關視窗時要跑的函式。`os` 是檔案唯一拿得到的東西：`t`、`fill`、`lang()`、`onLang(f)`（回傳取消函式）、`api`（Worker 網址）、`open`、`still`（減少動態效果的 media query）、`ver`（站台版號，App 自己 fetch 的檔案拿來加 `?v=`）。新增一個：寫 `apps/<id>.js`，`APPS` 加 `{w, h, file:"apps/<id>.js"}`，`I18N` 加 `app.<id>`，桌面 icon（含 `.ic-<id>` 顏色與 SVG symbol）、`KW`、`index()` 的清單、終端機 `OPENABLE` 與 `ls` 各補一處；App 名稱和 icon 留在 `index.html`，因為載入前桌面和 Spotlight 就要顯示。
- **私人版入口**：選單列右側的 🔒「私人版」，開新分頁到 [portfolio-private](https://github.com/tankfinal/portfolio-private)（Cloudflare Access 保護），跟私人版選單列的「公開版」對稱。手機只剩鎖頭。Spotlight 與 `open private` 也能開（`APPS.private` 用 `link` 標記，`open()` 直接開新分頁）。Access 登入頁不能放進 iframe，所以不開視窗。私人內容一律不進這個 repo，這裡只有入口。
- **TankOS 2.0 預覽（feature flag）**：網址加 `?ui=2` 會在 `<html>` 加上 `data-ui="2"`，換成 Nocturne 深色主題；`?ui=1` 是目前的介面。兩個都是明確的選擇，記在 `localStorage.ui`，之後直接開首頁、重新整理都維持，預設值改了也一樣。優先順序是網址的 `?ui=` > 記住的選擇 > `DEFAULT_UI`，其他值一律忽略；瀏覽器擋 storage 時，`?ui=` 只對那一次載入有效。判斷寫在 `<head>` 最前面的 `<script>`，在任何 CSS 與 `<body>` 之前執行，所以不會先閃一下舊主題。沒有這個屬性時畫面跟 v2.4 一模一樣。2.0 的東西一律寫在 `:root[data-ui="2"]` 底下：design token 是 `--tank-*`（顏色、圓角、間距、字級、z-index、動畫，值照 Design System v1），舊的 `--win-*`、`--accent`、`--sel` 名稱不變、改指到 token，所以各 App 與 `apps/<id>.js` 不用改就會跟著換色。2.0 只有深色，不管系統設定；紅色仍是品牌色（`--tank-brand`，文字用較亮的 `--tank-brand-text`），紫色（`--tank-primary`）給互動與選取。正式切成 2.0（v2.5.0）時把 flag script 的 `DEFAULT_UI` 改成 `"2"`，想留在舊介面的人用 `?ui=1`。
- **2.0 選單列與桌布**（`<style>` 最後的「TankOS 2.0 menu bar」「TankOS 2.0 wallpaper」）：選單列高度是 `--tank-menubar-height`（36px），經由 `--menu-h` 讓桌面與視窗圖層跟著下移；背景與聚焦視窗同一種玻璃，項目與 v2.4 完全相同，T 維持品牌紅。桌布是 Pixelverse 湖畔露營夜景：原檔 PNG 保留不動，瀏覽器載入它轉出的 WebP，不支援時退回 PNG（圖片宣告刻意不用 `var()`，否則退回會失效）。上面疊兩層很淡的深靛紫漸層（選單列與 Dock 附近、左右 icon 欄稍深，中間保持原色）；桌面標籤加深靛色光暈，月亮或燈籠剛好在標籤底下時也讀得清楚。橫向 `cover` + `50% 55%` 讓月亮與營地都在畫面裡，直向（手機、平板）改 `20% 50%` 保留營地。鎖定畫面的模糊背景跟著換。米塚照片仍是 v2.4 的桌布，之後可做成可選
- **2.0 Dock 與 App Launcher**（`<style>` 最後的「TankOS 2.0 Dock + App Launcher」與 JS 的「App Launcher」）：Dock 是與視窗同一種玻璃，icon 用 `--tank-dock-icon-size`（48px），最後多一顆「所有 App」按鈕（v2.4 隱藏）。執行中是小圓點，最上層的 App 是紫色長條（`showApp()` 順手幫 Dock 按鈕標 `.cur`）。hover 只放大指到的那顆、用 transform，不像 v2.4 用 margin 把旁邊推開；減少動態效果時不放大。768px 以下 Dock 只顯示帶 `data-m` 的 README、聯絡我、經典版和「所有 App」，每顆 48×48，其他 App 從 Launcher 開。Launcher 不是另一份 App 清單：分組與順序讀桌面四區，最後一組是 `APPS` 裡沒有桌面 icon 的（關於 TankOS、私人版）加 Dock 上的連結（經典版）；名稱用桌面的短名稱（`app.<id>`），icon 用 `iconOf()`，一律經 `open()` 開，所以新增 App 時放進桌面分區就會出現在 Launcher。它是 modal dialog：Esc、關閉鈕、點外面都會關，Tab 不會跑出去，方向鍵在 App 間移動；z-index 8500，在視窗與 Dock 之上、選單列（9000）與 Spotlight（9600）之下，開 Spotlight 會先關掉它
- **2.0 視窗**（`<style>` 最後的「TankOS 2.0 window system」）：16px 圓角、1px 淡紫邊、44px 標題列，標題左邊是 App 的 icon（`.bar-ic`，複製桌面或 Dock 上那顆；v2.4 隱藏）。聚焦的視窗是半透明玻璃加 24px 模糊、紫色邊與光暈；沒聚焦的是不透明底色（沒有模糊時半透明會透出底下視窗的字）、icon 變淡，內文不變淡。模糊很吃效能，所以只給聚焦的那一個、只在 769px 以上、拖曳時暫停；手機與平板直向、不支援 `backdrop-filter`、或系統要求減少透明度時一律不透明。規則都包在 `:where(:root[data-ui="2"])` 裡（不增加 specificity），所以放大、手機全螢幕、終端機與計算機自己的視窗配色這些 v2.4 規則照樣生效；沒有新增動畫，減少動態效果的設定照舊涵蓋
- **鎖定畫面**：每次進站都會出現（米塚模糊背景、時鐘、Tank Yang），點一下或按任意鍵解鎖。markup 帶 `hidden`，由 JS 打開，所以沒有 JS 時不會擋住頁面。
- **Spotlight**：⌘K / Ctrl+K、`/`，或選單列的放大鏡。索引在 `index()`：App、經歷（`e1`–`e6`）、技術名詞、動作（切語言、經典版、GitHub）。
- **活動監視器**（`activity`，只在桌面和 Spotlight，不放 Dock）：瀏覽器直接對 `SERVICES` 每個站發 `fetch(no-store)`，顯示狀態、延遲、趨勢線、HTML 大小、`Last-Modified` 當作最後部署時間，每 15 秒更新，關視窗就停。CORS 被擋時退回 `no-cors`，只能判斷有沒有活著。
- **方塊消除**（`blocks`，桌面與 Spotlight）：8×8 盤面、一次給三塊，拖曳放置，點一下（指標沒移動超過 6px）方塊順時針轉 90 度；填滿整排或整列就消除，連擊加分，三塊不論轉成哪個方向都放不下才結束（灰掉的方塊也用同一個判斷）。開窗先出現說明卡：玩法、排行榜前 10 名、名字輸入框，名字填了「開始遊戲」才按得下去（名字記在 `localStorage.blocks.name`，下次預先填好）。遊戲結束當下把名字和分數送到排行榜，結束畫面列出前 10 名並標出這個名字的那一列，不在前 10 名就接在最後面顯示名次。按「重新開始」中途放棄的那局不送。排行榜的後端見「API」。方塊是純 CSS 的寶石切面（四邊 border 做斜面＋`::after` 高光，顏色在 `.j-*` 的變數）。消除特效：碎片噴散、整排光束掃過、盤面震動（多條或連擊震更大），`prefers-reduced-motion` 時全部關掉。選單上方的「最佳」是這台瀏覽器自己的紀錄，存在 `localStorage.blocks.best`，跟排行榜無關。手機拖曳時方塊會浮在手指上方，避免被擋住。
- **計算機**（`calc`，桌面與 Spotlight）：照 macOS 基本計算機的算法，運算子套用到目前的累計值，`=` 連按會重複上一步。結果取 12 位有效數字（0.1 + 0.2 顯示 0.3），除以 0 顯示「錯誤」。視窗在最前面時吃鍵盤：數字、`+ - * /`、`Enter`、`Backspace`、`Esc`，這時 `/` 是除號、不開 Spotlight。768px 以下鍵盤貼底、按鍵變圓。
- **日曆**（`calendar`，桌面與 Spotlight）：月曆，週日開頭，今天是紅圈；點日期會在底部顯示完整日期、距今幾天與農曆。月份標題下列出這個月跨到的農曆月份與年（例：農曆 八月 – 九月 · 丙午年），每天日期下方是農曆日（初一那天改寫月份名，紅字）。農曆直接用瀏覽器的 `Intl`（`ca-chinese`），不維護對照表；不支援的瀏覽器就不顯示農曆。放假日（週末與國定假日）日期是紅字；國定假日與補假整格淡紅、農曆那行改寫節日名，底部寫全名。放假資料在 `HOLIDAYS`，照抄人事行政總處「政府行政機關辦公日曆表」（政府資料開放平臺 dataset 14718 的 CSV），目前有 2026、2027 兩年；週末預設放假，所以只列有名稱的假日和平日補假。人事總處每年 6 月 30 日前公告隔年的日曆表，屆時把新的一年加進去；沒列到的年份只會把週末標紅。桌面 icon 顯示今天的星期與日期，每分鐘更新。
- **下個連假小工具**（`#wgHol`）：連續放假 3 天以上、且其中有 `HOLIDAYS` 裡的日子才算連假。顯示還有幾天（或「明天」「放假中」）、節日名、連休天數與起訖日，每分鐘重算；點一下開日曆並選在連假第一天。`HOLIDAYS` 的資料用完就自動隱藏。
- **關於 TankOS**（`about`，點選單列左上的 T，或 Spotlight、`open about`）：版號直接讀 `.mb-ver`；更新紀錄從 GitHub API 抓 commit，只列 subject 結尾有 `（vX.Y.Z）` 的那些，所以版號規則裡「commit subject 標版號」是這個視窗的資料來源，不能省。主機欄依網址判斷是 Cloudflare Workers 還是 GitHub Pages。
- **Terminal** 是假的，指令寫死在 `run()` 裡；開視窗時會先列出 `HELP`。有幾個吃真資料：`who`（見下一條）、`git log [repo]`（GitHub API，未登入每小時 60 次）、`kubectl get pods`（跟活動監視器同一個 `probe()`）、`neofetch`、`top`。Tab 會補指令、`open` 的 App 名稱和 `git log` 的 repo。彩蛋（不列在 help）：`sudo`、`sudo rm -rf /`、`rm`、`deploy`（禮拜五不同）、`乖乖`、`vim`、`咖啡`、`hi`、`fortune`、`bug`，中文在上、英文在下。
- **我是社畜**（英文 I'm a Shachiku，`shachiku`，桌面「遊戲區」、Dock 與 Spotlight）：半夜被告警叫醒的像素 RPG，獨立在私人 repo `tankfinal/shachiku`、部署在 `https://shachiku.xarenvich.com`，遊戲內容、規則、版號都在那邊。跟其他作品一樣是網站型 App（`k: "w5"`，經典版作品第 05 項），視窗左邊介紹、右邊即時預覽，要全尺寸玩就按「開啟網站」開新分頁。repo 是私人的，所以沒有 Source 連結。舊名「凌晨三點」留在 Spotlight 關鍵字裡。
- **今晚出攤**（英文 Open Tonight，`nightmarket`，桌面「遊戲區」、Dock 與 Spotlight）：七天的夜市小吃攤經營遊戲，獨立在私人 repo `tankfinal/open-tonight`、部署在 `https://open-tonight.xarenvich.com`（Worker `open-tonight`），遊戲內容、規則、版號都在那邊。跟我是社畜一樣是網站型 App（`k: "w6"`，經典版作品第 05 項），沒有 Source 連結。遊戲只有中文。它的排行榜放在這個站的 D1 `portfolio` 裡的 `nightmarket_scores`（照「App 名當前綴」，App id 就是 `nightmarket`），API 在它自己的 Worker、不在這個 repo 的 `api/`，表結構見那邊的 `schema.sql`。
- **WordTrailer**（`wordtrailer`，桌面「作品」、Dock 與 Spotlight）：看美劇前先刷單字的網站，獨立在私人 repo `tankfinal/wordtrailer`、部署在 `https://wordtrailer.xarenvich.com`（Worker `wordtrailer`），內容與上架流程都在那邊。跟我是社畜一樣是網站型 App（`k: "w7"`，經典版作品第 06 項），沒有 Source 連結。網站只有中文。
- **口袋旅行**（英文 PocketTrip，`pockettrip`，桌面「作品」、Dock 與 Spotlight）：兩個人共用的吃喝玩樂清單，貼 Google Maps 分享連結就建檔，獨立在私人 repo `tankfinal/pocket-trip`、部署在 `https://pocket-trip.xarenvich.com`（Worker `trip`，資料在私人版的 D1 `portfolio-private`、表名 `trip_*`），要密碼登入，所以訪客開視窗只會看到登入畫面。網站型 App（`k: "w8"`，經典版作品第 07 項），沒有 Source 連結。icon 用 App 自己的 logo 圖（`images/pocket-trip-icon.png`），不是 SVG 線條圖示。網站只有中文。
- **Averlyn 疫苗**（英文 Averlyn's Vaccines，`averlyn`，桌面「作品」、Dock 與 Spotlight）：女兒的疫苗時程，獨立在私人 repo `tankfinal/averlyn-vaccine`、部署在 `https://averlyn-vaccine.xarenvich.com`（Worker `averlyn-vaccine`，密碼雜湊與登入紀錄在私人版的 D1 `portfolio-private`、表名 `averlyn_*`），要密碼登入，訪客開視窗只會看到登入畫面。網站型 App（`k: "w9"`，經典版作品第 08 項），沒有 Source 連結。icon 用 App 自己的 logo 圖（`images/averlyn-icon.png`）。跟口袋旅行同一套設計語彙。網站只有中文。
- **Request 的一生**（`trace`，獨立檔案 App，桌面「遊戲區」與 Spotlight）：按「送出請求」打一次 `GET /trace`，畫出三塊：路線圖（你 → Cloudflare 機房，Worker 在這裡跑 → D1 所在機房），每段標實測來回時間、直線距離與光速來回下限（光纖約 200 km/ms），送出時有一顆點沿路線來回（減少動態效果時不跑）；瀑布圖用瀏覽器的 Resource Timing（`PerformanceObserver`，不受 250 筆緩衝上限影響）拆 DNS、連線、TLS、等待回應、下載，「等待回應」再拆成網路來回（Cloudflare 量的 RTT）、Worker 等 D1、其他；細節列協定、TLS、網路業者、資料庫（D1 所在機房、主要或副本）與查詢（`SELECT 1` 與資料庫實際執行的時間）。路線圖、圖例與結論都寫「資料庫」而不是 D1，結論那句直接用兩端的城市（例：從達拉斯到新加坡），讓不懂後端的人也看得懂。選單列的線上人數讓這台 Worker 的連線一直開著，所以通常是連線重用、DNS 與 TLS 為 0，畫面會照實說明，並列出當初開這條連線的那個請求（通常是 `/presence` 的心跳）花了多少 DNS、連線、TLS 時間——找法是這次之前、最後一個有連線時間的 API 請求；瀏覽器的 Resource Timing 緩衝（250 筆）滿了以後只信視窗開著時 `PerformanceObserver` 看到的，找不到就不顯示。網頁沒辦法要求瀏覽器開新連線，所以只能顯示當初那條的數字。機房座標表在 `apps/trace.js` 的 `COLO`，不在表裡的機房只顯示代號、不算距離。最近 10 次的總時間與中位數列在最下面。路線圖、結論和細節以外分三個分頁：**時間軸**（預設，SVG 循序圖，三條泳道「你／Cloudflare／資料庫」由上往下走時間；色塊是實測的建立連線、資料庫執行查詢、其他、下載，虛線箭頭是單程，量不到所以用來回除以 2 並標 ≈；照視窗實際寬度畫、`ResizeObserver` 在寬度變了才重畫）、**瀑布圖**（上面那段）、**原始封包**（請求依 HTTP 版本顯示：HTTP/2、3 用 `:method`、`:path` 這類 pseudo-header，HTTP/1.1 用請求行；瀏覽器自動加的 header 網頁讀不到，畫面上註明。回應列 status、全部 header（Worker 送 `Access-Control-Expose-Headers: *`）和排版過的 JSON，加上內容大小（有壓縮時列壓縮前後）。header 的實際大小瀏覽器不公開：Resource Timing 規格的 `transferSize` 是內容大小加固定 300，避免從大小推出 cookie，所以畫面不拿它算 header，直接照實說明）。
- **線上訪客**（選單列時鐘左邊的綠點與人數、終端機 `who`）：每個分頁每 30 秒向 `/presence` 回報一次（分頁在背景時停止，切回來馬上補一次），回應就是 60 秒內有回報的人；離開頁面時用 `sendBeacon` 打 `/presence/leave` 立刻下線。回報內容是分頁 id 和「現在在看什麼」（最上層視窗的 App id，沒開視窗是 `desktop`，還沒解鎖是 `lock`）。`who` 會重新問一次伺服器，列出 `visitor-xxxx`、城市與國家、上線時間（看的人的當地時間）、在看什麼，自己那列標「← 你」，只有自己時跳彩蛋。點選單列的人數會開終端機並執行 `who`（`initTerm` 把 `exec` 掛在視窗的 `_cmd` 上）。分頁 id 存在 `sessionStorage.who.sid`，新分頁或下次造訪就是新的人，不跨造訪追蹤。API 連不上時人數不顯示，`who` 印錯誤。後端見「API」。

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

## 版號

選單列右邊的 `vX.Y.Z` 是 TankOS 的版號，寫在 `index.html` 的 `.mb-ver`，全站只有這一處。600px 以下選單列放不下，不顯示版號（「關於 TankOS」和 `neofetch` 照樣讀得到）。經典版不另外計號，改經典版也算 TankOS 的一次改動。

改到網站上看得到的東西就要升版，跟改動放在同一個 commit：

| 位數 | 什麼時候升 | 例子 |
|---|---|---|
| X 大改版 | 整體架構、網址結構或操作方式變了，舊的連結或用法會失效 | TankOS 換成首頁、經典版搬到 `/classic/` |
| Y 新功能 | 多了看得到的新東西：新 App、新的系統功能、新的桌面分區 | 新增陽明山 App、Spotlight、方塊消除 |
| Z 修正 | 沒有新功能：修 bug、改文案、調樣式、更新經歷或作品介紹 | 終端機 `open` 認得中文名、拿掉車型描述 |

- 升哪一位，它右邊的位數歸零：`1.4.2 → 1.5.0`、`1.5.0 → 2.0.0`
- 一個 commit 裡有好幾種改動，只升最大的那一位，而且只升一次
- 只改 README、CLAUDE.md、`.assetsignore` 這類不影響畫面的檔案，不升版
- commit subject 結尾標上新版號，例如 `feat(os): 新增 XX App（v1.1.0）`。「關於 TankOS」的更新紀錄就是讀這個，沒標的 commit 不會出現
- 私人版（portfolio-private）自己計號，兩邊互不影響

## 更新作品縮圖

縮圖是 headless 瀏覽器截 live 站的首屏，1280×800 CSS px，再壓成 jpg：

```bash
sips -Z 900 shot.png                                   # 長邊縮到 900
sips -s format jpeg -s formatOptions 78 shot.png --out out.jpg
```

## API（`api/`）

方塊消除的排行榜、線上訪客與 Request 的一生是網站同一個 Worker（`portfolio`）底下的 `/api/*`，資料放 Cloudflare D1 的 `portfolio` 資料庫，都在免費額度內。同一個資料庫裡還有今晚出攤的 `nightmarket_scores`：表由 tankfinal/open-tonight 的 `schema.sql` 建、由它自己的 Worker（`open-tonight`）讀寫，這個 repo 的程式不碰；刪資料、改表結構時別動到它。只有 `/api/*` 會執行程式（`wrangler.jsonc` 的 `run_worker_first`），其他請求都是靜態檔，免費也不限量。屬於某個 App 的表用 App 名當前綴（方塊消除的排行榜是 `blocks_scores`），`presence` 是 TankOS 本身的。直接打開 `/api/` 是一頁說明，列出下面這些 API。跟靜態站分開部署（見下方「部署」）：GitHub Pages 與 `portfolio` Worker 都只送靜態檔，`api/` 已列進 `.assetsignore`。

```
GET  /api/                         → 說明頁（HTML）
GET  /api/scores                   → {top}
POST /api/scores {name, score}     → {top, me:{name, score, rank}}
POST /api/presence {sid, app}      → {me, total, online:[{tag, city, country, app, since}]}
POST /api/presence/leave {sid}     → 204
GET  /api/trace                    → {edge, client, d1}
```

### 排行榜（`/scores`）

- **一個名字一列，只留最高分**：名字不分大小寫（`Tank` 和 `tank` 算同一人，顯示第一次留下的寫法），新分數比較高才覆蓋。同分時先達到的排前面
- **名字沒有登入驗證**：任何人打同一個名字都算同一個玩家，分數也是前端送的，這是給作品集玩的榜，不防作弊
- **輸入檢查**：名字壓掉空白與控制字元後要 1–12 個字，分數是 1 到 10,000,000 的整數，不符合回 400
- **CORS**：網站跟 API 同網域，用不到；`src/index.js` 的 `ORIGINS` 只留本機 `localhost:4321`，給頁面跟 API 分開跑的本機測試用
- 要刪掉某一列（例如不雅的名字）：`npx wrangler d1 execute portfolio --remote --command "DELETE FROM blocks_scores WHERE name = 'xxx'"`，在 repo 根目錄執行

### 線上訪客（`/presence`）

- **一個分頁一列**（`presence` 表）：`sid` 是前端產生的 32 位 hex，每次回報更新 `app` 與 `seen_at`，`since` 留第一次回報的時間。`seen_at` 在 60 秒內算在線；超過 5 分鐘的列在下一次有人回報時刪掉
- **存什麼**：`sid`、`tag`、Cloudflare 從 IP 推出的城市與國家（`request.cf.city` / `country`）、`app`、兩個時間。不存 IP 與 User-Agent。`sid` 不會回給別人，畫面上的 `visitor-xxxx` 是 `tag`，即 `SHA-256(sid)` 的前 4 位 hex
- **輸入檢查**：`sid` 要是 32 位小寫 hex，`app` 要是 1–20 個小寫英文字母，不符合回 400。`app` 只檢查格式，前端只顯示自己認得的 App 名稱，其他一律顯示 `—`，所以訪客送不出任意文字給別人看
- **body 用 `text/plain` 送**：這樣是 simple request，每次回報不用先打 CORS preflight；`sendBeacon` 本來也送不了 preflight
- **不防作弊**：跟排行榜一樣沒有登入，有人寫程式狂打可以把人數灌高，或把當天的免費額度（Workers 每天 10 萬次請求、D1 每天 10 萬列寫入，整個帳號共用）用完，用完時整個帳號的 D1 都不能查詢，排行榜也會跟著讀寫失敗，到 UTC 午夜（台北早上 8 點）重置。真的發生再加限流

### Request 的一生（`/trace`）

- **到 D1 走一趟**：查詢是 `SELECT 1`，不讀任何表、跟排行榜無關，只為了讓請求真的到 D1 所在機房再回來；用 `Date.now()` 包住量這段來回。Worker 裡的 `Date.now()` 只在 I/O 完成時前進（Cloudflare 防 timing 側通道的設計），所以量得到等 D1 的時間，量不到 Worker 自己的 CPU 時間
- **回什麼**：`edge` 是 Cloudflare 機房代號（`request.cf.colo`）；`client` 是城市、國家、經緯度、RTT（`clientQuicRtt` 或 `clientTcpRtt`）、HTTP 版本、TLS 版本與加密套件、網路業者（`asOrganization`）；`d1` 是 D1 回報的機房、區域、是否主要資料庫（`meta.served_by_*`）、Worker 量的來回 `ms`、SQL 執行 `sqlMs`。都只回給發請求的人，不寫入、不存
- **header**：`Server-Timing`（開發者工具的 Timing 分頁看得到 D1 與 SQL 時間）。`Access-Control-Expose-Headers: *` 每個回應都帶，網頁才讀得到 `cf-ray`、`alt-svc`、`Server-Timing` 這些 header。網站和 API 同網域，瀏覽器本來就給得出每段時間；`Timing-Allow-Origin` 只在本機測試跨 port 時用得到（跟 CORS 一樣只給 `ORIGINS`）

### 部署

API 跟網站一起部署，見下方「Deploy」。表結構改了就在 push 之前跑一次：

```bash
npx wrangler d1 execute portfolio --remote --file=api/schema.sql   # 全部是 IF NOT EXISTS，既有資料不受影響
```

## Local

```bash
npx wrangler d1 execute portfolio --local --file=api/schema.sql   # 第一次
npx wrangler dev                                                  # http://localhost:8787，網站和 /api 都在
```

只看畫面、不需要 API 的話，`python3 -m http.server 4321` 也行（排行榜、線上人數會讀不到）。

## Tests

Playwright 回歸測試，鎖住 TankOS 現在的行為（視窗開關、聚焦、拖曳、縮放、最小化／放大、Dock、各 App、語言、版面），改外觀的時候拿來證明行為沒變。

```bash
npm ci                 # 第一次
npm test               # 功能與版面測試（本機 Chromium，基準截圖會跳過）
npm run test:docker    # 全部，含基準截圖比對；跟 CI 用同一個 Playwright Docker image
npm run test:docker:update   # 畫面是故意改的：重產基準截圖，PR 裡看 PNG diff
npm run check:assets   # 用 wrangler dry-run 列出會變成公開檔案的清單，確認沒有測試與開發工具
```

- **不碰正式資料**：測試用 `tests/support/serve.js` 在本機起站，`/api/*` 一律回固定的假資料，iframe 裡的作品站、活動監視器、GitHub API 也都換成假的回應，不會打到 D1 或任何外部網站
- **不會不穩定**：時間固定在 2026-11-07 10:30（Asia/Taipei），開「減少動態效果」讓 TankOS 跳過動畫，截圖前等字型與桌布載完；不設 retry，偶發失敗就會被看到
- **基準截圖**只在 `mcr.microsoft.com/playwright:v1.63.0-noble` 裡比對（字型與繪製要一模一樣），所以 `npm test` 會跳過，`test:docker` 與 CI 才跑。升 `@playwright/test` 版本時，image tag（`package.json` 的 scripts 與 `.github/workflows/e2e.yml`）要一起改，並重產截圖
- **已知 bug** 用 `test.fail()` 記錄：測試寫的是正確行為，所以現在預期失敗；修好以後它會變紅（「Expected to fail, but passed」），這時把 `test.fail()` 和旁邊的「reproduces」測試一起拿掉。寫法見 `tests/e2e/layout.spec.js` 開頭（v2.4.1 修掉的 Dock 溢出、README 蓋住 icon 就是這樣記錄的）
- **基準截圖遮住選單列的版號**（洋紅色方塊），只升版不會讓截圖失效；比對門檻是 `threshold: 0.01`（預設 0.2 會把 6% 的透明度變化當成沒變）
- **兩個 project**：`default` 跑全部測試；`ui2` 在 2.0 flag 打開的狀態下再跑一次 window manager、Dock 與 App、版面測試，證明換主題沒有改到行為。flag 與 token 本身的測試在 `tests/e2e/ui-flag.spec.js`，`?ui=2` 的基準截圖檔名帶 `-ui2`
- **新增根目錄檔案**時，不是網站的檔案記得加進 `.assetsignore`，`npm run check:assets` 會擋
- CI（GitHub Actions `e2e`）在 `gh-pages` 以外的每次 push 與對 `main` 的 PR 跑，只測試、不部署
- Workers Builds 看到 `package-lock.json` 會先 `npm ci`（只裝 `@playwright/test`，不下載瀏覽器），部署指令跟結果都不變；想省掉這一步可以在 Dashboard 的 build 變數設 `SKIP_DEPENDENCY_INSTALL=1`

## Deploy

Push 到 `main` → Cloudflare Workers Builds 自動部署 Worker `portfolio`（網址 `portfolio.xarenvich.com` 與 `xarenvich.com`，由 `wrangler.jsonc` 的 `routes` 接上 Custom Domain；`workers_dev: true` 讓舊的 `portfolio.xarenvich.workers.dev` 繼續可用）。Dashboard 上的設定（`portfolio` → Settings → Build）：

| 設定 | 值 |
|---|---|
| Git branch | `main` |
| Root directory | `/` |
| Build command | 空白 |
| Deploy command | `npx wrangler deploy`（讀 repo 根目錄的 `wrangler.jsonc`） |

- **靜態檔**是 repo 根目錄整個上傳，不是網站的檔案（文件、設定、`api/` 原始碼、本機的 `.wrangler`、截圖資料夾）列在 `.assetsignore`。新增這類檔案記得加進去
- **Workers Builds 部署到 Dashboard 上接著的那個 Worker**，`wrangler.jsonc` 的 `name` 不一樣也照樣成功（2026-10-13 實測），所以 Worker 改名一定要在 Dashboard 改接
- **舊網址**：GitHub Pages 改成發佈 `gh-pages` 分支，那個分支只有轉址頁（`index.html`、`classic/`、`os/`、`404.html`），`tankfinal.github.io/portfolio/<任何路徑>` 都轉到這裡的同一路徑，query 和 hash 照帶。`main` 不再由 GitHub Pages 發佈；轉址頁要改就改 `gh-pages` 分支，推上去後若沒自動重建，用 `gh api -X POST repos/tankfinal/portfolio/pages/builds` 觸發
- 急著上線或 Workers Builds 出狀況時，可以在 repo 根目錄手動 `npx wrangler deploy`
