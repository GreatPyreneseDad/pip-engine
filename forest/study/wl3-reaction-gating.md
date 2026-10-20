# Study · Wario Land 3 (Game Boy Color) · the no-death reaction system, treasure-gated level variants, and day/night

Learned from ElectroDeoxys' `warioland3` disassembly, commit `560fce6faf50df4a48c0448f00105b6075f8f231`.
Files: `src/engine/level/object_interactions.asm` (contact resolution, every reaction's entry), `src/constants/wario_constants.asm`
(state list, durations, touch states), `src/engine/level/wario_states_1.asm` (invincibility ticking, stung),
`src/engine/level/wario_states_3.asm` (on-fire / hot ticking), `src/engine/overworld/level_select.asm` and
`src/data/levels/treasure_requirements.asm` (variant choice), `src/engine/overworld/day_night.asm`,
`src/engine/overworld/init.asm`, `src/engine/level/objects/owl.asm` (an object reading the clock). No code taken. ~60 fps.

## Why this one
There is **no health and no death**. A hit either shoves you (a "sting") or **turns you into something** — on fire,
flattened, puffed up, a bouncing ball, a snowball — and the something is a *tool* the level was built around: fire
burns the wooden block you could not pass; flat slips through the crack; puffy floats up the shaft. For a kids' game
that is the opposite of punishment: getting hit is how you solve the room. The world is gated by **treasures**, each
of which rewrites a level (five variants) rather than unlocking a door, and every level has a **day and a night**
version that is just a bit on the clock.

## State
Player: `state` (one of ~180 named states: idle, walking, airborne, stung, on-fire, hot, flat-idle, fat-eating,
puffy-rising, bouncy-ceiling, ...), `stateCounter, stateCycles`, `transformation` (id plus two bits: *persistent* —
cannot be overwritten by another hit — and *super-smash*), `transformationDuration` (frames), `touchState` and
`stingTouchState` (what touching an enemy does to the enemy *while* in this form: none / vulnerable / bump / attack
/ vanish / pass-through), `invincibleCounter`, `attackCounter` (dash charge), `grabState`, a collision box that
every state sets explicitly (walking: 18 wide, 27 tall above the feet; crouching: 15 tall).
Objects: `interactionType` (one of ~80 enumerated reaction kinds), hitbox, facing, `action` (what it is doing now).

## Contact resolution, each frame
```
 for each on-screen object with no action in progress
   overlap? ─no─► next
     │ yes: compute which sides overlap least → interactionSide ∈ {left, right, up, down} (one axis wins)
     ▼
   jump through a table on the object's interactionType:
     plain enemy ─► up (I am on top) → stomp it (it is stunned, I bounce)
                    side while dashing/rolling → attack it
                    side with the grab glove → pick it up
                    otherwise → sting
     sting-on-one-side enemy ─► stung only if I touched its spiky side (front / back / top / bottom / all)
     fire / food / bouncy / electric / ... ─► if not invincible and not already in a persistent form:
                                              set transformation, duration, touchStates; enter its start state
     coin / key / treasure ─► collect
     solid ─► push out
```
The side test takes the smaller horizontal and vertical overlaps, keeps the smaller of the two, and drops the other
axis entirely, so corner hits resolve as one direction. The object's own facing decides which side is "front".

## The sting (the only "damage")
`invincibleCounter = 1`, state = stung, grab/attack/roll cleared, collision box reset to standing, a knock-back
impulse from the fixed jump-velocity table (velocity index 6, falling toward the side away from the enemy), and the
enemy is told it hit something (`action = bumped`). No coins lost, nothing lost. After the stung state ends the
counter runs `$10 → $16` at one step per 4 frames and `$16 → $28` at one per 2 frames (flicker fast), about **60
frames of mercy**, then clears. While `invincibleCounter ≠ 0` no object can sting or transform you.

## A reaction, end to end (the fire one)
```
 touch fire ──► transformation = HOT (persistent, super-smash), duration = 600 f, touch = BUMP
                 state ON_FIRE: runs uncontrollably (input ignored), bumps enemies away
                 duration ticks down; at 300 left ──► state HOT: can steer; touch = VANISH (enemies I touch vanish),
                 burns wooden blocks on contact; palette warms at 224 / 164 / 60 frames left
                 at 1 ──► BURNT (a short stagger) ──► normal. Water at any point ──► normal at once.
```
Durations: hot 600 f (10 s, half of it uncontrollable), fat 420 f (7 s), bouncy 900 f (15 s). Persistent forms (hot,
flat, ball-of-string, zombie, vampire, bubble, skating, snowman, split, blind, launched, magic, ball) cannot be
overwritten by another hit; non-persistent ones (fat, electric, invisible, puffy, bouncy, crazy, owl, rail, fan) can
chain. Some forms end on a *condition* instead of a timer: flat ends by hitting water or being lifted; puffy ends at
a ceiling; snowman by rolling into something; zombie by light. Each form has its own 4–10 states and its own
collision box, so "what can I fit through" is answered by the box, not by a special case.

## Treasure-gated variants
Each level exists as **8 maps**: variants 1–4 × {day, night}. Variant is chosen on entry from a per-level table of
treasure pairs: `variant 4 if both treasures in row 1 are owned, else 3 if row 2, else 2 if row 3, else 1`; then
`+4` if it is night. Collecting a treasure plays an overworld event that visibly changes a level (a bridge, a drained
pool, a new door) and that is the *only* progression — there are no stars, no counts. Four treasures per level
(grey, red, green, blue chests, each needing its key found in that level), 100 treasures total, and a "next treasure"
hint pointer that walks a fixed list so the kid is always told where the newest thing is.

## Day / night
One bit. It **flips every time you return to the map** from a level; a late-game treasure gives a spell that flips it
on demand; one quarter of the map is locked to night until a specific treasure. Levels read the bit at load for
their variant, and *objects* read it live: an owl sleeps by day and flies at night, a pillar platform rises or
sinks, music swaps. The transition is 32 palette steps. That is the whole system; it is cheap because night is a
data switch, not a lighting model.

## Edge cases to keep
- A hit during a persistent form is a plain sting (shove), never a second transformation; during a non-persistent
  one it replaces the form. Decide this from the two bits, not from a list.
- Every form must set its own collision box on entry and the normal box on exit, or the player gets stuck in the
  gap the form let them into.
- The uncontrollable half of a form is what makes it feel like a *hit*; the controllable half is what makes it a
  tool. Keep both halves on one timer (`durationLeft` crossing a threshold), not two states.
- Transform entry zeroes the dash charge, grab, roll and jump state in one go; forgetting one leaves a ghost input.
- The variant table is "best match first" (check variant 4 before 3). Treasures are never un-collected, so the
  variants only ever go up.
