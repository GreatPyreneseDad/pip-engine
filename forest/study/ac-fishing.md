# Study · Animal Crossing (GameCube) · fish spawns and the bite

Learned from ACreTeam's `ac-decomp`, commit `09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c`. Spawn trigger:
`src/actor/ac_set_manager.c` (118–232). Fish spawn choice and tables: `src/actor/ac_set_ovl_gyoei.c` (tables
31–1200, weighted pick 1339–1439, term blending 1782–1871, per-water-kind lists 1952–2151, entry 2160–2179),
constants in `include/ac_set_ovl_gyoei.h`. Insect spawns use the same shape: `src/actor/ac_set_ovl_insect.c`
(hour terms 1042–1063, weighted pick 1675–1738), `include/ac_set_ovl_insect.h`. The fish-shadow brain:
`src/actor/ac_gyo_test.c` (tables 20–63, bobber search 300–346, scare 348–390, states 475–830); its per-species
class table `src/actor/ac_gyoei_type.c_inc`. The bobber: `src/actor/ac_uki_move.c_inc` (590–920). Game logic
runs at 60 steps/s (`FRAMES_PER_SECOND` in `include/types.h`). No code taken; no species named; the mechanism and
its constants are the subject.

## Why this one
Fishing is the single most-requested "calm" minigame on the floor, and this is the one everybody is remembering
when they ask. Two mechanisms, cleanly separable: **what shows up** (a weighted table keyed by place, half-month
and time of day, with a smooth hand-over between periods) and **how it bites** (a little state machine with a
fixed nibble count and a bite window that shrinks for rarer fish). Both are small. Both are good.

## Part 1 — what spawns
### When a roll happens
A spawn is attempted when the player **crosses into a new screen-sized area** (an "acre"): the manager notices the
crossing, waits 5 steps, then runs each spawner (insects, then fish) once. Not on a timer, not on every step.
A fish is refused if that area already has a live fish, or has no water at all. Fish despawn when they are more
than 600 units from the player *and* in a different acre than the player. So: at most one fish per acre, made the
moment you walk in, gone when you walk away.

### The table
Each water kind (river, sea, deep sea, pond, event, island) has a list per **half-month** (24 "terms" a year:
days 1–15 and 16–end) and per **time slot**. Four slots, three distinct lists: 21:00–3:59 uses list *night*,
4:00–8:59 and 16:00–20:59 both use list *dawn/dusk*, 9:00–15:59 uses list *midday*. Each entry is
`(species, requiredWaterFeature, weight)` with small integer weights — a typical river list is 14 entries with
weights like 40, 20, 10, 5, 5, 3, 3, 3, 2, 1, 1, 1, 1, 1 (total ≈ 96): one fish is ~40% of catches, the
rarest four share ~4%.

### Weighted pick with two twists
1. `total = Σ weight` over entries not yet tried; `pick = total · rand()`.
2. Walk the list subtracting `weight · envRate` from a running `remaining` that starts at `total`; the first
   entry where `remaining ≤ pick` wins. `envRate` is a town-tidiness factor: 0.5 / 0.75 / 0.875 / 1.0 for the
   bottom four of seven ranks, 1.0 above. A messy town therefore *shifts probability toward the top of the list*
   (the common fish) and, because `remaining` can hit zero early, can produce "nothing".
3. The winner must match its water feature (waterfall, pool, river mouth…) in this acre; if not, it is marked
   tried and the walk repeats without it. Up to `n` retries for `n` entries.

### Smooth hand-over between terms
Five days before a new half-month begins (the exact start is randomised 0–5 days early and saved), the game blends:
the next term's list is appended with every weight scaled by `(1 − rate)` and the current term's by `rate`, where
`rate = (daysToEnd) / 6` → 5/6, 4/6, … 1/6 over the five days. The two always sum to 1. So a fish that "arrives on
the 16th" is actually a 1-in-6 chance on the 11th. Deep-sea and island lists skip the blend (rate forced to 1).

### Weather and special entries
- Rain adds one rare deep-water species to the sea list at weight 2, only in the current-term half and never
  9:00–15:59 — rarer still as the term fades.
- The deep-sea list is the sea list with all weights ×10 plus one giant at weight 1: a 1-in-(10·total+1) roll.
- A fishing tourney swaps a river acre with a pool/bridge/waterfall to the event list with 75% probability.

### Insects, same shape
Twelve month lists × **six** time terms (23:00–3:59, 4–7:59, 8–15:59, 16–16:59, 17–18:59, 19–22:59), same
half-month blend, same `envRate`. Each entry carries a *spawn area* (on a tree, on a flower, flying, on the
ground, under a rock, on trash…). One extra rule: if the list's total weight is under 100 the roll is against 100,
so the remainder is "no bug" — thin months are quiet by arithmetic.

