# portfolio

Tank Yang 的個人網站 — 經歷、個人專案與開源工具的集合。

> Live: [tankfinal.github.io/portfolio](https://tankfinal.github.io/portfolio/)

## About

同一份內容做成兩個版本，都有中英雙語切換：

- **TankOS**（首頁 `/`）：macOS 風格的桌面，作品以 App 視窗開啟、直接跑 live 站。見下方 TankOS 一節。
- **經典版**（[`/classic/`](https://tankfinal.github.io/portfolio/classic/)）：一頁式排版，收錄六段工作經歷、四個自己在用的個人網站，以及三個開源工具。

`/os/` 是 TankOS 搬到首頁前的網址，已經分享出去過，現在只負責轉址回首頁。

**沒有 build step。** 兩個版本各是一個 HTML 檔（CSS 與 JS 都內嵌），加四張截圖；比較大的 TankOS App 另外放在 `apps/<id>.js`，開視窗時才載入。改完 push 就是部署。

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
├── trace.js        # Request 的一生
├── oncall.js       # 凌晨三點（On-call 小遊戲）
└── oncall/         # On-call 的像素素材（Kenney，CC0）：indoor.png、urban.png
images/
├── fukuoka-trip.jpg      # 經典版的作品縮圖（截自 live 站）
├── busan-trip.jpg
├── yangmingshan-trip.jpg
├── wallpaper-komezuka.jpg     # TankOS 桌布（1920px）
├── wallpaper-komezuka-sm.jpg  # 手機版桌布（1200px）
└── averlyn-vaccine.jpg
api/                # 排行榜、線上訪客、Request 的一生共用的 Worker + D1，獨立部署，見「API」
├── src/index.js
├── schema.sql
└── wrangler.jsonc
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
- **桌面分區**：icon 依類型分四區，各區有小標（`os.zone.*`，中英雙語）。左欄由上往下是「作品」（live 站）、「實驗區」（方塊消除、Request 的一生、凌晨三點）；右欄由上往下是「小工具」（終端機、活動監視器、計算機、日曆）、「下個連假」小工具、「關於我」（README 與聯絡我）。四區都是兩欄，不會伸進預設開啟的 README 視窗底下。兩欄都從上往下排、沒有貼底的區塊，最高的右欄底部約在 551px，視窗高度 560px 以上都不會被切到；加 icon 前先量一下，別讓任一欄超過這個高度太多（常見的 1366×768 筆電扣掉瀏覽器工具列只剩約 625–657px）。「關於 TankOS」沒有桌面 icon，由選單列左上的 T、Spotlight、`open about` 開，跟 macOS 一樣。新增 App 時放進對應區塊的 `<ul class="icons">`。768px 以下四區改成由上往下排，每列四顆。
- **App 視窗用 iframe 直接跑 live 站**，左側欄是經典版同一份作品介紹。新增 App：在 `APPS` 加一筆（`k` 指向經典版的作品 key、`url`、`src`、`spec`），再補桌面 icon 和 Dock 各一顆按鈕；要讓活動監視器和 `kubectl` 看得到，`SERVICES` 也加一筆；Spotlight 的別名寫在 `KW`。被嵌的站不能送 `X-Frame-Options` / `frame-ancestors`，GitHub Pages 預設沒有。
- **獨立檔案 App**（`APPS` 裡帶 `file` 的，目前有 `trace`、`oncall`）：程式、CSS、中英字串都在 `apps/<id>.js`，第一次開視窗才用 `<script>` 載入（網址帶 `?v=<版號>`，升版就不會吃到舊快取），載入中顯示轉圈，失敗顯示重試。檔案呼叫 `TankOS.define(id, {html, css, i18n, init})` 登記自己：`html` 是視窗內容（根元素帶 `body` class），`css` 第一次載入時注入一次，`i18n` 併進 `I18N`（key 用自己的前綴），`init(body, os)` 可以回傳一個關視窗時要跑的函式。`os` 是檔案唯一拿得到的東西：`t`、`fill`、`lang()`、`onLang(f)`（回傳取消函式）、`api`（Worker 網址）、`open`、`still`（減少動態效果的 media query）。新增一個：寫 `apps/<id>.js`，`APPS` 加 `{w, h, file:"apps/<id>.js"}`，`I18N` 加 `app.<id>`，桌面 icon（含 `.ic-<id>` 顏色與 SVG symbol）、`KW`、`index()` 的清單、終端機 `OPENABLE` 與 `ls` 各補一處；App 名稱和 icon 留在 `index.html`，因為載入前桌面和 Spotlight 就要顯示。
- **私人版入口**：選單列右側的 🔒「私人版」，開新分頁到 [portfolio-private](https://github.com/tankfinal/portfolio-private)（Cloudflare Access 保護），跟私人版選單列的「公開版」對稱。手機只剩鎖頭。Spotlight 與 `open private` 也能開（`APPS.private` 用 `link` 標記，`open()` 直接開新分頁）。Access 登入頁不能放進 iframe，所以不開視窗。私人內容一律不進這個 repo，這裡只有入口。
- **鎖定畫面**：每次進站都會出現（米塚模糊背景、時鐘、Tank Yang），點一下或按任意鍵解鎖。markup 帶 `hidden`，由 JS 打開，所以沒有 JS 時不會擋住頁面。
- **Spotlight**：⌘K / Ctrl+K、`/`，或選單列的放大鏡。索引在 `index()`：App、經歷（`e1`–`e6`）、技術名詞、動作（切語言、經典版、GitHub）。
- **活動監視器**（`activity`，只在桌面和 Spotlight，不放 Dock）：瀏覽器直接對 `SERVICES` 每個站發 `fetch(no-store)`，顯示狀態、延遲、趨勢線、HTML 大小、`Last-Modified` 當作最後部署時間，每 15 秒更新，關視窗就停。CORS 被擋時退回 `no-cors`，只能判斷有沒有活著。
- **方塊消除**（`blocks`，桌面與 Spotlight）：8×8 盤面、一次給三塊，拖曳放置，點一下（指標沒移動超過 6px）方塊順時針轉 90 度；填滿整排或整列就消除，連擊加分，三塊不論轉成哪個方向都放不下才結束（灰掉的方塊也用同一個判斷）。開窗先出現說明卡：玩法、排行榜前 10 名、名字輸入框，名字填了「開始遊戲」才按得下去（名字記在 `localStorage.blocks.name`，下次預先填好）。遊戲結束當下把名字和分數送到排行榜，結束畫面列出前 10 名並標出這個名字的那一列，不在前 10 名就接在最後面顯示名次。按「重新開始」中途放棄的那局不送。排行榜的後端見「API」。方塊是純 CSS 的寶石切面（四邊 border 做斜面＋`::after` 高光，顏色在 `.j-*` 的變數）。消除特效：碎片噴散、整排光束掃過、盤面震動（多條或連擊震更大），`prefers-reduced-motion` 時全部關掉。選單上方的「最佳」是這台瀏覽器自己的紀錄，存在 `localStorage.blocks.best`，跟排行榜無關。手機拖曳時方塊會浮在手指上方，避免被擋住。
- **計算機**（`calc`，桌面與 Spotlight）：照 macOS 基本計算機的算法，運算子套用到目前的累計值，`=` 連按會重複上一步。結果取 12 位有效數字（0.1 + 0.2 顯示 0.3），除以 0 顯示「錯誤」。視窗在最前面時吃鍵盤：數字、`+ - * /`、`Enter`、`Backspace`、`Esc`，這時 `/` 是除號、不開 Spotlight。768px 以下鍵盤貼底、按鍵變圓。
- **日曆**（`calendar`，桌面與 Spotlight）：月曆，週日開頭，今天是紅圈；點日期會在底部顯示完整日期、距今幾天與農曆。月份標題下列出這個月跨到的農曆月份與年（例：農曆 八月 – 九月 · 丙午年），每天日期下方是農曆日（初一那天改寫月份名，紅字）。農曆直接用瀏覽器的 `Intl`（`ca-chinese`），不維護對照表；不支援的瀏覽器就不顯示農曆。放假日（週末與國定假日）日期是紅字；國定假日與補假整格淡紅、農曆那行改寫節日名，底部寫全名。放假資料在 `HOLIDAYS`，照抄人事行政總處「政府行政機關辦公日曆表」（政府資料開放平臺 dataset 14718 的 CSV），目前有 2026、2027 兩年；週末預設放假，所以只列有名稱的假日和平日補假。人事總處每年 6 月 30 日前公告隔年的日曆表，屆時把新的一年加進去；沒列到的年份只會把週末標紅。桌面 icon 顯示今天的星期與日期，每分鐘更新。
- **下個連假小工具**（`#wgHol`）：連續放假 3 天以上、且其中有 `HOLIDAYS` 裡的日子才算連假。顯示還有幾天（或「明天」「放假中」）、節日名、連休天數與起訖日，每分鐘重算；點一下開日曆並選在連假第一天。`HOLIDAYS` 的資料用完就自動隱藏。
- **關於 TankOS**（`about`，點選單列左上的 T，或 Spotlight、`open about`）：版號直接讀 `.mb-ver`；更新紀錄從 GitHub API 抓 commit，只列 subject 結尾有 `（vX.Y.Z）` 的那些，所以版號規則裡「commit subject 標版號」是這個視窗的資料來源，不能省。主機欄依網址判斷是 Cloudflare Workers 還是 GitHub Pages。
- **Terminal** 是假的，指令寫死在 `run()` 裡；開視窗時會先列出 `HELP`。有幾個吃真資料：`who`（見下一條）、`git log [repo]`（GitHub API，未登入每小時 60 次）、`kubectl get pods`（跟活動監視器同一個 `probe()`）、`neofetch`、`top`。Tab 會補指令、`open` 的 App 名稱和 `git log` 的 repo。彩蛋（不列在 help）：`sudo`、`sudo rm -rf /`、`rm`、`deploy`（禮拜五不同）、`乖乖`、`vim`、`咖啡`、`hi`、`fortune`、`bug`，中文在上、英文在下。
- **凌晨三點**（英文 3 A.M.，`oncall`，獨立檔案 App，桌面「實驗區」與 Spotlight）：半夜被告警叫醒的俯視角像素 RPG。App id、檔名與 `localStorage` 的 key 沿用最早的名字 `oncall`，改名時沒動，存過的評等才不會消失。打開就隨機丟一個事故（優先挑沒玩過的，`localStorage.oncall.seen`），右上角「重新開始」換一個。場景是半夜的家：臥室加書房，20×12 格的 canvas，木地板與牆用程式畫，家具與角色用 Kenney 的 CC0 素材（`apps/oncall/indoor.png` 是 Roguelike Indoors，16px 格、間隔 1px；`apps/oncall/urban.png` 是 RPG Urban Pack，16px、無間隔，角色四方向各三格走路），兩包都沒有的床、地毯、筆電、手機、機櫃、綠色乖乖在 `ART` 裡用字串畫。操作：方向鍵／WASD 走、空白鍵互動、J 開紀錄；也可以點地板（廣度優先找路走過去）或點東西（走到旁邊並使用）。夜晚是一層暗色疊上去再挖出光（角色、窗外月光、響鈴的手機、打開後的筆電、機櫃燈號）。流程：手機響 → 接起來才看得到告警 → 去筆電（終端機，選項前面有 `$`）、手機（叫醒同事、聯絡對方）、機櫃（拜乖乖）做事，每個選項標在 `SCN` 的 `at`（預設筆電）。每個地點的畫面保留在那裡做過的所有事，「紀錄」本列出全部告警、動作與結果。每個動作花模擬分鐘（走路不花），按鈕上不標時間（選了才在紀錄裡看到，否則最貴的那個一看就是陷阱），選項順序每局打亂（資料裡正解常排第一）。客訴依每分鐘的速率累加，陷阱會再加一筆並變灰；有的選項改變速率（止血）。狀態列只寫「值班中」，事故名稱到結局才揭曉。修好後回床上：角色躺進被窩、熄燈冒 Zzz、天亮陽光從窗戶進來，然後 END 卡片依評等給結局（S 一夜好眠／A 大杯咖啡／B 站會主角／C 天亮了；S＝零陷阱且不超過最快路徑 2 分鐘，A＝最多一個陷阱且不超過 1.6 倍，B＝不超過 2.5 倍），再進事故檢討：修復時間與最快路徑、客訴數、陷阱、真正原因、最快的處理順序、事後待辦、一句教訓。最快路徑由資料自動算（每一步取能往下走的最便宜選項）。最佳評等存在 `localStorage.oncall.best`。減少動態效果時走路直接到位、沒有打字效果與 Zzz、結局直接出卡片。手機寬度（容器 520px 以下）面板、紀錄、對話框與結局卡片改放在地圖下方。情境都是業界常見情境改寫，不放公司或系統名稱。
- **Request 的一生**（`trace`，獨立檔案 App，桌面「實驗區」與 Spotlight）：按「送出請求」打一次 `GET /trace`，畫出三塊：路線圖（你 → Cloudflare 機房，Worker 在這裡跑 → D1 所在機房），每段標實測來回時間、直線距離與光速來回下限（光纖約 200 km/ms），送出時有一顆點沿路線來回（減少動態效果時不跑）；瀑布圖用瀏覽器的 Resource Timing（`PerformanceObserver`，不受 250 筆緩衝上限影響）拆 DNS、連線、TLS、等待回應、下載，「等待回應」再拆成網路來回（Cloudflare 量的 RTT）、Worker 等 D1、其他；細節列協定、TLS、網路業者、資料庫（D1 所在機房、主要或副本）與查詢（`SELECT 1` 與資料庫實際執行的時間）。路線圖、圖例與結論都寫「資料庫」而不是 D1，結論那句直接用兩端的城市（例：從達拉斯到新加坡），讓不懂後端的人也看得懂。選單列的線上人數讓這台 Worker 的連線一直開著，所以通常是連線重用、DNS 與 TLS 為 0，畫面會照實說明，並列出當初開這條連線的那個請求（通常是 `/presence` 的心跳）花了多少 DNS、連線、TLS 時間——找法是這次之前、最後一個有連線時間的 API 請求；瀏覽器的 Resource Timing 緩衝（250 筆）滿了以後只信視窗開著時 `PerformanceObserver` 看到的，找不到就不顯示。網頁沒辦法要求瀏覽器開新連線，所以只能顯示當初那條的數字。機房座標表在 `apps/trace.js` 的 `COLO`，不在表裡的機房只顯示代號、不算距離。最近 10 次的總時間與中位數列在最下面。路線圖、結論和細節以外分三個分頁：**時間軸**（預設，SVG 循序圖，三條泳道「你／Cloudflare／資料庫」由上往下走時間；色塊是實測的建立連線、資料庫執行查詢、其他、下載，虛線箭頭是單程，量不到所以用來回除以 2 並標 ≈；照視窗實際寬度畫、`ResizeObserver` 在寬度變了才重畫）、**瀑布圖**（上面那段）、**原始封包**（請求依 HTTP 版本顯示：HTTP/2、3 用 `:method`、`:path` 這類 pseudo-header，HTTP/1.1 用請求行；瀏覽器自動加的 header 網頁讀不到，畫面上註明。回應列 status、全部 header（Worker 送 `Access-Control-Expose-Headers: *`）和排版過的 JSON，加上內容大小（有壓縮時列壓縮前後）。header 的實際大小瀏覽器不公開：Resource Timing 規格的 `transferSize` 是內容大小加固定 300，避免從大小推出 cookie，所以畫面不拿它算 header，直接照實說明）。
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

方塊消除的排行榜、線上訪客與 Request 的一生共用一個 Cloudflare Worker `blocks-leaderboard`（名稱沿用最早只有排行榜的時候），資料放 Cloudflare D1（同名資料庫），都在免費額度內。跟靜態站分開部署（見下方「部署」）：GitHub Pages 與 `portfolio` Worker 都只送靜態檔，`api/` 已列進 `.assetsignore`。

```
GET  https://blocks-leaderboard.xarenvich.workers.dev/scores               → {top}
POST https://blocks-leaderboard.xarenvich.workers.dev/scores {name, score} → {top, me:{name, score, rank}}
POST https://blocks-leaderboard.xarenvich.workers.dev/presence {sid, app}   → {me, total, online:[{tag, city, country, app, since}]}
POST https://blocks-leaderboard.xarenvich.workers.dev/presence/leave {sid} → 204
GET  https://blocks-leaderboard.xarenvich.workers.dev/trace                → {edge, client, d1}
```

### 排行榜（`/scores`）

- **一個名字一列，只留最高分**：名字不分大小寫（`Tank` 和 `tank` 算同一人，顯示第一次留下的寫法），新分數比較高才覆蓋。同分時先達到的排前面
- **名字沒有登入驗證**：任何人打同一個名字都算同一個玩家，分數也是前端送的，這是給作品集玩的榜，不防作弊
- **輸入檢查**：名字壓掉空白與控制字元後要 1–12 個字，分數是 1 到 10,000,000 的整數，不符合回 400
- **CORS** 只開給 `tankfinal.github.io`、`portfolio.xarenvich.workers.dev` 和本機 `localhost:4321`。新增網域時改 `src/index.js` 的 `ORIGINS`
- 要刪掉某一列（例如不雅的名字）：`npx wrangler d1 execute blocks-leaderboard --remote --command "DELETE FROM scores WHERE name = 'xxx'"`，在 `api/` 底下執行

### 線上訪客（`/presence`）

- **一個分頁一列**（`presence` 表）：`sid` 是前端產生的 32 位 hex，每次回報更新 `app` 與 `seen_at`，`since` 留第一次回報的時間。`seen_at` 在 60 秒內算在線；超過 5 分鐘的列在下一次有人回報時刪掉
- **存什麼**：`sid`、`tag`、Cloudflare 從 IP 推出的城市與國家（`request.cf.city` / `country`）、`app`、兩個時間。不存 IP 與 User-Agent。`sid` 不會回給別人，畫面上的 `visitor-xxxx` 是 `tag`，即 `SHA-256(sid)` 的前 4 位 hex
- **輸入檢查**：`sid` 要是 32 位小寫 hex，`app` 要是 1–20 個小寫英文字母，不符合回 400。`app` 只檢查格式，前端只顯示自己認得的 App 名稱，其他一律顯示 `—`，所以訪客送不出任意文字給別人看
- **body 用 `text/plain` 送**：這樣是 simple request，每次回報不用先打 CORS preflight；`sendBeacon` 本來也送不了 preflight
- **不防作弊**：跟排行榜一樣沒有登入，有人寫程式狂打可以把人數灌高，或把當天的免費額度（Workers 每天 10 萬次請求、D1 每天 10 萬列寫入，整個帳號共用）用完，用完時整個帳號的 D1 都不能查詢，排行榜也會跟著讀寫失敗，到 UTC 午夜（台北早上 8 點）重置。真的發生再加限流

### Request 的一生（`/trace`）

- **到 D1 走一趟**：查詢是 `SELECT 1`，不讀任何表、跟排行榜無關，只為了讓請求真的到 D1 所在機房再回來；用 `Date.now()` 包住量這段來回。Worker 裡的 `Date.now()` 只在 I/O 完成時前進（Cloudflare 防 timing 側通道的設計），所以量得到等 D1 的時間，量不到 Worker 自己的 CPU 時間
- **回什麼**：`edge` 是 Cloudflare 機房代號（`request.cf.colo`）；`client` 是城市、國家、經緯度、RTT（`clientQuicRtt` 或 `clientTcpRtt`）、HTTP 版本、TLS 版本與加密套件、網路業者（`asOrganization`）；`d1` 是 D1 回報的機房、區域、是否主要資料庫（`meta.served_by_*`）、Worker 量的來回 `ms`、SQL 執行 `sqlMs`。都只回給發請求的人，不寫入、不存
- **header**：`Server-Timing`（開發者工具的 Timing 分頁看得到 D1 與 SQL 時間）。`Timing-Allow-Origin` 跟 CORS 一樣只給 `ORIGINS` 裡的來源，而且每個路由的回應都帶：沒有它瀏覽器會把跨網域請求的 DNS、連線、TLS、等待時間都回 0，Request 的一生就看不到當初開連線的那個請求（通常是 `/presence`）花了多少。`Access-Control-Expose-Headers: *` 也是每個回應都帶，網頁才讀得到 `cf-ray`、`alt-svc`、`Server-Timing` 這些 header（不帶 credentials 的請求，`*` 涵蓋 Set-Cookie 以外的全部）

### 部署

Push 到 `main` 且改到 `api/` 底下的檔案 → Cloudflare Workers Builds 自動部署 `blocks-leaderboard`。只改網頁的 push 不會觸發它。Dashboard 上的設定（`blocks-leaderboard` → Settings → Build）：

| 設定 | 值 |
|---|---|
| Git branch | `main` |
| Root directory | `/api/` |
| Build command | 空白 |
| Deploy command | `npx wrangler deploy` |
| Build watch paths | Include `api/*` |
| Enable Preview Builds | 關閉 |

Dashboard 上的 Worker 名稱要跟 `wrangler.jsonc` 的 `name` 一致，不一致建置會失敗。急著上線或 Workers Builds 出狀況時，也可以在 `api/` 底下手動 `npx wrangler login` 再 `npx wrangler deploy`。

第一次建資料庫時，`npx wrangler d1 create blocks-leaderboard` 把產生的 `database_id` 填進 `wrangler.jsonc`，再跑 `npx wrangler d1 execute blocks-leaderboard --remote --file=schema.sql` 建表。`schema.sql` 全部是 `IF NOT EXISTS`，之後加了新表（例如 `presence`）就在 push 之前再跑一次同一行，既有的表和資料不受影響。

本機測試：

```bash
cd api
npx wrangler d1 execute blocks-leaderboard --local --file=schema.sql
npx wrangler dev                                     # http://localhost:8787
```

前端寫死打正式網址（`index.html` 的 `API`，排行榜與線上訪客都從它組網址），要讓本機頁面打本機 API，暫時把它改成 `http://localhost:8787`。

## Local

```bash
python3 -m http.server 4321   # http://localhost:4321
```

## Deploy

Push 到 `main` → GitHub Pages（Deploy from a branch，`main` / root）自動發佈。

同一個 push 也會觸發 Cloudflare Worker `portfolio`（網址 `portfolio.xarenvich.workers.dev`，Workers Builds，repo 根目錄整個當靜態檔上傳）。Workers 不會自動略過 `.git` 這類檔案，不是網站的檔案要列進 `.assetsignore`。
