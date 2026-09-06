// ===== MODULE: jon =====
// Procedural character: hair/beard/tattoo drawing, animation states, hitbox. Includes the character viewer (J key).
// Nine colour tokens. Sheet hexes kept where they survive the cut:
// off-white = cap front + tee; blue = lens + poles; brown = hair + beard; black = socks, shoes, grips, ink.
import { ENGINE, GAME, Input, clamp, lerp, lerpTo, seg } from './engine.js';
import { RENDER, spawnDust } from './render.js';
import { footfalls } from './atmosphere.js';
import { UI_FONT } from './ui.js';

export const JON_PAL = {
  brown: '#3B2416',
  skin: '#C58E62',
  offwhite: '#F2F0E6',
  green: '#1F8A4C',
  blue: '#2E7BD6',
  vest: '#D8E24A',
  pink: '#E0338F',
  black: '#1A1A1A',
  bib: '#F5D021',
  ink: 'rgba(26,26,26,0.7)',         // black at 70% — the one tattoo tone
  shade: 'rgba(26,26,26,0.22)'       // black overlay for far-side limbs
};

export const JON = {
  X: 384,
  TARGET_PX: 140,           // on-screen height, feet to cap top. [ and ] adjust live.
  FIGURE_UNITS: 142,        // geometry height in figure units at scale 1
  JUMP_V: 640, G_HOLD: 1300, G_FULL: 2600, G_FASTFALL: 3800,
  STRIDE_PX: 150,
  POSE_RATE: 26,
  LAND_SQUASH_S: 0.14,
  BIB: '254',               // placeholder until race config supplies bibNumber
  POLES: true,              // per-race flag from step 6; default true, false for Across the Years
  SLIDE_MAX_S: 1.2,         // a slide lasts at most this long, then Jon auto-stands into a crouch-walk
  SLIDE_CD_S: 0.4           // cooldown before the next slide
};

export function makeJon() {
  return {
    y: 0, prevY: 0, vy: 0, grounded: true, jumpedSinceGround: false, holding: false, plantBeat: null,
    duckT: 0, slideCd: 0,
    stumbleT: 0, headScreen: { x: 0, y: 0 }, forcedState: null, footBeat: null,
    lastGroundedAt: 0, landedAt: -1, state: 'run', phase: 0,
    gait: 'flat',            // flat | up | down — sim sets this from grade at step 2
    pose: gaitPose(0, 'flat'),
    hair: hairInit()
  };
}

