// ===== MODULE: audio =====
// All synthesised. Two buses (Michael's feel pass 2026-09-05: "too constant"): ambient (beds + footsteps,
// −60%) and events (cowbell, growl, splash, thud, drums — full level, so they stand out). Beds are not
// steady: insects chirp in bursts with 5–20 s silences, wind comes in gusts, rain only during squalls.
// Footsteps −50% and pitch-varied per step. Starts on the first key or tap (browser gesture rule).
import { GAME, rng } from './engine.js';
import { Store } from './store.js';

// Dev-tweakable from the console (window.AUDIO): master = overall, ambient = bed bus relative level.
export const AUDIO = { master: 0.8, ambient: 0.4 };
if (typeof window !== 'undefined') window.AUDIO = AUDIO;

const aRng = rng(0xc41c);

export const AudioBed = {
  ctx: null, master: null, amb: null, rain: null, wind: null, insects: null, insectLfo: null, noise: null,
  muted: false, ready: false,
  insectUntil: 0, insectNext: 0, gustUntil: 0, gustNext: 0, nextDrum: 0,
  init() {
    if (this.ready || typeof window === 'undefined' || !(window.AudioContext || window.webkitAudioContext)) return;
    const AC = window.AudioContext || window.webkitAudioContext, ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : AUDIO.master; this.master.connect(ctx.destination);
    this.amb = ctx.createGain(); this.amb.gain.value = AUDIO.ambient; this.amb.connect(this.master);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), nr = rng(0xa0d10);
    for (let i = 0; i < len; i++) d[i] = nr() * 2 - 1;
    this.noise = buf;
    const bed = (freq, q, gain) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(this.amb); src.start();
      return g;
    };
    this.rain = bed(1800, 0.6, 0);
    this.wind = bed(260, 0.9, 0.015);
    this.insects = bed(5600, 12, 0);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 11; lg.gain.value = 0.5;      // chirp pulse
    lfo.connect(lg); lg.connect(this.insects.gain); lfo.start(); this.insectLfo = lfo;
    this.ready = true;
  },
  update(dt) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, ramp = (p, v) => p.setTargetAtTime(v, t, 0.4);
    this.master.gain.setTargetAtTime(this.muted ? 0 : AUDIO.master, t, 0.1);
    this.amb.gain.setTargetAtTime(AUDIO.ambient, t, 0.1);
    // rain: squalls only (GAME.rain is 0 outside them)
    ramp(this.rain.gain, GAME.rain * 0.45);
    // wind: gusts, not a steady bed
    if (t >= this.gustNext) { this.gustUntil = t + 2 + aRng() * 2.5; this.gustNext = this.gustUntil + 4 + aRng() * 12; }
    ramp(this.wind.gain, (t < this.gustUntil ? 0.10 : 0.015) + 0.05 * GAME.rain);
    // night insects: bursts of chirping with 5–20 s silences (peak matches the earlier −80% level)
    if (t >= this.insectNext) { this.insectUntil = t + 1.5 + aRng() * 3; this.insectNext = this.insectUntil + 5 + aRng() * 15; }
    ramp(this.insects.gain, t < this.insectUntil ? GAME.night * 0.06 * (1 - GAME.rain) : 0);
    // Huakaʻi Pō drums: low, slow, while the procession is on the ridge or crossing. Drums only.
    const M = GAME.marchers;
    if (M && ((M.bg && GAME.night > 0.6) || M.crossing) && t >= this.nextDrum) {
      this.drum(M.crossing ? 0.16 : 0.07);
      this.nextDrum = t + 1.25 + aRng() * 0.15;
    }
  },
  footstep(surface) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.85 + aRng() * 0.3;               // per-step pitch variation
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    const spec = { clay: [900, 0.06, 0.09], roots: [420, 0.08, 0.11], rock: [2400, 0.04, 0.08], mud: [260, 0.12, 0.12] }[surface] || [900, 0.06, 0.09];
    f.type = 'bandpass'; f.frequency.value = spec[0]; f.Q.value = 1.2;
    g.gain.setValueAtTime(spec[2], ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + spec[1]);
    src.connect(f); f.connect(g); g.connect(this.amb); src.start(); src.stop(ctx.currentTime + spec[1] + 0.02);
  },
  // obstacle trip: short low thump (event bus)
  thud() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 200;
    g.gain.setValueAtTime(0.3, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); src.stop(ctx.currentTime + 0.12);
  },
  // stream wade: bright noise splash (event bus)
  splash() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.28, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); src.stop(ctx.currentTime + 0.32);
  },
  // bite = short growl/snap burst (Design Bible §9; event bus)
  growl() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(55, t0 + 0.18);
    g.gain.setValueAtTime(0.22, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 0.22);
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(), g2 = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 1.5;
    g2.gain.setValueAtTime(0.18, t0); g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    src.connect(f); f.connect(g2); g2.connect(this.master); src.start(t0); src.stop(t0 + 0.08);
  },
  // Night Marcher drum: one soft low thump (event bus, quiet)
  drum(level) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(58, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.3);
    g.gain.setValueAtTime(level, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 0.4);
  },
  cowbell() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2;
    g.gain.setValueAtTime(0.5, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    for (const fr of [562, 845]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t0); o.stop(t0 + 0.9); }
    f.connect(g); g.connect(this.master);
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : AUDIO.master, this.ctx.currentTime, 0.05); Store.set('jons-ultra:settings', { mute: m }); }
};
