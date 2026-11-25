# TankOS 桌面翻頁、Dock 整理、移除舊介面（v3.0.0）

狀態：第二版（2026-11-25）。主 session 起草，Opus 審過一輪（`~/CursorProjects/dayday/claude_task/2026-11-25-portfolio-paging-spec-review.md`，主 session 已對 code 抽查確認），已依審查與 Tank 的決定修訂。待 Tank 確認後實作。基底 `b462ae9`（v2.7.0）。

## 為什麼
作品一直增加，桌面左欄越排越長，矮螢幕會碰到 Dock，Dock 也越來越寬（v2.7.0 加 DayDay 時兩邊都碰到上限）。改成像 iPad／iPhone 主畫面那樣左右翻頁，作品再多也只是多一頁；Dock 只放固定的系統類 App。

## 決定（Tank 2026-11-25，除非標「主 session 預設」）
1. 桌面左右翻頁，電腦與手機都翻。
2. 照順序排、滿了換頁，不分區（拿掉「作品」「遊戲區」「小工具」「關於我」小標）。
3. 整個桌面是一個格子，像 iPad；電腦最多 6 欄、置中。README 不再一進站就打開。
4. 「下個連假」小工具放第 1 頁最前面，佔 2 × 2 格。
5. 滑鼠單擊桌面 icon 就開（像 iPad）。
6. Dock：README、聯絡我、終端機、活動監視器、計算機、日曆、設定｜經典版、所有 App。作品與遊戲不放 Dock；執行中的作品在 Dock 上看不到、縮小後從桌面／Launcher／Spotlight 叫回，接受，不加功能。
7. 移除舊介面（v2.4，`?ui=1`），只留 TankOS 2.0。
8. 主 session 預設（Tank 沒特別指定，照審查建議）：
   - Dock 上的日曆用現在 2.0 的靜態 logo，不顯示日期（2.0 本來就不顯示）。
   - icon 固定電腦 60px、手機 56px（不再隨螢幕高度縮成 48px）；名稱最多兩行，超過截斷。
   - Launcher 的分類寫在 `APPS[id].cat`；組名沿用 `os.zone.*` 的「作品、遊戲區、小工具、關於我」；關於 TankOS、私人版、經典版在最後的「其他」組；小工具與關於我組的順序照 Dock。
   - 設定 App 的「外觀」區保留 Nocturne 那張卡片，只拿掉切回 v2.4。
   - 手機上 Dock 照舊只有 4 顆（README、聯絡我、經典版、所有 App），工具類從 Launcher 開。
   - 實作可以用 CSS scroll-snap；文中的數字（40px、50px、200ms）是參考值，行為對就好。
   - `ui-flag.spec.js` 裡「CSS 規則要包在 `:where(:root[data-ui="2"])`」那條測試保留，新寫的 CSS 照舊包。

## 1. 移除舊介面

### 永遠是 2.0
- 開頭的 flag script（`index.html:17-38`）：無條件設 `data-ui="2"`，不讀也不寫 `ui`，一律 `localStorage.removeItem("ui")`（包在 try/catch）。設定三個偏好（桌布、透明度、動態效果）那段原樣保留，`ui2.*` 的 key 名稱不改，免得大家的設定被重置。
- `?ui=1`、`?ui=2`、沒有參數，都顯示 2.0；網址參數不用改寫。
- `data-ui` 屬性與現有 171 處 `:where(:root[data-ui="2"])` 規則保留不動（不做 CSS 兩層合併重寫，另開一版）。

### 設定 App
- 拿掉「切回 v2.4」按鈕（`index.html:1408`）**與它的 handler**（`3482`，沒有 null 檢查，只拿按鈕會讓設定視窗壞掉），以及 `st.look.back`、`st.look.note` 兩個 i18n；`st.look.desc` 拿掉「預覽」二字。