// Character sheet §6: flat run, uphill grind, downhill bomb.
const GAITS = {
  flat: { hipAmp: 0.62, lean: 0.17, headPitch: 0.05, armAmp: 0.7, elbow: 1.7, windMul: 1.0, poleAng: 0.52, poleSplit: 0, beardFly: 0 },
  up:   { hipAmp: 0.42, lean: 0.30, headPitch: 0.30, armAmp: 0.55, elbow: 1.3, windMul: 0.7, poleAng: 0.0, poleSplit: 1, beardFly: 0 },
  down: { hipAmp: 0.90, lean: 0.02, headPitch: -0.08, armAmp: 0.95, elbow: 0.9, windMul: 1.7, poleAng: 0.52, poleSplit: 0, beardFly: 1 }
};
export function gaitPose(p, gait) {
  const g = GAITS[gait];
  const leg = q => {
    const hip = g.hipAmp * Math.sin(q);
    const rec = Math.max(0, Math.cos(q));
    return { hip, knee: 0.18 + 1.35 * rec * rec + 0.3 * Math.max(0, -Math.cos(q)) };
  };
  const near = leg(p), far = leg(p + Math.PI);
  return {
    hipY: -62, lean: g.lean, headPitch: g.headPitch,
    nearHip: near.hip, nearKnee: near.knee, farHip: far.hip, farKnee: far.knee,
    nearSh: -g.armAmp * Math.sin(p), nearEl: g.elbow - 0.3 * Math.sin(p),
    farSh: g.armAmp * Math.sin(p), farEl: g.elbow + 0.3 * Math.sin(p),
    windMul: g.windMul, poleAng: g.poleAng, poleSplit: g.poleSplit, beardFly: g.beardFly, poleUp: 0
  };
}
const POSES = {
  jumpUp:   { hipY: -62, lean: 0.22, headPitch: -0.05, nearHip: 0.95, nearKnee: 1.7, farHip: -0.25, farKnee: 1.3,
              nearSh: -0.4, nearEl: 1.9, farSh: 0.3, farEl: 1.8, windMul: 1.0, poleAng: -0.6, poleSplit: 0, beardFly: 1, poleUp: 0 },
  jumpDown: { hipY: -62, lean: 0.15, headPitch: 0.1, nearHip: 0.6, nearKnee: 0.7, farHip: -0.15, farKnee: 1.0,
              nearSh: -0.2, nearEl: 1.6, farSh: 0.4, farEl: 1.5, windMul: 1.0, poleAng: -0.3, poleSplit: 0, beardFly: 1, poleUp: 0 },
  stumble:  { hipY: -56, lean: 0.62, headPitch: 0.35, nearHip: 0.95, nearKnee: 0.9, farHip: -0.5, farKnee: 0.45,
              nearSh: 0.95, nearEl: 0.5, farSh: 0.7, farEl: 0.6, windMul: 0.8, poleAng: 0.9, poleSplit: 1, beardFly: 0, poleUp: 0 },
  duck:     { hipY: -36, lean: 1.05, headPitch: -0.35, nearHip: 1.3, nearKnee: 2.15, farHip: 0.95, farKnee: 2.0,
              nearSh: 0.9, nearEl: 1.1, farSh: 0.6, farEl: 1.3, windMul: 0.6, poleAng: 0.25, poleSplit: 0, beardFly: 0, poleUp: 0 },
  // crouch-walk: what a slide becomes after SLIDE_MAX_S with Down still held — low but upright enough
  // to keep moving (slower; the sim applies CROUCH_SPEED)
  crouch:   { hipY: -48, lean: 0.7, headPitch: -0.25, nearHip: 0.9, nearKnee: 1.5, farHip: 0.5, farKnee: 1.3,
              nearSh: 0.6, nearEl: 1.4, farSh: 0.4, farEl: 1.5, windMul: 0.5, poleAng: 0.3, poleSplit: 0, beardFly: 0, poleUp: 0 },
  // aid-station stop: hands on hips, head tilted back to drink (character sheet §6.6)
  aid:      { hipY: -62, lean: 0.02, headPitch: -0.3, nearHip: 0.1, nearKnee: 0.12, farHip: -0.1, farKnee: 0.12,
              nearSh: 0.35, nearEl: 2.55, farSh: -0.8, farEl: 1.9, windMul: 0.05, poleAng: 0.9, poleSplit: 1, beardFly: 0, poleUp: 0 },
  // finish: poles raised overhead in a V (character sheet §6.10)
  finish:   { hipY: -62, lean: 0.0, headPitch: -0.35, nearHip: 0.25, nearKnee: 0.15, farHip: -0.25, farKnee: 0.15,
              nearSh: 2.7, nearEl: 0.3, farSh: 2.9, farEl: 0.2, windMul: 0.2, poleAng: 0, poleSplit: 0, beardFly: 0, poleUp: 1 },
  // DNF: sits on a rock, head down
  sit:      { hipY: -30, lean: 0.3, headPitch: 0.55, nearHip: 1.35, nearKnee: 1.25, farHip: 1.15, farKnee: 1.4,
              nearSh: 0.85, nearEl: 0.9, farSh: 0.7, farEl: 1.0, windMul: 0.02, poleAng: 0.9, poleSplit: 0, beardFly: 0, poleUp: 0 }
};

function blendPose(j, target, dt) {
  for (const k in target) j.pose[k] = lerpTo(j.pose[k], target[k], dt, JON.POSE_RATE);
}

export function jonStep(j, dt) {
  const now = performance.now();
  j.prevY = j.y;

  const canJump = (j.grounded || (!j.jumpedSinceGround && (now - j.lastGroundedAt) <= ENGINE.COYOTE_MS)) && j.stumbleT <= 0 && !j.forcedState && GAME.screen === 'race';
  if (Input.jumpBuffered(now) && canJump) {
    j.vy = JON.JUMP_V * (GAME.jumpMul || 1); j.grounded = false; j.jumpedSinceGround = true; j.holding = true;
    Input.consumeJump();
  }
  if (!Input.jumpHeld) j.holding = false;

  if (!j.grounded) {
    let g = (j.holding && j.vy > 0) ? JON.G_HOLD : JON.G_FULL;
    if (Input.duckHeld) g = JON.G_FASTFALL;
    j.vy -= g * dt; j.y += j.vy * dt;
    if (j.y <= 0) {
      j.y = 0; j.vy = 0; j.grounded = true; j.jumpedSinceGround = false; j.landedAt = now;
      spawnDust(JON.X, RENDER.GROUND_Y + GAME.camY, 7);
    }
  } else j.lastGroundedAt = now;

  // Slide cap: a slide (duck) lasts at most SLIDE_MAX_S, then becomes a crouch-walk while Down is
  // held; releasing a slide starts the cooldown before the next one.
  if (j.slideCd > 0) j.slideCd -= dt;
  const wantLow = j.grounded && Input.duckHeld;
  let low = null;
  if (wantLow) {
    if (j.state === 'duck') {
      j.duckT += dt;
      if (j.duckT >= JON.SLIDE_MAX_S) { low = 'crouch'; j.slideCd = JON.SLIDE_CD_S; }
      else low = 'duck';
    } else if (j.state === 'crouch') low = 'crouch';
    else if (j.slideCd <= 0) { low = 'duck'; j.duckT = 0; }
    else low = 'crouch';
  } else {
    if (j.state === 'duck') j.slideCd = JON.SLIDE_CD_S;
    j.duckT = 0;
  }
  j.state = j.forcedState && j.grounded ? j.forcedState : !j.grounded ? (j.vy > 0 ? 'jumpUp' : 'jumpDown') : j.stumbleT > 0 ? 'stumble' : low ? low : 'run';
  if (j.state === 'run') j.phase += dt * GAME.animSpeed / JON.STRIDE_PX * Math.PI * 2;
  else if (j.state === 'crouch') j.phase += dt * GAME.animSpeed / JON.STRIDE_PX * Math.PI * 2 * 0.7;
  else if (j.state === 'duck' || j.state === 'stumble') j.phase += dt * 1.5;

  blendPose(j, j.state === 'run' ? gaitPose(j.phase, j.gait) : POSES[j.state], dt);
  const J = jonJoints(j.pose, j.grounded);
  hairStep(j, J, dt, GAME.animSpeed * j.pose.windMul);
  polePlantPuffs(j, J);
  footfalls(j, J);
}

