# Study · Animal Crossing (GameCube) · a villager's day

Learned from ACreTeam's `ac-decomp`, commit `09ca8e8b5b24e6ab44047ee980cf0088ad7ecb4c`. Daily timetable per
personality: `src/game/m_npc_schedule.c` (tables 8–91, lookup 136–158, overrides 196–211). Where they walk to:
`src/game/m_npc_walk.c` (goal tables 13–112, picking a walker 181–292), `include/m_npc_walk.h` (goal kinds, walker
cap). Moving them around off-screen and the per-acre crowd cap: `src/actor/ac_set_npc_manager.c` (831–957).
Constants: `ANIMAL_NUM_MAX` 15 in `include/m_npc.h`; 60 steps/s. No code taken; no names or dialogue; the
mechanism and its constants are the subject.

## Why this one
Kids ask for "a town where people live". What makes this town feel alive is not AI — it is a **timetable in
seconds**, a **small set of destinations**, and a **crowd limit per screen**. Fifteen villagers with three states
each, five of them walking at any time, moving one screen every seven seconds. Cheap, legible, and it never breaks.

## State
Per villager: `personality` (one of six), `homeAcre`, a `schedule` slot (`currentType`, `savedType`, a
`forcedType` + `forcedTimer` for scripted overrides). Per walker (at most `floor(15 / 3) = 5` at once): `goalKind`,
`goalAcre`, `status` ∈ {walking, stayInAcre, arrived}, an `arrivedCounter`. Globally: a bitfield of villagers who
have already had a walk this cycle, and a per-acre count of villagers currently inside it.

## The timetable
Each personality owns a short list of `(state, endsAtSecond)` rows; the current row is the first whose `endsAt`
exceeds `nowSec` (= hours·3600 + minutes·60 + seconds). Three states: **sleep**, **in house**, **outside**.

| personality | sleep | in | out | in | out | in | then |
|---|---|---|---|---|---|---|---|
| 1 | –5:00 | 5:00–6:00 | 6:00–12:00 | 12:00–13:00 | 13:00–18:30 | 18:30–21:00 | sleep 21:00– |
| 2 | –7:00 | 7:00–8:00 | 8:00–13:00 | 13:00–14:00 | 14:00–22:00 | 22:00–23:30 | sleep 23:30– |
| 3 | –8:00 | 8:00–9:00 | 9:00–12:00 | 12:00–14:00 | 14:00–19:30 | 19:30–22:00 | sleep 22:00– |
| 4 (early riser) | 1:00–5:30 | 5:30–6:30 | 6:30–12:00 | 12:00–12:30 | 12:30–23:00 | 23:00–1:00 | (loops) |
| 5 (night owl) | 5:00–10:00 | 10:00–11:00 | 11:00–15:00 | 15:00–16:00 | 16:00–22:00 | 22:00–23:00 | out 23:00–4:00, in 4:00–5:00 |
| 6 (night owl) | 2:30–9:00 | 9:00–10:00 | 10:00–13:00 | 13:00–14:00 | 14:00–21:00 | 21:00–22:00 | out 22:00–1:30, in 1:30–2:30 |

(Read as: there is always one hour "in house" between waking and going out, a short indoor break around midday,
and an indoor hour before sleep. The two night owls are outside past midnight and sleep through the morning.)

Overrides: on a special day every villager is forced **outside**; a scripted `forcedType` wins while its timer
runs (decremented once per schedule tick). Everything else reads `currentType`.

## Where "outside" means
Only while **outside** does a villager wander. Each personality also owns a second timetable of *destination bags*
keyed by the same clock rows; a bag is a small list from which one goal is drawn uniformly, so repeats weight it:
- **shrine** — the one landmark acre;
- **someone's house** — a random acre containing a villager's house;
- **alone** — a random acre with no other villager in it;
- **my home** — the acre with this villager's own house (the default when the row has no bag, and the goal every
  walk ends with).

Examples of bags: personality 1 at midday {shrine, house, alone}, at dusk {shrine, house}; personality 3 at midday
{alone} only; personality 5 all day {shrine ×3, alone ×7} — the loner; personality 6 small hours {shrine ×7,
alone ×3} — the night wanderer.

## The walk, mechanism
- At most **5** villagers are walkers at once. When a slot frees, pick uniformly among villagers who exist, whose
  current row has a non-empty bag, and who have not walked this cycle; when nobody qualifies, clear the "has
  walked" bits (keeping the current walkers') and pick again. Draw a goal from the bag and resolve it to an acre.
- Off-screen walkers move **one acre per 7 seconds** (`frame % 420 == 0`) toward the goal acre, choosing the next
  acre and the gate tile between acres. On-screen, the actor walks for real.
- **Crowd cap: 3 per acre.** If the acre a walker is heading into already holds 3 villagers, the walker's status
  becomes *stay in acre* and it idles where it is; when the count drops it resumes.
- On reaching the goal acre the walker **stays for 108,000 steps (30 minutes)**, then: if the goal was *my home*,
  the walk ends and the slot is handed to the next villager; otherwise the goal becomes *my home* and the counter
  resets — every excursion is "go somewhere, linger half an hour, go home, linger half an hour".
- The walker logic runs only for villagers whose timetable row says *outside*; the others are kept at (or sent to)
  their house by the manager's go-home status.

## Constants
| | |
|---|---|
| villagers | up to 15 |
| walkers at once | 5 |
| off-screen step | 1 acre / 7 s |
| linger at goal | 30 min |
| crowd cap | 3 per acre |
| states | sleep / in / outside |
| goal kinds | shrine / a house / alone / my home |

## Edge cases to keep
- Times are compared in seconds-of-day; a row ending at 24:00 wraps naturally because `nowSec` resets at midnight.
  Night owls' "outside past midnight" is just a row with a small `endsAt` at the top of the list.
- The "alone" goal must exclude the walker's own current acre and any acre at the cap.
- Forced schedule beats timetable beats default; keep three layers, not a boolean.
- The 30-minute linger is wall-clock in a real-time game; in a game with a fast clock scale it with the day.

## For a kids' game
A `kit.schedule` plugin: `{rows: [{state, until}], bags: [{until, goals}]}` per personality, a walker pool with a
cap, a per-screen crowd limit, and a linger timer. The six personalities above are a good default set to copy as
*shapes* (early riser, night owl, loner) with the kids' own characters on top.
