// ===== MODULE: audio =====
// All synthesised. Ambient bed: rain (bandpassed noise), wind in bamboo (low noise, slow LFO), night insects (high chirps).
// One-shots: footstep per surface, cowbell at aid stations. Starts on the first key or tap (browser gesture rule).
import { GAME, rng } from './engine.js';
import { Store } from './store.js';

export const AudioBed = {
  ctx: null, master: null, rain: null, wind: null, insects: null, insectLfo: null, noise: null, muted: false, ready: false,
  init() {
    if (this.ready || typeof window === 'undefined' || !(window.AudioContext || window.webkitAudioContext)) return;
    const AC = window.AudioContext || window.webkitAudioContext, ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), nr = rng(0xa0d10);
    for (let i = 0; i < len; i++) d[i] = nr() * 2 - 1;
    this.noise = buf;
    const bed = (freq, q, gain) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return g;
    };
    this.rain = bed(1800, 0.6, 0);
    this.wind = bed(260, 0.9, 0.05);
    this.insects = bed(5600, 12, 0);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 11; lg.gain.value = 0.5;      // chirp pulse
    lfo.connect(lg); lg.connect(this.insects.gain); lfo.start(); this.insectLfo = lfo;
    const wlfo = ctx.createOscillator(), wg = ctx.createGain(); wlfo.frequency.value = 0.13; wg.gain.value = 0.03;   // gusts
    wlfo.connect(wg); wg.connect(this.wind.gain); wlfo.start();
    this.ready = true;
  },
  update(dt) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, ramp = (p, v) => p.setTargetAtTime(v, t, 0.4);
    ramp(this.rain.gain, GAME.rain * 0.45);
    ramp(this.wind.gain, 0.05 + 0.04 * Math.abs(Math.sin(GAME.t * 0.4)) + 0.05 * GAME.rain);
    ramp(this.insects.gain, GAME.night * 0.024 * (1 - GAME.rain));   // 0.12 × 0.2 — Michael: night insects toned down 80% (phase-1 carry-over)
  },
  footstep(surface) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    const spec = { clay: [900, 0.06, 0.18], roots: [420, 0.08, 0.22], rock: [2400, 0.04, 0.16], mud: [260, 0.12, 0.24] }[surface] || [900, 0.06, 0.18];
    f.type = 'bandpass'; f.frequency.value = spec[0]; f.Q.value = 1.2;
    g.gain.setValueAtTime(spec[2], ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + spec[1]);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); src.stop(ctx.currentTime + spec[1] + 0.02);
  },
  // obstacle trip: short low thump
  thud() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 200;
    g.gain.setValueAtTime(0.3, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); src.stop(ctx.currentTime + 0.12);
  },
  // stream wade: bright noise splash
  splash() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.28, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); src.stop(ctx.currentTime + 0.32);
  },
  // bite = short growl/snap burst (Design Bible §9)
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
  cowbell() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2;
    g.gain.setValueAtTime(0.5, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    for (const fr of [562, 845]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t0); o.stop(t0 + 0.9); }
    f.connect(g); g.connect(this.master);
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05); Store.set('jons-ultra:settings', { mute: m }); }
};
