// ===== MODULE: atmosphere =====
// Sun/moon clocks, stars, shooting stars, rain, mist, ambient life, foot dust. Decoration only — nothing here touches play.
import { ENGINE, GAME, BIOMES, rng, hash, clamp, lerp, lerpTo } from './engine.js';
import { JON } from './jon.js';
import { RENDER, spawnDust } from './render.js';
import { SURFACES } from './sim.js';
import { AudioBed } from './audio.js';

const ATMO = {
  STARS: 150, STAR_TOP: 330,
  SHOOT_MIN_S: 30, SHOOT_MAX_S: 60, SHOOT_LEN_S: 0.95,   // 6e: every 30-60 s of night, longer streaks
  BUTTERFLIES: [2, 4], FIREFLIES: [5, 10], MOTHS: 3,     // 6e: firefly population halved
  BIRD_EVERY_S: [20, 40], BAT_EVERY_S: [25, 50],
  RAIN_DROPS: 140, RAIN_SPEED: 900
};
export function parseHM(s) { const [h, m] = s.split(':').map(Number); return h + m / 60; }
export function skyBodyFrac(hour, from, to) {            // 0..1 along the arc, or null when below the horizon
  let h = hour; if (to > 24 && h < from) h += 24;
  const f = (h - from) / (to - from);
  return f >= -0.03 && f <= 1.03 ? clamp(f, 0, 1) : null;
}
export function skyBodyPos(f, v) { return { x: 80 + f * (v.W - 160), y: 330 - Math.sin(f * Math.PI) * 260 }; }

// Palette keyframes and night amount derive from the course's sunrise/sunset (Design Bible §8 atmosphere rule 2).
function dayKeys(course) {
  const r = parseHM(course.sun.rise), s = parseHM(course.sun.set);
  return [[r - 1.1, 'night'], [r - 0.35, 'dawn'], [r + 0.5, 'day'], [s - 0.6, 'day'], [s + 0.1, 'dusk'], [s + 1.0, 'night']];
}
export function dayBlend(hour) {
  const keys = dayKeys(GAME.course), n = keys.length;
  for (let i = 0; i < n; i++) {
    const [h0, a] = keys[i], [h1raw, b] = keys[(i + 1) % n];
    const h1 = h1raw <= h0 ? h1raw + 24 : h1raw;
    let h = hour; if (h < h0) h += 24;
    if (h >= h0 && h <= h1) return { a, b, t: (h - h0) / (h1 - h0) };
  }
  return { a: 'night', b: 'night', t: 0 };
}
export function nightAmount(hour) {
  const r = parseHM(GAME.course.sun.rise), s = parseHM(GAME.course.sun.set);
  let h = hour; if (h < r - 1.1) h += 24;
  if (h >= r + 0.5 && h <= s - 0.6) return 0;
  if (h > s - 0.6 && h < s + 1.0) return (h - (s - 0.6)) / 1.6;
  if (h > r - 1.1 + 24 && h < r + 0.5 + 24) return 1 - (h - (r - 1.1 + 24)) / 1.6;
  if (h > r - 1.1 && h < r + 0.5) return 1 - (h - (r - 1.1)) / 1.6;
  return 1;
}
export function middayAmount(hour) {
  const r = parseHM(GAME.course.sun.rise), s = parseHM(GAME.course.sun.set);
  return hour > r && hour < s ? Math.sin((hour - r) / (s - r) * Math.PI) : 0;
}

