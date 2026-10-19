# EXPERIMENTAL: ZzFX sound synthesis (generation 4)

## Capabilities
- `kit.zzfx(params)` posts raw ZzFX parameter arrays (21 numbers) to host for synthesis
- `kit.sound(name)` extended with 8 synthesized presets: laser, zap, explode, coin, jump, hit, powerup, blip
- ZzFX sample generator (zzfxG) ported from LittleJS for host-side synthesis
- Rate limiting: 8 ZzFX sounds per frame (separate from unlimited sampled sounds)
- Synthesized sounds use mathematical waveform generation (sin, square, saw, triangle, noise)

## Behaviour changes from CLASSIC
- `kit.sound('laser')` now plays a synthesized laser sound instead of posting {type:'sound', name:'laser'}
- Same for zap, explode, coin, jump, hit, powerup, blip
- Existing sampled sound names (pop, boing, etc.) unchanged: CLASSIC behaviour
- `kit.zzfx([...])` is a new capability, no CLASSIC equivalent
- Synthesized sounds post {type:'zzfx', params:[21 numbers]} instead of {type:'sound', name}

## Integration points
- Host page must handle 'zzfx' message type by running zzfxG and playing the samples
- ZzFX parameters are validated: NaN and Infinity replaced with defaults
- Rate limit prevents synthesis spam (8 per frame, independent of sampled sounds)

## Evaluation metrics
- Games can create varied sound effects from parameter arrays (target: 8+ distinct sounds per game)
- Synthesized presets reduce game code size (target: 50% fewer lines for sound compared to defining arrays)
- No new dependencies added to the frame
- Existing sound tests stay green (CLASSIC compatibility)
- Host synthesis overhead acceptable (target: <5ms per sound on mid-range hardware)

## Trial success criteria
- All CLASSIC tests pass
- Games can play laser/zap/explode sounds without defining parameter arrays
- kit.zzfx() accepts custom parameter arrays and posts them correctly
- Rate limiting works for both sampled and synthesized sounds
- No frame performance regression (<1ms added per frame with 8 sounds playing)
