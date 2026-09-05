// ===== MODULE: sim =====
// Meters, race clock, course sampling, difficulty rules, palette blending. Reads the active DIFFICULTY table;
// no if (arcade) anywhere (Design Bible §6).
import { GAME, rng, hash, clamp, lerp, lerpTo } from './engine.js';
import { JON } from './jon.js';
import { RENDER } from './render.js';
import { RACE, nextStation, arriveAt, bonusActive } from './race.js';
import { nightAmount, middayAmount, dayBlend } from './atmosphere.js';

export const SIM = {
  PX_PER_MILE: 5400,        // Architecture §6: realistic ≈ 17 s/mile at 320 px/s flat
  FT_TO_PX: 1.5,            // visual exaggeration of the elevation line (14% real grade → ~11° on screen)
  FLAT_SPEED: 320,
  UP_K: 5.5,                // speed = flat / (1 + UP_K·grade) on climbs (14% → 56%)
  DOWN_K: 2.5, DOWN_MAX: 1.45,   // speed = flat · (1 + DOWN_K·|grade|) on descents, capped
  SPEED_RATE: 3,
  CAM_K: 260, CAM_MAX: 60, CAM_RATE: 2.5,
  GAIT_ON: 0.05, GAIT_OFF: 0.03,
  JUMP_GRADE_K: 1.6,
  STUMBLE_S: 0.55, STUMBLE_SPEED: 0.4,
  PICKUP_SPACING: 0.6, PICKUP_CHANCE: 0.6, PICKUP_REACH_PX: 40   // reach = max jump height at which a trail pickup is still grabbed
};

// Meters drain by distance. Base rates are Realistic; DIFFICULTY scales them.
const METERS = {
  ENERGY_PER_MILE: 7, HYDRATION_PER_MILE: 5,
  ENERGY_GRADE_K: 4,          // ×(1 + K·grade) on climbs
  HEAT_K: 0.6                 // hydration ×(1 + K·midday) — midday = 1 at 12:00, 0 at dawn/dusk
};

// Design Bible §6: difficulty is data. The sim reads the active table; no if (arcade) anywhere else.
export const DIFFICULTY = {
  realistic: { label: 'Realistic', timeScale: 50, speedMul: 1, energyDrain: 1, hydrationDrain: 1,
               nightAmbient: 0.12, bonkSpeed: 0.6, bonkJump: 0.8, crampEvery: [3, 6], pickupMul: 1, aidStopS: 3 },
  arcade:    { label: 'Arcade', timeScale: 300, speedMul: 5, energyDrain: 0.35, hydrationDrain: 0.35,
               nightAmbient: 0.45, bonkSpeed: 0.9, bonkJump: 0.95, crampEvery: [8, 14], pickupMul: 1.5, aidStopS: 0 }
};

// Surface footing. Hazards and slide risk arrive at step 6; here they change speed, jump, drain and look.
export const SURFACES = {
  clay:  { label: 'Clay',  speed: 1.00, jump: 1.00, drain: 1.0,  dust: 0.6, color: '#6e4a2c' },
  roots: { label: 'Roots', speed: 0.94, jump: 1.00, drain: 1.1,  dust: 0.2, color: '#3e2c18' },
  rock:  { label: 'Rock',  speed: 0.96, jump: 1.00, drain: 1.05, dust: 0.4, color: '#5f5c50' },
  mud:   { label: 'Mud',   speed: 0.84, jump: 0.88, drain: 1.25, dust: 0,   color: '#2c2014' }
};

// Placeholder trail pickups. Real per-race lists arrive at step 6 (race config `pickups`).
const PICKUPS = {
  gel:        { label: 'Gel',        energy: 8,  hydration: 0 },
  flask:      { label: 'Flask',      energy: 0,  hydration: 8 },
  watermelon: { label: 'Watermelon', energy: 4,  hydration: 5 }
};