### 可以刪的（只有 v2.4 用，或因為不分區而變成死碼）
- Dock hover 把旁邊推開的 margin 規則（`328-334`）。
- 手機 Dock 的 `--ds` clamp 那一行（`760`）；**`--ds`、`--dock-space` 的定義（`47-48`）與 `@media (max-width:768px)` 區塊本身保留**，裡面 2.0 也在用的規則（手機全螢幕 `.win`、`.side`、`.doc`、`.jobs li`、`.stack`，`770-775`）保留。
- `.ic-*` 漸層：只限 2.0 logo 清單（`1209-1211`）裡有的 id。
- 分區與小標（`241-254`）、矮螢幕縮 icon（`260-265`）、2.0 矮螢幕兩區間距（`921-923`）、手機分區（`761-767`）、手機的連假小工具舊位置（`576`）、為 14 顆 Dock 設的窄螢幕 gap（`1092-1095`）。
- `fitBetweenZones` 與開站開 README（`3811-3826`）。
- `.ui2-only` class 與相關規則、`APPS.settings.ui2`、`index()` 的 `ui2` 過濾（設定只剩 2.0 之後都是死碼）。
- `isUI2()` 的 v2.4 分支可以順手清，也可以留著（永遠為真）。
- 選單列與桌布的 v2.4 版本、米塚的漸層蓋層（`195-206`）：先確認 2.0 的 `.wall`（`932-948`、`1097-1111`）已整個覆寫 `background`，才刪。米塚是 2.0 設定裡的桌布選項，圖檔保留。

### 必須保留（2.0 疊在上面）
- `.dock`、`.dk`、`.dk .ic`、`.dk.run::after`、`.tip`、`.dk-sep`（`305-327`）；`.ic` 基底（`278-283`）；`.ic-pockettrip`（`292`，這條本身就是口袋旅行在 2.0 的 logo）；`.ic-glyph`（`525`）；`.ic-cal`、`.ci-wd`、`.ci-d`（`626-628`）；`.dk-launch` 那組（`973`、`989`）；`.ic svg` 與仍有地方用的 `<symbol>`（`g-search`、`g-lock`、`g-side`、`g-ext`、`g-mail`、`g-grid` 等在 icon 以外也有用到）。

## 2. 桌面翻頁

### 格子
- 桌面（選單列以下、Dock 以上，扣掉頁碼小圓點那一列）是一個格子，置中。每格一個 App：icon（電腦 60px、手機 56px）＋名稱（最多兩行，用 `-webkit-line-clamp:2` 截斷，參考 Launcher `1056-1060`）。格高照兩行名稱實測決定，格寬約 96px。
- 欄數：電腦 = min(6, 依寬度放得下的欄數)；手機（768px 以下）固定 4 欄，格寬 =（可用寬 − 邊距）÷ 4。列數 = max(1, 依高度放得下的列數)。
- 桌面 icon 仍放在 `ul.icons` 裡（`iconOf()` 在 `3681` 用 `.icons [data-open]` 找 icon，Launcher、Spotlight、視窗標題列都靠它）。`ul.icons` 加 `aria-label`（中英雙語，新 i18n key）。
- 順序：「下個連假」小工具（佔 2 × 2）、福岡、釜山、陽明山、WordTrailer、口袋旅行、Averlyn、DayDay、方塊消除、Request 的一生、我是社畜、今晚出攤。終端機、活動監視器、計算機、日曆、設定、README、聯絡我改放 Dock，不在桌面。
- 「下個連假」小工具：列數或欄數小於 2 時（例如手機橫放 667 × 375）不顯示；連假資料用完自動隱藏時（`2577`）讓出那 4 格，後面的 App 往前補，不留空洞。
- 頁數 = ceil(佔用格數 ÷ 每頁格數)，剛好整除時不多出空白頁。
- 視窗大小改變時重算：以「目前頁第一個項目的序號」當錨點換算新的頁碼。焦點在輸入框、而且只有高度改變時（手機跳出鍵盤）不重算。
- 包住格子的頁面／軌道層不能擋住桌面空白處的點擊判斷（`tests/support/fixtures.js:149-161` 的 `emptyDesktopPoint` 用 `elementFromPoint` 找 `#desktop`）：包裝層設 `pointer-events:none`、icon 設回 `auto`，或同步改 helper。

