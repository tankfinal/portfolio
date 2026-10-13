// 凌晨三點 (3 A.M.), the on-call game. A small top-down RPG: woken at night by alerts, you walk around a flat to
// the phone, the laptop and the rack, and each action there costs simulated minutes while user impact and asset
// risk keep growing. Fixed, you go back to bed for an ending by grade, then the postmortem. There is no single
// right answer: the score weighs time, users and assets per incident.
//
// The game is split so that new roles and incidents are data, not code:
//   apps/oncall/engine.js      the rules and the scoring (no DOM; tools/ tests and checks it in Node)
//   apps/oncall/world.js       the map on the canvas: drawing, walking, lighting, the ending animation
//   apps/oncall/ui.js          the dialog, station screens, log, bar, ending card and postmortem
//   apps/oncall/style.css      their styles
//   apps/oncall/roles/*.json   a role: its character and map, and its incidents
//   apps/oncall/maps/*.json    a map: tiles, furniture, and the things you can use
//   apps/oncall/art.json       the pixel art the packs don't have (bed, laptop, phone, rack, Kuai Kuai, window)
// To add a role: write roles/<id>.json (node tools/check-oncall.js checks it) and add the id to ROLES.
// This file is the controller: it loads all that, asks for a difficulty (普通, 困難, 地獄: harder ones offer
// more options), picks an incident (preferring ones not played yet) and runs the game. The difficulty, the
// incidents seen and the best grade per incident and difficulty stay in this browser (localStorage
// "oncall.lv", "oncall.seen" keyed "<role>/<incident>", "oncall.best" keyed "<role>/<incident>@<lv>").
// index.html loads these files the first time the window opens.
(function(){
  var ROLES = ["be"];
  var GRADE_ORDER = "SABC";
  var DATA = null;   // the loaded roles, maps, art and sprite sheets, shared by every window

  function load(ver){
    if (DATA) return DATA;
    function json(p){
      return fetch("apps/oncall/" + p + "?v=" + ver).then(function(r){ if (!r.ok) throw new Error(p); return r.json(); });
    }
    function img(p){
      return new Promise(function(ok, no){
        var im = new Image();
        im.onload = function(){ ok(im); };
        im.onerror = no;
        im.src = "apps/oncall/" + p;
      });
    }
    DATA = Promise.all([Promise.all(ROLES.map(function(id){ return json("roles/" + id + ".json"); })), json("art.json"), img("indoor.png"), img("urban.png")])
      .then(function(r){
        var roles = r[0], ids = [];
        roles.forEach(function(role){ if (ids.indexOf(role.map) < 0) ids.push(role.map); });
        return Promise.all(ids.map(function(id){ return json("maps/" + id + ".json"); })).then(function(list){
          var maps = {}, pool = [];
          list.forEach(function(m){ maps[m.id] = m; });
          roles.forEach(function(role){ role.scenarios.forEach(function(s){ pool.push({role:role, s:s, key:role.id + "/" + s.id}); }); });
          return {maps:maps, pool:pool, art:r[1], img:{"in":r[2], ur:r[3]}};
        });
      });
    DATA.catch(function(){ DATA = null; });   // let the next open try again
    return DATA;
  }

  // Keys were plain incident ids before roles existed, all the backend role's, and grades had no difficulty
  // before there was a choice; what there was then is 困難 now.
  function keyed(k){ return k.indexOf("/") < 0 ? "be/" + k : k; }
  function bestKey(k){ k = keyed(k); return k.indexOf("@") < 0 ? k + "@2" : k; }
  function read(name, empty){ try { return JSON.parse(localStorage.getItem(name)) || empty; } catch (e) { return empty; } }
  function write(name, v){ try { localStorage.setItem(name, JSON.stringify(v)); } catch (e) {} }
  function saveBest(key, grade){
    var old = read("oncall.best", {}), best = {};
    Object.keys(old).forEach(function(k){ best[bestKey(k)] = old[k]; });
    if (!best[key] || GRADE_ORDER.indexOf(grade) < GRADE_ORDER.indexOf(best[key])) best[key] = grade;
    write("oncall.best", best);
  }
  // Which incident to open: one not played yet if any, never the one just played.
  function pick(pool, not){
    var seen = read("oncall.seen", []).map(keyed);
    var left = pool.filter(function(x){ return x.key !== not && seen.indexOf(x.key) < 0; });
    if (!left.length) left = pool.filter(function(x){ return x.key !== not; });
    if (!left.length) left = pool;
    return left[Math.floor(Math.random() * left.length)];
  }
  function markSeen(pool, key){
    var seen = read("oncall.seen", []).map(keyed);
    if (seen.indexOf(key) < 0) seen.push(key);
    if (seen.length >= pool.length) seen = [key];   // all played: start a new round, but not with this one
    write("oncall.seen", seen);
  }

  TankOS.define("oncall", {
    i18n: {
      "oc.pick":   {zh:"選擇難度", en:"Choose a difficulty"},
      "oc.lv.1":   {zh:"普通", en:"Normal"},
      "oc.lv.2":   {zh:"困難", en:"Hard"},
      "oc.lv.3":   {zh:"地獄", en:"Hell"},
      "oc.lv.1.d": {zh:"選項少，一步一步來。", en:"Fewer options. One step at a time."},
      "oc.lv.2.d": {zh:"多了岔路和陷阱，告警裡夾著雜訊。", en:"More forks and traps, and noise among the alerts."},
      "oc.lv.3.d": {zh:"選項最多，很多看起來都對。", en:"The most options, and many of them look right."},
      "oc.toPick": {zh:"換難度", en:"Change difficulty"},
      "oc.shift":  {zh:"值班中", en:"On call"},
      "oc.time":   {zh:"時間", en:"Time"},
      "oc.status": {zh:"狀態", en:"Status"},
      "oc.st.down":{zh:"異常", en:"Down"},
      "oc.st.part":{zh:"部分止血", en:"Contained in part"},
      "oc.st.up":  {zh:"已恢復", en:"Restored"},
      "oc.dim.time":{zh:"時間", en:"Time"},
      "oc.dim.users":{zh:"用戶影響", en:"User impact"},
      "oc.dim.asset":{zh:"資產風險", en:"Asset risk"},
      "oc.sc.time":{zh:"時間", en:"Time"},
      "oc.sc.users":{zh:"用戶", en:"Users"},
      "oc.sc.asset":{zh:"資產", en:"Assets"},
      "oc.rate":   {zh:"+{n}/分", en:"+{n}/min"},
      "oc.d.min":  {zh:"+{m} 分鐘", en:"+{m} min"},
      "oc.d.add":  {zh:"{dim} +{n}", en:"{dim} +{n}"},
      "oc.d.slow": {zh:"{dim}擴大變慢", en:"{dim} slowing"},
      "oc.d.stop": {zh:"{dim}不再擴大", en:"{dim} contained"},
      "oc.d.fast": {zh:"{dim}擴大變快", en:"{dim} spreading faster"},
      "oc.paged":  {zh:"手機響了：{n} 則告警", en:"Paged: {n} alerts"},
      "oc.did":    {zh:"你：{a}", en:"You: {a}"},
      "oc.pm":     {zh:"事故檢討", en:"Postmortem"},
      "oc.pm.lv":  {zh:"難度：{lv}", en:"Difficulty: {lv}"},
      "oc.pm.total":{zh:"總分", en:"Score"},
      "oc.pm.mins":{zh:"修好花了 {m} 分鐘；穩健的處理大約 {par} 分鐘", en:"Fixed in {m} min; a sound fix takes about {par}"},
      "oc.pm.raw": {zh:"累積 {n}；拿高分的做法是 {best}", en:"Ended at {n}; the top-scoring way ends at {best}"},
      "oc.pm.capped":{zh:"{dim}這一項掉到 0 分：其他做得再好，評等最多 C。", en:"{dim} fell to 0: however good the rest, the grade stops at C."},
      "oc.pm.how": {zh:"總分是三項依這個事故的權重加權平均，拿高分的做法是 100 分；90 以上 S、75 以上 A、60 以上 B。", en:"The score is the three weighted for this incident; the top-scoring way is 100. 90+ is S, 75+ A, 60+ B."},
      "oc.pm.costly":{zh:"代價最大的決定", en:"The costliest decisions"},
      "oc.pm.pts": {zh:"−{n} 分", en:"−{n} pts"},
      "oc.pm.none":{zh:"沒有多付什麼代價，漂亮。", en:"Nothing cost you extra. Nicely done."},
      "oc.pm.what":{zh:"你做了什麼", en:"What you did"},
      "oc.pm.cause":{zh:"真正的原因", en:"Root cause"},
      "oc.pm.top": {zh:"拿高分的做法（{m} 分鐘）", en:"The top-scoring way ({m} min)"},
      "oc.pm.todo":{zh:"事後要做", en:"Follow-ups"},
      "oc.pm.lesson":{zh:"一句話", en:"In one line"},
      "oc.again":  {zh:"同一個事故再玩一次", en:"Replay this incident"},
      "oc.next":   {zh:"再來一局", en:"Next incident"},
      "oc.credit": {zh:"像素素材：Kenney（kenney.nl，CC0）", en:"Pixel art: Kenney (kenney.nl, CC0)"},
      "end.title": {zh:"結局 {g}：{name}", en:"Ending {g}: {name}"},
      "end.S":     {zh:"一夜好眠", en:"A good night's sleep"},
      "end.A":     {zh:"大杯咖啡", en:"A large coffee"},
      "end.B":     {zh:"站會主角", en:"Star of the stand-up"},
      "end.C":     {zh:"天亮了", en:"Sunrise"},
      "end.S.t":   {zh:"{m} 分鐘收工，處理得乾淨俐落。回到床上，剛剛那個夢還接得上。早上群組裡，主管只留了一句：「昨晚處理得漂亮。」", en:"Done in {m} minutes, cleanly. Back in bed, the dream picks up where it left off. In the morning your manager posts one line: \"Nicely handled last night.\""},
      "end.A.t":   {zh:"{m} 分鐘修好，判斷大致都對。睡得不算多，但鬧鐘響的時候你還記得自己是誰。今天的咖啡點大杯。", en:"Fixed in {m} minutes, mostly the right calls. Not much sleep, but when the alarm goes off you still know who you are. Make today's coffee a large."},
      "end.B.t":   {zh:"修好了，只是代價大了點，前後 {m} 分鐘。早上站會，大家都想聽昨晚發生什麼事。下午記得寫事故檢討。", en:"Fixed, at a price: {m} minutes in all. At stand-up everyone wants the story of last night. Write the postmortem this afternoon."},
      "end.C.t":   {zh:"前後 {m} 分鐘，事情是處理完了，要善後的卻比事故本身還多。天亮後，你在早餐店收到一則訊息：「今天下午開個會，聊聊昨晚。」", en:"{m} minutes, and it's over, but the clean-up is bigger than the incident. After sunrise, at the breakfast shop, a message arrives: \"Let's meet this afternoon about last night.\""},
      "end.was":   {zh:"這次的事故：{name}（{lv}）", en:"This time: {name} ({lv})"},
      "end.score": {zh:"總分 {n}", en:"Score {n}"},
      "end.pm":    {zh:"看事故檢討", en:"Read the postmortem"},
      "rpg.loading":{zh:"載入中…", en:"Loading…"},
      "rpg.loadFail":{zh:"載入失敗，關掉視窗再開一次試試。", en:"Couldn't load the game. Close the window and open it again."},
      "rpg.close": {zh:"關閉", en:"Close"},
      "rpg.book":  {zh:"紀錄", en:"Log"},
      "rpg.bookKey":{zh:"紀錄（J）", en:"Log (J)"},
      "rpg.restart":{zh:"重新開始", en:"Restart"},
      "rpg.restartTip":{zh:"換一個隨機事故", en:"Start a different random incident"},
      "rpg.empty": {zh:"還沒有任何紀錄。", en:"Nothing logged yet."},
      "rpg.wake":  {zh:"{t}。{what}\n（方向鍵或 WASD 移動，空白鍵互動，J 看紀錄；也可以直接點地板或東西）", en:"{t}. {what}\n(Arrow keys or WASD to move, Space to interact, J for the log, or just click the floor or things.)"},
      "rpg.wakeFirst":{zh:"{name}還在響，先接起來看看。", en:"The {name} is still ringing. Answer it first."},
      "rpg.answer":{zh:"是告警，{n} 則。", en:"Alerts. {n} of them."},
      "rpg.goalWake":{zh:"目標：接起響個不停的{name}", en:"Goal: answer the ringing {name}"},
      "rpg.goal":  {zh:"目標：{ask}　可以去：{where}", en:"Goal: {ask}  Go to: {where}"},
      "rpg.goalBed":{zh:"目標：回床上睡覺", en:"Goal: back to bed"},
      "rpg.nothing":{zh:"這一步在這裡沒什麼能做的。可以去：{where}", en:"Nothing to do here for this step. Try: {where}"},
      "rpg.fixed": {zh:"修好了。可以回床上睡覺了。", en:"Fixed. Time to go back to bed."},
      "rpg.goBed": {zh:"事情處理完了，回床上睡覺吧。", en:"It's handled. Go back to bed."}
    },

    // The rest of the styles are in apps/oncall/style.css; until it arrives, nothing shows unstyled.
    css: ".oc>*{visibility:hidden}",

    html:
      '<div class="body oc">' +
        '<div class="oc-bar" hidden></div>' +
        '<section class="oc-rpg">' +
          '<div class="oc-stage">' +
            '<canvas class="oc-cv" width="320" height="192" tabindex="0"></canvas>' +
            '<div class="oc-hud"><button type="button" class="oc-lvh" data-i18n-title="oc.toPick"></button><button type="button" class="oc-logb" data-i18n="rpg.bookKey"></button><button type="button" class="oc-re" data-i18n="rpg.restart" data-i18n-title="rpg.restartTip"></button></div>' +
            '<div class="oc-load" data-i18n="rpg.loading"></div>' +
            '<div class="oc-panel" hidden><header><b></b><button type="button" class="oc-x" data-i18n="rpg.close"></button></header><div class="oc-po"></div><div class="oc-pa"></div></div>' +
            '<div class="oc-book" hidden><header><b data-i18n="rpg.book"></b><button type="button" class="oc-x" data-i18n="rpg.close"></button></header><ol class="oc-log"></ol></div>' +
            '<div class="oc-say" hidden><p></p><small>▼</small></div>' +
            '<div class="oc-end" hidden><div class="oc-endcard"></div></div>' +
            '<div class="oc-pick" hidden><div class="oc-pickcard"></div></div>' +
          '</div>' +
          '<p class="oc-goal"></p>' +
        '</section>' +
        '<section class="oc-pm" hidden></section>' +
      '</div>',

    init: function(el, os){
      var OC = self.OC, E = OC.engine;
      if (!document.getElementById("oc-css")) {
        var link = document.createElement("link");
        link.id = "oc-css";
        link.rel = "stylesheet";
        link.href = "apps/oncall/style.css?v=" + os.ver;
        document.head.appendChild(link);
      }
      var ui = OC.ui.create(el, os), cv = el.querySelector(".oc-cv");
      // One game: the incident, the engine state, and what has happened at each station, so a language switch
      // can redraw it all. g.score is set once you are in bed.
      var data = null, g = null, world = null, alive = true, last = null;
      var lv = +read("oncall.lv", 0);
      if (E.LEVELS.indexOf(lv) < 0) lv = 1;
      var endOn = {pm:toPm, next:next}, pmOn = {next:next, again:again, level:level};

      // Before each round of play: choose the difficulty. Leaving a game for this abandons it.
      function level(){
        if (world) { world.destroy(); world = null; }
        if (g) last = g.key;
        g = null;
        ui.reset();
        lvBtn.textContent = os.t("oc.lv." + lv);
        ui.pick(lv, onPick);
      }
      function onPick(n){
        lv = n;
        write("oncall.lv", n);
        start(pick(data.pool, last));
      }

      function start(x){
        if (world) world.destroy();
        markSeen(data.pool, x.key);
        var map = data.maps[x.role.map], wake = map.things.filter(function(t){ return t.kind === "station" && t.wake; })[0];
        g = {key:x.key, role:x.role, s:x.s, map:map, wake:wake.id, st:E.create(x.s, lv), answered:false, on:{}, outs:{}, panelAt:null, score:null};
        ui.reset();
        lvBtn.textContent = os.t("oc.lv." + lv);
        ui.loading(false);
        ui.bar(g);
        ui.goal(g);
        world = OC.world.create(cv, {
          map:map, art:data.art, img:data.img, char:x.role.char, still:os.still,
          busy: function(){ return ui.busy() || !!g.score; },
          onUse:use, onAdvance:ui.advance, onBook:toggleBook,
          onSlept: function(){ ui.end(g, endOn); }
        });
        world.set({ringing:wake.id, on:g.on});
        world.start();
        ui.talk(os.fill(os.t("rpg.wake"), {t:x.s.clock, what:ui.L(map.wake)}));
      }
      function next(){ start(pick(data.pool, g.key)); }
      function again(){ start(data.pool.filter(function(x){ return x.key === g.key; })[0]); }
      function toPm(){ world.stop(); ui.pm(g, pmOn); }

      function use(t){
        if (g.st.done) { if (t.kind === "bed") sleep(); else ui.talk(os.t("rpg.goBed")); return; }
        if (!g.answered) {
          var w = g.map.things.filter(function(x){ return x.id === g.wake; })[0];
          if (t.id !== g.wake) { ui.talk(os.fill(os.t("rpg.wakeFirst"), {name:ui.L(w.name)})); return; }
          g.answered = true;
          world.set({ringing:null});
          var al = E.alerts(g.s, g.st.lv);
          ui.talk(os.fill(os.t("rpg.answer"), {n:al.length}));
          al.forEach(function(a){ ui.talk(a.sev + "　" + ui.L(a.text)); });
          ui.goal(g);
          return;
        }
        if (t.kind === "bed") { ui.talk(ui.L(t.early)); return; }
        if (t.kind === "flavor") { ui.talk(ui.L(t.say)); return; }
        if (t.idle && !E.options(g.s, g.st, t.id).length && !(g.outs[t.id] || []).length) { ui.talk(ui.L(t.idle)); return; }
        g.on[t.id] = true;
        world.set({on:g.on});
        g.panelAt = t.id;
        ui.panel(g, choose);
      }

      // Do an option. The station keeps what came back and any alert that fired meanwhile.
      function choose(i){
        if (g.st.done) return;
        var o = g.s.steps[g.st.phase].opts[i], cur = g, n = g.st.events.length;
        var r0 = {users:g.st.rate.users, asset:g.st.rate.asset};
        E.choose(g.s, g.st, i);
        var added = g.st.events.slice(n), say = added[added.length - 1], out = g.outs[E.stationOf(o)] = g.outs[E.stationOf(o)] || [];
        say.r0 = r0;
        say.r1 = {users:g.st.rate.users, asset:g.st.rate.asset};
        out.push(say);
        added.forEach(function(e){ if (e.k === "al") out.push(e); });
        ui.bar(g);
        ui.panel(g, choose);
        ui.goal(g);
        if (g.st.done) setTimeout(function(){ if (g !== cur || !alive) return; ui.closePanel(); ui.talk(os.t("rpg.fixed")); }, os.still.matches ? 0 : 1100);
      }

      function sleep(){
        g.score = E.score(g.s, g.st);
        saveBest(g.key + "@" + g.st.lv, g.score.grade);
        ui.clearGoal();
        world.sleep();
      }
      function toggleBook(){
        if (!g || g.score) return;
        if (ui.bookOpen()) ui.closeBook(); else ui.openBook(g);
      }

      var lvBtn = el.querySelector(".oc-lvh");
      lvBtn.addEventListener("click", function(){ if (g) level(); });
      el.querySelector(".oc-logb").addEventListener("click", toggleBook);
      el.querySelector(".oc-re").addEventListener("click", function(){ if (g) start(pick(data.pool, g.key)); });

      var off = os.onLang(function(){
        lvBtn.textContent = os.t("oc.lv." + lv);
        if (!g) { if (ui.pickOpen()) ui.pick(lv, onPick); return; }
        if (ui.pmOpen()) { ui.pm(g, pmOn); return; }
        ui.bar(g);
        if (!g.score) ui.goal(g);
        if (ui.panelOpen()) ui.panel(g, choose);
        if (ui.bookOpen()) ui.drawLog(g);
        if (ui.endOpen()) ui.end(g, endOn);
      });

      ui.reset();
      ui.loading(true);
      load(os.ver).then(function(d){
        if (!alive) return;
        data = d;
        ui.loading(false);
        level();
      }, function(){ if (alive) ui.loading("fail"); });
      return function(){ alive = false; off(); if (world) world.destroy(); };
    }
  });
})();