## Part 2 — the bite
### Fish classes
Each species has a `size` (eight classes XXS…XXL plus one giant), a `wariness` class 0–4 and a `biteWindow`
class 0–4. The three classes are the whole personality.

| per size class | XXS | XS | S | M | L | XL | XXL |
|---|---|---|---|---|---|---|---|
| approach speed (units/step) | 1.0 | 1.25 | 1.25 | 1.5 | 1.75 | 2.0 | 2.2 |
| back-off speed after a nibble | −0.38 | −0.40 | −0.42 | −0.42 | −0.45 | −0.50 | −0.70 |
| nibble interval base `b` (interval = `(b ± 15) · 2` steps) | 19 | 19 | 19 | 19 | 20 | 22 | 24 |
| touch distance (units) | 12 | 13 | 15 | 15 | 20 | 25 | 30 |
| shadow scale | 0.3 | 0.4 | 0.5 | 0.5 | 0.6 | 0.8 | 1.2 |
| reel-in time (steps) | 52 | 78 | 78 | 78 | 104 | 130 | 156 |

| per wariness class | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| notice radius (units) | 40 | 40 | 40 | 50 | 60 |
| notice cone, normal rod (± degrees) | 3 | 7 | 30 | 50 | 180 |
| notice cone, golden rod | 7.5 | 15 | 40 | 60 | 180 |

| per bite-window class | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| bite window, normal rod (steps) | 20 | 22 | 24 | 30 | 90 |
| bite window, golden rod (steps) | 22 | 24 | 26 | 36 | 120 |

Rare, large fish have wariness 1 and window 1: a 7° cone and 22 steps (0.37 s) to react. Common tiny fish: 180°
cone, 1.5 s.

### The state machine
- **wait** — drift with the current at −0.15 ± 0.1 for `(100 + rand 30) · 2` steps (3.3–4.3 s), then pick a swim
  mode (three equally likely: forward arc, turn-and-go, random heading) and **swim**; a wall or bank → **escape**.
  In both states, every step: if the player **scares** it, flee; else if the bobber is **noticed**, go **near**.
- **scare**: player dashing within 110 units, or a tool strike within 150, turns the fish away (ripple effect) and
  removes the shadow. The bobber itself scares if it *lands* within 17 units (XXS/XS) or 22 units (bigger).
- **notice**: bobber at rest (its 40-step cast settle finished), within the notice radius, within ±cone of the
  fish's heading, and within 10 units vertically.
- **near** — swim straight at the bobber at approach speed; leave if it drifts out of radius; on reaching touch
  distance, claim the bobber (one fish at a time) and go **touch**.
- **touch** (the nibbles) — a countdown starts at 0 so the first nibble is immediate. On each arrival at touch
  distance:
  - **bite** if `nibblesLeft` (starts at **5**) reaches 0 — or, with 25% per nibble, if the fish is on a
    waterfall tile; otherwise
  - *nibble*: bob the bobber, back off at the back-off speed (± 0.1) for `(b ± 15) · 2` steps (8–68 steps for
    small fish, 18–78 for the largest), then approach again.
  So the real game bites on the 5th nibble, every time. Pressing the button during a nibble (not a bite) reels in
  an empty hook and the fish leaves.
  - At the moment of biting, if the player has an empty pocket, 1 in 20 fish become **trash** of a matching size
    (can / boot / tyre by size class).
- **bite** — the bobber plunges; the fish holds for `biteWindow` steps. Button within the window → **catch**:
  the bobber flies to the hand over the size-class reel-in time, the shadow becomes the real fish. Window missed →
  the fish lets go and leaves (shadow fades), the bobber returns to **wait**.

## Edge cases to keep
- Only one fish can own the bobber; others that notice it must see "claimed" and go back to wait.
- A cast that lands *on* a fish scares it; a cast *near* one is the skill. Keep both distances.
- The bite window and the reel-in time are different timers: the first is the player's test, the second is the
  reward animation scaled by size. Don't fold them.
- A fish in the bite state ignores the scare check — once it has the hook, only the window matters.
- The "no fish in this acre yet" rule means walking back and forth across an acre edge is the re-roll; a kit should
  copy that honestly (one shadow per screen, re-rolled on screen change) rather than spawn on a timer.

## For a kids' game
Part 1 is a `kit.spawnTable` plugin: `{entries: [{kind, weight, needs}], envRate, blendWith(nextTable, rate)}`
plus the per-screen "one at a time" rule. Part 2 is a `kit.fish` plugin: the seven-state shadow with the
three class tables above and a bobber that reports *nibble* vs *bite*; the fixed five-nibble count is the secret
that makes it learnable by a six-year-old.
