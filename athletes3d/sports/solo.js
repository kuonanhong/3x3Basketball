/* SmartAction Sports — 3D signature moves for the solo sports: sprint & jumps, archery, golf, bowling and billiards.
   Stylized animation of publicly known playing styles, built from catalogue data (notes / traits / handedness).
   Generic procedural venues and equipment: no team names, logos, sponsor marks or brand names. MIT. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { poseTrack, vecTrack, numTrack, arc, span, smooth, lerp, clamp } from '../motion.js';
import { aimBone, BASE_POSE } from '../rig.js';
import { canvasTex, add, rng, crowd } from '../scenes.js';

export const SPORTS = ['sprint', 'archery', 'golf', 'bowling', 'billiards'];

/* ================================================================== shared helpers */
const D2R = Math.PI / 180, PI = Math.PI;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UPY = V(0, 1, 0);
const MATS = new Map();
function M(color, o = {}) { const k = color + JSON.stringify(o); if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.02 }, o))); return MATS.get(k); }
const BASIC = new Map();
/* decals lying on a ground plane: pushed toward the camera in depth so they never fight with the surface below */
function OV(level, o) { return Object.assign({ polygonOffset: true, polygonOffsetFactor: -1 * level, polygonOffsetUnits: -4 * level }, o || {}); }
function MO(color, level, o = {}) { return M(color, OV(level, o)); }
function MB(color, o = {}) { const k = color + JSON.stringify(o); if (!BASIC.has(k)) BASIC.set(k, new THREE.MeshBasicMaterial(Object.assign({ color }, o))); return BASIC.get(k); }
const Plane = (w, h) => new THREE.PlaneGeometry(w, h), Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cyl = (r1, r2, h, seg = 12, open = false) => new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);
const FLAT = [-PI / 2, 0, 0];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion();

/* orient an object so that its local +Y follows yDir and its local +Z leans toward zHint (both world) */
function orient(obj, pos, yDir, zHint) {
  const y = yDir.clone().normalize(), z = zHint.clone().addScaledVector(y, -zHint.dot(y));
  if (z.lengthSq() < 1e-9) z.set(1, 0, 0).addScaledVector(y, -y.x);
  z.normalize(); const x = V().crossVectors(y, z);
  _m4.makeBasis(x, y, z); obj.quaternion.setFromRotationMatrix(_m4); if (pos) obj.position.copy(pos); return obj;
}
/* stretch a unit-height (Y) object between two world points */
function between(obj, a, b, hint) {
  const d = V().subVectors(b, a), L = Math.max(1e-5, d.length());
  orient(obj, V().addVectors(a, b).multiplyScalar(0.5), d, hint || (Math.abs(d.y / L) < 0.95 ? UPY : V(1, 0, 0))); obj.scale.y = L; return obj;
}
function mix(a, b, w) {
  if (w <= 0) return Object.assign({}, b, a); if (w >= 1) return Object.assign({}, a, b);
  const o = {}; for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) { const x = a[k] ?? b[k] ?? BASE_POSE[k] ?? 0, y = b[k] ?? a[k] ?? BASE_POSE[k] ?? 0; o[k] = x + (y - x) * w; } return o;
}
const full = p => Object.assign({}, BASE_POSE, p);
const put = (env, q) => env.pose(full(q));
/* periodic (wrap-around) Catmull-Rom table: rows [phase, v1, v2, ...] with phases ascending in [0,1) */
function cyc(table) {
  const n = table.length, m = table[0].length - 1;
  return p => {
    p = ((p % 1) + 1) % 1; let i = n - 1; for (let k = 0; k < n; k++) if (table[k][0] <= p) i = k;
    const at = j => table[((j % n) + n) % n], p1 = at(i)[0], p2raw = at(i + 1)[0], p2 = p2raw <= p1 ? p2raw + 1 : p2raw;
    const pp = p < p1 ? p + 1 : p, u = (pp - p1) / (p2 - p1), out = [];
    for (let j = 1; j <= m; j++) { const a = at(i - 1)[j], b = at(i)[j], c = at(i + 1)[j], d = at(i + 2)[j]; out.push(0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u)); }
    return out;
  };
}
/* sampled 1-D signal (precomputed, deterministic) */
function sampler(arr, dt) { return t => { const f = clamp(t / dt, 0, arr.length - 1.001), i = Math.floor(f), u = f - i; return arr[i] + (arr[i + 1] - arr[i]) * u; }; }

/* two-bone leg IK: put the ankle of the (authored) side at a world point, knee toward a world pole point,
   optionally set the foot's world orientation (quaternion); weight blends with the FK pose */
const _fk = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], _pq = new THREE.Quaternion();
function legIK(env, side, ankle, pole, footQ, weight = 1) {
  if (weight <= 0) return;
  const rig = env.rig, s = env.side(side), th = rig.bones[s + 'Thigh'], sn = rig.bones[s + 'Shin'], ft = rig.bones[s + 'Foot'];
  _fk[0].copy(th.quaternion); _fk[1].copy(sn.quaternion); _fk[2].copy(ft.quaternion);
  const a = rig.len.thigh, b = rig.len.shin, S = th.getWorldPosition(V());
  const d = V().subVectors(ankle, S); const dist = clamp(d.length(), Math.abs(a - b) + 1e-3, a + b - 1e-4); const dir = d.normalize();
  const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const pv = V().subVectors(pole, S); pv.addScaledVector(dir, -pv.dot(dir)); if (pv.lengthSq() < 1e-8) pv.set(0, 0, 1); pv.normalize();
  const knee = S.clone().addScaledVector(dir, a * cosA).addScaledVector(pv, a * sinA), tgt = S.clone().addScaledVector(dir, dist);
  aimBone(th, V().subVectors(knee, S), pv); th.updateMatrixWorld(true);
  aimBone(sn, V().subVectors(tgt, knee), pv); sn.updateMatrixWorld(true);
  if (footQ) { sn.getWorldQuaternion(_pq); ft.quaternion.copy(_pq.invert().multiply(footQ)); }
  if (weight < 1) { th.quaternion.slerpQuaternions(_fk[0], th.quaternion.clone(), weight); sn.quaternion.slerpQuaternions(_fk[1], sn.quaternion.clone(), weight); ft.quaternion.slerpQuaternions(_fk[2], ft.quaternion.clone(), weight); }
  th.updateMatrixWorld(true);
}
/* world quaternion of a foot: toe direction (world, horizontal), toe-down pitch in degrees */
function footQuat(toeDir, pitch = 0) {
  const f = toeDir.clone().setY(0).normalize(), c = Math.cos(pitch * D2R), s = Math.sin(pitch * D2R);
  const z = f.clone().multiplyScalar(c).add(V(0, -s, 0)), y = f.clone().multiplyScalar(s).add(V(0, c, 0)), x = V().crossVectors(y, z);
  _m4.makeBasis(x, y, z); return new THREE.Quaternion().setFromRotationMatrix(_m4);
}
/* world position the ankle must have so that the sole point `which` ('toe'|'heel'|'mid') lands on `p` with orientation q */
function ankleFor(env, side, p, q, which = 'mid') {
  const rig = env.rig, s = env.side(side), toe = rig['toe_' + s].position, heel = rig['heel_' + s].position;
  const off = which === 'toe' ? toe.clone() : which === 'heel' ? heel.clone() : toe.clone().add(heel).multiplyScalar(0.5);
  return p.clone().sub(off.applyQuaternion(q));
}
/* safety: never let a sole dip below the floor (raise the hips instead) */
function keepFeetUp(env, ground = 0) {
  const v = V(); let lo = Infinity; for (const o of [env.rig.heel_l, env.rig.toe_l, env.rig.heel_r, env.rig.toe_r]) { o.getWorldPosition(v); lo = Math.min(lo, v.y); }
  if (lo < ground) setHipsY(env, hipsY(env) + ground - lo);
}
function setHipsY(env, y) { env.rig.bones.hips.position.y = y; env.rig.root.updateMatrixWorld(true); }
const hipsY = env => env.rig.bones.hips.position.y;

