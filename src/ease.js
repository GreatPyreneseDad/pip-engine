/* pip-engine · easing functions. Consumed from phaserjs/phaser @ 02d8931b626d, MIT license.
   Upstream: src/math/easing/{back,bounce,elastic,sine,quadratic}/Out.js + InOut.js
   Adapted for pip-engine: plain functions, no module.exports, child-appropriate subset only. */

/**
 * Back ease-out. The tween moves quickly at first, then overshoots its final
 * value before settling back to the target. The overshoot occurs at the end of
 * the transition, giving a slight 'bounce past and return' effect.
 *
 * Consumed from Phaser.Math.Easing.Back.Out
 * @param {number} v - The value to be eased, typically in the range [0, 1].
 * @param {number} [overshoot=1.70158] - The overshoot amount. Higher values produce a more pronounced overshoot.
 * @return {number} The eased value.
 */
function backOut(v, overshoot) {
  if (overshoot === undefined) { overshoot = 1.70158; }
  return --v * v * ((overshoot + 1) * v + overshoot) + 1;
}

/**
 * Applies a bounce ease-out effect to the given value. The motion starts fast
 * and decelerates toward the end with a bouncing effect, simulating a ball
 * landing and bouncing to a stop. The bounce is achieved through four piecewise
 * quadratic segments that produce three diminishing bounces before settling.
 *
 * Consumed from Phaser.Math.Easing.Bounce.Out
 * @param {number} v - The value to be eased.
 * @return {number} The eased value.
 */
function bounceOut(v) {
  if (v < 1 / 2.75) {
    return 7.5625 * v * v;
  } else if (v < 2 / 2.75) {
    return 7.5625 * (v -= 1.5 / 2.75) * v + 0.75;
  } else if (v < 2.5 / 2.75) {
    return 7.5625 * (v -= 2.25 / 2.75) * v + 0.9375;
  } else {
    return 7.5625 * (v -= 2.625 / 2.75) * v + 0.984375;
  }
}

/**
 * An Elastic ease-out, where the value overshoots its target and oscillates with a decaying sine wave
 * before settling at the final value. The elastic effect occurs at the end of the transition, making
 * the motion appear to bounce or spring into place. Accepts a normalized input value `v` in the range 0 to 1.
 *
 * Consumed from Phaser.Math.Easing.Elastic.Out
 * @param {number} v - The normalized value to be tweened, typically in the range [0, 1].
 * @param {number} [amplitude=0.1] - The amplitude of the elastic overshoot. Values above 1 increase the size of the overshoot.
 * @param {number} [period=0.1] - Controls how tight the sine-wave oscillation is. Smaller values produce tighter waves with more rapid oscillations.
 * @return {number} The eased value.
 */
function elasticOut(v, amplitude, period) {
  if (amplitude === undefined) { amplitude = 0.1; }
  if (period === undefined) { period = 0.1; }

  if (v === 0) {
    return 0;
  } else if (v === 1) {
    return 1;
  } else {
    var s = period / 4;

    if (amplitude < 1) {
      amplitude = 1;
    } else {
      s = period * Math.asin(1 / amplitude) / (2 * Math.PI);
    }

    return (amplitude * Math.pow(2, -10 * v) * Math.sin((v - s) * (2 * Math.PI) / period) + 1);
  }
}

/**
 * Applies a sinusoidal ease-in/out to the given value. The motion starts slowly,
 * accelerates through the midpoint, and decelerates back to a stop at the end,
 * producing a smooth S-curve transition. This is useful for animations that
 * need a natural, symmetrical feel with gentle starts and endings.
 *
 * Consumed from Phaser.Math.Easing.Sine.InOut
 * @param {number} v - The value to be eased, in the range [0, 1].
 * @return {number} The eased value, in the range [0, 1].
 */
function sineInOut(v) {
  if (v === 0) {
    return 0;
  } else if (v === 1) {
    return 1;
  } else {
    return 0.5 * (1 - Math.cos(Math.PI * v));
  }
}

/**
 * Quadratic ease-in/out. Applies a quadratic curve that accelerates in the first half
 * of the range and decelerates in the second half, producing a smooth S-curve transition.
 * Useful for animations that need to start gently, move briskly through the middle, and
 * settle smoothly at the end.
 *
 * Consumed from Phaser.Math.Easing.Quadratic.InOut
 * @param {number} v - The value to be eased, in the range [0, 1].
 * @return {number} The eased value, in the range [0, 1].
 */
function quadInOut(v) {
  if ((v *= 2) < 1) {
    return 0.5 * v * v;
  } else {
    return -0.5 * (--v * (v - 2) - 1);
  }
}

/**
 * Linear easing (no easing, constant rate).
 * @param {number} v - The value to be eased, in the range [0, 1].
 * @return {number} The same value (identity function).
 */
function linear(v) {
  return v;
}

// Registry of easing functions by name
const EASINGS = {
  linear,
  bounce: bounceOut,
  elastic: elasticOut,
  back: backOut,
  sine: sineInOut,
  quad: quadInOut,
};

/**
 * Get an easing function by name and apply it to a normalized value.
 * @param {string} name - Easing name: linear, bounce, elastic, back, sine, quad
 * @param {number} v - Normalized progress [0, 1]
 * @return {number} Eased value
 */
function ease(name, v) {
  const fn = EASINGS[name] || linear;
  return fn(v);
}
