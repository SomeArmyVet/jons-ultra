// ===== MODULE: store =====
// window.storage (artifact API) when present, localStorage otherwise. Keys per Architecture §7:
// switchbacks:settings { mute, lastRace, lastDifficulty } and switchbacks:progress
// { [raceId]: { [difficulty]: { bestHours, buckle, finishes, dnfs, furthestMile } } }.
// The game was renamed from Jon's Ultra (2026-09-05); loads fall back to the old jons-ultra:* keys
// once and re-save under the new prefix, so nobody loses a buckle.
export const Store = {
  async get(key) {
    try {
      if (typeof window !== 'undefined' && window.storage) { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
      if (typeof localStorage !== 'undefined') { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    } catch (e) { /* missing key or no storage */ }
    return null;
  },
  async set(key, value) {
    try {
      if (typeof window !== 'undefined' && window.storage) { await window.storage.set(key, JSON.stringify(value)); return; }
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage unavailable */ }
  }
};

// Settings are merged, never overwritten wholesale (a mute toggle must not wipe the last race).
async function getMigrated(key, oldKey) {
  const v = await Store.get(key);
  if (v != null) return v;
  const old = await Store.get(oldKey);
  if (old != null) Store.set(key, old);
  return old;
}

export const Settings = {
  data: { mute: false, lastRace: null, lastDifficulty: null },
  async load() { const v = await getMigrated('switchbacks:settings', 'jons-ultra:settings'); if (v) Object.assign(this.data, v); return this.data; },
  save(patch) { Object.assign(this.data, patch); Store.set('switchbacks:settings', this.data); }
};

// Per-race, per-difficulty results. rec() returns the live record to mutate; save() persists the blob.
export const Progress = {
  data: {},
  async load() { const v = await getMigrated('switchbacks:progress', 'jons-ultra:progress'); if (v) this.data = v; return this.data; },
  rec(raceId, diff) {
    const r = this.data[raceId] || (this.data[raceId] = {});
    return r[diff] || (r[diff] = { bestHours: null, buckle: null, finishes: 0, dnfs: 0, furthestMile: 0 });
  },
  save() { Store.set('switchbacks:progress', this.data); }
};
