/* SmartAction Sports — 3D signature moves: racket & net sports (tennis, soft tennis, badminton, table tennis, squash,
   volleyball, beach volleyball, sepak takraw). Stylized animation of publicly known playing styles; generic venues and
   equipment (no logos or brand marks). Everything is authored for right-handers; left-handers are mirrored. MIT. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { poseTrack, vecTrack, numTrack, gait, addPose, arc, span, smooth, lerp, clamp } from '../motion.js';
import { aimBone } from '../rig.js';
import { canvasTex, add, rng, crowd } from '../scenes.js';

export const SPORTS = ['tennis', 'soft-tennis', 'badminton', 'tabletennis', 'squash', 'volleyball', 'beach-volleyball', 'sepak-takraw'];

const D2R = Math.PI / 180, V3 = THREE.Vector3, UPY = new V3(0, 1, 0);
const _mats = new Map();
function M(color, o = {}) { const k = color + JSON.stringify(o); if (!_mats.has(k)) _mats.set(k, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.02 }, o))); return _mats.get(k); }
const dirL = (yaw, pitch) => { const y = yaw * D2R, p = pitch * D2R; return [Math.cos(p) * Math.cos(y), Math.sin(p), Math.cos(p) * Math.sin(y)]; };
const v3 = a => new V3(a[0], a[1], a[2]);

/* =================================================================== venue helpers */
function skyTex(top, mid, bottom) {
  return canvasTex(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, w, h); });
}
function planks(base, n = 48) {
  return canvasTex(1024, 1024, (x, w, h) => {
    const c = new THREE.Color(base);
    for (let i = 0; i < n; i++) { const v = 0.88 + ((i * 37) % 11) / 80; x.fillStyle = `rgb(${Math.round(c.r * 255 * v)},${Math.round(c.g * 255 * v)},${Math.round(c.b * 255 * v)})`; x.fillRect(i * w / n, 0, w / n + 1, h); }
    const r = rng(5); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(80,45,20,${r() * 0.07})`; x.fillRect(r() * w, r() * h, 2, 20 + r() * 60); }
    for (let i = 0; i < n; i++) { x.fillStyle = 'rgba(60,35,15,.22)'; x.fillRect(i * w / n, 0, 1.2, h); }
  }, [6, 6]);
}
/* stands of spectators: [x, z, yaw, width, centreY, height] */
function stands(g, rects, seed, base = '#232a33') {
  const tex = crowd(2048, 448, seed, base);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: '#c9ced4', emissive: '#0d1116', emissiveIntensity: 1 });
  for (const [px, pz, ry, w, y, h] of rects) { const m = add(g, new THREE.PlaneGeometry(w, h), mat, [px, y, pz], [-0.28, ry, 0, 'YXZ'], false); m.receiveShadow = false; }
}
function ceilingLights(g, xs, zs, y) { const m = new THREE.MeshBasicMaterial({ color: '#fff6e0' }); for (const x of xs) for (const z of zs) add(g, new THREE.BoxGeometry(1.6, 0.12, 0.5), m, [x, y, z], null, false); }
function netTex(color, cells = 8) {
  return canvasTex(128, 128, (x, w) => { x.clearRect(0, 0, w, w); x.strokeStyle = color; x.lineWidth = 2.2; const s = w / cells; for (let i = 0; i <= cells; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, w); x.stroke(); x.beginPath(); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke(); } }, [1, 1]);
}
/* a net between two posts: o = { half, z, top(x), bottom(x), cell, tape, tapeBottom, color, post: { x, r, h, color }, antenna: x } */
function makeNet(g, o) {
  const W = o.half * 2, segs = 24, depth0 = o.top(0) - o.bottom(0);
  const tex = netTex(o.color || '#1b1d1f'); tex.repeat.set(W / (8 * o.cell), depth0 / (8 * o.cell));
  const geo = new THREE.PlaneGeometry(W, 1, segs, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) > 0 ? o.top(x) : o.bottom(x)); }
  geo.computeVertexNormals();
  const net = add(g, geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false }), [0, 0, o.z || 0], null, false);
  net.castShadow = true;
  const white = M('#f4f4ef', { roughness: 0.6 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#f4f4ef', roughness: 0.6, side: THREE.DoubleSide });
  const band = (yf, h) => {   // flat ribbon folded over the cord
    const n = 16, pos = [], idx = [];
    for (let i = 0; i <= n; i++) { const x = -o.half + W * i / n, y = yf(x); pos.push(x, y - h, 0.006, x, y, 0.006, x, y, -0.006, x, y - h, -0.006); }
    for (let i = 0; i < n; i++) { const a = i * 4, b = a + 4; for (const [p0, p1] of [[0, 1], [1, 2], [2, 3]]) idx.push(a + p0, b + p0, b + p1, a + p0, b + p1, a + p1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return add(g, geo, tapeMat, [0, 0, o.z || 0], null, true);
  };
  if (o.tape) band(o.top, o.tape);
  if (o.tapeBottom) band(x => o.bottom(x) + o.tapeBottom, o.tapeBottom);
  void white;
  if (o.post) for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(o.post.r, o.post.r, o.post.h, 12), M(o.post.color || '#2b3036', { roughness: 0.45, metalness: 0.4 }), [s * o.post.x, o.post.h / 2, o.z || 0]);
  if (o.antenna) {
    const stripes = canvasTex(8, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f4f4ef' : '#d63a2c'; x.fillRect(0, i * h / 8, w, h / 8); } });
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.005, 0.005, 1.8, 6), new THREE.MeshStandardMaterial({ map: stripes }), [s * o.antenna, o.top(o.antenna) - 1.0 + 0.9, o.z || 0]);
  }
  return net;
}
/* court surface texture drawn with a callback in metres: draw(ctx, X, Z, k) */
function courtTex(wM, lM, pxW, pxL, draw) {
  return canvasTex(pxW, pxL, (x, w, h) => { const k = w / wM, X = v => (v + wM / 2) * k, Z = v => (v + lM / 2) * k; draw(x, X, Z, k, w, h); });
}
function lineFns(x, X, Z, k, color) {
  x.strokeStyle = color; x.fillStyle = color;
  return {
    L(x0, z0, x1, z1, wd = 0.05) { x.lineWidth = wd * k; x.beginPath(); x.moveTo(X(x0), Z(z0)); x.lineTo(X(x1), Z(z1)); x.stroke(); },
    R(x0, z0, x1, z1, wd = 0.05) { x.lineWidth = wd * k; x.strokeRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k); },
    C(cx, cz, r, a0, a1, wd = 0.04) { x.lineWidth = wd * k; x.beginPath(); x.arc(X(cx), Z(cz), r * k, a0, a1); x.stroke(); }
  };
}
function speckle(x, w, h, seed, n, rgba) { const r = rng(seed); for (let i = 0; i < n; i++) { x.fillStyle = rgba(r()); x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } }

/* =================================================================== venues */
/* Tennis: net centre at the origin, court along Z (baselines z = ±11.885), athlete on the −Z half facing +Z. */
function buildTennis(scene, soft) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = skyTex('#5b98d4', '#a7cbe8', '#e3edf0'); scene.fog = new THREE.Fog('#cfdfe8', 45, 130);
  const Wd = 18.3, Ln = 36.6, inner = soft ? '#3f6f4c' : '#2d5d97', outer = soft ? '#a24b37' : '#3b7c5b';
  const surf = courtTex(Wd, Ln, 1024, 2048, (x, X, Z, k, w, h) => {
    x.fillStyle = outer; x.fillRect(0, 0, w, h); x.fillStyle = inner; x.fillRect(X(-5.485), Z(-11.885), 10.97 * k, 23.77 * k);
    speckle(x, w, h, 3, 9000, r => `rgba(255,255,255,${0.025 + r * 0.03})`);
    const { L } = lineFns(x, X, Z, k, '#f4f4ef');
    for (const s of [-1, 1]) { L(-5.485, s * 11.885, 5.485, s * 11.885, 0.08); L(s * 5.485, -11.885, s * 5.485, 11.885); L(s * 4.115, -11.885, s * 4.115, 11.885); L(-4.115, s * 6.4, 4.115, s * 6.4); L(0, s * 11.885, 0, s * 11.75); }
    L(0, -6.4, 0, 6.4);
  });
  add(g, new THREE.PlaneGeometry(Wd, Ln), new THREE.MeshStandardMaterial({ map: surf, roughness: 0.8 }), [0, 0, 0], [-Math.PI / 2, 0, 0], false);
  add(g, new THREE.PlaneGeometry(140, 140), M('#30553f', { roughness: 0.95 }), [0, -0.01, 0], [-Math.PI / 2, 0, 0], false);
  makeNet(g, { half: 6.4, top: x => 0.914 + 0.156 * (x / 6.4) ** 2, bottom: () => 0.05, cell: 0.045, tape: 0.065, post: { x: 6.4, r: 0.045, h: 1.09, color: '#203c33' } });
  add(g, new THREE.BoxGeometry(0.05, 0.88, 0.012), M('#f4f4ef'), [0, 0.47, 0], null, false);   // centre strap
  const wind = M('#1d4636', { roughness: 0.9 });
  for (const s of [-1, 1]) { add(g, new THREE.BoxGeometry(Wd + 0.2, 3.0, 0.08), wind, [0, 1.5, s * (Ln / 2 + 0.04)]); add(g, new THREE.BoxGeometry(0.08, 1.0, Ln), wind, [s * (Wd / 2 + 0.04), 0.5, 0]); }
  // umpire's chair (generic)
  const ch = M('#2a3a44', { roughness: 0.6 });
  for (const [px, pz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) add(g, new THREE.BoxGeometry(0.05, 1.9, 0.05), ch, [7.4 + px, 0.95, pz]);
  add(g, new THREE.BoxGeometry(0.75, 0.08, 0.75), ch, [7.4, 1.9, 0]); add(g, new THREE.BoxGeometry(0.08, 0.7, 0.75), ch, [7.75, 2.25, 0]);
  stands(g, [[0, -25, 0, 44, 6, 10], [0, 25, Math.PI, 44, 6, 10], [-15, 0, Math.PI / 2, 52, 5.2, 8], [15, 0, -Math.PI / 2, 52, 5.2, 8]], soft ? 21 : 13);
  return { group: g };
}

/* Badminton: net centre at the origin, court 13.4 × 6.1 along Z. */
function buildBadminton(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = new THREE.Color('#14181d'); scene.fog = new THREE.Fog('#14181d', 26, 64);
  add(g, new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: planks('#c99a64'), roughness: 0.45 }), [0, -0.005, 0], [-Math.PI / 2, 0, 0], false);
  const mat = courtTex(8.6, 16.4, 1024, 2048, (x, X, Z, k, w, h) => {
    x.fillStyle = '#2f7a57'; x.fillRect(0, 0, w, h); speckle(x, w, h, 8, 5000, r => `rgba(0,0,0,${0.03 + r * 0.04})`);
    const { L, R } = lineFns(x, X, Z, k, '#f5f5ef');
    R(-3.05, -6.7, 3.05, 6.7, 0.04);
    for (const s of [-1, 1]) { L(s * 2.59, -6.7, s * 2.59, 6.7, 0.04); L(-3.05, s * 1.98, 3.05, s * 1.98, 0.04); L(-3.05, s * 5.94, 3.05, s * 5.94, 0.04); L(0, s * 1.98, 0, s * 6.7, 0.04); }
  });
  add(g, new THREE.PlaneGeometry(8.6, 16.4), new THREE.MeshStandardMaterial({ map: mat, roughness: 0.75 }), [0, 0.004, 0], [-Math.PI / 2, 0, 0], false);
  makeNet(g, { half: 3.05, top: x => 1.524 + 0.026 * (x / 3.05) ** 2, bottom: x => 0.764 + 0.026 * (x / 3.05) ** 2, cell: 0.019, tape: 0.075, color: '#2a2018', post: { x: 3.05, r: 0.025, h: 1.55, color: '#1f2a33' } });
  for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.22, 0.25, 0.08, 16), M('#1f2a33'), [s * 3.05, 0.04, 0]);
  const board = M('#1e3550', { roughness: 0.7 }), board2 = M('#2b5a6e', { roughness: 0.7 });
  for (const s of [-1, 1]) { add(g, new THREE.BoxGeometry(12, 0.8, 0.1), s > 0 ? board : board2, [0, 0.4, s * 10.5]); add(g, new THREE.BoxGeometry(0.1, 0.8, 21), board, [s * 6.5, 0.4, 0]); }
  add(g, new THREE.BoxGeometry(30, 9, 0.2), M('#162231', { roughness: 1 }), [0, 4.5, -15]); add(g, new THREE.BoxGeometry(30, 9, 0.2), M('#162231', { roughness: 1 }), [0, 4.5, 15]);
  stands(g, [[-11, 0, Math.PI / 2, 30, 5, 8], [11, 0, -Math.PI / 2, 30, 5, 8]], 31);
  ceilingLights(g, [-4, 0, 4], [-6, 0, 6], 12);
  return { group: g };
}

/* Table tennis: table centre (net) at the origin, length along Z; top surface at y = 0.76. */
const TT = { L: 2.74, W: 1.525, H: 0.76, net: 0.1525 };
function buildTableTennis(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = new THREE.Color('#121519'); scene.fog = new THREE.Fog('#121519', 22, 55);
  add(g, new THREE.PlaneGeometry(40, 40), M('#262b31', { roughness: 0.9 }), [0, -0.006, 0], [-Math.PI / 2, 0, 0], false);
  const fl = canvasTex(256, 512, (x, w, h) => { x.fillStyle = '#7a3029'; x.fillRect(0, 0, w, h); speckle(x, w, h, 4, 2500, r => `rgba(0,0,0,${0.05 + r * 0.05})`); });
  add(g, new THREE.PlaneGeometry(7, 14), new THREE.MeshStandardMaterial({ map: fl, roughness: 0.6 }), [0, 0, 0], [-Math.PI / 2, 0, 0], false);
  const bar = M('#20365e', { roughness: 0.65 }), trim = M('#e7eef5', { roughness: 0.6 });
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(7, 0.72, 0.04), bar, [0, 0.36, s * 7]); add(g, new THREE.BoxGeometry(7, 0.03, 0.05), trim, [0, 0.735, s * 7]);
    add(g, new THREE.BoxGeometry(0.04, 0.72, 14), bar, [s * 3.5, 0.36, 0]); add(g, new THREE.BoxGeometry(0.05, 0.03, 14), trim, [s * 3.5, 0.735, 0]);
  }
  // the table: top, white edge lines and centre line, legs with undercarriage
  const top = courtTex(TT.W, TT.L, 512, 1024, (x, X, Z, k, w, h) => {
    x.fillStyle = '#1d4f8c'; x.fillRect(0, 0, w, h); speckle(x, w, h, 9, 1500, r => `rgba(255,255,255,${0.02 + r * 0.03})`);
    x.fillStyle = '#f6f6f2'; const e = 0.02 * k; x.fillRect(0, 0, w, e); x.fillRect(0, h - e, w, e); x.fillRect(0, 0, e, h); x.fillRect(w - e, 0, e, h); x.fillRect(w / 2 - 0.0015 * k, 0, 0.003 * k + 1, h);
  });
  const tm = new THREE.MeshStandardMaterial({ map: top, roughness: 0.42 });
  add(g, new THREE.BoxGeometry(TT.W, 0.025, TT.L), [M('#173f70'), M('#173f70'), tm, M('#173f70'), M('#f2f2ee'), M('#f2f2ee')], [0, TT.H - 0.0125, 0]);
  const steel = M('#2a2e33', { roughness: 0.45, metalness: 0.5 });
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.045, TT.H - 0.03, 0.045), steel, [sx * 0.6, (TT.H - 0.03) / 2, sz * 1.05]);
  for (const sz of [-1, 1]) { add(g, new THREE.BoxGeometry(1.24, 0.04, 0.04), steel, [0, 0.12, sz * 1.05]); add(g, new THREE.BoxGeometry(1.3, 0.06, 0.06), steel, [0, TT.H - 0.07, sz * 0.9]); }
  add(g, new THREE.BoxGeometry(0.06, 0.06, 2.2), steel, [0, TT.H - 0.08, 0]);
  makeNet(g, { half: 0.915, top: () => TT.H + TT.net, bottom: () => TT.H + 0.003, cell: 0.012, tape: 0.015, color: '#1a2a44', post: { x: 0.925, r: 0.012, h: 0.001, color: '#1f2a33' } });
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.03, TT.net + 0.03, 0.05), M('#1a2a44'), [s * 0.93, TT.H + TT.net / 2 - 0.01, 0]);
  // umpire's table and towel box (generic)
  add(g, new THREE.BoxGeometry(0.6, 0.72, 0.5), M('#20365e'), [2.7, 0.36, 0]); add(g, new THREE.BoxGeometry(0.4, 0.5, 0.3), M('#3d4650'), [-3.0, 0.25, -5.6]);
  stands(g, [[0, -12, 0, 30, 4.8, 7], [0, 12, Math.PI, 30, 4.8, 7], [-9, 0, Math.PI / 2, 26, 4.8, 7], [9, 0, -Math.PI / 2, 26, 4.8, 7]], 41);
  ceilingLights(g, [-2, 2], [-3, 3], 7);
  return { group: g };
}

/* Squash: court centre on the floor at the origin; front wall at z = +4.875, glass back wall at z = −4.875, x = ±3.2. */
const SQ = { hx: 3.2, front: 4.875, back: -4.875 };
function buildSquash(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = new THREE.Color('#101317'); scene.fog = new THREE.Fog('#101317', 20, 46);
  add(g, new THREE.PlaneGeometry(40, 40), M('#1c2026', { roughness: 0.95 }), [0, -0.006, 0], [-Math.PI / 2, 0, 0], false);
  const fl = courtTex(6.4, 9.75, 512, 768, (x, X, Z, k, w, h) => {
    const n = 26; for (let i = 0; i < n; i++) { const v = 0.92 + ((i * 29) % 9) / 90; x.fillStyle = `rgb(${Math.round(226 * v)},${Math.round(192 * v)},${Math.round(146 * v)})`; x.fillRect(i * w / n, 0, w / n + 1, h); }
    const { L } = lineFns(x, X, Z, k, '#c8312a'), sl = SQ.front - 5.44;
    L(-3.2, sl, 3.2, sl); L(0, sl, 0, SQ.back);
    for (const s of [-1, 1]) { L(s * 1.6, sl, s * 1.6, sl - 1.6); L(s * 1.6, sl - 1.6, s * 3.2, sl - 1.6); }
  });
  add(g, new THREE.PlaneGeometry(6.4, 9.75), new THREE.MeshStandardMaterial({ map: fl, roughness: 0.45 }), [0, 0, 0], [-Math.PI / 2, 0, 0], false);
  // front wall with out line, service line and the tin
  const fw = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#f1f0eb'; x.fillRect(0, 0, w, h); const k = h / 5.2, Y = y => h - y * k;
    x.fillStyle = '#c8312a'; x.fillRect(0, Y(4.57) - 0.025 * k, w, 0.05 * k); x.fillRect(0, Y(1.78) - 0.025 * k, w, 0.05 * k); x.fillRect(0, Y(0.48) - 0.025 * k, w, 0.05 * k);
  });
  add(g, new THREE.PlaneGeometry(6.4, 5.2), new THREE.MeshStandardMaterial({ map: fw, roughness: 0.8 }), [0, 2.6, SQ.front], [0, Math.PI, 0], false);
  add(g, new THREE.BoxGeometry(6.4, 0.455, 0.04), M('#d9dde2', { roughness: 0.35, metalness: 0.5 }), [0, 0.2275, SQ.front - 0.02]);
  // glass side and back walls with painted red out lines
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
  // glass walls: their painted lines and frames fade when the camera looks through them from outside
  const fadeM = () => ({ red: new THREE.MeshStandardMaterial({ color: '#c8312a', roughness: 0.6, transparent: true }), frame: new THREE.MeshStandardMaterial({ color: '#262a30', roughness: 0.5, metalness: 0.4, transparent: true }) });
  const walls = { l: fadeM(), r: fadeM(), b: fadeM() };
  for (const s of [-1, 1]) {
    const W = walls[s > 0 ? 'l' : 'r'];
    add(g, new THREE.PlaneGeometry(9.75, 4.6), glass, [s * SQ.hx, 2.3, 0], [0, Math.PI / 2, 0], false);
    const len = Math.hypot(9.75, 4.57 - 2.13), ang = Math.atan2(4.57 - 2.13, 9.75);
    add(g, new THREE.BoxGeometry(0.02, 0.05, len), W.red, [s * (SQ.hx - 0.01), (4.57 + 2.13) / 2, 0], [-ang, 0, 0], false);
    for (const z of [-1.6, 1.6]) add(g, new THREE.BoxGeometry(0.06, 4.6, 0.04), W.frame, [s * (SQ.hx + 0.03), 2.3, z], null, false);
    add(g, new THREE.BoxGeometry(0.08, 0.08, 9.75), W.frame, [s * (SQ.hx + 0.03), 4.6, 0], null, false);
  }
  add(g, new THREE.PlaneGeometry(6.4, 4.6), glass, [0, 2.3, SQ.back], null, false);
  add(g, new THREE.BoxGeometry(6.4, 0.05, 0.02), walls.b.red, [0, 2.13, SQ.back + 0.01], null, false);
  add(g, new THREE.BoxGeometry(6.4, 0.08, 0.08), walls.b.frame, [0, 4.6, SQ.back], null, false);
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.06, 4.6, 0.06), walls.b.frame, [s * (SQ.hx + 0.03), 2.3, SQ.back], null, false);
  const fade = (W, outside) => { const o = outside ? 0.15 : 1; W.red.opacity = o; W.frame.opacity = o; W.red.depthWrite = W.frame.depthWrite = !outside; };
  stands(g, [[0, -10, 0, 22, 4, 7], [-8.5, 0, Math.PI / 2, 18, 4, 7], [8.5, 0, -Math.PI / 2, 18, 4, 7]], 51);
  ceilingLights(g, [-1.6, 1.6], [-2.5, 2.5], 6.5);
  return {
    group: g,
    // keep the camera inside the room in front of the solid front wall (the other walls are glass)
    clampCamera(p) { p.z = Math.min(p.z, SQ.front - 0.45); if (p.z > SQ.front - 2.5) { p.y = Math.min(p.y, 3.6); } },
    onCamera(p) { fade(walls.b, p.z < SQ.back + 0.25); fade(walls.l, p.x > SQ.hx - 0.25); fade(walls.r, p.x < -SQ.hx + 0.25); }
  };
}

/* Volleyball (indoor): net centre at the origin, court 18 × 9 along Z. */
function buildVolley(scene, netH) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = new THREE.Color('#15181d'); scene.fog = new THREE.Fog('#15181d', 30, 70);
  const fl = courtTex(17, 28, 1024, 1680, (x, X, Z, k, w, h) => {
    x.fillStyle = '#2a6c9c'; x.fillRect(0, 0, w, h); x.fillStyle = '#d98a3c'; x.fillRect(X(-4.5), Z(-9), 9 * k, 18 * k);
    speckle(x, w, h, 6, 6000, r => `rgba(255,255,255,${0.02 + r * 0.03})`);
    const { L, R } = lineFns(x, X, Z, k, '#f6f6f0'); R(-4.5, -9, 4.5, 9); L(-4.5, 0, 4.5, 0); L(-4.5, -3, 4.5, -3); L(-4.5, 3, 4.5, 3);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { L(-4.5 - 0.3 - i * 0.35, s * 3, -4.5 - 0.45 - i * 0.35, s * 3); L(4.5 + 0.3 + i * 0.35, s * 3, 4.5 + 0.45 + i * 0.35, s * 3); }
  });
  add(g, new THREE.PlaneGeometry(17, 28), new THREE.MeshStandardMaterial({ map: fl, roughness: 0.5 }), [0, 0, 0], [-Math.PI / 2, 0, 0], false);
  add(g, new THREE.PlaneGeometry(60, 60), M('#1f2329', { roughness: 0.95 }), [0, -0.006, 0], [-Math.PI / 2, 0, 0], false);
  makeNet(g, { half: 5.0, top: () => netH, bottom: () => netH - 1.0, cell: 0.1, tape: 0.07, tapeBottom: 0.05, color: '#16181a', antenna: 4.5 });
  // posts with padding (and the referee's stand) fade out when the camera passes right behind them
  const side = { [-1]: [], [1]: [] }, tm = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, transparent: true });
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.05, 1.0, 0.012), M('#f4f4ef'), [s * 4.5, netH - 0.5, 0], null, false);
    const pm = tm('#2e3a46'), pad = tm('#24557e'); side[s].push(pm, pad);
    add(g, new THREE.CylinderGeometry(0.05, 0.05, netH + 0.1, 12), pm, [s * 5.5, (netH + 0.1) / 2, 0]); add(g, new THREE.CylinderGeometry(0.13, 0.13, 1.8, 16), pad, [s * 5.5, 0.9, 0]);
  }
  const ref = tm('#2e3a46'); side[1].push(ref);
  add(g, new THREE.BoxGeometry(0.7, 1.1, 0.7), ref, [6.5, 0.55, 0]); add(g, new THREE.BoxGeometry(0.06, 1.0, 0.7), ref, [6.82, 1.6, 0]);
  stands(g, [[0, -19, 0, 40, 6, 10], [0, 19, Math.PI, 40, 6, 10], [-13.5, 0, Math.PI / 2, 36, 6, 10], [13.5, 0, -Math.PI / 2, 36, 6, 10]], 61);
  ceilingLights(g, [-5, 0, 5], [-8, 0, 8], 13);
  return { group: g, onCamera(p) { for (const s of [-1, 1]) { const near = s * p.x > 4.6 && Math.abs(p.z) < 3.2; for (const m of side[s]) { m.opacity = near ? 0.18 : 1; m.depthWrite = !near; } } } };
}

/* Beach volleyball: sand court 16 × 8 along Z, net centre at the origin. */
function buildBeach(scene, netH) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = skyTex('#4f93d6', '#9fd0f0', '#eef4f2'); scene.fog = new THREE.Fog('#d9e7ee', 50, 150);
  const sand = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#e2c697'; x.fillRect(0, 0, w, h); const r = rng(17); for (let i = 0; i < 14000; i++) { const v = r(); x.fillStyle = v < 0.5 ? `rgba(160,120,70,${0.12 + r() * 0.12})` : `rgba(255,248,230,${0.15 + r() * 0.2})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } }, [24, 24]);
  add(g, new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }), [0, 0, 0], [-Math.PI / 2, 0, 0], false);
  // boundary tapes (blue) lying on the sand
  const tape = M('#2459b5', { roughness: 0.7 });
  for (const s of [-1, 1]) { add(g, new THREE.BoxGeometry(8.1, 0.008, 0.05), tape, [0, 0.004, s * 8], null, false); add(g, new THREE.BoxGeometry(0.05, 0.008, 16), tape, [s * 4, 0.004, 0], null, false); }
  makeNet(g, { half: 4.25, top: () => netH, bottom: () => netH - 1.0, cell: 0.1, tape: 0.07, tapeBottom: 0.05, color: '#17191b', post: { x: 5.0, r: 0.06, h: netH + 0.15, color: '#d8dde2' }, antenna: 4.0 });
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.05, 1.0, 0.012), M('#2459b5'), [s * 4.0, netH - 0.5, 0], null, false);
  // sea, horizon and bleachers
  const sea = canvasTex(16, 128, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3f86b8'); gr.addColorStop(1, '#2a6d9a'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  add(g, new THREE.PlaneGeometry(400, 160), new THREE.MeshBasicMaterial({ map: sea }), [0, -0.02, 125], [-Math.PI / 2, 0, 0], false);
  stands(g, [[0, -22, 0, 36, 3.2, 5], [-16, -2, Math.PI / 2, 26, 3.2, 5], [16, -2, -Math.PI / 2, 26, 3.2, 5]], 71, '#4d5c6b');
  for (const [px, pz] of [[-22, 30], [-16, 38], [20, 34]]) {   // palm trees
    add(g, new THREE.CylinderGeometry(0.18, 0.28, 8, 8), M('#8a6a45'), [px, 4, pz]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(g, new THREE.ConeGeometry(0.5, 3.6, 4), M('#3f7d3a'), [px + Math.cos(a) * 1.4, 7.6, pz + Math.sin(a) * 1.4], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2], false); }
  }
  return { group: g };
}