export function courseLoopMile(course, mile) {
  const L = course.structure.loopMiles;
  return ((mile % L) + L) % L;
}
// Cosine interpolation between profile points so grade changes are smooth, not kinked.
export function courseElev(course, mile) {
  const m = courseLoopMile(course, mile), e = course.elevation;
  let i = 1; while (i < e.length - 1 && e[i][0] < m) i++;
  const [m0, f0] = e[i - 1], [m1, f1] = e[i];
  const u = clamp((m - m0) / (m1 - m0 || 1), 0, 1), k = 0.5 - 0.5 * Math.cos(u * Math.PI);
  return f0 + (f1 - f0) * k;
}
function courseGrade(course, mile) {
  const d = 0.02;
  return (courseElev(course, mile + d) - courseElev(course, mile - d)) / (2 * d * 5280);
}
export function courseSurface(course, mile) {
  const m = courseLoopMile(course, mile);
  for (const sgm of course.surfaces) if (m >= sgm.fromMile && m < sgm.toMile) return sgm.type;
  return course.surfaces[0].type;
}
function courseStartHour(course) {
  const [h, m] = course.startTime.split(':').map(Number);
  return h + m / 60;
}

// Trail pickups are seeded by absolute index so each lap has its own set.
export function pickupAt(i) {
  if (i < 1 || hash(i * 7 + 3) > SIM.PICKUP_CHANCE) return null;
  const r = hash(i * 13 + 1);
  return { i, type: r < 0.4 ? 'gel' : r < 0.7 ? 'flask' : 'watermelon', mile: i * SIM.PICKUP_SPACING + hash(i * 17 + 5) * 0.3 };
}

const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function lerpHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
}
export function paletteAt(kit, hour) {
  const { a, b, t } = dayBlend(hour), pa = kit.palette[a], pb = kit.palette[b], out = {};
  for (const k in pa) out[k] = lerpHex(pa[k], pb[k], t);
  return out;
}

const simRng = rng(0x51a7);
function triggerStumble(j) {
  if (!j.grounded || j.stumbleT > 0) return;
  j.stumbleT = SIM.STUMBLE_S; GAME.shake = Math.max(GAME.shake, 5);
}

