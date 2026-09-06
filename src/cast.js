// ===== MODULE: cast =====
// Finish-line cast (docs/Harper_JonsUltra_FinishLineCast_2026.md). Katie and Emma are fixed designs;
// spectators are seeded. Finding cues: Katie = fringe + thin black rectangular glasses + cowbell,
// Emma = long wavy hair + phone held up recording. Nobody else has either, and only those two get
// their own wave timing. Crowd faces stay featureless. No brand marks, no text anywhere.
import { hash, lerp } from './engine.js';
import { JON } from './jon.js';

// Spectator figure height in local units (feet to hair top). Crowd size is always derived from Jon's
// live height — front row 0.9 × Jon, back row 0.75 × Jon (Michael 2026-09-05) — never a fixed px, so
// the [ ] Jon-size keys rescale the crowd with him.
const CAST_UNITS = 90;
export function castScale(row) {
  return (row === 'front' ? 0.9 : 0.75) * JON.TARGET_PX / CAST_UNITS;
}

const CAST = {
  KATIE: { skin: '#ecc5a4', hair: '#241811', tee: '#3a3a40', jeans: '#4f6d99', boot: '#1A1A1A', frame: '#141414', lens: '#5a5049' },
  EMMA:  { skin: '#e6bd9d', hair: '#3a2a1c', top: '#cfe2f0', skirt: '#7f9cba', shoe: '#f0efea' },
  TORT:  { shell: '#776a3e', plate: '#57491f', skin: '#8c8256', eye: '#1A1A1A' },
  BOUNCE_PX: 4,               // Katie/Emma cheer bounce when the camera eases toward them (cast sheet §4)
  BACK_DIM: 0.62              // back-row brightness multiplier (cast sheet §6: back row darker)
};

// Darken a hex colour for the back row.
function dk(hex, f) {
  if (f >= 1) return hex;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * f);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * f);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * f);
  return `rgb(${r},${g},${b})`;
}

// --- crowd layout (cast sheet §6): 18–24 over the last ~500 px, two depth rows, irregular gaps,
// height ±15%, front-row slots wide enough that nobody overlaps. Katie and Emma keep a clear space.
// `rel` is the ±15% per-person height variance; the row's absolute scale comes from castScale() at draw
// time. Kid-on-shoulders figures are capped at 1.0 so no head ever reaches the FINISH banner.
let crowdCache = null;
function relFor(seed, h) {
  const pose = POSES[Math.floor(hash(seed * 97 + 13) * POSES.length)];
  const rel = 1 + (h - 0.5) * 0.3;
  return pose === 'shoulders' ? Math.min(rel, 1) : rel;
}
export function finishCrowdLayout() {
  if (crowdCache) return crowdCache;
  const list = [];
  for (let i = 0; i < 13; i++) {                                        // front row: floodlit, 0.9 × Jon
    if (hash(i * 631 + 17) < 0.14) continue;                            // gaps
    const dx = -500 + i * 45 + (hash(i * 907 + 3) - 0.5) * 16;
    if (dx > -115 && dx < -8) continue;                                 // Katie and Emma's clear space
    list.push({ dx, row: 'front', rel: relFor(i + 100, hash(i * 389 + 7)), seed: i + 100 });
  }
  for (let i = 0; i < 15; i++) {                                        // back row: 0.75 × Jon, darker
    if (hash(i * 733 + 29) < 0.1) continue;
    const dx = -520 + i * 38 + (hash(i * 1013 + 11) - 0.5) * 16;
    list.push({ dx, row: 'back', rel: relFor(i, hash(i * 449 + 5)), seed: i });
  }
  crowdCache = list;
  return list;
}