function skyTex(top, mid, bottom) { return canvasTex(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, w, h); }); }
function grassTex(seed, c1, c2, bands, rep) {
  return canvasTex(512, 512, (x, w, h) => {
    for (let i = 0; i < bands; i++) { x.fillStyle = i % 2 ? c1 : c2; x.fillRect(0, i * h / bands, w, h / bands); }
    const r = rng(seed); for (let i = 0; i < 7000; i++) { x.fillStyle = `rgba(${20 + r() * 40},${70 + r() * 60},${20 + r() * 30},.22)`; x.fillRect(r() * w, r() * h, 1.5, 3); }
  }, rep);
}
function speckTex(base, seed, rep, alpha = 0.18, dark = '0,0,0', light = '255,255,255') {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h); const r = rng(seed);
    for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? dark : light},${r() * alpha})`; x.fillRect(r() * w, r() * h, 1.5, 1.5); }
  }, rep);
}
function standPlane(g, tex, pos, ry, w, h, tilt = 0.6, rep = 4) {
  const grp = new THREE.Group(); grp.position.set(...pos); grp.rotation.y = ry; g.add(grp);
  const t = tex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1);
  const m = add(grp, Plane(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: '#d4d8dc' }), [0, 0, 0], [-tilt, 0, 0], false); m.receiveShadow = false;
  return grp;
}

/* ================================================================== venues */
/* ---- athletics stadium: home straight along +Z (start line z = 0, finish line z = 100), 9 lanes of 1.22 m, infield (+X) with a long-jump runway */
const TRACK = { lane: 1.22, finish: 100, lj: { x: 14, board: 70, pit0: 71, pit1: 80.5 } };
function buildTrack(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = skyTex('#4d8fd2', '#9ccaeb', '#e4eef1'); scene.fog = new THREE.Fog('#d7e6ee', 150, 430);
  add(g, Plane(700, 700), new THREE.MeshStandardMaterial({ map: grassTex(21, '#3f8c3c', '#47984a', 12, [60, 60]), roughness: 0.95 }), [40, -0.02, 50], FLAT, false);
  const red = new THREE.MeshStandardMaterial(OV(1, { map: speckTex('#b4462f', 4, [6, 80], 0.22), roughness: 0.92 }));
  add(g, Plane(12.6, 190), red, [-0.1, 0.002, 45], FLAT, false);                                   // lanes + small aprons
  add(g, Plane(4, 190), MO('#8f9aa1', 1, { roughness: 0.95 }), [-8.4, 0.001, 45], FLAT, false);          // outside concrete apron
  const white = MO('#f4f4ef', 2, { roughness: 0.7 });
  for (let k = 0; k <= 9; k++) add(g, Plane(0.05, 190), white, [-5.49 + 1.22 * k, 0.006, 45], FLAT, false);
  add(g, Plane(10.98, 0.05), white, [0, 0.007, 0], FLAT, false);
  add(g, Plane(10.98, 0.05), white, [0, 0.007, TRACK.finish], FLAT, false);
  add(g, Box(0.06, 0.05, 190), M('#e9ece8'), [5.62, 0.025, 45]);                                   // infield kerb
  const nums = canvasTex(1024, 96, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#f7f7f2'; x.font = '900 64px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; for (let i = 0; i < 9; i++) x.fillText(String(i + 1), (i + 0.5) * w / 9, h / 2 + 2); });
  for (const z of [TRACK.finish + 0.9, -1.4]) add(g, Plane(10.98, 1.0), new THREE.MeshStandardMaterial(OV(3, { map: nums, transparent: true, roughness: 0.7, depthWrite: false })), [0, 0.008, z], [-PI / 2, 0, PI], false);
  // outside wall, grandstand and roof (main stand on the runners' right)
  add(g, Box(0.4, 1.2, 190), M('#2d4f6e'), [-10.6, 0.6, 45]);
  const stands = crowd(2048, 448, 9, '#26313a');
  standPlane(g, stands, [-19, 8.5, 45], PI / 2, 190, 20, 0.62, 5);
  add(g, Box(16, 0.4, 190), M('#3a4148'), [-21, 18.5, 45], null, false);
  standPlane(g, stands, [96, 9, 45], -PI / 2, 230, 22, 0.55, 6);                                   // far side across the infield
  standPlane(g, stands, [20, 9, -82], 0, 170, 22, 0.55, 4);
  standPlane(g, stands, [20, 9, 176], PI, 170, 22, 0.55, 4);
  // finish posts with photo-finish camera
  for (const x of [6.3, -6.3]) { add(g, Cyl(0.05, 0.05, 2.6, 8), M('#e6e6e0'), [x, 1.3, TRACK.finish]); add(g, Box(0.28, 0.2, 0.36), M('#22272c'), [x, 2.7, TRACK.finish]); }
  // long jump: runway, take-off board, sand pit
  const L = TRACK.lj;
  add(g, Plane(1.22, 48), new THREE.MeshStandardMaterial(OV(1, { map: speckTex('#a5462f', 6, [1, 30], 0.2), roughness: 0.92 })), [L.x, 0.004, L.board - 24], FLAT, false);
  for (const sx of [-0.63, 0.63]) add(g, Plane(0.05, 48), white, [L.x + sx, 0.006, L.board - 24], FLAT, false);
  add(g, Box(1.22, 0.012, 0.2), M('#fbfbf6'), [L.x, 0.006, L.board + 0.1]);
  add(g, Box(1.22, 0.014, 0.1), M('#cfd4d6'), [L.x, 0.007, L.board + 0.25]);
  const sand = new THREE.MeshStandardMaterial({ map: speckTex('#d9c08a', 8, [3, 9], 0.3, '90,60,20'), roughness: 1 });
  add(g, Box(2.75, 0.03, L.pit1 - L.pit0), sand, [L.x, -0.012, (L.pit0 + L.pit1) / 2], null, false);
  const edge = M('#c9cdc9', { roughness: 0.9 });
  for (const sx of [-1, 1]) add(g, Box(0.12, 0.05, L.pit1 - L.pit0 + 0.24), edge, [L.x + sx * 1.435, 0.005, (L.pit0 + L.pit1) / 2], null, false);
  for (const z of [L.pit0 - 0.06, L.pit1 + 0.06]) add(g, Box(2.99, 0.05, 0.12), edge, [L.x, 0.005, z], null, false);
  return { group: g };
}

/* ================================================================== SPRINT */
/* running gait; phase 0 = left foot touchdown. Rows: [phase, thigh (world, forward +), knee, ankle (toe-down +)] */
const RLEG = cyc([[0.00, 26, 16, -6], [0.08, 11, 34, 0], [0.16, -7, 28, 12], [0.24, -24, 20, 32], [0.34, -18, 64, 30], [0.46, 12, 120, 8], [0.58, 48, 122, -8], [0.68, 68, 98, -14], [0.80, 64, 52, -12], [0.91, 42, 22, -8]]);
const RARM = cyc([[0.18, 64, 74], [0.43, 8, 92], [0.68, -50, 112], [0.93, 12, 90]]);
function runPose(ph, k, lean) {
  const L = RLEG(ph), R = RLEG(ph + 0.5), la = RARM(ph), ra = RARM(ph + 0.5), c = Math.cos(2 * PI * (ph - 0.18));
  const amp = 0.4 + 0.6 * k, kn = 0.45 + 0.55 * k, hy = 9 * k * c, cy = -12 * k * c;
  return {
    hipsX: lean, hipsY: hy, hipsZ: 0, spineX: 3, spineY: 0, spineZ: 0, chestX: 2, chestY: cy, chestZ: 0, neckX: -2, neckY: 0, headX: -lean * 0.4 - 2, headY: -(hy + cy), headZ: 0,
    lHipF: 10 + (L[0] - 10) * amp + lean, rHipF: 10 + (R[0] - 10) * amp + lean, lKnee: 10 + (L[1] - 10) * kn, rKnee: 10 + (R[1] - 10) * kn,
    lAnk: L[2] * amp, rAnk: R[2] * amp, lHipA: 3, rHipA: 3, lHipR: 0, rHipR: 0,
    lShF: la[0] * amp, rShF: ra[0] * amp, lEl: 45 + (la[1] - 45) * (0.3 + 0.7 * k), rEl: 45 + (ra[1] - 45) * (0.3 + 0.7 * k), lShA: 9, rShA: 9, lShR: 0, rShR: 0, lWrF: 8, rWrF: 8
  };
}
function runAir(ph, k) { const p = ((ph % 0.5) + 0.5) % 0.5; return p > 0.24 ? 0.075 * k * Math.sin(PI * (p - 0.24) / 0.26) : 0; }

const SET = { hipsX: 96, hipsY: 0, spineX: 6, chestX: 4, neckX: -4, headX: -6, lHipF: 146, lKnee: 104, lAnk: -4, rHipF: 104, rKnee: 78, rAnk: -10, lShF: 96, rShF: 96, lShA: 4, rShA: 4, lEl: 0, rEl: 0, lHipA: 2, rHipA: 2, lWrF: 25, rWrF: 25 };
const MARKS = Object.assign({}, SET, { hipsX: 70, spineX: 12, chestX: 6, lShF: 78, rShF: 78, headX: -2 });
const STAND = { hipsX: 0, hipsY: 0, spineX: 2, chestX: 2, neckX: 0, headX: -3, lHipF: 4, rHipF: 4, lKnee: 7, rKnee: 7, lAnk: -2, rAnk: -2, lHipA: 6, rHipA: 6, lShF: 6, rShF: 6, lShA: 10, rShA: 10, lEl: 18, rEl: 18 };

/* time plan of a straight-line run: velocity profile → position, gait phase, intensity. Precomputed (deterministic). */
function runPlan(o) {
  const dt = 1 / 240, n = Math.ceil((o.dur + 0.1) / dt) + 2, Z = new Float32Array(n), PH = new Float32Array(n), K = new Float32Array(n), VV = new Float32Array(n);
  const vmax = o.vmax, tau = o.tau || 1.15, tGo = o.tGo, tFin = o.tCut !== undefined ? o.tCut + (o.finishZ - o.zCut) / vmax : (o.tFin ?? 1e9);
  const vAt = t => {
    if (t < tGo) return 0;
    if (o.vfn) return o.vfn(t);
    if (t >= tFin) return vmax * Math.pow(Math.max(0, 1 - (t - tFin) / o.tDec), 1.5);
    if (o.tCut !== undefined && t >= o.tCut) return vmax;
    return vmax * (1 - Math.exp(-(t - tGo) / tau));
  };
  let z = o.z0, ph = o.ph0 ?? 0.74, cut = false;
  for (let i = 0; i < n; i++) {
    const t = i * dt, v = vAt(t);
    if (o.tCut !== undefined && !cut && t >= o.tCut) { z = o.zCut; cut = true; }
    Z[i] = z; PH[i] = ph; VV[i] = v;
    const rel = v / vmax;
    K[i] = t < tFin ? (t < tGo ? 0.8 : Math.max(0.78, Math.min(1, rel + 0.4))) : clamp(rel * 1.1, 0.1, 1);
    let r = 0;
    if (t >= tGo) r = t < tFin ? o.r0 + (o.r1 - o.r0) * (1 - Math.exp(-(t - tGo) / 0.7)) : (v > 0.05 ? lerp(1.35, o.r1, rel) : 0);
    z += v * dt; ph += r * dt;
  }
  return { z: sampler(Z, dt), ph: sampler(PH, dt), k: sampler(K, dt), v: sampler(VV, dt), tFin, tStop: tFin + (o.tDec || 0) };
}

/* celebrations after the line (stand-still poses, blended in as the runner stops) */
function celebration(kind, t0) {
  const S = Object.assign({}, STAND);
  if (kind === 'bolt') return poseTrack([
    [t0, S],
    [t0 + 0.45, { ry: -70, lHipA: 12, rHipA: 12, lHipF: 10, lKnee: 18, rKnee: 8, spineX: -2, headY: 10 }],
    [t0 + 0.85, { ry: -90, spineX: -10, spineZ: -6, chestX: -6, chestY: 22, hipsY: 6, headY: 32, headX: -26, headZ: -6, lHipA: 16, rHipA: 14, lHipF: 16, lKnee: 22, rHipF: -4, rKnee: 6, joy: 1 }],
    [t0 + 1.6, { spineX: -11, chestY: 24, headX: -28 }]
  ]);
  if (kind === 'flex') return poseTrack([
    [t0, S],
    [t0 + 0.5, { ry: -80, lHipA: 14, rHipA: 14, lKnee: 14, rKnee: 14, spineX: -4 }],
    [t0 + 0.9, { ry: -90, spineX: -8, chestX: -8, headX: -18, lHipA: 16, rHipA: 16, lKnee: 20, rKnee: 20, joy: 1 }],
    [t0 + 1.5, { spineX: -10, headX: -24 }]
  ]);
  if (kind === 'wide') return poseTrack([
    [t0, S],
    [t0 + 0.6, { ry: -30, lShF: 20, lShA: 100, lEl: 8, rShF: 20, rShA: 100, rEl: 8, spineX: -6, headX: -20, joy: 1 }],
    [t0 + 1.5, { ry: -40, lShA: 104, rShA: 104, headX: -24 }]
  ]);
  return poseTrack([   // arms raised in a V
    [t0, S],
    [t0 + 0.55, { ry: -25, lShF: 150, lShA: 30, lEl: 12, rShF: 150, rShA: 30, rEl: 12, spineX: -5, headX: -22, joy: 1 }],
    [t0 + 1.5, { ry: -35, lShF: 156, rShF: 156 }]
  ]);
}

function makeBlocks(env, feet) {   // feet: [{ toe, heel, q }] world, front (left) then rear (right)
  const g = new THREE.Group(), metal = M('#9aa3a8', { metalness: 0.6, roughness: 0.35 }), rubber = M('#22262a', { roughness: 0.9 }), red = M('#c23b2c');
  const zs = feet.map(f => Math.min(f.toe.z, f.heel.z)), z0 = Math.min(...zs) - 0.12, z1 = Math.max(...feet.map(f => Math.max(f.toe.z, f.heel.z))) + 0.08, xc = (feet[0].toe.x + feet[1].toe.x) / 2;
  add(g, Box(0.07, 0.035, z1 - z0), metal, [xc, 0.018, (z0 + z1) / 2]);
  add(g, Box(0.08, 0.04, 0.07), red, [xc, 0.02, z1 - 0.03]);
  for (const f of feet) {
    const sole = V().addVectors(f.toe, f.heel).multiplyScalar(0.5), down = V(0, -1, 0).applyQuaternion(f.q), fwd = V(0, 0, 1).applyQuaternion(f.q);
    const plate = new THREE.Mesh(Box(0.12, 0.03, 0.24), rubber); orient(plate, sole.clone().addScaledVector(down, 0.02).addScaledVector(fwd, -0.01), down.clone().negate(), fwd); g.add(plate);
    const back = sole.clone().addScaledVector(down, 0.06); back.y = Math.max(0.05, back.y);
    const st = new THREE.Mesh(Cyl(0.015, 0.015, 1, 6), metal); between(st, back, V(back.x, 0.02, back.z + 0.08)); g.add(st);
    const arm = new THREE.Mesh(Cyl(0.012, 0.012, 1, 6), metal); between(arm, V(back.x, 0.02, back.z + 0.08), V(xc, 0.02, back.z + 0.08)); g.add(arm);
  }
  return env.addProp(g);
}

/* crouch start in the blocks (hands behind the line at zLine), shared by the sprint and the hurdles */
function blockStart(env, zLine, tGo) {
  const s = env.s, zs = zLine - 0.03 - 0.44 * s;
  const pre = poseTrack([[0, Object.assign({ x: 0, z: zs - 0.12 * s, ry: 0 }, MARKS)], [0.3, {}], [0.85, Object.assign({ z: zs }, SET)], [tGo, {}]]);
  env.pose(full(Object.assign({ x: 0, z: zs, ry: 0 }, SET)));
  const feet = ['l', 'r'].map(sd => { const S = env.side(sd); return { toe: env.rig['toe_' + S].getWorldPosition(V()), heel: env.rig['heel_' + S].getWorldPosition(V()), q: env.rig.bones[S + 'Foot'].getWorldQuaternion(new THREE.Quaternion()), ank: env.rig.bones[S + 'Foot'].getWorldPosition(V()) }; });
  const B = { zs, zLine, pre, feet, setY: hipsY(env) }; makeBlocks(env, feet); return B;
}
function blockFrame(env, t, tGo, B, wRun) {   // hips height authored, feet pinned to the pedals, hands on the track
  const s = env.s, preY = lerp(0.6 * s, B.setY, smooth(span(t, 0.3, 0.85)));
  setHipsY(env, lerp(preY, hipsY(env), wRun));
  const wr = 1 - smooth(span(t, tGo, tGo + 0.09)), wf = 1 - smooth(span(t, tGo + 0.1, tGo + 0.27));
  legIK(env, 'l', B.feet[0].ank, env.ws([0.2, 0.3, 1.2], false), B.feet[0].q, wf);
  legIK(env, 'r', B.feet[1].ank, env.ws([-0.2, 0.3, 1.2], false), B.feet[1].q, wr);
  const wh = 1 - smooth(span(t, tGo - 0.02, tGo + 0.1));
  if (wh > 0) for (const [sd, x] of [['l', 0.19], ['r', -0.19]]) env.reach(sd, env.W(x * s, 0.03, B.zLine - 0.09), [x * 2.2, 0.6, -0.3], { weight: wh });
}
function flexArms(env, t, tStop) {   // double-biceps flex toward the crowd
  const s = env.s, w = smooth(span(t, tStop - 0.25, tStop + 0.2)); if (w <= 0) return;
  for (const [sd, x] of [['l', 1], ['r', -1]]) env.reach(sd, env.ws([x * 0.4, 1.74, 0.06]), [x * 1.3, 1.25, -0.1], { weight: w });
}
function boltArms(env, t, tStop) {   // "lightning bolt": bow arm to the sky on the left, other hand drawn back to the chest
  const s = env.s, w = smooth(span(t, tStop - 0.1, tStop + 0.35)); if (w <= 0) return;
  const sh = env.bonePos(env.side('l') + 'UpperArm'), dir = env.dir([0.62, 0.72, 0.3]).normalize();
  env.reach('l', sh.clone().addScaledVector(dir, 0.66 * s), [0.5, 0.9, -0.5], { weight: w });
  const rs = env.bonePos(env.side('r') + 'UpperArm');
  env.reach('r', rs.clone().addScaledVector(dir, 0.2 * s).add(env.dir([0.02, -0.04, 0.12]).multiplyScalar(s)), [-0.8, 0.95, -0.05], { weight: w });
}

/* block start → drive phase → upright sprint → (broadcast cut) → finish dip → celebration */
function sprint(a, o = {}) {
  const tGun = o.tGun ?? 1.15, tGo = tGun + (o.react ?? 0.14), tCut = tGo + (o.preCut ?? 2.15), vmax = o.vmax ?? 11.2;
  const plan0 = { tGo, vmax, tau: o.tau ?? 1.15, r0: o.r0 ?? 1.8, r1: o.r1 ?? 2.3, tCut, zCut: TRACK.finish - vmax * 1.0, finishZ: TRACK.finish, tDec: o.tDec ?? 2.3, z0: 0 };
  const tFin = tCut + 1.0, tStop = tFin + plan0.tDec, celT = o.celebrate === 'bolt' ? 1.7 : 1.5, dur = Math.min(8.9, tStop - 0.3 + celT);
  let plan = null, cel = null, B = null;
  return {
    venue: 'track', dur, hold: 0.8, payoff: tFin + 0.15,
    start(env) {
      B = blockStart(env, 0, tGo);
      plan = runPlan(Object.assign({}, plan0, { z0: B.zs, dur }));
      cel = celebration(o.celebrate, tStop - 0.75);
    },
    frame(t, env) {
      const s = env.s, ph = plan.ph(t), k = plan.k(t), z = plan.z(t);
      const sinceGo = Math.max(0, t - tGo), dip = Math.exp(-Math.pow((t - tFin + 0.04) / 0.13, 2));
      const lean = 6 + 54 * Math.exp(-sinceGo / 0.95) + 24 * dip - (t > tFin ? 3 * smooth(span(t, tFin, tFin + 0.6)) : 0);
      let q = runPose(ph, k, lean); q.x = 0; q.z = z; q.ry = 0;
      if (dip > 0.02) q = mix(q, Object.assign({}, q, { lShF: -38, rShF: -38, lEl: 35, rEl: 35, lShA: 14, rShA: 14, headX: -14 }), dip * 0.85);
      const wRun = smooth(span(t, tGo, tGo + 0.3));
      let air = runAir(ph, k) * wRun;
      if (t < tGo + 0.3) { const p = B.pre(Math.min(t, tGo)); p.z = t < tGo ? p.z : z; q = mix(p, q, wRun); }
      const wCel = smooth(span(t, tStop - 0.75, tStop - 0.05));
      if (wCel > 0) { const c = cel(t); c.x = 0; c.z = z; q = mix(q, c, wCel); air *= 1 - wCel; }
      q.air = air; put(env, q);
      if (t < tGo + 0.3) blockFrame(env, t, tGo, B, wRun);
      if (o.celebrate === 'bolt' && wCel > 0) boltArms(env, t, tStop);
      if (o.celebrate === 'flex' && wCel > 0) flexArms(env, t, tStop);
      const r = env.rig.root.position, H = Math.max(1, s);
      return { focus: V(r.x, (t < tGo ? 0.75 : 1.0) * s, r.z + (t < tStop ? 0.6 : 0)), radius: (t < tGo + 0.3 ? 4.4 : 5.4) * H };
    }
  };
}

/* ---- 110 m hurdles: block start, 8 strides to hurdle 1, three-stride rhythm, (cut) last hurdle, run-in, dip */
const HURDLE = { zLine: -10, first: 13.72, gap: 9.14, h: 1.067 };
function makeHurdles(env) {
  const n = 10, lanes = 9, count = n * lanes, white = M('#f6f6f2', { roughness: 0.5 }), dark = M('#2a2f33', { roughness: 0.6 });
  const board = new THREE.InstancedMesh(Box(1.18, 0.07, 0.02), white, count), up = new THREE.InstancedMesh(Box(0.03, 1, 0.03), dark, count * 2), foot = new THREE.InstancedMesh(Box(0.035, 0.03, 0.7), dark, count * 2);
  const m = new THREE.Matrix4(), sc = new THREE.Matrix4(); let i = 0, j = 0;
  for (let L = 0; L < lanes; L++) for (let h = 0; h < n; h++) {
    const x = (L - 4) * TRACK.lane, z = HURDLE.zLine + HURDLE.first + HURDLE.gap * h;
    m.makeTranslation(x, HURDLE.h - 0.035, z); board.setMatrixAt(i++, m);
    for (const sx of [-0.57, 0.57]) { m.makeTranslation(x + sx, (HURDLE.h - 0.07) / 2, z - 0.02); sc.makeScale(1, HURDLE.h - 0.07, 1); up.setMatrixAt(j, m.clone().multiply(sc)); m.makeTranslation(x + sx, 0.015, z - 0.33); foot.setMatrixAt(j++, m); }
  }
  const g = new THREE.Group(); g.add(board, up, foot); return env.addProp(g);
}
const HUR_KEYS = [   // clearance over the hurdle, u = 0 take-off (left foot) … 1 touchdown (right lead leg); thigh values are world angles
  [0.0, { lean: 24, lHipF: -26, lKnee: 14, lAnk: 30, lHipA: 4, rHipF: 84, rKnee: 104, rAnk: -12, rHipA: 2, lShF: 92, lEl: 25, lShA: 8, rShF: -32, rEl: 80, rShA: 14, lHipR: 0 }],
  [0.33, { lean: 44, lHipF: -12, lKnee: 60, lAnk: 20, lHipA: 30, rHipF: 92, rKnee: 12, rAnk: 4, lShF: 104, lEl: 10, rShF: -36, rEl: 85 }],
  [0.6, { lean: 40, lHipF: 30, lKnee: 104, lAnk: -18, lHipA: 76, lHipR: -30, rHipF: 62, rKnee: 8, rAnk: 8, lShF: 60, lShA: 38, lEl: 40, rShF: -10, rEl: 80 }],
  [0.85, { lean: 26, lHipF: 66, lKnee: 112, lHipA: 40, lHipR: -12, rHipF: 20, rKnee: 8, rAnk: 8, lShF: 20, lShA: 20, lEl: 70, rShF: 30, rEl: 80 }],
  [1.0, { lean: 16, lHipF: 74, lKnee: 104, lAnk: -10, lHipA: 12, lHipR: 0, rHipF: 8, rKnee: 18, rAnk: -2, lShF: -10, lShA: 10, lEl: 90, rShF: 45, rEl: 80 }]
];
const hurPose = poseTrack(HUR_KEYS.map(([u, p]) => [u, p]), { lean: 0 });
function hurdles(a) {
  const tGun = 0.95, tGo = tGun + 0.14, vmax = 9.4, tau = 1.0, skip = 7 * HURDLE.gap;   // the cut jumps from hurdle 2 to hurdle 9
  let B = null, Z = null, PH = null, KK = null, hT = [], tFin = 0, tStop = 0, cel = null, runHip = 0, dur = 8.9, tCut = 0;
  return {
    venue: 'track', get dur() { return dur; }, hold: 0.8, get payoff() { return tFin + 0.15; },
    start(env) {
      const s = env.s; B = makeHurdles(env) && blockStart(env, HURDLE.zLine, tGo);
      const dt = 1 / 240, n = Math.ceil(9.2 / dt), zr = new Float32Array(n), vv = new Float32Array(n);
      // real (uncut) path: accelerate to race pace, decelerate after the line
      let z = B.zs, fin = -1; const finReal = TRACK.finish - skip;
      for (let i = 0; i < n; i++) { const t = i * dt; let v = t < tGo ? 0 : vmax * (1 - Math.exp(-(t - tGo) / tau)); if (fin >= 0) v = vmax * Math.pow(Math.max(0, 1 - (t - fin) / 1.55), 1.5); zr[i] = z; vv[i] = v; z += v * dt; if (fin < 0 && z >= finReal) fin = t; }
      tFin = fin; tStop = tFin + 1.55; dur = Math.min(8.9, tStop + 0.85);
      const timeAt = zz => { for (let i = 1; i < n; i++) if (zr[i] >= zz) return (i - 1 + (zz - zr[i - 1]) / Math.max(1e-6, zr[i] - zr[i - 1])) * dt; return 9; };
      hT = [0, 1, 2].map(i => timeAt(HURDLE.zLine + HURDLE.first + HURDLE.gap * i));
      tCut = hT[1] + 0.42;
      // gait phase: 8 strides to hurdle 1 (take-off on the left), three strides between hurdles
      const keys = [[0, 0.74], [tGo, 0.74]];
      hT.forEach((th, i) => { keys.push([th - 0.2, 4.24 + 2 * i], [th + 0.17, 4.5 + 2 * i]); });
      const tl = hT[2] + 0.17; keys.push([tFin, 4.5 + 4 + 2.3 * (tFin - tl)]);
      let ph = keys[keys.length - 1][1]; for (let t = tFin + 0.05; t <= 9.3; t += 0.05) { const v = vmax * Math.pow(Math.max(0, 1 - (t - tFin) / 1.55), 1.5); ph += (v > 0.05 ? lerp(1.35, 2.3, v / vmax) : 0) * 0.05; keys.push([t, ph]); }
      PH = numTrack(keys); Z = sampler(zr, dt);
      KK = t => t < tFin ? 0.9 : clamp(sampler(vv, dt)(t) / vmax * 1.1, 0.1, 1);
      cel = celebration('arms', tStop - 0.75);
      env.pose(full(STAND)); runHip = hipsY(env) * 0.97;
    },
    frame(t, env) {
      const s = env.s, ph = PH(t), k = KK(t), z = Z(t) + (t >= tCut ? skip : 0);
      const sinceGo = Math.max(0, t - tGo), dip = Math.exp(-Math.pow((t - tFin + 0.04) / 0.13, 2));
      let lean = 6 + 38 * Math.exp(-sinceGo / 0.8) + 22 * dip - (t > tFin ? 3 * smooth(span(t, tFin, tFin + 0.6)) : 0);
      let q = runPose(ph, k, lean); q.x = 0; q.z = z; q.ry = 0;
      let air = runAir(ph, k), bump = 0;
      for (const th of hT) {   // hurdle clearance overrides the gait
        const t0 = th - 0.2, t1 = th + 0.17, w = smooth(span(t, t0 - 0.07, t0)) * (1 - smooth(span(t, t1, t1 + 0.08)));
        if (w <= 0) continue;
        const u = clamp((t - t0) / (t1 - t0), 0, 1), h = hurPose(u), L = h.lean;
        const c = Object.assign({}, h, { hipsX: L, lHipF: h.lHipF + L, rHipF: h.rHipF + L, headX: -L * 0.7, spineX: 4, chestX: 4, hipsY: 0, chestY: 0, headY: 0 }); delete c.lean;
        q = mix(q, c, w); air *= 1 - w; bump = Math.max(bump, w * Math.sin(PI * u));
      }
      if (dip > 0.02) q = mix(q, Object.assign({}, q, { lShF: -38, rShF: -38, lEl: 35, rEl: 35, headX: -14 }), dip * 0.85);
      const wRun = smooth(span(t, tGo, tGo + 0.3));
      if (t < tGo + 0.3) { const p = B.pre(Math.min(t, tGo)); p.z = t < tGo ? p.z : z; q = mix(p, q, wRun); air *= wRun; }
      const wCel = smooth(span(t, tStop - 0.75, tStop - 0.05));
      if (wCel > 0) { const c = cel(t); c.x = 0; c.z = z; q = mix(q, c, wCel); air *= 1 - wCel; }
      q.air = air; put(env, q);
      if (bump > 0) setHipsY(env, Math.max(hipsY(env), runHip + 0.3 * s * bump));
      if (t < tGo + 0.3) blockFrame(env, t, tGo, B, wRun);
      const r = env.rig.root.position, H = Math.max(1, s);
      return { focus: V(r.x, (t < tGo ? 0.75 : 1.05) * s, r.z + (t < tStop ? 0.8 : 0)), radius: (t < tGo + 0.3 ? 4.4 : 5.8) * H };
    }
  };
}

/* ---- long jump: approach run, take-off from the board, hitch-kick flight (running in the air), landing in the pit */
function longJump(a, o = {}) {
  const L = TRACK.lj, tGo = 0.8, tPlant = tGo + 2.6, tTO = tPlant + 0.12, vh = 9.0, vy = 3.15;
  let plan = null, body = null, y0 = 0, T = 0.84, tLand = 0, zTO = 0, zLand = 0, mark = null, dur = 7.4;
  const vfn = t => t < tTO ? 10.9 * (1 - Math.exp(-(t - tGo) / 1.05)) : t < tTO + T ? vh : vh * Math.max(0, 1 - (t - tTO - T) / 0.3) * 0.5;
  return {
    venue: 'track', get dur() { return dur; }, hold: 0.8, get payoff() { return tLand + 0.3; },
    start(env) {
      const s = env.s;
      // take-off and landing poses decide the flight: hips height when leaving the board and when the heels reach the sand
      const TO = { hipsX: 0, spineX: -2, chestX: 0, headX: -6, lHipF: -20, lKnee: 8, lAnk: 34, rHipF: 86, rKnee: 96, rAnk: -10, lShF: 115, lEl: 45, lShA: 10, rShF: -42, rEl: 60, rShA: 16 };
      const LANDP = { hipsX: 10, spineX: 30, chestX: 12, headX: 4, lHipF: 72, rHipF: 72, lKnee: 12, rKnee: 12, lAnk: -12, rAnk: -12, lShF: 50, rShF: 50, lEl: 20, rEl: 20, lShA: 12, rShA: 12, lHipA: 6, rHipA: 6 };
      env.pose(full(TO)); y0 = hipsY(env);
      env.pose(full(LANDP)); const yL = hipsY(env);
      T = (vy + Math.sqrt(vy * vy + 2 * 9.8 * (y0 - yL))) / 9.8; tLand = tTO + T; dur = tLand + 2.6;
      // phase so that the left foot lands on the board at tPlant; start mark so the hips are just behind it
      const probe = runPlan({ tGo, vmax: 10.9, r0: 1.7, r1: 2.3, z0: 0, ph0: 0, dur, vfn, tFin: tTO });
      const p0 = Math.ceil(probe.ph(tPlant)) - probe.ph(tPlant), z0 = L.board + 0.1 - 0.42 * s - probe.z(tPlant);
      plan = runPlan({ tGo, vmax: 10.9, r0: 1.7, r1: 2.3, z0, ph0: p0, dur, vfn, tFin: tTO });
      zTO = plan.z(tTO); zLand = zTO + vh * T;
      const F = k => tTO + k * T;
      body = poseTrack([
        [tPlant, Object.assign(runPose(0, 1, 4))],
        [tTO, TO],
        [F(0.25), { lHipF: 72, lKnee: 92, lAnk: -4, rHipF: -18, rKnee: 42, rAnk: 24, lShF: -34, lEl: 40, rShF: 150, rEl: 22, spineX: 2 }],
        [F(0.5), { lHipF: -12, lKnee: 52, lAnk: 22, rHipF: 74, rKnee: 100, rAnk: -4, lShF: 150, lEl: 22, rShF: -30, rEl: 40 }],
        [F(0.72), { lHipF: 58, lKnee: 96, rHipF: 80, rKnee: 30, rAnk: -8, lShF: 168, rShF: 160, lEl: 14, rEl: 14, spineX: 8, chestX: 4, hipsX: 0 }],
        [F(0.9), { lHipF: 82, rHipF: 82, lKnee: 10, rKnee: 10, lAnk: -10, rAnk: -10, lShF: 100, rShF: 100, spineX: 22, chestX: 10, headX: 6, hipsX: 4 }],
        [tLand, LANDP],
        [tLand + 0.25, { hipsX: 0, lHipF: 118, rHipF: 118, lKnee: 120, rKnee: 120, lAnk: 10, rAnk: 10, spineX: 42, chestX: 14, lShF: 75, rShF: 75, lEl: 30, rEl: 30, headX: 10 }],
        [tLand + 0.7, { spineX: 40 }],
        [tLand + 1.45, Object.assign({}, STAND, { headX: -8 })],
        [tLand + 2.0, { lShF: 150, lShA: 30, lEl: 12, rShF: 150, rShA: 30, rEl: 12, spineX: -4, headX: -20, joy: 1 }]
      ]);
      mark = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshStandardMaterial(OV(3, { color: '#8f7448', transparent: true, opacity: 0.85, roughness: 1, depthWrite: false })));
      mark.rotation.x = -PI / 2; mark.scale.set(1, 1.6, 1); env.addProp(mark); mark.visible = false;
    },
    frame(t, env) {
      const s = env.s, ph = plan.ph(t), k = plan.k(t);
      const z = t < tTO ? plan.z(t) : t < tLand ? zTO + vh * (t - tTO) : zLand + 0.5 * s * (1 - Math.exp(-(t - tLand) / 0.12));
      const lean = 4 + 30 * Math.exp(-Math.max(0, t - tGo) / 0.6);
      let q = runPose(ph, Math.max(0.15, k), lean); q.x = L.x; q.z = z; q.ry = 0;
      const wRun = smooth(span(t, tGo - 0.1, tGo + 0.4)) * (1 - smooth(span(t, tPlant - 0.02, tPlant + 0.06)));
      let air = runAir(ph, k) * wRun;
      const pre = Object.assign({}, STAND, { spineX: 4 + 4 * Math.sin(t * 5), headX: -2, x: L.x, z });
      if (t < tGo + 0.4) q = mix(pre, q, smooth(span(t, tGo - 0.1, tGo + 0.4)));
      if (t > tPlant - 0.02) { const b = body(t); b.x = L.x; b.z = z; q = mix(q, b, smooth(span(t, tPlant - 0.02, tPlant + 0.06))); air = 0; }
      q.air = air; put(env, q);
      if (t > tTO && t < tLand + 0.2) { const tt = t - tTO; setHipsY(env, Math.max(hipsY(env), y0 + vy * tt - 4.9 * tt * tt)); }
      if (t >= tLand) { mark.visible = true; mark.position.set(L.x, 0.012, zLand + 0.62 * s); } else mark.visible = false;
      const r = env.rig.root.position, H = Math.max(1, s);
      return { focus: V(r.x, 1.0 * s, r.z + (t < tLand ? 1.4 : 0.4)), radius: (t < tTO ? 6.2 : 5.6) * H };
    }
  };
}

/* ================================================================== ARCHERY */
/* ---- outdoor range: shooting line along X at z = 0, targets downrange at +Z (distance compressed from 70 m to 40 m, 122 cm faces kept) */
const RANGE = { dist: 40, faceY: 1.3, tilt: 12 * D2R, spacing: 2.6 };
function faceTex() {
  return canvasTex(512, 512, (x, w) => {
    x.fillStyle = '#f7f7f2'; x.fillRect(0, 0, w, w);
    const c = w / 2, R = w * 0.49, cols = ['#f7f7f2', '#f7f7f2', '#1f1f1f', '#1f1f1f', '#2a8fd6', '#2a8fd6', '#e0332b', '#e0332b', '#f6d62a', '#f6d62a'];
    for (let i = 0; i < 10; i++) { const r = R * (10 - i) / 10; x.beginPath(); x.arc(c, c, r, 0, PI * 2); x.fillStyle = cols[i]; x.fill(); x.lineWidth = 1.5; x.strokeStyle = i === 2 || i === 3 ? '#f2f2f2' : '#202020'; x.stroke(); }
    x.beginPath(); x.arc(c, c, R * 0.05, 0, PI * 2); x.strokeStyle = '#202020'; x.lineWidth = 1; x.stroke();   // inner 10 (X)
    x.beginPath(); x.moveTo(c - 6, c); x.lineTo(c + 6, c); x.moveTo(c, c - 6); x.lineTo(c, c + 6); x.stroke();
  });
}
function makeArrow(fl = '#f2c230', shaft = '#22272b') {
  const g = new THREE.Group(), L = 0.76;
  const sh = new THREE.Mesh(Cyl(0.0042, 0.0042, L, 6), M(shaft, { roughness: 0.4, metalness: 0.3 })); sh.rotation.x = PI / 2; sh.position.z = L / 2; g.add(sh);
  const pt = new THREE.Mesh(new THREE.ConeGeometry(0.0055, 0.03, 6), M('#c9ced2', { metalness: 0.8, roughness: 0.3 })); pt.rotation.x = PI / 2; pt.position.z = L + 0.012; g.add(pt);
  const nk = new THREE.Mesh(Cyl(0.005, 0.005, 0.02, 6), M('#e8e8e2')); nk.rotation.x = PI / 2; nk.position.z = 0.008; g.add(nk);
  for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(Box(0.0012, 0.022, 0.065), M(i === 0 ? '#e23b2e' : fl, { roughness: 0.5 })); const a = i * 2 * PI / 3; v.position.set(Math.cos(a) * 0.014, Math.sin(a) * 0.014, 0.065); v.rotation.z = a - PI / 2; g.add(v); }
  return g;
}
function orientZ(obj, pos, zDir, yHint) {   // local +Z along zDir, +Y toward yHint
  const z = zDir.clone().normalize(), y = yHint.clone().addScaledVector(z, -yHint.dot(z)); if (y.lengthSq() < 1e-9) y.set(0, 1, 0).addScaledVector(z, -z.y); y.normalize();
  const x = V().crossVectors(y, z); _m4.makeBasis(x, y, z); obj.quaternion.setFromRotationMatrix(_m4); if (pos) obj.position.copy(pos); return obj;
}
function buildRange(scene) {
  const g = new THREE.Group(); scene.add(g); const D = RANGE.dist;
  scene.background = skyTex('#5a98d4', '#a7d0ec', '#e6f0ef'); scene.fog = new THREE.Fog('#dfeaea', 70, 240);
  add(g, Plane(400, 400), new THREE.MeshStandardMaterial({ map: grassTex(33, '#4b9a43', '#55a64c', 16, [40, 40]), roughness: 0.95 }), [0, -0.02, 20], FLAT, false);
  const line = MO('#f7f7f2', 2, { roughness: 0.7 });
  add(g, Plane(40, 0.08), line, [0, 0.003, 0], FLAT, false);                                // shooting line
  for (let i = -9; i <= 9; i++) add(g, Plane(0.6, 0.06), line, [i * 1.6, 0.003, -5], FLAT, false);   // waiting line (dashed)
  for (let i = -7; i <= 7; i++) add(g, Plane(0.05, D), MO('#eef0ea', 1), [i * RANGE.spacing + RANGE.spacing / 2, 0.002, D / 2], FLAT, false);   // lane lines
  const face = new THREE.MeshStandardMaterial({ map: faceTex(), roughness: 0.75 }), boss = M('#d8c79a', { roughness: 1 }), wood = M('#8a6440', { roughness: 0.9 });
  const nums = n => canvasTex(128, 96, (x, w, h) => { x.fillStyle = '#fbfbf6'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d2428'; x.font = '900 70px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), w / 2, h / 2 + 4); });
  for (let i = -3; i <= 3; i++) {
    const t = new THREE.Group(); t.position.set(i * RANGE.spacing, 0, D); g.add(t);
    const tilted = new THREE.Group(); tilted.position.set(0, RANGE.faceY, 0); tilted.rotation.x = -RANGE.tilt; t.add(tilted);
    add(tilted, Box(1.32, 1.32, 0.4), boss, [0, 0, 0.2]);
    add(tilted, Plane(1.22, 1.22), face, [0, 0, -0.003], [0, PI, 0], false);
    for (const sx of [-0.55, 0.55]) add(t, Box(0.07, 2.3, 0.07), wood, [sx, 1.05, 0.55], [0.32, 0, 0]);
    add(t, Box(0.07, 2.0, 0.07), wood, [0, 1.0, -0.25], [-0.28, 0, 0]);
    add(t, Plane(0.32, 0.24), new THREE.MeshStandardMaterial({ map: nums(i + 4), roughness: 0.8 }), [0, 0.42, -0.42], [0, PI, 0], false);
    add(t, Cyl(0.015, 0.015, 1.6, 6), M('#cfd4d6'), [0.75, 2.55, 0.3]);                       // wind flag
    add(t, Plane(0.32, 0.22), M('#f2c94c', { side: THREE.DoubleSide }), [0.75 + 0.16, 3.22, 0.3], [0, 0.6 * (i % 2 ? 1 : -1), 0], false);
    if (i === 0) {   // two earlier arrows already in this face
      for (const [ax, ay] of [[0.09, -0.05], [-0.07, 0.12]]) { const a = makeArrow(); const tip = V(ax, ay, -0.03).applyAxisAngle(V(1, 0, 0), -RANGE.tilt).add(V(0, RANGE.faceY, D)); orientZ(a, tip.clone().add(V(0.02, 0.01, -0.7)), V(-0.02, -0.01, 0.7), UPY); g.add(a); }
    }
  }
  // safety net behind the targets, trees, spectator stand behind the shooting line
  add(g, Plane(60, 5), new THREE.MeshStandardMaterial({ color: '#2f5d3a', roughness: 1, transparent: true, opacity: 0.85 }), [0, 2.5, D + 9], [0, PI, 0], false);
  const leaf = M('#2f6a35', { roughness: 0.95 }), trunk = M('#5a4030');
  const r = rng(41); for (let i = 0; i < 26; i++) { const x = -45 + i * 3.6 + r() * 2, z = D + 16 + r() * 10, h = 5 + r() * 4; add(g, Cyl(0.15, 0.2, 2, 6), trunk, [x, 1, z]); add(g, new THREE.ConeGeometry(1.8 + r(), h, 8), leaf, [x, 2 + h / 2, z]); }
  add(g, Box(30, 0.8, 0.3), M('#3c5a73'), [0, 0.4, -9]);
  standPlane(g, crowd(1024, 256, 17, '#2b3a44'), [0, 3.2, -13], 0, 34, 7, 0.5, 2);
  // a few bow stands / tents for atmosphere
  for (const x of [-6, 6]) { const tent = new THREE.Group(); tent.position.set(x, 0, -7); g.add(tent); add(tent, Box(3, 0.08, 3), M('#f2f2ee'), [0, 2.6, 0]); for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) add(tent, Cyl(0.03, 0.03, 2.6, 6), M('#9aa3a8'), [dx, 1.3, dz]); }
  return { group: g, target: V(0, RANGE.faceY, D) };
}
/* target point on the face (offsets in metres within the tilted face plane) */
function facePoint(dx, dy, depth = 0) { return V(dx, dy, -0.003 + depth).applyAxisAngle(V(1, 0, 0), -RANGE.tilt).add(V(0, RANGE.faceY, RANGE.dist)); }

/* recurve bow: riser, flexing two-segment limbs, string with a nocking point, long rod + V-bar stabilisers, sight */
function makeBow(env, col = '#27486b') {
  const g = new THREE.Group(), sideS = env.mirror ? -1 : 1, riserM = M(col, { metalness: 0.55, roughness: 0.35 }), limbM = M('#1e2226', { roughness: 0.4 }), grip = M('#3a2b20', { roughness: 0.8 });
  const riser = new THREE.Group(); g.add(riser);
  add(riser, Box(0.028, 0.6, 0.045), riserM, [0, 0.03, 0.01]);
  add(riser, Box(0.034, 0.13, 0.07), grip, [0, -0.03, -0.012]);
  add(riser, Box(0.03, 0.08, 0.05), riserM, [0, 0.33, 0.0]); add(riser, Box(0.03, 0.08, 0.05), riserM, [0, -0.27, 0.0]);
  const rod = (a, b, r = 0.006) => { const m = new THREE.Mesh(Cyl(r, r, 1, 6), M('#202326', { roughness: 0.35, metalness: 0.4 })); between(m, a, b); riser.add(m); return m; };
  rod(V(0, -0.12, 0.03), V(0, -0.2, 0.78)); const wt = new THREE.Mesh(Cyl(0.017, 0.017, 0.06, 10), M('#2c3136', { metalness: 0.5 })); between(wt, V(0, -0.2, 0.76), V(0, -0.204, 0.82)); riser.add(wt);
  for (const sx of [-1, 1]) { rod(V(0, -0.12, 0.04), V(sx * 0.16, -0.24, -0.2), 0.005); const w2 = new THREE.Mesh(Cyl(0.014, 0.014, 0.05, 8), M('#2c3136', { metalness: 0.5 })); between(w2, V(sx * 0.16, -0.24, -0.2), V(sx * 0.18, -0.255, -0.245)); riser.add(w2); }
  rod(V(0.015 * sideS, 0.1, 0.02), V(0.05 * sideS, 0.11, 0.3), 0.005);
  add(riser, new THREE.TorusGeometry(0.012, 0.003, 6, 14), M('#e7e9ea', { metalness: 0.5 }), [0.05 * sideS, 0.11, 0.3]);
  const limbs = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(Cyl(0.02, 0.02, 1, 6), limbM); m.scale.set(1, 1, 0.3); g.add(m); return m; });
  const strings = [0, 1].map(() => { const m = new THREE.Mesh(Cyl(0.0032, 0.0032, 1, 5), M('#fbfaf2', { roughness: 0.4, emissive: '#55554f' })); g.add(m); return m; });
  env.addProp(g);
  const P = (y, z) => V(0, y, z);
  return {
    group: g,
    /* d: draw (0 brace … 1 full); nock: nocking point in bow-local coordinates (string pulled there) */
    set(d, nock) {
      const f = clamp(d, 0, 1.1);
      for (const s of [1, -1]) {
        const p0 = P(s * 0.31, 0.0), p1 = P(s * lerp(0.55, 0.53, f), lerp(-0.075, -0.13, f)), p2 = P(s * lerp(0.72, 0.68, f), lerp(-0.18, -0.29, f)), tip = P(s * lerp(0.785, 0.74, f), lerp(-0.2, -0.33, f));
        const i = s > 0 ? 0 : 2; between(limbs[i], p0, p1, V(0, 0, 1)); between(limbs[i + 1], p1, p2, V(0, 0, 1)); limbs[i].scale.x = 1; limbs[i + 1].scale.x = 0.8;
        between(strings[s > 0 ? 0 : 1], tip.clone().add(V(0, 0, -0.01)), nock || P(0, -0.21));
      }
    }
  };
}

/* the archer: nock, set, raise, draw to the chin, aim, release, follow-through; arrow to the 10 ring; camera follows to the face */
const ARCH_STANCE = { lHipA: 9, rHipA: 9, lKnee: 5, rKnee: 5, lHipF: 3, rHipF: 3, spineX: 1, chestX: 0, lShF: 10, rShF: 10, lEl: 20, rEl: 20 };
function archery(a, o = {}) {
  const aim = o.aim ?? 1.25, quick = o.quick ? 0.75 : 1;
  const tReach = 0.2, tGrab = 0.55 * quick, tNock = 1.35 * quick, tSet = 1.85 * quick, tRaise = 2.45 * quick, tFull = tRaise + 0.65 * (o.highDraw ? 1.1 : 1) * quick;
  const tRel = tFull + aim, tHit = tRel + 0.62, tBack = tHit + 1.25, dur = tBack + 1.35;
  const hitOff = o.hit || [0.012, 0.018];
  let body, G, U, F, DD, gripFull, A0, Lfull, bow, arrow, quiver, rel = null, hitP, hitDir;
  return {
    venue: 'archeryRange', dur, hold: 0.7, payoff: tHit + 0.05, view: 225, orbit: { base: 0, sweep: 45 }, mirror: a.handedness === 'left',
    start(env) {
      const s = env.s;
      if (a.appearance && a.appearance.accessory === 'cap') env.rig.setHeadwear('cap');
      // the rig draws the arm guard on the right forearm; archers wear it on the bow arm — move it
      const rf = env.rig.bones.rForearm; rf.traverse(m => { if (m.isMesh && m.material && m.material.color && m.material.color.getHexString() === '2b2f33') m.visible = false; });
      const bf = env.rig.bones[env.side('l') + 'Forearm'], H = env.rig.p.H;
      const guard = new THREE.Mesh(Cyl(0.03 * H * 0.95, 0.03 * H * 0.75, env.rig.len.forearm * 0.62, 12, true), M('#2b2f33', { side: THREE.DoubleSide })); guard.position.set(0, -env.rig.len.forearm * 0.45, 0); env.addProp(guard, bf);
      const chestG = new THREE.Mesh(new THREE.SphereGeometry(0.09 * H, 12, 8, 0, PI * 0.9, 0.5, 1.4), M('#2b2f33', { side: THREE.DoubleSide })); chestG.position.set((env.mirror ? -1 : 1) * 0.045 * H, env.rig.len.chest * 0.5, 0.0); chestG.rotation.y = env.mirror ? -0.3 : 0.3; chestG.scale.set(0.9, 1, 0.75); env.addProp(chestG, env.rig.bones.chest);
      // hip quiver on the draw side with a few arrows
      quiver = new THREE.Group(); const qx = (env.mirror ? 1 : -1) * 0.16 * H / 1.85;
      quiver.position.set(qx, -0.02 * H, -0.03 * H); quiver.rotation.set(-0.45, 0, (env.mirror ? -1 : 1) * -0.25);
      add(quiver, Cyl(0.045, 0.035, 0.36, 10, true), M('#30343a', { side: THREE.DoubleSide }), [0, -0.12, 0]);
      for (let i = 0; i < 3; i++) { const q = makeArrow(); q.rotation.x = -PI / 2; q.position.set((i - 1) * 0.018, -0.36 + 0.03 * i, (i % 2) * 0.012); q.scale.setScalar(1); quiver.add(q); }
      env.addProp(quiver, env.rig.bones.hips);
      bow = makeBow(env, o.bowColor); arrow = env.addProp(makeArrow());
      // body: side-on, head to the target at full draw
      const sd = 0.36;
      body = poseTrack([
        [0, Object.assign({ x: 0, z: 0, ry: -90 }, ARCH_STANCE, { headY: 30, headX: 2 })],
        [tReach, { chestY: -8, headY: 10, headX: 10 }],
        [tGrab, { chestY: -12, headY: -10, headX: 18 }],
        [tNock, { chestY: 4, headY: 22, headX: 28, spineX: 4 }],
        [tSet, { chestY: 2, headY: 80, headX: 0, neckY: 6, spineX: 1 }],
        [tRaise, { headY: 84, neckY: 6, headZ: -3 }],
        [tFull, { headY: 86, neckY: 7, headZ: -6, headX: 3, chestY: 3, chestZ: -1 }],
        [tRel, {}],
        [tRel + 0.4, { headZ: -4 }],
        [tBack - 0.2, {}],
        [tBack + 0.45, { headY: 40, headZ: 0, headX: -4, chestY: 0, joy: 1 }],
        [dur, { headY: 30 }]
      ]);
      // full-draw geometry: anchor under the chin, bow hand straight out toward the target
      env.pose(full(body(tFull)));
      const hg = env.rig.headGroup, R = env.rig.headR; hg.updateMatrixWorld(true);
      A0 = hg.localToWorld(V(0, -1.12 * R, 0.32 * R));
      const tgt = facePoint(env.mirror ? -hitOff[0] : hitOff[0], hitOff[1]);
      F = tgt.clone().sub(A0).normalize(); F.y += 0.012; F.normalize();
      const S = env.bonePos(env.side('l') + 'UpperArm'), L = env.rig.len, r = 0.965 * (L.upperArm + L.forearm + 0.03 * H);
      const AS = A0.clone().sub(S), b = F.dot(AS), c = AS.lengthSq() - r * r; Lfull = -b + Math.sqrt(Math.max(0, b * b - c));
      gripFull = A0.clone().addScaledVector(F, Lfull);
      const W = l => env.ws(l, false), Fw = F.clone(), Uw = UPY.clone();
      G = vecTrack([[0, W([0.3 + 0.0, 0.8, 0.18 * sd])], [tGrab, W([0.3, 0.84, 0.2])], [tNock - 0.35 * quick, W([0.3, 0.98, 0.36])], [tNock, W([0.3, 0.98, 0.36])], [tSet, W([0.42, 1.12, 0.3])], [tRaise, gripFull.clone().add(V(0, o.highDraw ? 0.26 : -0.04, 0)).addScaledVector(Fw, -0.02)], [tFull, gripFull], [tRel, gripFull], [tRel + 0.4, gripFull.clone().add(V(0, -0.03, 0))], [tBack - 0.2, gripFull.clone().add(V(0, -0.05, 0))], [tBack + 0.5, W([0.32, 0.86, 0.22])], [dur, W([0.3, 0.82, 0.2])]].map(([t, v]) => [t, v.toArray()]));
      const lf = env.dir([0, 0.75, 0.66]).normalize(), up2 = env.dir([0.15, 1, 0.12]).normalize(), roll = UPY.clone().multiplyScalar(0.62).addScaledVector(Fw, 0.78).normalize();
      U = vecTrack([[0, up2], [tGrab, up2], [tNock - 0.35 * quick, lf], [tNock, lf], [tSet, Uw.clone().addScaledVector(Fw, -0.05)], [tRaise, Uw], [tRel, Uw], [tRel + 0.08, Uw.clone().addScaledVector(Fw, 0.2)], [tRel + 0.4, roll], [tBack - 0.2, roll], [tBack + 0.5, up2], [dur, up2]].map(([t, v]) => [t, v.toArray()]));
      DD = numTrack([[0, 0.21], [tSet, 0.21], [tSet + 0.25, 0.25], [tRaise, 0.4], [tFull, Lfull], [tRel - 0.01, Lfull + 0.008], [tRel + 0.025, 0.21], [dur, 0.21]]);
      hitP = facePoint(env.mirror ? -hitOff[0] : hitOff[0], hitOff[1], 0.04);
    },
    frame(t, env) {
      const s = env.s; put(env, body(t));
      // bow placement
      const g = V(...G(t)), up = V(...U(t)).normalize();
      const fwd = t < tSet ? env.dir([1, 0, 0]).addScaledVector(up, -env.dir([1, 0, 0]).dot(up)).normalize() : F.clone().addScaledVector(up, -F.dot(up)).normalize();
      orient(bow.group, g, up, fwd); bow.group.updateMatrixWorld(true);
      const dd = DD(t), nockW = g.clone().addScaledVector(fwd, -dd).addScaledVector(up, 0.03);
      const nockL = bow.group.worldToLocal(nockW.clone()); bow.set((dd - 0.21) / Math.max(0.3, Lfull - 0.21), nockL);
      // bow hand on the grip
      env.reach('l', g.clone().addScaledVector(fwd, -0.035).addScaledVector(up, -0.02), [0.6, 0.7, -0.5], { weight: 1 });
      // draw hand: quiver → arrow to the bow → hook the string → draw → anchor → release along the neck
      const qTop = env.rig.bones.hips.localToWorld(quiver.position.clone().add(V(0, 0.08, -0.06)));
      const onString = nockW.clone().addScaledVector(fwd, -0.03).addScaledVector(up, -0.025);
      let hand;
      if (t < tGrab) hand = env.ws([-0.28, 0.98, 0.15], false).lerp(qTop, smooth(span(t, tReach, tGrab)));
      else if (t < tNock - 0.35 * quick) hand = qTop.clone().lerp(nockW.clone().addScaledVector(fwd, -0.18).add(V(0, 0.05, 0)), smooth(span(t, tGrab, tNock - 0.35 * quick)));
      else if (t < tNock) hand = nockW.clone().addScaledVector(fwd, -0.18).add(V(0, 0.05, 0)).lerp(onString.clone().addScaledVector(fwd, -0.02), smooth(span(t, tNock - 0.35 * quick, tNock)));
      else if (t < tRel) hand = onString;
      else { const k = smooth(span(t, tRel, tRel + 0.12)); hand = onString.clone().lerp(A0.clone().addScaledVector(F, -0.15).add(V(0, -0.035, 0)), k); if (t > tBack - 0.2) hand.lerp(env.ws([-0.25, 0.92, 0.12], false), smooth(span(t, tBack - 0.2, tBack + 0.5))); }
      if (t > tBack + 0.35 && o.fist) { const k = t - tBack - 0.35, pump = 0.5 + 0.5 * Math.cos(Math.max(0, k - 0.3) * 11) * Math.exp(-Math.max(0, k - 0.3) * 1.2); hand = hand.clone().lerp(env.ws([-0.3, 1.18 + 0.42 * pump, 0.34], false), smooth(span(k, 0, 0.3))); }
      env.reach('r', hand, t < tNock ? [-0.6, 0.6, -0.3] : t > tBack + 0.35 && o.fist ? [-0.8, 0.7, 0.1] : [-0.8, 1.12, -0.55], { weight: 1 });
      // the arrow
      if (t < tGrab) arrow.visible = false;
      else if (t < tNock - 0.1 * quick) {
        arrow.visible = true; const hp = env.handPos('r'), k = smooth(span(t, tNock - 0.5 * quick, tNock - 0.1 * quick));
        const dirA = V(0, 1, 0).lerp(fwd, k).normalize(); orientZ(arrow, hp.clone().addScaledVector(dirA, -0.06 * (1 - k)).lerp(nockW, k), dirA, up);
      } else if (t < tRel) { arrow.visible = true; orientZ(arrow, nockW, fwd, up); if (!rel || rel.t !== tRel) rel = null; }
      else {
        if (!rel) { const nk = gripFull.clone().addScaledVector(F, -Lfull).add(V(0, 0.03, 0)); rel = { t: tRel, p0: nk }; }
        const u = (t - tRel) / (tHit - tRel), tail = hitP.clone().addScaledVector(F, -0.76);
        if (u < 1) { const p = arc(rel.p0, tail, 0.42, u), p2 = arc(rel.p0, tail, 0.42, Math.min(1, u + 0.01)); orientZ(arrow, p, p2.clone().sub(p).lengthSq() > 1e-10 ? p2.sub(p) : F, UPY); }
        else { const w = Math.exp(-(t - tHit) * 5) * Math.sin((t - tHit) * 55) * 0.012; orientZ(arrow, tail.clone().add(V(w * 0.76, w * 0.5, 0)), F.clone().add(V(-w, -w * 0.6, 0)), UPY); }
      }
      // camera: archer → follows the arrow → the face → back to the archer
      const r = env.rig.root.position, Ha = Math.max(1, s), archer = V(r.x, 1.32 * s, r.z).addScaledVector(F, 0.35);
      const tgtF = V(hitP.x, RANGE.faceY - 0.05, hitP.z - 0.2);
      const go = smooth(span(t, tRel + 0.02, tHit + 0.05)), back = smooth(span(t, tBack, tBack + 0.12)), k = go * (1 - back);
      return { focus: archer.lerp(tgtF, k), radius: lerp(3.9 * Ha, 2.7, k), fixedY: k > 0.02, mood: t > tHit ? { joy: Math.min(1, (t - tHit) / 0.4) * (o.calm ? 0.65 : 1) } : { focus: Math.min(1, 0.35 + t / tRel) } };
    }
  };
}

/* ================================================================== GOLF */
/* ---- a par-4 hole: tee at the origin, play toward +Z along x = -1; the green ~330 m away with flag and cup */
const GBR = 0.027;   // golf ball drawn slightly larger than 42.7 mm so it reads on small screens
const HOLE = { lineX: -1, green: V(-1, 0, 330), cup: V(0, 0, 324), greenR: [11, 14] };
function golfBall() { const m = new THREE.Mesh(new THREE.SphereGeometry(GBR, 16, 12), M('#fbfbf8', { roughness: 0.35 })); m.castShadow = true; return m; }
function buildGolf(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = skyTex('#4f93d6', '#a2cdee', '#e8f1ee'); scene.fog = new THREE.Fog('#dbe8ea', 120, 520);
  const X = HOLE.lineX, Gc = HOLE.green;
  add(g, Plane(900, 900), new THREE.MeshStandardMaterial({ map: grassTex(51, '#3d7f36', '#41863a', 6, [80, 80]), roughness: 1 }), [X, -0.03, 200], FLAT, false);
  const fair = canvasTex(64, 512, (x, w, h) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#5aa548' : '#66b352'; x.fillRect(0, i * h / 16, w, h / 16); } const r = rng(5); for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(30,80,20,${r() * 0.12})`; x.fillRect(r() * w, r() * h, 1, 2); } }, [1, 10]);
  add(g, Plane(38, 300), new THREE.MeshStandardMaterial(OV(1, { map: fair, roughness: 0.9 })), [X, 0, 165], FLAT, false);
  const teeTex = canvasTex(64, 128, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#62ae4f' : '#6dba58'; x.fillRect(0, i * h / 8, w, h / 8); } }, [1, 1]);
  add(g, Plane(9, 16), new THREE.MeshStandardMaterial(OV(2, { map: teeTex, roughness: 0.9 })), [X, 0, 0], FLAT, false);
  for (const sx of [-2.6, 2.6]) { add(g, Box(0.16, 0.1, 0.1), M('#2a5c9a', { roughness: 0.5 }), [X + sx, 0.05, 1.6]); add(g, Box(0.1, 0.05, 0.06), M('#e8e8e2'), [X + sx, 0.12, 1.6]); }
  // green, collar, cup and flag
  const greenTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#74c25e'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'; x.fillRect(i * w / 8, 0, w / 8, h); } const r = rng(9); for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(20,70,20,${r() * 0.08})`; x.fillRect(r() * w, r() * h, 1, 1); } }, [3, 3]);
  const collar = add(g, new THREE.CircleGeometry(1, 48), M('#5fae4c', OV(2, { roughness: 0.9 })), [Gc.x, 0, Gc.z], FLAT, false); collar.scale.set(HOLE.greenR[0] + 1.4, HOLE.greenR[1] + 1.4, 1);
  const green = add(g, new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial(OV(3, { map: greenTex, roughness: 0.75 })), [Gc.x, 0, Gc.z], FLAT, false); green.scale.set(HOLE.greenR[0], HOLE.greenR[1], 1);
  const C = HOLE.cup;
  add(g, new THREE.CircleGeometry(0.054, 24), MB('#0b0d0c', OV(5)), [C.x, 0, C.z], FLAT, false);
  add(g, new THREE.RingGeometry(0.048, 0.056, 24), MB('#f2f2ee', OV(6)), [C.x, 0, C.z], FLAT, false);
  add(g, Cyl(0.0065, 0.0065, 2.13, 8), M('#f4f4ef', { roughness: 0.4 }), [C.x, 1.065, C.z]);
  const flag = add(g, Plane(0.5, 0.34), M('#f2c94c', { side: THREE.DoubleSide, roughness: 0.8 }), [C.x + 0.25, 1.95, C.z], [0, 0.35, 0]); flag.castShadow = true;
  // bunkers
  const sand = M('#e2cf9c', OV(2, { roughness: 1 }));
  for (const [x, z, rx, rz, ry] of [[Gc.x - 13, Gc.z - 4, 3.2, 6, 0.3], [Gc.x + 12, Gc.z + 6, 2.6, 4.5, -0.4], [X + 16, 232, 4, 9, 0.2], [X - 17, 255, 3.5, 7, -0.2]]) { const b = add(g, new THREE.CircleGeometry(1, 32), sand, [x, 0, z], [-PI / 2, 0, ry], false); b.scale.set(rx, rz, 1); }
  // tree lines (instanced)
  const r = rng(77), pos = [];
  for (let z = -20; z <= 380; z += 11) for (const side of [-1, 1]) { const x = X + side * (27 + r() * 12); if (Math.abs(z - Gc.z) < 25 && Math.abs(x - Gc.x) < 22) continue; pos.push([x, z, 5 + r() * 4, 2.2 + r() * 1.4]); }
  const trunkI = new THREE.InstancedMesh(Cyl(0.18, 0.25, 1, 6), M('#5a4030'), pos.length), crownI = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), M('#2f6b34', { roughness: 0.95 }), pos.length);
  const m4 = new THREE.Matrix4();
  pos.forEach(([x, z, h, c], i) => { m4.compose(V(x, h * 0.3, z), new THREE.Quaternion(), V(1, h * 0.6, 1)); trunkI.setMatrixAt(i, m4); m4.compose(V(x, h * 0.6 + c, z), new THREE.Quaternion(), V(c, c * 1.25, c)); crownI.setMatrixAt(i, m4); });
  trunkI.castShadow = crownI.castShadow = true; g.add(trunkI, crownI);
  // a low gallery mound and distant hills
  for (const [x, z, sx, sz] of [[X - 60, 140, 40, 220], [X + 70, 180, 50, 240], [X, 470, 160, 60]]) { const h = add(g, new THREE.SphereGeometry(1, 16, 8, 0, PI * 2, 0, PI / 2), M('#4d8a44', { roughness: 1 }), [x, -0.5, z], null, false); h.scale.set(sx, 9, sz); }
  return { group: g, cup: C.clone() };
}