export function simStep(dt) {
  const c = GAME.course, D = DIFFICULTY[GAME.diff], j = GAME.jon;
  const fast = GAME.fast ? 4 : 1, sdt = dt * fast;
  const prevMile = GAME.mile, prevBonk = GAME.bonk;
  GAME.mile = GAME.scroll / SIM.PX_PER_MILE;
  // Station arrivals (one per step is plenty).
  const nxt = nextStation();
  if (nxt && GAME.mile >= nxt.absMile && !GAME.aid) { GAME.nextIdx++; arriveAt(nxt); if (GAME.screen !== 'race') return; }
  GAME.lap = Math.min(c.structure.laps, Math.floor(GAME.mile / c.structure.loopMiles) + 1);
  GAME.elev = courseElev(c, GAME.mile);
  GAME.grade = courseGrade(c, GAME.mile);
  GAME.surface = courseSurface(c, GAME.mile);
  const surf = SURFACES[GAME.surface], g = GAME.grade;

  // Race clock: real seconds per game second, so day/night and cutoffs match the real event in either mode.
  GAME.raceSec += sdt * D.timeScale;
  GAME.hour = (courseStartHour(c) + GAME.raceSec / 3600) % 24;
  GAME.night = nightAmount(GAME.hour);

  // Meters: empty energy = bonk, empty hydration = cramp.
  const dMiles = Math.max(0, GAME.mile - prevMile);
  GAME.energy = clamp(GAME.energy - dMiles * METERS.ENERGY_PER_MILE * D.energyDrain * (1 + METERS.ENERGY_GRADE_K * Math.max(0, g)) * surf.drain, 0, 100);
  GAME.hydration = clamp(GAME.hydration - dMiles * METERS.HYDRATION_PER_MILE * D.hydrationDrain * (1 + METERS.HEAT_K * middayAmount(GAME.hour)) * (bonusActive('iceBandana') ? RACE.BANDANA_DRAIN_MUL : 1), 0, 100);
  GAME.bonk = GAME.energy <= 0;
  if (GAME.bonk && !prevBonk) GAME.stats.bonks++;
  if (GAME.night > 0.5) GAME.stats.nightMiles += dMiles;
  if (GAME.pacer) GAME.pacer.phase += dt * GAME.animSpeed / JON.STRIDE_PX * Math.PI * 2;
  GAME.cramp = GAME.hydration <= 0;
  if (GAME.cramp) {
    GAME.crampTimer -= sdt;
    if (GAME.crampTimer <= 0) { triggerStumble(j); GAME.crampTimer = lerp(D.crampEvery[0], D.crampEvery[1], simRng()); }
  } else GAME.crampTimer = Math.min(GAME.crampTimer, D.crampEvery[0]);
  if (j.stumbleT > 0) j.stumbleT -= dt;

  // Pickups crossed this step (swept, so Arcade speed can't skip them).
  const i0 = Math.floor(prevMile / SIM.PICKUP_SPACING), i1 = Math.floor(GAME.mile / SIM.PICKUP_SPACING) + 1;
  for (let i = i0; i <= i1; i++) {
    const p = pickupAt(i);
    if (!p || GAME.collected.has(i) || p.mile <= prevMile || p.mile > GAME.mile) continue;
    if (j.y > SIM.PICKUP_REACH_PX) continue;                    // jumped clean over it
    GAME.collected.add(i);
    const def = PICKUPS[p.type];
    GAME.energy = clamp(GAME.energy + def.energy * D.pickupMul, 0, 100);
    GAME.hydration = clamp(GAME.hydration + def.hydration * D.pickupMul, 0, 100);
    GAME.floaters.push({ x: JON.X, y: RENDER.GROUND_Y + GAME.camY - 120, text: def.label, age: 0 });
  }
  for (let k = GAME.floaters.length - 1; k >= 0; k--) { const f = GAME.floaters[k]; f.age += dt; f.y -= 30 * dt; if (f.age > 1.2) GAME.floaters.splice(k, 1); }

  // Speed: grade, surface, difficulty, bonk, stumble. animSpeed is Jon's apparent pace (drives legs and hair).
  const gradeFactor = g > 0 ? 1 / (1 + SIM.UP_K * g) : Math.min(SIM.DOWN_MAX, 1 + SIM.DOWN_K * -g);
  let target = SIM.FLAT_SPEED * gradeFactor * surf.speed * D.speedMul;
  if (g > 0 && bonusActive('poles')) target *= RACE.POLES_CLIMB_MUL;
  if (GAME.bonk) target *= D.bonkSpeed;
  if (j.stumbleT > 0) target *= SIM.STUMBLE_SPEED;
  if (GAME.aid && !GAME.aid.done) target = 0;                 // stopped at the aid table
  GAME.speed = dt > 0 ? lerpTo(GAME.speed, target, dt, GAME.aid && !GAME.aid.done ? 8 : SIM.SPEED_RATE) : target;
  GAME.animSpeed = GAME.speed / D.speedMul;
  GAME.scroll += GAME.speed * sdt;

  GAME.camY = lerpTo(GAME.camY, clamp(g * SIM.FT_TO_PX * SIM.CAM_K, -SIM.CAM_MAX, SIM.CAM_MAX), dt, SIM.CAM_RATE);
  GAME.jumpMul = clamp(1 - SIM.JUMP_GRADE_K * g, 0.75, 1.3) * surf.jump * (GAME.bonk ? D.bonkJump : 1);
  GAME.shake = Math.max(0, GAME.shake - 18 * dt);

  if (j.gait === 'flat') { if (g > SIM.GAIT_ON) j.gait = 'up'; else if (g < -SIM.GAIT_ON) j.gait = 'down'; }
  else if (j.gait === 'up' && g < SIM.GAIT_OFF) j.gait = 'flat';
  else if (j.gait === 'down' && g > -SIM.GAIT_OFF) j.gait = 'flat';
}
