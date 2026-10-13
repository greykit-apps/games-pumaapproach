#!/usr/bin/env node
/*
 * sim-check.js -- runs the engine block out of index.html under node, with
 * no browser: the separation rule, landings, exits, fuel, storms, the pay
 * table, and that a seed plus a command log replays the same shift. Then a
 * smoke run of every facility and shift with a clumsy robot controller, to
 * see that nothing throws and traffic keeps coming.
 *
 *   node tools/sim-check.js              (from the repo root, or anywhere)
 *   node tools/sim-check.js --engine path/to/block.js
 */
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const at = argv.indexOf("--engine");
const src = at >= 0 ? fs.readFileSync(argv[at + 1], "utf8") : fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = src.match(/\/\* @engine-begin[\s\S]*?@engine-end \*\//);
if (!m) { console.log("FAIL no @engine block found"); process.exit(1); }
const E = new Function(m[0] + "\nreturn Engine;")();
const { SECTORS, SHIFTS, DIRS, TPM, VOR_D, IAF_D } = E;

let failed = 0, passed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log("ok   " + name); }
  else { failed++; console.log("FAIL " + name + (detail ? ": " + detail : "")); }
}
/* a shift with no traffic of its own, so a test can place planes by hand */
function quiet(sector = 0, shift = 0) {
  const S = E.newShift({ sector, shift, rank: 3, seed: 7 });
  S.next = 1e9; S.stormAt = -1; S.cap = 0; S.end = 1e9;
  return S;
}
function plane(S, o) {
  const p = Object.assign({
    id: "A", al: "DL", num: 100, cls: "jet", kind: "tra", from: "CHI", to: "MIA", toAp: null, landAp: null, apIdx: null,
    x: 10, y: 10, px: 10, py: 10, h: 2, alt: 5, th: null, talt: null, tdir: 0, mode: "fly", holdDir: 1, nav: null, pat: 0,
    period: 2, phase: 0, posted: 0, enter: 0, fuel: 60 * TPM, emergency: false, budget: 1e9, delay: 0, cmds: 0, conf: -99,
  }, o);
  S.planes.push(p);
  return p;
}
function run(S, ticks) { const ev = []; for (let i = 0; i < ticks; i++) ev.push(...E.tick(S)); return ev; }
const lamps = ev => ev.filter(e => e.type === "alarm").map(e => e.lamp);

/* ---- separation ---- */
{
  let S = quiet(); plane(S, { id: "A", x: 10, y: 10, h: 2, period: 1e6 }); plane(S, { id: "B", x: 12, y: 10, h: 6, period: 1e6 });
  run(S, 1); check("conflict: 2 miles apart, same altitude", S.conflictTicks === 1);
  S = quiet(); plane(S, { id: "A", x: 10, y: 10, period: 1e6 }); plane(S, { id: "B", x: 13, y: 10, period: 1e6 });
  run(S, 1); check("no conflict: 3 miles apart, same altitude", S.conflictTicks === 0);
  S = quiet(); plane(S, { id: "A", x: 10, y: 10, period: 1e6, alt: 4 }); plane(S, { id: "B", x: 12, y: 10, period: 1e6, alt: 5 });
  run(S, 1); check("no conflict: 2 miles apart, 1,000 ft apart", S.conflictTicks === 0);
  S = quiet(); plane(S, { id: "A", x: 10, y: 10, period: 1e6, alt: 4 }); plane(S, { id: "B", x: 11, y: 10, period: 1e6, alt: 5 });
  run(S, 1); check("conflict: next door needs 2,000 ft", S.conflictTicks === 1);
  S = quiet(); plane(S, { id: "A", x: 10, y: 10, period: 1e6, alt: 3 }); plane(S, { id: "B", x: 11, y: 11, period: 1e6, alt: 5 });
  run(S, 1); check("no conflict: next door, 2,000 ft apart", S.conflictTicks === 0);
  S = quiet(); plane(S, { id: "A", x: 10, y: 10, h: 2, period: 1 }); plane(S, { id: "B", x: 12, y: 10, h: 6, period: 1 });
  const ev = run(S, 1); check("mid-air: same dot, same altitude", lamps(ev).includes("MID-AIR") && S.planes.length === 0 && S.done.filter(d => d.outcome === "crash").length === 2);
}

