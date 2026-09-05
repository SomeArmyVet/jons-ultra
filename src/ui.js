// ===== MODULE: ui =====
// Cards, HUD, buttons, toasts. Title and race select arrive at step 7.
import { ENGINE, GAME, clamp } from './engine.js';
import { DIFFICULTY, SURFACES, courseElev, courseLoopMile } from './sim.js';
import { nextStation, ITEM_LABEL, buckleFor, finishSummaryText, resetRace } from './race.js';
import { JON } from './jon.js';
import { AudioBed } from './audio.js';

export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// --- cards and screens ---
export const UI = { buttons: [] };
function button(ctx, x, y, w, h, label, id, primary) {
  ctx.fillStyle = primary ? '#D8E24A' : 'rgba(234,243,228,0.16)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.fillStyle = primary ? '#10201a' : '#eaf3e4'; ctx.font = '600 16px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  UI.buttons.push({ x, y, w, h, id });
}
export function uiClick(px, py) {
  for (const b of UI.buttons) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { uiAction(b.id); return true; }
  return false;
}
export function uiAction(id) {
  if (id === 'go') GAME.screen = 'race';
  else if (id === 'restart') { resetRace(); GAME.screen = 'intro'; }
  else if (id === 'select') toast('Race select arrives at step 7');
  else if (id === 'share') {
    const text = finishSummaryText();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied summary'), () => toast('Copy failed'));
    else toast('Clipboard unavailable');
  }
}
export function toast(text) { GAME.toasts.push({ text, age: 0 }); }

function card(ctx, w, h, cx) {
  const x = (cx || ENGINE.W / 2) - w / 2, y = (ENGINE.H - h) / 2;
  ctx.fillStyle = 'rgba(10, 22, 18, 0.88)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(234,243,228,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  return { x, y, w, h };
}
export function drawIntroCard(ctx) {
  const c = GAME.course, r = card(ctx, 640, 360), rules = c.rules || {};
  ctx.fillStyle = '#eaf3e4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 30px ' + UI_FONT; ctx.fillText(c.name, r.x + 36, r.y + 44);
  ctx.font = '15px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.75)';
  ctx.fillText(`${c.location || 'Test course'}   ·   ${c.structure.type === 'loop' ? `${c.structure.laps} × ${c.structure.loopMiles} mi` : `${c.distanceMiles} mi`}   ·   start ${c.startTime}   ·   ${c.timeLimitHours} h limit`, r.x + 36, r.y + 78);
  ctx.fillStyle = '#eaf3e4'; ctx.font = '16px ' + UI_FONT;
  (c.introFacts || []).forEach((f, i) => ctx.fillText('· ' + f, r.x + 36, r.y + 122 + i * 30));
  ctx.fillStyle = rules.pacersAllowed ? 'rgba(234,243,228,0.85)' : '#f2a07a'; ctx.font = '600 15px ' + UI_FONT;
  ctx.fillText(rules.pacersAllowed ? `Pacers allowed from mile ${rules.pacerFromMile}${rules.crewAllowed ? ' · crew allowed' : ''}` : 'No crew, no pacer', r.x + 36, r.y + 228);
  ctx.fillStyle = 'rgba(234,243,228,0.6)'; ctx.font = '14px ' + UI_FONT;
  ctx.fillText(`Mode: ${DIFFICULTY[GAME.diff].label} (T to change)`, r.x + 36, r.y + 256);
  button(ctx, r.x + r.w - 176, r.y + r.h - 70, 140, 44, 'Go  (Space)', 'go', true);
}
export function drawAidCard(ctx) {
  const a = GAME.aid, occ = a.occ, r = card(ctx, 560, 190, 860);
  ctx.fillStyle = '#eaf3e4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 26px ' + UI_FONT; ctx.fillText(occ.station.name, r.x + 30, r.y + 38);
  ctx.font = '15px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.8)';
  ctx.fillText(`Mile ${occ.absMile.toFixed(1)}   ·   race ${fmtClock(GAME.raceSec)}`, r.x + 30, r.y + 70);
  if (occ.cutoffH != null) {
    const margin = occ.cutoffH * 3600 - GAME.raceSec;
    ctx.fillStyle = margin < 300 ? '#f28a7a' : margin < 900 ? '#f2d27a' : '#c9f27a';
    ctx.fillText(`Cutoff ${fmtClock(occ.cutoffH * 3600)}   ·   ${fmtClock(Math.abs(margin))} ${margin >= 0 ? 'to spare' : 'late'}`, r.x + 30, r.y + 96);
  }
  if (a.item) { ctx.fillStyle = '#D8E24A'; ctx.font = '600 14px ' + UI_FONT; ctx.fillText('Drop bag: ' + ITEM_LABEL[a.item], r.x + 30, r.y + 124); }
  if (!a.done) {
    ctx.fillStyle = 'rgba(234,243,228,0.18)'; ctx.fillRect(r.x + 30, r.y + 152, r.w - 60, 8);
    ctx.fillStyle = '#7FD1FF'; ctx.fillRect(r.x + 30, r.y + 152, (r.w - 60) * clamp(a.t / a.dur, 0, 1), 8);
    ctx.fillStyle = 'rgba(234,243,228,0.6)'; ctx.font = '13px ' + UI_FONT; ctx.textAlign = 'right';
    ctx.fillText('Space: leave early (partial refill)', r.x + r.w - 30, r.y + 172);
  }
}
export function drawDNFCard(ctx) {
  const d = GAME.dnf, r = card(ctx, 620, 300, 860);          // right of Jon on his rock
  ctx.fillStyle = '#f28a7a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 34px ' + UI_FONT; ctx.fillText('DNF', r.x + 36, r.y + 46);
  ctx.fillStyle = '#eaf3e4'; ctx.font = '700 22px ' + UI_FONT; ctx.fillText(d.occ.station.name, r.x + 36, r.y + 92);
  ctx.font = '16px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.85)';
  ctx.fillText(`Mile ${d.occ.absMile.toFixed(1)}`, r.x + 36, r.y + 126);
  ctx.fillText(d.reason === 'cutoff' ? `Missed the cutoff (${fmtClock(d.occ.cutoffH * 3600)})` : 'Pulled by medical: bonked and cramping', r.x + 36, r.y + 154);
  ctx.fillText(`Time on feet: ${fmtClock(d.raceSec)}`, r.x + 36, r.y + 182);
  button(ctx, r.x + 36, r.y + r.h - 70, 160, 44, 'Restart  (Enter)', 'restart', true);
  button(ctx, r.x + 216, r.y + r.h - 70, 160, 44, 'Race select', 'select', false);
}
export function drawFinishCard(ctx) {
  const f = GAME.finish, c = GAME.course, r = card(ctx, 640, 340, 860), h = f.raceSec / 3600;
  ctx.fillStyle = '#D8E24A'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 34px ' + UI_FONT; ctx.fillText('Finisher', r.x + 36, r.y + 46);
  ctx.fillStyle = '#eaf3e4'; ctx.font = '700 26px ' + UI_FONT; ctx.fillText(`${fmtClock(f.raceSec)}   ·   ${buckleFor(c, h)} buckle`, r.x + 36, r.y + 92);
  ctx.font = '16px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.85)';
  ctx.fillText(`Hits taken: ${GAME.stats.hits}     Bonks: ${GAME.stats.bonks}     Night miles: ${GAME.stats.nightMiles.toFixed(1)}`, r.x + 36, r.y + 134);
  ctx.fillText(`${DIFFICULTY[GAME.diff].label} mode`, r.x + 36, r.y + 162);
  ctx.fillStyle = '#eaf3e4'; ctx.font = '600 17px ' + UI_FONT; ctx.fillText('Katie and Emma were at the line.', r.x + 36, r.y + 206);
  button(ctx, r.x + 36, r.y + r.h - 70, 160, 44, 'Restart  (Enter)', 'restart', true);
  button(ctx, r.x + 216, r.y + r.h - 70, 160, 44, 'Race select', 'select', false);
  button(ctx, r.x + 396, r.y + r.h - 70, 200, 44, 'Share as text', 'share', false);
}
export function drawToasts(ctx) {
  ctx.font = '600 15px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  GAME.toasts.forEach((tt, i) => { ctx.fillStyle = `rgba(234,243,228,${clamp(1.6 - tt.age, 0, 1)})`; ctx.fillText(tt.text, ENGINE.W / 2, 110 + i * 22); });
}

