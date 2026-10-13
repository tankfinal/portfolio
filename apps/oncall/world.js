// 凌晨三點 (3 A.M.): the world on the canvas. Draws a map (apps/oncall/maps/*.json) with the Kenney sheets and
// the pixel art in art.json, walks the player around it (keyboard, or click to walk / click a thing to use it),
// lights it for night, and plays the going-to-bed ending. It knows nothing about scenarios: things are used
// through cfg.onUse, and the controller tells it what to show with set() (the ringing thing, things switched
// on, whether the game is still waiting to be answered).
(function(root){
  var OC = root.OC = root.OC || {};
  var T = 16, NIGHT = 1600, DAWN = 1400;
  var DIRS = {up:[0, -1], down:[0, 1], left:[-1, 0], right:[1, 0]};
  var COLS = {left:23, down:24, up:25, right:26};   // RPG Urban: one column per facing, three rows of walking
  var KEYS = {ArrowUp:"up", ArrowDown:"down", ArrowLeft:"left", ArrowRight:"right", w:"up", s:"down", a:"left", d:"right", W:"up", S:"down", A:"left", D:"right"};

  // cfg: {map, art, img:{in, ur}, char, still (a matchMedia), busy(), onUse(thing), onAdvance(), onBook(), onSlept()}
  function create(cv, cfg){
    var cx = cv.getContext("2d"), map = cfg.map, MW = map.w, MH = map.h, art = cfg.art;
    var stat = null, dark = null, sprites = {}, raf = 0, last = 0, ending = 0, slept = false;
    var view = {ringing:null, on:{}};
    var p = {x:map.start[0], y:map.start[1], tx:map.start[0], ty:map.start[1], dir:map.start[2] || "down", t:0, moving:false, walk:0, path:[], then:null};
    var held = [];
    cv.width = MW * T; cv.height = MH * T;

    function still(){ return cfg.still.matches; }
    function blocked(x, y){
      if (x < 0 || y < 0 || x >= MW || y >= MH || map.tiles[y].charAt(x) === "#") return true;
      return map.props.some(function(q){ return q.block && q.x === x && (q.y === y || (q.h === 2 && q.y + 1 === y)); });
    }
    function thingAt(x, y){
      return map.things.filter(function(t){ return t.tiles.some(function(c){ return c[0] === x && c[1] === y; }); })[0];
    }
    // Breadth-first search over the tile grid; the tiles to walk, excluding where you stand.
    function route(fx, fy, tx, ty){
      if (blocked(tx, ty)) return null;
      var prev = {}, seen = {}, q = [[fx, fy]];
      seen[fx + "," + fy] = 1;
      while (q.length) {
        var c = q.shift();
        if (c[0] === tx && c[1] === ty) {
          var out = [], k = tx + "," + ty;
          while (k !== fx + "," + fy) { out.unshift(k.split(",").map(Number)); k = prev[k]; }
          return out;
        }
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function(d){
          var nx = c[0] + d[0], ny = c[1] + d[1], nk = nx + "," + ny;
          if (!seen[nk] && !blocked(nx, ny)) { seen[nk] = 1; prev[nk] = c[0] + "," + c[1]; q.push([nx, ny]); }
        });
      }
      return null;
    }
    function dirTo(a, b){ return b[0] > a[0] ? "right" : b[0] < a[0] ? "left" : b[1] > a[1] ? "down" : "up"; }
    function stepTo(x, y){ p.dir = dirTo([p.x, p.y], [x, y]); p.tx = x; p.ty = y; p.moving = true; p.t = 0; }
    function arrive(){
      if (p.path.length || !p.then) return;
      var f = p.then;
      p.then = null;
      f();
    }
    function walkTo(x, y, then){
      var r = route(p.tx, p.ty, x, y);
      if (!r) return false;
      p.path = r;
      p.then = then || null;
      if (still() && r.length) {   // reduced motion: arrive at once
        var lastStep = r[r.length - 1];
        p.dir = dirTo(r.length > 1 ? r[r.length - 2] : [p.tx, p.ty], lastStep);
        p.x = p.tx = lastStep[0]; p.y = p.ty = lastStep[1]; p.path = []; p.moving = false;
        arrive();
      } else if (!r.length && !p.moving) arrive();
      return true;
    }
    // Walk to the nearest spot a thing can be used from, face it, use it.
    function useThing(t){
      var best = null;
      t.spots.forEach(function(s){
        var r = s[0] === p.tx && s[1] === p.ty ? [] : route(p.tx, p.ty, s[0], s[1]);
        if (r && (!best || r.length < best.r.length)) best = {s:s, r:r};
      });
      if (best) walkTo(best.s[0], best.s[1], function(){ p.dir = best.s[2]; cfg.onUse(t); });
    }
    function facing(){
      var d = DIRS[p.dir];
      return thingAt(p.x + d[0], p.y + d[1]);
    }

    /* ----- drawing ----- */
    function sprite(name, alt){
      var key = name + (alt ? JSON.stringify(alt) : "");
      if (sprites[key]) return sprites[key];
      var rows = art.sprites[name], c = document.createElement("canvas");
      c.width = rows[0].length; c.height = rows.length;
      var s = c.getContext("2d");
      rows.forEach(function(row, y){
        for (var x = 0; x < row.length; x++) {
          var ch = row.charAt(x);
          if (ch === ".") continue;
          s.fillStyle = (alt && alt[ch]) || art.pal[ch];
          s.fillRect(x, y, 1, 1);
        }
      });
      return (sprites[key] = c);
    }
    function buildStatic(){
      stat = document.createElement("canvas");
      stat.width = MW * T; stat.height = MH * T;
      var s = stat.getContext("2d");
      s.imageSmoothingEnabled = false;
      for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) {
        if (map.tiles[y].charAt(x) === "#") drawWall(s, x, y); else drawFloor(s, x, y);
      }
      (map.rugs || []).forEach(function(r){ drawRug(s, r[0], r[1], r[2], r[3]); });
      map.props.forEach(function(q){
        var y = q.y * T + (q.dy || 0);
        if (q.sheet === "in") s.drawImage(cfg.img["in"], q.c * 17, q.r * 17, 16, 16, q.x * T, y, 16, 16);   // 16 px tiles, 1 px apart
        else if (q.art) s.drawImage(sprite(q.art), q.x * T, y);
      });
    }
    function drawFloor(s, x, y){
      var X = x * T, Y = y * T;
      s.fillStyle = "#B88A5C"; s.fillRect(X, Y, T, T);
      s.fillStyle = "#A67A4F";
      for (var i = 0; i < 4; i++) s.fillRect(X, Y + i * 4 + 3, T, 1);
      s.fillRect(X + ((x * 7 + y * 5) % 12) + 2, Y, 1, 3);
      s.fillRect(X + ((x * 3 + y * 11) % 12) + 2, Y + 8, 1, 3);
    }
    // The pack has no rugs (its bordered pieces are tables), so they are drawn: blue-grey with a border.
    function drawRug(s, x, y, w, h){
      var X = x * T + 2, Y = y * T + 3, W = w * T - 4, H = h * T - 6;
      s.fillStyle = "#3D4C69"; s.fillRect(X, Y, W, H);
      s.fillStyle = "#6B7EA4"; s.fillRect(X + 2, Y + 2, W - 4, 1); s.fillRect(X + 2, Y + H - 3, W - 4, 1);
      s.fillRect(X + 2, Y + 2, 1, H - 4); s.fillRect(X + W - 3, Y + 2, 1, H - 4);
      s.fillStyle = "#56678C";
      for (var i = X + 6; i < X + W - 6; i += 4) s.fillRect(i, Y + Math.floor(H / 2), 2, 1);
      s.fillStyle = "#C9C1AE";
      for (var j = X + 1; j < X + W - 1; j += 2) { s.fillRect(j, Y - 1, 1, 1); s.fillRect(j, Y + H, 1, 1); }
    }
    function drawWall(s, x, y){
      var X = x * T, Y = y * T, face = y + 1 < MH && map.tiles[y + 1].charAt(x) !== "#" && (y === 0 || map.tiles[y - 1].charAt(x) === "#");
      if (face) {   // the wall face you see above the floor
        s.fillStyle = "#E8DBBE"; s.fillRect(X, Y, T, T);
        s.fillStyle = "#D6C6A2"; s.fillRect(X, Y + 12, T, 1);
        s.fillStyle = "#8A6A48"; s.fillRect(X, Y + 13, T, 3);
      } else {
        s.fillStyle = "#CDB98F"; s.fillRect(X, Y, T, T);
        s.fillStyle = "#7A5C3E";
        if (y === MH - 1 || (y > 1 && map.tiles[y - 1].charAt(x) !== "#")) s.fillRect(X, Y, T, 1);
        if (x > 0 && map.tiles[y].charAt(x - 1) !== "#") s.fillRect(X, Y, 1, T);
        if (x < MW - 1 && map.tiles[y].charAt(x + 1) !== "#") s.fillRect(X + T - 1, Y, 1, T);
      }
    }

    function frame(ts){
      var dt = Math.min(50, ts - (last || ts));
      last = ts;
      update(dt);
      if (!raf) return;   // stopped from inside update (walking into bed ends the game)
      draw(ts);
      if (ending && !slept && ts - ending >= NIGHT + DAWN) { slept = true; cfg.onSlept(); }
      if (raf) raf = requestAnimationFrame(frame);
    }
    function update(dt){
      if (p.moving) {
        p.t += dt / 150;
        if (p.t >= 1) {
          p.x = p.tx; p.y = p.ty; p.moving = false; p.t = 0; p.walk++;
          if (!p.path.length) arrive();
        }
      }
      if (!p.moving && !cfg.busy() && !ending) {
        if (p.path.length) { var n = p.path.shift(); stepTo(n[0], n[1]); }
        else if (held.length) {
          var d = held[held.length - 1], v = DIRS[d];
          p.dir = d;
          if (!blocked(p.x + v[0], p.y + v[1])) stepTo(p.x + v[0], p.y + v[1]);
        }
      }
    }

    function draw(ts){
      var pulse = (Math.sin(ts / 180) + 1) / 2, e = ending ? ts - ending : -1;
      var night = e < 0 ? 0 : Math.min(1, e / NIGHT), dawn = e < NIGHT ? 0 : Math.min(1, (e - NIGHT) / DAWN);
      cx.imageSmoothingEnabled = false;
      cx.drawImage(stat, 0, 0);

      // Things with a live look: a ringing one shakes and flashes, a switched-on one lights, a blinking one blinks.
      map.things.forEach(function(t){
        var sp = t.sprite;
        if (!sp) return;
        var ring = view.ringing === t.id, alt = null, dx = 0;
        if (ring && sp.ring) {
          alt = {};
          Object.keys(sp.ring).forEach(function(k){ alt[k] = sp.ring[k][pulse > .5 ? 0 : 1]; });
          if (!still() && Math.floor(ts / 90) % 2) dx = 1;
        } else if (view.on[t.id] && !ending && sp.on) alt = sp.on;
        else if (sp.blink && Math.floor(ts / 400) % 2) alt = sp.blink;
        cx.drawImage(sprite(sp.art, alt), sp.x + dx, sp.y);
        (t.deco || []).forEach(function(dc){ cx.drawImage(sprite(dc.art), dc.x, dc.y); });
      });

      var fx = (p.x + (p.tx - p.x) * p.t) * T, fy = (p.y + (p.ty - p.y) * p.t) * T;
      if (ending) {
        // Tucked in: the head on the pillow, the blanket drawn back over the body.
        var tk = bed().tuck;
        cx.drawImage(cfg.img.ur, COLS.down * 16, cfg.char * 3 * 16, 16, 9, tk.headX, tk.headY, 16, 9);
        cx.drawImage(sprite(tk.art), 0, tk.sy, 16, tk.sh, tk.x, tk.y, 16, tk.sh);
      } else {
        var row = p.moving ? 1 + (p.walk % 2) : 0;
        cx.drawImage(cfg.img.ur, COLS[p.dir] * 16, (cfg.char * 3 + row) * 16, 16, 16, Math.round(fx), Math.round(fy) - 4, 16, 16);
      }

      // Night: darken everything, then cut out light. Going to sleep pushes the dark to black; dawn lifts it.
      if (!dark) { dark = document.createElement("canvas"); dark.width = MW * T; dark.height = MH * T; }
      var d = dark.getContext("2d");
      d.globalCompositeOperation = "source-over";
      d.clearRect(0, 0, dark.width, dark.height);
      d.fillStyle = "rgba(8,10,32," + (.66 + night * .32 - dawn * .9) + ")";
      d.fillRect(0, 0, dark.width, dark.height);
      d.globalCompositeOperation = "destination-out";
      if (!ending) light(d, fx + 8, fy + 4, 30, .85);
      (map.lights || []).forEach(function(l){ light(d, l.x, l.y, l.r + (l.dawn ? dawn * 40 : 0), l.a * (1 - night) + (l.dawn ? dawn * .6 : 0)); });
      if (!ending) map.things.forEach(function(t){
        var l = t.light;
        if (!l || (l.whenOn && !view.on[t.id])) return;
        var ring = view.ringing === t.id;
        light(d, l.x, l.y, ring && l.ringR ? l.ringR - 8 + pulse * 8 : l.r, l.a);
      });
      cx.drawImage(dark, 0, 0);
      if (!ending) map.things.forEach(function(t){
        var g = t.glow;
        if (!g) return;
        if (view.ringing === t.id && g.ring) glow(g.x, g.y, g.r, "rgba(" + g.ring + "," + (.18 + pulse * .25) + ")");
        else if (view.on[t.id] && g.on) glow(g.x, g.y, g.r, "rgba(" + g.on + ",.18)");
      });
      if (dawn) (map.lights || []).filter(function(l){ return l.dawn; }).forEach(function(l){ glow(l.x, l.y + 16, 70 * dawn + 10, "rgba(255,200,120," + (.35 * dawn) + ")"); });
      if (night && !dawn && !still()) zees(e);

      // A bouncing marker over whatever you can use from here.
      var t = !cfg.busy() && !p.moving && !ending && facing();
      if (t) {
        var top = t.tiles.reduce(function(a, c){ return c[1] < a[1] ? c : a; });
        var bx = top[0] * T + 8, by = top[1] * T - 9 + (still() ? 0 : Math.round(Math.sin(ts / 150) * 1.5));
        cx.fillStyle = "#FFFFFF";
        cx.fillRect(bx - 3, by, 7, 1); cx.fillRect(bx - 2, by + 1, 5, 1); cx.fillRect(bx - 1, by + 2, 3, 1); cx.fillRect(bx, by + 3, 1, 1);
      }
    }
    function bed(){ return map.things.filter(function(t){ return t.kind === "bed"; })[0]; }
    // Three z's drifting up from the pillow while the lights go out.
    function zees(e){
      var tk = bed().tuck;
      cx.fillStyle = "#F5EEDC";
      for (var i = 0; i < 3; i++) {
        var k = ((e / 900) + i / 3) % 1, x = tk.headX + 12 + k * 14, y = tk.headY - 1 - k * 18, s = i === 1 ? 2 : 1;
        cx.globalAlpha = 1 - k;
        cx.fillRect(x, y, 3 * s, s); cx.fillRect(x + s, y + s, s, s); cx.fillRect(x, y + 2 * s, 3 * s, s);
      }
      cx.globalAlpha = 1;
    }
    function light(d, x, y, r, a){
      var gr = d.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(0,0,0," + Math.max(0, Math.min(1, a)) + ")");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = gr;
      d.fillRect(x - r, y - r, r * 2, r * 2);
    }
    function glow(x, y, r, color){
      var gr = cx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, color);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      cx.globalCompositeOperation = "lighter";
      cx.fillStyle = gr;
      cx.fillRect(x - r, y - r, r * 2, r * 2);
      cx.globalCompositeOperation = "source-over";
    }

    /* ----- input ----- */
    function onKey(e){
      if (!raf) return;
      if (e.key === "j" || e.key === "J") { e.preventDefault(); if (!cfg.busy()) cfg.onBook(); return; }
      var d = KEYS[e.key];
      if (d) {
        e.preventDefault();
        if (cfg.busy() || ending) return;
        p.path = []; p.then = null;
        if (held.indexOf(d) < 0) held.push(d);
        // Step right away, so a quick tap released before the next frame still moves (or turns you).
        if (!p.moving && !e.repeat) {
          var v = DIRS[d];
          p.dir = d;
          if (!blocked(p.x + v[0], p.y + v[1])) stepTo(p.x + v[0], p.y + v[1]);
        }
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (cfg.onAdvance()) return;
        var t = !cfg.busy() && !ending && !p.moving && facing();
        if (t) cfg.onUse(t);
      }
    }
    function onKeyUp(e){ var d = KEYS[e.key]; if (d) held = held.filter(function(x){ return x !== d; }); }
    function onBlur(){ held = []; }
    function onPointer(e){
      if (!raf || ending) return;
      cv.focus();
      if (cfg.onAdvance()) return;
      if (cfg.busy()) return;
      var rc = cv.getBoundingClientRect();
      var x = Math.floor((e.clientX - rc.left) / rc.width * MW), y = Math.floor((e.clientY - rc.top) / rc.height * MH);
      var t = thingAt(x, y);
      if (t) useThing(t); else walkTo(x, y);
    }
    cv.addEventListener("keydown", onKey);
    cv.addEventListener("keyup", onKeyUp);
    cv.addEventListener("blur", onBlur);
    cv.addEventListener("pointerdown", onPointer);

    return {
      start: function(){
        if (!stat) buildStatic();
        if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
        cv.focus();
      },
      stop: function(){ cancelAnimationFrame(raf); raf = 0; },
      destroy: function(){
        cancelAnimationFrame(raf); raf = 0;
        cv.removeEventListener("keydown", onKey);
        cv.removeEventListener("keyup", onKeyUp);
        cv.removeEventListener("blur", onBlur);
        cv.removeEventListener("pointerdown", onPointer);
      },
      set: function(v){ Object.keys(v).forEach(function(k){ view[k] = v[k]; }); },
      // Into bed: lights out, a few z's, then morning; cfg.onSlept fires when the sun is up.
      sleep: function(){
        ending = performance.now() - (still() ? NIGHT + DAWN : 0);
        p.moving = false; p.path = []; p.then = null; held = [];
      }
    };
  }

  OC.world = {create:create};
})(typeof self !== "undefined" ? self : this);
