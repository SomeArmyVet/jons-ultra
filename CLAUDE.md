# Switchbacks — working rules

1. Read docs/ before any work: Design Bible, Race Bible, Architecture, Jon character sheet, Finish-Line Cast. They are the source of truth; if a request conflicts, say so and ask.
2. Vanilla JS + Canvas 2D, ES modules, no frameworks, no build step, no external assets or libraries. Web Audio for sound.
3. Never fictionalise a race. VERIFY flags in the Race Bible are researched before that level ships.
4. Jon is drawn per the character sheet, procedurally only. Hair is SIMULATED (verlet chain), never hand-posed.
5. Difficulty is data (DIFFICULTY tables). No `if (arcade)` branches. Seeded RNG only.
6. Reference photos live outside the repo at /Users/moats/Library/CloudStorage/OneDrive-Personal/Alfred/42-Entertainment-Harper/42.01_Jons-Ultra/02-jon-reference/ — read them, never copy them in.
7. Work in small commits. After each: what changed, how Michael tests it (exact keys/URL), known gaps. Michael prefers lists; when a decision is needed, offer 2–4 options with a recommendation first.
8. Every design decision gets a dated line in docs/Harper_JonsUltra_DesignBible_2026.md §12. Every schema change updates docs/Harper_JonsUltra_Architecture_2026.md §4.
9. Local test server: python3 -m http.server 8080 → http://localhost:8080