export function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function fmtLocal(hour) {
  const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function drawMeter(ctx, x, y, w, label, value, color) {
  ctx.fillStyle = 'rgba(234,243,228,0.8)'; ctx.font = '12px ' + UI_FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.fillStyle = 'rgba(234,243,228,0.18)'; ctx.fillRect(x + 62, y - 5, w, 10);
  ctx.fillStyle = value > 25 ? color : `rgba(242,138,122,${0.6 + 0.4 * Math.abs(Math.sin(GAME.t * 6))})`;
  ctx.fillRect(x + 62, y - 5, w * value / 100, 10);
}
// HUD per Design Bible §10 screen 4: mile, race clock, next aid + cutoff (step 4), energy, hydration, elevation strip.
export function drawHUD(ctx) {
  const D = DIFFICULTY[GAME.diff], c = GAME.course;
  ctx.fillStyle = 'rgba(16, 32, 26, 0.6)'; ctx.fillRect(0, 0, ENGINE.W, 74);
  ctx.fillStyle = '#eaf3e4'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = '600 17px ' + UI_FONT; ctx.fillText("Jon's Ultra  v0.5", 18, 20);

  // Row 1: position, clock, mode
  ctx.font = '15px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.92)';
  const gradePct = Math.round(GAME.grade * 100);
  ctx.fillText(`Lap ${GAME.lap} of ${c.structure.laps}   Mile ${GAME.mile.toFixed(2)}   ${Math.round(GAME.elev).toLocaleString()} ft   ${gradePct > 0 ? '+' : ''}${gradePct}%   ${SURFACES[GAME.surface].label}`, 180, 20);
  ctx.font = '600 15px ' + UI_FONT;
  ctx.fillText(`Race ${fmtClock(GAME.raceSec)}`, 620, 20);
  ctx.font = '15px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.8)';
  ctx.fillText(`${fmtLocal(GAME.hour)} local`, 745, 20);
  drawElevationStrip(ctx, ENGINE.W - 420, 6, 300, 28);
  ctx.textAlign = 'right'; ctx.font = '600 16px ' + UI_FONT;
  ctx.fillStyle = GAME.fps.value >= 55 ? '#c9f27a' : GAME.fps.value >= 30 ? '#f2d27a' : '#f28a7a';
  ctx.fillText(GAME.fps.value + ' fps', ENGINE.W - 18, 20);

  // Row 2: meters, next aid (empty until step 4), mode flags
  drawMeter(ctx, 18, 56, 150, 'Energy', GAME.energy, '#D8E24A');
  drawMeter(ctx, 260, 56, 150, 'Hydration', GAME.hydration, '#7FD1FF');
  ctx.font = '13px ' + UI_FONT; ctx.textAlign = 'left';
  const nx = nextStation();
  if (nx) {
    ctx.fillStyle = 'rgba(234,243,228,0.85)';
    ctx.fillText(`${nx.isFinish ? 'Finish' : 'Next aid'}: ${nx.station.name.split(' (')[0]} in ${Math.max(0, nx.absMile - GAME.mile).toFixed(1)} mi`, 500, 56);
    if (nx.cutoffH != null) {
      const margin = nx.cutoffH * 3600 - GAME.raceSec;
      ctx.fillStyle = margin < 300 ? '#f28a7a' : margin < 900 ? '#f2d27a' : 'rgba(234,243,228,0.85)';
      ctx.fillText(`Cutoff ${fmtClock(nx.cutoffH * 3600)}  (${margin >= 0 ? '' : '−'}${fmtClock(Math.abs(margin))})`, 760, 56);
    }
  }
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(234,243,228,0.9)'; ctx.font = '600 13px ' + UI_FONT;
  const flags = [D.label, GAME.course.moon === 'full' ? 'Full moon' : '', GAME.rain > 0.2 ? 'Squall' : '', AudioBed.muted ? 'Muted' : '', GAME.fast ? 'FAST ×4' : '', GAME.bonk ? 'BONK' : '', GAME.cramp ? 'CRAMP' : ''].filter(Boolean).join('   ');
  ctx.fillText(flags, ENGINE.W - 18, 56);

  ctx.textAlign = 'center'; ctx.font = '14px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.8)';
  ctx.fillText('Space / Up: jump (hold)     Down / S: duck     Esc / P: pause     M: mute     T: difficulty     J: viewer     [ ]: Jon size', ENGINE.W / 2, ENGINE.H - 40);
  ctx.fillStyle = 'rgba(234,243,228,0.55)';
  ctx.fillText('Test keys:  F fast ×4     , . skip ±1 mi     G to finish     K miss next cutoff     N +1 h (Shift+N +6 h)     Shift+M moon     X shooting star     E / H empty meters     R refill     D debug', ENGINE.W / 2, ENGINE.H - 18);

  if (GAME.debug) {
    const j = GAME.jon;
    ctx.textAlign = 'left'; ctx.font = '13px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.75)';
    ctx.fillText(`state ${j.state}   gait ${j.gait}   speed ${GAME.speed.toFixed(0)} px/s (anim ${GAME.animSpeed.toFixed(0)})   jump ×${GAME.jumpMul.toFixed(2)}   night ${GAME.night.toFixed(2)}   clock ×${D.timeScale}   camY ${GAME.camY.toFixed(0)}   Jon ${JON.TARGET_PX} px`, 18, 90);
  }
}
// Elevation strip: the loop profile with Jon's position. Design Bible §10 HUD item.
function drawElevationStrip(ctx, x, y, w, h) {
  const c = GAME.course, L = c.structure.loopMiles, lo = c.altitudeFeet.min, hi = c.altitudeFeet.max;
  ctx.fillStyle = 'rgba(234,243,228,0.18)';
  ctx.beginPath(); ctx.moveTo(x, y + h);
  for (let i = 0; i <= 60; i++) {
    const m = L * i / 60, f = courseElev(c, m);
    ctx.lineTo(x + w * i / 60, y + h - (f - lo) / (hi - lo) * (h - 4) - 2);
  }
  ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  const m = courseLoopMile(c, GAME.mile), px = x + w * m / L, py = y + h - (GAME.elev - lo) / (hi - lo) * (h - 4) - 2;
  ctx.fillStyle = '#F5D021'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(234,243,228,0.7)'; ctx.font = '11px ' + UI_FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('0', x - 8, y + h - 2); ctx.fillText(L + ' mi', x + w + 4, y + h - 2);
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(10, 22, 18, 0.62)'; ctx.fillRect(0, 0, ENGINE.W, ENGINE.H);
  ctx.fillStyle = '#eaf3e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 44px ' + UI_FONT; ctx.fillText('Paused', ENGINE.W / 2, ENGINE.H / 2 - 18);
  ctx.font = '18px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.8)';
  ctx.fillText('Esc, P or tap to resume', ENGINE.W / 2, ENGINE.H / 2 + 24);
}
