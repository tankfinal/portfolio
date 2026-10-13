// Life of a Request（Request 的一生）. One GET to the API Worker's /trace, shown three ways: a route diagram
// (you → Cloudflare's data centre → D1), the browser's own timing of each phase from Resource Timing (the
// Worker sends Timing-Allow-Origin on every response; without it a cross-origin request reports every phase
// as 0), and what the Worker measured on its side. When the connection is reused, the request that opened it
// (usually the menu bar's heartbeat) still has its DNS / connect / TLS times, so those are shown too.
// Three tabs: a timeline (sequence diagram, one-way legs estimated as half a round trip), the waterfall, and
// the raw request and response (the Worker sends Access-Control-Expose-Headers: * so every header is readable).
// index.html loads this file the first time the window opens.
(function(){
  // Cloudflare data centres a request is likely to reach, by IATA code: [lat, lon, 中文, English].
  // Codes not listed are shown as they are, without a distance.
  var COLO = {
    TPE:[25.03,121.56,"台北","Taipei"], KHH:[22.63,120.30,"高雄","Kaohsiung"], HKG:[22.32,114.17,"香港","Hong Kong"],
    MFM:[22.20,113.55,"澳門","Macau"], NRT:[35.68,139.69,"東京","Tokyo"], KIX:[34.69,135.50,"大阪","Osaka"],
    FUK:[33.59,130.40,"福岡","Fukuoka"], OKA:[26.21,127.68,"那霸","Naha"], ICN:[37.57,126.98,"首爾","Seoul"],
    SIN:[1.35,103.82,"新加坡","Singapore"], KUL:[3.14,101.69,"吉隆坡","Kuala Lumpur"], BKK:[13.76,100.50,"曼谷","Bangkok"],
    MNL:[14.60,120.98,"馬尼拉","Manila"], CEB:[10.32,123.89,"宿霧","Cebu"], SGN:[10.82,106.63,"胡志明市","Ho Chi Minh City"],
    HAN:[21.03,105.85,"河內","Hanoi"], CGK:[-6.21,106.85,"雅加達","Jakarta"], BOM:[19.08,72.88,"孟買","Mumbai"],
    DEL:[28.61,77.21,"新德里","New Delhi"], MAA:[13.08,80.27,"清奈","Chennai"], SYD:[-33.87,151.21,"雪梨","Sydney"],
    MEL:[-37.81,144.96,"墨爾本","Melbourne"], BNE:[-27.47,153.03,"布里斯本","Brisbane"], PER:[-31.95,115.86,"伯斯","Perth"],
    AKL:[-36.85,174.76,"奧克蘭","Auckland"], HNL:[21.31,-157.86,"檀香山","Honolulu"], LAX:[34.05,-118.24,"洛杉磯","Los Angeles"],
    SJC:[37.34,-121.89,"聖荷西","San Jose"], SEA:[47.61,-122.33,"西雅圖","Seattle"], DEN:[39.74,-104.99,"丹佛","Denver"],
    DFW:[32.78,-96.80,"達拉斯","Dallas"], ORD:[41.88,-87.63,"芝加哥","Chicago"], ATL:[33.75,-84.39,"亞特蘭大","Atlanta"],
    MIA:[25.76,-80.19,"邁阿密","Miami"], IAD:[39.04,-77.49,"阿什本","Ashburn"], EWR:[40.74,-74.17,"紐華克","Newark"],
    YYZ:[43.65,-79.38,"多倫多","Toronto"], YVR:[49.28,-123.12,"溫哥華","Vancouver"], MEX:[19.43,-99.13,"墨西哥城","Mexico City"],
    GRU:[-23.55,-46.63,"聖保羅","São Paulo"], EZE:[-34.60,-58.38,"布宜諾斯艾利斯","Buenos Aires"], SCL:[-33.45,-70.67,"聖地牙哥","Santiago"],
    BOG:[4.71,-74.07,"波哥大","Bogotá"], LHR:[51.51,-0.13,"倫敦","London"], DUB:[53.35,-6.26,"都柏林","Dublin"],
    CDG:[48.86,2.35,"巴黎","Paris"], AMS:[52.37,4.90,"阿姆斯特丹","Amsterdam"], FRA:[50.11,8.68,"法蘭克福","Frankfurt"],
    ZRH:[47.38,8.54,"蘇黎世","Zurich"], MXP:[45.46,9.19,"米蘭","Milan"], MAD:[40.42,-3.70,"馬德里","Madrid"],
    VIE:[48.21,16.37,"維也納","Vienna"], WAW:[52.23,21.01,"華沙","Warsaw"], ARN:[59.33,18.07,"斯德哥爾摩","Stockholm"],
    IST:[41.01,28.98,"伊斯坦堡","Istanbul"], DXB:[25.20,55.27,"杜拜","Dubai"], TLV:[32.09,34.78,"特拉維夫","Tel Aviv"],
    JNB:[-26.20,28.05,"約翰尼斯堡","Johannesburg"]
  };
  // D1's own region names, for when it reports a region but not a data centre.
  var REGION = {APAC:["亞太","Asia-Pacific"], OC:["大洋洲","Oceania"], WNAM:["北美西部","Western North America"],
                ENAM:["北美東部","Eastern North America"], WEUR:["西歐","Western Europe"], EEUR:["東歐","Eastern Europe"]};
  var KM_PER_MS = 200;   // light in optical fibre covers about 200 km per millisecond
  var KEEP = 10;         // runs kept for the history line
  var COLOR = {dns:"#30B0C7", tcp:"#FF9F0A", tls:"#BF5AF2", dl:"#34C759", net:"#64D2FF", d1:"#5E5CE6", other:"#A1A1A6"};

  // Great-circle distance in km.
  function km(a, b){
    var r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.pow(Math.sin(dLon / 2), 2);
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }
  function make(tag, cls, text){
    var x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text != null) x.textContent = text;
    return x;
  }
  function pct(f){ return Math.max(0, Math.min(100, f * 100)) + "%"; }
  function median(list){
    var s = list.slice().sort(function(a, b){ return a - b; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  TankOS.define("trace", {
    i18n: {
      "tr.lede":    {zh:"按一下，看你的請求從這裡出發、經過 Cloudflare 的機房、查完資料庫再回來，每一段各花多久。", en:"Send one request and see where it goes, through a Cloudflare data centre, into the database and back, and how long each leg takes."},
      "tr.send":    {zh:"送出請求", en:"Send a request"},
      "tr.again":   {zh:"再送一次", en:"Send again"},
      "tr.sending": {zh:"送出中…", en:"Sending…"},
      "tr.fail":    {zh:"送不出去：連不上伺服器，稍後再試。", en:"Couldn't reach the server. Try again later."},
      "tr.you":     {zh:"你", en:"You"},
      "tr.edgeSub": {zh:"Worker 在這裡執行", en:"Worker runs here"},
      "tr.db":      {zh:"資料庫", en:"Database"},
      "tr.dbAt":    {zh:"資料庫 · {where}", en:"Database · {where}"},
      "tr.primary": {zh:"主要資料庫", en:"primary"},
      "tr.replica": {zh:"唯讀副本", en:"read replica"},
      "tr.local":   {zh:"本機", en:"local"},
      "tr.rtt":     {zh:"來回 {ms}", en:"{ms} round trip"},
      "tr.dist":    {zh:"直線 {km} km，光速來回至少 {min}", en:"{km} km apart; light needs {min} there and back"},
      "tr.same":    {zh:"同一個機房", en:"Same data centre"},
      "tr.punch":   {zh:"慢的不是資料庫，是距離：資料庫執行查詢只花了 {sql}，但從{from}到{to}來回一趟就要 {d1}。", en:"The database isn't the slow part, distance is: running the query took {sql}, but one round trip from {from} to {to} took {d1}."},
      "tr.tab.tl":  {zh:"時間軸", en:"Timeline"},
      "tr.tab.wf":  {zh:"瀑布圖", en:"Waterfall"},
      "tr.tab.raw": {zh:"原始封包", en:"Raw request"},
      "tr.tl.hs":   {zh:"建立連線 {ms}", en:"Connect {ms}"},
      "tr.tl.exec": {zh:"執行查詢 {ms}", en:"Query {ms}"},
      "tr.tl.other":{zh:"其他 {ms}", en:"Other {ms}"},
      "tr.tl.dl":   {zh:"下載 {ms}", en:"Download {ms}"},
      "tr.tl.key":  {zh:"色塊是實測，虛線箭頭是估算：單程時間量不到（兩端的時鐘沒有對齊），只能用來回時間除以 2。實測的有：瀏覽器等待回應 {wait}、Worker 到資料庫來回 {d1}、資料庫執行查詢 {sql}。", en:"Coloured blocks are measured; dashed arrows are estimates. A one-way trip can't be timed (the two clocks aren't in sync), so each is half its round trip. Measured: the browser waited {wait}, the Worker's round trip to the database took {d1}, the query ran in {sql}."},
      "tr.raw.req": {zh:"請求（你的瀏覽器送出）", en:"Request (sent by your browser)"},
      "tr.raw.reqNote":{zh:"瀏覽器還會自動加上 user-agent、accept 這類 header，網頁讀不到，所以只列得出這幾行。", en:"Your browser also adds headers such as user-agent and accept on its own. A page can't read those, so only these lines are shown."},
      "tr.raw.res": {zh:"回應（伺服器傳回）", en:"Response (from the server)"},
      "tr.raw.size":{zh:"內容 {body}{gz}。header 的實際大小瀏覽器不公開：規格一律算成 300 bytes，避免網頁從大小推出你帶了哪些 cookie。", en:"Body {body}{gz}. Browsers don't reveal the real header size: the spec always counts it as 300 bytes, so a page can't infer which cookies were sent."},
      "tr.raw.gz":  {zh:"（壓縮前 {raw}）", en:" ({raw} before compression)"},
      "tr.p.dns":   {zh:"DNS 查詢", en:"DNS lookup"},
      "tr.p.tcp":   {zh:"建立連線", en:"Connect"},
      "tr.p.tls":   {zh:"TLS 握手", en:"TLS handshake"},
      "tr.p.wait":  {zh:"等待回應", en:"Waiting for response"},
      "tr.p.dl":    {zh:"下載", en:"Download"},
      "tr.p.total": {zh:"總計", en:"Total"},
      "tr.s.net":   {zh:"網路來回", en:"Network round trip"},
      "tr.s.d1":    {zh:"到資料庫來回", en:"Round trip to the database"},
      "tr.s.other": {zh:"其他", en:"Everything else"},
      "tr.reuse":   {zh:"連線重用：選單列的線上人數一直跟這台伺服器保持連線，所以這次不用查 DNS，也不用 TLS 握手。", en:"Connection reused: the online counter in the menu bar keeps a connection to this server open, so there was no DNS lookup or TLS handshake this time."},
      "tr.fresh":   {zh:"這次開了一條新連線，所以有 DNS 和 TLS 的時間；再送一次就會重用它。", en:"This request opened a new connection, hence the DNS and TLS time. Send again and it will be reused."},
      "tr.conn":    {zh:"這條連線是 {at} {by}時建立的：DNS 查詢 {dns}、建立連線 {tcp}、TLS 握手 {tls}，共 {sum}。之後的請求都省下了這一段。", en:"This connection was opened at {at} {by}: DNS lookup {dns}, connect {tcp}, TLS handshake {tls}, {sum} in all. Every request since has skipped that."},
      "tr.by.presence":{zh:"選單列回報線上人數", en:"when the menu bar reported you online"},
      "tr.by.scores":{zh:"讀取排行榜", en:"when the leaderboard was loaded"},
      "tr.by.trace":{zh:"前一次送出請求", en:"by an earlier request from this window"},
      "tr.notao":   {zh:"瀏覽器沒有提供分段時間，只看得到總計。", en:"Your browser didn't share the per-phase timing, only the total."},
      "tr.more":    {zh:"細節", en:"Details"},
      "tr.d.http":  {zh:"協定", en:"Protocol"},
      "tr.d.tls":   {zh:"加密", en:"Encryption"},
      "tr.d.isp":   {zh:"你的網路業者", en:"Your network"},
      "tr.d.db":    {zh:"資料庫", en:"Database"},
      "tr.d.sql":   {zh:"查詢", en:"Query"},
      "tr.d.sqlv":  {zh:"SELECT 1，資料庫執行花了 {ms}（只確認資料庫有回應，不讀任何資料）", en:"SELECT 1, ran in {ms} (only checks that the database answers; reads no data)"},
      "tr.hist":    {zh:"最近 {n} 次，中位數 {m}：", en:"Last {n}, median {m}: "},
      "tr.tip.h":   {zh:"為什麼 Worker 量不到自己花了多少時間？", en:"Why can't the Worker time its own work?"},
      "tr.tip.b":   {zh:"Cloudflare 為了防範 Spectre 這類 timing 側通道攻擊，Worker 裡的 Date.now() 在程式執行時是凍結的，只有 I/O 完成時才會前進。所以 Worker 量得到「等資料庫回來」花了多久，但自己的 CPU 時間怎麼量都是 0，算在「其他」裡。", en:"To defend against timing side channels such as Spectre, Date.now() inside a Worker stands still while code runs and only moves when I/O completes. The Worker can time its wait for the database, but its own CPU time always measures zero, so it ends up in “Everything else”."},
      "tr.tip.dev": {zh:"打開瀏覽器開發者工具的 Network，點這個請求的 Timing，也看得到伺服器送回來的 Server-Timing。", en:"Open DevTools → Network, pick this request and its Timing tab to see the Server-Timing the server sent back."}
    },

    css: [
      ".tr{container-type:inline-size;padding:18px 20px 26px;font-size:13px;line-height:1.55}",
      ".tr-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap}",
      ".tr-go{flex:none;padding:7px 16px;border-radius:8px;background:#5E5CE6;color:#fff;font-weight:600;cursor:pointer}",
      ".tr-go:hover{filter:brightness(1.08)}",
      ".tr-go:disabled{opacity:.6;cursor:default}",
      ".tr-lede{flex:1;min-width:220px;color:var(--win-soft)}",
      ".tr-err{margin-top:14px;color:var(--accent)}",
      ".tr-out[hidden],.tr-res[hidden],.tr-err[hidden],.tr-punch[hidden]{display:none}",
      ".tr-route{display:grid;grid-template-columns:auto minmax(64px,1fr) auto minmax(64px,1fr) auto;align-items:center;margin-top:24px}",
      ".tr-node{max-width:180px;padding:10px 12px;border-radius:10px;background:var(--win-side);border:.5px solid var(--win-line);text-align:center}",
      ".tr-node b{display:block;font-size:13px;font-weight:600}",
      ".tr-node small{display:block;margin-top:2px;font-size:11.5px;color:var(--win-mute)}",
      ".tr-leg{display:grid;grid-template-rows:auto 14px auto;align-items:center;text-align:center;padding:0 8px;min-width:0}",
      ".tr-ms{font:600 12.5px var(--mono);color:var(--win-fg);font-variant-numeric:tabular-nums}",
      ".tr-km{font-size:11px;line-height:1.35;color:var(--win-mute)}",
      ".tr-line{position:relative;display:block;height:0;border-top:1.5px dashed var(--win-line)}",
      ".tr-dot{position:absolute;left:0;top:-5px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:#5E5CE6;box-shadow:0 0 0 3px rgba(94,92,230,.25);opacity:0}",
      ".tr-route.run [data-l='1'] .tr-dot{animation:tr-l1 1.6s ease-in-out}",
      ".tr-route.run [data-l='2'] .tr-dot{animation:tr-l2 1.6s ease-in-out}",
      // Out on leg 1, out on leg 2, back on leg 2, back on leg 1.
      "@keyframes tr-l1{0%{left:0;opacity:1}25%{left:100%;opacity:1}26%,74%{left:100%;opacity:0}75%{left:100%;opacity:1}100%{left:0;opacity:1}}",
      "@keyframes tr-l2{0%,24%{left:0;opacity:0}25%{left:0;opacity:1}50%{left:100%;opacity:1}75%{left:0;opacity:1}76%,100%{left:0;opacity:0}}",
      "@keyframes tr-l1v{0%{top:0;opacity:1}25%{top:100%;opacity:1}26%,74%{top:100%;opacity:0}75%{top:100%;opacity:1}100%{top:0;opacity:1}}",
      "@keyframes tr-l2v{0%,24%{top:0;opacity:0}25%{top:0;opacity:1}50%{top:100%;opacity:1}75%{top:0;opacity:1}76%,100%{top:0;opacity:0}}",
      // Narrow windows (phones) stack the route top to bottom.
      "@container (max-width:540px){",
      "  .tr-route{grid-template-columns:1fr}",
      "  .tr-node{max-width:none}",
      "  .tr-leg{grid-template-rows:none;grid-template-columns:1fr auto 1fr;gap:0 14px;height:64px;padding:0}",
      "  .tr-ms{text-align:right}",
      "  .tr-km{text-align:left}",
      "  .tr-line{align-self:stretch;height:auto;border-top:0;border-left:1.5px dashed var(--win-line)}",
      "  .tr-dot{left:-5px;top:0;margin:-4.5px 0 0}",
      "  .tr-route.run [data-l='1'] .tr-dot{animation-name:tr-l1v}",
      "  .tr-route.run [data-l='2'] .tr-dot{animation-name:tr-l2v}",
      "}",
      ".tr-punch{margin-top:20px;padding:10px 14px;border-radius:8px;background:rgba(94,92,230,.12);font-weight:500}",
      ".tr h3{margin:22px 0 10px;font-size:12px;font-weight:600;color:var(--win-mute)}",
      ".tr-bars{display:grid;grid-template-columns:max-content 1fr max-content;gap:7px 12px;align-items:center}",
      ".tr-bars .k{color:var(--win-soft);white-space:nowrap}",
      ".tr-bars .v{font:12px var(--mono);text-align:right;font-variant-numeric:tabular-nums}",
      ".tr-bars .tot{font-weight:600;color:var(--win-fg)}",
      ".tr-track{position:relative;height:12px;border-radius:3px;background:rgba(127,127,127,.12)}",
      ".tr-bar{position:absolute;top:0;bottom:0;min-width:2px;border-radius:3px;display:flex;overflow:hidden;background:#64D2FF}",
      ".tr-bar i{display:block;height:100%}",
      ".tr-legend{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:10px;font-size:12px;color:var(--win-soft)}",
      ".tr-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:-1px}",
      ".tr-note{margin-top:10px;font-size:12.5px;color:var(--win-soft)}",
      ".tr-conn{margin-top:8px;padding:9px 12px;border-radius:8px;border:.5px dashed var(--win-line);font-size:12.5px;color:var(--win-soft)}",
      ".tr-conn[hidden]{display:none}",
      ".tr-dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px}",
      ".tr-dl dt{color:var(--win-mute)}",
      ".tr-dl dd{font:12.5px var(--mono);word-break:break-word}",
      ".tr-hist{margin-top:14px;font:12px var(--mono);color:var(--win-soft);word-break:break-word}",
      ".tr-tip{margin-top:18px;padding-top:14px;border-top:.5px solid var(--win-line);font-size:12.5px;color:var(--win-soft)}",
      ".tr-tip summary{cursor:pointer;color:var(--win-fg);font-weight:500}",
      ".tr-tip p{margin-top:8px}",
      ".tr-tabs{display:inline-flex;gap:2px;margin:22px 0 14px;padding:2px;border-radius:8px;background:rgba(127,127,127,.14);max-width:100%;overflow-x:auto}",
      ".tr-tabs button{padding:4px 14px;border-radius:6px;font-size:12.5px;color:var(--win-soft);cursor:pointer;white-space:nowrap}",
      ".tr-tabs button[aria-selected='true']{background:var(--win-bg);color:var(--win-fg);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.18)}",
      ".tr-pane[hidden]{display:none}",
      ".tr h4{margin:16px 0 6px;font-size:12px;font-weight:600;color:var(--win-mute)}",
      ".tr-pane h4:first-child{margin-top:0}",
      ".tr-req,.tr-resp{margin:0;padding:10px 12px;border-radius:8px;background:var(--win-side);border:.5px solid var(--win-line);font:12px/1.5 var(--mono);color:var(--win-fg);white-space:pre-wrap;word-break:break-all;max-height:340px;overflow:auto}",
      ".tr-small{margin-top:6px;font-size:12px;color:var(--win-mute)}",
      ".tr-tl svg{display:block;overflow:visible}",
      ".tr-tlkey{margin-top:8px;font-size:12.5px;color:var(--win-soft)}",
      ".tr-tl .tl-lane{stroke:var(--win-line);stroke-width:1.5}",
      ".tr-tl .tl-grid{stroke:var(--win-line);stroke-width:.6;stroke-dasharray:2 4}",
      ".tr-tl .tl-head{font-size:12px;font-weight:600;fill:var(--win-fg)}",
      ".tr-tl .tl-sub{font-size:11px;fill:var(--win-mute)}",
      ".tr-tl .tl-tick{font:10.5px var(--mono);fill:var(--win-mute)}",
      ".tr-tl .tl-msg{stroke:var(--win-soft);stroke-width:1.5;fill:none;stroke-dasharray:5 4}",
      ".tr-tl .tl-ah{fill:var(--win-soft)}",
      ".tr-tl .tl-lab{font:11px var(--mono);fill:var(--win-fg);paint-order:stroke;stroke:var(--win-bg);stroke-width:4px;stroke-linejoin:round}",
      "@media (prefers-reduced-motion:reduce){.tr-dot{animation:none!important}}"
    ].join("\n"),

    html:
      '<div class="body tr">' +
        '<div class="tr-top"><button type="button" class="tr-go"></button><p class="tr-lede" data-i18n="tr.lede"></p></div>' +
        '<p class="tr-err" data-i18n="tr.fail" hidden></p>' +
        '<div class="tr-out" hidden>' +
          '<div class="tr-route">' +
            '<div class="tr-node" data-n="you"><b></b><small></small></div>' +
            '<div class="tr-leg" data-l="1"><span class="tr-ms"></span><span class="tr-line"><span class="tr-dot"></span></span><small class="tr-km"></small></div>' +
            '<div class="tr-node" data-n="edge"><b></b><small></small></div>' +
            '<div class="tr-leg" data-l="2"><span class="tr-ms"></span><span class="tr-line"><span class="tr-dot"></span></span><small class="tr-km"></small></div>' +
            '<div class="tr-node" data-n="d1"><b></b><small></small></div>' +
          '</div>' +
          '<div class="tr-res" hidden>' +
            '<p class="tr-punch"></p>' +
            '<div class="tr-tabs" role="tablist">' +
              '<button type="button" role="tab" data-tab="tl" data-i18n="tr.tab.tl"></button>' +
              '<button type="button" role="tab" data-tab="wf" data-i18n="tr.tab.wf"></button>' +
              '<button type="button" role="tab" data-tab="raw" data-i18n="tr.tab.raw"></button>' +
            '</div>' +
            '<div class="tr-pane" data-pane="tl" role="tabpanel"><div class="tr-tl"></div><p class="tr-tlkey"></p></div>' +
            '<div class="tr-pane" data-pane="wf" role="tabpanel" hidden><div class="tr-bars"></div><div class="tr-legend"></div><p class="tr-note"></p><p class="tr-conn" hidden></p></div>' +
            '<div class="tr-pane" data-pane="raw" role="tabpanel" hidden>' +
              '<h4 data-i18n="tr.raw.req"></h4><pre class="tr-req"></pre><p class="tr-small" data-i18n="tr.raw.reqNote"></p>' +
              '<h4 data-i18n="tr.raw.res"></h4><pre class="tr-resp"></pre><p class="tr-small tr-size"></p>' +
            '</div>' +
            '<h3 data-i18n="tr.more"></h3><dl class="tr-dl"></dl><p class="tr-hist"></p>' +
            '<details class="tr-tip"><summary data-i18n="tr.tip.h"></summary><p data-i18n="tr.tip.b"></p><p data-i18n="tr.tip.dev"></p></details>' +
          '</div>' +
        '</div>' +
      '</div>',

    init: function(el, os){
      var go = el.querySelector(".tr-go"), out = el.querySelector(".tr-out"), res = el.querySelector(".tr-res"), err = el.querySelector(".tr-err");
      var route = el.querySelector(".tr-route"), bars = el.querySelector(".tr-bars"), legend = el.querySelector(".tr-legend");
      var note = el.querySelector(".tr-note"), conn = el.querySelector(".tr-conn"), punch = el.querySelector(".tr-punch"), dl = el.querySelector(".tr-dl"), hist = el.querySelector(".tr-hist");
      var tabs = el.querySelector(".tr-tabs"), tl = el.querySelector(".tr-tl"), tlKey = el.querySelector(".tr-tlkey");
      var reqPre = el.querySelector(".tr-req"), resPre = el.querySelector(".tr-resp"), size = el.querySelector(".tr-size");
      var seen = {}, live = [], runs = [], last = null, busy = false, seq = 0, tab = "tl", tlWidth = 0;

      // The observer still sees entries once the page's resource-timing buffer (250 entries) is full,
      // which the menu bar's 30-second heartbeat gets to after about two hours. `live` keeps every API
      // request since this window opened, in case one of them reopens the connection.
      var obs = null;
      if (window.PerformanceObserver) {
        try {
          obs = new PerformanceObserver(function(list){
            list.getEntries().forEach(function(e){
              if (e.name.indexOf(os.api) !== 0) return;
              if (e.name.indexOf("/trace?") > -1) seen[e.name] = e;
              live.push(e);
              if (live.length > 50) live.shift();
            });
          });
          obs.observe({type:"resource"});
        } catch (x) { obs = null; }
      }
      // The entry can land a moment after the response body, so look for up to a second.
      function timingOf(url){
        return new Promise(function(ok){
          var tries = 0;
          (function look(){
            var e = seen[url] || (performance.getEntriesByName ? performance.getEntriesByName(url)[0] : null);
            if (e || ++tries > 20) { delete seen[url]; ok(e || null); }
            else setTimeout(look, 50);
          })();
        });
      }

      function en(){ return os.lang() === "en"; }
      function ms(v){
        if (v == null || isNaN(v)) return "—";
        v = Math.max(0, v);
        return (v === 0 || v % 1 === 0 ? v : v < 10 ? v.toFixed(1) : Math.round(v)) + " ms";
      }
      function cityOf(code){ var c = COLO[code]; return c ? c[en() ? 3 : 2] : code; }
      function at(code){ var c = COLO[code]; return c ? [c[0], c[1]] : null; }
      function dbName(d1){ return d1.colo ? cityOf(d1.colo) : d1.region && REGION[d1.region] ? REGION[d1.region][en() ? 1 : 0] : os.t("tr.local"); }
      function protoOf(e, c){ var hop = e && e.nextHopProtocol; return hop ? ({h3:"HTTP/3", h2:"HTTP/2", "http/1.1":"HTTP/1.1"})[hop] || hop : c.http || "HTTP"; }
      function bytes(n){ return n ? new Intl.NumberFormat(en() ? "en-US" : "zh-TW").format(n) + " bytes" : "—"; }
      function dist(a, b){
        if (!a || !b) return "";
        var d = km(a, b);
        if (d < 1) return os.t("tr.same");
        return os.fill(os.t("tr.dist"), {km:new Intl.NumberFormat(en() ? "en-US" : "zh-TW").format(Math.round(d)), min:ms(2 * d / KM_PER_MS)});
      }
      function node(n, title, sub){
        var b = route.querySelector('[data-n="' + n + '"]');
        b.querySelector("b").textContent = title;
        b.querySelector("small").textContent = sub || "";
      }
      function leg(n, time, far){
        var b = route.querySelector('[data-l="' + n + '"]');
        b.querySelector(".tr-ms").textContent = time;
        b.querySelector(".tr-km").textContent = far;
      }
      function skeleton(){
        node("you", os.t("tr.you"), "…");
        node("edge", "Cloudflare", "…");
        node("d1", os.t("tr.db"), "…");
        leg(1, "…", "");
        leg(2, "…", "");
      }

      // Phases as the browser saw them. Without Timing-Allow-Origin, requestStart is 0 and there are none.
      function phases(e){
        if (!e || !e.requestStart) return null;
        var s = e.startTime, from = function(v){ return Math.max(v || s, s); };
        var tlsAt = e.secureConnectionStart > 0 ? e.secureConnectionStart : e.connectEnd;
        return [
          {k:"dns",  at:from(e.domainLookupStart), d:e.domainLookupEnd - e.domainLookupStart},
          {k:"tcp",  at:from(e.connectStart),      d:tlsAt - e.connectStart},
          {k:"tls",  at:from(tlsAt),               d:e.connectEnd - tlsAt},
          {k:"wait", at:from(e.requestStart),      d:e.responseStart - e.requestStart},
          {k:"dl",   at:from(e.responseStart),     d:e.responseEnd - e.responseStart}
        ].map(function(p){ p.d = Math.max(0, p.d || 0); return p; });
      }

      // The latest earlier API request that spent time on DNS or connecting opened the connection this one
      // reused (HTTP/2 and HTTP/3 keep one per origin). Once the buffer is full, newer requests are missing
      // from it, so only what the observer saw since this window opened can be trusted.
      function opener(e){
        var buf = performance.getEntriesByType ? performance.getEntriesByType("resource") : [];
        var pool = (buf.length >= 250 ? [] : buf).concat(live), best = null;
        pool.forEach(function(x){
          if (x.name.indexOf(os.api) !== 0 || x.startTime >= e.startTime) return;
          if (x.connectEnd - x.connectStart > 0 || x.domainLookupEnd - x.domainLookupStart > 0) {
            if (!best || x.startTime > best.startTime) best = x;
          }
        });
        return best;
      }
      function connLine(x){
        var p = phases(x), path = x.name.slice(os.api.length).split("?")[0];
        var by = {"/presence":"tr.by.presence", "/presence/leave":"tr.by.presence", "/scores":"tr.by.scores", "/trace":"tr.by.trace"}[path];
        var at = new Intl.DateTimeFormat(en() ? "en-US" : "zh-TW", {hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false})
          .format(new Date(performance.timeOrigin + x.startTime));
        return os.fill(os.t("tr.conn"), {at:at, by:by ? os.t(by) : "", dns:ms(p[0].d), tcp:ms(p[1].d), tls:ms(p[2].d), sum:ms(p[0].d + p[1].d + p[2].d)});
      }

      // Waiting = one network round trip (Cloudflare's RTT for this connection) + the Worker's wait on D1
      // + everything the Worker can't time, its own CPU included.
      function split(w, rtt, d1ms){
        var net = rtt == null ? Math.max(0, w - d1ms) : Math.min(rtt, w);
        var d1 = Math.min(d1ms, Math.max(0, w - net));
        return {net:net, d1:d1, other:Math.max(0, w - net - d1)};
      }
      function splitWait(bar, w, rtt, d1ms){
        var p = split(w, rtt, d1ms);
        [["net", p.net], ["d1", p.d1], ["other", p.other]].forEach(function(s){
          var seg = document.createElement("i");
          seg.style.background = COLOR[s[0]];
          seg.style.flex = s[1] + " 1 0";
          bar.appendChild(seg);
          var key = make("span", "", os.t("tr.s." + s[0]) + " " + ms(s[1])), sw = document.createElement("i");
          sw.style.background = COLOR[s[0]];
          key.insertBefore(sw, key.firstChild);
          legend.appendChild(key);
        });
      }

      function render(){
        var data = last.data, c = data.client, d1 = data.d1, e = last.e;
        var you = c.lat != null && c.lon != null ? [c.lat, c.lon] : null;
        var d1Name = dbName(d1);
        var role = d1.primary === true ? os.t("tr.primary") : d1.primary === false ? os.t("tr.replica") : "";

        node("you", os.t("tr.you"), [c.city, c.country].filter(Boolean).join(", "));
        node("edge", "Cloudflare " + (data.edge ? cityOf(data.edge) : ""), (data.edge && COLO[data.edge] ? data.edge + " · " : "") + os.t("tr.edgeSub"));
        node("d1", os.fill(os.t("tr.dbAt"), {where:d1Name}), "Cloudflare D1" + (d1.colo && COLO[d1.colo] ? " · " + d1.colo : ""));
        leg(1, c.rtt != null ? os.fill(os.t("tr.rtt"), {ms:ms(c.rtt)}) : "—", dist(you, at(data.edge)));
        leg(2, os.fill(os.t("tr.rtt"), {ms:ms(d1.ms)}), dist(at(data.edge), at(d1.colo)));

        // Only worth saying when distance clearly dominates (not against a local database).
        punch.hidden = !(d1.sqlMs != null && d1.ms >= 5 && d1.ms > d1.sqlMs * 3);
        punch.textContent = os.fill(os.t("tr.punch"), {sql:ms(d1.sqlMs), d1:ms(d1.ms), from:data.edge ? cityOf(data.edge) : "Cloudflare", to:d1Name});

        bars.textContent = "";
        legend.textContent = "";
        var ph = phases(e);
        if (ph) {
          var span = last.total || 1;
          ph.forEach(function(p){
            var track = make("div", "tr-track"), bar = make("div", "tr-bar"), left = (p.at - e.startTime) / span;
            bar.style.left = pct(left);
            bar.style.width = pct(Math.min(p.d / span, 1 - left));
            if (p.k === "wait") splitWait(bar, p.d, c.rtt, d1.ms);
            else bar.style.background = COLOR[p.k];
            track.appendChild(bar);
            bars.appendChild(make("span", "k", os.t("tr.p." + p.k)));
            bars.appendChild(track);
            bars.appendChild(make("span", "v", ms(p.d)));
          });
        }
        bars.appendChild(make("span", "k tot", os.t("tr.p.total")));
        bars.appendChild(make("span"));
        bars.appendChild(make("span", "v tot", ms(last.total)));
        var reused = ph && ph[0].d + ph[1].d + ph[2].d < 0.5, from = reused ? opener(e) : null;
        note.textContent = !ph ? os.t("tr.notao") : reused ? os.t("tr.reuse") : os.t("tr.fresh");
        conn.hidden = !from;
        if (from) conn.textContent = connLine(from);

        dl.textContent = "";
        [["tr.d.http", protoOf(e, c)], ["tr.d.tls", [c.tls, c.cipher].filter(Boolean).join(" · ")], ["tr.d.isp", c.isp && c.isp.replace(/[\s,;]+$/, "")],   // registry names can end in a stray comma
         ["tr.d.db", ["Cloudflare D1 (SQLite)", d1Name + (d1.colo && COLO[d1.colo] ? " " + d1.colo : ""), role].filter(Boolean).join(" · ")],
         ["tr.d.sql", d1.sqlMs != null ? os.fill(os.t("tr.d.sqlv"), {ms:ms(d1.sqlMs)}) : ""]
        ].forEach(function(r){
          if (!r[1]) return;
          dl.appendChild(make("dt", "", os.t(r[0])));
          dl.appendChild(make("dd", "", r[1]));
        });

        hist.textContent = os.fill(os.t("tr.hist"), {n:runs.length, m:ms(median(runs))}) +
          runs.map(function(v){ return Math.round(v); }).join(" · ");
        res.hidden = false;
        if (tab === "tl") drawTimeline();
        fillRaw();
      }

      var SVG = "http://www.w3.org/2000/svg";
      function svg(tag, attrs, text){
        var x = document.createElementNS(SVG, tag);
        Object.keys(attrs || {}).forEach(function(k){ x.setAttribute(k, attrs[k]); });
        if (text != null) x.textContent = text;
        return x;
      }
      // A grid step that draws at most six lines.
      function gridStep(total){
        var s = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
        for (var i = 0; i < s.length; i++) if (total / s[i] <= 6) return s[i];
        return 10000;
      }

      // Three lanes, time running down, drawn in real pixels so the text stays readable. Coloured blocks are
      // measured. The dashed arrows are one-way trips, which can't be measured (the two clocks aren't in sync),
      // so each is half its round trip; the Worker is assumed to call D1 as soon as the request arrives, since
      // its own CPU time reads as zero anyway.
      function drawTimeline(){
        var W = tl.clientWidth, data = last.data, c = data.client, d1 = data.d1, ph = phases(last.e);
        tlWidth = W;
        tl.textContent = "";
        if (!ph) { tlKey.textContent = os.t("tr.notao"); return; }
        if (!W) return;
        var hs = ph[0].d + ph[1].d + ph[2].d, wait = ph[3].d, dlMs = ph[4].d, sql = Math.min(d1.sqlMs || 0, d1.ms);
        var p = split(wait, c.rtt, d1.ms), hop = Math.max(0, p.d1 - sql) / 2;
        var tReq = hs, tEdge = tReq + p.net / 2, tDbIn = tEdge + hop, tDbOut = tDbIn + sql, tBack = tEdge + p.d1,
            tOut = tBack + p.other, tFirst = tReq + wait, tDone = tFirst + dlMs;
        var top = 50, H = 320, k = H / (tDone || 1), y = function(t){ return top + t * k; };
        var axis = 52, xs = [0.14, 0.52, 0.88].map(function(f){ return axis + (W - axis) * f; });
        var root = svg("svg", {width:W, height:top + H + 18, viewBox:"0 0 " + W + " " + (top + H + 18), role:"img", "aria-label":os.t("tr.tab.tl")});
        var defs = svg("defs"), mk = svg("marker", {id:"tr-ah", viewBox:"0 0 8 8", refX:"7.5", refY:"4", markerWidth:"7", markerHeight:"7", orient:"auto"});
        mk.appendChild(svg("path", {d:"M0 0L8 4L0 8z", "class":"tl-ah"}));
        defs.appendChild(mk);
        root.appendChild(defs);
        for (var g = gridStep(tDone), t = 0; t <= tDone + 1e-6; t += g) {
          root.appendChild(svg("line", {x1:axis, x2:W, y1:y(t), y2:y(t), "class":"tl-grid"}));
          root.appendChild(svg("text", {x:axis - 8, y:y(t) + 3.5, "text-anchor":"end", "class":"tl-tick"}, t + " ms"));
        }
        [[os.t("tr.you"), c.city || ""], ["Cloudflare", data.edge ? cityOf(data.edge) : ""], [os.t("tr.db"), dbName(d1)]].forEach(function(h, i){
          root.appendChild(svg("line", {x1:xs[i], x2:xs[i], y1:top - 8, y2:top + H + 10, "class":"tl-lane"}));
          root.appendChild(svg("text", {x:xs[i], y:16, "text-anchor":"middle", "class":"tl-head"}, h[0]));
          root.appendChild(svg("text", {x:xs[i], y:32, "text-anchor":"middle", "class":"tl-sub"}, h[1]));
        });
        function arrow(a, ta, b, tb, text){
          root.appendChild(svg("line", {x1:xs[a], y1:y(ta), x2:xs[b], y2:y(tb), "class":"tl-msg", "marker-end":"url(#tr-ah)"}));
          root.appendChild(svg("text", {x:(xs[a] + xs[b]) / 2, y:(y(ta) + y(tb)) / 2 - 6, "text-anchor":"middle", "class":"tl-lab"}, text));
        }
        function block(lane, ta, tb, color, text, left){
          var h = Math.max(3, y(tb) - y(ta));
          root.appendChild(svg("rect", {x:xs[lane] - 5, y:y(ta), width:10, height:h, rx:2, fill:color}));
          root.appendChild(svg("text", {x:xs[lane] + (left ? -10 : 10), y:y(ta) + h / 2 + 3.5, "text-anchor":left ? "end" : "start", "class":"tl-lab"}, text));
        }
        if (hs >= 0.5) block(0, 0, hs, COLOR.tls, os.fill(os.t("tr.tl.hs"), {ms:ms(hs)}));
        arrow(0, tReq, 1, tEdge, "≈ " + ms(p.net / 2));
        arrow(1, tEdge, 2, tDbIn, "≈ " + ms(hop));
        block(2, tDbIn, tDbOut, COLOR.d1, os.fill(os.t("tr.tl.exec"), {ms:ms(sql)}), true);
        arrow(2, tDbOut, 1, tBack, "≈ " + ms(hop));
        if (p.other >= 0.5) block(1, tBack, tOut, COLOR.other, os.fill(os.t("tr.tl.other"), {ms:ms(p.other)}));
        arrow(1, tOut, 0, tFirst, "≈ " + ms(p.net / 2));
        block(0, tFirst, tDone, COLOR.dl, os.fill(os.t("tr.tl.dl"), {ms:ms(dlMs)}));
        tl.appendChild(root);
        tlKey.textContent = os.fill(os.t("tr.tl.key"), {wait:ms(wait), d1:ms(d1.ms), sql:ms(d1.sqlMs)});
      }

      // What went over the wire, as far as a page can see it. HTTP/2 and HTTP/3 carry the request line as
      // pseudo-headers (:method, :path...), so it is shown that way, the same as browser developer tools.
      function fillRaw(){
        var r = last, u = new URL(r.url), proto = protoOf(r.e, r.data.client), h1 = proto === "HTTP/1.1";
        reqPre.textContent = (h1
          ? ["GET " + u.pathname + u.search + " HTTP/1.1", "host: " + u.host]
          : [":method: GET", ":authority: " + u.host, ":scheme: https", ":path: " + u.pathname + u.search]
        ).concat(["origin: " + location.origin]).join("\n");
        resPre.textContent = [h1 ? "HTTP/1.1 " + r.status : ":status: " + r.status]
          .concat(r.headers.map(function(x){ return x[0] + ": " + x[1]; })).join("\n") +
          "\n\n" + JSON.stringify(r.data, null, 2);
        // transferSize is the body plus a flat 300 (Resource Timing hides real header sizes), so only the body
        // sizes say anything.
        var e = r.e, gz = e && e.decodedBodySize && e.decodedBodySize !== e.encodedBodySize;
        size.textContent = e && e.encodedBodySize
          ? os.fill(os.t("tr.raw.size"), {body:bytes(e.encodedBodySize), gz:gz ? os.fill(os.t("tr.raw.gz"), {raw:bytes(e.decodedBodySize)}) : ""})
          : "";
      }

      function show(name){
        tab = name;
        tabs.querySelectorAll("button").forEach(function(b){ b.setAttribute("aria-selected", String(b.getAttribute("data-tab") === name)); });
        el.querySelectorAll(".tr-pane").forEach(function(x){ x.hidden = x.getAttribute("data-pane") !== name; });
        if (name === "tl" && last) drawTimeline();
      }
      tabs.addEventListener("click", function(ev){ var b = ev.target.closest("button"); if (b) show(b.getAttribute("data-tab")); });
      // Redraw the timeline when the window is resized; the check stops its own redraw from looping.
      var ro = window.ResizeObserver ? new ResizeObserver(function(){
        if (tab === "tl" && last && tl.clientWidth !== tlWidth) drawTimeline();
      }) : null;
      if (ro) ro.observe(tl);

      function label(){
        go.disabled = busy;
        go.textContent = os.t(busy ? "tr.sending" : last ? "tr.again" : "tr.send");
      }

      function send(){
        if (busy) return;
        busy = true;
        label();
        err.hidden = true;
        out.hidden = false;
        if (!os.still.matches) {
          route.classList.remove("run");
          void route.offsetWidth;   // restart the animation
          route.classList.add("run");
        }
        var url = os.api + "/trace?n=" + Date.now().toString(36) + "-" + (++seq), t0 = performance.now(), got = {};
        fetch(url, {cache:"no-store"}).then(function(r){
          if (!r.ok) throw new Error(r.status);
          got.status = r.status;
          got.headers = [];
          r.headers.forEach(function(v, k){ got.headers.push([k, v]); });
          return r.json();
        }).then(function(data){
          var t1 = performance.now();
          return timingOf(url).then(function(e){
            return {data:data, e:e, total:e ? e.responseEnd - e.startTime : t1 - t0, url:url, status:got.status, headers:got.headers};
          });
        }).then(function(run){
          last = run;
          runs.push(run.total);
          if (runs.length > KEEP) runs.shift();
          render();
        }, function(){
          err.hidden = false;
          if (!last) out.hidden = true;
        }).then(function(){
          busy = false;
          label();
        });
      }

      go.addEventListener("click", send);
      var off = os.onLang(function(){ label(); if (last) render(); else skeleton(); });
      label();
      skeleton();
      show("tl");
      return function(){ off(); if (obs) obs.disconnect(); if (ro) ro.disconnect(); };
    }
  });
})();
