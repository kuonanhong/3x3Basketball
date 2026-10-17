/* SmartAction Sports — 3D signature moves for goal sports: handball, ice hockey, water polo, cricket and softball.
   Stylized animation of publicly known playing styles (catalogue notes / traits / handedness). Venues and equipment
   are generic and procedural: no team names, logos, sponsor marks or brands. Authored for right-handers; the motion
   runtime mirrors poses for left-handers. MIT. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { poseTrack, vecTrack, numTrack, gait, addPose, arc, headingTo, span, smooth, lerp, clamp, MotionEnv } from '../motion.js';
import { canvasTex, add, rng, crowd, makeGlove } from '../scenes.js';
import { AthleteRig, UNIFORMS } from '../rig.js';

export const SPORTS = ['handball', 'ice-hockey', 'water-polo', 'cricket', 'softball'];

const D2R = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _mc = new Map();
function M(color, o = {}) { const k = color + JSON.stringify(o); if (!_mc.has(k)) _mc.set(k, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o))); return _mc.get(k); }
const ldir = (yaw, pitch = 0) => [Math.cos(pitch * D2R) * Math.cos(yaw * D2R), Math.sin(pitch * D2R), Math.cos(pitch * D2R) * Math.sin(yaw * D2R)];
const wave = (t, f, ph = 0) => Math.sin((t * f + ph) * Math.PI * 2);

/* orient an object so its local +Y points along dir and its local +X along x (x is made perpendicular) */
const _bx = V(), _by = V(), _bz = V(), _m4 = new THREE.Matrix4();
function orientXY(obj, pos, dir, x) {
  _by.copy(dir).normalize(); _bx.copy(x).addScaledVector(_by, -x.dot(_by));
  if (_bx.lengthSq() < 1e-8) _bx.set(1, 0, 0).addScaledVector(_by, -_by.x);
  _bx.normalize(); _bz.crossVectors(_bx, _by);
  _m4.makeBasis(_bx, _by, _bz); obj.quaternion.setFromRotationMatrix(_m4); obj.position.copy(pos); obj.updateMatrixWorld(true);
}
/* same, but the hint gives local +Z (e.g. a bat face) */
function orientYZ(obj, pos, dir, z) {
  _by.copy(dir).normalize(); _bz.copy(z).addScaledVector(_by, -z.dot(_by));
  if (_bz.lengthSq() < 1e-8) _bz.set(0, 0, 1).addScaledVector(_by, -_by.z);
  _bz.normalize(); _bx.crossVectors(_by, _bz);
  _m4.makeBasis(_bx, _by, _bz); obj.quaternion.setFromRotationMatrix(_m4); obj.position.copy(pos); obj.updateMatrixWorld(true);
}
function netMat(rx, ry, color = '#f1f1ec') {
  const t = canvasTex(32, 32, (x) => { x.clearRect(0, 0, 32, 32); x.fillStyle = color; x.fillRect(0, 0, 32, 3); x.fillRect(0, 0, 3, 32); }, [rx, ry]);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
}
function stripes(alongX, rep, a = '#d8342b', b = '#f4f4f0') {
  return canvasTex(alongX ? 64 : 8, alongX ? 8 : 64, (x, w, h) => { x.fillStyle = a; x.fillRect(0, 0, w, h); x.fillStyle = b; if (alongX) x.fillRect(w / 2, 0, w / 2, h); else x.fillRect(0, h / 2, w, h / 2); }, rep);
}
function skyTex(top = '#5f9fd9', mid = '#a9d1ef', low = '#e8f1f2') { return canvasTex(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, low); x.fillStyle = g; x.fillRect(0, 0, w, h); }); }
function standsRing(g, r0, r1, h, y, seed, base, a0 = 0, len = Math.PI * 2) {
  const st = crowd(4096, 256, seed, base);
  add(g, new THREE.CylinderGeometry(r1, r0, h, 72, 1, true, a0, len), new THREE.MeshStandardMaterial({ map: st, side: THREE.BackSide, roughness: 1 }), [0, y, 0], null, false);
}
function grassTex(rep, a = '#3f8c3c', b = '#4a9a45', seed = 11) {
  return canvasTex(512, 512, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(0, i * h / 8, w, h / 8); }
    const r = rng(seed); for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${20 + r() * 40},${70 + r() * 60},${20 + r() * 30},.25)`; x.fillRect(r() * w, r() * h, 1.5, 3); }
  }, rep);
}

/* ------------------------------------------------------------------ generic team-mates / opponents (no likeness, no number) */
function uniKey(env) { const j = env.rig.u.jersey; for (const k in UNIFORMS) if (UNIFORMS[k].jersey === j) return k; return 'teal'; }
const rivalUni = env => uniKey(env) === 'navy' ? 'coral' : 'navy';
function ghost(env, sport, o = {}) {
  const me = env.athlete || {}, f = (o.gender || me.gender) === 'f', tag = o.tag || 'player';
  let hsh = 7; for (const ch of tag + (me.id || '')) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const skins = ['#f1c9a5', '#d2a47f', '#b07a52', '#8a5a3a', '#e3b994', '#6e4630'], hairs = ['#2a2119', '#4a3020', '#1b1b1b', '#7a5a38', '#c9a066'];
  const a = { id: 'generic-' + tag, name: '', sport, gender: f ? 'f' : 'm', heightCm: o.h || (f ? 176 : 189), handedness: 'right',
    appearance: Object.assign({ skin: o.skin || skins[hsh % skins.length], hair: hairs[(hsh >>> 3) % hairs.length], hairStyle: f ? 'ponytail' : 'short', facialHair: 'none', build: 'athletic', accessory: 'none', jerseyNumber: null }, o.look || {}) };
  const rig = new AthleteRig(a, sport, o.uni || rivalUni(env));
  env.addProp(rig.root);
  const g = new MotionEnv(rig, env.props, env.venue, env.mirror); g.athlete = a; g.addProp = env.addProp;
  if (o.head !== undefined) rig.setHeadwear(o.head);
  return g;
}

/* ================================================================== VENUES */
/* --- handball: goal line z = 0 (goal 3 x 2 m, centred on x = 0), court toward +Z (40 x 20 m) */
function buildHandball(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = new THREE.Color('#151a21'); scene.fog = new THREE.Fog('#151a21', 34, 80);
  const S = 2048, m = S / 24, X = v => (v + 12) * m, Z = v => (v + 3) * m;
  const dee = (x, r) => { x.beginPath(); x.moveTo(X(-1.5 - r), Z(0)); x.arc(X(-1.5), Z(0), r * m, Math.PI, Math.PI / 2, true); x.lineTo(X(1.5), Z(r)); x.arc(X(1.5), Z(0), r * m, Math.PI / 2, 0, true); };
  const floor = canvasTex(S, S, (x) => {
    x.fillStyle = '#26415f'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#2f6aac'; x.fillRect(X(-10), Z(0), 20 * m, 21 * m);
    x.fillStyle = '#e1873c'; dee(x, 6); x.closePath(); x.fill();
    const r = rng(5); for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.035})`; x.fillRect(r() * S, r() * S, 40 + r() * 140, 2); }
    x.strokeStyle = '#f6f6f2'; x.lineWidth = 0.05 * m;
    dee(x, 6); x.stroke();
    x.setLineDash([0.15 * m, 0.15 * m]); dee(x, 9); x.stroke(); x.setLineDash([]);
    x.strokeRect(X(-10), Z(0), 20 * m, 20 * m);
    x.beginPath(); x.moveTo(X(-0.5), Z(7)); x.lineTo(X(0.5), Z(7)); x.stroke();
    x.beginPath(); x.moveTo(X(-0.075), Z(4)); x.lineTo(X(0.075), Z(4)); x.stroke();
    for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(X(sx * 10), Z(15.5)); x.lineTo(X(sx * 10.15), Z(15.5)); x.stroke(); }
    x.lineWidth = 0.08 * m; x.beginPath(); x.moveTo(X(-1.5), Z(0)); x.lineTo(X(1.5), Z(0)); x.stroke();
  });
  add(g, new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: floor, roughness: 0.42 }), [0, 0, 9], [-Math.PI / 2, 0, 0], false);
  add(g, new THREE.PlaneGeometry(20, 20), M('#2f6aac', { roughness: 0.45 }), [0, -0.012, 31.02], [-Math.PI / 2, 0, 0], false);
  add(g, new THREE.PlaneGeometry(100, 100), M('#1b2633', { roughness: 0.9 }), [0, -0.03, 15], [-Math.PI / 2, 0, 0], false);
  // goal: striped posts and crossbar (inner 3 x 2 m), net
  const pm = new THREE.MeshStandardMaterial({ map: stripes(false, [1, 5]), roughness: 0.4 }), cm = new THREE.MeshStandardMaterial({ map: stripes(true, [8, 1]), roughness: 0.4 });
  for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.08, 2.0, 0.08), pm, [sx * 1.54, 1.0, -0.04]);
  add(g, new THREE.BoxGeometry(3.16, 0.08, 0.08), cm, [0, 2.04, -0.04]);
  const nm = netMat(30, 20), ns = netMat(10, 20);
  add(g, new THREE.PlaneGeometry(3.0, 0.75), nm, [0, 1.99, -0.45], [Math.PI / 2, 0, 0], false);
  add(g, new THREE.PlaneGeometry(3.0, 2.01), nm, [0, 1.0, -0.9], [Math.atan2(0.2, 2.0), 0, 0], false);
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.94, 0); sh.lineTo(0.74, 2.0); sh.lineTo(0, 2.0); sh.closePath();
  for (const sx of [-1, 1]) { const sg = new THREE.ShapeGeometry(sh); const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i)); add(g, sg, ns, [sx * 1.5, 0, -0.06], [0, Math.PI / 2, 0], false); }
  // boards, stands, ceiling lights
  const ad = canvasTex(512, 32, (x, w, h) => { x.fillStyle = '#1d3f6e'; x.fillRect(0, 0, w, h); x.fillStyle = '#2f6aac'; for (let i = 0; i < 8; i++) x.fillRect(i * 64 + 6, 8, 40, 16); });
  ad.wrapS = THREE.RepeatWrapping; ad.repeat.set(4, 1);
  const adM = new THREE.MeshStandardMaterial({ map: ad, roughness: 0.6 });
  add(g, new THREE.BoxGeometry(24, 0.9, 0.12), adM, [0, 0.45, -3.2]);
  for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.12, 0.9, 34), adM, [sx * 12.2, 0.45, 15]);
  const stands = crowd(2048, 448, 9, '#232a33');
  for (const [px, pz, ry, w] of [[0, -9, 0, 44], [-17, 14, Math.PI / 2, 44], [17, 14, -Math.PI / 2, 44]]) add(g, new THREE.PlaneGeometry(w, 10), new THREE.MeshStandardMaterial({ map: stands, roughness: 1, color: '#c9ced4', emissive: '#0d1116', emissiveIntensity: 1 }), [px, 5.2, pz], [-0.28, ry, 0], false);
  for (let i = -2; i <= 2; i++) add(g, new THREE.BoxGeometry(2.4, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: '#fff6e0' }), [i * 4, 12, 10], null, false);
  return { group: g };
}
function makeHandball() {
  const tex = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#f3f0e6'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#d23a2c'; for (const o of [0, 0.5]) { x.beginPath(); x.ellipse((o + 0.12) * w, h * 0.3, w * 0.1, h * 0.18, 0.4, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#1f5aa8'; for (const o of [0.25, 0.75]) { x.beginPath(); x.ellipse((o + 0.1) * w, h * 0.7, w * 0.1, h * 0.18, -0.4, 0, Math.PI * 2); x.fill(); }
    x.strokeStyle = 'rgba(40,40,40,.35)'; x.lineWidth = 1.5; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(i * w / 6, 0); x.bezierCurveTo(i * w / 6 + 20, h * 0.3, i * w / 6 - 20, h * 0.7, i * w / 6, h); x.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.093, 28, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); m.castShadow = true; return m;
}

/* --- ice rink: goal line z = 0 (goal 1.83 x 1.22 m), end boards at z = -3.35, rink 60.96 x 25.9 m toward +Z */
const RINK = { HW: 12.95, R: 8.53, Z0: -3.35, Z1: -3.35 + 60.96 };
function rinkOutline(inset, n = 12) {
  const { HW, R, Z0, Z1 } = RINK, w = HW - inset, r = R - inset, a = Z0 + inset, b = Z1 - inset, pts = [];
  const corner = (cx, cz, a0) => { for (let i = 0; i <= n; i++) { const t = a0 + i / n * Math.PI / 2; pts.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]); } };
  corner(w - r, a + r, -Math.PI / 2); corner(w - r, b - r, 0); corner(-w + r, b - r, Math.PI / 2); corner(-w + r, a + r, Math.PI);
  return pts;
}
const toShape = (pts, S = new THREE.Shape()) => { pts.forEach(([x, z], i) => i ? S.lineTo(x, -z) : S.moveTo(x, -z)); S.closePath(); return S; };
const toPath = pts => { const p = new THREE.Path(); pts.forEach(([x, z], i) => i ? p.lineTo(x, -z) : p.moveTo(x, -z)); p.closePath(); return p; };
function ringExtrude(inIn, inOut, depth) { const s = toShape(rinkOutline(inOut)); s.holes.push(toPath(rinkOutline(inIn).reverse())); return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); }
function buildRink(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = new THREE.Color('#10151b'); scene.fog = new THREE.Fog('#10151b', 45, 120);
  const { Z0, Z1 } = RINK;
  // ice: one shape with the rounded outline; texture covers x in [-13.5, 13.5], z in [-3.95, 32.05]
  const W = 27, Hh = 36, zt = -3.95, px = 1536 / W;
  const iceTex = canvasTex(1536, 2048, (x) => {
    const X = v => (v + 13.5) * px, Z = v => (v - zt) * px;
    x.fillStyle = '#f4f8fb'; x.fillRect(0, 0, 1536, 2048);
    const r = rng(21); for (let i = 0; i < 2600; i++) { x.strokeStyle = `rgba(150,175,195,${r() * 0.12})`; x.lineWidth = 1; x.beginPath(); const a = r() * 6.28, cx = r() * 1536, cy = r() * 2048; x.arc(cx, cy, 20 + r() * 160, a, a + 0.6 + r()); x.stroke(); }
    const red = '#c8202a', blue = '#1d4fa3';
    x.fillStyle = red; x.fillRect(0, Z(0) - 0.025 * px, 1536, 0.05 * px);                          // goal line
    x.fillStyle = blue; x.fillRect(0, Z(19.5) - 0.15 * px, 1536, 0.3 * px);                         // blue line
    x.fillStyle = red; x.fillRect(0, Z(Z0 + 30.48) - 0.15 * px, 1536, 0.3 * px);                     // centre red line
    x.fillStyle = 'rgba(143,198,234,.85)'; x.beginPath(); x.moveTo(X(-1.22), Z(0)); x.lineTo(X(-1.22), Z(1.37)); x.quadraticCurveTo(X(0), Z(2.3), X(1.22), Z(1.37)); x.lineTo(X(1.22), Z(0)); x.closePath(); x.fill();
    x.strokeStyle = red; x.lineWidth = 0.05 * px; x.stroke();
    x.beginPath(); x.moveTo(X(-2.74), Z(0)); x.lineTo(X(-4.27), Z(Z0)); x.moveTo(X(2.74), Z(0)); x.lineTo(X(4.27), Z(Z0)); x.stroke();   // trapezoid
    for (const sx of [-1, 1]) {
      const cx = X(sx * 6.71), cz = Z(6.1);
      x.beginPath(); x.arc(cx, cz, 4.57 * px, 0, Math.PI * 2); x.stroke();
      x.fillStyle = red; x.beginPath(); x.arc(cx, cz, 0.3 * px, 0, Math.PI * 2); x.fill();
      for (const hx of [-1, 1]) for (const hz of [-1, 1]) { x.fillRect(cx + hx * 0.85 * px - 0.025 * px, cz + hz * 4.5 * px - (hz > 0 ? 0 : 0.6 * px), 0.05 * px, 0.6 * px); }
      x.beginPath(); x.arc(X(sx * 6.71), Z(21.02), 0.3 * px, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = blue; x.beginPath(); x.arc(X(0), Z(Z0 + 30.48), 4.57 * px, 0, Math.PI * 2); x.stroke();
    x.fillStyle = blue; x.beginPath(); x.arc(X(0), Z(Z0 + 30.48), 0.15 * px, 0, Math.PI * 2); x.fill();
  });
  iceTex.repeat.set(1 / W, 1 / Hh); iceTex.offset.set(13.5 / W, (Hh + zt) / Hh);
  add(g, new THREE.ShapeGeometry(toShape(rinkOutline(0))), new THREE.MeshStandardMaterial({ map: iceTex, roughness: 0.16, metalness: 0.0 }), [0, 0, 0], [-Math.PI / 2, 0, 0], false);
  for (const [z, w, c] of [[Z1 - 22.86, 0.3, '#1d4fa3'], [Z1 - 3.35, 0.05, '#c8202a']]) add(g, new THREE.PlaneGeometry(25.6, w), M(c, { roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), [0, 0.01, z], [-Math.PI / 2, 0, 0], false);
  add(g, new THREE.PlaneGeometry(160, 160), M('#1a2027', { roughness: 0.9 }), [0, -0.05, 25], [-Math.PI / 2, 0, 0], false);
  // boards (white, yellow kick plate, coping), glass — faded when the camera is outside the rink
  const boardM = new THREE.MeshStandardMaterial({ color: '#f1f2ee', roughness: 0.45, transparent: true }), kickM = new THREE.MeshStandardMaterial({ color: '#e5c041', roughness: 0.5, transparent: true });
  const capM = new THREE.MeshStandardMaterial({ color: '#1f5f86', roughness: 0.4, transparent: true });
  const glassM = new THREE.MeshStandardMaterial({ color: '#d6eaf1', roughness: 0.05, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
  add(g, ringExtrude(0, -0.16, 1.07), boardM, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  add(g, ringExtrude(-0.01, -0.17, 0.22), kickM, [0, 0, 0], [-Math.PI / 2, 0, 0], false);
  add(g, ringExtrude(-0.02, -0.18, 0.05), capM, [0, 1.07, 0], [-Math.PI / 2, 0, 0], false);
  add(g, ringExtrude(-0.07, -0.09, 1.55), glassM, [0, 1.12, 0], [-Math.PI / 2, 0, 0], false);
  // stands around the rink
  const stands = crowd(2048, 448, 13, '#232a33');
  for (const [x0, z0, ry, w] of [[0, -8.5, 0, 34], [-18.5, 20, Math.PI / 2, 60], [18.5, 20, -Math.PI / 2, 60]]) add(g, new THREE.PlaneGeometry(w, 10), new THREE.MeshStandardMaterial({ map: stands, roughness: 1, color: '#c9ced4', emissive: '#0d1116', emissiveIntensity: 1 }), [x0, 5.6, z0], [-0.3, ry, 0], false);
  for (let i = -2; i <= 2; i++) add(g, new THREE.BoxGeometry(2.4, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: '#f4f7ff' }), [i * 4.5, 13, 12], null, false);
  hockeyGoal(g, 0, false); hockeyGoal(g, Z1 - 3.35, true);
  let fade = -1;
  return {
    group: g,
    onCamera(p) {
      const { HW, R } = RINK, cx = clamp(p.x, -(HW - R), HW - R), cz = clamp(p.z, Z0 + R, Z1 - R), d = Math.hypot(p.x - cx, p.z - cz) - R;
      const k = smooth(span(d, -0.4, 0.4)); if (Math.abs(k - fade) < 0.01) return; fade = k;
      for (const m of [boardM, kickM, capM]) { m.opacity = 1 - 0.8 * k; m.depthWrite = k < 0.5; }
      glassM.opacity = 0.13 * (1 - 0.7 * k);
    }
  };
}
function hockeyGoal(g, z, far) {
  const grp = new THREE.Group(); grp.position.set(0, 0, z); if (far) grp.rotation.y = Math.PI; g.add(grp);
  const red = M('#c8202a', { roughness: 0.35, metalness: 0.3 }), white = M('#f2f2ee', { roughness: 0.5 });
  for (const sx of [-1, 1]) add(grp, new THREE.CylinderGeometry(0.03, 0.03, 1.22, 12), red, [sx * 0.945, 0.61, 0]);
  add(grp, new THREE.CylinderGeometry(0.03, 0.03, 1.95, 12), red, [0, 1.22, 0], [0, 0, Math.PI / 2]);
  const base = new THREE.CatmullRomCurve3([V(-0.945, 0.02, 0), V(-0.96, 0.02, -0.55), V(-0.55, 0.02, -1.05), V(0.55, 0.02, -1.05), V(0.96, 0.02, -0.55), V(0.945, 0.02, 0)]);
  add(grp, new THREE.TubeGeometry(base, 30, 0.02, 6, false), white, null, null, false);
  const top = new THREE.CatmullRomCurve3([V(-0.945, 1.2, -0.02), V(-0.9, 1.12, -0.42), V(0.9, 1.12, -0.42), V(0.945, 1.2, -0.02)]);
  add(grp, new THREE.TubeGeometry(top, 20, 0.016, 6, false), white, null, null, false);
  if (far) return;
  const nm = netMat(18, 5), ns = netMat(8, 10);
  add(grp, new THREE.PlaneGeometry(1.86, 0.45), nm, [0, 1.17, -0.22], [Math.PI / 2 - 0.15, 0, 0], false);
  add(grp, new THREE.PlaneGeometry(1.95, 1.27), nm, [0, 0.57, -0.74], [Math.atan2(0.62, 1.12), 0, 0], false);
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.0, 0); sh.lineTo(0.42, 1.14); sh.lineTo(0, 1.2); sh.closePath();
  for (const sx of [-1, 1]) add(grp, new THREE.ShapeGeometry(sh), ns, [sx * 0.95, 0.01, 0], [0, Math.PI / 2, 0], false);
}
function makePuck() { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.0254, 24), new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.55 })); m.castShadow = true; return m; }

