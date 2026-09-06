# Switchbacks — Architecture

Status: v0.4 (Sep 5 2026 — phase 2 LIVE: split shipped, §3 lists the actual files; §4 gains `tortoise`). Read before writing any code. Goal: adding a race never requires touching the engine.

## 1. Delivery phases

| Phase | Where | Form | Status |
|---|---|---|---|
| 1 | Claude Project "Jon's Ultra" | Single-file HTML artifact `jons-ultra.html` | CLOSED at v0.5 (step 5 shipped 2026-09-05). Build archived in OneDrive 42.01/03-builds. |
| 2 | Claude Code repo + GitHub Pages | Multi-file: `index.html`, `src/*.js` ES modules, `races/*.json` | **LIVE** since 2026-09-05 — the v0.5 split is verified identical to the monolith; steps 6–8 and every later race are built here. |

The split was mechanical as planned: each phase-1 section became one file, verified bit-identical against the monolith (sim state at miles 5/10/15/20 over 6,625 headless frames).

## 2. Stack

- HTML5 Canvas 2D, vanilla JS (ES2020), no frameworks, no build step, no external assets, no external libraries.
- `requestAnimationFrame` loop with fixed-timestep physics (60 Hz) and variable render.
- Web Audio API for all sound (synthesised).
- `window.storage` (artifact key-value API) for persistence in phase 1; `localStorage` shim behind the same interface in phase 2.
- Target: 60 fps on a 2020 laptop and a mid-range phone at 1280×720 logical resolution, DPR-aware.

## 3. Modules (actual phase-2 files)

