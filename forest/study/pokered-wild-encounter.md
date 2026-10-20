# Study · Pokémon Red/Blue (Game Boy) · the wild-encounter roll

Learned from pret's `pokered` disassembly, commit `af519899719f0754965776faac0e836a3b906e6d`. The step hook is in
`home/overworld.asm` (~lines 10–16 and 290–375), the roll in `engine/battle/wild_encounters.asm`, the slot table in
`data/wild/probabilities.asm`, and each area's rate and ten slots in `data/wild/maps/*.asm`. The repel step counts
are in `engine/items/item_effects.asm` (~1533, 1623, 1627). No code taken; the mechanism and its constants are the
subject.

## Why this one
Random encounters are a *pacing* device: how often the walk is interrupted, how rare the rare thing is, and the
one rule that keeps it from being annoying (a short grace period after each fight). Any "explore the grass" game a
kid asks for needs these three numbers and nothing else.

## State it keeps
Per area: `rate` (0–255; the chance *per step* out of 256) and a table of exactly **10 slots**, each
`(level, species)`. Two tables per area in the original, one for walking terrain and one for water, each with its
own rate. Globally: a `noEncounterSteps` countdown (3 after a battle) and an optional `repelSteps` countdown.

## Per step, in order
1. Decrement the step counter. If `noEncounterSteps > 0`, decrement it; while it is nonzero nothing can spawn.
   It is set to **3** when a battle ends, so the player always gets three free steps.
2. Refuse if the player is mid-script, exiting a door, jumping a ledge, standing on a warp, or just outside the
   map edge. Refuse if the tile under the player's feet is not an encounter tile (the original looks at *one*
   specific tile of the 2×2 block the player stands in, and the "left shore" quirk — grass encounters on a
   water-edge block — comes from which tile it checks; indoor maps with a table set treat every tile as grass).
3. Pick the table and its `rate` by that tile (grass vs water).
4. **Encounter roll:** draw a byte; encounter if `rand < rate`. Area rates used in the original: 0 (none), 8, 10
   (18 areas), 15 (19 areas), 20, 25 (9 areas, the early routes), 30 (4 caves). Rate 25 ≈ 9.8% per step; rate
   10 ≈ 3.9%; rate 30 ≈ 11.7%.
5. **Slot roll:** draw a second byte and walk a cumulative table:

   | slot | weight /256 | % | cumulative ≤ |
   |---|---|---|---|
   | 0 | 51 | 19.9 | 50 |
   | 1 | 51 | 19.9 | 101 |
   | 2 | 39 | 15.2 | 140 |
   | 3 | 25 | 9.8 | 165 |
   | 4 | 25 | 9.8 | 190 |
   | 5 | 25 | 9.8 | 215 |
   | 6 | 13 | 5.1 | 228 |
   | 7 | 13 | 5.1 | 241 |
   | 8 | 11 | 4.3 | 252 |
   | 9 | 3 | 1.2 | 255 |

   The first slot whose cumulative value is ≥ the byte wins. The same species can appear in several slots — that
   is how an area tunes a creature's total odds without changing this table.
6. **Repel:** if `repelSteps > 0`, cancel the encounter when the chosen creature's level is *below* the player's
   lead creature's level. Repel durations: 100 / 200 / 250 steps for the three tiers; the step that reaches 0
   prints the wore-off message.

Important subtlety: both bytes are the two halves of the RNG's current state (one is the "add" register, one the
"sub" register), drawn at the same instant, not two sequential calls. A kit should just draw twice.

## Design shape
- Ten fixed-weight slots and *one* rate per area is a very small data footprint and already gives three tiers of
  rarity (20%, 10–15%, 1–5%) plus the 1.2% "wow" slot.
- A per-area rate of 10–30 out of 256 per tile step is the whole pacing knob. On a 390-px-wide canvas with
  32-px tiles, rate 25 means an encounter roughly every 10 steps — about every 3–4 seconds of walking. Too hot for
  a small screen; start at 10–15 and give the line a `density` word (sparse / normal / thick).
- The three-step grace is the smallest thing that stops "fight, one step, fight" from feeling broken. Keep it.

## Edge cases to keep
- Step counting is suspended while the game moves the player (cutscene, forced walk). A kit encounter counter
  should only tick on *player-driven* tile transitions.
- Slot level is per-slot, not per-species, so the same creature can be level 2 in slot 3 and level 5 in slot 9.
- An encounter is rolled when the step *completes*, after any warp check fails — never on the first frame of
  movement, never on a tile the player is leaving.