/* --- water-polo pool: water surface y = 0, goal line z = 0 (goal 3 x 0.9 m above the water), field 30 x 20 m toward +Z */
function buildPool(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = skyTex('#4f93d6', '#9fcbef', '#e9f2f4'); scene.fog = new THREE.Fog('#d3e6f1', 60, 160);
  const X0 = 12.5, ZA = -3, ZB = 33, DEP = 2.0, DECK = 0.25;
  const tile = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#7cc7e8'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke(); } }, [25, 36]);
  const floor = canvasTex(1024, 1024, (x, w, h) => { x.fillStyle = '#6fbfe3'; x.fillRect(0, 0, w, h); x.fillStyle = '#1f4f86'; for (let i = 0; i < 8; i++) x.fillRect((i + 0.5) * w / 8 - 6, h * 0.06, 12, h * 0.88); });
  add(g, new THREE.PlaneGeometry(25, 36), new THREE.MeshStandardMaterial({ map: floor, roughness: 0.5 }), [0, -DEP, 15], [-Math.PI / 2, 0, 0], false);
  const wallM = new THREE.MeshStandardMaterial({ map: tile, roughness: 0.4 });
  for (const [x, z, ry, w] of [[-X0, 15, Math.PI / 2, 36], [X0, 15, -Math.PI / 2, 36], [0, ZA, 0, 25], [0, ZB, Math.PI, 25]]) add(g, new THREE.PlaneGeometry(w, DEP + DECK), wallM, [x, (DECK - DEP) / 2, z], [0, ry, 0], false);
  const deckM = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#d9d2c3'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,110,95,.35)'; x.strokeRect(0, 0, w, h); }, [40, 40]), roughness: 0.85 });
  for (const [x, z, w, d] of [[-X0 - 20, 15, 40, 120], [X0 + 20, 15, 40, 120], [0, ZA - 20, 25, 40], [0, ZB + 20, 25, 40]]) add(g, new THREE.BoxGeometry(w, 0.1, d), deckM, [x, DECK - 0.05, z], null, false);
  // water: semi-transparent so the lower body shows faintly
  const ripple = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); const r = rng(3); for (let i = 0; i < 500; i++) { x.strokeStyle = `rgba(20,90,140,${0.05 + r() * 0.12})`; x.lineWidth = 1 + r() * 2; x.beginPath(); const cx = r() * w, cy = r() * h; x.ellipse(cx, cy, 8 + r() * 26, 2 + r() * 5, 0, 0, Math.PI * 2); x.stroke(); } }, [12, 16]);
  add(g, new THREE.PlaneGeometry(25, 36), new THREE.MeshStandardMaterial({ color: '#2b93c9', map: ripple, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.15, depthWrite: false }), [0, 0, 15], [-Math.PI / 2, 0, 0], false);
  // field boundary floats (lane ropes) at x = ±10: red to 2 m, yellow to 5 m, white to halfway (both ends)
  const fl = new THREE.CylinderGeometry(0.065, 0.065, 0.1, 10); fl.rotateX(Math.PI / 2);
  const n = 250, im = new THREE.InstancedMesh(fl, new THREE.MeshStandardMaterial({ roughness: 0.5 }), n * 2), o = new THREE.Object3D(), c = new THREE.Color();
  for (let s = 0; s < 2; s++) for (let i = 0; i < n; i++) {
    const z = i * 0.12, d = Math.min(z, 30 - z); o.position.set(s ? 10 : -10, 0.02, z); o.updateMatrix(); im.setMatrixAt(s * n + i, o.matrix);
    im.setColorAt(s * n + i, c.set(d < 2 ? '#d8342b' : d < 5 ? '#f1c232' : (i % 8 < 4 ? '#f4f4f0' : '#2f7bd0')));
  }
  g.add(im);
  waterGoal(g, 0, false); waterGoal(g, 30, true);
  // stands and a few sun shades
  standsRing(g, 48, 60, 16, 7, 17, '#2b3a44', Math.PI * 0.08, Math.PI * 1.84);
  return { group: g };
}
function waterGoal(g, z, far) {
  const grp = new THREE.Group(); grp.position.set(0, 0, z); if (far) grp.rotation.y = Math.PI; g.add(grp);
  const white = M('#f4f4f0', { roughness: 0.35 }), orange = M('#f08a24', { roughness: 0.5 });
  for (const sx of [-1, 1]) { add(grp, new THREE.BoxGeometry(0.075, 1.2, 0.075), white, [sx * 1.5375, 0.3, -0.0375]); add(grp, new THREE.BoxGeometry(0.16, 0.16, 0.9), orange, [sx * 1.56, 0.02, -0.45]); }
  add(grp, new THREE.BoxGeometry(3.15, 0.075, 0.075), white, [0, 0.9375, -0.0375]);
  add(grp, new THREE.BoxGeometry(3.15, 0.1, 0.1), orange, [0, 0.0, -0.9]);
  if (far) return;
  const nm = netMat(30, 4, '#f6f6f2'), ns = netMat(8, 10, '#f6f6f2');
  add(grp, new THREE.PlaneGeometry(3.0, 0.8), nm, [0, 0.93, -0.42], [Math.PI / 2, 0, 0], false);
  add(grp, new THREE.PlaneGeometry(3.0, 1.25), nm, [0, 0.33, -0.82], null, false);
  for (const sx of [-1, 1]) add(grp, new THREE.PlaneGeometry(0.8, 1.25), ns, [sx * 1.5, 0.33, -0.42], [0, Math.PI / 2, 0], false);
}
function makeWaterPoloBall() {
  const tex = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#f1cf1a'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#1f4e9a'; x.lineWidth = 10; for (const o of [0.12, 0.62]) { x.beginPath(); for (let i = 0; i <= 64; i++) { const v = i / 64, px = (o + Math.sin(v * Math.PI) * 0.16) * w; i ? x.lineTo(px, v * h) : x.moveTo(px, v * h); } x.stroke(); }
    const r = rng(8); for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(90,60,0,${r() * 0.12})`; x.fillRect(r() * w, r() * h, 1.5, 1.5); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 28, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); m.castShadow = true; return m;
}

/* --- cricket ground: striker's stumps at the origin, bowler's stumps at z = -20.12, boundary ~65 m */
const PITCH = 20.12;
function buildCricket(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = skyTex(); scene.fog = new THREE.Fog('#d4e6ee', 110, 260);
  const cz = -PITCH / 2;
  add(g, new THREE.CircleGeometry(150, 64), new THREE.MeshStandardMaterial({ map: grassTex([60, 60], '#4b9442', '#57a34c', 19), roughness: 0.95 }), [0, 0, cz], [-Math.PI / 2, 0, 0], false);
  add(g, new THREE.CircleGeometry(16, 48), M('#5aa64f', { roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [0, 0.008, cz], [-Math.PI / 2, 0, 0], false);   // square
  const pt = canvasTex(256, 2048, (x, w, h) => {
    x.fillStyle = '#d6c28e'; x.fillRect(0, 0, w, h);
    const r = rng(4); for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${120 + r() * 60},${100 + r() * 50},${60 + r() * 30},${r() * 0.18})`; x.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6); }
    for (const zz of [0.06, 0.94]) { x.fillStyle = 'rgba(150,120,80,.25)'; x.fillRect(w * 0.3, h * zz - 60, w * 0.4, 120); }
  });
  add(g, new THREE.PlaneGeometry(3.05, PITCH + 5), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [0, 0.014, cz], [-Math.PI / 2, 0, 0], false);
  const chalk = new THREE.MeshBasicMaterial({ color: '#f7f7f2', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (const [z0, sgn] of [[0, -1], [-PITCH, 1]]) {
    add(g, new THREE.PlaneGeometry(2.64, 0.05), chalk, [0, 0.02, z0], [-Math.PI / 2, 0, 0], false);                    // bowling crease
    add(g, new THREE.PlaneGeometry(4.4, 0.05), chalk, [0, 0.02, z0 + sgn * 1.22], [-Math.PI / 2, 0, 0], false);       // popping crease
    for (const sx of [-1, 1]) add(g, new THREE.PlaneGeometry(0.05, 2.44), chalk, [sx * 1.32, 0.02, z0 + sgn * 0.0], [-Math.PI / 2, 0, 0], false);   // return creases
  }
  stumpsAt(g, -PITCH);
  // boundary rope, sight screens, stands
  add(g, new THREE.TorusGeometry(65, 0.06, 6, 120), M('#f2f2ee', { roughness: 0.6 }), [0, 0.06, cz], [Math.PI / 2, 0, 0], false);
  for (const z of [cz + 74, cz - 74]) add(g, new THREE.BoxGeometry(22, 7, 0.4), M('#f6f6f2', { roughness: 0.8 }), [0, 3.5, z], null, false);
  const st = new THREE.Group(); st.position.z = cz; g.add(st); standsRing(st, 80, 96, 18, 9, 23, '#34424c');
  return { group: g };
}
function stumpsAt(g, z) {
  const wood = M('#efe6cf', { roughness: 0.5 }), grp = new THREE.Group(); grp.position.z = z; g.add(grp);
  const stumps = [-0.1143 + 0.018, 0, 0.1143 - 0.018].map(x => add(grp, new THREE.CylinderGeometry(0.018, 0.016, 0.711, 10), wood, [x, 0.3555, 0]));
  const bails = [-0.048, 0.048].map(x => add(grp, new THREE.CylinderGeometry(0.008, 0.008, 0.108, 8), wood, [x, 0.719, 0], [0, 0, Math.PI / 2]));
  return { grp, stumps, bails };
}
function makeCricketBall() {
  const tex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#a3161c'; x.fillRect(0, 0, w, h); x.fillStyle = '#efe0c4'; x.fillRect(0, h / 2 - 3, w, 6); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, h * 0.2, w, h * 0.12); });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })); m.castShadow = true; return m;
}

/* --- softball diamond: home plate at the origin, pitcher's plate 13.11 m toward -Z, bases 18.29 m apart */
const SB = { RUBBER: -13.11, BASE: 18.29 };
function buildSoftball(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = skyTex('#5c9bd6', '#a6cfee', '#eaf2f2'); scene.fog = new THREE.Fog('#cfe3ee', 80, 220);
  const b = SB.BASE / Math.SQRT2, rz = SB.RUBBER;
  const grass = grassTex([40, 40], '#428f3e', '#4d9c47', 29);
  add(g, new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }), [0, 0, -40], [-Math.PI / 2, 0, 0], false);
  const dirt = M('#c28d5e', { roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // skinned infield: arc of radius 18.29 m around the pitcher's plate, closed along both foul lines
  const shape = new THREE.Shape(); shape.moveTo(0, -2.5); shape.lineTo(b + 3.5, b + 3.5);
  for (let i = 0; i <= 48; i++) { const a = -0.25 - i / 48 * (Math.PI - 0.5); shape.lineTo(Math.cos(a) * 18.29, -rz - Math.sin(a) * 18.29); }
  shape.lineTo(-b - 3.5, b + 3.5); shape.closePath();
  add(g, new THREE.ShapeGeometry(shape, 48), dirt, [0, 0.015, 0], [-Math.PI / 2, 0, 0], false);
  add(g, new THREE.CircleGeometry(5, 40), dirt, [0, 0.016, 0], [-Math.PI / 2, 0, 0], false);
  const chalk = new THREE.MeshBasicMaterial({ color: '#f7f7f2', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  add(g, new THREE.RingGeometry(2.42, 2.47, 64), chalk, [0, 0.022, rz], [-Math.PI / 2, 0, 0], false);           // pitching circle (8 ft)
  add(g, new THREE.BoxGeometry(0.61, 0.03, 0.15), M('#f7f7f2'), [0, 0.022, rz + 0.075]);                       // pitcher's plate
  const hp = new THREE.Shape(); hp.moveTo(-0.216, 0); hp.lineTo(0.216, 0); hp.lineTo(0.216, -0.216); hp.lineTo(0, -0.432); hp.lineTo(-0.216, -0.216); hp.closePath();
  add(g, new THREE.ShapeGeometry(hp), M('#fbfbf7', { roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), [0, 0.024, -0.216], [-Math.PI / 2, 0, Math.PI], false);
  const baseM = M('#fbfbf7', { roughness: 0.7 });
  for (const [x, z] of [[0, -2 * b], [-b, -b]]) add(g, new THREE.BoxGeometry(0.38, 0.07, 0.38), baseM, [x, 0.035, z], [0, Math.PI / 4, 0]);
  add(g, new THREE.BoxGeometry(0.38, 0.07, 0.38), baseM, [b - 0.13, 0.035, -b - 0.13], [0, Math.PI / 4, 0]);         // double first base
  add(g, new THREE.BoxGeometry(0.38, 0.07, 0.38), M('#f08a24', { roughness: 0.7 }), [b + 0.14, 0.035, -b + 0.14], [0, Math.PI / 4, 0]);
  for (const sx of [1, -1]) {
    add(g, new THREE.PlaneGeometry(0.076, 95), chalk, [sx * 33.6, 0.022, -33.6], [-Math.PI / 2, 0, -sx * Math.PI / 4], false);
    const cx = sx * (0.216 + 0.15 + 0.455), czz = -0.1;
    for (const [dx, dz, w, h] of [[0, -1.065, 0.91, 0.05], [0, 1.065, 0.91, 0.05], [-0.455, 0, 0.05, 2.13], [0.455, 0, 0.05, 2.13]]) add(g, new THREE.PlaneGeometry(w, h), chalk, [cx + dx, 0.023, czz + dz], [-Math.PI / 2, 0, 0], false);
  }
  // outfield fence (67 m), foul poles, stands, backstop at 7.6 m
  const fr = 67, fh = 1.8, a0 = Math.PI - Math.PI / 4 - 0.02, al = Math.PI / 2 + 0.04;
  add(g, new THREE.CylinderGeometry(fr, fr, fh, 80, 1, true, a0, al), new THREE.MeshStandardMaterial({ color: '#1f4a35', roughness: 0.85, side: THREE.DoubleSide }), [0, fh / 2, 0]);
  add(g, new THREE.CylinderGeometry(fr - 0.04, fr - 0.04, 0.12, 80, 1, true, a0, al), new THREE.MeshBasicMaterial({ color: '#f2c94c', side: THREE.DoubleSide }), [0, fh, 0], null, false);
  add(g, new THREE.RingGeometry(fr - 3.5, fr, 80, 1, Math.PI / 4 - 0.02, Math.PI / 2 + 0.04), M('#9a7048', { roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [0, 0.015, 0], [-Math.PI / 2, 0, 0], false);
  for (const sx of [1, -1]) add(g, new THREE.CylinderGeometry(0.12, 0.12, 9, 8), M('#f2c94c'), [sx * fr * Math.SQRT1_2, 4.5, -fr * Math.SQRT1_2]);
  standsRing(g, fr + 6, fr + 20, 16, 8, 31, '#2b3a44', Math.PI - Math.PI / 4 - 0.3, Math.PI / 2 + 0.6);
  add(g, new THREE.CylinderGeometry(7.6, 7.6, 1.1, 40, 1, true, -0.9, 1.8), M('#26404f', { roughness: 0.9, side: THREE.DoubleSide }), [0, 0.55, 0], null, false);
  const net = canvasTex(64, 64, (x) => { x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(30,38,44,.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke(); }, [30, 8]);
  add(g, new THREE.CylinderGeometry(7.6, 7.6, 5, 40, 1, true, -0.9, 1.8), new THREE.MeshBasicMaterial({ map: net, transparent: true, side: THREE.DoubleSide, depthWrite: false }), [0, 3.6, 0], null, false);
  return { group: g, wallR: fr, wallH: fh };
}
function makeSoftball() {
  const tex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#e4ee3c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c8302a'; x.lineWidth = 3; for (const o of [0.25, 0.75]) { x.beginPath(); for (let i = 0; i <= 64; i++) { const v = i / 64, px = (o + Math.sin(v * Math.PI * 2) * 0.12) * w; i ? x.lineTo(px, v * h) : x.moveTo(px, v * h); } x.stroke(); } });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.0485, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 })); m.castShadow = true; return m;
}

export const VENUES = {
  handballCourt: { indoor: true, build: buildHandball, ball: makeHandball },
  iceRink: { indoor: true, build: buildRink, ball: makePuck },
  waterPoloPool: { indoor: false, build: buildPool, ball: makeWaterPoloBall },
  cricketGround: { indoor: false, build: buildCricket, ball: makeCricketBall },
  softballDiamond: { indoor: false, build: buildSoftball, ball: makeSoftball }
};


/* ================================================================== SHARED MOTION HELPERS */
/* projectile with floor bounces and a final roll (deterministic in t) */
function proj(out, P, v, t, fy = 0, e = 0.45, f = 0.8) {
  let px = P.x, py = P.y, pz = P.z, vx = v.x, vy = v.y, vz = v.z, tt = Math.max(0, t);
  for (let i = 0; i < 5; i++) {
    const tau = (vy + Math.sqrt(Math.max(0, vy * vy + 19.6 * (py - fy)))) / 9.8;
    if (tt < tau) return out.set(px + vx * tt, py + vy * tt - 4.9 * tt * tt, pz + vz * tt);
    px += vx * tau; pz += vz * tau; py = fy; vy = -(vy - 9.8 * tau) * e; vx *= f; vz *= f; tt -= tau;
    if (Math.abs(vy) < 0.4) break;
  }
  const k = 1.4, d = (1 - Math.exp(-k * tt)) / k; return out.set(px + vx * d, fy, pz + vz * d);
}
/* ball that enters a goal at G, hits the net at N, then drops and settles */
function intoNet(out, G, N, t, floorY, tNet = 0.06) {
  if (t < tNet) return out.lerpVectors(G, N, t / tNet);
  const d = N.clone().sub(G).multiplyScalar(0.25 / tNet); d.y = Math.min(0, d.y);
  return proj(out, N, V(d.x * 0.15, -0.5, d.z * 0.05), t - tNet, floorY, 0.3, 0.5);
}
/* the palm behind a held ball, on the line from the shoulder */
function palmOn(env, side, B, r) { const S = env.bonePos(env.side(side) + 'UpperArm'); return B.clone().add(S.sub(B).normalize().multiplyScalar(r + 0.03)); }
function twoHands(env, B, r, w = 1, poleR = [-0.8, 0.7, -0.4], poleL = [0.8, 0.7, -0.4]) {
  env.reach('r', B.clone().add(env.dir([-(r + 0.03), -0.02, -0.04])), poleR, { weight: w });
  env.reach('l', B.clone().add(env.dir([r + 0.03, -0.02, -0.04])), poleL, { weight: w });
}
const runW = (t, a, b, f = 0.18) => Math.min(smooth(span(t, a, a + f)), 1 - smooth(span(t, b - f, b)));
const rootPos = env => env.rig.root.position;
const keeperUni = env => { const u = uniKey(env), r = rivalUni(env); return ['white', 'coral', 'navy', 'teal'].find(k => k !== u && k !== r); };

/* ================================================================== HANDBALL */
const HB_READY = { lHipF: 20, rHipF: 20, lKnee: 28, rKnee: 28, lAnk: 8, rAnk: 8, spineX: 10, chestX: 4, lHipA: 7, rHipA: 7, headX: -6, lShF: 40, rShF: 40, lEl: 70, rEl: 70 };
const GK_READY = { lHipA: 20, rHipA: 20, lHipF: 24, rHipF: 24, lKnee: 36, rKnee: 36, lAnk: 10, rAnk: 10, spineX: 8, lShF: 62, rShF: 62, lShA: 62, rShA: 62, lEl: 70, rEl: 70, lWrF: -10, rWrF: -10, headX: -4 };
const HB_R = 0.093;

/* a handball goalkeeper (generic) who reacts to a shot aimed at world point [tx, ty] (authored for right-handers) */
function hbKeeper(env, tRel, from, tgt, late = 1) {
  const gk = ghost(env, 'handball', { tag: 'keeper', uni: keeperUni(env), h: (env.athlete || {}).gender === 'f' ? 180 : 194 });
  const gx = clamp(from[0] * 0.08, -0.5, 0.5), face = headingTo(gx, 0.55, from[0], from[1]), side = Math.sign(tgt[0] - gx) || 1, high = tgt[1] > 1.0;
  const reach = high ? (side > 0 ? { lShF: 150, lShA: 110, lEl: 5, spineZ: -14, lHipA: 30, rHipA: 26, air: 0.22 } : { rShF: 150, rShA: 110, rEl: 5, spineZ: 14, lHipA: 26, rHipA: 30, air: 0.22 })
    : (side > 0 ? { lHipA: 62, lKnee: 6, lHipF: 10, rKnee: 50, lShA: 80, lShF: 40, lEl: 10, spineZ: -10 } : { rHipA: 62, rKnee: 6, rHipF: 10, lKnee: 50, rShA: 80, rShF: 40, rEl: 10, spineZ: 10 });
  const tr = poseTrack([[0, Object.assign({ x: gx, z: 0.55, ry: face }, GK_READY)], [tRel - 0.1, {}], [tRel + 0.12 * late, Object.assign({}, GK_READY)],
    [tRel + 0.3 * late, Object.assign({ x: gx + side * 0.35 }, reach)], [tRel + 0.75, Object.assign({ air: 0 }, GK_READY, { x: gx + side * 0.3, spineZ: 0 })], [tRel + 2.5, { lShF: 20, rShF: 20, lShA: 10, rShA: 10, lEl: 20, rEl: 20, spineX: 4, lKnee: 10, rKnee: 10, lHipF: 6, rHipF: 6 }]]);
  return t => { const q = tr(t); if (t < tRel) q.air = Math.max(0, wave(t, 2.2)) * 0.03; gk.pose(q); };
}
/* jump shot over the defence (right-handed; left-handers are mirrored by the runtime) */
function hbJumpShot(a, o) {
  const X = o.x, Zj = o.z, air = o.air || 0.62, tRun = 0.3, tPlant = 1.25, tTake = 1.45, tRel = tTake + 0.4, tLand = tTake + 0.8, dur = tLand + 1.75;
  const S = [X + (o.dx || 0.5), Zj + 3.7], P = [X + (o.dx || 0.5) * 0.12, Zj + 0.55], T = [X, Zj + 0.25], L = [X - 0.05, Zj - 0.6];
  const face = headingTo(X, Zj, 0, 0), tgt = o.tgt || [1.1, 1.65];
  const keys = [
    [0, Object.assign({ x: S[0], z: S[1], ry: headingTo(S[0], S[1], P[0], P[1]) }, HB_READY)],
    [tRun, {}],
    [tPlant - 0.3, { x: lerp(S[0], P[0], 0.7), z: lerp(S[1], P[1], 0.7) }],
    [tPlant, { x: P[0], z: P[1], ry: face - 15, lHipF: 38, lKnee: 48, lAnk: 14, rHipF: -6, rKnee: 32, rAnk: 22, spineX: 12, chestY: -20, hipsY: -10, headY: 18, lShF: 70, lShA: 20, lEl: 50 }],
    [tTake, { x: T[0], z: T[1], ry: face - 25, air: 0.04, lHipF: 6, lKnee: 14, lAnk: -36, rHipF: 78, rKnee: 92, rAnk: -10, spineX: 4, spineZ: 6, chestY: -36, hipsY: -18, headY: 34, lShF: 95, lShA: 22, lEl: 25 }],
    [tTake + 0.22, { air: air * 0.88, lHipF: 14, lKnee: 30, lAnk: -30, rHipF: 70, rKnee: 88, spineX: -6, chestX: -4, spineZ: 8, chestY: -42, hipsY: -20, headY: 38, headX: -10 }],
    [tRel, { x: lerp(T[0], L[0], 0.5), z: lerp(T[1], L[1], 0.5), ry: face - 6, air, lHipF: 24, lKnee: 36, rHipF: 46, rKnee: 70, spineX: 14, chestX: 6, spineZ: -3, chestY: 26, hipsY: 6, headY: 4, headX: 0, lShF: 45, lShA: 30, lEl: 55 }],
    [tRel + 0.16, { air: air * 0.62, spineX: 24, chestY: 34, hipsY: 10, rShF: 70, rShA: 14, rEl: 15 }],
    [tLand, { x: L[0], z: L[1], air: 0, lHipF: 42, lKnee: 58, lAnk: 14, rHipF: 46, rKnee: 66, rAnk: 4, spineX: 22, chestY: 16, hipsY: 6, rShF: 40, rEl: 20 }],
    [tLand + 0.4, Object.assign({}, HB_READY, { spineX: 10, chestY: 0, hipsY: 0, headY: 0, lShF: 20, rShF: 20, lEl: 25, rEl: 25 })],
    [tLand + 0.9, { rShF: 150, rShA: 25, rEl: 55, rWrF: 0, lShF: 30, lShA: 20, spineX: 2, headX: -12, lKnee: 12, rKnee: 12, lHipF: 6, rHipF: 6 }],
    [dur, { rShF: 158, rShA: 22, rEl: 45, headX: -14 }]
  ];
  const body = poseTrack(keys);
  const ball = vecTrack([[0, [-0.02, 1.12, 0.36]], [tPlant - 0.35, [-0.06, 1.12, 0.36]], [tPlant, [-0.2, 1.42, 0.22]], [tTake, [-0.34, 1.86, -0.06]], [tTake + 0.22, [-0.4, 1.98, -0.3]], [tRel - 0.07, [-0.34, 2.1, -0.02]], [tRel, [-0.18, 2.14, 0.5]]]);
  const poleR = vecTrack([[0, [-0.8, 0.7, -0.3]], [tPlant, [-0.9, 1.2, -0.4]], [tTake, [-0.9, 2.0, -0.6]], [tRel, [-0.7, 2.3, 0.3]]]);
  const two = numTrack([[0, 1], [tPlant - 0.15, 1], [tPlant + 0.1, 0]]), ikR = numTrack([[0, 1], [tRel, 1], [tRel + 0.12, 0]]);
  const D = [X * 0.8 + 0.5, 6.9];
  const dTr = poseTrack([[0, Object.assign({ x: D[0], z: D[1] + 0.4, ry: headingTo(D[0], D[1], S[0], S[1]) }, HB_READY, { lShF: 70, rShF: 70, lEl: 30, rEl: 30, lShA: 25, rShA: 25 })],
    [tPlant - 0.2, { x: D[0], z: D[1], ry: headingTo(D[0], D[1], P[0], P[1]) }], [tTake + 0.05, { lHipF: 30, rHipF: 30, lKnee: 50, rKnee: 50, lShF: 150, rShF: 150, lEl: 15, rEl: 15, lShA: 18, rShA: 18 }],
    [tTake + 0.32, { air: 0.3, lHipF: 10, rHipF: 10, lKnee: 14, rKnee: 14, lAnk: -30, rAnk: -30, lShF: 172, rShF: 170, lShA: 12, rShA: 10, lEl: 4, rEl: 4, headX: -24 }],
    [tTake + 0.6, Object.assign({ air: 0 }, HB_READY, { lShF: 120, rShF: 120, lEl: 20, rEl: 20 })], [dur, { lShF: 20, rShF: 20, lEl: 20, rEl: 20, spineX: 14, headX: 10 }]]);
  const tf = o.flight || 0.42;
  let P0 = null, G = null, N = null, keeper = null, def = null;
  return {
    venue: 'handballCourt', dur, hold: 0.6, payoff: tRel + tf, mirror: a.handedness === 'left', view: 0,
    start(env) {
      env.pose(body(tRel)); P0 = env.ws(ball(tRel)).clone(); G = env.W(tgt[0], tgt[1], 0); N = env.W(tgt[0] * 0.92, tgt[1] - 0.08, -0.78);
      keeper = hbKeeper(env, tRel, [X, Zj], tgt); def = ghost(env, 'handball', { tag: 'def', h: (a.gender === 'f' ? 182 : 198) });
    },
    frame(t, env) {
      const q = body(t);
      if (t > tRun && t < tPlant) addPose(q, gait((t - tRun) / 0.5, 0.75, true), runW(t, tRun, tPlant - 0.05, 0.2));
      env.pose(q);
      const B = env.props.ball;
      if (t < tRel) {
        B.position.copy(env.ws(ball(t)));
        const w2 = two(t);
        env.reach('r', w2 > 0.5 ? B.position.clone().add(env.dir([-(HB_R + 0.03), -0.02, -0.04])) : palmOn(env, 'r', B.position, HB_R), poleR(t), { weight: 1 });
        if (w2 > 0) env.reach('l', B.position.clone().add(env.dir([HB_R + 0.03, -0.02, -0.04])), [0.8, 0.7, -0.4], { weight: w2 });
      } else {
        const u = t - tRel;
        if (u < tf) arc(P0, G, 0.12, u / tf, B.position); else intoNet(B.position, G, N, u - tf, HB_R);
        env.reach('r', env.handPos('r'), poleR(t), { weight: ikR(t) });
      }
      B.rotation.set(t * 9, t * 4, 0);
      keeper(t); def.pose(dTr(t));
      const r = rootPos(env);
      return { focus: V(lerp(r.x, 0, 0.3), 1.3, lerp(r.z, 0, 0.3)), radius: Math.max(6.2, Math.hypot(r.x, r.z) * 0.55 + 3.4) * Math.max(1, env.s) };
    }
  };
}
/* playmaker: dribble, body feint, cut through the gap and jump into the 6 m area to shoot */
function hbBreakthrough(a, o = {}) {
  const k = o.tempo || 1, tD = 0.25, tF = 1.05 * k, tX = 1.35 * k, tP = 1.6 * k, tT = tP + 0.15, tR = tT + 0.3, tL = tT + 0.62, dur = tL + 1.7;
  const S = [0.4, 11.8], A = [0.3, 10.0], F = [0.9, 9.2], C = [-0.75, 8.45], P = [-1.15, 7.55], T = [-1.2, 7.3], L = [-1.15, 5.45];
  const face = headingTo(-1.2, 7.3, 0, 0), tgt = o.tgt || [1.0, 0.45], hip = o.style === 'hip';
  const keys = [
    [0, Object.assign({ x: S[0], z: S[1], ry: 180 }, HB_READY)], [tD, {}],
    [0.85 * k, { x: A[0], z: A[1], ry: 182 }],
    [tF, { x: F[0], z: F[1], ry: 196, rHipF: 40, rKnee: 52, rHipA: 18, lHipF: 4, lKnee: 18, spineX: 16, spineZ: -10, chestY: -30, hipsY: -12, headY: 26, lShF: 80, lEl: 40 }],
    [tX, { x: C[0], z: C[1], ry: 168, lHipF: 44, lKnee: 54, lHipA: 18, rHipF: 0, rKnee: 22, rHipA: 6, spineZ: 10, chestY: 6, hipsY: 6, headY: -6, spineX: 14 }],
    [tP, { x: P[0], z: P[1], ry: face - 15, lHipF: 38, lKnee: 48, lAnk: 14, lHipA: 7, rHipF: -6, rKnee: 32, rAnk: 22, spineZ: 0, spineX: 12, chestY: -20, hipsY: -10, headY: 18 }],
    [tT, { x: T[0], z: T[1], ry: face - 22, air: 0.04, lHipF: 6, lKnee: 14, lAnk: -36, rHipF: 70, rKnee: 88, spineX: 6, chestY: -34, hipsY: -16, headY: 30, lShF: 90, lShA: 25, lEl: 30 }],
    [tR, { x: -1.18, z: 6.35, ry: face - 4, air: 0.5, lHipF: 30, lKnee: 40, rHipF: 50, rKnee: 70, spineX: 20, chestX: 6, chestY: hip ? 30 : 24, spineZ: hip ? 14 : -2, hipsY: 6, headY: 2, lShF: 45, lShA: 30, lEl: 50 }],
    [tR + 0.15, { air: 0.32, spineX: 26, chestY: 32, rShF: 70, rShA: 14, rEl: 15 }],
    [tL, { x: L[0], z: L[1], air: 0, lHipF: 42, lKnee: 58, lAnk: 14, rHipF: 46, rKnee: 66, spineX: 24, chestY: 14, spineZ: 0, rShF: 40, rEl: 20 }],
    [tL + 0.45, Object.assign({}, HB_READY, { x: L[0], z: L[1] - 0.25, spineX: 8, chestY: 0, hipsY: 0, headY: 0, lShF: 20, rShF: 20, lEl: 25, rEl: 25 })],
    [tL + 0.95, { rShF: 155, rShA: 25, rEl: 50, lShF: 150, lShA: 25, lEl: 50, headX: -14, lKnee: 12, rKnee: 12, lHipF: 6, rHipF: 6, spineX: 2 }],
    [dur, { rShF: 160, lShF: 160 }]
  ];
  const body = poseTrack(keys);
  const rel = hip ? [-0.6, 1.35, 0.42] : [-0.16, 2.06, 0.5], cock = hip ? [-0.62, 1.3, -0.25] : [-0.38, 1.92, -0.22];
  const ball = vecTrack([[0, [-0.02, 1.1, 0.38]], [tD, [-0.2, 1.0, 0.45]], [tD + 0.25, [-0.24, 0.3, 0.55]], [tD + 0.5, [-0.12, 1.05, 0.42]], [0.95 * k, [-0.24, 1.55, 0.18]], [tF + 0.05, [-0.36, 1.82, -0.04]],
    [tX, [-0.04, 1.15, 0.38]], [tP, [-0.22, 1.45, 0.2]], [tT, [-0.34, 1.82, -0.06]], [tR - 0.08, cock], [tR, rel]]);
  const poleR = vecTrack([[0, [-0.8, 0.7, -0.3]], [tF, [-0.9, 1.8, -0.5]], [tX, [-0.8, 0.8, -0.3]], [tT, [-0.9, 1.9, -0.6]], [tR, hip ? [-0.6, 0.4, 0.2] : [-0.7, 2.3, 0.3]]]);
  const two = numTrack([[0, 1], [tD - 0.02, 1], [tD + 0.02, 0], [tD + 0.48, 0], [tD + 0.55, 1], [0.95 * k, 1], [tF - 0.02, 0.2], [tX - 0.1, 1], [tP - 0.15, 1], [tP + 0.1, 0]]), ikR = numTrack([[0, 1], [tR, 1], [tR + 0.12, 0]]);
  const dTr = poseTrack([[0, Object.assign({ x: 0.15, z: 7.75, ry: 0 }, HB_READY, { lShF: 60, rShF: 60, lEl: 40, rEl: 40, lShA: 30, rShA: 30 })], [tF - 0.25, { x: 0.2, z: 7.7 }],
    [tF + 0.12, { x: 0.75, z: 7.65, ry: 8, rHipA: 30, lHipA: 12, spineZ: 8, lShF: 100, rShF: 90 }], [tX + 0.25, { x: 0.5, z: 7.45, ry: -20, lHipA: 28, rHipA: 10, spineZ: -8, lShF: 95, lShA: 35, lEl: 20 }],
    [tR, { x: 0.3, z: 7.2, ry: -35, lShF: 120, lShA: 40, rShF: 60 }], [dur, Object.assign({}, HB_READY, { ry: -10, spineZ: 0, lShF: 20, rShF: 20, lShA: 10 })]]);
  const bounce = o.style === 'bounce', tf = bounce ? 0.5 : 0.36;
  let P0 = null, G = null, N = null, Bp = null, keeper = null, def = null;
  return {
    venue: 'handballCourt', dur, hold: 0.6, payoff: tR + tf, mirror: a.handedness === 'left', view: a.handedness === 'left' ? 50 : -50,
    start(env) {
      env.pose(body(tR)); P0 = env.ws(ball(tR)).clone(); G = env.W(tgt[0], bounce ? 1.25 : tgt[1], 0); N = env.W(tgt[0] * 0.92, (bounce ? 1.25 : tgt[1]) - 0.08, -0.78); Bp = env.W(tgt[0] * 0.4, HB_R, 1.7);
      keeper = hbKeeper(env, tR, [-1.18, 6.35], bounce ? [tgt[0], 1.2] : tgt, 1.1); def = ghost(env, 'handball', { tag: 'def', h: (a.gender === 'f' ? 180 : 196) });
    },
    frame(t, env) {
      const q = body(t);
      if (t > tD && t < tF) addPose(q, gait((t - tD) / 0.55, 0.45, true), runW(t, tD, tF, 0.2));
      env.pose(q);
      const B = env.props.ball;
      if (t < tR) {
        B.position.copy(env.ws(ball(t)));
        if (t > tD && t < tD + 0.5) { const u = (t - tD) / 0.5, y = 0.12 + (1.0 - 0.12) * Math.abs(Math.cos(Math.PI * u)); B.position.copy(env.ws([-0.24, y, 0.5], false)); B.position.y = Math.max(HB_R, y * env.s); }
        const w2 = two(t), hand = t > tD && t < tD + 0.5 ? B.position.clone().add(V(0, Math.max(0.1, 0.95 * env.s - B.position.y + 0.1), 0)) : null;
        env.reach('r', hand || (w2 > 0.5 ? B.position.clone().add(env.dir([-(HB_R + 0.03), -0.02, -0.04])) : palmOn(env, 'r', B.position, HB_R)), poleR(t), { weight: 1 });
        if (w2 > 0) env.reach('l', B.position.clone().add(env.dir([HB_R + 0.03, -0.02, -0.04])), [0.8, 0.7, -0.4], { weight: w2 });
      } else {
        const u = t - tR;
        if (bounce) { if (u < tf * 0.55) arc(P0, Bp, 0.05, u / (tf * 0.55), B.position); else if (u < tf) arc(Bp, G, 0.25, (u - tf * 0.55) / (tf * 0.45), B.position); else intoNet(B.position, G, N, u - tf, HB_R); }
        else if (u < tf) arc(P0, G, 0.1, u / tf, B.position); else intoNet(B.position, G, N, u - tf, HB_R);
        env.reach('r', env.handPos('r'), poleR(t), { weight: ikR(t) });
      }
      B.rotation.set(t * 9, t * 4, 0);
      keeper(t); def.pose(dTr(t));
      const r = rootPos(env);
      return { focus: V(lerp(r.x, 0, 0.3), 1.3, lerp(r.z, 0, 0.3)), radius: Math.max(6.2, Math.hypot(r.x, r.z) * 0.55 + 3.4) * Math.max(1, env.s) };
    }
  };
}
/* wing: run along the 6 m line, dive into the goal area and spin the ball off the floor past the keeper */
function hbWingDive(a) {
  const tRun = 0.15, tT = 1.35, tR = tT + 0.36, tL = tT + 0.72, dur = tL + 2.1;
  const S = [-9.4, 5.2], P = [-6.95, 3.95], T = [-6.65, 3.75], R = [-5.6, 2.95], L = [-4.75, 2.25], L2 = [-4.2, 1.85];
  const face = headingTo(T[0], T[1], 0.3, 0);
  const keys = [
    [0, Object.assign({ x: S[0], z: S[1], ry: headingTo(S[0], S[1], P[0], P[1]) }, HB_READY)], [tRun, {}],
    [tT - 0.2, { x: P[0], z: P[1], ry: face - 25, lHipF: 38, lKnee: 48, lAnk: 14, rHipF: -6, rKnee: 32, rAnk: 22, spineX: 12, chestY: -16, headY: 16 }],
    [tT, { x: T[0], z: T[1], ry: face - 15, air: 0.05, lHipF: 6, lKnee: 14, lAnk: -36, rHipF: 75, rKnee: 90, spineX: 10, spineZ: 8, chestY: -30, hipsY: -12, headY: 26, lShF: 95, lShA: 35, lEl: 30 }],
    [tR, { x: R[0], z: R[1], ry: face, air: 0.5, hipsX: 22, spineX: 18, chestX: 6, spineZ: 10, chestY: 22, hipsY: 6, lHipF: 10, lKnee: 30, rHipF: 30, rKnee: 40, headY: 0, headX: -14, lShF: 70, lShA: 40, lEl: 30 }],
    [tR + 0.18, { x: lerp(R[0], L[0], 0.6), z: lerp(R[1], L[1], 0.6), air: 0.3, hipsX: 50, spineX: 12, chestY: 10, spineZ: 4, lHipF: -6, rHipF: 4, lKnee: 20, rKnee: 30, lShF: 150, rShF: 140, lShA: 25, rShA: 25, lEl: 15, rEl: 15, headX: -40 }],
    [tL, { x: L[0], z: L[1], air: 0, seat: 1, seatY: 0.3, hipsX: 78, spineX: 4, chestX: 0, chestY: 0, spineZ: 0, hipsY: 0, lHipF: -4, rHipF: -2, lKnee: 18, rKnee: 26, lAnk: -40, rAnk: -40, lShF: 150, rShF: 150, lShA: 30, rShA: 30, lEl: 20, rEl: 20, headX: -50 }],
    [tL + 0.4, { x: L2[0], z: L2[1], seatY: 0.22, hipsX: 84, lShF: 160, rShF: 160 }],
    [tL + 0.9, { seat: 1, seatY: 0.32, hipsX: 50, spineX: 10, lHipF: 70, rHipF: 60, lKnee: 120, rKnee: 110, lAnk: 10, rAnk: 10, lShF: 60, rShF: 60, lShA: 20, rShA: 20, lEl: 20, rEl: 20, headX: -20 }],
    [tL + 1.4, Object.assign({ seat: 0, hipsX: 0, ry: face + 40 }, HB_READY, { lShF: 20, rShF: 20, lEl: 25, rEl: 25, spineX: 6 })],
    [dur, { rShF: 150, rShA: 30, rEl: 60, lShF: 30, headX: -10, lKnee: 14, rKnee: 14, lHipF: 6, rHipF: 6 }]
  ];
  const body = poseTrack(keys);
  const ball = vecTrack([[0, [-0.02, 1.12, 0.38]], [tT - 0.5, [-0.06, 1.15, 0.36]], [tT - 0.2, [-0.22, 1.5, 0.18]], [tT, [-0.36, 1.86, -0.08]], [tR - 0.1, [-0.4, 1.98, -0.12]], [tR, [-0.1, 2.05, 0.5]]]);
  const poleR = vecTrack([[0, [-0.8, 0.7, -0.3]], [tT, [-0.9, 2.0, -0.6]], [tR, [-0.7, 2.3, 0.3]]]);
  const two = numTrack([[0, 1], [tT - 0.3, 1], [tT - 0.1, 0]]), ikR = numTrack([[0, 1], [tR, 1], [tR + 0.12, 0]]);
  const tf1 = 0.26, tf2 = 0.3;
  let P0 = null, Bp = null, G = null, N = null, C = null, keeper = null;
  return {
    venue: 'handballCourt', dur, hold: 0.6, payoff: tR + tf1 + tf2, mirror: a.handedness === 'left', view: a.handedness === 'left' ? -25 : 25,
    start(env) {
      env.pose(body(tR)); P0 = env.ws(ball(tR)).clone(); Bp = env.W(-0.85, HB_R, 1.15); G = env.W(0.55, 0.6, 0); N = env.W(0.65, 0.5, -0.8); C = env.W(0.9, 0.35, 0.7);
      const gk = ghost(env, 'handball', { tag: 'keeper', uni: keeperUni(env), h: a.gender === 'f' ? 180 : 194 });
      const tr = poseTrack([[0, Object.assign({ x: -0.6, z: 0.5, ry: headingTo(-0.6, 0.5, -7, 4) }, GK_READY)], [tR, { x: -1.05, z: 0.45, ry: headingTo(-1.05, 0.45, -5.6, 3) }],
        [tR + tf1, { x: -1.0, lHipA: 50, lKnee: 8, rKnee: 48, spineZ: -8, lShF: 60, lShA: 80, lEl: 10 }], [tR + tf1 + 0.3, { x: -0.7, lHipA: 30, rHipA: 20, lShF: 80, lShA: 110, spineZ: -12, ry: 0 }], [dur, Object.assign({}, GK_READY, { lShF: 20, rShF: 20, lShA: 10, rShA: 10, lEl: 20, rEl: 20, spineZ: 0 })]]);
      this._gk = t => gk.pose(tr(t));
    },
    frame(t, env) {
      const q = body(t);
      if (t > tRun && t < tT - 0.15) addPose(q, gait((t - tRun) / 0.5, 0.85, true), runW(t, tRun, tT - 0.1, 0.2));
      env.pose(q);
      const B = env.props.ball;
      if (t < tR) {
        B.position.copy(env.ws(ball(t)));
        const w2 = two(t);
        env.reach('r', w2 > 0.5 ? B.position.clone().add(env.dir([-(HB_R + 0.03), -0.02, -0.04])) : palmOn(env, 'r', B.position, HB_R), poleR(t), { weight: 1 });
        if (w2 > 0) env.reach('l', B.position.clone().add(env.dir([HB_R + 0.03, -0.02, -0.04])), [0.8, 0.7, -0.4], { weight: w2 });
      } else {
        const u = t - tR;
        if (u < tf1) arc(P0, Bp, 0.04, u / tf1, B.position);
        else if (u < tf1 + tf2) { const k = (u - tf1) / tf2, a1 = Bp.clone().lerp(C, k), a2 = C.clone().lerp(G, k); B.position.lerpVectors(a1, a2, k); B.position.y = lerp(HB_R, G.y, k) + 0.45 * k * (1 - k); }
        else intoNet(B.position, G, N, u - tf1 - tf2, HB_R);
        env.reach('r', env.handPos('r'), poleR(t), { weight: ikR(t) });
      }
      B.rotation.set(t * 9, t * 22, 0);
      this._gk(t);
      const r = rootPos(env);
      return { focus: V(lerp(r.x, 0, 0.35), 1.2, lerp(r.z, 0, 0.35)), radius: 6.4 * Math.max(1, env.s) };
    }
  };
}
/* goalkeeper star-jump save: arms and legs spread wide against a jump shot from the 6 m line */
function hbStarSave(a) {
  const tTake = 1.0, tRel = 1.35, tc = 1.62, tLand = 1.95, dur = 3.9;
  const K = [0.1, 0.5], Sh = [1.7, 6.75], face = headingTo(K[0], K[1], Sh[0], Sh[1]);
  const keys = [
    [0, Object.assign({ x: K[0] - 0.25, z: K[1], ry: face - 10 }, GK_READY)],
    [0.7, { x: K[0], ry: face, lHipA: 24, rHipA: 16 }], [1.0, Object.assign({ x: K[0] + 0.05 }, GK_READY)],
    [1.3, { lHipF: 34, rHipF: 34, lKnee: 52, rKnee: 52, lAnk: 16, rAnk: 16, spineX: 12, lShF: 50, rShF: 50, lShA: 70, rShA: 70 }],
    [1.43, { air: 0.12, lHipF: 12, rHipF: 12, lKnee: 14, rKnee: 14, lAnk: -30, rAnk: -30, spineX: 2, lHipA: 30, rHipA: 30, lShA: 110, rShA: 110, lShF: 30, rShF: 30, lEl: 20, rEl: 20 }],
    [tc, { air: 0.42, lHipA: 46, rHipA: 46, lHipF: 14, rHipF: 14, lKnee: 6, rKnee: 6, lAnk: -10, rAnk: -10, spineX: -4, lShA: 150, rShA: 150, lShF: 22, rShF: 22, lEl: 4, rEl: 4, lWrF: 0, rWrF: 0, headX: -8 }],
    [tc + 0.15, { air: 0.3 }],
    [tLand, Object.assign({ air: 0 }, GK_READY, { lHipA: 26, rHipA: 26, lKnee: 44, rKnee: 44, spineX: 14, lShA: 80, rShA: 80 })],
    [tLand + 0.45, { spineX: 6, lKnee: 20, rKnee: 20, lHipF: 10, rHipF: 10, lShF: 20, lShA: 15, lEl: 30, rShF: 40, rShA: 30, rEl: 30, headY: -30 }],
    [tLand + 0.9, { rShF: 95, rShA: 55, rEl: 120, rWrF: -10, spineX: 12, chestY: 20, lKnee: 34, rKnee: 34, lHipF: 24, rHipF: 24, headY: -10, headX: -18 }],
    [tLand + 1.2, { rShF: 70, rShA: 45, rEl: 135, spineX: 20 }],
    [dur, { rShF: 100, rShA: 55, rEl: 120, spineX: 10, headX: -20 }]
  ];
  const body = poseTrack(keys);
  const sTr = poseTrack([[0, Object.assign({ x: 2.3, z: 8.6, ry: headingTo(2.3, 8.6, 0, 0) }, HB_READY)], [tTake - 0.2, { x: 1.85, z: 7.1 }],
    [tTake, { x: 1.75, z: 6.95, ry: headingTo(1.75, 6.95, 0, 0) - 25, air: 0.04, lHipF: 6, lKnee: 14, lAnk: -36, rHipF: 75, rKnee: 90, chestY: -36, hipsY: -16, headY: 32, lShF: 90, lShA: 25, lEl: 30 }],
    [tRel, { x: 1.62, z: 6.45, ry: headingTo(1.7, 6.6, 0, 0) - 5, air: 0.62, lHipF: 24, lKnee: 36, rHipF: 46, rKnee: 70, spineX: 16, chestY: 26, hipsY: 6, headY: 4, lShF: 45, lShA: 30, lEl: 55 }],
    [tRel + 0.15, { air: 0.42, rShF: 70, rEl: 15, spineX: 24 }], [tLand, Object.assign({ x: 1.55, z: 6.0, air: 0 }, HB_READY, { spineX: 22, lKnee: 50, rKnee: 60, lHipF: 40, rHipF: 46, chestY: 10 })],
    [dur, Object.assign({}, HB_READY, { spineX: 30, lShF: 10, rShF: 10, lEl: 10, rEl: 10, headX: 20, chestY: 0 })]]);
  const sBall = vecTrack([[0, [-0.04, 1.12, 0.36]], [tTake - 0.3, [-0.2, 1.45, 0.2]], [tTake, [-0.34, 1.86, -0.06]], [tRel - 0.08, [-0.38, 2.0, -0.2]], [tRel, [-0.16, 2.12, 0.5]]]);
  let sh = null, P0 = null, C = null, vOut = null;
  return {
    venue: 'handballCourt', dur, hold: 0.6, payoff: tc, mirror: a.handedness === 'left', view: a.handedness === 'left' ? 55 : -55,
    start(env) {
      sh = ghost(env, 'handball', { tag: 'shooter', h: a.gender === 'f' ? 178 : 192 });
      sh.pose(sTr(tRel)); P0 = sh.ws(sBall(tRel)).clone();
      env.pose(body(tc)); C = env.handPos('r').clone().add(V(0, 0.02, 0.08)); vOut = env.dir([-1.6, 3.2, 3.0]);
    },
    frame(t, env) {
      env.pose(body(t)); sh.pose(sTr(t));
      const B = env.props.ball;
      if (t < tRel) { B.position.copy(sh.ws(sBall(t))); const two = t < tTake - 0.25; if (two) twoHands(sh, B.position, HB_R); else sh.reach('r', palmOn(sh, 'r', B.position, HB_R), [-0.9, 2.0, -0.5]); }
      else if (t < tc) { arc(P0, C, 0.08, (t - tRel) / (tc - tRel), B.position); sh.reach('r', sh.handPos('r'), [-0.7, 2.3, 0.3], { weight: 1 - smooth(span(t, tRel, tRel + 0.12)) }); }
      else proj(B.position, C, vOut, t - tc, HB_R, 0.5);
      B.rotation.set(t * 9, t * 5, 0);
      const r = rootPos(env);
      return { focus: V(lerp(r.x, 1.7, 0.22), 1.35, lerp(r.z, 6.7, 0.22)), radius: 7.2 * Math.max(1, env.s), mood: t > tc ? { joy: Math.min(1, (t - tc) / 0.3) } : undefined };
    }
  };
}


/* ================================================================== ICE HOCKEY */
const PUCK_Y = 0.0127, PR = 0.038;
const SK_BASE = { hipsX: 12, spineX: 18, chestX: 6, lHipF: 46, rHipF: 46, lKnee: 70, rKnee: 70, lAnk: 20, rAnk: 20, lHipA: 9, rHipA: 9, headX: -24 };
/* skating stride (phase in cycles, k intensity): alternate side-back pushes with toes out, deep support knee */
function skate(ph, k) {
  const w = ph * Math.PI * 2, s = Math.sin(w), pl = Math.max(0, s), pr = Math.max(0, -s);
  return {
    lHipA: 9 + 30 * k * pl, rHipA: 9 + 30 * k * pr, lHipF: 46 - 34 * k * pl + 10 * k * pr, rHipF: 46 - 34 * k * pr + 10 * k * pl,
    lKnee: 70 - 46 * k * pl + 16 * k * pr, rKnee: 70 - 46 * k * pr + 16 * k * pl, lHipR: 16 * k * pl, rHipR: 16 * k * pr,
    lAnk: 20 - 24 * k * pl, rAnk: 20 - 24 * k * pr, hipsZ: -4 * s * k, hipsY: 7 * s * k, chestY: -7 * s * k
  };
}
/* stick: butt at the origin, shaft along +Y, blade from the heel along b = (1,1,0)/√2 (lie 135°), blade height along u = (1,-1,0)/√2 */
function makeStick(goalie) {
  const g = new THREE.Group(), L = goalie ? 1.12 : 1.42, dark = M('#1c2024', { roughness: 0.45 }), tape = M('#ecece6', { roughness: 0.85 });
  add(g, new THREE.BoxGeometry(0.03, L, 0.022), dark, [0, L / 2, 0]);
  add(g, new THREE.BoxGeometry(0.036, 0.13, 0.028), M('#30353b', { roughness: 0.9 }), [0, 0.065, 0]);
  if (goalie) add(g, new THREE.BoxGeometry(0.085, 0.6, 0.024), dark, [0.02, L - 0.28, 0]);
  const bl = goalie ? 0.38 : 0.31, bh = goalie ? 0.09 : 0.075;
  const bld = add(g, new THREE.BoxGeometry(bl, bh, 0.012), tape, [0, 0, 0], [0, 0, Math.PI / 4]);
  bld.position.set(0, L, 0).add(V(Math.SQRT1_2, Math.SQRT1_2, 0).multiplyScalar(bl / 2)).add(V(Math.SQRT1_2, -Math.SQRT1_2, 0).multiplyScalar(bh / 2));
  g.userData = { L, bl }; return g;
}
/* place a stick from its butt Kw along the horizontal heading hd with the heel at height h; returns blade helpers */
function placeStickW(st, Kw, hd, h, s, roll, mirror) {
  const L = st.userData.L * s, drop = clamp(Kw.y - h, -L * 0.985, L * 0.985), d = Math.sqrt(L * L - drop * drop);
  const heel = Kw.clone().addScaledVector(hd, d); heel.y -= drop;
  const D = heel.clone().sub(Kw).normalize(), X = UP.clone().addScaledVector(D, -UP.dot(D));
  if (X.lengthSq() < 1e-6) X.copy(hd); X.normalize(); if (roll) X.applyAxisAngle(D, roll * D2R * (mirror ? -1 : 1));
  st.scale.setScalar(s); orientXY(st, Kw, D, X);
  const Z = V().crossVectors(X, D), fore = mirror ? Z.negate() : Z;
  return { K: Kw, D, heel, fore, b: X.clone().add(D).multiplyScalar(Math.SQRT1_2), s };
}
const placeStick = (env, st, K, yaw, h, roll = 0) => placeStickW(st, env.ws(K), env.dir([Math.cos(yaw * D2R), 0, Math.sin(yaw * D2R)]), h, env.s, roll, env.mirror);
/* place the stick so the blade middle sits beside the puck Pp (world), forehand side > 0, backhand < 0; the hands follow */
function stickToPuck(env, st, K, Pp, side) {
  const s = env.s, Kw = env.ws(K), L = st.userData.L * s, mid = 0.155 * s;
  let Pb = Pp.clone().setY(0), S = null;
  for (let it = 0; it < 2; it++) {
    const flat = V(Pb.x - Kw.x, 0, Pb.z - Kw.z), dist = flat.length(); flat.normalize();
    const drop = clamp(Kw.y, 0, L * 0.985), d = Math.sqrt(L * L - drop * drop);
    S = placeStickW(st, Kw.clone().addScaledVector(flat, dist - mid - d), flat, 0, s, 0, env.mirror);
    Pb = Pp.clone().addScaledVector(S.fore, -side * (PR + 0.009)).setY(0);
  }
  return S;
}
const bladeMid = (S, out = V()) => out.copy(S.heel).addScaledVector(S.b, 0.155 * S.s);
function puckBeside(S, side, out) { bladeMid(S, out).addScaledVector(S.fore, side * (PR + 0.009)); out.y = Math.max(PUCK_Y, out.y + PUCK_Y); return out; }
function stickHands(env, S, grip = 0.42, wTop = 1, wBot = 1) {
  if (wTop > 0) env.reach('l', S.K.clone().addScaledVector(S.D, 0.035 * S.s), [0.8, 0.8, -0.2], { weight: wTop });
  if (wBot > 0) env.reach('r', S.K.clone().addScaledVector(S.D, grip * S.s), [-0.9, 0.55, 0.05], { weight: wBot });
}
function yawOf(env, v) { const l = v.clone().applyAxisAngle(UP, -env.rig.root.rotation.y); if (env.mirror) l.x = -l.x; return Math.atan2(l.z, l.x) / D2R; }
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/* goalie equipment on any rig: leg pads, blocker, catching glove, mask, stick (returned) */
function goalieGear(ge) {
  const r = ge.rig, s = ge.s, padM = M('#f4f4f0', { roughness: 0.6 }), trimM = M(r.u.jersey, { roughness: 0.6 });
  const put = (geo, mat, bone, pos, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(pos[0] * s, pos[1] * s, pos[2] * s); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); m.scale.setScalar(s); ge.addProp(m, r.bones[bone]); return m; };
  for (const sd of ['l', 'r']) {
    const b = ge.side(sd);
    put(new THREE.BoxGeometry(0.27, 0.74, 0.15), padM, b + 'Shin', [0, -0.2, 0.07]);
    put(new THREE.BoxGeometry(0.28, 0.05, 0.16), trimM, b + 'Shin', [0, -0.02, 0.075]);
    put(new THREE.BoxGeometry(0.28, 0.05, 0.16), trimM, b + 'Shin', [0, -0.36, 0.075]);
    put(new THREE.BoxGeometry(0.21, 0.3, 0.14), padM, b + 'Thigh', [0, -0.3, 0.06]);
  }
  put(new THREE.BoxGeometry(0.05, 0.36, 0.21), padM, ge.side('r') + 'Hand', [ge.mirror ? 0.05 : -0.05, -0.06, 0]);
  const gl = makeGlove('#f4f4f0', true); gl.position.set(0, -0.02 * s, 0.03 * s); gl.scale.setScalar(1.3 * s); ge.addProp(gl, r.bones[ge.side('l') + 'Hand']);
  r.setHeadwear(null);
  const R = r.headR, mask = new THREE.Group(), shell = M('#f2f2ee', { roughness: 0.25 }), cage = M('#2a2a2a', { roughness: 0.35, metalness: 0.5 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.17, 22, 16), shell); dome.scale.set(0.96, 1.1, 1.08); mask.add(dome);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(R * 0.62, R * 0.035, 6, 16, Math.PI), cage); b.position.set(0, -R * 0.05 - i * R * 0.17, R * 0.98); b.rotation.set(0, 0, Math.PI); b.scale.set(1, 0.5, 1); mask.add(b); }
  const st = makeStick(true); ge.addProp(st);
  r.headGroup.add(mask); r.headwear = mask;
  return st;
}
/* goalie stick from the blocker hand down to the ice in front of the pads */
function goalieStick(ge, st) {
  const s = ge.s, H = ge.rig['grip_' + ge.side('r')].getWorldPosition(V()), grip = 0.36, Ll = (st.userData.L - grip) * s;
  const hd = ge.dir([0.08, 0, 1]).normalize(), drop = clamp(H.y, 0, Ll * 0.985), d = Math.sqrt(Ll * Ll - drop * drop);
  const heel = H.clone().addScaledVector(hd, d); heel.y -= drop;
  const D = heel.sub(H).normalize(), K = H.clone().addScaledVector(D, -grip * s);
  return placeStickW(st, K, hd, 0, s, 0, ge.mirror);
}
const G_READY = { hipsX: 8, spineX: 22, chestX: 6, lHipA: 24, rHipA: 24, lHipF: 52, rHipF: 52, lKnee: 80, rKnee: 80, lAnk: 24, rAnk: 24, lHipR: 8, rHipR: 8, lShF: 52, lShA: 36, lEl: 88, lWrF: -10, rShF: 40, rShA: 20, rEl: 55, rWrF: 0, headX: -22 };
const G_BUTTERFLY = { seat: 1, seatY: 0.3, hipsX: 4, spineX: 16, lHipF: 80, rHipF: 80, lHipA: 14, rHipA: 14, lKnee: 125, rKnee: 125, lHipR: -48, rHipR: -48, lAnk: 30, rAnk: 30 };
/* a generic goalie in the crease who tracks the puck and makes a late save attempt toward `side` (+1 = goalie's left/glove) */
function hockeyGoalie(env, tSave, side, high, o = {}) {
  const gk = ghost(env, 'ice-hockey', { tag: 'goalie', uni: keeperUni(env), h: (env.athlete || {}).gender === 'f' ? 176 : 188 });
  const st = goalieGear(gk), base = poseTrack([[0, G_READY]])(0);
  const save = Object.assign({}, G_BUTTERFLY, high ? (side > 0 ? { lShF: 120, lShA: 95, lEl: 25, spineZ: -10 } : { rShF: 110, rShA: 90, rEl: 15, spineZ: 10 })
    : (side > 0 ? { lHipA: 40, lHipR: -60, spineZ: -8 } : { rHipA: 40, rHipR: -60, spineZ: 8 }));
  return (t, puck) => {
    const q = Object.assign({}, base), px = env.mirror ? -puck.x : puck.x, pz = Math.max(1.5, puck.z);
    q.x = clamp(px * 0.07, -0.55, 0.55) + (o.bite ? o.bite[1] * 0.45 * smooth(span(t, o.bite[0], o.bite[0] + 0.25)) : 0); q.z = 0.42;
    q.ry = clamp(headingTo(q.x, q.z, px, pz), -60, 60);
    const k = smooth(span(t, tSave, tSave + 0.2)), kb = o.bite ? smooth(span(t, o.bite[0], o.bite[0] + 0.25)) : 0;
    if (kb > 0) addPose(q, G_BUTTERFLY, kb);
    if (k > 0) { addPose(q, save, k); q.x += side * 0.18 * k; }
    gk.pose(q); goalieStick(gk, st);
  };
}
/* wrist shot (forehand) or backhand from the slot, carrying the puck in on the stick */
function ihWrist(a, o = {}) {
  const back = !!o.back, fast = !!o.fast, tR = fast ? 2.3 : 2.45, tSet = tR - 0.45, dur = tR + 2.1;
  const Rp = o.at || [-1.8, 8.6], tgt = o.tgt || (back ? [0.62, 1.02] : [-0.66, 1.0]);
  const head = headingTo(Rp[0], Rp[1], tgt[0], 0), ryS = back ? head + 35 : head - 40;
  const S = o.from || (fast ? [-7.5, 27.5] : [-5.2, 19.2]), M1 = [lerp(S[0], Rp[0], 0.62) - 0.6, lerp(S[1], Rp[1], 0.62)];
  const pre = [Rp[0] - Math.sin(head * D2R) * 1.7, Rp[1] - Math.cos(head * D2R) * 1.7], aft = [Rp[0] + Math.sin(head * D2R) * 1.5, Rp[1] + Math.cos(head * D2R) * 1.5];
  const hApp = headingTo(M1[0], M1[1], pre[0], pre[1]);
  const keys = [
    [0, Object.assign({ x: S[0], z: S[1], ry: headingTo(S[0], S[1], M1[0], M1[1]) }, SK_BASE)],
    [tSet - 0.55, { x: M1[0], z: M1[1], ry: hApp }],
    [tSet, { x: pre[0], z: pre[1], ry: lerp(hApp, ryS, 0.5) }],
    [tR - 0.14, { ry: ryS - (back ? -6 : 6), lHipF: 42, lKnee: 64, rHipF: 30, rKnee: 52, rHipA: 22, lHipA: 14, spineX: 16, hipsX: 10, chestY: back ? 24 : -24, hipsY: back ? 10 : -10, headY: back ? -40 : 44, neckY: back ? -8 : 8 }],
    [tR, { x: Rp[0], z: Rp[1], ry: ryS, lHipF: 52, lKnee: 72, lHipA: 12, rHipF: 18, rKnee: 28, rHipA: 26, spineX: 22, chestY: back ? -22 : 24, hipsY: back ? -8 : 10, headY: back ? -40 : 40, spineZ: back ? -6 : 6 }],
    [tR + 0.25, { chestY: back ? -32 : 34, headY: back ? -36 : 36 }],
    [tR + 0.75, Object.assign({ x: aft[0], z: aft[1], ry: ryS + (back ? -20 : 20) }, SK_BASE, { chestY: 0, hipsY: 0, headY: 0, neckY: 0, spineZ: 0 })],
    [tR + 1.25, { spineX: 6, hipsX: 4, chestX: 2, lKnee: 30, rKnee: 30, lHipF: 22, rHipF: 22, headX: -14 }],
    [dur, { lKnee: 24, rKnee: 24, headX: -18 }]
  ];
  const body = poseTrack(keys);
  const fq = fast ? 2.2 : 1.7, dr = t => [-0.12 + 0.24 * wave(t, fq), 0, 0.92];
  const sw = vecTrack(back ? [[tSet, [0.2, 0, 0.8]], [tR - 0.25, [0.55, 0, 0.34]], [tR - 0.1, [0.32, 0, 0.62]], [tR, [0.04, 0, 0.98]]]
    : [[tSet, [-0.28, 0, 0.78]], [tR - 0.25, [-0.64, 0, 0.18]], [tR - 0.1, [-0.36, 0, 0.56]], [tR, [0.0, 0, 0.98]]]);
  const puckL = t => t < tSet - 0.2 ? dr(t) : t < tSet ? lerp3(dr(t), sw(tSet), smooth(span(t, tSet - 0.2, tSet))) : sw(t);
  const sideOf = t => { const sd = back ? -1 : 1; if (t >= tSet) return sd; const d = Math.tanh(3 * Math.cos((t * fq) * Math.PI * 2)); return t < tSet - 0.2 ? d : lerp(d, sd, smooth(span(t, tSet - 0.2, tSet))); };
  const Kt = vecTrack(back ? [[0, [0.12, 0.92, 0.32]], [tSet, [0.16, 0.95, 0.3]], [tR - 0.25, [0.3, 0.98, 0.16]], [tR, [0.04, 1.0, 0.36]], [tR + 0.2, [-0.12, 1.18, 0.3]], [tR + 0.8, [0.12, 0.95, 0.3]], [tR + 1.25, [0.12, 1.3, 0.3]], [tR + 1.55, [0.1, 1.95, 0.22]], [dur, [0.1, 1.98, 0.22]]]
    : [[0, [0.12, 0.92, 0.32]], [tSet, [0.12, 0.95, 0.3]], [tR - 0.25, [0.0, 1.0, 0.18]], [tR, [0.2, 1.0, 0.3]], [tR + 0.2, [0.32, 1.15, 0.22]], [tR + 0.8, [0.12, 0.95, 0.3]], [tR + 1.25, [0.12, 1.3, 0.3]], [tR + 1.55, [0.1, 1.95, 0.22]], [dur, [0.1, 1.98, 0.22]]]);
  const yawF = back ? 150 : 40;
  let yawR = 90, P0 = null, G = null, N = null, st = null, goalie = null;
  const yawT = t => t < tR + 0.2 ? lerp(yawR, yawF, smooth(span(t, tR, tR + 0.2))) : t < tR + 0.8 ? lerp(yawF, 95, smooth(span(t, tR + 0.2, tR + 0.8))) : 95;
  const hT = numTrack([[tR, 0.02], [tR + 0.2, 0.55], [tR + 0.8, 0.03], [tR + 1.25, 0.6], [tR + 1.55, 2.6], [dur, 2.6]]);
  const tf = fast ? 0.3 : 0.34;
  return {
    venue: 'iceRink', dur, hold: 0.6, payoff: tR + tf, mirror: a.handedness === 'left', view: 0,
    start(env) {
      st = env.addProp(makeStick(false));
      env.pose(body(tR)); const Pp = env.ws(puckL(tR), false).setY(PUCK_Y), S = stickToPuck(env, st, Kt(tR), Pp, back ? -1 : 1);
      yawR = yawOf(env, bladeMid(S).sub(S.K).setY(0)); P0 = Pp.clone(); G = env.W(tgt[0], tgt[1], -0.02); N = env.W(tgt[0] * 0.9, tgt[1] - 0.12, -0.72);
      goalie = hockeyGoalie(env, tR + 0.05, tgt[0] > 0 ? 1 : -1, tgt[1] > 0.6);
    },
    frame(t, env) {
      const q = body(t);
      if (t < tSet) addPose(q, skate(t / (fast ? 0.52 : 0.62), fast ? 1 : 0.85), runW(t, 0.05, tSet, 0.3));
      env.pose(q);
      const B = env.props.ball;
      if (t <= tR) {
        B.position.copy(env.ws(puckL(t), false)).setY(PUCK_Y);
        const S = stickToPuck(env, st, Kt(t), B.position, sideOf(t)); stickHands(env, S, 0.42);
      } else {
        const S = placeStick(env, st, Kt(t), yawT(t), hT(t)); stickHands(env, S, t > tR + 1.2 ? 0.3 : 0.42);
        const u = t - tR; if (u < tf) arc(P0, G, back ? 0.35 : 0.18, u / tf, B.position); else intoNet(B.position, G, N, u - tf, PUCK_Y, 0.05);
      }
      B.rotation.set(0, t * 25, 0);
      goalie(t, B.position);
      const r = rootPos(env);
      return { focus: V(lerp(r.x, 0, 0.3), 1.1, lerp(r.z, 0, 0.3)), radius: clamp(Math.hypot(r.x, r.z) * 0.5 + 3.4, 6, 11) * Math.max(1, env.s) };
    }
  };
}
/* one-timer slap shot from the left circle: wind-up while the pass slides across, full swing through the puck */
function ihOneTimer(a) {
  const tPass = 0.75, tc = 1.7, dur = tc + 2.3;
  const Sp = [-7.0, 8.9], tgt = [0.7, 0.98], head = headingTo(Sp[0], Sp[1], tgt[0], 0), ry = head - 90 + 22;
  const keys = [
    [0, Object.assign({ x: Sp[0] - 0.6, z: Sp[1] + 0.7, ry: ry - 10 }, SK_BASE)],
    [tc - 0.65, { x: Sp[0] - 0.15, z: Sp[1] + 0.2, ry, lHipA: 18, rHipA: 18, lKnee: 52, rKnee: 52, lHipF: 38, rHipF: 38, spineX: 16, hipsX: 8, headY: 50, neckY: 14 }],
    [tc - 0.25, { hipsY: -16, chestY: -34, spineZ: 8, rKnee: 64, rHipF: 44, lKnee: 40, lHipF: 30, headY: 60, neckY: 16 }],
    [tc, { x: Sp[0], z: Sp[1], hipsY: 8, chestY: 10, spineZ: -2, spineX: 24, lKnee: 62, lHipF: 48, rKnee: 34, rHipF: 20, headY: 46, neckY: 12 }],
    [tc + 0.25, { hipsY: 22, chestY: 36, spineX: 14, spineZ: -8, rHipF: 8, rKnee: 18, rHipA: 26, headY: 30, neckY: 8 }],
    [tc + 0.8, Object.assign({ x: Sp[0] + 0.5, z: Sp[1] - 0.4 }, SK_BASE, { chestY: 10, hipsY: 4, spineZ: 0, headY: 20, neckY: 0, lHipA: 12, rHipA: 12 })],
    [tc + 1.35, { ry: ry + 45, spineX: 4, hipsX: 0, chestX: 2, lKnee: 24, rKnee: 24, lHipF: 18, rHipF: 18, chestY: 0, hipsY: 0, headY: 0, headX: -16 }],
    [dur, { x: Sp[0] + 0.9, z: Sp[1] - 0.6, ry: ry + 55 }]
  ];
  const body = poseTrack(keys);
  const Kt = vecTrack([[0, [0.1, 0.92, 0.32]], [tc - 0.65, [0.08, 0.95, 0.3]], [tc - 0.45, [-0.02, 1.1, 0.26]], [tc - 0.22, [-0.14, 1.32, 0.12]], [tc - 0.04, [0.08, 0.95, 0.34]], [tc, [0.16, 0.9, 0.36]], [tc + 0.12, [0.3, 1.02, 0.3]], [tc + 0.3, [0.36, 1.22, 0.2]], [tc + 0.9, [0.14, 0.95, 0.3]], [tc + 1.3, [0.12, 1.25, 0.3]], [tc + 1.6, [0.1, 1.95, 0.25]], [dur, [0.1, 1.98, 0.25]]]);
  const yaw = numTrack([[0, 100], [tc - 0.65, 100], [tc - 0.45, 150], [tc - 0.22, 205], [tc - 0.04, 108], [tc, 92], [tc + 0.12, 45], [tc + 0.3, 15], [tc + 0.9, 70], [tc + 1.3, 95], [tc + 1.6, 100], [dur, 100]]);
  const hh = numTrack([[0, 0], [tc - 0.65, 0], [tc - 0.45, 0.6], [tc - 0.22, 1.75], [tc - 0.04, 0.0], [tc, 0.0], [tc + 0.12, 0.85], [tc + 0.3, 1.4], [tc + 0.9, 0.05], [tc + 1.3, 0.6], [tc + 1.6, 2.6], [dur, 2.6]]);
  const Pp = [4.6, 11.8], pTr = poseTrack([[0, Object.assign({ x: Pp[0], z: Pp[1], ry: headingTo(Pp[0], Pp[1], Sp[0], Sp[1]) + 40 }, SK_BASE)], [tPass - 0.2, { chestY: -24, hipsY: -10 }], [tPass, { chestY: 24, hipsY: 10, spineX: 20 }], [dur, Object.assign({}, SK_BASE, { chestY: 0, hipsY: 0, spineX: 10, headX: -16 })]]);
  const pPuck = vecTrack([[0, [-0.45, 0, 0.55]], [tPass - 0.22, [-0.6, 0, 0.4]], [tPass, [0.05, 0, 0.98]]]);
  let C = null, P1 = null, G = null, N = null, st = null, pst = null, pas = null, goalie = null;
  const tf = 0.3;
  return {
    venue: 'iceRink', dur, hold: 0.6, payoff: tc + tf, mirror: a.handedness === 'left', view: a.handedness === 'left' ? 15 : -15,
    start(env) {
      st = env.addProp(makeStick(false));
      env.pose(body(tc)); const S = placeStick(env, st, Kt(tc), yaw(tc), hh(tc)); C = puckBeside(S, 1, V());
      pas = ghost(env, 'ice-hockey', { tag: 'mate', uni: uniKey(env) }); pst = env.addProp(makeStick(false));
      pas.pose(pTr(tPass)); P1 = pas.ws(pPuck(tPass), false).setY(PUCK_Y);
      G = env.W(tgt[0], tgt[1], -0.02); N = env.W(tgt[0] * 0.9, tgt[1] - 0.12, -0.72);
      goalie = hockeyGoalie(env, tc + 0.06, 1, true);
    },
    frame(t, env) {
      const q = body(t); if (t < tc - 0.7) addPose(q, skate(t / 0.7, 0.5), runW(t, 0.0, tc - 0.7, 0.3));
      env.pose(q); pas.pose(pTr(t));
      const S = placeStick(env, st, Kt(t), yaw(t), hh(t)); stickHands(env, S, t > tc + 1.2 ? 0.3 : 0.55);
      const B = env.props.ball;
      if (t < tPass) { B.position.copy(pas.ws(pPuck(t), false)).setY(PUCK_Y); const PS = stickToPuck(pas, pst, [0.12, 0.92, 0.32], B.position, 1); stickHands(pas, PS); }
      else {
        const PS = placeStick(pas, pst, [0.18, 1.0, 0.3], lerp(70, 40, smooth(span(t, tPass, tPass + 0.3))), 0.25 * smooth(span(t, tPass, tPass + 0.2)) * (1 - smooth(span(t, tPass + 0.4, tPass + 1)))); stickHands(pas, PS);
        if (t < tc) B.position.lerpVectors(P1, C, (t - tPass) / (tc - tPass)); else { const u = t - tc; if (u < tf) arc(C, G, 0.2, u / tf, B.position); else intoNet(B.position, G, N, u - tf, PUCK_Y, 0.05); }
      }
      B.rotation.set(0, t * 25, 0);
      goalie(t, B.position);
      const r = rootPos(env);
      return { focus: V(lerp(r.x, 0, 0.25), 1.0, lerp(r.z, 0, 0.25)), radius: 8.0 * Math.max(1, env.s) };
    }
  };
}
/* from behind the net ("the office"): patient stickhandling, then out around the post and a wraparound tuck */
function ihWrap(a) {
  const tOut = 1.25, tT = 2.45, dur = tT + 2.0;
  const path = [[1.25, [0.45, -2.2]], [1.5, [0.0, -2.15]], [1.85, [-1.45, -1.75]], [2.15, [-1.95, -0.45]], [tT, [-1.62, 0.5]], [tT + 0.6, [-1.15, 1.65]], [tT + 1.2, [-0.55, 2.5]]];
  const keys = [[0, Object.assign({ x: 0.55, z: -2.18, ry: 0 }, SK_BASE, { hipsX: 6, spineX: 14, headX: -10 })], [0.6, { x: 0.25, ry: -12, headY: -30 }], [1.0, { x: 0.5, ry: 8, headY: 30 }]];
  for (let i = 0; i < path.length; i++) { const [t, p] = path[i], nx = path[Math.min(path.length - 1, i + 1)][1], pv = path[Math.max(0, i - 1)][1]; keys.push([t, { x: p[0], z: p[1], ry: headingTo(pv[0], pv[1], nx[0], nx[1]) + (i === path.length - 1 ? 0 : 0), headY: 0 }]); }
  keys.push([tT - 0.15, { chestY: -18, hipsY: -8, lHipF: 50, lKnee: 72, rHipA: 20 }], [tT + 0.1, { chestY: 26, hipsY: 10, spineX: 24, headY: 30 }], [tT + 0.8, Object.assign({}, SK_BASE, { chestY: 0, hipsY: 0, headY: 0 })],
    [tT + 1.3, { spineX: 6, hipsX: 2, lKnee: 26, rKnee: 26, lHipF: 20, rHipF: 20, headX: -16 }], [dur, {}]);
  keys.sort((p, q) => p[0] - q[0]);
  const body = poseTrack(keys);
  const dr = t => [-0.15 + 0.26 * wave(t, 1.4), 0, 0.88], tuck = vecTrack([[tT - 0.3, [-0.42, 0, 0.75]], [tT - 0.12, [-0.5, 0, 0.62]]]);
  const puckL = t => t < tOut ? dr(t) : t < tT - 0.3 ? lerp3(dr(t), [-0.42, 0, 0.75], smooth(span(t, tOut, tOut + 0.4))) : tuck(t);
  const sideOf = t => t < tOut ? Math.tanh(3 * Math.cos(t * 1.4 * Math.PI * 2)) : 1;
  const Kt = vecTrack([[0, [0.12, 0.92, 0.32]], [tT - 0.3, [0.05, 0.92, 0.28]], [tT, [0.22, 0.98, 0.3]], [tT + 0.25, [0.3, 1.1, 0.25]], [tT + 0.8, [0.12, 0.95, 0.3]], [tT + 1.3, [0.12, 1.3, 0.3]], [tT + 1.6, [0.1, 1.95, 0.22]], [dur, [0.1, 1.98, 0.22]]]);
  let st = null, Pq = null, G = null, N = null, goalie = null, yawR = 90;
  const yawT = t => t < tT + 0.25 ? lerp(yawR, 40, smooth(span(t, tT, tT + 0.25))) : lerp(40, 95, smooth(span(t, tT + 0.25, tT + 0.8)));
  const hT = numTrack([[tT, 0.02], [tT + 0.25, 0.35], [tT + 0.8, 0.03], [tT + 1.3, 0.6], [tT + 1.6, 2.6], [dur, 2.6]]);
  const tf = 0.16;
  return {
    venue: 'iceRink', dur, hold: 0.6, payoff: tT + tf, mirror: a.handedness === 'left', view: a.handedness === 'left' ? 120 : -120,
    start(env) {
      st = env.addProp(makeStick(false));
      env.pose(body(tT - 0.12)); Pq = env.ws(puckL(tT - 0.12), false).setY(PUCK_Y);
      G = env.W(-0.62, 0.05, -0.02); N = env.W(-0.38, 0.12, -0.6);
      const S = stickToPuck(env, st, Kt(tT - 0.12), Pq, 1); yawR = yawOf(env, bladeMid(S).sub(S.K).setY(0));
      goalie = hockeyGoalie(env, tT, -1, false);
    },
    frame(t, env) {
      const q = body(t); if (t > tOut && t < tT - 0.25) addPose(q, skate((t - tOut) / 0.55, 0.75), runW(t, tOut, tT - 0.2, 0.2));
      env.pose(q);
      const B = env.props.ball;
      if (t < tT - 0.12) { B.position.copy(env.ws(puckL(t), false)).setY(PUCK_Y); const S = stickToPuck(env, st, Kt(t), B.position, sideOf(t)); stickHands(env, S); }
      else {
        const u = t - tT + 0.12;
        if (u < tf) { B.position.lerpVectors(Pq, G, u / tf); const S = stickToPuck(env, st, Kt(t), B.position, 1); stickHands(env, S); }
        else { intoNet(B.position, G, N, u - tf, PUCK_Y, 0.1); const S = placeStick(env, st, Kt(t), yawT(t), hT(t)); stickHands(env, S, t > tT + 1.2 ? 0.3 : 0.42); }
      }
      B.rotation.set(0, t * 20, 0);
      const lag = body(Math.max(0, t - 0.45)); goalie(t, V(env.mirror ? -lag.x : lag.x, 0, Math.max(lag.z, 1.6)));
      const r = rootPos(env);
      return { focus: V(lerp(r.x, 0, 0.25), 1.0, lerp(r.z, 0.2, 0.25)), radius: 6.4 * Math.max(1, env.s) };
    }
  };
}
/* breakaway deke: forehand fake, pull across, finish high to the open side ('fb'); long-reach / puck-protection variants */
function ihDeke(a, o = {}) {
  const style = o.style || 'fb', tF = 1.95, tP = tF + 0.28, tR = tF + 0.56, dur = tR + 2.0;
  const S = [0.5, 17], A = [0.3, 6.0], Rp = [0.15, 4.4];
  const keys = [[0, Object.assign({ x: S[0], z: S[1], ry: 180 }, SK_BASE)], [tF - 0.5, { x: lerp(S[0], A[0], 0.85), z: lerp(S[1], A[1], 0.85), ry: 180 }],
    [tF, { x: A[0], z: A[1], ry: 186, spineZ: style === 'reach' ? 14 : 8, chestY: -22, hipsY: -8, headY: 10, lHipF: 40, lKnee: 60, rHipF: 54, rKnee: 82, rHipA: 18 }],
    [tP, { ry: 172, spineZ: -8, chestY: 14, hipsY: 4, headY: -6, lHipF: 56, lKnee: 82, rHipF: 40, rKnee: 60, lHipA: 18, rHipA: 9 }],
    [tR, { x: Rp[0], z: Rp[1], ry: 176, spineZ: style === 'fb' ? 6 : -10, chestY: style === 'fb' ? -18 : 24, hipsY: style === 'fb' ? -6 : 8, spineX: 20, headY: style === 'fb' ? -20 : 16 }],
    [tR + 0.6, Object.assign({ x: Rp[0] - 0.5, z: Rp[1] - 1.6, ry: 160 }, SK_BASE, { spineZ: 0, chestY: 0, hipsY: 0, headY: 0 })],
    [tR + 1.2, { x: Rp[0] - 1.2, z: Rp[1] - 2.2, ry: 120, spineX: 6, hipsX: 2, lKnee: 26, rKnee: 26, lHipF: 20, rHipF: 20, headX: -16 }], [dur, { ry: 110 }]];
  const body = poseTrack(keys);
  const dr = t => [-0.1 + 0.26 * wave(t, 1.6), 0, 0.92];
  const wide = style === 'reach' ? -1.0 : -0.6;
  const dk = vecTrack(style === 'fb' ? [[tF - 0.35, [-0.2, 0, 0.92]], [tF, [wide, 0, 0.82]], [tP, [0.6, 0, 0.78]], [tP + 0.12, [0.64, 0, 0.86]], [tR, [0.22, 0, 1.05]]]
    : [[tF - 0.35, [-0.2, 0, 0.92]], [tF, [wide, 0, 0.8]], [tP - 0.08, [wide + 0.05, 0, 0.88]], [tR, [0.12, 0, 1.02]]]);
  const sideT = numTrack(style === 'fb' ? [[tF - 0.35, -1], [tF - 0.02, -1], [tF + 0.04, 1], [tP, 1], [tP + 0.06, -1], [tR, -1]] : [[tF - 0.35, -1], [tF - 0.02, -1], [tF + 0.06, 1], [tR, 1]]);
  const puckL = t => t < tF - 0.55 ? dr(t) : t < tF - 0.35 ? lerp3(dr(t), dk(tF - 0.35), smooth(span(t, tF - 0.55, tF - 0.35))) : dk(t);
  const sideOf = t => t < tF - 0.35 ? Math.tanh(3 * Math.cos(t * 1.6 * Math.PI * 2)) : sideT(t);
  const prot = style === 'protect';
  const Kt = vecTrack([[0, [0.12, 0.92, 0.32]], [tF, [style === 'reach' ? -0.15 : 0.0, 0.95, 0.3]], [tP, [0.26, 0.95, 0.3]], [tR, [0.12, 1.0, 0.34]], [tR + 0.25, [0.0, 1.2, 0.3]], [tR + 0.8, [0.12, 0.95, 0.3]], [tR + 1.25, [0.12, 1.3, 0.3]], [tR + 1.55, [0.1, 1.95, 0.22]], [dur, [0.1, 1.98, 0.22]]]);
  const tgt = [-0.62, style === 'fb' ? 1.05 : 0.35];
  const yawF = style === 'fb' ? 140 : 40;
  let st = null, P0 = null, G = null, N = null, goalie = null, yawR = 90;
  const yawT = t => t < tR + 0.2 ? lerp(yawR, yawF, smooth(span(t, tR, tR + 0.2))) : lerp(yawF, 95, smooth(span(t, tR + 0.2, tR + 0.8)));
  const hT = numTrack([[tR, 0.02], [tR + 0.2, 0.6], [tR + 0.8, 0.03], [tR + 1.25, 0.6], [tR + 1.55, 2.6], [dur, 2.6]]);
  const tf = 0.28, protW = t => prot ? 1 - smooth(span(t, tF - 0.6, tF - 0.3)) : 0;
  return {
    venue: 'iceRink', dur, hold: 0.6, payoff: tR + tf, mirror: a.handedness === 'left', view: a.handedness === 'left' ? -35 : 35,
    start(env) {
      st = env.addProp(makeStick(false));
      env.pose(body(tR)); P0 = env.ws(puckL(tR), false).setY(PUCK_Y);
      const S = stickToPuck(env, st, Kt(tR), P0, sideOf(tR)); yawR = yawOf(env, bladeMid(S).sub(S.K).setY(0));
      G = env.W(tgt[0], tgt[1], -0.02); N = env.W(tgt[0] * 0.9, tgt[1] - 0.1, -0.7);
      goalie = hockeyGoalie(env, tR + 0.05, -1, tgt[1] > 0.6, { bite: [tF - 0.15, 1] });
    },
    frame(t, env) {
      const q = body(t); if (t < tF - 0.4) addPose(q, skate(t / 0.62, 0.85), runW(t, 0.05, tF - 0.4, 0.3));
      const pw = protW(t); if (pw > 0) addPose(q, { rShF: 70, rShA: 55, rEl: 25, spineZ: 6, chestY: 12 }, pw);
      env.pose(q);
      const B = env.props.ball;
      if (t <= tR) {
        const pl = puckL(t), wideP = prot ? [pl[0] - 0.35 * pw, 0, pl[2] + 0.05 * pw] : pl;
        B.position.copy(env.ws(wideP, false)).setY(PUCK_Y); const S = stickToPuck(env, st, Kt(t), B.position, sideOf(t)); stickHands(env, S, 0.42, 1, 1 - pw);
      } else {
        const S = placeStick(env, st, Kt(t), yawT(t), hT(t)); stickHands(env, S, t > tR + 1.2 ? 0.3 : 0.42);
        const u = t - tR; if (u < tf) arc(P0, G, style === 'fb' ? 0.4 : 0.1, u / tf, B.position); else intoNet(B.position, G, N, u - tf, PUCK_Y, 0.05);
      }
      B.rotation.set(0, t * 25, 0);
      goalie(t, B.position);
      const r = rootPos(env);
      return { focus: V(lerp(r.x, 0, 0.3), 1.05, lerp(r.z, 0, 0.3)), radius: clamp(Math.hypot(r.x, r.z) * 0.45 + 3.6, 6, 10) * Math.max(1, env.s) };
    }
  };
}
/* goalie: acrobatic sprawling pad-stack save, stick dropped, then back up with the glove raised (catches left) */
function ihFlop(a) {
  const tS = 1.25, tC = 1.55, dur = 4.4;
  const keys = [
    [0, Object.assign({ x: 0.1, z: 0.5, ry: 0 }, G_READY)], [0.8, { x: -0.15, ry: -12 }], [tS, { x: -0.25, ry: -16 }],
    [tS + 0.12, { lHipF: 30, rHipF: 40, lKnee: 40, rKnee: 70, spineZ: -10, hipsZ: -14, air: 0.05 }],
    [tC, { x: -0.55, z: 0.6, ry: -6, seat: 1, seatY: 0.24, hipsZ: -74, hipsX: 6, spineX: 4, chestX: 0, spineZ: -6, lHipF: 6, rHipF: 12, lHipA: 4, rHipA: 22, lKnee: 8, rKnee: 6, lHipR: 0, rHipR: 0, lAnk: 10, rAnk: 10,
      lShF: 150, lShA: 60, lEl: 25, rShF: 70, rShA: 40, rEl: 20, headZ: 30, headX: -10 }],
    [tC + 0.5, { seatY: 0.22, hipsZ: -80, rHipA: 16, lShF: 160, rShF: 90, rShA: 60 }],
    [tC + 0.95, { hipsZ: -76, seatY: 0.26, lHipF: 75, rHipF: 72, lKnee: 115, rKnee: 110, lHipA: 6, rHipA: 10, lShF: 70, lShA: 30, rShF: 60, rShA: 30, headZ: 20 }],
    [tC + 1.45, Object.assign({ hipsZ: 0, x: -0.35, ry: 0 }, G_BUTTERFLY, { lShF: 52, lShA: 36, lEl: 88, rShF: 40, rShA: 20, rEl: 55, headZ: 0 })],
    [tC + 1.95, Object.assign({ seat: 0, x: -0.3 }, G_READY)],
    [tC + 2.35, { lShF: 150, lShA: 30, lEl: 30, spineX: 8, hipsX: 2, lKnee: 30, rKnee: 30, lHipF: 22, rHipF: 22, headX: -12, rShF: 20, rEl: 30 }],
    [dur, { lShF: 160 }]
  ];
  const body = poseTrack(keys);
  const sTr = poseTrack([[0, Object.assign({ x: -3.6, z: 11.5, ry: 160 }, SK_BASE)], [tS - 0.45, { x: -2.3, z: 7.9, ry: 165 }], [tS - 0.12, { ry: 150, chestY: -24, hipsY: -10 }], [tS, { x: -1.9, z: 7.1, ry: 145, chestY: 24, hipsY: 10, spineX: 22, headY: 40 }], [dur, Object.assign({ x: -1.4, z: 5.8, ry: 170 }, SK_BASE, { chestY: 0, hipsY: 0, headY: 0, spineX: 8 })]]);
  const sPuck = vecTrack([[0, [-0.1, 0, 0.92]], [tS - 0.45, [-0.2, 0, 0.9]], [tS - 0.12, [-0.62, 0, 0.25]], [tS, [0.0, 0, 0.98]]]);
  let sh = null, sst = null, st = null, P0 = null, C = null, vOut = null, drop = null, dropV = null;
  return {
    venue: 'iceRink', dur, hold: 0.6, payoff: tC, mirror: false, view: 20,
    start(env) {
      st = goalieGear(env);
      sh = ghost(env, 'ice-hockey', { tag: 'shooter' }); sst = env.addProp(makeStick(false));
      sh.pose(sTr(tS)); P0 = sh.ws(sPuck(tS), false).setY(PUCK_Y);
      env.pose(body(tC)); C = env.bonePos(env.side('r') + 'Shin').lerp(env.bonePos(env.side('r') + 'Foot'), 0.5); C.y = Math.max(0.12, C.y);
      vOut = env.W(-7, 2.2, 3.5).sub(V(0, 0, 0)); vOut.x = (env.mirror ? 1 : -1) * 6; vOut.set(vOut.x, 2.4, 3.2);
      env.pose(body(tS + 0.12)); drop = env.rig['grip_' + env.side('r')].getWorldPosition(V()); dropV = env.W(1.6, 0, 2.2);
    },
    frame(t, env) {
      env.pose(body(t)); const sq = sTr(t); if (t < tS - 0.4) addPose(sq, skate(t / 0.62, 0.8), runW(t, 0, tS - 0.4, 0.3)); sh.pose(sq);
      const B = env.props.ball;
      if (t <= tS) { B.position.copy(sh.ws(sPuck(t), false)).setY(PUCK_Y); const S = stickToPuck(sh, sst, [0.12, 0.92, 0.32], B.position, t > tS - 0.45 ? 1 : Math.tanh(3 * Math.cos(t * 1.6 * Math.PI * 2))); stickHands(sh, S); }
      else { const S = placeStick(sh, sst, [0.25, 1.05, 0.25], lerp(80, 40, smooth(span(t, tS, tS + 0.2))), 0.5 * smooth(span(t, tS, tS + 0.2)) * (1 - smooth(span(t, tS + 0.5, tS + 1)))); stickHands(sh, S);
        if (t < tC) arc(P0, C, 0.1, (t - tS) / (tC - tS), B.position); else proj(B.position, C, vOut, t - tC, PUCK_Y, 0.2, 0.7); }
      B.rotation.set(t * 3, t * 25, 0);
      // the stick: held until the dive, then dropped and sliding away on the ice
      if (t < tS + 0.12) goalieStick(env, st);
      else { const u = t - tS - 0.12, k = (1 - Math.exp(-2.2 * u)) / 2.2, p = drop.clone().addScaledVector(dropV, k); p.y = Math.max(0.03, drop.y - 4.9 * u * u * 3);
        placeStickW(st, p, env.dir([0.6, 0, 0.8]).normalize(), 0.0, env.s, 70 + u * 40, env.mirror); }
      const r = rootPos(env);
      return { focus: V(lerp(r.x, -1.9, 0.25), 0.8, lerp(r.z, 7, 0.25)), radius: 6.4 * Math.max(1, env.s), fixedY: true };
    }
  };
}




/* ================================================================== WATER POLO (water surface y = 0; bodies sink with `seat`) */
const WP_R = 0.11, FLOAT_Y = 0.05;
const TREAD = { seat: 1, seatY: -0.42, ground: -4, hipsX: 4, spineX: 6, chestX: 2, lHipF: 78, rHipF: 78, lHipA: 38, rHipA: 38, lKnee: 100, rKnee: 100, lAnk: 20, rAnk: 20, lShF: 40, rShF: 40, lShA: 50, rShA: 50, lEl: 30, rEl: 30, headX: -4 };
/* eggbeater kick and sculling hands (absolute values, blended with addPose) */
function egg(t, k = 1, f = 1.4) {
  const w = t * f * Math.PI * 2, s = Math.sin(w), c = Math.cos(w);
  return { lKnee: 100 + 24 * k * s, rKnee: 100 - 24 * k * s, lHipR: -14 + 18 * k * c, rHipR: -14 - 18 * k * c, lHipA: 38 + 7 * k * c, rHipA: 38 - 7 * k * c, lAnk: 20 + 15 * k * s, rAnk: 20 - 15 * k * s };
}
function scull(t, sides = 'lr', k = 1) {
  const w = t * 1.2 * Math.PI * 2, o = {};
  for (const sd of sides) { o[sd + 'ShA'] = 52 + 12 * k * Math.sin(w); o[sd + 'ShF'] = 38 + 8 * k * Math.cos(w); o[sd + 'El'] = 32; o[sd + 'ShR'] = 10 * Math.sin(w); }
  return o;
}
/* white foam ring at the waterline around a body */
function foam(env, r = 0.42) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 28), new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.45, depthWrite: false }));
  m.rotation.x = Math.PI / 2; m.castShadow = false; env.addProp(m); m.castShadow = false; return m;
}
function setFoam(m, rig, k, t) { const h = rig.bones.chest.getWorldPosition(V()); m.position.set(h.x, 0.015, h.z); const sc = 1 + 0.08 * Math.sin(t * 9) + 0.6 * k; m.scale.set(sc, sc, 1); m.material.opacity = 0.22 + 0.4 * Math.min(1, k); }
function splash(env) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.22, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; env.addProp(m); m.castShadow = false; return m;
}
function setSplash(m, P, u) { if (u < 0 || u > 1) { m.visible = false; return; } m.visible = true; m.position.set(P.x, 0.02, P.z); const sc = 1 + 5 * u; m.scale.set(sc, sc, 1); m.material.opacity = 0.85 * (1 - u); }
function wpKeeper(env, tRel, tgt, o = {}) {
  const gk = ghost(env, 'water-polo', { tag: 'keeper', uni: uniKey(env) === 'coral' ? 'navy' : 'coral', h: (env.athlete || {}).gender === 'f' ? 180 : 196 });
  const side = Math.sign(tgt[0]) || 1, fm = foam(gk), from = o.from || [0, 6];
  const ready = Object.assign({}, TREAD, { seatY: -0.3, lShF: 80, rShF: 80, lShA: 55, rShA: 55, lEl: 40, rEl: 40 });
  const lunge = side > 0 ? { seatY: -0.02, lShF: 150, lShA: 120, lEl: 6, rShF: 60, rShA: 70, spineZ: -22, chestZ: -8, lHipA: 20 } : { seatY: -0.02, rShF: 150, rShA: 120, rEl: 6, lShF: 60, lShA: 70, spineZ: 22, chestZ: 8, rHipA: 20 };
  const tr = poseTrack([[0, Object.assign({ x: 0, z: 0.7, ry: headingTo(0, 0.7, from[0], from[1]) }, ready)], [tRel + 0.05, {}], [tRel + 0.32, Object.assign({ x: side * 0.45 }, lunge)], [tRel + 0.9, Object.assign({ x: side * 0.4 }, ready, { spineZ: 0, chestZ: 0 })], [tRel + 3, {}]]);
  return t => { const q = tr(t); addPose(q, egg(t, 1, 1.8), 1); gk.pose(q); setFoam(fm, gk.rig, smooth(span(t, tRel, tRel + 0.3)) * (1 - smooth(span(t, tRel + 0.5, tRel + 1))), t); };
}
/* lift out of the water on the eggbeater and fire overhead (power) or side-arm off the water (skip) */
function wpShot(a, o = {}) {
  const skip = !!o.skip, X = o.x === undefined ? -1.2 : o.x, Z = o.z || 6.5, lift = o.lift || 0;
  const tGrab = 0.65, tCock = 1.42, tR = 1.6, dur = 4.0;
  const face = headingTo(X, Z, 0, 0), tgt = o.tgt || (skip ? [1.0, 0.35] : [1.15, 0.72]);
  const keys = [
    [0, Object.assign({ x: X, z: Z + 0.2, ry: face + 8 }, TREAD)],
    [tGrab, { rShF: 55, rShA: 30, rEl: 20 }],
    [1.12, { x: X, z: Z, ry: face - 4, seatY: -0.14 + lift * 0.5, rHipF: 62, lHipF: 86, spineX: -2, chestY: -36, hipsY: -10, spineZ: 8, headY: 34, neckY: 6, lShF: 75, lShA: 28, lEl: 12 }],
    [tCock, { seatY: -0.04 + lift, chestY: -44, spineX: -8, spineZ: skip ? 16 : 10, headY: 40 }],
    [tR, { seatY: -0.08 + lift, chestY: 28, spineX: 22, spineZ: skip ? 12 : -4, hipsY: 8, headY: 4, neckY: 0, lShF: 40, lShA: 42, lEl: 25 }],
    [tR + 0.28, { seatY: -0.32, spineX: 42, chestX: 10, chestY: 30, rShF: 80, rShA: 20, rEl: 10, headX: 10 }],
    [tR + 0.85, Object.assign({}, TREAD, { seatY: -0.45, spineX: 12, chestY: 0, spineZ: 0, hipsY: 0, headY: 0, headX: -6 })],
    [tR + 1.5, { seatY: -0.22, rShF: 165, rShA: 22, rEl: 30, lShF: 45, spineX: 2, headX: -14 }],
    [dur, { seatY: -0.26, rShF: 168 }]
  ];
  const body = poseTrack(keys);
  const rel = skip ? [-0.62, 1.72, 0.32] : [-0.12, 2.15, 0.45], cock = skip ? [-0.58, 1.85, -0.3] : [-0.34, 2.12, -0.3];
  const ball = vecTrack([[tGrab, [-0.3, 1.4, 0.5]], [1.0, [-0.36, 1.78, 0.12]], [1.15, [-0.38, 2.0, -0.14]], [tCock, cock], [tR, rel]]);
  const pole = vecTrack([[0, [-0.8, 1.0, 0.2]], [1.0, [-0.9, 1.6, -0.4]], [tCock, [-0.9, 2.1, -0.6]], [tR, skip ? [-0.9, 1.2, 0.3] : [-0.7, 2.4, 0.3]]]);
  const ikR = numTrack([[0, 1], [tR, 1], [tR + 0.12, 0]]);
  const tf = skip ? 0.42 : 0.3;
  let W0 = null, P0 = null, G = null, N = null, Bp = null, keeper = null, fm = null, sp = null, sp2 = null;
  return {
    venue: 'waterPoloPool', dur, hold: 0.6, payoff: tR + tf, mirror: a.handedness === 'left', allowBelowGround: true, view: a.handedness === 'left' ? -10 : 10,
    start(env) {
      env.pose(body(0)); W0 = env.ws([-0.3, 0, 0.55], false).setY(FLOAT_Y);
      env.pose(body(tR)); P0 = env.ws(rel).clone(); G = env.W(tgt[0], tgt[1], -0.02); N = env.W(tgt[0] * 0.92, tgt[1] - 0.08, -0.75); Bp = env.W(tgt[0] * 0.55, FLOAT_Y, 1.35);
      keeper = wpKeeper(env, tR, tgt, { from: [X, Z] }); fm = foam(env); sp = splash(env); sp2 = splash(env);
    },
    frame(t, env) {
      const q = body(t);
      addPose(q, egg(t, 1, t > 0.9 && t < tR + 0.2 ? 2.4 : 1.4), 1);
      if (t < tGrab + 0.2) addPose(q, scull(t, 'l'), 1 - smooth(span(t, tGrab, tGrab + 0.2)));
      else if (t > tR + 0.8) addPose(q, scull(t, 'l'), smooth(span(t, tR + 0.8, tR + 1.1)));
      env.pose(q);
      const B = env.props.ball;
      if (t < tR) {
        const k = smooth(span(t, tGrab, 1.0));
        if (k <= 0) B.position.copy(W0); else B.position.lerpVectors(W0, env.ws(ball(t)), k);
        const top = B.position.clone().add(V(0, WP_R + 0.02, 0)), palm = palmOn(env, 'r', B.position, WP_R);
        env.reach('r', top.lerp(palm, smooth(span(t, tGrab, tGrab + 0.25))), pole(t), { weight: smooth(span(t, 0.1, 0.45)) });
      } else {
        const u = t - tR;
        if (skip) { if (u < tf * 0.5) arc(P0, Bp, 0.02, u / (tf * 0.5), B.position); else if (u < tf) arc(Bp, G, 0.18, (u - tf * 0.5) / (tf * 0.5), B.position); else intoNet(B.position, G, N, u - tf, FLOAT_Y, 0.06); }
        else if (u < tf) arc(P0, G, 0.12, u / tf, B.position); else intoNet(B.position, G, N, u - tf, FLOAT_Y, 0.06);
        env.reach('r', env.handPos('r'), pole(t), { weight: ikR(t) });
      }
      B.rotation.set(t * 7, t * 3, 0);
      setFoam(fm, env.rig, smooth(span(t, 0.9, 1.3)) * (1 - smooth(span(t, tR + 0.1, tR + 0.6))) + 0.6 * Math.exp(-Math.pow((t - tR - 0.3) / 0.15, 2)), t);
      setSplash(sp, Bp, skip ? (t - tR - tf * 0.5) / 0.6 : -1); setSplash(sp2, N, (t - tR - tf - 0.15) / 0.7);
      keeper(t);
      const r = rootPos(env);
      return { focus: V(lerp(r.x, 0, 0.25), 0.45, lerp(r.z, 0, 0.25)), radius: Math.max(5.0, Math.hypot(r.x, r.z) * 0.42 + 2.9) * Math.max(1, env.s), fixedY: true };
    }
  };
}
/* playmaker: win the ball, spin, rise and launch a long counter-attack pass to a team-mate up the pool */
function wpCounter(a) {
  const tGrab = 0.55, tTurn = 1.25, tR = 1.75, tCatch = tR + 1.25, dur = tCatch + 1.4;
  const X = 1.6, Z = 4.2, mate = [-2.6, 15.5];
  const out = headingTo(X, Z, mate[0], mate[1]);
  const keys = [
    [0, Object.assign({ x: X, z: Z, ry: 200 }, TREAD)], [tGrab, { rShF: 60, rShA: 25, rEl: 20 }],
    [tTurn, { ry: out + 15, seatY: -0.25, chestY: -20, headY: 20 }],
    [tR - 0.2, { seatY: -0.06, chestY: -42, spineX: -10, spineZ: 8, hipsY: -10, headY: 38, neckY: 6, rHipF: 60, lHipF: 86, lShF: 85, lShA: 30, lEl: 10 }],
    [tR, { seatY: -0.1, chestY: 18, spineX: 10, spineZ: -2, hipsY: 6, headY: 6, neckY: 0, headX: -14, lShF: 50, lShA: 40, lEl: 20 }],
    [tR + 0.3, { seatY: -0.3, spineX: 26, chestY: 22, rShF: 100, rEl: 10, headX: -10 }],
    [tR + 0.9, Object.assign({}, TREAD, { ry: out, seatY: -0.38, spineX: 8, chestY: 0, hipsY: 0, spineZ: 0, headY: 0, headX: -10, rShF: 120, rShA: 15, rEl: 5 })],
    [dur, { rShF: 100, rShA: 20, rEl: 10, seatY: -0.4 }]
  ];
  const body = poseTrack(keys);
  const ball = vecTrack([[tGrab, [-0.3, 1.4, 0.5]], [tTurn, [-0.34, 1.75, 0.2]], [tR - 0.2, [-0.36, 2.12, -0.32]], [tR, [-0.16, 2.2, 0.38]]]);
  const pole = vecTrack([[0, [-0.8, 1.0, 0.2]], [tTurn, [-0.9, 1.6, -0.4]], [tR - 0.2, [-0.9, 2.1, -0.6]], [tR, [-0.7, 2.4, 0.3]]]);
  const mTr = poseTrack([[0, Object.assign({ x: mate[0] + 0.6, z: mate[1] - 1.6, ry: 0 }, TREAD, { seat: 1, seatY: -0.5, hipsX: 70, spineX: 4, lHipF: 8, rHipF: 8, lHipA: 6, rHipA: 6, lKnee: 20, rKnee: 20, lShF: 150, rShF: 60, headX: -40 })],
    [tR, { x: mate[0] + 0.2, z: mate[1] - 0.4, lShF: 60, rShF: 150 }],
    [tCatch - 0.5, Object.assign({ x: mate[0], z: mate[1], ry: 200 }, TREAD, { seatY: -0.3, rShF: 160, rShA: 20, rEl: 10 })],
    [tCatch + 0.2, { seatY: -0.25 }], [dur, { seatY: -0.4, rShF: 120 }]]);
  let W0 = null, P0 = null, C = null, mt = null, fm = null, fm2 = null;
  return {
    venue: 'waterPoloPool', dur, hold: 0.6, payoff: tCatch, mirror: a.handedness === 'left', allowBelowGround: true, view: a.handedness === 'left' ? -30 : 30,
    start(env) {
      env.pose(body(0)); W0 = env.ws([-0.3, 0, 0.55], false).setY(FLOAT_Y);
      env.pose(body(tR)); P0 = env.ws(ball(tR)).clone();
      mt = ghost(env, 'water-polo', { tag: 'mate', uni: uniKey(env) }); mt.pose(mTr(tCatch)); C = mt.handPos('r').add(V(0, 0.08, 0));
      fm = foam(env); fm2 = foam(mt);
    },
    frame(t, env) {
      const q = body(t); addPose(q, egg(t, 1, t > tTurn && t < tR + 0.2 ? 2.4 : 1.4), 1);
      if (t < tGrab + 0.2) addPose(q, scull(t, 'l'), 1 - smooth(span(t, tGrab, tGrab + 0.2)));
      env.pose(q);
      const mq = mTr(t); if (t < tCatch - 0.6) { const w = t * 1.3 * Math.PI * 2; addPose(mq, { lShF: 90 + 80 * Math.sin(w), rShF: 90 - 80 * Math.sin(w), lKnee: 20 + 20 * Math.sin(w * 2), rKnee: 20 - 20 * Math.sin(w * 2) }, 1 - smooth(span(t, tCatch - 0.9, tCatch - 0.6))); }
      else addPose(mq, egg(t, 1, 1.6), 1);
      mt.pose(mq);
      const B = env.props.ball;
      if (t < tR) {
        const k = smooth(span(t, tGrab, tTurn)); if (k <= 0) B.position.copy(W0); else B.position.lerpVectors(W0, env.ws(ball(t)), k);
        const top = B.position.clone().add(V(0, WP_R + 0.02, 0));
        env.reach('r', top.lerp(palmOn(env, 'r', B.position, WP_R), smooth(span(t, tGrab, tGrab + 0.25))), pole(t), { weight: smooth(span(t, 0.1, 0.4)) });
      } else if (t < tCatch) { arc(P0, C, 3.2, (t - tR) / (tCatch - tR), B.position); env.reach('r', env.handPos('r'), pole(t), { weight: 1 - smooth(span(t, tR, tR + 0.12)) }); }
      else { B.position.copy(mt.handPos('r')).add(V(0, 0.08, 0)); }
      B.rotation.set(t * 5, t * 2, 0);
      setFoam(fm, env.rig, smooth(span(t, tTurn, tR - 0.2)) * (1 - smooth(span(t, tR, tR + 0.5))), t); setFoam(fm2, mt.rig, t < tCatch - 0.6 ? 0.5 : 0.1, t);
      const r = rootPos(env), k = smooth(span(t, tR, tCatch)), mp = mt.rig.root.position, back = 0.45 * smooth(span(t, tCatch + 0.3, dur));
      const f = V(lerp(r.x, mp.x, k), 0.6, lerp(r.z, mp.z, k)).lerp(V((r.x + mp.x) / 2, 0.6, (r.z + mp.z) / 2), back);
      f.y = lerp(0.6, 1.4, Math.sin(Math.PI * k) * (1 - back));
      return { focus: f, radius: (5.6 + 2.6 * Math.sin(Math.PI * k) + 4.5 * back) * Math.max(1, env.s), fixedY: true };
    }
  };
}
/* defender: rise high on the eggbeater with the arm straight up and block the shot */
function wpBlock(a) {
  const tR = 1.45, tc = 1.62, dur = 3.9;
  const D = [-0.75, 4.4], A = [-1.0, 6.1];
  const keys = [
    [0, Object.assign({ x: D[0], z: D[1], ry: headingTo(D[0], D[1], A[0], A[1]) }, TREAD, { seatY: -0.36 })],
    [0.9, { seatY: -0.3, rShF: 90, rShA: 30, rEl: 40, lShF: 50, lShA: 55 }],
    [tR - 0.08, { seatY: -0.02, rShF: 172, rShA: 12, rEl: 4, rWrF: -10, lShF: 40, lShA: 70, lEl: 20, spineX: -2, spineZ: 6, headX: -10 }],
    [tc + 0.1, { seatY: 0.02, rShF: 176, rShA: 8 }],
    [tc + 0.6, Object.assign({}, TREAD, { seatY: -0.35, rShF: 120, rShA: 20, rEl: 20, spineZ: 0 })],
    [tc + 1.3, { seatY: -0.2, rShF: 120, rShA: 60, rEl: 110, rWrF: -10, chestY: 15, headX: -12 }],
    [dur, { seatY: -0.24, rShF: 150, rShA: 40, rEl: 60 }]
  ];
  const body = poseTrack(keys);
  const aFace = headingTo(A[0], A[1], 0.2, 0);
  const aTr = poseTrack([[0, Object.assign({ x: A[0], z: A[1], ry: aFace + 8 }, TREAD)], [0.85, { seatY: -0.16, rHipF: 62, lHipF: 86, chestY: -36, hipsY: -10, spineZ: 8, headY: 34, lShF: 75, lShA: 28, lEl: 12, ry: aFace - 4 }],
    [tR - 0.15, { seatY: -0.06, chestY: -44, spineX: -8, spineZ: 10 }], [tR, { seatY: -0.1, chestY: 26, spineX: 22, spineZ: -4, hipsY: 8, headY: 4, lShF: 40, lShA: 42, lEl: 25 }],
    [tR + 0.3, { seatY: -0.32, spineX: 40, chestY: 28, rShF: 80, rEl: 10 }], [dur, Object.assign({}, TREAD, { seatY: -0.42 })]]);
  const aBall = vecTrack([[0, [-0.3, 1.75, 0.2]], [0.85, [-0.38, 2.0, -0.14]], [tR - 0.15, [-0.34, 2.12, -0.3]], [tR, [-0.12, 2.15, 0.45]]]);
  let at = null, P0 = null, C = null, vOut = null, keeper = null, fm = null, fm2 = null, sp = null;
  return {
    venue: 'waterPoloPool', dur, hold: 0.6, payoff: tc, mirror: a.handedness === 'left', allowBelowGround: true, view: a.handedness === 'left' ? -100 : 100,
    start(env) {
      at = ghost(env, 'water-polo', { tag: 'attacker' }); at.pose(aTr(tR)); P0 = at.ws(aBall(tR)).clone();
      env.pose(body(tc)); C = env.handPos('r').add(V(0, 0.1, 0)); vOut = env.dir([-1.5, 3.5, 2.2]);
      keeper = wpKeeper(env, tR + 0.6, [0.5, 0.5], { from: A }); fm = foam(env); fm2 = foam(at); sp = splash(env);
    },
    frame(t, env) {
      const q = body(t); addPose(q, egg(t, 1, t > 0.8 && t < tc + 0.2 ? 2.4 : 1.4), 1); if (t < 0.85) addPose(q, scull(t, 'lr'), 1 - smooth(span(t, 0.6, 0.85))); env.pose(q);
      const aq = aTr(t); addPose(aq, egg(t, 1, 2), 1); at.pose(aq);
      const B = env.props.ball;
      if (t < tR) { B.position.copy(at.ws(aBall(t))); at.reach('r', palmOn(at, 'r', B.position, WP_R), [-0.9, 2.0, -0.5]); }
      else if (t < tc) { arc(P0, C, 0.05, (t - tR) / (tc - tR), B.position); at.reach('r', at.handPos('r'), [-0.7, 2.4, 0.3], { weight: 1 - smooth(span(t, tR, tR + 0.12)) }); }
      else proj(B.position, C, vOut, t - tc, FLOAT_Y, 0.15, 0.6);
      B.rotation.set(t * 7, t * 3, 0);
      setFoam(fm, env.rig, smooth(span(t, 0.9, 1.3)) * (1 - smooth(span(t, tc + 0.2, tc + 0.7))), t); setFoam(fm2, at.rig, smooth(span(t, 0.6, 1.0)) * (1 - smooth(span(t, tR + 0.1, tR + 0.6))), t);
      setSplash(sp, B.position, B.position.y < FLOAT_Y + 0.01 && t > tc + 0.3 ? 0.3 : -1);
      keeper(t);
      const r = rootPos(env);
      return { focus: V(lerp(r.x, A[0] * (env.mirror ? -1 : 1), 0.4), 0.55, lerp(r.z, A[1], 0.4)), radius: 6.0 * Math.max(1, env.s), fixedY: true };
    }
  };
}