/* Sepak takraw: court 13.4 × 6.1 along Z, net centre at the origin. */
function buildTakraw(scene, netH) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = new THREE.Color('#13171c'); scene.fog = new THREE.Fog('#13171c', 26, 64);
  add(g, new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: planks('#b98c5c'), roughness: 0.5 }), [0, -0.005, 0], [-Math.PI / 2, 0, 0], false);
  const fl = courtTex(9.1, 16.4, 1024, 1840, (x, X, Z, k, w, h) => {
    x.fillStyle = '#2c6f63'; x.fillRect(0, 0, w, h); x.fillStyle = '#2f5f9a'; x.fillRect(X(-3.05), Z(-6.7), 6.1 * k, 13.4 * k);
    speckle(x, w, h, 12, 5000, r => `rgba(255,255,255,${0.02 + r * 0.03})`);
    const { L, R, C } = lineFns(x, X, Z, k, '#f6f6f0'); R(-3.05, -6.7, 3.05, 6.7, 0.04); L(-3.05, 0, 3.05, 0, 0.02);
    C(-3.05, 0, 0.9, -Math.PI / 2, Math.PI / 2); C(3.05, 0, 0.9, Math.PI / 2, Math.PI * 1.5);
    for (const s of [-1, 1]) C(0, s * 4.25, 0.3, 0, Math.PI * 2);
  });
  add(g, new THREE.PlaneGeometry(9.1, 16.4), new THREE.MeshStandardMaterial({ map: fl, roughness: 0.55 }), [0, 0.003, 0], [-Math.PI / 2, 0, 0], false);
  makeNet(g, { half: 3.35, top: x => netH + 0.03 * (x / 3.35) ** 2, bottom: x => netH - 0.7 + 0.03 * (x / 3.35) ** 2, cell: 0.05, tape: 0.05, tapeBottom: 0.05, color: '#1a1c1e', post: { x: 3.35, r: 0.04, h: netH + 0.06, color: '#2e3a46' } });
  const board = M('#283f5a', { roughness: 0.7 });
  for (const s of [-1, 1]) { add(g, new THREE.BoxGeometry(14, 0.8, 0.1), board, [0, 0.4, s * 11]); add(g, new THREE.BoxGeometry(0.1, 0.8, 22), board, [s * 7, 0.4, 0]); }
  stands(g, [[0, -15, 0, 30, 5, 8], [0, 15, Math.PI, 30, 5, 8], [-11, 0, Math.PI / 2, 28, 5, 8], [11, 0, -Math.PI / 2, 28, 5, 8]], 81);
  ceilingLights(g, [-4, 0, 4], [-6, 0, 6], 11);
  return { group: g };
}

