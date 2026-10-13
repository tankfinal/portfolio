#!/usr/bin/env node
// Checks the 凌晨三點 content: every role's scenarios against the game rules (apps/oncall/engine.js) and its
// map, then prints, for each scenario and difficulty, the options on offer, par and fastest fix, the top-scoring
// way through and how the endings spread.
// Run before committing content:  node tools/check-oncall.js        (add -v to list the top path)
"use strict";
const fs = require("fs");
const path = require("path");
const E = require("../apps/oncall/engine.js");

const ROOT = path.join(__dirname, "..", "apps", "oncall");
const verbose = process.argv.includes("-v");
const LV = { 1: "普通", 2: "困難", 3: "地獄" };
const problems = [];

function load(p){ return JSON.parse(fs.readFileSync(p, "utf8")); }

function checkMap(map){
  const bad = (msg) => problems.push("map " + map.id + ": " + msg);
  if (map.tiles.length !== map.h) bad("has " + map.tiles.length + " rows, expected " + map.h);
  map.tiles.forEach((row, y) => { if (row.length !== map.w) bad("row " + y + " is " + row.length + " wide, expected " + map.w); });
  const blocked = (x, y) => x < 0 || y < 0 || x >= map.w || y >= map.h || map.tiles[y][x] === "#" ||
    map.props.some((p) => p.block && p.x === x && (p.y === y || (p.h === 2 && p.y + 1 === y)));
  if (blocked(map.start[0], map.start[1])) bad("start is on a blocked tile");
  const ids = new Set();
  map.things.forEach((t) => {
    if (ids.has(t.id)) bad("duplicate thing " + t.id);
    ids.add(t.id);
    if (!["station", "bed", "flavor"].includes(t.kind)) bad(t.id + " has unknown kind " + t.kind);
    t.spots.forEach((s) => { if (blocked(s[0], s[1])) bad(t.id + " spot " + s.slice(0, 2) + " is blocked"); });
  });
  if (map.things.filter((t) => t.kind === "station" && t.wake).length !== 1) bad("needs exactly one station with wake: true");
  if (map.things.filter((t) => t.kind === "bed").length !== 1) bad("needs exactly one bed");
}

const maps = {};
fs.readdirSync(path.join(ROOT, "maps")).filter((f) => f.endsWith(".json")).forEach((f) => {
  const m = load(path.join(ROOT, "maps", f));
  maps[m.id] = m;
  checkMap(m);
});

fs.readdirSync(path.join(ROOT, "roles")).filter((f) => f.endsWith(".json")).forEach((f) => {
  const role = load(path.join(ROOT, "roles", f));
  const map = maps[role.map];
  if (!map) { problems.push("role " + role.id + ": map " + role.map + " not found"); return; }
  const stations = map.things.filter((t) => t.kind === "station").map((t) => t.id);
  E.validate(role, stations).forEach((p) => problems.push(p));
  console.log("\n" + role.id + " (" + role.name.en + "), map " + map.id + ", " + role.scenarios.length + " scenarios");
  role.scenarios.forEach((s) => {
    E.LEVELS.forEach((lv) => {
      let a;
      try { a = E.analyse(s, lv); } catch (e) { problems.push(role.id + "/" + s.id + ": " + e.message); return; }
      if (!a.paths.length) return;
      const grades = { S: 0, A: 0, B: 0, C: 0 };
      a.paths.forEach((p) => grades[p.score.grade]++);
      const totals = a.paths.map((p) => p.score.total).sort((x, y) => x - y);
      const opts = Object.keys(s.steps).reduce((n, k) => n + s.steps[k].opts.filter((o) => (o.lv || 1) <= lv).length, 0);
      console.log("  " + (lv === 1 ? s.id : "").padEnd(9) + LV[lv] + " " + String(opts).padStart(2) + " options · par " + String(a.par).padStart(3) +
        " min (fastest " + a.fastest + ") · top " + a.top.score.total + " (" + a.top.score.grade + ") in " + a.top.mins + " min · " +
        a.paths.length + " paths · S" + grades.S + " A" + grades.A + " B" + grades.B + " C" + grades.C + " · totals " + totals[0] + "–" + totals[totals.length - 1]);
      if (verbose) {
        const sc = a.top.score;
        console.log("      top: time " + sc.time + " users " + sc.users + " asset " + sc.asset + "  (" + a.top.mins + " min, users " + a.top.users + ", asset " + a.top.asset + "; best users " + a.best.users + ", asset " + a.best.asset + ")");
        a.top.path.forEach((p) => console.log("      → " + s.steps[p.phase].opts[p.i].label.zh));
      }
    });
  });
});

if (problems.length) {
  console.log("\n" + problems.length + " problem(s):");
  problems.forEach((p) => console.log("  ✗ " + p));
  process.exit(1);
}
console.log("\nOK");
