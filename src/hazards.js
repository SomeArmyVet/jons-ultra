// ===== MODULE: hazards =====
// Obstacle resolution and animal behaviours + their drawing functions. Obstacles resolve once as Jon's
// mile crosses them (jump over roots, duck the limb, slide the slab, hop or wade the streams); animals
// wake ahead of Jon when their time window matches, move, and can bite. A bite = hit; hitsPerFall hits
// in one segment = stumble-fall, never death (Design Bible §5–§6). Teleport test keys skip effects.
import { GAME, clamp } from './engine.js';
import { SIM, triggerStumble } from './sim.js';
import { JON } from './jon.js';
import { RENDER, spawnDust } from './render.js';
import { takeHit } from './race.js';
import { AudioBed } from './audio.js';

const HZ = {
  ROOT_CLEAR: 26,        // px of air Jon needs over a root web
  MUD_SLOW: 0.55, MUD_S: 1.0,
  WADE_SLOW: 0.6, WADE_S: 1.4, WADE_HYD: 4, WADE_EN: 3,
  TRIP_EN: 4,
  BOAR_SPEED: 260, MONGOOSE_SPEED: 420, RAT_SPEED: 380,
  CHICKEN_NOTICE: 260, CHICKEN_FLEE: 180, CHICKEN_FLEE_S: 1.2,
  WAKE_MI: 0.2,          // animals activate this far ahead of Jon
  DRAW_AHEAD_MI: 0.3
};

function timeOk(times) {
  if (!times || !times.length) return true;
  const n = GAME.night;
  for (const t of times) {
    if (t === 'night' && n > 0.6) return true;
    if ((t === 'dawn' || t === 'dusk') && n > 0.05 && n < 0.95) return true;
    if (t === 'day' && n < 0.4) return true;
  }
  return false;
}
function trip(j, energyCost) {
  triggerStumble(j);
  if (energyCost) GAME.energy = clamp(GAME.energy - energyCost, 0, 100);
  AudioBed.thud();
}

// Resolve one obstacle at the moment Jon's mile crosses it. Guard: a teleport (test keys) that lands
// far past an obstacle skips its effect instead of resolving a wall of them at once.
function resolveObstacle(o, j) {
  if (GAME.mile - o.mile > 0.05) return;
  const airborne = !j.grounded, y = j.y, duck = j.state === 'duck';
  if (o.type === 'rootWeb') {
    if (airborne && y > HZ.ROOT_CLEAR) return;
    trip(j, HZ.TRIP_EN);
  } else if (o.type === 'banyanLimb') {
    if (duck) return;
    trip(j, HZ.TRIP_EN + 1);
  } else if (o.type === 'slickRock') {
    if (duck || airborne) return;                              // slide across (or clear it)
    trip(j, 0);
  } else if (o.type === 'mudPit') {
    if (airborne && y > 10) return;
    GAME.slowT = Math.max(GAME.slowT, HZ.MUD_S); GAME.slowK = HZ.MUD_SLOW;
    spawnDust(JON.X, RENDER.GROUND_Y + GAME.camY, 5, '#2a1e12', 1.5);
    AudioBed.footstep('mud');
  } else if (o.type === 'streamCrossing') {
    if (airborne && y > 14) return;                            // rock-hopped it clean
    GAME.slowT = Math.max(GAME.slowT, HZ.WADE_S); GAME.slowK = HZ.WADE_SLOW;
    GAME.hydration = clamp(GAME.hydration + HZ.WADE_HYD, 0, 100);
    GAME.energy = clamp(GAME.energy - HZ.WADE_EN, 0, 100);
    GAME.floaters.push({ x: JON.X, y: RENDER.GROUND_Y + GAME.camY - 120, text: 'Wade', age: 0 });
    spawnDust(JON.X, RENDER.GROUND_Y + GAME.camY, 8, '#9fc4d4', 1.2);
    AudioBed.splash();
  }
}

function makeCritter(a) {
  return { type: a.type, x: a.mile * SIM.PX_PER_MILE, seed: a.seed, phase: (a.seed % 628) / 100,
           state: 'idle', t: 0, hitDone: false, gone: false };
}
function critterScreenX(c) { return JON.X + (c.x - GAME.scroll); }