/* clubs: butt at the origin, shaft along +Y to the head; the face looks along local -X, the toe along +Z (right-handed) */
function makeClub(kind, mirror) {
  const g = new THREE.Group(), len = kind === 'driver' ? 1.13 : kind === 'putter' ? 0.86 : 0.9, lie = kind === 'driver' ? 50 : kind === 'putter' ? 70 : 62;
  add(g, Cyl(0.0135, 0.011, 0.27, 10), M('#1c1e20', { roughness: 0.85 }), [0, 0.135, 0]);
  add(g, Cyl(0.007, 0.0045, len - 0.27, 8), M(kind === 'driver' ? '#2b2f35' : '#c9cfd4', { metalness: kind === 'driver' ? 0.3 : 0.85, roughness: 0.3 }), [0, 0.27 + (len - 0.27) / 2, 0]);
  const head = new THREE.Group(); head.position.y = len; g.add(head);
  const sole = new THREE.Group(); sole.rotation.x = PI - (90 - lie) * D2R; head.add(sole);   // sole frame: +Y up, -Z toward the toe when the shaft sits at its lie angle
  if (kind === 'driver') {
    const body = add(sole, new THREE.SphereGeometry(0.06, 20, 12), M('#22262b', { metalness: 0.4, roughness: 0.25 }), [0.045, 0.032, -0.055]); body.scale.set(0.95, 0.55, 1.0);
    add(sole, Box(0.004, 0.05, 0.1), M('#8d949a', { metalness: 0.7, roughness: 0.3 }), [-0.008, 0.03, -0.055]);
    add(sole, Cyl(0.007, 0.009, 0.05, 8), M('#22262b'), [0.0, 0.025, -0.005]);
  } else if (kind === 'putter') {
    add(sole, Box(0.025, 0.026, 0.105), M('#b9c0c6', { metalness: 0.85, roughness: 0.25 }), [0.012, 0.014, -0.05]);
    add(sole, Box(0.04, 0.012, 0.07), M('#9aa1a7', { metalness: 0.85, roughness: 0.3 }), [0.04, 0.008, -0.05]);
    add(sole, Cyl(0.004, 0.004, 0.05, 6), M('#b9c0c6', { metalness: 0.8 }), [0.0, 0.03, -0.012]);
  } else {
    const bl = add(sole, Box(0.012, 0.05, 0.075), M('#d3d8dc', { metalness: 0.85, roughness: 0.22 }), [0.004, 0.026, -0.045]); bl.rotation.z = -0.9;   // lofted wedge face
    add(sole, Cyl(0.007, 0.009, 0.06, 8), M('#d3d8dc', { metalness: 0.85 }), [0, 0.03, -0.004]);
  }
  if (mirror) g.scale.x = -1;
  g.userData.len = len; g.userData.head = head; g.userData.sole = sole;
  g.userData.face = kind === 'driver' ? V(-0.01, 0.032, -0.055) : kind === 'putter' ? V(-0.001, 0.014, -0.05) : V(-0.004, 0.02, -0.045);
  return g;
}
const ADDRESS_D = lie => [0, -Math.sin(lie * D2R), Math.cos(lie * D2R)], ADDRESS_T = lie => [0, Math.cos(lie * D2R), Math.sin(lie * D2R)];
/* place a club from the hands' mid point H (local, 1.85-scaled), shaft direction D and toe direction T (local); returns world butt + dir */
function placeClub(env, club, H, D, T, dy = 0) {
  const d = env.dir(D).normalize(), tw = env.dir(T), hw = env.ws(H); hw.y += dy;
  const K = hw.clone().addScaledVector(d, -0.11);
  orient(club, K, d, tw); club.updateMatrixWorld(true);
  return { K, d, head: club.userData.head.getWorldPosition(V()) };
}
const faceCentre = club => club.userData.sole.localToWorld(club.userData.face.clone());
function headLift(env, club, H, D, T, want) { const c = placeClub(env, club, H, D, T); return want - c.head.y; }
function gripClub(env, c, poleL, poleR, wR = 1) {
  env.reach('l', c.K.clone().addScaledVector(c.d, 0.06), poleL, { weight: 1 });
  env.reach('r', c.K.clone().addScaledVector(c.d, 0.155), poleR, { weight: wR });
}
/* feet: record in the address pose (FK), then keep them planted with leg IK; the trail foot can pivot onto its toe */
function recordFeet(env) {
  const f = {}; for (const sd of ['l', 'r']) { const S = env.side(sd); f[sd] = { ank: env.rig.bones[S + 'Foot'].getWorldPosition(V()), q: env.rig.bones[S + 'Foot'].getWorldQuaternion(new THREE.Quaternion()), toe: env.rig['toe_' + S].getWorldPosition(V()) }; } return f;
}
function plantFeet(env, f, pivot = 0, poleL = [0.35, 0.5, 1.2], poleR = [-0.35, 0.5, 1.2]) {
  legIK(env, 'l', f.l.ank, env.world(poleL), f.l.q);
  if (pivot > 0.01) {
    const toeDir = V(0, 0, 1).applyQuaternion(f.r.q).setY(0).normalize().applyAxisAngle(UPY, (env.mirror ? -1 : 1) * 62 * D2R * pivot);
    const q = footQuat(toeDir, 68 * pivot), ank = ankleFor(env, 'r', f.r.toe, q, 'toe');
    legIK(env, 'r', ank, env.world([lerp(poleR[0], 0.5, pivot), 0.5, lerp(poleR[2], 0.6, pivot)]), q);
  } else legIK(env, 'r', f.r.ank, env.world(poleR), f.r.q);
}

