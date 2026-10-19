// Plain shapes, curves, soft light, meters, smooth noise and a score line to the host.
// Written for MacT Factory (ages 10+); harmless extras for Pip's games.
(function () {
  const fin = (...a) => a.every(v => typeof v === 'number' && isFinite(v));
  const col = (c, d) => typeof c === 'string' && c ? c : d;
  kit.rect = (x, y, w, h, color, r = 0) => { if (!fin(x, y, w, h)) return; ctx.fillStyle = col(color, '#fff'); if (r > 0 && ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); } else ctx.fillRect(x, y, w, h); };
  kit.circle = (x, y, rad, color) => { if (!fin(x, y, rad) || rad <= 0) return; ctx.fillStyle = col(color, '#fff'); ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); };
  kit.ellipse = (x, y, rx, ry, color, rot = 0) => { if (!fin(x, y, rx, ry) || rx <= 0 || ry <= 0) return; ctx.fillStyle = col(color, '#fff'); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, +rot || 0, 0, TAU); ctx.fill(); };
  kit.ring = (x, y, rad, color, width = 2) => { if (!fin(x, y, rad) || rad <= 0) return; ctx.strokeStyle = col(color, '#fff'); ctx.lineWidth = +width || 2; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.stroke(); };
  kit.line = (x1, y1, x2, y2, color, width = 2) => { if (!fin(x1, y1, x2, y2)) return; ctx.strokeStyle = col(color, '#fff'); ctx.lineWidth = +width || 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  kit.poly = (pts, color) => { if (!Array.isArray(pts) || pts.length < 3) return; ctx.fillStyle = col(color, '#fff'); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(+p[0] || 0, +p[1] || 0) : ctx.moveTo(+p[0] || 0, +p[1] || 0)); ctx.closePath(); ctx.fill(); };
  kit.polyline = (pts, color, width = 2) => { if (!Array.isArray(pts) || pts.length < 2) return; ctx.strokeStyle = col(color, '#fff'); ctx.lineWidth = +width || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(+p[0] || 0, +p[1] || 0) : ctx.moveTo(+p[0] || 0, +p[1] || 0)); ctx.stroke(); };
  kit.curve = (x1, y1, cx, cy, x2, y2, color, width = 2) => { if (!fin(x1, y1, cx, cy, x2, y2)) return; ctx.strokeStyle = col(color, '#fff'); ctx.lineWidth = +width || 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke(); };
  kit.arc = (x, y, r, a0, a1, color, width = 2) => { if (!fin(x, y, r, a0, a1) || r <= 0) return; ctx.strokeStyle = col(color, '#fff'); ctx.lineWidth = +width || 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); };
  kit.label = (str, x, y, size = 16, color, align = 'left') => { if (!fin(x, y)) return; ctx.save(); ctx.font = '600 ' + (+size || 16) + 'px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = ['left', 'center', 'right'].includes(align) ? align : 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = col(color, '#e8eef5'); ctx.fillText(String(str), x, y); ctx.restore(); };
  kit.radial = (x, y, r, inner, outer) => { if (!fin(x, y, r) || r <= 0) return; try { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col(inner, '#fff')); g.addColorStop(1, col(outer, 'rgba(0,0,0,0)')); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } catch (e) {} };
  kit.band = (y0, y1, top, bottom) => { if (!fin(y0, y1)) return; try { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, col(top, '#000')); g.addColorStop(1, col(bottom, col(top, '#000'))); ctx.fillStyle = g; ctx.fillRect(-20, y0, W + 40, y1 - y0); } catch (e) {} };
  kit.shadow = (blur, color, fn) => { ctx.save(); ctx.shadowBlur = +blur || 12; ctx.shadowColor = col(color, 'rgba(0,0,0,.5)'); try { if (typeof fn === 'function') fn(); } catch (e) {} ctx.restore(); };
  kit.alpha = (a, fn) => { ctx.save(); ctx.globalAlpha = kit.clamp(+a || 0, 0, 1); try { if (typeof fn === 'function') fn(); } catch (e) {} ctx.restore(); };
  kit.bar = (x, y, w, h, frac, color, back) => { if (!fin(x, y, w, h)) return; kit.rect(x, y, w, h, col(back, 'rgba(255,255,255,.15)'), h / 2); kit.rect(x, y, w * kit.clamp(+frac || 0, 0, 1), h, col(color, '#5fe09a'), h / 2); };
  kit.wrap = (v, lo, hi) => v < lo ? hi : v > hi ? lo : v;

  /* smooth value noise in 0..1, period about 1 unit, deterministic */
  const NP = new Uint8Array(512); { let seed = 1337; for (let i = 0; i < 256; i++) NP[i] = i; for (let i = 255; i > 0; i--) { seed = (seed * 16807) % 2147483647; const j = seed % (i + 1); const t = NP[i]; NP[i] = NP[j]; NP[j] = t; } for (let i = 0; i < 256; i++) NP[256 + i] = NP[i]; }
  kit.noise = (x, y = 0) => { if (!fin(x, y)) return 0.5; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const h = (a, b) => NP[(NP[a & 255] + (b & 255)) & 511] / 255; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; };

  /* score and game over, posted to the host so it can show a HUD */
  let lastScore = null, overAt = -99;
  kit.score = n => { n = Math.round(+n || 0); if (n !== lastScore) { lastScore = n; post({ type: 'score', score: n }); } };
  kit.over = n => { if (kit.t - overAt < 1) return; overAt = kit.t; post({ type: 'over', score: Math.round(+n || 0) }); };
})();
