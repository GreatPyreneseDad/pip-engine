// ZzFX sound synthesis for kit.zzfx() and synthesized sound presets.
// Consumed from KilledByAPixel/LittleJS @ cdcbef463d88 (MIT License)
// Adapted from src/engineAudio.js:
//   - the sample generator (ZzFX v1.4.0 by Frank Force) now lives host-side in src/zzfx.mjs
//   - Named sound presets for common game sounds

(function() {
  // Named ZzFX presets for common game sounds. The frame posts the parameters; the host plays them
  // with playZzfx() from the engine module (dist/pip-engine.mjs, or PIP_ENGINE.playZzfx).
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

  const MAX_ZZFX_PER_FRAME = 4;
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
