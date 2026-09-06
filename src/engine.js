// ===== MODULE: engine =====
// Loop, timing, input, camera, scene stack — and the three allowed globals (Architecture §3):
// GAME (state), RACES (registry), BIOMES (kit registry). Everything else crosses files as ES imports.
import { render, particlesStep, finishTrailMile } from './render.js';
import { JON, jonStep, viewerStep, viewerToggle, titleIdle } from './jon.js';
import { SIM, simStep } from './sim.js';
import { aidStep, resetRace } from './race.js';
import { hazardsStep } from './hazards.js';
import { atmoStep, atmoRng } from './atmosphere.js';
import { AudioBed } from './audio.js';
import { Settings, Progress } from './store.js';
import { UI, uiClick, uiAction, toast } from './ui.js';
import { registerBiomes } from './biomes/index.js';

export const ENGINE = {
  W: 1280, H: 720,
  STEP: 1 / 60,
  MAX_FRAME: 0.25,
  COYOTE_MS: 80,
  BUFFER_MS: 100,
  TEST_SCROLL_SPEED: 300    // px/s flat test ground; sim owns this from step 2
};

export const GAME = {
  t: 0,
  paused: false,
  scroll: 0,
  speed: ENGINE.TEST_SCROLL_SPEED,
  camY: 0,                  // vertical camera offset: looks down the hill on descents
  fast: false,              // F: 4× scroll for testing
  course: null, mile: 0, lap: 1, elev: 0, grade: 0, surface: 'clay', jumpMul: 1, animSpeed: 0,
  diff: 'realistic',
  raceSec: 0, hour: 6, night: 0,
  energy: 100, hydration: 100, bonk: false, cramp: false, crampTimer: 4,
  collected: new Set(), floaters: [], toasts: [],
  shake: 0,
  screen: 'title',          // title | select | intro | race | dnf | finish
  stations: [], nextIdx: 0, aid: null, dnf: null, finish: null, pacer: null, bonusItem: null, forceCutoffMiss: false,
  stats: { hits: 0, bonks: 0, nightMiles: 0 },
  rain: 0, mistAmount: 0, life: [], shooting: null,
  spawn: null, critters: [], obIdx: 0, anIdx: 0, segHits: 0, slowT: 0, slowK: 1, attempt: 0, paceMul: 1,
  loops: 1, mileRate: 1, lastKatieAt: null,
  reducedMotion: false, hazardMarks: true,
  marchers: { nightIdx: 0, bg: false, onTrailMile: null, crossing: null, crossingDone: false, dark: 0, wasNight: false },
  jon: null,
  particles: [],
  fps: { frames: 0, since: 0, value: 0 },
  debug: true,
  alpha: 0,                 // render interpolation fraction between physics steps
  viewer: { on: false, idx: 0, timer: 0, jon: null }
};
export const RACES = {};
export const BIOMES = {};
// Console access for debugging and test scripts — the same three names phase 1 exposed.
window.GAME = GAME; window.RACES = RACES; window.BIOMES = BIOMES;

export function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}
export function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = (n * 0x27d4eb2d) | 0;
  n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
// Function declarations (not const arrows) so circular imports can call them during module evaluation.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function lerpTo(cur, target, dt, rate) { return cur + (target - cur) * (1 - Math.exp(-dt * rate)); }
// Segment from a point: angle from straight down, positive = forward (+x). Negative length = up.
export function seg(p, len, ang) { return { x: p.x + Math.sin(ang) * len, y: p.y + Math.cos(ang) * len }; }

