// ===== MODULE: spawner =====
// Reads the race config's hazard tables and surfaces; emits obstacles and animals with seeded RNG
// (seed = race id + attempt, Architecture §3). Fixed-mile obstacles (stream crossings) repeat at their
// real miles every lap; weighted ones roll per slot, honouring surface filters. Density tuning is step 8.
import { GAME, rng } from './engine.js';
import { SIM, courseSurface, courseElev, courseLoopMile } from './sim.js';

// Density ×3 (Michael's feel pass 2026-09-05): ≈ one obstacle per 0.25 mi overall, roots denser still,
// animals ×3. Step 8 evaluated an explicit spawn-density ramp (obstacle rolls ×0.85→×1.15, then a
// quota ramp 14→18) and REJECTED both: the GAP_S spacing cap flattens realized obstacle density
// (52/52/61 per loop with the ramp), and every layout perturbation reshuffles hit timing outside the
// 6e 3–8 hits-per-loop contract. The effective curve stays the phase-aware quota (+3 on the last
// loop) plus natural late-race congestion. Revisit only with a widened acceptance band.
const SPAWN = {
  START_MILE: 0.4,                  // clear runway out of the start
  OB_STEP: 0.08, OB_CHANCE: 0.75,   // rolls per slot; surface-filter misses thin this to ≈ one per 0.25 mi
  ROOTS_STEP: 0.12, ROOTS_CHANCE: 0.5,   // extra root webs on roots surfaces — the HURT signature
  AN_STEP: 0.22, AN_CHANCE: 0.5,    // ≈ one animal per 0.45 trail mi (time windows thin this further)
  GAP_S: 1.0,                       // min time between obstacles at local speed: full jump airtime + 0.15 s (6e)
  STATION_CLEAR: 0.15               // nothing spawns this close to an aid station (trail miles)
};

function idHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// Stations live at their real display miles converted to trail positions (6e visual loops).
function stationTrailMiles(course) {
  const st = course.structure, laps = st.type === 'loop' ? st.laps : 1, L = st.loopMiles || course.distanceMiles;
  const out = [];
  for (let k = 0; k < laps; k++) for (const s of course.aidStations) {
    const abs = s.mile === 0 ? (k + 1) * L : k * L + s.mile;
    out.push(abs / GAME.mileRate);
  }
  return out;
}
// Local expected running speed at a trail mile — sets the time-gap between obstacles.
function localSpeed(course, mile) {
  const d = 0.02;
  const g = (courseElev(course, mile + d) - courseElev(course, mile - d)) / (2 * d * 5280);
  const gradeFactor = g > 0 ? 1 / (1 + SIM.UP_K * g) : Math.min(SIM.DOWN_MAX, 1 + SIM.DOWN_K * -g);
  return SIM.FLAT_SPEED * GAME.paceMul * gradeFactor;
}
function pickWeighted(list, r) {
  const sum = list.reduce((a, o) => a + (o.weight || 1), 0);
  let x = r * sum;
  for (const o of list) { x -= (o.weight || 1); if (x <= 0) return o; }
  return list[list.length - 1];
}