/* ================================================================== CRICKET (striker's stumps at the origin, bowler runs in toward +Z) */
const CB_R = 0.036;
function makeCricketBat() {
  const g = new THREE.Group(), willow = M('#e7d09c', { roughness: 0.55 }), grip = M('#23272b', { roughness: 0.85 });
  add(g, new THREE.CylinderGeometry(0.017, 0.016, 0.29, 12), grip, [0, 0.145, 0]);
  add(g, new THREE.CylinderGeometry(0.02, 0.026, 0.05, 12), willow, [0, 0.31, 0]);
  add(g, new THREE.BoxGeometry(0.108, 0.54, 0.036), willow, [0, 0.6, 0.004]);
  add(g, new THREE.BoxGeometry(0.05, 0.4, 0.03), willow, [0, 0.64, -0.024]);
  return g;
}
function batterGear(e) {
  const r = e.rig, s = e.s, pad = M('#f6f6f2', { roughness: 0.7 });
  const put = (geo, bone, pos) => { const m = new THREE.Mesh(geo, pad); m.position.set(pos[0] * s, pos[1] * s, pos[2] * s); m.scale.setScalar(s); e.addProp(m, r.bones[bone]); };
  for (const sd of ['l', 'r']) { put(new THREE.BoxGeometry(0.16, 0.58, 0.1), sd + 'Shin', [0, -0.23, 0.06]); put(new THREE.BoxGeometry(0.16, 0.13, 0.12), sd + 'Shin', [0, 0.03, 0.06]); put(new THREE.BoxGeometry(0.08, 0.11, 0.075), sd + 'Hand', [0, -0.05, 0.01]); }
  r.setHeadwear('cricketHelmet');
}
function stumpsProp(env) { const g = new THREE.Group(); env.addProp(g); return stumpsAt(g, 0); }
/* struck stump tilts back, bails fly (deterministic from the hit time) */
function knockStumps(st, which, u, env) {
  st.stumps.forEach((m, i) => { const k = i === which ? 1 : 0.18; const a = u > 0 ? k * 0.55 * (1 - Math.exp(-u * 9)) : 0; m.rotation.set(a, 0, (i - 1) * 0.15 * a); m.position.set(m.userData.x0 ?? (m.userData.x0 = m.position.x), 0.3555 * Math.cos(a), 0.3555 * Math.sin(a)); });
  st.bails.forEach((b, i) => {
    if (b.userData.x0 === undefined) b.userData.x0 = b.position.x;
    if (u <= 0) { b.position.set(b.userData.x0, 0.719, 0); b.rotation.set(0, 0, Math.PI / 2); return; }
    proj(b.position, V(b.userData.x0, 0.719, 0), V((i ? 1.2 : -1.0) * (env.mirror ? -1 : 1), 3.0 + i * 0.4, 3.2 + i * 0.5), u, 0.008, 0.3, 0.6);
    b.rotation.set(u * (9 + i * 3), u * 4, Math.PI / 2 + u * 7);
  });
}
/* wicket-keeper crouched behind the stumps (rises as the ball passes) */
function keeperGhost(env, z, tUp) {
  const k = ghost(env, 'cricket', { tag: 'keeper', uni: rivalUni(env) }); batterGear(k); k.rig.setHeadwear('cricketHelmet');
  for (const sd of ['l', 'r']) { const gl = makeGlove('#f2f2ee'); gl.position.set(0, -0.02 * k.s, 0.03 * k.s); gl.scale.setScalar(k.s); k.addProp(gl, k.rig.bones[k.side(sd) + 'Hand']); }
  const tr = poseTrack([[0, { x: 0.15, z, ry: 180, lHipA: 30, rHipA: 30, lHipF: 105, rHipF: 105, lKnee: 135, rKnee: 135, lAnk: 25, rAnk: 25, lHipR: -20, rHipR: -20, spineX: 30, headX: -12, lShF: 60, rShF: 60, lEl: 40, rEl: 40, lShA: 10, rShA: 10 }], [tUp, {}],
    [tUp + 0.35, { lHipF: 30, rHipF: 30, lKnee: 40, rKnee: 40, spineX: 20, lHipA: 18, rHipA: 18, lHipR: 0, rHipR: 0, lAnk: 10, rAnk: 10, headX: -4 }], [tUp + 3, { lShF: 20, rShF: 20, lKnee: 20, rKnee: 20, spineX: 10 }]]);
  return t => k.pose(tr(t));
}
/* ----- batting plan: stance, back-lift, front-foot stride, straight-bat swing in a vertical plane (angle th around the
   horizontal shot heading psi), follow-through; handle-top track K in the athlete frame */
