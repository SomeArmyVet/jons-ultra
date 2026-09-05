# Jon's Ultra — Race Bible

Status: v0.1 (Sep 2026). One section per race Jon has run. Facts marked VERIFY are from memory and must be checked against the official race guide before that level ships. HURT 100 has had its research pass (sources: Book of HURT 2024–2026, hurt100.com). Saddles, Bradshaw Brute and Coyote Two Moon had a quick check; the rest are seeded only.

Rule: the level must look and behave like the real course. Desert race = desert. Loop race = loops. No pacers = no pacer power-up.

## Biome kits (shared art + hazard sets)

| Kit | Races | Ground | Parallax feel |
|---|---|---|---|
| Rainforest | HURT 100 | Mud, roots, slick rock, stream crossings | Dense green, bamboo, mist, banyan |
| Alpine | Hardrock, Wyoming Range | Scree, snowfield, tundra, creek | Jagged peaks, big sky, wildflowers |
| AZ high desert / ponderosa | Bradshaw Brute, Zane Grey, Saddles, Stagecoach | Granite, decomposed rock, pine needle, cinder | Pines, granite boulders, saguaro low down |
| California chaparral / oak | Coyote Two Moon, Folsom | Clay (greasy when wet), fire road, oak leaf | Golden grass, oaks, ridgelines, Pacific haze |
| Mojave | Bootleg | Sand, rock, hardpan | Lake Mead blue, red/brown rock, creosote |
| Loop track | Across the Years | Dirt/paved 1-mile loop | Ballpark lights, tents, fireworks |

---

## 1. HURT 100 — Honolulu, Oahu, HI  ★ FIRST LEVEL

Research pass: DONE (2026-09-05). Full pass 2026-09-05 against the Book of HURT 2024 (hurt100.com/wp-content/uploads/2023/05/BookofHURT2024.pdf — the last classic 5×20 edition), the official course map (hurt100.com/HURT100-map.pdf), the 2024 wrap-up (hurt100.com/2024/01/2024-hurt-100-wrap-up/) and finisher reports (brianbondy.com/blog/188). All VERIFYs cleared. Note: from 2026 the real course changed to a 2.5-mile lower loop + 5 × 19.5-mile revised loops; the game models the classic 5 × 20 course Jon ran.

- Distance: 100 miles as 5 laps of a 20-mile loop. Mid-January. Start 06:00 Saturday, race ends 18:00 Sunday (Book of HURT 2024 schedule — CONFIRMED).
- Elevation: 300–1,900 ft; ~24,500 ft cumulative gain (GPS sampling ~100 m per the Book). Each lap = 3 climbs of ~1,200–1,600 ft (Hogsback→Mānoa Cliff, Aihualama→Pauoa Flats, Nu'uanu→Nahuina); 13 switchbacks down Aihualama after the Pauoa Flats roots. The level's elevation array interpolates between these documented anchors — swap in a GPX-derived profile if one lands (refinement, not a VERIFY).
- Surface: almost entirely technical single-track — roots (layered to knee height), rocks, clay baked or slick, mud of varying depth, hairpins. 20 stream crossings: Mānoa and Nu'uanu streams each crossed twice per lap, close to their aid stations (CONFIRMED). Two road crossings per lap. The Pauoa Flats boardwalk is off-limits (slippery; marked blue).
- Aid stations (3, spaced 5.2–7.4 miles; drop bags allowed at all three):
  1. Makiki — start/finish, Hawai'i Nature Center, mile 0/20; pacers may start; crew OK
  2. Mānoa — Paradise Park, mile ~7.2; pacers may start; crew OK
  3. Nu'uanu — Judd Trail trailhead, mile ~12.5; NO crew, NO pacer starts (limited parking; violations can DQ the runner)
- Cutoffs (CONFIRMED, 2024 Book): 36 h overall; intermediate cutoffs exist only on lap 5 — Makiki mile 80 at 29:00 (Sun 11:00), Mānoa mile 87 at 31:30 (13:30), Nu'uanu mile 92.5 at 33:30 (15:30), finish mile 100 at 36:00 (18:00). Stations close 15 min after their cutoff. (The book's lap-5 mileposts 87/92.5 imply legs of ~7.0/5.5/7.5; the stated 5.2–7.4 spacing and race reports support ~7.2/12.5 — the game uses 7.2/12.5.)
- Sun/moon (Jan 13 2024): sunrise 07:11, sunset 18:03; dawn 06:47, dusk 18:32; moon 9.3% — effectively no moon under canopy (CONFIRMED).
- Motto: "We wouldn't want it to be easy." (CONFIRMED — hurt100.com.)
- Finish tradition (CONFIRMED): finishers ring the bell and kiss the sign that reads "We wouldn't want it to be easy," then get the buckle.
- Landmarks per lap (official map names): Hogsback (Maunalaha Trail), Makiki Valley "Crossover", "Pipes", Mānoa Cliff, Pauoa Flats (the root web), bamboo forest, Aihualama switchbacks, Mānoa Falls, Bien's Bench, Judd Trail / Jackass Ginger pool, Nahuina, Kalāwahine.
- Real hazards: wild pigs — roam the trails, most active sunrise/sunset, temperamental with dangerous tusks (CONFIRMED, Book wildlife section); slick moss rock at night, root webs, mud slides; mosquitoes and leptospirosis in the streams (flavour only).

