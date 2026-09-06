# Switchbacks — Design Bible

Status: v0.7 (Sep 5 2026 — game renamed Switchbacks; formerly Jon's Ultra. Doc filenames keep the JonsUltra slug to stay in sync with the OneDrive masters). Phase 1 closed at v0.5; phase 2 in repo SomeArmyVet/jons-ultra. Owner: Michael Moats. This file is the source of truth for how the game plays and looks. Any chat building or changing the game reads this first.

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
- Katie crews every crew-allowed station (she does in real life): she stands at the aid table in her finish-line design and hands Jon a flask during the refill. At stations with `crew: false` (Nu'uanu) she is absent and the aid card says "No crew access." Emma is finish-line only. (2026-09-05, 6e.)
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
| 100 miles takes | the race's `targetMinutes` (HURT ≈ 10 min) | ≈ ⅕ of Realistic (HURT ≈ 2 min) |
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
- Stars at night: seeded field, twinkle, fade in over dusk and out over dawn. A shooting star every 30–60 s of night real time (6e — meant to be noticed), longer bright streak; never by day.
- Ambient life is decoration only — no collision, no effect on play. Day: butterflies in the mid layer, occasional bird. Dusk/night: fireflies in near and foreground layers, moths around the headlamp, bat silhouettes across the moon. Each biome kit defines its own set.
- Foot dust: every surface carries `dust` 0–1. Footfalls spawn dust scaled by it and by speed, more on descents; mud spawns a splat instead. Pole plants match.
- Accessibility (implemented v0.9): reduced-motion toggle on the title screen — no screen shake, dust/rain particles halved; hazard cues toggle — shape-coded ▲ jump / ▼ get low above every obstacle (shape and luminance carry the meaning, never hue); every sound already pairs with a visual (bite=shake+flash, cowbell=aid card, grunt=hoof dust + head drop, drums=torches, splash/thud=particles+stumble). Both toggles persist in settings.

## 9. Audio

- Web Audio API, all synthesised — no audio files. Footsteps change with surface, −50% and pitch-varied per step. Ambient bed per biome — never steady (2026-09-05): insects chirp in bursts with 5–20 s silences, wind comes in gusts, rain only during squalls; ambient bus sits at −60% under the event sounds. Bite = short growl/snap burst. Aid station = cowbell. Events keep full level so they stand out.
- Mute toggle persists. Dev: `window.AUDIO.master` / `.ambient` tweak live; a settings slider comes later.

## 10. Screens

1. Title — logo, "Switchbacks", difficulty toggle, start.
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
- 2026-09-05 — Finish-line cast shipped in `src/cast.js` per the cast sheet, likeness checked against the Katie/Emma photos: Katie = straight dark hair + full fringe + black rectangular glasses (always drawn) + charcoal tee/jeans/boots + cowbell, closest to the tape (positions swapped — she was outside Emma before); Emma = slightly shorter teen, long wavy dark hair, no fringe/no glasses, pale-blue top, denim skirt, white sneakers, GO JON sign. Cheer bounce scales with the finish-zoom factor so only the last ~2 s animate them differently from the crowd. Tortoise is now a proper desert tortoise (brown-olive domed shell with plate seams, elephant legs, wrinkled neck, one front leg mid-step, very slow) placed per the new `tortoise.where` config field — HURT test loop uses "aidTable" (under the finish aid table); schema updated in Architecture §4.
- 2026-09-05 — Finish-line pass (Michael): crowd is now 18–24 over the last ~500 px in two depth rows (front full size + floodlit, back 80% + darker), irregular gaps, height ±15%, six poses cycling (arms up, clap, phone, cowbell, kid on shoulders, cooler sitter), no front-row overlaps. Two floodlights on the finish posts punch a warm pool (~250 px) out of the night overlay so tape, trail and front row read at full night. Katie's glasses redrawn as thin frames + lighter lens fill sized to the eyes (not a bar); fringe as a band above the frames. Emma's GO JON sign DROPPED — her identifier is now a phone held up recording plus her own wave timing. Katie and Emma are the only figures the floodlights fully hit and the only two with their own wave timing. Cast sheet bumped to v0.2.
- 2026-09-05 — Step 6 begins (v0.6): HURT 100 is the boot course (`races/hurt100.json`, `?race=test20` keeps the synthetic loop for regression). Real cutoff structure as per-station per-lap arrays (lap 5 only: mile 80/29 h, 87.2/31.5 h, 92.5/33.5 h, 100/36 h); pacers from mile 60, never starting Nu'uanu; no crew at Nu'uanu; real sun clock 07:11/18:03, no moon; 51-point elevation profile interpolating the documented anchors (24.9k ft over 5 laps vs 24.5k real, 300–1,900 ft); per-leg surface map; official-map landmarks toast as Jon passes them each lap; per-race trail pickups with drawings (spam musubi, bacon, flat Coke, salt tab, watermelon, gel); bib number and poles flag now read from the config; reaching the line after course closure is a DNF, not a finish.
- 2026-09-05 — Step 6 hazards shipped: spawner emits seeded layouts (seed = race id + attempt; ~1 obstacle/0.4 mi, ~1 animal/1.6 mi before time windows; 320 px minimum spacing; 0.15 mi aid-station clear zones; stream crossings at their four real miles every lap). Obstacles: root web (jump or trip), banyan limb (duck or bonk), slick rock (slide/jump or slip), mud pit (jump or 0.55× slow), stream (rock-hop airborne or wade: +4 hydration, −3 energy, 0.6× slow — the real choice). Animals: boar charges at dawn/dusk (bite = hit), mongoose darts underfoot (stumble only), centipede bites at night, feral chicken and rat are harmless flavour. Bite = hit (−10 energy, growl synth); hitsPerFall is difficulty data (3 Realistic / 5 Arcade) → stumble-fall (1.4 s), reset at each aid station, never death. New synth one-shots: thud, splash, growl. Teleport test keys skip hazard effects rather than resolving a wall of them.
- 2026-09-05 — Step 8 (v0.9), tuning + accessibility — the last planned build-order step. ARCADE PASS: DIFFICULTY gains `enforceDNF` (true Realistic / false Arcade) — Arcade now matches the §6 table it always promised: missed cutoffs toast "Past the real cutoff — Arcade rolls on" instead of DNFing, and there are no medical pulls; Realistic unchanged. SPAWN DENSITY CURVE (§9.8): evaluated and REJECTED after four measured iterations — an obstacle-roll ramp (×0.85→×1.15) is flattened by the 1.0 s spacing cap (realized 52/52/61 per loop) while destabilizing the 6e hits-per-loop contract through jump-lock timing, and a quota ramp (14→18) fails the same way; every layout perturbation reshuffles hit timing outside the 3–8 band. The effective curve remains the phase-aware biter quota (+3 last loop) plus natural late-race congestion; revisit only if the acceptance band is widened. ACCESSIBILITY per §8 (see updated §8 entry): reduced-motion and hazard-cue toggles on the title, persisted. JUMP FEEL: deliberately untouched — stable through the 6e acceptance pass; awaiting Michael's v0.9 playtest before touching physics.
- 2026-09-05 — RENAMED: the game is "Switchbacks" (Michael's pick from a no-Jon's-name shortlist; it describes the terrain, every course in the roster, and what a loop ultra does to you). Jon stays the character; only the title changed. Title screen, HUD, page title, share text and README updated; storage keys migrated jons-ultra:* → switchbacks:* with a one-time fallback read so existing buckles survive. Doc filenames and the repo/folder name keep the old slug for now (OneDrive master sync; repo rename is Michael's call on GitHub).
- 2026-09-05 — Step 7 (v0.8): title, race select, difficulty toggle, persistence (Architecture §9.7). Title screen (§10.1): logo over the live idling world — Jon stands hands-on-hips and checks his watch every few seconds (character sheet §6.9; the laugh and cap-adjust wait for the polish pass); Start, difficulty toggle, mute/viewer hints. Race select (§10.2): registry-driven cards — biome thumbnail painted from the kit's day palette (no images), name, location, distance, gain, month, real-vs-game loop note, earned buckle with best time, finishes/DNFs, or furthest mile if unfinished — per current difficulty; all races unlocked (no gating); dev courses (test20) hidden unless ?dev is in the URL. Flow: title → select → intro (gains a Back button) → race; Esc walks back; Enter/Space advance. Persistence per §7: jons-ultra:settings { mute, lastRace, lastDifficulty } — merged on save, so toggling mute no longer wipes the rest — and jons-ultra:progress per race per difficulty { bestHours, buckle (best tier kept), finishes, dnfs, furthestMile }, written at every finish and DNF. Boot restores last difficulty and shows the last-run race behind the title; ?race=<id> still jumps straight to that intro for dev/regression.
- 2026-09-05 — Step 6e (v0.7), Michael's third round — shipped only after every acceptance criterion passed the headless harness (test/acceptance.mjs, 14 tuning iterations). NOTE: the 6d round is not in this repo's history; its stated outcomes (pickups +65%, marchers guaranteed once per race, whole-race targetMinutes) were implemented from Michael's 6e summary, but the 6d pacer redraw spec was unrecoverable — pacer unchanged, needs Michael's 6d notes. Decisions: LOOPS — config `loops` (HURT 3) separates visual loops from the real 5×20 structure: GAME.mile is trail miles, display miles = trail × mileRate (100/60); stations, cutoffs, drains, landmarks and the clock live on real display miles (raceSec-per-display-mile invariant), so aid tents sit at their real mile positions even where that lands mid-profile (accepted trade-off); HUD "Loop 1 of 3 · Mile 27"; intro card states both real and game structure; ?race=test20 degrades to mileRate 1 bit-identically. PACE — targetMinutes is now the WHOLE-race played duration (HURT 10 → 9.9–10.0 min measured). SLIDE — max 1.2 s, then auto-stand into crouch-walk while Down held (0.55× speed, still "low" for limb/slab/wallaby/marchers), 0.4 s cooldown before the next slide. PIG — rework: ~0.5× Jon, longer than tall, one ink tone, mane ridge, snout, tusks; waits trailside → 0.6 s telegraph (grunt + hoof dust + head lowers) → bolts across in 0.5 s (seeded late-bolt window); jump clears, duck does not; roams all day per the Book. WALLABY — 0.45 s visible coil telegraph before the hop (every biter telegraphs). Night EYE-SHINE on animals (real; keeps night fair). ATMOSPHERE — fireflies halved (5–10, blink half speed); shooting stars every 30–60 s of night, longer brighter streaks. KATIE CREWS — cast doc renamed to "Cast": Katie at every crew-allowed station handing Jon a flask during the refill; absent at Nu'uanu, whose aid card says "No crew access."; Emma finish-only. TUNING (acceptance-driven, supersedes earlier values): drainMul 1.6/2.0 (was 1.8/2.5), HEAT_K 0.85 (was 1.0, still above the 0.6 original), pickup spacing 0.32 and values raised (both halves of "pickups +65%"), HIT_ENERGY 6, trips cost time only, hitsPerFall unchanged; hits-per-loop stabilised by a phase-aware per-loop biter quota (`hitQuotaPerLoop` 16, +3 on the final loop) placed against the invariant clock — the day/night mile map is deterministic, so each loop reliably carries 3–8 hits of pressure; obstacle spacing is time-based (≥ 1.0 s = full jump airtime + 0.15 s at local expected speed, fixed crossings evict rolled neighbours). Final acceptance numbers logged in the 6e handover.
- 2026-09-05 — Step 6c, Michael's first-playtest feel pass. PACE: race config gains `targetMinutes` (minutes per lap as played, Realistic); HURT 14 → 10. paceMul = 14/10 scales world speed AND race clock together (Realistic ×50 → effective ×70), so raceSec-per-mile — every cutoff and the day/night arc — is bit-invariant; §6 table updated (100 mi ≈ laps × targetMinutes; the old 25–35 min row is superseded). DANGERS ×3: ~1 obstacle/0.25 mi, extra root-web pass on roots surfaces, animals ×3 (~1/0.55 mi before time windows); MIN_GAP 0.06 mi (~0.7 s at new pace) keeps clusters dodgeable; obstacle silhouettes enlarged for readability at speed. METERS: config gains `drainMul` — HURT humidity: hydration ×2.5, energy ×1.8; HEAT_K 0.6 → 1.0. ANIMALS corrected per Race Bible: boar → wild pig; mongoose redrawn ferret-shaped; chickens spawn 2–3 and scatter both ways; NEW brush-tailed rock wallaby (real Kalihi Valley colony, sourced) hops the trail in a high arc — duck under it, collide = hit. LORE: Huakaʻi Pō added (config `lore.nightMarchers`): ridge torches + low drums ~1 night in 3 (1 in 2 full moon), at most one on-trail crossing per night — DUCK and hold until it passes; standing/jumping = hit + 1.2 s darken. Respectful: torches and drums only, no chants, no faces. FINISH: crowd sized from Jon live (front 0.9×, back 0.75× JON.TARGET_PX — never fixed px; kid-on-shoulders clamped clear of the banner); finish card waits 3 s then slides into the right 45%, compact, Jon and near crowd stay visible. AUDIO: ambient bus −60% under full-level events; insect bursts with 5–20 s silences; wind in gusts; footsteps −50% + pitch-varied; `window.AUDIO` exposed for dev; marcher drums are soft sine thumps.