/* =================================================================== props */
const RK = {
  tennis: { L: 0.685, hl: 0.33, hw: 0.255, grip: 0.19, gr: 0.0155, tube: 0.011, frame: '#22282e', accent: '#d8553f', str: '#f1efe4', gripC: '#f1efe8', cell: 0.0165 },
  soft: { L: 0.66, hl: 0.3, hw: 0.235, grip: 0.18, gr: 0.0145, tube: 0.008, frame: '#e2e6ea', accent: '#2f6fb0', str: '#f6f6ee', gripC: '#2a3036', cell: 0.0155 },
  badminton: { L: 0.665, hl: 0.235, hw: 0.2, grip: 0.2, gr: 0.0135, tube: 0.0055, shaft: 0.0045, frame: '#1d2428', accent: '#e8c547', str: '#f6f6f0', gripC: '#e9e9e2', cell: 0.0085 },
  squash: { L: 0.686, hl: 0.255, hw: 0.21, grip: 0.2, gr: 0.0145, tube: 0.0085, frame: '#2b2f36', accent: '#2fb3a5', str: '#f2efe2', gripC: '#20262b', cell: 0.0125 }
};
function rod(parent, a, b, r, mat, seg = 6) {
  const d = new V3().subVectors(b, a), L = d.length(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UPY, d.normalize()); parent.add(m); return m;
}
/* racket along +Y (butt at the origin), string bed in the XY plane (face normal ±Z). userData.head = head centre y */
function makeRacket(kind) {
  const S = RK[kind], g = new THREE.Group();
  const fm = M(S.frame, { roughness: 0.32, metalness: 0.35 }), am = M(S.accent, { roughness: 0.4, metalness: 0.2 }), gm = M(S.gripC, { roughness: 0.85 });
  add(g, new THREE.CylinderGeometry(S.gr, S.gr * 0.92, S.grip, 8), gm, [0, S.grip / 2, 0]);
  add(g, new THREE.CylinderGeometry(S.gr * 1.18, S.gr * 1.1, 0.014, 8), fm, [0, 0.007, 0]);
  const hb = S.L - S.hl, hc = S.L - S.hl / 2;
  if (S.shaft) { rod(g, new V3(0, S.grip - 0.01, 0), new V3(0, hb + 0.006, 0), S.shaft, fm); add(g, new THREE.CylinderGeometry(S.gr * 0.7, S.shaft, 0.03, 8), am, [0, S.grip + 0.012, 0]); }
  else {
    for (const sx of [-1, 1]) rod(g, new V3(0, S.grip + 0.012, 0), new V3(sx * S.hw * 0.3, hb + 0.035, 0), S.tube * 0.95, fm);
    rod(g, new V3(-S.hw * 0.3, hb + 0.035, 0), new V3(S.hw * 0.3, hb + 0.035, 0), S.tube * 0.8, fm);
    add(g, new THREE.CylinderGeometry(S.gr * 0.9, S.gr * 0.9, 0.03, 8), am, [0, S.grip + 0.006, 0]);
  }
  const pts = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; pts.push(new V3(Math.sin(a) * S.hw / 2, hc + Math.cos(a) * S.hl / 2, 0)); }
  add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 56, S.tube, 6, true), fm);
  const top = []; for (let i = -5; i <= 5; i++) { const a = i / 28 * Math.PI * 2; top.push(new V3(Math.sin(a) * (S.hw / 2 + 0.0015), hc + Math.cos(a) * (S.hl / 2 + 0.0015), 0)); }
  add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top), 16, S.tube * 1.08, 6, false), am);
  const st = canvasTex(128, 128, (x, w) => { x.clearRect(0, 0, w, w); x.strokeStyle = S.str; x.lineWidth = 2.4; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 16 + 8, 0); x.lineTo(i * 16 + 8, w); x.stroke(); x.beginPath(); x.moveTo(0, i * 16 + 8); x.lineTo(w, i * 16 + 8); x.stroke(); } }, [1 / (8 * S.cell), 1 / (8 * S.cell)]);
  const shape = new THREE.Shape(); shape.absellipse(0, 0, S.hw / 2 - S.tube * 0.6, S.hl / 2 - S.tube * 0.6, 0, Math.PI * 2, false, 0);
  add(g, new THREE.ShapeGeometry(shape, 24), new THREE.MeshStandardMaterial({ map: st, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 0.6 }), [0, hc, 0], null, false);
  g.userData = { head: hc, len: S.L, kind };
  return g;
}
/* table-tennis bat (blade + red / black rubbers), along +Y, face normal ±Z */
function makePaddle() {
  const g = new THREE.Group(), wood = M('#c9a066', { roughness: 0.7 });
  add(g, new THREE.BoxGeometry(0.03, 0.1, 0.024), wood, [0, 0.05, 0]); add(g, new THREE.BoxGeometry(0.036, 0.022, 0.026), M('#8a5a2c'), [0, 0.098, 0]);
  const hc = 0.1 + 0.074;
  const disc = (r, th, mat, z) => { const m = add(g, new THREE.CylinderGeometry(r, r, th, 28), mat, [0, hc, z], [Math.PI / 2, 0, 0]); m.scale.set(1, 1, 1.05); return m; };
  disc(0.076, 0.0058, wood, 0); disc(0.0745, 0.0022, M('#c5241f', { roughness: 0.75 }), 0.004); disc(0.0745, 0.0022, M('#18191a', { roughness: 0.75 }), -0.004);
  g.userData = { head: hc, len: 0.25, kind: 'tt' };
  return g;
}
function seamBall(r, base, seam) {
  const tex = canvasTex(128, 64, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); if (seam) { x.strokeStyle = seam; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= 64; i++) { const u = i / 64; x.lineTo(u * w, h / 2 + Math.sin(u * Math.PI * 4) * h * 0.27); } x.stroke(); } });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); m.castShadow = true; return m;
}
const makeTennisBall = () => seamBall(0.0335, '#d6ee3c', '#f6f8e8');
const makeSoftBall = () => seamBall(0.033, '#f4f3ee', null);
const makeTTBall = () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), M('#f7f5ef', { roughness: 0.35 })); m.castShadow = true; return m; };
function makeSquashBall() {
  const tex = canvasTex(64, 32, (x, w, h) => { x.fillStyle = '#121314'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2d23a'; for (const cx of [16, 48]) { x.beginPath(); x.arc(cx, 16, 3, 0, Math.PI * 2); x.fill(); } });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); m.castShadow = true; return m;
}
function makeVolleyball() {
  const tex = canvasTex(256, 128, (x, w, h) => {
    const cols = ['#f3c431', '#2457a8', '#f6f5ef'];
    for (let i = 0; i < 6; i++) { x.fillStyle = cols[i % 3]; x.beginPath(); for (let k = 0; k <= 32; k++) { const u = k / 32; x.lineTo(u * w, (i / 6) * h + Math.sin(u * Math.PI * 2 + i) * h * 0.05); } for (let k = 32; k >= 0; k--) { const u = k / 32; x.lineTo(u * w, ((i + 1) / 6) * h + Math.sin(u * Math.PI * 2 + i + 1) * h * 0.05); } x.fill(); }
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1.2; for (let i = 1; i < 6; i++) { x.beginPath(); for (let k = 0; k <= 32; k++) { const u = k / 32; x.lineTo(u * w, (i / 6) * h + Math.sin(u * Math.PI * 2 + i) * h * 0.05); } x.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })); m.castShadow = true; return m;
}
function makeTakrawBall() {
  const tex = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#4a2d12'; x.fillRect(0, 0, w, h); x.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) for (let i = -8; i < 16; i++) { x.strokeStyle = pass ? '#f0b53a' : '#e09a28'; x.lineWidth = 9; x.beginPath(); const x0 = i * 22; x.moveTo(x0, 0); x.lineTo(x0 + (pass ? 64 : -64), h); x.stroke(); }
    x.strokeStyle = '#f7d26a'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, i * h / 6 + 10); x.lineTo(w, i * h / 6 + 10); x.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 })); m.castShadow = true; return m;
}
/* shuttlecock: cork leads along +Y */
function makeShuttle() {
  const g = new THREE.Group(), white = M('#f7f6f0', { roughness: 0.6 });
  add(g, new THREE.SphereGeometry(0.0128, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, [0, 0, 0]);
  add(g, new THREE.CylinderGeometry(0.0128, 0.0128, 0.012, 12), M('#e9e3d2'), [0, -0.006, 0]);
  add(g, new THREE.CylinderGeometry(0.0138, 0.0138, 0.005, 12), M('#2a6fb3'), [0, -0.013, 0]);
  const sk = canvasTex(64, 64, (x, w, h) => { x.fillStyle = 'rgba(250,250,246,.9)'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(120,120,120,.6)'; for (let i = 0; i < 16; i++) x.fillRect(i * 4, 0, 1, h); x.fillStyle = 'rgba(60,60,60,.5)'; x.fillRect(0, 20, w, 2); x.fillRect(0, 34, w, 2); });
  const skirt = add(g, new THREE.CylinderGeometry(0.0135, 0.034, 0.066, 16, 1, true), new THREE.MeshStandardMaterial({ map: sk, transparent: true, side: THREE.DoubleSide, roughness: 0.8, depthWrite: false }), [0, -0.048, 0]);
  void skirt; g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export const VENUES = {
  tennisCourt: { indoor: false, build: s => buildTennis(s, false), ball: makeTennisBall },
  softTennisCourt: { indoor: false, build: s => buildTennis(s, true), ball: makeSoftBall },
  badmintonHall: { indoor: true, build: buildBadminton, ball: makeShuttle },
  ttHall: { indoor: true, build: buildTableTennis, ball: makeTTBall },
  squashCourt: { indoor: true, build: buildSquash, ball: makeSquashBall },
  volleyCourtM: { indoor: true, build: s => buildVolley(s, 2.43), ball: makeVolleyball },
  volleyCourtW: { indoor: true, build: s => buildVolley(s, 2.24), ball: makeVolleyball },
  beachCourtM: { indoor: false, build: s => buildBeach(s, 2.43), ball: makeVolleyball },
  beachCourtW: { indoor: false, build: s => buildBeach(s, 2.24), ball: makeVolleyball },
  takrawCourtM: { indoor: true, build: s => buildTakraw(s, 1.52), ball: makeTakrawBall },
  takrawCourtW: { indoor: true, build: s => buildTakraw(s, 1.42), ball: makeTakrawBall }
};

/* =================================================================== motion infrastructure */
/* two-bone leg IK onto a world ankle target with a flat (or heel-raised) foot; side = rig side ('l'/'r') */
function legIK(env, side, ankle, down, toe, w) {
  const R = env.rig, B = R.bones, th = B[side + 'Thigh'], sn = B[side + 'Shin'], ft = B[side + 'Foot'];
  const fk = w < 1 ? [th.quaternion.clone(), sn.quaternion.clone(), ft.quaternion.clone()] : null;
  const S = th.getWorldPosition(new V3()), a = R.len.thigh, b = R.len.shin;
  const d = new V3().subVectors(ankle, S); const dist = clamp(d.length(), Math.abs(a - b) + 1e-3, a + b - 1e-4); d.normalize();
  const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const pole = new V3().copy(toe).add(new V3(0, 0.35, 0)); pole.addScaledVector(d, -pole.dot(d)); if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1); pole.normalize();
  const knee = S.clone().addScaledVector(d, a * cosA).addScaledVector(pole, a * sinA), tgt = S.clone().addScaledVector(d, dist);
  aimBone(th, new V3().subVectors(knee, S), pole); th.updateMatrixWorld(true);
  aimBone(sn, new V3().subVectors(tgt, knee), pole); sn.updateMatrixWorld(true);
  aimBone(ft, down, toe);
  if (fk) { th.quaternion.slerpQuaternions(fk[0], th.quaternion.clone(), w); sn.quaternion.slerpQuaternions(fk[1], sn.quaternion.clone(), w); ft.quaternion.slerpQuaternions(fk[2], ft.quaternion.clone(), w); }
  th.updateMatrixWorld(true);
}
/* planted feet: plants = { l: [[from, to, anchorTime, heel]], r: [...] } (authored sides). During a window the foot stays
   where the pose put it at anchorTime (flat on the floor, or on the ball of the foot with heel° lift). Removes foot sliding
   while the hips and shoulders rotate. */
function planter(plants) {
  let A = null;
  const heelOf = (h, t) => typeof h === 'function' ? h(t) : (h || 0);
  return {
    init(env, poseAt) {
      A = { l: [], r: [] };
      for (const s of ['l', 'r']) for (const [from, to, at, heel] of (plants[s] || [])) {
        env.pose(poseAt(at)); const ft = env.rig.bones[env.side(s) + 'Foot'];
        const p = ft.getWorldPosition(new V3()), toe = new V3(0, 0, 1).applyQuaternion(ft.getWorldQuaternion(new THREE.Quaternion())); toe.y = 0; toe.normalize();
        A[s].push({ from, to, p, toe, heel });
      }
    },
    apply(t, env, ground = 0) {
      if (!A) return;
      const R = env.rig, AH = R.len.ankle, F = R.len.foot, act = [];
      for (const s of ['l', 'r']) {
        let best = null, w = 0;
        for (const a of A[s]) { const k = Math.min(smooth(span(t, a.from - 0.07, a.from)), 1 - smooth(span(t, a.to, a.to + 0.07))); if (k > w) { w = k; best = a; } }
        if (!best || w <= 0) continue;
        const phi = heelOf(best.heel, t) * D2R, f = best.toe;
        const ball = new V3(best.p.x, ground, best.p.z).addScaledVector(f, 0.72 * F);
        const down = new V3(0, -Math.cos(phi), 0).addScaledVector(f, -Math.sin(phi)), toeAx = f.clone().multiplyScalar(Math.cos(phi)).add(new V3(0, -Math.sin(phi), 0));
        const ankle = ball.clone().addScaledVector(down, -AH).addScaledVector(toeAx, -0.72 * F);
        act.push({ side: env.side(s), ankle, down, toeAx, w });
      }
      if (!act.length) return;
      // lower the hips if a planted foot cannot be reached (keeps the foot on the floor)
      const hips = R.bones.hips, L = R.len.thigh + R.len.shin - 0.004; let drop = 0;
      for (const a of act) { const S = R.bones[a.side + 'Thigh'].getWorldPosition(new V3()); const h = Math.hypot(S.x - a.ankle.x, S.z - a.ankle.z), v = S.y - a.ankle.y; if (h < L && h * h + v * v > L * L) drop = Math.max(drop, (v - Math.sqrt(L * L - h * h)) * a.w); }
      if (drop > 0) { hips.position.y -= drop; R.root.updateMatrixWorld(true); }
      for (const a of act) legIK(env, a.side, a.ankle, a.down, a.toeAx, a.w);
      // never let a (free) foot end up under the floor because the hips were lowered
      let lo = Infinity; const v = new V3();
      for (const o of [R.heel_l, R.toe_l, R.heel_r, R.toe_r]) { o.getWorldPosition(v); lo = Math.min(lo, v.y); }
      if (lo < ground - 0.004) { hips.position.y += ground - lo; R.root.updateMatrixWorld(true); for (const a of act) legIK(env, a.side, a.ankle, a.down, a.toeAx, a.w); }
    }
  };
}
/* turn the head toward a world point (limited, blended) */
const _hq = new THREE.Quaternion(), _hm = new THREE.Matrix4();
function lookAt(env, target, w = 0.85, maxDeg = 75) {
  const head = env.rig.bones.head, hp = head.getWorldPosition(new V3());
  _hm.lookAt(target, hp, UPY); const want = new THREE.Quaternion().setFromRotationMatrix(_hm);
  const pq = head.parent.getWorldQuaternion(new THREE.Quaternion()).invert(); want.premultiply(pq);
  const fk = head.quaternion.clone(); const ang = 2 * Math.acos(clamp(Math.abs(fk.dot(want)), 0, 1)) / D2R;
  const k = ang > maxDeg ? maxDeg / ang : 1; head.quaternion.slerpQuaternions(fk, want, clamp(w * k, 0, 1)); head.updateMatrixWorld(true);
}
/* hold a racket / bat in the palm of the authored hand: tool shaft = hand's −Y, string bed parallel to the palm */
function holdTool(env, tool, side = 'r', slide = 0) {
  const hand = env.rig.bones[env.side(side) + 'Hand'], holder = new THREE.Group();
  holder.position.set(0, -0.012 * env.s + slide, 0.017 * env.s); holder.rotation.set(0, 0, Math.PI); holder.add(tool);
  env.addProp(holder, hand); return holder;
}
/* racket arm: hand (palm) position, shaft direction, palm normal and elbow pole. Directions are vectors (k.dir / k.palmV,
   keys at most ~100° apart) or yaw/pitch angles (k.yaw, k.pitch, k.palm). Positions are athlete-local (1.85 m scale) or, with
   k.court = [x0, z0], in the court frame (facing +Z, mirrored for left-handers) relative to that origin. */
function frameFns(env, court) {
  const s = env.s;
  if (!court) return { P: h => env.ws(h), Pole: p => env.world([p[0] * s, p[1] * s, p[2] * s]), Dir: d => env.dir(d) };
  const lift = env.rig.bones.hips.position.y - env.rig.len.hip;
  return { P: h => env.W(court[0] + h[0] * s, h[1] * s + lift, court[1] + h[2] * s), Pole: p => env.W(court[0] + p[0] * s, p[1] * s + lift, court[1] + p[2] * s), Dir: d => env.W(d[0], d[1], d[2]) };
}
function swingTrack(k) {
  const hand = vecTrack(k.hand), pole = vecTrack(k.pole), dir = k.dir ? vecTrack(k.dir) : null, palm = k.palmV ? vecTrack(k.palmV) : null;
  const yaw = k.yaw ? numTrack(k.yaw) : null, pitch = k.pitch ? numTrack(k.pitch) : null;
  const pY = k.palm ? numTrack(k.palm.map(([t, v]) => [t, v[0]])) : null, pP = k.palm ? numTrack(k.palm.map(([t, v]) => [t, v[1]])) : null;
  return (t, env, side = 'r', w = 1) => {
    const F = frameFns(env, k.court), D = F.Dir(dir ? dir(t) : dirL(yaw(t), pitch(t))).normalize(), N = F.Dir(palm ? palm(t) : dirL(pY(t), pP(t)));
    N.addScaledVector(D, -N.dot(D)).normalize();
    env.rig.reach(env.side(side), F.P(hand(t)), F.Pole(pole(t)), { weight: w, handDir: D, handUp: N });
    return { D, N };
  };
}
/* free hand (ball toss, balance): positions + pole + weight track, same frames as swingTrack */
function armTrack(k) {
  const hand = vecTrack(k.hand), pole = vecTrack(k.pole), w = numTrack(k.w || [[0, 1]]);
  return (t, env, side = 'l') => { const ww = w(t); if (ww <= 0.001) return; const F = frameFns(env, k.court); env.rig.reach(env.side(side), F.P(hand(t)), F.Pole(pole(t)), { weight: ww }); };
}
const toolPoint = (ctx, y, z = 0) => ctx.tool.localToWorld(new V3(0, y, z));
const headPos = ctx => toolPoint(ctx, ctx.tool.userData.head);
const hide = B => B.position.set(0, -6, 0);
/* ball flying along a sequence of arcs: legs = [[t0, t1, fromV3, toV3, apex]] */
function flight(t, legs, out) {
  for (const [t0, t1, a, b, h] of legs) if (t <= t1) return arc(a, b, h, clamp((t - t0) / (t1 - t0), 0, 1), out);
  const l = legs[legs.length - 1]; return out.copy(l[3]);
}

/* generic racket move: body pose keys, foot plants, a swing track for the racket hand, optional second hand on the
   racket, ball path callback. ctx.C[i] = world contact point of contact i (racket head at time contacts[i]). */
function racketMove(cfg) {
  const body = cfg.poseFn || poseTrack(cfg.body), sw = swingTrack(cfg.swing), plant = planter(cfg.plants || {});
  const offW = cfg.off ? numTrack(cfg.off.ik) : null, offPole = cfg.off ? vecTrack(cfg.off.pole) : null, offY = cfg.off && cfg.off.y ? numTrack(cfg.off.y) : null;
  const look = cfg.look ? numTrack(cfg.look) : null, free = cfg.free ? armTrack(cfg.free) : null;
  const poseAt = t => { const q = body(t); if (cfg.run) for (const r of cfg.run) if (t > r.from && t < r.to) addPose(q, gait((t - r.from) / r.period + (r.phase || 0), r.k, !!r.hold), Math.min(smooth(span(t, r.from, r.from + 0.12)), 1 - smooth(span(t, r.to - 0.12, r.to)))); if (cfg.poseMod) cfg.poseMod(q, t); return q; };
  const ctx = { C: [] };
  function apply(t, env) {
    env.pose(poseAt(t)); plant.apply(t, env, cfg.ground || 0);
    const { D, N } = sw(t, env, 'r', 1); ctx.D = D; ctx.N = N;
    if (offW) { const w = offW(t); if (w > 0.001) { const P = offPole(t), s = env.s; env.reach('l', toolPoint(ctx, offY(t)), [P[0] * s, P[1] * s, P[2] * s], { weight: w, handDir: D, handUp: N.clone().negate() }); } }
    if (free) free(t, env, 'l');
    if (cfg.arms) cfg.arms(t, env, ctx);
  }
  return {
    venue: cfg.venue, dur: cfg.dur, hold: cfg.hold || 0.6, payoff: cfg.payoff, mirror: cfg.mirror, view: cfg.view, orbit: cfg.orbit,
    start(env) {
      ctx.tool = cfg.tool === 'tt' ? makePaddle() : makeRacket(cfg.tool); ctx.holder = holdTool(env, ctx.tool, 'r', cfg.slide || 0);
      if (cfg.ball) { env.props.ball.visible = false; ctx.ball = env.addProp(cfg.ball()); } else ctx.ball = env.props.ball;
      plant.init(env, poseAt);
      ctx.C = (cfg.contacts || []).map(c => { apply(c.t, env); return headPos(ctx).addScaledVector(ctx.N, (c.side || 1) * (c.off || 0.03)).add(new V3(0, c.dy || 0, 0)); });
      if (cfg.init) cfg.init(env, ctx, apply);
    },
    frame(t, env) {
      apply(t, env);
      const B = ctx.ball; cfg.ballPath(t, env, ctx, B);
      if (look) { const w = look(t), L = cfg.lookAt ? cfg.lookAt(t, env, ctx) : B.position; if (w > 0 && L.y > -1) lookAt(env, L, w); }
      const r = env.rig.root.position, f = cfg.focus ? cfg.focus(t, env, ctx) : new V3(r.x, 1.15 * env.s + (cfg.ground || 0), r.z);
      return { focus: f, radius: (cfg.radius || 5.0) * Math.max(1, env.s) };
    }
  };
}

/* =================================================================== tennis & soft tennis */
const T_READY = { lHipA: 13, rHipA: 13, lHipF: 24, rHipF: 24, lKnee: 36, rKnee: 36, lAnk: 10, rAnk: 10, spineX: 16, chestX: 6, headX: -6, lShF: 35, lShA: 10, lEl: 70, rShF: 30, rEl: 60 };
const BASE_Z = -12.35, TB = 0.034;
const readySwing = { hand: [-0.14, 1.02, 0.36], dir: [0.05, 0.5, 0.86], palm: [1, 0, 0.05] };

/* topspin forehand (open stance). o.lasso: reverse "lasso" finish over the head (Nadal); o.flat: flatter drive (Graf);
   o.soft: soft-tennis drive (low, long, flat swing with the soft ball) */
function tennisForehand(a, o = {}) {
  const tc = 1.55, dur = 3.6, soft = o.soft, flat = o.flat || soft;
  const body = [
    [0, Object.assign({ x: 0.15, z: BASE_Z, ry: 0 }, T_READY)],
    [0.3, {}],
    [0.42, { air: 0.08, lKnee: 18, rKnee: 18, lHipF: 12, rHipF: 12 }],
    [0.55, { air: 0, lKnee: 40, rKnee: 40, lHipF: 28, rHipF: 28 }],
    [0.75, { rHipF: 44, rKnee: 64, rHipA: 18, hipsY: -18, chestY: -20 }],
    [0.95, { hipsY: -38, chestY: -44, spineX: 12, rHipF: 30, rKnee: 48, rHipA: 22, lHipF: 22, lKnee: 30, lHipA: 12, headY: 62, neckY: 12, lShF: 88, lShA: 2, lEl: 12, lWrF: 0 }],
    [1.3, { hipsY: -44, chestY: -50, rKnee: soft ? 66 : 58, rHipF: soft ? 42 : 36, headY: 70, neckY: 14, lShF: 82, lShA: 0 }],
    [tc, { hipsY: 14, chestY: 16, spineX: soft ? 20 : 14, spineZ: flat ? 3 : 6, rKnee: soft ? 46 : 34, rHipF: 22, lKnee: soft ? 40 : 28, headY: -40, neckY: -12, headX: 14, lShF: 62, lShA: 8, lEl: 112 }],
    [tc + 0.32, { hipsY: 36, chestY: 30, spineX: 10, spineZ: 0, rKnee: 26, lKnee: 22, headY: -10, neckY: 0, headX: -4, lShF: 40, lShA: 15, lEl: 115 }],
    [2.6, Object.assign({ hipsY: 8, chestY: 6, headY: 0 }, T_READY)],
    [dur, { hipsY: 0, chestY: 0 }]
  ];
  const L = o.lasso;
  const finish = L ? [[tc + 0.12, [-0.08, 1.35, 0.58]], [tc + 0.28, [0.05, 1.85, 0.3]], [tc + 0.45, [-0.22, 1.95, 0.08]], [tc + 0.65, [-0.34, 1.75, 0.08]]]
    : soft ? [[tc + 0.12, [-0.02, 1.08, 0.62]], [tc + 0.3, [0.36, 1.32, 0.22]], [tc + 0.5, [0.34, 1.28, 0.12]]]
    : [[tc + 0.12, [-0.05, 1.3, 0.6]], [tc + 0.3, [0.32, 1.52, 0.18]], [tc + 0.5, [0.3, 1.45, 0.14]]];
  const fdir = L ? [[tc + 0.12, [0.25, 0.85, 0.46]], [tc + 0.28, [0.2, 0.3, -0.93]], [tc + 0.45, [0.1, -0.6, -0.8]], [tc + 0.65, [0.25, -0.7, -0.67]]]
    : soft ? [[tc + 0.12, [0.55, 0.2, 0.8]], [tc + 0.3, [0.45, -0.05, -0.89]], [tc + 0.5, [0.4, -0.15, -0.9]]]
    : [[tc + 0.12, [0.3, 0.75, 0.6]], [tc + 0.3, [0.35, 0.0, -0.94]], [tc + 0.5, [0.33, -0.15, -0.93]]];
  const fpalm = L ? [[tc + 0.12, [0.6, -0.5, 0.5]], [tc + 0.28, [0.9, -0.2, 0.3]], [tc + 0.45, [0.9, 0.2, 0.2]], [tc + 0.65, [0.9, 0.1, 0.1]]]
    : [[tc + 0.12, [0.6, -0.7, 0.3]], [tc + 0.3, [0.9, 0, 0.3]], [tc + 0.5, [0.9, 0, 0.3]]];
  const ch = flat ? 0.98 : 0.92;
  const swing = {
    hand: [[0, readySwing.hand], [0.55, [-0.14, 1.0, 0.36]], [0.95, [-0.5, 1.22, -0.02]], [1.3, [-0.64, 1.05, -0.36]], [1.45, [-0.62, soft ? 0.86 : 0.92, -0.06]], [tc, [-0.5, ch, 0.5]], ...finish, [2.6, [-0.1, 1.05, 0.36]], [dur, readySwing.hand]],
    dir: [[0, readySwing.dir], [0.55, readySwing.dir], [0.75, [-0.6, 0.75, 0.3]], [0.95, [-0.3, 0.75, -0.58]], [1.3, [-0.35, -0.18, -0.92]], [1.45, [-0.3, -0.38, -0.87]], [tc, [-0.86, -0.07, 0.5]], ...fdir, [2.3, [0.3, 0.3, 0.9]], [2.6, readySwing.dir], [dur, readySwing.dir]],
    palmV: [[0, readySwing.palm], [0.55, readySwing.palm], [0.95, [-0.8, -0.5, 0.2]], [1.3, [-0.3, -0.95, 0.1]], [1.45, [-0.6, -0.3, 0.7]], [tc, [0.5, flat ? 0 : -0.14, 0.86]], ...fpalm, [2.6, readySwing.palm], [dur, readySwing.palm]],
    pole: [[0, [-0.6, 0.5, 0]], [0.95, [-0.8, 0.9, -0.5]], [1.3, [-0.9, 0.7, -0.6]], [tc, [-0.6, 0.4, 0.1]], [tc + 0.3, [0.1, 1.6, 0.9]], [2.6, [-0.6, 0.5, 0]], [dur, [-0.6, 0.5, 0]]]
  };
  return racketMove({
    venue: soft ? 'softTennisCourt' : 'tennisCourt', dur, mirror: a.handedness === 'left', tool: soft ? 'soft' : 'tennis', payoff: tc + 0.5, body, swing,
    plants: { l: [[0.58, dur, 0.6]], r: [[0.58, 0.68, 0.6], [0.92, dur, 1.0, numTrack([[tc - 0.05, 0], [tc + 0.3, 40], [2.4, 40], [2.7, 0]])]] },
    off: { ik: [[0, 1], [0.7, 1], [0.92, 0], [2.6, 0], [3.0, 1], [dur, 1]], y: [[0, 0.3]], pole: [[0, [0.7, 0.4, -0.1]], [dur, [0.7, 0.4, -0.1]]] },
    contacts: [{ t: tc, side: 1 }],
    look: [[0, 0.8], [tc + 0.1, 0.8], [tc + 0.4, 0.3], [dur, 0.3]],
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(-1.8, 1.0, 11.6), Bp = env.W(-0.9, TB, -6.6), T = env.W(3.2, TB, 9.6), T2 = env.W(4.6, TB, 15.5);
      if (t < 0.2) return hide(B);
      flight(t, [[0.2, 1.05, S0, Bp, 1.5], [1.05, tc, Bp, C, flat ? 0.45 : 0.55], [tc, tc + 0.95, C, T, flat ? 0.8 : 1.4], [tc + 0.95, tc + 1.6, T, T2, 0.9]], B.position);
      B.rotation.set(-t * 25, 0, 0);
    }
  });
}

/* one- and two-handed backhands (ball to the left). o.two: two-handed (Djokovic, Li Na) */
function tennisBackhand(a, o = {}) {
  const tc = 1.6, dur = 3.7, two = o.two;
  const body = [
    [0, Object.assign({ x: -0.15, z: BASE_Z, ry: 0 }, T_READY)],
    [0.3, {}],
    [0.42, { air: 0.08, lKnee: 18, rKnee: 18, lHipF: 12, rHipF: 12 }],
    [0.55, { air: 0, lKnee: 40, rKnee: 40, lHipF: 28, rHipF: 28 }],
    [0.78, { hipsY: 22, chestY: 26, lHipF: 40, lKnee: 60 }],
    [1.0, { hipsY: 40, chestY: two ? 45 : 55, spineX: 14, lHipF: 24, lKnee: 44, rHipF: 34, rKnee: 40, rHipA: 6, headY: two ? -64 : -70, neckY: -14, headX: -4 }],
    [1.35, { hipsY: 44, chestY: two ? 48 : 60, lKnee: 52, rKnee: 48, headY: two ? -66 : -74 }],
    [tc, { hipsY: two ? 6 : 26, chestY: two ? 4 : 16, spineX: 16, spineZ: -5, rKnee: 40, rHipF: 34, lKnee: 34, lHipF: 14, headY: two ? 20 : 0, neckY: 8, headX: 16,
      lShF: two ? 40 : -45, lShA: two ? 10 : 34, lEl: two ? 60 : 8 }],
    [tc + 0.35, { hipsY: two ? -22 : 16, chestY: two ? -26 : 4, spineX: 8, spineZ: 0, rKnee: 26, lKnee: 22, headY: two ? 10 : -10, neckY: 0, headX: 0, lShF: two ? 40 : -50, lShA: two ? 10 : 40 }],
    [2.6, Object.assign({ hipsY: 4, chestY: 4, headY: 0, neckY: 0 }, T_READY)],
    [dur, { hipsY: 0, chestY: 0 }]
  ];
  const swing = two ? {
    hand: [[0, readySwing.hand], [0.55, [-0.14, 1.0, 0.36]], [1.0, [0.32, 1.1, -0.02]], [1.35, [0.5, 0.95, -0.22]], [1.5, [0.42, 0.88, 0.1]], [tc, [0.16, 0.95, 0.48]], [tc + 0.15, [-0.12, 1.3, 0.55]], [tc + 0.35, [-0.38, 1.52, 0.1]], [tc + 0.55, [-0.36, 1.45, 0.08]], [2.6, [-0.1, 1.05, 0.36]], [dur, readySwing.hand]],
    dir: [[0, readySwing.dir], [0.55, readySwing.dir], [0.8, [0.5, 0.75, 0.4]], [1.0, [0.3, 0.55, -0.78]], [1.35, [0.3, -0.15, -0.94]], [1.5, [0.5, -0.4, -0.76]], [tc, [0.9, 0.0, 0.43]], [tc + 0.15, [-0.05, 0.85, 0.52]], [tc + 0.35, [-0.25, 0.1, -0.96]], [tc + 0.55, [-0.2, -0.2, -0.96]], [2.3, [-0.2, 0.4, 0.89]], [2.6, readySwing.dir], [dur, readySwing.dir]],
    palmV: [[0, readySwing.palm], [0.55, readySwing.palm], [1.0, [0.2, 0.2, -0.95]], [1.35, [0.1, -0.9, -0.3]], [tc, [0.43, -0.1, -0.9]], [tc + 0.15, [0.5, 0.4, -0.75]], [tc + 0.35, [-0.95, 0, 0.2]], [2.6, readySwing.palm], [dur, readySwing.palm]],
    pole: [[0, [-0.6, 0.5, 0]], [1.0, [-0.5, 0.3, 0.6]], [tc, [-0.6, 0.6, 0.0]], [tc + 0.35, [-1.0, 1.0, 0.5]], [2.6, [-0.6, 0.5, 0]], [dur, [-0.6, 0.5, 0]]]
  } : {
    hand: [[0, readySwing.hand], [0.55, [-0.14, 1.0, 0.36]], [1.0, [0.28, 1.12, 0.04]], [1.35, [0.44, 0.94, -0.22]], [1.5, [0.42, 0.88, 0.1]], [tc, [0.24, 0.98, 0.5]], [tc + 0.15, [0.02, 1.36, 0.62]], [tc + 0.35, [-0.34, 1.8, 0.32]], [tc + 0.55, [-0.36, 1.75, 0.3]], [2.6, [-0.1, 1.05, 0.36]], [dur, readySwing.hand]],
    dir: [[0, readySwing.dir], [0.55, readySwing.dir], [0.8, [0.5, 0.75, 0.4]], [1.0, [0.2, 0.55, -0.81]], [1.35, [0.3, -0.3, -0.9]], [1.5, [0.55, -0.45, -0.7]], [tc, [0.92, -0.04, 0.38]], [tc + 0.15, [0.25, 0.85, 0.45]], [tc + 0.35, [-0.3, 0.75, -0.6]], [tc + 0.55, [-0.3, 0.7, -0.65]], [2.3, [-0.1, 0.6, 0.79]], [2.6, readySwing.dir], [dur, readySwing.dir]],
    palmV: [[0, readySwing.palm], [0.55, readySwing.palm], [1.0, [0.1, 0.2, -0.97]], [1.35, [0.1, -0.9, -0.3]], [tc, [0.38, 0, -0.92]], [tc + 0.15, [0.6, 0.2, -0.75]], [tc + 0.35, [0.3, -0.3, -0.9]], [2.6, readySwing.palm], [dur, readySwing.palm]],
    pole: [[0, [-0.6, 0.5, 0]], [1.0, [-0.4, 0.4, 0.6]], [tc, [-0.5, 0.7, 0.1]], [tc + 0.35, [-0.8, 1.6, 0.6]], [2.6, [-0.6, 0.5, 0]], [dur, [-0.6, 0.5, 0]]]
  };
  return racketMove({
    venue: 'tennisCourt', dur, mirror: a.handedness === 'left', tool: 'tennis', payoff: tc + 0.5, body, swing,
    plants: { r: [[0.58, 0.72, 0.6], [1.02, dur, 1.05, numTrack([[tc - 0.05, 0], [tc + 0.3, two ? 30 : 0], [2.4, two ? 30 : 0], [2.7, 0]])]], l: [[0.58, dur, 0.6, numTrack([[tc - 0.1, 0], [tc + 0.2, two ? 0 : 35], [2.4, two ? 0 : 35], [2.7, 0]])]] },
    off: { ik: two ? [[0, 1], [dur, 1]] : [[0, 1], [1.38, 1], [1.5, 0], [2.6, 0], [3.0, 1], [dur, 1]], y: two ? [[0, 0.3], [0.6, 0.3], [0.9, 0.165], [2.5, 0.165], [3.0, 0.3]] : [[0, 0.3]],
      pole: [[0, [0.7, 0.4, -0.1]], [1.0, [0.6, 0.3, -0.5]], [tc, [0.6, 0.5, -0.3]], [tc + 0.35, [0.4, 0.3, 0.8]], [dur, [0.7, 0.4, -0.1]]] },
    contacts: [{ t: tc, side: -1 }],
    look: [[0, 0.8], [tc + 0.1, 0.8], [tc + 0.4, 0.3], [dur, 0.3]],
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(1.6, 1.0, 11.6), Bp = env.W(0.9, TB, -6.6), T = env.W(two ? 3.0 : -3.4, TB, 9.4), T2 = env.W(two ? 4.4 : -4.8, TB, 15.5);
      if (t < 0.25) return hide(B);
      flight(t, [[0.25, 1.1, S0, Bp, 1.5], [1.1, tc, Bp, C, 0.55], [tc, tc + 0.95, C, T, 1.25], [tc + 0.95, tc + 1.6, T, T2, 0.9]], B.position);
      B.rotation.set(-t * 25, 0, 0);
    }
  });
}

/* serve (deuce court, flat "T" serve). o.soft: soft-tennis overhead serve */
function tennisServe(a, o = {}) {
  const soft = o.soft, tr = 1.22, tc = 1.86, dur = 4.0, X0 = -0.45, Z0 = BASE_Z + 0.15;
  const body = [
    [0, { x: X0, z: Z0, ry: -58, lHipF: 14, lHipA: 5, lKnee: 12, rHipF: -6, rHipA: 12, rKnee: 12, rAnk: 4, spineX: 8, chestX: 4, headY: 46, neckY: 10, headX: -4 }],
    [0.6, { spineX: 12 }],
    [1.0, { spineX: 2, rKnee: 16, lKnee: 8, headX: -12 }],
    [1.42, { lKnee: 46, lHipF: 30, rKnee: 52, rHipF: 12, spineZ: 18, chestZ: 8, spineX: -8, chestX: -6, hipsZ: -6, headX: -38, headY: 34, neckY: 6 }],
    [1.62, { lKnee: 22, rKnee: 26, air: 0.06, spineZ: 8, chestZ: 2 }],
    [tc, { air: soft ? 0.12 : 0.28, ry: -22, hipsY: 18, chestY: 22, spineZ: -18, chestZ: -8, hipsZ: 0, spineX: 8, chestX: 2, lHipF: 4, lKnee: 4, lAnk: -30, rHipF: -18, rKnee: 30, rAnk: -20, headX: -32, headY: 6, neckY: 0 }],
    [2.08, { air: 0, x: X0 + 0.05, z: Z0 + 0.72, ry: 0, hipsY: 26, chestY: 26, spineZ: 0, chestZ: 0, spineX: 36, chestX: 10, lHipF: 42, lKnee: 52, lAnk: 10, rHipF: -32, rKnee: 70, rAnk: 0, headX: 10, headY: 0 }],
    [2.55, { hipsY: 10, chestY: 8, spineX: 20, rHipF: 14, rKnee: 32, rHipA: 12, lHipA: 12 }],
    [3.3, Object.assign({ hipsY: 0, chestY: 0, headX: -6 }, T_READY)],
    [dur, {}]
  ];
  const C0 = [X0, Z0];
  const swing = {
    court: C0,
    hand: [[0, [0.0, 1.05, 0.3]], [0.6, [0.0, 1.03, 0.32]], [0.95, [-0.22, 0.76, 0.06]], [1.2, [-0.42, 1.2, -0.3]], [1.42, [-0.34, 1.62, -0.38]], [1.54, [-0.26, 1.66, -0.34]], [1.62, [-0.14, 1.72, -0.26]], [1.76, [-0.17, 1.95, -0.02]],
      [tc, [-0.14, 2.25, 0.22]], [1.98, [0.0, 1.62, 0.62]], [2.12, [0.3, 0.98, 0.5]], [2.55, [0.22, 1.0, 0.75]], [3.3, [-0.1, 1.02, 1.08]], [dur, [-0.12, 1.02, 1.08]]],
    dir: [[0, [0.25, 0.3, 0.92]], [0.6, [0.25, 0.25, 0.93]], [0.95, [0.05, -0.6, 0.8]], [1.2, [-0.3, 0.3, -0.9]], [1.42, [-0.1, 0.9, -0.42]], [1.54, [-0.2, 0.1, -0.97]], [1.62, [-0.05, -0.92, -0.38]],
      [1.76, [0.0, 0.05, -1.0]], [tc, [-0.05, 0.97, 0.22]], [1.98, [0.1, 0.05, 1.0]], [2.05, [0.2, -0.9, 0.35]], [2.12, [0.3, -0.85, -0.42]], [2.55, [0.2, -0.3, 0.93]], [3.3, readySwing.dir], [dur, readySwing.dir]],
    palmV: [[0, [1, 0, -0.25]], [0.95, [1, 0, 0]], [1.2, [0, -1, 0]], [1.42, [-1, 0, 0]], [1.62, [-1, 0, 0]], [1.76, [-0.8, -0.2, 0.5]], [tc, [0.1, -0.2, 1]], [1.98, [-0.7, -0.5, 0.4]], [2.12, [-0.7, 0.2, -0.6]], [2.55, [1, 0, 0]], [dur, [1, 0, 0]]],
    pole: [[0, [-0.6, 0.6, 0.0]], [1.2, [-0.9, 0.8, -0.4]], [1.42, [-0.9, 1.6, -0.2]], [1.62, [-0.35, 2.4, 0.35]], [tc, [-0.9, 1.9, -0.1]], [2.12, [-0.4, 1.4, 1.0]], [3.3, [-0.6, 0.5, 0.4]], [dur, [-0.6, 0.5, 0.4]]]
  };
  const free = {
    court: C0, w: [[0, 1], [2.0, 1], [2.4, 0], [3.0, 0], [3.3, 1], [dur, 1]],
    hand: [[0, [0.1, 1.06, 0.36]], [0.6, [0.12, 1.02, 0.38]], [0.95, [0.24, 0.8, 0.16]], [tr, [0.0, 1.98, 0.42]], [1.62, [0.0, 2.05, 0.36]], [tc, [0.16, 1.25, 0.28]], [2.0, [0.25, 1.1, 0.3]], [3.3, [0.1, 1.0, 1.0]], [dur, [0.1, 1.0, 1.0]]],
    pole: [[0, [0.6, 0.6, 0.1]], [tr, [0.6, 1.4, 0.1]], [tc, [0.7, 1.2, -0.2]], [dur, [0.7, 0.5, 0.8]]]
  };
  let R = null;
  return racketMove({
    venue: soft ? 'softTennisCourt' : 'tennisCourt', dur, mirror: a.handedness === 'left', tool: soft ? 'soft' : 'tennis', payoff: tc + 0.45, body, swing, free,
    plants: { l: [[0, 1.62, 0, numTrack([[1.3, 0], [1.6, 25]])], [2.06, dur, 2.12]], r: [[0, 1.56, 0, numTrack([[1.2, 0], [1.5, 30]])], [2.5, dur, 2.6]] },
    off: { ik: [[0, 1], [0.45, 1], [0.6, 0], [3.0, 0], [3.4, 1], [dur, 1]], y: [[0, 0.3]], pole: [[0, [0.7, 0.4, -0.1]], [dur, [0.7, 0.4, -0.1]]] },
    contacts: [{ t: tc, side: 1, off: 0.04 }],
    init(env, ctx, apply) { apply(tr, env); R = env.handPos('l').clone(); },
    look: [[0, 0.6], [1.0, 0.85], [tc, 0.85], [2.3, 0.4], [dur, 0.3]],
    focus(t, env) { const r = env.rig.root.position, k = smooth(span(t, 0.9, 1.4)) * (1 - smooth(span(t, 2.0, 2.6))); return new V3(r.x, (1.15 + 0.55 * k) * env.s, r.z); }, radius: 5.4,
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0];
      if (t < 0.5 && false) return;
      if (t < tr) { B.position.copy(env.handPos('l')); B.position.y += 0.01; }
      else if (t < tc) { const T = tc - tr, u = t - tr, g = 9.8, v0 = new V3().subVectors(C, R).addScaledVector(UPY, 0.5 * g * T * T).multiplyScalar(1 / T); B.position.copy(R).addScaledVector(v0, u).addScaledVector(UPY, -0.5 * g * u * u); }
      else { const T = env.W(0.9, TB, 6.0), T2 = env.W(1.9, TB, 14.5); flight(t, [[tc, tc + (soft ? 0.75 : 0.55), C, T, soft ? 0.9 : 0.3], [tc + (soft ? 0.75 : 0.55), tc + 1.3, T, T2, 0.7]], B.position); }
      B.rotation.set(-t * 18, t * 4, 0);
    }
  });
}

