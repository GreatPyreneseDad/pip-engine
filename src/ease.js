/* pip-engine · easing functions. MIT, consumed from phaserjs/phaser @ 02d8931b626d.
   Upstream: src/math/easing/{back,bounce,elastic,sine,quadratic}/*.js
   License: MIT, Copyright 2013-2026 Phaser Studio Inc.
   
   Each function takes a normalized value v in [0, 1] and returns an eased value.
   Used by kit.tween and kit.ease. Child-friendly defaults: playful overshoots,
   bounces, and smooth curves for 2-8 year old touch games. */

/**
 * Back ease-out. Moves quickly, overshoots the target, then settles back.
 * The overshoot occurs at the end, giving a slight 'bounce past and return' effect.
 * @param {number} v - Value in [0, 1]
 * @param {number} overshoot - Overshoot amount (default 1.70158, standard value)
 * @returns {number} Eased value
 */
export function backOut(v, overshoot = 1.70158) {
  return --v * v * ((overshoot + 1) * v + overshoot) + 1;
}

/**
 * Bounce ease-out. Starts fast, decelerates with a bouncing effect like a ball landing.
 * Four piecewise quadratic segments produce three diminishing bounces before settling.
 * @param {number} v - Value in [0, 1]
 * @returns {number} Eased value
 */
export function bounceOut(v) {
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
 * Elastic ease-out. Overshoots with a decaying sine wave oscillation, like a spring.
 * The elastic effect occurs at the end, making motion appear to bounce or spring into place.
 * @param {number} v - Value in [0, 1]
 * @param {number} amplitude - Overshoot amplitude (default 0.1, child-friendly)
 * @param {number} period - Oscillation tightness (default 0.1, gentle waves)
 * @returns {number} Eased value
 */
export function elasticOut(v, amplitude = 0.1, period = 0.1) {
  if (v === 0) return 0;
  if (v === 1) return 1;

  let s = period / 4;
  if (amplitude < 1) {
    amplitude = 1;
  } else {
    s = period * Math.asin(1 / amplitude) / (2 * Math.PI);
  }

  return amplitude * Math.pow(2, -10 * v) * Math.sin((v - s) * (2 * Math.PI) / period) + 1;
}

/**
 * Sinusoidal ease-in-out. Smooth S-curve with gentle start and end.
 * Accelerates through the midpoint, decelerates back to a stop.
 * @param {number} v - Value in [0, 1]
 * @returns {number} Eased value
 */
export function sineInOut(v) {
  if (v === 0) return 0;
  if (v === 1) return 1;
  return 0.5 * (1 - Math.cos(Math.PI * v));
}

/**
 * Quadratic ease-in-out. Moderate S-curve acceleration/deceleration.
 * Starts gently, moves briskly through the middle, settles smoothly.
 * @param {number} v - Value in [0, 1]
 * @returns {number} Eased value
 */
export function quadInOut(v) {
  if ((v *= 2) < 1) {
    return 0.5 * v * v;
  } else {
    return -0.5 * (--v * (v - 2) - 1);
  }
}