const CR_STANCE = { x: -0.38, z: -1.2, ry: 90, lHipA: 13, rHipA: 13, lHipF: 16, rHipF: 16, lKnee: 20, rKnee: 22, lAnk: 4, rAnk: 4, spineX: 24, chestX: 6, chestY: -6, headY: 72, neckY: 12, headX: 6, lShF: 30, rShF: 30, lEl: 40, rEl: 40 };
function batPlan(kind, tc = 1.8) {
  const tLift = tc - 0.78, tTop = tc - 0.36, tLand = tc - 0.1, tFol = tc + 0.32, tHold = tc + 1.35, dur = tc + 2.2;
  const psi = { cover: 55, straight: 4, lofted: -8, high: 50, defend: 0, heli: -30 }[kind], off = kind === 'cover' || kind === 'high' ? 0.1 : 0;
  const body = poseTrack([
    [0, CR_STANCE], [tLift, {}],
    [tTop, { hipsY: -6, chestY: -14, rKnee: 28, headY: 70 }],
    [tLand, kind === 'heli' ? { x: -0.4, z: -1.32, lHipA: 22, lHipF: 14, lKnee: 24, rKnee: 34, rHipF: 22, hipsY: 20, spineX: 26, chestY: -16, headY: 52, headX: 22 }
      : { x: -0.38 + off, z: -1.46, lHipA: 36, lHipF: 30, lKnee: 38, lAnk: 10, rHipF: 0, rKnee: 16, rHipA: 8, hipsY: 26, spineX: 34, chestX: 8, chestY: -30, headY: 42, headX: 24 }],
    [tc, kind === 'heli' ? { rKnee: 44, rHipF: 30, lKnee: 18, hipsY: 34, spineX: 30, chestY: -6, headY: 40, headX: 30 }
      : { lKnee: kind === 'lofted' ? 34 : 46, lHipF: 36, spineX: kind === 'lofted' ? 26 : 38, chestY: -24, headY: 36, headX: 30 }],
    [tFol, kind === 'heli' ? { rKnee: 22, rHipF: 8, hipsY: 50, chestY: 40, spineX: 12, spineZ: -8, headY: 20, headX: -12 }
      : kind === 'defend' ? {} : { chestY: kind === 'lofted' ? 10 : 0, hipsY: 30, spineX: kind === 'lofted' ? 14 : 26, headY: 30, headX: kind === 'lofted' ? -6 : 10 }],
    [tHold, kind === 'heli' ? { headX: -18 } : {}],
    [dur, { spineX: 10, lHipA: 15, lHipF: 10, lKnee: 12, rKnee: 10, rHipF: 6, hipsY: 20, chestY: 0, spineZ: 0, headY: 20, headX: -4 }]
  ]);
  const hi = kind === 'high';
  const Kk = kind === 'heli'
    ? [[0, [0.0, 0.9, 0.28]], [tLift, [0.0, 0.92, 0.28]], [tTop, [-0.18, 1.3, 0.12]], [tc - 0.05, [0.2, 0.84, 0.32]], [tc, [0.26, 0.78, 0.34]], [tc + 0.12, [0.25, 1.25, 0.25]], [tc + 0.3, [0.05, 1.85, 0.08]], [tc + 0.6, [-0.05, 1.9, 0.0]], [tc + 0.9, [0.0, 1.62, 0.1]], [tHold, [0.0, 1.58, 0.1]], [dur, [0.05, 1.0, 0.3]]]
    : kind === 'defend' ? [[0, [0.0, 0.88, 0.28]], [tLift, [0.0, 0.9, 0.28]], [tTop, [-0.08, 1.05, 0.2]], [tLand, [0.25, 1.0, 0.3]], [tc, [0.52, 0.9, 0.34]], [dur, [0.5, 0.92, 0.34]]]
    : [[0, [0.0, 0.88, 0.28]], [tLift, [0.0, 0.9, 0.28]], [tTop, hi ? [-0.12, 1.5, 0.08] : [-0.14, 1.18, 0.14]], [tLand, [0.12, 1.12, 0.26]], [tc - 0.04, [0.5, 0.92, 0.34]], [tc, [0.58, 0.88, 0.36]],
      [tc + 0.12, [0.72, 1.12, 0.38]], [tFol, kind === 'lofted' ? [0.6, 1.7, 0.25] : [0.55, 1.55, 0.3]], [tHold, kind === 'lofted' ? [0.55, 1.72, 0.22] : [0.52, 1.58, 0.28]], [dur, [0.1, 1.0, 0.35]]];
  const th = numTrack(kind === 'heli' ? [[0, 262], [tLift, 262], [tTop, 125], [tc - 0.05, 245], [tc, 272], [tc + 0.08, 320], [dur, 320]]
    : kind === 'defend' ? [[0, 262], [tLift, 262], [tTop, 200], [tLand, 238], [tc, 268], [dur, 268]]
    : [[0, 262], [tLift, 262], [tTop, hi ? 98 : 128], [tLand, 175], [tc - 0.04, 255], [tc, kind === 'lofted' ? 282 : 270], [tc + 0.12, 330], [tFol, kind === 'lofted' ? 455 : hi ? 470 : 445], [tHold, kind === 'lofted' ? 460 : hi ? 472 : 450], [dur, 600]]);
  const ps = numTrack([[0, 0], [tTop, 12], [tLand, psi * 0.5], [tc, psi], [dur, psi]]);
  const rot = numTrack([[tc + 0.08, psi], [tc + 0.62, psi - 360], [tc + 0.9, psi - 400], [dur, psi - 400]]), rotW = numTrack([[tc + 0.04, 0], [tc + 0.2, 1], [tHold, 1], [dur, 0.4]]);
  return { body, K: vecTrack(Kk), th, ps, tc, dur, psi, kind, rot: kind === 'heli' ? rot : null, rotW };
}
/* place the bat for plan P at time t on env e and put both hands on the handle; returns { K, D } */
function placeBat(e, bat, P, t) {
  let K = P.K(t);
  const th = P.th(t), ps = P.ps(t);
  if (t < P.tc - 0.78) { const tap = Math.max(0, Math.sin(t * Math.PI * 2 * 1.1)); K = [K[0], K[1] + 0.03 * tap, K[2]]; }
  const h = ldir(ps), c = Math.cos(th * D2R), sn = Math.sin(th * D2R);
  let dl = [c * h[0], sn, c * h[2]], nl = [-sn * h[0], c, -sn * h[2]];
  if (P.rot) { const w = P.rotW(t); if (w > 0) { const r = ldir(P.rot(t), 12), rn = [0, 1, 0]; dl = lerp3(dl, r, w); nl = lerp3(nl, rn, w); } }
  const Kw = e.ws(K), D = e.dir(dl).normalize();
  bat.scale.setScalar(e.s); orientYZ(bat, Kw, D, e.dir(nl));
  const s = e.s;
  e.reach('l', Kw.clone().addScaledVector(D, 0.05 * s), [0.7, 0.9, -0.3], { weight: 1 });
  e.reach('r', Kw.clone().addScaledVector(D, 0.15 * s), [-0.6, 0.6, -0.3], { weight: 1 });
  return { K: Kw, D };
}
const sweetSpot = (B, s) => B.K.clone().addScaledVector(B.D, 0.66 * s);

