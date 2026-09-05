# Jon's Ultra — Design Bible

Status: v0.6 (Sep 5 2026 — phase 1 closed at v0.5; phase 2 in repo SomeArmyVet/jons-ultra). Owner: Michael Moats. This file is the source of truth for how the game plays and looks. Any chat building or changing the game reads this first.

## 1. Premise

A side-scrolling ultra-running game. You are Jon — the family's long-distance runner — racing real 50–200 mile ultras he has actually run. Each race is a level whose look, terrain, weather, animals, aid stations and cutoffs match the real event. The game is a tribute, not a parody: the races are hard, the courses are accurate, and finishing means something.

## 2. Jon (the player character)

- Look: Forrest Gump silhouette — long flowing hair, long beard, both animated with speed and wind.
- Tattoos on neck, arms and legs, drawn as dark line detail; visible in every art pass.
- Kit: race bib (number configurable per race), hydration vest, trucker hat, trail shoes, blue trekking poles by default (per-race `poles` flag; off only for Across the Years).
- Night: headlamp on head; visible cone of light in front.
- States: run, uphill grind (shorter stride, forward lean), downhill bomb (long stride, arms out), jump, duck/slide, stumble, bite-hit (red flash + shake), aid-station stop (hands on hips, drinking), DNF (sits on a rock), finish (arms up).
- Drawn 100% procedurally on Canvas 2D. No image files. Ever.

## 3. Camera and controls

- Side view, camera locked slightly left of centre so obstacles appear with reaction time.
- World scrolls left. Jon's x is fixed; only y changes.
- Inputs (keyboard + touch + gamepad-later):
  - Jump: Space / Up / tap upper half of screen
  - Duck/slide: Down / S / tap lower half
  - Pause: Esc / P
  - Aid station: automatic stop-and-go (see §5); Space skips the stop early at a cost
- Jump has a short and long variant (hold = higher). Coyote time ~80 ms. Buffered input ~100 ms.

## 4. Core loop

1. Pick race → pick difficulty → start.
2. Run. Dodge obstacles and animals. Manage energy and hydration.
3. Reach aid stations before cutoff. Restock.
4. Survive the night section.
5. Finish → time, buckle tier, stats. Or DNF → where and why.

## 5. Mechanics

### Meters
- Energy (0–100): drains with distance, faster uphill and at altitude. Empty = "bonk": speed drops 40%, screen desaturates, jump height reduced.
- Hydration (0–100): drains with distance, faster in heat. Empty = cramp: random stumbles.
- Both refill at aid stations. Pickups on trail refill small amounts.

### Terrain and elevation
- Each race has a real elevation profile (array of points, mile → feet). The ground line follows it, scaled.
- Uphill: slower scroll, shorter jump. Downhill: faster scroll, obstacles arrive quicker, longer jump.
- Altitude (alpine races): energy drain multiplier above 10,000 ft.
- Surface types change obstacle mix and footing: mud (slide risk), roots, rock, sand, snow, road/track.

### Aid stations
- Real names and real mile markers from the race bible.
- Auto-stop for ~3 s: meters refill, aid-station name and mile shown, cutoff clock compared. Skip early = partial refill.
- Drop bag stations (per race) grant a bonus item: headlamp battery, poles, ice bandana.

### Day / night
- Race clock starts at the real start time. Sky palette interpolates through dawn, day, dusk, night, dawn.
- Night: visibility limited to headlamp cone + moon. Full-moon races (Saddles, Coyote Two Moon) get a wider ambient glow. Animal spawn shifts to nocturnal set.

### Cutoffs
- Each aid station has a cutoff time from the race bible. Arrive late = DNF at that station, with the real station name on the DNF card.
- Cutoff pressure indicator: clock turns amber at 15 min margin, red at 5.

### Pacer
- At the race's real pacer-eligible mile, a pacer joins behind Jon for one segment: absorbs one hit and calls out obstacles (audio + arrow). Races with no pacers allowed (Bradshaw Brute) skip this and are flagged "no crew, no pacer" on the intro card.

### Hazards
- Obstacles: terrain-specific, static or moving. Jump-over, duck-under, or slide-through.
- Animals: chase or ambush patterns per species. A bite = hit: lose energy, brief slow, screen shake. Three hits in one segment without an aid station = stumble-fall (bigger time loss), not death.
- Weather events per race: lightning (must duck at the flash), sleet, sandstorm, mud rain.

