/* SmartAction Sports — 3D signature moves inside the game.
   Picture-in-picture on highlights, full stage overlay from the "3D" button or a line-up card. Lazy-loaded by app.js. MIT. */
import { Stage3D, signatureMove, hasLibrary } from './stage3d.js';
export { signatureMove };

let stage = null, host = null, canvas = null, raf = 0, state = null;

function ensure(container) {
  if (host) return;
  host = document.getElementById('star3d') || document.createElement('div');
  if (!host.id) { host.id = 'star3d'; host.className = 'star3d'; container.appendChild(host); }
  canvas = host.querySelector('canvas') || host.appendChild(document.createElement('canvas'));
  const lite = matchMedia('(max-width: 780px)').matches || (navigator.hardwareConcurrency || 4) <= 4;
  stage = new Stage3D(canvas, { pixelRatio: Math.min(lite ? 1.25 : 2, window.devicePixelRatio || 1), shadows: !lite, antialias: !lite });
  host.querySelector('.star3d-close')?.addEventListener('click', () => stop('close'));
  new ResizeObserver(() => size()).observe(host);
}
function size() { if (!stage || host.hidden) return; const r = host.getBoundingClientRect(); stage.resize(Math.max(160, r.width), Math.max(90, r.height)); }

export function available(athlete) { return !!(athlete && hasLibrary(athlete.sport)); }

/* opts: { mode: 'pip' | 'full', moveId, uniform, title, subtitle, onEnd } */
export function play(container, athlete, opts = {}) {
  if (!available(athlete)) return false;
  ensure(container);
  const mode = opts.mode || 'pip';
  host.hidden = false; host.classList.toggle('full', mode === 'full'); host.classList.toggle('pip', mode !== 'full');
  host.querySelector('.star3d-title') && (host.querySelector('.star3d-title').textContent = opts.title || athlete.name);
  host.querySelector('.star3d-sub') && (host.querySelector('.star3d-sub').textContent = opts.subtitle || '');
  size();
  stage.load(athlete, opts.moveId || signatureMove(athlete), opts.uniform || 'teal');
  const hold = (stage.move.hold || 0.6) + 0.4, loops = mode === 'full' ? Infinity : 1;
  state = { t0: performance.now(), dur: stage.duration, hold, loops, mode, onEnd: opts.onEnd, angle0: mode === 'full' ? 25 : 40 };
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  return true;
}
function loop(now) {
  if (!state) return;
  const el = (now - state.t0) / 1000, cycle = state.dur + state.hold, n = Math.floor(el / cycle), t = el - n * cycle;
  if (n >= state.loops) { stop('end'); return; }
  stage.frame(Math.min(t, state.dur));
  const orb = stage.move.orbit, k = el / cycle;
  const ang = orb ? orb.base + orb.sweep * Math.sin(k * Math.PI * 2) : state.angle0 + k * (state.mode === 'full' ? 300 : 220);
  stage.placeCamera(ang, state.mode === 'full' ? 1.05 : 1.15);
  stage.render();
  const bar = host.querySelector('.star3d-progress i'); if (bar) bar.style.width = (Math.min(1, t / state.dur) * 100).toFixed(1) + '%';
  raf = requestAnimationFrame(loop);
}
export function stop(reason) {
  cancelAnimationFrame(raf); raf = 0;
  const s = state; state = null;
  if (host) host.hidden = true;
  if (s && s.onEnd) s.onEnd(reason || 'stop');
}
export function isOpen() { return !!state; }
export function mode() { return state ? state.mode : null; }
