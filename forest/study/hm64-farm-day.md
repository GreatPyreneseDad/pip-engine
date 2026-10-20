# Study · Harvest Moon 64 (N64) · the farm day: clock, crops, watering, stamina, shipping

Learned from harvestwhisperer's `hm64-decomp`, commit `9824b8810fe97c3cf4d37ec887e02f968c6462fb`. Clock:
`src/game/time.c` (lines 46–157, 221–232). Crop tiles and the overnight pass: `src/game/groundObjects.h`
(tile ids), `src/game/groundObjects.c` (tile table lines 36–258, overnight pass 1220–1447, rain 1451–1497).
Harvest regrowth: `src/game/items.c` (4113–4178); seed planting 3200–3240. Stamina and fatigue:
`src/game/player.c` (tool costs 289–321, thresholds 1519–1570, spend 1610–1660), overnight recovery
`src/game/game.c` (2500–2545). Shipping: `src/game/items.c` (`itemShippingValues`, 1083+; bin add 4565),
`src/game/game.c` (`handleDailyShipment`, 2767), `src/game/gameStatus.c` (57–82). Seed prices: `src/game/shop.c`
(541–597). Weather: `src/game/weather.c`. No code taken; the mechanism and its constants are the subject.

## Why this one
"Plant, water, wait, sell" is the calmest loop a kid can ask for, and this game's version is tiny enough to hold
in one hand: a tile is one byte, growth is +1, watering is +1, a day is one pass over the grid. The stamina system
is the pacing brake — it makes the day end before the chores do. Everything a farm-game request needs is here.

## The clock
- Game time advances **10 seconds per logic step** while time is allowed to flow on the current map. 6 steps = one
  game minute; 360 steps = one game hour. At 30 steps/s a game hour is 12 real seconds and the waking day
  (6:00 → midnight) is 3.6 minutes; at 60 steps/s half that. Pick the rate for the floor, keep the shape.
- The day number rolls at **6:00**, not midnight. Hours run 0–23; reaching 24 wraps to 0 without touching the day.
- **30 days per month, 4 months (seasons) per year**, 7-day week running independently. Day 31 → day 1 of the next
  season; season 5 → spring of the next year. "Tomorrow's season" is precomputed so the forecast and the
  overnight pass can use it.
- Falling asleep sets the clock to 6:00 of the next day and runs the overnight pass. Being awake at 6:00 forces the
  end-of-day sequence anyway.
- Night is `17 < hour < 24`; the "working hours" for fatigue are `5 < hour < 18`.

## Weather, once per night
A roll 1–100 against a cumulative per-season table: spring 85 sun / 15 rain; summer 85 / 10 rain / 5 typhoon;
autumn 85 / 15; winter 70 sun / 30 snow. Rain waters every waterable tile for free (and the one special plot).
Typhoon and earthquake nights run their own destructive passes (random crop/log/grass loss).

## A crop tile is one number
The field is a 24 × 20 grid of bytes. Each crop owns a run of consecutive ids: for every growth stage there is a
*dry* id and a *watered* id (`dry + 1`), ending in `ripe`, `ripe watered`, `dead`. Each id carries two flag sets:
what tools work on it (cut / till / chop / hammer / **water** / **plant**) and what happens overnight.

| crop | stages before ripe | watered days to ripe | after harvest | ship value | seed bag |
|---|---|---|---|---|---|
| A (turnip-shaped) | 2 planted + 2 sprout | 4 | tilled soil | 60 | 200 |
| B (potato-shaped) | 3 + 3 | 6 | tilled soil | 80 | 200 |
| C (cabbage-shaped) | 3 + 2 + 2 | 7 | tilled soil | 90 | 200 |
| D (eggplant-shaped) | 2 + 2 + 3 | 7 | back 3 stages, regrows | 60 | 300 |
| E (tomato-shaped) | 2 + 2 + 2 + 3 | 9 | back 3 stages, regrows | 90 | 300 |
| F (corn-shaped) | 3 + 3 + 3 + 4 | 13 | back 4 stages, regrows | 120 | 300 |
| G (strawberry-shaped) | 2 + 2 + 2 | 6 | tilled soil | 150 | 500 |

