/* pip-engine · runtime (rt). Runs inside the sealed game frame after lib.js. Defines W, H, ctx, kit. */
/* runtime inside the sealed game frame */
const cv = document.getElementById('c'); const ctx = cv.getContext('2d'); g = ctx;
var W = innerWidth, H = innerHeight, DPR = 1;
function fit() { DPR = Math.min(2, window.devicePixelRatio || 1); W = Math.max(50, innerWidth); H = Math.max(50, innerHeight); cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
addEventListener('resize', fit); fit();
const post = m => { try { parent.postMessage(Object.assign({ gm: 1 }, m), '*'); } catch (e) {} };
const BASE = { girl: 114, boy: 108, robot: 104, unicorn: 100, bunny: 98, dino: 84, ghost: 66, cloud: 86, snowball: 36, crab: 52, butterfly: 84, firefly: 70, ladybug: 60 };
const PBASE = { tree: 80, pine: 92, bush: 28, flower: 24, rock: 20, palm: 92, shell: 12, snowman: 60, mushroom: 30, crystal: 40, lollipop: 70, cane: 46 };
const FONT = 'ui-rounded, "Arial Rounded MT Bold", "Baloo 2", system-ui, sans-serif';
const parts = []; let shakeAmt = 0, sayAt = -99, sounds = 0, wonAt = -99;
const kit = {
  t: 0, pointer: { x: W / 2, y: H / 2, down: false, pressed: false, released: false },
  rand: (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a),
  pick: a => a && a.length ? a[Math.floor(Math.random() * a.length)] : undefined,
  clamp: (v, a, b) => v < a ? a : v > b ? b : v, dist: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2), lerp: (a, b, k) => a + (b - a) * k,
  bg(top, bottom) { const gr = ctx.createLinearGradient(0, 0, 0, H); try { gr.addColorStop(0, top || '#8fd3ff'); gr.addColorStop(1, bottom || top || '#d6f5c9'); } catch (e) { gr.addColorStop(0, '#8fd3ff'); gr.addColorStop(1, '#d6f5c9'); } ctx.fillStyle = gr; ctx.fillRect(-20, -20, W + 40, H + 40); },
  _draw(x, y, size, base, o, feet, fn) { if (!isFinite(x) || !isFinite(y) || !(size > 0)) return; o = o || {}; const s = size / base; ctx.save(); ctx.translate(x, y); if (o.rot) { const c = feet ? -size / 2 : 0; ctx.translate(0, c); ctx.rotate(o.rot); ctx.translate(0, -c); } if (o.alpha !== undefined) ctx.globalAlpha = kit.clamp(+o.alpha || 0, 0, 1); ctx.scale(o.flip ? -s : s, s); try { fn(); } catch (e) {} ctx.restore(); },
  sprite(kind, x, y, size = 90, o) { const t = o && o.t !== undefined ? +o.t || 0 : 0;
    if (TROUBLE[kind]) return kit._draw(x, y, size, BASE[kind] || 70, o, true, () => TROUBLE[kind](t));
    if (kind === 'girl' || kind === 'boy' || kind === 'robot' || AN[kind]) return kit._draw(x, y, size, BASE[kind] || 80, o, true, () => drawChar(kind, t));
    kit.emoji('❓', x, y - size / 2, size, o); },
  item(kind, x, y, size = 50, o) { if (THING[kind]) kit._draw(x, y, size, 32, o, false, () => THING[kind](kit.t)); else kit.emoji('⭐', x, y, size, o); },
  prop(kind, x, y, size = 90) { if (DECOR[kind]) kit._draw(x, y, size, PBASE[kind] || 60, null, true, () => DECOR[kind]()); },
  emoji(ch, x, y, size = 60, o) { if (!isFinite(x) || !isFinite(y) || !(size > 0)) return; o = o || {}; ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1); if (o.alpha !== undefined) ctx.globalAlpha = kit.clamp(+o.alpha || 0, 0, 1); ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(String(ch), 0, size * 0.06); ctx.restore(); },
  text(str, x, y, size = 40, color = '#fff', align = 'center') { ctx.save(); ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = 'rgba(40,30,70,.55)'; ctx.lineJoin = 'round'; ctx.strokeText(String(str), x, y); ctx.fillStyle = color; ctx.fillText(String(str), x, y); ctx.restore(); },
  sound(name) { if (sounds++ < 4) post({ type: 'sound', name: String(name) }); },
  note(freq, dur = 0.15) { if (sounds++ < 4) post({ type: 'note', freq: +freq || 440, dur: kit.clamp(+dur || 0.15, 0.03, 1) }); },
  puff(x, y, colors, n = 10) { if (!Array.isArray(colors) || !colors.length) colors = ['#ffd84d', '#ff9ed2', '#7fd4ff', '#fff']; n = kit.clamp(n | 0, 1, 40); for (let i = 0; i < n && parts.length < 400; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 200; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.5 + Math.random() * 0.6, c: colors[i % colors.length], r: 3 + Math.random() * 4 }); } },
  shake(a = 6) { shakeAmt = Math.max(shakeAmt, kit.clamp(+a || 0, 0, 16)); },
  say(text) { if (kit.t - sayAt > 5) { sayAt = kit.t; post({ type: 'say', text: String(text).slice(0, 90) }); } },
  win() { if (kit.t - wonAt < 2) return; wonAt = kit.t; post({ type: 'win' }); for (let i = 0; i < 8; i++) kit.puff(W * (0.1 + Math.random() * 0.8), H * (0.15 + Math.random() * 0.5), ['#ff5a8a', '#ffd84d', '#57b8ff', '#5fd47a', '#b58cff'], 18); },
};
function pt(e) { kit.pointer.x = e.clientX; kit.pointer.y = e.clientY; }
addEventListener('pointerdown', e => { pt(e); kit.pointer.down = true; kit.pointer.pressed = true; });
addEventListener('pointermove', e => { pt(e); });
addEventListener('pointerup', e => { pt(e); kit.pointer.down = false; kit.pointer.released = true; });
addEventListener('pointercancel', () => { kit.pointer.down = false; kit.pointer.released = true; });
for (const ev of ['touchstart', 'touchmove', 'gesturestart', 'dblclick', 'contextmenu']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
let paused = false, dead = false, frames = 0, lastT = 0;
addEventListener('message', e => { if (e.source === parent && e.data && e.data.gm) { if (e.data.type === 'pause') paused = !!e.data.on; } });
function fail(e) { if (dead) return; dead = true; post({ type: 'error', message: String(e && e.message || e).slice(0, 300), stack: String(e && e.stack || '').slice(0, 400), frames }); }