/* ---- movement and turns ---- */
{
  const S = quiet(); const p = plane(S, { x: 10, y: 10, h: 2, period: 2 });
  run(S, 2); check("a jet moves one dot every two ticks", p.x === 11 && p.y === 10 && p.px === 10);
  E.command(S, { id: "A", op: "vector", h: 6, alt: 3 });
  run(S, 2); check("a 180 turns 45 degrees a dot, to the right by default", p.h === 3 && p.alt === 4);
  run(S, 6); check("...and arrives on heading, descending 1,000 ft a dot", p.h === 6 && p.alt === 3);
  check("the command was logged", S.log.length === 1 && S.log[0].c.op === "vector");
  const S2 = quiet(); const q = plane(S2, { x: 10, y: 10, h: 2, period: 2 });
  E.command(S2, { id: "A", op: "vector", h: 6, alt: 5, dir: -1 });
  run(S2, 2); check("a 180 to the left when asked", q.h === 1);
}

/* ---- the pilot takes a moment: a command takes hold at the first dot
   ACK_S seconds after it was sent, not before ---- */
{
  let S = quiet(); let p = plane(S, { x: 10, y: 10, h: 2, period: 2 });
  run(S, 2);                                         /* just passed a dot; the next is two ticks off */
  E.command(S, { id: "A", op: "vector", h: 4, alt: 5, at: S.t });
  check("a command waits as p.next until it is taken in", p.next && p.th === null);
  run(S, 2);
  check("sent right after a dot: it turns at the next one", p.h === 3 && !p.next, `h${p.h}`);
  S = quiet(); p = plane(S, { x: 10, y: 10, h: 2, period: 2 });
  run(S, 3);                                         /* half way; the next dot one tick off */
  E.command(S, { id: "A", op: "vector", h: 4, alt: 5, at: S.t + 0.9 });
  run(S, 1);
  check(`sent ${(0.1 * 7.5).toFixed(2)} s before a dot: it flies through that one`, p.h === 2 && p.next, `h${p.h}`);
  run(S, 2);
  check("...and turns at the one after", p.h === 3 && !p.next, `h${p.h}`);
  E.command(S, { id: "A", op: "vector", h: 2, alt: 3, at: S.t });
  E.command(S, { id: "A", op: "vector", h: 6, alt: 4, at: S.t + 0.2 });
  run(S, 2);
  check("a second command before the first is taken in replaces it", p.talt === 4 && p.th === 6, `th${p.th} talt${p.talt}`);
  S = quiet(); p = plane(S, { kind: "dep", to: "MIA", x: 21, y: 13, h: 2, alt: 0, mode: "ground", apIdx: 0 });
  E.command(S, { id: "A", op: "vector", h: 4, alt: 4, at: S.t });
  run(S, 1);
  check("a departure rolls on the first tick after it has taken in its clearance", p.mode === "fly" && p.talt === 4);
  run(S, 2);
  check("its first dot is the climb-out: down the runway to 1,000 ft, no turn", p.x === 22 && p.y === 13 && p.h === 2 && p.alt === 1, `${p.x},${p.y} h${p.h} a${p.alt}`);
  run(S, 2);
  check("...then it turns and climbs as cleared", p.h === 3 && p.alt === 2, `h${p.h} a${p.alt}`);
}