### Good pickups
- Gels, salt tabs, watermelon slices, ramen cups, flat Coke, bacon (Nu'uanu tradition), pickle (Coyote Two Moon), ice bandana, headlamp battery, trekking poles.

## 6. Difficulty (toggle on title screen)

| | Realistic | Arcade |
|---|---|---|
| 100 miles takes | 25–35 min | 5–8 min |
| Cutoffs | Real, DNF is real | Generous, warning only |
| Meters | Drain and matter | Drain slowly, cosmetic bonk |
| Hits | 3 per segment = fall | 5 per segment = fall |
| Night | Headlamp cone only | Wider ambient light |
| Aid stops | Mandatory 3 s | Instant |

Both modes share the same course, art and content. Realistic is the canonical experience; Arcade is for showing people at a party.

## 7. Scoring and progression

- Finish time is the score. Buckle tiers per race, taken from the real race where they exist (e.g. Western States sub-24 silver), otherwise: Gold = top-10%-equivalent, Silver = mid-pack, Bronze = finisher.
- Persisted per race and per difficulty: best time, buckle, finishes, DNFs, furthest mile. Stored with `window.storage` (personal scope).
- Race select shows earned buckles. All races unlocked from day one — no gating. Ultras don't gate.
- Stretch: household leaderboard (shared scope) so Jon can beat Michael's time.

## 8. Art direction

- Flat vector, painterly palettes. Reference feel: Alto's Odyssey.
- 4–6 parallax layers per biome: sky, far ridge, mid ridge, near vegetation, ground, foreground foliage passing in front of Jon.
- Every biome has a palette object with day/dusk/night/dawn variants. Never reuse a palette across biomes.
- Particles per biome: rain, mist, fireflies, dust, snow, embers, bamboo leaves.
- Screen shake on hits and falls; subtle heartbeat vignette at empty meters.
- Text: one display font (system stack), one UI font. Sentence case. No emoji in UI.
### Atmosphere (added 2026-09-05, Michael's request — canon for every biome)
- Sun and moon are real clocks. Sun position tracks local time between the race config's `sun.rise` and `sun.set`; the moon follows the same arc at night when `moon != "none"`. Movement must be noticeable within a few minutes of Realistic play.
- Night lasts as long as it really does. Palette keyframes derive from the config's rise/set, not fixed hours.
- Stars at night: seeded field, twinkle, fade in over dusk and out over dawn. A shooting star every 2–4 minutes real time; never by day.
- Ambient life is decoration only — no collision, no effect on play. Day: butterflies in the mid layer, occasional bird. Dusk/night: fireflies in near and foreground layers, moths around the headlamp, bat silhouettes across the moon. Each biome kit defines its own set.
- Foot dust: every surface carries `dust` 0–1. Footfalls spawn dust scaled by it and by speed, more on descents; mud spawns a splat instead. Pole plants match.
- Accessibility: reduced-motion toggle (no shake, fewer particles), colour-blind-safe hazard outline, all audio has a visual cue.

## 9. Audio

- Web Audio API, all synthesised — no audio files. Footsteps change with surface. Ambient bed per biome (rain, wind, cicadas). Bite = short growl/snap burst. Aid station = cowbell.
- Mute toggle persists.

## 10. Screens

1. Title — logo, "Jon's Ultra", difficulty toggle, start.
2. Race select — cards with real race name, location, distance, gain, biome thumbnail, earned buckle.
3. Race intro card — 3 facts about the real race, start time, rules (pacers y/n), "Go".
4. In-race HUD — mile, race clock, next aid + cutoff, energy, hydration, elevation strip with position.
5. Aid station card — name, mile, clock vs cutoff.
6. Finish — time, buckle, hits taken, bonks, night miles, share-as-text button.
7. DNF — station name, mile, reason.

## 11. Non-goals (v1)

- No multiplayer, no accounts, no external assets, no mobile app wrapper, no in-app purchases, no real photos or logos from race organisers.
- No race is "fictionalised". If a fact is unknown, it is marked VERIFY in the race bible and researched before the level ships.

## 12. Decisions log

- 2026-09-05 — Build in Project first, graduate to Claude Code + GitHub Pages at race #2. Side-scroller. Flat vector + parallax. Difficulty toggle (Realistic + Arcade). First race: HURT 100. Build order after: Hardrock → Bradshaw Brute → remaining Arizona races → rest.
- 2026-09-05 — Step 1 (v0.1) shipped: engine, render skeleton, Jon, jump/duck. Jump = hold-to-float (reduced gravity while held), fast-fall on Down. Poles = per-race config flag, default true, off for Across the Years (resolves Design Bible vs character sheet conflict). Drawing functions take `(ctx, palette, t, view)`.
- 2026-09-05 — Jon likeness pass (v0.1.1–v0.1.4). Jon = 110 px feet-to-cap, 9 colour tokens, one ink tone at 70%. Hair is SIMULATED, never hand-posed: 10-point verlet chain anchored under the back of the cap band, gravity + back-wind ∝ scroll speed + airborne lift, rendered as one tapered Catmull-Rom ribbon behind head and torso; two 5-point front locks in front of the vest strap. Head reads cap → glasses → skin window → single beard mass. Per-state hair input is `windMul` only. Step 1 closed.
- 2026-09-05 — Step 2 (v0.2): elevation drawn relative to Jon (world tilts, feet fixed), 1.5 px/ft exaggeration, camera pitch ±60 px. Grade speed model 1/(1+5.5g) up, 1+2.5|g| down (cap 1.45). Gait hysteresis ±5%/±3%. Surfaces as data (SURFACES), footing = speed + jump multipliers. Synthetic HURT-shaped test loop until the real profile lands at step 6.
- 2026-09-05 — v0.2.1: Jon 140 px, ground line at 60% of frame. Hair helmet under the cap, chain anchored at the nape. Carried poles behind torso in the trailing hand at 30°. Contact shadow and pole-plant dust puffs.
- 2026-09-05 — Step 3 (v0.3): race clock ×50 (Realistic) / ×300 (Arcade) real seconds per game second, keyed to `startTime`. Palette keyframes 04:45 / 05:45 / 07:00 / 17:30 / 18:30 / 19:30. Headlamp cone 560 px ±19°; `nightAmbient` 0.12 / 0.45; full moon +0.3. Drains 7 E / 5 H per mile with grade, surface and heat multipliers; trail pickups gel 8 E, flask 8 H, watermelon 4 E + 5 H. Bonk ×0.6 speed, ×0.8 jump; cramp stumble 0.55 s. Sunglasses ride the cap bill 17:45–06:15.
- 2026-09-05 — Step 4 (v0.4): cutoffs as data — per-station `cutoffHours` (number or per-lap array) or a course `cutoffSchedule`; schema gains `cutoffSchedule`, `bibNumber`, `rules`, `buckles`, `sun`. Aid stop 3 s Realistic / instant Arcade (`DIFFICULTY.aidStopS`). Drop-bag items rotate battery / ice bandana / poles. Pacer = one segment, one shield. Finish crowd 16 seeded, camera eases 35% toward Katie and Emma over 2 s. Katie, Emma and tortoise remain placeholders until the cast sheet reaches the build.
- 2026-09-05 — Atmosphere rules added to §8 (sun/moon clocks, real night length, stars + shooting stars, ambient life, foot dust). Phase-2 split (Claude Code + GitHub Pages) happens AFTER step 5; step 6 onward is built in the repo.
- 2026-09-05 — Step 5 (v0.5, 2,077 lines): schema gains `sun: { rise, set }` and `biome`; day/night keyframes derive from rise/set (−1:06 / −0:21 / +0:30 around rise, −0:36 / +0:06 / +1:00 around set). Shooting star every 2–4 real min, night only. Life sets live in the kit (`life.day`, `life.night`). `SURFACES.dust` clay 0.6 / roots 0.2 / rock 0.4 / mud 0 (splats). Audio bed = 3 filtered-noise layers + LFOs; footstep filter per surface; cowbell 562/845 Hz. M = mute (persisted), Shift+M = moon test key. PHASE 1 CLOSED. Open item carried to phase 2: night insect bed −80% volume; Katie/Emma/tortoise still placeholders (cast sheet never reached the Project chat).
- 2026-09-05 — Phase 2 begins in `~/Developer/jons-ultra` (GitHub SomeArmyVet/jons-ultra, private). Plans are copied into `docs/`; masters stay in OneDrive 42.01. Reference photos are never committed — Claude Code reads them from the OneDrive path.
- 2026-09-05 — Phase 2 split shipped: v0.5 monolith → `index.html` + ES modules per Architecture §3 (engine, render, jon, sim, race, spawner stub, hazards stub, atmosphere, biomes/rainforest + biomes/index, ui, audio, store); synthetic loop → `races/test20.json`, loaded by fetch at boot. Structural decisions: the character viewer lives in `jon.js` (keeps poses/hair sim module-private); biome kits register at boot via `registerBiomes()` (avoids import-cycle TDZ); GAME/RACES/BIOMES are also exposed on `window` for console debugging — still the only globals; the cast placeholders stay in `render.js` until the cast pass. Verified identical to the monolith headlessly: bit-identical raceSec/energy/hydration/lap/station-index at miles 5/10/15/20 over 6,625 frames, viewer cycles, finish sequence renders. Monolith deleted from the repo; archived in OneDrive 42.01/03-builds.
- 2026-09-05 — Night insect bed volume ×0.2 (gain 0.12 → 0.024), closing the phase-1 open item "night insect bed −80% volume" (Michael: "toned down 80%").
