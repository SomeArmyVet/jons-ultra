// ===== MODULE: ui =====
// Title, race select, cards, HUD, buttons, toasts (Design Bible §10 screens 1–7).
import { ENGINE, GAME, RACES, BIOMES, clamp } from './engine.js';
import { DIFFICULTY, SURFACES, courseElev, courseLoopMile } from './sim.js';
import { RACE, nextStation, ITEM_LABEL, buckleFor, finishSummaryText, resetRace } from './race.js';
import { JON } from './jon.js';
import { AudioBed } from './audio.js';
import { Settings, Progress } from './store.js';

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
  else if (id === 'start') { if (GAME.jon) GAME.jon.forcedState = null; GAME.screen = 'select'; }
  else if (id === 'title') GAME.screen = 'title';
  else if (id === 'select') GAME.screen = 'select';
  else if (id === 'toggleDiff') { GAME.diff = GAME.diff === 'realistic' ? 'arcade' : 'realistic'; Settings.save({ lastDifficulty: GAME.diff }); }
  else if (id.startsWith('race:')) {
    const rc = RACES[id.slice(5)];
    if (rc) { GAME.course = rc; Settings.save({ lastRace: rc.id, lastDifficulty: GAME.diff }); resetRace(); GAME.screen = 'intro'; }
  }
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
// --- title screen (Design Bible §10.1): logo, difficulty toggle, start. The live world idles behind. ---
export function drawTitle(ctx) {
  ctx.fillStyle = 'rgba(10,22,18,0.38)'; ctx.fillRect(0, 0, ENGINE.W, ENGINE.H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(16,32,26,0.55)'; ctx.font = '800 86px ' + UI_FONT;
  ctx.fillText("Jon's Ultra", ENGINE.W / 2 + 3, 183);                          // soft drop shadow
  ctx.fillStyle = '#D8E24A';
  ctx.fillText("Jon's Ultra", ENGINE.W / 2, 180);
  ctx.fillStyle = 'rgba(234,243,228,0.85)'; ctx.font = '18px ' + UI_FONT;
  ctx.fillText('Real ultras. Real cutoffs. One runner.', ENGINE.W / 2, 244);
  button(ctx, ENGINE.W / 2 - 110, 320, 220, 54, 'Start  (Space)', 'start', true);
  button(ctx, ENGINE.W / 2 - 150, 396, 300, 44, `Mode: ${DIFFICULTY[GAME.diff].label}  (T)`, 'toggleDiff', false);
  ctx.fillStyle = 'rgba(234,243,228,0.55)'; ctx.font = '13px ' + UI_FONT;
  ctx.fillText('M: mute     J: character viewer', ENGINE.W / 2, 470);
  ctx.textAlign = 'right'; ctx.fillText('v0.8', ENGINE.W - 16, ENGINE.H - 16);
}

// --- race select (Design Bible §10.2): registry-driven cards — name, location, distance, gain, biome
// thumbnail, earned buckle. All races unlocked from day one; dev courses hidden unless ?dev. ---
function selectableRaces() {
  const dev = typeof location !== 'undefined' && location.search.includes('dev');
  return Object.values(RACES).filter(r => dev || !r.dev);
}
function drawBiomeThumb(ctx, x, y, w, h, kit) {
  const pal = (kit && kit.palette.day) || { skyTop: '#8fb5b8', skyBottom: '#dfe9dc', far: '#5d8d78', mid: '#3f7458', dirt: '#3f2f20', sun: '#fff6d6' };
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, pal.skyTop); g.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pal.sun; ctx.beginPath(); ctx.arc(x + w * 0.78, y + h * 0.28, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.far; ctx.beginPath(); ctx.moveTo(x, y + h);
  for (let i = 0; i <= w; i += 5) ctx.lineTo(x + i, y + h * 0.62 - Math.abs(Math.sin(i / 21)) * h * 0.26 - Math.sin(i / 57) * h * 0.08);
  ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.mid; ctx.beginPath(); ctx.moveTo(x, y + h);
  for (let i = 0; i <= w; i += 5) ctx.lineTo(x + i, y + h * 0.82 - Math.abs(Math.sin(i / 34 + 2)) * h * 0.18);
  ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.dirt; ctx.fillRect(x, y + h * 0.9, w, h * 0.1);
  ctx.restore();
}
const BUCKLE_COL = { Gold: '#F5D021', Silver: '#c9ced6', Bronze: '#c98a4a', Finisher: '#9fb2a5' };
export function drawSelect(ctx) {
  ctx.fillStyle = 'rgba(10,22,18,0.55)'; ctx.fillRect(0, 0, ENGINE.W, ENGINE.H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eaf3e4'; ctx.font = '700 34px ' + UI_FONT;
  ctx.fillText('Race select', 60, 70);
  ctx.fillStyle = 'rgba(234,243,228,0.65)'; ctx.font = '14px ' + UI_FONT;
  ctx.fillText(`Mode: ${DIFFICULTY[GAME.diff].label} — times and buckles are per mode`, 60, 104);
  const races = selectableRaces();
  const CW = 320, CH = 350, GAP = 40;
  const x0 = (ENGINE.W - races.length * CW - (races.length - 1) * GAP) / 2;
  races.forEach((rc, i) => {
    const x = x0 + i * (CW + GAP), y = 150;
    ctx.fillStyle = rc.id === GAME.course.id ? 'rgba(216,226,74,0.12)' : 'rgba(10,22,18,0.85)';
    ctx.beginPath(); ctx.roundRect(x, y, CW, CH, 14); ctx.fill();
    ctx.strokeStyle = rc.id === GAME.course.id ? 'rgba(216,226,74,0.6)' : 'rgba(234,243,228,0.25)';
    ctx.lineWidth = 1.5; ctx.stroke();
    drawBiomeThumb(ctx, x + 16, y + 16, CW - 32, 116, BIOMES[rc.biome]);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#eaf3e4'; ctx.font = '700 22px ' + UI_FONT; ctx.fillText(rc.name, x + 20, y + 158);
    ctx.fillStyle = 'rgba(234,243,228,0.75)'; ctx.font = '13px ' + UI_FONT;
    ctx.fillText(rc.location || '', x + 20, y + 184);
    ctx.fillText(`${rc.distanceMiles} mi${rc.gainFeet ? '  ·  ' + rc.gainFeet.toLocaleString() + ' ft' : ''}${rc.month ? '  ·  ' + rc.month : ''}`, x + 20, y + 206);
    if (rc.loops && rc.loops !== rc.structure.laps)
      ctx.fillText(`${rc.structure.laps} × ${rc.structure.loopMiles} mi real  ·  ${rc.loops} loops in game`, x + 20, y + 226);
    const p = (Progress.data[rc.id] || {})[GAME.diff];
    if (p && (p.finishes || p.dnfs)) {
      if (p.buckle) {
        ctx.fillStyle = BUCKLE_COL[p.buckle] || '#eaf3e4';
        ctx.beginPath(); ctx.roundRect(x + 20, y + 246, 12, 12, 3); ctx.fill();
        ctx.font = '600 14px ' + UI_FONT;
        ctx.fillText(`${p.buckle} buckle  ·  best ${fmtClock(p.bestHours * 3600)}`, x + 40, y + 252);
      } else {
        ctx.fillStyle = 'rgba(234,243,228,0.75)'; ctx.font = '600 14px ' + UI_FONT;
        ctx.fillText(`Furthest: mile ${p.furthestMile}`, x + 20, y + 252);
      }
      ctx.fillStyle = 'rgba(234,243,228,0.6)'; ctx.font = '13px ' + UI_FONT;
      ctx.fillText(`${p.finishes} finish${p.finishes === 1 ? '' : 'es'}  ·  ${p.dnfs} DNF${p.dnfs === 1 ? '' : 's'}`, x + 20, y + 274);
    } else {
      ctx.fillStyle = 'rgba(234,243,228,0.5)'; ctx.font = '600 14px ' + UI_FONT;
      ctx.fillText('Unraced', x + 20, y + 252);
    }
    button(ctx, x + 20, y + CH - 56, CW - 40, 40, 'Run it', 'race:' + rc.id, rc.id === GAME.course.id);
  });
  button(ctx, 60, ENGINE.H - 80, 130, 44, 'Back  (Esc)', 'title', false);
  button(ctx, ENGINE.W - 320, ENGINE.H - 80, 260, 44, `Mode: ${DIFFICULTY[GAME.diff].label}  (T)`, 'toggleDiff', false);
}

export function drawIntroCard(ctx) {
  const c = GAME.course, r = card(ctx, 640, 360), rules = c.rules || {};
  ctx.fillStyle = '#eaf3e4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 30px ' + UI_FONT; ctx.fillText(c.name, r.x + 36, r.y + 44);
  ctx.font = '15px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.75)';
  ctx.fillText(`${c.location || 'Test course'}   ·   ${c.structure.type === 'loop' ? `${c.structure.laps} × ${c.structure.loopMiles} mi` : `${c.distanceMiles} mi`}   ·   start ${c.startTime}   ·   ${c.timeLimitHours} h limit`, r.x + 36, r.y + 78);
  if (c.loops && c.loops !== c.structure.laps) {
    ctx.fillStyle = 'rgba(234,243,228,0.65)'; ctx.font = '14px ' + UI_FONT;
    ctx.fillText(`Real race: ${c.structure.laps} laps of a ${c.structure.loopMiles}-mile loop. Game: ${c.loops} loops.`, r.x + 36, r.y + 100);
  }
  ctx.fillStyle = '#eaf3e4'; ctx.font = '16px ' + UI_FONT;
  (c.introFacts || []).forEach((f, i) => ctx.fillText('· ' + f, r.x + 36, r.y + 126 + i * 28));
  ctx.fillStyle = rules.pacersAllowed ? 'rgba(234,243,228,0.85)' : '#f2a07a'; ctx.font = '600 15px ' + UI_FONT;
  ctx.fillText(rules.pacersAllowed ? `Pacers allowed from mile ${rules.pacerFromMile}${rules.crewAllowed ? ' · crew allowed' : ''}` : 'No crew, no pacer', r.x + 36, r.y + 228);
  ctx.fillStyle = 'rgba(234,243,228,0.6)'; ctx.font = '14px ' + UI_FONT;
  ctx.fillText(`Mode: ${DIFFICULTY[GAME.diff].label} (T to change)`, r.x + 36, r.y + 256);
  button(ctx, r.x + r.w - 176, r.y + r.h - 70, 140, 44, 'Go  (Space)', 'go', true);
  button(ctx, r.x + 36, r.y + r.h - 70, 130, 44, 'Back  (Esc)', 'select', false);
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
  if (occ.station.crew === false) { ctx.fillStyle = '#f2a07a'; ctx.font = '600 14px ' + UI_FONT; ctx.fillText('No crew access.', r.x + 30, r.y + (a.item ? 140 : 124)); }
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
// Slides in on the right 45% of the frame after the celebration, leaving Jon and the near-side crowd
// visible (Michael 2026-09-05).
export function drawFinishCard(ctx) {
  const f = GAME.finish, c = GAME.course, h = f.raceSec / 3600;
  const slide = clamp((f.t - RACE.FINISH_HOLD_S) / 0.45, 0, 1), ease = 1 - Math.pow(1 - slide, 3);
  const w = 500, cx = ENGINE.W - w / 2 - 24 + (1 - ease) * (w + 60);
  const r = card(ctx, w, 320, cx);
  ctx.fillStyle = '#D8E24A'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 28px ' + UI_FONT; ctx.fillText('Finisher', r.x + 26, r.y + 40);
  ctx.fillStyle = '#eaf3e4'; ctx.font = '700 22px ' + UI_FONT; ctx.fillText(`${fmtClock(f.raceSec)}   ·   ${buckleFor(c, h)} buckle`, r.x + 26, r.y + 80);
  ctx.font = '14px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.85)';
  ctx.fillText(`Hits taken: ${GAME.stats.hits}     Bonks: ${GAME.stats.bonks}     Night miles: ${GAME.stats.nightMiles.toFixed(1)}`, r.x + 26, r.y + 118);
  ctx.fillText(`${DIFFICULTY[GAME.diff].label} mode`, r.x + 26, r.y + 144);
  ctx.fillStyle = '#eaf3e4'; ctx.font = '600 15px ' + UI_FONT; ctx.fillText('Katie and Emma were at the line.', r.x + 26, r.y + 184);
  button(ctx, r.x + 24, r.y + r.h - 66, 140, 44, 'Restart  (Enter)', 'restart', true);
  button(ctx, r.x + 176, r.y + r.h - 66, 130, 44, 'Race select', 'select', false);
  button(ctx, r.x + 318, r.y + r.h - 66, 158, 44, 'Share as text', 'share', false);
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
  ctx.font = '600 17px ' + UI_FONT; ctx.fillText("Jon's Ultra  v0.8", 18, 20);

  // Row 1: position, clock, mode
  ctx.font = '15px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.92)';
  const gradePct = Math.round(GAME.grade * 100), disp = GAME.mile * GAME.mileRate;
  ctx.fillText(`Loop ${GAME.lap} of ${GAME.loops}   Mile ${disp.toFixed(1)}   ${Math.round(GAME.elev).toLocaleString()} ft   ${gradePct > 0 ? '+' : ''}${gradePct}%   ${SURFACES[GAME.surface].label}`, 180, 20);
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
    ctx.fillText(`${nx.isFinish ? 'Finish' : 'Next aid'}: ${nx.station.name.split(' (')[0]} in ${Math.max(0, nx.absMile - GAME.mile * GAME.mileRate).toFixed(1)} mi`, 500, 56);
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
  ctx.fillText('0', x - 8, y + h - 2); ctx.fillText((GAME.course.distanceMiles / GAME.loops).toFixed(0) + ' mi', x + w + 4, y + h - 2);
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(10, 22, 18, 0.62)'; ctx.fillRect(0, 0, ENGINE.W, ENGINE.H);
  ctx.fillStyle = '#eaf3e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 44px ' + UI_FONT; ctx.fillText('Paused', ENGINE.W / 2, ENGINE.H / 2 - 18);
  ctx.font = '18px ' + UI_FONT; ctx.fillStyle = 'rgba(234,243,228,0.8)';
  ctx.fillText('Esc, P or tap to resume', ENGINE.W / 2, ENGINE.H / 2 + 24);
}
