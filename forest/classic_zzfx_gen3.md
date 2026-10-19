# CLASSIC: Sound capabilities (generation 3)

## Capabilities
- `kit.sound(name)` plays named sampled sounds: pop, join, bonk, win, tap, magic, boing, whoosh, splash, munch
- `kit.note(freq, seconds)` plays a single musical tone at a given frequency
- All sound posts `{type: 'sound', name}` or `{type: 'note', freq, seconds}` to the host page
- Rate limiting: 8 sounds per frame maximum
- Sounds are played host-side; the sealed frame has no audio context

## Behaviour
- Sampled sounds are discrete, pre-recorded audio clips
- No synthesis or procedural sound generation
- Sound names outside the known set are posted as-is (host may ignore them)
- Rate limiting prevents audio spam from runaway game loops

## Performance
- No client-side audio processing
- Minimal frame overhead (just postMessage calls)
- Host-side playback means no Web Audio API in the frame

## Evaluation
- Games can play sounds for taps, wins, and feedback
- No musical scales beyond single tones
- No sound effects variety without adding more named samples
