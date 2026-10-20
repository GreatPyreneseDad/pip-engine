# Study · Animal Crossing (GameCube) · the real-time day, weather, and the bell economy

Learned from ACreTeam's `ac-decomp`, commit `09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c`. Clock and calendar:
`src/game/m_time.c` (calendar terms 66–182, tick 446–520), `include/m_time.h` (`mTM_FIELD_RENEW_HOUR`). Daily
reset at 6:00: `src/game/m_all_grow_ovl.c` (3059–3150, spoil test 316–334). Weather: `src/game/m_kankyo_weather.c_inc`
(date windows 16–53, table and roll 66–140), reroll trigger `src/actor/ac_weather.c` (603–640). Turnip market:
`src/game/m_kabu_manager.c` (whole file). Shop: `src/game/m_shop.c` (price lookup 649–738, hours 1703–1720),
`include/m_shop.h` (sales thresholds 23–29), sell ratio `include/ac_npc_shop_common.h` and
`src/actor/npc/ac_npc_shop_common.c` (2986–3003). No code taken; no names; the shapes and constants are the subject.

## Why this one
The thing kids remember about this game is that it kept going when they were not there. Three mechanisms make
that work: a **real clock** with a day that turns at 6 a.m., **weather rolled once per calendar day** from a
date-window table, and a tiny **economy** — one speculative vegetable, a shop that buys at a quarter of what it
sells, and a shop that grows when you spend enough. All three are cheap to build and give a canvas game a pulse.

## The clock
- Time is the console's real-time clock, read every step. The game keeps `nowSec = h·3600 + m·60 + s` for
  schedules and two angles for the clock hands (`minuteAngle = (m·60 + s) / 3600`, `hourAngle = (h·3600 + …) / 43200`,
  both as a fraction of a turn).
- When the RTC is unavailable it falls back to a counter: `addSec` per step accumulates into whole seconds; a debug
  mode steps time at 2, 4, 120 or 240 s per step — the knobs a canvas game needs for "fast day".
- **Two different "day boundaries":**
  - *calendar day* (midnight): sets a bank of "renew" flags; the weather roll consumes one of them.
  - *field day* (**6:00**): growth, turnip spoilage, shop restock, and anything that "happened overnight". The
    world-update routine computes `growTime = last update rounded to 6:00 (next day if ≥ 6:00)` and runs the
    overnight pass only when now is past it — so staying up to 5:59 keeps yesterday; 6:00 flips everything at
    once.
- **Season** is a lookup of the date in an 18-row table of (month, lastDay, season, decoration profile): e.g.
  spring from 25 Feb, summer from 26 May, autumn from 16 Sep, winter from 10 Dec, with sub-terms for short
  decorative windows. The island climate ignores the table and is always row 7 (summer).
- Half-month "terms" (24/year, days 1–15 / 16–end) drive spawn tables (see `ac-fishing.md`).

## Weather, once per calendar day
Twenty date windows, each a bag of ten tickets across {clear, rain, storm, snow, blizzard, blossom, heavy blossom}:
```
1 Jan–7 Jan      10 clear
8 Jan–24 Feb      7 clear  2 snow  1 blizzard
25 Feb–31 Mar     8 clear  2 rain
1–4 Apr          10 clear
5–7 Apr          10 light blossom     8 Apr   10 heavy blossom
9–19 Apr          8 clear  2 rain     20 Apr  10 clear
21 Apr–25 Jun     7 clear  2 rain  1 storm
26 Jun–15 Jul     5 clear  3 rain  2 storm
16 Jul–31 Aug     9 clear  1 storm
1–30 Sep          6 clear  4 storm
1–30 Oct          8 clear  2 rain    31 Oct   10 clear
1–15 Nov          8 clear  1 rain  1 snow
16 Nov–9 Dec      7 clear  3 snow
10 Dec           10 blizzard
11–23 Dec         4 clear  4 snow  2 blizzard
24–30 Dec         6 snow  4 blizzard
31 Dec           10 clear
```
Roll `d = rand · 10` and walk the bag in that order. The roll happens at game start and once when the calendar
day's renew flag is set (midnight), unless the player is on a special screen; scripted events can override, and a
chores-mode flag turns rain to clear. Rain feeds the spawn tables: it adds a rare sea fish and brings out the
on-flower-in-rain insects (see `ac-fishing.md`).