/* Hsieh Su-wei: two-handed on both wings — a two-handed forehand angle, then a two-handed backhand */
function tennisDoubleHanded(a) {
  const t1 = 1.45, t2 = 3.4, dur = 4.9;
  const body = [
    [0, Object.assign({ x: 0.0, z: BASE_Z + 0.4, ry: 0 }, T_READY)],
    [0.3, { air: 0.07, lKnee: 18, rKnee: 18, lHipF: 12, rHipF: 12 }],
    [0.45, { air: 0, lKnee: 40, rKnee: 40, lHipF: 28, rHipF: 28 }],
    [0.9, { hipsY: -36, chestY: -40, spineX: 14, rKnee: 52, rHipF: 34, headY: 58, neckY: 12 }],
    [1.25, { hipsY: -40, chestY: -46, headY: 64 }],
    [t1, { hipsY: 10, chestY: 10, rKnee: 36, headY: -34, neckY: -10, headX: 14 }],
    [t1 + 0.3, { hipsY: 28, chestY: 24, headY: -8, neckY: 0, headX: 0 }],
    [2.3, Object.assign({ hipsY: 0, chestY: 0, headY: 0 }, T_READY)],
    [2.85, { hipsY: 38, chestY: 44, rHipF: 34, rKnee: 44, lKnee: 50, headY: -62, neckY: -12 }],
    [3.2, { hipsY: 42, chestY: 46, headY: -64 }],
    [t2, { hipsY: 8, chestY: 4, rKnee: 40, lKnee: 34, headY: 18, neckY: 8, headX: 14 }],
    [t2 + 0.32, { hipsY: -20, chestY: -24, headY: 8, neckY: 0, headX: 0 }],
    [4.4, Object.assign({ hipsY: 0, chestY: 0, headY: 0, neckY: 0 }, T_READY)],
    [dur, {}]
  ];
  const swing = {
    hand: [[0, readySwing.hand], [0.45, readySwing.hand], [0.9, [-0.45, 1.15, -0.05]], [1.25, [-0.56, 0.95, -0.26]], [1.37, [-0.55, 0.88, 0.0]], [t1, [-0.42, 0.95, 0.42]], [t1 + 0.15, [-0.05, 1.25, 0.55]], [t1 + 0.32, [0.3, 1.4, 0.16]], [2.3, readySwing.hand],
      [2.85, [0.32, 1.1, -0.02]], [3.2, [0.5, 0.95, -0.22]], [3.32, [0.42, 0.88, 0.1]], [t2, [0.16, 0.95, 0.46]], [t2 + 0.15, [-0.12, 1.28, 0.55]], [t2 + 0.32, [-0.38, 1.5, 0.1]], [4.4, readySwing.hand], [dur, readySwing.hand]],
    dir: [[0, readySwing.dir], [0.45, readySwing.dir], [0.7, [-0.6, 0.75, 0.3]], [0.9, [-0.3, 0.7, -0.65]], [1.25, [-0.35, -0.15, -0.92]], [1.37, [-0.35, -0.35, -0.87]], [t1, [-0.88, -0.05, 0.47]], [t1 + 0.15, [0.25, 0.8, 0.55]], [t1 + 0.32, [0.35, 0.0, -0.94]], [2.0, [0.3, 0.3, 0.9]], [2.3, readySwing.dir],
      [2.6, [0.5, 0.75, 0.4]], [2.85, [0.3, 0.55, -0.78]], [3.2, [0.3, -0.15, -0.94]], [3.32, [0.5, -0.4, -0.76]], [t2, [0.9, 0.0, 0.43]], [t2 + 0.15, [-0.05, 0.85, 0.52]], [t2 + 0.32, [-0.25, 0.1, -0.96]], [4.1, [-0.2, 0.4, 0.89]], [4.4, readySwing.dir], [dur, readySwing.dir]],
    palmV: [[0, readySwing.palm], [0.45, readySwing.palm], [0.9, [-0.8, -0.5, 0.2]], [1.25, [-0.3, -0.95, 0.1]], [t1, [0.5, -0.1, 0.86]], [t1 + 0.15, [0.6, -0.7, 0.3]], [t1 + 0.32, [0.9, 0, 0.3]], [2.3, readySwing.palm],
      [2.85, [0.2, 0.2, -0.95]], [3.2, [0.1, -0.9, -0.3]], [t2, [0.43, -0.1, -0.9]], [t2 + 0.15, [0.5, 0.4, -0.75]], [t2 + 0.32, [-0.95, 0, 0.2]], [4.4, readySwing.palm], [dur, readySwing.palm]],
    pole: [[0, [-0.6, 0.5, 0]], [0.9, [-0.8, 0.9, -0.5]], [t1, [-0.6, 0.4, 0.1]], [t1 + 0.3, [0.1, 1.6, 0.9]], [2.3, [-0.6, 0.5, 0]], [2.85, [-0.5, 0.3, 0.6]], [t2, [-0.6, 0.6, 0.0]], [t2 + 0.32, [-1.0, 1.0, 0.5]], [4.4, [-0.6, 0.5, 0]], [dur, [-0.6, 0.5, 0]]]
  };
  return racketMove({
    venue: 'tennisCourt', dur, mirror: a.handedness === 'left', tool: 'tennis', payoff: t2 + 0.4, body, swing,
    plants: { l: [[0.48, dur, 0.5]], r: [[0.48, dur, 0.5]] },
    off: { ik: [[0, 1], [dur, 1]], y: [[0, 0.3], [0.5, 0.3], [0.8, 0.165], [2.1, 0.165], [2.35, 0.3], [2.6, 0.165], [4.2, 0.165], [4.6, 0.3]],
      pole: [[0, [0.7, 0.4, -0.1]], [0.9, [0.5, 0.2, 0.6]], [t1, [0.7, 0.3, 0.3]], [2.3, [0.7, 0.4, -0.1]], [2.85, [0.6, 0.3, -0.5]], [t2, [0.6, 0.5, -0.3]], [t2 + 0.32, [0.4, 0.3, 0.8]], [dur, [0.7, 0.4, -0.1]]] },
    contacts: [{ t: t1, side: 1 }, { t: t2, side: -1 }],
    look: [[0, 0.8], [dur, 0.8]],
    ballPath(t, env, ctx, B) {
      const [C1, C2] = ctx.C, S0 = env.W(-1.2, 1.0, 11.6), B1 = env.W(-0.8, TB, -6.8), T1 = env.W(3.6, TB, 7.2), O = env.W(2.6, 0.9, 10.5), B2 = env.W(1.0, TB, -6.4), T2 = env.W(-2.8, TB, 9.0), T3 = env.W(-4.0, TB, 15);
      if (t < 0.15) return hide(B);
      flight(t, [[0.15, 0.95, S0, B1, 1.4], [0.95, t1, B1, C1, 0.5], [t1, t1 + 0.85, C1, T1, 1.3], [t1 + 0.85, t1 + 1.1, T1, O, 0.5], [t1 + 1.1, 3.0, O, B2, 1.2], [3.0, t2, B2, C2, 0.45], [t2, t2 + 0.9, C2, T2, 1.2], [t2 + 0.9, t2 + 1.5, T2, T3, 0.8]], B.position);
      B.rotation.set(-t * 25, 0, 0);
    }
  });
}

/* soft tennis: net volley (doubles net player) */
function softVolley(a) {
  const tc = 1.35, dur = 3.2, z0 = -2.6;
  const body = [
    [0, Object.assign({ x: 0.2, z: z0, ry: 0 }, T_READY, { spineX: 20 })],
    [0.45, { air: 0.06, lKnee: 20, rKnee: 20 }],
    [0.6, { air: 0, lKnee: 42, rKnee: 42, lHipF: 30, rHipF: 30 }],
    [1.05, { hipsY: -24, chestY: -22, headY: 30, neckY: 8, lHipF: 40, lKnee: 46 }],
    [tc, { z: z0 + 0.35, hipsY: -6, chestY: -8, lHipF: 52, lKnee: 50, rHipF: -4, rKnee: 30, spineX: 26, headY: -10, headX: 10, lShF: 60, lShA: 20, lEl: 70 }],
    [tc + 0.3, { hipsY: 0, chestY: 0, spineX: 22 }],
    [2.5, Object.assign({ z: z0 + 0.35 }, T_READY, { spineX: 18 })],
    [dur, {}]
  ];
  const swing = {
    hand: [[0, readySwing.hand], [0.6, readySwing.hand], [1.05, [-0.42, 1.28, 0.2]], [tc, [-0.36, 1.18, 0.62]], [tc + 0.25, [-0.2, 1.05, 0.7]], [2.5, readySwing.hand], [dur, readySwing.hand]],
    dir: [[0, readySwing.dir], [0.6, readySwing.dir], [1.05, [-0.45, 0.85, 0.25]], [tc, [-0.55, 0.62, 0.55]], [tc + 0.25, [-0.35, 0.45, 0.82]], [2.5, readySwing.dir], [dur, readySwing.dir]],
    palmV: [[0, readySwing.palm], [0.6, readySwing.palm], [1.05, [0.3, -0.2, 0.93]], [tc, [0.25, -0.3, 0.92]], [tc + 0.25, [0.4, -0.5, 0.75]], [2.5, readySwing.palm], [dur, readySwing.palm]],
    pole: [[0, [-0.6, 0.5, 0]], [1.05, [-0.9, 0.9, -0.2]], [tc, [-0.8, 0.8, 0.2]], [2.5, [-0.6, 0.5, 0]], [dur, [-0.6, 0.5, 0]]]
  };
  return racketMove({
    venue: 'softTennisCourt', dur, mirror: a.handedness === 'left', tool: 'soft', payoff: tc + 0.4, body, swing,
    plants: { r: [[0.62, dur, 0.65]], l: [[0.62, 1.12, 0.65], [tc - 0.05, dur, tc]] },
    off: { ik: [[0, 1], [0.8, 1], [1.0, 0], [2.4, 0], [2.8, 1], [dur, 1]], y: [[0, 0.3]], pole: [[0, [0.7, 0.4, -0.1]], [dur, [0.7, 0.4, -0.1]]] },
    contacts: [{ t: tc, side: 1 }],
    look: [[0, 0.85], [tc + 0.2, 0.85], [2.0, 0.4], [dur, 0.3]],
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(-1.5, 1.1, 11.0), T = env.W(2.2, TB, 7.5), T2 = env.W(3.2, TB, 13.5);
      if (t < 0.3) return hide(B);
      flight(t, [[0.3, tc, S0, C, 0.9], [tc, tc + 0.7, C, T, 0.2], [tc + 0.7, tc + 1.4, T, T2, 1.0]], B.position);
      B.rotation.set(-t * 20, 0, 0);
    }
  });
}