function critterStep(c, dt, j) {
  c.t += dt; c.phase += dt * 10;
  const sx = critterScreenX(c), dx = sx - JON.X;
  if (c.type === 'boar') {
    c.x -= HZ.BOAR_SPEED * dt;                                 // charges down the trail at Jon
    if (!c.hitDone && Math.abs(dx) < 34 && j.y < 34) { c.hitDone = true; takeHit(); }
  } else if (c.type === 'mongoose') {
    c.x -= HZ.MONGOOSE_SPEED * dt;                             // darts under Jon's feet
    if (!c.hitDone && Math.abs(dx) < 20 && j.grounded) { c.hitDone = true; triggerStumble(j); }
  } else if (c.type === 'centipede') {
    if (!c.hitDone && Math.abs(dx) < 16 && j.grounded) { c.hitDone = true; takeHit(); }
  } else if (c.type === 'chicken') {
    if (c.state === 'idle' && dx < HZ.CHICKEN_NOTICE) c.state = 'flee';
    if (c.state === 'flee') { c.x += (GAME.speed * 0.5 + HZ.CHICKEN_FLEE) * dt; c.fleeT = (c.fleeT || 0) + dt; if (c.fleeT > HZ.CHICKEN_FLEE_S) c.gone = true; }
  } else if (c.type === 'rat') {
    c.x -= HZ.RAT_SPEED * dt;                                  // harmless night streak
  }
  if (sx < -90) c.gone = true;
}

export function hazardsStep(dt) {
  const sp = GAME.spawn; if (!sp) return;
  const j = GAME.jon;
  if (GAME.slowT > 0) GAME.slowT -= dt;
  // static obstacles: sorted; the index pointer resolves each exactly once
  while (GAME.obIdx < sp.obstacles.length && sp.obstacles[GAME.obIdx].mile <= GAME.mile) {
    resolveObstacle(sp.obstacles[GAME.obIdx], j);
    GAME.obIdx++;
  }
  // animals: wake within range if their time window matches now; otherwise they never appear
  while (GAME.anIdx < sp.animals.length && sp.animals[GAME.anIdx].mile <= GAME.mile + HZ.WAKE_MI) {
    const a = sp.animals[GAME.anIdx++];
    if (GAME.mile - a.mile > 0.02) continue;                   // teleported past
    if (!timeOk(a.time)) continue;
    GAME.critters.push(makeCritter(a));
  }
  for (let k = GAME.critters.length - 1; k >= 0; k--) {
    const c = GAME.critters[k];
    critterStep(c, dt, j);
    if (c.gone) GAME.critters.splice(k, 1);
  }
}

// ---- drawing ----
export function drawHazards(ctx, view, pal, t) {
  const sp = GAME.spawn; if (!sp) return;
  for (let i = Math.max(0, GAME.obIdx - 8); i < sp.obstacles.length; i++) {
    const o = sp.obstacles[i];
    if (o.mile > GAME.mile + HZ.DRAW_AHEAD_MI) break;
    const x = JON.X + (o.mile - GAME.mile) * SIM.PX_PER_MILE;
    if (x < -80 || x > view.W + 80) continue;
    const gy = view.groundAt(x);
    if (o.type === 'rootWeb') drawRootWeb(ctx, x, gy, pal, o.mile);
    else if (o.type === 'banyanLimb') drawBanyanLimb(ctx, x, gy, pal);
    else if (o.type === 'slickRock') drawSlickRock(ctx, x, gy, pal);
    else if (o.type === 'mudPit') drawMudPit(ctx, x, gy, t);
    else if (o.type === 'streamCrossing') drawStream(ctx, x, gy, t);
  }
  for (const c of GAME.critters) {
    const sx = critterScreenX(c);
    if (sx < -90 || sx > view.W + 90) continue;
    const gy = view.groundAt(sx);
    if (c.type === 'boar') drawBoar(ctx, sx, gy, c);
    else if (c.type === 'mongoose') drawMongoose(ctx, sx, gy, c);
    else if (c.type === 'centipede') drawCentipede(ctx, sx, gy, c);
    else if (c.type === 'chicken') drawChicken(ctx, sx, gy, c);
    else if (c.type === 'rat') drawRat(ctx, sx, gy, c);
  }
}

