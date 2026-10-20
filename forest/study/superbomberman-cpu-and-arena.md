# Study · Super Bomberman (SNES) · the computer player: a mode machine over four ray-walks, the danger mask, target picking — and the sudden-death spiral

Learned from LIJI32's disassembly, `github.com/LIJI32/superbomberman` at commit
`6b9d0721952a3dff6eb145ba11b8e81b07782e33`. Sources: `bank4.asm` — the CPU movement handler
`handle_player_movement_1` (`$C42E0E`), the think routine `sub_C43D4D` with its direction loop `sub_C43DA2`, the
two dispatch tables `off_C441D0` (direction scorers, one per mode) and `off_C441E2` (deciders, one per mode),
the ray-walkers `sub_C44440`/`sub_C444A2`, the scorers `sub_C442B8`, `sub_C44325`, `sub_C4437A`, `sub_C443C3`,
`sub_C4426A`, `sub_C441F8`, the deciders `sub_C43F31`, `sub_C43F74`, `sub_C44008`, `sub_C44082`, `sub_C44094`,
`sub_C441C2`, `sub_C44103`, `sub_C43FC9`, `sub_C43F8C`, the modes 9–11 handler `sub_C43EC5`, target selection
`sub_C447CF`/`sub_C447F2`, bomb placement `sub_C44519`, the neighbour-offset table `byte_C44246`;
`bank5.asm` — the time-up banner `sub_C53C16`, the sudden-death placer `sub_C53CA9` with its leg table
`sudden_death_related_data` (also in `bank3.asm`). The code is 65816; nothing is transcribed.

Units. 60 Hz, cells of 16 px, 13 × 11 arena. The `potentialBlast` bit (`0x800`) is painted into every cell
within some live bomb's range every frame by the bomb code (see `superbomberman-bombs-flames.md`); the AI never
simulates a blast, it reads that bit.

## Why this one
A bomb game with no second kid on the floor needs an opponent that *looks* like it is thinking: it walks toward
you, bombs a block in its way, steps out of its own blast, and sometimes traps you. This one does all of that
with no path-finding at all — four straight-line walks per frame, a danger bit, and a dozen tiny modes. It is
the right size for a canvas game and the difficulty is three thresholds on one byte.

## State the CPU keeps (per player object)
`mode` (`z:0x26`, 0..11), `facing` (`z:0x20`, one of 4 direction bits `1/2/4/8`), `target` (another player's
object; re-chosen on a 256-frame countdown or when the target dies), `targetCell` (`z:0x53`, the target's cell
index, refreshed every frame), `skill` (`z:0x3D`, the menu's COM level in battle / a per-world value in story;
thresholds at 2, 3 and 4), `safeDirs` (`z:0x1B`, the set of directions whose ray found a cell outside the blast
mask this frame), `turnParity` (`z:0x25`, for tie-breaking and the "which way after the bomb" table), a wait
timer (`z:0x22`), the "bombs I have out" count (`z:0x24`), and the "a kickable bomb is in sight" counter.

## Each frame (`sub_C43D4D` → `sub_C43DA2`)
1. If `mode ≥ 9`, run the small turn-around/wait handler (below) and skip the rest.
2. Housekeeping: if standing on a special tile, count down and drop to mode 2 (flee); a per-mode wait counter.
3. **Refresh the target** (`sub_C447CF`): every 256 frames, or when the current target is dead, pick a random
   *other* player, alive, and — if any human is in the match — not a CPU. So computers gang up on people. The
   target's cell index becomes `targetCell`.
4. **Evaluate four directions**: starting from `facing`, rotate through all four either clockwise or
   anticlockwise (one random bit per frame) and call the **mode's scorer** for each. Scorers keep a running
   best (`bestDist`, `bestDir`), lower distance wins; ties go to the alternate direction on alternate turns
   (`turnParity`) so the CPU does not oscillate.
5. Call the **mode's decider**, which may change mode, drop a bomb, or set the direction to walk. Finally
   refuse any chosen direction whose next cell is a flame.
6. The movement handler walks `facing` at the player's speed; `do_player_warp_ai` and `cpu_death` handle the
   rest.

## The ray-walk (`sub_C44440`, `sub_C444A2`)
From the CPU's cell, step cell by cell in a direction (the offsets `±2`, `±0x40` in `byte_C44246`), up to
22 cells, counting distance, until a cell has any bit of the mode's **block mask**. `sub_C444A2` also peeks
sideways at each step (the perpendicular neighbours), which is how "a soft block beside my path" and "a safe
side-cell" are found without turning. The block masks:

| mask | stops at |
|---|---|
| `0x1E0` | bomb, soft, hard, flame |
| `0x9E0` | the above + `potentialBlast` (do not walk into danger) |
| `0xBE0` | the above + a moving bomb |

