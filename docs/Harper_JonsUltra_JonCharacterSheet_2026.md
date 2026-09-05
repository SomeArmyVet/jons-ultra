# Jon — Character Sheet

Source: four race photos supplied by Michael, 2026-09-05 (Angeles Crest tunnel, coastal ridge with poles, Zane Grey stream crossing, aid-station close-up). Photos live in `02-jon-reference/`. This sheet is what the game draws from; the photos are for checking likeness, never for tracing or embedding.

## 1. Silhouette (what reads at 60 px tall)

1. Lean, wiry, medium height. Runner's build — narrow shoulders, long legs, no bulk.
2. Very long dark-brown hair, wavy, past the shoulders to mid-back. In motion it streams straight back in 3–5 ropey strands and lifts off the shoulders.
3. Full, long, bushy dark-brown beard reaching the upper chest. Slightly frizzy edges. It moves as one mass with a half-beat lag behind the head.
4. Trucker cap always. Hair pours out from under it on both sides and the back.
5. Hydration vest with two soft flasks on the chest — the vest is the brightest thing on him.
6. Trekking poles in most races; carried, not planted, on runnable ground.

Silhouette test: cap + streaming hair + big beard + bright vest + poles. If those five read, it's Jon.

## 2. Colours (game palette, hex)

| Element | Colour | Hex |
|---|---|---|
| Hair | Dark warm brown | #3B2416 |
| Hair highlight (sun) | Chestnut | #6B4224 |
| Beard | Same as hair, edges slightly darker | #33200F |
| Skin | Tanned | #C58E62 |
| Skin shadow | | #9E6B45 |
| Cap front panel | Off-white | #F2F0E6 |
| Cap mesh + bill | Kelly green | #1F8A4C |
| Sunglasses | Blue mirrored shield | #2E7BD6 (lens) with #7FD1FF highlight |
| Shirt | White tee | #F4F4F2 with a small muted print block #E36A2B / #2B4C9B on the chest |
| Vest | Chartreuse / safety yellow-green | #D8E24A |
| Vest straps + flask caps | Pale blue-grey | #A9C7D6 |
| Shorts (default) | Hot pink / magenta | #E0338F |
| Shorts (alt A) | Rust red | #B8432B |
| Shorts (alt B) | Heather grey | #9A9A9A |
| Race bib | Yellow, black digits | #F5D021 / #111111 |
| Trekking poles | Bright blue shaft, black grips | #2F7BEA / #1A1A1A |
| Socks | Black ankle | #1A1A1A |
| Shoes | Grey-olive trail shoe, orange accent | #6E6F64 / #E8602C |
| Watch | Black GPS watch, left wrist | #1A1A1A |
| Tattoos | Ink black, low-opacity | #1E1E1E at 70% over skin |
| Arm sleeves (cold races) | White | #F4F4F2 |

Shorts default to hot pink. It's the most Jon thing in the photos and it pops against every biome. Alt colours are cosmetic unlocks or per-race variety.

## 3. Head