/* ----- bowling plan: run-up, bound, side-on back-foot landing, front-foot brace, arm over the top, follow-through */
function bowlPlan(kind) {
  const fast = kind === 'fast', x0 = 0.42, zR = -19.0;
  const tB = fast ? 1.45 : 1.25, tBF = tB + (fast ? 0.32 : 0.26), tFF = tBF + (fast ? 0.15 : 0.2), tR = tFF + (fast ? 0.1 : 0.13), dur = tR + 2.2;
  const z0 = fast ? -31.6 : -24.4;
  const body = poseTrack([
    [0, { x: x0, z: z0, ry: 0, spineX: 10, chestX: 2 }],
    [tB - 0.2, { x: x0, z: fast ? -22.9 : -21.5, ry: 0 }],
    [tB, { z: fast ? -21.95 : -21.0, air: 0.04, ry: -20, lHipF: 70, lKnee: 80, rHipF: -6, rKnee: 22, rAnk: -30, spineX: 4, rShF: 50, rShA: 10, rEl: 125, lShF: 120, lShA: 10, lEl: 30 }],
    [(tB + tBF) / 2, { air: fast ? 0.36 : 0.14, z: lerp(fast ? -21.95 : -21.0, zR - 1.2, 0.5), ry: -70, lHipF: 62, lKnee: 72, rHipF: 30, rKnee: 64, rAnk: 0, spineX: -2, lShF: 162, lShA: 8, lEl: 10, headY: 60 }],
    [tBF, { air: 0, z: zR - 1.2, ry: -90, rHipF: 22, rKnee: 36, rAnk: 14, lHipF: 64, lKnee: 58, lHipA: 12, spineX: -6, spineZ: 10, chestY: -8, headY: 82, neckY: 10, lShF: 168, lShA: 6, lEl: 8 }],
    [tFF, { z: zR - 0.62, ry: -62, lHipF: 22, lKnee: 8, lHipA: 34, rHipF: -10, rKnee: 30, rAnk: 30, spineZ: 4, chestY: 0, hipsY: 10, headY: 62, lShF: 120, lShA: 20, lEl: 20 }],
    [tR, { z: zR - 0.45, ry: -12, hipsY: 30, chestY: 22, spineX: 30, spineZ: -10, lKnee: 12, rHipF: -24, rKnee: 42, rAnk: 40, headY: 12, neckY: 0, headX: 12, lShF: 40, lShA: 30, lEl: 80 }],
    [tR + 0.3, { z: zR + 0.35, x: x0 + 0.35, ry: 14, spineX: 44, chestY: 30, hipsY: 20, spineZ: -4, lHipF: 30, lKnee: 40, lHipA: 12, rHipF: 62, rKnee: 82, rAnk: 10, headY: 0, headX: 0, lShF: 20, lEl: 40 }],
    [tR + 0.9, { z: zR + 2.0, x: x0 + 1.3, ry: 28, spineX: 16, chestX: 4, chestY: 0, hipsY: 0, spineZ: 0, lHipF: 14, lKnee: 18, rHipF: 14, rKnee: 18, lHipA: 6, rHipA: 6, headY: -20, headX: -6 }],
    [dur, { z: zR + 2.6, x: x0 + 1.6, ry: 12, spineX: 6, lKnee: 8, rKnee: 8, lHipF: 4, rHipF: 4, headY: -12 }]
  ]);
  const phi = numTrack(fast ? [[tBF - 0.14, 235], [tBF, 205], [tFF, 172], [tR - 0.04, 108], [tR, 92], [tR + 0.12, 15], [tR + 0.3, -55], [tR + 0.6, -72], [dur, -72]]
    : [[tBF - 0.14, 228], [tBF, 205], [tFF, 168], [tR - 0.06, 118], [tR, 102], [tR + 0.16, 28], [tR + 0.36, -50], [tR + 0.7, -70], [dur, -70]]);
  const ikW = numTrack([[tBF - 0.16, 0], [tBF - 0.02, 1], [tR + 0.55, 1], [tR + 1.0, 0]]);
  return { body, phi, ikW, tB, tBF, tFF, tR, dur, z0, fast, run: [0.05, tB - 0.08, fast ? 0.5 : 0.62, fast ? 0.95 : 0.6] };
}
function applyBowl(e, P, t, extraPose) {
  const q = P.body(t); const [r0, r1, per, k] = P.run;
  if (t > r0 && t < r1) addPose(q, gait((t - r0) / per, k, false), runW(t, r0, r1, 0.15));
  if (extraPose) addPose(q, extraPose, 1);
  e.pose(q);
  const w = P.ikW(t);
  if (w > 0) {
    const S = e.bonePos(e.side('r') + 'UpperArm'), f = P.phi(t) * D2R, R = 0.66 * e.s, across = smooth(clamp(-P.phi(t) / 70, 0, 1));
    const T = S.clone().add(V(0, Math.sin(f) * R, Math.cos(f) * R)).add(e.dir([0.32 * across, 0, 0.12 * across]));
    e.reach('r', T, [-1.0, 1.4, -0.2], { weight: w });
  }
  return e.handPos('r');
}