export const Input = {
  jumpHeld: false, duckHeld: false, jumpPressedAt: -1,
  pauseRequested: false, viewerRequested: false, scaleDelta: 0, skipMiles: 0, uiKey: null,
  touchJumpId: null, touchDuckId: null,

  init(canvas) {
    const jumpKeys = new Set(['Space', 'ArrowUp', 'KeyW']);
    const duckKeys = new Set(['ArrowDown', 'KeyS']);
    const pauseKeys = new Set(['Escape', 'KeyP']);
    window.addEventListener('keydown', e => {
      AudioBed.init();
      if (jumpKeys.has(e.code)) {
        if (!this.jumpHeld) this.jumpPressedAt = performance.now();
        this.jumpHeld = true; e.preventDefault();
      } else if (duckKeys.has(e.code)) { this.duckHeld = true; e.preventDefault(); }
      else if (pauseKeys.has(e.code)) { if (!e.repeat) { if (GAME.screen === 'race') this.pauseRequested = true; else this.uiKey = 'select'; } e.preventDefault(); }
      else if (e.code === 'Enter' && !e.repeat) this.uiKey = 'primary';
      else if (e.code === 'KeyG' && !e.repeat) this.uiKey = 'gotoFinish';
      else if (e.code === 'KeyK' && !e.repeat) { GAME.forceCutoffMiss = true; toast('Next station: forced cutoff miss'); }
      else if (e.code === 'KeyJ' && !e.repeat) this.viewerRequested = true;
      else if (e.code === 'KeyD' && !e.repeat) GAME.debug = !GAME.debug;
      else if (e.code === 'BracketLeft') this.scaleDelta -= 10;
      else if (e.code === 'BracketRight') this.scaleDelta += 10;
      else if (e.code === 'KeyF' && !e.repeat) GAME.fast = !GAME.fast;
      else if (e.code === 'Comma') this.skipMiles -= 1;
      else if (e.code === 'Period') this.skipMiles += 1;
      else if (e.code === 'KeyT' && !e.repeat) { GAME.diff = GAME.diff === 'realistic' ? 'arcade' : 'realistic'; Settings.save({ lastDifficulty: GAME.diff }); }
      else if (e.code === 'KeyN') GAME.raceSec += e.shiftKey ? 6 * 3600 : 3600;
      else if (e.code === 'KeyM' && !e.repeat) { if (e.shiftKey) GAME.course.moon = GAME.course.moon === 'full' ? 'none' : 'full'; else AudioBed.setMuted(!AudioBed.muted); }
      else if (e.code === 'KeyX' && !e.repeat) { if (GAME.night > 0.6 && !GAME.shooting) GAME.shooting = { x: 300 + atmoRng() * 600, y: 50 + atmoRng() * 150, vx: -650, vy: 220, age: 0 }; else toast('Shooting stars need full night'); }
      else if (e.code === 'KeyE' && !e.repeat) GAME.energy = 0;
      else if (e.code === 'KeyH' && !e.repeat) GAME.hydration = 0;
      else if (e.code === 'KeyR' && !e.repeat) { GAME.energy = 100; GAME.hydration = 100; }
    });
    window.addEventListener('keyup', e => {
      if (jumpKeys.has(e.code)) this.jumpHeld = false;
      else if (duckKeys.has(e.code)) this.duckHeld = false;
    });
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault(); AudioBed.init();
      if (GAME.paused) { this.pauseRequested = true; return; }
      {
        const rect = canvas.getBoundingClientRect();
        const lx = (e.clientX - rect.left) / Screen.scale, ly = (e.clientY - rect.top) / Screen.scale;
        if (UI.buttons.length && uiClick(lx, ly)) return;
        if (GAME.screen !== 'race') return;
      }
      const rect = canvas.getBoundingClientRect();
      const upper = (e.clientY - rect.top) < rect.height / 2;
      if (upper) {
        if (this.touchJumpId === null) { this.jumpPressedAt = performance.now(); this.jumpHeld = true; }
        this.touchJumpId = e.pointerId;
      } else { this.duckHeld = true; this.touchDuckId = e.pointerId; }
    });
    const release = e => {
      if (e.pointerId === this.touchJumpId) { this.touchJumpId = null; this.jumpHeld = false; }
      if (e.pointerId === this.touchDuckId) { this.touchDuckId = null; this.duckHeld = false; }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', release);
    window.addEventListener('blur', () => { if (!GAME.paused && !GAME.viewer.on) GAME.paused = true; });
  },
  jumpBuffered(now) { return this.jumpPressedAt >= 0 && (now - this.jumpPressedAt) <= ENGINE.BUFFER_MS; },
  consumeJump() { this.jumpPressedAt = -1; }
};

export const Screen = {
  canvas: null, ctx: null, scale: 1, dpr: 1,
  init(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.resize(); window.addEventListener('resize', () => this.resize());
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = Math.min(window.innerWidth / ENGINE.W, window.innerHeight / ENGINE.H);
    const cssW = Math.floor(ENGINE.W * this.scale), cssH = Math.floor(ENGINE.H * this.scale);
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.floor(cssW * this.dpr); this.canvas.height = Math.floor(cssH * this.dpr);
  },
  begin() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);
    return ctx;
  }
};