1. Cap: flat-ish bill, slight curve; white front panel, green mesh back and green bill. A tiny smiley dot on the front panel is fine; no wording (real cap slogan is a brand's — leave it off).
2. Sunglasses: wide single-lens blue mirrored shield, worn in daylight; pushed up onto the cap bill at dusk/night (small detail, sells the day/night change).
3. Face: mostly beard. Tanned nose and cheekbones visible, big grin when things go well, gritted teeth on hard climbs.
4. Hair: 3–5 thick wavy strands each side, one big mass behind. Strand tips curl. In wind or descent they fly horizontal.

## 4. Body and kit

1. Shirt: plain white tee, short sleeves, slightly baggy, smudged with dirt as the race goes on (add grime after mile 30).
2. Vest: chartreuse, sits high on the chest, two soft flasks in front pockets with pale caps, thin elastic cross-lacing on the front. Slight bounce on stride.
3. Shorts: above-knee split shorts. Yellow race bib pinned on the left thigh — bib number is the race config's `bibNumber`, three digits.
4. Legs: hairy, tanned, lean. Black low ankle socks. Grey-olive trail shoes with an orange sole flash.
5. Poles: blue Z-poles. Held together in one hand on flats and descents; planted alternately on climbs. Stowed (folded, across the vest) on the flat loop race.
6. Left wrist: black GPS watch plus a thin band. Right wrist: a thin bracelet.
7. Cold races (Hardrock, Wyoming Range, night sections): white arm sleeves appear; grey cap variant allowed.

## 5. Tattoos (placement map)

Style: American-traditional / illustrative line work, mostly black ink with a few colour spots. At game scale, draw as dark line clusters and one or two recognisable shapes — never a smear.

| Location | What to draw |
|---|---|
| Both forearms, wrist to elbow | Full sleeves. Dense line work; a skull on the right outer forearm is the one recognisable motif. |
| Upper arms | Continue lighter, fading under the sleeve. |
| Neck | Small marks on both sides of the neck just below the beard line — mostly hidden by beard, visible in profile when the head turns. (Michael confirms neck tattoos; photos don't show them clearly — keep them suggestive.) |
| Right thigh, front | Ornate band / geometric piece just above the knee. |
| Left thigh, front | Framed illustrative piece above the knee. |
| Left shin | The signature piece: a dagger pointing down with a woman's face below it, small stars/dots around. This is the tattoo to get right — it's the most visible in a side view. |
| Right calf | Line-work piece, medium density. |
| Left calf | Lighter line work. |

Rule: from the side, at least the left-shin dagger, one forearm sleeve, and the thigh pieces must be visible. Tattoos never disappear when the palette goes dark — keep them at 70% opacity over the night skin tone.

## 6. Animation notes

1. Run cycle: efficient, low bounce, slight forward lean. Arms compact when carrying poles.
2. Uphill grind: torso leans 15°, stride shortens, poles plant alternately with the opposite foot, head down, hair hangs forward.
3. Downhill: stride lengthens, arms out, poles trail behind in one hand, hair and beard fly.
4. Jump: tuck, poles up and back. Beard compresses on landing.
5. Duck/slide: cap bill leads; hair drags along the ground line.
6. Aid station: hands on hips or one hand on a flask, big grin, head tilts back to drink.
7. Bite hit: flinch, cap knocked askew for a second, red flash.
8. Stumble: one pole plants hard, body pitches, recovers.
9. Idle on title screen: looks at watch, laughs, adjusts cap.
10. Finish: poles raised overhead in a V, hair everywhere.

## 7. Do / don't

Do
- Simulate the hair (verlet chain, see Design Bible §12, 2026-09-05). Hand-posed hair was tried four times and never read as hair.


Do
- Keep the beard and hair as separate masses that move on different timings.
- Keep the vest the brightest value on screen except the bib.
- Change small details across a race: grime, sleeves at night, glasses on the cap after dusk.

Don't
- Don't put brand names, slogans, or logos on the cap, shirt, vest or poles.
- Don't shorten the hair or beard for "readability" — reduce strand count instead.
- Don't invent a face shape; it's cap, glasses and beard.
- Don't use photos as textures.

## 8. Reference photo notes (for likeness checks)

1. Tunnel photo — best full-body reference: pink shorts, bib on left thigh, poles bunched in right hand, left-shin dagger clearly visible, blue shield glasses, hair length.
2. Ridge photo — hair in wind, poles planted, rust-red shorts, coastal light; good for the downhill/power-hike pose.
3. Stream crossing — grey shorts, white arm sleeves, glasses on cap bill, dark tee variant; good for the stumble/balance pose and the stream-crossing mechanic.
4. Aid station close-up — cap, beard shape, forearm sleeve detail (skull), watch and bands; the grin.
