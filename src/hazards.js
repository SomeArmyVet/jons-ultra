// ===== MODULE: hazards =====
// Obstacle resolution and animal behaviours + their drawing functions. Obstacles resolve once as Jon's
// mile crosses them (jump over roots, duck the limb, slide the slab, hop or wade the streams); animals
// wake ahead of Jon when their time window matches, move, and can bite. A bite = hit; hitsPerFall hits
// in one segment = stumble-fall, never death (Design Bible §5–§6). Teleport test keys skip effects.
// Also owns the Huakaʻi Pō (Night Marchers) lore hazard — treated respectfully: torches and drums only,
// no chants, no faces. The legend's answer — do not look, get low — maps to DUCK and hold.
import { GAME, hash, clamp, lerp } from './engine.js';
import { SIM, triggerStumble } from './sim.js';
import { JON } from './jon.js';
import { RENDER, spawnDust } from './render.js';
import { takeHit } from './race.js';
import { AudioBed } from './audio.js';

const HZ = {
  ROOT_CLEAR: 26,        // px of air Jon needs over a root web
  MUD_SLOW: 0.55, MUD_S: 1.0,
  WADE_SLOW: 0.6, WADE_S: 1.4, WADE_HYD: 8, WADE_EN: 3,   // wading is the hydration play at HURT (6e tuning)
  TRIP_EN: 0,            // 6e: the stumble IS the obstacle cost — meters are drained by miles and bites
  // pig rework (6e): waits trailside, 0.6 s telegraph (grunt + hoof dust + head lowers), then bolts
  // across in 0.5 s. Jump clears it; duck does not (it is half Jon's height).
  PIG_NOTICE: 760, PIG_TG_S: 0.6, PIG_GO: 300, PIG_BOLT: 620, PIG_BOLT_S: 0.5, PIG_CLEAR: 62,
  MONGOOSE_SPEED: 420, RAT_SPEED: 380,
  CHICKEN_NOTICE: 260, CHICKEN_FLEE: 180, CHICKEN_FLEE_S: 1.2,
  WALLABY_NOTICE: 320, WALLABY_COIL_S: 0.45, WALLABY_HOP_S: 0.75, WALLABY_HOP_H: 112, WALLABY_HOP_X: 170, WALLABY_BODY: 15,
  DUCK_TOP: 76,          // Jon's height while sliding, px — clears under a wallaby at the top of its arc
  CROUCH_TOP: 95,        // crouch-walk is a little taller but still clears the arc
  STAND_TOP: 140,
  WAKE_MI: 0.2,          // animals activate this far ahead of Jon
  DRAW_AHEAD_MI: 0.3,
  MARCH_ZONE: 90, MARCH_DUR: 5.5, MARCH_TORCHES: 5
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
// Duck and crouch both count as "low" for clearance (limb, slick rock, wallaby, marchers); only the
// slide is speed-free — the crouch-walk pays with CROUCH_SPEED.
function isLow(j) { return j.state === 'duck' || j.state === 'crouch'; }
function trip(j, energyCost) {
  triggerStumble(j);
  if (energyCost) GAME.energy = clamp(GAME.energy - energyCost, 0, 100);
  AudioBed.thud();
}

// Resolve one obstacle at the moment Jon's mile crosses it. Guard: a teleport (test keys) that lands
// far past an obstacle skips its effect instead of resolving a wall of them at once.
function resolveObstacle(o, j) {
  if (GAME.mile - o.mile > 0.05) return;
  const airborne = !j.grounded, y = j.y;
  if (o.type === 'rootWeb') {
    if (airborne && y > HZ.ROOT_CLEAR) return;
    trip(j, HZ.TRIP_EN);
  } else if (o.type === 'banyanLimb') {
    if (isLow(j)) return;
    trip(j, HZ.TRIP_EN + 1);
  } else if (o.type === 'slickRock') {
    if (isLow(j) || airborne) return;                          // slide across (or clear it)
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

function makeCritter(a, off, dir) {
  return { type: a.type, x: a.mile * SIM.PX_PER_MILE + (off || 0), seed: a.seed, phase: (a.seed % 628) / 100,
           state: 'idle', t: 0, dir: dir || 1, hopT: -1, hitDone: false, gone: false };
}
function critterScreenX(c) { return JON.X + (c.x - GAME.scroll); }

function critterStep(c, dt, j) {
  c.t += dt; c.phase += dt * 10;
  const sx = critterScreenX(c), dx = sx - JON.X;
  if (c.type === 'pig') {
    // idle trailside -> telegraph (>= PIG_TG_S, always) -> bolt across -> gone
    if (c.state === 'idle' && dx < HZ.PIG_NOTICE) { c.state = 'telegraph'; c.tgT = 0; AudioBed.grunt(); }
    else if (c.state === 'telegraph') {
      c.tgT += dt;
      if (c.tgT > 0.12 && Math.floor(c.tgT / 0.16) !== Math.floor((c.tgT - dt) / 0.16))
        spawnDust(critterScreenX(c) - 20, RENDER.GROUND_Y + GAME.camY, 2);   // pawing hooves
      const goPx = 180 + (c.seed % 1000) / 1000 * 200;                    // seeded: some bolt very late
      if (c.tgT >= HZ.PIG_TG_S && dx < goPx) { c.state = 'bolt'; c.boltT = 0; }
    } else if (c.state === 'bolt') {
      c.boltT += dt;
      c.x -= HZ.PIG_BOLT * dt;
      if (!c.hitDone && Math.abs(critterScreenX(c) - JON.X) < 40 && j.y < HZ.PIG_CLEAR) { c.hitDone = true; takeHit(); }
      if (c.boltT >= HZ.PIG_BOLT_S) c.gone = true;              // across and into the green
    }
  } else if (c.type === 'mongoose') {
    c.x -= HZ.MONGOOSE_SPEED * dt;                             // darts under Jon's feet
    if (!c.hitDone && Math.abs(dx) < 20 && j.grounded) { c.hitDone = true; triggerStumble(j); }
  } else if (c.type === 'centipede') {
    if (!c.hitDone && Math.abs(dx) < 16 && j.grounded) { c.hitDone = true; takeHit(); }
  } else if (c.type === 'chicken') {
    if (c.state === 'idle' && dx < HZ.CHICKEN_NOTICE) c.state = 'flee';
    if (c.state === 'flee') {
      c.x += c.dir * (GAME.speed * 0.4 + HZ.CHICKEN_FLEE) * dt;                    // scatters both ways
      c.fleeT = (c.fleeT || 0) + dt; if (c.fleeT > HZ.CHICKEN_FLEE_S) c.gone = true;
    }
  } else if (c.type === 'wallaby') {
    // waits beside the trail, coils 0.45 s (visible squat — every hazard telegraphs), then hops across
    // in one high arc (Kalihi Valley colony, Race Bible §1)
    if (c.state === 'idle' && dx < HZ.WALLABY_NOTICE) { c.state = 'coil'; c.coilT = 0; }
    else if (c.state === 'coil') {
      c.coilT += dt;
      if (c.coilT >= HZ.WALLABY_COIL_S) { c.state = 'hop'; c.hopT = 0; c.x0 = c.x; }
    }
    if (c.state === 'hop') {
      c.hopT += dt / HZ.WALLABY_HOP_S;
      c.x = c.x0 - c.hopT * HZ.WALLABY_HOP_X;
      if (c.hopT >= 1) { c.state = 'away'; c.awayT = 0; }
      const wy = Math.sin(clamp(c.hopT, 0, 1) * Math.PI) * HZ.WALLABY_HOP_H;       // height of the arc
      const jonTop = j.state === 'duck' ? HZ.DUCK_TOP : j.state === 'crouch' ? HZ.CROUCH_TOP : HZ.STAND_TOP;
      if (!c.hitDone && Math.abs(critterScreenX(c) - JON.X) < 26 &&
          wy - HZ.WALLABY_BODY < j.y + jonTop && wy + HZ.WALLABY_BODY > j.y) {
        c.hitDone = true; takeHit();
      }
    } else if (c.state === 'away') {
      c.awayT += dt; c.x -= 120 * dt; if (c.awayT > 0.8) c.gone = true;            // bounds off into the green
    }
  } else if (c.type === 'rat') {
    c.x -= HZ.RAT_SPEED * dt;                                  // harmless night streak
  }
  if (sx < -90) c.gone = true;
}

// ---- Huakaʻi Pō (Night Marchers): seeded per night; background torches on the far ridge with low
// drums on ~1 night in 3 (1 in 2 under a full moon); at most one on-trail crossing per night. When the
// procession crosses ahead, DUCK AND HOLD until it passes; standing or jumping = a hit and the screen
// darkens for a beat. Torches and drums only — no chants, no faces, no caricature.
function marchersStep(dt) {
  const M = GAME.marchers, lore = GAME.course.lore || {};
  if (!lore.nightMarchers) return;
  const nightNow = GAME.night > 0.9;
  if (nightNow && !M.wasNight) { M.nightIdx++; M.bg = true; }  // torches walk the ridge every night (6d: guaranteed)
  M.wasNight = nightNow;
  if (GAME.night < 0.6) M.crossing = null;                     // dawn dissolves the procession
  if (M.dark > 0) M.dark = Math.max(0, M.dark - dt / 1.2);
  // exactly one on-trail crossing per race (6d), scheduled a seeded distance ahead once night is full
  if (!M.crossingDone && !M.crossing && M.onTrailMile == null && GAME.night > 0.7)
    M.onTrailMile = GAME.mile + 1 + hash(GAME.attempt * 131 + 7) * 2.5;
  if (M.onTrailMile != null && !M.crossing && GAME.night > 0.6 && GAME.mile > M.onTrailMile - 0.08) {
    M.crossing = { mile: M.onTrailMile, t: 0, hitDone: false };
    M.onTrailMile = null; M.crossingDone = true;
  }
  const c = M.crossing;
  if (c) {
    c.t += dt;
    const inZone = Math.abs(c.mile - GAME.mile) * SIM.PX_PER_MILE < HZ.MARCH_ZONE;
    if (inZone && c.t < HZ.MARCH_DUR) {
      if (isLow(GAME.jon)) { GAME.slowT = Math.max(GAME.slowT, 0.2); GAME.slowK = 0.02; }   // stop, stay down
      else if (!c.hitDone) { c.hitDone = true; takeHit(); M.dark = 1; }
    }
    if (c.t > HZ.MARCH_DUR + 2) M.crossing = null;
  }
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
    if (a.type === 'chicken') {                                // chickens come in small groups and scatter
      const n = 2 + (a.seed % 2);
      for (let k = 0; k < n; k++) GAME.critters.push(makeCritter(a, k * 34 - 17, (a.seed >> k) % 2 ? 1 : -1));
    } else GAME.critters.push(makeCritter(a));
  }
  for (let k = GAME.critters.length - 1; k >= 0; k--) {
    const c = GAME.critters[k];
    critterStep(c, dt, j);
    if (c.gone) GAME.critters.splice(k, 1);
  }
  marchersStep(dt);
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
    if (c.type === 'pig') drawPig(ctx, sx, gy, c);
    else if (c.type === 'mongoose') drawMongoose(ctx, sx, gy, c);
    else if (c.type === 'centipede') drawCentipede(ctx, sx, gy, c);
    else if (c.type === 'chicken') drawChicken(ctx, sx, gy, c);
    else if (c.type === 'wallaby') drawWallaby(ctx, sx, gy, c);
    else if (c.type === 'rat') drawRat(ctx, sx, gy, c);
    // night eye-shine: animal eyes catch the headlamp well beyond the cone — real, and it keeps
    // night encounters fair at speed (6e readability)
    if (GAME.night > 0.4 && c.type !== 'chicken') {
      const ey = c.type === 'pig' ? gy - 34 : c.type === 'wallaby' ? gy - 25 - (c.state === 'hop' ? Math.sin(clamp(c.hopT, 0, 1) * Math.PI) * HZ.WALLABY_HOP_H : 0) : gy - 7;
      ctx.fillStyle = `rgba(255,220,140,${0.7 * GAME.night})`;
      ctx.beginPath(); ctx.arc(sx - (c.type === 'pig' ? 45 : 16), ey, 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawMarchersCrossing(ctx, view, t);
}

// Background procession: a line of torches moving along the far ridge. Called by render after the far
// ridge layer. Flames and glow only — distance keeps it abstract.
export function drawMarchersRidge(ctx, view, t) {
  const M = GAME.marchers;
  if (!M.bg || GAME.night < 0.6) return;
  const a = clamp((GAME.night - 0.6) / 0.3, 0, 1) * 0.9;
  const headX = view.W + 120 - ((t * 14) % (view.W + 700));    // one slow traverse every few minutes
  for (let i = 0; i < 9; i++) {
    const x = headX + i * 30;
    if (x < -20 || x > view.W + 20) continue;
    const wx = x + view.scroll * 0.05;
    const y = 244 - 90 * Math.sin(wx / 610) - 40 * Math.abs(Math.sin(wx / 95 + 0.4)) - 18 * Math.abs(Math.sin(wx / 31)) - 12 * Math.sin(wx / 210 + 2);
    const fl = 0.75 + 0.25 * Math.sin(t * 9 + i * 1.7);
    ctx.fillStyle = `rgba(255,170,70,${0.10 * a * fl})`;
    ctx.beginPath(); ctx.arc(x, y - 4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,196,110,${a * fl})`;
    ctx.beginPath(); ctx.arc(x, y - 4, 1.9, 0, Math.PI * 2); ctx.fill();
  }
}
// On-trail crossing: staggered torches pass across the trail ahead. Faint tall shrouds, no detail.
function drawMarchersCrossing(ctx, view, t) {
  const c = GAME.marchers.crossing; if (!c) return;
  const x0 = JON.X + (c.mile - GAME.mile) * SIM.PX_PER_MILE;
  if (x0 < -200 || x0 > view.W + 200) return;
  const gy = view.groundAt(x0);
  for (let i = 0; i < HZ.MARCH_TORCHES; i++) {
    const prog = clamp((c.t - i * 0.55) / 3.2, 0, 1);
    if (prog <= 0 || prog >= 1) continue;
    const x = x0 + Math.sin(i * 2.6) * 42;
    const y = lerp(gy - 158, gy + 24, prog);
    const fade = Math.sin(prog * Math.PI);                       // emerges, passes, fades
    ctx.fillStyle = `rgba(10,14,16,${0.28 * fade})`;             // shroud, featureless
    ctx.beginPath(); ctx.roundRect(x - 7, y - 12, 14, 64, 7); ctx.fill();
    const fl = 0.75 + 0.25 * Math.sin(t * 10 + i * 2.1);
    ctx.fillStyle = `rgba(255,170,70,${0.16 * fade * fl})`;
    ctx.beginPath(); ctx.arc(x, y - 20, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,200,120,${0.95 * fade * fl})`;
    ctx.beginPath(); ctx.arc(x, y - 20, 2.6, 0, Math.PI * 2); ctx.fill();
  }
}
// Full-screen darken beat after ignoring the procession. Render calls this after the meter effects.
export function drawMarchersDark(ctx, W, H) {
  const d = GAME.marchers.dark; if (d <= 0) return;
  ctx.fillStyle = `rgba(0,0,4,${0.55 * d})`;
  ctx.fillRect(0, 0, W, H);
}

function drawRootWeb(ctx, x, gy, pal, seedMile) {
  const h = (seedMile * 37) % 1;
  ctx.strokeStyle = pal.root; ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x - 27, gy + 4); ctx.quadraticCurveTo(x - 6, gy - 24 - h * 6, x + 23, gy + 2); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x - 20, gy + 6); ctx.quadraticCurveTo(x + 4, gy - 15, x + 28, gy + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 28, gy + 2); ctx.quadraticCurveTo(x - 2, gy - 9, x + 13, gy - 17); ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x - 9, gy + 6); ctx.quadraticCurveTo(x + 6, gy - 21, x + 24, gy - 4); ctx.stroke();
}
function drawBanyanLimb(ctx, x, gy, pal) {
  ctx.strokeStyle = pal.trunk; ctx.lineCap = 'round'; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(x - 34, gy - 120); ctx.quadraticCurveTo(x - 6, gy - 78, x + 30, gy - 56); ctx.stroke();
  ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(x - 8, gy - 86); ctx.lineTo(x + 4, gy - 100); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 12, gy - 68); ctx.lineTo(x + 24, gy - 80); ctx.stroke();
  ctx.fillStyle = pal.canopy;                                   // leaves still on the fallen limb
  ctx.beginPath();
  ctx.ellipse(x + 6, gy - 104, 15, 9, -0.5, 0, Math.PI * 2);
  ctx.ellipse(x + 27, gy - 82, 13, 8, -0.5, 0, Math.PI * 2);
  ctx.fill();
}
function drawSlickRock(ctx, x, gy, pal) {
  ctx.fillStyle = pal.stone;
  ctx.beginPath(); ctx.ellipse(x, gy + 2, 30, 9, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.38)';                     // wet sheen — the read is "slippery"
  ctx.beginPath(); ctx.ellipse(x - 6, gy - 4, 15, 3.2, -0.15, 0, Math.PI * 2); ctx.fill();
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

// Wild pig (6e look): ~0.5 x Jon tall, longer than tall; low heavy body, bristly mane ridge, snout,
// small tusks. ONE ink tone (dark grey-brown) plus the same shade/highlight discipline as Jon.
function drawPig(ctx, x, gy, c) {
  const tg = c.state === 'telegraph', bolt = c.state === 'bolt';
  const run = bolt ? Math.sin(c.phase * 3) : 0;
  const headDrop = tg ? Math.min(1, c.tgT / 0.3) * 10 : bolt ? 6 : 0;     // the telegraph: head lowers
  const INK = '#453a30', SHADE = 'rgba(20,14,8,0.28)', PALE = '#e8e2d0';
  ctx.save(); ctx.translate(x, gy);
  ctx.fillStyle = INK;
  // legs: stumpy and thick; trot only while bolting
  for (const [lx, ph] of [[-30, 0], [-16, Math.PI], [14, 0.6], [28, Math.PI + 0.6]])
    ctx.fillRect(lx + run * Math.sin(c.phase * 3 + ph) * 5, -16, 7, 16);
  // low heavy body, longer than tall (~95 x 46)
  ctx.beginPath(); ctx.ellipse(0, -32, 46, 22, 0, 0, Math.PI * 2); ctx.fill();
  // head, lowering during the telegraph
  ctx.beginPath(); ctx.ellipse(-42, -28 + headDrop * 0.6, 16, 13, 0.2 + headDrop * 0.02, 0, Math.PI * 2); ctx.fill();
  // bristly mane ridge: spiky triangles along the spine
  ctx.beginPath();
  for (let k = 0; k < 7; k++) {
    const bx = -26 + k * 9;
    ctx.moveTo(bx, -50); ctx.lineTo(bx + 4, -60 - (k % 2) * 3); ctx.lineTo(bx + 8, -50);
  }
  ctx.fill();
  // snout
  ctx.beginPath(); ctx.ellipse(-56, -22 + headDrop * 0.7, 6.5, 5, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = SHADE;
  ctx.beginPath(); ctx.ellipse(0, -24, 44, 12, 0, 0, Math.PI); ctx.fill();               // belly shade
  // small tusks
  ctx.strokeStyle = PALE; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-52, -19 + headDrop * 0.7); ctx.quadraticCurveTo(-57, -24 + headDrop * 0.7, -54, -29 + headDrop * 0.7); ctx.stroke();
  ctx.fillStyle = PALE; ctx.beginPath(); ctx.arc(-45, -34 + headDrop * 0.6, 1.6, 0, Math.PI * 2); ctx.fill();   // eye
  ctx.restore();
}
// Ferret-shaped: long, low, slinky — the body undulates as it runs, tail nearly body-length.
function drawMongoose(ctx, x, gy, c) {
  const s = Math.sin(c.phase * 3);
  ctx.save(); ctx.translate(x, gy);
  ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, -5 + s);                     // undulating tube body
  ctx.quadraticCurveTo(-4, -8 - s * 1.5, 6, -5 + s);
  ctx.quadraticCurveTo(12, -3.5 - s, 16, -5); ctx.stroke();
  ctx.fillStyle = '#7a5a3a';
  ctx.beginPath(); ctx.ellipse(-18, -6 + s, 5.5, 3.4, 0.25, 0, Math.PI * 2); ctx.fill();   // pointed head
  ctx.beginPath(); ctx.arc(-16, -9 + s, 1.3, 0, Math.PI * 2); ctx.arc(-19.5, -9 + s, 1.3, 0, Math.PI * 2); ctx.fill();  // small ears
  ctx.strokeStyle = '#6b4d30'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(16, -5); ctx.quadraticCurveTo(26, -9 + s * 2, 34, -3); ctx.stroke();          // long tail
  ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(-21, -6.5 + s, 0.8, 0, Math.PI * 2); ctx.fill();
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
  const peck = c.state === 'idle' ? Math.max(0, Math.sin(c.t * 2.4 + c.phase)) * 4 : 0;
  const flap = c.state === 'flee' ? Math.sin(c.phase * 3) * 3 : 0;
  const face = c.state === 'flee' ? c.dir : -1;                 // scatters facing the way it runs
  ctx.save(); ctx.translate(x, gy); ctx.scale(-face, 1);
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
// Brush-tailed rock wallaby: grey-brown, lighter belly, big folded hind legs, long dark brush tail.
function drawWallaby(ctx, x, gy, c) {
  const hop = c.state === 'hop' ? clamp(c.hopT, 0, 1) : 0;
  const wy = Math.sin(hop * Math.PI) * HZ.WALLABY_HOP_H;
  const lean = c.state === 'hop' ? -0.35 + hop * 0.55 : 0;      // nose up on launch, down on landing
  const coil = c.state === 'coil' ? Math.min(1, c.coilT / HZ.WALLABY_COIL_S) : 0;   // visible squat = telegraph
  ctx.save(); ctx.translate(x, gy - wy + coil * 5); ctx.scale(1, 1 - coil * 0.22); ctx.rotate(lean);
  ctx.strokeStyle = '#3a3028'; ctx.lineWidth = 5; ctx.lineCap = 'round';                     // brush tail
  ctx.beginPath(); ctx.moveTo(12, -14); ctx.quadraticCurveTo(26, -8, 32, -18); ctx.stroke();
  ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(27, -16); ctx.lineTo(32, -18); ctx.stroke(); // bushy tip
  ctx.fillStyle = '#6b5a48';
  ctx.beginPath(); ctx.ellipse(0, -18, 15, 10, -0.2, 0, Math.PI * 2); ctx.fill();            // body
  ctx.fillStyle = '#8a7862';
  ctx.beginPath(); ctx.ellipse(-3, -14, 8, 5, -0.2, 0, Math.PI * 2); ctx.fill();             // lighter belly
  ctx.fillStyle = '#6b5a48';
  ctx.beginPath(); ctx.ellipse(8, -12, 8.5, 5.5, 0.5, 0, Math.PI * 2); ctx.fill();           // folded hind leg
  ctx.fillStyle = '#584a3a'; ctx.fillRect(9, -8, 10, 3);                                     // long foot
  ctx.fillStyle = '#6b5a48';
  ctx.beginPath(); ctx.ellipse(-13, -24, 5.5, 4.5, -0.3, 0, Math.PI * 2); ctx.fill();        // head
  ctx.beginPath(); ctx.moveTo(-14, -28); ctx.lineTo(-16, -34); ctx.lineTo(-11, -30); ctx.closePath(); ctx.fill();   // ears
  ctx.beginPath(); ctx.moveTo(-10, -28); ctx.lineTo(-10, -33); ctx.lineTo(-6, -29); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#584a3a'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-8, -16); ctx.lineTo(-11, -10); ctx.stroke();                  // little forearms
  ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(-16, -25, 1, 0, Math.PI * 2); ctx.fill();
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
