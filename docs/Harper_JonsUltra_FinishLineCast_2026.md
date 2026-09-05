# Jon's Ultra — Finish-Line Cast

Status: v0.1 (Sep 5 2026). Requested by Michael for the finish sequence (Design Bible §10 screen 6 and Architecture §9 step 4). Not part of steps 2–3. Read when building the finish screen. Reference photos of Katie and Emma live in `02-jon-reference/`; they are for likeness checks only, never traced or embedded.

## 1. The moment

Jon crosses the finish line into a cheering crowd. Two people in that crowd must be findable at a glance from the running lane: his wife Katie and his daughter Emma. Everyone else is generic spectators. Somewhere in the scene, easy to miss, is his pet desert tortoise.

## 2. Katie (wife)

- Long, straight, dark brown hair past the shoulders with a full straight fringe (bangs) to the eyebrows. The fringe is the silhouette cue.
- Black rectangular / cat-eye glasses — the single strongest identifier. Always drawn, always dark frames.
- Fair skin. Dark clothing by default (charcoal or black tee), blue jeans, black boots.
- Pose: front row, arms up, cowbell in one hand. She is closest to the finish tape.
- Do not draw brand marks or team logos from the photos.

## 3. Emma (teenage daughter)

- Long dark brown hair, soft waves, no fringe, no glasses. Often worn down; hair frames the face.
- Light top (pale blue or white), denim skirt or black dress, white sneakers.
- Pose: front row beside Katie, holding a hand-lettered sign that reads GO JON (or the race bib number). The sign is her identifier at distance.
- Draw her as a teen: a little shorter than Katie, same dark hair family so the two read as a pair.
- Keep it wholesome and cartoon-simple, consistent with the rest of the cast.

## 4. How Jon spots them

1. They stand together, front row, on the near side of the tape, slightly apart from the generic crowd.
2. Emma's sign and Katie's glasses + fringe are the two cues; nobody else in the crowd has either.
3. When Jon is within ~2 s of the line, the camera eases toward them and they get a small bounce/wave animation the rest of the crowd doesn't.
4. Optional: a one-line callout on the finish card — "Katie and Emma were at the line."

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

- 12–20 spectators, procedurally varied (height, skin tone, shirt colour, hat/no hat), arms raised on a staggered rhythm, a few cowbells and phones.
- Race-specific flavour: lei and slippers at HURT, puffy jackets at Hardrock, cowboy hats at Wyoming Range, Halloween costumes at Javelina if it ever joins the roster.
- Same colour discipline as Jon: ≤3 tones per spectator, no text except Emma's sign.

## 7. Implementation notes

- Cast lives in a `cast` module: `drawKatie(ctx, palette, t, view)`, `drawEmma(...)`, `drawTortoise(...)`, `drawSpectator(seed, ...)`.
- Katie and Emma are fixed designs; spectators are seeded.
- Tortoise placement per race is a field in the race config: `tortoise: { where: "aidTable" | "trail" | "tote" | "rock" | "lap" }`.