(Stage counts read from the id runs in `groundObjects.h`; regrowth targets from the harvest handler, which sets
the tile to the first id of the last stage group — "stalk" or "plant" — so the regrow time is that group's length.)

One seed bag covers a **3 × 3 sweep** (9 tile offsets in front of the player) and can only land on tilled,
unplanted soil in the crop's season (or in the greenhouse). 9 × 60 = 540 from a 200 bag in 4 days; corn's 300 bag
returns 1080 every 13 days and then 1080 more every 4. The numbers are the whole economy.

## Watering
- Watering a dry tile sets it to `dry + 1` (its watered twin). Watering a watered tile does nothing.
- Rain overnight does the same to every waterable tile.
- Only a **watered** tile grows. The overnight flag on a watered stage id says "+1" (to the next stage's *dry* id);
  the dry stage id has no overnight flag and stays put. The ripe-watered id says "−1" (back to ripe, dry).
  So: `water → +1`, `night → +1 if watered`, and a stage costs exactly one watered day.
- Tilled-and-watered soil dries back to tilled overnight by the same −1 rule.

## Season change kills
On day 1 of a new season the overnight pass sweeps the field once with season rules:
- New summer: spring crops still in their planted stages → tilled soil; sprouted or ripe → the crop's *dead* id.
- New autumn: the same for summer crops (and the two flower kinds).
- New winter: everything (crops, dead crops, tilled soil, weeds) → bare ground. Snow resets the farm.
- New spring: planted grass → cut grass; tilled soil has a 50% chance (roll 0–5 ≥ 3) of reverting to bare ground.
- The greenhouse skips all of this: growth only, every season.

## Stamina and fatigue (two bars, different speeds)
- `stamina` 0–`max` (max starts at 100), refilled to max every morning. `fatigue` 0–100, **not** refilled; it only
  comes down.
- Each tool swing costs `toolCost[tool][chargeLevel]` stamina: the two heavy tools cost 2 / 4 / 6 at charge
  levels 0 / 1 / 2, the three medium tools 1 / 2 / 3 (one is 1 / 2 / 6), everything else 1 or 0. Holding the button
  for 16 steps charges the next level, only if the next level's cost is still affordable.
- The same swing adds the same number to `fatigue` — but **only in bad weather or outside 6:00–18:00** (and never
  in the greenhouse); a gift item halves the added amount. So working through the night, or in the rain, is what
  wears you down. Daytime sunshine work is free of fatigue.
- Four stamina warning levels at ¼, ½, ¾ of max and "can't afford the next swing"; three fatigue levels at 50,
  75, 100. Crossing a level plays an animation; at fatigue 100 you cannot use tools.
- Food restores stamina and reduces fatigue by per-item amounts; a hot spring and a few other actions knock 10–20
  off fatigue.
- Sleeping removes `(30 − bedHour) · 2` fatigue (×3 with a comfort item), where `bedHour` counts past midnight as
  24+; bed at 20:00 → −20, bed at 2:00 → −8. Early bed is the fatigue cure. Fatigue at 100 skips the recovery.

## Shipping and money
- Dropping an item in the bin adds its ship value to a daily total (capped at 999,999). Values above: crops 60–150,
  egg 50, milk 100 / 150 / 300 / 500 by grade, wool 900 / 1800, fish 30 / 100 / 180, ores 100–1000, foraged
  30–100. Flowers, tools, gifts: 0 (not shippable).
- At the end of the day the total is added to gold (cap 999,999) and the bin empties. Money arrives *overnight*,
  never on drop — the delay is deliberate; the kid wakes up richer.
- Livestock buy-in: hen 1500, sheep 4000, cow 6000; feed 10 per bag, fodder 30. Tools and upgrades 600–10,000.

## Edge cases to keep
- The overnight pass is a single sweep; apply `+1 / −1` from the *original* id's flags, not from an id you just
  changed, or a tile can jump two stages.
- Rain is applied *before* the overnight growth so a rainy night grows the crop (the rain pass sets watered ids,
  then the growth pass advances them).
- A regrowing crop is set to a *dry* stage id on harvest; it still needs watering that day.
- Time does not flow on some maps (indoors, menus) and is suspended during animations — the clock hook checks
  per map.
- Both stamina and fatigue use a clamp-add (`value + delta` bounded to `[0, max]`); never let fatigue underflow.

## For a kids' game
The byte-per-tile state with "water = +1, night = +1 if watered" is a plugin (`kit.field`?) with a crop table of
`{stages, regrowStages, value, seedCost}`. The two-bar stamina with the "only at night / in rain" fatigue rule and
the `(30 − bedHour)·2` sleep recovery is a design note the line can carry into any day-loop game.