## The modes
| mode | scorer (what the ray looks for) | decider (what happens next) |
|---|---|---|
| 0 **chase** | walk toward `targetCell`; mask `0x1E0`, or `0x9E0` when `skill ≥ 2`; distance = steps to the target's row/column; also counts moving bombs seen | if a direction reaches the target within `range + 1` cells → mode 6 (bomb it); if a moving bomb was seen and `skill ≥ 1` → mode 5; if nothing reachable → mode 1 |
| 1 **dig** | nearest soft block along or beside a ray; mask `0x9E0`; a flag in the skill byte limits it to one candidate per frame | if a soft block is adjacent (`dist 0`) → mode 4; nothing → mode 0 |
| 2 **flee** | the first cell along each ray **without** `potentialBlast`; distance = how far; record the set as `safeDirs` | if my cell is still in the blast (or on a special tile with blast beside it) keep walking the chosen safe direction; otherwise wait a few frames → mode 5 |
| 3 **approach** | same as mode 0 | target reachable → mode 0, else → mode 4 |
| 4 **bomb and back off** | safe direction (as mode 2) | drop a bomb here, turn to the opposite of `facing`, → mode 2 |
| 5 **wait / kick** | walk toward a moving bomb (`0xBE0`); at `skill ≥ 3` a second flag can veto it | if no direction → mode 0 |
| 6 **bomb the target** | safe direction (as mode 2) | with a safe direction: drop a bomb, set the walk to the opposite of `facing`, then by `skill & 3`: 0 → mode 2 (flee), 1 → mode 7, 2 → mode 8, 3 → one of 7/8 at random. At `skill ≥ 3` the flee direction is instead taken from a 4-entry cycle (advanced past `facing` by `turnParity`) when that entry is in `safeDirs`. With **no** safe direction: if the cell behind is free and the CPU has no bombs out it bombs anyway and flees backward; otherwise it does not bomb and drops to mode 3 |
| 7 / 8 **retreat** | walk back along a ray up to 10 / 8 cells looking for `targetCell`'s line; only directions in `safeDirs` count | turn around → mode 10 / 9 |
| 9–11 **turn and settle** | — | if my cell is on a bomb: 9 → face the opposite way, mode 2; 10 → set direction opposite, mode 11; 11 → when the next cell is not a bomb (or is a bomb under a kickable flag) → mode 2 |

Bomb placement (`sub_C44519`) goes through the same `drop_bomb` as a human (same limits, same fuse); the CPU
also bumps its own `turnParity` and, if it holds a remote, arms the detonate on the first bomb.

```
          target in range          bomb placed
  chase ───────────────► bomb(6) ─────────────► retreat(7/8) ──► turn(9/10) ──► flee(2)
    │ nothing reachable                                                        │ out of blast
    ▼                                                                          ▼
  dig(1) ── block adjacent ──► bomb+back(4) ──► flee(2) ──► wait(5) ──► chase(0)
```

## Difficulty is three thresholds
`skill < 2`: chases straight through danger (mask `0x1E0`). `skill ≥ 1`: will go after a kickable bomb.
`skill ≥ 2`: chase rays stop at danger. `skill ≥ 3`: the post-bomb flee direction must be a known safe
direction. `skill & 3`: whether a bomb is followed by a plain flee or a measured retreat. Everything else is
identical — the "hard" CPU is the same machine with more of the danger bit respected.

## Sudden death (`sub_C53C16` → `sub_C53C8A` → `sub_C53CA9`)
When the match clock runs out the time-up banner slides in (16 px/frame to a stop), then after **64 frames** a
placer object starts at the **bottom-left** cell and walks a **spiral** of 8 legs from the leg table:
up the left column to the top, right along the top row, down the right column, left along the bottom row to
column 1, then the inner ring (up to row 1, right to column 11, down to row 9, left to column 1). At each cell:
write `hard | 0x500` and the block tile, flash for **16 frames** (re-asserting the cell each frame), then move
one cell (16 px, one frame) and repeat. Two rings = 44 + 36 = 80 cells at ~17 frames each ≈ 23 s. A bomb under
a placed block is removed (`bomb_handler` checks for the tag); what happens to a player standing there was not
traced. The placed cells are tagged distinctly so flames skip them instead of stopping.

## Translating to pip-engine
`kit.bombs.cpu(player, {skill})`: a mode byte, a target refreshed every 256 frames (prefer humans), four
ray-walks per frame with the three block masks, `safeDirs` from the flee scorer, the table above as a
`switch`, bombs placed through the normal API. The danger bit comes free from the bomb note's per-frame mask
paint. `kit.bombs.suddenDeath({after: seconds})`: a spiral generator over the arena's ring cells, one hard
cell every 17 frames, with a flash before each. Knobs: `skill` 1–4, ray length 22, retarget 256 frames,
spiral rings 2.

## Edge cases to keep
- Never let the CPU simulate blasts; paint the danger mask from the bombs and read a bit.
- Alternate the rotation order and tie-break by parity, or the CPU jitters between two equal directions.
- A CPU must not bomb when its escape direction is a dead end (mode 6 check), or it kills itself constantly —
  which is also the easiest "make it dumber" knob.
- Retarget on death of the target, or the CPU stands still over a corpse.
- Refuse a chosen direction whose next cell is a flame even if the scorer liked it.
- Sudden death is a sweep, not a wall: the flash before each block is the only warning, so 16 frames is a
  minimum for a kid's reflexes; the kit should expose it.
