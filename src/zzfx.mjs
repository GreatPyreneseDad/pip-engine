/* pip-engine · host-side ZzFX player. The sealed frame cannot make sound, so kit.zzfx / kit.sound post
   { gm: 1, type: 'zzfx', params } to the host; the host calls playZzfx(params) on that message.
   ZzFX v1.4.0 by Frank Force (MIT), via KilledByAPixel/LittleJS src/engineAudio.js. */

const ZZFX_RATE = 44100;
const ZZFX_DEFAULTS = [1, .05, 220, 0, 0, .1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];

/** Float32Array of samples for 21 ZzFX parameters (missing or junk entries take the defaults). */
export function zzfxSamples(params) {
  const p = ZZFX_DEFAULTS.map((d, i) => { const v = Array.isArray(params) ? params[i] : undefined; return typeof v === 'number' && isFinite(v) ? v : d; });
  return zzfxG(...p);
}

let zzfxCtx = null;
/** Play a ZzFX sound in the host page. Returns the source node, or null if audio is unavailable. */
export function playZzfx(params, volume = 1) {
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    zzfxCtx ||= new AC();
    if (zzfxCtx.state === 'suspended') zzfxCtx.resume();
    const samples = zzfxSamples(params);
    if (!samples || !samples.length) return null;
    const buf = zzfxCtx.createBuffer(1, samples.length, ZZFX_RATE);
    buf.getChannelData(0).set(samples);
    const srcNode = zzfxCtx.createBufferSource(), gain = zzfxCtx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, +volume || 0));
    srcNode.buffer = buf; srcNode.connect(gain); gain.connect(zzfxCtx.destination); srcNode.start();
    return srcNode;
  } catch (e) { return null; }
}

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
  const sampleRate = ZZFX_RATE;
  const PI = Math.PI;
  const PI2 = PI * 2;
  let startSlide = (slide *= 500 * PI2 / sampleRate / sampleRate);
  let startFrequency = frequency *=
    (1 + (Math.random() * 2 - 1) * randomness) * PI2 / sampleRate;
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
