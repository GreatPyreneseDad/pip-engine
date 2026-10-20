# Study targets, in order of what the floor needs

The floor builds 2D arcade games for kids with a keyboard, a stick and two buttons. So the first studies are the guts
every one of those games reuses: how things move, how enemies behave, how a camera follows, how a hit feels, how a
round is paced. Big 3D worlds and RPG systems come later, as design notes the line can be told about.

| # | Learn from | Repo (board row) | Mechanism to take | Becomes |
|---|---|---|---|---|
| 1 | Mega Man 2 / 6 (NES, complete static recomps) | Junior-Jones/Mega-Man-2-NES-Static-Recomp | Enemy pattern vocabulary: sine flyers, hoppers, turrets that lead the shot, chasers, shield-and-open cycles; hit-stun, invulnerability flash, knockback; boss phase state machines | `kit.patterns` (a library of movers the line can name), `kit.hitstun` |
| 2 | Sonic (Genesis disassemblies; the physics are the most documented in the hobby) | sonicretro/* rows | Slope physics, momentum, variable jump, rolling, spring/bounce, ring loss scatter | **done 0.3.2:** `kit.platform` from `forest/study/sonic-movement.md` (run/brake/friction, variable jump, coyote, buffer, axis-by-axis resolve, one-way ledges). Slopes, rolling, springs still in the note only. |
| 3 | Super Mario 64 (n64decomp/sm64) | n64decomp/sm64 | The camera: modes, lag, lookahead, cuts; the player state machine and how actions chain | `kit.camera` (follow with lookahead, zones, shake already exists) |
| 4 | Diddy Kong Racing (DavidSM64 decomp) & Crash Team Racing (CTR-tools) | DavidSM64/Diddy-Kong-Racing, CTR-tools/ctr-native | Kart handling: drift charge, boost, AI racers with rubber banding, item pacing | `kit.kart` (top-down and pseudo-3D racers for the floor) |
| 5 | Ocarina of Time (zeldaret/oot) | zeldaret/oot | Z-targeting: how a target is picked and held; the fishing pond: bite logic, lure depth, line tension, the big one | `kit.target`; a second opinion for Backwater's fight model |
| 6 | Animal Crossing (ACreTeam/ac-decomp) | ACreTeam/ac-decomp | Day cycle, shop economy, fish/bug spawn tables by hour and weather, a villager's daily schedule | design note for life-sim builds; Backwater's spawn tables |
| 7 | Harvest Moon 64 (complete decomp) | harvestwhisperer/hm64-decomp | Crop growth, stamina, seasons, shipping prices | design note: the tycoon/farm loop |
| 8 | Advance Wars: Dual Strike (complete decomp) | sturmds/advance-wars-dual-strike-decomp | Damage formula, terrain defence, fog, CO powers as pacing | `kit.tactics` grid combat on top of `kit.grid` |
| 9 | Pokémon (pret: pokered / pokeemerald, the best-documented decomps there are) | pret/pokered, pret/pokeemerald | Catch rate, damage formula, type chart shape, encounter tables, the RNG | design note: collection and battle maths |
| 10 | Castlevania: Symphony of the Night (Xeeynamo/sotn-decomp) | Xeeynamo/sotn-decomp | Drop tables, stat growth, weapon arcs and hit boxes | design note: loot and growth |
| 11 | Columns (Master System decomp), Tetris-likes | lhsazevedo/columns | Gravity curves, lock delay, match detection, chain scoring | `kit.grid` extensions: falling-piece puzzle |
| 12 | Banjo-Kazooie (n64decomp) | n64decomp/banjo-kazooie | Collectathon pacing: how a level gates and rewards | design note: level pacing |
| 13 | Metroid Prime recomp (complete) | ethannicholas/prime-recomp | Lock-on and scan, room-based world, ability gating | design note (3D; later) |
| 14 | Chrono Trigger reimplementation | zdiemer/chrono-trigger-reimplemented | Active-time battle pacing, tech combos | design note: turn pacing |

## How a study runs

1. Clone the repo read-only; find the mechanism's files (the decomp communities name them well: `camera.c`, `fishing.c`,
   `z_actor.c`).
2. Write `forest/study/<game>-<mechanism>.md`: purpose, state, update order, formulas with constants, edge cases,
   a diagram. Cite file and commit. No code.
3. Write the plugin from the note, in the kit's voice, with tests in `tests/`. Add the line to `api/kit.md`.
4. Record it in the table above (Becomes → done, plugin name, version).

## Not studied

Anything that only teaches content (a specific level, a specific boss, a character's moves). Recomps of Xbox 360 /
PS3 titles (mostly the recomp tooling at work, the guts are in engines we can't read from here).