### 翻頁
- 頁碼小圓點：放在 `#desktop` 裡、格子後面（Launcher／Spotlight 開著時 `#desktop` 整個 `inert`，小圓點跟著被擋；Tab 順序是 icon → 小圓點 → Dock），畫面上在 Dock 正上方置中。用 `<button>`，`aria-label`「第 N 頁，共 M 頁」／"Page N of M"，目前那頁 `aria-current="true"`。只有一頁時不顯示。換頁時用 live region 唸出「第 N 頁」。
- 觸控：`#desktop` 設 `touch-action`（例如 `pan-y`）避免被瀏覽器搶走手勢；手機版的 `.desktop{overflow-y:auto}`（`761`）拿掉。滑動時頁面跟著手指走；放開時位移超過約 40px 或快速甩動就照方向換到相鄰頁，否則彈回；第一頁往右、最後一頁往左只有阻尼。滑動中不觸發 icon 的點擊。iOS 從左邊緣滑是系統的上一頁，接受。
- 觸控板：只在 `#desktop` 上聽 `wheel`，`ctrlKey` 為真（捏合縮放）時忽略；`deltaX` 累積超過約 50px 換一頁，然後鎖住，直到約 200ms 沒有 wheel 事件才解鎖（吃掉放手後的慣性）。
- 滑鼠：在桌面空白處按住拖曳跟觸控一樣；點小圓點跳頁。
- 鍵盤：「焦點在桌面」= 沒鎖定、Spotlight 與 Launcher 都沒開、沒有前景視窗（`focused === null`）、`activeElement` 是 `body` 或在 `#desktop` 裡、也不是輸入框。這時 ← → 換頁。
- 焦點跟頁：任何方式讓焦點落到某一頁的 icon（Tab、Shift+Tab 從 Dock 回來、Spotlight 關閉還焦點），監聽 `focusin` 就翻到那一頁。其他頁的 icon 必須仍可 focus（不能 `inert`／`hidden`／`display:none`）。
- 從 Spotlight、Launcher、終端機開其他頁的 App：不翻頁（視窗會蓋住桌面）。
- 減少動態效果（一律用既有的 `still.matches`，`1890`，已同時處理系統與設定 App）：手指拖曳時跟手保留（直接操作），放開後的吸附、點小圓點、← → 換頁都瞬間完成。
- 不記住頁碼：重新整理回到第 1 頁。

### 點擊
- 滑鼠單擊桌面 icon 就開（現在是單擊選取、雙擊開啟，`3384-3391`）。觸控與鍵盤照舊單擊開。
- 在桌面空白處按下仍會取消前景視窗的焦點（`3397-3401`），照舊。

### 其他連動
- README 不再一進站就打開（電腦；手機本來就不開），從 Dock 開。線上訪客回報的 `app` 開站時會是 `desktop`，正常。
- App Launcher：`lnGroups()`（`3502-3514`）改成照 `APPS[id].cat` 分組（作品、遊戲區、小工具、關於我、其他），組的順序固定；`os.zone.*` 四個 i18n key 保留給 Launcher 當組名。Launcher 涵蓋所有 App（含 Dock 上的）。
- Spotlight、終端機 `open`、活動監視器照舊。

## 3. Dock
- 順序：README、聯絡我、終端機、活動監視器、計算機、日曆、設定｜經典版、所有 App。設定從分隔線右邊移到左邊。
- 日曆按鈕照抄桌面現在的 markup（含 `<b class="ci-wd">`、`<b class="ci-d">`，`1325`）：`paintCalIcons()`（`2538-2547`）對每個 `.ic-cal` 直接寫這兩個子元素、沒有 null 檢查，少了會讓整支主程式在開站時停掉。2.0 的日曆 logo 不顯示日期（照現況）。
- 執行中小圓點、目前 App 的紫色長條、hover 放大照舊；作品與遊戲縮小時照現在的做法縮向 Dock 中央（`2194-2195`），相關註解與 README「活動監視器不放 Dock」（README 112 行、`2194`）一併更新。
- 手機：照舊只顯示帶 `data-m` 的 README、聯絡我、經典版、所有 App。

## 4. 測試
- `playwright.config.js`：`v24` 與 `ui2` 兩個 project 合成一個沒有 `testMatch` 的預設 project（`tankUi` 不設）。**每個 spec 檔都要有測試被執行**（用 `npx playwright test --list` 確認），不能因為拿掉 `v24` 讓 8 個檔默默不跑。
- `tests/support/fixtures.js`：`tankUi` option 拿掉或簡化；`boot(page, {readme:true})` 開完站從 Dock 點開 README，讓現有拿 README 當背景視窗的測試只改 boot 那一行；新增 `openApp(page, id)`：在 Dock 上就點 Dock，否則走 Launcher（取代約 34 處從桌面開 calc、contact、settings、terminal、calendar 的寫法）。
- 刪除：`ui-flag.spec.js` 的切換與優先順序（`186-245`）、「桌面版面跟 v2.4 一樣」（`126`）、v2.4 顏色（`59-75`）；`release.spec.js` 的 v2.4 情境（保留 `146` 的靜態檔檢查）；`settings.spec.js` 的 back to v2.4（`257-265`）；`desktop-shell.spec.js` 的 `?ui=1` 對照（`40-47`、`184-192`、`219`、`226`）。保留 `ui-flag.spec.js` 的 token 測試（`89-117`）與 CSS 包裝規則測試（`276-290`）。
- `layout.spec.js`：改成驗格子（第 5 節驗收 2）。
- 翻頁的測試：用保證有 2 頁以上的視窗大小（實作後實測挑一個，例如很矮的視窗），寫明每個尺寸預期幾頁。觸控滑動用 CDP `Input.dispatchTouchEvent` 或 `pointerType:"touch"` 的 PointerEvent；觸控板用 `page.mouse.wheel(dx, 0)`。
- 基準截圖：刪掉 7 張 v2.4 的（不帶 `-ui2`），14 張 `-ui2` 用 Docker 重產（`npm run test:docker:update`）；「desktop with README」等測試名稱照新行為改。本機沒有 Docker 時照實說明，Tank 自己處理 CI。

