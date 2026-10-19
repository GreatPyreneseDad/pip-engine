// Delayed and repeating callbacks: kit.after(seconds, fn) and kit.every(seconds, fn).
// Adapted from KilledByAPixel/LittleJS @ cdcbef463d88 (MIT License)
// Timer class based on src/engineUtilities.js:Timer

(function() {
  const liveTimers = [];
  const MAX_TIMERS = 100;

  // Internal timer: tracks when to fire, whether it repeats, and the callback.
  function Timer(delay, callback, repeating) {
    this.delay = delay;
    this.callback = callback;
    this.repeating = repeating;
    this.fireAt = kit.t + delay;
    this.cancelled = false;
  }

  Timer.prototype.tick = function() {
    if (this.cancelled || kit.t < this.fireAt) return false;
    // Fire the callback, catching and reporting errors so one bad timer doesn't freeze the game.
    try {
      this.callback();
    } catch (e) {
      if (typeof post === 'function') {
        post({ type: 'error', message: 'Timer callback error: ' + (e && e.message || String(e)) });
      }
    }
    if (this.repeating) {
      this.fireAt = kit.t + this.delay;
      return false; // keep it alive
    }
    return true; // one-shot: remove it
  };

  Timer.prototype.cancel = function() {
    this.cancelled = true;
  };

  // kit.after(seconds, fn): call fn once after seconds of game time.
  // Returns a handle with cancel() to stop it before it fires.
  kit.after = function(seconds, fn) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return { cancel: function() {} };
    if (typeof fn !== 'function') return { cancel: function() {} };
    if (liveTimers.length >= MAX_TIMERS) {
      // Cap reached: drop the oldest timer so the newest thing the child did always runs.
      liveTimers.shift();
    }
    const timer = new Timer(seconds, fn, false);
    liveTimers.push(timer);
    return { cancel: function() { timer.cancel(); } };
  };

  // kit.every(seconds, fn): call fn repeatedly every seconds of game time.
  // Returns a handle with cancel() to stop it.
  kit.every = function(seconds, fn) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) return { cancel: function() {} };
    if (typeof fn !== 'function') return { cancel: function() {} };
    if (liveTimers.length >= MAX_TIMERS) {
      liveTimers.shift();
    }
    const timer = new Timer(seconds, fn, true);
    liveTimers.push(timer);
    return { cancel: function() { timer.cancel(); } };
  };

  kit._onTick(function(dt) {
    for (let i = liveTimers.length - 1; i >= 0; i--) {
      if (liveTimers[i].tick()) {
        liveTimers.splice(i, 1);
      }
    }
  });
})();