// A pole plants each half stride on climbs: puff where its tip meets the trail.
function polePlantPuffs(j, J) {
  if (!JON.POLES || j.gait !== 'up' || j.state !== 'run' || j.pose.poleSplit < 0.5) { j.plantBeat = null; return; }
  const beat = Math.floor((j.phase + Math.PI / 2) / Math.PI);          // sin(phase) extremes = plant moments
  if (j.plantBeat === null || j.plantBeat === undefined) { j.plantBeat = beat; return; }
  if (beat === j.plantBeat) return;
  j.plantBeat = beat;
  const scale = JON.TARGET_PX / JON.FIGURE_UNITS;
  const hand = (beat % 2 === 0) ? J.nHand : J.fHand, ang = 0.45 + 0.35 * Math.sin(j.phase) * ((beat % 2 === 0) ? 1 : -1);
  const len = Math.max(20, (-(hand.y + J.dy) - 6) / Math.cos(ang)), tip = seg(hand, len, ang);
  spawnDust(JON.X + tip.x * scale, RENDER.GROUND_Y + GAME.camY, 3);
}

// --- drawing helpers ---
export function drawLimb(ctx, a, b, w, color) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function drawShoe(ctx, ankle, shinAng) {
  ctx.save();
  ctx.translate(ankle.x, ankle.y + 1);
  ctx.rotate(clamp(-shinAng * 0.35, -0.5, 0.5));
  ctx.fillStyle = JON_PAL.black;
  ctx.fillRect(-4.5, -7, 9, 6);                                 // ankle sock
  ctx.beginPath(); ctx.roundRect(-7, -2, 19, 7, [3, 5, 2, 2]); ctx.fill();   // shoe, one dark shape
  ctx.restore();
}
// Forearm sleeve = three bold ink bands. Reads as "tattooed" without line-work noise.
function inkSleeve(ctx, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  ctx.strokeStyle = JON_PAL.ink; ctx.lineWidth = 2.4; ctx.lineCap = 'butt';
  ctx.beginPath();
  for (const s of [0.28, 0.5, 0.72]) {
    const px = a.x + dx * s, py = a.y + dy * s;
    ctx.moveTo(px - nx * 4, py - ny * 4); ctx.lineTo(px + nx * 4, py + ny * 4);
  }
  ctx.stroke();
}
// Left-shin dagger as one dark mark.
function inkDagger(ctx, knee, ankle) {
  const dx = ankle.x - knee.x, dy = ankle.y - knee.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const at = s => ({ x: knee.x + dx * s, y: knee.y + dy * s });
  const grip = at(0.14), guard = at(0.26), tip = at(0.62);
  ctx.strokeStyle = JON_PAL.ink; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(grip.x, grip.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(guard.x - nx * 3.8, guard.y - ny * 3.8); ctx.lineTo(guard.x + nx * 3.8, guard.y + ny * 3.8); ctx.stroke();
  ctx.fillStyle = JON_PAL.ink;
  ctx.beginPath();
  ctx.moveTo(tip.x - nx * 2.4 - dx / L * 4, tip.y - ny * 2.4 - dy / L * 4);
  ctx.lineTo(tip.x + nx * 2.4 - dx / L * 4, tip.y + ny * 2.4 - dy / L * 4);
  ctx.lineTo(tip.x + dx / L * 2.5, tip.y + dy / L * 2.5); ctx.fill();
}
function inkThighMark(ctx, hip, knee) {
  const s = 0.74, x = hip.x + (knee.x - hip.x) * s, y = hip.y + (knee.y - hip.y) * s;
  ctx.fillStyle = JON_PAL.ink; ctx.fillRect(x - 3.5, y - 2.5, 7, 5);
}

// ---- hair: simulated verlet chains, no hand posing ----
// Frame: Jon's figure units, x forward, y down, origin at the feet, ground at y = 0 (so jumps move the anchor).
const HAIRSIM = {
  N: 10, SEG: 5.2,             // 10 points, 9 links ≈ 47 units → ends land at mid-back
  G: 800,                      // gravity, units/s²
  WIND_K: 1.9,                 // back-wind per px/s of scroll speed (300 px/s → 35° hang)
  AIR_WIND: 260,               // extra back-wind while airborne
  FALL_LIFT: 0.8,              // upward push per unit/s of fall speed
  DAMP: 0.94, ITER: 4,
  LOCK_N: 5, LOCK_SEG: 5, LOCK_WIND: 0.12, LOCK_DAMP: 0.88,
  W_SCALP: 4, W_FULL: 7.5, W_END: 4.5,   // ribbon half-widths
  BUMPS: 3, BUMP_AMP: 3
};
function chainInit(n, seg2, ax, ay) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x: ax, y: ay + i * seg2, px: ax, py: ay + i * seg2 });
  return pts;
}
function hairInit() {
  return {
    main: chainInit(HAIRSIM.N, HAIRSIM.SEG, -7, -117),
    near: chainInit(HAIRSIM.LOCK_N, HAIRSIM.LOCK_SEG, -4, -120),
    far:  chainInit(HAIRSIM.LOCK_N, HAIRSIM.LOCK_SEG, -9, -122)
  };
}
// One verlet step for a pinned chain. clampFn(p) keeps points behind the neck line and above the ground.
function chainStep(pts, ax, ay, accX, accY, seg2, damp, dt, clampFn) {
  pts[0].px = pts[0].x; pts[0].py = pts[0].y; pts[0].x = ax; pts[0].y = ay;
  const dt2 = dt * dt;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
    p.px = p.x; p.py = p.y;
    p.x += vx + accX * dt2; p.y += vy + accY * dt2;
  }
  for (let k = 0; k < HAIRSIM.ITER; k++) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 0.0001;
      const diff = (L - seg2) / L;
      if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
      else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
    }
    for (let i = 1; i < pts.length; i++) clampFn(pts[i]);
  }
}
// Steps all three chains from the current joints. windPx = scroll speed in px/s (already gait-scaled).
function hairStep(j, J, dt, windPx) {
  const h = j.hair, s = JON.TARGET_PX / JON.FIGURE_UNITS;
  const groundOff = j.y / s;                         // feet height above ground, figure units
  const oy = J.dy - groundOff;                       // local-frame → ground-frame
  const head = J.head, hip = J.hip;
  const ax = head.x - 7, ay = head.y + 7 + oy;       // nape of the hair helmet
  const backBottomX = hip.x - 9, backBottomY = hip.y + oy;
  const backX = y => lerp(ax, backBottomX, clamp((y - ay) / (backBottomY - ay || 1), 0, 1.4));
  const clampMain = p => { p.x = Math.min(p.x, backX(p.y) + 1); p.y = Math.min(p.y, -2); };
  const clampLock = p => { p.y = Math.min(p.y, -2); };

  let accX = -windPx * HAIRSIM.WIND_K, accY = HAIRSIM.G;
  if (!j.grounded) {
    accX -= HAIRSIM.AIR_WIND;
    if (j.vy < 0) accY -= Math.min(650, (-j.vy / s) * HAIRSIM.FALL_LIFT);
  }
  chainStep(h.main, ax, ay, accX, accY, HAIRSIM.SEG, HAIRSIM.DAMP, dt, clampMain);
  chainStep(h.near, head.x - 4, head.y + 4 + oy, accX * HAIRSIM.LOCK_WIND, HAIRSIM.G, HAIRSIM.LOCK_SEG, HAIRSIM.LOCK_DAMP, dt, clampLock);
  chainStep(h.far,  head.x - 9, head.y + 2 + oy, accX * HAIRSIM.LOCK_WIND, HAIRSIM.G, HAIRSIM.LOCK_SEG, HAIRSIM.LOCK_DAMP, dt, clampLock);
}
// Catmull-Rom resample of a chain into a smooth centreline.
function resample(pts, per) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let k = 0; k < per; k++) {
      const u = k / per, u2 = u * u, u3 = u2 * u;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3)
      });
    }
  }
  out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
  return out;
}
// ONE tapered ribbon along the main chain, soft 3-bump end. oy converts ground-frame back to the drawing frame.
function drawHairRibbon(ctx, chain, oy, t) {
  const c = resample(chain, 4), N = c.length - 1, nrm = [];
  for (let i = 0; i <= N; i++) {
    const a = c[Math.min(i + 1, N)], b = c[Math.max(i - 1, 0)];
    const tx = a.x - b.x, ty = a.y - b.y, L = Math.hypot(tx, ty) || 1;
    nrm.push({ x: -ty / L, y: tx / L });
  }
  const halfW = s => s < 0.15 ? lerp(HAIRSIM.W_SCALP, HAIRSIM.W_FULL, s / 0.15) : lerp(HAIRSIM.W_FULL, HAIRSIM.W_END, (s - 0.15) / 0.85);
  ctx.fillStyle = JON_PAL.brown;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) { const w = halfW(i / N); ctx.lineTo(c[i].x - nrm[i].x * w, c[i].y - nrm[i].y * w + oy); }
  const e = c[N], n = nrm[N], w = halfW(1);
  const dx = e.x - c[N - 1].x, dy = e.y - c[N - 1].y, dL = Math.hypot(dx, dy) || 1, ux = dx / dL, uy = dy / dL;
  for (let k = 1; k < 9; k++) {
    const u = k / 9, side = -w * (1 - 2 * u);
    const bump = HAIRSIM.BUMP_AMP * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * HAIRSIM.BUMPS + t)) * Math.sin(u * Math.PI);
    ctx.lineTo(e.x + n.x * side + ux * bump, e.y + n.y * side + uy * bump + oy);
  }
  for (let i = N; i >= 0; i--) { const w2 = halfW(i / N); ctx.lineTo(c[i].x + nrm[i].x * w2, c[i].y + nrm[i].y * w2 + oy); }
  ctx.closePath(); ctx.fill();
}
// Front lock: tapered stroke along its chain.
function drawLock(ctx, chain, oy, w0, shade) {
  const c = resample(chain, 3);
  for (let i = 0; i < c.length - 1; i++) {
    const w = lerp(w0, 2, i / (c.length - 2));
    ctx.strokeStyle = JON_PAL.brown; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c[i].x, c[i].y + oy); ctx.lineTo(c[i + 1].x, c[i + 1].y + oy); ctx.stroke();
    if (shade) { ctx.strokeStyle = JON_PAL.shade; ctx.stroke(); }
  }
}

