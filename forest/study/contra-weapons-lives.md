# Study · Contra (NES) · five guns from one bullet table, and the lives-and-respawn loop

Learned from vermiceli's annotated Contra (US) disassembly (github.com/vermiceli/nes-contra-us, commit
`687d651c021fd7020f10d05b970ccb62663c94bd`). No code taken; the mechanisms and their constants are the subject.
Player firing and bullets are `src/bank6.asm` (`check_player_fire` 290 → `fire_weapon_routine_*` 384–596, velocity
tables 837–1250); invincibility, death and lives are in `src/bank7.asm` (4066–4130, 1137–1180, 1300–1320,
3975–4005, 4240–4260, 5150–5160). Frames are 60 fps; velocities are 8.8 fixed point converted to pixels per second.

## Why this one
"Give me a spread gun" is the second thing a kid says after "give me a gun". Contra's five weapons differ in only
three dimensions — how many bullets per press, how fast, and what shape — and the whole kit fits in a velocity table
per aim direction. The lives loop is the other half: a death that throws you off screen, a respawn that drops you
in with two seconds of mercy during which the enemies politely hold fire, and a partner who can lend you a life.
Both halves are exactly what an arcade-style kids' game needs and neither needs a line of cleverness.

## State the gun keeps
Per player: current weapon (type in the low nibble, **rapid-fire upgrade** as bit 4), aim direction (0–9: up,
up-fwd, fwd, down-fwd, crouch, and mirrored; 11 = jump-and-shoot-down), a "fire time" byte for the machine gun's
hold cadence, a 15-frame recoil timer (the gun-out pose). Per bullet (pool of 10 slots per player): type, owner,
8.8 position, 8.8 velocity, aim direction, a timer (indoor lifetime / laser stagger / flame phase), two extra
positions for the flame's swirl centre.

## Aim → velocity (`set_bullet_velocity` 837–876)
Twelve velocity rows per table, one per aim direction, four bytes each (x, y in 8.8). Three tables:
| table | straight | diagonal | used by |
|---|---|---|---|
| normal | 3 px/f = **180 px/s** | 2.12, 2.12 (true 45°, |v| = 3) | pistol, machine gun |
| rapid | 4 px/f = **240 px/s** | 2.83, 2.83 | pistol/MG with the upgrade; laser always |
| flame | 1.5 px/f = **90 px/s** | 1.06, 1.06 | flame (2.0 / 1.41 with the upgrade) |
Picking up the rapid-fire item flips one bit and every weapon reads the next table. Diagonals are normalised (the
player's bullets are honest; see the Mega Man note for the enemies' cheap aim). Crouching aims straight; jumping
while aiming down uses the twelfth row (straight down).

## The five guns (`fire_weapon_routine_*` 401–596)
| gun | per press | max alive (per player) | speed | shape rule |
|---|---|---|---|---|
| pistol | 1 | 4 | 180 (240) px/s | press only |
| machine gun | 1 per 8 f **while held** | 6 | 180 (240) | bursts: after 6 shots in a row, a 15-frame gap, then resume; a free slot that opens re-arms immediately |
| flame | 1 | 4 | 90 (120) | a slow shot that **swirls** around a centre point travelling with it; centre offset and swirl phase from a per-aim table (1064–1076) |
| spread | 5 at once | 10 (two volleys) | 180 (210) | aim index ±0, ±1, ±2 on a **32-direction circle** → a fan of 11.25° steps, ±22.5° total (1140–1200) |
| laser | 4 segments at once | 4 | 240 | segments created with timers 10 / 7 / 4 / 1 so they string out behind the lead; pressing again while any segment lives **restarts** the beam (the famous "don't tap the laser") |

Holding fire with the machine gun: a nibble counts frames between shots (fire every 8), the high nibble counts shots
in the burst (`gen_m_bullet_if_delay_met` 439–475); at 6 the gap becomes 15 frames and the counter resets.
Letting go lets the low nibble climb to 7 so the first shot after a release is instant.

The spread's table is a 32-entry circle (x and y each a 16-entry half-wave of 8.8 values from 0 to ±3); the aim
direction maps to a base index (0, 4, 8, 12 … = 0°, 45°, 90° …) and the five bullets add 0, +1, −1, +2, −2.
With the upgrade a second circle of radius 3.48 px/f is used.

Every fire sets the player's recoil pose for 15 frames, plays a per-weapon sound, and writes the aim into the
bullet so its sprite can face the right way. Indoor (3D) levels give bullets a **lifetime** instead of a screen edge:
42 frames, 21 with rapid fire (the bullet travels "into" the screen and shrinks).