// Test-key teleport: move Jon and skip any stations passed without stopping at them.
export function skipTo(mile) {
  GAME.scroll = Math.max(0, mile) * SIM.PX_PER_MILE; GAME.mile = GAME.scroll / SIM.PX_PER_MILE;
  while (GAME.nextIdx < GAME.stations.length && GAME.stations[GAME.nextIdx].absMile <= GAME.mile) GAME.nextIdx++;
}
function step(dt) {
  if (GAME.viewer.on) { viewerStep(dt); return; }
  if (GAME.screen === 'intro') return;
  GAME.t += dt;
  if (GAME.screen === 'race') { simStep(dt); aidStep(dt); if (GAME.screen === 'race') hazardsStep(dt); }
  else if (GAME.screen === 'title' || GAME.screen === 'select') { GAME.speed = 0; GAME.animSpeed = 0; titleIdle(dt, GAME.screen === 'title'); }
  else { GAME.speed = lerpTo(GAME.speed, 0, dt, 6); GAME.animSpeed = 0; if (GAME.finish) GAME.finish.t += dt; GAME.shake = Math.max(0, GAME.shake - 18 * dt); }
  for (let k = GAME.toasts.length - 1; k >= 0; k--) { GAME.toasts[k].age += dt; if (GAME.toasts[k].age > 1.8) GAME.toasts.splice(k, 1); }
  jonStep(GAME.jon, dt);
  particlesStep(dt);
  atmoStep(dt, performance.now() / 1000);
  AudioBed.update(dt);
}

let lastFrame = 0, accum = 0;
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, ENGINE.MAX_FRAME);
  lastFrame = now;

  if (Input.pauseRequested) { Input.pauseRequested = false; GAME.paused = !GAME.paused; accum = 0; }
  if (Input.viewerRequested) { Input.viewerRequested = false; viewerToggle(); accum = 0; }
  if (Input.scaleDelta) {
    JON.TARGET_PX = clamp(JON.TARGET_PX + Input.scaleDelta, 80, 180);
    Input.scaleDelta = 0;
  }
  if (Input.skipMiles) { skipTo(GAME.mile + Input.skipMiles); Input.skipMiles = 0; }
  if (Input.uiKey) {
    const k = Input.uiKey; Input.uiKey = null;
    if (k === 'gotoFinish') { if (GAME.screen === 'race') skipTo(finishTrailMile() - 0.3); }
    else if (k === 'primary') {
      if (GAME.screen === 'title') uiAction('start');
      else if (GAME.screen === 'select') uiAction('race:' + GAME.course.id);
      else if (GAME.screen === 'intro') uiAction('go');
      else if (GAME.screen === 'dnf' || GAME.screen === 'finish') uiAction('restart');
    }
    else if (k === 'select') {
      if (GAME.screen === 'select') uiAction('title');
      else if (GAME.screen === 'intro' || GAME.screen === 'dnf' || GAME.screen === 'finish') uiAction('select');
    }
  }
  if (GAME.screen === 'intro' && Input.jumpBuffered(now)) { Input.consumeJump(); uiAction('go'); }
  if (GAME.screen === 'title' && Input.jumpBuffered(now)) { Input.consumeJump(); uiAction('start'); }

  if (!GAME.paused) {
    accum += dt;
    while (accum >= ENGINE.STEP) { step(ENGINE.STEP); accum -= ENGINE.STEP; }
  }
  GAME.alpha = accum / ENGINE.STEP;

  GAME.fps.frames++;
  if (now - GAME.fps.since >= 500) {
    GAME.fps.value = Math.round(GAME.fps.frames * 1000 / (now - GAME.fps.since));
    GAME.fps.frames = 0; GAME.fps.since = now;
  }

  render(Screen.begin(), now / 1000);
  requestAnimationFrame(frame);
}

// ===== boot =====
async function boot() {
  const canvas = document.getElementById('game');
  Screen.init(canvas); Input.init(canvas);
  registerBiomes();
  for (const id of ['hurt100', 'test20']) {
    const course = await (await fetch(`./races/${id}.json`)).json();
    RACES[course.id] = course;
  }
  await Settings.load(); await Progress.load();
  if (Settings.data.mute) AudioBed.muted = true;
  if (Settings.data.lastDifficulty === 'arcade' || Settings.data.lastDifficulty === 'realistic') GAME.diff = Settings.data.lastDifficulty;
  GAME.reducedMotion = !!Settings.data.reducedMotion;
  GAME.hazardMarks = Settings.data.hazardMarks !== false;
  // ?race=<id> jumps straight to that race's intro (dev + regression); otherwise the title screen,
  // with the last-run race idling in the world behind it.
  const raceId = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('race') : null;
  GAME.course = RACES[raceId] || RACES[Settings.data.lastRace] || RACES.hurt100;
  resetRace();
  GAME.screen = raceId ? 'intro' : 'title';
  lastFrame = performance.now(); GAME.fps.since = lastFrame;
  requestAnimationFrame(frame);
}
boot();
