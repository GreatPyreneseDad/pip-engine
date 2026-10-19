// Color utilities: parsing, mixing, HSL conversion, rainbow gradients.
// Color parsing consumed from craftyjs/Crafty @ f3982baa51af (MIT License)
// Adapted from src/graphics/color.js: assignColor, parseHexString, parseRgbString

(function() {
  // HTML named colors dictionary (standard 16 + common extended)
  const colorNames = {
    aqua: '#00ffff', black: '#000000', blue: '#0000ff', fuchsia: '#ff00ff',
    gray: '#808080', green: '#00ff00', lime: '#00ff00', maroon: '#800000',
    navy: '#000080', olive: '#808000', orange: '#ffa500', purple: '#800080',
    red: '#ff0000', silver: '#c0c0c0', teal: '#008080', white: '#ffffff',
    yellow: '#ffff00'
  };

  // Parse a color string (hex, rgb, rgba, or named) into {r, g, b, a} components (0-255, 0-1)
  function parseColor(str) {
    if (!str || typeof str !== 'string') return null;
    str = str.trim().toLowerCase();

    // Hex format: #RGB or #RRGGBB
    if (str[0] === '#') {
      const len = str.length;
      let r, g, b;
      if (len === 7) {
        r = parseInt(str.substr(1, 2), 16);
        g = parseInt(str.substr(3, 2), 16);
        b = parseInt(str.substr(5, 2), 16);
      } else if (len === 4) {
        const rr = str.substr(1, 1);
        const gg = str.substr(2, 1);
        const bb = str.substr(3, 1);
        r = parseInt(rr + rr, 16);
        g = parseInt(gg + gg, 16);
        b = parseInt(bb + bb, 16);
      } else {
        return null;
      }
      if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
      return { r, g, b, a: 1.0 };
    }

    // rgb() or rgba() format
    if (str.startsWith('rgb')) {
      const match = /rgba?\s*\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,?\s*([0-9.]+)?\s*\)/.exec(str);
      if (!match) return null;
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const a = match[4] ? parseFloat(match[4]) : 1.0;
      if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null;
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
    }

    // Named color
    const hex = colorNames[str];
    if (hex) return parseColor(hex);

    return null;
  }

  // Convert {r, g, b, a} to CSS rgba() string
  function toRgba(color) {
    if (!color) return 'rgba(0, 0, 0, 1)';
    const r = Math.round(Math.max(0, Math.min(255, color.r)));
    const g = Math.round(Math.max(0, Math.min(255, color.g)));
    const b = Math.round(Math.max(0, Math.min(255, color.b)));
    const a = Math.max(0, Math.min(1, color.a));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // HSL to RGB conversion (h: 0-360, s: 0-1, l: 0-1)
  function hslToRgb(h, s, l) {
    h = h % 360;
    if (h < 0) h += 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
      a: 1.0
    };
  }

  // Public API: kit.color namespace
  kit.color = {};

  // Mix two colors with linear interpolation (t: 0 = a, 1 = b)
  kit.color.mix = function(a, b, t) {
    const ca = parseColor(a);
    const cb = parseColor(b);
    if (!ca || !cb) return 'rgba(0, 0, 0, 1)';
    if (typeof t !== 'number' || isNaN(t)) t = 0;
    t = Math.max(0, Math.min(1, t));

    const r = ca.r + (cb.r - ca.r) * t;
    const g = ca.g + (cb.g - ca.g) * t;
    const bl = ca.b + (cb.b - ca.b) * t;
    const alpha = ca.a + (cb.a - ca.a) * t;

    return toRgba({ r, g, b: bl, a: alpha });
  };

  // Create a color from HSL values (h: 0-360 degrees, s: 0-1, l: 0-1)
  kit.color.hsl = function(h, s, l) {
    if (typeof h !== 'number' || isNaN(h)) h = 0;
    if (typeof s !== 'number' || isNaN(s)) s = 1;
    if (typeof l !== 'number' || isNaN(l)) l = 0.5;
    return toRgba(hslToRgb(h, s, l));
  };

  // Rainbow color from t (0-1): cycles through hue spectrum
  kit.color.rainbow = function(t) {
    if (typeof t !== 'number' || isNaN(t)) t = 0;
    t = t % 1;
    if (t < 0) t += 1;
    const hue = t * 360;
    return toRgba(hslToRgb(hue, 1, 0.5));
  };

  // Adjust alpha channel of a color (a: 0-1)
  kit.color.alpha = function(color, a) {
    const c = parseColor(color);
    if (!c) return 'rgba(0, 0, 0, 1)';
    if (typeof a !== 'number' || isNaN(a)) a = 1;
    c.a = Math.max(0, Math.min(1, a));
    return toRgba(c);
  };
})();
