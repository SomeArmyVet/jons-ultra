# Switchbacks — Cast

Status: v0.3 (Sep 5 2026 — scope renamed from Finish-Line Cast to Cast: Katie now also crews aid stations, 6e). Previously v0.2 (Emma's sign dropped for the raised phone, floodlights, two-row crowd). Requested by Michael for the finish sequence (Design Bible §10 screen 6 and Architecture §9 step 4). Read when building the finish screen. Reference photos of Katie and Emma live in `02-jon-reference/`; they are for likeness checks only, never traced or embedded.

## 1. The moment

Jon crosses the finish line into a cheering crowd. Two people in that crowd must be findable at a glance from the running lane: his wife Katie and his daughter Emma. Everyone else is generic spectators. Somewhere in the scene, easy to miss, is his pet desert tortoise.

## 1b. Katie crews the aid stations (added 6e — she does in real life)

- At every crew-allowed station (the config's `crew` flag) Katie stands at the aid table: same design as the finish — fringe, glasses, dark tee, cowbell (held at her side).
- During Jon's refill she extends a flask toward him ("offer" pose). No bounce, no wave — she's working.
- At `crew: false` stations (Nu'uanu) she is absent and the aid card reads "No crew access."
- Emma is finish-line only.

## 2. Katie (wife)

- Long, straight, dark brown hair past the shoulders with a full straight fringe (bangs) to the eyebrows. The fringe sits as a hair band above the glasses frames, with skin visible between fringe and jawline — never covering the face.
- Black rectangular / cat-eye glasses — the single strongest identifier. Always drawn: thin dark frame outline (~2 px) with a slightly lighter lens fill, sized to the eyes. Never a bar across the face.
- Fair skin. Dark clothing by default (charcoal or black tee), blue jeans, black boots.
- Pose: front row near side, closest to the finish tape; cowbell in one hand, other arm up waving on her own timing.
- Do not draw brand marks or team logos from the photos.

## 3. Emma (teenage daughter)

- Long dark brown hair, soft waves, no fringe, no glasses. Often worn down; hair frames the face. Nothing else on the face — hair shape is her only head cue.
- Light top (pale blue or white), jeans skirt or dark dress, white sneakers.
- Pose: front row beside Katie; phone held up in one hand, recording Jon, other arm waving on her own timing. The raised phone is her identifier at distance. (The GO JON sign was dropped — Michael, 2026-09-05.)
- Draw her as a teen: a little shorter than Katie, same dark hair family so the two read as a pair.
- Keep it wholesome and cartoon-simple, consistent with the rest of the cast.

## 4. How Jon spots them

1. They stand together, front row, on the near side of the tape, a half-step apart from the generic crowd with a clear gap either side.
2. Katie's glasses + fringe + cowbell and Emma's raised phone are the cues; nobody else in the crowd has either.
3. They are the only two figures the floodlights (§8) fully hit, and the only two with their own wave timing — everyone else shares the staggered crowd rhythm.
4. When Jon is within ~2 s of the line, the camera eases toward them and they get a small bounce/wave animation the rest of the crowd doesn't.
5. Optional: a one-line callout on the finish card — "Katie and Emma were at the line."

## 5. The tortoise (easter egg)

- Desert tortoise, ~1.5 ft across: domed brown-olive shell with a pattern of raised plates, stumpy elephant legs, wrinkled neck, small head. Slow. Very slow.
- Placement ideas (pick one per race, vary it):
  - under the aid-station table at the finish, one leg mid-step
  - on the trail 30 px before the tape, so Jon has to hop him — a hop, not a hit
  - riding in Katie's tote bag, head poking out
  - on a rock in the background layer, sunning, moving one pixel per second
  - at Across the Years: doing his own lap, 1 mile per game-hour
- He is never a hazard that costs the player anything. Finding him should feel like a wink.

## 6. Generic crowd

- 18–24 spectators over the last ~500 px before the tape, on BOTH sides of the trail, in two depth rows: front row 0.9 × Jon's height and floodlit, back row 0.75 × Jon's height and darker. Sizes are always derived from Jon's live height (JON.TARGET_PX), never a fixed px, so the crowd rescales with him.
- Irregular spacing with gaps; height varies ±15%; no overlaps in the front row.
- 6+ poses cycling through the crowd: arms up, clapping, phone held up, cowbell, kid on shoulders, one sitting on a cooler. Staggered per-person rhythm.
- Faces stay featureless — hair + skin + clothes only. Katie's glasses and Emma's phone are the only face-adjacent props, consistent with Jon having no face beyond glasses and beard.
- Race-specific flavour: lei and slippers at HURT, puffy jackets at Hardrock, cowboy hats at Wyoming Range, Halloween costumes at Javelina if it ever joins the roster.
- Same colour discipline as Jon: ≤3 tones per spectator, no text anywhere in the crowd.

## 7. Implementation notes

- Cast lives in `src/cast.js`: `drawKatie(ctx, x, y, s, t, cheer)`, `drawEmma(...)`, `drawTortoise(ctx, x, y, t)`, `drawSpectator(ctx, x, y, s, seed, t, dim)`; `cheer` is the finish-zoom factor driving the §4 bounce, `dim` darkens the back row.
- Crowd placement comes from `finishCrowdLayout()` (seeded, cached): slot-based so the front row can't overlap, with Katie and Emma's clear space reserved.
- Katie and Emma are fixed designs; spectators are seeded.
- The floodlight pool is punched out of the night overlay in `render.js` (same destination-out pass as the headlamp cone), with a warm additive wash on top.
- Tortoise placement per race is a field in the race config: `tortoise: { where: "aidTable" | "trail" | "tote" | "rock" | "lap" }`.

## 8. Floodlights

- Two finish-line lights, one on each banner post, housings angled down at the trail.
- They cast a warm pool over the last ~250 px: trail, tape and the near part of the front-row crowd stay visible even at full night, fading out to the headlamp darkness beyond the pool. This is what lets Jon see faces at a night finish.
- Katie and Emma, closest to the tape, are the only two figures the pool fully hits (§4).
- By day the fixtures are visible but unlit.
