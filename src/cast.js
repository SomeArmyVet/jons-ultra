// ===== MODULE: cast =====
// Finish-line cast (docs/Harper_JonsUltra_FinishLineCast_2026.md). Katie and Emma are fixed designs;
// spectators are seeded. Likeness stays cartoon-simple — the finding cues are Katie's fringe + black
// rectangular glasses + cowbell and Emma's long wavy hair + GO JON sign; nobody else has either.
// No brand marks, no text except Emma's sign.
import { hash, lerp } from './engine.js';
import { UI_FONT } from './ui.js';

const CAST = {
  KATIE: { skin: '#ecc5a4', hair: '#241811', tee: '#3a3a40', jeans: '#4f6d99', boot: '#1A1A1A', frame: '#141414' },
  EMMA:  { skin: '#e6bd9d', hair: '#3a2a1c', top: '#cfe2f0', skirt: '#7f9cba', shoe: '#f0efea' },
  TORT:  { shell: '#776a3e', plate: '#57491f', skin: '#8c8256', eye: '#1A1A1A' },
  BOUNCE_PX: 4                // Katie/Emma cheer bounce when the camera eases toward them (cast sheet §4.3)
};

// --- generic spectator: ≤3 tones each, arms raised on a staggered rhythm (cast sheet §6) ---
const CROWD_TOPS = ['#c84a4a', '#3d7cc9', '#e0a33a', '#5aa36a', '#8b5cb8', '#e07a9a', '#2c9c9c', '#d96b3b'];
export function drawSpectator(ctx, x, y, s, seed, t) {
  const h1 = hash(seed * 31 + 7), h2 = hash(seed * 53 + 11), h3 = hash(seed * 71 + 3);
  const skin = ['#C58E62', '#8d5a3b', '#e9b98f', '#6b4128'][Math.floor(h2 * 4)], top = CROWD_TOPS[Math.floor(h1 * CROWD_TOPS.length)];
  const wave = Math.sin(t * 3.2 + h3 * Math.PI * 2);                  // staggered rhythm per person
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#2b2b30'; ctx.fillRect(-7, -34, 5.5, 34); ctx.fillRect(1.5, -34, 5.5, 34);       // legs
  ctx.fillStyle = top; ctx.beginPath(); ctx.roundRect(-10, -66, 20, 34, 4); ctx.fill();               // torso
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -76, 9.5, 0, Math.PI * 2); ctx.fill();            // head
  ctx.fillStyle = ['#3B2416', '#1A1A1A', '#8a5a2a', '#d9b06a'][Math.floor(h3 * 4)];
  ctx.beginPath(); ctx.arc(0, -78, 10, Math.PI, Math.PI * 2); ctx.fill();                              // hair
  // arms: up when the wave is high, otherwise down at the sides
  const up = 0.5 + 0.5 * wave;
  ctx.strokeStyle = skin; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const a = lerp(0.3, 2.6, up) * side;
    ctx.beginPath(); ctx.moveTo(side * 9, -62); ctx.lineTo(side * 9 + Math.sin(a) * 22 * side, -62 + Math.cos(a) * 22); ctx.stroke();
  }
  ctx.restore();
}

// --- Katie (cast sheet §2): straight dark hair past the shoulders, full straight fringe, black
// rectangular glasses (always drawn), charcoal tee, blue jeans, black boots, cowbell up, closest to the tape.
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
  // head, then straight side curtains and the full fringe to the eyebrows — the silhouette cue
  ctx.fillStyle = K.skin; ctx.beginPath(); ctx.arc(0, -76, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = K.hair;
  ctx.fillRect(-11.5, -85, 3.8, 32); ctx.fillRect(7.7, -85, 3.8, 32);                       // side curtains
  ctx.beginPath(); ctx.roundRect(-8.5, -86, 17, 8.5, [7, 7, 1, 1]); ctx.fill();             // fringe
  // black rectangular glasses — the single strongest identifier, always dark frames
  ctx.strokeStyle = K.frame; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
  ctx.strokeRect(-7.5, -77.5, 6.6, 5.4); ctx.strokeRect(0.9, -77.5, 6.6, 5.4);
  ctx.beginPath(); ctx.moveTo(-0.9, -75.5); ctx.lineTo(0.9, -75.5); ctx.stroke();
  // arms up: right waves, left holds the cowbell
  ctx.strokeStyle = K.skin; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  const waveA = 2.35 + Math.sin(t * 3.4) * 0.25;
  ctx.beginPath(); ctx.moveTo(9, -62); ctx.lineTo(9 + Math.sin(waveA) * 22, -62 + Math.cos(waveA) * 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9, -62); ctx.lineTo(-14, -84); ctx.stroke();
  // cowbell: grey trapezoid swinging from the raised hand
  ctx.save(); ctx.translate(-14, -84); ctx.rotate(Math.sin(t * 5.2) * 0.28);
  ctx.strokeStyle = '#6d6d70'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 3); ctx.stroke();
  ctx.fillStyle = '#8f8f93'; ctx.beginPath(); ctx.moveTo(-3, 3); ctx.lineTo(3, 3); ctx.lineTo(4.2, 10); ctx.lineTo(-4.2, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a4a4e'; ctx.fillRect(-0.9, 8.5, 1.8, 2.6);                              // clapper
  ctx.restore();
  ctx.restore();
}

// --- Emma (cast sheet §3): teen, a little shorter than Katie; long dark wavy hair, no fringe, no glasses;
// pale blue top, denim skirt, white sneakers; the GO JON sign is her identifier at distance.
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
  // head; hair frames the face — no fringe, so the forehead stays open
  ctx.fillStyle = E.skin; ctx.beginPath(); ctx.arc(0, -74, 9.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = E.hair;
  ctx.beginPath(); ctx.arc(0, -77, 9.8, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();          // crown, centre part
  ctx.fillRect(-11.5, -80, 3.6, 30); ctx.fillRect(7.9, -80, 3.6, 30);                          // face-framing locks
  // both arms up to the sign stick
  ctx.strokeStyle = E.skin; ctx.lineWidth = 4.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -59); ctx.lineTo(-2.5, -86); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9, -59); ctx.lineTo(3.5, -86); ctx.stroke();
  // the hand-lettered GO JON sign, held high, gentle waggle
  ctx.save(); ctx.translate(0, -88); ctx.rotate(Math.sin(t * 2.6) * 0.06);
  ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-1.8, -28, 3.6, 30);
  ctx.fillStyle = '#F2F0E6'; ctx.fillRect(-26, -56, 52, 30);
  ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5; ctx.strokeRect(-26, -56, 52, 30);
  ctx.fillStyle = '#c84a4a'; ctx.font = '700 14px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('GO JON', 0, -41);
  ctx.restore();
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