/* ---- landing ---- */
{
  const sec = SECTORS[0], ap = sec.airports[0], vor = E.vorOf(ap), iaf = E.iafOf(ap);
  check("Atlanta's VOR is 5 west of the runway", vor.x === ap.x - VOR_D && vor.y === ap.y && iaf.x === ap.x - VOR_D - IAF_D);
  let S = quiet(); let p = plane(S, { kind: "arr", to: "ATL", toAp: 0, x: vor.x, y: vor.y, h: ap.rwy, alt: 5, period: 2 });
  E.command(S, { id: "A", op: "land", ap: 0 });
  let ev = run(S, 2 * (VOR_D + 1) + 1);
  check("at the VOR at 5,000 and cleared: lands at the field", S.done[0] && S.done[0].outcome === "landed", JSON.stringify(S.done[0]) + " " + JSON.stringify(p));
  S = quiet(); p = plane(S, { kind: "arr", to: "ATL", toAp: 0, x: vor.x - 1, y: vor.y, h: ap.rwy, alt: 5, period: 2 });
  E.command(S, { id: "A", op: "land", ap: 0 });
  ev = run(S, 2 * (VOR_D + 2) + 1);
  check("a dot before the VOR it still lands (goes to the VOR first)", S.done[0] && S.done[0].outcome === "landed", JSON.stringify(S.done[0]));
  S = quiet(); p = plane(S, { kind: "arr", to: "ATL", toAp: 0, x: vor.x, y: vor.y, h: ap.rwy, alt: 2, period: 2 });
  E.command(S, { id: "A", op: "land", ap: 0 });
  run(S, 2 * (VOR_D + 1) + 1);
  check("low at the VOR: reaches the ground early, rolls on to the field, lands", S.done[0] && S.done[0].outcome === "landed", JSON.stringify(S.done[0]));
  S = quiet(); p = plane(S, { kind: "arr", to: "ATL", toAp: 0, x: ap.x - 2, y: ap.y, h: ap.rwy, alt: 5, period: 2 });
  E.command(S, { id: "A", op: "vector", h: ap.rwy, alt: 0 });
  ev = run(S, 20);
  check("vectored to the ground with no runway ahead: a crash", lamps(ev).includes("CRASH") && S.done[0].outcome === "crash");
  /* the holding pattern: eight dots round, back at the VOR on the runway heading */
  S = quiet(); p = plane(S, { kind: "arr", to: "ATL", toAp: 0, x: iaf.x - 4, y: iaf.y - 2, h: 2, alt: 5, period: 2, nav: "iaf" });
  let hits = 0;
  for (let i = 0; i < 80; i++) { E.tick(S); if (p.x === vor.x && p.y === vor.y && p.h === ap.rwy && p.nav === "pattern") hits++; }
  check("an arrival flies to the VOR by itself and holds, passing the VOR on the runway heading", p.mode === "hold" && hits >= 2, `mode ${p.mode} hits ${hits} at ${p.x},${p.y} h${p.h} nav ${p.nav}`);
  E.command(S, { id: "A", op: "land", ap: 0 });
  run(S, 60);
  check("cleared to land out of the hold: lands", S.done[0] && S.done[0].outcome === "landed", JSON.stringify(S.done[0]) + " " + p.nav);
  /* the wrong airport */
  const was = SECTORS[3], iad = was.airports[0], dca = was.airports[1], v0 = E.vorOf(iad);
  S = quiet(3); p = plane(S, { kind: "arr", to: "DCA", toAp: 1, x: v0.x, y: v0.y, h: iad.rwy, alt: 5, period: 2 });
  E.command(S, { id: "A", op: "land", ap: 0 });
  ev = run(S, 2 * (VOR_D + 1) + 1);
  check("landing at the wrong airport is a bad exit under the AIRPORT lamp", lamps(ev).includes("AIRPORT") && S.done[0].outcome === "badexit");
  void dca;
}