/* =================================================================== badminton */
const B_READY = { lHipA: 14, rHipA: 14, lHipF: 26, rHipF: 26, lKnee: 40, rKnee: 40, lAnk: 10, rAnk: 10, spineX: 16, chestX: 6, headX: -6, lShF: 40, lShA: 15, lEl: 70 };
const bReady = { hand: [-0.22, 1.12, 0.38], dir: [-0.05, 0.75, 0.66], palm: [0.1, 0, 1] };
/* shuttle legs [t0, t1, A, B, apex]: the horizontal motion decelerates (feathered drag), so the fall is steep */
function shuttleAt(t, legs, out) {
  for (const [t0, t1, a, b, h, lin] of legs) if (t <= t1) {
    const u = clamp((t - t0) / (t1 - t0), 0, 1), e = lin ? u : 1 - Math.pow(1 - u, 1.8);
    return out.set(lerp(a.x, b.x, e), lerp(a.y, b.y, u) + 4 * h * u * (1 - u), lerp(a.z, b.z, e));
  }
  return out.copy(legs[legs.length - 1][3]);
}
const _s0 = new V3(), _s1 = new V3();
function placeShuttle(S, t, legs, tRest) {
  shuttleAt(t, legs, S.position);
  if (tRest !== undefined && t >= tRest) { S.quaternion.setFromAxisAngle(new V3(1, 0, 0.3).normalize(), 1.9); S.position.y = 0.035; return; }
  shuttleAt(t - 0.015, legs, _s0); shuttleAt(t + 0.015, legs, _s1); const v = _s1.sub(_s0);
  if (v.lengthSq() > 1e-8) S.quaternion.setFromUnitVectors(UPY, v.normalize());
}

/* jump smash from the rear forehand corner with a scissor kick (Lin Dan, Lee Chong Wei, Axelsen, Sindhu, Marín, Wang Chi-lin) */
function badmintonSmash(a, o = {}) {
  const tc = 1.55, dur = 3.6, air = o.air || 0.55;
  const body = poseTrack([
    [0, Object.assign({ x: 0, z: -3.6, ry: 0 }, B_READY)],
    [0.15, { ry: -10 }],
    [0.35, { x: -0.2, z: -4.1, ry: -55, air: 0.06, rHipA: 30, lHipA: 6, lKnee: 30, rKnee: 30, headY: 40, headX: -25 }],
    [0.5, { x: -0.3, z: -4.5, air: 0.12, rHipA: 8, lHipA: 8 }],
    [0.68, { x: -0.45, z: -4.85, air: 0.03, rHipA: 28, lHipA: 8 }],
    [0.85, { x: -0.55, z: -5.1, air: 0.1, rHipA: 10, lHipA: 10 }],
    [1.0, { x: -0.6, z: -5.25, ry: -60, air: 0, rHipA: 18, lHipA: 14, lKnee: 30, rKnee: 34, lHipF: 22, rHipF: 22, spineX: 4, headY: 35, headX: -35, lShF: 150, lShA: 20, lEl: 20 }],
    [1.22, { lKnee: 62, rKnee: 66, lHipF: 46, rHipF: 48, spineX: 12, hipsY: -10, chestY: -10, spineZ: 8 }],
    [1.32, { air: air * 0.28, lKnee: 20, rKnee: 24, lHipF: 10, rHipF: 12, lAnk: -30, rAnk: -30 }],
    [1.45, { air: air * 0.9, rHipF: -15, rKnee: 40, lHipF: 30, lKnee: 50, spineX: -12, spineZ: 14, chestZ: 6, hipsY: 0, chestY: 0, headX: -40 }],
    [tc, { air, rHipF: 40, rKnee: 70, lHipF: -10, lKnee: 40, spineX: 6, spineZ: -16, chestZ: -6, hipsY: 25, chestY: 22, headX: -28, headY: 20, lShF: 70, lShA: 10, lEl: 90 }],
    [1.7, { air: air * 0.55, rHipF: 50, rKnee: 60, lHipF: -25, lKnee: 50, spineX: 30, spineZ: -6, chestZ: 0, hipsY: 40, chestY: 30, headX: 5, headY: 10, lShF: 40, lEl: 80 }],
    [1.86, { air: 0, lHipF: 30, lKnee: 52, lAnk: 10, rHipF: 50, rKnee: 70, spineX: 26 }],
    [2.06, { ry: -25, rHipF: 34, rKnee: 44, lHipF: 10, lKnee: 30, spineX: 18, hipsY: 20, chestY: 10 }],
    [2.45, { x: -0.35, z: -4.5, ry: 0, hipsY: 0, chestY: 0, spineZ: 0, chestZ: 0 }],
    [2.95, Object.assign({ x: 0, z: -3.7, headX: -6, headY: 0 }, B_READY)],
    [dur, {}]
  ]);
  const swing = {
    hand: [[0, bReady.hand], [0.35, [-0.32, 1.4, 0.15]], [1.0, [-0.32, 1.68, -0.18]], [1.22, [-0.34, 1.6, -0.22]], [1.4, [-0.26, 1.8, -0.08]], [1.5, [-0.16, 2.02, 0.08]], [tc, [-0.02, 2.2, 0.3]], [1.62, [0.18, 1.85, 0.48]], [1.82, [0.36, 1.0, 0.25]], [2.1, [0.2, 1.0, 0.35]], [2.95, bReady.hand], [dur, bReady.hand]],
    dir: [[0, bReady.dir], [0.35, [-0.1, 0.95, 0.3]], [1.0, [0.0, 0.95, -0.3]], [1.22, [0.05, 0.9, -0.43]], [1.32, [0.05, 0.1, -1]], [1.4, [0.1, -0.85, -0.5]], [1.5, [0.15, 0.2, -0.97]], [tc, [0.24, 0.94, 0.24]], [1.6, [0.45, 0.5, 0.75]], [1.68, [0.6, -0.3, 0.75]], [1.82, [0.3, -0.85, -0.4]], [2.1, [0.2, -0.2, 0.95]], [2.95, bReady.dir], [dur, bReady.dir]],
    palmV: [[0, bReady.palm], [1.0, [0.87, 0, 0.5]], [1.5, [0.87, 0, 0.5]], [tc, [0.64, -0.42, 0.64]], [1.68, [0.4, -0.85, 0.35]], [1.82, [-0.2, 0, 1]], [2.95, bReady.palm], [dur, bReady.palm]],
    pole: [[0, [-0.6, 0.6, 0]], [1.0, [-0.9, 1.7, -0.3]], [1.4, [-0.7, 2.3, 0.0]], [tc, [-0.8, 1.9, -0.3]], [1.82, [-0.3, 1.2, 0.8]], [2.95, [-0.6, 0.6, 0]], [dur, [-0.6, 0.6, 0]]]
  };
  return racketMove({
    venue: 'badmintonHall', dur, mirror: a.handedness === 'left', tool: 'badminton', payoff: tc + 0.35, body: [], poseFn: body, swing,
    run: [{ from: 2.1, to: 2.95, period: 0.38, k: 0.55 }],
    plants: { l: [[1.02, 1.3, 1.05], [1.88, 2.1, 1.9], [2.98, dur, 3.0]], r: [[1.02, 1.28, 1.05], [2.06, 2.14, 2.08], [2.98, dur, 3.0]] },
    contacts: [{ t: tc, side: 1, off: 0.02 }],
    look: [[0, 0.85], [tc, 0.85], [1.8, 0.2], [dur, 0.2]],
    ballPath(t, env, ctx, S) {
      const C = ctx.C[0], A = env.W(-0.4, 1.0, 5.0), T = env.W(0.9, 0.035, 3.4);
      if (t < 0.05) { S.position.copy(A); return; }
      placeShuttle(S, t, [[0.05, tc, A, C, 5.2], [tc, tc + 0.3, C, T, 0, true]], tc + 0.3);
    }
  });
}

/* deceptive net play: lunge to the net, hold the racket as if to push straight, then flick the shuttle cross-court (Tai Tzu-ying) */
function badmintonNet(a) {
  const tc = 1.3, dur = 3.4;
  const body = [
    [0, Object.assign({ x: 0, z: -3.3, ry: 0 }, B_READY)],
    [0.3, { ry: -12 }],
    [0.85, { x: -0.55, z: -1.8, rHipF: 60, rKnee: 70, lHipF: -10, lKnee: 30, spineX: 20 }],
    [1.02, { x: -0.62, z: -1.62, rHipF: 86, rKnee: 96, rAnk: 12, lHipF: -32, lKnee: 12, lAnk: -10, lHipA: 10, rHipA: 6, spineX: 26, chestX: 8, lShF: -25, lShA: 45, lEl: 20, headX: -4 }],
    [tc, { spineX: 28 }],
    [1.5, { spineX: 24 }],
    [1.8, { z: -1.75, rHipF: 50, rKnee: 60, lHipF: 0, lKnee: 30, spineX: 18 }],
    [2.7, Object.assign({ x: 0, z: -3.2, ry: 0, rAnk: 10, lAnk: 10, headX: -6 }, B_READY)],
    [dur, {}]
  ];
  const swing = {
    hand: [[0, bReady.hand], [0.4, [-0.28, 1.2, 0.4]], [0.85, [-0.32, 1.2, 0.55]], [1.02, [-0.3, 1.24, 0.8]], [1.2, [-0.3, 1.25, 0.82]], [tc, [-0.24, 1.27, 0.84]], [1.45, [-0.12, 1.3, 0.8]], [1.85, [-0.3, 1.15, 0.5]], [2.7, bReady.hand], [dur, bReady.hand]],
    dir: [[0, bReady.dir], [0.85, [-0.3, 0.5, 0.81]], [1.02, [-0.25, 0.42, 0.87]], [1.2, [-0.3, 0.42, 0.86]], [tc, [0.25, 0.45, 0.86]], [1.45, [0.55, 0.45, 0.7]], [1.85, [0, 0.75, 0.66]], [2.7, bReady.dir], [dur, bReady.dir]],
    palmV: [[0, bReady.palm], [1.02, [0, 0.9, -0.4]], [1.2, [0, 0.9, -0.3]], [tc, [0.8, 0.5, 0.2]], [1.45, [0.85, 0.3, -0.4]], [2.0, bReady.palm], [dur, bReady.palm]],
    pole: [[0, [-0.6, 0.6, 0]], [1.02, [-0.8, 0.6, 0.4]], [1.45, [-0.6, 0.8, 0.5]], [2.7, [-0.6, 0.6, 0]], [dur, [-0.6, 0.6, 0]]]
  };
  return racketMove({
    venue: 'badmintonHall', dur, mirror: a.handedness === 'left', tool: 'badminton', payoff: tc + 0.45, body, swing,
    run: [{ from: 0.2, to: 0.85, period: 0.34, k: 0.7 }, { from: 1.85, to: 2.6, period: 0.4, k: 0.3 }],
    plants: { r: [[1.0, 1.82, 1.02]], l: [[1.0, 1.8, 1.02, 18]], all: [] },
    contacts: [{ t: tc, side: 1, off: 0.02 }],
    look: [[0, 0.85], [tc + 0.3, 0.85], [2.2, 0.3], [dur, 0.3]],
    ballPath(t, env, ctx, S) {
      const C = ctx.C[0], A = env.W(0.5, 2.3, 4.2), T = env.W(2.4, 0.035, 1.25);
      if (t < 0.25) { S.position.copy(A); return; }
      placeShuttle(S, t, [[0.25, tc, A, C, 0.9], [tc, tc + 0.8, C, T, 0.55]], tc + 0.8);
      if (t > tc && t < tc + 0.8) S.rotateY((t - tc) * 40);   // tumbling spin
    }
  });
}

/* doubles front-court interception: racket up, hop in and kill the flat drive downward (Lee Yang) */
function badmintonKill(a) {
  const tc = 1.05, dur = 3.0;
  const body = [
    [0, Object.assign({ x: 0.15, z: -2.45, ry: 0 }, B_READY, { spineX: 14, headX: -10 })],
    [0.72, { lKnee: 48, rKnee: 48, lHipF: 30, rHipF: 30 }],
    [0.92, { z: -2.25, air: 0.12, rHipF: 46, rKnee: 52, lHipF: -6, lKnee: 30, lAnk: -20 }],
    [tc, { z: -2.15, air: 0.18, spineX: 20, hipsY: 16, chestY: 18, headX: 6 }],
    [1.25, { z: -2.05, air: 0, rHipF: 40, rKnee: 54, lHipF: -2, lKnee: 26, lAnk: 6, spineX: 24 }],
    [1.9, Object.assign({ z: -2.35, hipsY: 0, chestY: 0 }, B_READY, { spineX: 14, headX: -8 })],
    [dur, {}]
  ];
  const up = [-0.22, 1.45, 0.35];
  const swing = {
    hand: [[0, up], [0.6, up], [0.85, [-0.36, 1.72, 0.12]], [tc, [-0.26, 1.85, 0.55]], [1.16, [-0.12, 1.32, 0.66]], [1.35, [-0.15, 1.25, 0.6]], [1.9, up], [dur, up]],
    dir: [[0, [-0.1, 0.9, 0.42]], [0.6, [-0.1, 0.9, 0.42]], [0.85, [-0.2, 0.85, -0.5]], [tc, [-0.1, 0.78, 0.62]], [1.16, [0.05, -0.3, 0.95]], [1.35, [0.0, 0.2, 0.98]], [1.9, [-0.1, 0.9, 0.42]], [dur, [-0.1, 0.9, 0.42]]],
    palmV: [[0, [0, -0.4, 0.9]], [0.85, [0.3, 0.2, 0.9]], [tc, [0.1, -0.6, 0.8]], [1.16, [0.1, -0.95, -0.3]], [1.9, [0, -0.4, 0.9]], [dur, [0, -0.4, 0.9]]],
    pole: [[0, [-0.8, 1.0, 0]], [0.85, [-0.9, 1.4, -0.3]], [tc, [-0.9, 1.3, 0.2]], [1.9, [-0.8, 1.0, 0]], [dur, [-0.8, 1.0, 0]]]
  };
  return racketMove({
    venue: 'badmintonHall', dur, mirror: a.handedness === 'left', tool: 'badminton', payoff: tc + 0.3, body, swing,
    plants: { l: [[0, 0.82, 0], [1.24, dur, 1.3]], r: [[0, 0.8, 0], [1.24, dur, 1.3]] },
    contacts: [{ t: tc, side: 1, off: 0.02 }],
    look: [[0, 0.85], [tc + 0.2, 0.85], [1.8, 0.3], [dur, 0.3]],
    ballPath(t, env, ctx, S) {
      const C = ctx.C[0], A = env.W(-0.3, 1.75, 4.6), T = env.W(0.55, 0.035, 1.5);
      if (t < 0.55) { S.position.copy(A); S.visible = t > 0.3; return; }
      S.visible = true; placeShuttle(S, t, [[0.55, tc, A, C, 0.22, true], [tc, tc + 0.22, C, T, 0, true]], tc + 0.22);
    }
  });
}

/* defence: low wide base, side lunge and a counter-drive off the smash (Chen Long) */
function badmintonDefense(a) {
  const tc = 1.1, dur = 3.2, D = { lHipA: 22, rHipA: 22, lHipF: 34, rHipF: 34, lKnee: 52, rKnee: 52, lAnk: 14, rAnk: 14, spineX: 22, chestX: 6, headX: -8, lShF: 45, lShA: 20, lEl: 70 };
  const body = [
    [0, Object.assign({ x: 0, z: -3.4, ry: 0 }, D)],
    [0.75, { lKnee: 56, rKnee: 56 }],
    [0.92, { x: -0.18, rHipA: 32, rKnee: 70, rHipF: 46, lKnee: 34, hipsY: -18, chestY: -18, headY: 20 }],
    [tc, { x: -0.32, rHipA: 38, rKnee: 84, rHipF: 54, lKnee: 14, lHipF: 22, lHipA: 26, hipsY: -24, chestY: -14, spineZ: 10, headY: 6, lShF: 30, lShA: 40, lEl: 30 }],
    [1.35, { hipsY: 0, chestY: 6, spineZ: 4 }],
    [2.0, Object.assign({ x: 0, hipsY: 0, chestY: 0, spineZ: 0, headY: 0 }, D)],
    [dur, {}]
  ];
  const r0 = { hand: [0.02, 1.0, 0.45], dir: [0.3, 0.75, 0.6], palm: [0, 0, 1] };
  const swing = {
    hand: [[0, r0.hand], [0.75, r0.hand], [0.95, [-0.6, 1.08, 0.12]], [tc, [-0.74, 0.92, 0.46]], [1.25, [-0.36, 1.02, 0.74]], [2.0, r0.hand], [dur, r0.hand]],
    dir: [[0, r0.dir], [0.75, r0.dir], [0.85, [-0.3, 0.9, 0.3]], [0.95, [-0.4, 0.7, -0.6]], [tc, [-0.78, 0.22, 0.58]], [1.25, [0.2, 0.4, 0.9]], [2.0, r0.dir], [dur, r0.dir]],
    palmV: [[0, r0.palm], [0.75, r0.palm], [0.95, [-0.5, -0.3, 0.8]], [tc, [0.6, 0, 0.8]], [1.25, [0.85, 0, -0.3]], [2.0, r0.palm], [dur, r0.palm]],
    pole: [[0, [-0.5, 0.6, 0.2]], [tc, [-1.0, 0.6, -0.2]], [2.0, [-0.5, 0.6, 0.2]], [dur, [-0.5, 0.6, 0.2]]]
  };
  return racketMove({
    venue: 'badmintonHall', dur, mirror: a.handedness === 'left', tool: 'badminton', payoff: tc + 0.4, body, swing,
    plants: { l: [[0, dur, 0]], r: [[0, 0.8, 0], [1.02, 1.6, tc], [1.95, dur, 2.0]] },
    contacts: [{ t: tc, side: 1, off: 0.02 }],
    look: [[0, 0.85], [tc + 0.3, 0.85], [2.0, 0.3], [dur, 0.3]],
    ballPath(t, env, ctx, S) {
      const C = ctx.C[0], A = env.W(0.6, 3.0, 4.6), T = env.W(1.3, 0.035, 5.4);
      if (t < 0.72) { S.position.copy(A); S.visible = t > 0.4; return; }
      S.visible = true; placeShuttle(S, t, [[0.72, tc, A, C, -0.05, true], [tc, tc + 0.7, C, T, 0.4]], tc + 0.7);
    }
  });
}

/* =================================================================== table tennis */
const TT_READY = { lHipA: 16, rHipA: 16, lHipF: 36, rHipF: 36, lKnee: 52, rKnee: 52, lAnk: 14, rAnk: 14, spineX: 26, chestX: 8, headX: -14, lShF: 40, lShA: 18, lEl: 80 };
const ttReady = { hand: [-0.08, 0.98, 0.38], dir: [0.25, 0.45, 0.86], palm: [0.9, 0, -0.3] };
const TY = TT.H + 0.02;   // ball centre when it touches the table

/* forehand power loop from mid-distance (Ma Long, Chuang Chih-yuan, Timo Boll) */
function ttLoop(a, o = {}) {
  const tc = 1.12, dur = 3.0, z0 = -2.3, x0 = 0.2;
  const body = [
    [0, Object.assign({ x: x0, z: z0, ry: -22 }, TT_READY, { lHipF: 34, rHipF: 22 })],
    [0.45, {}],
    [0.92, { hipsY: -30, chestY: -34, rKnee: 58, rHipF: 32, lKnee: 34, spineX: 22, spineZ: 8, headY: 40, neckY: 8 }],
    [tc, { hipsY: 6, chestY: 10, rKnee: 40, lKnee: 44, spineX: 26, spineZ: 0, headY: -12, neckY: -4, headX: 4, lShF: 55, lShA: 10, lEl: 95 }],
    [tc + 0.28, { hipsY: 22, chestY: 26, rKnee: 32, lKnee: 40, spineX: 20, headY: -6, neckY: 0 }],
    [2.1, Object.assign({ hipsY: 0, chestY: 0, headY: 0, spineZ: 0 }, TT_READY, { lHipF: 34, rHipF: 22 })],
    [dur, {}]
  ];
  const swing = {
    hand: [[0, ttReady.hand], [0.45, ttReady.hand], [0.7, [-0.32, 0.86, 0.18]], [0.92, [-0.52, 0.72, -0.12]], [1.04, [-0.5, 0.82, 0.12]], [tc, [-0.42, 0.98, 0.36]], [tc + 0.12, [-0.14, 1.32, 0.42]], [tc + 0.28, [0.08, 1.56, 0.32]], [2.1, ttReady.hand], [dur, ttReady.hand]],
    dir: [[0, ttReady.dir], [0.45, ttReady.dir], [0.7, [-0.6, 0.1, 0.8]], [0.92, [-0.5, -0.55, -0.67]], [1.04, [-0.75, -0.3, 0.4]], [tc, [-0.84, 0.3, 0.45]], [tc + 0.12, [-0.3, 0.8, 0.5]], [tc + 0.28, [0.35, 0.85, 0.4]], [2.1, ttReady.dir], [dur, ttReady.dir]],
    palmV: [[0, ttReady.palm], [0.45, ttReady.palm], [0.7, [0.6, -0.2, 0.8]], [0.92, [0.3, -0.7, 0.6]], [tc, [0.4, -0.38, 0.84]], [tc + 0.12, [0.3, -0.6, 0.75]], [tc + 0.28, [0.2, -0.4, 0.9]], [2.1, ttReady.palm], [dur, ttReady.palm]],
    pole: [[0, [-0.6, 0.6, 0.0]], [0.92, [-0.9, 0.7, -0.4]], [tc, [-0.8, 0.6, -0.1]], [tc + 0.28, [-0.4, 1.3, 0.6]], [2.1, [-0.6, 0.6, 0.0]], [dur, [-0.6, 0.6, 0.0]]]
  };
  return racketMove({
    venue: 'ttHall', dur, mirror: a.handedness === 'left', tool: 'tt', payoff: tc + 0.35, body, swing, radius: 3.6,
    plants: { l: [[0, dur, 0]], r: [[0, dur, 0, numTrack([[tc, 0], [tc + 0.25, 25], [1.9, 25], [2.2, 0]])]] },
    contacts: [{ t: tc, side: 1, off: 0.025 }],
    look: [[0, 0.9], [tc + 0.15, 0.9], [2.0, 0.5], [dur, 0.4]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x * 0.8, 0.95 * env.s, r.z + 0.45); },
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(-0.25, 0.95, 1.9), b1 = env.W(-0.45, TY, -0.72), b2 = env.W(0.4, TY, 0.85), F = env.W(0.65, 0.55, 3.4);
      if (t < 0.45) return hide(B);
      flight(t, [[0.45, 0.86, S0, b1, 0.26], [0.86, tc, b1, C, 0.2], [tc, tc + 0.3, C, b2, o.heavy ? 0.3 : 0.22], [tc + 0.3, tc + 0.8, b2, F, 0.35]], B.position);
      B.rotation.set(-t * 40, 0, 0);
    }
  });
}