const POSES = ['arms', 'clap', 'phone', 'cowbell', 'shoulders', 'cooler'];
const SKINS = ['#C58E62', '#8d5a3b', '#e9b98f', '#6b4128'];
const HAIRS = ['#3B2416', '#1A1A1A', '#8a5a2a', '#d9b06a'];
const CROWD_TOPS = ['#c84a4a', '#3d7cc9', '#e0a33a', '#5aa36a', '#8b5cb8', '#e07a9a', '#2c9c9c', '#d96b3b'];

function drawCowbell(ctx, x, y, t, ph, bell, clapper) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 5.2 + ph) * 0.28);
  ctx.strokeStyle = clapper; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 3); ctx.stroke();
  ctx.fillStyle = bell; ctx.beginPath(); ctx.moveTo(-3, 3); ctx.lineTo(3, 3); ctx.lineTo(4.2, 10); ctx.lineTo(-4.2, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = clapper; ctx.fillRect(-0.9, 8.5, 1.8, 2.6);
  ctx.restore();
}
function arm(ctx, color, x0, y0, x1, y1, w) {
  ctx.strokeStyle = color; ctx.lineWidth = w || 4.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

// Generic spectator: featureless (hair + skin + clothes), pose from seed, staggered rhythm.
export function drawSpectator(ctx, x, y, s, seed, t, dim) {
  const f = dim ? CAST.BACK_DIM : 1;
  const h1 = hash(seed * 31 + 7), h2 = hash(seed * 53 + 11), h3 = hash(seed * 71 + 3);
  const skin = dk(SKINS[Math.floor(h2 * 4)], f), top = dk(CROWD_TOPS[Math.floor(h1 * CROWD_TOPS.length)], f);
  const hairC = dk(HAIRS[Math.floor(h3 * 4)], f), pants = dk('#2b2b30', f);
  const ph = h3 * Math.PI * 2, wave = Math.sin(t * 3.2 + ph);           // staggered rhythm per person
  const pose = POSES[Math.floor(hash(seed * 97 + 13) * POSES.length)];
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);

  if (pose === 'cooler') {                                              // sitting one out on the cooler
    ctx.fillStyle = dk('#dfe3e8', f); ctx.beginPath(); ctx.roundRect(-9, -12, 18, 12, 2); ctx.fill();
    ctx.fillStyle = dk('#3d7cc9', f); ctx.fillRect(-9, -13.5, 18, 3);   // lid
    ctx.strokeStyle = pants; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, -16); ctx.lineTo(8, -15); ctx.lineTo(9, -3); ctx.stroke();   // bent legs
    ctx.fillStyle = skin; ctx.fillRect(6.5, -4, 6, 4);                  // feet
    ctx.fillStyle = top; ctx.beginPath(); ctx.roundRect(-8, -42, 16, 28, 4); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -50, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hairC; ctx.beginPath(); ctx.arc(0, -52, 9, Math.PI, Math.PI * 2); ctx.fill();
    arm(ctx, skin, -7, -38, -10, -22, 4);                               // one arm resting on the knee
    const a = 2.3 + wave * 0.3;                                          // the other still cheers a little
    arm(ctx, skin, 7, -38, 7 + Math.sin(a) * 18, -38 + Math.cos(a) * 18, 4);
    ctx.restore(); return;
  }

  // standing base
  ctx.fillStyle = pants; ctx.fillRect(-7, -34, 5.5, 34); ctx.fillRect(1.5, -34, 5.5, 34);
  ctx.fillStyle = top; ctx.beginPath(); ctx.roundRect(-10, -66, 20, 34, 4); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -76, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hairC; ctx.beginPath(); ctx.arc(0, -78, 10, Math.PI, Math.PI * 2); ctx.fill();

  if (pose === 'arms') {
    const up = 0.5 + 0.5 * wave;
    for (const side of [-1, 1]) {
      const a = lerp(0.3, 2.6, up) * side;
      arm(ctx, skin, side * 9, -62, side * 9 + Math.sin(a) * 22 * side, -62 + Math.cos(a) * 22);
    }
  } else if (pose === 'clap') {
    const gap = 2 + 7 * Math.abs(Math.sin(t * 5 + ph));                 // hands meet on the beat
    for (const side of [-1, 1]) arm(ctx, skin, side * 9, -62, side * gap, -56);
  } else if (pose === 'phone') {
    arm(ctx, skin, -9, -62, -11, -46);                                  // off arm down
    arm(ctx, skin, 9, -62, 7, -88);
    ctx.fillStyle = dk('#1A1A1A', f); ctx.beginPath(); ctx.roundRect(5, -96, 4.2, 8.8, 1.2); ctx.fill();
    ctx.fillStyle = dk('#8fb9d9', f); ctx.fillRect(5.7, -95, 1.1, 6.8);
  } else if (pose === 'cowbell') {
    arm(ctx, skin, 9, -62, 12, -46);                                    // off arm down
    arm(ctx, skin, -9, -62, -13, -84);
    drawCowbell(ctx, -13, -84, t, ph, dk('#8f8f93', f), dk('#4a4a4e', f));
  } else if (pose === 'shoulders') {                                    // kid up top, both of them cheering
    for (const side of [-1, 1]) arm(ctx, skin, side * 9, -62, side * 14, -80);   // adult holds the kid's legs
    const kSkin = dk(SKINS[Math.floor(hash(seed * 121 + 9) * 4)], f);
    const kTop = dk(CROWD_TOPS[Math.floor(hash(seed * 143 + 3) * CROWD_TOPS.length)], f);
    ctx.fillStyle = kSkin; ctx.fillRect(-7.5, -95, 3.5, 12); ctx.fillRect(4, -95, 3.5, 12);      // legs straddle
    ctx.fillStyle = kTop; ctx.beginPath(); ctx.roundRect(-5.5, -104, 11, 13, 3); ctx.fill();
    ctx.fillStyle = kSkin; ctx.beginPath(); ctx.arc(0, -110, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hairC; ctx.beginPath(); ctx.arc(0, -111.5, 6.4, Math.PI, Math.PI * 2); ctx.fill();
    const ka = 2.4 + Math.sin(t * 4.1 + ph) * 0.3;
    for (const side of [-1, 1]) arm(ctx, kSkin, side * 5, -100, side * 5 + Math.sin(ka) * 12 * side, -100 + Math.cos(ka) * 12, 3);
  }
  ctx.restore();
}