/* batting move: main athlete bats; a generic bowler delivers from the far end, a keeper crouches behind the stumps */
function crBat(a, kind) {
  const P = batPlan(kind), tc = P.tc, dur = P.dur, B0 = bowlPlan('fast');
  const fl1 = kind === 'heli' ? 0.5 : 0.46, fl2 = kind === 'heli' ? 0.05 : 0.16, tRel = tc - fl1 - fl2, shift = B0.tR - tRel;
  const pitch = { cover: [0.32, -4.3], high: [0.3, -4.1], straight: [0.06, -4.4], lofted: [0.0, -4.0], heli: [0.02, -1.55] }[kind];
  const v0 = { cover: [24, 1.2], high: [24, 1.2], straight: [25, 1.0], lofted: [27, 15], heli: [26, 17] }[kind];
  let bat = null, bowler = null, keeper = null, R0 = null, Pp = null, C = null, vOut = null;
  return {
    venue: 'cricketGround', dur, hold: 0.7, payoff: tc + 0.5, mirror: a.handedness === 'left',
    start(env) {
      batterGear(env); bat = env.addProp(makeCricketBat()); stumpsProp(env);
      bowler = ghost(env, 'cricket', { tag: 'bowler' }); bowler.rig.setHeadwear(null);
      applyBowl(bowler, B0, B0.tR); R0 = bowler.handPos('r').clone();
      env.pose(P.body(tc)); const Bt = placeBat(env, bat, P, tc); C = sweetSpot(Bt, env.s); C.y = Math.max(C.y, CB_R + 0.02);
      Pp = env.W(pitch[0], CB_R, pitch[1]);
      const h = env.dir(ldir(P.psi)).setY(0).normalize(); vOut = h.multiplyScalar(v0[0]).add(V(0, v0[1], 0));
      keeper = keeperGhost(env, 1.7, tc - 0.05);
    },
    frame(t, env) {
      env.pose(P.body(t)); placeBat(env, bat, P, t);
      const bt = clamp(t + shift, 0, B0.dur); const hand = applyBowl(bowler, B0, bt);
      const B = env.props.ball;
      if (t < tRel) B.position.copy(hand);
      else if (t < tRel + fl1) arc(R0, Pp, kind === 'heli' ? 0.25 : 0.3, (t - tRel) / fl1, B.position);
      else if (t < tc) arc(Pp, C, 0.03, (t - tRel - fl1) / fl2, B.position);
      else proj(B.position, C, vOut, t - tc, CB_R, 0.35, 0.75);
      B.rotation.set(t * 30, 0, 0);
      keeper(t);
      const r = rootPos(env), fol = smooth(span(t, tc, tc + 1.2)) * (kind === 'lofted' || kind === 'heli' ? 0.15 : 0.1);
      return { focus: V(r.x + (C.x - r.x) * 0.3 + vOut.x * fol * 0.12, 1.0, r.z + (C.z - r.z) * 0.3 + vOut.z * fol * 0.12), radius: 4.9 * Math.max(1, env.s) };
    }
  };
}
/* bowling move: main athlete bowls; a generic batter is beaten and the stumps are hit */
function crBowl(a, kind) {
  const B0 = bowlPlan(kind === 'spin' ? 'spin' : 'fast'), tR = B0.tR, dur = B0.dur;
  const spin = kind === 'spin', fl1 = spin ? 0.88 : 0.42, fl2 = spin ? 0.17 : 0.14, tHit = tR + fl1 + fl2;
  const P = batPlan('defend', tHit - 0.06);
  const which = spin ? 2 : 1;
  let R0 = null, Pp = null, T = null, bat = null, bt = null, st = null, keeper = null, vOut = null;
  return {
    venue: 'cricketGround', dur: Math.max(dur, tHit + 2.0), hold: 0.7, payoff: tHit, mirror: a.handedness === 'left' && a.id !== 'ben-stokes', view: (a.handedness === 'left' && a.id !== 'ben-stokes') ? -50 : 50,
    start(env) {
      applyBowl(env, B0, tR); R0 = env.handPos('r').clone();
      Pp = spin ? env.W(-0.34, CB_R, -2.3) : env.W(0.03, CB_R, -5.7); T = env.W(spin ? 0.1 : 0.0, spin ? 0.6 : 0.48, -0.02);
      vOut = V(0, 0.6, 5);
      st = stumpsProp(env);
      bt = ghost(env, 'cricket', { tag: 'batter' }); batterGear(bt); bat = env.addProp(makeCricketBat());
      keeper = spin ? keeperGhost(env, 0.8, tHit + 0.05) : null;
    },
    frame(t, env) {
      const celebrate = smooth(span(t, tHit + 0.25, tHit + 0.7));
      const hand = applyBowl(env, B0, t, celebrate > 0 ? { lShF: 165, lShA: 25, lEl: 15, rShF: 165, rShA: 25, rEl: 15, headX: -14 } : null);
      if (celebrate > 0) { env.reach('r', env.ws([-0.35, 2.15, 0.15]), [-1, 1.5, 0], { weight: celebrate }); env.reach('l', env.ws([0.35, 2.15, 0.15]), [1, 1.5, 0], { weight: celebrate }); }
      bt.pose(P.body(t)); placeBat(bt, bat, P, t);
      const B = env.props.ball;
      if (t < tR) B.position.copy(hand);
      else if (t < tR + fl1) { const u = (t - tR) / fl1; arc(R0, Pp, spin ? 0.75 : 0.25, u, B.position); if (spin) B.position.x += (env.mirror ? 1 : -1) * 0.18 * Math.sin(Math.PI * u) * u; }
      else if (t < tHit) arc(Pp, T, 0.05, (t - tR - fl1) / fl2, B.position);
      else proj(B.position, T, vOut, t - tHit, CB_R, 0.3, 0.6);
      B.rotation.set(spin ? t * 6 : t * 25, spin ? t * 40 : 0, 0);
      knockStumps(st, which, t - tHit, env);
      if (keeper) keeper(t);
      const r = rootPos(env), me = V(r.x, 1.1, r.z), wk = V(0, 0.8, -0.6);
      const u = clamp((t - tR) / (tHit - tR), 0, 1), k1 = smooth(span(t, tR - 0.05, tR + 0.25)), k2 = smooth(span(t, tHit + 0.75, tHit + 1.45));
      const ballF = me.clone().lerp(wk, smooth(u)), f = me.clone().lerp(ballF, k1).lerp(me, k2);
      return { focus: f, radius: (5.4 + 0.9 * k1 * (1 - k2) + 1.2 * k2) * Math.max(1, env.s), fixedY: true, mood: t > tHit ? { joy: Math.min(1, (t - tHit) / 0.3) } : undefined };
    }
  };
}