/* backhand "banana" flick over the table against a short ball (Lin Yun-ju, Harimoto, Fan Zhendong) */
function ttFlick(a) {
  const tc = 1.08, dur = 2.9, z0 = -1.95;
  const body = [
    [0, Object.assign({ x: 0.0, z: z0, ry: 0 }, TT_READY)],
    [0.45, {}],
    [0.8, { z: z0 + 0.2, rHipF: 58, rKnee: 62, lHipF: 4, lKnee: 34, spineX: 34, chestX: 12, hipsY: 10, chestY: 14, headX: -4, lShF: -6, lShA: 52, lEl: 78 }],
    [tc, { spineX: 36, hipsY: -4, chestY: -6, headY: -8 }],
    [tc + 0.25, { hipsY: -10, chestY: -14, spineX: 32 }],
    [1.55, { lShF: -6, lShA: 52, lEl: 78 }],
    [1.8, Object.assign({ z: z0, hipsY: 0, chestY: 0, headY: 0 }, TT_READY)],
    [dur, {}]
  ];
  const swing = {
    hand: [[0, ttReady.hand], [0.45, ttReady.hand], [0.8, [0.06, 1.14, 0.46]], [0.98, [0.08, 1.12, 0.5]], [tc, [-0.04, 1.1, 0.64]], [tc + 0.12, [-0.2, 1.12, 0.66]], [tc + 0.28, [-0.3, 1.18, 0.6]], [1.8, ttReady.hand], [dur, ttReady.hand]],
    dir: [[0, ttReady.dir], [0.45, ttReady.dir], [0.65, [0.6, 0.1, 0.8]], [0.8, [0.5, -0.45, -0.7]], [0.98, [0.35, -0.5, -0.78]], [1.03, [0.2, -0.2, 0.96]], [tc, [-0.5, 0.2, 0.84]], [tc + 0.12, [-0.8, 0.45, 0.4]], [tc + 0.28, [-0.8, 0.55, 0.2]], [1.8, ttReady.dir], [dur, ttReady.dir]],
    palmV: [[0, ttReady.palm], [0.45, ttReady.palm], [0.8, [0, 0.4, -0.9]], [0.98, [0.1, 0.3, -0.95]], [tc, [-0.3, -0.3, -0.9]], [tc + 0.12, [0.0, -0.4, -0.9]], [1.8, ttReady.palm], [dur, ttReady.palm]],
    pole: [[0, [-0.6, 0.6, 0.0]], [0.8, [-0.5, 1.2, 0.6]], [tc, [-0.6, 1.2, 0.5]], [1.8, [-0.6, 0.6, 0.0]], [dur, [-0.6, 0.6, 0.0]]]
  };
  return racketMove({
    venue: 'ttHall', dur, mirror: a.handedness === 'left', tool: 'tt', payoff: tc + 0.35, body, swing, radius: 3.4,
    plants: { l: [[0, dur, 0]], r: [[0, 0.5, 0], [0.82, 1.55, 0.85]] },
    contacts: [{ t: tc, side: -1, off: 0.025 }],
    look: [[0, 0.9], [tc + 0.15, 0.9], [2.0, 0.5], [dur, 0.4]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x * 0.8, 0.95 * env.s, r.z + 0.45); },
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(0.1, 0.86, 1.6), s1 = env.W(0.08, TY, 0.62), s2 = env.W(0.05, TY, -0.32), b2 = env.W(-0.42, TY, 0.92), F = env.W(-0.9, 0.5, 2.9);
      if (t < 0.25) return hide(B);
      flight(t, [[0.25, 0.45, S0, s1, 0.05], [0.45, 0.78, s1, s2, 0.12], [0.78, tc, s2, C, 0.1], [tc, tc + 0.3, C, b2, 0.2], [tc + 0.3, tc + 0.8, b2, F, 0.3]], B.position);
      if (t > tc && t < tc + 0.3) B.position.x += (env.mirror ? 1 : -1) * Math.sin((t - tc) / 0.3 * Math.PI) * 0.12;   // sidespin curve ("banana")
      B.rotation.set(-t * 30, t * 50, 0);
    }
  });
}

/* close-to-table fast attack: backhand punch, then a forehand kill (Deng Yaping, Sun Yingsha) */
function ttFast(a) {
  const t1 = 0.95, t2 = 2.0, dur = 3.3, z0 = -1.85;
  const body = [
    [0, Object.assign({ x: 0.05, z: z0, ry: -8 }, TT_READY)],
    [0.6, { hipsY: 14, chestY: 14, headY: -8 }],
    [t1, { hipsY: 8, chestY: 4 }],
    [1.4, { hipsY: 0, chestY: 0, headY: 0 }],
    [1.85, { hipsY: -28, chestY: -30, rKnee: 54, lKnee: 36, headY: 30, neckY: 6 }],
    [t2, { hipsY: 10, chestY: 12, rKnee: 40, lKnee: 46, spineX: 28, headY: -10, neckY: -2, lShF: 55, lEl: 95 }],
    [t2 + 0.28, { hipsY: 28, chestY: 28, headY: -4, neckY: 0 }],
    [2.9, Object.assign({ hipsY: 0, chestY: 0, headY: 0 }, TT_READY)],
    [dur, {}]
  ];
  const swing = {
    hand: [[0, ttReady.hand], [0.55, [0.12, 0.98, 0.32]], [0.82, [0.14, 0.98, 0.32]], [t1, [0.04, 1.02, 0.52]], [1.1, [-0.04, 1.05, 0.6]], [1.4, ttReady.hand], [1.85, [-0.5, 1.15, 0.02]], [t2, [-0.38, 1.12, 0.42]], [t2 + 0.15, [-0.06, 1.3, 0.5]], [t2 + 0.3, [0.12, 1.4, 0.38]], [2.9, ttReady.hand], [dur, ttReady.hand]],
    dir: [[0, ttReady.dir], [0.55, [0.85, 0.3, 0.42]], [0.82, [0.85, 0.3, 0.42]], [t1, [0.72, 0.3, 0.62]], [1.1, [0.55, 0.35, 0.76]], [1.4, ttReady.dir], [1.6, [-0.5, 0.5, 0.7]], [1.85, [-0.6, 0.6, -0.5]], [t2, [-0.85, 0.2, 0.48]], [t2 + 0.15, [-0.2, 0.6, 0.77]], [t2 + 0.3, [0.5, 0.6, 0.6]], [2.9, ttReady.dir], [dur, ttReady.dir]],
    palmV: [[0, ttReady.palm], [0.55, [0.4, 0, -0.9]], [t1, [0.55, 0, -0.85]], [1.1, [0.6, 0, -0.8]], [1.4, ttReady.palm], [1.85, [0.4, -0.4, 0.8]], [t2, [0.48, -0.2, 0.85]], [t2 + 0.3, [0.3, -0.5, 0.8]], [2.9, ttReady.palm], [dur, ttReady.palm]],
    pole: [[0, [-0.6, 0.6, 0.0]], [t1, [-0.6, 1.0, 0.3]], [1.4, [-0.6, 0.6, 0.0]], [1.85, [-0.9, 0.9, -0.4]], [t2, [-0.8, 0.7, -0.1]], [t2 + 0.3, [-0.3, 1.3, 0.6]], [2.9, [-0.6, 0.6, 0.0]], [dur, [-0.6, 0.6, 0.0]]]
  };
  return racketMove({
    venue: 'ttHall', dur, mirror: a.handedness === 'left', tool: 'tt', payoff: t2 + 0.3, body, swing, radius: 3.5,
    plants: { l: [[0, dur, 0]], r: [[0, dur, 0, numTrack([[t2, 0], [t2 + 0.25, 22], [2.7, 22], [3.0, 0]])]] },
    contacts: [{ t: t1, side: -1, off: 0.025 }, { t: t2, side: 1, off: 0.025 }],
    look: [[0, 0.9], [dur, 0.9]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x * 0.8, 0.95 * env.s, r.z + 0.45); },
    ballPath(t, env, ctx, B) {
      const [C1, C2] = ctx.C, S0 = env.W(-0.2, 0.95, 1.8), b1 = env.W(0.15, TY, -0.55), o1 = env.W(0.3, TY, 0.8), R = env.W(0.45, 0.98, 1.65), b2 = env.W(-0.45, TY, -0.62), k = env.W(-0.3, TY, 0.95), F = env.W(-0.5, 0.4, 3.6);
      if (t < 0.4) return hide(B);
      flight(t, [[0.4, 0.72, S0, b1, 0.18], [0.72, t1, b1, C1, 0.14], [t1, 1.2, C1, o1, 0.12], [1.2, 1.42, o1, R, 0.12], [1.42, 1.75, R, b2, 0.16], [1.75, t2, b2, C2, 0.26], [t2, t2 + 0.2, C2, k, 0.05], [t2 + 0.2, t2 + 0.6, k, F, 0.15]], B.position);
      B.rotation.set(-t * 30, 0, 0);
    }
  });
}

/* =================================================================== squash */
const SQ_READY = { lHipA: 15, rHipA: 15, lHipF: 30, rHipF: 30, lKnee: 44, rKnee: 44, lAnk: 12, rAnk: 12, spineX: 20, chestX: 6, headX: -8, lShF: 40, lShA: 20, lEl: 70 };
const sqReady = { hand: [-0.26, 1.18, 0.34], dir: [-0.3, 0.85, 0.42], palm: [0.3, 0, 0.95] };
const SR = 0.02, SQT = [0, -0.5];
/* length drive down the forehand wall from the back corner (Jahangir Khan, Jansher Khan) */
function squashDrive(a, o = {}) {
  const tc = 1.45, dur = 3.7, P = [-1.75, -2.85];
  const body = [
    [0, Object.assign({ x: SQT[0], z: SQT[1], ry: 0 }, SQ_READY)],
    [0.3, { ry: -40 }],
    [0.95, { x: P[0] + 0.25, z: P[1] + 0.3, ry: -95 }],
    [1.12, { x: P[0], z: P[1], ry: -85, lHipF: 62, lKnee: 70, lHipA: 8, rHipF: 0, rKnee: 30, rHipA: 18, spineX: 22, hipsY: -20, chestY: -25, headY: 40, neckY: 8, lShF: 70, lShA: 30, lEl: 30 }],
    [tc, { hipsY: 12, chestY: 18, lKnee: 84, lHipF: 72, rKnee: 22, spineX: 30, chestX: 10, headY: 34, headX: 18, lShF: 45, lShA: 40, lEl: 40 }],
    [tc + 0.3, { hipsY: 22, chestY: 26, spineX: 22, headY: 20, headX: 0 }],
    [1.95, { lHipF: 40, lKnee: 50 }],
    [2.7, Object.assign({ x: SQT[0], z: SQT[1], ry: 0, hipsY: 0, chestY: 0, headY: 0, neckY: 0 }, SQ_READY)],
    [dur, {}]
  ];
  const swing = {
    hand: [[0, sqReady.hand], [0.3, sqReady.hand], [0.95, [-0.4, 1.5, -0.05]], [1.15, [-0.5, 1.62, -0.18]], [1.32, [-0.44, 1.05, 0.0]], [tc, [-0.12, 0.72, 0.5]], [tc + 0.15, [0.15, 1.05, 0.55]], [tc + 0.32, [0.32, 1.45, 0.36]], [2.0, sqReady.hand], [dur, sqReady.hand]],
    dir: [[0, sqReady.dir], [0.3, sqReady.dir], [0.95, [-0.3, 0.9, -0.3]], [1.15, [-0.2, 0.85, -0.5]], [1.25, [-0.3, 0.1, -0.95]], [1.35, [-0.4, -0.55, -0.73]], [tc, [0.15, -0.5, 0.85]], [tc + 0.15, [0.6, 0.35, 0.72]], [tc + 0.32, [0.35, 0.9, 0.25]], [2.0, sqReady.dir], [dur, sqReady.dir]],
    palmV: [[0, sqReady.palm], [0.3, sqReady.palm], [1.15, [0.8, 0, 0.6]], [1.35, [0.6, -0.6, 0.5]], [tc, [1, 0, -0.1]], [tc + 0.15, [0.7, 0, -0.7]], [tc + 0.32, [0.2, 0, -1]], [2.0, sqReady.palm], [dur, sqReady.palm]],
    pole: [[0, [-0.6, 0.7, 0]], [1.15, [-0.9, 1.4, -0.3]], [tc, [-0.6, 0.8, 0.1]], [tc + 0.32, [0.0, 1.5, 0.8]], [2.0, [-0.6, 0.7, 0]], [dur, [-0.6, 0.7, 0]]]
  };
  return racketMove({
    venue: 'squashCourt', dur, mirror: a.handedness === 'left', tool: 'squash', payoff: tc + 0.45, body, swing, radius: 4.4,
    run: [{ from: 0.25, to: 1.05, period: 0.36, k: 0.75 }, { from: 1.95, to: 2.7, period: 0.36, k: 0.55 }],
    plants: { l: [[1.1, 1.92, 1.15]], r: [[1.06, 1.92, 1.12, numTrack([[tc, 0], [tc + 0.25, 30]])]], all: [] },
    contacts: [{ t: tc, side: 1, off: 0.02 }],
    look: [[0, 0.85], [tc + 0.1, 0.85], [tc + 0.5, 0.5], [dur, 0.5]],
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], f = SQ.front - SR, b = SQ.back + SR;
      const S0 = env.W(-0.6, 1.0, 1.2), Fi = env.W(-2.0, 1.25, f), B1 = env.W(-2.55, SR, -1.0), F1 = env.W(-2.85, 0.75, f), B2 = env.W(-3.05, SR, -1.2), BW = env.W(-3.1, 0.32, b), R = env.W(-2.9, SR, -4.0);
      if (t < 0.15) return hide(B);
      flight(t, [[0.15, 0.42, S0, Fi, 0.1], [0.42, 1.08, Fi, B1, 0.8], [1.08, tc, B1, C, 0.35], [tc, tc + 0.36, C, F1, o.power ? 0.05 : 0.12], [tc + 0.36, tc + 0.95, F1, B2, 0.55], [tc + 0.95, tc + 1.15, B2, BW, 0.2], [tc + 1.15, tc + 1.7, BW, R, 0.05]], B.position);
      B.rotation.set(-t * 20, 0, 0);
    }
  });
}
/* attacking volley drop into the front corner that dies in the nick (Ramy Ashour, Nour El Sherbini) */
function squashNick(a) {
  const tc = 1.18, dur = 3.4;
  const body = [
    [0, Object.assign({ x: SQT[0], z: SQT[1], ry: 0 }, SQ_READY)],
    [0.55, { ry: -20 }],
    [0.95, { x: -0.45, z: -0.05, ry: -55, lHipF: 58, lKnee: 60, rHipF: -4, rKnee: 26, hipsY: -18, chestY: -22, spineX: 16, headY: 30, neckY: 6, lShF: 80, lShA: 20, lEl: 40 }],
    [tc, { hipsY: 4, chestY: 6, spineX: 20, headY: 10, headX: 4, lShF: 50, lShA: 30, lEl: 60 }],
    [tc + 0.3, { hipsY: 10, chestY: 12 }],
    [2.4, Object.assign({ x: SQT[0], z: SQT[1], ry: 0, hipsY: 0, chestY: 0, headY: 0, neckY: 0 }, SQ_READY)],
    [dur, {}]
  ];
  const swing = {
    hand: [[0, sqReady.hand], [0.55, sqReady.hand], [0.95, [-0.46, 1.62, -0.06]], [1.08, [-0.5, 1.5, 0.12]], [tc, [-0.38, 1.36, 0.46]], [tc + 0.15, [-0.2, 1.22, 0.62]], [tc + 0.35, [-0.15, 1.2, 0.58]], [2.4, sqReady.hand], [dur, sqReady.hand]],
    dir: [[0, sqReady.dir], [0.55, sqReady.dir], [0.95, [-0.2, 0.9, -0.4]], [1.08, [-0.45, 0.75, -0.48]], [tc, [-0.86, 0.22, 0.46]], [tc + 0.15, [-0.5, 0.1, 0.86]], [tc + 0.35, [-0.4, 0.3, 0.86]], [2.4, sqReady.dir], [dur, sqReady.dir]],
    palmV: [[0, sqReady.palm], [0.55, sqReady.palm], [0.95, [0.6, 0, 0.8]], [tc, [0.45, 0.25, 0.86]], [tc + 0.15, [0.8, 0.3, 0.5]], [2.4, sqReady.palm], [dur, sqReady.palm]],
    pole: [[0, [-0.6, 0.7, 0]], [0.95, [-0.9, 1.5, -0.3]], [tc, [-0.9, 1.0, 0.0]], [2.4, [-0.6, 0.7, 0]], [dur, [-0.6, 0.7, 0]]]
  };
  return racketMove({
    venue: 'squashCourt', dur, mirror: a.handedness === 'left', tool: 'squash', payoff: tc + 0.7, body, swing, radius: 4.4,
    run: [{ from: 0.45, to: 0.9, period: 0.4, k: 0.5 }, { from: 1.6, to: 2.35, period: 0.4, k: 0.4 }],
    plants: { l: [[0.93, 1.6, 0.97]], r: [[0, 0.5, 0], [0.93, 1.6, 0.97, numTrack([[tc, 0], [tc + 0.2, 20]])]] },
    contacts: [{ t: tc, side: 1, off: 0.02 }],
    look: [[0, 0.85], [tc + 0.2, 0.85], [tc + 0.8, 0.6], [dur, 0.4]],
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], f = SQ.front - SR, S0 = env.W(1.2, 1.4, f), F1 = env.W(-2.85, 0.56, f), N = env.W(-3.2 + SR, SR, 4.15), R = env.W(-3.0, SR, 2.9);
      if (t < 0.35) { B.position.copy(S0); B.visible = t > 0.2; return; }
      B.visible = true;
      flight(t, [[0.35, tc, S0, C, 0.35], [tc, tc + 0.42, C, F1, 0.25], [tc + 0.42, tc + 0.62, F1, N, 0.02], [tc + 0.62, tc + 1.5, N, R, 0.0]], B.position);
      B.rotation.set(-t * 15, 0, 0);
    }
  });
}
/* sprint and lunge to the front backhand corner, lift the ball, push back to the T (Nicol David, Ali Farag) */
function squashRetrieve(a) {
  const tc = 1.2, dur = 3.7, P = [1.55, 2.55];
  const body = [
    [0, Object.assign({ x: SQT[0], z: SQT[1], ry: 0 }, SQ_READY)],
    [0.25, { ry: 22 }],
    [0.9, { x: P[0] - 0.25, z: P[1] - 0.35, ry: 30 }],
    [1.05, { x: P[0], z: P[1], ry: 32, rHipF: 84, rKnee: 96, rAnk: 12, lHipF: -30, lKnee: 18, lAnk: -12, lHipA: 10, spineX: 32, chestX: 10, hipsY: 26, chestY: 30, headY: -26, headX: 10, lShF: -30, lShA: 40, lEl: 20 }],
    [tc, { spineX: 34 }],
    [1.45, { hipsY: 10, chestY: 8, spineX: 26 }],
    [1.7, { rHipF: 50, rKnee: 60, lHipF: 0, lKnee: 30, spineX: 18 }],
    [2.6, Object.assign({ x: SQT[0], z: SQT[1], ry: 0, hipsY: 0, chestY: 0, headY: 0, headX: -8 }, SQ_READY)],
    [dur, {}]
  ];
  const swing = {
    hand: [[0, sqReady.hand], [0.3, sqReady.hand], [0.85, [0.2, 1.25, 0.15]], [1.05, [0.36, 0.72, 0.62]], [tc, [0.16, 0.6, 0.88]], [tc + 0.15, [0.0, 1.0, 0.86]], [tc + 0.35, [-0.1, 1.3, 0.62]], [1.8, [-0.2, 1.15, 0.4]], [2.6, sqReady.hand], [dur, sqReady.hand]],
    dir: [[0, sqReady.dir], [0.3, sqReady.dir], [0.85, [0.5, 0.8, -0.3]], [1.05, [0.6, -0.4, 0.69]], [tc, [0.1, -0.45, 0.89]], [tc + 0.15, [-0.3, 0.5, 0.81]], [tc + 0.35, [-0.3, 0.85, 0.43]], [2.6, sqReady.dir], [dur, sqReady.dir]],
    palmV: [[0, sqReady.palm], [0.3, sqReady.palm], [0.85, [0.3, 0, -0.95]], [1.05, [-0.2, -0.6, -0.75]], [tc, [-0.1, -0.75, -0.65]], [tc + 0.15, [0.2, -0.6, -0.75]], [2.6, sqReady.palm], [dur, sqReady.palm]],
    pole: [[0, [-0.6, 0.7, 0]], [0.85, [-0.5, 1.2, 0.5]], [tc, [-0.6, 1.0, 0.4]], [2.6, [-0.6, 0.7, 0]], [dur, [-0.6, 0.7, 0]]]
  };
  return racketMove({
    venue: 'squashCourt', dur, mirror: a.handedness === 'left', tool: 'squash', payoff: tc + 0.45, body, swing, radius: 4.6,
    run: [{ from: 0.2, to: 0.98, period: 0.32, k: 0.85 }, { from: 1.75, to: 2.55, period: 0.38, k: 0.35 }],
    plants: { r: [[1.03, 1.72, 1.06]], l: [[1.03, 1.72, 1.06, 20]] },
    contacts: [{ t: tc, side: -1, off: 0.02 }],
    look: [[0, 0.85], [tc + 0.3, 0.85], [2.2, 0.4], [dur, 0.4]],
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], f = SQ.front - SR, S0 = env.W(0.3, 0.75, f), B1 = env.W(2.05, SR, 3.75), F1 = env.W(0.4, 3.4, f), L = env.W(-2.3, SR, -3.6), R = env.W(-2.6, SR, -4.5);
      if (t < 0.25) { B.position.copy(S0); B.visible = t > 0.1; return; }
      B.visible = true;
      flight(t, [[0.25, 0.8, S0, B1, 0.25], [0.8, tc, B1, C, 0.12], [tc, tc + 0.5, C, F1, 0.6], [tc + 0.5, tc + 1.9, F1, L, 1.5], [tc + 1.9, tc + 2.2, L, R, 0.3]], B.position);
      B.rotation.set(-t * 15, 0, 0);
    }
  });
}

