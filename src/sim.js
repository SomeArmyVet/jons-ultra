// ===== MODULE: sim =====
// Meters, race clock, course sampling, difficulty rules, palette blending. Reads the active DIFFICULTY table;
// no if (arcade) anywhere (Design Bible §6).
import { GAME, rng, hash, clamp, lerp, lerpTo } from './engine.js';
import { JON } from './jon.js';
import { RENDER } from './render.js';
import { RACE, nextStation, arriveAt, bonusActive } from './race.js';
import { nightAmount, middayAmount, dayBlend } from './atmosphere.js';
import { toast } from './ui.js';

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
  PICKUP_SPACING: 0.32, PICKUP_CHANCE: 0.6, PICKUP_REACH_PX: 40,  // 0.6 → 0.32 (6d pickups +65%, then 6e acceptance tuning); reach = max jump height that still grabs
  // Pace is data (6e semantics): a race's `targetMinutes` is the design minutes for the WHOLE RACE as
  // played (Realistic). PACE_CAL_MIN is the reference-runner whole-race minutes at paceMul 1, measured
  // in the 6e acceptance harness; paceMul = PACE_CAL_MIN / targetMinutes. paceMul scales BOTH world
  // speed and the race clock, so raceSec-per-mile — cutoffs, day/night — is untouched.
  PACE_CAL_MIN: 23,
  CROUCH_SPEED: 0.55,         // crouch-walk (Down held past the slide cap) — slower on purpose
  ANIM_CADENCE_CAP: 1.4       // leg cadence stops scaling with paceMul beyond this (looks silly past it)
};

// Meters drain by distance. Base rates are Realistic; DIFFICULTY scales them.
const METERS = {
  ENERGY_PER_MILE: 7, HYDRATION_PER_MILE: 5,
  ENERGY_GRADE_K: 4,          // ×(1 + K·grade) on climbs
  HEAT_K: 0.85                // hydration ×(1 + K·midday) — stronger than v0.5's 0.6, trimmed from 1.0 by the 6e acceptance pass (the Sunday-noon finish decides the hydration criterion)
};

// Design Bible §6: difficulty is data. The sim reads the active table; no if (arcade) anywhere else.
export const DIFFICULTY = {
  realistic: { label: 'Realistic', timeScale: 50, speedMul: 1, energyDrain: 1, hydrationDrain: 1,
               nightAmbient: 0.12, bonkSpeed: 0.6, bonkJump: 0.8, crampEvery: [3, 6], pickupMul: 1, aidStopS: 3, hitsPerFall: 3, enforceDNF: true },
  arcade:    { label: 'Arcade', timeScale: 300, speedMul: 5, energyDrain: 0.35, hydrationDrain: 0.35,
               nightAmbient: 0.45, bonkSpeed: 0.9, bonkJump: 0.95, crampEvery: [8, 14], pickupMul: 1.5, aidStopS: 0, hitsPerFall: 5, enforceDNF: false }
};

// Surface footing. Hazards and slide risk arrive at step 6; here they change speed, jump, drain and look.
export const SURFACES = {
  clay:  { label: 'Clay',  speed: 1.00, jump: 1.00, drain: 1.0,  dust: 0.6, color: '#6e4a2c' },
  roots: { label: 'Roots', speed: 0.94, jump: 1.00, drain: 1.1,  dust: 0.2, color: '#3e2c18' },
  rock:  { label: 'Rock',  speed: 0.96, jump: 1.00, drain: 1.05, dust: 0.4, color: '#5f5c50' },
  mud:   { label: 'Mud',   speed: 0.84, jump: 0.88, drain: 1.25, dust: 0,   color: '#2c2014' }
};

