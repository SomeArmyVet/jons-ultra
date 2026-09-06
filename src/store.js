// ===== MODULE: store =====
// window.storage (artifact API) when present, localStorage otherwise. Keys per Architecture §7:
// jons-ultra:settings { mute, lastRace, lastDifficulty } and jons-ultra:progress
// { [raceId]: { [difficulty]: { bestHours, buckle, finishes, dnfs, furthestMile } } }.
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
export const Settings = {
  data: { mute: false, lastRace: null, lastDifficulty: null },
  async load() { const v = await Store.get('jons-ultra:settings'); if (v) Object.assign(this.data, v); return this.data; },
  save(patch) { Object.assign(this.data, patch); Store.set('jons-ultra:settings', this.data); }
};

// Per-race, per-difficulty results. rec() returns the live record to mutate; save() persists the blob.
export const Progress = {
  data: {},
  async load() { const v = await Store.get('jons-ultra:progress'); if (v) this.data = v; return this.data; },
  rec(raceId, diff) {
    const r = this.data[raceId] || (this.data[raceId] = {});
    return r[diff] || (r[diff] = { bestHours: null, buckle: null, finishes: 0, dnfs: 0, furthestMile: 0 });
  },
  save() { Store.set('jons-ultra:progress', this.data); }
};