/* =================================================================== volleyball & beach volleyball */
/* generic move without a tool: body keys, plants, IK arm tracks, contacts computed from the posed body */
function bodyMove(cfg) {
  const body = cfg.poseFn || poseTrack(cfg.body), plant = planter(cfg.plants || {});
  const arms = (cfg.arms || []).map(k => ({ side: k.side, f: armTrack(k) })), look = cfg.look ? numTrack(cfg.look) : null;
  const poseAt = t => { const q = body(t); if (cfg.run) for (const r of cfg.run) if (t > r.from && t < r.to) addPose(q, gait((t - r.from) / r.period + (r.phase || 0), r.k, !!r.hold), Math.min(smooth(span(t, r.from, r.from + 0.12)), 1 - smooth(span(t, r.to - 0.12, r.to)))); if (cfg.poseMod) cfg.poseMod(q, t); return q; };
  const ctx = { C: [] };
  function apply(t, env) { env.pose(poseAt(t)); plant.apply(t, env, cfg.ground || 0); for (const a of arms) a.f(t, env, a.side); if (cfg.after) cfg.after(t, env, ctx); }
  return {
    venue: cfg.venue, dur: cfg.dur, hold: cfg.hold || 0.6, payoff: cfg.payoff, mirror: cfg.mirror, view: cfg.view, orbit: cfg.orbit, allowBelowGround: cfg.allowBelowGround,
    start(env) {
      ctx.ball = env.props.ball; env.props.ball.visible = true; if (cfg.props) cfg.props(env, ctx);
      plant.init(env, poseAt);
      ctx.C = (cfg.contacts || []).map(c => { apply(c.t, env); return c.at(env, ctx); });
      if (cfg.init) cfg.init(env, ctx, apply);
    },
    frame(t, env) {
      apply(t, env); cfg.ballPath(t, env, ctx, ctx.ball);
      if (look) { const w = look(t), L = cfg.lookAt ? cfg.lookAt(t, env, ctx) : ctx.ball.position; if (w > 0 && L.y > -1) lookAt(env, L, w); }
      const r = env.rig.root.position, f = cfg.focus ? cfg.focus(t, env, ctx) : new V3(r.x, 1.15 * env.s, r.z);
      const out = { focus: f, radius: (cfg.radius || 5.5) * Math.max(1, env.s) }; if (cfg.mood) out.mood = cfg.mood(t); return out;
    }
  };
}
const VB_READY = { lHipA: 10, rHipA: 10, lHipF: 30, rHipF: 30, lKnee: 40, rKnee: 40, lAnk: 10, rAnk: 10, spineX: 22, chestX: 6, headX: -12, lShF: 30, rShF: 30, lEl: 60, rEl: 60, lShA: 10, rShA: 10 };
const VR = 0.105;
const vbVenue = (a, beach) => (beach ? 'beachCourt' : 'volleyCourt') + (a.gender === 'f' ? 'W' : 'M');
const PUMP = { rShF: 95, rShA: 35, rEl: 125, rWrF: 0, lShF: 25, lShA: 15, lEl: 40, headX: -12, spineX: 6, joy: 1 };
/* approach + arm swing for the spike and the jump serve; t0 = time of the first approach step */
function approachKeys(t0, x0, z0, dz, air, ry, extra = {}) {
  const tc = t0 + 1.05, Z = k => z0 + dz * k;
  return { tc, keys: [
    [t0, { x: x0, z: Z(0.08), lHipF: 45, lKnee: 30, rHipF: -5, rKnee: 25, spineX: 20 }],
    [t0 + 0.25, { x: x0, z: Z(0.45), rHipF: 50, rKnee: 30, lHipF: -15, lKnee: 40, air: 0.12, spineX: 30, lShF: -55, rShF: -55, lEl: 15, rEl: 15, lShA: 10, rShA: 10, headX: -12 }],
    [t0 + 0.43, { z: Z(0.82), air: 0, rHipF: 50, rKnee: 72, lHipF: 42, lKnee: 76, rAnk: 15, lAnk: 15, spineX: 38, chestX: 10, lShF: -75, rShF: -75, lEl: 10, rEl: 10, headX: -24 }],
    [t0 + 0.57, { z: Z(0.9), air: air * 0.3, rHipF: 10, rKnee: 15, lHipF: 10, lKnee: 15, rAnk: -35, lAnk: -35, spineX: 10, chestX: 2, lShF: 120, rShF: 110, lEl: 20, rEl: 30, headX: -30 }],
    [tc - 0.12, { z: Z(0.96), air: air * 0.95, rHipF: -5, rKnee: 45, lHipF: 15, lKnee: 35, spineX: -10, chestX: -6, hipsY: -15, chestY: -25, lShF: 165, lShA: 10, lEl: 10, rShF: 150, rShA: 45, rEl: 120, headX: -35 }],
    [tc, Object.assign({ z: Z(1.0), air, spineX: 12, chestX: 6, hipsY: 10, chestY: 15, lShF: 70, lShA: 20, lEl: 100, rShF: 170, rShA: 10, rEl: 10, headX: -30, rKnee: 30, lKnee: 30, rHipF: 15, lHipF: 15 }, extra)],
    [tc + 0.18, { z: Z(1.04), air: air * 0.6, spineX: 30, chestX: 10, hipsY: 20, chestY: 20, rShF: 45, rShA: -18, rEl: 30, lShF: 40, lEl: 80, headX: 0 }],
    [tc + 0.36, { z: Z(1.08), air: 0, rHipF: 46, rKnee: 72, lHipF: 46, lKnee: 72, rAnk: 15, lAnk: 15, spineX: 30, hipsY: 0, chestY: 0 }]
  ] };
}
/* outside-hitter spike with a three-step approach (Zhu Ting, Kim Yeon-koung, Giba; beach) */
function vbSpike(a, o = {}) {
  const beach = o.beach, air = (a.gender === 'f' ? 0.52 : 0.68) * (beach ? 0.8 : 1);
  const x0 = beach ? 2.0 : 3.1, z0 = beach ? -3.9 : -4.3, ry = -12;
  const ap = approachKeys(0.45, x0, z0, beach ? 2.75 : 3.25, air, ry), tc = ap.tc, dur = tc + 2.1;
  const body = [[0, Object.assign({ x: x0, z: z0, ry }, VB_READY)], [0.4, {}], ...ap.keys,
    [tc + 0.9, Object.assign({ hipsY: 0, chestY: 0, spineZ: 0, headX: -6, joy: 0 }, VB_READY, { spineX: 12, lHipF: 14, rHipF: 14, lKnee: 18, rKnee: 18 })],
    [tc + 1.25, PUMP], [dur, {}]];
  const H = [-0.16, 2.36, 0.32], zEnd = z0 + (beach ? 2.75 : 3.25) * 1.08;
  return bodyMove({
    venue: vbVenue(a, beach), dur, mirror: a.handedness === 'left', payoff: tc + 0.2, body,
    plants: { l: [[0, 0.42, 0], [tc + 0.36, dur, tc + 0.4]], r: [[0, 0.68, 0], [tc + 0.36, dur, tc + 0.4]] },
    arms: [{ side: 'r', hand: [[0, H], [dur, H]], pole: [[0, [-0.8, 1.9, -0.4]], [dur, [-0.8, 1.9, -0.4]]], w: [[tc - 0.2, 0], [tc - 0.04, 1], [tc + 0.03, 1], [tc + 0.15, 0]] }],
    contacts: [{ t: tc, at: env => env.ws([H[0], H[1] + 0.07, H[2] + 0.1]) }],
    look: [[0, 0.9], [tc + 0.1, 0.9], [tc + 0.5, 0.4], [dur, 0.2]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x, 1.25 * env.s, r.z); }, radius: 6, view: a.handedness === 'left' ? -70 : 70,
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(-0.8, 2.4, -0.55), T = env.W(-1.2, VR, beach ? 4.0 : 4.6), T2 = env.W(-2.0, VR, beach ? 7.2 : 8.2);
      if (t < 0.45) { B.position.copy(S0); B.visible = false; return; }
      B.visible = true; flight(t, [[0.45, tc, S0, C, 1.6], [tc, tc + 0.36, C, T, 0.05], [tc + 0.36, tc + 1.1, T, T2, 0.9]], B.position);
      B.rotation.set(-t * 12, t * 3, 0); void zEnd;
    }
  });
}
/* jump serve: one-hand toss, approach, hit in the air (Wilfredo León, Yūki Ishikawa, April Ross; beach) */
function vbJumpServe(a, o = {}) {
  const beach = o.beach, air = (a.gender === 'f' ? 0.5 : 0.66) * (beach ? 0.8 : 1), line = beach ? -8 : -9;
  const x0 = -1.4, z0 = line - (beach ? 3.0 : 3.6), tr = 0.55;
  const ap = approachKeys(0.95, x0, z0 + 0.6, (line - 0.55) - (z0 + 0.6), air, 0), tc = ap.tc, dur = tc + 2.1;
  const body = [
    [0, Object.assign({ x: x0, z: z0, ry: 0 }, VB_READY, { lHipF: 14, rHipF: 14, lKnee: 14, rKnee: 14, spineX: 8, rShF: 25, rEl: 70, lShF: 15, lEl: 30, headX: -6 })],
    [0.35, { rShF: 5, rEl: 50, spineX: 16, lKnee: 24, rKnee: 24, lHipF: 20, rHipF: 20 }],
    [tr, { rShF: 155, rShA: 8, rEl: 8, spineX: 4, headX: -32, lKnee: 12, rKnee: 12 }],
    [0.8, { rShF: 70, rEl: 40, headX: -40 }],
    ...ap.keys,
    [tc + 0.9, Object.assign({ hipsY: 0, chestY: 0, headX: -6, joy: 0 }, VB_READY, { spineX: 12, lHipF: 14, rHipF: 14, lKnee: 18, rKnee: 18 })],
    [tc + 1.25, PUMP], [dur, {}]];
  const H = [-0.16, 2.36, 0.3];
  let R = null;
  return bodyMove({
    venue: vbVenue(a, beach), dur, mirror: a.handedness === 'left', payoff: tc + 0.45, body,
    plants: { l: [[0, 0.9, 0], [tc + 0.36, dur, tc + 0.4]], r: [[0, 0.9, 0], [tc + 0.36, dur, tc + 0.4]] },
    arms: [{ side: 'r', hand: [[0, H], [dur, H]], pole: [[0, [-0.8, 1.9, -0.4]], [dur, [-0.8, 1.9, -0.4]]], w: [[tc - 0.2, 0], [tc - 0.04, 1], [tc + 0.03, 1], [tc + 0.15, 0]] }],
    contacts: [{ t: tc, at: env => env.ws([H[0], H[1] + 0.07, H[2] + 0.1]) }],
    init(env, ctx, apply) { apply(tr, env); R = env.handPos('r').clone().add(new V3(0, 0.08, 0)); },
    look: [[0, 0.9], [tc + 0.1, 0.9], [tc + 0.5, 0.3], [dur, 0.2]],
    focus(t, env) { const r = env.rig.root.position, k = smooth(span(t, 0.4, 0.8)) * (1 - smooth(span(t, 1.0, 1.5))); return new V3(r.x, (1.25 + 0.9 * k) * env.s, r.z); }, radius: 6.2, view: 75,
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], T = env.W(1.0, VR, beach ? 5.2 : 6.0), T2 = env.W(1.6, VR, beach ? 8.8 : 9.6);
      if (t < tr) { B.position.copy(env.handPos('r')).add(new V3(0, 0.08, 0)); }
      else if (t < tc) { const T0 = tc - tr, u = t - tr, v0 = new V3().subVectors(C, R).addScaledVector(UPY, 4.9 * T0 * T0).multiplyScalar(1 / T0); B.position.copy(R).addScaledVector(v0, u).addScaledVector(UPY, -4.9 * u * u); }
      else flight(t, [[tc, tc + 0.72, C, T, 1.35], [tc + 0.72, tc + 1.4, T, T2, 0.8]], B.position);
      B.rotation.set(-t * 14, 0, 0);
    }
  });
}
/* floor defence: low stance, step, forearm dig and (o.dive) a sprawl onto the floor (Karch Kiraly; beach diggers); o.pass: standing reception (Jordan Larson) */
function vbDig(a, o = {}) {
  const beach = o.beach, dive = o.dive, tc = 0.95, dur = dive ? 3.4 : 3.2, x0 = beach ? -1.8 : -2.0, z0 = beach ? -5.2 : -6.0;
  const keys = [
    [0, Object.assign({ x: x0, z: z0, ry: 0 }, { lHipA: 18, rHipA: 18, lHipF: 50, rHipF: 50, lKnee: 72, rKnee: 72, lAnk: 18, rAnk: 18, spineX: 32, chestX: 8, headX: -22, lShF: 40, rShF: 40, lEl: 25, rEl: 25, lShA: 10, rShA: 10 })],
    [0.55, {}],
    [0.8, { x: x0 - 0.2, ry: -12, rHipA: 30, rHipF: 58, rKnee: 84, lKnee: 56, lHipF: 40, spineX: 38 }],
    [tc, { x: x0 - 0.3, spineX: 42, chestX: 10, headX: -16 }]
  ];
  if (dive) keys.push(
    [1.12, { x: x0 - 0.4, z: z0 + 0.15, hipsX: 34, seat: 0.45, seatY: 0.55, rHipF: 30, rKnee: 50, lHipF: 10, lKnee: 30, spineX: 30, headX: -40 }],
    [1.32, { z: z0 + 0.6, hipsX: 80, spineX: 4, chestX: 0, seat: 1, seatY: 0.21, lHipF: -2, rHipF: -2, lKnee: 18, rKnee: 28, lHipA: 12, rHipA: 8, lAnk: 30, rAnk: 30, lShF: 165, rShF: 165, lShA: 20, rShA: 20, lEl: 10, rEl: 10, headX: -58 }],
    [1.62, { z: z0 + 0.95 }],
    [2.3, { lShF: 150, rShF: 150, headX: -62 }],
    [dur, { joy: 1, headX: -64 }]);
  else keys.push(
    [1.25, { spineX: 30, lKnee: 50, rKnee: 60, headX: -30 }],
    [2.0, Object.assign({ x: x0 - 0.3, ry: 0 }, VB_READY, { spineX: 14, lKnee: 24, rKnee: 24, lHipF: 18, rHipF: 18 })],
    [2.5, PUMP], [dur, {}]);
  const P = o.pass ? [-0.2, 0.78, 0.5] : [-0.3, 0.55, 0.58];
  const sandPuff = [];
  return bodyMove({
    venue: vbVenue(a, beach), dur, mirror: a.handedness === 'left', payoff: tc + 0.25, body: keys, allowBelowGround: false,
    plants: dive ? { l: [[0, 1.0, 0]], r: [[0, 0.62, 0], [0.82, 1.02, 0.85]] } : { l: [[0, dur, 0]], r: [[0, 0.62, 0], [0.82, dur, 0.85]] },
    arms: [
      { side: 'l', hand: [[0, [P[0] + 0.035, P[1], P[2]]], [dur, [P[0] + 0.035, P[1], P[2]]]], pole: [[0, [0.7, 0.2, 0.3]], [dur, [0.7, 0.2, 0.3]]], w: [[0.55, 0], [0.82, 1], [tc + 0.08, 1], [tc + 0.25, 0]] },
      { side: 'r', hand: [[0, [P[0] - 0.035, P[1], P[2]]], [dur, [P[0] - 0.035, P[1], P[2]]]], pole: [[0, [-0.9, 0.2, 0.3]], [dur, [-0.9, 0.2, 0.3]]], w: [[0.55, 0], [0.82, 1], [tc + 0.08, 1], [tc + 0.25, 0]] }],
    contacts: [{ t: tc, at: env => { const m = env.bonePos('lForearm').add(env.bonePos('rForearm')).add(env.bonePos('lHand')).add(env.bonePos('rHand')).multiplyScalar(0.25); return m.add(new V3(0, VR + 0.03, 0)); } }],
    props(env) {
      if (!beach || !dive) return;
      for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035 + (i % 3) * 0.01, 6, 4), M('#d9bd8c', { roughness: 1, transparent: true })); sandPuff.push(m); env.addProp(m); }
    },
    after(t, env) {
      if (!sandPuff.length) return;
      const r = env.rig.root.position, k = span(t, 1.28, 2.1);
      sandPuff.forEach((m, i) => { const a2 = i / 9 * Math.PI * 2; m.visible = k > 0 && k < 1; m.position.set(r.x + Math.cos(a2) * (0.2 + 0.6 * k), 0.05 + Math.sin(k * Math.PI) * (0.25 + (i % 3) * 0.1), r.z + 0.5 + Math.sin(a2) * (0.2 + 0.6 * k)); m.material.opacity = 1 - k; });
    },
    look: [[0, 0.9], [dur, 0.9]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x, (dive ? lerp(1.0, 0.7, smooth(span(t, 1.0, 1.4))) : 1.0) * env.s, r.z + 0.3); }, radius: 5.4,
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(o.pass ? 1.5 : 1.2, o.pass ? 2.6 : 3.2, o.pass ? 8.5 : 1.0), U = env.W(-0.6, 4.6, -1.2), D = env.W(-0.4, 2.6, -0.6);
      const tIn = o.pass ? 0.0 : 0.55;
      if (t < tIn) return hide(B);
      flight(t, [[tIn, tc, S0, C, o.pass ? 1.4 : 0.05], [tc, tc + 1.15, C, U, 1.2], [tc + 1.15, tc + 1.7, U, D, 0.3]], B.position);
      B.rotation.set(-t * 10, t * 4, 0);
    }
  });
}
/* block at the net (Kerri Walsh Jennings indoor; beach blockers Alison Cerutti, Anders Mol: hand signals behind the back first) */
function vbBlock(a, o = {}) {
  const beach = o.beach, t0 = beach ? 0.9 : 0, tc = t0 + 1.05, dur = tc + 2.1, air = (a.gender === 'f' ? 0.46 : 0.58) * (beach ? 0.75 : 1);
  const UP = { lShF: 112, rShF: 112, lShA: 22, rShA: 22, lEl: 92, rEl: 92, lWrF: 0, rWrF: 0 };
  const keys = [
    [0, Object.assign({ x: 0.4, z: -0.48, ry: 0, lHipA: 10, rHipA: 10, lHipF: 16, rHipF: 16, lKnee: 24, rKnee: 24, lAnk: 6, rAnk: 6, spineX: 8, headX: -8 }, beach ? { spineX: 14, lShF: -30, rShF: -30, lEl: 80, rEl: 80, lShA: 15, rShA: 15 } : UP)]
  ];
  if (beach) keys.push([0.75, { headY: 0 }], [t0 + 0.2, Object.assign({ spineX: 8 }, UP)]);
  keys.push(
    [t0 + 0.55, { lHipF: 46, rHipF: 46, lKnee: 64, rKnee: 64, lAnk: 16, rAnk: 16, spineX: 16, headX: -14 }],
    [t0 + 0.72, { air: air * 0.3, lHipF: 8, rHipF: 8, lKnee: 14, rKnee: 14, lAnk: -30, rAnk: -30, spineX: 6, lShF: 150, rShF: 150, lEl: 30, rEl: 30 }],
    [tc, { air, lHipF: 22, rHipF: 22, lKnee: 28, rKnee: 28, spineX: 8, chestX: 4, lShF: 172, rShF: 172, lShA: 8, rShA: 8, lEl: 4, rEl: 4, headX: -18 }],
    [tc + 0.25, { air: air * 0.3, spineX: 4 }],
    [tc + 0.4, { air: 0, lHipF: 46, rHipF: 46, lKnee: 62, rKnee: 62, lAnk: 16, rAnk: 16, spineX: 18, lShF: 120, rShF: 120 }],
    [tc + 0.85, Object.assign({ lHipF: 14, rHipF: 14, lKnee: 18, rKnee: 18, lAnk: 4, rAnk: 4, spineX: 6, headX: -6 }, { lShF: 30, rShF: 30, lEl: 40, rEl: 40, lShA: 10, rShA: 10 })],
    [tc + 1.25, Object.assign({}, PUMP, { lShF: 150, lShA: 30, lEl: 30, rShF: 150, rShA: 30, rEl: 30 })], [dur, {}]);
  const HL = [0.14, 2.4, 0.52], HR = [-0.14, 2.4, 0.52], w = [[t0 + 0.6, 0], [tc - 0.1, 1], [tc + 0.15, 1], [tc + 0.35, 0]];
  const arms = [
    { side: 'l', hand: [[0, HL], [dur, HL]], pole: [[0, [0.8, 2.0, 0]], [dur, [0.8, 2.0, 0]]], w },
    { side: 'r', hand: [[0, HR], [dur, HR]], pole: [[0, [-0.8, 2.0, 0]], [dur, [-0.8, 2.0, 0]]], w }];
  if (beach) {   // hand signals behind the back (fingers implied)
    const BL = [0.1, 0.98, -0.2], BR = [-0.1, 0.98, -0.2], ws = [[0, 1], [0.7, 1], [0.95, 0]];
    arms.push({ side: 'l', hand: [[0, BL], [dur, BL]], pole: [[0, [0.6, 1.0, -0.2]], [dur, [0.6, 1.0, -0.2]]], w: ws }, { side: 'r', hand: [[0, BR], [dur, BR]], pole: [[0, [-0.6, 1.0, -0.2]], [dur, [-0.6, 1.0, -0.2]]], w: ws });
  }
  return bodyMove({
    venue: vbVenue(a, beach), dur, mirror: a.handedness === 'left', payoff: tc + 0.3, body: keys,
    plants: { l: [[0, t0 + 0.62, 0], [tc + 0.4, dur, tc + 0.45]], r: [[0, t0 + 0.62, 0], [tc + 0.4, dur, tc + 0.45]] },
    arms, contacts: [{ t: tc, at: env => env.ws([0, 2.5, 0.6]) }],
    look: [[0, beach ? 0 : 0.6], [t0 + 0.2, 0.85], [tc + 0.4, 0.85], [dur, 0.3]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x, 1.45 * env.s, r.z); }, radius: 6.0, view: beach ? 160 : undefined,
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(0.9, 2.2, 2.6), A = env.W(0.7, 3.2, 1.7), T = env.W(0.45, VR, 1.4), T2 = env.W(0.9, VR, 2.6);
      if (t < tc - 1.0) { B.position.copy(S0); B.visible = false; return; }
      B.visible = true;
      flight(t, [[tc - 1.0, tc - 0.22, S0, A, 1.1], [tc - 0.22, tc, A, C, 0.0], [tc, tc + 0.4, C, T, 0.15], [tc + 0.4, tc + 1.0, T, T2, 0.5]], B.position);
      B.rotation.set(t * 12, 0, 0);
    }
  });
}