export function spawnCourse(course, attempt) {
  const R = rng((idHash(course.id) + attempt) >>> 0);
  const H = course.hazards || {};
  const st = course.structure, L = st.loopMiles || course.distanceMiles;
  const visLoops = course.loops || (st.type === 'loop' ? st.laps : 1);
  const total = visLoops * L;                    // TRAIL miles: one visual loop per pass of the profile
  const stations = stationTrailMiles(course);
  const nearStation = mile => stations.some(sm => Math.abs(mile - sm) < SPAWN.STATION_CLEAR);
  const obstacles = [], animals = [];

  // fixed-position obstacles at their profile miles, once per visual loop
  for (const ob of (H.obstacles || [])) {
    if (!ob.atMiles) continue;
    for (let k = 0; k < visLoops; k++) for (const m of ob.atMiles) obstacles.push({ type: ob.type, mile: k * L + m, fixed: true });
  }
  // weighted obstacles: one roll per slot; RNG is consumed identically whether or not the roll lands,
  // so the layout stays a pure function of (race id, attempt)
  const weighted = (H.obstacles || []).filter(o => !o.atMiles);
  if (weighted.length) for (let m = SPAWN.START_MILE; m < total - 0.1; m += SPAWN.OB_STEP) {
    const roll = R(), place = R(), pick = R();
    if (roll > SPAWN.OB_CHANCE) continue;
    const mm = m + place * SPAWN.OB_STEP * 0.8;
    if (nearStation(mm)) continue;
    // pick across ALL weighted types, then drop surface mismatches — so each type's frequency follows
    // its weight and its surface share, and runnable surfaces stay comparatively clear
    const def = pickWeighted(weighted, pick);
    if (def.surfaces && !def.surfaces.includes(courseSurface(course, mm))) continue;
    obstacles.push({ type: def.type, mile: mm });
  }
  // extra pass: root webs stack up on roots surfaces (Pauoa Flats should feel like Pauoa Flats)
  const rootDef = weighted.find(o => o.type === 'rootWeb');
  if (rootDef) for (let m = SPAWN.START_MILE; m < total - 0.1; m += SPAWN.ROOTS_STEP) {
    const roll = R(), place = R();
    if (roll > SPAWN.ROOTS_CHANCE) continue;
    const mm = m + place * SPAWN.ROOTS_STEP * 0.8;
    if (nearStation(mm) || courseSurface(course, mm) !== 'roots') continue;
    obstacles.push({ type: 'rootWeb', mile: mm });
  }
  // Biters come from a phase-aware per-loop quota (6e: keeps hits-per-loop in the 3–8 design band
  // instead of at the mercy of slot luck). The clock-per-display-mile is invariant, so the spawner can
  // predict day/night at every mile and place species that will actually be awake there.
  const HIT_SPECIES = new Set(['pig', 'wallaby', 'centipede']);
  const quota = H.hitQuotaPerLoop || 0;
  if (quota) {
    const startHour = parseFloat(course.startTime.split(':')[0]) + parseFloat(course.startTime.split(':')[1] || 0) / 60;
    const clockHoursPerDispMile = 0.318;               // ≈ mid-pack pacing; drift near boundaries is fine
    for (let k = 0; k < visLoops; k++) {
      // the last loop loses the most encounters to station clears and the finish area — top it up
      const nQ = quota + (k === visLoops - 1 ? 3 : 0);
      for (let q = 0; q < nQ; q++) {
        const frac = (q + 0.5 + (R() - 0.5) * 0.3) / nQ;
        const r = R(), s2 = R();
        const mm = k * L + SPAWN.START_MILE + frac * (L - 1.2);
        if (nearStation(mm)) continue;
        const hour = (startHour + mm * GAME.mileRate * clockHoursPerDispMile) % 24;
        const night = hour > 19.2 || hour < 6.6;
        const dawnish = (hour >= 6.6 && hour < 7.8) || (hour > 17.5 && hour <= 19.2);
        const type = night ? (r < 0.45 ? 'wallaby' : r < 0.75 ? 'centipede' : 'pig')
                   : dawnish ? (r < 0.5 ? 'pig' : 'wallaby')
                   : 'pig';
        animals.push({ type, time: null, mile: mm, seed: Math.floor(s2 * 2147483647) });
      }
    }
  }
  // flavour animals (and all animals when no quota is set) roll from the config table
  const aList = (H.animals || []).filter(a => !quota || !HIT_SPECIES.has(a.type));
  if (aList.length) for (let m = SPAWN.START_MILE; m < total - 0.1; m += SPAWN.AN_STEP) {
    const roll = R(), place = R(), pick = R(), s2 = R();
    if (roll > SPAWN.AN_CHANCE) continue;
    const mm = m + place * SPAWN.AN_STEP * 0.8;
    if (nearStation(mm)) continue;
    const def = pickWeighted(aList, pick);
    animals.push({ type: def.type, time: def.time || null, mile: mm, seed: Math.floor(s2 * 2147483647) });
  }

  obstacles.sort((a, b) => a.mile - b.mile);
  // spacing: never two obstacles closer than GAP_S seconds at the local expected speed (6e criterion:
  // one full jump airtime + 0.15 s), so clusters stay dodgeable even on fast descents
  const gapOk = (a, b) => {
    const v = Math.max(localSpeed(course, a.mile), localSpeed(course, b.mile));
    return (b.mile - a.mile) * SIM.PX_PER_MILE >= SPAWN.GAP_S * v;
  };
  const spaced = [];
  for (const o of obstacles) {
    const prev = spaced[spaced.length - 1];
    if (prev && !o.fixed && !gapOk(prev, o)) continue;
    // a fixed obstacle keeps its real spot: evict rolled neighbours that sit too close BEFORE it
    if (o.fixed) while (spaced.length && !spaced[spaced.length - 1].fixed && !gapOk(spaced[spaced.length - 1], o)) spaced.pop();
    spaced.push(o);
  }
  animals.sort((a, b) => a.mile - b.mile);
  return { obstacles: spaced, animals };
}
