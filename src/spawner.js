// ===== MODULE: spawner =====
// Reads the race config's hazard tables and surfaces; emits obstacles and animals with seeded RNG
// (seed = race id + attempt, Architecture §3). Fixed-mile obstacles (stream crossings) repeat at their
// real miles every lap; weighted ones roll per slot, honouring surface filters. Density tuning is step 8.
import { rng } from './engine.js';
import { courseSurface, courseLoopMile } from './sim.js';

// Density ×3 (Michael's feel pass 2026-09-05): ≈ one obstacle per 0.25 mi overall, roots denser still,
// animals ×3. MIN_GAP keeps clusters readable — at the new pace it is ~0.7 s between obstacles, and a
// full-hold jump covers ~0.07 mi, so back-to-back obstacles stay dodgeable.
const SPAWN = {
  START_MILE: 0.4,                  // clear runway out of the start
  OB_STEP: 0.08, OB_CHANCE: 0.75,   // rolls per slot; surface-filter misses thin this to ≈ one per 0.25 mi
  ROOTS_STEP: 0.12, ROOTS_CHANCE: 0.5,   // extra root webs on roots surfaces — the HURT signature
  AN_STEP: 0.27, AN_CHANCE: 0.5,    // ≈ one animal per 0.55 mi (time windows thin this further)
  MIN_GAP: 0.06,                    // no two rolled obstacles closer than this (≈ 320 px)
  STATION_CLEAR: 0.15               // nothing spawns this close to an aid station
};

function idHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function nearStation(course, mile) {
  const m = courseLoopMile(course, mile), L = course.structure.loopMiles || course.distanceMiles;
  return course.aidStations.some(s => {
    const d = Math.abs(m - s.mile);
    return Math.min(d, L - d) < SPAWN.STATION_CLEAR;
  });
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
  const laps = st.type === 'loop' ? st.laps : 1;
  const total = course.distanceMiles;
  const obstacles = [], animals = [];

  // fixed-position obstacles at their real miles, every lap
  for (const ob of (H.obstacles || [])) {
    if (!ob.atMiles) continue;
    for (let k = 0; k < laps; k++) for (const m of ob.atMiles) obstacles.push({ type: ob.type, mile: k * L + m, fixed: true });
  }
  // weighted obstacles: one roll per slot; RNG is consumed identically whether or not the roll lands,
  // so the layout stays a pure function of (race id, attempt)
  const weighted = (H.obstacles || []).filter(o => !o.atMiles);
  if (weighted.length) for (let m = SPAWN.START_MILE; m < total - 0.1; m += SPAWN.OB_STEP) {
    const roll = R(), place = R(), pick = R();
    if (roll > SPAWN.OB_CHANCE) continue;
    const mm = m + place * SPAWN.OB_STEP * 0.8;
    if (nearStation(course, mm)) continue;
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
    if (nearStation(course, mm) || courseSurface(course, mm) !== 'roots') continue;
    obstacles.push({ type: 'rootWeb', mile: mm });
  }
  // animals: sparser; time-of-day windows are checked at encounter time by hazards.js
  const aList = H.animals || [];
  if (aList.length) for (let m = SPAWN.START_MILE; m < total - 0.1; m += SPAWN.AN_STEP) {
    const roll = R(), place = R(), pick = R(), s2 = R();
    if (roll > SPAWN.AN_CHANCE) continue;
    const mm = m + place * SPAWN.AN_STEP * 0.8;
    if (nearStation(course, mm)) continue;
    const def = pickWeighted(aList, pick);
    animals.push({ type: def.type, time: def.time || null, mile: mm, seed: Math.floor(s2 * 2147483647) });
  }

  obstacles.sort((a, b) => a.mile - b.mile);
  const spaced = [];
  for (const o of obstacles) {
    const prev = spaced[spaced.length - 1];
    if (prev && !o.fixed && o.mile - prev.mile < SPAWN.MIN_GAP) continue;
    spaced.push(o);
  }
  animals.sort((a, b) => a.mile - b.mile);
  return { obstacles: spaced, animals };
}
