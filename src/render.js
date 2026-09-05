// ===== MODULE: render =====
// Layer painter, parallax, night overlay, particles, race furniture (aid stations, finish line, crowd, pacer), screen shake.
import { ENGINE, GAME, BIOMES, rng, clamp, lerp, seg } from './engine.js';
import { JON, JON_PAL, drawJon, drawLimb, viewerRender } from './jon.js';
import { SIM, DIFFICULTY, SURFACES, paletteAt, courseElev, courseSurface, pickupAt } from './sim.js';
import { RACE, bonusActive } from './race.js';
import { UI, UI_FONT, drawHUD, drawIntroCard, drawAidCard, drawDNFCard, drawFinishCard, drawToasts, drawPause } from './ui.js';
import { parseHM, drawLife, drawRain } from './atmosphere.js';
import { drawSpectator, drawKatie, drawEmma, drawTortoise, finishCrowdLayout } from './cast.js';

export const RENDER = { GROUND_Y: 432 };   // ground line at ~60% of frame height

export function render(ctx, tReal) {
  if (GAME.viewer.on) { viewerRender(ctx, tReal); return; }
  const kit = BIOMES[GAME.course.biome], pal = paletteAt(kit, GAME.hour);
  const groundY = RENDER.GROUND_Y + GAME.camY;
  const view = {
    scroll: GAME.scroll, W: ENGINE.W, H: ENGINE.H, groundY,
    // Ground line relative to Jon: the world tilts, Jon's feet stay put.
    groundAt: sx => groundY - (courseElev(GAME.course, GAME.mile + (sx - JON.X) / SIM.PX_PER_MILE) - GAME.elev) * SIM.FT_TO_PX,
    surfaceAt: sx => courseSurface(GAME.course, GAME.mile + (sx - JON.X) / SIM.PX_PER_MILE),
    // Parallax layers sink as Jon climbs, so height gained reads against the ridges.
    ridgeShift: (GAME.elev - GAME.course.altitudeFeet.min) / (GAME.course.altitudeFeet.max - GAME.course.altitudeFeet.min) * 70
  };
  const t = GAME.t;
  view.hour = GAME.hour; view.moon = GAME.course.moon; view.sun = { rise: parseHM(GAME.course.sun.rise), set: parseHM(GAME.course.sun.set) };
  view.mistAmount = GAME.mistAmount;

  ctx.save();
  if (GAME.shake > 0) ctx.translate((shakeRng() - 0.5) * 2 * GAME.shake, (shakeRng() - 0.5) * 2 * GAME.shake);
  const zk = finishZoom();
  if (zk > 0) {                                                       // camera eases toward Katie and Emma
    const ke = katieEmmaScreen(view), fx = (ke.katie.x + ke.emma.x) / 2, fy = ke.katie.y - 70;
    const z = 1 + RACE.FINISH_ZOOM * zk;
    ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy);
  }
  kit.sky(ctx, pal, t, view);
  kit.farRidge(ctx, pal, t, view);
  drawLife(ctx, t, 'sky', view);
  kit.midRidge(ctx, pal, t, view);
  drawLife(ctx, t, 'mid', view);
  kit.nearVegetation(ctx, pal, t, view);
  kit.ground(ctx, pal, t, view);
  drawAidStations(ctx, view);
  drawFinishLine(ctx, view, t, 'back');
  drawGroundShadow(ctx, JON.X, groundY, GAME.jon.y, -GAME.grade * SIM.FT_TO_PX, JON.TARGET_PX / JON.FIGURE_UNITS);
  drawPickups(ctx, view);
  drawPacer(ctx, view, t);
  particlesDraw(ctx);

  // Interpolate Jon's height between physics steps so 100–144 Hz screens don't judder.
  const j = GAME.jon;
  const yDraw = j.grounded ? 0 : lerp(j.prevY, j.y, GAME.alpha);
  const glassesOnCap = GAME.hour >= 17.75 || GAME.hour < 6.25;
  drawJon(ctx, JON_PAL, t, j, JON.X, groundY - yDraw, JON.TARGET_PX / JON.FIGURE_UNITS, yDraw, { glassesOnCap, lamp: GAME.night });

  drawFinishLine(ctx, view, t, 'front');
  kit.foreground(ctx, pal, t, view);
  drawRain(ctx, pal, view);
  if (GAME.night > 0) drawNight(ctx, GAME.night, j.headScreen, view);
  drawLife(ctx, t, 'near', view);                                   // fireflies and moths are light sources: over the darkness
  drawLife(ctx, t, 'fore', view);
  drawMeterEffects(ctx, t);
  ctx.restore();
  drawHUD(ctx);
  UI.buttons = [];
  if (GAME.screen === 'intro') drawIntroCard(ctx);
  else if (GAME.aid) drawAidCard(ctx);
  else if (GAME.screen === 'dnf') drawDNFCard(ctx);
  else if (GAME.screen === 'finish' && GAME.finish.t > RACE.FINISH_HOLD_S) drawFinishCard(ctx);
  drawToasts(ctx);
  if (GAME.paused) drawPause(ctx);
}