/* ---- exits ---- */
{
  const sec = SECTORS[0], fix = sec.fixes.find(f => f.n === "MIA");
  let S = quiet(); plane(S, { kind: "tra", to: "MIA", x: fix.x, y: fix.y - 1, h: 4, alt: 4, period: 2 });
  let ev = run(S, 2);
  check("out through the right fix at 4,000: a completion", S.done[0] && S.done[0].outcome === "exited", JSON.stringify(S.done));
  S = quiet(); plane(S, { kind: "tra", to: "MIA", x: fix.x, y: fix.y - 1, h: 4, alt: 3, period: 2 });
  ev = run(S, 2);
  check("out through the right fix at 3,000: EXIT ALT", lamps(ev).includes("EXIT ALT") && S.done[0].outcome === "badexit");
  S = quiet(); plane(S, { kind: "tra", to: "CHI", x: fix.x, y: fix.y - 1, h: 4, alt: 4, period: 2 });
  ev = run(S, 2);
  check("out through the wrong fix: EXIT FIX", lamps(ev).includes("EXIT FIX") && S.done[0].outcome === "badexit");
  S = quiet(); plane(S, { kind: "tra", to: "MIA", x: 20, y: 1, h: 0, alt: 4, period: 2 });
  ev = run(S, 4);
  check("off the edge between fixes: EXIT FIX", lamps(ev).includes("EXIT FIX") && S.done[0].outcome === "badexit", JSON.stringify(S.done));
  S = quiet(); plane(S, { kind: "tra", to: "MIA", x: fix.x, y: fix.y - 1, h: 4, alt: 4, period: 2, emergency: true });
  ev = run(S, 2);
  check("an emergency leaving: EMERGENCY, a major error", lamps(ev).includes("EMERGENCY") && S.done[0].outcome === "emexit");
}

/* ---- fuel ---- */
{
  const S = quiet(); const p = plane(S, { kind: "tra", to: "MIA", x: 20, y: 20, h: 0, alt: 5, period: 1e6, fuel: 8 * TPM + 1 });
  let ev = run(S, 2);
  check("under 8 minutes of fuel: an emergency, now bound for the nearest airport", p.emergency && p.kind === "arr" && p.to === "ATL" && lamps(ev).includes("EMERGENCY"));
  ev = run(S, 8 * TPM);
  check("out of fuel: a crash", S.done[0] && S.done[0].outcome === "crash");
}

/* ---- weather, terrain, the zone ---- */
{
  let S = quiet(); S.storm = { x: 20, y: 10, phase: 0 }; plane(S, { x: 18, y: 10, h: 2, alt: 5, period: 1 });
  let ev = run(S, 3);
  check("a plane flying into the storm crashes", lamps(ev).includes("CRASH"), JSON.stringify(S.done));
  S = quiet(2); plane(S, { x: 9, y: 10, h: 6, alt: 3, period: 1 });
  ev = run(S, 6);
  check("Denver: 3,000 over the mountains crashes", lamps(ev).includes("CRASH"));
  S = quiet(2); const p = plane(S, { x: 9, y: 10, h: 6, alt: 4, period: 1 });
  ev = run(S, 6);
  check("Denver: 4,000 over the mountains is fine", !lamps(ev).includes("CRASH") && p.x === 3);
  S = quiet(3); plane(S, { x: 24, y: 13, h: 0, alt: 1, period: 1 });
  ev = run(S, 4);
  check("Washington: straight north from National is shot down", lamps(ev).includes("CRASH"));
}

/* ---- the pay table ---- */
{
  const S = quiet(0, 0); S.rank = 3;
  S.done = [
    { outcome: "landed", al: "DL" }, { outcome: "exited", al: "UA" }, { outcome: "landed", al: "PU" }, { outcome: "emland", al: "AA" },
  ];
  S.delayTicks = 2 * TPM; S.delayPuma = TPM;
  const t = E.tally(S);
  check("salary is (rank+1) x 500: GS-9 earns $2,000", t.salary === 2000);
  check("bonus: $100 x (4 done + 1 Puma - 3 delay min (Puma's counted twice) + 2 x 1 emergency landing)", t.bonus === 400, String(t.bonus));
  check("no major errors, no conflict: promoted", t.promoted && !t.fired);
  S.conflictTicks = 9;
  check("over a minute of conflict: fired, not promoted", E.tally(S).fired && !E.tally(S).promoted);
  S.conflictTicks = 5;
  check("38 s of conflict: neither promoted nor fired", !E.tally(S).fired && !E.tally(S).promoted);
  S.rank = 1; S.conflictTicks = 20; S.done.push({ outcome: "crash", al: "DL" });
  check("a GS-7 is never fired", !E.tally(S).fired);
  S.rank = 7; S.conflictTicks = 0; S.done.pop();
  check("GS-13 cannot be promoted further", !E.tally(S).promoted && !E.tally(S).fired);
  check("the ladder: GS-7 Atlanta Trainee, GS-8 Denver Trainee, GS-9 New York Trainee, GS-13 New York Prime Time, GS-7 Denver nothing",
    E.shiftFor(1, 0) === 0 && E.shiftFor(2, 2) === 0 && E.shiftFor(3, 4) === 0 && E.shiftFor(7, 4) === 4 && E.shiftFor(1, 2) === -1 && E.shiftFor(6, 0) === -1);
}

