# Study · Mega Man 2 (NES) · the object pool, shared gravity/move routine, jump launch and energy refill

Learned from Junior-Jones' static recompilation of Mega Man 2
(github.com/Junior-Jones/Mega-Man-2-NES-Static-Recomp, commit `91d682c8b83ac39508058494900c7823fcdbe091`), with
a look at the sibling Mega Man 6 recomp (github.com/Junior-Jones/Mega-Man-6-NES-Static-Recomp, commit
`3c094a707c0288b92dfb0e1f2138d3535358f8bc`). No code taken; the mechanism and its constants are the subject.

**What these repos are.** Both are opcode-for-opcode 6502→C translations: one `switch` case per instruction
(`generated/core-v01/mm2_direct_core_bank_0b.c` … `_0f.c`, about 20 000 cases), each case annotated only with
the mnemonic and operand bytes. There are no labels, no symbol names, no comments on game logic, and data tables
(enemy spawn lists, AI tables, sprite data) are not in the translation at all — only executable instructions.
MM6 is the same shape. So the enemy pattern vocabulary (sine flyers, hoppers, leading turrets, shield cycles) and
the boss state machines **cannot be read out of these repos**; what follows is what the instruction stream does
give up when read as a listing, cross-checked against the hardware constants (NES 60 fps, 256×240 screen,
8.8 fixed-point positions). Citations are bank:address of the case label in the generated file for that bank.

## Why this one
Two things here are worth stealing for any 2D kids' game: (1) a fixed-size **object pool** where every object —
player, bullet, enemy, pickup — is the same handful of fields and shares *one* movement routine, and (2) the
feel-numbers of the stiffest-feeling classic platformer: a jump of ~4.87 px/frame against gravity of ~0.25 px/frame².
Mega Man's jump is the counterweight to the Sonic note: no run-up, no variable height by default, a fast rise and
a fast fall, which is what makes platforms at exactly 3 tiles high "feel" like Mega Man.

## State it keeps — the pool (bank 0f, routine at `0f:EEBA`)
32 slots, one byte per field per slot, fields laid out as parallel arrays with stride 0x20 ("struct of arrays").
Slot 0 is the player, slot 1 the boss (its HP is written at `0e:B8BB`), slots 2–15 enemies, 16–31 shots and
effects (the despawn path treats ≥ 16 as freeable, `0f:EF8F`). Fields recovered from how the shared routine uses
them:

| array | meaning |
|---|---|
| anim id | which animation plays; set from a per-state table (`0f:D3A8`) |
| flags | bit 6 = facing left (mirrors x movement), bit 2 = affected by gravity, bits 0–1 = collide with terrain |
| x: screen, pixel, sub-pixel | three bytes, 8.8 pixel+fraction plus a screen index for scrolling stages |
| y: pixel, sub-pixel | 8.8 |
| vx: pixel, sub-pixel | 8.8, always positive; direction comes from the facing bit |
| vy: pixel, sub-pixel | 8.8, **positive is up**; the move routine subtracts it from y |
| two animation counters | frame timer and frame index |
| type / state | per-object behaviour selector |
| hp | 28 max for the player (cap tested at `0e:82F7`, `0e:8304`, `0d:929B`) |

Separately the player keeps a `state` byte (walk/idle, climb, jump/air …; the jump-start path at `0e:858E`
sets it to 6) and the stage keeps two zero-page pairs set at level start (`0e:811B`–`0e:8121` and
`0e:815A`–`0e:8160`): the **gravity** and the **jump launch velocity**. Both can be reloaded from a per-stage
table (`0e:8B12`–`0e:8B24`), which is how a water or low-gravity section changes the feel without touching the
mover. The table's contents are data and not in the recomp.

## Update order — the shared move routine (`0f:EEBA` → `0f:EF8B`)
Called once per object per frame by whatever behaviour owns it, with X = slot:
1. If the terrain-collision bits are set, run the horizontal and vertical terrain probes first (`0f:E55A`,
   `0f:E5EC`); if the vertical probe reports contact the object is switched to a fixed anim id, its flags are
   reset to a bare value and its counters zeroed (`0f:EEDA`–`0f:EEEC`) — the "shot hits a wall" branch.
2. **Vertical:** `y −= vy` on the 8.8 pair (`0f:EEEF`–`0f:EEFF`). If the pixel part is ≥ 240 the object has left
   the bottom/top of the screen → despawn path.
3. **Gravity:** if the gravity bit is set, `vy −= g` on the 8.8 pair (`0f:EF10`–`0f:EF1E`). The code clears the
   carry before the 8-bit subtract-with-borrow, which on the 6502 subtracts one extra 1/256: effective
   `g = 0x0040 + 1/256 ≈ 0.2539 px/frame²`.
