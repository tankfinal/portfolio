// 凌晨三點 (3 A.M.): the game rules. No DOM here, so the same file runs in the browser and in Node, where
// tools/oncall.test.js tests it and tools/check-oncall.js uses it to check the content.
//
// A scenario is data (apps/oncall/roles/<role>.json). Each choice costs simulated minutes; until the service
// is restored, user impact and asset risk grow at a per-minute `rate`; options can add to them at once
// (`users`, `asset`), change the rate (mitigation), hand out clues (`give`) that other options `need`, move to
// another step (`next`), restore the service (`fix`: nothing grows any more, and the time score is taken
// here) and close the incident (`end`, or a `fix` with no `next`). Between restoring and closing come the
// checks and the clean-up, which still cost users or assets when done badly. Timers make a slow response
// worse. There is no single right answer: the score weighs time (against the scenario's `par`, the minutes a
// sound restore takes), users and assets (against the best any way through reached), and losing everything
// that matters caps the grade at C.
//
// The player picks a difficulty, 1 to 3 (普通, 困難, 地獄). An option or alert with `lv` shows only from that
// difficulty up; without it, it shows on all three. Each difficulty is analysed and scored on its own.
//
// On 困難 and 地獄 the clock also runs between choices: the page calls wait() for every minute that passes
// while you walk and think. So that thinking is not a loss in itself, each decision comes with THINK minutes
// of allowance: the analysis spends them before every choice, and the time score adds them to `par`.
(function(root){
  var DIMS = ["time", "users", "asset"];
  var LEVELS = [1, 2, 3];
  var THINK = {1:0, 2:3, 3:3};
  var GRADES = [["S", 90], ["A", 75], ["B", 60], ["C", 0]];
  var STATIONS_DEFAULT = "pc";

  function clamp(v){ return Math.max(0, Math.min(100, v)); }
  function shuffle(a, rnd){
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function stationOf(o){ return o.at || STATIONS_DEFAULT; }
  function shows(x, lv){ return (x.lv || 1) <= lv; }
  function alertsAt(scn, lv){ return scn.alerts.filter(function(a){ return shows(a, lv); }); }

  // A new game at difficulty `lv`. `rnd` returns [0, 1); tests pass a fixed one. `log` false skips the event
  // list (for the search).
  function create(scn, lv, rnd, log){
    rnd = rnd || Math.random;
    var order = {};
    Object.keys(scn.steps).forEach(function(id){
      order[id] = shuffle(scn.steps[id].opts.map(function(_, i){ return i; }), rnd);   // the right answer is often first in the data
    });
    var rate = scn.rate || {};
    var st = {lv:lv || 1, phase:scn.first || "start", mins:0, users:0, asset:0, rate:{users:rate.users || 0, asset:rate.asset || 0},
              flags:{}, used:{}, fired:{}, fixed:false, fixedAt:null, nFix:0, done:false, n:0, waited:{mins:0, users:0, asset:0},
              order:order, events:log === false ? null : []};
    if (st.events) {
      var al = alertsAt(scn, st.lv);
      st.events.push({k:"sys", t:0, key:"oc.paged", vars:{n:al.length}});
      al.forEach(function(a){ st.events.push({k:"al", t:0, a:a}); });
    }
    return st;
  }
  function copy(st){
    return {lv:st.lv, phase:st.phase, mins:st.mins, users:st.users, asset:st.asset, rate:{users:st.rate.users, asset:st.rate.asset},
            flags:Object.assign({}, st.flags), used:Object.assign({}, st.used), fired:Object.assign({}, st.fired),
            fixed:st.fixed, fixedAt:st.fixedAt, nFix:st.nFix, done:st.done, n:st.n, waited:st.waited, order:st.order, events:null};
  }

  // What can be done now, in the shuffled order; `at` narrows it to one station.
  function options(scn, st, at){
    var step = scn.steps[st.phase];
    return st.order[st.phase].filter(function(i){
      var o = step.opts[i];
      if (st.used[st.phase + ":" + i] || !shows(o, st.lv)) return false;
      if ((o.need || []).some(function(f){ return !st.flags[f]; })) return false;
      return at == null || stationOf(o) === at;
    }).map(function(i){ return {i:i, o:step.opts[i]}; });
  }
  function stations(scn, st){
    var out = [];
    options(scn, st).forEach(function(x){ var a = stationOf(x.o); if (out.indexOf(a) < 0) out.push(a); });
    return out;
  }

  // Let `m` minutes pass. Timers due in that span fire at their minute. They only worsen what is still growing
  // at full rate: once you have contained a dimension, a timer leaves it alone; once restored, they are over.
  function advance(scn, st, m){
    var end = st.mins + m, t0 = st.mins;
    (st.fixed ? [] : scn.timers || []).map(function(tm, i){ return {tm:tm, i:i}; })
      .filter(function(x){ return !st.fired[x.i] && x.tm.at > st.mins && x.tm.at <= end; })
      .sort(function(a, b){ return a.tm.at - b.tm.at; })
      .forEach(function(x){
        accrue(st, x.tm.at - t0);
        t0 = x.tm.at;
        st.fired[x.i] = 1;
        var base = scn.rate || {};
        Object.keys(x.tm.rate || {}).forEach(function(k){ if (st.rate[k] > 0 && st.rate[k] >= (base[k] || 0)) st.rate[k] += x.tm.rate[k]; });
        if (st.events && x.tm.alert) st.events.push({k:"al", t:x.tm.at, a:x.tm.alert, late:1});
      });
    accrue(st, end - t0);
    st.mins = end;
  }
  function accrue(st, m){ st.users += st.rate.users * m; st.asset += st.rate.asset * m; }

  // A minute passes without an action (walking, thinking), until the service is restored. What it added is
  // kept in st.waited.
  function wait(scn, st){
    if (st.fixed) return;
    var u = st.users, a = st.asset;
    advance(scn, st, 1);
    st.waited = {mins:st.waited.mins + 1, users:st.waited.users + st.users - u, asset:st.waited.asset + st.asset - a};
  }

  // Do option `i` of the current step. Returns what it cost: {mins, users, asset}; `after` marks a choice made
  // once the service was already restored, whose minutes no longer count.
  function choose(scn, st, i){
    var o = scn.steps[st.phase].opts[i], before = {mins:st.mins, users:st.users, asset:st.asset}, after = st.fixed;
    st.n++;
    if (st.events) st.events.push({k:"act", t:st.mins, o:o});
    advance(scn, st, o.min || 0);
    st.users += o.users || 0;
    st.asset += o.asset || 0;
    Object.keys(o.rate || {}).forEach(function(k){ st.rate[k] = o.rate[k]; });
    (o.give || []).forEach(function(f){ st.flags[f] = 1; });
    var d = {mins:st.mins - before.mins, users:st.users - before.users, asset:st.asset - before.asset, after:after};
    if (st.events) st.events.push({k:"say", t:st.mins, o:o, d:d});
    if (o.fix && !st.fixed) { st.fixed = true; st.fixedAt = st.mins; st.nFix = st.n; st.rate = {users:0, asset:0}; }
    if (o.end || (o.fix && !o.next)) st.done = true;
    else if (o.next) st.phase = o.next;
    else st.used[st.phase + ":" + i] = 1;
    return d;
  }

  // Every way through the incident, found by trying each choice in turn, thinking THINK minutes before each
  // until the restore. Options that only cost (no clue, no rate change, no move) can never help, so the search
  // skips them; that keeps it small. A path's `mins` and `n` are taken at the restore.
  function analyse(scn, lv){
    lv = lv || 1;
    if (!scn.__analysis) Object.defineProperty(scn, "__analysis", {value:{}, enumerable:false, configurable:true});
    if (scn.__analysis[lv]) return scn.__analysis[lv];
    var paths = [], unfixed = [], think = THINK[lv] || 0;
    (function dfs(st, path, depth){
      if (st.done) {
        if (st.fixed) paths.push({path:path, n:st.nFix, mins:st.fixedAt, total:st.mins, users:st.users, asset:st.asset});
        else unfixed.push(path);
        return;
      }
      if (depth > 24) return;
      options(scn, st).forEach(function(x){
        var o = x.o;
        if (!(o.next || o.fix || o.end || o.rate || (o.give && o.give.length))) return;
        var s2 = copy(st);
        if (think && !s2.fixed) advance(scn, s2, think);
        choose(scn, s2, x.i);
        dfs(s2, path.concat([{phase:st.phase, i:x.i}]), depth + 1);
      });
    })(create(scn, lv, function(){ return 0; }, false), [], 0);
    var best = {mins:Infinity, users:Infinity, asset:Infinity};
    paths.forEach(function(p){ DIMS.forEach(function(k){ var v = k === "time" ? p.mins : p[k]; var key = k === "time" ? "mins" : k; if (v < best[key]) best[key] = v; }); });
    // First find the best trade-off, judging each dimension against the best any path reached in it (those
    // bests usually come from different paths, so no path is perfect everywhere). Then score everything,
    // players included, against that path: matching it is 100.
    var par = scn.par || best.mins, top = null;
    paths.forEach(function(p){
      p.raw = scoreWith(scn, {par:par, think:think, users:best.users, asset:best.asset}, p).total;
      if (!top || p.raw > top.raw || (p.raw === top.raw && p.mins < top.mins)) top = p;
    });
    var ref = top ? {par:par, think:think, users:top.users, asset:top.asset} : {par:par, think:think, users:0, asset:0};
    paths.forEach(function(p){ p.score = scoreWith(scn, ref, p); });
    return (scn.__analysis[lv] = {par:par, think:think, fastest:best.mins, best:best, top:top, ref:ref, paths:paths, unfixed:unfixed});
  }

  // Each dimension is 100 at the reference and falls to 0 at `budget` worse; time, taken at the restore, is 100
  // up to `par` (plus the thinking allowance for the decisions made by then) and falls to 0 at three times it.
  // The total is the weighted mean. A dimension weighing 0.3 or more that ends at 0 (all the users lost, the
  // assets gone) caps the grade at C, however good the rest looks. `m` is a path or a finished game.
  function scoreWith(scn, ref, m){
    var w = scn.weights || {}, b = scn.budget || {};
    var mins = m.fixedAt != null ? m.fixedAt : m.mins, n = m.fixedAt != null ? m.nFix : m.n;
    var par = ref.par + (ref.think || 0) * (n || 0);
    var s = {
      time: mins <= par ? 100 : clamp(100 * (1 - (mins - par) / (2 * Math.max(par, 1)))),
      users: clamp(100 * (1 - (m.users - ref.users) / (b.users || 100))),
      asset: clamp(100 * (1 - (m.asset - ref.asset) / (b.asset || 100)))
    };
    var wsum = DIMS.reduce(function(t, k){ return t + (w[k] || 0); }, 0) || 1;
    s.total = Math.round(DIMS.reduce(function(t, k){ return t + (w[k] || 0) * s[k]; }, 0) / wsum);
    DIMS.forEach(function(k){ s[k] = Math.round(s[k]); });
    s.grade = GRADES.filter(function(g){ return s.total >= g[1]; })[0][0];
    s.capped = DIMS.filter(function(k){ return (w[k] || 0) / wsum >= 0.3 && s[k] === 0; })[0] || null;
    if (s.capped) s.grade = "C";
    return s;
  }
  function score(scn, st){ return scoreWith(scn, analyse(scn, st.lv).ref, st); }

  // How many score points each decision cost, for the postmortem. Choices on the top-scoring path are left out:
  // that path pays them too. Time spent walking and thinking beyond the allowance is one more entry, with no
  // option (`slow`), carrying its share of what the waiting added.
  function costs(scn, st){
    var a = analyse(scn, st.lv), w = scn.weights || {}, b = scn.budget || {};
    var wsum = DIMS.reduce(function(t, k){ return t + (w[k] || 0); }, 0) || 1, par = Math.max(a.par + a.think * st.nFix, 1);
    function pts(d){
      var p = {
        time: d.after ? 0 : (w.time || 0) * 100 * d.mins / (2 * par) / wsum,
        users: (w.users || 0) * 100 * d.users / (b.users || 100) / wsum,
        asset: (w.asset || 0) * 100 * d.asset / (b.asset || 100) / wsum
      };
      return {pts:p, total:p.time + p.users + p.asset};
    }
    var onTop = a.top ? a.top.path.map(function(p){ return scn.steps[p.phase].opts[p.i]; }) : [];
    var out = (st.events || []).filter(function(e){ return e.k === "say" && onTop.indexOf(e.o) < 0; }).map(function(e){
      var c = pts(e.d);
      return {o:e.o, d:e.d, pts:c.pts, total:c.total};
    });
    var wd = st.waited, over = wd.mins - a.think * st.nFix;
    if (over > 0) {
      var share = over / wd.mins, d = {mins:over, users:wd.users * share, asset:wd.asset * share}, c = pts(d);
      out.push({slow:true, o:null, d:d, pts:c.pts, total:c.total});
    }
    return out.filter(function(c){ return c.total >= 0.5; }).sort(function(x, y){ return y.total - x.total; });
  }

  // Content checks, for tools/check-oncall.js and the tests. `stations` lists the station ids the map offers.
  function validate(role, stationIds){
    var out = [], ids = {};
    function bad(where, msg){ out.push(role.id + "/" + where + ": " + msg); }
    function text(where, t){ if (!t || typeof t.zh !== "string" || typeof t.en !== "string" || !t.zh || !t.en) bad(where, "needs zh and en text"); }
    (role.scenarios || []).forEach(function(s){
      var at = s.id || "?";
      if (!s.id) bad(at, "missing id");
      if (ids[s.id]) bad(at, "duplicate id");
      ids[s.id] = 1;
      ["name", "hook", "cause", "lesson"].forEach(function(k){ text(at + "." + k, s[k]); });
      (s.todo || []).forEach(function(t, i){ text(at + ".todo[" + i + "]", t); });
      if (!(s.par > 0)) bad(at, "par (the minutes a sound fix takes) must be set");
      if (!/^\d\d:\d\d$/.test(s.clock || "")) bad(at, "clock must be HH:MM");
      if (!s.alerts || !alertsAt(s, 1).length) bad(at, "needs at least one alert on every difficulty");
      (s.alerts || []).concat((s.timers || []).map(function(t){ return t.alert; }).filter(Boolean)).forEach(function(a, i){
        if (!/^P[123]$/.test(a.sev)) bad(at + ".alert[" + i + "]", "sev must be P1, P2 or P3");
        if (a.lv != null && LEVELS.indexOf(a.lv) < 0) bad(at + ".alert[" + i + "]", "lv must be 1, 2 or 3");
        text(at + ".alert[" + i + "]", a.text);
      });
      var w = s.weights || {};
      if (!DIMS.some(function(k){ return w[k] > 0; })) bad(at, "weights must give at least one dimension a share");
      var steps = s.steps || {}, first = s.first || "start", given = {}, needed = [];
      if (!steps[first]) bad(at, "first step '" + first + "' does not exist");
      Object.keys(steps).forEach(function(sid){
        var st = steps[sid], where = at + "." + sid;
        text(where + ".ask", st.ask);
        if (!st.opts || !st.opts.length) { bad(where, "has no options"); return; }
        if (!st.opts.some(function(o){ return o.next || o.fix || o.end; })) bad(where, "no option moves on, restores or closes");
        st.opts.forEach(function(o, i){
          var ow = where + "[" + i + "]";
          text(ow + ".label", o.label);
          text(ow + ".say", o.say);
          if (!(o.min >= 0)) bad(ow, "min must be a number >= 0");
          if (o.lv != null && LEVELS.indexOf(o.lv) < 0) bad(ow, "lv must be 1, 2 or 3");
          if (o.next && !steps[o.next]) bad(ow, "next '" + o.next + "' does not exist");
          if (o.next && o.end) bad(ow, "cannot both move on and close");
          if (stationIds.indexOf(stationOf(o)) < 0) bad(ow, "station '" + stationOf(o) + "' is not on the map");
          (o.give || []).forEach(function(f){ given[f] = 1; });
          (o.need || []).forEach(function(f){ needed.push([ow, f]); });
        });
      });
      needed.forEach(function(n){ if (!given[n[1]]) bad(n[0], "needs clue '" + n[1] + "' that nothing gives"); });
      if (!out.length || out.every(function(m){ return m.indexOf(role.id + "/" + at) !== 0; })) LEVELS.forEach(function(lv){
        var a = analyse(s, lv);
        if (!a.paths.length) bad(at + "@" + lv, "cannot be fixed by any path");
        else if (a.unfixed.length) bad(at + "@" + lv, "can close without restoring the service");
        else if (a.top.score.capped) bad(at + "@" + lv, "the best trade-off still loses all of " + a.top.score.capped);
      });
    });
    return out;
  }

  var E = {DIMS:DIMS, LEVELS:LEVELS, THINK:THINK, alerts:alertsAt, create:create, wait:wait, options:options, stations:stations, choose:choose, analyse:analyse,
           score:score, costs:costs, validate:validate, stationOf:stationOf};
  if (typeof module === "object" && module.exports) module.exports = E;
  else (root.OC = root.OC || {}).engine = E;
})(typeof self !== "undefined" ? self : this);