### Weapon strength (bank7 4096–4116)
Each weapon has a strength 0–3 (pistol 0, flame 1, machine gun 2, laser 2, spread 3). The strength is remembered
as a high-water mark and feeds the spawn director (−5 ticks per point) — the game gets a little busier when you are
better armed. On death the weapon resets to the pistol and the mark drops with it.

## Enemy bullets, for contrast (bank7 9831–10194)
One routine: aim at the nearest player in 24 directions (15°), unit vector from a 7-entry quarter table, then a
speed code picks one of {0.5, 0.75, 1, 1.25, 1.5, 1.62, 1.75, 1.87} px/f (30–112 px/s) by halving and adding —
no multiply. Enemy bullets are 3–8× slower than the player's. That gap *is* the genre.

## The lives loop
```
 [start] lives = 2 spare (29 with the code), continues = 3, extra-life target = 20,000 pts
 [alive] ──hit / fall off bottom (y ≥ 232)──▶ [dying] fling: vy = 2.5 px/f up (150 px/s), vx = −1 px/f (60 px/s) outdoors,
                                               gravity 0.137 px/f² (492 px/s²), fall off screen, weapon → pistol
 [dying] ──lives > 0──▶ lives−1 → [drop-in] fall from above the top at the level's spawn x (p1 48 or 112 px,
                         p2 32 or 144), until a floor is under the feet (scan at +32 px);
                         then 128 frames (2.1 s) of invincibility; ENEMY_ATTACK_FLAG stays clear → nothing fires
                         or spawns until the i-frames end  → [alive]
         ──lives = 0──▶ [game over] partner may press A to donate one of theirs (if they have ≥1 and are not
                         dying) → revived as above; else continue (3) or end
 1-up: every time the score crosses the extra-life threshold the threshold moves up; max 99 lives, a sound
```
(`init_player_lives` 1170–1180, `kill_player` 4240–4258, `init_player_dec_num_lives` 5150–5160, the respawn setup
4185–4200, the donate rule 3975–4005, the 1-up 1300–1320.)

The respawn mercy is the important number: **128 frames**, and during it the whole enemy population is told not
to attack, not just that the player is immune. That is why Contra deaths don't chain.

## Constants
| | per frame | per second / count |
|---|---|---|
| bullet, normal / rapid | 3 / 4 px/f | 180 / 240 px/s |
| flame, normal / rapid | 1.5 / 2 px/f | 90 / 120 px/s |
| spread, normal / rapid | 3 / 3.48 px/f | 180 / 209 px/s |
| spread fan | 5 bullets at 11.25° steps | ±22.5° |
| machine gun cadence | 1 per 8 f, 6 then 15 f gap | 7.5 shots/s, bursts |
| laser stagger | 10 / 7 / 4 / 1 f | — |
| alive caps | 4 / 6 / 4 / 10 / 4 | pistol / MG / flame / spread / laser |
| recoil pose | 15 f | 0.25 s |
| indoor bullet life | 42 (21 rapid) f | 0.7 / 0.35 s |
| enemy bullet | 0.5–1.87 px/f | 30–112 px/s |
| player gravity | 0.137 px/f² | 492 px/s² |
| death fling | (−1, 2.5 up) px/f | (60, 150) px/s |
| respawn mercy | 128 f | 2.1 s |
| lives / continues / 1-up | 3 / 3 / 20,000 then rising | max 99 |

## Design shapes seen
- **Weapon = row in a velocity table + a count + a cap.** The spread is five lookups into a circle; the laser is
  four bullets with staggered timers. No weapon has its own physics.
- **Upgrade = a bit that selects the next table.** One pickup makes every gun better in the same way.
- **Hold-to-fire with a burst limiter.** Hold is a cadence plus a stamina counter, so holding is never strictly
  better than tapping.
- **Mercy is global.** The respawn flag silences the enemies, not just the damage.
- **Shared lives in co-op** by explicit donation, not a pool.

## Things learned that are not built yet
- The flame swirl's exact path (two offset tables indexed by a 16-step phase, 1529–1566).
- Indoor/3D bullets travel in z: a scale index by lifetime; a different kit.
- The weapon pickup flies in an arc from a capsule and falls to the ground (bank0 `weapon_item_routine_*`).

## Edge cases to keep
- Bullets carry their aim so their sprite and their velocity never disagree.
- A fan weapon takes all its slots or none (the spread stops when a slot is missing — accept that or pre-check).
- Restarting a beam on re-press is a *feature* only if the player can learn it; make it a knob.
- Falling off the bottom is a death, checked in the normal state every frame.
- Donating a life must refuse if the donor is on their last life *and* currently dying.
- The 1-up threshold moves after each award; cap lives and clamp the threshold at the top of the counter.