function drawRootWeb(ctx, x, gy, pal, seedMile) {
  const h = (seedMile * 37) % 1;
  ctx.strokeStyle = pal.root; ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x - 24, gy + 4); ctx.quadraticCurveTo(x - 6, gy - 22 - h * 6, x + 20, gy + 2); ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(x - 18, gy + 6); ctx.quadraticCurveTo(x + 4, gy - 14, x + 26, gy + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 26, gy + 2); ctx.quadraticCurveTo(x - 2, gy - 8, x + 12, gy - 16); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 8, gy + 6); ctx.quadraticCurveTo(x + 6, gy - 20, x + 22, gy - 4); ctx.stroke();
}
function drawBanyanLimb(ctx, x, gy, pal) {
  ctx.strokeStyle = pal.trunk; ctx.lineCap = 'round'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(x - 34, gy - 118); ctx.quadraticCurveTo(x - 6, gy - 78, x + 30, gy - 56); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x - 8, gy - 86); ctx.lineTo(x + 4, gy - 100); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 12, gy - 68); ctx.lineTo(x + 24, gy - 80); ctx.stroke();
  ctx.fillStyle = pal.canopy;                                   // leaves still on the fallen limb
  ctx.beginPath();
  ctx.ellipse(x + 6, gy - 102, 14, 8, -0.5, 0, Math.PI * 2);
  ctx.ellipse(x + 26, gy - 82, 12, 7, -0.5, 0, Math.PI * 2);
  ctx.fill();
}
function drawSlickRock(ctx, x, gy, pal) {
  ctx.fillStyle = pal.stone;
  ctx.beginPath(); ctx.ellipse(x, gy + 2, 30, 9, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';                     // wet sheen
  ctx.beginPath(); ctx.ellipse(x - 6, gy - 4, 14, 3, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(47,90,53,0.5)';                         // moss patches
  ctx.beginPath(); ctx.ellipse(x + 14, gy - 2, 5, 2.2, 0, 0, Math.PI * 2); ctx.ellipse(x - 20, gy, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
}
function drawMudPit(ctx, x, gy, t) {
  ctx.fillStyle = '#241a10';
  ctx.beginPath(); ctx.ellipse(x, gy + 5, 38, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(170,190,200,0.25)';
  ctx.beginPath(); ctx.ellipse(x - 10, gy + 3, 16, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  const b = Math.sin(t * 2.1 + x) * 0.5 + 0.5;                  // slow bubble
  ctx.fillStyle = `rgba(90,74,50,${0.5 * b})`;
  ctx.beginPath(); ctx.arc(x + 12, gy + 3, 1.6 + b, 0, Math.PI * 2); ctx.fill();
}
function drawStream(ctx, x, gy, t) {
  ctx.fillStyle = '#4a7286';
  ctx.beginPath(); ctx.ellipse(x, gy + 6, 48, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(220,236,240,0.55)'; ctx.lineWidth = 1.4;
  for (let k = -1; k <= 1; k++) {
    const wob = Math.sin(t * 3 + k * 2) * 3;
    ctx.beginPath(); ctx.moveTo(x - 26 + k * 16 + wob, gy + 3 + k * 2); ctx.lineTo(x - 8 + k * 16 + wob, gy + 3 + k * 2); ctx.stroke();
  }
  ctx.fillStyle = '#6f6d62';                                    // stepping rocks
  for (const [rx, rw] of [[-22, 7], [0, 8], [22, 7]]) {
    ctx.beginPath(); ctx.ellipse(x + rx, gy + 2, rw, 3.5, 0, Math.PI, Math.PI * 2); ctx.fill();
  }
}

function drawBoar(ctx, x, gy, c) {
  const run = Math.sin(c.phase * 2);
  ctx.save(); ctx.translate(x, gy);
  ctx.fillStyle = '#3d3128';
  for (const [lx, ph] of [[-14, 0], [-4, Math.PI], [8, 0.6], [16, Math.PI + 0.6]])
    ctx.fillRect(lx + Math.sin(c.phase * 2 + ph) * 3, -10, 4.5, 10);      // trotting legs
  ctx.beginPath(); ctx.ellipse(0, -18, 24, 12, 0, 0, Math.PI * 2); ctx.fill();          // body
  ctx.beginPath(); ctx.ellipse(-22, -16, 9, 7.5, 0.15, 0, Math.PI * 2); ctx.fill();     // head (facing Jon)
  ctx.fillStyle = '#57493c'; ctx.beginPath(); ctx.ellipse(2, -24, 14, 5, 0, 0, Math.PI * 2); ctx.fill();   // bristly back
  ctx.fillStyle = '#2b221b'; ctx.beginPath(); ctx.ellipse(-30, -14, 4, 3, 0, 0, Math.PI * 2); ctx.fill();  // snout
  ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 2; ctx.lineCap = 'round';                                   // tusk
  ctx.beginPath(); ctx.moveTo(-28, -12); ctx.quadraticCurveTo(-31, -15, -29, -18); ctx.stroke();
  ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.arc(-24, -19, 1.1, 0, Math.PI * 2); ctx.fill();          // eye
  ctx.restore();
}
function drawMongoose(ctx, x, gy, c) {
  const s = Math.sin(c.phase * 3) * 2;
  ctx.save(); ctx.translate(x, gy);
  ctx.fillStyle = '#7a5a3a';
  ctx.beginPath(); ctx.ellipse(0, -5, 16, 4.5 + s * 0.4, 0, 0, Math.PI * 2); ctx.fill();       // low body
  ctx.beginPath(); ctx.ellipse(-16, -6, 5, 3.5, 0.2, 0, Math.PI * 2); ctx.fill();              // head
  ctx.strokeStyle = '#6b4d30'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(14, -5); ctx.quadraticCurveTo(24, -8 + s, 30, -3); ctx.stroke(); // tail
  ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(-18, -7, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawCentipede(ctx, x, gy, c) {
  ctx.save(); ctx.translate(x, gy);
  ctx.fillStyle = '#6e2f1e';
  for (let k = 0; k < 7; k++) {
    const px = -12 + k * 4, py = -3 - Math.sin(k * 0.9 + c.phase * 0.4) * 1.5;
    ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#4c2013'; ctx.lineWidth = 1;
  for (let k = 0; k < 7; k++) {
    const px = -12 + k * 4;
    ctx.beginPath(); ctx.moveTo(px, -2); ctx.lineTo(px - 1, 1); ctx.moveTo(px, -2); ctx.lineTo(px + 1, 1); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(-17, -7); ctx.moveTo(-14, -4); ctx.lineTo(-18, -4); ctx.stroke();  // antennae
  ctx.restore();
}
function drawChicken(ctx, x, gy, c) {
  const peck = c.state === 'idle' ? Math.max(0, Math.sin(c.t * 2.4)) * 4 : 0;
  const flap = c.state === 'flee' ? Math.sin(c.phase * 3) * 3 : 0;
  ctx.save(); ctx.translate(x, gy);
  ctx.strokeStyle = '#c88a2a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(-3, 0); ctx.moveTo(3, -8); ctx.lineTo(3, 0); ctx.stroke();   // legs
  ctx.fillStyle = '#b8432b';
  ctx.beginPath(); ctx.ellipse(2, -14 + flap * 0.3, 10, 7, -0.15, 0, Math.PI * 2); ctx.fill();                 // rust body
  ctx.fillStyle = '#8a2f1e'; ctx.beginPath(); ctx.ellipse(8, -15, 5, 4, -0.6, 0, Math.PI * 2); ctx.fill();     // tail
  ctx.fillStyle = '#b8432b'; ctx.beginPath(); ctx.arc(-7, -20 + peck, 4.5, 0, Math.PI * 2); ctx.fill();        // head
  ctx.fillStyle = '#c8322e'; ctx.beginPath(); ctx.arc(-7, -24.5 + peck, 1.8, 0, Math.PI * 2); ctx.fill();      // comb
  ctx.fillStyle = '#e0a33a'; ctx.beginPath(); ctx.moveTo(-11, -20 + peck); ctx.lineTo(-15, -19 + peck); ctx.lineTo(-11, -18 + peck); ctx.closePath(); ctx.fill();  // beak
  ctx.restore();
}
function drawRat(ctx, x, gy, c) {
  ctx.save(); ctx.translate(x, gy);
  ctx.fillStyle = '#57534e';
  ctx.beginPath(); ctx.ellipse(0, -4, 9, 3.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-9, -5, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b6660'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8, -3); ctx.quadraticCurveTo(16, -5, 20, -1); ctx.stroke();
  ctx.restore();
}