/* ================================================================== SOFTBALL (home plate at the origin, pitcher's plate at z = -13.11) */
const SB_R = 0.0485;
function makeSoftBat() {
  const prof = [[0, 0], [0.026, 0.0], [0.027, 0.012], [0.015, 0.03], [0.0125, 0.24], [0.016, 0.38], [0.026, 0.5], [0.0285, 0.58], [0.0285, 0.82], [0.02, 0.835], [0, 0.838]];
  const g = new THREE.Group(), m = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20), M('#3a4048', { roughness: 0.3, metalness: 0.6 }));
  g.add(m); add(g, new THREE.CylinderGeometry(0.0145, 0.0135, 0.22, 14), M('#d8342b', { roughness: 0.8 }), [0, 0.14, 0]);
  add(g, new THREE.CylinderGeometry(0.0287, 0.0287, 0.07, 18, 1, true), M('#f1c232', { roughness: 0.4, metalness: 0.3 }), [0, 0.53, 0]);
  return g;
}
function attachMitt(e, glove, scale = 1.1) { const hand = e.rig.bones[e.side('l') + 'Hand']; glove.position.set(0, -0.02, 0.03); glove.rotation.set(0, 0, 0); glove.scale.setScalar(e.s * scale); e.addProp(glove, hand); return glove; }
/* ----- windmill pitch plan: rock back, stride, a full 360° arm circle (IK around the shoulder), release at the hip */
function windmillPlan(o = {}) {
  const t0 = 0.75, tTop = 1.12, tR = 1.46, dur = tR + 2.0, z0 = SB.RUBBER + 0.05, st = o.stride || 1.25;
  const body = poseTrack([
    [0, { x: 0, z: z0, ry: 0, lHipA: 8, rHipA: 8, lHipF: 4, rHipF: 14, lKnee: 10, rKnee: 18, spineX: 10, headX: -6, lShF: 40, lEl: 95, rShF: 40, rEl: 95, lShA: 10, rShA: 10 }],
    [t0 - 0.3, { spineX: 4, rKnee: 10, lHipF: -8, lKnee: 14 }],
    [t0, { spineX: 18, rKnee: 34, rHipF: 30, lHipF: 30, lKnee: 40 }],
    [tTop, { z: z0 + 0.35, ry: -62, lHipF: 62, lKnee: 64, lHipA: 18, rHipF: 20, rKnee: 30, spineX: 4, spineZ: 6, chestY: -6, headY: 62, neckY: 10, lShF: 90, lShA: 70, lEl: 10 }],
    [tR - 0.08, { z: z0 + st * 0.75, ry: -58, lHipF: 34, lKnee: 18, lHipA: 30, rHipF: -14, rKnee: 26, rAnk: 26, spineX: 2, headY: 58 }],
    [tR, { z: z0 + st * 0.82, ry: -24, hipsY: 14, chestY: 10, spineX: 12, lKnee: 22, rHipF: -20, rKnee: 30, rAnk: 36, headY: 22, lShF: 30, lShA: 30, lEl: 60 }],
    [tR + 0.3, { z: z0 + st, ry: -4, hipsY: 6, chestY: 6, spineX: 22, lHipF: 40, lKnee: 44, lHipA: 14, rHipF: 34, rKnee: 56, rAnk: 10, headY: 4, headX: -4 }],
    [tR + 0.8, { spineX: 18, lHipF: 34, rHipF: 34, lKnee: 40, rKnee: 40, lHipA: 14, rHipA: 14, rAnk: 6, hipsY: 0, chestY: 0, lShF: 60, lEl: 80, rShF: 30, rEl: 60, headX: -6 }],
    [dur, { spineX: 10, lKnee: 20, rKnee: 20, lHipF: 14, rHipF: 14 }]
  ]);
  const phi = numTrack([[t0 - 0.05, -80], [t0 + 0.15, -20], [t0 + 0.25, 30], [tTop, 92], [tTop + 0.14, 182], [tR - 0.08, 248], [tR, 276], [tR + 0.1, 330], [tR + 0.25, 380]]);
  const ikW = numTrack([[t0 - 0.12, 0], [t0 + 0.02, 1], [tR + 0.12, 1], [tR + 0.35, 0]]);
  return { body, phi, ikW, t0, tR, dur };
}
function applyWindmill(e, P, t, glove) {
  e.pose(P.body(t));
  const w = P.ikW(t);
  if (w > 0) {
    const S = e.bonePos(e.side('r') + 'UpperArm'), f = P.phi(t) * D2R, R = 0.66 * e.s, brush = Math.exp(-Math.pow((P.phi(t) - 276) / 40, 2));
    const T = S.clone().add(V(0, Math.sin(f) * R, Math.cos(f) * R)).add(e.dir([0.08 * brush, 0, 0]));
    e.reach('r', T, [-1.2, 1.0, 0], { weight: w });
  }
  if (t < P.t0 + 0.05) { const gl = e.ws([0.02, 1.08, 0.3]); e.reach('l', gl, [0.9, 0.8, -0.2], { weight: 1 - smooth(span(t, P.t0 - 0.05, P.t0 + 0.05)) }); e.reach('r', gl.clone().add(e.dir([-0.06, 0, 0.04])), [-0.9, 0.8, -0.2], { weight: 1 - smooth(span(t, P.t0 - 0.12, P.t0 + 0.02)) }); }
  return e.handPos('r');
}
/* pitched ball with late movement (rise > 0 lifts, < 0 drops) */
function sbPitchPath(out, R0, T, u, rise) { out.lerpVectors(R0, T, u); out.y += 0.55 * u * (1 - u) + rise * (u * u * u - 0.25 * u); return out; }
/* ----- softball swing plan (adapted from the baseball batting swing) */
const SB_STANCE = { lHipA: 15, rHipA: 15, lHipF: 22, rHipF: 22, lKnee: 24, rKnee: 26, lAnk: 6, rAnk: 6, spineX: 18, chestX: 6, headY: 72, neckY: 12, headX: -6, hipsY: -4 };
function swingPlan(o = {}) {
  const tc = o.tc || 2.0, dur = tc + 2.1, x0 = -0.82, z0 = -0.1, wide = o.wide ? 8 : 0, k = o.compact ? [14, 18] : [28, 34], miss = !!o.miss;
  const body = poseTrack([
    [0, Object.assign({ x: x0, z: z0, ry: 90 }, SB_STANCE, { lHipA: 15 + wide, rHipA: 15 + wide })],
    [tc - 0.9, {}],
    [tc - 0.55, { hipsY: -14, chestY: -8, rKnee: 30 }],
    [tc - 0.33, { lHipF: k[0], lKnee: k[1], lHipA: 6, lAnk: 25, rKnee: 30, hipsY: -18, chestY: -10, spineX: 16 }],
    [tc - 0.12, { lHipF: 14, lKnee: 14, lHipA: 22 + wide, lAnk: 0, hipsY: -12, chestY: -12, rKnee: 30 }],
    [tc, { hipsY: 52, chestY: 14, spineX: 18, spineZ: 10, rHipR: 30, rKnee: 36, rAnk: 26, lKnee: 8, headY: 42, neckY: 8, headX: 4 }],
    [tc + 0.12, { hipsY: 72, chestY: 26, spineZ: 6, headY: 30 }],
    [tc + 0.35, { hipsY: 84, chestY: 30, spineX: 10, spineZ: 4, rHipR: 40, rKnee: 40, rAnk: 34, headY: miss ? 50 : 26, headX: miss ? 6 : -12 }],
    [tc + 1.1, { hipsY: 80, chestY: 24, spineX: 8, headY: miss ? 60 : 22, headX: miss ? 10 : -16 }],
    [dur, { hipsY: 60, chestY: 10, spineX: 6, lHipA: 10, rHipA: 10, lKnee: 10, rKnee: 12, rAnk: 4, rHipR: 10, headY: miss ? 40 : 30 }]
  ]);
  const knob = vecTrack([[0, [-0.18, 1.32, 0.12]], [tc - 0.6, [-0.2, 1.34, 0.1]], [tc - 0.35, [-0.27, 1.36, 0.06]], [tc - 0.17, [-0.14, 1.14, 0.2]], [tc - 0.06, [0.05, 1.0, 0.34]], [tc, [0.26, 0.95, 0.38]], [tc + 0.08, [0.42, 1.02, 0.28]], [tc + 0.3, [0.2, 1.46, -0.12]], [tc + 1.0, [0.18, 1.4, -0.08]], [dur, [0.1, 1.0, 0.25]]]);
  const yaw = numTrack([[0, 200], [tc - 0.35, 206], [tc - 0.17, 186], [tc - 0.06, 136], [tc, 92], [tc + 0.08, 30], [tc + 0.3, -78], [tc + 1.0, -72], [dur, -10]]);
  const pitch = numTrack([[0, 62], [tc - 0.35, 54], [tc - 0.17, 26], [tc - 0.06, 6], [tc, miss ? -12 : -6], [tc + 0.08, 4], [tc + 0.3, 40], [tc + 1.0, 36], [dur, -40]]);
  return { body, knob, yaw, pitch, tc, dur };
}
function placeSoftBat(e, bat, P, t) {
  const wag = t < P.tc - 0.6 ? Math.sin(t * 5.5) : 0, yw = P.yaw(t) + wag * 8, pt = P.pitch(t) + wag * 5;
  const K = e.ws(P.knob(t)), D = e.dir(ldir(yw, pt)).normalize();
  bat.scale.setScalar(1); bat.position.copy(K); bat.quaternion.setFromUnitVectors(UP, D); bat.updateMatrixWorld(true);
  e.reach('l', K.clone().addScaledVector(D, 0.07), [0.75, 0.7, 0.35], { weight: 1 });
  e.reach('r', K.clone().addScaledVector(D, 0.16), [-0.55, 0.55, -0.35], { weight: 1 });
  return { K, D };
}
function catcherGhost(env, tCatch) {
  const c = ghost(env, 'softball', { tag: 'catcher', uni: rivalUni(env), head: 'helmet' });
  attachMitt(c, makeGlove('#6b3f1d', true), 1.0);
  const tr = poseTrack([[0, { x: 0, z: 0.95, ry: 180, lHipA: 30, rHipA: 30, lHipF: 105, rHipF: 105, lKnee: 135, rKnee: 135, lAnk: 25, rAnk: 25, lHipR: -20, rHipR: -20, spineX: 20, headX: -8 }], [tCatch + 0.3, {}],
    [tCatch + 0.9, { lHipF: 40, rHipF: 40, lKnee: 50, rKnee: 50, spineX: 12, lHipR: 0, rHipR: 0 }], [tCatch + 3, {}]]);
  return (t, ballP) => { c.pose(tr(t)); const mitt = c.ws([0.05, 0.85, 0.45]); if (ballP && t > tCatch - 0.4 && t < tCatch + 0.6) mitt.lerp(ballP.clone().add(c.dir([0, 0, -0.05])), smooth(span(t, tCatch - 0.4, tCatch - 0.1)) * (1 - smooth(span(t, tCatch + 0.2, tCatch + 0.6)))); c.reach('l', mitt, [0.9, 0.6, 0.0]); c.reach('r', c.ws([-0.25, 0.7, 0.25]), [-0.9, 0.5, -0.2]); return mitt; };
}
/* windmill pitch move (main athlete pitches; generic batter swings through a rise ball / chases a drop; catcher receives) */
function sbPitch(a, o = {}) {
  const P = windmillPlan(o), tR = P.tR, fl = o.flight || 0.44, tCatch = tR + fl, dur = Math.max(P.dur, tCatch + 2.2);
  const S = swingPlan({ tc: tCatch - 0.03, miss: true, compact: true });
  const T = V(0, o.rise > 0 ? 0.95 : o.rise < 0 ? 0.42 : 0.72, 0.42);
  let R0 = null, bat = null, bt = null, catcher = null, M1 = null;
  return {
    venue: 'softballDiamond', dur, hold: 0.6, payoff: tCatch + 0.05, mirror: a.handedness === 'left', view: a.handedness === 'left' ? -60 : 60,
    start(env) {
      env.rig.setHeadwear('visor'); attachMitt(env, env.props.glove, 1.15);
      applyWindmill(env, P, tR); R0 = env.handPos('r').clone();
      bt = ghost(env, 'softball', { tag: 'batter', head: 'helmet' }); bat = env.addProp(makeSoftBat()); bt.rig.setHeadwear('helmet', env.mirror ? 'L' : 'R');
      catcher = catcherGhost(env, tCatch); M1 = V();
    },
    frame(t, env) {
      const hand = applyWindmill(env, P, t);
      bt.pose(S.body(t)); placeSoftBat(bt, bat, S, t);
      const B = env.props.ball;
      if (t < tR) B.position.copy(t < P.t0 + 0.1 ? env.ws([0.0, 1.06, 0.36]) : hand);
      else if (t < tCatch) sbPitchPath(B.position, R0, T, (t - tR) / fl, (o.rise || 0) * 0.35);
      const mitt = catcher(t, t >= tR && t < tCatch ? B.position : T.clone());
      if (t >= tCatch) B.position.copy(mitt).add(V(0, 0.03, -0.05));
      B.rotation.set(t * 30, 0, 0);
      const r = rootPos(env), me = V(r.x, 1.1, r.z), hp = V(0, 1.0, -0.2), u = clamp((t - tR) / fl, 0, 1);
      const k1 = smooth(span(t, tR - 0.05, tR + 0.2)), k2 = smooth(span(t, tCatch + 0.8, tCatch + 1.5));
      const f = me.clone().lerp(me.clone().lerp(hp, smooth(u)), k1).lerp(me, k2);
      return { focus: f, radius: (5.0 + 0.8 * k1 * (1 - k2) + 0.6 * k2) * Math.max(1, env.s), fixedY: true, mood: t > tCatch ? { joy: Math.min(1, (t - tCatch) / 0.3) } : undefined };
    }
  };
}
/* power swing (main athlete bats; a generic pitcher delivers underhand) */
function sbSwing(a, o = {}) {
  const S = swingPlan(o), tc = S.tc, dur = S.dur, W = windmillPlan(), fl = 0.42, tRel = tc - fl, shift = W.tR - tRel;
  let bat = null, pit = null, R0 = null, C = null, vOut = null;
  return {
    venue: 'softballDiamond', dur, hold: 0.5, payoff: tc + 0.4, mirror: a.handedness === 'left',
    start(env) {
      env.rig.setHeadwear('helmet', env.mirror ? 'R' : 'L'); bat = env.addProp(makeSoftBat());
      pit = ghost(env, 'softball', { tag: 'pitcher', head: 'visor' }); attachMitt(pit, makeGlove('#8b5a2b'), 1.15);
      applyWindmill(pit, W, W.tR); R0 = pit.handPos('r').clone();
      env.pose(S.body(tc)); const b = placeSoftBat(env, bat, S, tc); C = b.K.clone().addScaledVector(b.D, 0.66);
      const ang = o.pull === false ? 6 : 18, la = o.launch || 30, v = 44, dirY = env.mirror ? 1 : -1;
      vOut = V(Math.sin(ang * D2R) * dirY * Math.cos(la * D2R) * v, Math.sin(la * D2R) * v, -Math.cos(ang * D2R) * Math.cos(la * D2R) * v);
    },
    frame(t, env) {
      env.pose(S.body(t)); placeSoftBat(env, bat, S, t);
      const hand = applyWindmill(pit, W, clamp(t + shift, 0, W.dur));
      const B = env.props.ball;
      if (t < tRel) B.position.copy(hand);
      else if (t < tc) sbPitchPath(B.position, R0, C, (t - tRel) / fl, 0.08);
      else proj(B.position, C, vOut, t - tc, SB_R, 0.4, 0.7);
      B.rotation.set(t * 30, 0, 0);
      const r = rootPos(env);
      return { focus: V(r.x * 0.9, 1.15 * env.s, r.z * 0.9 - 0.2), radius: 4.8 * Math.max(1, env.s) };
    }
  };
}