/* tube along points whose radius grows with distance from the start (reads like a broadcast tracer from the tee) */
function taperTube(pts, r0, k, radial = 5) {
  const n = pts.length, pos = new Float32Array(n * radial * 3), idx = []; let d = 0;
  for (let i = 0; i < n; i++) {
    if (i) d += pts[i].distanceTo(pts[i - 1]);
    const tg = (i < n - 1 ? pts[i + 1].clone().sub(pts[i]) : pts[i].clone().sub(pts[i - 1])).normalize();
    const ax = Math.abs(tg.y) < 0.9 ? UPY : V(1, 0, 0), u = V().crossVectors(tg, ax).normalize(), w = V().crossVectors(tg, u), r = r0 + k * d;
    for (let j = 0; j < radial; j++) { const th = j / radial * 2 * PI; const p = pts[i].clone().addScaledVector(u, Math.cos(th) * r).addScaledVector(w, Math.sin(th) * r); pos.set([p.x, p.y, p.z], (i * radial + j) * 3); }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, e = b + radial; idx.push(a, c, b, b, c, e); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  return { geo, per: radial * 6, segs: n - 1 };
}
function offsetTrack(track, off) { return t => { const q = track(t); q.x += off.x; q.z += off.z; return q; }; }
/* camera for putts and chips: golfer → rides along with the rolling ball → back to the golfer for the reaction */
function shortGameCam(env, t, tI, tDrop, ball) {
  const s = env.s, r = env.rig.root.position, H = Math.max(1, s), me = V(r.x, 0.8 * s, r.z).add(env.dir([0.25, 0, 0.3]));
  const go = smooth(span(t, tI + 0.1, tI + 0.7)) * (1 - smooth(span(t, tDrop + 0.35, tDrop + 0.95)));
  const b = ball.clone().setY(0.35).addScaledVector(env.dir([1, 0, 0]), 0.4);
  return { focus: me.lerp(b.setY(0.6), go), radius: lerp(3.9 * H, 5.2, go), fixedY: go > 0.05 };
}
/* style notes per golfer (only what the catalogue / public record supports) */
const DRIVE_STYLE = {
  'rory-mcilroy': { launch: 14.5 },                 // "high-ball"
  'yani-tseng': { launch: 12.5, tempo: 0.95 },      // "aggressive, long-driver"
  'annika-sorenstam': { headEarly: true },          // her well-known early head rotation toward the target through impact
  'tiger-woods': { launch: 11.5 }
};

/* rolling ball on the green: from p0 to the cup with a gentle break; returns position at time tt (and whether it dropped) */
function rollPath(p0, cup, brk, decel) {
  const L = p0.distanceTo(cup), v0 = Math.sqrt(2 * decel * (L + 0.35)), tIn = (v0 - Math.sqrt(Math.max(0, v0 * v0 - 2 * decel * L))) / decel;
  const dir = cup.clone().sub(p0).setY(0).normalize(), side = V(dir.z, 0, -dir.x);
  const at = (sd, out) => { const u = sd / L; return out.copy(p0).addScaledVector(dir, sd).addScaledVector(side, brk * 4 * u * (1 - u)).setY(GBR); };
  return { tIn, L, v0, at(tt, out = V()) {
    if (tt <= tIn) { const sd = v0 * tt - 0.5 * decel * tt * tt; at(sd, out); out.userData = sd; return out; }
    const f = Math.min(1, (tt - tIn) / 0.12); out.copy(cup).setY(GBR - 0.09 * f * f); return out;
  } };
}

/* putting stroke: arms + putter rock as one pendulum from the shoulders; the ball breaks into the cup */
function putt(a, o = {}) {
  const st = Object.assign({ dist: 4.6, brk: 0.22, back: 9, thru: 12, react: 'wave' }, o, PUTT_STYLE[a.id] || {});
  const t0 = 1.6, tb = t0 + 0.55, tI = tb + 0.42, tF = tI + 0.3;
  const ad = ADDRESS_D(70), at = ADDRESS_T(70), H0 = [0.0, 0.72, 0.33], PV = [0.0, 1.36, 0.16];
  let club, feet, roll, tDrop = 0, dur = 7, body, p0, dy = 0;
  const theta = numTrack([[0, 0], [1.0, 0], [1.15, 1.2], [1.3, 0], [t0, 0], [tb, st.back], [tI, 0], [tF, -st.thru], [tF + 1.2, -st.thru]]);
  return {
    venue: 'golfHole', get dur() { return dur; }, hold: 0.8, get payoff() { return tDrop; }, mirror: a.handedness === 'left',
    start(env) {
      const s = env.s, cup = HOLE.cup;
      golfHat(env, a);
      p0 = cup.clone().add(V(st.brk * 0.25, 0, -st.dist)); p0.y = GBR;
      roll = rollPath(p0, cup, env.mirror ? -st.brk : st.brk, 1.25); tDrop = tI + roll.tIn; dur = tDrop + 2.4;
      const rx = 0, rz = 0, look = 18;
      body = poseTrack([
        [0, Object.assign({ x: rx, z: rz, ry: -90 }, G_ADDR, { hipsX: 28, spineX: 18, chestX: 8, neckX: 14, headX: 22, lKnee: 18, rKnee: 18, lHipF: 40, rHipF: 40, lHipA: 6, rHipA: 6, lHipR: 4 })],
        [0.6, { neckY: 34, headY: look + 20, headX: 10 }], [1.0, { neckY: 0, headY: 0, headX: 22 }],
        [tI + 0.25, {}], [tI + 0.6, { neckY: 30, headY: 34, headX: 8 }],
        [tDrop - 0.1, { neckY: 34, headY: 38, headX: 4 }],
        [tDrop + 0.5, Object.assign({}, STAND, { hipsX: 4, spineX: 6, neckY: 20, headY: 24, headX: -4, joy: 1 })],
        [dur, { neckY: 10, headY: 10 }]
      ]);
      club = env.addProp(makeClub('putter', env.mirror));
      put(env, body(0)); dy = headLift(env, club, H0.map(v => v * s), ad, at, 0.004);
      const fc = faceCentre(club), tgt = env.dir([1, 0, 0]); this._off = p0.clone().sub(fc).addScaledVector(tgt, -(GBR + 0.006));
      body = offsetTrack(body, this._off); put(env, body(0)); feet = recordFeet(env);
    },
    frame(t, env) {
      const s = env.s, q = body(t), th = theta(t);
      q.chestY = -th * 0.7; put(env, q);
      const stand = smooth(span(t, tDrop + 0.05, tDrop + 0.5));
      if (stand < 1) plantFeet(env, feet, 0);
      // pendulum: rotate hands and shaft about the shoulder pivot (axis normal to the stroke plane)
      const D0 = V(...ad), X = V(1, 0, 0), n = V().crossVectors(X, D0).normalize(), ang = th * D2R;
      const pv = V(...PV), h = V(...H0).sub(pv).applyAxisAngle(n, ang).add(pv), d = D0.clone().applyAxisAngle(n, ang), tq = V(...at).applyAxisAngle(n, ang);
      if (stand > 0) {   // after the putt drops: stand up, putter in the lead hand, trail hand acknowledges
        h.lerp(V(0.2, 0.86, 0.22), stand); d.lerp(V(0.1, -0.95, 0.25), stand).normalize(); tq.lerp(V(1, 0.2, 0), stand);
      }
      const c = placeClub(env, club, h.toArray().map(v => v * s), d.toArray(), tq.toArray(), dy * (1 - stand));
      gripClub(env, c, [0.6, 0.9, 0.3], [-0.6, 0.9, 0.3], 1 - stand);
      if (stand > 0) {
        const k = t - tDrop, wave = st.react === 'fist' ? env.ws([-0.3, 1.2 + 0.45 * smooth(span(k, 0.2, 0.5)) - 0.25 * smooth(span(k, 0.6, 0.8)) + 0.25 * smooth(span(k, 0.9, 1.1)), 0.35], false) : env.ws([-0.3, 1.55, 0.35], false).add(env.dir([0, 0.03 * Math.sin(k * 8), 0]));
        env.reach('r', wave, st.react === 'fist' ? [-0.8, 0.8, 0.0] : [-0.8, 1.0, -0.2], { weight: stand });
      }
      const B = env.props.ball; if (t < tI) B.position.copy(p0); else roll.at(t - tI, B.position);
      return shortGameCam(env, t, tI, tDrop, B.position);
    }
  };
}
const PUTT_STYLE = {
  'inbee-park': { dist: 4.4, brk: 0.16, react: 'wave' },     // "putter, calm": still head, unhurried stroke, quiet acknowledgement
  'lydia-ko': { dist: 5.2, brk: 0.3, react: 'fist' }         // "short-game, putter": longer breaking putt
};

/* chip from the fringe that runs into the cup, then the uppercut fist pump */
function chipIn(a) {
  const t1 = 1.3, tTop = t1 + 0.55, tI = tTop + 0.24, tF = tI + 0.35;
  const ad = ADDRESS_D(62), at = ADDRESS_T(62), H0 = [0.1, 0.76, 0.34];
  let club, feet, body, p0, land, roll, tLand = 0, tDrop = 0, dur = 7, dy = 0;
  const hand = vecTrack([[0, H0], [t1, H0], [tTop, [-0.32, 0.98, 0.3]], [tI, [0.12, 0.76, 0.35]], [tF, [0.38, 0.95, 0.3]], [tF + 0.8, [0.36, 0.93, 0.3]]]);
  const dirT = vecTrack([[0, ad], [t1, ad], [tTop, [-0.85, 0.42, 0.32]], [tI, [-0.08, -0.88, 0.46]], [tF, [0.9, -0.15, 0.4]], [tF + 0.8, [0.88, -0.2, 0.42]]]);
  const toeT = vecTrack([[0, at], [t1, at], [tTop, [0.3, 0.8, -0.5]], [tI, at], [tF, [0.1, 0.6, -0.8]], [tF + 0.8, [0.1, 0.6, -0.8]]]);
  return {
    venue: 'golfHole', get dur() { return dur; }, hold: 0.8, get payoff() { return tDrop; }, mirror: a.handedness === 'left',
    start(env) {
      const s = env.s, cup = HOLE.cup; golfHat(env, a);
      p0 = cup.clone().add(V(0.12, 0, -10.2)); p0.y = GBR;
      land = p0.clone().add(V(0.0, 0, 3.6)); tLand = tI + 0.72;
      roll = rollPath(land, cup, env.mirror ? -0.08 : 0.08, 1.7); tDrop = tLand + 0.18 + roll.tIn; dur = tDrop + 2.2;
      const rx = 0, rz = 0;
      body = poseTrack([
        [0, Object.assign({ x: rx, z: rz, ry: -86 }, G_ADDR, { lHipR: 16, hipsY: 6 })],
        [0.5, { neckY: 34, headY: 34, headX: 6 }], [0.95, { neckY: 0, headY: 0, headX: 12 }], [t1, {}],
        [tTop, { hipsY: -6, chestY: -28, neckY: 18, headY: 12 }],
        [tI, { hipsY: 20, chestY: -2, neckY: -2, headY: 0, z: rz + 0.03 }],
        [tF, { hipsY: 36, chestY: 14, neckY: -8, headY: -10, headX: 8 }],
        [tLand, { neckY: -20, headY: -26, headX: 0, spineX: 9 }],
        [tDrop - 0.25, { neckY: -24, headY: -34, headX: -2, hipsY: 40, chestY: 20 }],
        [tDrop + 0.12, Object.assign({}, STAND, { ry: -40, hipsY: 0, chestY: 0, hipsX: 14, spineX: 14, lHipF: 30, rHipF: 22, lKnee: 34, rKnee: 30, neckY: 0, headY: 0, headX: -6, joy: 1 })],
        [tDrop + 0.45, { spineX: 22, lKnee: 44, rKnee: 40, lHipF: 38, rHipF: 30, headX: -14 }],
        [tDrop + 0.75, { spineX: 10, lKnee: 24, rKnee: 22 }],
        [tDrop + 1.0, { spineX: 20, lKnee: 40, rKnee: 36 }],
        [dur, { spineX: 8, lKnee: 14, rKnee: 12, lHipF: 14, rHipF: 12, hipsX: 4 }]
      ]);
      club = env.addProp(makeClub('wedge', env.mirror));
      put(env, body(0)); dy = headLift(env, club, hand(0).map(v => v * s), dirT(0), toeT(0), 0.006);
      put(env, body(tI)); placeClub(env, club, hand(tI).map(v => v * s), dirT(tI), toeT(tI), dy);
      const fc = faceCentre(club), tgt = env.dir([1, 0, 0]); this._off = p0.clone().sub(fc).addScaledVector(tgt, -(GBR + 0.004)); this._off.y = 0;
      body = offsetTrack(body, this._off); put(env, body(0)); feet = recordFeet(env);
    },
    frame(t, env) {
      const s = env.s; put(env, body(t));
      const free = smooth(span(t, tDrop - 0.2, tDrop + 0.1));
      if (free < 1) plantFeet(env, feet, 0, [0.3, 0.5, 1.2], [-0.3, 0.5, 1.2]);
      let h = V(...hand(t)), d = V(...dirT(t)).normalize(), tq = V(...toeT(t));
      if (free > 0) { h.lerp(V(0.3, 0.86, 0.15), free); d.lerp(V(0.2, -0.95, 0.15), free).normalize(); tq.lerp(V(1, 0.2, 0), free); }
      const c = placeClub(env, club, h.toArray().map(v => v * s), d.toArray(), tq.toArray(), dy * (1 - free));
      gripClub(env, c, [0.7, 0.9, 0.2], [-0.6, 0.8, 0.3], 1 - free);
      if (free > 0) {   // uppercut fist pump with the trail hand
        const k = t - tDrop, pump = k < 0.35 ? smooth(k / 0.35) : k < 0.6 ? 1 - 0.8 * smooth((k - 0.35) / 0.25) : k < 0.9 ? 0.2 + 0.8 * smooth((k - 0.6) / 0.3) : 1 - 0.75 * smooth((k - 0.9) / 0.25);
        const low = env.ws([-0.3, 1.08, 0.36], false), high = env.ws([-0.36, 1.78, 0.3], false);
        env.reach('r', low.lerp(high, pump), [-0.75, 0.9, -0.15], { weight: free });
      }
      const B = env.props.ball;
      if (t < tI) B.position.copy(p0);
      else if (t < tLand) { const u = (t - tI) / (tLand - tI); arc(p0, land, 1.15, u, B.position); }
      else if (t < tLand + 0.18) { const u = (t - tLand) / 0.18; B.position.lerpVectors(land, roll.at(0, V()), u); B.position.y = GBR + 0.12 * 4 * u * (1 - u); }
      else roll.at(t - tLand - 0.18, B.position);
      return shortGameCam(env, t, tI, tDrop, B.position);
    }
  };
}

function golfHat(env, a) { const acc = a.appearance && a.appearance.accessory; if (acc === 'visor') env.rig.setHeadwear('visor'); }
const G_ADDR = { hipsX: 24, spineX: 12, chestX: 6, neckX: 10, headX: 12, lHipF: 38, rHipF: 38, lKnee: 20, rKnee: 20, lAnk: -6, rAnk: -6, lHipA: 9, rHipA: 9, lHipR: 8, rHipR: 0, lShF: 30, rShF: 30, lEl: 10, rEl: 18 };
/* full swing with the driver: waggle, takeaway, top (optional pause), downswing, impact, high finish, ball flight with tracer */
function drive(a, o = {}) {
  o = Object.assign({}, DRIVE_STYLE[a.id] || {}, o);
  const tempo = o.tempo || 1, t1 = 1.45, tTop = t1 + 0.9 * tempo, tTop2 = tTop + (o.pause || 0), tImp = tTop2 + 0.29, tFin = tImp + 0.55, dur = tImp + (o.watch || 2.7);
  const B = t => t - tTop2;   // downswing clock
  const body = poseTrack([
    [0, Object.assign({ x: 0, z: 0, ry: -90 }, G_ADDR)],
    [0.55, { neckY: 30, headY: 32, headX: 4 }], [0.95, { neckY: 0, headY: 0, headX: 12 }],
    [t1, {}],
    [t1 + 0.4 * tempo, { hipsY: -18, chestY: -28, neckY: 22, headY: 18, spineZ: 2 }],
    [tTop, { hipsY: -42, chestY: -50, spineZ: 6, spineX: 10, neckY: 40, headY: 36, lKnee: 28, lHipF: 42, rKnee: 16, lHipR: 18, z: -0.01 }],
    [tTop2, {}],
    [tTop2 + 0.14, { hipsY: -8, chestY: -46, spineZ: 8, neckY: 32, headY: 30, lKnee: 16, rKnee: 24, z: 0.04 }],
    [tImp, { hipsY: 36, chestY: -18, spineZ: 16, spineX: 14, neckY: -4, headY: -6, headX: 14, lKnee: 8, rKnee: 26, lHipR: 0, z: 0.06 }],
    [tImp + 0.14, { hipsY: 62, chestY: 4, spineZ: 12, spineX: 8, neckY: -20, headY: -24, headX: 4 }],
    [tFin, { hipsY: 86, chestY: 16, spineZ: 4, spineX: 2, hipsX: 6, chestX: 0, neckX: 0, neckY: -30, headY: -38, headX: -12, lKnee: 6, rKnee: 30, z: 0.07 }],
    [tFin + 0.6, { headX: -16, neckY: -34 }],
    [dur, { headX: -14, hipsY: 84 }]
  ]);
  const ad = ADDRESS_D(50), at = ADDRESS_T(50), H0 = [0.05, 0.8, 0.36];
  const hand = vecTrack([[0, H0], [0.6, H0], [0.75, [0.02, 0.81, 0.35]], [0.9, H0], [t1, H0],
    [t1 + 0.38 * tempo, [-0.3, 0.88, 0.32]], [t1 + 0.62 * tempo, [-0.42, 1.2, 0.17]], [tTop, [-0.3, 1.5, -0.06]], [tTop2, [-0.31, 1.5, -0.07]],
    [tTop2 + 0.15, [-0.4, 1.12, 0.16]], [tTop2 + 0.23, [-0.22, 0.9, 0.31]], [tImp, [0.11, 0.8, 0.36]], [tImp + 0.07, [0.36, 0.9, 0.31]], [tImp + 0.17, [0.44, 1.24, 0.12]], [tFin, [0.13, 1.5, -0.2]], [dur, [0.12, 1.46, -0.18]]]);
  const dirT = vecTrack([[0, ad], [0.6, ad], [0.75, [-0.25, -0.73, 0.62]], [0.9, ad], [t1, ad],
    [t1 + 0.38 * tempo, [-0.98, 0.06, 0.18]], [t1 + 0.62 * tempo, [-0.2, 0.94, 0.25]], [tTop, [0.9, 0.12, -0.42]], [tTop2, [0.9, 0.1, -0.42]],
    [tTop2 + 0.15, [-0.3, 0.93, -0.2]], [tTop2 + 0.23, [-0.86, 0.3, 0.42]], [tImp, [-0.05, -0.766, 0.64]], [tImp + 0.07, [0.97, 0.05, 0.22]], [tImp + 0.17, [0.25, 0.94, -0.2]], [tFin, [-0.55, -0.32, -0.77]], [dur, [-0.5, -0.4, -0.76]]]);
  const toeT = vecTrack([[0, at], [t1, at], [t1 + 0.38 * tempo, [0, 1, 0]], [t1 + 0.62 * tempo, [-0.9, 0.05, -0.4]], [tTop, [0.1, -0.7, -0.7]], [tTop2, [0.1, -0.7, -0.7]],
    [tTop2 + 0.15, [-0.9, -0.1, -0.4]], [tTop2 + 0.23, [0, 0.9, -0.4]], [tImp, at], [tImp + 0.07, [0, 1, 0]], [tImp + 0.17, [0.9, 0.1, 0.4]], [tFin, [0, 1, 0.3]], [dur, [0, 1, 0.3]]]);
  const poleL = vecTrack([[0, [0.7, 0.9, 0.2]], [tTop, [0.3, 1.0, 0.6]], [tImp, [0.8, 0.8, 0.0]], [tFin, [0.8, 1.6, -0.3]]]);
  const poleR = vecTrack([[0, [-0.7, 0.8, 0.1]], [tTop, [-0.4, 0.6, -0.1]], [tImp, [-0.6, 0.7, 0.4]], [tFin, [0.0, 1.0, 0.6]]]);
  let club, feet, ball0, tee, flight = null, tracer, launch, dy = 0;
  return {
    venue: 'golfHole', dur, hold: 0.8, payoff: tImp + 0.6, mirror: a.handedness === 'left',
    start(env) {
      golfHat(env, a);
      club = env.addProp(makeClub('driver', env.mirror));
      put(env, body(0)); feet = recordFeet(env); dy = headLift(env, club, hand(0).map(v => v * env.s), dirT(0), toeT(0), 0.012);
      // ball where the face centre is at impact
      put(env, body(tImp)); placeClub(env, club, hand(tImp).map(v => v * env.s), dirT(tImp), toeT(tImp), dy);
      ball0 = faceCentre(club).add(env.dir([1, 0, 0]).multiplyScalar(0.03)); ball0.y = Math.max(GBR + 0.035, ball0.y);
      tee = new THREE.Group(); add(tee, Cyl(0.006, 0.002, 0.05, 8), M('#f6f6f0'), [0, -0.025, 0]); add(tee, Cyl(0.009, 0.006, 0.006, 8), M('#f6f6f0'), [0, 0.0, 0]); tee.position.set(ball0.x, ball0.y - GBR, ball0.z); env.addProp(tee);
      // ball flight: launch, drag, lift, curve; sampled at 120 Hz
      const tgt = env.dir([1, 0, 0]), side = env.dir([0, 0, 1]), la = (o.launch || 12) * D2R;
      let p = ball0.clone(), v = tgt.clone().multiplyScalar(Math.cos(la) * 74).add(V(0, Math.sin(la) * 74, 0)); const pts = [], dt = 1 / 120;
      for (let i = 0; i < 900 && p.y >= 0.02; i++) { pts.push(p.clone()); const sp = v.length(); const acc = V(0, -9.8, 0).addScaledVector(v, -0.0042 * sp).add(V(0, 0.0034 * sp * sp * 0.9 / 74, 0)).addScaledVector(side, (o.fade || 0) * 0.012 * sp); v.addScaledVector(acc, dt); p = p.clone().addScaledVector(v, dt); }
      flight = { pts, dt };
      const tt = taperTube(pts.filter((_, i) => i % 4 === 0), 0.012, 0.0032);
      tracer = new THREE.Mesh(tt.geo, new THREE.MeshBasicMaterial({ color: '#ff4a2a', fog: false, transparent: true, opacity: 0.9 }));
      env.addProp(tracer); tracer.castShadow = false; tracer.receiveShadow = false; tracer.geometry.setDrawRange(0, 0); tracer.userData.tt = tt;
      launch = pts.length;
    },
    frame(t, env) {
      const s = env.s, q = body(t);
      if (o.headEarly) { const k = smooth(span(t, tImp - 0.06, tImp + 0.12)); q.neckY = lerp(q.neckY, -34, k); q.headY = lerp(q.headY, -40, k); q.headX = lerp(q.headX, -8, k); }
      put(env, q);
      const pivot = smooth(span(t, tImp + 0.05, tFin + 0.1));
      plantFeet(env, feet, pivot);
      const c = placeClub(env, club, hand(t).map(v => v * s), dirT(t), toeT(t), dy);
      gripClub(env, c, poleL(t), poleR(t));
      const B0 = env.props.ball;
      if (t < tImp) { B0.position.copy(ball0); tracer.geometry.setDrawRange(0, 0); }
      else {
        const f = (t - tImp) / flight.dt, i = Math.min(flight.pts.length - 2, Math.floor(f)), u = Math.min(1, f - i);
        B0.position.lerpVectors(flight.pts[i], flight.pts[i + 1], u);
        const tt = tracer.userData.tt, frac = Math.min(1, f / launch); tracer.geometry.setDrawRange(0, Math.floor(frac * tt.segs) * tt.per);
      }
      const r = env.rig.root.position, H = Math.max(1, s);
      return { focus: V(r.x, 1.0 * s, r.z).add(env.dir([0.15, 0, 0.35])), radius: 4.3 * H };
    }
  };
}

/* ================================================================== BOWLING */
/* ---- alley: foul line at z = 0, approach behind (-Z), lane 18.29 m to the head pin, 1.054 m wide (39 boards), gutters, neighbouring lanes */
const LANE = { w: 1.054, len: 18.29, board: 1.054 / 39, gutter: 0.235, spacing: 1.82, pinR: 0.06, ballR: 0.108 };
const PIN_SPOTS = [[0, 0], [0.152, 0.264], [-0.152, 0.264], [0.305, 0.528], [0, 0.528], [-0.305, 0.528], [0.457, 0.792], [0.152, 0.792], [-0.152, 0.792], [-0.457, 0.792]];   // pins 1..10 (+X = right-hander's left)
const boardX = b => -LANE.w / 2 + (b - 0.5) * LANE.board;   // board 1 at the right-hander's right edge
function laneTex() {
  return canvasTex(128, 2048, (x, w, h) => {
    const r = rng(12); for (let i = 0; i < 39; i++) { const v = 0.9 + r() * 0.1; x.fillStyle = `rgb(${Math.round(222 * v)},${Math.round(178 * v)},${Math.round(122 * v)})`; x.fillRect(i * w / 39, 0, w / 39 + 1, h); x.fillStyle = 'rgba(90,55,25,.25)'; x.fillRect(i * w / 39, 0, 0.6, h); }
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(110,70,30,${r() * 0.07})`; x.fillRect(r() * w, r() * h, 0.8, 20 + r() * 60); }
    const zToY = z => z / LANE.len * h, bx = b => (b - 0.5) / 39 * w;   // canvas top = foul line, left = board 1
    x.fillStyle = '#2a2420';
    for (const b of [5, 10, 15, 20, 25, 30, 35]) { const z = 4.88 - Math.abs(b - 20) / 5 * 0.3, y = zToY(z); x.beginPath(); x.moveTo(bx(b), y); x.lineTo(bx(b) - 2.2, y - 16); x.lineTo(bx(b) + 2.2, y - 16); x.closePath(); x.fill(); }
    for (const b of [3, 5, 8, 11, 14, 26, 29, 32, 35, 37]) { x.beginPath(); x.arc(bx(b), zToY(2.13), 1.3, 0, PI * 2); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, 0, w, h);
  });
}
function makePin() {
  const pts = [[0, 0.026], [0.012, 0.036], [0.05, 0.054], [0.105, 0.0605], [0.15, 0.056], [0.2, 0.038], [0.245, 0.0245], [0.28, 0.027], [0.315, 0.032], [0.345, 0.03], [0.368, 0.02], [0.381, 0]].map(([y, r]) => new THREE.Vector2(r, y));
  const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), M('#f7f6f1', { roughness: 0.25 })); g.add(body);
  for (const y of [0.252, 0.274]) add(g, new THREE.TorusGeometry(0.0258, 0.0035, 6, 18), M('#c8292c', { roughness: 0.4 }), [0, y, 0], [PI / 2, 0, 0]);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeBowlingBall(color, twoHand) {
  const g = new THREE.Group(), R = LANE.ballR;
  add(g, new THREE.SphereGeometry(R, 28, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.15 }));
  const hole = M('#0c0c0d', { roughness: 0.9 }), holes = twoHand ? [[0.02, 0.0], [-0.02, 0.0]] : [[0.02, 0.0], [-0.02, 0.0], [0, -0.055]];
  for (const [hx, hy] of holes) { const n = V(hx, hy, Math.sqrt(R * R - hx * hx - hy * hy)).normalize(); const d = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), hole); d.position.copy(n.clone().multiplyScalar(R + 0.0005)); d.lookAt(n.clone().multiplyScalar(2)); g.add(d); }
  return g;
}
function buildAlley(scene) {
  const g = new THREE.Group(); scene.add(g); const L = LANE;
  scene.background = new THREE.Color('#14161b'); scene.fog = new THREE.Fog('#14161b', 24, 48);
  const lane = new THREE.MeshStandardMaterial({ map: laneTex(), roughness: 0.22, metalness: 0.05 }), approach = M('#d9b783', { roughness: 0.35 });
  const gutterM = M('#3a3f45', { metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide }), cap = M('#2a3038', { roughness: 0.5 });
  add(g, Plane(12, 40), M('#23272e', { roughness: 0.9 }), [0, -0.01, 6], FLAT, false);
  const kickM = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.6, transparent: true, opacity: 1 }), dots = [], pinSpots = [];
  for (let k = -2; k <= 2; k++) {
    const x0 = k * L.spacing;
    add(g, Plane(L.w, L.len), lane, [x0, 0.0, L.len / 2], FLAT, false);
    add(g, Plane(L.w + 2 * L.gutter + 0.14, 4.9), approach, [x0, 0.0, -2.45], FLAT, false);
    add(g, Plane(L.w, 1.2), M('#e0c290', { roughness: 0.3 }), [x0, 0.0, L.len + 0.45], FLAT, false);                              // pin deck
    add(g, Box(L.w + 0.5, 0.6, 1.2), MB('#050506'), [x0, -0.31, L.len + 1.65], null, false);                                      // pit
    for (const sx of [-1, 1]) {
      const gx = x0 + sx * (L.w / 2 + L.gutter / 2);
      const gt = add(g, new THREE.CylinderGeometry(L.gutter / 2, L.gutter / 2, L.len + 1.0, 10, 1, true, PI / 2, PI), gutterM, [gx, 0.0, L.len / 2 + 0.5], [PI / 2, 0, 0], false); gt.receiveShadow = true;
      add(g, Box(0.12, 0.05, L.len + 1.0), cap, [x0 + sx * (L.w / 2 + L.gutter + 0.06), 0.02, L.len / 2 + 0.5]);
      add(g, Box(0.08, 0.8, 2.6), kickM, [x0 + sx * (L.w / 2 + L.gutter + 0.04), 0.4, L.len + 0.9]);   // kickbacks
    }
    add(g, Box(L.w + 0.6, 0.012, 0.02), MB('#121212'), [x0, 0.005, 0], null, false);                                             // foul line
    for (const z of [-3.66, -4.57]) for (const b of [5, 10, 15, 20, 25, 30, 35]) dots.push([x0 - boardX(b), z]);
    if (k !== 0) for (const [px, pz] of PIN_SPOTS) pinSpots.push([x0 + px, L.len + pz]);
  }
  // approach dots and the neighbours' pins as instanced meshes (cheap in software rendering)
  const m4 = new THREE.Matrix4(), flatQ = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -PI / 2);
  const dotI = new THREE.InstancedMesh(new THREE.CircleGeometry(0.008, 8), MB('#2a2420', OV(2)), dots.length);
  dots.forEach(([x, z], i) => { m4.compose(V(x, 0.001, z), flatQ, V(1, 1, 1)); dotI.setMatrixAt(i, m4); }); g.add(dotI);
  const pin = makePin(), parts = pin.children.filter(o => o.isMesh);
  for (const part of parts) { const im = new THREE.InstancedMesh(part.geometry, part.material, pinSpots.length); pinSpots.forEach(([x, z], i) => { m4.compose(V(x, part.position.y, z), part.quaternion, V(1, 1, 1)); im.setMatrixAt(i, m4); }); im.castShadow = true; g.add(im); }
  // masking unit above the pin decks, ceiling, light strips, walls, ball return, seating
  const mask = canvasTex(1024, 192, (x, w, h) => { const gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#16324f'); gr.addColorStop(0.5, '#244f7a'); gr.addColorStop(1, '#16324f'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,200,255,.35)'; x.lineWidth = 6; for (let i = -4; i < 14; i++) { x.beginPath(); x.moveTo(i * 90, h); x.lineTo(i * 90 + 140, 0); x.stroke(); } });
  add(g, Plane(10, 1.5), new THREE.MeshStandardMaterial({ map: mask, roughness: 0.8, emissive: '#0a1a2a', emissiveIntensity: 0.6 }), [0, 1.65, L.len + 0.55], [0, PI, 0], false);
  add(g, Box(10, 0.9, 0.3), M('#11141a'), [0, 2.85, L.len + 0.6]);
  add(g, Plane(12, 40), M('#1a1d22', { roughness: 1 }), [0, 3.6, 6], [PI / 2, 0, 0], false);
  for (let k = -2; k <= 2; k++) add(g, Box(0.25, 0.04, 16), MB('#fff4dc'), [k * L.spacing, 3.56, 8], null, false).castShadow = false;
  for (const sx of [-1, 1]) add(g, Plane(40, 3.6), M('#262b33', { roughness: 0.9 }), [sx * 4.9, 1.8, 6], [0, -sx * PI / 2, 0], false);
  add(g, Plane(12, 3.6), M('#2a2f37', { roughness: 0.9 }), [0, 1.8, -10], null, false);
  const rx = L.spacing / 2, rz = -2.2;
  add(g, Box(0.42, 0.6, 1.1), M('#3b4250', { roughness: 0.4, metalness: 0.2 }), [rx, 0.3, -3.2 + rz]);
  add(g, Box(0.4, 0.06, 0.9), M('#2b3038'), [rx, 0.62, -3.15 + rz]);
  add(g, Box(0.16, 0.04, 18), M('#2b3038'), [rx, 0.03, 6.5], null, false);
  for (const [dz, c] of [[-0.25, '#7a2bd0'], [0.05, '#1f7a6a'], [0.32, '#d04a2b']]) add(g, new THREE.SphereGeometry(0.108, 18, 12), M(c, { roughness: 0.2 }), [rx, 0.76, -3.2 + rz + dz]);
  for (const x of [-2.2, 0, 2.2]) { add(g, Box(1.6, 0.45, 0.55), M('#3c2f4a', { roughness: 0.8 }), [x, 0.22, -7.2]); add(g, Box(1.6, 0.5, 0.12), M('#3c2f4a'), [x, 0.6, -7.45]); }
  const clampCamera = p => { p.x = clamp(p.x, -4.5, 4.5); p.y = clamp(p.y, 0.5, 3.3); p.z = clamp(p.z, -9.4, L.len - 0.4); };
  // looking at the pins from beside the lane, the kickback boards would hide them: fade them
  const onCamera = p => { const k = clamp((Math.abs(p.x) - 0.6) / 0.6, 0, 1) * clamp((p.z - 12) / 3, 0, 1); kickM.opacity = 1 - 0.8 * k; kickM.depthWrite = k < 0.5; };
  return { group: g, clampCamera, onCamera };
}

/* strike: hand-authored scatter (deterministic) — which pin is hit when, where it flies, how it tumbles */
const STRIKE = [   // [pin index, hit delay, dir x, dir z, speed, hop]
  [0, 0.00, 0.55, 1, 3.2, 0.05], [2, 0.01, -0.55, 1, 3.4, 0.09], [4, 0.06, 0.15, 1, 2.8, 0.06], [1, 0.07, 0.62, 1, 2.6, 0.05], [8, 0.11, -0.12, 1, 2.4, 0.07],
  [5, 0.09, -0.9, 0.45, 2.6, 0.08], [3, 0.14, 0.85, 0.55, 2.2, 0.05], [7, 0.13, 0.1, 1, 2.0, 0.04], [9, 0.16, -0.45, 1, 2.1, 0.06], [6, 0.22, 0.35, 1, 1.8, 0.04]
];
function pinMotion(spot, hit, mx) {   // returns (tau) → { pos (base point), quat }
  const [, delay, dx, dz, sp, hop] = hit, dir = V(dx * mx, 0, dz).normalize(), axis = V().crossVectors(UPY, dir).normalize();
  const tauD = 0.42, fall = 0.22 + 0.1 * (1 - sp / 3.4), spinAx = V(dir.z, 0.6, -dir.x).normalize(), spin = (4 + sp * 3) * (hit[0] % 2 ? 1 : -1);
  const base0 = V(spot[0], 0, spot[1]);
  return tau => {
    tau -= delay; if (tau <= 0) return { pos: base0.clone(), quat: new THREE.Quaternion(), down: 0 };
    const tilt = Math.min(1, Math.pow(tau / fall, 1.4)) * PI / 2 * 1.02;
    let d = sp * tauD * (1 - Math.exp(-tau / tauD)), x = base0.x + dir.x * d, z = base0.z + dir.z * d;
    const wall = 0.84; if (Math.abs(x) > wall) x = Math.sign(x) * (2 * wall - Math.abs(x));
    const q = new THREE.Quaternion().setFromAxisAngle(axis, tilt), qs = new THREE.Quaternion().setFromAxisAngle(spinAx, spin * tauD * (1 - Math.exp(-tau / (tauD * 1.4))));
    q.premultiply(qs);
    const up = V(0, 1, 0).applyQuaternion(q), comH = lerp(0.15, 0.061, Math.min(1, Math.abs(up.angleTo(UPY)) / (PI / 2))) + hop * Math.max(0, Math.sin(PI * Math.min(1, tau / 0.3)));
    let y = comH; if (z > LANE.len + 1.05) y -= 4.9 * Math.pow(Math.max(0, tau - 0.15), 2) + 0.2;
    const com = V(x, y, z), pos = com.clone().addScaledVector(up, -0.15);
    return { pos, quat: q, down: tilt };
  };
}

const BOWL_COL = { 'earl-anthony': '#2b4aa8', 'walter-ray-williams-jr': '#1b1b22', 'pete-weber': '#b0262b', 'liz-johnson': '#7b2bd0', 'kelly-kulick': '#e2702a', 'jason-belmonte': '#1d8f8a' };
/* approach + delivery. o.kind: 'hook' | 'straight' | 'power' | 'twoHand' | 'spare' */
function bowl(a, o = {}) {
  const two = o.kind === 'twoHand', spare = o.kind === 'spare';
  const x0 = spare ? 0.34 : two ? 0.0 : 0.05, tS = 0.8;
  const st = [tS, tS + 0.36, tS + 0.72, tS + 1.06, tS + 1.34], tR = tS + 1.66, tSlide = tS + 1.66;
  const hook = { hook: [-0.135, -0.012, -0.06, 0.09, 8.2], straight: [-0.1, 0.0, -0.06, 0.035, 8.6], power: [-0.16, -0.016, -0.062, 0.105, 8.4], twoHand: [-0.2, -0.021, -0.064, 0.115, 8.0], spare: [0.3, -0.042, -0.457, -0.042, 8.3] }[o.kind || 'hook'];
  const zE = spare ? LANE.len + 0.79 - 0.17 : LANE.len - 0.165;
  let body, ballT, feetT, B, hipsK, pins = [], motions = [], tP = 0, dur = 8, path = null, ball, standH = 0, celeb;
  return {
    venue: 'bowlingAlley', get dur() { return dur; }, hold: 0.7, mirror: a.handedness === 'left', get payoff() { return tP + 0.25; }, orbit: { base: 165, sweep: 40 },
    start(env) {
      const s = env.s;
      ball = env.addProp(makeBowlingBall(BOWL_COL[a.id] || '#3a6ad0', two));
      // pins
      const standing = spare ? [9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (const i of standing) { const p = env.addProp(makePin()); const sp = PIN_SPOTS[i]; p.position.copy(env.W(sp[0], 0, LANE.len + sp[1])); pins.push({ mesh: p, i }); }
      // ball path down the lane (authored for a right-hander; mirrored for lefties)
      const [xR, m0, xE, m1, v0] = hook, zR = 0.32, Ll = zE - zR;
      const xz = u => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * xR + (u3 - 2 * u2 + u) * Ll * m0 + (-2 * u3 + 3 * u2) * xE + (u3 - u2) * Ll * m1; };
      const tRoll = Ll / (v0 - 0.45); tP = tR + 0.12 + tRoll;
      path = { xz, zR, Ll, v0, tRoll };
      for (const h of STRIKE) { const pin = pins.find(p => p.i === h[0]); if (pin) motions.push({ pin, f: pinMotion(PIN_SPOTS[h[0]].map((v, k) => k ? LANE.len + v : v), spare ? [9, 0, -0.75, 1, 2.6, 0.05] : h, env.mirror ? -1 : 1) }); }
      dur = Math.min(8.95, tP + 2.9);
      // body keys (right-hander, facing +Z); pelvis z/height authored, feet by IK
      const lean = two ? 1.5 : 1;
      body = poseTrack([
        [0, Object.assign({ x: x0, z: -3.98, ry: 0 }, STAND, { spineX: 8, chestX: 4, headX: 10, lKnee: 14, rKnee: 14, lHipF: 12, rHipF: 12 })],
        [tS, { headX: 14 }],
        [st[1], { z: -3.55, spineX: 10 * lean, headX: 6 }],
        [st[2], { z: -2.95, spineX: 18 * lean, chestY: -6, hipsY: -4, headX: -2 }],
        [st[3], { z: -2.2, spineX: 28 * lean, chestX: 8, chestY: two ? -14 : -10, hipsY: -8, headX: -14 }],
        [st[4], { z: -1.35, spineX: 30 * lean, chestY: -4, hipsY: -4, headX: -18 }],
        [tR, { z: -0.62, x: x0 + 0.02, spineX: 32 * lean, chestX: 10, chestY: 2, hipsY: 2, spineZ: two ? 4 : 6, headX: -24, lShF: 20, lShA: 75, lEl: 10 }],
        [tR + 0.4, { z: -0.56, spineX: 30 * lean, headX: -26 }],
        [tP - 0.2, { z: -0.56, spineX: 26, headX: -22 }],
        [tP + 0.35, { z: -0.62, spineX: 10, chestX: 4, spineZ: 0, headX: -10 }],
        [dur, { z: -0.7 }]
      ]);
      hipsK = numTrack([[0, 0.95], [tS, 0.95], [st[1], 0.93], [st[2], 0.9], [st[3], 0.85], [st[4], 0.76], [tR, 0.64], [tP - 0.2, 0.65], [tP + 0.45, 0.93], [dur, 0.95]]);
      // feet: [time, x, z] plants; swing arcs in between (authored right-handed)
      const R0 = [x0 - 0.1, -3.95], L0 = [x0 + 0.1, -3.82];
      feetT = {
        r: [[0, ...R0], [st[0], ...R0], [st[1], x0 - 0.09, -3.35], [st[2], x0 - 0.09, -3.35], [st[3], x0 - 0.08, -1.95], [st[3] + 0.05, x0 - 0.08, -1.95], [tR + 0.08, x0 + 0.34, -1.12], [tP + 0.5, x0 + 0.34, -1.12], [tP + 0.85, x0 - 0.12, -0.75], [dur, x0 - 0.12, -0.75]],
        l: [[0, ...L0], [st[1], ...L0], [st[2], x0 + 0.07, -2.7], [st[3], x0 + 0.07, -2.7], [st[4], x0 + 0.03, -1.0], [tSlide, x0 + 0.03, -0.16], [dur, x0 + 0.03, -0.16]]
      };
      // ball in the hands (local to the root, 1.85 scale)
      ballT = vecTrack(two ? [
        [0, [-0.04, 0.98, 0.3]], [tS, [-0.04, 1.0, 0.32]], [st[1], [-0.08, 0.9, 0.52]], [st[2], [-0.18, 0.42, 0.18]], [st[3], [-0.12, 1.42, -0.12]], [st[4], [-0.2, 0.78, 0.08]], [tR, [-0.2, 0.42, 0.5]]
      ] : [
        [0, [-0.14, 1.02, 0.3]], [tS, [-0.14, 1.04, 0.32]], [st[1], [-0.17, 0.95, 0.55]], [st[2], [-0.24, 0.34, 0.08]], [st[3], [-0.27, 1.52, -0.58]], [st[4], [-0.25, 0.7, -0.12]], [tR, [-0.2, 0.42, 0.5]]
      ]);
      put(env, full(STAND)); standH = hipsY(env) / 0.97;
      celeb = o.celebrate || 'pump';
    },
    frame(t, env) {
      const s = env.s, q = body(t);
      // after the strike: celebrate
      const ct = t - tP - 0.35, cw = smooth(span(ct, 0, 0.3));
      if (ct > 0 && celeb !== 'calm') {
        const pump = Math.sin(Math.min(1, ct / 0.9) * PI * 2.5) * 0.5 + 0.5;
        Object.assign(q, mix(q, celeb === 'big' ? { rShF: 120 + 40 * pump, rShA: 40, rEl: 90 - 40 * pump, lShF: 120 + 40 * pump, lShA: 40, lEl: 90 - 40 * pump, headX: -18, spineX: 6 - 8 * pump } : { rShF: 80 + 50 * pump, rShA: 20, rEl: 120 - 30 * pump, rShR: -30, headX: -10 }, cw));
      }
      put(env, q);
      setHipsY(env, standH * hipsK(t) * Math.max(1, 0.999));
      // feet
      for (const sd of ['l', 'r']) {
        const keys = feetT[sd]; let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
        const [ta, xa, za] = keys[i], [tb, xb, zb] = keys[i + 1], u = clamp((t - ta) / Math.max(1e-6, tb - ta), 0, 1);
        const moving = Math.hypot(xb - xa, zb - za) > 0.02, slide = sd === 'l' && ta >= st[4] - 1e-6 && tb <= tSlide + 1e-6;
        const k = slide ? 1 - Math.pow(1 - u, 2) : smooth(u), p = env.W(lerp(xa, xb, k), 0, lerp(za, zb, k));
        const trail = sd === 'r' && ta >= st[3] + 0.04 && ta < tP + 0.4;
        let pitch = 0, lift = 0;
        if (moving && !slide) { lift = (trail ? 0.12 : 0.09) * Math.sin(PI * u); pitch = lerp(25, -12, u) * Math.sin(PI * Math.min(1, u * 1.2)); }
        if (sd === 'r' && t > st[3] + 0.04 && t < tP + 0.6) pitch = lerp(pitch, 62, smooth(span(t, tR - 0.1, tR + 0.1)) * (1 - smooth(span(t, tP + 0.3, tP + 0.6))));
        const toe = env.dir([trail ? 0.35 : 0.05, 0, 1]).normalize(), qf = footQuat(toe, pitch);
        const ank = ankleFor(env, sd, p, qf, pitch > 40 ? 'toe' : 'mid'); ank.y += lift;
        legIK(env, sd, ank, sd === 'l' ? env.world([0.35, 0.5, 1.4]) : env.world(trail ? [0.1, 0.1, 0.4] : [-0.35, 0.5, 1.4]), qf);
      }
      // ball: in the hands until the release, then down the lane, into the pins and the pit
      const sh = env.bonePos(env.side('r') + 'UpperArm');
      if (t < tR) {
        const bl = ballT(t), bw = env.ws(bl); bw.y = Math.max(LANE.ballR + 0.015, bw.y); ball.position.copy(bw);
        const toSh = sh.clone().sub(bw).normalize();
        env.reach('r', bw.clone().addScaledVector(toSh, LANE.ballR + 0.015), [-0.9, 0.9, -0.2], { weight: 1 });
        const wl = two ? 1 - smooth(span(t, tR - 0.12, tR)) : 1 - smooth(span(t, st[1] + 0.05, st[2] - 0.05));
        const lsh = env.bonePos(env.side('l') + 'UpperArm');
        if (wl > 0) env.reach('l', bw.clone().addScaledVector(lsh.clone().sub(bw).normalize(), LANE.ballR + 0.015), [0.9, 0.8, -0.2], { weight: wl });
        ball.rotation.set(0, 0, 0);
      } else {
        const tt = t - tR - 0.12; let pos;
        if (tt < 0) { const u = (t - tR) / 0.12, p0 = env.ws(ballT(tR)).setY(Math.max(LANE.ballR + 0.015, env.ws(ballT(tR)).y)), p1 = env.W(hook[0], LANE.ballR, path.zR); pos = p0.lerp(p1, u); pos.y = lerp(p0.y, LANE.ballR, u * u); }
        else if (tt < path.tRoll) { const sd = (path.v0 - 0.45 * tt / path.tRoll * 0.9) * tt, u = clamp(sd / path.Ll, 0, 1); pos = env.W(path.xz(u), LANE.ballR, path.zR + u * path.Ll); }
        else { const k = tt - path.tRoll, x = path.xz(1) + (spare ? -0.03 : 0.05) * k, z = path.zR + path.Ll + 4.5 * k * Math.exp(-k * 0.8); pos = env.W(x, Math.max(-0.6, LANE.ballR - (z > LANE.len + 1.05 ? 4.9 * Math.pow(k - 0.25, 2) : 0)), Math.min(z, LANE.len + 1.6)); }
        ball.position.copy(pos);
        const dist = Math.max(0, (pos.z - 0.3)), ax = V(1, 0, 0.18 * (env.mirror ? -1 : 1)).normalize(); ball.quaternion.setFromAxisAngle(ax, dist / LANE.ballR);
        // follow-through: the bowling hand keeps rising toward the target; the other arm out for balance
        const ft = smooth(span(t, tR - 0.05, tR + 0.4));
        env.reach('r', env.ws(two ? [-0.12, 1.85, 0.55] : [-0.14, 1.95, 0.5]).lerp(env.ws([-0.22, 0.45, 0.5]), 1 - ft), [-0.8, 0.6, -0.4], { weight: 1 - smooth(span(t, tP + 0.3, tP + 0.6)) });
      }
      // pins
      for (const m of motions) { const r = m.f(t - tP); m.pin.mesh.position.copy(r.pos); m.pin.mesh.quaternion.copy(r.quat); }
      // camera: bowler → ball → pins → back to the bowler
      const rp = env.rig.root.position, H = Math.max(1, s), me = V(rp.x, 1.05 * s, rp.z + 0.6);
      const pinsF = env.W(spare ? -0.35 : 0, 0.35, LANE.len + 0.45);
      const k1 = smooth(span(t, tR + 0.25, tR + 1.0)), k2 = smooth(span(t, tP - 0.9, tP - 0.2)), back = smooth(span(t, tP + 1.45, tP + 1.95));
      const bf = ball.position.clone().setY(0.4).add(V(0, 0, 1.5)); bf.z = Math.min(bf.z, LANE.len);
      let f = me.clone().lerp(bf, k1 * (1 - k2)).lerp(pinsF, k2); f = f.lerp(me, back);
      return { focus: f, radius: lerp(4.4 * H, 3.6, Math.max(k1, k2) * (1 - back)), fixedY: (k1 + k2) * (1 - back) > 0.05 };
    }
  };
}

/* ================================================================== BILLIARDS */
/* ---- pool room: 9-ft table centred at the origin, long axis along Z; bed (cloth) at y = 0.76 */
const TABLE = { hw: 0.635, hl: 1.27, bed: 0.76, r: 0.028575, cush: 0.045 };
const POCKETS = [[1, 1, 0.075], [-1, 1, 0.075], [1, -1, 0.075], [-1, -1, 0.075], [1, 0, 0.07], [-1, 0, 0.07]].map(([sx, sz, cap]) => ({ x: sx * (TABLE.hw + (sz ? 0.018 : 0.03)), z: sz * (TABLE.hl + 0.018), cap }));
const BALL_COL = ['#f6f4ec', '#f2c21b', '#1f4fb4', '#d4291f', '#5b2c8f', '#ee7a1a', '#1c7a3c', '#7a1f1f', '#151515', '#f2c21b'];
function poolBall(n) {
  const tex = canvasTex(128, 64, (x, w, h) => {
    const stripe = n >= 9, c = BALL_COL[n];
    x.fillStyle = stripe ? '#f6f4ec' : c; x.fillRect(0, 0, w, h);
    if (stripe) { x.fillStyle = c; x.fillRect(0, h * 0.28, w, h * 0.44); }
    if (n > 0) for (const u of [0.25, 0.75]) { x.fillStyle = '#f9f8f2'; x.beginPath(); x.ellipse(u * w, h / 2, 9, 11, 0, 0, PI * 2); x.fill(); x.fillStyle = '#111'; x.font = '900 13px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), u * w, h / 2 + 1); }
    else { x.fillStyle = '#c62828'; x.beginPath(); x.arc(0.25 * w, h / 2, 2.5, 0, PI * 2); x.fill(); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(TABLE.r, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.15, metalness: 0.05 })); m.castShadow = true; return m;
}
function makeCue() {
  const g = new THREE.Group();   // tip at the origin, butt along -Z (1.47 m)
  const seg = (z0, z1, r0, r1, col, o = {}) => { const m = new THREE.Mesh(Cyl(r1, r0, z1 - z0, 12), M(col, Object.assign({ roughness: 0.35 }, o))); m.rotation.x = PI / 2; m.position.z = -(z0 + z1) / 2; g.add(m); };
  seg(0, 0.008, 0.0065, 0.0065, '#3b6db3', { roughness: 0.9 });
  seg(0.008, 0.03, 0.0065, 0.0066, '#f3f1e8');
  seg(0.03, 0.72, 0.0066, 0.0105, '#e3c995');
  seg(0.72, 0.76, 0.0105, 0.0108, '#2a2a2a', { metalness: 0.6 });
  seg(0.76, 1.05, 0.0108, 0.0128, '#5a2d18', { roughness: 0.3 });
  seg(1.05, 1.32, 0.0128, 0.0142, '#1d1d1f', { roughness: 0.85 });
  seg(1.32, 1.47, 0.0142, 0.015, '#5a2d18', { roughness: 0.3 });
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function buildPool(scene) {
  const g = new THREE.Group(); scene.add(g); const T = TABLE;
  scene.background = new THREE.Color('#17130f'); scene.fog = new THREE.Fog('#17130f', 9, 22);
  add(g, Plane(14, 14), new THREE.MeshStandardMaterial({ map: speckTex('#3a2a26', 31, [10, 10], 0.25), roughness: 1 }), [0, 0, 0], FLAT, false);
  const wall = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#3d2a1e'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(0,0,0,.18)' : 'rgba(255,220,180,.04)'; x.fillRect(i * w / 8, 0, w / 8, h); } x.fillStyle = '#2a1c14'; x.fillRect(0, h * 0.62, w, h * 0.06); }, [6, 1]), roughness: 0.85 });
  for (const [x, z, ry] of [[0, -6, 0], [0, 6, PI], [-6, 0, PI / 2], [6, 0, -PI / 2]]) add(g, Plane(12, 3.4), wall, [x, 1.7, z], [0, ry, 0], false);
  add(g, Plane(14, 14), M('#15110e', { roughness: 1 }), [0, 3.4, 0], [PI / 2, 0, 0], false);
  // table: cloth bed, cushions, rails with diamonds, pockets, apron and legs
  const cloth = new THREE.MeshStandardMaterial({ map: speckTex('#1f7a45', 3, [4, 8], 0.12), roughness: 0.95 }), wood = M('#5a3018', { roughness: 0.45 }), cush = M('#1c6e3e', { roughness: 0.9 });
  add(g, Box(2 * T.hw + 0.12, 0.05, 2 * T.hl + 0.12), cloth, [0, T.bed - 0.025, 0]);
  const ch = T.cush, cy = T.bed + ch / 2, gap = 0.07;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, Box(0.05, ch, T.hl - 2 * gap), cush, [sx * (T.hw + 0.025), cy, sz * (T.hl / 2)]);
  for (const sz of [-1, 1]) add(g, Box(2 * T.hw - 2 * gap, ch, 0.05), cush, [0, cy, sz * (T.hl + 0.025)]);
  const RW = 0.14;
  for (const sx of [-1, 1]) add(g, Box(RW, 0.06, 2 * T.hl + 0.1 + 2 * RW), wood, [sx * (T.hw + 0.05 + RW / 2), T.bed + 0.02, 0]);
  for (const sz of [-1, 1]) add(g, Box(2 * T.hw + 0.1, 0.06, RW), wood, [0, T.bed + 0.02, sz * (T.hl + 0.05 + RW / 2)]);
  const dia = []; for (let i = 1; i < 8; i++) if (i !== 4) for (const sx of [-1, 1]) dia.push([sx * (T.hw + 0.05 + RW / 2), (i - 4) / 4 * T.hl]);
  for (let i = 1; i < 4; i++) for (const sz of [-1, 1]) dia.push([(i - 2) / 2 * T.hw, sz * (T.hl + 0.05 + RW / 2)]);
  const di = new THREE.InstancedMesh(new THREE.CircleGeometry(0.008, 10), MB('#f3efe2'), dia.length); const m4 = new THREE.Matrix4();
  dia.forEach(([x, z], i) => { m4.compose(V(x, T.bed + 0.0505, z), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -PI / 2), V(1, 1, 1)); di.setMatrixAt(i, m4); }); g.add(di);
  for (const p of POCKETS) { add(g, Cyl(0.064, 0.058, 0.065, 16), MB('#060606'), [p.x, T.bed + 0.02, p.z], null, false); add(g, new THREE.TorusGeometry(0.066, 0.008, 6, 16), M('#1a1410', { roughness: 0.6 }), [p.x, T.bed + 0.052, p.z], [PI / 2, 0, 0]); }
  add(g, Box(2 * T.hw + 0.3, 0.18, 2 * T.hl + 0.3), wood, [0, T.bed - 0.12, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) add(g, Box(0.13, T.bed - 0.2, 0.13), M('#4a2814', { roughness: 0.5 }), [sx * (T.hw + 0.05), (T.bed - 0.2) / 2, sz * (T.hl - 0.05)]);
  // hanging lamp
  add(g, Box(0.5, 0.12, 1.9), M('#1d3a2a', { roughness: 0.5, metalness: 0.2 }), [0, 1.85, 0], null, false);
  add(g, Plane(0.44, 1.84), MB('#fff1cf'), [0, 1.789, 0], [PI / 2, 0, 0], false);
  for (const sz of [-0.7, 0.7]) add(g, Cyl(0.006, 0.006, 1.5, 4), M('#222'), [0, 2.65, sz], null, false);
  // background: a second table, cue rack, bar stools
  const t2 = new THREE.Group(); t2.position.set(-3.3, 0, 1.5); g.add(t2);
  add(t2, Box(1.4, 0.06, 2.65), cloth, [0, T.bed - 0.02, 0]); add(t2, Box(1.62, 0.2, 2.87), wood, [0, T.bed - 0.1, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(t2, Box(0.12, T.bed - 0.2, 0.12), wood, [sx * 0.65, (T.bed - 0.2) / 2, sz * 1.2]);
  add(g, Box(1.2, 0.08, 0.06), wood, [3.0, 1.5, -5.95]); for (let i = 0; i < 6; i++) add(g, Cyl(0.007, 0.012, 1.45, 6), M(i % 2 ? '#e3c995' : '#5a2d18'), [2.55 + i * 0.18, 0.78, -5.9]);
  for (const x of [4.6, 5.2]) { add(g, Cyl(0.18, 0.18, 0.05, 14), M('#3a2d28'), [x, 0.75, -4.6]); add(g, Cyl(0.025, 0.025, 0.75, 6), M('#777'), [x, 0.37, -4.6]); }
  const clampCamera = p => { p.x = clamp(p.x, -5.6, 5.6); p.z = clamp(p.z, -5.6, 5.6); p.y = clamp(p.y, 0.9, 3.1); if (Math.abs(p.x) < T.hw + 0.25 && Math.abs(p.z) < T.hl + 0.25) p.y = Math.max(p.y, 1.15); };
  return { group: g, clampCamera };
}

/* 2-D table physics, precomputed at start (deterministic): rolling friction, elastic ball-ball contacts, cushions, pockets */
function poolSim(init, T = 4.2) {
  const R = TABLE.r, X = TABLE.hw - R, Z = TABLE.hl - R, dt = 0.0005, every = 1 / 120 / dt, n = init.length, mu = 0.22;
  const b = init.map(o => ({ id: o.id, x: o.x, z: o.z, vx: o.vx || 0, vz: o.vz || 0, inAt: -1, px: 0, pz: 0, rot: new THREE.Quaternion() }));
  const frames = [];
  for (let s = 0, t = 0; t <= T; s++, t += dt) {
    if (s % Math.round(every) === 0) frames.push(b.map(o => ({ x: o.x, z: o.z, q: o.rot.clone(), inAt: o.inAt, px: o.px, pz: o.pz })));
    for (const o of b) {
      if (o.inAt >= 0) continue;
      const sp = Math.hypot(o.vx, o.vz); if (sp > 0) { const ns = Math.max(0, sp - mu * dt); o.vx *= ns / sp; o.vz *= ns / sp; }
      o.x += o.vx * dt; o.z += o.vz * dt;
      if (sp > 1e-4) { const ax = V(o.vz, 0, -o.vx).normalize(); o.rot.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, sp * dt / R)); }
      for (const p of POCKETS) if (Math.hypot(o.x - p.x, o.z - p.z) < p.cap) { o.inAt = t; o.px = p.x; o.pz = p.z; }
      if (o.inAt >= 0) continue;
      const nearPocket = POCKETS.some(p => Math.hypot(o.x - p.x, o.z - p.z) < p.cap + 0.04);
      if (!nearPocket) {
        if (o.x > X) { o.x = 2 * X - o.x; o.vx = -Math.abs(o.vx) * 0.86; o.vz *= 0.86; } else if (o.x < -X) { o.x = -2 * X - o.x; o.vx = Math.abs(o.vx) * 0.86; o.vz *= 0.86; }
        if (o.z > Z) { o.z = 2 * Z - o.z; o.vz = -Math.abs(o.vz) * 0.86; o.vx *= 0.86; } else if (o.z < -Z) { o.z = -2 * Z - o.z; o.vz = Math.abs(o.vz) * 0.86; o.vx *= 0.86; }
      }
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = b[i], B2 = b[j]; if (A.inAt >= 0 || B2.inAt >= 0) continue;
      const dx = B2.x - A.x, dz = B2.z - A.z, d = Math.hypot(dx, dz); if (d >= 2 * R || d < 1e-9) continue;
      const nx = dx / d, nz = dz / d, rel = (A.vx - B2.vx) * nx + (A.vz - B2.vz) * nz, over = 2 * R - d;
      A.x -= nx * over / 2; A.z -= nz * over / 2; B2.x += nx * over / 2; B2.z += nz * over / 2;
      if (rel > 0) { const k = rel * 0.97; A.vx -= k * nx; A.vz -= k * nz; B2.vx += k * nx; B2.vz += k * nz; }
    }
  }
  return { frames, dt: 1 / 120, n };
}
function simAt(sim, t, i) {
  const f = clamp(t / sim.dt, 0, sim.frames.length - 1.001), k = Math.floor(f), u = f - k, a = sim.frames[k][i], c = sim.frames[k + 1][i];
  const x = lerp(a.x, c.x, u), z = lerp(a.z, c.z, u), q = a.q.clone().slerp(c.q, u);
  const inAt = c.inAt >= 0 ? c.inAt : a.inAt;
  return { x, z, q, inAt, px: c.px, pz: c.pz };
}
/* ghost-ball aim: where the cue ball must be at contact to send ball O toward pocket P */
const pocketAim = i => { const p = POCKETS[i], sx = Math.sign(p.x), sz = Math.sign(p.z); return sz ? { x: sx * (TABLE.hw - 0.035), z: sz * (TABLE.hl - 0.035) } : { x: sx * TABLE.hw, z: 0 }; };
function ghost(O, P) { const d = V(P.x - O.x, 0, P.z - O.z).normalize(); return { x: O.x - d.x * 2 * TABLE.r, z: O.z - d.z * 2 * TABLE.r }; }

/* the shot: get down on the cue, practice strokes, pause, deliver, stay down, stand up / react */
const POOL_STANCE = { hipsX: 52, spineX: 24, chestX: 10, neckX: -20, headX: -44, lHipF: 76, lKnee: 26, lAnk: -10, rHipF: 44, rKnee: 4, rAnk: 4, lHipA: 6, rHipA: 12, lHipR: -8, rHipR: 10 };
const POOL_SHOTS = {
  break: { cue: [0.2, -0.8], target: 'rack', speed: 8.6, elev: 4, chin: 0.2, strokes: 2, react: 'up' },
  cut: { cue: [0.1, -0.72], obj: [0.38, 0.62], pocket: 0, speed: 2.1, chin: 0.15, strokes: 2, react: 'nod' },
  cutSide: { cue: [-0.15, -0.65], obj: [0.42, -0.1], pocket: 4, speed: 1.9, chin: 0.15, strokes: 2, react: 'nod' },
  kick: { obj: [0.2, 1.0], pocket: 0, rail: 'right', back: 1.05, speed: 3.0, chin: 0.15, strokes: 3, react: 'smile' },
  longPot: { cue: [-0.32, -0.86], obj: [0.43, 0.96], pocket: 0, speed: 2.6, chin: 0.045, strokes: 3, react: 'nod' }
};
const CUT_STYLE = { 'wu-chia-ching': { kind: 'cutSide' }, 'pan-xiaoting': { obj: [0.3, 0.8] }, 'ko-pin-yi': {} };
function poolShot(a, kind) {
  const S = Object.assign({}, POOL_SHOTS[kind], kind === 'cut' ? (CUT_STYLE[a.id] || {}) : {});
  if (kind === 'cut' && S.kind) Object.assign(S, POOL_SHOTS[S.kind]);
  const tDown = 1.1, nS = S.strokes, tBack = tDown + 0.25 + nS * 0.62, tPause = tBack + (kind === 'break' ? 0.2 : 0.45), tC = tPause + (kind === 'break' ? 0.13 : 0.2);
  const stroke = numTrack([[0, -0.03], [tDown, -0.03], ...Array.from({ length: nS }, (_, i) => [[tDown + 0.25 + i * 0.62 + 0.31, -0.13], [tDown + 0.25 + i * 0.62 + 0.62, -0.02]]).flat(), [tBack + 0.3, kind === 'break' ? -0.24 : -0.16], [tPause + 0.02, kind === 'break' ? -0.25 : -0.165], [tC, 0.0], [tC + 0.12, kind === 'break' ? 0.22 : 0.13], [tC + 0.9, kind === 'break' ? 0.22 : 0.13]]);
  let cue, balls = [], sim, u, dir, tip0, body, feet, dur = 8, tIn = 0, objIdx = 1, ry = 0, rootOff = V(), standY = 0;
  return {
    venue: 'poolHall', get dur() { return dur; }, hold: 0.7, get payoff() { return tIn > 0 ? tIn : tC + 0.8; }, mirror: a.handedness === 'left', orbit: { base: 70, sweep: 50 },
    start(env) {
      const T = TABLE, s = env.s, R = T.r;
      // layout and the cue-ball velocity
      if (S.rail) {   // kick: rail point on the extension of pocket→ball, cue ball further back along the mirrored line; a blocker hides the direct line
        const O = { x: S.obj[0], z: S.obj[1] }, P = pocketAim(S.pocket), G = ghost(O, P), xr = (S.rail === 'right' ? -1 : 1) * (T.hw - R);
        const dpo = V(O.x - P.x, 0, O.z - P.z).normalize(), tk = (xr - O.x) / dpo.x, K = { x: xr, z: O.z + dpo.z * tk };
        const away = V(K.x - (2 * xr - G.x), 0, K.z - G.z).normalize();
        S.cue = [K.x + away.x * S.back, K.z + away.z * S.back]; S.blocker = [lerp(S.cue[0], O.x, 0.5), lerp(S.cue[1], O.z, 0.5)];
      }
      const C = { x: S.cue[0], z: S.cue[1] }, init = [{ id: 0, x: C.x, z: C.z }];
      if (kind === 'break') {
        const order = [1, 2, 3, 9, 4, 5, 6, 7, 8], rows = [1, 2, 3, 2, 1], dz = 2 * R * Math.cos(PI / 6) + 0.0004; let k = 0;
        rows.forEach((cnt, ri) => { for (let c = 0; c < cnt; c++) { init.push({ id: order[k++], x: (c - (cnt - 1) / 2) * (2 * R + 0.0004) + (ri % 2 ? 0.0002 : -0.0001), z: 0.635 + ri * dz }); } });
        const id1 = init.findIndex(o => o.id === 1);
        // try a few slight aim offsets; keep the first that pockets a ball (deterministic search)
        let best = null;
        for (const off of [0.004, -0.004, 0.008, -0.008, 0.0, 0.012, -0.012, 0.016]) {
          const aim = V(init[id1].x + off - C.x, 0, init[id1].z - C.z).normalize(), tr = init.map(o => Object.assign({}, o)); tr[0].vx = aim.x * S.speed; tr[0].vz = aim.z * S.speed;
          const sm = poolSim(tr, 4.0), last = sm.frames[sm.frames.length - 1], got = last.some((o, i) => i > 0 && o.inAt >= 0) && last[0].inAt < 0;
          if (got) { best = { sm, aim }; break; } if (!best) best = { sm, aim };
        }
        sim = best.sm; u = best.aim; objIdx = 1;
      } else {
        const O = { x: S.obj[0], z: S.obj[1] }, P = pocketAim(S.pocket), G = ghost(O, P);
        init.push({ id: kind === 'kick' ? 9 : kind === 'longPot' ? 1 : (a.id.length % 7) + 2, x: O.x, z: O.z });
        let aimPt = G;
        if (S.rail) { const xr = (S.rail === 'right' ? -1 : 1) * (T.hw - R); aimPt = { x: 2 * xr - G.x, z: G.z }; }
        if (S.blocker) init.push({ id: 8, x: S.blocker[0], z: S.blocker[1] });
        if (kind === 'cut' || kind === 'cutSide') init.push({ id: 8, x: -0.4, z: 0.95 }, { id: 3, x: -0.38, z: -0.35 });
        if (kind === 'longPot') init.push({ id: 5, x: -0.45, z: 0.3 });
        u = V(aimPt.x - C.x, 0, aimPt.z - C.z).normalize(); init[0].vx = u.x * S.speed; init[0].vz = u.z * S.speed;
        sim = poolSim(init, 4.0); objIdx = 1;
      }
      // when does the target (or first) ball drop?
      tIn = 0; const last = sim.frames[sim.frames.length - 1];
      for (let i = 1; i < last.length; i++) if (last[i].inAt >= 0 && (kind === 'break' || i === objIdx)) { const tt = tC + last[i].inAt; if (!tIn || tt < tIn) tIn = tt; }
      dur = Math.min(8.9, Math.max(tC + 2.6, (tIn || tC + 1.4) + 1.9));
      // ball meshes (table coords → world; mirrored for left-handers)
      for (let i = 0; i < init.length; i++) { const m = env.addProp(poolBall(init[i].id)); balls.push(m); }
      // cue line: tip just behind the cue ball, slight elevation
      const e = (S.elev || 2.5) * D2R, uw = env.W(u.x, 0, u.z).normalize();
      dir = uw.clone().multiplyScalar(Math.cos(e)).add(V(0, -Math.sin(e), 0)).normalize();
      tip0 = env.W(C.x, T.bed + R - 0.004, C.z).addScaledVector(uw, -(R + 0.012));
      cue = env.addProp(makeCue());
      // body: face about 26° right of the cue line, chin over the cue, feet planted behind the rail
      ry = Math.atan2(uw.x, uw.z) / D2R - (env.mirror ? -26 : 26);
      const stance = Object.assign({ x: 0, z: 0, ry: env.mirror ? -ry : ry }, POOL_STANCE, { headY: 22, neckY: 6 });
      put(env, stance);
      const hg = env.rig.headGroup, Rh = env.rig.headR; hg.updateMatrixWorld(true);
      const chin = hg.localToWorld(V(0, -0.95 * Rh, 0.45 * Rh)), want = tip0.clone().addScaledVector(dir, -0.62).add(V(0, S.chin + 0.03, 0));
      rootOff = want.clone().sub(chin); rootOff.y = 0;
      standY = hipsY(env); const dyH = want.y - chin.y; this._dyH = dyH;
      body = poseTrack([
        [0, Object.assign({}, STAND, { x: rootOff.x - uw.x * 0.45, z: rootOff.z - uw.z * 0.45, ry: stance.ry, headX: 10, headY: 10, rShF: 10 })],
        [0.35, { headX: 14 }],
        [tDown, Object.assign({ x: rootOff.x, z: rootOff.z }, POOL_STANCE, { headY: 22, neckY: 6 })],
        [tC + 0.12, {}], [tC + 0.5, { headX: -48 }],
        [Math.max(tC + 0.9, (tIn || tC) + 0.15), {}],
        [Math.max(tC + 1.6, (tIn || tC) + 0.85), Object.assign({}, STAND, { headX: 6, spineX: 4, joy: 1, headY: 8 })],
        [dur, { headX: 4 }]
      ]);
      put(env, body(tDown)); feet = recordFeet(env);
    },
    frame(t, env) {
      const s = env.s, T = TABLE, R = T.r, q = body(t); put(env, q);
      const down = smooth(span(t, 0.2, tDown)) * (1 - smooth(span(t, Math.max(tC + 0.9, (tIn || tC) + 0.15), Math.max(tC + 1.6, (tIn || tC) + 0.85))));
      if (down > 0) setHipsY(env, hipsY(env) + this._dyH * down);
      if (down > 0.6) { const w = smooth(span(down, 0.6, 1)); legIK(env, 'l', feet.l.ank, env.world([0.3, 0.4, 1.4]), feet.l.q, w); legIK(env, 'r', feet.r.ank, env.world([-0.3, 0.4, 1.4]), feet.r.q, w); }
      keepFeetUp(env);
      // cue: on the shot line while down; carried in the right hand otherwise
      const tipA = tip0.clone().addScaledVector(dir, stroke(t)), carryTip = env.ws([-0.32, 1.65, 0.45], false), carryDir = env.dir([0.1, -0.98, 0.15]).normalize().negate();
      const tipW = carryTip.lerp(tipA, down), dW = carryDir.lerp(dir, down).normalize();
      orientZ(cue, tipW, dW, UPY); cue.updateMatrixWorld(true);
      const grip = tipW.clone().addScaledVector(dW, -0.95), bridge = tip0.clone().addScaledVector(dir, -0.24);
      if (down > 0.5) { const sh = env.bonePos(env.side('r') + 'UpperArm'); env.rig.reach(env.side('r'), grip, sh.clone().addScaledVector(dir, -1.0).add(V(0, 0.12, 0)), { weight: 1 }); }
      else env.reach('r', grip, [-0.3, 1.45, -0.95], { weight: 1 });
      if (down > 0.02) env.reach('l', V(bridge.x, T.bed + 0.035, bridge.z).add(env.dir([0.03, 0, -0.06])), [0.7, 1.2, 0.2], { weight: smooth(span(down, 0.35, 1)) });
      // balls
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i], st = simAt(sim, Math.max(0, t - tC), i), p = env.W(st.x, T.bed + R, st.z);
        if (st.inAt >= 0 && t - tC > st.inAt) { const k = Math.min(1, (t - tC - st.inAt) / 0.18), pk = env.W(st.px, T.bed + R, st.pz); p.lerp(pk, Math.min(1, k * 2)); p.y -= 0.12 * k * k; b.visible = k < 1; } else b.visible = true;
        b.position.copy(p); b.quaternion.copy(st.q);
      }
      // camera: over the shot, drifting toward where the action is
      const r = env.rig.root.position, H = Math.max(1, s), cb = balls[0].position, ob = balls[Math.min(objIdx, balls.length - 1)].position;
      const k = smooth(span(t, tC, tC + 0.7));
      const f = kind === 'break' ? V(r.x, 1.05 * s, r.z).lerp(env.W(0, T.bed, 0.35), 0.62) : V(r.x, 1.05 * s, r.z).lerp(cb, 0.55).lerp(ob.clone().lerp(V(0, T.bed, 0), 0.3), 0.55 * k); f.y = Math.max(f.y, T.bed + 0.2);
      return { focus: f, radius: (kind === 'break' ? 3.7 : 3.0) * H, fixedY: true };
    }
  };
}

/* ================================================================== catalogue */
export const VENUES = {
  track: { indoor: false, build: buildTrack },
  archeryRange: { indoor: false, build: buildRange },
  golfHole: { indoor: false, build: buildGolf, ball: golfBall },
  bowlingAlley: { indoor: true, build: buildAlley },
  poolHall: { indoor: true, build: buildPool }
};
export const MOVES = {
  sprint_dash: a => sprint(a, { celebrate: 'arms' }),
  sprint_rocketStart: a => sprint(a, { react: 0.12, r0: 2.05, r1: 2.45, tau: 1.0, vmax: 10.9, celebrate: 'wide' }),
  sprint_showtime: a => sprint(a, { vmax: 11.6, r1: 2.25, celebrate: 'flex' }),
  sprint_lightningBolt: a => sprint(a, { vmax: 12.2, r0: 1.7, r1: 2.15, tau: 1.25, celebrate: 'bolt' }),
  sprint_longJump: a => longJump(a),
  sprint_hurdles: a => hurdles(a),
  archery_recurve: a => archery(a, {}),
  archery_quickShot: a => archery(a, { quick: true, aim: 0.75, fist: true }),
  archery_shootOff: a => archery(a, { aim: 1.8, hit: [0.004, 0.006], fist: true, calm: false }),
  archery_highDraw: a => archery(a, { highDraw: true, aim: 1.4 }),
  golf_drive: a => drive(a, {}),
  golf_drivePause: a => drive(a, { pause: 0.42, tempo: 1.08 }),
  golf_driveFade: a => drive(a, { fade: 1.0, launch: 11 }),
  golf_putt: a => putt(a),
  golf_chipIn: a => chipIn(a),
  bowling_hook: a => bowl(a, { kind: 'hook' }),
  bowling_straight: a => bowl(a, { kind: 'straight', celebrate: 'calm' }),
  bowling_powerHook: a => bowl(a, { kind: 'power', celebrate: 'big' }),
  bowling_twoHand: a => bowl(a, { kind: 'twoHand' }),
  bowling_spare: a => bowl(a, { kind: 'spare', celebrate: 'calm' }),
  billiards_break: a => poolShot(a, 'break'),
  billiards_cut: a => poolShot(a, 'cut'),
  billiards_kick: a => poolShot(a, 'kick'),
  billiards_longPot: a => poolShot(a, 'longPot')
};
export const SIGNATURE = {
  'usain-bolt': 'sprint_lightningBolt', 'florence-griffith-joyner': 'sprint_dash', 'allyson-felix': 'sprint_dash',
  'shelly-ann-fraser-pryce': 'sprint_rocketStart', 'su-bingtian': 'sprint_rocketStart', 'noah-lyles': 'sprint_showtime',
  'carl-lewis': 'sprint_longJump', 'yang-chuan-kwang': 'sprint_hurdles',
  'kim-woo-jin': 'archery_quickShot', 'ki-bo-bae': 'archery_shootOff', 'an-san': 'archery_recurve', 'brady-ellison': 'archery_highDraw',
  'lei-chien-ying': 'archery_recurve', 'tang-chih-chun': 'archery_quickShot', 'deepika-kumari': 'archery_recurve', 'mete-gazoz': 'archery_shootOff',
  'tiger-woods': 'golf_drive', 'rory-mcilroy': 'golf_drive', 'annika-sorenstam': 'golf_drive', 'yani-tseng': 'golf_drive',
  'hideki-matsuyama': 'golf_drivePause', 'jack-nicklaus': 'golf_driveFade', 'inbee-park': 'golf_putt', 'lydia-ko': 'golf_putt',
  'earl-anthony': 'bowling_hook', 'walter-ray-williams-jr': 'bowling_straight', 'pete-weber': 'bowling_powerHook', 'liz-johnson': 'bowling_hook',
  'kelly-kulick': 'bowling_powerHook', 'jason-belmonte': 'bowling_twoHand',
  'efren-reyes': 'billiards_kick', 'earl-strickland': 'billiards_break', 'ko-pin-yi': 'billiards_cut', 'wu-chia-ching': 'billiards_cut',
  'allison-fisher': 'billiards_longPot', 'pan-xiaoting': 'billiards_cut'
};
const BY_SPORT = { billiards: ['billiards_break', 'billiards_cut', 'billiards_kick', 'billiards_longPot'], bowling: ['bowling_hook', 'bowling_straight', 'bowling_powerHook', 'bowling_twoHand', 'bowling_spare'], golf: ['golf_drive', 'golf_drivePause', 'golf_driveFade', 'golf_putt', 'golf_chipIn'], archery: ['archery_recurve', 'archery_quickShot', 'archery_shootOff', 'archery_highDraw'], sprint: ['sprint_dash', 'sprint_rocketStart', 'sprint_showtime', 'sprint_lightningBolt', 'sprint_longJump', 'sprint_hurdles'] };
export function movesFor(a) {
  const list = (BY_SPORT[a && a.sport] || []).filter(m => MOVES[m]), sig = SIGNATURE[a && a.id];
  return sig && MOVES[sig] ? [sig].concat(list.filter(m => m !== sig)) : list;
}