1. `src/engine.js` — loop, timing, input, camera, scene stack, boot; owns the three globals and the shared helpers (rng, hash, clamp, lerp, lerpTo, seg).
2. `src/render.js` — layer painter, parallax, night overlay + headlamp cone, particles, race furniture (aid stations, finish line, crowd placement, pacer), HUD dispatch, screen shake.
3. `src/jon.js` — procedural character: hair sim (verlet), beard/tattoo drawing, poses/gaits, hitbox; includes the character viewer (J key), keeping poses and hair internals module-private.
4. `src/sim.js` — meters, race clock, course sampling (elevation/grade/surface), DIFFICULTY and SURFACES tables, palette blending, placeholder trail pickups.
5. `src/race.js` — station list, cutoffs, aid stops, pacer, drop-bag bonuses, hit pipeline, DNF/finish, race reset.
6. `src/spawner.js` — reads the race config's hazard tables and surfaces; emits obstacles and animals with seeded RNG (seed = race id + attempt). Fixed-mile obstacles (stream crossings) repeat at their real miles every lap; weighted ones roll per slot honouring surface filters, with minimum spacing and aid-station clear zones.
7. `src/hazards.js` — obstacle resolution (jump the root web, duck the limb, slide the slab, hop or wade the streams, jump the mud pit) and animal behaviours (pig telegraph-and-bolt, wallaby coil-and-hop, mongoose dart, centipede bite, chicken scatter, rat streak, night eye-shine) with drawing functions; the Huakaʻi Pō lore hazard; owns the segment hit counter (hitsPerFall → stumble-fall).
8. `src/atmosphere.js` — sun/moon clocks, day/night keyframes, stars + shooting stars, rain/mist, ambient life, foot dust. Decoration only.
9. `src/biomes/rainforest.js` + `src/biomes/index.js` — one file per kit (sky, ridges, vegetation, ground, foreground, palettes, life sets); `registerBiomes()` fills BIOMES at boot (registration at boot avoids import-cycle TDZ).
10. `src/cast.js` — the cast: drawKatie (finish cheer + aid-station crewing modes), drawEmma, drawTortoise, drawSpectator (cast sheet §7).
11. `src/ui.js` — title screen, race select (registry-driven cards: biome thumbnail from the kit's day palette, real facts, earned buckle + best time per difficulty), intro/aid/DNF/finish cards, HUD, buttons, toasts.
12. `src/audio.js` — synth voices and ambient beds keyed by biome.
13. `src/store.js` — Store (raw), Settings (merged: mute, lastRace, lastDifficulty), Progress (per race + difficulty: bestHours, buckle, finishes, dnfs, furthestMile); localStorage behind the phase-1 interface.
14. `races/*.json` — the race registry: one config file per race (§4), fetched and registered at boot.

Allowed globals: `GAME` (state), `RACES` (registry), `BIOMES` (kit registry). Nothing else — everything further crosses files as ES module imports; the three globals are also mirrored on `window` for console debugging.

## 4. Race config schema

Every race is one object. Adding a race = adding one object and, if needed, one biome kit. The engine never references a race by name.

```js
{
  id: "hurt100",                       // slug, used for storage keys and seeds
  dev: true,                           // optional: hidden from race select unless the URL contains ?dev (test20)
  name: "HURT 100",
  location: "Honolulu, Oahu, HI",
  month: "January",
  distanceMiles: 100,
  structure: { type: "loop", loopMiles: 20, laps: 5 },   // or { type: "point" } or { type: "fixedTime", loopMiles: 1, targetMiles: 200 }
  startTime: "06:00",                  // local, drives day/night
  timeLimitHours: 36,
  gainFeet: 24500,
  altitudeFeet: { min: 300, max: 1900 },
  biome: "rainforest",                 // key into BIOMES
  palette: { day: {...}, dusk: {...}, night: {...}, dawn: {...} },
  moon: "none",                        // "none" | "full" — affects night ambient
  sun: { rise: "07:05", set: "18:10" },  // local; drives sun/moon arcs and palette keyframes
  bibNumber: 254,
  cutoffSchedule: [[0,0],[20,12],[40,22],[60,30],[80,34.5],[100,36]],   // [absMile, hours]; alternative to per-station cutoffHours
  elevation: [[0, 300], [1.2, 1800], ...],   // [mile, feet] within one loop (or whole course for point-to-point)
  surfaces: [ { fromMile: 0, toMile: 3, type: "roots" }, ... ],   // each surface type carries dust 0–1 in SURFACES
  aidStations: [
    { name: "Makiki (Nature Center)", mile: 0, cutoffHours: null, dropBag: true, pacerStart: true, crew: true },
    { name: "Mānoa (Paradise Park)", mile: 7.2, cutoffHours: null, dropBag: true, pacerStart: true, crew: true },
    { name: "Nu'uanu (Judd Trail)", mile: 12.5, cutoffHours: null, dropBag: true, pacerStart: false, crew: false }
  ],
  rules: { pacersAllowed: true, pacerFromMile: 60, crewAllowed: true },
  poles: true,                         // Jon carries poles in this race (false only for Across the Years)
  targetMinutes: 10,                   // design minutes for the WHOLE RACE as played (Realistic, 6e); scales world speed AND race clock together, so raceSec-per-display-mile (cutoffs, day/night) is invariant
  loops: 3,                            // visual loops (6e): the world runs `loops` passes of the profile while the mile counter, stations, cutoffs and clock stay on the real structure (5 × 20). One on-screen loop = 33.3 real miles.
  drainMul: { energy: 1.6, hydration: 2.0 },   // per-race climate: HURT humidity (defaults 1; tuned by the 6e acceptance pass)
  lore: { nightMarchers: true },       // Hawaiian races only: Huakaʻi Pō lore hazard (Race Bible §1)
  tortoise: { where: "aidTable" },     // finish-line easter egg placement: "aidTable" | "trail" | "tote" | "rock" | "lap" (cast sheet §5/§7); pick one per race, vary it

  hazards: {
    obstacles: [ { type: "rootWeb", weight: 5, surfaces: ["roots"] }, { type: "streamCrossing", weight: 2, atMiles: [6.8, 7.6, 12.1, 12.9] }, ... ],
    hitQuotaPerLoop: 16,               // biters (pig/wallaby/centipede) placed per visual loop, phase-aware, so hits-per-loop sits in the 3–8 design band (6e); 0/absent = all animals roll from the table
    animals:   [ { type: "pig", weight: 0, time: ["day", "dawn", "dusk"] }, { type: "mongoose", weight: 4 }, { type: "centipede", weight: 0, time: ["night"] } ],   // weight 0 = quota-driven biter, listed for the fauna record
    weather:   [ { type: "rainSquall", chancePerMile: 0.05 }, { type: "mist", aboveFeet: 1400 } ]
  },
  pickups: ["gel", "saltTab", "watermelon", "bacon", "spamMusubi", "flatCoke"],
  landmarks: [ { mile: 2.5, label: "Hogsback" }, { mile: 9.0, label: "Bamboo forest" } ],
  buckles: { gold: 24, silver: 30, bronze: 36 },    // hours
  introFacts: [ "5 laps of a 20-mile loop with 24,500 ft of climbing.", "20 stream crossings.", "Motto: We wouldn't want it to be easy." ]
}
```

Validation: on load, `races` runs a schema check and throws with the race id and field name if anything is missing. Fail loud, not at mile 63.

## 5. Difficulty as data

`DIFFICULTY.realistic` and `DIFFICULTY.arcade` are objects of multipliers (scroll speed, drain rates, hit tolerance, cutoff enforcement, aid stop seconds, night ambient). The sim reads the active one; no `if (arcade)` branches anywhere else.

## 6. Time scale

Pace is data (6e): each race's `targetMinutes` is the whole-race Realistic duration as played (HURT: 10). paceMul = SIM.PACE_CAL_MIN / targetMinutes scales world speed and the race clock together, so raceSec-per-display-mile — the day/night cycle and every cutoff — stays true to the real event regardless of pace or mode. Arcade ≈ targetMinutes / 5.

## 7. Persistence keys

- `switchbacks:progress` → `{ [raceId]: { [difficulty]: { bestHours, buckle, finishes, dnfs, furthestMile } } }` (one key, one JSON blob).
- `switchbacks:settings` → `{ mute, reducedMotion, lastRace, lastDifficulty }`.
- Phase 2 stretch: `switchbacks:household` (shared scope) for the family leaderboard.
- Renamed from jons-ultra:* (2026-09-05): loads fall back to the old keys once and re-save under the new prefix.

## 8. How to add a race (checklist)

1. Complete the race's section in `Harper_JonsUltra_RaceBible_2026.md`; clear every VERIFY.
2. Choose biome kit. If none fits, write a new kit in `biomes/` (sky, ridges, vegetation, ground, foreground, particles, ambient audio).
3. Write the config object per §4. Elevation array from the real profile (40–100 points).
4. Add any new hazard types to `hazards` with a behaviour and a drawing function.
5. Add any new pickup types (drawing + effect).
6. Run the schema check. Play the first 10 miles and the first night segment.
7. Add the race card to race select (automatic from the registry — confirm it renders).
8. Update the decisions log in `Harper_JonsUltra_DesignBible_2026.md`.

## 9. Build order for phase 1 (HURT 100)

1. Engine + render skeleton with a flat test ground and one parallax kit. Jon drawn and animated. Jump/duck working.
2. Elevation-driven ground, surfaces, camera speed by grade.
3. Meters, race clock, day/night palette, headlamp.
4. Aid stations, cutoffs, pacer, DNF and finish screens.
5. Rainforest kit: layers, particles, ambient audio.
6. HURT hazards, animals, pickups, landmarks; 5-lap structure.
7. Title, race select, difficulty toggle, persistence.
8. Tuning passes: jump feel, spawn density curve, difficulty tables.

## 10. Coding conventions

- Section banners: `// ===== MODULE: jon =====`.
- No magic numbers in behaviour code; constants live at the top of their module.
- Every drawing function takes `(ctx, palette, t, view)` — `view` carries scroll offset and camera state — and never reads global state.
- Seeded RNG only (`rng(seed)`); `Math.random` is banned so a run is reproducible for bug reports.
- Comments explain why, not what.