const shakeRng = rng(0x5a4e0);
// --- night: darkness overlay with the headlamp cone cut out. Drawn after the world, before the HUD. ---
let nightCanvas = null;
function getNightCanvas() {
  if (!nightCanvas) {
    nightCanvas = document.createElement('canvas');
    nightCanvas.width = ENGINE.W; nightCanvas.height = ENGINE.H;
  }
  return nightCanvas;
}
const LAMP = { LEN: 560, HALF: 0.34, PITCH: 0.14, HALO: 95 };
// Finish floodlights (cast sheet §8): warm pool over the last ~250 px so the tape, trail and front-row
// crowd stay visible at full night. Two pools, one per post light, punched out of the darkness like the
// headlamp cone. This is what lets Jon see faces at a night finish.
const FLOOD = { R: 230, CY: 55, OFF_X: 60, WARM: 0.10 };
function floodCenters(view) {
  const fx = absMileToScreenX(finishAbsMile());
  if (fx < -400 || fx > view.W + 400) return null;
  const gy = view.groundAt(fx);
  return { fx, gy, centers: [[fx - FLOOD.OFF_X, gy - FLOOD.CY], [fx + FLOOD.OFF_X, gy - FLOOD.CY]] };
}
function drawNight(ctx, amount, headScreen, view) {
  const D = DIFFICULTY[GAME.diff];
  const ambient = clamp(D.nightAmbient + (GAME.course.moon === 'full' ? 0.3 : 0), 0, 0.9);
  const alpha = amount * (1 - ambient);
  if (alpha <= 0.01) return;
  const off = getNightCanvas(), o = off.getContext('2d');
  o.globalCompositeOperation = 'source-over';
  o.clearRect(0, 0, ENGINE.W, ENGINE.H);
  o.fillStyle = `rgba(4, 8, 14, ${alpha})`; o.fillRect(0, 0, ENGINE.W, ENGINE.H);
  const { x: hx, y: hy } = headScreen;
  o.globalCompositeOperation = 'destination-out';
  // Three nested wedges feather the cone edge; the radial gradient fades it with distance.
  const lampLen = LAMP.LEN * (bonusActive('battery') ? RACE.BATTERY_LAMP_MUL : 1);
  const g = o.createRadialGradient(hx, hy, 12, hx, hy, lampLen);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  o.fillStyle = g;
  for (const [half, a] of [[LAMP.HALF, 0.5], [LAMP.HALF * 0.78, 0.6], [LAMP.HALF * 0.55, 0.8]]) {
    o.globalAlpha = a;
    o.beginPath(); o.moveTo(hx, hy); o.arc(hx, hy, lampLen, LAMP.PITCH - half, LAMP.PITCH + half); o.closePath(); o.fill();
  }
  o.globalAlpha = 1;
  const halo = o.createRadialGradient(hx, hy, 0, hx, hy, LAMP.HALO);
  halo.addColorStop(0, 'rgba(0,0,0,0.75)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
  o.fillStyle = halo; o.beginPath(); o.arc(hx, hy, LAMP.HALO, 0, Math.PI * 2); o.fill();
  // floodlight pools: still in destination-out, so they cut the darkness away over the finish area
  const flood = floodCenters(view);
  if (flood) for (const [cx, cy] of flood.centers) {
    const fg = o.createRadialGradient(cx, cy, 30, cx, cy, FLOOD.R);
    fg.addColorStop(0, 'rgba(0,0,0,0.96)'); fg.addColorStop(0.55, 'rgba(0,0,0,0.8)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = fg; o.beginPath(); o.arc(cx, cy, FLOOD.R, 0, Math.PI * 2); o.fill();
  }
  ctx.drawImage(off, 0, 0, ENGINE.W, ENGINE.H);
  if (flood) {                                                        // warm wash inside the pools
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = FLOOD.WARM * amount;
    for (const [cx, cy] of flood.centers) {
      const wf = ctx.createRadialGradient(cx, cy, 10, cx, cy, FLOOD.R);
      wf.addColorStop(0, '#ffd890'); wf.addColorStop(1, 'rgba(255,216,144,0)');
      ctx.fillStyle = wf; ctx.beginPath(); ctx.arc(cx, cy, FLOOD.R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // Warm beam wash inside the cone.
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.10 * amount;
  const wg = ctx.createRadialGradient(hx, hy, 10, hx, hy, LAMP.LEN * 0.8);
  wg.addColorStop(0, '#ffd890'); wg.addColorStop(1, 'rgba(255,216,144,0)');
  ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.arc(hx, hy, LAMP.LEN * 0.8, LAMP.PITCH - LAMP.HALF, LAMP.PITCH + LAMP.HALF); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Bonk: desaturate; empty meters: heartbeat vignette (Design Bible §8).
function drawMeterEffects(ctx, t) {
  if (GAME.bonk) {
    ctx.save();
    try { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.75)'; ctx.fillRect(0, 0, ENGINE.W, ENGINE.H); }
    catch (e) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(120,120,120,0.25)'; ctx.fillRect(0, 0, ENGINE.W, ENGINE.H); }
    ctx.restore();
  }
  if (GAME.bonk || GAME.cramp) {
    const beat = 0.5 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 7.5)), 4);
    const vg = ctx.createRadialGradient(ENGINE.W / 2, ENGINE.H / 2, ENGINE.H * 0.35, ENGINE.W / 2, ENGINE.H / 2, ENGINE.H * 0.85);
    vg.addColorStop(0, 'rgba(60,0,0,0)'); vg.addColorStop(1, `rgba(60,0,0,${0.35 * beat})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, ENGINE.W, ENGINE.H);
  }
}
function drawPickups(ctx, view) {
  const i0 = Math.floor((GAME.mile - 0.1) / SIM.PICKUP_SPACING), i1 = Math.floor((GAME.mile + 0.3) / SIM.PICKUP_SPACING) + 1;
  for (let i = i0; i <= i1; i++) {
    const p = pickupAt(i);
    if (!p || GAME.collected.has(i)) continue;
    const x = JON.X + (p.mile - GAME.mile) * SIM.PX_PER_MILE;
    if (x < -30 || x > view.W + 30) continue;
    const y = view.groundAt(x) - 12 + Math.sin(GAME.t * 3 + i) * 2;
    ctx.save(); ctx.translate(x, y);
    if (p.type === 'gel') {
      ctx.fillStyle = '#E36A2B'; ctx.beginPath(); ctx.roundRect(-7, -9, 14, 18, 3); ctx.fill();
      ctx.fillStyle = '#F5D021'; ctx.fillRect(-4, -9, 8, 4);
    } else if (p.type === 'flask') {
      ctx.fillStyle = '#A9C7D6'; ctx.beginPath(); ctx.roundRect(-6, -10, 12, 20, 4); ctx.fill();
      ctx.fillStyle = '#2E7BD6'; ctx.fillRect(-3.5, -13, 7, 4);
    } else if (p.type === 'saltTab') {
      ctx.fillStyle = '#F2F0E6'; ctx.beginPath(); ctx.roundRect(-6, -4, 12, 8, 4); ctx.fill();
      ctx.strokeStyle = '#b9b6a8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke();
    } else if (p.type === 'bacon') {
      ctx.strokeStyle = '#a53d2a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-5, -6, 0, 0); ctx.quadraticCurveTo(5, 6, 10, 0); ctx.stroke();
      ctx.strokeStyle = '#e8a07a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-5, -6, 0, 0); ctx.quadraticCurveTo(5, 6, 10, 0); ctx.stroke();
    } else if (p.type === 'spamMusubi') {
      ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.roundRect(-9, -6, 18, 13, 2); ctx.fill();   // rice block
      ctx.fillStyle = '#c05a4a'; ctx.fillRect(-9, -6, 18, 5);                                     // spam layer
      ctx.fillStyle = '#223018'; ctx.fillRect(-3, -6, 6, 13);                                     // nori band
    } else if (p.type === 'flatCoke') {
      ctx.fillStyle = '#c8322e'; ctx.beginPath(); ctx.roundRect(-6, -10, 12, 18, 2); ctx.fill();
      ctx.fillStyle = '#8e2320'; ctx.fillRect(-6, -10, 12, 4);
    } else {
      ctx.fillStyle = '#E0338F'; ctx.beginPath(); ctx.moveTo(-11, -7); ctx.lineTo(11, -7); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1F8A4C'; ctx.fillRect(-11, -9, 22, 3);
    }
    ctx.restore();
  }
  ctx.font = '600 14px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of GAME.floaters) { ctx.fillStyle = `rgba(234,243,228,${1 - f.age / 1.2})`; ctx.fillText('+ ' + f.text, f.x, f.y); }
}

// --- race furniture in the world: aid stations, finish banner, crowd, pacer ---
function absMileToScreenX(absMile) { return JON.X + (absMile - GAME.mile) * SIM.PX_PER_MILE; }

function drawAidStations(ctx, view) {
  for (let i = Math.max(0, GAME.nextIdx - 1); i < Math.min(GAME.stations.length, GAME.nextIdx + 2); i++) {
    const occ = GAME.stations[i]; if (occ.isFinish) continue;
    const x = absMileToScreenX(occ.absMile);
    if (x < -160 || x > view.W + 160) continue;
    const y = view.groundAt(x);
    // tent behind the trail
    ctx.fillStyle = '#c94a3a';
    ctx.beginPath(); ctx.moveTo(x - 70, y - 4); ctx.lineTo(x - 10, y - 92); ctx.lineTo(x + 50, y - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.moveTo(x - 10, y - 92); ctx.lineTo(x + 50, y - 4); ctx.lineTo(x + 18, y - 4); ctx.closePath(); ctx.fill();
    // table with cups
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x + 56, y - 30, 60, 5); ctx.fillRect(x + 60, y - 25, 4, 22); ctx.fillRect(x + 108, y - 25, 4, 22);
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? '#F5D021' : '#7FD1FF'; ctx.fillRect(x + 60 + k * 10, y - 38, 6, 8); }
    // sign
    ctx.fillStyle = '#F2F0E6'; ctx.fillRect(x - 60, y - 128, 120, 26);
    ctx.fillStyle = '#1A1A1A'; ctx.font = '600 13px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(occ.station.name.split(' (')[0], x, y - 115);
    ctx.fillStyle = '#6a5a3a'; ctx.fillRect(x - 2, y - 102, 4, 98);
  }
}

// Finish line: banner over the trail, tape until it's broken, crowd on both sides, Katie and Emma front row near side.
export function finishAbsMile() { return GAME.stations[GAME.stations.length - 1].absMile; }
function drawFinishLine(ctx, view, t, layer) {
  const fx = absMileToScreenX(finishAbsMile());
  if (fx < -300 || fx > view.W + 400) return;
  const gy = view.groundAt(fx);
  if (layer === 'back') {
    // back row, far side of the trail: 80% size, darker (cast sheet §6)
    for (const c of finishCrowdLayout()) {
      if (c.row !== 'back') continue;
      const x = fx + c.dx;
      if (x < -40 || x > view.W + 40) continue;
      drawSpectator(ctx, x, view.groundAt(x) - 10, c.scale, c.seed, t, true);
    }
    // posts + banner
    ctx.fillStyle = '#6a5a3a'; ctx.fillRect(fx - 3, gy - 190, 6, 190); ctx.fillRect(fx + 84 - 3, gy - 190, 6, 190);
    ctx.fillStyle = '#c84a4a'; ctx.fillRect(fx - 10, gy - 190, 104, 34);
    ctx.fillStyle = '#F2F0E6'; ctx.font = '700 20px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FINISH', fx + 42, gy - 173);
    // floodlights on both posts, housings angled at the trail; their pool is cut out of the night overlay
    for (const [px2, dir] of [[fx, 1], [fx + 84, -1]]) {
      ctx.fillStyle = '#3a3a3e'; ctx.fillRect(px2 - 2, gy - 204, 4, 16);
      ctx.save(); ctx.translate(px2, gy - 204); ctx.rotate(dir * 0.5);
      ctx.fillStyle = '#2b2b30'; ctx.beginPath(); ctx.roundRect(-6, -8, 12, 9, 2); ctx.fill();
      ctx.fillStyle = GAME.night > 0.05 ? `rgba(255,224,150,${0.55 + 0.45 * GAME.night})` : '#cfd3d8';
      ctx.fillRect(-4.5, -1.5, 9, 2.5);
      ctx.restore();
    }
    // tape at hip height until Jon crosses it
    const broken = GAME.screen === 'finish';
    ctx.strokeStyle = '#F5D021'; ctx.lineWidth = 4;
    if (!broken) { ctx.beginPath(); ctx.moveTo(fx, gy - 70); ctx.lineTo(fx + 84, gy - 70); ctx.stroke(); }
    else {
      const fl = Math.sin(t * 5) * 6;
      ctx.beginPath(); ctx.moveTo(fx, gy - 70); ctx.quadraticCurveTo(fx + 10, gy - 40 + fl, fx + 4, gy - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx + 84, gy - 70); ctx.quadraticCurveTo(fx + 74, gy - 40 - fl, fx + 80, gy - 10); ctx.stroke();
    }
  } else {
    // front row, near side: full size, floodlit; Katie and Emma keep a clear gap either side
    for (const c of finishCrowdLayout()) {
      if (c.row !== 'front') continue;
      const x = fx + c.dx;
      if (x < -40 || x > view.W + 40) continue;
      drawSpectator(ctx, x, view.groundAt(x) + 14, c.scale, c.seed, t, false);
    }
    // Katie and Emma bounce only when the camera starts easing toward them (cast sheet §4.3).
    const cheer = finishZoom();
    const ke = katieEmmaScreen(view);
    drawKatie(ctx, ke.katie.x, ke.katie.y, 1.08, t, cheer);
    drawEmma(ctx, ke.emma.x, ke.emma.y, 1.0, t, cheer);
    drawFinishTortoise(ctx, view, fx, gy, t);
  }
}
// Tortoise placement comes from the race config (`tortoise.where`, cast sheet §5/§7). "aidTable" draws the
// finish aid table with him underneath, one leg mid-step; anything else falls back to the finish post.
function drawFinishTortoise(ctx, view, fx, gy, t) {
  const where = (GAME.course.tortoise && GAME.course.tortoise.where) || 'post';
  if (where === 'aidTable') {
    const tx = fx + 150, ty = view.groundAt(tx) + 14;
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(tx - 28, ty - 26, 56, 5); ctx.fillRect(tx - 24, ty - 21, 4, 20); ctx.fillRect(tx + 20, ty - 21, 4, 20);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#F5D021' : '#7FD1FF'; ctx.fillRect(tx - 22 + k * 12, ty - 34, 6, 8); }
    drawTortoise(ctx, tx - 2, ty, t);
  } else {
    drawTortoise(ctx, fx + 14, gy + 16, t);
  }
}
// Katie is closest to the finish tape (cast sheet §2); Emma stands beside her.
function katieEmmaScreen(view) {
  const fx = absMileToScreenX(finishAbsMile());
  return { katie: { x: fx - 44, y: view.groundAt(fx - 44) + 14 }, emma: { x: fx - 78, y: view.groundAt(fx - 78) + 14 } };
}
// Camera ease toward Katie and Emma over the last ZOOM_LEAD_S seconds, held through the finish.
function finishZoom() {
  if (GAME.screen === 'finish') return 1;
  const distPx = (finishAbsMile() - GAME.mile) * SIM.PX_PER_MILE;
  if (distPx > 1600) return 0;
  const tTo = distPx / Math.max(GAME.speed, 40);
  return clamp(1 - tTo / RACE.ZOOM_LEAD_S, 0, 1);
}

// Pacer: a plainer runner behind Jon for one segment. Points at pickups ahead.
function drawPacer(ctx, view, t) {
  const p = GAME.pacer; if (!p) return;
  const scale = JON.TARGET_PX / JON.FIGURE_UNITS * 0.92;
  const x = JON.X + RACE.PACER_X_OFFSET, gy = view.groundAt(x);
  const ph = p.phase, bob = -Math.abs(Math.sin(ph)) * 3;
  ctx.save(); ctx.translate(x, gy + bob * scale); ctx.scale(scale, scale);
  const leg = (q, col) => {
    const hip = 0.6 * Math.sin(q), rec = Math.max(0, Math.cos(q)), knee = 0.2 + 1.3 * rec * rec;
    const k = seg({ x: 0, y: -62 }, 30, hip), a = seg(k, 30, hip - knee);
    drawLimb(ctx, { x: 0, y: -62 }, k, 9, col); drawLimb(ctx, k, a, 8, col);
    ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.roundRect(a.x - 6, a.y - 1, 16, 6, 3); ctx.fill();
  };
  leg(ph + Math.PI, '#a8744f');
  ctx.fillStyle = '#2c9c9c'; ctx.beginPath(); ctx.roundRect(-9, -104, 18, 44, 5); ctx.fill();                 // teal top
  ctx.fillStyle = '#1f2a44'; ctx.beginPath(); ctx.roundRect(-10, -66, 20, 16, 3); ctx.fill();                 // navy shorts
  leg(ph, '#c48a62');
  const sh = { x: 1, y: -100 };
  for (const [q, col] of [[ph + Math.PI, '#a8744f'], [ph, '#c48a62']]) {
    const e = seg(sh, 20, -0.7 * Math.sin(q)), h = seg(e, 18, -0.7 * Math.sin(q) + 1.7);
    drawLimb(ctx, sh, e, 7, col); drawLimb(ctx, e, h, 6, col);
  }
  ctx.fillStyle = '#c48a62'; ctx.beginPath(); ctx.arc(2, -116, 11, 0, Math.PI * 2); ctx.fill();               // head
  ctx.fillStyle = '#c84a4a'; ctx.beginPath(); ctx.arc(2, -119, 12.5, Math.PI, Math.PI * 2); ctx.fill();       // red cap
  ctx.fillRect(2, -120, 22, 4);
  if (p.shield) { ctx.strokeStyle = 'rgba(216,226,74,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -70, 52, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  // callouts: arrow over the next pickup within reach
  const i0 = Math.floor(GAME.mile / SIM.PICKUP_SPACING), i1 = Math.floor((GAME.mile + RACE.PACER_CALLOUT_PX / SIM.PX_PER_MILE) / SIM.PICKUP_SPACING) + 1;
  for (let i = i0; i <= i1; i++) {
    const pk = pickupAt(i); if (!pk || GAME.collected.has(i) || pk.mile <= GAME.mile) continue;
    const px = absMileToScreenX(pk.mile), py = view.groundAt(px) - 34 + Math.sin(t * 6) * 4;
    ctx.fillStyle = '#F5D021'; ctx.beginPath(); ctx.moveTo(px, py + 8); ctx.lineTo(px - 7, py - 4); ctx.lineTo(px + 7, py - 4); ctx.closePath(); ctx.fill();
    break;
  }
}

// Soft contact shadow: follows the slope, shrinks and fades when airborne.
function drawGroundShadow(ctx, x, groundY, heightPx, slope, scale) {
  const k = 1 / (1 + heightPx / 90);
  ctx.save();
  ctx.translate(x + 4 * scale, groundY + 3); ctx.rotate(Math.atan(slope));
  ctx.fillStyle = `rgba(20,14,6,${0.10 * k})`;
  ctx.beginPath(); ctx.ellipse(0, 0, 34 * scale * (0.7 + 0.3 * k), 7 * scale * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(20,14,6,${0.20 * k})`;
  ctx.beginPath(); ctx.ellipse(0, 0, 24 * scale * (0.7 + 0.3 * k), 4.5 * scale * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const particleRng = rng(0xd0d0);
export function spawnDust(x, y, n, color, sizeMul) {
  for (let i = 0; i < n; i++) {
    const a = particleRng();
    GAME.particles.push({
      x: x + (particleRng() - 0.5) * 18, y: y - particleRng() * 4,
      vx: -60 - a * 120, vy: -20 - particleRng() * 40,
      r: (2 + particleRng() * 3) * (sizeMul || 1), life: 0.45 + particleRng() * 0.25, age: 0, color: color || '#8a7a5a'
    });
  }
}
export function particlesStep(dt) {
  const ps = GAME.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.vx *= 0.96;
    if (p.age >= p.life) ps.splice(i, 1);
  }
}
function particlesDraw(ctx) {
  for (const p of GAME.particles) {
    const k = 1 - p.age / p.life;
    ctx.globalAlpha = k * 0.6; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * (1.6 - k * 0.6), p.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
