// Tweening and easing for smooth property animation.
// Consumed from phaserjs/phaser @ 02d8931b626d (MIT License)
// Easing functions adapted from:
//   src/math/easing/back/Out.js
//   src/math/easing/bounce/Out.js
//   src/math/easing/elastic/Out.js
//   src/math/easing/sine/InOut.js
//   src/math/easing/quadratic/InOut.js

(function() {
  const easeFns = {
    linear: function(t) { return t; },
    backOut: function(t, overshoot) {
      if (overshoot === undefined) overshoot = 1.70158;
      return --t * t * ((overshoot + 1) * t + overshoot) + 1;
    },
    bounceOut: function(t) {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      } else if (t < 2 / 2.75) {
        return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      } else if (t < 2.5 / 2.75) {
        return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      } else {
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      }
    },
    elasticOut: function(t, amplitude, period) {
      if (amplitude === undefined) amplitude = 0.1;
      if (period === undefined) period = 0.1;
      if (t === 0) return 0;
      if (t === 1) return 1;
      let s = period / 4;
      if (amplitude < 1) {
        amplitude = 1;
      } else {
        s = period * Math.asin(1 / amplitude) / (2 * Math.PI);
      }
      return amplitude * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / period) + 1;
    },
    sineInOut: function(t) {
      if (t === 0) return 0;
      if (t === 1) return 1;
      return 0.5 * (1 - Math.cos(Math.PI * t));
    },
    quadInOut: function(t) {
      if ((t *= 2) < 1) {
        return 0.5 * t * t;
      } else {
        return -0.5 * (--t * (t - 2) - 1);
      }
    }
  };

  // Unknown or misspelled names fall back to linear: a typo must never freeze a child's game.
  kit.ease = function(name, t) {
    if (typeof t !== 'number' || isNaN(t)) return 0;
    const fn = (typeof name === 'string' && easeFns[name]) || easeFns.linear;
    return fn(Math.max(0, Math.min(1, t)));
  };

  const activeTweens = [];
  const MAX_TWEENS = 50;

  kit.tween = function(obj, props, seconds, ease) {
    if (!obj || typeof obj !== 'object') return;
    if (!props || typeof props !== 'object') return;
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) return;
    if (typeof ease !== 'string' || !easeFns[ease]) ease = 'sineInOut';

    const start = {};
    const delta = {};
    let valid = false;
    for (const key in props) {
      if (typeof obj[key] === 'number' && typeof props[key] === 'number' && !isNaN(props[key])) {
        start[key] = obj[key];
        delta[key] = props[key] - obj[key];
        valid = true;
      }
    }
    if (!valid) return;

    // A new tween on the same property wins: the old tween lets go of it (no tug-of-war jitter).
    for (let i = activeTweens.length - 1; i >= 0; i--) {
      const old = activeTweens[i];
      if (old.obj !== obj) continue;
      for (const key in delta) delete old.delta[key];
      if (Object.keys(old.delta).length === 0) activeTweens.splice(i, 1);
    }
    // Full: the oldest tween gives way, so the newest thing the child did always animates.
    if (activeTweens.length >= MAX_TWEENS) activeTweens.shift();

    const tween = { obj, start, delta, ease, duration: seconds, elapsed: 0 };
    activeTweens.push(tween);
  };

  kit._onTick(function(dt) {
    for (let i = activeTweens.length - 1; i >= 0; i--) {
      const tw = activeTweens[i];
      tw.elapsed += dt;
      const t = Math.min(1, tw.elapsed / tw.duration);
      const eased = kit.ease(tw.ease, t);
      for (const key in tw.delta) {
        tw.obj[key] = tw.start[key] + tw.delta[key] * eased;
      }
      if (t >= 1) {
        activeTweens.splice(i, 1);
      }
    }
  });
})();
