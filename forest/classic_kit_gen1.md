# CLASSIC · kit · gen 1

**Branch**: CLASSIC
**Domain**: kit (the API games are written against)
**Generation**: 1
**Created**: extracted verbatim from Maple's World `public/genie-maker/index.html` (maples-world @ c072f06)
**Status**: BASELINE

## Capabilities
- Contract: `const game = { init, update(dt), draw }`; dt ≤ 0.05 s; full redraw each frame
- Drawing: `kit.bg`, `kit.sprite` (29 hand-drawn characters, walk/flap animation), `kit.item`, `kit.prop`, `kit.emoji`, `kit.text`
- Feedback: `kit.sound` (10 named sounds, host-played), `kit.note`, `kit.puff` (≤ 400 particles), `kit.shake`, `kit.say`, `kit.win`
- Input: one pointer (`down`, `pressed`, `released` one-frame edges)
- Helpers: `rand`, `pick`, `clamp`, `dist`, `lerp`
- Safety: sealed srcdoc frame with CSP `default-src 'none'`; errors posted, never thrown; runaway-frame guard; sound throttle 4/frame; win and say debounced

## Pinned by
`tests/kit.test.mjs` (14 tests) and `tests/examples.test.mjs`. CERATA treats every one of these as CLASSIC:
a consume that turns one red fails its trial.

## Known gaps (the hunt list)
No tweening/easing · no collision helpers · no multi-touch, drag or swipe · particles are one style · sounds are a fixed set of 10 · no grid/tile layouts · no timers or sequences. See `CERATA_TARGETS.md`.