// Joint positions in figure units from a pose. dy grounds the lowest foot.
function jonJoints(P, grounded) {
  const hip = { x: 0, y: P.hipY };
  const shoulder = seg(hip, -40, -P.lean);
  const neck = seg(shoulder, -5, -P.lean);
  const head = seg(neck, -12, -(P.lean + P.headPitch));
  const nKnee = seg(hip, 30, P.nearHip), nAnkle = seg(nKnee, 30, P.nearHip - P.nearKnee);
  const fKnee = seg(hip, 30, P.farHip),  fAnkle = seg(fKnee, 30, P.farHip - P.farKnee);
  const nElbow = seg(shoulder, 22, P.nearSh), nHand = seg(nElbow, 20, P.nearSh + P.nearEl);
  const fElbow = seg(shoulder, 22, P.farSh),  fHand = seg(fElbow, 20, P.farSh + P.farEl);
  const dy = grounded ? -(Math.max(nAnkle.y, fAnkle.y) + 6) : 0;
  return { hip, shoulder, neck, head, nKnee, nAnkle, fKnee, fAnkle, nElbow, nHand, fElbow, fHand, dy };
}

// Draws Jon with feet at (x, groundY) in screen space. `scale` maps figure units to px.
// yUpPx = drawn height above ground, used to map the ground-frame hair back onto the body.
export function drawJon(ctx, pal, t, j, x, groundY, scale, yUpPx, opts) {
  opts = opts || {};
  const P = j.pose;
  const J = jonJoints(P, j.grounded);
  const { hip, shoulder, neck, head, nKnee, nAnkle, fKnee, fAnkle, nElbow, nHand, fElbow, fHand, dy } = J;
  const hairOy = (yUpPx || 0) / scale - dy;        // ground-frame → drawing frame (which already has dy applied)
  j.headScreen = { x: x + head.x * scale, y: groundY + (head.y + dy) * scale };   // for the headlamp cone

  const sinceLand = j.landedAt >= 0 ? (performance.now() - j.landedAt) / 1000 : 9;
  const squash = sinceLand < JON.LAND_SQUASH_S ? 1 - 0.2 * Math.sin((sinceLand / JON.LAND_SQUASH_S) * Math.PI) : 1;
  // Beard: stride timing, half a beat behind the head; flies back on descents and in the air.
  const beardSway = Math.sin(j.phase * 2 - Math.PI / 2) * 1.6 - P.beardFly * 2.5;
  const beardLift = P.beardFly * 0.12;

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);
  ctx.translate(0, dy);
  if (j.state === 'sit') {                                                    // the rock
    ctx.fillStyle = '#6b6656'; ctx.beginPath(); ctx.ellipse(-6, -14, 30, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(-6, -8, 30, 10, 0, 0, Math.PI); ctx.fill();
  }

  // 1. hair ribbon (behind everything) and the far-side front lock
  drawHairRibbon(ctx, j.hair.main, hairOy, t);
  drawLock(ctx, j.hair.far, hairOy, 3.2, true);

  // 2. far arm
  drawLimb(ctx, shoulder, fElbow, 8, pal.skin);
  drawLimb(ctx, fElbow, fHand, 7, pal.skin);
  inkSleeve(ctx, fElbow, fHand);
  drawLimb(ctx, shoulder, fElbow, 8, pal.shade);
  drawLimb(ctx, fElbow, fHand, 7, pal.shade);

  // 3. far leg
  drawLimb(ctx, hip, fKnee, 10, pal.skin);
  drawLimb(ctx, fKnee, fAnkle, 8.5, pal.skin);
  drawLimb(ctx, hip, fKnee, 10, pal.shade);
  drawLimb(ctx, fKnee, fAnkle, 8.5, pal.shade);
  drawShoe(ctx, fAnkle, P.farHip - P.farKnee);

  // poles: planted one per hand on climbs; raised in a V at the finish; otherwise bunched in the trailing hand, behind the torso
  if (JON.POLES) {
    if (P.poleUp > 0.5) drawRaisedPole(ctx, pal, fHand, -0.5, true);
    else if (P.poleSplit > 0.5) drawPlantedPole(ctx, pal, fHand, 0.45 - 0.35 * Math.sin(j.phase), true);
    else drawCarriedPoles(ctx, pal, fHand, P.poleAng);
  }

  // 5. torso: tee, then vest as the single brightest block
  ctx.save();
  ctx.translate(hip.x, hip.y); ctx.rotate(P.lean);
  ctx.fillStyle = pal.offwhite;
  ctx.beginPath(); ctx.roundRect(-10, -44, 20, 50, 6); ctx.fill();
  const bounce = Math.abs(Math.sin(j.phase)) * 0.8;
  ctx.fillStyle = pal.vest;
  ctx.beginPath(); ctx.roundRect(-10.5, -45 + bounce, 24, 31, [5, 7, 5, 4]); ctx.fill();
  ctx.fillStyle = pal.offwhite;                                 // one flask, front pocket
  ctx.beginPath(); ctx.roundRect(8.5, -41 + bounce, 5, 13, 2); ctx.fill();
  ctx.restore();
  drawLock(ctx, j.hair.near, hairOy, 3.8, false);            // near-side front lock, in front of the strap

  // 6. near leg
  drawLimb(ctx, hip, nKnee, 10.5, pal.skin);
  drawLimb(ctx, nKnee, nAnkle, 9, pal.skin);
  inkThighMark(ctx, hip, nKnee);
  inkDagger(ctx, nKnee, nAnkle);
  drawShoe(ctx, nAnkle, P.nearHip - P.nearKnee);

  // 7. split shorts, bib on the near thigh
  const shortsLeg = (knee, dark) => {
    const dx = knee.x - hip.x, dy2 = knee.y - hip.y, L = Math.hypot(dx, dy2) || 1;
    const nx = -dy2 / L * 7, ny = dx / L * 7, hem = 0.56;
    ctx.fillStyle = pal.pink;
    ctx.beginPath();
    ctx.moveTo(hip.x - nx - 3, hip.y - ny - 6); ctx.lineTo(hip.x + nx + 3, hip.y + ny - 6);
    ctx.lineTo(hip.x + dx * hem + nx * 1.05, hip.y + dy2 * hem + ny * 1.05);
    ctx.lineTo(hip.x + dx * (hem - 0.06) - nx * 1.05, hip.y + dy2 * (hem - 0.06) - ny * 1.05);
    ctx.closePath(); ctx.fill();
    if (dark) { ctx.fillStyle = pal.shade; ctx.fill(); }
  };
  shortsLeg(fKnee, true);
  shortsLeg(nKnee, false);
  ctx.fillStyle = pal.pink; ctx.beginPath(); ctx.roundRect(hip.x - 10, hip.y - 8, 20, 9, 3); ctx.fill();
  {
    const s = 0.38, bx = hip.x + (nKnee.x - hip.x) * s, by = hip.y + (nKnee.y - hip.y) * s;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(-P.nearHip);
    ctx.fillStyle = pal.bib; ctx.fillRect(-5, -3.5, 10, 7);
    ctx.fillStyle = pal.black; ctx.font = 'bold 5px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(JON.BIB, 0, 0.4);
    ctx.restore();
  }

  // 8. near arm, tee sleeve, ink sleeve, poles
  drawLimb(ctx, shoulder, nElbow, 8.5, pal.skin);
  drawLimb(ctx, shoulder, seg(shoulder, 11, P.nearSh), 12, pal.offwhite);
  drawLimb(ctx, nElbow, nHand, 7.5, pal.skin);
  inkSleeve(ctx, nElbow, nHand);
  if (JON.POLES && P.poleUp > 0.5) drawRaisedPole(ctx, pal, nHand, 0.5, false);
  else if (JON.POLES && P.poleSplit > 0.5) drawPlantedPole(ctx, pal, nHand, 0.45 + 0.35 * Math.sin(j.phase), false);
  ctx.fillStyle = pal.skin; ctx.beginPath(); ctx.arc(nHand.x, nHand.y, 4, 0, Math.PI * 2); ctx.fill();

  // 9. neck, head
  drawLimb(ctx, shoulder, neck, 8, pal.skin);
  ctx.fillStyle = pal.skin; ctx.beginPath(); ctx.arc(head.x, head.y, 12, 0, Math.PI * 2); ctx.fill();
  // hair helmet: brow line over the crown to the nape, one filled shape; the cap sits on top of it
  ctx.fillStyle = pal.brown;
  ctx.beginPath();
  ctx.moveTo(head.x + 7.2, head.y - 10.6);                                   // brow line
  ctx.arc(head.x, head.y, 12.8, -Math.PI / 2 + 0.6, Math.PI / 2 + 0.35, true);   // over the crown, down the back
  ctx.lineTo(head.x - 6.5, head.y + 4); ctx.lineTo(head.x - 2, head.y - 4);  // hairline behind the glasses
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.skin;
  ctx.beginPath(); ctx.arc(head.x + 11.8, head.y + 3.5, 3, 0, Math.PI * 2); ctx.fill();   // nose

  // 10. beard: one mass hung well below the glasses, leaving a cheek + nose skin window
  ctx.save();
  ctx.translate(head.x + 2 + beardSway, head.y + 9); ctx.rotate(-beardLift); ctx.scale(1, squash);
  ctx.fillStyle = pal.brown;
  ctx.beginPath();
  ctx.moveTo(7, -1);
  ctx.quadraticCurveTo(12, 5, 9.5, 12);
  ctx.quadraticCurveTo(6.5, 19.5, 0.5, 21);
  ctx.quadraticCurveTo(-6, 19.5, -7.5, 12);
  ctx.quadraticCurveTo(-9, 4, -6.5, -1.5);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // 11. shield glasses: one blue shape on the face by day; pushed up onto the cap bill at dusk
  if (!opts.glassesOnCap) {
    ctx.fillStyle = pal.blue;
    ctx.beginPath(); ctx.moveTo(head.x - 4, head.y - 5.5); ctx.lineTo(head.x + 13.5, head.y - 5);
    ctx.lineTo(head.x + 14.5, head.y + 1.5); ctx.lineTo(head.x - 3, head.y + 2.5); ctx.closePath(); ctx.fill();
  }

  // 12. cap: the silhouette. Green mesh back, off-white front, green bill leading.
  ctx.save();
  ctx.translate(head.x, head.y - 3.5); ctx.rotate((P.lean + P.headPitch) * 0.6);
  ctx.fillStyle = pal.green;
  ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI, Math.PI * 1.5); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.offwhite;
  ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI * 1.5, Math.PI * 2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.green;
  ctx.fillRect(-14, -0.5, 28, 3);
  ctx.beginPath(); ctx.moveTo(4, -1.5); ctx.quadraticCurveTo(16, -5, 27, 0.5);
  ctx.lineTo(26, 3.2); ctx.quadraticCurveTo(15, -1, 4, 2.4); ctx.closePath(); ctx.fill();
  if (opts.glassesOnCap) {                                        // glasses resting on the bill
    ctx.fillStyle = pal.blue;
    ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(19, -6.5); ctx.lineTo(19.5, -2.5); ctx.lineTo(7, -0.5); ctx.closePath(); ctx.fill();
  }
  if (opts.lamp > 0) {                                            // headlamp on the cap front
    ctx.fillStyle = pal.black; ctx.fillRect(7, -12, 6, 5);
    ctx.fillStyle = `rgba(255,236,170,${0.6 + 0.4 * opts.lamp})`; ctx.beginPath(); ctx.arc(13.5, -9.5, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

function drawCarriedPoles(ctx, pal, hand, a) {
  const L = 60;
  for (let k = 0; k < 2; k++) {
    const ox = k * 2.6, oy = k * -1.8;
    const hx = hand.x + ox, hy = hand.y + oy;
    ctx.strokeStyle = pal.blue; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 9, hy - Math.sin(a) * 9); ctx.lineTo(hx - Math.cos(a) * L, hy + Math.sin(a) * L); ctx.stroke();
    ctx.strokeStyle = pal.black; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 9, hy - Math.sin(a) * 9); ctx.lineTo(hx + Math.cos(a) * 1, hy - Math.sin(a) * 1); ctx.stroke();
  }
}
// Raised pole: from the hand straight up and outward (finish V).
function drawRaisedPole(ctx, pal, hand, lean, far) {
  const tip = { x: hand.x + Math.sin(lean) * 58, y: hand.y - Math.cos(lean) * 58 };
  ctx.strokeStyle = pal.blue; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hand.x, hand.y + 8); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  if (far) { ctx.strokeStyle = pal.shade; ctx.stroke(); }
  ctx.strokeStyle = pal.black; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hand.x, hand.y + 8); ctx.lineTo(hand.x, hand.y); ctx.stroke();
}
// Planted pole: tip on the ground line, angle from straight down.
function drawPlantedPole(ctx, pal, hand, ang, far) {
  const len = Math.max(20, (-hand.y - 6) / Math.cos(ang));
  const tip = seg(hand, len, ang);
  ctx.strokeStyle = pal.blue; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hand.x, hand.y - 8); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  if (far) { ctx.strokeStyle = pal.shade; ctx.stroke(); }
  ctx.strokeStyle = pal.black; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hand.x, hand.y - 8); ctx.lineTo(hand.x, hand.y); ctx.stroke();
}

