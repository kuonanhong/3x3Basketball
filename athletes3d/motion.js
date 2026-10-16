/* SmartAction Sports — motion runtime for the 3D athlete studio: keyframe tracks (monotone cubic),
   running gait, left/right mirroring and helpers that move props in the athlete's local frame. MIT. */
import * as THREE from '../vendor/three/three.module.min.js';
import { BASE_POSE } from './rig.js';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

/* monotone cubic interpolation (Fritsch–Carlson) over keys [[t, value], ...] */
function monotone(ts, vs) {
  const n = ts.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((vs[i + 1] - vs[i]) / Math.max(1e-6, ts[i + 1] - ts[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return t => {
    if (t <= ts[0]) return vs[0]; if (t >= ts[n - 1]) return vs[n - 1];
    let i = 0; while (i < n - 2 && t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], u = (t - ts[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * vs[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * vs[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}
/* pose track: keys are cumulative partial poses on top of `base` */
export function poseTrack(keys, base = BASE_POSE) {
  const full = []; let cur = Object.assign({}, base);
  for (const [t, p] of keys) { cur = Object.assign({}, cur, p); full.push([t, cur]); }
  const ts = full.map(k => k[0]), fns = {};
  for (const f of Object.keys(cur)) fns[f] = monotone(ts, full.map(k => k[1][f] === undefined ? 0 : k[1][f]));
  return t => { const o = {}; for (const f in fns) o[f] = fns[f](t); return o; };
}
/* vector track: keys [[t, [x, y, z]], ...] */
export function vecTrack(keys) {
  const ts = keys.map(k => k[0]), fx = monotone(ts, keys.map(k => k[1][0])), fy = monotone(ts, keys.map(k => k[1][1])), fz = monotone(ts, keys.map(k => k[1][2]));
  return t => [fx(t), fy(t), fz(t)];
}
export const numTrack = keys => monotone(keys.map(k => k[0]), keys.map(k => k[1]));

/* running gait added on top of a pose; phase in cycles, k = intensity 0..1 */
export function gait(phase, k, holdBall) {
  const w = phase * Math.PI * 2, s = Math.sin(w);
  const kn = side => 22 + 78 * k * Math.pow(0.5 + 0.5 * Math.cos(w + (side ? Math.PI : 0) + 0.35), 2);
  const o = {
    lHipF: 16 + 44 * s * k, rHipF: 16 - 44 * s * k, lKnee: kn(0), rKnee: kn(1),
    lAnk: -6 + 22 * Math.sin(w - 0.6) * k, rAnk: -6 - 22 * Math.sin(w - 0.6) * k,
    lHipA: 3, rHipA: 3, spineX: 7 + 9 * k, chestX: 3, hipsY: -9 * s * k, chestY: 12 * s * k, headX: -6 * k, headY: -4 * s * k
  };
  if (!holdBall) Object.assign(o, { lShF: -42 * s * k, rShF: 42 * s * k, lEl: 20 + 70 * k, rEl: 20 + 70 * k, lShA: 10, rShA: 10 });
  return o;
}
export function addPose(p, d, w = 1) { for (const k in d) p[k] = lerp(p[k] === undefined ? 0 : p[k], d[k], w); return p; }

const AXIAL = ['hipsY', 'hipsZ', 'spineY', 'spineZ', 'chestY', 'chestZ', 'neckY', 'headY', 'headZ', 'ry', 'x'];
export function mirrorPose(p) {
  const q = {};
  for (const k in p) {
    if (/^[lr][A-Z]/.test(k)) q[(k[0] === 'l' ? 'r' : 'l') + k.slice(1)] = p[k];
    else q[k] = AXIAL.includes(k) ? -p[k] : p[k];
  }
  return q;
}

/* the environment a move runs in: rig, props, venue, mirroring and coordinate helpers */
export class MotionEnv {
  constructor(rig, props, venue, mirror) {
    this.rig = rig; this.props = props; this.venue = venue; this.mirror = !!mirror; this.s = rig.p.H / 1.85;
    this._v = new THREE.Vector3();
  }
  pose(p) { const q = this.mirror ? mirrorPose(p) : p; this.rig.applyPose(q); return q; }
  /* local (athlete) → world. Local +Z = facing, +X = athlete's left; y measured from the floor.
     lift adds the current jump/crouch offset of the hips so carried objects move with the body. */
  world(l, lift = true, out = new THREE.Vector3()) {
    const r = this.rig, x = this.mirror ? -l[0] : l[0];
    out.set(x, l[1] + (lift ? r.bones.hips.position.y - r.len.hip : 0), l[2]);
    out.applyAxisAngle(UP, r.root.rotation.y); out.x += r.root.position.x; out.z += r.root.position.z;
    return out;
  }
  /* local direction → world direction (rotation and mirror only) */
  dir(l, out = new THREE.Vector3()) { out.set(this.mirror ? -l[0] : l[0], l[1], l[2]); return out.applyAxisAngle(UP, this.rig.root.rotation.y); }
  /* local point scaled to the athlete's size (authored for a 1.85 m player) */
  ws(l, lift = true, out) { return this.world([l[0] * this.s, l[1] * this.s, l[2] * this.s], lift, out); }
  /* world coordinates authored for a right-hander → mirrored for a left-hander */
  W(x, y, z, out = new THREE.Vector3()) { return out.set(this.mirror ? -x : x, y, z); }
  side(s) { return this.mirror ? (s === 'l' ? 'r' : 'l') : s; }
  /* arm IK with the authored side mapped through the mirror */
  reach(side, target, poleLocal, opts) { this.rig.reach(this.side(side), target, this.world(poleLocal, true), opts); }
  handPos(side, out = new THREE.Vector3()) { return this.rig['handTip_' + this.side(side)].getWorldPosition(out); }
  bonePos(name, out = new THREE.Vector3()) { return this.rig.bones[name].getWorldPosition(out); }
}
const UP = new THREE.Vector3(0, 1, 0);

/* parabolic flight from a to b with apex h above the straight line, u in 0..1 */
export function arc(a, b, h, u, out = new THREE.Vector3()) {
  return out.set(lerp(a.x, b.x, u), lerp(a.y, b.y, u) + 4 * h * u * (1 - u), lerp(a.z, b.z, u));
}
/* basketball dribble height for a phase (top at 0, floor at 0.5) */
export function dribbleY(phase, top) { return 0.12 + (top - 0.12) * Math.abs(Math.cos(Math.PI * phase)); }
export const headingTo = (fromX, fromZ, toX, toZ) => Math.atan2(toX - fromX, toZ - fromZ) * 180 / Math.PI;
