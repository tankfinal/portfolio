// 凌晨三點 (3 A.M.): everything around the map. The dialog box, the station screens (a terminal or a phone),
// the log, the status bar, the goal line, the ending card and the postmortem. It draws from the game the
// controller (apps/oncall.js) keeps, g = {role, s (scenario), st (engine state), map, answered, outs, panelAt},
// and never changes it; what the player picks goes back through the callbacks.
(function(root){
  var OC = root.OC = root.OC || {};
  var SEV = {P1:"#FF453A", P2:"#FF9F0A", P3:"#8E8E93"};

  function create(el, os){
    var E = OC.engine;
    var cv = el.querySelector(".oc-cv"), loadEl = el.querySelector(".oc-load"), goalEl = el.querySelector(".oc-goal");
    var game = el.querySelector(".oc-rpg"), pmEl = el.querySelector(".oc-pm"), barEl = el.querySelector(".oc-bar");
    var sayEl = el.querySelector(".oc-say"), panel = el.querySelector(".oc-panel"), book = el.querySelector(".oc-book");
    var bookList = book.querySelector(".oc-log"), endEl = el.querySelector(".oc-end");
    var queue = [], typing = null, full = "";

    function L(o){ return o[os.lang() === "en" ? "en" : "zh"]; }
    function num(n){ return new Intl.NumberFormat(os.lang() === "en" ? "en-US" : "zh-TW").format(Math.round(n)); }
    function clockAt(s, mins){
      var p = s.clock.split(":"), t = (+p[0] * 60 + +p[1] + mins) % 1440;
      return ("0" + Math.floor(t / 60)).slice(-2) + ":" + ("0" + t % 60).slice(-2);
    }
    function make(tag, cls, text){
      var x = document.createElement(tag);
      if (cls) x.className = cls;
      if (text != null) x.textContent = text;
      return x;
    }
    function thing(g, id){ return g.map.things.filter(function(t){ return t.id === id; })[0]; }
    function where(g){ return E.stations(g.s, g.st).map(function(id){ return L(thing(g, id).name); }).join(" · "); }
    // The dimensions this incident is scored on; time always counts.
    function dims(s){ return E.DIMS.filter(function(k){ return k === "time" || (s.weights[k] || 0) > 0; }); }
    function stars(n){ return "★★★".slice(0, n) + "☆☆☆".slice(n); }

    /* ----- the dialog box: lines queue up and type out ----- */
    function talk(text){
      queue.push(text);
      if (sayEl.hidden) nextTalk();
    }
    function nextTalk(){
      var text = queue.shift();
      clearInterval(typing);
      typing = null;
      if (text == null) { sayEl.hidden = true; cv.focus(); return; }
      sayEl.hidden = false;
      var p = sayEl.querySelector("p"), i = 0;
      full = text;
      if (os.still.matches) { p.textContent = text; return; }
      p.textContent = "";
      typing = setInterval(function(){
        i += 2;
        p.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(typing); typing = null; }
      }, 24);
    }
    // The first press finishes the line being typed, the next moves on. False when there is no dialog.
    function advance(){
      if (sayEl.hidden) return false;
      if (typing) { clearInterval(typing); typing = null; sayEl.querySelector("p").textContent = full; return true; }
      nextTalk();
      return true;
    }

    /* ----- the bar and the goal ----- */
    function status(g){
      if (g.st.done) return "up";
      var base = g.s.rate || {};
      return ["users", "asset"].some(function(k){ return (base[k] || 0) > g.st.rate[k]; }) ? "part" : "down";
    }
    function drawBar(g){
      barEl.textContent = "";
      barEl.appendChild(make("b", "", os.t("oc.shift")));
      function cell(label, value, cls, extra){
        var c = make("span", cls || "", label);
        c.appendChild(make("strong", "", value));
        if (extra) c.appendChild(make("small", "", extra));
        barEl.appendChild(c);
      }
      cell(os.t("oc.time"), clockAt(g.s, g.st.mins));
      dims(g.s).filter(function(k){ return k !== "time"; }).forEach(function(k){
        var r = g.st.rate[k];
        cell(os.t("oc.dim." + k), num(g.st[k]), "", r > 0 ? os.fill(os.t("oc.rate"), {n:num(r)}) : "");
      });
      var stt = status(g);
      cell(os.t("oc.status"), os.t("oc.st." + stt), stt);
      barEl.hidden = false;
    }
    function drawGoal(g){
      if (!g.answered) goalEl.textContent = os.fill(os.t("rpg.goalWake"), {name:L(thing(g, g.wake).name)});
      else if (g.st.done) goalEl.textContent = os.t("rpg.goalBed");
      else goalEl.textContent = os.fill(os.t("rpg.goal"), {ask:L(g.s.steps[g.st.phase].ask), where:where(g)});
    }

    // What an action did, as small chips: minutes, impact added, and whether the spread slowed or stopped.
    function chips(g, e){
      var box = make("span", "oc-d");
      box.appendChild(make("i", "", os.fill(os.t("oc.d.min"), {m:e.d.mins})));
      dims(g.s).filter(function(k){ return k !== "time"; }).forEach(function(k){
        if (Math.round(e.d[k]) > 0) box.appendChild(make("i", e.d[k] >= 20 ? "hi" : "", os.fill(os.t("oc.d.add"), {dim:os.t("oc.dim." + k), n:num(e.d[k])})));
        if (e.r0 && !e.o.fix && e.r1[k] < e.r0[k]) box.appendChild(make("i", "ok", os.fill(os.t(e.r1[k] ? "oc.d.slow" : "oc.d.stop"), {dim:os.t("oc.dim." + k)})));
        if (e.r0 && e.r1[k] > e.r0[k]) box.appendChild(make("i", "hi", os.fill(os.t("oc.d.fast"), {dim:os.t("oc.dim." + k)})));
      });
      if (e.o.fix) box.appendChild(make("i", "ok", os.t("oc.st.up")));
      return box;
    }
    function alertLine(cls, a){
      var x = make("div", cls);
      x.style.setProperty("--sev", SEV[a.sev]);
      x.appendChild(make("b", "", a.sev));
      x.appendChild(document.createTextNode(L(a.text)));
      return x;
    }

    /* ----- a station's screen: everything done there, then the current question ----- */
    function drawPanel(g, onChoose){
      var t = thing(g, g.panelAt), term = t.style !== "phone", st = g.s.steps[g.st.phase];
      panel.className = "oc-panel" + (term ? "" : " phone");
      panel.querySelector("b").textContent = L(t.name);
      var po = panel.querySelector(".oc-po"), pa = panel.querySelector(".oc-pa");
      po.textContent = "";
      (g.outs[t.id] || []).forEach(function(e){
        if (e.k === "al") { po.appendChild(alertLine("al", e.a)); return; }
        po.appendChild(make("div", "cmd", (term ? "$ " : "> ") + L(e.o.label)));
        po.appendChild(make("div", "", L(e.o.say)));
        po.appendChild(chips(g, e));
      });
      if (!g.st.done) po.appendChild(make("div", "q", L(st.ask)));
      pa.textContent = "";
      if (!g.st.done) {
        var opts = E.options(g.s, g.st, t.id);
        opts.forEach(function(x){
          var b = make("button", "", (term ? "$ " : "") + L(x.o.label));   // the laptop reads like a shell
          b.type = "button";
          b.addEventListener("click", function(){ onChoose(x.i); });
          pa.appendChild(b);
        });
        if (!opts.length) pa.appendChild(make("p", "none", os.fill(os.t("rpg.nothing"), {where:where(g)})));
      }
      pa.hidden = g.st.done;
      panel.hidden = false;
      po.scrollTop = po.scrollHeight;
      var first = pa.querySelector("button");
      if (first) first.focus(); else panel.querySelector(".oc-x").focus();
    }
    function closePanel(){ panel.hidden = true; cv.focus(); }

    /* ----- the log: alerts (once answered), what you did, what came back ----- */
    function drawLog(g){
      bookList.textContent = "";
      g.st.events.forEach(function(e){
        if ((e.k === "sys" || e.k === "al") && !g.answered) return;
        var li = make("li", "k-" + e.k), body;
        li.appendChild(make("time", "", e.k === "say" ? "" : clockAt(g.s, e.t)));
        if (e.k === "al") body = alertLine("", e.a);
        else {
          body = make("div");
          if (e.k === "sys") body.textContent = os.fill(os.t(e.key), e.vars);
          if (e.k === "act") body.textContent = os.fill(os.t("oc.did"), {a:L(e.o.label)});
          if (e.k === "say") { body.textContent = L(e.o.say); body.appendChild(chips(g, e)); }
        }
        li.appendChild(body);
        bookList.appendChild(li);
      });
      if (!bookList.children.length) bookList.appendChild(make("li", "none", os.t("rpg.empty")));
    }
    function openBook(g){
      drawLog(g);
      book.hidden = false;
      bookList.scrollTop = bookList.scrollHeight;
      book.querySelector(".oc-x").focus();
    }
    function closeBook(){ book.hidden = true; cv.focus(); }

    /* ----- the ending card ----- */
    function scoreLine(g, sc){
      return dims(g.s).map(function(k){ return os.t("oc.sc." + k) + " " + sc[k]; }).join(" · ");
    }
    function drawEnd(g, on){
      var sc = g.score, card = endEl.querySelector(".oc-endcard");
      card.textContent = "";
      card.appendChild(make("div", "end", "END"));
      card.appendChild(make("div", "gr " + sc.grade, sc.grade));
      card.appendChild(make("h2", "", os.fill(os.t("end.title"), {g:sc.grade, name:os.t("end." + sc.grade)})));
      card.appendChild(make("p", "", os.fill(os.t("end." + sc.grade + ".t"), {m:g.st.mins})));
      card.appendChild(make("p", "was", os.fill(os.t("end.was"), {name:L(g.s.name), stars:stars(g.s.stars)})));
      card.appendChild(make("p", "st", os.fill(os.t("end.score"), {n:sc.total}) + " · " + scoreLine(g, sc)));
      var row = make("div", "row"), toPm = make("button", "oc-btn pri", os.t("end.pm")), next = make("button", "oc-btn", os.t("oc.next"));
      toPm.type = next.type = "button";
      toPm.addEventListener("click", on.pm);
      next.addEventListener("click", on.next);
      row.appendChild(toPm);
      row.appendChild(next);
      card.appendChild(row);
      endEl.hidden = false;
      toPm.focus();
    }

    /* ----- the postmortem ----- */
    function drawPm(g, on){
      var s = g.s, st = g.st, sc = g.score, a = E.analyse(s), acts = st.events.filter(function(e){ return e.k === "act"; });
      var wsum = dims(s).reduce(function(t, k){ return t + (s.weights[k] || 0); }, 0) || 1;
      function section(title){ pmEl.appendChild(make("h3", "", title)); }
      pmEl.textContent = "";

      var head = make("div", "oc-head"), txt = make("div");
      head.appendChild(make("div", "oc-grade " + sc.grade, sc.grade));
      txt.appendChild(make("h2", "", os.t("oc.pm") + " · " + L(s.name)));
      txt.appendChild(make("p", "", os.fill(os.t("end.title"), {g:sc.grade, name:os.t("end." + sc.grade)}) + " · " + os.fill(os.t("oc.pm.stars"), {stars:stars(s.stars)})));
      head.appendChild(txt);
      pmEl.appendChild(head);

      // The score: the total, then each dimension with its weight and what it measured.
      var box = make("div", "oc-score"), tot = make("div", "tot");
      tot.appendChild(make("b", "", String(sc.total)));
      tot.appendChild(make("small", "", os.t("oc.pm.total")));
      box.appendChild(tot);
      var rows = make("div", "rows");
      dims(s).forEach(function(k){
        var r = make("div", "row"), barO = make("span", "oc-sb"), barI = make("span");
        r.appendChild(make("span", "oc-sl", os.t("oc.sc." + k) + " " + Math.round(100 * (s.weights[k] || 0) / wsum) + "%"));
        barI.style.width = sc[k] + "%";
        barI.className = sc[k] >= 90 ? "g" : sc[k] >= 60 ? "y" : "r";
        barO.appendChild(barI);
        r.appendChild(barO);
        r.appendChild(make("b", "", String(sc[k])));
        var raw = k === "time" ? os.fill(os.t("oc.pm.mins"), {m:st.mins, par:a.par}) : os.fill(os.t("oc.pm.raw"), {n:num(st[k]), best:num(a.ref[k])});
        r.appendChild(make("small", "", raw));
        rows.appendChild(r);
      });
      box.appendChild(rows);
      pmEl.appendChild(box);
      if (sc.capped) pmEl.appendChild(make("p", "oc-cap", os.fill(os.t("oc.pm.capped"), {dim:os.t("oc.sc." + sc.capped)})));
      pmEl.appendChild(make("p", "oc-how", os.t("oc.pm.how")));

      section(os.t("oc.pm.costly"));
      var costs = E.costs(s, st).filter(function(c){ return !c.o.egg; }).slice(0, 3);
      if (costs.length) {
        var cl = make("ul", "oc-costs");
        costs.forEach(function(c){
          var li = make("li");
          li.appendChild(make("b", "", os.fill(os.t("oc.pm.pts"), {n:Math.round(c.total)})));
          li.appendChild(document.createTextNode(L(c.o.label)));
          li.appendChild(make("small", "", L(c.o.say)));
          cl.appendChild(li);
        });
        pmEl.appendChild(cl);
      } else pmEl.appendChild(make("p", "", os.t("oc.pm.none")));

      section(os.t("oc.pm.what"));
      var ol = make("ol");
      acts.forEach(function(e){
        var li = make("li");
        li.appendChild(make("time", "", clockAt(s, e.t)));
        li.appendChild(document.createTextNode(L(e.o.label)));
        ol.appendChild(li);
      });
      pmEl.appendChild(ol);
      acts.filter(function(e){ return e.o.egg; }).forEach(function(e){ pmEl.appendChild(make("p", "oc-egg", L(e.o.egg))); });

      section(os.t("oc.pm.cause"));
      pmEl.appendChild(make("p", "", L(s.cause)));

      section(os.fill(os.t("oc.pm.top"), {m:a.top.mins}));
      var path = make("ol");
      a.top.path.forEach(function(p){ path.appendChild(make("li", "", L(s.steps[p.phase].opts[p.i].label))); });
      pmEl.appendChild(path);

      section(os.t("oc.pm.todo"));
      var todo = make("ul");
      s.todo.forEach(function(t){ todo.appendChild(make("li", "", L(t))); });
      pmEl.appendChild(todo);

      section(os.t("oc.pm.lesson"));
      pmEl.appendChild(make("p", "oc-lesson", L(s.lesson)));
      pmEl.appendChild(make("p", "oc-credit", os.t("oc.credit")));

      var end = make("div", "oc-endrow"), next = make("button", "oc-btn pri", os.t("oc.next")), again = make("button", "oc-btn", os.t("oc.again"));
      next.type = again.type = "button";
      next.addEventListener("click", on.next);
      again.addEventListener("click", on.again);
      end.appendChild(next);
      end.appendChild(again);
      pmEl.appendChild(end);
      game.hidden = true; barEl.hidden = true; pmEl.hidden = false;
      el.scrollTop = 0;
    }

    sayEl.addEventListener("click", advance);
    panel.addEventListener("keydown", function(e){ if (e.key === "Escape") { e.stopPropagation(); closePanel(); } });
    panel.querySelector(".oc-x").addEventListener("click", closePanel);
    book.addEventListener("keydown", function(e){ if (e.key === "Escape" || e.key === "j" || e.key === "J") { e.stopPropagation(); closeBook(); } });
    book.querySelector(".oc-x").addEventListener("click", closeBook);

    return {
      L:L, talk:talk, advance:advance,
      busy: function(){ return !sayEl.hidden || !panel.hidden || !book.hidden; },
      // A fresh game: the map showing, every overlay closed, the loading note until `loaded` says otherwise.
      reset: function(){
        queue = []; clearInterval(typing); typing = null;
        [sayEl, panel, book, endEl, pmEl].forEach(function(x){ x.hidden = true; });
        game.hidden = false;
        goalEl.textContent = "";
        el.scrollTop = 0;
      },
      loading: function(state){
        loadEl.hidden = state === false;
        loadEl.textContent = os.t(state === "fail" ? "rpg.loadFail" : "rpg.loading");
      },
      bar:drawBar, goal:drawGoal, panel:drawPanel, closePanel:closePanel,
      panelOpen: function(){ return !panel.hidden; },
      openBook:openBook, closeBook:closeBook, drawLog:drawLog,
      bookOpen: function(){ return !book.hidden; },
      end:drawEnd, endOpen: function(){ return !endEl.hidden; },
      pm:drawPm, pmOpen: function(){ return !pmEl.hidden; },
      clearGoal: function(){ goalEl.textContent = ""; }
    };
  }

  OC.ui = {create:create};
})(typeof self !== "undefined" ? self : this);