## 5. README
- 用 `grep -nE 'v2\.4|\?ui=1|Rollback' README.md` 找出的段落改成現況（版本歷史裡的 `v2.4.x` 字樣除外）。至少包括：11、43、100（整段「桌面分區」改成格子與翻頁）、101–102（新增 App 的步驟：桌面格子加一格、`APPS[id].cat`，不再加 Dock；`.ic-<id>` 漸層與 symbol 不再需要，2.0 用 logo）、104–109、106（Launcher 分組）、112、116、119–125（各 App 的「桌面、Dock 與 Spotlight」）、124（DayDay 不放 Dock 的理由改成現況）、174–202（v2.5.0 發布、Rollback、Smoke test 整節）、178–188、199、204–222（App Logo 一節的「v2.4 不吃這些規則」）、291、293（兩個 project）。CLAUDE.md 沒有相關字，不用改。

## 6. 版號
操作方式改變、`?ui=1` 不再有作用，照 README 版號表升 X：`v3.0.0`。

## 不做
- 拖曳 icon 改位置、資料夾、自訂哪些 App 放 Dock。
- 記住上次停在哪一頁。
- Dock 顯示執行中的作品（像 Mac 那樣暫時出現）。
- 2.0 CSS 兩層合併重寫。

## 驗收
1. `?ui=1`、`?ui=2`、沒有參數都是 2.0；`localStorage.ui` 存 `"1"` 或 `"2"` 進站後那個 key 不在；`ui2.*` 偏好保留；設定 App 沒有「切回 v2.4」、設定視窗正常。
2. 1440 × 900、1366 × 657、1024 × 768、768 × 1024、390 × 844、667 × 375、320 × 568，中英文各一次：格子置中、電腦不超過 6 欄、手機 4 欄；不碰選單列、小圓點、Dock；沒有橫向捲軸；所有名稱不超出自己的格子；App 依順序、總數不漏不重；每個尺寸的頁數符合實測寫進測試的值；「下個連假」在第 1 頁最前面佔 2 × 2，667 × 375 時不顯示。
3. 觸控滑動、觸控板水平捲動、滑鼠拖曳、點小圓點、← → 都能換頁；滑動時不誤開 App；`focusin` 到其他頁的 icon 會翻頁（含從 Dock Shift+Tab 回來）；視窗大小改變後頁碼照錨點規則；減少動態效果時吸附與跳頁瞬間完成。
4. 滑鼠單擊桌面 icon 就開；進站沒有自動打開 README；Dock 的 README 打得開。
5. Dock 依序是第 3 節那 9 顆加經典版、所有 App；手機是那 4 顆；日曆在 Dock 上正常（沒有 `pageerror`）。
6. Launcher 依 `APPS[id].cat` 分組，每組的成員與順序符合第 2 節；about、private、classic 在「其他」；每個 App 在 Launcher、Spotlight、視窗標題列的 icon 都不是 `.ic-glyph`。
7. Launcher、Spotlight 開著時小圓點不能 Tab、不能點。
8. 縮小一個作品視窗後，單擊桌面 icon 能叫回來。
9. 開站與上面每一項操作過程中都沒有 `pageerror`。
10. `npm test` 全過，且每個 spec 檔都有測試被執行；基準截圖照第 4 節處理。
11. `.mb-ver` 是 `v3.0.0`；`grep -nE 'v2\.4|\?ui=1|Rollback' README.md` 只剩版本歷史。
