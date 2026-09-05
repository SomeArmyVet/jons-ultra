// ===== MODULE: race =====
// Aid stations, cutoffs, pacer, DNF, finish. Everything reads the course config; nothing names a race.
import { GAME, Input, clamp, lerp } from './engine.js';
import { DIFFICULTY, simStep } from './sim.js';
import { JON, makeJon } from './jon.js';
import { AudioBed } from './audio.js';
import { toast, fmtClock } from './ui.js';

export const RACE = {
  AID_CARD_ARCADE_S: 0.8,       // Arcade: no stop, card flashes for this long
  SKIP_REFILL_MIN: 0.15,        // Space at an aid stop still gives at least this fraction of the refill
  FINISH_HOLD_S: 1.6,           // arms-up beat before the finish card
  FINISH_ZOOM: 0.35, ZOOM_LEAD_S: 2,
  BATTERY_LAMP_MUL: 1.4, BANDANA_DRAIN_MUL: 0.6, POLES_CLIMB_MUL: 1.08,
  PACER_X_OFFSET: -125, PACER_CALLOUT_PX: 420,
  HIT_ENERGY: 10
};

// Every station visit in race order. Loop races repeat their stations per lap; the mile-0 station is the lap end.
function buildStationList(course) {
  const list = [], st = course.structure, L = st.loopMiles || 0;
  const laps = st.type === 'loop' ? st.laps : 1;
  for (let k = 0; k < laps; k++) {
    for (const s of course.aidStations) {
      const isStart = s.mile === 0;
      const absMile = isStart ? (k + 1) * L : k * L + s.mile;
      if (st.type !== 'loop' && isStart) continue;
      list.push({ station: s, absMile, lap: k, isFinish: isStart && k === laps - 1, cutoffH: cutoffFor(course, s, k, absMile) });
    }
  }
  list.sort((a, b) => a.absMile - b.absMile);
  if (st.type !== 'loop') list.push({ station: { name: 'Finish', mile: course.distanceMiles, dropBag: false, pacerStart: false }, absMile: course.distanceMiles, lap: 0, isFinish: true, cutoffH: course.timeLimitHours });
  return list;
}
// Station cutoff: per-station number, per-station per-lap array, or the course's absMile→hours schedule.
function cutoffFor(course, s, lap, absMile) {
  if (Array.isArray(s.cutoffHours)) return s.cutoffHours[lap] ?? null;
  if (typeof s.cutoffHours === 'number') return s.cutoffHours;
  const sch = course.cutoffSchedule; if (!sch) return null;
  let i = 1; while (i < sch.length - 1 && sch[i][0] < absMile) i++;
  const [m0, h0] = sch[i - 1], [m1, h1] = sch[i];
  return h0 + (h1 - h0) * clamp((absMile - m0) / (m1 - m0 || 1), 0, 1);
}
export function nextStation() { return GAME.stations[GAME.nextIdx] || null; }
function raceHours() { return GAME.raceSec / 3600; }