## The turnip market (one speculative vegetable)
Prices are generated **for the whole week at once** and stored per weekday.
- **Sunday buy price** `= 100 · (1 + (rand − 0.5) · 0.6)` → uniformly 70–129.
- Then a **trend** is drawn, with odds that depend on last week's trend:

  | last → next | A (spike) | B (random) | C (falling) |
  |---|---|---|---|
  | A | 50% | 30% | 20% |
  | B | 60% | 20% | 20% |
  | C | 60% | 30% | 10% |

- **B, random walk** (Mon→Sat, starting from the Sunday price): each day, with probability `pDown` (starts 0.10),
  the price is set to `min(price · 0.7, 0.8 · sunday)` and `pDown = min(pDown · 0.3, 0.10)`; otherwise
  `price ·= mult`, then `mult += 0.01` (starts 1.05) and `pDown += 0.14`. So the odds of a crash climb 10 → 24 →
  38 → 52% as the price rises, and reset to ≤10% after one. Prices mostly sit at 0.8–1.3× Sunday.
- **A, spike**: generate B, then overwrite one day Mon–Fri (uniform) with **8 × Sunday price** (560–1032).
- **C, falling**: each day `price ·= 0.80 + 0.15 · rand` → 80–95% of the day before.
- Prices are clamped to 10–2000 on load. Turnips are bought in 10 / 50 / 100 bundles and sold at the day's price
  × bundle; any turnip still held when a **Sunday 6:00** passes becomes rotten (sell value 0, attracts flies).
- Visiting a day you already rolled (Sunday after the week was set) re-rolls Mon–Sat only; a gap of more than a
  week re-rolls everything.

## The shop
- Every item has one **catalog price**; the shop **buys back at `price / 4`** (integer), and refuses items whose
  quarter is 0. Fruit that is not the town's native fruit sells for a flat 2000 instead of its table price — the
  "bring fruit from a friend's town" economy in one constant. A seasonal money-bag item sells for the current
  *year* in bells (a joke the code keeps). Shell prices: 160, 80, 600, 120, 240, 1800, 1400, 1000.
- **Hours** by shop tier: tier 0 9:00–22:00, tier 1 7:00–23:00, tiers 2–3 9:00–22:00; on the last day of the month
  opening is 10:00 (a lottery). Before opening is a "pre" state, after closing an "end" state; the shop never
  changes stock while open.
- **Growth** is cumulative spend: every purchase adds to `salesSum`; the shop upgrades at 25,000 / 90,000 / 240,000.
  Inside tier 0, tools appear at 3,000 (net), 8,000 (rod), 12,000 (axe) — the first week's goals.
- Money also exists as bag items of 100 / 1,000 / 10,000 / 30,000; when the wallet is short at the till the game
  breaks bags from the pockets automatically, smallest first.

## Edge cases to keep
- Two day boundaries, not one: midnight flags things, 6:00 *does* them. Build both.
- The turnip spoil check is "has a Sunday 6:00 passed since the last field update", not "is it Sunday".
- Type-B's "decrease" is `min(price·0.7, 0.8·sunday)`: it always lands at or below 80% of Sunday, never a gentle dip.
- Weather is rolled once; it does not change mid-day except by script. Blossom "weather" is a season effect, not a
  forecast — keep it off the roll if you don't have the season.

## For a kids' game
The clock + 6:00 boundary + weather-bag is a `kit.calendar`-style plugin (configurable seconds per game-day, a
date-window weather table, callbacks for midnight and dawn). The turnip week and the quarter-price shop with
spend-to-upgrade thresholds are design notes the line can hand to any shop or market the kids ask for.
