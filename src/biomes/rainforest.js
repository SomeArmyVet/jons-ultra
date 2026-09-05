// ===== MODULE: biomes/rainforest =====
// HURT's kit (Race Bible §1 + biome table): Ko'olau fluted ridges, banyan/koa canopy, swaying bamboo band,
// mud/roots/rock/clay trail, fronds in the foreground, squalls and mist. Day/dusk/night/dawn palettes are hex only.
import { hash } from '../engine.js';
import { drawStars, drawMist, skyBodyFrac, skyBodyPos } from '../atmosphere.js';
import { SURFACES } from '../sim.js';

export const rainforest = {
  palette: {
    day:   { skyTop: '#8fb5b8', skyBottom: '#dfe9dc', sun: '#fff6d6', far: '#5d8d78', mid: '#3f7458', canopy: '#2f5f3d', canopyHi: '#4a7f4f', trunk: '#3a2a1a',
             bamboo: '#7a9a4a', bambooDark: '#55733a', grass: '#2f5a35', dirt: '#3f2f20', dirtDark: '#2a1e12', root: '#1c1309', stone: '#6f6d62', fore: '#1f4a2c', mist: '#c9d7d6', rain: '#dfe9ee' },
    dusk:  { skyTop: '#5a4f7a', skyBottom: '#e6956a', sun: '#ffab66', far: '#4a5f66', mid: '#2f4f44', canopy: '#223f2d', canopyHi: '#355a3a', trunk: '#2a1c11',
             bamboo: '#5f7a3a', bambooDark: '#40562a', grass: '#22412a', dirt: '#33251a', dirtDark: '#20160e', root: '#150e06', stone: '#585549', fore: '#17351f', mist: '#b6a9a8', rain: '#d9cfc8' },
    night: { skyTop: '#04070d', skyBottom: '#0a1410', sun: '#d8dde6', far: '#0b1613', mid: '#08130e', canopy: '#06100a', canopyHi: '#0a170e', trunk: '#050806',
             bamboo: '#0f1a0e', bambooDark: '#0a120a', grass: '#07120a', dirt: '#120d08', dirtDark: '#0a0705', root: '#040302', stone: '#1e1e1a', fore: '#040c07', mist: '#182420', rain: '#7f8c90' },
    dawn:  { skyTop: '#7d8fb8', skyBottom: '#f0c7a8', sun: '#ffd4a0', far: '#5c7d84', mid: '#3d6658', canopy: '#2b5439', canopyHi: '#40724a', trunk: '#33241a',
             bamboo: '#6d8c48', bambooDark: '#4b6636', grass: '#2b5232', dirt: '#3a2b1e', dirtDark: '#261b11', root: '#1a1208', stone: '#666459', fore: '#1c4429', mist: '#d8d2d4', rain: '#e6dcd6' }
  },
  // Ambient life sets (Design Bible §8 atmosphere rules). Decoration only.
  life: { day: ['butterfly', 'bird'], night: ['firefly', 'moth', 'bat'] },

  sky(ctx, pal, t, v) {
    const g = ctx.createLinearGradient(0, 0, 0, v.groundY);
    g.addColorStop(0, pal.skyTop); g.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, v.W, v.H);
    drawStars(ctx, t, v);
    // Sun and moon are real clocks: the sun runs rise→set across the arc, the moon set→rise.
    const sun = skyBodyFrac(v.hour, v.sun.rise, v.sun.set);
    if (sun !== null) { const p = skyBodyPos(sun, v); ctx.fillStyle = pal.sun; ctx.beginPath(); ctx.arc(p.x, p.y, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.12)'; ctx.beginPath(); ctx.arc(p.x, p.y, 70, 0, Math.PI * 2); ctx.fill(); }
    const moon = v.moon !== 'none' ? skyBodyFrac(v.hour, v.sun.set, v.sun.rise + 24) : null;
    if (moon !== null) { const p = skyBodyPos(moon, v); v.moonPos = p;
      ctx.fillStyle = '#e8ecf2'; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(232,236,242,0.14)'; ctx.beginPath(); ctx.arc(p.x, p.y, 62, 0, Math.PI * 2); ctx.fill(); }
  },
  // Ko'olau: tall, fluted, near-vertical ridges — abs(sin) gives the knife-edge flutes.
  farRidge(ctx, pal, t, v) {
    const f = 0.05, base = 250 + v.ridgeShift * 0.5;
    ctx.fillStyle = pal.far; ctx.beginPath(); ctx.moveTo(0, v.H);
    for (let x = 0; x <= v.W; x += 6) {
      const wx = x + v.scroll * f;
      const y = base - 90 * Math.sin(wx / 610) - 40 * Math.abs(Math.sin(wx / 95 + 0.4)) - 18 * Math.abs(Math.sin(wx / 31)) - 12 * Math.sin(wx / 210 + 2);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(v.W, v.H); ctx.closePath(); ctx.fill();
    drawMist(ctx, pal, t, v, 0.08, 265, 0.5);
  },
  midRidge(ctx, pal, t, v) {
    const f = 0.16, base = 330 + v.ridgeShift;
    ctx.fillStyle = pal.mid; ctx.beginPath(); ctx.moveTo(0, v.H);
    for (let x = 0; x <= v.W; x += 6) {
      const wx = x + v.scroll * f;
      ctx.lineTo(x, base - 42 * Math.sin(wx / 300 + 1.4) - 20 * Math.abs(Math.sin(wx / 120)) - 8 * Math.sin(wx / 33 + 1));
    }
    ctx.lineTo(v.W, v.H); ctx.closePath(); ctx.fill();
    drawMist(ctx, pal, t, v, 0.14, 350, 1);
  },
  // Banyan and koa canopy: broad multi-lobed crowns, banyan roots hanging to the ground, then the bamboo band.
  nearVegetation(ctx, pal, t, v) {
    const f = 0.45, spacing = 210, wx0 = v.scroll * f;
    const i0 = Math.floor(wx0 / spacing) - 1, i1 = Math.floor((wx0 + v.W) / spacing) + 1;
    for (let i = i0; i <= i1; i++) {
      const h = hash(i * 7919), h2 = hash(i * 104729 + 13), banyan = h2 < 0.45;
      const x = i * spacing + h * 110 - wx0, baseY = v.groundAt(x) - 6;
      const trunkH = 80 + h2 * 60, r = 36 + h * 26;
      ctx.fillStyle = pal.trunk;
      ctx.fillRect(x - (banyan ? 9 : 5), baseY - trunkH, banyan ? 18 : 10, trunkH);
      if (banyan) for (let k = 0; k < 5; k++) {                       // aerial roots
        const rx = x - 34 + k * 17 + hash(i * 3 + k) * 8, top = baseY - trunkH + 20;
        ctx.strokeStyle = pal.trunk; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(rx, top); ctx.quadraticCurveTo(rx + 3, (top + baseY) / 2, rx + (k - 2) * 2, v.groundAt(rx) - 2); ctx.stroke();
      }
      ctx.fillStyle = pal.canopy; ctx.beginPath();
      ctx.ellipse(x, baseY - trunkH, r * 1.5, r * 0.75, 0, 0, Math.PI * 2);
      ctx.ellipse(x - r * 0.9, baseY - trunkH + 10, r * 0.9, r * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(x + r * 0.9, baseY - trunkH + 8, r * 0.85, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.canopyHi; ctx.beginPath(); ctx.ellipse(x + r * 0.3, baseY - trunkH - r * 0.25, r * 0.7, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Bamboo band, swaying as one grove with a slow travelling wave.
    const bf = 0.7, bspacing = 26, bx0 = v.scroll * bf;
    const b0 = Math.floor(bx0 / bspacing) - 1, b1 = Math.floor((bx0 + v.W) / bspacing) + 1;
    for (let i = b0; i <= b1; i++) {
      const hb = hash(i * 9176 + 2); if (hb > 0.72) continue;         // gaps between clumps
      const x = i * bspacing + hb * 10 - bx0, gy = v.groundAt(x) + 2, hgt = 70 + hash(i * 55 + 1) * 90;
      const sway = Math.sin(t * 1.1 + i * 0.35) * (6 + hgt * 0.06);
      ctx.strokeStyle = hb < 0.36 ? pal.bamboo : pal.bambooDark; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo(x + sway * 0.3, gy - hgt * 0.55, x + sway, gy - hgt); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = pal.bambooDark;
      for (let k = 1; k < 4; k++) { const yy = gy - hgt * k / 4, sx = x + sway * (k / 4) * (k / 4); ctx.beginPath(); ctx.moveTo(sx - 2.5, yy); ctx.lineTo(sx + 2.5, yy); ctx.stroke(); }
      ctx.strokeStyle = pal.bamboo; ctx.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) { const lx = x + sway * (0.6 + k * 0.15), ly = gy - hgt * (0.6 + k * 0.15); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 9 + k * 2, ly - 5 + Math.sin(t * 2 + k) * 2); ctx.stroke(); }
    }
    ctx.fillStyle = pal.grass; ctx.beginPath(); ctx.moveTo(0, v.groundAt(0) + 4);
    for (let x = 0; x <= v.W; x += 10) { const wx = x + v.scroll * 0.7; ctx.lineTo(x, v.groundAt(x) - 9 - 7 * Math.abs(Math.sin(wx / 43)) - 4 * Math.sin(wx / 17)); }
    ctx.lineTo(v.W, v.groundAt(v.W) + 4); ctx.closePath(); ctx.fill();
  },
  ground(ctx, pal, t, v) {
    ctx.fillStyle = pal.dirt; ctx.beginPath(); ctx.moveTo(0, v.H);
    for (let x = 0; x <= v.W; x += 8) ctx.lineTo(x, v.groundAt(x));
    ctx.lineTo(v.W, v.H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.dirtDark; ctx.beginPath(); ctx.moveTo(0, v.H);
    for (let x = 0; x <= v.W; x += 8) ctx.lineTo(x, v.groundAt(x) + 44);
    ctx.lineTo(v.W, v.H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.moveTo(0, v.H);
    for (let x = 0; x <= v.W; x += 8) ctx.lineTo(x, v.groundAt(x) + 150 + 12 * Math.sin((x + v.scroll) / 90));
    ctx.lineTo(v.W, v.H); ctx.closePath(); ctx.fill();
    for (let x = 0; x <= v.W; x += 8) {
      const surf = SURFACES[v.surfaceAt(x + 4)], y0 = v.groundAt(x), y1 = v.groundAt(x + 8);
      ctx.fillStyle = surf.color;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 8, y1); ctx.lineTo(x + 8, y1 + 12); ctx.lineTo(x, y0 + 12); ctx.closePath(); ctx.fill();
    }
    const spacing = 80, i0 = Math.floor(v.scroll / spacing) - 1, i1 = Math.floor((v.scroll + v.W) / spacing) + 1;
    for (let i = i0; i <= i1; i++) {
      const h = hash(i * 31337), x = i * spacing + h * 50 - v.scroll;
      if (x < -60 || x > v.W + 60) continue;
      const y = v.groundAt(x), sName = v.surfaceAt(x);
      ctx.lineCap = 'round';
      if (sName === 'roots') {                                            // layered root web, the HURT signature
        ctx.strokeStyle = pal.root; ctx.lineWidth = 3.5 + h * 3;
        ctx.beginPath(); ctx.moveTo(x - 30, v.groundAt(x - 30) + 6); ctx.quadraticCurveTo(x, y - 7 + h * 6, x + 30 + h * 20, v.groundAt(x + 30 + h * 20) + 9); ctx.stroke();
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 12, y + 10); ctx.quadraticCurveTo(x + 8, y - 2, x + 26, y + 11); ctx.stroke();
      } else if (sName === 'rock') {
        ctx.fillStyle = pal.stone;
        ctx.beginPath(); ctx.ellipse(x, y + 3, 9 + h * 12, 4 + h * 2, 0, 0, Math.PI * 2); ctx.fill();
        if (h > 0.5) { ctx.beginPath(); ctx.ellipse(x + 24, v.groundAt(x + 24) + 4, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
      } else if (sName === 'mud') {
        ctx.fillStyle = 'rgba(170,190,200,0.28)'; ctx.beginPath(); ctx.ellipse(x, y + 7, 16 + h * 14, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = pal.dirtDark; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + 6 + h * 6, y + 10); ctx.lineTo(x + 2, y + 12); ctx.stroke();
      }
    }
    ctx.strokeStyle = pal.grass; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, v.groundAt(0));
    for (let x = 8; x <= v.W; x += 8) ctx.lineTo(x, v.groundAt(x));
    ctx.stroke();
  },
  // Foreground: hāpu'u fern and palm fronds sweeping past in front of Jon.
  foreground(ctx, pal, t, v) {
    const f = 1.45, spacing = 640, wx0 = v.scroll * f;
    const i0 = Math.floor(wx0 / spacing) - 1, i1 = Math.floor((wx0 + v.W) / spacing) + 1;
    ctx.fillStyle = pal.fore;
    for (let i = i0; i <= i1; i++) {
      const h = hash(i * 4201 + 5), x = i * spacing + h * 200 - wx0;
      const fromTop = h > 0.5, baseY = fromTop ? -20 : v.H + 20, dir = fromTop ? 1 : -1;
      for (let k = 0; k < 5; k++) {
        const a = (k - 2) * 0.26 + Math.sin(t * 0.7 + i + k) * 0.035, len = 130 + hash(i * 17 + k) * 90;
        const tipX = x + Math.sin(a) * len, tipY = baseY + Math.cos(a) * len * dir;
        ctx.beginPath(); ctx.moveTo(x, baseY);
        for (let s2 = 0.15; s2 < 1; s2 += 0.17) {                          // serrated frond edge
          const px = x + Math.sin(a) * len * s2, py = baseY + Math.cos(a) * len * s2 * dir, w = 22 * (1 - s2);
          ctx.lineTo(px + Math.cos(a) * w, py - Math.sin(a) * w * dir); ctx.lineTo(px + Math.cos(a) * w * 0.4 + Math.sin(a) * len * 0.05, py + Math.cos(a) * len * 0.05 * dir);
        }
        ctx.lineTo(tipX, tipY);
        for (let s2 = 0.95; s2 > 0.1; s2 -= 0.17) {
          const px = x + Math.sin(a) * len * s2, py = baseY + Math.cos(a) * len * s2 * dir, w = 22 * (1 - s2);
          ctx.lineTo(px - Math.cos(a) * w, py + Math.sin(a) * w * dir);
        }
        ctx.closePath(); ctx.fill();
      }
    }
  }
};