/* ================================================================== CATALOGUE
   Signatures follow catalogue notes / traits / handedness: back-court sharpshooters jump-shoot over the block, playmakers
   feint and break through, Omeyer (goalkeeper) star-jump save; Ovechkin one-timer, Gretzky behind the net, Crosby backhand,
   McDavid at speed, Datsyuk / Lemieux / Jagr dekes (Jagr: puck protection), Hasek sprawling save (catches left); water-polo
   shooters lift and fire (Azevedo long range), Steffens / Varga skip shots, Villa (playmaker) counter pass, Kasas (defender)
   block; Tendulkar straight drive, cover drives, Lara high back-lift (left), Dhoni helicopter, Warne leg spin, Perry fast
   bowling, Stokes left-handed lofted drive; Finch rise ball, Osterman drop ball (left), Abbott velocity (left). */
const HB_SHOT = {
  'nikola-karabatic': { x: -1.6, z: 9.6, air: 0.7, tgt: [1.15, 1.7] },
  'mikkel-hansen': { x: 4.2, z: 9.2, air: 0.74, tgt: [-1.2, 1.72], dx: -0.4 },
  'cristina-neagu': { x: -4.2, z: 9.0, air: 0.6, tgt: [1.2, 1.62] },
  'domagoj-duvnjak': { x: -0.6, z: 9.4, air: 0.66, tgt: [-1.2, 1.75] },
  'bojana-popovic': { x: -3.8, z: 9.3, air: 0.6, tgt: [1.25, 0.4] }
};
const HB_PLAY = {
  'ivano-balic': { style: 'bounce', tgt: [1.05, 0.4] }, 'stine-oftedal': { tempo: 0.85, tgt: [1.15, 0.35] },
  'andrea-lekic': { tgt: [1.15, 1.65] }, 'talant-dujshebaev': { style: 'hip', tgt: [1.1, 0.5] }
};
const IH = {
  'hayley-wickenheiser': { tgt: [-0.66, 1.0] }, 'marie-philip-poulin': { tgt: [-0.6, 0.95] },
  'connor-mcdavid': { fast: true, at: [-1.4, 8.2] }, 'sidney-crosby': { back: true, at: [-1.2, 6.6] },
  'pavel-datsyuk': { style: 'fb' }, 'mario-lemieux': { style: 'reach' }, 'jaromir-jagr': { style: 'protect' }
};
const WP = {
  'manuel-estiarte': { x: -1.6, z: 5.6, tgt: [1.2, 0.72] }, 'tony-azevedo': { x: -0.8, z: 8.2, tgt: [-1.2, 0.74], lift: 0.04 },
  'filip-filipovic': { x: -1.4, z: 7.0, tgt: [1.25, 0.78], lift: 0.08 }, 'pietro-figlioli': { x: -2.0, z: 6.5, tgt: [1.1, 0.4] },
  'maggie-steffens': { skip: true, x: -1.0, z: 5.5, tgt: [1.0, 0.35] }, 'denes-varga': { skip: true, x: -2.2, z: 6.0, tgt: [1.05, 0.3] }
};
const SBP = {
  'jennie-finch': { rise: 1, stride: 1.35 }, 'cat-osterman': { rise: -1, stride: 1.35 }, 'monica-abbott': { rise: 0, flight: 0.38, stride: 1.4 },
  'yukiko-ueno': { rise: 0, flight: 0.4 }, 'lisa-fernandez': { rise: 0.6 }
};
const SBB = { 'crystl-bustos': { wide: true, launch: 32 }, 'eri-yamada': { launch: 28 }, 'dot-richardson': { compact: true, launch: 27, pull: false } };
export const MOVES = {
  hb_jumpShot: a => hbJumpShot(a, HB_SHOT[a.id] || { x: -2.2, z: 9.4, air: 0.62 }),
  hb_breakthrough: a => hbBreakthrough(a, HB_PLAY[a.id] || {}),
  hb_wingDive: a => hbWingDive(a),
  hb_starSave: a => hbStarSave(a),
  ih_oneTimer: a => ihOneTimer(a),
  ih_wristShot: a => ihWrist(a, IH[a.id] && !IH[a.id].back ? IH[a.id] : {}),
  ih_backhand: a => ihWrist(a, Object.assign({ back: true, at: [-1.2, 6.6] }, a.id === 'sidney-crosby' ? IH[a.id] : {})),
  ih_behindNet: a => ihWrap(a),
  ih_deke: a => ihDeke(a, IH[a.id] && IH[a.id].style ? IH[a.id] : { style: 'fb' }),
  ih_flopSave: a => ihFlop(a),
  wp_powerShot: a => wpShot(a, WP[a.id] && !WP[a.id].skip ? WP[a.id] : {}),
  wp_skipShot: a => wpShot(a, Object.assign({}, WP[a.id] && WP[a.id].skip ? WP[a.id] : { x: -1.0, z: 5.6 }, { skip: true })),
  wp_counterPass: a => wpCounter(a),
  wp_block: a => wpBlock(a),
  cr_coverDrive: a => crBat(a, 'cover'),
  cr_straightDrive: a => crBat(a, 'straight'),
  cr_highBackliftDrive: a => crBat(a, 'high'),
  cr_loftedDrive: a => crBat(a, 'lofted'),
  cr_helicopter: a => crBat(a, 'heli'),
  cr_legSpin: a => crBowl(a, 'spin'),
  cr_fastBowl: a => crBowl(a, 'fast'),
  sb_windmill: a => sbPitch(a, SBP[a.id] || {}),
  sb_powerSwing: a => sbSwing(a, SBB[a.id] || {})
};
export const SIGNATURE = {
  'nikola-karabatic': 'hb_jumpShot', 'mikkel-hansen': 'hb_jumpShot', 'cristina-neagu': 'hb_jumpShot', 'domagoj-duvnjak': 'hb_jumpShot', 'bojana-popovic': 'hb_jumpShot',
  'alexander-ovechkin': 'ih_oneTimer', 'wayne-gretzky': 'ih_behindNet', 'sidney-crosby': 'ih_backhand', 'connor-mcdavid': 'ih_wristShot', 'hayley-wickenheiser': 'ih_wristShot',
  'marie-philip-poulin': 'ih_wristShot', 'pavel-datsyuk': 'ih_deke', 'mario-lemieux': 'ih_deke', 'jaromir-jagr': 'ih_deke', 'dominik-hasek': 'ih_flopSave',
  'manuel-estiarte': 'wp_powerShot', 'tony-azevedo': 'wp_powerShot', 'filip-filipovic': 'wp_powerShot', 'pietro-figlioli': 'wp_powerShot',
  'maggie-steffens': 'wp_skipShot', 'denes-varga': 'wp_skipShot', 'brenda-villa': 'wp_counterPass', 'tamas-kasas': 'wp_block',
  'sachin-tendulkar': 'cr_straightDrive', 'virat-kohli': 'cr_coverDrive', 'don-bradman': 'cr_coverDrive', 'babar-azam': 'cr_coverDrive', 'jacques-kallis': 'cr_coverDrive',
  'brian-lara': 'cr_highBackliftDrive', 'ms-dhoni': 'cr_helicopter', 'shane-warne': 'cr_legSpin', 'ellyse-perry': 'cr_fastBowl', 'ben-stokes': 'cr_loftedDrive',
  'jennie-finch': 'sb_windmill', 'cat-osterman': 'sb_windmill', 'monica-abbott': 'sb_windmill', 'yukiko-ueno': 'sb_windmill', 'lisa-fernandez': 'sb_windmill',
  'crystl-bustos': 'sb_powerSwing', 'eri-yamada': 'sb_powerSwing', 'dot-richardson': 'sb_powerSwing',
  'ivano-balic': 'hb_breakthrough', 'stine-oftedal': 'hb_breakthrough', 'andrea-lekic': 'hb_breakthrough', 'talant-dujshebaev': 'hb_breakthrough', 'thierry-omeyer': 'hb_starSave'
};
const BY_SPORT = { handball: ['hb_jumpShot', 'hb_breakthrough', 'hb_wingDive', 'hb_starSave'], 'ice-hockey': ['ih_oneTimer', 'ih_wristShot', 'ih_backhand', 'ih_behindNet', 'ih_deke', 'ih_flopSave'],
  'water-polo': ['wp_powerShot', 'wp_skipShot', 'wp_counterPass', 'wp_block'],
  cricket: ['cr_coverDrive', 'cr_straightDrive', 'cr_highBackliftDrive', 'cr_loftedDrive', 'cr_helicopter', 'cr_legSpin', 'cr_fastBowl'],
  softball: ['sb_windmill', 'sb_powerSwing'] };
export function movesFor(a) {
  const all = BY_SPORT[a.sport] || [], sig = SIGNATURE[a.id] || all[0];
  return [sig].concat(all.filter(m => m !== sig));
}


