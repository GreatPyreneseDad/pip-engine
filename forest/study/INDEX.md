# The forest: study notes

Mechanisms learned from classic games (see ../STUDY.md). 9 notes. Each is also embedded in the factory's forest table, so the line is handed the relevant ones for a brief.

- [Study · Mega Man 2 (NES) · the object pool, shared gravity/move routine, jump launch and energy refill](megaman2-object-pool-gravity.md) — Two things here are worth stealing for any 2D kids' game: (1) a fixed-size **object pool** where every object —
- [Study · Ocarina of Time (N64) · the fishing pond: bite, hook, fight, size](oot-fishing.md) — "Fishing game" is one of the first things a kid asks for, and the naive version — tap, wait a random time, fish —
- [Study · Ocarina of Time (N64) · Z-targeting: picking, holding and dropping a lock-on](oot-z-targeting.md) — On a touch screen there is no aiming. A kid taps "attack" and the game has to decide *which* thing they meant.
- [Study · Super Mario 64 (N64) · the player's action state machine and what a hit does](sm64-action-states.md) — Every character on the floor ends up with a tangle of booleans: `jumping`, `hurt`, `sliding`, `canJump`. Mario 64
- [Study · Super Mario 64 (N64) · the follow camera](sm64-camera.md) — Every scrolling game on the floor has a camera, and nearly all of them are wrong in the same way: glued to the
- [Study · Sonic the Hedgehog (Genesis) · ground movement and jumping](sonic-movement.md) — Every "make me a platformer" on the floor needs the same four feelings: a run that builds, a stop that bites, a jump
- [Study · Castlevania: Symphony of the Night (PS1) · weapon arcs, hit detection, hit-stun and invulnerability](sotn-hit-detection.md) — A sword swing that *feels* like it connects is three things: a hitbox that moves through the arc frame by frame,
- [Study · Castlevania: Symphony of the Night (PS1) · drop tables and the loot roll](sotn-loot-roll.md) — Every "monster drops stuff" on the floor wants the same three feelings: *usually* a little something (a heart,
- [Study · Castlevania: Symphony of the Night (PS1) · experience, level-ups and the damage formula](sotn-stat-growth.md) — "Make my guy level up" is the second thing a kid asks for after "make him jump". SotN's growth is four stats,