/* =================================================================== sepak takraw */
const K_READY = { lHipA: 12, rHipA: 12, lHipF: 22, rHipF: 22, lKnee: 30, rKnee: 30, lAnk: 8, rAnk: 8, spineX: 14, chestX: 4, headX: -8, lShF: 20, rShF: 20, lShA: 25, rShA: 25, lEl: 40, rEl: 40 };
const KR = 0.068;
const tkVenue = a => a.gender === 'f' ? 'takrawCourtW' : 'takrawCourtM';
const footPoint = (env, side, fwd, up) => { const ft = env.rig.bones[env.side(side) + 'Foot']; return ft.localToWorld(new V3(0, up, fwd)); };
/* roll spike: back to the net, take off from the left foot and whip the right leg over in a bicycle-kick roll (Suebsak Phunsueb, Sittipong Khamchan) */
function takrawRoll(a) {
  const tc = 1.55, dur = 3.7, x0 = 0.7, z0 = -1.45;
  const body = [
    [0, Object.assign({ x: x0, z: z0, ry: 200 }, K_READY, { headY: 55, neckY: 10 })],
    [0.6, { headY: 50 }],
    [0.95, { z: z0 + 0.3, ry: 190, lHipF: 30, lKnee: 45, rHipF: 8, rKnee: 30, spineX: 10, headY: 10, headX: -30 }],
    [1.17, { z: z0 + 0.45, lHipF: 46, lKnee: 72, rHipF: 30, rKnee: 52, lAnk: 18, spineX: 18 }],
    [1.32, { air: 0.25, z: z0 + 0.55, lHipF: 10, lKnee: 12, lAnk: -30, rHipF: 90, rKnee: 70, hipsX: -25, spineX: -5, headX: -30, lShA: 60, rShA: 60, lEl: 20, rEl: 20 }],
    [tc, { air: 0.62, ry: 172, z: z0 + 0.62, hipsX: -72, spineX: -8, chestX: -6, rHipF: 150, rKnee: 6, rAnk: -20, lHipF: -15, lKnee: 40, lAnk: -10, headX: -20, lShF: 40, lShA: 80, rShF: 40, rShA: 80, lEl: 10, rEl: 10 }],
    [tc + 0.2, { air: 0.42, hipsX: -42, rHipF: 90, rKnee: 30, lHipF: 20, lKnee: 60 }],
    [tc + 0.42, { air: 0, ry: 160, hipsX: 0, spineX: 30, lHipF: 60, lKnee: 86, rHipF: 50, rKnee: 82, lAnk: 18, rAnk: 18, lShF: 40, rShF: 40, lShA: 40, rShA: 40, headX: 0 }],
    [2.6, Object.assign({ ry: 160, hipsX: 0, headY: 0 }, K_READY)],
    [3.05, Object.assign({}, PUMP, { lShA: 30 })], [dur, {}]
  ];
  return bodyMove({
    venue: tkVenue(a), dur, mirror: a.handedness === 'left', payoff: tc + 0.2, body,
    plants: { l: [[0, 0.75, 0], [1.0, 1.27, 1.05], [tc + 0.42, dur, tc + 0.46]], r: [[0, 0.75, 0], [0.98, 1.22, 1.0], [tc + 0.46, dur, tc + 0.5]] },
    contacts: [{ t: tc, at: env => footPoint(env, 'r', 0.06, -0.02).add(new V3(0, KR, 0)) }],
    look: [[0, 0.85], [tc + 0.1, 0.85], [tc + 0.5, 0.5], [dur, 0.3]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x, 1.25 * env.s, r.z + 0.2); }, radius: 5.4, view: 90,
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(-2.2, 1.0, -1.0), T = env.W(0.5, KR, 2.0), T2 = env.W(0.9, KR, 4.2);
      if (t < 0.3) { B.position.copy(S0); B.visible = t > 0.15; return; }
      B.visible = true; flight(t, [[0.3, tc, S0, C, 2.4], [tc, tc + 0.24, C, T, 0], [tc + 0.24, tc + 0.85, T, T2, 0.6]], B.position);
      B.rotation.set(t * 9, t * 5, 0);
    }
  });
}
/* sunback spike: facing the net, the right leg swings straight up and the sole drives the ball down (Fueangfa Praphatsarang) */
function takrawSunback(a) {
  const tc = 1.42, dur = 3.5, x0 = -0.7, z0 = -0.95;
  const body = [
    [0, Object.assign({ x: x0, z: z0, ry: 0 }, K_READY, { headY: -40 })],
    [0.6, { headY: -25 }],
    [0.92, { z: z0 + 0.12, lHipF: 42, lKnee: 64, rHipF: 18, rKnee: 30, lAnk: 16, spineX: 18, headY: 0, headX: -30 }],
    [1.12, { air: 0.22, lHipF: 10, lKnee: 14, lAnk: -30, rHipF: 70, rKnee: 70, spineX: 2, lShA: 60, rShA: 60, lEl: 20, rEl: 20 }],
    [tc, { air: 0.5, z: z0 + 0.2, hipsX: -14, rHipF: 138, rKnee: 4, rAnk: 25, lHipF: -12, lKnee: 34, lAnk: -10, spineX: -22, chestX: -10, headX: -8, lShA: 80, rShA: 70, lShF: 20, rShF: 20 }],
    [tc + 0.2, { air: 0.3, hipsX: 0, rHipF: 80, rKnee: 40, spineX: 8 }],
    [tc + 0.4, { air: 0, lHipF: 48, lKnee: 72, rHipF: 44, rKnee: 66, lAnk: 16, rAnk: 16, spineX: 22, lShA: 40, rShA: 40 }],
    [2.4, Object.assign({}, K_READY)],
    [2.9, PUMP], [dur, {}]
  ];
  return bodyMove({
    venue: tkVenue(a), dur, mirror: a.handedness === 'left', payoff: tc + 0.2, body,
    plants: { l: [[0, 1.08, 0.92]], r: [[0, 0.98, 0.92]], all: [] },
    poseMod(q, t) { void t; },
    contacts: [{ t: tc, at: env => footPoint(env, 'r', 0.04, -0.06).add(new V3(0, 0.03, KR)) }],
    look: [[0, 0.85], [tc + 0.1, 0.85], [tc + 0.5, 0.5], [dur, 0.3]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x, 1.2 * env.s, r.z + 0.3); }, radius: 5.2, view: 70,
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(1.8, 1.0, -1.2), T = env.W(-0.4, KR, 2.1), T2 = env.W(-0.6, KR, 4.0);
      if (t < 0.3) { B.position.copy(S0); B.visible = t > 0.15; return; }
      B.visible = true; flight(t, [[0.3, tc, S0, C, 2.2], [tc, tc + 0.25, C, T, 0], [tc + 0.25, tc + 0.85, T, T2, 0.6]], B.position);
      B.rotation.set(t * 9, t * 5, 0);
    }
  });
}
/* tekong serve: left foot in the service circle, the right leg whips up and strikes the tossed ball (Anuwat Chaichana, Pornchai Kaokaew) */
function takrawServe(a) {
  const tc = 1.25, dur = 3.5, x0 = 0.1, z0 = -4.3;
  const body = [
    [0, Object.assign({ x: x0, z: z0, ry: -35 }, { lHipA: 8, rHipA: 10, lHipF: 10, lKnee: 12, rHipF: -18, rKnee: 15, lAnk: 4, rAnk: 4, spineX: 8, chestX: 2, lShA: 30, rShA: 30, lEl: 30, rEl: 30, headY: 32, headX: -8 })],
    [0.55, {}],
    [0.95, { rHipF: -40, rKnee: 72, rHipA: 15, lKnee: 26, lHipF: 22, spineX: 18, spineZ: -5, lShA: 70, rShA: 60, lEl: 10, rEl: 10, headY: 18 }],
    [tc, { rHipF: 112, rKnee: 8, rHipA: 22, rHipR: -25, rAnk: 30, lKnee: 18, lHipF: 6, spineX: -16, spineZ: -20, chestZ: -8, hipsY: 20, chestY: 10, lShA: 85, rShA: 40, lShF: 10, rShF: 40, headY: 8, headX: 6 }],
    [tc + 0.2, { rHipF: 88, rHipA: -10, rKnee: 30, spineX: 0, spineZ: -10, hipsY: 40, chestY: 25 }],
    [tc + 0.45, { x: x0 - 0.05, z: z0 + 0.45, ry: 0, rHipF: 30, rKnee: 30, rHipA: 10, rHipR: 0, lHipF: -10, lKnee: 20, spineX: 12, spineZ: 0, chestZ: 0, hipsY: 10, chestY: 0, headY: 0 }],
    [2.3, Object.assign({ hipsY: 0 }, K_READY)],
    [2.85, PUMP], [dur, {}]
  ];
  return bodyMove({
    venue: tkVenue(a), dur, mirror: a.handedness === 'left', payoff: tc + 0.5, body,
    plants: { l: [[0, tc + 0.25, 0, numTrack([[tc - 0.05, 0], [tc + 0.2, 45]])], [tc + 0.42, dur, tc + 0.55]], r: [[0, 0.62, 0], [tc + 0.42, dur, tc + 0.48]] },
    contacts: [{ t: tc, at: env => footPoint(env, 'r', 0.06, 0.0).add(new V3(0, KR + 0.02, 0)) }],
    look: [[0, 0.85], [tc + 0.1, 0.85], [tc + 0.6, 0.4], [dur, 0.3]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x, 1.2 * env.s, r.z + 0.5); }, radius: 5.4, view: 50,
    ballPath(t, env, ctx, B) {
      const C = ctx.C[0], S0 = env.W(-2.3, 1.2, -0.8), T = env.W(-0.8, KR, 4.6), T2 = env.W(-1.2, KR, 7.4);
      if (t < 0.3) { B.position.copy(S0); B.visible = t > 0.12; return; }
      B.visible = true; flight(t, [[0.3, tc, S0, C, 1.5], [tc, tc + 0.75, C, T, 1.0], [tc + 0.75, tc + 1.4, T, T2, 0.6]], B.position);
      B.rotation.set(t * 12, t * 6, 0);
    }
  });
}
/* feeder: cushion the pass on the knee, then set high to the net with the inside of the foot (Mohd Azlan Alias) */
function takrawFeed(a) {
  const t1 = 0.95, t2 = 1.8, dur = 3.6, x0 = 2.0, z0 = -1.5;
  const body = [
    [0, Object.assign({ x: x0, z: z0, ry: 200 }, K_READY)],
    [0.62, { rHipF: 30, rKnee: 40 }],
    [t1, { rHipF: 86, rKnee: 96, rAnk: 10, lKnee: 18, lHipF: 10, spineX: 6, lShA: 50, rShA: 50, headX: 24 }],
    [1.22, { rHipF: 18, rKnee: 26, headX: -10 }],
    [1.5, { rHipF: 28, rKnee: 56 }],
    [t2, { ry: 212, rHipF: 46, rKnee: 88, rHipR: 52, rHipA: 22, rAnk: 4, lKnee: 24, lHipF: 14, spineX: 10, spineZ: 6, lShA: 55, rShA: 55, headX: 26 }],
    [t2 + 0.25, { rHipF: 28, rKnee: 40, rHipR: 18, headX: -20 }],
    [2.6, Object.assign({ ry: 235, headX: -24 }, K_READY, { headX: -24 })],
    [3.1, { headX: -16 }], [dur, {}]
  ];
  return bodyMove({
    venue: tkVenue(a), dur, mirror: a.handedness === 'left', payoff: t2 + 0.6, body,
    plants: { l: [[0, dur, 0]], r: [[0, 0.5, 0], [1.3, 1.45, 1.35], [2.35, dur, 2.5]] },
    contacts: [
      { t: t1, at: env => env.rig.bones[env.side('r') + 'Shin'].getWorldPosition(new V3()).add(new V3(0, KR + 0.07, 0)) },
      { t: t2, at: env => footPoint(env, 'r', 0.05, -0.02).add(new V3(0, KR + 0.05, 0)) }],
    look: [[0, 0.9], [dur, 0.9]],
    focus(t, env) { const r = env.rig.root.position; return new V3(r.x - 0.6, 1.2 * env.s, r.z + 0.2); }, radius: 5.6, view: 120,
    ballPath(t, env, ctx, B) {
      const [C1, C2] = ctx.C, S0 = env.W(0.9, 1.8, -4.8), N = env.W(-1.6, 2.2, -0.35), D = env.W(-1.9, 1.5, -0.45);
      if (t < 0.1) { B.position.copy(S0); B.visible = false; return; }
      B.visible = true; flight(t, [[0.1, t1, S0, C1, 1.1], [t1, t2, C1, C2, 0.95], [t2, t2 + 1.25, C2, N, 2.3], [t2 + 1.25, t2 + 1.5, N, D, 0.05]], B.position);
      B.rotation.set(t * 6, t * 3, 0);
    }
  });
}

export const MOVES = {
  tennis_serve: a => tennisServe(a),
  tennis_forehand: a => tennisForehand(a),
  tennis_lassoForehand: a => tennisForehand(a, { lasso: true }),
  tennis_flatForehand: a => tennisForehand(a, { flat: true }),
  tennis_oneHandBackhand: a => tennisBackhand(a),
  tennis_twoHandBackhand: a => tennisBackhand(a, { two: true }),
  tennis_doubleHanded: a => tennisDoubleHanded(a),
  softtennis_serve: a => tennisServe(a, { soft: true }),
  softtennis_drive: a => tennisForehand(a, { soft: true }),
  softtennis_volley: a => softVolley(a),
  badminton_jumpSmash: a => badmintonSmash(a, { air: a.heightCm > 185 ? 0.5 : 0.56 }),
  badminton_netDeception: a => badmintonNet(a),
  badminton_frontKill: a => badmintonKill(a),
  badminton_defense: a => badmintonDefense(a),
  tt_forehandLoop: a => ttLoop(a, { heavy: a.id === 'timo-boll' }),
  tt_backhandFlick: a => ttFlick(a),
  tt_fastAttack: a => ttFast(a),
  squash_drive: a => squashDrive(a, { power: a.id === 'jahangir-khan' }),
  squash_nickVolley: a => squashNick(a),
  squash_retrieve: a => squashRetrieve(a),
  volleyball_spike: a => vbSpike(a),
  volleyball_jumpServe: a => vbJumpServe(a),
  volleyball_dig: a => vbDig(a, { dive: true }),
  volleyball_receive: a => vbDig(a, { pass: true }),
  volleyball_block: a => vbBlock(a),
  beach_spike: a => vbSpike(a, { beach: true }),
  beach_jumpServe: a => vbJumpServe(a, { beach: true }),
  beach_block: a => vbBlock(a, { beach: true }),
  beach_dig: a => vbDig(a, { beach: true, dive: true }),
  takraw_rollSpike: a => takrawRoll(a),
  takraw_sunbackSpike: a => takrawSunback(a),
  takraw_serve: a => takrawServe(a),
  takraw_feed: a => takrawFeed(a)
};
export const SIGNATURE = {
  'roger-federer': 'tennis_oneHandBackhand', 'rafael-nadal': 'tennis_lassoForehand', 'novak-djokovic': 'tennis_twoHandBackhand', 'serena-williams': 'tennis_serve',
  'naomi-osaka': 'tennis_serve', 'hsieh-su-wei': 'tennis_doubleHanded', 'li-na': 'tennis_twoHandBackhand', 'steffi-graf': 'tennis_flatForehand',
  'tai-tzu-ying': 'badminton_netDeception', 'lin-dan': 'badminton_jumpSmash', 'lee-chong-wei': 'badminton_jumpSmash', 'viktor-axelsen': 'badminton_jumpSmash', 'p-v-sindhu': 'badminton_jumpSmash',
  'chen-long': 'badminton_defense', 'carolina-marin': 'badminton_jumpSmash', 'lee-yang': 'badminton_frontKill', 'wang-chi-lin': 'badminton_jumpSmash',
  'ma-long': 'tt_forehandLoop', 'deng-yaping': 'tt_fastAttack', 'timo-boll': 'tt_forehandLoop', 'lin-yun-ju': 'tt_backhandFlick', 'fan-zhendong': 'tt_backhandFlick',
  'chuang-chih-yuan': 'tt_forehandLoop', 'tomokazu-harimoto': 'tt_backhandFlick', 'sun-yingsha': 'tt_fastAttack',
  'jahangir-khan': 'squash_drive', 'jansher-khan': 'squash_drive', 'nicol-david': 'squash_retrieve', 'ramy-ashour': 'squash_nickVolley', 'nour-el-sherbini': 'squash_nickVolley', 'ali-farag': 'squash_retrieve',
  'karch-kiraly': 'volleyball_dig', 'zhu-ting-volleyball': 'volleyball_spike', 'y-ki-ishikawa': 'volleyball_jumpServe', 'giba': 'volleyball_spike', 'kerri-walsh-jennings': 'volleyball_block',
  'kim-yeon-koung': 'volleyball_spike', 'jordan-larson': 'volleyball_receive', 'wilfredo-leon': 'volleyball_jumpServe',
  'misty-may-treanor': 'beach_dig', 'april-ross': 'beach_jumpServe', 'alison-cerutti': 'beach_block', 'bruno-schmidt': 'beach_dig', 'anders-mol': 'beach_block', 'christian-sorum': 'beach_dig',
  'suebsak-phunsueb': 'takraw_rollSpike', 'anuwat-chaichana': 'takraw_serve', 'pornchai-kaokaew': 'takraw_serve', 'sittipong-khamchan': 'takraw_rollSpike',
  'fueangfa-praphatsarang': 'takraw_sunbackSpike', 'azlan-alias': 'takraw_feed',
  'hayato-funemizu': 'softtennis_drive', 'toshiki-uematsu': 'softtennis_serve', 'lee-chia-hung': 'softtennis_volley', 'cheng-chu-ling': 'softtennis_drive'
};
const SPORT_MOVES = { tennis: 'tennis_', 'soft-tennis': 'softtennis_', badminton: 'badminton_', tabletennis: 'tt_', squash: 'squash_', volleyball: 'volleyball_', 'beach-volleyball': 'beach_', 'sepak-takraw': 'takraw_' };
export function movesFor(a) {
  const pre = SPORT_MOVES[a.sport] || '', sig = SIGNATURE[a.id], list = Object.keys(MOVES).filter(m => m.startsWith(pre));
  return sig ? [sig, ...list.filter(m => m !== sig)] : list;
}