/* ---- a robot controller, for the smoke run and the replay ---- */
function robot(S, rng) {
  const sec = SECTORS[S.sector];
  for (const p of S.planes) {
    if (p.mode === "pending" || p.next || p.cmds > 0 && rng() > 0.05) continue;
    const at = S.t + rng() * 0.99;                   /* sent part way through a tick, as a player does */
    if (p.mode === "ground") E.command(S, { id: p.id, op: "vector", h: Math.floor(rng() * 8), alt: 4, at });
    else if (p.kind === "arr") E.command(S, { id: p.id, op: rng() < 0.5 ? "land" : "hold", ap: p.toAp, dir: 1, at });
    else { const f = sec.fixes.find(x => x.n === p.to); E.command(S, { id: p.id, op: "vector", h: E.bearing(p.x, p.y, f.x, f.y), alt: 4, at }); }
  }
}
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/* ---- replay ---- */
{
  const S = E.newShift({ sector: 4, shift: 4, rank: 7, seed: 99 });
  const rng = lcg(5);
  while (!S.over) { robot(S, rng); E.tick(S); }
  const log = JSON.parse(JSON.stringify(S.log));
  const R = E.newShift({ sector: 4, shift: 4, rank: 7, seed: 99 });
  let i = 0;
  while (!R.over) {
    while (i < log.length && log[i].t === R.t) E.command(R, log[i++].c);
    E.tick(R);
  }
  const strip = s => JSON.stringify({ done: s.done, c: s.conflictTicks, d: s.delayTicks, p: s.planes.map(p => [p.id, p.x, p.y, p.alt, p.h, p.mode]) });
  check("replay: the same seed and log give the same shift", strip(S) === strip(R) && S.done.length >= 3 && log.length > 10, `${S.done.length} flights, ${log.length} commands, same: ${strip(S) === strip(R)}`);
}

/* ---- smoke: every facility, every shift ---- */
{
  let worst = "";
  for (let sector = 0; sector < SECTORS.length; sector++) for (let shift = 0; shift < SHIFTS.length; shift++) {
    const S = E.newShift({ sector, shift, rank: 7, seed: 1000 + sector * 10 + shift });
    const rng = lcg(sector * 7 + shift);
    try {
      while (!S.over) { robot(S, rng); E.tick(S); for (const e of S.events) if (e.type === "radio" && (!e.say || !e.say.length)) throw new Error("radio with nothing to say: " + e.text); }
    } catch (e) { check(`smoke ${SECTORS[sector].id} ${SHIFTS[shift].name}`, false, e.stack); continue; }
    const seen = S.done.length + S.planes.length;
    const line = `${SECTORS[sector].id} ${SHIFTS[shift].name}: ${seen} flights, ${S.done.length} resolved, DN ${S.DN}, cap ${S.cap}, every ${S.gap} ticks` + (S.stormAt >= 0 ? ", storm" : "");
    if (seen < 4) check("smoke " + line, false, "too little traffic");
    else worst += "  " + line + "\n";
  }
  check("smoke: 25 shifts ran under the robot", true);
  process.stdout.write(worst);
}

if (failed) { console.log(`sim-check: FAILED (${failed} of ${passed + failed})`); process.exit(1); }
console.log(`sim-check: all ${passed} checks passed`);
