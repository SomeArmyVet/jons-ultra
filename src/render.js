// ===== MODULE: render =====
// Layer painter, parallax, night overlay, particles, race furniture (aid stations, finish line, crowd, pacer), screen shake.
import { ENGINE, GAME, BIOMES, rng, hash, clamp, lerp, seg } from './engine.js';
import { JON, JON_PAL, drawJon, drawLimb, viewerRender } from './jon.js';
import { SIM, DIFFICULTY, SURFACES, paletteAt, courseElev, courseSurface, pickupAt } from './sim.js';
import { RACE, bonusActive } from './race.js';
import { UI, UI_FONT, drawHUD, drawIntroCard, drawAidCard, drawDNFCard, drawFinishCard, drawToasts, drawPause } from './ui.js';
import { parseHM, drawLife, drawRain } from './atmosphere.js';

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
  if (GAME.night > 0) drawNight(ctx, GAME.night, j.headScreen);
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
function drawNight(ctx, amount, headScreen) {
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
  ctx.drawImage(off, 0, 0, ENGINE.W, ENGINE.H);
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

// Spectator: simple standing figure, arms up on its own rhythm. Katie/Emma variants add glasses+fringe and a sign.
const CROWD_TOPS = ['#c84a4a', '#3d7cc9', '#e0a33a', '#5aa36a', '#8b5cb8', '#e07a9a', '#2c9c9c', '#d96b3b'];
function drawSpectator(ctx, x, y, s, seed2, t, who) {
  const h1 = hash(seed2 * 31 + 7), h2 = hash(seed2 * 53 + 11), h3 = hash(seed2 * 71 + 3);
  const skin = ['#C58E62', '#8d5a3b', '#e9b98f', '#6b4128'][Math.floor(h2 * 4)], top = CROWD_TOPS[Math.floor(h1 * CROWD_TOPS.length)];
  const wave = Math.sin(t * 3.2 + h3 * Math.PI * 2);                  // staggered rhythm per person
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#2b2b30'; ctx.fillRect(-7, -34, 5.5, 34); ctx.fillRect(1.5, -34, 5.5, 34);       // legs
  ctx.fillStyle = top; ctx.beginPath(); ctx.roundRect(-10, -66, 20, 34, 4); ctx.fill();               // torso
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -76, 9.5, 0, Math.PI * 2); ctx.fill();            // head
  ctx.fillStyle = ['#3B2416', '#1A1A1A', '#8a5a2a', '#d9b06a'][Math.floor(h3 * 4)];
  ctx.beginPath(); ctx.arc(0, -78, 10, Math.PI, Math.PI * 2); ctx.fill();                              // hair
  if (who === 'katie') {                                                 // glasses + fringe (from your brief; rest awaits the cast sheet)
    ctx.fillStyle = '#3B2416'; ctx.fillRect(-10, -80, 20, 6);
    ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-4, -74, 3.2, 0, Math.PI * 2); ctx.arc(4, -74, 3.2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.8, -74); ctx.lineTo(0.8, -74); ctx.stroke();
  }
  // arms: up when the wave is high, otherwise down at the sides
  const up = who ? 0.75 + 0.25 * wave : 0.5 + 0.5 * wave;
  ctx.strokeStyle = skin; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const a = lerp(0.3, 2.6, who ? (side < 0 ? up : 1 - up * 0.3) : up) * side;   // Katie/Emma: one arm holds, the other waves
    ctx.beginPath(); ctx.moveTo(side * 9, -62); ctx.lineTo(side * 9 + Math.sin(a) * 22 * side, -62 + Math.cos(a) * 22); ctx.stroke();
  }
  if (who === 'emma') {                                                  // the GO JON sign, held high
    ctx.fillStyle = '#F2F0E6'; ctx.fillRect(-26, -122, 52, 30);
    ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5; ctx.strokeRect(-26, -122, 52, 30);
    ctx.fillStyle = '#c84a4a'; ctx.font = '700 14px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GO JON', 0, -107);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-2, -92, 4, 30);
  }
  ctx.restore();
}
// Placeholder tortoise. The cast sheet decides who this is; for the test loop it sits at the foot of the finish post, near side.
function drawTortoise(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#5a6b3a'; ctx.beginPath(); ctx.ellipse(0, -8, 16, 10, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3d4a26'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.moveTo(0, -17); ctx.lineTo(0, -8); ctx.moveTo(-5, -15); ctx.lineTo(-5, -9); ctx.moveTo(5, -15); ctx.lineTo(5, -9); ctx.stroke();
  ctx.fillStyle = '#8c9a5a';
  ctx.fillRect(-13, -8, 6, 6); ctx.fillRect(7, -8, 6, 6);
  const bob = Math.sin(t * 1.5) * 1.2;
  ctx.beginPath(); ctx.ellipse(19, -10 + bob, 5.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(21, -11 + bob, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Finish line: banner over the trail, tape until it's broken, crowd on both sides, Katie and Emma front row near side.
export function finishAbsMile() { return GAME.stations[GAME.stations.length - 1].absMile; }
function drawFinishLine(ctx, view, t, layer) {
  const fx = absMileToScreenX(finishAbsMile());
  if (fx < -300 || fx > view.W + 400) return;
  const gy = view.groundAt(fx);
  if (layer === 'back') {
    // far-side crowd (behind the trail)
    for (let i = 0; i < RACE.CROWD_N; i++) {
      if (hash(i * 19 + 1) > 0.5) continue;
      const dx = -RACE.CROWD_PX + hash(i * 23 + 5) * (RACE.CROWD_PX + 60);
      const x = fx + dx; drawSpectator(ctx, x, view.groundAt(x) - 10, 0.9, i, t, null);
    }
    // posts + banner
    ctx.fillStyle = '#6a5a3a'; ctx.fillRect(fx - 3, gy - 190, 6, 190); ctx.fillRect(fx + 84 - 3, gy - 190, 6, 190);
    ctx.fillStyle = '#c84a4a'; ctx.fillRect(fx - 10, gy - 190, 104, 34);
    ctx.fillStyle = '#F2F0E6'; ctx.font = '700 20px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FINISH', fx + 42, gy - 173);
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
    // near-side crowd (in front of the trail), Katie and Emma front row, tortoise at the post
    for (let i = 0; i < RACE.CROWD_N; i++) {
      if (hash(i * 19 + 1) <= 0.5) continue;
      const dx = -RACE.CROWD_PX + hash(i * 23 + 5) * (RACE.CROWD_PX + 60);
      if (dx > -110 && dx < -20) continue;                                 // leave the front-row spot for Katie and Emma
      const x = fx + dx; drawSpectator(ctx, x, view.groundAt(x) + 14, 1.05, i + 100, t, null);
    }
    const ke = katieEmmaScreen(view);
    drawSpectator(ctx, ke.katie.x, ke.katie.y, 1.08, 501, t, 'katie');
    drawSpectator(ctx, ke.emma.x, ke.emma.y, 1.0, 502, t, 'emma');
    drawTortoise(ctx, fx + 14, gy + 16, t);
  }
}
function katieEmmaScreen(view) {
  const fx = absMileToScreenX(finishAbsMile());
  return { katie: { x: fx - 78, y: view.groundAt(fx - 78) + 14 }, emma: { x: fx - 44, y: view.groundAt(fx - 44) + 14 } };
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