// Trail pickup effects; each race's `pickups` config lists which of these appear on its trail.
// Values ×1.65 (6d: pickups +65% — applied to both count and restore, tuned by the 6e harness).
const PICKUPS = {
  gel:        { label: 'Gel',         energy: 15, hydration: 0 },
  flask:      { label: 'Flask',       energy: 0,  hydration: 24 },
  watermelon: { label: 'Watermelon',  energy: 7,  hydration: 14 },
  saltTab:    { label: 'Salt tab',    energy: 0,  hydration: 20 },
  bacon:      { label: 'Bacon',       energy: 18, hydration: 0 },
  spamMusubi: { label: 'Spam musubi', energy: 22, hydration: 0 },
  flatCoke:   { label: 'Flat Coke',   energy: 10, hydration: 14 }
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
  const list = (GAME.course && GAME.course.pickups) || ['gel', 'flask', 'watermelon'];
  const type = list[Math.floor(hash(i * 13 + 1) * list.length)];
  return { i, type, mile: i * SIM.PICKUP_SPACING + hash(i * 17 + 5) * 0.3 };
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
export function triggerStumble(j) {
  if (!j.grounded || j.stumbleT > 0) return;
  j.stumbleT = SIM.STUMBLE_S; GAME.shake = Math.max(GAME.shake, 5);
}

// GAME.mile is TRAIL miles (world geometry: one visual loop = one pass of the 20-mile profile).
// Display miles — the real race's mile counter — are trail × mileRate; stations, cutoffs, drains and
// the HUD all live in display miles (Architecture §4 `loops`, 6e).
export function displayMile() { return GAME.mile * GAME.mileRate; }

export function simStep(dt) {
  const c = GAME.course, D = DIFFICULTY[GAME.diff], j = GAME.jon;
  const fast = GAME.fast ? 4 : 1, sdt = dt * fast;
  const prevMile = GAME.mile, prevBonk = GAME.bonk;
  GAME.mile = GAME.scroll / SIM.PX_PER_MILE;
  // Station arrivals (one per step is plenty). Stations fire at their real display miles via trailMile.
  const nxt = nextStation();
  if (nxt && GAME.mile >= nxt.trailMile && !GAME.aid) { GAME.nextIdx++; arriveAt(nxt); if (GAME.screen !== 'race') return; }
  GAME.lap = Math.min(GAME.loops, Math.floor(GAME.mile / c.structure.loopMiles) + 1);
  GAME.elev = courseElev(c, GAME.mile);
  GAME.grade = courseGrade(c, GAME.mile);
  GAME.surface = courseSurface(c, GAME.mile);
  const surf = SURFACES[GAME.surface], g = GAME.grade;

  // Race clock: real seconds per game second, so day/night and cutoffs match the real event in either mode.
  // paceMul and mileRate scale clock and display-mile speed together, keeping raceSec-per-display-mile
  // — and every cutoff — invariant.
  GAME.raceSec += sdt * D.timeScale * GAME.paceMul * GAME.mileRate;
  GAME.hour = (courseStartHour(c) + GAME.raceSec / 3600) % 24;
  GAME.night = nightAmount(GAME.hour);

  // Meters: empty energy = bonk, empty hydration = cramp. Per-race climate multipliers come from the
  // config's drainMul (HURT: Hawaiian humidity — hydration ×2.5, energy ×1.8, Michael 2026-09-05).
  const dm = c.drainMul || {};
  const dMiles = Math.max(0, GAME.mile - prevMile) * GAME.mileRate;   // drains are per real (display) mile
  GAME.energy = clamp(GAME.energy - dMiles * METERS.ENERGY_PER_MILE * (dm.energy || 1) * D.energyDrain * (1 + METERS.ENERGY_GRADE_K * Math.max(0, g)) * surf.drain, 0, 100);
  GAME.hydration = clamp(GAME.hydration - dMiles * METERS.HYDRATION_PER_MILE * (dm.hydration || 1) * D.hydrationDrain * (1 + METERS.HEAT_K * middayAmount(GAME.hour)) * (bonusActive('iceBandana') ? RACE.BANDANA_DRAIN_MUL : 1), 0, 100);
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

  // Landmarks: toast the real trail name as Jon passes it, every lap (race config `landmarks`).
  if (c.landmarks) {
    const L = c.structure.loopMiles;
    for (const lm of c.landmarks) {
      for (let k = Math.floor(prevMile / L); k <= Math.floor(GAME.mile / L); k++) {
        const abs = k * L + lm.mile;
        if (abs > prevMile && abs <= GAME.mile) toast(lm.label);
      }
    }
  }

  // Speed: grade, surface, difficulty, bonk, stumble. animSpeed is Jon's apparent pace (drives legs and hair).
  const gradeFactor = g > 0 ? 1 / (1 + SIM.UP_K * g) : Math.min(SIM.DOWN_MAX, 1 + SIM.DOWN_K * -g);
  let target = SIM.FLAT_SPEED * GAME.paceMul * gradeFactor * surf.speed * D.speedMul;
  if (g > 0 && bonusActive('poles')) target *= RACE.POLES_CLIMB_MUL;
  if (GAME.bonk) target *= D.bonkSpeed;
  if (j.stumbleT > 0) target *= SIM.STUMBLE_SPEED;
  if (j.state === 'crouch') target *= SIM.CROUCH_SPEED;       // crouch-walk: low but slow
  if (GAME.slowT > 0) target *= GAME.slowK;                   // wading a stream or slogging a mud pit
  if (GAME.aid && !GAME.aid.done) target = 0;                 // stopped at the aid table
  GAME.speed = dt > 0 ? lerpTo(GAME.speed, target, dt, GAME.aid && !GAME.aid.done ? 8 : SIM.SPEED_RATE) : target;
  GAME.animSpeed = GAME.speed / D.speedMul / Math.max(1, GAME.paceMul / SIM.ANIM_CADENCE_CAP);
  GAME.scroll += GAME.speed * sdt;

  GAME.camY = lerpTo(GAME.camY, clamp(g * SIM.FT_TO_PX * SIM.CAM_K, -SIM.CAM_MAX, SIM.CAM_MAX), dt, SIM.CAM_RATE);
  GAME.jumpMul = clamp(1 - SIM.JUMP_GRADE_K * g, 0.75, 1.3) * surf.jump * (GAME.bonk ? D.bonkJump : 1);
  GAME.shake = Math.max(0, GAME.shake - 18 * dt);

  if (j.gait === 'flat') { if (g > SIM.GAIT_ON) j.gait = 'up'; else if (g < -SIM.GAIT_ON) j.gait = 'down'; }
  else if (j.gait === 'up' && g < SIM.GAIT_OFF) j.gait = 'flat';
  else if (j.gait === 'down' && g > -SIM.GAIT_OFF) j.gait = 'flat';
}