4. **Horizontal:** if facing left `x −= vx` else `x += vx`, carrying into the screen byte (`0f:EF28`–`0f:EF72`).
5. **Horizontal cull:** compare the object's pixel x with the camera's; if it is within 8 px of the screen edge
   it is travelling toward (or on another screen), return "gone" (`0f:EF43`–`0f:EF8B`).
6. **Despawn** (`0f:EF8C`): shot/effect slots are freed. Enemy slots are marked "off-screen, may respawn" and
   their **current HP is saved into a per-spawn-point array** (`0f:EF9E`–`0f:EFAD`) — an enemy that scrolls off
   comes back as hurt as it left.

The player uses the same arrays (slot 0) with its own state code around them: on jump press, copy the stage's
launch velocity into vy and switch to the air state (`0e:858E`–`0e:85A5`).

## Constants
| | per frame (8.8 hex) | per second (× 60, × 60²) |
|---|---|---|
| jump launch | 4.DF = 4.871 px/f | 292 px/s |
| gravity | 0.40 (+1/256) = 0.2539 px/f² | 914 px/s² |
| rise time to apex | 19.2 f | 0.32 s |
| jump height (v²/2g) | 46.7 px | ≈ 3 tiles of 16 |
| enemy "hopper" gravity seen in bank 0e | 0.40 = 0.25 px/f² (`0e:A158`, `0e:BAF9`) | 900 px/s² |
| screen cull margin | 8 px (x), 240 px (y) | — |
| player / boss hp | 28 | — |
| energy pellet refill | +1 hp every 8 f, small = 2, large = 10 (`0e:82EC`–`0e:8320`) | 7.5 hp/s |
| energy tank refill | +1 hp every 4 f until full (`0d:9298`–`0d:92B3`) | 15 hp/s |
| boss meter intro | 64-frame hold, then +1 per tick with a sound each (`0e:B907`–`0e:B94E`) | — |

Compared with the Sonic note: Sonic launches at 6.5 px/f against 0.21875 — higher and floatier. Mega Man's jump
is 75% the launch and 16% more gravity, with no jump cut: a committed, short-arc jump. For a kit this is a preset,
not a different mover: `jump ≈ 290, gravity ≈ 910, airAcc = acc, cut = jump` (no shortening).

## Design shapes seen (structure, not numbers)
- **One mover for everything.** Player, shots, enemies, pickups all go through `0f:EEBA`; behaviours only write
  vx/vy/flags. The flags make gravity and terrain collision opt-in per object.
- **Spawn-from-table.** A child object (a shot, a fragment) is created by copying anim id, facing, a position
  offset and an 8.8 velocity pair from parallel tables indexed by the spawn kind (`0f:D3E0`–`0f:D44B`); its hp,
  counters and state start at zero. The tables are what give the eight "shot patterns"; the code is one routine.
- **Refill as a timed drip, not a jump**: health pickups queue units and release one every N frames with a sound
  each, so the bar visibly climbs. Pickups are 2 or 10 units; tanks drip twice as fast.
- **Remember the wound.** Off-screen enemies keep HP; respawn restores it.

## Things learned that are not built yet
- The enemy pattern vocabulary and boss phase machines live in per-type behaviour code dispatched by the
  type byte through jump tables whose targets are in data; not recoverable here. A disassembly with labels
  (e.g. a community `mm2.asm`) would be the right prey for `kit.patterns`.
- Terrain probes (`0f:E55A`, `0f:E5EC`) read a tile attribute map; we have rectangles.
- Horizontal walk speed and ladder climb speed are set by the state code, not by the shared mover; not isolated.

## Edge cases to keep
- Positive-up vy with "subtract from y" avoids negative fixed-point in 8 bits; on a canvas, keep screen-down
  positive and negate the launch instead. Don't carry the sign convention over.
- Gravity applies *after* the move each frame (position first, then velocity) — a semi-implicit order that makes
  the first frame of a jump rise by the full launch speed. The Sonic note integrates velocity first. Either is
  fine; pick one and keep it for every object.
- The 1/256 gravity bias is a hardware accident but it is in every jump players remember; if someone asks for
  "exactly Mega Man" use 0.2539, not 0.25.
- Cull in the direction of travel only: an object just inside the edge moving inward is kept, moving outward is
  dropped. Prevents pop-in flicker at the edge.
- Slot ranges are policy: freeing a shot slot is instant, freeing an enemy slot writes its HP home first.