### Level design
- Loop structure: the same 20-mile loop repeats 5×; palette shifts with time of day so lap 3–4 are night. Lap counter in HUD ("Lap 3 of 5").
- Weather: passing rain squalls; mist at elevation; mud deepens after rain.
- Obstacles: root web (jump), fallen banyan limb (duck), slick rock slab (slide/duck or stumble), stream crossing (timed jump on rocks or wade = hydration bonus, energy cost) at the four real crossing points per lap, mud pit (slow unless jumped).
- Animals: wild boar (charges across trail at dawn/dusk), mongoose (darts under feet — small stumble), giant centipede (on root at night, bite = hit), feral chicken (harmless flavour), rat at night (harmless).
- Pickups: local aid fare — spam musubi, bacon, watermelon, flat Coke, salt tabs, gels (poke and saimin stay at the aid-station tables, not as trail pickups).
- Pacer (CONFIRMED): allowed after mile 60 (or from 17:00 Saturday); may start only at Mānoa or Makiki, never Nu'uanu; one at a time. Game: pacerFromMile 60, pacerStart false at Nu'uanu.
- Buckles (CONFIRMED): HURT awards one buckle to every 100-mile finisher — no official tiers (selected finishers also get a custom belt). Gold/silver/bronze in the game are game-only tiers: sub-24 gold, sub-30 silver, finisher bronze.
- Palette: deep greens, wet black-brown earth, grey-blue mist by day; night is near-black green with headlamp amber.

---

## 2. Hardrock 100 — Silverton, CO

