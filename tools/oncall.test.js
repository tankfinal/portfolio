// Tests for the 凌晨三點 game rules (apps/oncall/engine.js).   node --test tools/oncall.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const E = require("../apps/oncall/engine.js");

const T = (s) => ({ zh: s, en: s });
// A small scenario that uses every rule: a clue, a mitigation, a timer, a costly shortcut and a sound fix.
function sample(){
  return {
    id: "t", stars: 1, par: 10, clock: "03:00", name: T("t"), hook: T("t"), cause: T("t"), lesson: T("t"), todo: [],
    weights: { time: 0.3, users: 0.3, asset: 0.4 }, budget: { users: 50, asset: 50 },
    rate: { users: 2, asset: 1 },
    alerts: [{ sev: "P1", text: T("a") }],
    timers: [{ at: 6, rate: { users: 3 }, alert: { sev: "P2", text: T("late") } }],
    steps: {
      start: { ask: T("q1"), opts: [
        { min: 2, give: ["clue"], label: T("look"), say: T("x") },
        { min: 1, need: ["clue"], next: "fix", label: T("act"), say: T("x") },
        { min: 3, label: T("waste"), say: T("x") },
        { min: 1, at: "phone", rate: { asset: 0 }, label: T("contain"), say: T("x") }
      ] },
      fix: { ask: T("q2"), opts: [
        { min: 5, fix: true, label: T("sound"), say: T("x") },
        { min: 1, fix: true, asset: 60, label: T("shortcut"), say: T("x") }
      ] }
    }
  };
}
const zero = () => 0;

test("a new game shuffles the options and pages with the alerts", () => {
  const st = E.create(sample(), zero);
  assert.equal(st.phase, "start");
  assert.deepEqual(st.events.map((e) => e.k), ["sys", "al"]);
  assert.deepEqual(st.order.start.slice().sort(), [0, 1, 2, 3]);
});

test("an option needing a clue stays hidden until the clue is found", () => {
  const s = sample(), st = E.create(s, zero);
  assert.ok(!E.options(s, st).some((x) => x.i === 1));
  E.choose(s, st, 0);
  assert.ok(E.options(s, st).some((x) => x.i === 1));
  assert.ok(!E.options(s, st).some((x) => x.i === 0), "a used option is gone");
});

test("time passes, impact grows at the rate, and a mitigation stops it", () => {
  const s = sample(), st = E.create(s, zero);
  const d = E.choose(s, st, 2);                      // waste 3 min
  assert.deepEqual(d, { mins: 3, users: 6, asset: 3 });
  E.choose(s, st, 3);                                // contain: 1 more min, then asset stops
  assert.equal(st.asset, 4);
  E.choose(s, st, 0);
  assert.equal(st.asset, 4);
});

test("a timer fires once, and only worsens what is still at full rate", () => {
  const s = sample(), st = E.create(s, zero);
  E.choose(s, st, 2); E.choose(s, st, 0); E.choose(s, st, 1);   // 6 min: the timer fires at minute 6
  assert.equal(st.rate.users, 5);
  assert.equal(st.events.filter((e) => e.late).length, 1);
  const st2 = E.create(s, zero);
  E.choose(s, st2, 3);                               // contain assets first
  st2.rate.users = 1;                                // users already contained too
  E.choose(s, st2, 2); E.choose(s, st2, 0);
  assert.equal(st2.rate.users, 1, "a contained rate is left alone");
});

test("fixing ends the game and stops all growth", () => {
  const s = sample(), st = E.create(s, zero);
  E.choose(s, st, 0); E.choose(s, st, 1); E.choose(s, st, 0);
  assert.equal(st.done, true);
  assert.deepEqual(st.rate, { users: 0, asset: 0 });
});

test("the best trade-off scores 100 and a ruinous shortcut is capped at C", () => {
  const s = sample(), a = E.analyse(s);
  assert.equal(a.top.score.total, 100);
  assert.equal(a.top.score.grade, "S");
  const st = E.create(s, zero);
  E.choose(s, st, 0); E.choose(s, st, 1); E.choose(s, st, 1);   // look, act, shortcut
  const sc = E.score(s, st);
  assert.equal(sc.asset, 0);
  assert.equal(sc.capped, "asset");
  assert.equal(sc.grade, "C");
});

test("decision costs leave out the choices the best path makes too", () => {
  const s = sample(), st = E.create(s, zero);
  E.choose(s, st, 2); E.choose(s, st, 0); E.choose(s, st, 1); E.choose(s, st, 0);
  const c = E.costs(s, st);
  assert.equal(c[0].o.label.en, "waste");
});

test("validate catches broken content", () => {
  const s = sample();
  s.steps.start.opts[1].need = ["nowhere"];
  s.steps.fix.opts[0].at = "fridge";
  s.steps.start.opts[1].next = "nope";
  const out = E.validate({ id: "r", scenarios: [s] }, ["pc", "phone"]).join("\n");
  assert.match(out, /clue 'nowhere'/);
  assert.match(out, /station 'fridge'/);
  assert.match(out, /next 'nope'/);
});

test("the shipped content is valid", () => {
  const root = path.join(__dirname, "..", "apps", "oncall");
  const map = JSON.parse(fs.readFileSync(path.join(root, "maps", "home.json"), "utf8"));
  const stations = map.things.filter((t) => t.kind === "station").map((t) => t.id);
  fs.readdirSync(path.join(root, "roles")).filter((f) => f.endsWith(".json")).forEach((f) => {
    const role = JSON.parse(fs.readFileSync(path.join(root, "roles", f), "utf8"));
    assert.deepEqual(E.validate(role, stations), []);
  });
});