// --- stars ---
const starRng = rng(0x57a5);
const STARS = Array.from({ length: ATMO.STARS }, () => ({ x: starRng(), y: starRng(), r: 0.6 + starRng() * 1.3, ph: starRng() * 6.28, f: 0.8 + starRng() * 2.2 }));
export function drawStars(ctx, t, v) {
  const a = Math.pow(GAME.night, 1.5); if (a <= 0.01) return;
  ctx.fillStyle = '#eef2ff';
  for (const s of STARS) {
    const tw = 0.55 + 0.45 * Math.sin(t * s.f + s.ph);
    ctx.globalAlpha = a * tw; ctx.beginPath(); ctx.arc(s.x * v.W, s.y * ATMO.STAR_TOP, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const sh = GAME.shooting;
  if (sh && sh.age < ATMO.SHOOT_LEN_S) {
    // 6e: longer, brighter streak — a soft wide trail with a white-hot core, meant to be noticed
    const k = sh.age / ATMO.SHOOT_LEN_S, x = sh.x + sh.vx * sh.age, y = sh.y + sh.vy * sh.age;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(200,216,255,${(1 - k) * a * 0.5})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - sh.vx * 0.26, y - sh.vy * 0.26); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * a})`; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x - sh.vx * 0.2, y - sh.vy * 0.2); ctx.lineTo(x, y); ctx.stroke();
  }
}
export const atmoRng = rng(0xa7a0);
export function atmoStep(dt, tReal) {
  // shooting star: real-time schedule, night only, one streak
  if (GAME.nextShoot === undefined) GAME.nextShoot = tReal + lerp(ATMO.SHOOT_MIN_S, ATMO.SHOOT_MAX_S, atmoRng());
  if (GAME.shooting) { GAME.shooting.age += dt; if (GAME.shooting.age > ATMO.SHOOT_LEN_S) GAME.shooting = null; }
  else if (tReal >= GAME.nextShoot) {
    GAME.nextShoot = tReal + lerp(ATMO.SHOOT_MIN_S, ATMO.SHOOT_MAX_S, atmoRng());
    if (GAME.night > 0.6) GAME.shooting = { x: 200 + atmoRng() * (ENGINE.W - 400), y: 40 + atmoRng() * 180, vx: -(500 + atmoRng() * 300), vy: 160 + atmoRng() * 120, age: 0 };
  }
  // rain: seeded squall windows along the course, with ramps; mist above the config altitude
  const c = GAME.course, wx = (c.hazards && c.hazards.weather) || [];
  const squall = wx.find(w => w.type === 'rainSquall'), mist = wx.find(w => w.type === 'mist');
  let rainTarget = 0;
  if (squall) {
    const seg = 0.5, i = Math.floor(GAME.mile / seg), u = (GAME.mile - i * seg) / seg;
    const here = hash(i * 977 + 11) < squall.chancePerMile * seg * 4;          // chance per half-mile window
    if (here) rainTarget = clamp(Math.min(u, 1 - u) * 6, 0, 1);
  }
  GAME.rain = lerpTo(GAME.rain, rainTarget, dt, 1.2);
  GAME.mistAmount = mist ? clamp((GAME.elev - mist.aboveFeet) / 300, 0, 1) * (0.6 + 0.4 * GAME.rain) : 0;
  lifeStep(dt);
}
export function drawRain(ctx, pal, v) {
  const r = GAME.rain; if (r < 0.02) return;
  ctx.strokeStyle = pal.rain; ctx.globalAlpha = 0.35 * r; ctx.lineWidth = 1.2;
  const n = Math.floor(ATMO.RAIN_DROPS * r), tt = GAME.t;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const h = hash(i * 131 + 7), h2 = hash(i * 173 + 3);
    const x = ((h * v.W + tt * -160 * (0.6 + h2)) % v.W + v.W) % v.W;
    const y = ((h2 * v.H + tt * ATMO.RAIN_SPEED * (0.7 + h * 0.6)) % (v.H + 40)) - 20;
    ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16);
  }
  ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = pal.mist; ctx.globalAlpha = 0.10 * r; ctx.fillRect(0, 0, v.W, v.H); ctx.globalAlpha = 1;
}

// Mist bands above the config's mist altitude, drifting slowly; alpha grows with height and rain.
export function drawMist(ctx, pal, t, v, f, y, k) {
  const above = v.mistAmount; if (above <= 0.01) return;
  ctx.fillStyle = pal.mist; ctx.globalAlpha = 0.28 * above * k;
  for (let b = 0; b < 3; b++) {
    const yy = y + b * 26 + Math.sin(t * 0.3 + b) * 6, drift = (v.scroll * f * 0.5 + t * 12 + b * 400) % (v.W + 600) - 300;
    ctx.beginPath(); ctx.ellipse(drift, yy, 320, 14 + b * 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(drift + 700, yy + 8, 260, 12, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- ambient life ---
function lifeStep(dt) {
  const L = GAME.life, kit = BIOMES[GAME.course.biome], day = GAME.night < 0.5;
  const count = type => L.filter(e => e.type === type).length;
  const W = ENGINE.W, H = ENGINE.H;
  // population targets by time of day
  const wantB = day ? Math.round(lerp(ATMO.BUTTERFLIES[0], ATMO.BUTTERFLIES[1], hash(Math.floor(GAME.mile)))) : 0;
  const wantF = !day ? Math.round(lerp(ATMO.FIREFLIES[0], ATMO.FIREFLIES[1], hash(Math.floor(GAME.mile) + 9))) : 0;
  const wantM = !day && GAME.night > 0.8 ? ATMO.MOTHS : 0;
  if (kit.life.day.includes('butterfly') && count('butterfly') < wantB) L.push({ type: 'butterfly', x: W + 30, y: 250 + atmoRng() * 120, ph: atmoRng() * 6, hue: Math.floor(atmoRng() * 3), age: 0 });
  if (kit.life.night.includes('firefly') && count('firefly') < wantF) L.push({ type: 'firefly', x: atmoRng() * W, y: 300 + atmoRng() * 180, ph: atmoRng() * 6, layer: atmoRng() < 0.6 ? 1 : 1.45, age: 0 });
  if (kit.life.night.includes('moth') && count('moth') < wantM) L.push({ type: 'moth', x: 0, y: 0, ph: atmoRng() * 6, age: 0 });
  GAME.nextBird = GAME.nextBird ?? GAME.t + lerp(...ATMO.BIRD_EVERY_S, atmoRng());
  GAME.nextBat = GAME.nextBat ?? GAME.t + lerp(...ATMO.BAT_EVERY_S, atmoRng());
  if (day && kit.life.day.includes('bird') && GAME.t > GAME.nextBird) { GAME.nextBird = GAME.t + lerp(...ATMO.BIRD_EVERY_S, atmoRng()); L.push({ type: 'bird', x: W + 40, y: 60 + atmoRng() * 140, ph: 0, age: 0 }); }
  if (!day && kit.life.night.includes('bat') && GAME.t > GAME.nextBat) { GAME.nextBat = GAME.t + lerp(...ATMO.BAT_EVERY_S, atmoRng()); L.push({ type: 'bat', x: W + 40, y: 70 + atmoRng() * 120, ph: 0, age: 0 }); }

  for (let i = L.length - 1; i >= 0; i--) {
    const e = L[i]; e.age += dt; e.ph += dt;
    if (e.type === 'butterfly') { e.x -= (GAME.speed * 0.45 + 25) * dt; e.y += Math.sin(e.ph * 2.3) * 22 * dt; if (e.x < -40 || !day) L.splice(i, 1); }
    else if (e.type === 'bird') { e.x -= (GAME.speed * 0.05 + 170) * dt; e.y += Math.sin(e.ph * 1.5) * 8 * dt; if (e.x < -60) L.splice(i, 1); }
    else if (e.type === 'firefly') { e.x -= GAME.speed * e.layer * dt - Math.sin(e.ph * 1.7) * 18 * dt; e.y += Math.cos(e.ph * 1.3) * 14 * dt; if (e.x < -20) e.x = W + 20; if (day) L.splice(i, 1); }
    else if (e.type === 'moth') { if (GAME.night < 0.5) L.splice(i, 1); }
    else if (e.type === 'bat') { e.x -= (GAME.speed * 0.05 + 260) * dt; e.y += Math.sin(e.ph * 4) * 30 * dt; if (e.x < -60) L.splice(i, 1); }
  }
}
export function drawLife(ctx, t, layer, v) {
  for (const e of GAME.life) {
    if (layer === 'sky' && e.type === 'bird') {
      const flap = Math.sin(t * 9 + e.ph) * 6;
      ctx.strokeStyle = 'rgba(30,40,40,0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(e.x - 12, e.y - flap); ctx.quadraticCurveTo(e.x - 4, e.y + 2, e.x, e.y); ctx.quadraticCurveTo(e.x + 4, e.y + 2, e.x + 12, e.y - flap); ctx.stroke();
    } else if (layer === 'sky' && e.type === 'bat') {
      const flap = Math.sin(t * 16 + e.ph) * 7;
      ctx.fillStyle = 'rgba(8,10,14,0.9)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.quadraticCurveTo(e.x - 8, e.y - 6 - flap, e.x - 16, e.y - flap); ctx.quadraticCurveTo(e.x - 9, e.y + 4, e.x, e.y + 3);
      ctx.quadraticCurveTo(e.x + 9, e.y + 4, e.x + 16, e.y - flap); ctx.quadraticCurveTo(e.x + 8, e.y - 6 - flap, e.x, e.y); ctx.fill();
    } else if (layer === 'mid' && e.type === 'butterfly') {
      const wing = Math.abs(Math.sin(t * 11 + e.ph)) * 7 + 2, col = ['#e8a23a', '#f2e6c8', '#d9773a'][e.hue];
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(e.x - wing * 0.6, e.y, wing, 4, -0.4, 0, Math.PI * 2); ctx.ellipse(e.x + wing * 0.6, e.y, wing, 4, 0.4, 0, Math.PI * 2); ctx.fill();
    } else if ((layer === 'near' && e.type === 'firefly' && e.layer === 1) || (layer === 'fore' && e.type === 'firefly' && e.layer > 1)) {
      const blink = Math.max(0, Math.sin(t * 1.1 + e.ph * 3)) ** 3 * GAME.night;   // 6e: slower blink
      if (blink < 0.05) continue;
      const r = e.layer > 1 ? 4 : 3;
      ctx.fillStyle = `rgba(200,240,120,${0.25 * blink})`; ctx.beginPath(); ctx.arc(e.x, e.y, r * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(230,255,170,${blink})`; ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.6, 0, Math.PI * 2); ctx.fill();
    } else if (layer === 'fore' && e.type === 'moth') {
      const hs = GAME.jon.headScreen, ang = e.ph * 3.1 + e.ph * 0.7, rr = 40 + Math.sin(e.ph * 2.3) * 22;
      const x = hs.x + 60 + Math.cos(ang) * rr, y = hs.y - 10 + Math.sin(ang * 1.3) * rr * 0.6, flap = Math.abs(Math.sin(t * 20 + e.ph)) * 3 + 1;
      ctx.fillStyle = `rgba(230,220,190,${0.6 * GAME.night})`;
      ctx.beginPath(); ctx.ellipse(x - flap, y, flap, 1.8, 0, 0, Math.PI * 2); ctx.ellipse(x + flap, y, flap, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// --- foot dust: each footfall spawns dust by surface `dust`, more with speed and on descents; mud splats instead ---
export function footfalls(j, J) {
  if (j.state !== 'run' || !j.grounded) { j.footBeat = null; return; }
  const beat = Math.floor((j.phase - Math.PI / 2) / Math.PI);
  if (j.footBeat === null || j.footBeat === undefined) { j.footBeat = beat; return; }
  if (beat === j.footBeat) return;
  j.footBeat = beat;
  const scale = JON.TARGET_PX / JON.FIGURE_UNITS, ankle = beat % 2 === 0 ? J.nAnkle : J.fAnkle;
  const sx = JON.X + ankle.x * scale, gy = RENDER.GROUND_Y + GAME.camY;
  const surf = SURFACES[GAME.surface];
  if (surf.dust === 0) { spawnDust(sx, gy, 2, '#2a1e12', 1.4); }                    // mud splat
  else {
    const n = Math.round(surf.dust * (1.5 + GAME.animSpeed / 140) * (j.gait === 'down' ? 1.6 : 1));
    if (n > 0) spawnDust(sx, gy, n);
  }
  AudioBed.footstep(GAME.surface);
}