// Called by the sim when Jon's mile crosses a station.
export function arriveAt(occ) {
  const D = DIFFICULTY[GAME.diff];
  if (occ.isFinish) {
    // Reaching the line after the course closes is a DNF, not a finish (course closure is real).
    if (occ.cutoffH != null && raceHours() > occ.cutoffH) { startDNF(occ, 'cutoff'); return; }
    startFinish(); return;
  }
  const late = (occ.cutoffH != null && raceHours() > occ.cutoffH) || GAME.forceCutoffMiss;
  GAME.forceCutoffMiss = false;
  if (late) { startDNF(occ, 'cutoff'); return; }
  if (GAME.bonk && GAME.cramp) { startDNF(occ, 'pulled'); return; }

  // Pacer leaves at the station after joining; joins at the first eligible station past pacerFromMile.
  if (GAME.pacer && GAME.nextIdx >= GAME.pacer.leaveIdx) { GAME.pacer = null; toast('Pacer segment done'); }
  const rules = GAME.course.rules || {};
  if (!GAME.pacer && rules.pacersAllowed && occ.station.pacerStart && occ.absMile >= (rules.pacerFromMile || 0)) {
    GAME.pacer = { shield: true, leaveIdx: GAME.nextIdx + 1, phase: 0 };
    toast('Pacer joins');
  }
  let item = null;
  if (occ.station.dropBag) {
    item = ['battery', 'iceBandana', 'poles'][GAME.nextIdx % 3];
    GAME.bonusItem = { type: item, untilIdx: GAME.nextIdx + 1 };
  }
  const dur = D.aidStopS;
  AudioBed.cowbell();
  GAME.aid = { occ, t: 0, dur, e0: GAME.energy, h0: GAME.hydration, item, done: dur === 0 };
  if (dur === 0) { GAME.energy = 100; GAME.hydration = 100; }
  GAME.jon.forcedState = dur === 0 ? null : 'aid';
}
export function aidStep(dt) {
  const a = GAME.aid; if (!a) return;
  a.t += dt;
  if (!a.done) {
    const k = clamp(a.t / a.dur, 0, 1);
    GAME.energy = lerp(a.e0, 100, k); GAME.hydration = lerp(a.h0, 100, k);
    if (Input.jumpBuffered(performance.now())) {           // Space skips the stop for a partial refill
      Input.consumeJump();
      const kk = Math.max(k, RACE.SKIP_REFILL_MIN);
      GAME.energy = lerp(a.e0, 100, kk); GAME.hydration = lerp(a.h0, 100, kk);
      a.done = true;
    }
    if (a.t >= a.dur) a.done = true;
    if (a.done) { GAME.jon.forcedState = null; a.closeT = a.t; }
  } else if (a.t - (a.closeT || 0) > (a.dur === 0 ? RACE.AID_CARD_ARCADE_S : 0.6)) GAME.aid = null;
}
export const ITEM_LABEL = { battery: 'Headlamp battery: wider beam to the next station', iceBandana: 'Ice bandana: slower hydration drain to the next station', poles: 'Fresh poles: faster climbing to the next station' };
export function bonusActive(type) { return GAME.bonusItem && GAME.bonusItem.type === type && GAME.nextIdx < GAME.bonusItem.untilIdx; }

// Hits arrive at step 6; the pacer's shield is wired now.
export function takeHit() {
  if (GAME.pacer && GAME.pacer.shield) { GAME.pacer.shield = false; toast('Pacer took that one'); GAME.shake = 4; return; }
  GAME.energy = clamp(GAME.energy - RACE.HIT_ENERGY, 0, 100); GAME.stats.hits++; GAME.shake = 7;
}

function startDNF(occ, reason) {
  GAME.screen = 'dnf';
  GAME.dnf = { occ, reason, raceSec: GAME.raceSec };
  GAME.jon.forcedState = 'sit'; GAME.aid = null; GAME.pacer = null;
}
function startFinish() {
  GAME.screen = 'finish';
  GAME.finish = { t: 0, raceSec: GAME.raceSec };
  GAME.jon.forcedState = 'finish'; GAME.aid = null; GAME.pacer = null;
}
export function buckleFor(course, hours) {
  const b = course.buckles; if (!b) return 'Finisher';
  return hours <= b.gold ? 'Gold' : hours <= b.silver ? 'Silver' : hours <= b.bronze ? 'Bronze' : 'Finisher';
}
export function finishSummaryText() {
  const c = GAME.course, f = GAME.finish, h = f.raceSec / 3600;
  return `Jon's Ultra — ${c.name}\nFinish: ${fmtClock(f.raceSec)} (${buckleFor(c, h)} buckle)\nHits taken: ${GAME.stats.hits}   Bonks: ${GAME.stats.bonks}   Night miles: ${GAME.stats.nightMiles.toFixed(1)}\nKatie and Emma were at the line.`;
}

export function resetRace() {
  // Per-race character flags come from the config (character sheet: poles off only for Across the Years).
  JON.BIB = String(GAME.course.bibNumber || '254');
  JON.POLES = GAME.course.poles !== false;
  GAME.scroll = 0; GAME.mile = 0; GAME.lap = 1; GAME.raceSec = 0; GAME.speed = 0; GAME.camY = 0;
  GAME.energy = 100; GAME.hydration = 100; GAME.bonk = false; GAME.cramp = false; GAME.crampTimer = 4;
  GAME.collected = new Set(); GAME.floaters = []; GAME.toasts = []; GAME.particles = [];
  GAME.stats = { hits: 0, bonks: 0, nightMiles: 0 };
  GAME.stations = buildStationList(GAME.course); GAME.nextIdx = 0;
  GAME.aid = null; GAME.dnf = null; GAME.finish = null; GAME.pacer = null; GAME.bonusItem = null; GAME.forceCutoffMiss = false;
  GAME.life = []; GAME.rain = 0; GAME.shooting = null;
  GAME.jon = makeJon(); GAME.jon.lastGroundedAt = performance.now();
  GAME.fast = false;
  simStep(0);
}
