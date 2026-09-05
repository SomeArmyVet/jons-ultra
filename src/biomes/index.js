// ===== MODULE: biomes =====
// Kit registration happens at boot (not at module evaluation) so the import cycle with engine.js stays safe.
// Adding a biome = one file here + one import + one line in registerBiomes.
import { BIOMES } from '../engine.js';
import { rainforest } from './rainforest.js';

export function registerBiomes() {
  BIOMES.rainforest = rainforest;
}
