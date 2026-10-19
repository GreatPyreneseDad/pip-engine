// ZzFX sound synthesis for kit.zzfx() and synthesized sound presets.
// Consumed from KilledByAPixel/LittleJS @ cdcbef463d88 (MIT License)
// Adapted from src/engineAudio.js:
//   - zzfxG() for sample generation (ZzFX v1.4.0 by Frank Force)
//   - Sample rate constant
//   - Named sound presets for common game sounds

(function() {
  const audioDefaultSampleRate = 44100;

  // ZzFX sample generator - generates Float32Array of audio samples
  // from 21 numeric parameters describing the sound envelope and shape
  function zzfxG(
    volume = 1,
    randomness = .05,
    frequency = 220,
    attack = 0,
    sustain = 0,
    release = .1,
    shape = 0,
    shapeCurve = 1,
    slide = 0,
    deltaSlide = 0,
    pitchJump = 0,
    pitchJumpTime = 0,
    repeatTime = 0,
    noise = 0,
    modulation = 0,
    bitCrush = 0,
    delay = 0,
    sustainVolume = 1,
    decay = 0,
    tremolo = 0,
    filter = 0
  ) {
    // init parameters
    const sampleRate = audioDefaultSampleRate;
    const PI = Math.PI;
    const PI2 = PI * 2;
    const startSlide = (slide *= 500 * PI2 / sampleRate / sampleRate);
    const startFrequency = frequency *=
      (1 + kit.rand(-randomness, randomness)) * PI2 / sampleRate;
    let modOffset = 0;
    let repeat = 0;
    let crush = 0;
    let jump = 1;
    let length;
    let b;
    let t = 0;
    let i = 0;
    let s = 0;
    let f;

    // biquad LP/HP filter
    const quality = 2;
    const w = PI2 * Math.min(Math.abs(filter), sampleRate / 4 - 1) * 2 / sampleRate;
    const cosw = Math.cos(w);
    const alpha = Math.sin(w) / 2 / quality;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw / a0;
    const a2 = (1 - alpha) / a0;
    const sign_filter = filter >= 0 ? 1 : -1;
    const b0 = (1 + sign_filter * cosw) / 2 / a0;
    const b1 = -(sign_filter + cosw) / a0;
    const b2 = b0;
    let x2 = 0, x1 = 0, y2 = 0, y1 = 0;

    // scale by sample rate
    const minAttack = 9;
    attack = attack * sampleRate || minAttack;
    decay *= sampleRate;
    sustain *= sampleRate;
    release *= sampleRate;
    delay *= sampleRate;
    deltaSlide *= 500 * PI2 / Math.pow(sampleRate, 3);
    modulation *= PI2 / sampleRate;
    pitchJump *= PI2 / sampleRate;
    pitchJumpTime *= sampleRate;
    repeatTime = repeatTime * sampleRate | 0;

    // allocate sample buffer
    length = attack + decay + sustain + release + delay | 0;
    b = new Float32Array(length > 0 ? length : 0);

    // generate waveform
    for (; i < length; b[i++] = s * volume) {
      if (!(++crush % (bitCrush * 100 | 0))) {
        s = shape ? shape > 1 ? shape > 2 ? shape > 3 ? shape > 4 ?
          (t / PI2 % 1 < shapeCurve / 2 ? 1 : -1) :
          Math.sin(Math.pow(t, 3)) :
          Math.max(Math.min(Math.tan(t), 1), -1) :
          1 - (2 * t / PI2 % 2 + 2) % 2 :
          1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2) :
          Math.sin(t);

        s = (repeatTime ?
          1 - tremolo + tremolo * Math.sin(PI2 * i / repeatTime) :
          1) *
          (shape > 4 ? s : (s >= 0 ? 1 : -1) * Math.pow(Math.abs(s), shapeCurve)) *
          (i < attack ? i / attack :
          i < attack + decay ?
          1 - ((i - attack) / decay) * (1 - sustainVolume) :
          i < attack + decay + sustain ?
          sustainVolume :
          i < length - delay ?
          (length - i - delay) / release * sustainVolume :
          0);

        s = delay ? s / 2 + (delay > i ? 0 :
          (i < length - delay ? 1 : (length - i) / delay) *
          b[i - delay | 0] / 2 / (volume || 1)) : s;

        if (filter)
          s = y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
      }

      f = (frequency += slide += deltaSlide) *
        Math.cos(modulation * modOffset++);
      t += f + f * noise * (i * i * PI2 % 2 - 1);

      if (jump && ++jump > pitchJumpTime) {
        frequency += pitchJump;
        startFrequency += pitchJump;
        jump = 0;
      }

      if (repeatTime && !(++repeat % repeatTime)) {
        frequency = startFrequency;
        slide = startSlide;
        jump ||= 1;
      }
    }

    return b;
  }

  // Named ZzFX presets for common game sounds
  const zzfxPresets = {
    laser: [.5, .05, 400, .01, .05, .1, 1, 1.5, 0, 0, 0, 0, 0, .1, 0, 0, 0, 1, .01],
    zap: [.3, .01, 300, .01, .02, .05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, .01],
    explode: [1, .05, 200, .01, .3, .5, 3, .1, 0, 0, 0, 0, 0, .5, 0, 0, .1, .5, .01],
    coin: [.5, .05, 600, .01, .05, .1, 0, 1, 0, 0, 0, 0, 0, 0, 50, 0, 0, 1, .01],
    jump: [.3, .05, 300, .05, .2, .2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, .05],
    hit: [.5, .05, 100, .01, .05, .1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .8, .01],
    powerup: [.5, .05, 400, .05, .3, .3, 0, 1, 0, 0, 50, .05, 0, 0, 0, 0, 0, 1, .05, .2],
    blip: [.3, 0, 500, .01, .03, .05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, .01]
  };

  const MAX_ZZFX_PER_FRAME = 8;
  let zzfxThisFrame = 0;

  kit._onTick(function() {
    zzfxThisFrame = 0;
  });

  // Post a ZzFX sound to the host
  kit.zzfx = function(params) {
    if (!params || typeof params !== 'object' || params.length === undefined) return;
    if (zzfxThisFrame >= MAX_ZZFX_PER_FRAME) return;
    zzfxThisFrame++;

    // Convert to array and fill in defaults for omitted parameters
    const fullParams = [];
    const defaults = [1, .05, 220, 0, 0, .1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
    for (let i = 0; i < 21; i++) {
      const val = params[i];
      fullParams.push(typeof val === 'number' && isFinite(val) ? val : defaults[i]);
    }

    try {
      parent.postMessage({ gm: 1, type: 'zzfx', params: fullParams }, '*');
    } catch (e) {}
  };

  // Extend kit.sound to support synthesized presets
  const originalSound = kit.sound;
  kit.sound = function(name) {
    if (typeof name === 'string' && zzfxPresets[name]) {
      kit.zzfx(zzfxPresets[name]);
    } else {
      originalSound(name);
    }
  };
})();
