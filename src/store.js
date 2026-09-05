// ===== MODULE: store =====
// window.storage (artifact API) when present, localStorage otherwise. Settings only until step 7 adds progress.
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
