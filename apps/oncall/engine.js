// 凌晨三點 (3 A.M.): the game rules. No DOM here, so the same file runs in the browser and in Node, where
// tools/oncall.test.js tests it and tools/check-oncall.js uses it to check the content.
//
// A scenario is data (apps/oncall/roles/<role>.json). Each choice costs simulated minutes; while the incident
// lasts, user impact and asset risk grow at a per-minute `rate`; options can add to them at once (`users`,
// `asset`), change the rate (mitigation), hand out clues (`give`) that other options `need`, move to another
// step (`next`) or resolve the incident (`fix`). Timers make a slow response worse. There is no single right
// answer: the score weighs time (against the scenario's `par`, the minutes a sound fix takes), users and assets
// (against the best any way through reached), and losing everything that matters caps the grade at C.
(function(root){
  var DIMS = ["time", "users", "asset"];
  var GRADES = [["S", 90], ["A", 75], ["B", 60], ["C", 0]];
  var STATIONS_DEFAULT = "pc";

  function clamp(v){ return Math.max(0, Math.min(100, v)); }
  function shuffle(a, rnd){
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function stationOf(o){ return o.at || STATIONS_DEFAULT; }

  // A new game. `rnd` returns [0, 1); tests pass a fixed one. `log` false skips the event list (for the search).
  function create(scn, rnd, log){
    rnd = rnd || Math.random;
    var order = {};
    Object.keys(scn.steps).forEach(function(id){
      order[id] = shuffle(scn.steps[id].opts.map(function(_, i){ return i; }), rnd);   // the right answer is often first in the data
    });
    var rate = scn.rate || {};
    var st = {phase:scn.first || "start", mins:0, users:0, asset:0, rate:{users:rate.users || 0, asset:rate.asset || 0},
              flags:{}, used:{}, fired:{}, done:false, order:order, events:log === false ? null : []};
    if (st.events) {
      st.events.push({k:"sys", t:0, key:"oc.paged", vars:{n:scn.alerts.length}});
      scn.alerts.forEach(function(a){ st.events.push({k:"al", t:0, a:a}); });
    }
    return st;
  }
  function copy(st){
    return {phase:st.phase, mins:st.mins, users:st.users, asset:st.asset, rate:{users:st.rate.users, asset:st.rate.asset},
            flags:Object.assign({}, st.flags), used:Object.assign({}, st.used), fired:Object.assign({}, st.fired),
            done:st.done, order:st.order, events:null};
  }

  // What can be done now, in the shuffled order; `at` narrows it to one station.
  function options(scn, st, at){
    var step = scn.steps[st.phase];
    return st.order[st.phase].filter(function(i){
      var o = step.opts[i];
      if (st.used[st.phase + ":" + i]) return false;
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
  // at full rate: once you have contained a dimension, a timer leaves it alone.
  function advance(scn, st, m){
    var end = st.mins + m, t0 = st.mins;
    (scn.timers || []).map(function(tm, i){ return {tm:tm, i:i}; })
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

  // Do option `i` of the current step. Returns what it cost: {mins, users, asset}.
  function choose(scn, st, i){
    var o = scn.steps[st.phase].opts[i], before = {mins:st.mins, users:st.users, asset:st.asset};
    if (st.events) st.events.push({k:"act", t:st.mins, o:o});
    advance(scn, st, o.min || 0);
    st.users += o.users || 0;
    st.asset += o.asset || 0;
    Object.keys(o.rate || {}).forEach(function(k){ st.rate[k] = o.rate[k]; });
    (o.give || []).forEach(function(f){ st.flags[f] = 1; });
    var d = {mins:st.mins - before.mins, users:st.users - before.users, asset:st.asset - before.asset};
    if (st.events) st.events.push({k:"say", t:st.mins, o:o, d:d});
    if (o.fix) { st.done = true; st.rate = {users:0, asset:0}; }
    else if (o.next) st.phase = o.next;
    else st.used[st.phase + ":" + i] = 1;
    return d;
  }

  // Every way to fix the incident, found by trying each choice in turn. Options that only cost (no clue, no
  // rate change, no move) can never help, so the search skips them; that keeps it small.
  function analyse(scn){
    if (scn.__analysis) return scn.__analysis;
    var paths = [];
    (function dfs(st, path, depth){
      if (st.done) { paths.push({path:path, mins:st.mins, users:st.users, asset:st.asset}); return; }
      if (depth > 16) return;
      options(scn, st).forEach(function(x){
        var o = x.o;
        if (!(o.next || o.fix || o.rate || (o.give && o.give.length))) return;
        var s2 = copy(st);
        choose(scn, s2, x.i);
        dfs(s2, path.concat([{phase:st.phase, i:x.i}]), depth + 1);
      });
    })(create(scn, function(){ return 0; }, false), [], 0);
    var best = {mins:Infinity, users:Infinity, asset:Infinity};
    paths.forEach(function(p){ DIMS.forEach(function(k){ var v = k === "time" ? p.mins : p[k]; var key = k === "time" ? "mins" : k; if (v < best[key]) best[key] = v; }); });
    // First find the best trade-off, judging each dimension against the best any path reached in it (those
    // bests usually come from different paths, so no path is perfect everywhere). Then score everything,
    // players included, against that path: matching it is 100.
    var par = scn.par || best.mins, top = null;
    paths.forEach(function(p){
      p.raw = scoreWith(scn, {par:par, users:best.users, asset:best.asset}, p).total;
      if (!top || p.raw > top.raw || (p.raw === top.raw && p.mins < top.mins)) top = p;
    });
    var ref = top ? {par:par, users:top.users, asset:top.asset} : {par:par, users:0, asset:0};
    paths.forEach(function(p){ p.score = scoreWith(scn, ref, p); });
    var a = {par:par, fastest:best.mins, best:best, top:top, ref:ref, paths:paths};
    Object.defineProperty(scn, "__analysis", {value:a, enumerable:false, configurable:true});
    return a;
  }

  // Each dimension is 100 at the reference and falls to 0 at `budget` worse; time is 100 up to `par` and falls
  // to 0 at three times it. The total is the weighted mean. A dimension weighing 0.3 or more that ends at 0
  // (all the users lost, the assets gone) caps the grade at C, however good the rest looks.
  function scoreWith(scn, ref, m){
    var w = scn.weights || {}, b = scn.budget || {};
    var s = {
      time: m.mins <= ref.par ? 100 : clamp(100 * (1 - (m.mins - ref.par) / (2 * Math.max(ref.par, 1)))),
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
  function score(scn, st){ return scoreWith(scn, analyse(scn).ref, st); }

  // How many score points each decision cost, for the postmortem. Choices on the top-scoring path are left out:
  // that path pays them too.
  function costs(scn, st){
    var a = analyse(scn), w = scn.weights || {}, b = scn.budget || {};
    var wsum = DIMS.reduce(function(t, k){ return t + (w[k] || 0); }, 0) || 1;
    var onTop = a.top ? a.top.path.map(function(p){ return scn.steps[p.phase].opts[p.i]; }) : [];
    return (st.events || []).filter(function(e){ return e.k === "say" && onTop.indexOf(e.o) < 0; }).map(function(e){
      var p = {
        time: (w.time || 0) * 100 * e.d.mins / (2 * Math.max(a.par, 1)) / wsum,
        users: (w.users || 0) * 100 * e.d.users / (b.users || 100) / wsum,
        asset: (w.asset || 0) * 100 * e.d.asset / (b.asset || 100) / wsum
      };
      return {o:e.o, d:e.d, pts:p, total:p.time + p.users + p.asset};
    }).filter(function(c){ return c.total >= 0.5; }).sort(function(x, y){ return y.total - x.total; });
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
      if (!(s.stars >= 1 && s.stars <= 3)) bad(at, "stars must be 1 to 3");
      if (!(s.par > 0)) bad(at, "par (the minutes a sound fix takes) must be set");
      if (!/^\d\d:\d\d$/.test(s.clock || "")) bad(at, "clock must be HH:MM");
      if (!s.alerts || !s.alerts.length) bad(at, "needs at least one alert");
      (s.alerts || []).concat((s.timers || []).map(function(t){ return t.alert; }).filter(Boolean)).forEach(function(a, i){
        if (!/^P[123]$/.test(a.sev)) bad(at + ".alert[" + i + "]", "sev must be P1, P2 or P3");
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
        if (!st.opts.some(function(o){ return o.next || o.fix; })) bad(where, "no option moves on or fixes");
        st.opts.forEach(function(o, i){
          var ow = where + "[" + i + "]";
          text(ow + ".label", o.label);
          text(ow + ".say", o.say);
          if (!(o.min >= 0)) bad(ow, "min must be a number >= 0");
          if (o.next && !steps[o.next]) bad(ow, "next '" + o.next + "' does not exist");
          if (o.next && o.fix) bad(ow, "cannot both move on and fix");
          if (stationIds.indexOf(stationOf(o)) < 0) bad(ow, "station '" + stationOf(o) + "' is not on the map");
          (o.give || []).forEach(function(f){ given[f] = 1; });
          (o.need || []).forEach(function(f){ needed.push([ow, f]); });
        });
      });
      needed.forEach(function(n){ if (!given[n[1]]) bad(n[0], "needs clue '" + n[1] + "' that nothing gives"); });
      if (!out.length || out.every(function(m){ return m.indexOf(role.id + "/" + at) !== 0; })) {
        var a = analyse(s);
        if (!a.paths.length) bad(at, "cannot be fixed by any path");
        else if (a.top.score.capped) bad(at, "the best trade-off still loses all of " + a.top.score.capped);
      }
    });
    return out;
  }

  var E = {DIMS:DIMS, create:create, options:options, stations:stations, choose:choose, analyse:analyse,
           score:score, costs:costs, validate:validate, stationOf:stationOf};
  if (typeof module === "object" && module.exports) module.exports = E;
  else (root.OC = root.OC || {}).engine = E;
})(typeof self !== "undefined" ? self : this);