// ===== character viewer (likeness passes; J toggles) =====
// Lives with Jon so the poses, gaits and hair sim stay module-private.
const VIEWER = { STATES: ['run', 'jump', 'duck', 'uphill', 'downhill'], HOLD_S: 2, ZOOM: 4, JUMP_H: 60 };

export function viewerToggle() {
  const v = GAME.viewer;
  v.on = !v.on;
  if (v.on) { v.idx = 0; v.timer = 0; v.jon = makeJon(); v.jon.state = 'run'; }
}
export function viewerStep(dt) {
  const v = GAME.viewer, j = v.jon;
  v.timer += dt;
  if (v.timer >= VIEWER.HOLD_S) { v.timer = 0; v.idx = (v.idx + 1) % VIEWER.STATES.length; j.landedAt = -1; }
  const s = VIEWER.STATES[v.idx], prog = v.timer / VIEWER.HOLD_S;
  j.grounded = true; j.y = 0;
  let target;
  if (s === 'run')      { j.gait = 'flat'; j.phase += dt * 300 / JON.STRIDE_PX * Math.PI * 2; target = gaitPose(j.phase, 'flat'); }
  else if (s === 'uphill')   { j.gait = 'up';   j.phase += dt * 190 / JON.STRIDE_PX * Math.PI * 2; target = gaitPose(j.phase, 'up'); }
  else if (s === 'downhill') { j.gait = 'down'; j.phase += dt * 420 / JON.STRIDE_PX * Math.PI * 2; target = gaitPose(j.phase, 'down'); }
  else if (s === 'duck') { j.phase += dt * 1.5; target = POSES.duck; }
  else {                                                         // jump: one arc per hold
    const arc = Math.sin(prog * Math.PI);
    j.grounded = false; j.y = VIEWER.JUMP_H * arc; j.vy = VIEWER.JUMP_H * Math.PI * Math.cos(prog * Math.PI) / VIEWER.HOLD_S;
    target = prog < 0.5 ? POSES.jumpUp : POSES.jumpDown;
    if (prog > 0.96 && j.landedAt < 0) j.landedAt = performance.now();
  }
  j.prevY = j.y;
  blendPose(j, target, dt);
  const wind = s === 'uphill' ? 190 : s === 'downhill' ? 420 : 300;
  hairStep(j, jonJoints(j.pose, j.grounded), dt, wind * j.pose.windMul);
}
export function viewerRender(ctx, tReal) {
  const v = GAME.viewer, j = v.jon;
  const scale = VIEWER.ZOOM * JON.TARGET_PX / JON.FIGURE_UNITS;
  const groundY = 672;
  ctx.fillStyle = '#9b9c94'; ctx.fillRect(0, 0, ENGINE.W, ENGINE.H);
  ctx.fillStyle = '#84857d'; ctx.fillRect(0, groundY, ENGINE.W, ENGINE.H - groundY);

  // Slope line so uphill/downhill read as slopes even though the ground stays flat.
  const s = VIEWER.STATES[v.idx];
  if (s === 'uphill' || s === 'downhill') {
    const g = s === 'uphill' ? -0.32 : 0.32;
    ctx.strokeStyle = 'rgba(40,40,36,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.moveTo(ENGINE.W / 2 - 260, groundY - 260 * -g); ctx.lineTo(ENGINE.W / 2 + 260, groundY + 260 * -g); ctx.stroke();
    ctx.setLineDash([]);
  }

  drawJon(ctx, JON_PAL, GAME.t + tReal, j, ENGINE.W / 2, groundY - j.y, scale, j.y);

  // 1:1 in-game preview beside the big one, so the size decision is made at true scale.
  drawJon(ctx, JON_PAL, GAME.t + tReal, j, ENGINE.W - 120, groundY - j.y * 0.25, JON.TARGET_PX / JON.FIGURE_UNITS, j.y * 0.25);
  ctx.fillStyle = 'rgba(40,40,36,0.7)'; ctx.font = '14px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`in-game size: ${JON.TARGET_PX} px`, ENGINE.W - 120, groundY + 26);

  ctx.fillStyle = '#2b2b27'; ctx.textAlign = 'left';
  ctx.font = '700 40px ' + UI_FONT; ctx.fillText(s, 40, 60);
  ctx.font = '16px ' + UI_FONT; ctx.fillStyle = 'rgba(40,40,36,0.75)';
  ctx.fillText(`Character viewer, ${VIEWER.ZOOM}× in-game size.  J: back to game    [ ]: in-game size ±10 px    ${v.idx + 1} of ${VIEWER.STATES.length}`, 40, 92);
  // Hold-timer bar
  ctx.fillStyle = 'rgba(40,40,36,0.25)'; ctx.fillRect(40, 108, 300, 4);
  ctx.fillStyle = 'rgba(40,40,36,0.7)'; ctx.fillRect(40, 108, 300 * (v.timer / VIEWER.HOLD_S), 4);
}