// --- Katie (cast sheet §2): straight dark hair past the shoulders, full straight fringe as a band above
// the frames, thin black rectangular glasses with a lighter lens fill, charcoal tee, jeans, black boots,
// cowbell up, other arm waving on her own timing. Front row near side, closest to the tape.
export function drawKatie(ctx, x, y, s, t, cheer) {
  const K = CAST.KATIE;
  const bounce = -Math.abs(Math.sin(t * 5.5)) * CAST.BOUNCE_PX * cheer;
  ctx.save(); ctx.translate(x, y + bounce); ctx.scale(s, s);
  // hair back mass first: straight, past the shoulders
  ctx.fillStyle = K.hair; ctx.beginPath(); ctx.roundRect(-11.5, -90, 23, 44, [9, 9, 3, 3]); ctx.fill();
  // jeans + boots
  ctx.fillStyle = K.jeans; ctx.fillRect(-7, -34, 5.5, 29); ctx.fillRect(1.5, -34, 5.5, 29);
  ctx.fillStyle = K.boot; ctx.fillRect(-8, -6, 7.5, 6); ctx.fillRect(0.5, -6, 7.5, 6);
  // charcoal tee
  ctx.fillStyle = K.tee; ctx.beginPath(); ctx.roundRect(-10, -66, 20, 34, 4); ctx.fill();
  // head; straight side curtains; fringe sits as a band above the frames, skin visible below it
  ctx.fillStyle = K.skin; ctx.beginPath(); ctx.arc(0, -76, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = K.hair;
  ctx.fillRect(-11.5, -85, 3.8, 32); ctx.fillRect(7.7, -85, 3.8, 32);                       // side curtains
  ctx.beginPath(); ctx.roundRect(-8.5, -86.5, 17, 6.5, [7, 7, 1, 1]); ctx.fill();           // fringe band
  // glasses: thin dark frame outline with a slightly lighter lens fill, sized to the eyes — never a bar
  ctx.fillStyle = K.lens;
  ctx.fillRect(-6.8, -77.6, 5.6, 4.6); ctx.fillRect(1.2, -77.6, 5.6, 4.6);
  ctx.strokeStyle = K.frame; ctx.lineWidth = 1.3; ctx.lineJoin = 'round';
  ctx.strokeRect(-6.8, -77.6, 5.6, 4.6); ctx.strokeRect(1.2, -77.6, 5.6, 4.6);
  ctx.beginPath(); ctx.moveTo(-1.2, -76.2); ctx.lineTo(1.2, -76.2); ctx.stroke();           // bridge
  // arms: her own wave timing (nobody in the crowd shares it), cowbell in the other hand
  ctx.strokeStyle = K.skin; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  const waveA = 2.35 + Math.sin(t * 3.4) * 0.25;
  ctx.beginPath(); ctx.moveTo(9, -62); ctx.lineTo(9 + Math.sin(waveA) * 22, -62 + Math.cos(waveA) * 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9, -62); ctx.lineTo(-14, -84); ctx.stroke();
  drawCowbell(ctx, -14, -84, t, 0, '#8f8f93', '#4a4a4e');
  ctx.restore();
}

// --- Emma (cast sheet §3): teen, a little shorter than Katie; long wavy dark hair framing the face,
// no fringe, no glasses; light top, denim skirt, white sneakers. Phone held up recording Jon in one
// hand, other arm waving on her own timing — the raised phone is her identifier at distance.
export function drawEmma(ctx, x, y, s, t, cheer) {
  const E = CAST.EMMA;
  const bounce = -Math.abs(Math.sin(t * 5.5 + 0.9)) * CAST.BOUNCE_PX * cheer;
  ctx.save(); ctx.translate(x, y + bounce); ctx.scale(s, s);
  // hair back mass: soft waves — wavy hem drawn as three lobes, past the shoulders
  ctx.fillStyle = E.hair;
  ctx.beginPath(); ctx.roundRect(-12, -88, 24, 40, [9, 9, 4, 4]); ctx.fill();
  ctx.beginPath();
  for (const [lx, r] of [[-8, 4.4], [0, 5], [8, 4.4]]) ctx.ellipse(lx, -49, r, 5.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs + white sneakers
  ctx.fillStyle = E.skin; ctx.fillRect(-6.5, -22, 5, 17); ctx.fillRect(1.5, -22, 5, 17);
  ctx.fillStyle = E.shoe; ctx.fillRect(-8, -5, 7.5, 5); ctx.fillRect(0.5, -5, 7.5, 5);
  ctx.fillStyle = '#c9c9c2'; ctx.fillRect(-8, -1.2, 7.5, 1.2); ctx.fillRect(0.5, -1.2, 7.5, 1.2);   // soles
  // denim skirt over the hips
  ctx.fillStyle = E.skirt; ctx.beginPath(); ctx.moveTo(-8.5, -36); ctx.lineTo(8.5, -36); ctx.lineTo(10.5, -20); ctx.lineTo(-10.5, -20); ctx.closePath(); ctx.fill();
  // pale blue top
  ctx.fillStyle = E.top; ctx.beginPath(); ctx.roundRect(-9.5, -63, 19, 29, 4); ctx.fill();
  // head; hair frames the face — no fringe, so the forehead stays open; no other face marks
  ctx.fillStyle = E.skin; ctx.beginPath(); ctx.arc(0, -74, 9.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = E.hair;
  ctx.beginPath(); ctx.arc(0, -77, 9.8, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();          // crown, centre part
  ctx.fillRect(-11.5, -80, 3.6, 30); ctx.fillRect(7.9, -80, 3.6, 30);                          // face-framing locks
  // arms: phone up recording, wave on her own timing
  ctx.strokeStyle = E.skin; ctx.lineWidth = 4.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(9, -59); ctx.lineTo(13, -86); ctx.stroke();
  const waveA = 2.5 + Math.sin(t * 2.9 + 1.7) * 0.3;
  ctx.beginPath(); ctx.moveTo(-9, -59); ctx.lineTo(-9 - Math.sin(waveA) * 22, -59 + Math.cos(waveA) * 22); ctx.stroke();
  // the phone, held vertical, screen glow toward the trail
  ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.roundRect(11.2, -95.5, 4.2, 8.8, 1.2); ctx.fill();
  ctx.fillStyle = '#9fd7ff'; ctx.fillRect(11.9, -94.5, 1.1, 6.8);
  ctx.restore();
}

// --- desert tortoise (cast sheet §5): domed brown-olive shell with raised plates, stumpy elephant legs,
// wrinkled neck, small head. One front leg mid-step. Slow. Very slow. Never a hazard.
export function drawTortoise(ctx, x, y, t) {
  const T = CAST.TORT;
  const bob = Math.sin(t * 0.7) * 1.1;                               // slow head bob
  const step = Math.max(0, Math.sin(t * 0.8)) * 2.2;                 // front leg lifts mid-step, slowly
  ctx.save(); ctx.translate(x, y);
  // far legs
  ctx.fillStyle = T.skin;
  ctx.beginPath(); ctx.roundRect(-12, -9, 6, 9, [2, 2, 3, 3]); ctx.fill();
  ctx.beginPath(); ctx.roundRect(6, -9, 6, 9, [2, 2, 3, 3]); ctx.fill();
  // wrinkled neck + small head
  ctx.beginPath(); ctx.roundRect(12, -13 + bob, 8, 5.5, 3); ctx.fill();                        // neck
  ctx.beginPath(); ctx.ellipse(21, -11.5 + bob, 4.6, 3.6, 0, 0, Math.PI * 2); ctx.fill();      // head
  ctx.strokeStyle = T.plate; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(13.5, -12 + bob); ctx.lineTo(13.5, -9.5 + bob);
  ctx.moveTo(15.5, -12.5 + bob); ctx.lineTo(15.5, -9.5 + bob); ctx.stroke();                   // neck wrinkles
  ctx.fillStyle = T.eye; ctx.beginPath(); ctx.arc(22.5, -12.5 + bob, 0.9, 0, Math.PI * 2); ctx.fill();
  // near legs: stumpy elephant feet, front one mid-step
  ctx.fillStyle = T.skin;
  ctx.beginPath(); ctx.roundRect(-15, -8, 7, 8, [2, 2, 3, 3]); ctx.fill();
  ctx.beginPath(); ctx.roundRect(8, -8 - step, 7, 8, [2, 2, 3, 3]); ctx.fill();
  // domed shell with a raised-plate pattern
  ctx.fillStyle = T.shell; ctx.beginPath(); ctx.ellipse(0, -8, 17, 12, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = T.plate; ctx.fillRect(-17, -9.5, 34, 3);                                     // rim band
  ctx.strokeStyle = T.plate; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-14, -11); ctx.quadraticCurveTo(0, -15, 14, -11);                                 // lower plate seam
  ctx.moveTo(-10.5, -15.5); ctx.quadraticCurveTo(0, -19, 10.5, -15.5);                         // upper plate seam
  ctx.moveTo(-6, -12.5); ctx.lineTo(-7.5, -18);                                                // radial seams
  ctx.moveTo(0, -14); ctx.lineTo(0, -20);
  ctx.moveTo(6, -12.5); ctx.lineTo(7.5, -18);
  ctx.stroke();
  ctx.restore();
}