- Distance: 100.5 miles loop, direction alternates yearly. Mid-July.
- Elevation: ~33,000 ft gain; average elevation ~11,000 ft; high point Handies Peak 14,048 ft. VERIFY current figures.
- Towns: Silverton (start/finish), Telluride, Ouray, Lake City, Sherman.
- Finish tradition: kiss the Hardrock (painted boulder).
- Cutoff: 48 hours.
- Hazards: afternoon lightning above treeline (must duck at flash), snowfields, scree, creek crossings, marmots, mountain goats, altitude energy drain.
- Aid stations: 13 (VERIFY names and miles: KT, Chapman, Telluride, Kroger's Canteen at Virginius Pass 13,100 ft, Governor Basin, Ouray, Engineer, Grouse Gulch, Burrows, Sherman, Pole Creek, Maggie Gulch, Cunningham).
- Palette: grey rock, snow white, wildflower purples/yellows, huge blue sky, storm black.

## 3. Bradshaw Brute 100 — Black Canyon City → Prescott, AZ

Quick check: DONE.

- The first ~100 miles of the Cocodona 250 course, Black Canyon City to Watson Lake, Prescott. Early May. ~100.8 miles point-to-point.
- Gain ~20,400 ft, loss ~17,200 ft; min 1,858 ft, max 7,673 ft.
- No pacers, no crew. Technical and remote. Hot days, cold nights. 9 aid stations. ~38 h limit.
- Trails: Black Canyon National Recreation Trail, Bradshaw Mountains, Crown King main street, Prescott Circle Trail, Whiskey Row.
- Hazards: rattlesnake, heat exposure, cold night on the Bradshaws, cactus, ankle rocks.
- Palette: low Sonoran tan and sage, saguaro green; climbs into ponderosa dark green and granite grey; sunset orange.

## 4. Zane Grey 50 — Payson / Mogollon Rim, AZ

- ~50 miles on the Highline Trail beneath the Mogollon Rim. Late April. Reputed one of the hardest 50s in the US.
- Gain ~10,000–12,000 ft VERIFY. Point-to-point Pine → 260 Trailhead VERIFY.
- Surface: relentless rocks, burned-forest sections (Dude Fire), manzanita, creek crossings.
- Hazards: ankle-roll rocks, cactus, elk crossing, heat on exposed burn.
- Palette: red-orange rock, black burned snags, silver-green manzanita, rim wall backdrop.

## 5. Across the Years 200 — Glendale, AZ

- Fixed-time multi-day event at Camelback Ranch over New Year's; 1-mile loop (alternates direction periodically) VERIFY loop length/timing.
- Jon's distance: 200 miles.
- Flat. Hazards are internal: sleep deprivation, boredom, cold desert nights, blister accumulation.
- Unique mechanics: sleep meter (tent stop restores), direction reversal, midnight New Year fireworks event, loop counter instead of mile markers, aid tent every loop.
- Palette: ballpark floodlights, tent city, Arizona winter sky, fireworks.

## 6. Wyoming Range 100 — Big Piney, WY

- Remote point-to-point (or out-and-back VERIFY) on the Wyoming Range National Recreation Trail. Mid-August.
- Gain ~18,000 ft VERIFY; elevation 7,500–10,500 ft VERIFY.
- Hazards: grizzly (rare, huge, run-away event), moose on trail, exposure, hail, river fords, remoteness (long gaps between aid).
- Palette: sage grey-green, aspen, limestone ridges, high sky, storm.

## 7. Coyote Two Moon 100 — Ojai, CA

Quick check: DONE.

- Revived race in Los Padres National Forest above Ojai; Rose Valley Road start area. Full-moon weekend, early May. 100M/100K start Friday 5:00 PM.
- ~26,000–27,000 ft gain; high point ~6,200 ft; ~42 h limit. Ridge with fire road on the spine, single-track drops off it and back up.
- Culture: deliberately unserious — propeller hats, pickle-eating and errands for time credits, limoncello at mile 70. Game: pickle pickup = time bonus; propeller hat cosmetic.
- Hazards: coyotes, poison oak (touch = itch debuff slows), tarantulas at night, clay grease when wet, snow/fog on ridge.
- Palette: chaparral olive, sandstone, Pacific haze, full moon white-blue.

## 8. Saddles 100 — Prescott, AZ

Quick check: DONE.

- 100-mile loop around Prescott (direction alternates yearly), first weekend of October, run under the full moon. ~12,000 ft gain.
- 9 aid stations roughly every 10 miles; cutoffs at 3 mph; 34 h limit. Pacers from the Granite Dells (halfway).
- Terrain: Prescott Circle Trail, Granite Dells, Willow Lake, ponderosa and juniper, high desert.
- Weather history: cold, wet and windy editions.
- Hazards: javelina herd, wind gusts, cold rain, granite slab.
- Palette: pink-tan granite, dark pine, big full moon, lake reflections.

## 9. Stagecoach Line 100 — Flagstaff → Grand Canyon, AZ

- Point-to-point on the Arizona Trail from Flagstaff area to Tusayan/Grand Canyon. Late September. VERIFY exact termini and gain (~9,000 ft?).
- Terrain: ponderosa, aspen groves (gold in late Sept), Babbitt Ranch open range, Kaibab plateau.
- Hazards: elk, cattle guards (jump), free-range cattle, afternoon thunderstorm, cinder footing.
- Palette: ponderosa green, aspen gold, red cinder, canyon-rim finish glow.

## 10. Folsom 100 — Folsom Lake, CA

- Loops around Folsom Lake / Granite Bay trails VERIFY structure and date.
- Terrain: oak woodland, golden grass, lakeshore single-track, rolling foothills.
- Hazards: rattlesnake, ticks, heat, poison oak.
- Palette: California gold grass, oak green, lake blue, dry-heat haze.

## 11. Bootleg 100 — Boulder City, NV

- Loop course in Bootleg Canyon, Boulder City, overlooking Lake Mead VERIFY loop length and date.
- Terrain: Mojave rock and sand, mountain-bike trails, exposed.
- Hazards: scorpion, rattlesnake, desert bighorn sheep, heat, wind.
- Palette: red-brown rock, Lake Mead turquoise, pale sky, harsh shadows.

---

## Research checklist per race (before its level ships)

1. Official course guide / runner manual: distance, gain, start time, cutoffs, aid station names and miles, pacer/crew rules.
2. Elevation profile → 40–100 point array (mile, feet).
3. 3–5 landmark names runners actually use.
4. Animals and weather actually reported for that course.
5. Anything Jon said about it (the hard part, a story) → becomes an intro-card fact or a level event.
6. Replace every VERIFY; record source URL and date at the top of the section.
