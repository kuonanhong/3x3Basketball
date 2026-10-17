/* SmartAction Sports — 3D signature moves for the field sports: soccer, rugby, american & flag football, field hockey
   and lacrosse. Stylized animation of publicly known playing styles, based on the catalogue's notes, traits, position and
   handedness. Venues and equipment are generic and procedural (no team names, logos or sponsor marks).
   Every move is authored for a right-footed / right-handed player; left-handers are mirrored by the motion runtime. MIT. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { poseTrack, vecTrack, numTrack, gait, addPose, arc, headingTo, span, smooth, lerp, clamp, mirrorPose } from '../motion.js';
import { canvasTex, add, rng, crowd } from '../scenes.js';
import { AthleteRig, UNIFORMS, BASE_POSE as BASE } from '../rig.js';

export const SPORTS = ['soccer', 'rugby', 'american-football', 'flag-football', 'field-hockey', 'lacrosse'];

const D2R = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o || {}));
const win = (t, a, b, c, d) => smooth(span(t, a, b)) * (1 - smooth(span(t, c, d)));     // 0 → 1 (a..b) … 1 → 0 (c..d)
const easeOut = u => 1 - Math.pow(1 - clamp(u, 0, 1), 2);
const YD = 0.9144;
/* authored (right-handed) world space ⇄ actual world space: mirror x for left-handers (an involution) */
const mw = (env, v) => { if (env.mirror) v.x = -v.x; return v; };
const A = (env, x, y, z) => mw(env, V(x, y, z));

/* ================================================================== generic geometry helpers */
function rod(parent, a, b, r, mat, seg = 10) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const _m4 = new THREE.Matrix4();
/* place a tool: local +Y along dir, local +Z toward zHint (orthogonalised) */
function orient(obj, pos, dir, zHint) {
  const y = dir.clone().normalize(); let z = zHint.clone().addScaledVector(y, -zHint.dot(y));
  if (z.lengthSq() < 1e-8) z = Math.abs(y.y) < 0.9 ? V(0, 1, 0).addScaledVector(y, -y.y) : V(1, 0, 0);
  z.normalize(); const x = new THREE.Vector3().crossVectors(y, z);
  _m4.makeBasis(x, y, z); obj.quaternion.setFromRotationMatrix(_m4); obj.position.copy(pos); obj.updateMatrixWorld(true);
  return obj;
}
/* all painted lines of a venue in ONE mesh (quads on the ground) */
class Lines {
  constructor() { this.p = []; this.flip = null; }
  _z(z) { return this.flip === null ? z : this.flip - z; }
  seg(ax, az, bx, bz, w = 0.12) {
    az = this._z(az); bz = this._z(bz);
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2;
    this.p.push(ax + nx, az + nz, ax - nx, az - nz, bx - nx, bz - nz, ax + nx, az + nz, bx - nx, bz - nz, bx + nx, bz + nz);
    return this;
  }
  rect(x0, z0, x1, z1, w) { return this.seg(x0, z0, x1, z0, w).seg(x1, z0, x1, z1, w).seg(x1, z1, x0, z1, w).seg(x0, z1, x0, z0, w); }
  dash(ax, az, bx, bz, w, on = 1, off = 1) {
    const L = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d < L - 1e-6; d += on + off) { const e = Math.min(L, d + on); this.seg(lerp(ax, bx, d / L), lerp(az, bz, d / L), lerp(ax, bx, e / L), lerp(az, bz, e / L), w); }
    return this;
  }
  /* arc around (cx, cz); angle measured from +Z toward +X */
  arc(cx, cz, r, a0, a1, w = 0.12, n = 40, dashed = false) {
    for (let i = 0; i < n; i++) {
      if (dashed && i % 2) continue;
      const u0 = lerp(a0, a1, i / n), u1 = lerp(a0, a1, (i + 1) / n);
      this.seg(cx + r * Math.sin(u0), cz + r * Math.cos(u0), cx + r * Math.sin(u1), cz + r * Math.cos(u1), w);
    }
    return this;
  }
  dot(cx, cz, r, n = 14) {
    cz = this._z(cz);
    for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; this.p.push(cx, cz, cx + r * Math.sin(a0), cz + r * Math.cos(a0), cx + r * Math.sin(a1), cz + r * Math.cos(a1)); }
    return this;
  }
  mesh(parent, color = '#f4f4ee', y = 0.012) {
    const n = this.p.length / 2, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    const P = this.p;
    for (let i = 0; i < n; i += 3) {   // make every triangle face up (+Y)
      const ax = P[i * 2], az = P[i * 2 + 1], bx = P[i * 2 + 2], bz = P[i * 2 + 3], cx = P[i * 2 + 4], cz = P[i * 2 + 5];
      if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) { P[i * 2 + 2] = cx; P[i * 2 + 3] = cz; P[i * 2 + 4] = bx; P[i * 2 + 5] = bz; }
    }
    for (let i = 0; i < n; i++) { pos[i * 3] = P[i * 2]; pos[i * 3 + 1] = y; pos[i * 3 + 2] = P[i * 2 + 1]; nor[i * 3 + 1] = 1; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const m = new THREE.Mesh(geo, std(color, { roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true; parent.add(m); return m;
  }
}
/* goal netting as one LineSegments; push(ball, dir, R) stretches it where the ball hits */
function makeNet(panels, step, color = '#f4f4f0', opacity = 0.8) {
  const pts = [];
  for (const P of panels) {
    const ns = Math.max(1, Math.round(P.ls / step)), nw = Math.max(1, Math.round(P.lw / step));
    for (let i = 0; i <= ns; i++) for (let j = 0; j <= nw; j++) {
      const a = P.f(i / ns, j / nw);
      if (i < ns) pts.push(a.clone(), P.f((i + 1) / ns, j / nw));
      if (j < nw) pts.push(a.clone(), P.f(i / ns, (j + 1) / nw));
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  const base = geo.attributes.position.array.slice(); let dirty = false;
  return {
    line,
    push(B, dir, R, spread = 0.3, cap = 0.65) {
      const a = geo.attributes.position.array; let hit = false;
      for (let i = 0; i < a.length; i += 3) {
        const px = B.x - base[i], py = B.y - base[i + 1], pz = B.z - base[i + 2];
        const al = px * dir.x + py * dir.y + pz * dir.z, along = al + R;
        if (along <= 0) continue;
        const lat2 = Math.max(0, px * px + py * py + pz * pz - al * al), w = Math.exp(-lat2 / (2 * spread * spread));
        if (w < 0.03) continue;
        const d = Math.min(along, cap) * w;
        a[i] = base[i] + dir.x * d; a[i + 1] = base[i + 1] + dir.y * d; a[i + 2] = base[i + 2] + dir.z * d; hit = true;
      }
      if (hit) { geo.attributes.position.needsUpdate = true; dirty = true; }
    },
    reset() { if (!dirty) return; geo.attributes.position.array.set(base); geo.attributes.position.needsUpdate = true; dirty = false; }
  };
}

/* ================================================================== venues */
function skyAndFog(scene, near = 80, far = 290) {
  scene.background = canvasTex(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5d9bd6'); g.addColorStop(0.55, '#a9d0ee'); g.addColorStop(1, '#e7eff2'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog('#d3e3ec', near, far);
}
function grassTex(c1, c2, seed, rep, turf) {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = c1; x.fillRect(0, 0, w, h / 2); x.fillStyle = c2; x.fillRect(0, h / 2, w, h / 2);
    const r = rng(seed);
    for (let i = 0; i < 2600; i++) { x.fillStyle = turf ? `rgba(255,255,255,${(r() * 0.06).toFixed(3)})` : `rgba(${Math.round(10 + r() * 40)},${Math.round(60 + r() * 70)},${Math.round(10 + r() * 30)},.22)`; x.fillRect(r() * w, r() * h, 1, turf ? 1 : 2.5); }
  }, rep);
}
function ground(g, w, l, cz, tex, y = 0) { return add(g, new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), [0, y, cz], [-Math.PI / 2, 0, 0], false); }
/* crowd stands: [x, z, ry (facing), width, height] — front edge at (x, z) */
function stands(g, list, seed = 3) {
  const mat = new THREE.MeshStandardMaterial({ map: crowd(2048, 384, seed, '#26323c'), roughness: 1, color: '#d7dade' }), wall = std('#33414b', { roughness: 0.9 });
  const roofM = std('#d9dde0', { roughness: 0.6, side: THREE.DoubleSide });
  for (const [x, z, ry, w, h = 13, y0 = 1.6] of list) {
    const tilt = 0.55, back = Math.sin(tilt) * h, fx = Math.sin(ry), fz = Math.cos(ry);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); s.rotation.order = 'YXZ'; s.rotation.set(-tilt, ry, 0);
    s.position.set(x - fx * back / 2, y0 + Math.cos(tilt) * h / 2, z - fz * back / 2); g.add(s);
    add(g, new THREE.BoxGeometry(w, y0, 0.4), wall, [x - fx * 0.2, y0 / 2, z - fz * 0.2], [0, ry, 0], false);
    const top = y0 + Math.cos(tilt) * h;
    add(g, new THREE.BoxGeometry(w, top + 2, 0.5), wall, [x - fx * (back + 0.3), (top + 2) / 2, z - fz * (back + 0.3)], [0, ry, 0], false);
    const roof = add(g, new THREE.BoxGeometry(w, 0.25, back * 0.75), roofM, [x - fx * back * 0.62, top + 3.2, z - fz * back * 0.62], [0, ry, 0], false); roof.rotation.order = 'YXZ'; roof.rotation.set(0.12, ry, 0);
  }
}
/* perimeter boards: [x, z, ry (facing), segments of 16 m] */
function boards(g, list) {
  const tex = canvasTex(1024, 64, (x, w, h) => {
    for (let i = 0; i < 4; i++) {
      x.fillStyle = ['#0f8a80', '#1d2d55', '#0f8a80', '#e9edf0'][i]; x.fillRect(i * w / 4, 0, w / 4, h);
      x.fillStyle = i === 3 ? '#0f8a80' : '#f4f4ee'; x.font = '900 30px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SMARTACTION', i * w / 4 + w / 8, h / 2 + 2);
    }
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  for (const [x, z, ry, n] of list) for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 16, rx = Math.cos(ry), rz = -Math.sin(ry);
    add(g, new THREE.BoxGeometry(16, 0.9, 0.08), m, [x + rx * off, 0.45, z + rz * off], [0, ry, 0], false);
  }
}
function cornerFlag(g, x, z, color = '#ffd23d') {
  rod(g, V(x, 0, z), V(x, 1.5, z), 0.015, std('#f4f4ef'));
  add(g, new THREE.PlaneGeometry(0.35, 0.25), std(color, { side: THREE.DoubleSide }), [x + 0.18, 1.36, z], null, false);
}

/* soccer goal (7.32 × 2.44 m) on the line z = 0, net toward −Z */
function soccerGoal(g) {
  const W = 3.66, H = 2.44, white = std('#f7f7f2', { roughness: 0.35 }), dark = std('#9aa3a8', { roughness: 0.5 });
  for (const sx of [-1, 1]) rod(g, V(sx * (W + 0.06), 0, -0.06), V(sx * (W + 0.06), H + 0.12, -0.06), 0.06, white, 14);
  rod(g, V(-W - 0.12, H + 0.06, -0.06), V(W + 0.12, H + 0.06, -0.06), 0.06, white, 14);
  const top = -1.2, back = -2.2, zb = y => lerp(back, top, y / H);
  for (const sx of [-1, 1]) { rod(g, V(sx * W, H, -0.1), V(sx * W, H, top), 0.022, dark); rod(g, V(sx * W, H, top), V(sx * W, 0, back), 0.022, dark); }
  rod(g, V(-W, 0.025, back), V(W, 0.025, back), 0.022, dark); rod(g, V(-W, H, top), V(W, H, top), 0.02, dark);
  const net = makeNet([
    { ls: 2 * W, lw: 1.1, f: (s, w) => V(lerp(-W, W, s), H, lerp(-0.12, top, w)) },
    { ls: 2 * W, lw: 2.6, f: (s, w) => V(lerp(-W, W, s), lerp(H, 0, w), zb(lerp(H, 0, w))) },
    { ls: 1.8, lw: 2.44, f: (s, w) => V(-W, lerp(H, 0, w), lerp(-0.12, zb(lerp(H, 0, w)), s)) },
    { ls: 1.8, lw: 2.44, f: (s, w) => V(W, lerp(H, 0, w), lerp(-0.12, zb(lerp(H, 0, w)), s)) }
  ], 0.16);
  g.add(net.line); return net;
}
function farGoal(g, z, build) { const fg = new THREE.Group(); fg.position.set(0, 0, z); fg.rotation.y = Math.PI; g.add(fg); build(fg); return fg; }

function soccerPitch(scene) {
  const g = new THREE.Group(); scene.add(g); skyAndFog(scene);
  ground(g, 200, 260, 52.5, grassTex('#3f8a3a', '#3b8437', 9, [40, 52]), -0.01);
  ground(g, 74, 111, 52.5, grassTex('#52a14a', '#46923f', 5, [1, 10.5]), 0);
  const ln = new Lines();
  ln.rect(-34, 0, 34, 105, 0.12).seg(-34, 52.5, 34, 52.5).arc(0, 52.5, 9.15, 0, Math.PI * 2, 0.12, 64).dot(0, 52.5, 0.15);
  for (const flip of [null, 105]) {
    ln.flip = flip;
    ln.seg(-20.16, 0, -20.16, 16.5).seg(-20.16, 16.5, 20.16, 16.5).seg(20.16, 16.5, 20.16, 0);
    ln.seg(-9.16, 0, -9.16, 5.5).seg(-9.16, 5.5, 9.16, 5.5).seg(9.16, 5.5, 9.16, 0);
    ln.dot(0, 11, 0.12).arc(0, 11, 9.15, -0.927, 0.927, 0.12, 28);
    ln.arc(-34, 0, 1, 0, Math.PI / 2, 0.12, 8).arc(34, 0, 1, -Math.PI / 2, 0, 0.12, 8);
  }
  ln.flip = null; ln.mesh(g);
  const net = soccerGoal(g); farGoal(g, 105, soccerGoal);
  for (const [x, z] of [[-34, 0], [34, 0], [-34, 105], [34, 105]]) cornerFlag(g, x, z);
  boards(g, [[0, -5, 0, 5], [-39, 30, Math.PI / 2, 4], [39, 30, -Math.PI / 2, 4]]);
  stands(g, [[0, -13, 0, 96], [-46, 52.5, Math.PI / 2, 120], [46, 52.5, -Math.PI / 2, 120], [0, 118, Math.PI, 96]], 3);
  return { group: g, goal: net, reset() { net.reset(); } };
}

function rugbyPosts(g, z) {
  const white = std('#f7f7f2', { roughness: 0.35 }), pad = std('#0f8a80', { roughness: 0.8 });
  for (const sx of [-1, 1]) { rod(g, V(sx * 2.8, 0, z), V(sx * 2.8, 13, z), 0.075, white, 12); add(g, new THREE.CylinderGeometry(0.34, 0.34, 2.0, 16), pad, [sx * 2.8, 1.0, z]); }
  rod(g, V(-2.8, 3.0, z), V(2.8, 3.0, z), 0.065, white, 12);
}
function rugbyPitch(scene) {
  const g = new THREE.Group(); scene.add(g); skyAndFog(scene);
  ground(g, 210, 280, 50, grassTex('#3f8a3a', '#3b8437', 9, [40, 54]), -0.01);
  ground(g, 76, 124, 50, grassTex('#52a14a', '#46923f', 6, [1, 12]), 0);
  const ln = new Lines();
  ln.rect(-35, -10, 35, 110, 0.12).seg(-35, 0, 35, 0, 0.14).seg(-35, 100, 35, 100, 0.14).seg(-35, 22, 35, 22).seg(-35, 78, 35, 78).seg(-35, 50, 35, 50);
  ln.dash(-35, 40, 35, 40, 0.12, 2, 1.5).dash(-35, 60, 35, 60, 0.12, 2, 1.5);
  for (const sx of [-1, 1]) {
    ln.dash(sx * 20, 5, sx * 20, 95, 0.1, 1.5, 3.5).dash(sx * 30, 5, sx * 30, 95, 0.1, 1.5, 3.5);
    for (const z of [5, 95]) ln.dash(sx * 3, z, sx * 20, z, 0.1, 1.5, 2);
  }
  ln.mesh(g);
  rugbyPosts(g, 0); rugbyPosts(g, 100);
  for (const [x, z] of [[-35, 0], [35, 0], [-35, 22], [35, 22], [-35, -10], [35, -10]]) cornerFlag(g, x, z, '#ffffff');
  boards(g, [[0, -14, 0, 5], [-40, 30, Math.PI / 2, 4], [40, 30, -Math.PI / 2, 4]]);
  stands(g, [[0, -22, 0, 96], [-48, 50, Math.PI / 2, 130], [48, 50, -Math.PI / 2, 130], [0, 122, Math.PI, 96]], 4);
  return { group: g, reset() {} };
}

function afPost(g, zEnd) {
  const y = std('#f2c94c', { roughness: 0.4, metalness: 0.15 }), pad = std('#1d2d55', { roughness: 0.8 }), zb = zEnd - 1.8;
  rod(g, V(0, 0, zb), V(0, 2.55, zb), 0.1, y); rod(g, V(0, 2.5, zb), V(0, 3.05, zb + 0.7), 0.09, y); rod(g, V(0, 3.05, zb + 0.65), V(0, 3.05, zEnd), 0.08, y);
  add(g, new THREE.CylinderGeometry(0.26, 0.26, 2.0, 16), pad, [0, 1.0, zb]);
  rod(g, V(-2.88, 3.05, zEnd), V(2.88, 3.05, zEnd), 0.06, y);
  for (const sx of [-1, 1]) { rod(g, V(sx * 2.82, 3.05, zEnd), V(sx * 2.82, 12.2, zEnd), 0.05, y); add(g, new THREE.BoxGeometry(0.1, 1.0, 0.02), std('#ff7a1a'), [sx * 2.82, 11.8, zEnd + 0.06], null, false); }
}
function yardNumber(txt) {
  return canvasTex(256, 160, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#f4f4ee'; x.font = '900 150px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 8); });
}
function gridiron(scene, flag) {
  const g = new THREE.Group(); scene.add(g); skyAndFog(scene);
  const half = flag ? 12.5 * YD : 26.65 * YD, len = flag ? 50 * YD : 100 * YD, ez = 10 * YD;
  ground(g, 200, 260, len / 2, grassTex('#3f8a3a', '#3b8437', 9, [40, 52]), -0.01);
  ground(g, 2 * half + 8, len + 2 * ez + 8, len / 2, grassTex('#4f9e47', '#4a9843', 7, [1, (len + 2 * ez + 8) / (10 * YD)]), 0);
  for (const zc of [-ez / 2, len + ez / 2]) add(g, new THREE.PlaneGeometry(2 * half, ez), std('#0d6f68', { roughness: 0.95 }), [0, 0.004, zc], [-Math.PI / 2, 0, 0], false);
  const ln = new Lines();
  ln.rect(-half, -ez, half, len + ez, 0.15).seg(-half, 0, half, 0, 0.2).seg(-half, len, half, len, 0.2);
  for (let k = 1; k < (flag ? 10 : 20); k++) ln.seg(-half, k * 5 * YD, half, k * 5 * YD, 0.1);
  if (!flag) for (let k = 1; k < 100; k++) { if (k % 5 === 0) continue; const z = k * YD; for (const sx of [-1, 1]) { ln.seg(sx * (half - 0.3), z, sx * (half - 0.9), z, 0.1); ln.seg(sx * 2.82, z, sx * 3.43, z, 0.1); ln.seg(sx * 2.82 - sx * 0.61, z, sx * 2.82, z, 0.1); } }
  ln.mesh(g);
  if (!flag) {
    const tex = {}; for (const n of ['10', '20', '30', '40', '50']) tex[n] = yardNumber(n);
    for (let k = 1; k <= 9; k++) for (const sx of [-1, 1]) {
      const n = String(10 * (k <= 5 ? k : 10 - k)), m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.83), new THREE.MeshStandardMaterial({ map: tex[n], transparent: true, roughness: 0.8, depthWrite: false }));
      m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0); m.position.set(sx * (half - 12 * YD), 0.014, k * 10 * YD); m.receiveShadow = true; g.add(m);
    }
    afPost(g, -ez); farGoal(g, len + ez, fg => afPost(fg, 0));
  }
  const word = canvasTex(1024, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(244,244,238,.92)'; x.font = '900 104px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SMARTACTION', w / 2, h / 2 + 6); });
  for (const [zc, r] of [[-ez / 2, 0], [len + ez / 2, Math.PI]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * half * 0.8, ez * 0.6), new THREE.MeshStandardMaterial({ map: word, transparent: true, depthWrite: false, roughness: 0.9 })); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, r, 0); m.position.set(0, 0.014, zc); m.receiveShadow = true; g.add(m); }
  const pyl = std('#ff7a1a', { roughness: 0.6 });
  for (const sx of [-1, 1]) for (const z of [0, -ez, len, len + ez]) add(g, new THREE.BoxGeometry(0.1, 0.46, 0.1), pyl, [sx * half, 0.23, z]);
  boards(g, flag ? [[0, -ez - 5, 0, 2]] : [[0, -ez - 6, 0, 4]]);
  if (flag) stands(g, [[0, -ez - 10, 0, 40, 8], [-half - 10, len / 2, Math.PI / 2, 60, 8], [half + 10, len / 2, -Math.PI / 2, 60, 8]], 6);
  else stands(g, [[0, -ez - 12, 0, 80], [-half - 14, len / 2, Math.PI / 2, 130], [half + 14, len / 2, -Math.PI / 2, 130], [0, len + ez + 12, Math.PI, 80]], 6);
  return { group: g, reset() {} };
}

/* field hockey goal: 3.66 × 2.14 m, boards 0.46 m high, 1.2 m deep */
function hockeyGoal(g) {
  const W = 1.83, H = 2.14, D = 1.2, bH = 0.46, white = std('#f4f4ef', { roughness: 0.4 }), board = std('#1d2a33', { roughness: 0.7 }), dark = std('#9aa3a8', { roughness: 0.5 });
  for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.05, H + 0.05, 0.05), white, [sx * (W + 0.025), (H + 0.05) / 2, -0.025]);
  add(g, new THREE.BoxGeometry(2 * W + 0.1, 0.05, 0.05), white, [0, H + 0.025, -0.025]);
  add(g, new THREE.BoxGeometry(2 * W, bH, 0.03), board, [0, bH / 2, -D]);
  for (const sx of [-1, 1]) { add(g, new THREE.BoxGeometry(0.03, bH, D), board, [sx * W, bH / 2, -D / 2]); rod(g, V(sx * W, H, -0.05), V(sx * W, H, -D), 0.018, dark); rod(g, V(sx * W, H, -D), V(sx * W, bH, -D), 0.018, dark); }
  rod(g, V(-W, H, -D), V(W, H, -D), 0.018, dark);
  const net = makeNet([
    { ls: 2 * W, lw: D, f: (s, w) => V(lerp(-W, W, s), H, lerp(-0.06, -D, w)) },
    { ls: 2 * W, lw: H - bH, f: (s, w) => V(lerp(-W, W, s), lerp(H, bH, w), -D + 0.02) },
    { ls: D, lw: H - bH, f: (s, w) => V(-W + 0.02, lerp(H, bH, w), lerp(-0.06, -D, s)) },
    { ls: D, lw: H - bH, f: (s, w) => V(W - 0.02, lerp(H, bH, w), lerp(-0.06, -D, s)) }
  ], 0.12);
  g.add(net.line); return net;
}
function hockeyTurf(scene) {
  const g = new THREE.Group(); scene.add(g); skyAndFog(scene, 70, 240);
  ground(g, 200, 260, 45.7, grassTex('#3f8a3a', '#3b8437', 9, [40, 52]), -0.01);
  ground(g, 63, 101.4, 45.7, grassTex('#3e8e52', '#3b8a4f', 11, [6, 10], true), 0);
  add(g, new THREE.PlaneGeometry(55, 91.4), new THREE.MeshStandardMaterial({ map: grassTex('#2f6cb3', '#2c68ae', 12, [5, 9], true), roughness: 0.85 }), [0, 0.004, 45.7], [-Math.PI / 2, 0, 0], false);
  const ln = new Lines(), w = 0.075;
  ln.rect(-27.5, 0, 27.5, 91.4, w).seg(-27.5, 45.7, 27.5, 45.7, w);
  for (const flip of [null, 91.4]) {
    ln.flip = flip;
    ln.seg(-27.5, 22.9, 27.5, 22.9, w);
    ln.arc(-1.83, 0, 14.63, -Math.PI / 2, 0, w, 24).arc(1.83, 0, 14.63, 0, Math.PI / 2, w, 24).seg(-1.83, 14.63, 1.83, 14.63, w);
    ln.arc(-1.83, 0, 19.63, -Math.PI / 2, 0, w, 30, true).arc(1.83, 0, 19.63, 0, Math.PI / 2, w, 30, true).dash(-1.83, 19.63, 1.83, 19.63, w, 0.3, 3);
    ln.dot(0, 6.475, 0.075);
    for (const sx of [-1, 1]) for (const d of [5, 10]) ln.seg(sx * (1.83 + d), 0, sx * (1.83 + d), 0.3, w);
  }
  ln.flip = null; ln.mesh(g);
  const net = hockeyGoal(g); farGoal(g, 91.4, hockeyGoal);
  boards(g, [[0, -6, 0, 4]]);
  stands(g, [[0, -12, 0, 70, 9], [-38, 45.7, Math.PI / 2, 100, 9], [38, 45.7, -Math.PI / 2, 100, 9], [0, 104, Math.PI, 70, 9]], 7);
  return { group: g, goal: net, reset() { net.reset(); } };
}

/* lacrosse goal: 1.83 × 1.83 m frame, pyramid net to a point 2.13 m behind */
function laxGoal(g) {
  const W = 0.915, H = 1.83, apex = V(0, 0.02, -2.13), orange = std('#ff6a1a', { roughness: 0.4, metalness: 0.2 }), white = std('#f2f2ee');
  for (const sx of [-1, 1]) { rod(g, V(sx * (W + 0.025), 0, 0), V(sx * (W + 0.025), H + 0.05, 0), 0.025, orange); rod(g, V(sx * W, 0.02, 0), apex, 0.018, white); }
  rod(g, V(-W - 0.05, H + 0.025, 0), V(W + 0.05, H + 0.025, 0), 0.025, orange);
  const loop = s => s < 1 / 3 ? V(-W, s * 3 * H, -0.03) : s < 2 / 3 ? V(lerp(-W, W, (s - 1 / 3) * 3), H, -0.03) : V(W, H * (1 - (s - 2 / 3) * 3), -0.03);
  const net = makeNet([{ ls: 2 * H + 2 * W, lw: 2.5, f: (s, w) => loop(s).lerp(apex, w * 0.98) }], 0.11, '#f0f0ea', 0.75);
  g.add(net.line); return net;
}
function laxField(scene) {
  const g = new THREE.Group(); scene.add(g); skyAndFog(scene);
  const half = 27.43, zE = -13.72, zF = 86.87, mid = 36.58;
  ground(g, 200, 260, mid, grassTex('#3f8a3a', '#3b8437', 9, [40, 52]), -0.01);
  ground(g, 2 * half + 8, zF - zE + 8, mid, grassTex('#52a14a', '#46923f', 8, [1, 10]), 0);
  const ln = new Lines(), w = 0.1;
  ln.rect(-half, zE, half, zF, w).seg(-half, mid, half, mid, w).seg(-half, 18.29, half, 18.29, w).seg(-half, 54.86, half, 54.86, w);
  for (const zc of [0, 73.15]) { ln.arc(0, zc, 2.74, 0, Math.PI * 2, 0.08, 48); ln.seg(-0.915, zc, 0.915, zc, 0.06); }
  ln.seg(-0.6, mid - 0.6, 0.6, mid + 0.6, 0.08).seg(-0.6, mid + 0.6, 0.6, mid - 0.6, 0.08).arc(0, mid, 9, 0, Math.PI * 2, 0.08, 64);
  for (const sx of [-1, 1]) ln.seg(sx * (half - 9.14), mid - 9.14, sx * (half - 9.14), mid + 9.14, w);
  ln.mesh(g);
  const net = laxGoal(g); farGoal(g, 73.15, laxGoal);
  boards(g, [[0, zE - 4, 0, 3]]);
  stands(g, [[0, zE - 10, 0, 70, 10], [-half - 12, mid, Math.PI / 2, 110, 10], [half + 12, mid, -Math.PI / 2, 110, 10], [0, zF + 10, Math.PI, 70, 10]], 8);
  return { group: g, goal: net, reset() { net.reset(); } };
}

/* ================================================================== balls and sticks */
function soccerBall() {
  const tex = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#f7f7f2'; x.fillRect(0, 0, w, h); x.fillStyle = '#1c1e24';
    const phi = (1 + Math.sqrt(5)) / 2, verts = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) verts.push([0, a, b * phi], [a, b * phi, 0], [b * phi, 0, a]);
    for (const v of verts) {
      const d = V(v[0], v[1], v[2]).normalize(), t1 = V(0, 1, 0).cross(d); if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0); t1.normalize(); const t2 = d.clone().cross(t1);
      const poly = [];
      for (let k = 0; k < 5; k++) {
        const an = k / 5 * Math.PI * 2, p = d.clone().addScaledVector(t1, Math.cos(an) * 0.37).addScaledVector(t2, Math.sin(an) * 0.37).normalize();
        poly.push([(Math.atan2(p.z, -p.x) / (2 * Math.PI) + 1) % 1 * w, Math.acos(clamp(p.y, -1, 1)) / Math.PI * h]);
      }
      for (let k = 1; k < 5; k++) { while (poly[k][0] - poly[0][0] > w / 2) poly[k][0] -= w; while (poly[k][0] - poly[0][0] < -w / 2) poly[k][0] += w; }
      for (const off of [-w, 0, w]) { x.beginPath(); poly.forEach(([px, py], k) => k ? x.lineTo(px + off, py) : x.moveTo(px + off, py)); x.closePath(); x.fill(); }
    }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 28, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42 }));
  m.castShadow = true; return m;
}
function prolate(len, rad, pw, tex) {
  const pts = []; for (let i = 0; i <= 28; i++) { const y = -len / 2 + len * i / 28, k = Math.max(0, 1 - Math.pow(2 * y / len, 2)); pts.push(new THREE.Vector2(Math.max(0.0005, rad * Math.pow(k, pw)), y)); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  m.castShadow = true; const g = new THREE.Group(); g.add(m); return g;   // long axis = local Y
}
function rugbyBall() {
  return prolate(0.29, 0.096, 0.62, canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#f3f1ea'; x.fillRect(0, 0, w, h); x.fillStyle = '#0f8a80'; x.fillRect(0, h * 0.22, w, h * 0.05); x.fillRect(0, h * 0.73, w, h * 0.05);
    x.fillStyle = '#1d2d55'; x.fillRect(0, h * 0.46, w, h * 0.08); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; for (const u of [0, 0.25, 0.5, 0.75]) { x.beginPath(); x.moveTo(u * w + 1, 0); x.lineTo(u * w + 1, h); x.stroke(); }
  }));
}
function football() {
  return prolate(0.28, 0.086, 0.78, canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#7b3f1e'; x.fillRect(0, 0, w, h); const r = rng(4); for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(40,15,5,${(r() * 0.25).toFixed(2)})`; x.fillRect(r() * w, r() * h, 1.5, 1.5); }
    x.strokeStyle = 'rgba(30,10,4,.6)'; x.lineWidth = 2; for (const u of [0, 0.25, 0.5, 0.75]) { x.beginPath(); x.moveTo(u * w + 1, 0); x.lineTo(u * w + 1, h); x.stroke(); }
    x.fillStyle = '#f4f1e8'; x.fillRect(w * 0.25 - 2, h * 0.32, 4, h * 0.36); for (let i = 0; i < 8; i++) x.fillRect(w * 0.25 - 9, h * (0.34 + i * 0.043), 18, 4);
  }));
}
function smallBall(r, color) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), std(color, { roughness: 0.45 })); m.castShadow = true; return m; }
const hockeyBall = () => smallBall(0.04, '#f7f7f2');
const laxBall = () => smallBall(0.034, '#ffd23d');

/* field hockey stick: butt at the origin, shaft along +Y, J-hook at the end curling toward +Z; flat face toward −X */
const HS = { L: 0.8, rh: 0.045 };
function hockeyStick(accent = '#0f8a80') {
  const g = new THREE.Group(), body = std('#1f2428', { roughness: 0.35, metalness: 0.15 });
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0175, HS.L, 10), body); sh.position.y = HS.L / 2; sh.scale.z = 1.25; g.add(sh);
  const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 10), std('#33373b', { roughness: 0.95 })); gr.position.y = 0.16; g.add(gr);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), std(accent, { roughness: 0.4 })); st.position.y = 0.55; st.scale.z = 1.25; g.add(st);
  const head = new THREE.Mesh(new THREE.TorusGeometry(HS.rh, 0.017, 8, 14, Math.PI), body); head.rotation.y = Math.PI / 2; head.position.set(0, HS.L, HS.rh); head.scale.z = 0.62; g.add(head);
  return g;
}
/* ball centre when touching the flat face at the bottom of the hook (stick-local) */
const HS_BALL = V(-0.052, HS.L + HS.rh - 0.012, HS.rh * 0.9);
/* lacrosse stick: butt at the origin, shaft along +Y, head above; the pocket opens toward +Z */
function laxStick(len = 0.78, head = '#f4f4ef') {
  const g = new THREE.Group(), shaft = std('#2b2f33', { roughness: 0.3, metalness: 0.5 }), hm = std(head, { roughness: 0.4 });
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 10), shaft); sh.position.y = len / 2; g.add(sh);
  add(g, new THREE.CylinderGeometry(0.017, 0.017, 0.03, 10), std('#1b1b1b'), [0, 0.015, 0]);
  const pts = [[0, -0.02, 0], [0.03, 0.03, 0], [0.058, 0.1, 0], [0.078, 0.18, 0.004], [0.07, 0.24, 0.012], [0.035, 0.268, 0.02], [0, 0.272, 0.022]];
  const loop = pts.map(p => V(p[0], len + p[1], p[2])).concat(pts.slice(1, -1).reverse().map(p => V(-p[0], len + p[1], p[2])));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true), 48, 0.0075, 6, true), hm); g.add(tube);
  const pocket = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), std('#e9e6dc', { wireframe: true, roughness: 0.9 })); pocket.scale.set(0.062, 0.105, 0.04); pocket.position.set(0, len + 0.145, -0.012); g.add(pocket);
  add(g, new THREE.CylinderGeometry(0.02, 0.016, 0.06, 10), hm, [0, len + 0.0, 0]);
  g.userData.len = len; return g;
}
const laxPocket = stick => V(0, stick.userData.len + 0.14, -0.022);

/* ================================================================== extra players (opponents / team-mates) */
function extra(env, o = {}) {
  const a = { id: 'extra-' + (o.tag || 'x'), name: '', gender: o.gender || (env.athlete && env.athlete.gender) || 'm', heightCm: o.h || 183, weightKg: o.w,
    appearance: { skin: o.skin || '#b98a68', hair: o.hair || '#2a1d14', hairStyle: o.hairStyle || 'short', build: o.build || 'athletic', facialHair: 'none', accessory: 'none', jerseyNumber: null } };
  const navy = env.rig.u && env.rig.u.jersey === UNIFORMS.navy.jersey;
  const own = Object.keys(UNIFORMS).find(k => UNIFORMS[k].jersey === (env.rig.u && env.rig.u.jersey)) || 'teal';
  const rig = new AthleteRig(a, o.sport || env.rig.sport, o.uni === 'same' ? own : o.uni || (navy ? 'coral' : 'navy'));
  env.addProp(rig.root); rig.setExpression({ focus: 0.6 });
  if (rig.sport === 'lacrosse' && a.gender === 'f') rig.setHeadwear(null);   // women's field lacrosse: eyewear, no helmet
  return rig;
}
const poseX = (env, rig, q) => rig.applyPose(env.mirror ? mirrorPose(q) : q);
const reachX = (env, rig, side, target, pole, opts) => rig.reach(env.mirror ? (side === 'l' ? 'r' : 'l') : side, target, pole, opts);
/* stationary training mannequin (free-kick wall, dribbling obstacles) */
function mannequin(env, x, z, ry = 0, color = '#ffd23d') {
  const g = new THREE.Group(), m = std(color, { roughness: 0.6 }), dark = std('#2b2f33');
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), dark, [0, 0.15, 0]);
  const body = add(g, new THREE.CapsuleGeometry(0.2, 0.95, 4, 12), m, [0, 1.0, 0]); body.scale.set(1, 1, 0.45);
  add(g, new THREE.SphereGeometry(0.12, 12, 10), m, [0, 1.78, 0]);
  for (const sx of [-1, 1]) { const leg = add(g, new THREE.CapsuleGeometry(0.07, 0.35, 4, 8), m, [sx * 0.1, 0.33, 0]); leg.scale.set(1, 1, 0.6); }
  const p = mw(env, V(x, 0, z)); g.position.copy(p); g.rotation.y = (env.mirror ? -ry : ry) * D2R; env.addProp(g); return g;
}

/* ================================================================== shared motion helpers */
const RUN_ARMS = { lShF: 10, rShF: 10, lEl: 80, rEl: 80, lShA: 12, rShA: 12 };
/* gait blended over [from, to] with smooth in/out */
function runBlend(q, t, from, to, period, k = 0.9, hold = false, phase0 = 0, edge = 0.15) {
  if (t <= from || t >= to) return q;
  return addPose(q, gait((t - from) / period + phase0, k, hold), Math.min(1, smooth(span(t, from, from + edge)) * (1 - smooth(span(t, to - edge, to)))));
}
/* ball centre where the (authored) foot meets the ball, in world space */
function footBall(env, side, part, R) {
  const s = env.side(side), rig = env.rig, sc = env.s;
  const heel = rig['heel_' + s].getWorldPosition(V()), toe = rig['toe_' + s].getWorldPosition(V());
  const q = rig.bones[s + 'Foot'].getWorldQuaternion(new THREE.Quaternion());
  const ax = V(1, 0, 0).applyQuaternion(q), up = V(0, 1, 0).applyQuaternion(q), fwd = toe.clone().sub(heel).normalize();
  const inward = s === 'r' ? 1 : -1, p = heel.clone().lerp(toe, 0.5);
  if (part === 'inside') p.addScaledVector(ax, inward * (0.062 * sc + R)).addScaledVector(up, 0.035 * sc);
  else if (part === 'outside') p.lerp(toe, 0.3).addScaledVector(ax, -inward * (0.062 * sc + R)).addScaledVector(up, 0.035 * sc);
  else if (part === 'laces') p.copy(heel).lerp(toe, 0.66).addScaledVector(up, 0.07 * sc + R * 0.9).addScaledVector(fwd, R * 0.35);
  else if (part === 'toe') p.copy(toe).addScaledVector(fwd, R + 0.01).addScaledVector(up, 0.035 * sc);
  else if (part === 'sole') p.addScaledVector(up, -R * 0.6);
  else if (part === 'heel') p.copy(heel).addScaledVector(fwd, -R - 0.015).addScaledVector(up, 0.04 * sc);
  else if (part === 'head') { rig.headGroup.getWorldPosition(p); p.addScaledVector(env.dir([0, 0, 1]), 0.0); }
  return p;
}
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
/* deterministic ball spin: rotate about axis by angle (radians) from a fixed base orientation */
function spinBall(B, axis, angle) { _ax.copy(axis); if (_ax.lengthSq() < 1e-8) _ax.set(1, 0, 0); _ax.normalize(); B.quaternion.setFromAxisAngle(_ax, angle); }
/* rolling ball: axis perpendicular to the travel direction, angle = distance / radius */
function rollSpin(B, from, to, R) { const d = V(to.x - from.x, 0, to.z - from.z), L = d.length(); spinBall(B, V(d.z, 0, -d.x), L / R); }
/* prolate ball (rugby / american football): long axis along dir, spun about it */
function aimBall(B, dir, spin = 0) { const d = dir.clone().normalize(); _q.setFromUnitVectors(UP, d); B.quaternion.setFromAxisAngle(d, spin).multiply(_q); }

/* ================================================================== ball paths (authored space; knots filled in start()) */
class BallPath {
  constructor(R) { this.R = R; this.k = []; this.tab = null; }
  add(t, p, mode = 'roll', o = {}) { this.k.push({ t, p: p.clone(), mode, o }); return this; }
  pos(t, out = V()) {
    const k = this.k; if (!k.length) return out.set(0, -5, 0);
    if (t <= k[0].t) return out.copy(k[0].p);
    for (let i = 0; i < k.length - 1; i++) { const a = k[i], b = k[i + 1]; if (t <= b.t) return this.seg(a, b, (t - a.t) / Math.max(1e-6, b.t - a.t), out); }
    return out.copy(k[k.length - 1].p);
  }
  seg(a, b, u, out) {
    const o = a.o;
    switch (a.mode) {
      case 'hold': return out.copy(a.p);
      case 'lin': return out.lerpVectors(a.p, b.p, u);
      case 'roll': { const e = o.lin ? u : easeOut(u); out.lerpVectors(a.p, b.p, e); if (o.h) out.y += 4 * o.h * u * (1 - u); return out; }
      case 'arc': return arc(a.p, b.p, o.h || 0.5, u, out);
      case 'shot': return shotPos(a.p, b.p, u, o, out);
      case 'net': { const tau = u * (b.t - a.t); out.copy(a.p).addScaledVector(o.dir, (o.depth || 1.5) * (1 - Math.exp(-6 * tau))); out.y = Math.max(this.R, a.p.y + (o.vy || 0) * tau - 4.9 * tau * tau); return out; }
      case 'bounce': {   // ground ball bouncing away and settling: o.n bounces
        out.lerpVectors(a.p, b.p, easeOut(u)); const n = o.n || 2, ph = u * n; out.y = Math.max(a.p.y, b.p.y) * (1 - u) * 0 + this.R + (o.h || 0.6) * Math.abs(Math.sin(ph * Math.PI)) * Math.pow(1 - u, 1.5); return out;
      }
    }
    return out.copy(a.p);
  }
  /* cumulative distance table for rolling spin */
  build(t0, t1) { this.t0 = t0; this.dt = 1 / 120; const n = Math.ceil((t1 - t0) / this.dt) + 2, tab = new Float32Array(n), a = V(), b = V(); this.pos(t0, a); for (let i = 1; i < n; i++) { this.pos(t0 + i * this.dt, b); tab[i] = tab[i - 1] + a.distanceTo(b); a.copy(b); } this.tab = tab; }
  dist(t) { if (!this.tab) return 0; const f = clamp((t - this.t0) / this.dt, 0, this.tab.length - 1.001), i = Math.floor(f); return lerp(this.tab[i], this.tab[i + 1], f - i); }
}
/* shot flight from a to b (u 0..1): apex (m above the chord), curve (sideways bulge to the shooter's right), wobble (knuckle), dip */
function shotPos(a, b, u, o, out) {
  out.lerpVectors(a, b, u); out.y += 4 * (o.apex || 0) * u * (1 - u);
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, rx = -dz / L, rz = dx / L;
  let lat = (o.curve || 0) * 4 * u * (1 - u) * (o.late ? 0.55 + 0.9 * u : 1);
  if (o.wobble) { lat += o.wobble * Math.sin(u * Math.PI * 5) * u; out.y += o.wobble * 0.7 * Math.sin(u * Math.PI * 4) * u; }
  if (o.dip) out.y += o.dip * 6.75 * u * (1 - u) * (1 - u);
  out.x += rx * lat; out.z += rz * lat; return out;
}
/* ball centre in front of the forehead (header) */
function headBall(env, R) {
  const hg = env.rig.headGroup, p = hg.getWorldPosition(V()), q = hg.getWorldQuaternion(new THREE.Quaternion());
  return p.addScaledVector(V(0, 0, 1).applyQuaternion(q), env.rig.headR * 0.95 + R).addScaledVector(V(0, 1, 0).applyQuaternion(q), env.rig.headR * 0.25);
}

/* ================================================================== soccer */
const RS = 0.11;
const READY_S = { lHipF: 14, rHipF: 14, lKnee: 20, rKnee: 20, lAnk: 6, rAnk: 6, spineX: 8, chestX: 3, lHipA: 6, rHipA: 6, lShF: 12, rShF: 12, lShA: 14, rShA: 14, lEl: 30, rEl: 30, headX: -4 };
/* right-footed strike around contact time tc (kind: curl | drive | knuckle | chip | cross | poke) */
function kickKeys(tc, kind, f = {}) {
  const curl = kind === 'curl' || kind === 'cross', lean = kind === 'chip' || kind === 'cross' ? -8 : kind === 'knuckle' ? 12 : 6;
  const R = curl ? 36 : kind === 'poke' ? -8 : 0, fol = kind === 'knuckle' ? 0.55 : kind === 'poke' ? 0.45 : 1;
  return [
    [tc - 0.3, Object.assign({ lHipF: 40, lKnee: 24, lAnk: 6, rHipF: -16, rKnee: 64, rAnk: 26, rHipR: 0, rHipA: 4, lHipA: 4, spineX: 9, hipsY: -6, hipsZ: 0, spineZ: 0, chestY: 6, lShF: 28, lShA: 30, lEl: 40, rShF: -18, rShA: 22, rEl: 40, headX: 10, air: 0 }, f.pre)],
    [tc - 0.13, Object.assign({ lHipF: 20, lKnee: 22, lAnk: -2, lHipA: 6, rHipF: -36, rKnee: 104, rAnk: 34, rHipA: 8, rHipR: R * 0.5, hipsY: -22, hipsZ: -4, spineX: 6 + lean * 0.4, spineZ: 6, chestY: 12, lShF: 26, lShA: 72, lEl: 24, rShF: -24, rShA: 42, rEl: 30, headX: 22 }, f.plant)],
    [tc, Object.assign({ lHipF: 15, lKnee: 18, lAnk: -3, rHipF: 14, rKnee: 44, rAnk: curl ? 12 : 44, rHipR: R, rHipA: 4, hipsY: 8, hipsZ: -11, spineX: 10 + lean, spineZ: 10, chestY: -6, lShF: 32, lShA: 82, lEl: 18, rShF: 22, rShA: 30, rEl: 30, headX: 26 }, f.hit)],
    [tc + 0.17, Object.assign({ lHipF: 10, lKnee: 14, lAnk: -20, rHipF: 14 + 52 * fol, rKnee: 44 - 28 * fol, rAnk: 18, rHipR: R * 0.7, hipsY: 6 + 16 * fol, hipsZ: -6, spineX: 2 + lean * 0.5, spineZ: 6, chestY: -14, lShF: 40, lShA: 62, rShF: 46, rShA: 24, headX: 8 }, f.follow)],
    [tc + 0.45, Object.assign({ lHipF: -12, lKnee: 34, lAnk: 10, rHipF: 22, rKnee: 22, rAnk: 2, rHipR: 6, hipsY: 2, hipsZ: 0, spineX: 8, spineZ: 0, chestY: 0, lShF: 14, lShA: 24, lEl: 32, rShF: 10, rShA: 20, rEl: 32, headX: 0 }, f.land)]
  ];
}
/* root path keys for a strike: at contact the root is at S, heading ry; f = approach direction (unit, [x,z]) */
function kickRoot(tc, S, ry, f, g = ry) {
  const fx = Math.sin(g * D2R), fz = Math.cos(g * D2R);
  return [[tc - 0.3, { x: S[0] - f[0] * 0.95, z: S[1] - f[1] * 0.95 }], [tc - 0.13, { x: S[0] - f[0] * 0.32, z: S[1] - f[1] * 0.32, ry }], [tc, { x: S[0], z: S[1], ry }], [tc + 0.17, { x: S[0] + fx * 0.3, z: S[1] + fz * 0.3 }], [tc + 0.45, { x: S[0] + fx * 0.85, z: S[1] + fz * 0.85, ry: g }]];
}
/* per-field track: every field interpolates (monotone cubic) between the keys that mention it, so root paths and body
   actions can be authored as separate key lists and merged */
function ftrack(keys) {
  const fields = {}, mk = merge(keys), times = mk.map(k => k[0]);
  for (const [t, p] of mk) for (const k in p) (fields[k] || (fields[k] = [])).push([t, p[k]]);
  for (const k in fields) {   // before its first mention a field rests at its base value (like cumulative keys)
    const t1 = fields[k][0][0]; let t0 = null; for (const t of times) if (t < t1 - 1e-6) t0 = t;
    if (t0 !== null) fields[k].unshift([t0, BASE[k] === undefined ? 0 : BASE[k]]);
  }
  const fns = {};
  for (const k in fields) { const arr = fields[k]; fns[k] = arr.length === 1 ? (() => arr[0][1]) : numTrack(arr); }
  return t => { const o = Object.assign({}, BASE); for (const k in fns) o[k] = fns[k](t); return o; };
}
const merge = keys => { const m = new Map(); for (const [t, p] of keys) { const k = Math.round(t * 1000); m.set(k, Object.assign(m.get(k) || {}, p)); } return [...m.entries()].sort((x, y) => x[0] - y[0]).map(([k, p]) => [k / 1000, p]); };
/* celebrations (generic joy, no personal trademark gestures unless documented in the catalogue) */
function cheer(t0, kind = 'pump') {
  if (kind === 'arms') return [[t0, Object.assign({}, READY_S)], [t0 + 0.45, { lShA: 80, rShA: 80, lShF: 25, rShF: 25, lEl: 8, rEl: 8, spineX: -2, chestX: -6, headX: -10 }], [t0 + 1.1, { lShA: 84, rShA: 84, headX: -14 }]];
  if (kind === 'sky') return [[t0, Object.assign({}, READY_S)], [t0 + 0.45, { lShF: 150, rShF: 150, lShA: 22, rShA: 22, lEl: 6, rEl: 6, spineX: -6, chestX: -6, headX: -22 }], [t0 + 1.1, { lShF: 158, rShF: 158, headX: -26 }]];
  return [[t0, Object.assign({}, READY_S)], [t0 + 0.3, { rShF: 70, rShA: 30, rEl: 120, rWrF: 0, lShF: 20, lEl: 50, spineX: 14, chestX: 6, lKnee: 34, rKnee: 34, lHipF: 24, rHipF: 24, headX: 6 }], [t0 + 0.55, { rShF: 40, rEl: 135, spineX: 18 }], [t0 + 1.0, { rShF: 150, rShA: 25, rEl: 15, lShF: 30, spineX: -2, chestX: -4, lKnee: 12, rKnee: 12, lHipF: 6, rHipF: 6, headX: -16 }]];
}

/* generic soccer move: body keys + gait runs, ball contacts computed from the posed foot, a shot into the net */
function socc(a, cfg) {
  const body = ftrack(cfg.keys), runs = cfg.runs || [];
  const poseAt = (t, off) => {
    const q = body(t);
    for (const r of runs) runBlend(q, t, r.from, r.to, r.period, r.k === undefined ? 0.9 : r.k, false, r.phase || 0, r.edge || 0.15);
    if (cfg.post) cfg.post(q, t);
    if (off) { q.x += off[0]; q.z += off[1]; }
    return q;
  };
  const path = new BallPath(RS), sh = cfg.shot, C = cfg.contacts;
  let off = [0, 0], tShot = C[C.length - 1].t, tGoal = tShot + sh.flight, ext = {}, dirG = V(0, 0, -1);
  return {
    venue: 'fldSoccer', dur: cfg.dur, hold: cfg.hold === undefined ? 0.6 : cfg.hold, payoff: cfg.payoff === undefined ? tGoal : cfg.payoff,
    mirror: cfg.mirror === undefined ? a.handedness === 'left' : cfg.mirror, view: cfg.view, orbit: cfg.orbit === undefined ? { base: 155, sweep: 65 } : cfg.orbit || undefined,
    start(env) {
      const at = (c, o) => { env.pose(poseAt(c.t, o)); return mw(env, c.part === 'head' ? headBall(env, RS) : footBall(env, c.side || 'r', c.part || 'laces', RS)); };
      if (cfg.align) { const p = at(C[0], [0, 0]); off = [cfg.align[0] - p.x, cfg.align[1] - p.z]; }
      const P = C.map(c => { const p = at(c, off); p.y = c.air ? Math.max(RS, p.y) : RS; return p; });
      if (cfg.align) P[0].set(cfg.align[0], RS, cfg.align[1]);
      if (cfg.incoming) { const I = cfg.incoming; path.add(I.t, V(I.p[0], I.p[1], I.p[2]), I.mode || 'arc', I); }
      else { const b0 = cfg.ballStart ? cfg.ballStart(P) : [P[0].x, P[0].z]; path.add(0, V(b0[0], RS, b0[1]), cfg.align ? 'hold' : 'roll', cfg.ballRoll || {}); }
      C.forEach((c, i) => { if (i < C.length - 1) path.add(c.t, P[i], c.mode || 'roll', c); });
      const T = V(sh.target[0], sh.target[1], sh.target[2]), Pl = P[P.length - 1];
      const pre = shotPos(Pl, T, 0.97, sh, V()); dirG = T.clone().sub(pre); dirG.y = 0; dirG.normalize();
      path.add(tShot, Pl, 'shot', sh); path.add(tGoal, T, 'net', { dir: dirG, depth: sh.depth || 1.55, vy: sh.vy || 0 });
      path.add(tGoal + 4, T.clone().addScaledVector(dirG, sh.depth || 1.55).setY(RS), 'hold');
      path.build(0, cfg.dur + 0.1);
      if (cfg.view === undefined) { const h = headingTo(Pl.x, Pl.z, T.x, T.z); this.view = env.mirror ? -h : h; }
      ext = cfg.extras ? cfg.extras(env) || {} : {};
      this._ext = ext;
    },
    frame(t, env) {
      const q = poseAt(t, off); env.pose(q);
      if (cfg.arms) cfg.arms(t, env, q);
      const B = env.props.ball, pA = path.pos(t), bw = mw(env, pA.clone()); B.position.copy(bw);
      const d = path.pos(Math.min(cfg.dur, t + 0.02)).sub(path.pos(Math.max(0, t - 0.02))); mw(env, d);
      if (t > tShot && sh.curve && t < tGoal) spinBall(B, V(0, env.mirror ? -1 : 1, 0), (t - tShot) * 22 * Math.sign(sh.curve));
      else spinBall(B, V(d.z, 0, -d.x), path.dist(t) / RS * (sh.wobble && t > tShot && t < tGoal ? 0.05 : 1));
      if (t > tGoal - 0.1 && env.venue && env.venue.goal) env.venue.goal.push(bw, mw(env, dirG.clone()), RS);
      if (cfg.extraFrame) cfg.extraFrame(t, env, ext);
      return camOn(env, t, bw, tShot, sh.flight, tGoal, cfg);
    }
  };
}
/* camera: on the athlete, drifting toward the ball while it flies to the target (radius grows so both stay in frame) */
function camOn(env, t, bw, tShot, flight, tGoal, cfg = {}) {
  const r = env.rig.root.position, hips = env.bonePos('hips'), s = Math.max(1, env.s);
  const f0 = V(r.x, Math.max(0.95, hips.y + 0.15), r.z), fb = V(bw.x, clamp(bw.y * 0.7, 1, 2.2), bw.z);
  const k = (cfg.camK === undefined ? 0.5 : cfg.camK) * win(t, tShot, tShot + flight * 0.7, tGoal + 0.5, tGoal + 1.3);
  const D = f0.distanceTo(fb), out = { focus: f0.clone().lerp(fb, k), radius: ((cfg.radius || 5.4) + k * D * 1.5) * s, fixedY: true };
  if (cfg.camY) out.focus.y += cfg.camY;
  if (cfg.camEarly) { const ke = cfg.camEarly[0] * win(t, -1, 0, cfg.camEarly[1], cfg.camEarly[2]); out.focus.lerp(fb, ke); out.radius += ke * D * 1.0 * s; }
  return out;
}
const unit = (x, z) => { const L = Math.hypot(x, z) || 1; return [x / L, z / L]; };
/* root keys (x, z, ry) along a polyline at constant speed between t0 and t1 */
function along(pts, t0, t1, steps = 10, ryOff = 0) {
  const seg = [], n = pts.length; let L = 0;
  for (let i = 1; i < n; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
  const at = u => { let d = u * L; for (let i = 0; i < seg.length; i++) { if (d <= seg[i] + 1e-9 || i === seg.length - 1) { const k = clamp(d / seg[i], 0, 1); return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k), headingTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])]; } d -= seg[i]; } };
  const keys = []; let prev = null;
  for (let i = 0; i <= steps; i++) { const p = at(i / steps); let ry = p[2] + ryOff; if (prev !== null) while (ry - prev > 180) ry -= 360; while (prev !== null && ry - prev < -180) ry += 360; prev = ry; keys.push([lerp(t0, t1, i / steps), { x: p[0], z: p[1], ry }]); }
  return keys;
}

/* curled finesse shot after a diagonal dribble from the wing (inside of the foot into the far top corner) */
function curlShot(a, o = {}) {
  const S = o.S || [-5.2, 17.6], f = unit(0.727, -0.687), L = o.runLen || 7, S0 = [S[0] - f[0] * L, S[1] - f[1] * L], hd = headingTo(S0[0], S0[1], S[0], S[1]);
  const tc = 1.63, ry = 150, T = o.target || [2.9, 2.05, 0];
  const keys = [[0, Object.assign({ x: S0[0], z: S0[1], ry: hd }, READY_S, { spineX: 12, headX: 8 })]]
    .concat(kickRoot(tc, S, ry, f, 160), kickKeys(tc, 'curl'), cheer(tc + 0.85, o.cheer || 'pump'));
  return socc(a, {
    dur: 4.4, keys, runs: [{ from: 0.1, to: tc - 0.22, period: 0.6, k: 0.85, phase: 0.25 }],
    contacts: [{ t: 0.4, part: 'laces' }, { t: 1.0, part: 'outside' }, { t: tc, part: 'inside' }],
    ballStart: P => [P[0].x - f[0] * 1.0, P[0].z - f[1] * 1.0],
    shot: { target: T, flight: 1.0, apex: 1.0, curve: 2.4, late: true, depth: 1.75 }
  });
}
/* knuckleball free kick with the wide-legged set-up stance, over a four-man wall */
function knuckle(a) {
  const B0 = [-3.0, 24.5], T = [2.55, 2.0, 0], S0 = [B0[0] - 0.9, B0[1] + 3.7], hd = headingTo(S0[0], S0[1], B0[0], B0[1]);
  const tc = 2.55, f = unit(B0[0] - S0[0], B0[1] - S0[1]), ry = headingTo(B0[0], B0[1], T[0], T[2]);
  const STANCE = { lHipA: 21, rHipA: 21, lHipF: 0, rHipF: 0, lKnee: 5, rKnee: 5, lAnk: 0, rAnk: 0, spineX: -2, chestX: -4, lShF: 3, rShF: 3, lShA: 13, rShA: 13, lEl: 10, rEl: 10, headX: -2 };
  const keys = [[0, Object.assign({ x: S0[0], z: S0[1], ry: hd }, STANCE)], [0.55, { chestX: -9, spineX: -4, lShA: 17, rShA: 17 }], [1.05, { chestX: -3, spineX: -1, lShA: 13, rShA: 13 }],
    [1.3, Object.assign({ x: S0[0], z: S0[1] }, STANCE)], [1.5, { lHipA: 6, rHipA: 6, spineX: 10, chestX: 2 }]]
    .concat(kickRoot(tc, [B0[0] - 0.3, B0[1] + 0.45], ry, f, ry), kickKeys(tc, 'knuckle', { land: { rHipF: 30, rKnee: 30 } }), cheer(tc + 1.0, 'arms'));
  const wallC = [B0[0] + (0 - B0[0]) * 9.15 / Math.hypot(B0[0], B0[1]), B0[1] - B0[1] * 9.15 / Math.hypot(B0[0], B0[1])];
  return socc(a, {
    dur: 5.0, keys, runs: [{ from: 1.4, to: tc - 0.2, period: 0.55, k: 0.75, phase: 0.0 }], align: B0,
    contacts: [{ t: tc, part: 'laces' }],
    shot: { target: T, flight: 0.95, apex: 1.25, wobble: 0.18, dip: 0.55, depth: 1.75 },
    extras(env) { for (let i = 0; i < 4; i++) mannequin(env, wallC[0] + (i - 1.5) * 0.46 * 0.99, wallC[1] + (i - 1.5) * 0.46 * 0.12, headingTo(wallC[0], wallC[1], B0[0], B0[1])); }
  });
}

/* bicycle kick: back to goal, scissor the legs and strike the cross overhead, land on the back */
function bicycle(a) {
  const P0 = [0.4, 10.2], tc = 1.45, T = [-1.1, 1.35, 0];
  const keys = [
    [0, Object.assign({ x: P0[0], z: P0[1], ry: 0 }, READY_S, { headY: 45, headX: -18, neckY: 10 })],
    [0.7, { x: P0[0] - 0.05, z: P0[1] - 0.15, headY: 25, headX: -28, neckY: 5 }],
    [1.0, { x: P0[0], z: P0[1] - 0.2, lHipF: 42, rHipF: 40, lKnee: 62, rKnee: 64, lAnk: 14, rAnk: 14, spineX: 14, lShF: -20, rShF: -20, lShA: 20, rShA: 20, lEl: 20, rEl: 20, headY: 8, neckY: 0, headX: -30 }],
    [1.17, { lHipF: 100, lKnee: 50, rHipF: 4, rKnee: 8, rAnk: 40, hipsX: -40, spineX: 0, air: 0.3, lShF: 60, rShF: 60, lShA: 60, rShA: 60, headY: 0, headX: -10 }],
    [tc, { z: P0[1] - 0.35, hipsX: -102, seat: 1, seatY: 1.02, rHipF: 100, rKnee: 8, rAnk: 40, lHipF: -5, lKnee: 60, spineX: 14, chestX: 6, headX: 32, lShF: 30, rShF: 30, lShA: 85, rShA: 85, lEl: 10, rEl: 10, air: 0 }],
    [tc + 0.22, { z: P0[1] - 0.55, hipsX: -100, seatY: 0.62, rHipF: 70, rKnee: 25, lHipF: 30, lKnee: 50, lShF: -20, rShF: -20, lShA: 70, rShA: 70, headX: 30 }],
    [tc + 0.45, { z: P0[1] - 0.65, hipsX: -88, seatY: 0.16, rHipF: 40, rKnee: 70, lHipF: 30, lKnee: 80, spineX: 4, chestX: 0, lShF: 0, rShF: 0, lShA: 55, rShA: 55, headX: 25 }],
    [tc + 1.1, { headX: 32 }],
    [tc + 1.6, { hipsX: -35, seatY: 0.13, spineX: 22, chestX: 6, lHipF: 70, rHipF: 70, lKnee: 80, rKnee: 70, lShF: 150, rShF: 150, lShA: 20, rShA: 20, lEl: 10, rEl: 10, headX: -12 }],
    [tc + 2.3, { lShF: 160, rShF: 160, headX: -18 }]
  ];
  return socc(a, { dur: 3.9, keys, incoming: { t: 0.1, p: [13, 0.15, 17], h: 4.2 }, contacts: [{ t: tc, part: 'laces', air: true }],
    shot: { target: T, flight: 0.5, apex: 0.15, depth: 1.7 }, orbit: { base: 100, sweep: 70 }, radius: 5.8 });
}
/* first-time volley of a high, dropping cross at the edge of the box (side-on swing) */
function volley(a, o = {}) {
  const P = [1.4, 17.4], tc = 1.6, T = [-2.75, 2.1, 0];
  const keys = [
    [0, Object.assign({ x: P[0] + 0.45, z: P[1] + 0.7, ry: 200 }, READY_S, { headY: -55, headX: -25 })],
    [0.6, { x: P[0] + 0.2, z: P[1] + 0.35, ry: 196, headY: -45, headX: -32 }],
    [1.05, { x: P[0], z: P[1], ry: 192, headY: -25, headX: -20, lHipF: 30, lKnee: 30, rHipF: 0, rKnee: 30 }],
    [1.32, { lHipF: 16, lKnee: 24, lAnk: -2, lHipA: 10, rHipF: -24, rKnee: 70, rHipA: 34, rAnk: 30, hipsY: -30, hipsZ: -12, spineZ: -10, chestY: 16, spineX: 2, lShA: 62, lShF: 10, rShA: 66, rShF: -10, rEl: 30, lEl: 25, headY: -22, headX: 16 }],
    [tc, { lHipF: 6, lKnee: 12, lAnk: -16, lHipA: 24, rHipF: 34, rHipA: 56, rKnee: 14, rAnk: 40, rHipR: -6, hipsY: 14, hipsZ: -26, spineZ: -10, spineX: 4, chestY: -10, lShA: 55, lShF: 10, rShA: 82, rShF: -6, rEl: 15, lEl: 20, headY: -26, headZ: 14, headX: 18, air: 0.02 }],
    [tc + 0.18, { ry: 204, rHipF: 46, rHipA: 18, rKnee: 26, hipsY: 34, hipsZ: -12, spineZ: -6, chestY: -16, lHipA: 12, lAnk: -10, headY: -5, headZ: 4, air: 0.02 }],
    [tc + 0.5, Object.assign({ x: P[0] - 0.4, z: P[1] - 0.5, ry: 215, air: 0, hipsY: 0, hipsZ: 0, spineZ: 0, chestY: 0, chestZ: 0, rHipA: 6, rHipR: 0, lHipA: 6, headZ: 0 }, READY_S, { lHipF: 30, lKnee: 34, rHipF: -10, rKnee: 30, headY: 0 })]
  ].concat(cheer(tc + 1.0, 'arms'));
  return socc(a, { dur: 4.2, keys, mirror: o.leftFoot ? true : undefined, incoming: { t: 0.0, p: [17, 0.4, 26], h: 7.5 }, contacts: [{ t: tc, part: 'laces', air: true }],
    shot: { target: T, flight: 0.72, apex: 0.5, depth: 1.75 } });
}
/* leaping header from a cross: one-foot take-off, arch, snap the forehead through the ball */
function header(a) {
  const S0 = [-3.6, 16.2], J = [-1.4, 9.6], tj = 1.3, tc = 1.56, T = [-2.85, 1.05, 0], hT = headingTo(J[0], J[1], T[0], T[2]);
  const keys = [[0, Object.assign({ x: S0[0], z: S0[1], ry: headingTo(S0[0], S0[1], J[0], J[1]) }, READY_S, { headY: -35, headX: -15 })]]
    .concat(along([S0, J], 0.05, tj, 6).slice(1))
    .concat([
      [tj - 0.12, { lHipF: 40, lKnee: 58, rHipF: 12, rKnee: 48, lAnk: 10, spineX: 16, lShF: -25, rShF: -25, lEl: 30, rEl: 30, headY: -20, headX: -20 }],
      [tj, { lHipF: 10, lKnee: 16, lAnk: 30, rHipF: 85, rKnee: 95, air: 0.14, spineX: -6, chestX: -6, lShF: 75, rShF: 70, lShA: 30, rShA: 30, lEl: 40, rEl: 40, headY: -10, headX: -32 }],
      [tc - 0.12, { air: 0.5, spineX: -16, chestX: -8, headX: -18, neckX: -10, ry: hT - 25 }],
      [tc, { air: 0.55, spineX: 18, chestX: 10, neckX: 12, headX: 16, headY: 0, rHipF: 50, rKnee: 70, lHipF: 22, lKnee: 40, ry: hT, lShF: 45, rShF: 40 }],
      [tc + 0.32, Object.assign({ air: 0 }, { lHipF: 30, rHipF: 30, lKnee: 46, rKnee: 46, lAnk: 12, rAnk: 12, spineX: 12, chestX: 2, neckX: 0, headX: 0, lShF: 20, rShF: 20 })]
    ]).concat(cheer(tc + 0.9, 'pump'));
  return socc(a, { dur: 4.1, keys, runs: [{ from: 0.05, to: tj - 0.1, period: 0.55, k: 0.8 }], incoming: { t: 0.1, p: [21, 0.3, 10.5], h: 3.6 }, contacts: [{ t: tc, part: 'head', air: true }],
    shot: { target: T, flight: 0.55, apex: 0.05, depth: 1.6 } });
}
/* in-swinging corner kick that curls straight in at the near post */
function corner(a) {
  const B0 = [-33.55, 0.5], T = [-3.1, 2.0, 0], tc = 1.95, S0 = [-36.9, -1.8], hd = headingTo(S0[0], S0[1], B0[0], B0[1]), f = unit(B0[0] - S0[0], B0[1] - S0[1]);
  const keys = [[0, Object.assign({ x: S0[0], z: S0[1], ry: hd + 25 }, READY_S, { lHipF: 4, rHipF: 4, lKnee: 6, rKnee: 6, spineX: 2, rShF: 165, rShA: 12, rEl: 6, headX: -4 })],
    [0.85, { rShF: 168, ry: hd + 22 }], [1.1, Object.assign({ x: S0[0] + f[0] * 0.3, z: S0[1] + f[1] * 0.3, ry: hd }, READY_S)]]
    .concat(kickRoot(tc, [B0[0] - 0.35, B0[1] - 0.35], 72, f, 80), kickKeys(tc, 'cross'), cheer(tc + 1.6, 'arms'));
  return socc(a, { dur: 5.1, keys, runs: [{ from: 1.05, to: tc - 0.2, period: 0.55, k: 0.7 }], align: B0, contacts: [{ t: tc, part: 'inside' }],
    shot: { target: T, flight: 1.45, apex: 2.4, curve: 4.2, late: true, depth: 1.5 }, camK: 0.45 });
}
/* close-control slalom through defenders (mannequins) and a low finish */
function slalom(a) {
  const pts = [[5.6, 33.5], [3.5, 28.0], [5.5, 23.0], [3.0, 18.0], [3.7, 14.1]], tc = 2.62, S = [3.2, 12.2], T = [-2.6, 0.35, 0];
  const f = unit(S[0] - 3.7, S[1] - 14.1), ry = headingTo(S[0], S[1], T[0], T[2]);
  const keys = [[0, Object.assign({}, READY_S, { spineX: 14 })]].concat(along(pts.concat([[S[0] - f[0] * 0.95, S[1] - f[1] * 0.95]]), 0, tc - 0.3, 14), kickRoot(tc, S, ry, f, ry), kickKeys(tc, 'drive'), cheer(tc + 1.0, 'arms'));
  return socc(a, { dur: 4.7, keys, runs: [{ from: 0.02, to: tc - 0.22, period: 0.5, k: 0.85, phase: 0.25 }],
    contacts: [0.35, 0.85, 1.35, 1.85].map((t, i) => ({ t, part: i % 2 ? 'inside' : 'outside' })).concat([{ t: tc, part: 'laces' }]),
    ballStart: P => [P[0].x + 0.3, P[0].z + 0.9], shot: { target: T, flight: 0.55, apex: 0.15, depth: 1.6 },
    extras(env) { mannequin(env, 4.9, 27.0, 0); mannequin(env, 3.7, 22.4, 0); mannequin(env, 4.6, 17.0, 0); } });
}
/* knock-on sprint: long touches at top speed, then a low drive across goal */
function sprintShot(a, o = {}) {
  const S0 = o.S0 || [-8.5, 36], S = o.S || [-4.4, 18.6], T = o.target || [3.0, 0.5, 0], per = o.period || 0.48, tc = o.tc || 2.15;
  const f = unit(S[0] - S0[0], S[1] - S0[1]), ry = headingTo(S[0], S[1], T[0], T[2]);
  const keys = [[0, Object.assign({}, READY_S, { spineX: 16 })]].concat(along([S0, [S[0] - f[0] * 0.95, S[1] - f[1] * 0.95]], 0, tc - 0.3, 8), kickRoot(tc, S, ry, f, ry + 10), kickKeys(tc, 'drive'), cheer(tc + 1.0, o.cheer || 'pump'));
  return socc(a, { dur: tc + 2.3, keys, runs: [{ from: 0.02, to: tc - 0.22, period: per, k: 1.0, phase: 0.25 }],
    contacts: [{ t: 0.02 + 0.5 * per, part: 'toe' }, { t: 0.02 + 2.5 * per, part: 'toe' }, { t: tc, part: 'laces' }],
    ballStart: P => [P[0].x - f[0] * 0.6, P[0].z - f[1] * 0.6], shot: { target: T, flight: 0.6, apex: 0.2, depth: 1.6 },
    extras(env) { if (o.defender !== false) mannequin(env, S0[0] + f[0] * 7 + 0.9, S0[1] + f[1] * 7, 0); } });
}
/* pressing: chase down a loose pass, win it, drive a low shot */
function press(a) {
  const S0 = [-6.8, 29.5], I = [-7.2, 23.4], S = [-4.6, 18.1], T = [2.9, 0.45, 0], tc = 2.5, f = unit(S[0] - I[0], S[1] - I[1]), ry = headingTo(S[0], S[1], T[0], T[2]);
  const keys = [[0, Object.assign({ x: S0[0], z: S0[1], ry: headingTo(S0[0], S0[1], I[0], I[1]) - 20 }, READY_S, { headY: 40 })]]
    .concat(along([S0, I, [S[0] - f[0] * 0.95, S[1] - f[1] * 0.95]], 0.05, tc - 0.3, 10).slice(1), kickRoot(tc, S, ry, f, ry), kickKeys(tc, 'drive'), cheer(tc + 1.0, 'pump'));
  return socc(a, { dur: 4.7, keys, runs: [{ from: 0.05, to: tc - 0.22, period: 0.5, k: 0.95, phase: 0.25 }],
    contacts: [{ t: 1.3, part: 'inside' }, { t: 1.8, part: 'toe' }, { t: tc, part: 'laces' }],
    ballStart: () => [-15.5, 21.6], ballRoll: { lin: true }, shot: { target: T, flight: 0.62, apex: 0.25, depth: 1.6 }, camEarly: [0.45, 0.9, 1.4],
    extras(env) { mannequin(env, -16.3, 21.2, 80); } });
}
/* elastico: outside of the foot pushes out, inside snaps it back, burst past the defender, finish */
function elastico(a) {
  const S0 = [3.7, 26.5], E = [3.15, 19.6], tE = 1.3, tc = 2.5, S = [1.0, 13.6], T = [-2.6, 0.6, 0], ry = headingTo(S[0], S[1], T[0], T[2]);
  const f = unit(S[0] - 1.55, S[1] - 15.8);
  const keys = [[0, Object.assign({}, READY_S, { spineX: 12 })]].concat(along([S0, [E[0], E[1] + 0.45]], 0, tE - 0.25, 6), [
    [tE - 0.25, { lHipF: 22, lKnee: 26, rHipF: 20, rKnee: 34, rHipA: 2, rHipR: -20, spineX: 8, spineZ: 0, lShA: 40, rShA: 40, lShF: 15, rShF: 15, lEl: 40, rEl: 40, headX: 18 }],
    [tE, { x: E[0], z: E[1] + 0.3, rHipF: 22, rKnee: 24, rHipA: 2, rHipR: -26, rAnk: 10, spineZ: 10, hipsZ: 4 }],
    [tE + 0.1, { z: E[1] + 0.2, rHipF: 26, rKnee: 30, rHipA: 38, rHipR: 0, spineZ: 12 }],
    [tE + 0.2, { x: E[0] + 0.05, z: E[1] + 0.05, rHipF: 24, rKnee: 28, rHipA: 34, rHipR: 34, spineZ: -10, hipsZ: -4 }],
    [tE + 0.33, { x: E[0] - 0.25, z: E[1] - 0.15, rHipF: 30, rKnee: 30, rHipA: -14, rHipR: 30, spineZ: -18, hipsZ: -6, lKnee: 34, ry: 205 }],
  ]).concat(along([[E[0] - 0.25, E[1] - 0.15], [1.55, 15.8], [S[0] - f[0] * 0.95, S[1] - f[1] * 0.95]], tE + 0.33, tc - 0.3, 6).slice(1), kickRoot(tc, S, ry, f, ry), kickKeys(tc, 'drive', { hit: { spineZ: 4 } }), cheer(tc + 1.0, 'arms'));
  return socc(a, { dur: 4.6, keys, runs: [{ from: 0.02, to: tE - 0.25, period: 0.55, k: 0.7, phase: 0.25 }, { from: tE + 0.3, to: tc - 0.22, period: 0.5, k: 0.95, phase: 0.5 }],
    post(q, t) { const w = win(t, tE - 0.3, tE - 0.2, tE + 0.3, tE + 0.4); if (w > 0) { q.rAnk = lerp(q.rAnk, 8, w); q.lAnk = lerp(q.lAnk, q.lHipF - q.lKnee, w); } },
    contacts: [{ t: 0.3, part: 'toe' }, { t: tE, part: 'outside' }, { t: tE + 0.2, part: 'inside' }, { t: 2.0, part: 'toe' }, { t: tc, part: 'laces' }],
    ballStart: P => [P[0].x + 0.1, P[0].z + 0.9], shot: { target: T, flight: 0.5, apex: 0.2, depth: 1.6 },
    extras(env) { mannequin(env, 2.85, 17.4, 180); } });
}
/* step-overs at a defender, push out with the outside of the foot, curled finish */
function stepover(a, o = {}) {
  const n = o.count || 2, S0 = [-3.3, 27], E = [-3.05, 20.0], t1 = 1.1, dt = 0.36, tPush = t1 + n * dt + 0.08, tc = tPush + 0.95, S = [-0.4, 15.4], T = [-2.9, 2.0, 0], ry = headingTo(S[0], S[1], T[0], T[2]);
  const keys = [[0, Object.assign({}, READY_S, { spineX: 12 })]].concat(along([S0, [E[0], E[1] + 0.5]], 0, t1 - 0.15, 6));
  for (let i = 0; i < n; i++) {
    const t = t1 + i * dt, r = i % 2 === 0, L = r ? 'r' : 'l', O = r ? 'l' : 'r', sx = r ? -1 : 1, zz = E[1] + 0.45 - i * 0.12;
    keys.push([t - 0.12, { [L + 'HipF']: 34, [L + 'Knee']: 62, [L + 'HipA']: -20, [L + 'Ank']: 10, [L + 'HipR']: 20, [O + 'HipF']: 8, [O + 'Knee']: 28, [O + 'HipA']: 8, spineZ: -sx * 8, hipsZ: 0, x: E[0] - sx * 0.05, z: zz, ry: 180 - sx * 6 }]);
    keys.push([t, { [L + 'HipF']: 50, [L + 'Knee']: 82, [L + 'HipA']: 4, [L + 'HipR']: 0, spineZ: sx * 6, [O + 'Knee']: 32 }]);
    keys.push([t + 0.15, { [L + 'HipF']: 10, [L + 'Knee']: 24, [L + 'HipA']: 30, [L + 'HipR']: -10, [O + 'HipA']: 0, [O + 'Knee']: 30, spineZ: sx * 16, hipsZ: sx * 6, x: E[0] + sx * 0.24, z: zz - 0.06, ry: 180 + sx * 10, lShA: sx > 0 ? 60 : 30, rShA: sx > 0 ? 30 : 60, lShF: 20, rShF: 20, lEl: 30, rEl: 30, spineX: 10, headX: 18 }]);
  }
  keys.push([tPush, { x: E[0] + 0.25, z: E[1] - 0.15, rHipF: 22, rKnee: 26, rHipA: 4, rHipR: -24, lHipA: 6, lHipF: 10, lKnee: 24, spineZ: -8, hipsZ: 0, ry: 160 }]);
  keys.push(...along([[E[0] + 0.25, E[1] - 0.15], [-1.2, 17.2], [S[0] - 0.4, S[1] + 0.9]], tPush + 0.05, tc - 0.3, 5).slice(1));
  const f = unit(0.4 * 0 + 0.4, -0.9);
  keys.push(...kickRoot(tc, S, ry, f, ry), ...kickKeys(tc, 'curl'), ...cheer(tc + 1.0, 'pump'));
  return socc(a, { dur: tc + 2.3, keys, runs: [{ from: 0.02, to: t1 - 0.15, period: 0.55, k: 0.7, phase: 0.25 }, { from: tPush + 0.05, to: tc - 0.22, period: 0.5, k: 0.9, phase: 0.75 }],
    contacts: [{ t: 0.3, part: 'toe', lin: true }, { t: tPush, part: 'outside' }, { t: tPush + 0.5, part: 'toe' }, { t: tc, part: 'inside' }],
    ballStart: P => [P[0].x + 0.05, P[0].z + 0.9], shot: { target: T, flight: 0.85, apex: 0.7, curve: 1.6, late: true, depth: 1.75 },
    extras(env) { mannequin(env, -2.9, 17.9, 180); } });
}
/* Cruyff turn: fake the cross, drag the ball behind the standing leg, turn away, curl it in */
function cruyffTurn(a) {
  const S0 = [3.0, 15.6], C = [9.15, 13.45], tF = 1.32, tc = 3.0, S = [5.4, 11.7], T = [-2.9, 2.05, 0], ry = headingTo(S[0], S[1], T[0], T[2]);
  const h0 = headingTo(S0[0], S0[1], C[0], C[1]), f = unit(S[0] - 7.0, S[1] - 12.55);
  const keys = [[0, Object.assign({}, READY_S, { spineX: 12 })]].concat(along([S0, [C[0] - 0.35, C[1] + 0.12]], 0, tF - 0.12, 6), [
    [tF, { x: C[0] - 0.15, z: C[1] + 0.05, ry: h0, lHipF: 22, lKnee: 24, lAnk: -2, rHipF: -32, rKnee: 92, rAnk: 30, hipsY: -18, spineX: 6, chestY: 10, lShA: 60, lShF: 20, rShA: 40, rShF: -20, headX: 20, headY: 20 }],
    [tF + 0.15, { rHipF: 30, rKnee: 30, rHipR: 30, rAnk: 10, hipsY: 0, chestY: -4, rShF: 30, headY: 10 }],
    [tF + 0.27, { rHipF: 18, rKnee: 40, rHipR: 50, rHipA: -6, spineX: 10, headY: 30, headX: 28 }],
    [tF + 0.42, { rHipF: -12, rKnee: 50, rHipA: -22, rHipR: 40, ry: h0 + 40, hipsY: 20, chestY: 15, headY: 40 }],
    [tF + 0.7, { x: C[0] - 0.3, z: C[1] - 0.05, ry: h0 + 150, rHipF: 20, rKnee: 30, rHipA: 4, rHipR: 0, lHipF: -5, lKnee: 30, hipsY: 0, chestY: 0, spineX: 14, headY: 0, headX: 10 }]
  ]).concat(along([[C[0] - 0.3, C[1] - 0.05], [7.0, 12.55], [S[0] - f[0] * 0.95, S[1] - f[1] * 0.95]], tF + 0.75, tc - 0.3, 6).slice(1), kickRoot(tc, S, ry, f, ry), kickKeys(tc, 'curl'), cheer(tc + 1.0, 'arms'));
  for (const k of keys) if (k[0] > tF + 0.71 && k[1].ry !== undefined && k[1].ry < h0) k[1].ry += 360;
  return socc(a, { dur: tc + 2.4, keys, runs: [{ from: 0.02, to: tF - 0.12, period: 0.55, k: 0.8, phase: 0.25 }, { from: tF + 0.75, to: tc - 0.22, period: 0.5, k: 0.9, phase: 0.5 }],
    contacts: [{ t: 0.3, part: 'toe' }, { t: 0.85, part: 'toe' }, { t: tF + 0.27, part: 'inside' }, { t: tF + 1.15, part: 'toe' }, { t: tc, part: 'inside' }],
    ballStart: P => [P[0].x - 0.8, P[0].z + 0.2], shot: { target: T, flight: 0.95, apex: 0.9, curve: 1.9, late: true, depth: 1.75 } });
}

/* ================================================================== generic scripted play (rugby, american & flag football) */
const Hof = a => clamp((a.heightCm || (a.gender === 'f' ? 175 : 185)) / 100, 1.55, 2.32);
function chestPt(env, x, y, z) { const s = env.s; return env.rig.bones.chest.localToWorld(V((env.mirror ? -x : x) * s, y * s, z * s)); }
function chestDir(env, x, y, z) { const q = env.rig.bones.chest.getWorldQuaternion(new THREE.Quaternion()); return V(env.mirror ? -x : x, y, z).applyQuaternion(q).normalize(); }
const handsMid = env => env.handPos('l').add(env.handPos('r')).multiplyScalar(0.5);
/* hold an oval ball: 'two' = in front with both hands, 'tuck' = under the authored left arm, 'tuckR' = under the right arm */
function holdOval(env, B, mode, w = 1, spin = 0) {
  if (mode === 'two') {
    const c = chestPt(env, 0, 0.04, 0.3); B.position.copy(c); aimBall(B, chestDir(env, 1, 0.2, 0), spin);
    env.reach('l', c.clone().add(chestDir(env, 1, 0, -0.25).multiplyScalar(0.115 * env.s)), [0.7, 0.8, -0.3], { weight: w });
    env.reach('r', c.clone().add(chestDir(env, -1, 0, -0.25).multiplyScalar(0.115 * env.s)), [-0.7, 0.8, -0.3], { weight: w });
  } else {
    const sx = mode === 'tuckR' ? -1 : 1, side = sx > 0 ? 'l' : 'r', c = chestPt(env, 0.15 * sx, -0.01, 0.15);
    B.position.copy(c); aimBall(B, chestDir(env, 0.12 * sx, 0.5, 1), spin);
    env.reach(side, c.clone().add(chestDir(env, 0.05 * sx, 0.35, 1).multiplyScalar(0.11 * env.s)), [0.75 * sx, 0.95, -0.25], { weight: w });
  }
  return B.position;
}
/* a scripted play: body keys + gait runs + extra players + an update() that drives ball, hands and camera */
function play(a, cfg) {
  const body = ftrack(cfg.keys), runs = cfg.runs || [];
  const poseAt = t => { const q = body(t); for (const r of runs) runBlend(q, t, r.from, r.to, r.period, r.k === undefined ? 0.9 : r.k, !!r.hold, r.phase || 0, r.edge || 0.15); if (cfg.post) cfg.post(q, t); return q; };
  const xs = (cfg.extras || []).map(e => ({ e, body: ftrack(e.keys) }));
  const S = { poseAt };
  return {
    venue: cfg.venue, dur: cfg.dur, hold: cfg.hold === undefined ? 0.6 : cfg.hold, payoff: cfg.payoff, mirror: cfg.mirror === undefined ? a.handedness === 'left' : cfg.mirror,
    view: cfg.view, orbit: cfg.orbit, allowBelowGround: cfg.allowBelowGround,
    start(env) {
      S.x = xs.map(x => extra(env, x.e)); S.path = new BallPath(cfg.R || 0.1);
      S.xpose = (t, i) => { const x = xs[i], q = x.body(t); for (const r of x.e.runs || []) runBlend(q, t, r.from, r.to, r.period, r.k === undefined ? 0.9 : r.k, !!r.hold, r.phase || 0, r.edge || 0.15); return q; };
      if (cfg.setup) cfg.setup(env, S);
      if (cfg.viewFn) this.view = cfg.viewFn(env, S);
    },
    frame(t, env) {
      env.pose(poseAt(t));
      xs.forEach((x, i) => { poseX(env, S.x[i], S.xpose(t, i)); if (x.e.mood) S.x[i].setExpression(x.e.mood(t)); });
      return cfg.update(t, env, S) || {};
    }
  };
}
/* default follow camera: athlete, optionally drifting toward the ball */
function follow(env, bw, k = 0, base = 5.6, lift = 0, grow = 1.5) {
  const r = env.rig.root.position, hips = env.bonePos('hips'), s = Math.max(1, env.s);
  const f0 = V(r.x, Math.max(0.95, hips.y + 0.15) + lift, r.z);
  if (!bw || k <= 0) return { focus: f0, radius: base * s, fixedY: true };
  const fb = V(bw.x, clamp(bw.y * 0.7, 1, 2.2), bw.z), D = f0.distanceTo(fb);
  return { focus: f0.lerp(fb, k), radius: (base + k * D * grow) * s, fixedY: true };
}
/* dive over the line and ground the ball: root from `from` to `to` (A-space), take-off at t0 */
function diveKeys(t0, from, to, H) {
  const ry = headingTo(from[0], from[1], to[0], to[1]), L = (u) => ({ x: lerp(from[0], to[0], u), z: lerp(from[1], to[1], u) });
  const prone = 0.075 * H + 0.03;
  return [
    [t0 - 0.16, Object.assign(L(-0.25), { ry, spineX: 24, lHipF: 44, lKnee: 52, rHipF: -14, rKnee: 46, lAnk: 10 })],
    [t0, Object.assign(L(0), { lHipF: 26, lKnee: 24, rHipF: -28, rKnee: 30, lAnk: 30, spineX: 42, chestX: 6, air: 0.18, lShF: 120, rShF: 120, lShA: 12, rShA: 12, lEl: 20, rEl: 20, headX: -20 })],
    [t0 + 0.22, Object.assign(L(0.55), { hipsX: 58, seat: 1, seatY: 0.62, spineX: 8, chestX: 0, lHipF: -10, rHipF: -16, lKnee: 18, rKnee: 30, lAnk: 30, rAnk: 30, lShF: 168, rShF: 168, lShA: 8, rShA: 8, lEl: 8, rEl: 8, headX: -45, air: 0 })],
    [t0 + 0.42, Object.assign(L(0.9), { hipsX: 86, seatY: prone + 0.04, spineX: 2, lHipF: -4, rHipF: -4, lKnee: 10, rKnee: 16, headX: -52 })],
    [t0 + 0.62, Object.assign(L(1), { hipsX: 88, seatY: prone })]
  ];
}
function kneelUp(t0, H) {
  const ky = 0.25 * H + 0.05, prone = 0.075 * H + 0.03;
  return [[t0, { hipsX: 88, seatY: prone, seat: 1 }], [t0 + 0.4, { hipsX: 45, seatY: 0.35 * H * 0.5 + 0.1, spineX: 26, lHipF: 70, rHipF: 70, lKnee: 110, rKnee: 110, lAnk: 20, rAnk: 20, lShF: 40, rShF: 40, lShA: 20, rShA: 20, lEl: 40, rEl: 40, headX: -10 }],
    [t0 + 0.85, { hipsX: 0, seatY: ky, spineX: -6, chestX: -4, lHipF: 2, rHipF: 2, lKnee: 92, rKnee: 92, lAnk: 30, rAnk: 30, lShF: 150, rShF: 150, lShA: 28, rShA: 28, lEl: 12, rEl: 12, headX: -24 }],
    [t0 + 1.5, { lShF: 158, rShF: 158, headX: -28 }]];
}
const READY_R = { lHipF: 18, rHipF: 18, lKnee: 24, rKnee: 24, lAnk: 6, rAnk: 6, spineX: 14, chestX: 4, lHipA: 7, rHipA: 7, lShF: 20, rShF: 20, lShA: 14, rShA: 14, lEl: 40, rEl: 40, headX: -6 };
const OPP = (h = 185, extraO = {}) => Object.assign({ h, skin: '#c8956b', hair: '#2a1d14' }, extraO);

/* ================================================================== rugby */
const RBR = 0.096;
/* place kick off a tee (Carter); with the pre-kick hand pose (Goromaru) */
function placeKick(a, o = {}) {
  const B0 = o.B0 || [-11, 22.5], T = [0.6, 6.4, 0], Lnd = [1.2, -8.5], d = unit(T[0] - B0[0], T[2] - B0[1]), ryP = headingTo(B0[0], B0[1], T[0], T[2]);
  const left = [Math.cos(ryP * D2R), -Math.sin(ryP * D2R)], S0 = [B0[0] - d[0] * 3.6 + left[0] * 2.3, B0[1] - d[1] * 3.6 + left[1] * 2.3];
  const pre = o.ritual ? 1.5 : 0, tStart = 1.0 + pre, tc = tStart + 1.05, f = unit(B0[0] - S0[0], B0[1] - S0[1]), H = Hof(a);
  const STAND = { lHipF: 4, rHipF: 4, lKnee: 8, rKnee: 8, lHipA: 9, rHipA: 9, spineX: 4, lShF: 8, rShF: 8, lShA: 10, rShA: 10, lEl: 20, rEl: 20, headX: -12 };
  const keys = [[0, Object.assign({ x: S0[0], z: S0[1], ry: ryP }, STAND)], [0.6, { headX: 18, ry: ryP - 10 }], [1.0, { headX: -14, ry: ryP }]];
  if (o.ritual) keys.push([1.4, { lHipF: 22, rHipF: 22, lKnee: 34, rKnee: 34, lAnk: 10, rAnk: 10, spineX: 26, chestX: 4, neckX: -10, headX: -12, lHipA: 12, rHipA: 12 }], [2.2, { spineX: 28, headX: -14 }], [2.5, Object.assign({}, STAND)]);
  keys.push([tStart, Object.assign({ x: S0[0], z: S0[1], ry: headingTo(S0[0], S0[1], B0[0], B0[1]) }, STAND, { spineX: 10 })]);
  keys.push(...kickRoot(tc, [B0[0] - f[0] * 0.12 - left[0] * 0.28, B0[1] - f[1] * 0.12 - left[1] * 0.28], ryP - 8, f, ryP),
    ...kickKeys(tc, 'curl', { follow: { rHipF: 100, rKnee: 6, rHipR: 20, lAnk: -28, spineX: -4, hipsY: 28, chestY: -16, lShA: 70, lShF: 40, rShF: 30, rShA: 40 }, hit: { rHipR: 26, rAnk: 30, spineX: 12 } }), ...cheer(tc + 1.55, 'pump'));
  const flight = 1.25, tGoal = tc + flight;
  let off = [0, 0], tee = null, fingers = [];
  const ballOnTee = () => V(B0[0], 0.055 + 0.145 * 0.96, B0[1]);
  return play(a, {
    venue: 'fldRugby', dur: tGoal + 1.9, keys, runs: [{ from: tStart + 0.05, to: tc - 0.22, period: 0.55, k: 0.75 }], payoff: tGoal, orbit: { base: 160, sweep: 60 }, R: RBR,
    post(q) { q.x += off[0]; q.z += off[1]; },
    setup(env, S) {
      env.pose(S.poseAt(tc)); const p = mw(env, footBall(env, 'r', 'inside', 0.05)); off = [B0[0] - p.x, B0[1] - p.z];
      tee = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.06, 14), std('#ff7a1a')); tee.position.copy(mw(env, V(B0[0], 0.03, B0[1]))); env.addProp(tee);
      S.path.add(0, ballOnTee(), 'hold').add(tc, ballOnTee(), 'shot', { apex: 1.6 }).add(tGoal, V(T[0], T[1], T[2]), 'arc', { h: 0.6 }).add(tGoal + 0.75, V(Lnd[0], RBR, Lnd[1]), 'bounce', { n: 3, h: 0.9 }).add(tGoal + 3, V(Lnd[0] + 0.4, RBR, Lnd[1] - 3), 'hold');
      S.path.build(0, tGoal + 3);
      if (o.ritual) for (const sd of ['l', 'r']) { const fg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085 * H, 0.045 * H, 4, 8), std((a.appearance && a.appearance.skin) || '#c8956b', { roughness: 0.55 })); fg.position.set(0, -0.085 * H, 0.008 * H); env.addProp(fg, env.rig.bones[env.side(sd) + 'Hand']); fingers.push(fg); }
      this.view = undefined;
    },
    update(t, env, S) {
      const B = env.props.ball, p = mw(env, S.path.pos(t)); B.position.copy(p);
      if (t < tc) aimBall(B, mw(env, V(d[0] * 0.28, 1, d[1] * 0.28)));
      else { const dirH = mw(env, V(d[0], 0, d[1])), th = -(t - tc) * 21; aimBall(B, dirH.clone().multiplyScalar(Math.cos(th)).add(V(0, Math.sin(th), 0))); }
      if (o.ritual) {
        const w = win(t, 1.25, 1.5, 2.25, 2.5), c = chestPt(env, 0, 0.27, 0.34);
        if (w > 0) { env.reach('l', c.clone().add(chestDir(env, 1, 0, 0).multiplyScalar(0.025)), [0.5, 0.9, 0.0], { weight: w, handDir: V(0, 1, 0) }); env.reach('r', c.clone().add(chestDir(env, -1, 0, 0).multiplyScalar(0.025)), [-0.5, 0.9, 0.0], { weight: w, handDir: V(0, 1, 0) }); }
        for (const fg of fingers) fg.visible = w > 0.6;
      }
      const k = 0.5 * win(t, tc, tc + 0.8, tGoal + 0.9, tGoal + 1.7);
      return follow(env, p, k, 5.4);
    }
  });
}
/* drop goal: take the pass, drop the ball and strike it on the half-volley */
function dropGoal(a) {
  const S = [-2.0, 30.5], T = [0.3, 6.2, 0], tCatch = 0.95, tDrop = 1.5, tc = 1.86, flight = 1.35, tGoal = tc + flight, ry = headingTo(S[0], S[1], T[0], T[2]), f = unit(T[0] - S[0], T[2] - S[1]);
  const keys = [[0, Object.assign({ x: S[0] + 0.3, z: S[1] + 1.4, ry: ry - 25 }, READY_R, { lShF: 70, rShF: 70, lShA: 10, rShA: 10, lEl: 30, rEl: 30, headY: 55 })],
    [tCatch, { x: S[0] + 0.15, z: S[1] + 0.9, ry: ry - 15, headY: 30, spineX: 10 }],
    [tCatch + 0.3, { ry: ry - 4, headY: 0, headX: -10 }],
    [tDrop, { x: S[0] - f[0] * 0.35, z: S[1] - f[1] * 0.35, lHipF: 34, lKnee: 26, rHipF: -16, rKnee: 50, spineX: 14, headX: 20 }]
  ].concat(kickRoot(tc, S, ry, f, ry), kickKeys(tc, 'drive', { follow: { rHipF: 96, rKnee: 8, lAnk: -28, spineX: -6, lShA: 75, lShF: 30 }, plant: { headX: 30 } }), cheer(tc + 1.5, 'sky'));
  let pDrop = null, pHit = null;
  return play(a, {
    venue: 'fldRugby', dur: tGoal + 1.8, keys, payoff: tGoal, orbit: { base: 160, sweep: 60 }, R: RBR,
    setup(env, S2) {
      env.pose(S2.poseAt(tDrop)); pDrop = mw(env, chestPt(env, 0, -0.18, 0.36)); env.pose(S2.poseAt(tc)); pHit = mw(env, footBall(env, 'r', 'laces', 0.0)); pHit.y = 0.16;
      const P = S2.path; P.add(0.25, V(-9.5, 0.95, 31.5), 'shot', { apex: 0.5 }).add(tCatch, V(0, 0, 0), 'hold');
      P.add(tGoal, V(T[0], T[1], T[2]), 'arc', { h: 0.6 }).add(tGoal + 0.75, V(0.9, RBR, -8.5), 'bounce', { n: 3, h: 0.9 });
      S2.catchT = tCatch;
    },
    update(t, env, S2) {
      const B = env.props.ball;
      if (t < tCatch) {   // pass arriving into the hands (spiral)
        env.pose(S2.poseAt(t)); const hT = mw(env, chestPt(env, 0, 0.12, 0.42)), a0 = mw(env, V(-9.5, 0.95, 31.5)), u = (t - 0.25) / (tCatch - 0.25);
        B.position.copy(u < 0 ? a0 : arc(a0, hT, 0.5, u, V())); aimBall(B, hT.clone().sub(a0), t * 30);
        const reachW = smooth(span(t, 0.2, 0.6)); env.reach('l', hT.clone().add(chestDir(env, 1, 0, 0).multiplyScalar(0.12)), [0.7, 0.9, -0.2], { weight: reachW }); env.reach('r', hT.clone().add(chestDir(env, -1, 0, 0).multiplyScalar(0.12)), [-0.7, 0.9, -0.2], { weight: reachW });
      } else if (t < tDrop) {   // ball held upright in front, ready to drop
        const c = chestPt(env, 0, lerp(0.12, -0.18, smooth(span(t, tCatch, tDrop))), lerp(0.42, 0.36, smooth(span(t, tCatch, tDrop))));
        B.position.copy(c); aimBall(B, V(0, 1, 0).lerp(chestDir(env, 1, 0.2, 0), 1 - smooth(span(t, tCatch, tCatch + 0.3))));
        env.reach('l', c.clone().add(chestDir(env, 1, 0, -0.2).multiplyScalar(0.11 * env.s)), [0.7, 0.8, -0.3]); env.reach('r', c.clone().add(chestDir(env, -1, 0, -0.2).multiplyScalar(0.11 * env.s)), [-0.7, 0.8, -0.3]);
      } else if (t < tc) {   // falling point-first to the turf
        const u = (t - tDrop) / (tc - tDrop), p = mw(env, V(lerp(pDrop.x, pHit.x, u), lerp(pDrop.y, pHit.y, u * u), lerp(pDrop.z, pHit.z, u)));
        B.position.copy(p); aimBall(B, V(0, 1, 0).add(mw(env, V(f[0], 0, f[1])).multiplyScalar(0.25 * u)));
        const w = 1 - smooth(span(t, tDrop, tDrop + 0.15)); if (w > 0) { env.reach('l', chestPt(env, 0.14, -0.15, 0.4), [0.7, 0.8, -0.3], { weight: w }); env.reach('r', chestPt(env, -0.14, -0.15, 0.4), [-0.7, 0.8, -0.3], { weight: w }); }
      } else {
        const u = (t - tc) / flight, Tw = V(T[0], T[1], T[2]);
        if (u <= 1) B.position.copy(mw(env, shotPos(V(pHit.x, pHit.y, pHit.z), Tw, u, { apex: 3.2 }, V())));
        else B.position.copy(mw(env, S2.path.pos(t)));
        const th = -(t - tc) * 20, dirH = mw(env, V(f[0], 0, f[1])); aimBall(B, dirH.multiplyScalar(Math.cos(th)).add(V(0, Math.sin(th), 0)));
      }
      const k = 0.5 * win(t, tc, tc + 0.8, tGoal + 0.9, tGoal + 1.6);
      return follow(env, B.position, Math.max(k, 0.35 * win(t, 0, 0.1, 0.6, tCatch)), 5.4);
    }
  });
}

/* run, beat the defence (hand-off / side-step / dummy pass) and dive over for a try */
function tryRun(a, o) {
  const H = Hof(a), style = o.style, tDive = o.tDive, land = o.land, from = o.from, path = o.path;
  const keys = [[0, Object.assign({}, READY_R, { spineX: 18 })]].concat(along(path.concat([from]), 0, tDive - 0.16, 12), diveKeys(tDive, from, land, H), kneelUp(tDive + 1.25, H));
  if (o.extraKeys) keys.push(...o.extraKeys);
  const tGround = tDive + 0.45, ry = headingTo(from[0], from[1], land[0], land[1]);
  let pGround = null;
  return play(a, {
    venue: 'fldRugby', dur: tDive + 3.0, keys, payoff: tGround, R: RBR, extras: o.extras, view: o.view, orbit: o.orbit,
    runs: [{ from: 0.02, to: tDive - 0.2, period: o.period || 0.5, k: 1.0, hold: true, phase: 0.25 }].concat(o.runs || []),
    post: o.post,
    setup(env, S) { env.pose(S.poseAt(tGround)); pGround = handsMid(env); pGround.y = RBR; },
    update(t, env, S) {
      const B = env.props.ball, carry = o.carry || 'tuck';
      if (t < tDive - 0.4) holdOval(env, B, o.carryAt ? o.carryAt(t) : carry);
      else if (t < tGround) {
        const w = smooth(span(t, tDive - 0.4, tDive - 0.15));
        if (w < 1) { holdOval(env, B, carry, 1 - w); }
        else { const m = handsMid(env); B.position.copy(m); aimBall(B, chestDir(env, 1, 0, 0)); }
        if (w > 0 && w < 1) { const c = chestPt(env, 0, 0.04, 0.3); B.position.lerp(c, w); }
      } else { B.position.copy(pGround); aimBall(B, mw(env, V(1, 0, 0.2))); }
      if (o.update) o.update(t, env, S);
      return follow(env, B.position, 0, 6.2);
    }
  });
}
function lomu(a) {
  const tH = 0.9;
  const defK = [[0, Object.assign({ x: 7.7, z: 10.3, ry: -8 }, READY_R)], [0.72, { x: 7.2, z: 12.75, ry: -14 }], [tH - 0.08, { spineX: 38, chestX: 6, lHipF: 40, rHipF: 30, lKnee: 60, rKnee: 50, lShF: 70, rShF: 70, lShA: 20, rShA: 20, lEl: 30, rEl: 30, headX: -20 }],
    [tH + 0.25, { x: 7.6, z: 12.5, ry: -40, hipsX: -40, seat: 0.6, seatY: 0.5, spineX: -10, lHipF: 60, rHipF: 40, lKnee: 40, rKnee: 30, lShF: 120, rShF: 90, lShA: 40, rShA: 40, headX: 20 }],
    [tH + 0.55, { x: 8.0, z: 12.1, hipsX: -84, seat: 1, seatY: 0.16, spineX: 0, lHipF: 40, rHipF: 30, lKnee: 40, rKnee: 20, lShF: 40, rShF: 30, lShA: 60, rShA: 60, headX: 30 }], [3.5, { headX: 25 }]];
  return tryRun(a, {
    style: 'handoff', path: [[7.3, 22.0], [6.5, 13.6], [6.2, 9.0]], from: [5.8, 1.6], land: [5.6, -1.25], tDive: 2.4, carry: 'tuck',
    extras: [Object.assign(OPP(186, { build: 'athletic' }), { tag: 'd1', keys: defK, runs: [{ from: 0.1, to: 0.85, period: 0.6, k: 0.6 }] })],
    extraKeys: [[tH - 0.25, { rShF: 30, rEl: 70 }], [tH, { rShF: 78, rShA: 8, rEl: 6, rWrF: -40, spineX: 6, chestY: -12 }], [tH + 0.3, { rShF: 40, rEl: 40, chestY: 0 }]],
    update(t, env, S) {
      const w = win(t, tH - 0.18, tH - 0.03, tH + 0.12, tH + 0.3);
      if (w > 0) { const d = S.x[0]; const sh = d.bones.chest.localToWorld(V(0, 0.12 * d.p.H / 1.85, 0.12)); env.reach('r', sh, [-0.6, 1.2, 0.2], { weight: w }); }
    }
  });
}
function sidestep(a) {
  const tS = 1.05;
  const defK = [[0, Object.assign({ x: -2.6, z: 9.0, ry: 10 }, READY_R)], [0.95, { x: -3.2, z: 11.6, ry: 0 }], [tS + 0.15, { x: -3.5, z: 12.2, ry: -10, spineX: 35, lHipF: 50, lKnee: 60, rHipF: 20, rKnee: 40, lShF: 80, rShF: 80, headX: -20 }],
    [tS + 0.45, { x: -3.0, z: 12.7, ry: -25, hipsX: 50, seat: 0.8, seatY: 0.45, spineX: 10, lHipF: 10, rHipF: -10, lKnee: 20, rKnee: 30, lShF: 160, rShF: 160 }],
    [tS + 0.7, { x: -2.8, z: 12.9, hipsX: 86, seat: 1, seatY: 0.14, spineX: 2, headX: -40 }], [3.5, { headX: -30 }]];
  return tryRun(a, {
    style: 'sidestep', path: [[-4.6, 24], [-4.0, 14.6], [-4.15, 13.4], [-5.2, 12.4], [-5.6, 6.0]], from: [-5.6, 1.6], land: [-5.6, -1.2], tDive: 2.3, carry: 'two',
    extras: [Object.assign(OPP(168, { gender: 'f', hairStyle: 'ponytail' }), { tag: 'd2', keys: defK, runs: [{ from: 0.1, to: 0.95, period: 0.6, k: 0.6 }] })],
    extraKeys: [[tS - 0.12, { spineZ: 0 }], [tS, { spineZ: -14, hipsZ: -6, rHipA: 26, rKnee: 50 }], [tS + 0.25, { spineZ: 6, hipsZ: 0, rHipA: 7 }]]
  });
}
function cornerTry(a) {
  const defK = [[0, Object.assign({ x: -24.5, z: 16, ry: -40 }, READY_R)], [1.5, { x: -30.2, z: 4.6, ry: -60 }], [1.75, { hipsX: 55, seat: 1, seatY: 0.55, spineX: 8, lShF: 165, rShF: 165, lHipF: -10, rHipF: -10, air: 0 }], [2.0, { x: -31.6, z: 3.4, hipsX: 86, seatY: 0.14 }], [4, {}]];
  return tryRun(a, {
    style: 'corner', path: [[-32.0, 26], [-32.4, 12], [-32.6, 4.8]], from: [-32.7, 1.5], land: [-33.3, -1.2], tDive: 2.05, carry: 'tuck', period: 0.46,
    extras: [Object.assign(OPP(170, { gender: 'f', hairStyle: 'braids' }), { tag: 'd3', keys: defK, runs: [{ from: 0.05, to: 1.55, period: 0.5, k: 0.95 }] })], orbit: { base: 70, sweep: 70 }
  });
}
function lineBreak(a) {
  const tC = 0.7, tD = 1.2;
  const dA = [[0, Object.assign({ x: -0.9, z: 13.6, ry: 0 }, READY_R)], [tD + 0.1, { x: -0.6, z: 14.0 }], [tD + 0.45, { x: 0.15, z: 14.2, ry: 40, spineX: 35, lShF: 80, rShF: 60, lHipF: 40, lKnee: 50 }], [tD + 0.8, { x: 0.3, z: 14.3, hipsX: 60, seat: 1, seatY: 0.4, spineX: 8, lShF: 150, rShF: 150 }], [tD + 1.1, { hipsX: 86, seatY: 0.14 }], [4, {}]];
  const dB = [[0, Object.assign({ x: 2.4, z: 13.8, ry: 0 }, READY_R)], [tD, { x: 2.6, z: 14.0, ry: -10 }], [tD + 0.5, { x: 4.4, z: 14.6, ry: -35 }], [tD + 0.9, { x: 4.9, z: 13.4, ry: -150 }], [4, { x: 5.0, z: 12.5, ry: -160 }]];
  return tryRun(a, {
    style: 'dummy', path: [[-1.6, 25.5], [-0.6, 17.5], [1.2, 13.4], [1.4, 6]], from: [1.4, 1.6], land: [1.2, -1.2], tDive: 2.45, carry: 'two',
    extras: [Object.assign(OPP(184), { tag: 'dA', keys: dA }), Object.assign(OPP(188, { skin: '#8d5a3b' }), { tag: 'dB', keys: dB, runs: [{ from: tD + 0.05, to: tD + 0.55, period: 0.5, k: 0.5 }, { from: tD + 0.9, to: 4, period: 0.55, k: 0.7 }] })],
    extraKeys: [[tD - 0.2, { chestY: 0, headY: 0 }], [tD, { chestY: -38, headY: -45, spineZ: 6 }], [tD + 0.25, { chestY: 0, headY: 0, spineZ: 0 }]],
    carryAt: t => 'two',
    update(t, env, S) {
      const B = env.props.ball;
      if (t < tC) { const a0 = mw(env, V(-8.5, 1.0, 26.0)), hT = chestPt(env, 0, 0.06, 0.34), u = clamp((t - 0.05) / (tC - 0.05), 0, 1); B.position.copy(arc(a0, hT, 0.4, u, V())); aimBall(B, hT.clone().sub(a0), t * 30); }
      const w = win(t, tD - 0.25, tD - 0.05, tD + 0.08, tD + 0.3);
      if (w > 0) { const c = chestPt(env, -0.36 * w, 0.0, 0.3); B.position.copy(c); env.reach('l', c.clone().add(chestDir(env, 1, 0, -0.3).multiplyScalar(0.11 * env.s)), [0.6, 0.8, -0.3]); env.reach('r', c.clone().add(chestDir(env, -1, 0, -0.3).multiplyScalar(0.11 * env.s)), [-0.8, 0.8, -0.2]); }
    }
  });
}
/* jackal: arrive over the tackled player, clamp onto the ball, rip it free (turnover) */
function jackal(a, o = {}) {
  const low = o.low ? 8 : 0, tSet = 0.85, tRip = 2.05, H = Hof(a);
  const keys = [[0, Object.assign({ x: 0.1, z: 16.6, ry: 0 }, READY_R, { spineX: 20 })], [0.55, { x: 0.05, z: 18.5 }],
    [tSet, { x: 0, z: 18.95, lHipA: 24, rHipA: 24, lHipR: 12, rHipR: 12, hipsX: 22, lHipF: 95 + low, rHipF: 95 + low, lKnee: 104 + low, rKnee: 104 + low, lAnk: -31, rAnk: -31, spineX: 38 + low * 0.5, chestX: 12, neckX: -18, headX: -26, lShF: 80, rShF: 80, lEl: 20, rEl: 20 }],
    [tSet + 0.45, { spineX: 44 + low * 0.5, chestX: 16, hipsZ: 3 }], [tSet + 0.75, { spineX: 42 + low * 0.5, hipsZ: -3 }], [tRip - 0.15, { spineX: 42 + low * 0.5, hipsZ: 0, lKnee: 108 + low, rKnee: 108 + low, lAnk: -35, rAnk: -35 }],
    [tRip + 0.12, { hipsX: 16, lHipF: 75, rHipF: 75, lKnee: 85, rKnee: 85, lAnk: -25, rAnk: -25, spineX: 30, chestX: 6 }],
    [tRip + 0.45, { hipsX: 0, lHipF: 28, rHipF: 28, lKnee: 34, rKnee: 34, lAnk: 6, rAnk: 6, lHipR: 0, rHipR: 0, spineX: 10, chestX: 0, neckX: 0, headX: -10, lHipA: 12, rHipA: 12, z: 18.85 }],
    [tRip + 0.85, { ry: -30, x: -0.2, z: 18.4, lHipF: 12, rHipF: 12, lKnee: 16, rKnee: 16, spineX: 4, headX: -14 }]];
  const tackled = [[0, { x: -0.15, z: 20.25, ry: 90, hipsX: -84, seat: 1, seatY: 0.15, hipsZ: 10, lHipF: 30, rHipF: 50, lKnee: 40, rKnee: 60, lShF: 100, rShF: 130, lShA: 30, rShA: 50, lEl: 40, rEl: 30, headX: 20, headY: 20 }],
    [tRip, { rShF: 140, lShF: 110 }], [tRip + 0.35, { rShF: 170, rShA: 30, rEl: 10, lShF: 120, headX: 10 }], [4.5, { rShF: 165 }]];
  const ball0 = [0.05, 19.72];
  return play(a, {
    venue: 'fldRugby', dur: tRip + 2.2, keys, payoff: tRip + 0.15, R: RBR, runs: [{ from: 0.02, to: tSet - 0.15, period: 0.55, k: 0.7 }],
    extras: [Object.assign(OPP(184, { skin: '#8d5a3b' }), { tag: 'tk', keys: tackled, mood: t => ({ focus: 0.8, sad: t > tRip ? 0.7 : 0 }) })], orbit: { base: 60, sweep: 80 },
    update(t, env, S) {
      const B = env.props.ball, gb = mw(env, V(ball0[0], RBR + 0.005, ball0[1]));
      const lift = smooth(span(t, tRip - 0.12, tRip + 0.28));
      const tug = t > tSet + 0.3 && t < tRip ? Math.sin((t - tSet) * 18) * 0.03 : 0;
      const held = chestPt(env, 0, 0.06, 0.3), p = gb.clone().add(V(0, tug + 0.02, 0)).lerp(held, lift);
      B.position.copy(p); aimBall(B, mw(env, V(1, 0.1, 0.2)).lerp(chestDir(env, 1, 0.2, 0), lift));
      const w = smooth(span(t, tSet - 0.35, tSet)), raise = smooth(span(t, tRip + 0.45, tRip + 0.9));
      const hp = p.clone().add(V(0, 0.08 * raise * 0, 0));
      if (raise > 0) hp.lerp(chestPt(env, -0.1, 0.65, 0.25), raise);
      env.reach('l', hp.clone().add(chestDir(env, 1, 0, -0.2).multiplyScalar(0.11 * env.s)), [0.6, 0.6, -0.1], { weight: w });
      env.reach('r', hp.clone().add(chestDir(env, -1, 0, -0.2).multiplyScalar(0.11 * env.s)), [-0.6, 0.6, -0.1], { weight: w });
      if (raise > 0) B.position.copy(hp);
      // the tackled player keeps a hand on the ball until it is ripped away
      const x = S.x[0], wt = 1 - smooth(span(t, tRip, tRip + 0.25));
      if (wt > 0) reachX(env, x, 'r', p.clone().add(V(0, 0.05, 0)), x.bones.chest.localToWorld(V(0, 0.4, 0.4)), { weight: wt });
      return follow(env, p, 0.25, 4.8, -0.15);
    }
  });
}
/* dominant tackle: drive the shoulder into the carrier and put him down */
function tackle(a) {
  const tHit = 1.2, H = Hof(a);
  const keys = [[0, Object.assign({ x: 0.15, z: 18.0, ry: 0 }, READY_R, { spineX: 22, lHipF: 34, rHipF: 34, lKnee: 46, rKnee: 46, lShF: 40, rShF: 40, headX: -14 })],
    [0.7, { x: 0.15, z: 18.6, spineX: 30, lHipF: 50, rHipF: 50, lKnee: 70, rKnee: 70 }],
    [tHit - 0.12, { x: 0.1, z: 19.3, spineX: 42, lHipF: 60, lKnee: 70, rHipF: -10, rKnee: 40, lShF: 70, rShF: 50, lShA: 30, rShA: 20, lEl: 70, rEl: 70, chestY: 14, headY: -15, headX: -26 }],
    [tHit, { x: 0.05, z: 19.8, spineX: 38, chestY: 18, lShF: 85, rShF: 70, lShA: 50, rShA: 40, lEl: 95, rEl: 95, rHipF: -18, rKnee: 30, lHipF: 40, lKnee: 50 }],
    [tHit + 0.3, { z: 20.5, hipsX: 30, seat: 0.7, seatY: 0.55, spineX: 30, lHipF: 10, rHipF: -10, lKnee: 40, rKnee: 50 }],
    [tHit + 0.55, { z: 20.8, hipsX: 74, seat: 1, seatY: 0.42, spineX: 8, lHipF: 20, rHipF: 10, lKnee: 70, rKnee: 60, lShF: 100, rShF: 80, headX: -30 }],
    [tHit + 1.0, { z: 20.6, hipsX: 30, seatY: 0.55, spineX: 30, lHipF: 80, rHipF: 50, lKnee: 110, rKnee: 90, lShF: 40, rShF: 40, lEl: 40, rEl: 40, headX: -10 }],
    [tHit + 1.4, Object.assign({ x: 0.2, z: 20.2, ry: -10, hipsX: 0, seat: 0, spineX: 8, chestY: 0, headY: 0 }, READY_R)]].concat(cheer(tHit + 1.6, 'pump'));
  const car = [[0, Object.assign({ x: -0.1, z: 26.5, ry: 180 }, READY_R)], [tHit - 0.05, { x: 0.0, z: 21.0, ry: 180, spineX: 18 }],
    [tHit + 0.3, { z: 21.6, hipsX: -45, seat: 0.8, seatY: 0.55, spineX: -10, lHipF: 70, rHipF: 50, lKnee: 30, rKnee: 30, lShF: 60, rShF: 90, headX: 25 }],
    [tHit + 0.6, { z: 22.0, hipsX: -84, seat: 1, seatY: 0.15, spineX: 0, lHipF: 40, rHipF: 30, lKnee: 40, rKnee: 30, lShF: 20, rShF: 30, headX: 30 }], [4.5, { headX: 25 }]];
  return play(a, {
    venue: 'fldRugby', dur: tHit + 3.0, keys, payoff: tHit + 0.6, R: RBR, orbit: { base: 70, sweep: 80 },
    extras: [Object.assign(OPP(188, { build: 'stocky' }), { tag: 'car', keys: car, runs: [{ from: 0.05, to: tHit - 0.1, period: 0.5, k: 0.95, hold: true }], mood: t => ({ focus: 0.8, sad: t > tHit + 0.3 ? 0.6 : 0 }) })],
    update(t, env, S) {
      const B = env.props.ball, x = S.x[0];
      const c = x.bones.chest.localToWorld(V((env.mirror ? 0.15 : -0.15) * x.p.H / 1.85, 0, 0.15 * x.p.H / 1.85)); B.position.copy(c); aimBall(B, x.bones.chest.localToWorld(V(0, 0.5, 1)).sub(x.bones.chest.getWorldPosition(V())));
      reachX(env, x, 'l', c.clone().add(V(0, 0.08, 0)), x.bones.chest.localToWorld(V(0.6, 0, -0.4)), { weight: 1 });
      const w = win(t, tHit - 0.08, tHit + 0.05, tHit + 0.6, tHit + 0.9);
      if (w > 0) { const back = x.bones.spine.localToWorld(V(0, 0.08, -0.12)); env.reach('l', back.clone().add(V(0.12, 0, 0)), [0.6, 1.0, 0.3], { weight: w }); env.reach('r', back.clone().add(V(-0.12, 0, 0)), [-0.6, 1.0, 0.3], { weight: w }); }
      return follow(env, B.position, 0.3, 5.0);
    }
  });
}
/* spin pass off the ground (from the base of a ruck) to a team-mate 14 m away */
function spinPass(a) {
  const P0 = [0.0, 24.0], tPick = 0.9, tRel = 1.45, tgt = [-13.5, 1.15, 22.6], flight = 0.85;
  const ryT = headingTo(P0[0], P0[1], tgt[0], tgt[2]);
  const keys = [[0, Object.assign({ x: P0[0] + 0.3, z: P0[1] + 1.4, ry: 180 }, READY_R)], [0.55, { x: P0[0] + 0.15, z: P0[1] + 0.45 }],
    [tPick, { x: P0[0], z: P0[1] + 0.15, ry: 200, lHipF: 70, rHipF: 40, lKnee: 80, rKnee: 60, lHipA: 18, rHipA: 18, spineX: 48, headY: -40, headX: 10 }],
    [tRel - 0.2, { ry: 215, lHipF: 40, rHipF: 30, lKnee: 50, rKnee: 40, spineX: 30, hipsY: -30, chestY: -30, headY: 70 }],
    [tRel, { ry: ryT - 70, hipsY: 10, chestY: 30, spineX: 22, rHipF: -10, rKnee: 30, lHipF: 40, lKnee: 30, headY: 40 }],
    [tRel + 0.35, { ry: ryT - 55, hipsY: 15, chestY: 35, spineX: 14, lShF: 70, rShF: 80, lShA: 30, rShA: 10, lEl: 10, rEl: 10, headY: 35 }],
    [tRel + 1.3, Object.assign({ ry: ryT - 40, hipsY: 0, chestY: 0, headY: 20 }, READY_R)]];
  return play(a, {
    venue: 'fldRugby', dur: tRel + 2.0, keys, payoff: tRel + flight, R: RBR, orbit: { base: 40, sweep: 70 },
    update(t, env, S) {
      const B = env.props.ball, g0 = mw(env, V(P0[0] - 0.35, RBR, P0[1] - 0.35));
      let out = { marker: mw(env, V(tgt[0], 0.02, tgt[2])) };
      if (t < tPick) { B.position.copy(g0); aimBall(B, mw(env, V(1, 0, 0.3))); }
      else if (t < tRel) {
        const u = smooth(span(t, tPick, tPick + 0.25)), c = chestPt(env, lerp(-0.1, -0.32, smooth(span(t, tPick + 0.2, tRel))), lerp(-0.25, -0.1, u), 0.32);
        const p = g0.clone().lerp(c, u); B.position.copy(p); aimBall(B, chestDir(env, 1, 0, 0.3));
        env.reach('l', p.clone().add(chestDir(env, 1, 0, -0.3).multiplyScalar(0.11 * env.s)), [0.6, 0.6, -0.3]); env.reach('r', p.clone().add(chestDir(env, -1, 0, -0.3).multiplyScalar(0.11 * env.s)), [-0.6, 0.6, -0.3]);
      } else {
        if (!S.rel) { env.pose(S.poseAt(tRel)); S.rel = mw(env, chestPt(env, -0.32, -0.1, 0.32)); env.pose(S.poseAt(t)); }   // depends only on tRel
        const u = (t - tRel) / flight, A0 = mw(env, S.rel.clone()), T = mw(env, V(tgt[0], tgt[1], tgt[2]));
        if (u <= 1) { B.position.copy(arc(A0, T, 0.5, u, V())); aimBall(B, T.clone().sub(A0), (t - tRel) * 45); }
        else { B.position.copy(T); }
      }
      return Object.assign(follow(env, B.position, 0.35 * win(t, tRel, tRel + 0.4, 3.5, 4), 5.4), out);
    }
  });
}

/* ================================================================== american & flag football */
const FBR = 0.086;
/* right-handed throwing arm along an IK path (athlete-local, 1.85 m scale): load behind the ear → release → follow-through */
function throwHand(env, t, tLoad, tRel, side) {
  const k = clamp((t - tLoad) / (tRel - tLoad), 0, 1.7), sa = side ? 1 : 0;
  const back = side ? [-0.55, 1.45, -0.3] : [-0.3, 1.72, -0.32], rel = side ? [-0.62, 1.42, 0.32] : [-0.22, 1.98, 0.42], fin = side ? [0.15, 1.0, 0.55] : [0.32, 0.95, 0.45];
  const p = k < 1 ? back.map((v, i) => lerp(v, rel[i], smooth(k))) : rel.map((v, i) => lerp(v, fin[i], smooth((k - 1) / 0.7)));
  env.reach('r', env.ws(p), k < 1 ? [-1.0, 1.25 - sa * 0.5, -0.7] : [-0.9, 1.2, 0.6], { weight: 1 });
}
/* center (extra) crouched over the ball at the line of scrimmage, snapping it back at tSnap, then blocking */
function centerKeys(L, tSnap) {
  return [[0, { x: 0, z: L + 0.35, ry: 180, hipsX: 18, lHipF: 92, rHipF: 92, lKnee: 104, rKnee: 104, lAnk: -30, rAnk: -30, lHipA: 18, rHipA: 18, spineX: 46, chestX: 6, headX: -40, rShF: 80, lShF: 30, lEl: 60, rEl: 10 }],
    [tSnap, { rShF: 50 }], [tSnap + 0.35, { hipsX: 0, lHipF: 40, rHipF: 30, lKnee: 50, rKnee: 40, lAnk: -10, rAnk: -10, spineX: 30, chestX: 4, headX: -20, lShF: 70, rShF: 70, lEl: 80, rEl: 80, z: L + 0.1 }], [6, { z: L - 0.4 }]];
}
/* the quarterback's play: snap (under centre or shotgun), drop / roll-out / scramble, throw a spiral to a receiver */
function qbPlay(a, o) {
  const L = o.L || 12, sg = o.shotgun, tSnap = o.tSnap || 0.6, tCatch = o.tRel + o.flight, H = Hof(a), flag = o.flag;
  const q0 = sg ? [0, L + 4.6] : [0, L + 0.95];
  const STANCE = sg ? { lHipF: 30, rHipF: 30, lKnee: 40, rKnee: 40, lAnk: -10, rAnk: -10, lHipA: 9, rHipA: 9, spineX: 24, lShF: 40, rShF: 40, lEl: 60, rEl: 60, headX: -6 }
    : { lHipF: 38, rHipF: 38, lKnee: 48, rKnee: 48, lAnk: -10, rAnk: -10, lHipA: 9, rHipA: 9, spineX: 34, chestX: 6, headX: -12, lShF: 60, rShF: 60 };
  const keys = [[0, Object.assign({ x: q0[0], z: q0[1], ry: 180 }, STANCE)]].concat(o.keys);
  const ex = [];
  if (o.center !== false) ex.push(Object.assign(OPP(188, { build: 'stocky' }), { tag: 'c', uni: 'same', keys: centerKeys(L, tSnap) }));
  const rc = o.receiver; ex.push(Object.assign(OPP(rc.h || 188), { tag: 'wr', uni: 'same', keys: rc.keys, runs: rc.runs, mood: t => ({ joy: t > tCatch + 0.1 ? 1 : 0, focus: 0.6 }) }));
  if (o.rusher) ex.push(Object.assign(OPP(190), { tag: 'dl', keys: o.rusher.keys, runs: o.rusher.runs }));
  let snapA = null, rel = null, cat = null;
  return play(a, {
    venue: flag ? 'fldFlag' : 'fldGridiron', dur: o.dur, keys, runs: o.runs, post: o.post, payoff: tCatch, R: FBR, extras: ex, orbit: o.orbit || { base: 150, sweep: 60 }, mirror: false,
    setup(env, S) {
      if (S.x[0] && o.center !== false) for (const x of S.x.slice(0, 2)) { /* team-mates wear the same kit */ }
      const wr = S.x[o.center !== false ? 1 : 0];
      poseX(env, wr, S.xpose(tCatch, o.center !== false ? 1 : 0)); cat = mw(env, wr.handTip_l.getWorldPosition(V()).add(wr.handTip_r.getWorldPosition(V())).multiplyScalar(0.5));
      env.pose(S.poseAt(o.tRel)); throwHand(env, o.tRel, o.tRel - 0.3, o.tRel, o.side); rel = mw(env, env.handPos('r').add(env.dir([0.0, 0.06, 0.02])));
      S.wr = wr; S.wi = o.center !== false ? 1 : 0;
    },
    update(t, env, S) {
      const B = env.props.ball, wr = S.wr;
      const snapP = V(0, FBR + 0.01, L - 0.25), hands = mw(env, chestPt(env, 0, 0.0, 0.3).clone()); mw(env, hands);
      if (t < tSnap) { B.position.copy(mw(env, snapP.clone())); aimBall(B, V(0, 0.15, 1)); }
      else if (t < o.tRel) {
        const tIn = sg ? 0.42 : 0.14, u = (t - tSnap) / tIn, holdP = chestPt(env, -0.12, 0.12, 0.3);
        const tl = o.tRel - 0.32;
        if (u < 1) { if (sg) { env.pose(S.poseAt(tSnap + tIn)); const h1 = chestPt(env, 0, 0.0, 0.32); env.pose(S.poseAt(t)); B.position.copy(arc(mw(env, snapP.clone()), h1, 0.25, u, V())); } else B.position.copy(mw(env, snapP.clone()).lerp(chestPt(env, 0, -0.25, 0.4), smooth(u))); aimBall(B, mw(env, V(0, 0.2, 1)), t * 25); }
        else if (t < tl) { B.position.copy(holdP); aimBall(B, chestDir(env, -0.3, 0.6, 1)); }
        else { throwHand(env, t, tl, o.tRel, o.side); B.position.copy(env.handPos('r').add(env.dir([0.0, 0.06, 0.02]))); aimBall(B, env.dir([-0.2, 0.5, 1])); }
        const pump = o.pump ? win(t, o.pump - 0.25, o.pump - 0.08, o.pump + 0.02, o.pump + 0.2) : 0;
        if (pump > 0) { const pp = env.ws([lerp(-0.25, -0.2, pump), lerp(1.55, 1.92, pump), lerp(-0.1, 0.25, pump)]); env.reach('r', pp, [-1, 1.3, -0.5], { weight: 1 }); B.position.copy(env.handPos('r').add(env.dir([0, 0.06, 0.02]))); }
        else if (u >= 0.7 && t < tl) { env.reach('r', B.position.clone().add(chestDir(env, -0.6, -0.4, -0.3).multiplyScalar(0.07)), [-0.9, 0.9, -0.4], { weight: 1 }); }
        if (u >= 0.6 && t < tl + 0.12) env.reach('l', B.position.clone().add(chestDir(env, 1, -0.2, 0).multiplyScalar(0.09)), [0.9, 0.9, -0.2], { weight: (1 - smooth(span(t, tl, tl + 0.12))) * (1 - pump) });
        if (u < 1 && !sg) { const sp = chestPt(env, 0, -0.32, 0.45); env.reach('r', sp.clone().add(V(0, 0.05, 0)), [-0.7, 0.6, 0], { weight: 1 - smooth(span(t, tSnap + 0.1, tSnap + 0.35)) }); env.reach('l', sp, [0.7, 0.6, 0], { weight: 1 - smooth(span(t, tSnap + 0.1, tSnap + 0.35)) }); }
        else if (u < 1 && sg) { const w = smooth(span(t, tSnap + tIn - 0.25, tSnap + tIn)); env.reach('r', B.position.clone().add(env.dir([-0.1, 0, -0.05])), [-0.8, 0.9, -0.2], { weight: w }); env.reach('l', B.position.clone().add(env.dir([0.1, 0, -0.05])), [0.8, 0.9, -0.2], { weight: w }); }
      } else {
        throwHand(env, t, o.tRel - 0.32, o.tRel, o.side);
        const u = (t - o.tRel) / o.flight, A0 = mw(env, rel.clone()), C = mw(env, cat.clone());
        if (u <= 1) { B.position.copy(arc(A0, C, o.apex || 3, u, V())); const nx = arc(A0, C, o.apex || 3, Math.min(1, u + 0.02), V()).sub(B.position); if (u >= 0.999) nx.copy(C).sub(A0); aimBall(B, nx, (t - o.tRel) * 40); }
        else { const m = wr.handTip_l.getWorldPosition(V()).add(wr.handTip_r.getWorldPosition(V())).multiplyScalar(0.5); B.position.copy(m); aimBall(B, wr.bones.chest.localToWorld(V(0, 0.4, 1)).sub(wr.bones.chest.getWorldPosition(V()))); }
      }
      // receiver hands meet the ball
      const wc = win(t, tCatch - 0.45, tCatch - 0.1, tCatch + 0.35, tCatch + 0.7);
      if (wc > 0 && t <= tCatch) { reachX(env, wr, 'l', B.position.clone().add(V(0.09, 0, 0)), wr.bones.chest.localToWorld(V(0.5, 0.2, 0)), { weight: wc }); reachX(env, wr, 'r', B.position.clone().add(V(-0.09, 0, 0)), wr.bones.chest.localToWorld(V(-0.5, 0.2, 0)), { weight: wc }); }
      if (o.update) o.update(t, env, S);
      const k = (o.camK || 0.5) * win(t, o.tRel, o.tRel + o.flight * 0.8, o.dur + 1, o.dur + 2);
      return follow(env, B.position, k, 5.6);
    }
  });
}
/* receiver track helper: run from p0 through pts, catch at tCatch (arms up), then celebrate */
function wrKeys(pts, t0, t1, tCatch, catchPose, after) {
  return [[0, Object.assign({}, READY_R, { spineX: 20 })]].concat(along(pts, t0, t1, 8), [[tCatch - 0.3, catchPose || {}], [tCatch, Object.assign({ lShF: 165, rShF: 165, lShA: 10, rShA: 10, lEl: 15, rEl: 15, headX: -30 }, catchPose || {})],
    [tCatch + 0.5, { lShF: 60, rShF: 60, lEl: 90, rEl: 90, headX: 0, air: 0 }], [tCatch + 1.1, Object.assign({ lShF: 170, rShF: 170, lShA: 12, rShA: 12, lEl: 5, rEl: 5, headX: -10 }, after || {})]]);
}
function brady(a) {
  const L = 12, tRel = 2.6, flight = 1.45, tC = tRel + flight;
  const keys = [[0.6, {}], [0.75, { ry: 135, spineX: 14, lHipF: 20, rHipF: 20, lKnee: 30, rKnee: 30 }], [1.75, { x: 0.25, z: L + 6.6, ry: 120 }], [1.95, Object.assign({ x: 0.2, z: L + 6.5, ry: 165 }, READY_R, { lShF: 40, rShF: 40 })],
    [2.25, { x: 0.15, z: L + 5.9, ry: 170 }], [tRel - 0.12, { ry: 105, hipsY: -15, chestY: -25, lHipF: 30, lKnee: 20, rHipF: -5, rKnee: 30, spineX: 4, headY: 70, lShF: 70, lShA: 30, lEl: 20 }],
    [tRel, { x: 0.05, z: L + 5.4, ry: 150, hipsY: 25, chestY: 25, spineX: 16, lHipF: 30, lKnee: 24, rHipF: -14, rKnee: 30, rAnk: 30, headY: 20, lShF: 20, lShA: 30, lEl: 60 }],
    [tRel + 0.35, { hipsY: 10, chestY: 10, spineX: 20, rHipF: 30, rKnee: 50, lShF: 10, lEl: 40, headY: 10 }], [tC + 0.15, Object.assign({}, READY_R, { ry: 175, hipsY: 0, chestY: 0, headY: 0 })],
    [tC + 0.6, { lShF: 172, rShF: 172, lShA: 8, rShA: 8, lEl: 6, rEl: 6, spineX: -4, headX: -16 }]];
  return qbPlay(a, { L, tRel, flight, apex: 4.2, dur: tC + 1.6, keys, runs: [{ from: 0.85, to: 1.8, period: 0.45, k: 0.6, hold: true }, { from: 1.95, to: 2.3, period: 0.5, k: 0.3, hold: true }],
    receiver: { keys: wrKeys([[-9.5, L + 1], [-9.3, 2], [-6.8, -4.6]], 0.6, tC - 0.2, tC, { ry: 20 }), runs: [{ from: 0.6, to: tC - 0.25, period: 0.5, k: 0.95 }] } });
}

function manning(a) {
  const L = 12, tSnap = 1.6, tRel = 3.05, flight = 1.4, tC = tRel + flight;
  const keys = [[0, { lHipF: 14, rHipF: 14, lKnee: 20, rKnee: 20, spineX: 8, lShF: 10, rShF: 10, lEl: 20, rEl: 20 }],
    [0.3, { rShF: 95, rShA: 55, rEl: 5, headY: 40, chestY: 15 }], [0.65, { rShF: 90, rShA: 25, rEl: 5, headY: 10, chestY: 5 }],
    [0.95, { rShF: 120, rShA: 20, rEl: 120, lShF: 120, lShA: 20, lEl: 120, headY: 0, chestY: 0 }], [1.15, { rShF: 60, rEl: 90, lShF: 60, lEl: 90 }],
    [1.4, { lHipF: 30, rHipF: 30, lKnee: 40, rKnee: 40, spineX: 24, lShF: 40, rShF: 40, lEl: 60, rEl: 60, lShA: 10, rShA: 10 }],
    [tSnap + 0.45, { ry: 180, spineX: 12 }], [tSnap + 0.95, { x: 0.1, z: L + 6.3, ry: 160 }],
    [tRel - 0.12, { ry: 105, hipsY: -15, chestY: -25, lHipF: 30, lKnee: 20, rHipF: -5, rKnee: 30, spineX: 4, headY: 70, lShF: 70, lShA: 30, lEl: 20 }],
    [tRel, { x: 0.05, z: L + 5.7, ry: 150, hipsY: 25, chestY: 25, spineX: 16, lHipF: 30, lKnee: 24, rHipF: -14, rKnee: 30, rAnk: 30, headY: 20, lShF: 20, lShA: 30, lEl: 60 }],
    [tRel + 0.35, { hipsY: 10, chestY: 10, spineX: 20, rHipF: 30, rKnee: 50, lShF: 10, lEl: 40, headY: 10 }], [tC + 0.15, Object.assign({}, READY_R, { ry: 175, hipsY: 0, chestY: 0, headY: 0 })],
    [tC + 0.6, { lShF: 172, rShF: 172, lShA: 8, rShA: 8, lEl: 6, rEl: 6, spineX: -4, headX: -16 }]];
  return qbPlay(a, { L, tSnap, tRel, flight, apex: 3.8, dur: tC + 1.6, keys, shotgun: true, runs: [{ from: tSnap + 0.4, to: tSnap + 1.0, period: 0.45, k: 0.5, hold: true }],
    receiver: { keys: wrKeys([[9.5, L + 1], [9.3, 3], [6.4, -4.4]], 1.6, tC - 0.2, tC, { ry: -20 }), runs: [{ from: 1.6, to: tC - 0.25, period: 0.5, k: 0.95 }] } });
}
function montana(a) {
  const L = 12, tSnap = 0.6, tRel = 2.45, flight = 1.55, tC = tRel + flight;
  const keys = [[0.75, { ry: 120, spineX: 14 }]].concat(along([[0, L + 0.95], [0.6, L + 2.8], [3.0, L + 4.2], [6.0, L + 4.0]], 0.7, tRel + 0.1, 8, 0).slice(1), [
    [tRel - 0.15, { hipsY: -10, chestY: -20, spineX: 10, headY: 60, lShF: 60, lShA: 30, lEl: 30 }],
    [tRel, { hipsY: 10, chestY: 20, spineX: 16, headY: 10, lShF: 20, lShA: 30, lEl: 60 }],
    [tRel + 0.4, Object.assign({ x: 6.8, z: L + 3.8, ry: 150, hipsY: 0, chestY: 0, headY: 0 }, READY_R)], [tC + 0.6, { lShF: 172, rShF: 172, lShA: 8, rShA: 8, lEl: 6, rEl: 6, spineX: -4, headX: -16 }]]);
  return qbPlay(a, { L, tSnap, tRel, flight, apex: 4.6, dur: tC + 1.6, keys, runs: [{ from: 0.75, to: tRel + 0.3, period: 0.5, k: 0.8, hold: true }],
    post(q, t) { if (t > 0.9 && t < tRel + 0.05) q.ry = lerpAng(q.ry, 150, smooth(span(t, tRel - 0.6, tRel - 0.1))); },
    receiver: { h: 193, keys: wrKeys([[1.5, L + 1], [3.0, 0], [6.0, -8.2]], 0.6, tC - 0.25, tC, { ry: -160, air: 0.45, lHipF: 40, lKnee: 70 }, { ry: -150 }), runs: [{ from: 0.6, to: tC - 0.35, period: 0.55, k: 0.85 }] } });
}
function mahomes(a) {
  const L = 12, tSnap = 0.6, tRel = 2.55, flight = 1.3, tC = tRel + flight;
  const keys = [[tSnap + 0.45, { ry: 180, spineX: 12 }]].concat(along([[0, L + 4.6], [-0.6, L + 5.8], [-3.2, L + 6.2], [-5.4, L + 5.4]], tSnap + 0.45, tRel - 0.15, 6, 0).slice(1), [
    [tRel - 0.15, { ry: 200, hipsY: -20, chestY: -30, spineX: 12, spineZ: 8, headY: 75, lShF: 60, lShA: 40, lEl: 30 }],
    [tRel, { x: -5.6, z: L + 5.2, ry: 205, hipsY: 5, chestY: 15, spineX: 20, spineZ: 18, headY: 85, neckY: 20, lShF: 20, lShA: 40, lEl: 60, lHipF: 30, lKnee: 34, rHipF: -10, rKnee: 30 }],
    [tRel + 0.35, { spineZ: 6, hipsY: 0, chestY: 5, headY: 40, neckY: 10 }],
    [tRel + 0.9, Object.assign({ ry: 170, headY: 0, neckY: 0, spineZ: 0, chestY: 0 }, READY_R)], [tC + 0.6, { lShF: 172, rShF: 172, lShA: 8, rShA: 8, lEl: 6, rEl: 6, spineX: -4, headX: -16 }]]);
  return qbPlay(a, { L, tSnap, tRel, flight, apex: 2.2, dur: tC + 1.6, keys, shotgun: true, side: true, runs: [{ from: tSnap + 0.45, to: tRel - 0.2, period: 0.45, k: 0.8, hold: true }],
    receiver: { keys: wrKeys([[8.5, L + 1], [8.0, 4], [3.6, -3.0]], 0.6, tC - 0.2, tC, { ry: 70 }), runs: [{ from: 0.6, to: tC - 0.25, period: 0.5, k: 0.9 }] } });
}
/* receiver plays: the ball is thrown from an unseen quarterback behind the line */
function wrPlay(a, o) {
  const tC = o.tC, H = Hof(a);
  let cat = null;
  return play(a, {
    venue: 'fldGridiron', dur: o.dur, keys: o.keys, runs: o.runs, payoff: o.payoff || tC, R: FBR, extras: o.extras, orbit: o.orbit,
    setup(env, S) { env.pose(S.poseAt(tC)); cat = mw(env, chestPt(env, 0, o.high ? 0.95 : 0.12, o.high ? 0.25 : 0.38)); S.from = V(...o.from); },
    update(t, env, S) {
      const B = env.props.ball, t0 = tC - o.flight;
      if (t < tC) {
        const u = clamp((t - t0) / o.flight, 0, 1), A0 = mw(env, S.from.clone()), C = mw(env, cat.clone());
        B.position.copy(arc(A0, C, o.apex, u, V())); const nx = arc(A0, C, o.apex, Math.min(1, u + 0.02), V()).sub(B.position); if (u >= 0.98) nx.copy(C).sub(A0); aimBall(B, nx, t * 40);
        if (t < t0) B.visible = t > t0 - 0.01; else B.visible = true;
        const w = smooth(span(t, tC - 0.4, tC - 0.12)), Bp = B.position;
        if (w > 0) { env.reach('l', Bp.clone().add(chestDir(env, 1, 0, -0.1).multiplyScalar(0.1)), [0.8, 1.2, 0.2], { weight: w }); env.reach('r', Bp.clone().add(chestDir(env, -1, 0, -0.1).multiplyScalar(0.1)), [-0.8, 1.2, 0.2], { weight: w }); }
      } else {
        B.visible = true; const tuck = smooth(span(t, tC + 0.25, tC + 0.6)), raise = o.raise ? smooth(span(t, o.raise, o.raise + 0.3)) : 0;
        if (tuck < 1) { const hp = handsMid(env).lerp(chestPt(env, -0.15, 0.0, 0.16), tuck); B.position.copy(hp); aimBall(B, chestDir(env, -0.1, 0.5, 1)); if (tuck > 0) env.reach('r', hp.clone().add(chestDir(env, -1, 0, -0.1).multiplyScalar(0.1)), [-0.8, 1.0, 0], { weight: tuck }); }
        else holdOval(env, B, 'tuckR');
        if (raise > 0) { env.reach('r', chestPt(env, -0.22, 0.95, 0.12), [-0.8, 1.7, 0], { weight: raise }); B.position.lerp(env.handPos('r').add(V(0, 0.05, 0)), raise); }
      }
      if (o.update) o.update(t, env, S);
      return follow(env, B.position, (o.camK || 0.35) * win(t, t0, t0 + 0.4, tC - 0.05, tC + 0.4), 5.8);
    }
  });
}
function rice(a) {
  const tC = 1.7;
  const keys = [[0, Object.assign({ x: -10.5, z: 16.5, ry: 180 }, { lHipF: 40, rHipF: 20, lKnee: 50, rKnee: 40, spineX: 34, lShF: 30, rShF: -20, lEl: 70, rEl: 60, headX: -20, headY: 30 })],
    [0.35, { x: -10.5, z: 16.4 }], [0.95, { x: -10.3, z: 13.4, ry: 180 }], [1.1, { x: -9.9, z: 12.9, ry: 135, spineZ: -10 }], [1.3, { spineZ: 0 }]]
    .concat(along([[-9.9, 12.9], [-6.0, 8.9], [-2.8, 3.0], [-1.6, -3.2]], 1.1, 3.0, 8).slice(1), [[3.25, Object.assign({ x: -1.5, z: -3.9, ry: 175 }, READY_R)], [3.7, { ry: 150 }], [4.0, { spineX: 2, lShF: 40, lShA: 30, headX: -12 }], [4.9, {}]]);
  return wrPlay(a, { tC, flight: 0.62, apex: 0.6, from: [-1.5, 2.1, 20.5], dur: 5.0, keys, raise: 3.75,
    runs: [{ from: 0.35, to: 3.15, period: 0.48, k: 0.95, phase: 0.25 }] });
}
function moss(a) {
  const tJ = 2.55, tC = 2.8;
  const keys = [[0, Object.assign({}, READY_R, { spineX: 24 })]].concat(along([[13.5, 27], [13.4, 9], [12.6, 1.6]], 0, tJ - 0.1, 8), [
    [tJ - 0.1, { lHipF: 50, lKnee: 60, rHipF: 10, rKnee: 40, spineX: 16 }],
    [tJ, { x: 12.5, z: 1.2, lHipF: 10, lKnee: 20, lAnk: 30, rHipF: 80, rKnee: 90, air: 0.3, spineX: -8, headX: -35 }],
    [tC, { x: 12.4, z: 0.3, air: 0.82, lHipF: 30, lKnee: 60, rHipF: 50, rKnee: 70, spineX: -10, headX: -40 }],
    [tC + 0.35, { x: 12.3, z: -0.7, air: 0, lHipF: 30, rHipF: 30, lKnee: 50, rKnee: 50, spineX: 14, headX: 0 }],
    [tC + 1.0, Object.assign({ x: 12.2, z: -1.4, ry: 160 }, READY_R)], [tC + 1.5, { lShF: 60, lShA: 40, lEl: 30, headX: -15 }]]);
  const dk = [[0, Object.assign({ x: 12.0, z: 22, ry: 180 }, READY_R)]].concat(along([[12.0, 22], [11.9, 7], [11.8, 1.2]], 0, tJ, 8).slice(1), [[tJ + 0.05, { air: 0.25, lShF: 150, rShF: 160, lHipF: 30, lKnee: 60, spineX: 0 }], [tC, { air: 0.35 }], [tC + 0.3, { air: 0, z: 0.4, lShF: 30, rShF: 30, lHipF: 30, lKnee: 40 }], [5, Object.assign({}, READY_R)]]);
  return wrPlay(a, { tC, flight: 1.75, apex: 7.5, from: [0.5, 2.1, 38], high: true, dur: 5.0, keys, payoff: tC + 0.4, raise: tC + 1.3,
    runs: [{ from: 0.02, to: tJ - 0.15, period: 0.48, k: 1.0, phase: 0.25 }], orbit: { base: 110, sweep: 70 },
    extras: [Object.assign(OPP(185), { tag: 'cb', keys: dk, runs: [{ from: 0.02, to: tJ - 0.1, period: 0.48, k: 1.0 }] })] });
}
/* ball carrier plays: juke (Sanders), stiff-arm (Payton), lowered-shoulder power run (Brown) — ending in the end zone */
function runPlay(a, o) {
  const tE = o.tE, H = Hof(a);
  const keys = [[0, Object.assign({}, READY_R, { spineX: 18 })]].concat(along(o.path1, 0, tE - 0.05, 8), o.ev, along(o.path2, o.t2, o.tEnd, 8).slice(1),
    [[o.tEnd + 0.3, Object.assign({ ry: o.endRy || 180 }, READY_R)], [o.tEnd + 0.75, { rShF: 165, rShA: 10, rEl: 8, lShF: 40, lEl: 60, headX: -14, spineX: 2 }], [o.tEnd + 1.6, {}]]);
  return play(a, {
    venue: 'fldGridiron', dur: o.tEnd + 1.7, keys, payoff: o.payoff || o.tEnd - 0.3, R: FBR, orbit: o.orbit,
    runs: [{ from: 0.02, to: tE - 0.08, period: 0.5, k: 0.95, hold: true, phase: 0.25 }, { from: o.t2, to: o.tEnd, period: 0.48, k: 1.0, hold: true, phase: 0.5 }],
    extras: [Object.assign(OPP(188), { tag: 'lb', keys: o.dk, runs: o.dkRuns, mood: t => ({ focus: 0.8, sad: t > tE + 0.4 ? 0.6 : 0 }) })],
    update(t, env, S) {
      const B = env.props.ball; holdOval(env, B, t > o.tEnd + 0.55 ? 'two' : 'tuckR', 1);
      if (t > o.tEnd + 0.55) { const k = smooth(span(t, o.tEnd + 0.55, o.tEnd + 0.8)); env.reach('r', chestPt(env, -0.2, 0.75 + 0.2 * k, 0.15), [-0.8, 1.6, 0], { weight: k }); B.position.copy(env.handPos('r')); }
      if (o.update) o.update(t, env, S);
      return follow(env, B.position, 0, 6.0);
    }
  });
}
function sanders(a) {
  const tE = 1.05;
  return runPlay(a, { tE, t2: tE + 0.5, tEnd: 2.9, path1: [[2.2, 22], [1.6, 14.8]], path2: [[-0.9, 13.5], [-1.6, 7], [-2.0, -2.5]],
    ev: [[tE, { x: 1.55, z: 14.5, ry: 180, lHipF: 50, rHipF: 50, lKnee: 70, rKnee: 70, lHipA: 18, rHipA: 18, spineX: 22, spineZ: 10, air: 0, lShF: 30, lShA: 40, lEl: 60 }],
      [tE + 0.18, { x: 0.4, z: 14.15, air: 0.28, lHipA: 30, rHipA: 4, spineZ: -16, hipsZ: -8, lKnee: 40, rKnee: 60 }],
      [tE + 0.34, { x: -0.6, z: 13.85, air: 0, lHipF: 40, rHipF: 50, lKnee: 60, rKnee: 70, lHipA: 22, rHipA: 22, spineZ: -8, hipsZ: 0, ry: 195 }],
      [tE + 0.5, { x: -0.9, z: 13.5, spineZ: 0, lHipA: 7, rHipA: 7, ry: 185 }]],
    dk: [[0, Object.assign({ x: 1.0, z: 9.2, ry: 0 }, READY_R)], [0.9, { x: 1.4, z: 12.0 }], [tE + 0.1, { x: 1.6, z: 12.6, spineX: 30, lShF: 70, rShF: 70, lHipF: 40, lKnee: 50 }],
      [tE + 0.4, { x: 2.2, z: 13.2, ry: 30, hipsX: 55, seat: 1, seatY: 0.5, spineX: 10, lShF: 160, rShF: 160 }], [tE + 0.7, { hipsX: 86, seatY: 0.16, x: 2.4, z: 13.6 }], [5, {}]],
    dkRuns: [{ from: 0.05, to: 0.95, period: 0.55, k: 0.7 }] });
}
function payton(a) {
  const tE = 1.0;
  return runPlay(a, { tE, t2: tE + 0.25, tEnd: 2.7, path1: [[-2.6, 21], [-2.0, 13.6]], path2: [[-2.0, 12.6], [-2.2, 6], [-2.5, -2.2]],
    ev: [[tE - 0.2, { lShF: 30, lEl: 70 }], [tE, { x: -2.0, z: 13.0, ry: 180, lShF: 82, lShA: 18, lEl: 4, lWrF: -40, chestY: 14, spineX: 8 }], [tE + 0.3, { lShF: 40, lEl: 40, chestY: 0 }]],
    dk: [[0, Object.assign({ x: -3.6, z: 8.5, ry: 15 }, READY_R)], [0.85, { x: -2.9, z: 11.9, ry: 20 }], [tE - 0.05, { spineX: 38, lShF: 70, rShF: 70, lHipF: 40, rHipF: 30, lKnee: 60, rKnee: 50, headX: -20 }],
      [tE + 0.25, { x: -3.6, z: 11.4, ry: 40, hipsX: -40, seat: 0.6, seatY: 0.5, spineX: -10, lShF: 120, rShF: 90 }], [tE + 0.55, { x: -4.0, z: 11.0, hipsX: -84, seat: 1, seatY: 0.16, spineX: 0, lShF: 40, rShF: 40 }], [5, {}]],
    dkRuns: [{ from: 0.05, to: 0.85, period: 0.55, k: 0.7 }],
    update(t, env, S) { const w = win(t, tE - 0.18, tE - 0.03, tE + 0.1, tE + 0.28); if (w > 0) { const d = S.x[0]; env.reach('l', d.bones.chest.localToWorld(V(0, 0.15, 0.12)), [0.6, 1.2, 0.2], { weight: w }); } } });
}
function jimBrown(a) {
  const tE = 1.0;
  return runPlay(a, { tE, t2: tE + 0.35, tEnd: 2.8, path1: [[0.6, 21], [0.4, 13.8]], path2: [[0.3, 12.6], [0.1, 6], [-0.2, -2.3]],
    ev: [[tE - 0.15, { spineX: 30, chestY: 0 }], [tE, { x: 0.4, z: 13.4, ry: 180, spineX: 38, chestY: -16, lShF: 40, lShA: 30, lEl: 80, headX: -20 }], [tE + 0.35, { x: 0.3, z: 12.6, spineX: 24, chestY: 0 }]],
    dk: [[0, Object.assign({ x: 0.2, z: 9.2, ry: 0 }, READY_R)], [0.85, { x: 0.3, z: 12.3 }], [tE - 0.05, { spineX: 38, lShF: 70, rShF: 70, lHipF: 40, rHipF: 30, lKnee: 60, rKnee: 50, headX: -20 }],
      [tE + 0.25, { x: 1.0, z: 12.6, ry: 60, hipsX: -40, seat: 0.6, seatY: 0.55, spineX: -10, lShF: 140, rShF: 60 }], [tE + 0.55, { x: 1.5, z: 12.9, ry: 80, hipsX: -84, seat: 1, seatY: 0.16, spineX: 0, lShF: 60, rShF: 30 }], [5, {}]],
    dkRuns: [{ from: 0.05, to: 0.85, period: 0.55, k: 0.7 }] });
}
/* edge rush and strip-sack of the quarterback */
function sack(a) {
  const L = 14, tSnap = 0.5, tHit = 1.95;
  const keys = [[0, Object.assign({ x: -4.4, z: L - 1.1, ry: 0 }, { lHipF: 40, rHipF: 20, lKnee: 60, rKnee: 40, spineX: 36, lShF: 40, rShF: 10, lEl: 60, rEl: 40, headX: -25 })],
    [tSnap + 0.15, { spineX: 30 }]].concat(along([[-4.4, L - 1.1], [-4.8, L + 1.8], [-3.0, L + 4.6], [-0.8, L + 6.0]], tSnap + 0.1, tHit - 0.05, 8).slice(1), [
    [tHit - 0.2, { lShF: 60, rShF: 110, rShA: 20, rEl: 30 }], [tHit, { x: -0.6, z: L + 6.1, spineX: 34, rShF: 40, rShA: 30, rEl: 10, lShF: 90, lShA: 40, lEl: 70 }],
    [tHit + 0.3, { x: -0.2, z: L + 6.6, hipsX: 50, seat: 0.9, seatY: 0.55, spineX: 14, lShF: 100, rShF: 100, lHipF: 10, rHipF: -10, lKnee: 40, rKnee: 40 }],
    [tHit + 0.6, { x: 0.1, z: L + 7.0, hipsX: 80, seat: 1, seatY: 0.42, spineX: 4 }],
    [tHit + 1.1, { hipsX: 30, seatY: 0.6, spineX: 30, lHipF: 80, rHipF: 50, lKnee: 110, rKnee: 90, lShF: 40, rShF: 40 }],
    [tHit + 1.5, Object.assign({ hipsX: 0, seat: 0, ry: 160 }, READY_R)], [tHit + 1.9, { rShF: 70, rShA: 70, rEl: 100, lShF: 70, lShA: 70, lEl: 100, spineX: -4, chestX: -6, headX: -20 }], [tHit + 2.4, {}]]);
  const qb = [[0, Object.assign({ x: 0, z: L + 0.95, ry: 180 }, { lHipF: 38, rHipF: 38, lKnee: 48, rKnee: 48, spineX: 34, lShF: 60, rShF: 60 })], [tSnap + 0.2, { ry: 140, spineX: 12, lHipF: 20, rHipF: 20, lKnee: 30, rKnee: 30 }],
    [tSnap + 1.1, { x: 0.1, z: L + 6.6, ry: 150 }], [tHit - 0.2, Object.assign({ ry: 170, headY: 40 }, READY_R, { lShF: 40, rShF: 40 })],
    [tHit + 0.25, { x: 0.4, z: L + 7.3, hipsX: -45, seat: 0.8, seatY: 0.55, spineX: -10, lShF: 90, rShF: 120, lHipF: 60, rHipF: 50, lKnee: 30, rKnee: 30 }],
    [tHit + 0.55, { x: 0.6, z: L + 7.7, hipsX: -84, seat: 1, seatY: 0.15, spineX: 0, lShF: 40, rShF: 30, lHipF: 40, rHipF: 30, lKnee: 40, rKnee: 30 }], [6, {}]];
  let loose = null;
  return play(a, {
    venue: 'fldGridiron', dur: tHit + 2.5, keys, payoff: tHit + 0.1, R: FBR, orbit: { base: 50, sweep: 80 },
    runs: [{ from: tSnap + 0.1, to: tHit - 0.1, period: 0.46, k: 1.0, phase: 0 }],
    extras: [Object.assign(OPP(193), { tag: 'qb', keys: qb, runs: [{ from: tSnap + 0.25, to: tSnap + 1.1, period: 0.45, k: 0.55, hold: true }], mood: t => ({ focus: 0.7, sad: t > tHit + 0.3 ? 0.7 : 0 }) }),
      Object.assign(OPP(188, { build: 'stocky' }), { tag: 'c', keys: centerKeys(L, tSnap) })],
    setup(env, S) {   // where the ball is knocked loose (deterministic: QB posed at the hit)
      const q = S.x[0]; poseX(env, q, S.xpose(tHit + 0.02, 0)); loose = q.bones.chest.localToWorld(V((env.mirror ? 0.12 : -0.12) * q.p.H / 1.85, 0.12, 0.3));
    },
    update(t, env, S) {
      const B = env.props.ball, q = S.x[0];
      if (t < tSnap) { B.position.copy(mw(env, V(0, FBR + 0.01, L - 0.25))); aimBall(B, V(0, 0.15, 1)); }
      else if (t < tHit + 0.02) {
        const c = q.bones.chest.localToWorld(V((env.mirror ? 0.12 : -0.12) * q.p.H / 1.85, 0.12, 0.3)); B.position.copy(t < tSnap + 0.15 ? mw(env, V(0, FBR + 0.01, L - 0.25)).lerp(c, (t - tSnap) / 0.15) : c); aimBall(B, V(0.2, 0.6, 1));
        reachX(env, q, 'r', c.clone().add(V(0, 0.02, 0.05)), q.bones.chest.localToWorld(V(-0.6, -0.2, -0.3)), { weight: 1 }); reachX(env, q, 'l', c.clone().add(V(0.12, 0, 0)), q.bones.chest.localToWorld(V(0.6, -0.2, -0.3)), { weight: 1 });
      } else {
        const tt = t - tHit - 0.02, p0 = loose, end = mw(env, V(-1.8, FBR, L + 4.2));
        const u = clamp(tt / 1.4, 0, 1); B.position.lerpVectors(p0, end, easeOut(u)); B.position.y = Math.max(FBR, lerp(p0.y, FBR, Math.min(1, u * 3)) + Math.abs(Math.sin(u * Math.PI * 3)) * 0.5 * (1 - u)); aimBall(B, V(Math.sin(tt * 9), 0.4, Math.cos(tt * 9)));
      }
      const w = win(t, tHit - 0.25, tHit - 0.05, tHit + 0.05, tHit + 0.2); if (w > 0) env.reach('r', q.bones.chest.localToWorld(V(-0.1, 0.1, 0.35)), [-0.7, 1.4, 0.2], { weight: w });
      return follow(env, B.position, 0.25, 6.2);
    }
  });
}

/* flag football: elusive scramble (spin away from the flag-puller) and throw on the run; pump fake and throw */
function flores(a) {
  const L = 12, tSnap = 0.6, tSpin = 1.45, tRel = 2.55, flight = 1.25, tC = tRel + flight;
  const keys = [[tSnap + 0.4, { ry: 180, spineX: 12, x: 0, z: L + 4.6 }], [tSpin - 0.3, { x: -0.2, z: L + 5.9, ry: 175 }], [tSpin, { x: 0.3, z: L + 6.1, ry: 175 }],
    [tSpin + 0.45, { x: 1.5, z: L + 6.0, ry: 175 + 360 }]].concat(along([[1.5, L + 6.0], [3.5, L + 5.6], [5.4, L + 4.6]], tSpin + 0.45, tRel + 0.1, 5, 0).slice(1).map(([t, k]) => [t, Object.assign(k, { ry: k.ry + 360 })]), [
    [tRel - 0.15, { hipsY: -10, chestY: -20, spineX: 10, headY: 50, lShF: 60, lShA: 30, lEl: 30 }],
    [tRel, { hipsY: 10, chestY: 20, spineX: 16, headY: 10, lShF: 20, lShA: 30, lEl: 60 }],
    [tRel + 0.45, Object.assign({ x: 6.1, z: L + 4.3, ry: 520, hipsY: 0, chestY: 0, headY: 0 }, READY_R)], [tC + 0.6, { lShF: 172, rShF: 172, lShA: 8, rShA: 8, lEl: 6, rEl: 6, spineX: -4, headX: -16 }]]);
  const rush = [[0, Object.assign({ x: -1.6, z: L - 6.3, ry: 0 }, READY_R)], [tSpin - 0.1, { x: -1.0, z: L + 4.7, ry: 10 }], [tSpin + 0.05, { x: -0.75, z: L + 5.0, ry: 25, spineX: 42, rShF: 75, rShA: 20, rEl: 5, lHipF: 55, lKnee: 60 }],
    [tSpin + 0.5, { x: -0.6, z: L + 5.3, ry: 35, spineX: 22, rShF: 30, lHipF: 20, lKnee: 30 }], [5, { x: -0.5, z: L + 5.6, ry: 60 }]];
  return qbPlay(a, { L, tSnap, tRel, flight, apex: 2.8, dur: tC + 1.5, keys, shotgun: true, flag: true, runs: [{ from: tSnap + 0.4, to: tRel + 0.3, period: 0.45, k: 0.75, hold: true }],
    post(q, t) { if (t > tSpin - 0.05 && t < tSpin + 0.5) { q.spineX = lerp(q.spineX, 4, win(t, tSpin - 0.05, tSpin + 0.05, tSpin + 0.35, tSpin + 0.5)); } },
    rusher: { keys: rush, runs: [{ from: tSnap, to: tSpin - 0.05, period: 0.5, k: 0.9 }] },
    receiver: { h: 172, keys: wrKeys([[6.5, L + 1], [6.8, 2], [4.0, -5.0]], 0.6, tC - 0.2, tC, { ry: -40 }), runs: [{ from: 0.6, to: tC - 0.25, period: 0.5, k: 0.9 }] } });
}
function doucette(a) {
  const L = 12, tSnap = 0.6, tPump = 1.9, tRel = 2.65, flight = 1.35, tC = tRel + flight;
  const keys = [[tSnap + 0.45, { ry: 180, spineX: 12, x: 0, z: L + 4.6 }], [tSnap + 0.95, { x: 0.05, z: L + 6.0, ry: 175 }],
    [tPump - 0.2, { ry: 125, chestY: -15, headY: 50, x: 0.05, z: L + 5.9 }], [tPump, { ry: 125, chestY: 10, headY: 45, spineX: 16, lHipF: 30, lKnee: 24 }], [tPump + 0.25, { ry: 190, chestY: -20, headY: 60, spineX: 8, lHipF: 14, lKnee: 20 }],
    [tRel - 0.12, { ry: 215, hipsY: -15, chestY: -25, lHipF: 30, lKnee: 20, rHipF: -5, rKnee: 30, spineX: 4, headY: 70, lShF: 70, lShA: 30, lEl: 20 }],
    [tRel, { x: -0.1, z: L + 5.5, ry: 230, hipsY: 25, chestY: 25, spineX: 16, lHipF: 30, lKnee: 24, rHipF: -14, rKnee: 30, rAnk: 30, headY: 20, lShF: 20, lShA: 30, lEl: 60 }],
    [tRel + 0.35, { hipsY: 10, chestY: 10, spineX: 20, rHipF: 30, rKnee: 50, lShF: 10, lEl: 40, headY: 10 }], [tC + 0.15, Object.assign({}, READY_R, { ry: 210, hipsY: 0, chestY: 0, headY: 0 })],
    [tC + 0.6, { lShF: 172, rShF: 172, lShA: 8, rShA: 8, lEl: 6, rEl: 6, spineX: -4, headX: -16 }]];
  return qbPlay(a, { L, tSnap, tRel, flight, apex: 3.6, dur: tC + 1.5, keys, shotgun: true, flag: true, pump: tPump, runs: [{ from: tSnap + 0.4, to: tSnap + 1.0, period: 0.45, k: 0.5, hold: true }],
    receiver: { h: 180, keys: wrKeys([[-7.5, L + 1], [-7.3, 4], [-7.0, -4.6]], 0.6, tC - 0.2, tC, { ry: 30 }), runs: [{ from: 0.6, to: tC - 0.25, period: 0.5, k: 0.95 }] } });
}
/* defensive flag pull: chase the ball carrier and rip the flag off the hip */
function flagPull(a) {
  const tP = 1.55;
  const keys = [[0, Object.assign({}, READY_R, { spineX: 20 })]].concat(along([[3.2, 13.5], [1.2, 16.5], [-1.6, 19.0]], 0, tP - 0.05, 6), [
    [tP - 0.15, { spineX: 30, rShF: 40, rShA: 30 }], [tP, { x: -1.75, z: 19.2, spineX: 34, lHipF: 50, lKnee: 60, rHipF: -10, rKnee: 30 }],
    [tP + 0.3, { x: -2.0, z: 19.5, spineX: 16, lHipF: 20, lKnee: 24, rHipF: 10, rKnee: 20 }], [tP + 0.75, Object.assign({ x: -2.1, z: 19.6, ry: 200 }, READY_R, { spineX: 2, headX: -10 })], [tP + 1.6, {}]]);
  const car = [[0, Object.assign({ x: -0.6, z: 30, ry: 175 }, READY_R)], [tP, { x: -1.4, z: 19.9, ry: 182 }], [tP + 0.35, { x: -1.5, z: 18.6, ry: 185 }], [tP + 0.9, Object.assign({ x: -1.55, z: 18.2, ry: 180 }, READY_R, { spineX: 6, headX: 10 })], [4, {}]];
  let flag = null, prop = null;
  return play(a, {
    venue: 'fldFlag', dur: tP + 1.7, keys, payoff: tP + 0.05, R: FBR, orbit: { base: 60, sweep: 80 },
    runs: [{ from: 0.02, to: tP - 0.1, period: 0.46, k: 0.95 }],
    extras: [Object.assign(OPP(180), { tag: 'bc', keys: car, runs: [{ from: 0.02, to: tP + 0.35, period: 0.48, k: 0.95, hold: true }], mood: t => ({ focus: 0.7, sad: t > tP + 0.2 ? 0.7 : 0 }) })],
    setup(env, S) {
      const x = S.x[0]; const side = env.mirror ? -1 : 1;
      x.bones.hips.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === 'ffd23d' && Math.sign(o.position.x) === side) flag = o; });
      prop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.06), std('#ffd23d')); prop.position.set(0, -0.12, 0.03); env.addProp(prop, env.rig.bones[env.side('r') + 'Hand']);
    },
    update(t, env, S) {
      const x = S.x[0], B = env.props.ball, pulled = t > tP;
      if (flag) flag.visible = !pulled; prop.visible = pulled;
      const c = x.bones.chest.localToWorld(V((env.mirror ? 0.15 : -0.15) * x.p.H / 1.85, 0, 0.15 * x.p.H / 1.85)); B.position.copy(c); aimBall(B, x.bones.chest.localToWorld(V(0, 0.5, 1)).sub(x.bones.chest.getWorldPosition(V())));
      reachX(env, x, 'r', c.clone().add(V(0, 0.08, 0)), x.bones.chest.localToWorld(V(-0.6, 0, -0.4)), { weight: 1 });
      const hip = x.bones.hips.localToWorld(V((env.mirror ? -1 : 1) * 0.11 * x.p.H / 1.85, -0.12, 0));
      const w = smooth(span(t, tP - 0.35, tP - 0.05)), up = smooth(span(t, tP + 0.25, tP + 0.7));
      if (t < tP + 0.25) env.reach('r', hip, [-0.6, 0.6, 0.2], { weight: w * (1 - smooth(span(t, tP, tP + 0.25))) });
      if (up > 0) env.reach('r', chestPt(env, -0.2, 0.95, 0.15), [-0.8, 1.7, 0], { weight: up });
      if (flag) { const fm = flag.material; void fm; }
      return follow(env, c, 0.3, 5.6);
    }
  });
}

/* ================================================================== field hockey (all sticks are right-handed: no mirroring) */
const HBR = 0.04;
const STANCE_H = { hipsX: 8, lHipF: 56, rHipF: 50, lKnee: 66, rKnee: 60, lAnk: -18, rAnk: -18, lHipA: 10, rHipA: 10, spineX: 34, chestX: 10, headX: -34, neckX: -10, lShF: 30, rShF: 30, lEl: 40, rEl: 40 };
const _qa = new THREE.Quaternion(), _pa = new THREE.Vector3();
/* put the stick so that the ball centre `Bw` touches the flat face; shaft along D (butt → head); toe toward zHint */
function stickAt(stick, Bw, D, zHint) { orient(stick, V(), D, zHint); stick.position.copy(Bw).sub(HS_BALL.clone().applyQuaternion(stick.quaternion)); stick.updateMatrixWorld(true); return stick; }
/* blend two stick placements (k: 0 → first, 1 → second); each is { p, q } */
function stickBlend(stick, A0, A1, k) { stick.position.copy(A0.p).lerp(A1.p, k); stick.quaternion.copy(A0.q).slerp(A1.q, k); stick.updateMatrixWorld(true); }
const snap = stick => ({ p: stick.position.clone(), q: stick.quaternion.clone() });
function gripHS(env, stick, gl = 0.05, gr = 0.34, wl = 1, wr = 1, poleL = [0.6, 1.1, 0.1], poleR = [-0.7, 0.7, -0.1]) {
  if (wl > 0) env.reach('l', stick.localToWorld(V(0, gl, 0)), poleL, { weight: wl });
  if (wr > 0) env.reach('r', stick.localToWorld(V(0, gr, 0)), poleR, { weight: wr });
}
/* a hockey play: body keys + runs, a ball function and a stick function supplied by the move */
function hockeyPlay(a, cfg) {
  let stick = null;
  return play(a, {
    venue: 'fldHockey', dur: cfg.dur, keys: cfg.keys, runs: cfg.runs, post: cfg.post, payoff: cfg.payoff, R: HBR, extras: cfg.extras, orbit: cfg.orbit, mirror: false, viewFn: cfg.viewFn,
    setup(env, S) { stick = env.addProp(hockeyStick(cfg.accent)); stick.scale.setScalar(Math.max(0.94, Math.min(1.06, env.s))); S.stick = stick; if (cfg.setup) cfg.setup(env, S); },
    update(t, env, S) {
      const B = env.props.ball, b = cfg.ball(t, env, S); B.position.copy(b);
      cfg.stick(t, env, S, stick, b);
      if (t > (cfg.tGoal || 99) - 0.05 && env.venue && env.venue.goal) env.venue.goal.push(b, S.goalDir || V(0, 0, -1), HBR, 0.25, 0.4);
      if (cfg.update) cfg.update(t, env, S);
      return cfg.cam ? cfg.cam(t, env, S, b) : follow(env, b, 0.3 * win(t, cfg.tShot || 99, (cfg.tShot || 99) + 0.3, (cfg.tGoal || 99) + 0.8, (cfg.tGoal || 99) + 1.5), 5.2);
    }
  });
}
/* hockey ball path segments (world) */
function hShot(P, T, u, apex, out) { return arc(P, T, apex, clamp(u, 0, 1), out); }
function intoGoal(T, dir, tau, out) { out.copy(T).addScaledVector(dir, 1.1 * (1 - Math.exp(-7 * tau))); out.y = Math.max(HBR, T.y - 4.9 * tau * tau); return out; }

/* penalty-corner drag flick: injection, run-in, long low drag, sling into the top corner */
function dragFlick(a, o = {}) {
  const P0 = [0.45, 14.3], tIn = 0.2, tStop = 1.05, tD0 = 1.42, tR = 1.78, flight = 0.48, T = o.target || [-1.25, 1.55, 0], tGoal = tR + flight;
  const keys = [[0, Object.assign({ x: 1.7, z: 20.8, ry: 175 }, STANCE_H)], [tIn, {}], [tD0 - 0.12, { x: 0.95, z: 15.6, ry: 178 }],
    [tD0, { x: 0.85, z: 15.25, ry: 192, lHipF: 66, lKnee: 92, lAnk: -26, rHipF: -30, rKnee: 22, rAnk: 30, lHipA: 14, rHipA: 18, hipsY: -36, chestY: -28, spineX: 44, chestX: 10, spineZ: 8, headX: -18, headY: -10 }],
    [tR - 0.15, { x: 0.65, z: 14.75, ry: 186, lHipF: 74, lKnee: 100, lAnk: -26, rHipF: -40, rKnee: 16, hipsY: -10, chestY: -6, spineX: 46, spineZ: 4 }],
    [tR, { x: 0.45, z: 14.25, ry: 178, lHipF: 60, lKnee: 80, rHipF: -32, rKnee: 24, hipsY: 18, chestY: 22, spineX: 36, spineZ: -6, headX: -30, headY: 10 }],
    [tR + 0.35, { x: 0.35, z: 13.9, lHipF: 40, lKnee: 50, rHipF: 10, rKnee: 40, rAnk: 10, hipsY: 14, chestY: 18, spineX: 18, spineZ: -4, headX: -14 }],
    [tGoal + 0.4, Object.assign({ x: 0.3, z: 13.7, ry: 178, hipsY: 0, chestY: 0, spineZ: 0, headY: 0 }, STANCE_H, { spineX: 10, lKnee: 20, rKnee: 20, lHipF: 14, rHipF: 14, lAnk: -6, rAnk: -6 })],
    [tGoal + 1.0, { spineX: 0, headX: -14 }]];
  /* ball path in the athlete frame during the drag: from behind the right foot to release in front of the left foot */
  const dragL = vecTrack([[tD0, [-0.55, 0.04, -0.15]], [tR - 0.2, [-0.25, 0.04, 0.45]], [tR, [0.15, 0.3, 1.05]]]);
  const knobL = vecTrack([[0, [-0.05, 1.0, 0.3]], [tD0 - 0.3, [-0.1, 0.95, 0.25]], [tD0, [0.0, 0.62, 0.15]], [tR - 0.2, [0.12, 0.7, 0.45]], [tR, [0.3, 1.0, 0.75]], [tR + 0.25, [0.4, 1.55, 0.6]], [tGoal + 0.4, [0.1, 1.05, 0.35]]]);
  let rel = null, off = [0, 0], dirG = null;
  return hockeyPlay(a, {
    dur: tGoal + 1.6, keys, payoff: tGoal, tShot: tR, tGoal, orbit: { base: 160, sweep: 60 },
    runs: [{ from: tIn, to: tD0 - 0.15, period: 0.5, k: 0.75, hold: true }],
    post(q) { q.x += off[0]; q.z += off[1]; },
    setup(env, S) {
      env.pose(S.poseAt(tD0)); const p = env.ws([dragL(tD0)[0], 0, dragL(tD0)[2]]); off = [P0[0] - p.x, P0[1] - p.z];
      env.pose(S.poseAt(tR)); rel = env.ws(dragL(tR)); dirG = V(T[0], T[1], T[2]).sub(rel).setY(0).normalize(); S.goalDir = dirG;
    },
    ball(t, env, S) {
      if (t < tIn) return V(11.83, HBR, 0.4);
      if (t < tStop) return V(11.83, HBR, 0.4).lerp(V(P0[0], HBR, P0[1]), easeOut((t - tIn) / (tStop - tIn)) * 0.15 + 0.85 * (t - tIn) / (tStop - tIn));
      if (t < tD0) return V(P0[0], HBR, P0[1]);
      if (t < tR) { const p = env.ws(dragL(t)); p.y = Math.max(HBR, p.y); return p; }
      if (t < tGoal) return hShot(rel, V(T[0], T[1], T[2]), (t - tR) / flight, 0.15, V());
      return intoGoal(V(T[0], T[1], T[2]), dirG, t - tGoal, V());
    },
    stick(t, env, S, st, b) {
      const knob = env.ws(knobL(t));
      if (t < tD0 - 0.25) { const bw = env.ws([-0.35, HBR, 0.75]); stickAt(st, bw, bw.clone().sub(knob), env.dir([0, 1, 0])); gripHS(env, st); return; }
      const head = t < tR ? b : env.ws(lerpArr(dragL(tR), [0.5, 1.4, 1.5], smooth(span(t, tR, tR + 0.3)))), D = head.clone().sub(knob);
      const A1 = snap(stickAt(st, head, D, env.dir([-0.7, 1, 0.3])));
      if (t < tD0) { const bw = env.ws([-0.35, HBR, 0.75]); const A0 = snap(stickAt(st, bw, bw.clone().sub(env.ws(knobL(tD0 - 0.25))), env.dir([0, 1, 0]))); stickBlend(st, A0, A1, smooth(span(t, tD0 - 0.25, tD0))); }
      gripHS(env, st, 0.05, 0.42, 1, 1, [0.7, 1.2, 0.0], [-0.7, 0.5, -0.2]);
    }
  });
}
const lerpArr = (p, q, k) => p.map((v, i) => lerp(v, q[i], k));
const lerpAng = (a, b, k) => { let d = ((b - a) % 360 + 540) % 360 - 180; return a + d * k; };

/* dribble with the ball glued to the stick (forehand / reverse taps), optional 360° spin or wide drag, then a shot */
const SWING = {
  hit: { toe: 0, gr: 0.12, ball: [-0.22, 0.75], head: [[-0.32, [-0.78, 1.35, -0.3]], [-0.08, [-0.62, 0.35, 0.3]], [0, null], [0.15, [0.35, 0.45, 1.2]], [0.45, [0.8, 1.35, 0.55]]],
    knob: [[-0.32, [-0.25, 1.18, 0.05]], [-0.08, [-0.15, 0.88, 0.3]], [0, [0.0, 0.78, 0.42]], [0.15, [0.2, 0.92, 0.5]], [0.45, [0.3, 1.18, 0.3]]] },
  push: { toe: 0, gr: 0.38, ball: [-0.12, 0.72], head: [[-0.3, null], [0, null], [0.2, [0.25, 0.3, 1.3]], [0.45, [0.35, 0.9, 1.1]]],
    knob: [[-0.3, [-0.12, 0.95, 0.2]], [0, [-0.05, 0.85, 0.3]], [0.2, [0.1, 0.95, 0.5]], [0.45, [0.15, 1.1, 0.45]]] },
  reverse: { toe: Math.PI, gr: 0.16, ball: [0.42, 0.75], head: [[-0.36, [1.15, 0.7, -0.25]], [-0.1, [0.9, 0.16, 0.35]], [0, null], [0.15, [-0.15, 0.2, 1.25]], [0.45, [-0.75, 0.75, 0.95]]],
    knob: [[-0.36, [0.3, 1.02, 0.2]], [-0.1, [0.18, 0.86, 0.32]], [0, [0.06, 0.8, 0.42]], [0.15, [-0.1, 0.88, 0.5]], [0.45, [-0.25, 1.05, 0.35]]] }
};
const SWING_BODY = {
  hit: tc => [[tc - 0.32, { hipsY: -22, chestY: -34, spineX: 26, lHipF: 30, lKnee: 34, rHipF: 20, rKnee: 40, headY: 18 }], [tc, { hipsY: 4, chestY: 6, spineX: 34, lHipF: 40, lKnee: 46, rHipF: 6, rKnee: 36, rAnk: 20, headY: 6 }], [tc + 0.4, { hipsY: 18, chestY: 26, spineX: 18, lKnee: 30, rHipF: 20, rKnee: 30, headY: 0 }]],
  push: tc => [[tc - 0.3, { hipsY: -10, chestY: -14, spineX: 34, lHipF: 44, lKnee: 60, rHipF: 10, rKnee: 40 }], [tc + 0.2, { hipsY: 10, chestY: 16, spineX: 30, lHipF: 50, lKnee: 64, rHipF: -10, rKnee: 30 }], [tc + 0.5, { hipsY: 4, chestY: 6, spineX: 20 }]],
  reverse: tc => [[tc - 0.36, { hipsY: 24, chestY: 40, spineX: 34, spineZ: -10, lHipF: 40, lKnee: 60, rHipF: 50, rKnee: 66, headY: -14 }], [tc, { hipsY: 4, chestY: 4, spineX: 40, spineZ: -6, lHipF: 50, lKnee: 66, rHipF: 46, rKnee: 60 }], [tc + 0.4, { hipsY: -20, chestY: -30, spineX: 22, spineZ: 0 }]]
};
function hockeyRun(a, o) {
  const tc = o.tc, kind = o.shot || 'hit', sw = SWING[kind], T = o.target, flight = o.flight || 0.42, tGoal = tc + flight;
  const sx = o.spin ? o.spin : null;
  const keys = [[0, Object.assign({}, STANCE_H)]].concat(along(o.path, 0, tc - 0.25, 10), SWING_BODY[kind](tc),
    [[tGoal + 0.5, Object.assign({}, STANCE_H, { hipsY: 0, chestY: 0, headY: 0, spineX: 12, lKnee: 20, rKnee: 20, lHipF: 14, rHipF: 14, lAnk: -6, rAnk: -6 })], [tGoal + 1.0, { lShF: 150, lShA: 30, lEl: 20, spineX: 2, headX: -14 }]], o.keys || []);
  const latF = t => o.lat ? o.lat(t) : 0.24 * Math.sin(t * Math.PI * 2 * (o.freq || 1.4));
  const headTr = vecTrack(sw.head.filter(h => h[1]).map(([dt, v]) => [tc + dt, v])), knobTr = vecTrack(sw.knob.map(([dt, v]) => [tc + dt, v]));
  const tSet = tc - 0.42;
  let shotP = null, dirG = null, off = null;
  const ballL = t => { const lead = o.lead || 0.88; return [-0.1 + latF(t), HBR, lead]; };
  return hockeyPlay(a, {
    dur: tGoal + 1.6, keys, payoff: tGoal, tShot: tc, tGoal, orbit: o.orbit || { base: 165, sweep: 70 }, extras: o.extras, accent: o.accent,
    runs: [{ from: 0.02, to: tc - 0.32, period: o.period || 0.5, k: o.k || 0.85, hold: true, phase: 0.25 }],
    post: o.post,
    setup(env, S) {
      env.pose(S.poseAt(tc)); shotP = env.ws([sw.ball[0], HBR, sw.ball[1]]); shotP.y = HBR;
      dirG = V(T[0], 0, T[2]).sub(shotP).setY(0).normalize(); S.goalDir = dirG;
      if (o.setup) o.setup(env, S);
    },
    ball(t, env, S) {
      if (t < tSet) return env.ws(ballL(t));
      if (t < tc) { env.pose(S.poseAt(tSet)); const p0 = env.ws(ballL(tSet)); env.pose(S.poseAt(t)); return p0.lerp(shotP, easeOut((t - tSet) / (tc - tSet))); }
      if (t < tGoal) return hShot(shotP, V(T[0], T[1], T[2]), (t - tc) / flight, o.apex || 0.1, V());
      return intoGoal(V(T[0], T[1], T[2]), dirG, t - tGoal, V());
    },
    stick(t, env, S, st, b) {
      const right = env.dir([-1, 0, 0]), up = V(0, 1, 0);
      const dribble = () => {
        const dl = latF(t + 0.02) - latF(t - 0.02), phi = o.forehandOnly ? 0 : (dl >= 0 ? 0 : Math.PI) * 0 + Math.PI * (1 - smooth(clamp(0.5 + dl * 40, 0, 1)));
        const z = up.clone().multiplyScalar(Math.cos(phi)).add(right.clone().multiplyScalar(-Math.sin(phi)));
        const hands = env.ws([-0.12, 0.86, 0.3]);
        return snap(stickAt(st, b, b.clone().sub(hands), z));
      };
      const swing = () => {
        const h = t >= tc - 1e-3 && t <= tc + 1e-3 ? b : (t < tc && sw.head[1][1] === null ? b : env.ws(headTr(Math.max(t, tc - 0.32)))), k = env.ws(knobTr(Math.max(t, tc - 0.32)));
        const head = t < tc ? (sw.head[0][1] ? env.ws(headTr(Math.max(t, tc - 0.32))).lerp(b, smooth(span(t, tc - 0.08, tc))) : b) : (t < tc + 0.02 ? b : env.ws(headTr(t)));
        void h;
        const z = sw.toe ? up.clone().negate().add(right.clone().multiplyScalar(0.3)) : up.clone().add(right.clone().multiplyScalar(0.2));
        return snap(stickAt(st, head, head.clone().sub(k), z));
      };
      if (t < tc - 0.45) { const A = dribble(); gripHS(env, st); void A; }
      else { const A0 = t < tc - 0.3 ? dribble() : null, A1 = swing(); if (A0) stickBlend(st, A0, A1, smooth(span(t, tc - 0.45, tc - 0.3))); gripHS(env, st, 0.05, lerp(0.34, sw.gr, smooth(span(t, tc - 0.45, tc - 0.3)))); }
    }
  });
}
function chand(a) {
  return hockeyRun(a, { path: [[-3.6, 31], [-2.2, 24.5], [-0.3, 19.6], [-1.9, 15.6], [-1.1, 12.4]], tc: 2.75, shot: 'push', target: [1.15, 0.25, 0], flight: 0.5, freq: 1.6,
    extras: undefined, setup(env) { mannequin(env, -3.0, 24.2, 0); mannequin(env, 0.6, 19.4, 0); mannequin(env, -2.9, 15.4, 0); } });
}
function reverseShot(a, o = {}) {
  return hockeyRun(a, { path: o.path || [[7.2, 21.5], [4.6, 17.2], [1.8, 13.6]], tc: 2.25, shot: 'reverse', target: o.target || [1.25, 0.35, 0], flight: 0.42, freq: 1.4,
    post(q, t) { if (t > 1.6) q.ry = lerpAng(q.ry, 200, smooth(span(t, 1.6, 1.9))); } });
}
function aymarSpin(a) {
  const tS = 1.15, tE = 1.75;
  return hockeyRun(a, { path: [[-2.5, 27.5], [-1.4, 21.6], [-0.4, 18.6], [-0.9, 15.4], [-0.6, 12.6]], tc: 2.75, shot: 'push', target: [-1.25, 0.25, 0], flight: 0.5, freq: 1.3,
    post(q, t) { const k = smooth(span(t, tS, tE)); q.ry += 360 * k; if (t > tS && t < tE) { q.spineX = lerp(q.spineX, 22, win(t, tS, tS + 0.1, tE - 0.1, tE)); } },
    lat: t => t > tS - 0.2 && t < tE + 0.2 ? 0.05 : 0.22 * Math.sin(t * Math.PI * 2 * 1.3), setup(env) { mannequin(env, 0.35, 18.0, 0); } });
}
function shootout(a) {
  return hockeyRun(a, { path: [[1.2, 22.9], [0.6, 12.5], [-0.8, 7.2], [-2.6, 4.6]], tc: 2.45, shot: 'push', target: [-0.3, 0.2, 0], flight: 0.35, freq: 1.2,
    lat: t => t < 1.4 ? 0.18 * Math.sin(t * Math.PI * 2 * 1.2) : 0.18 * Math.sin(1.4 * Math.PI * 2 * 1.2) + 0.25 * smooth(span(t, 1.4, 1.8)),
    setup(env) { mannequin(env, 0.6, 2.6, 180, '#2b2f33'); } });
}
function vanDoren(a) {
  return hockeyRun(a, { path: [[8.5, 42], [5.5, 28], [2.4, 16.2]], tc: 2.55, shot: 'hit', target: [-1.2, 0.4, 0], flight: 0.42, freq: 0.9, period: 0.46, k: 1.0, lead: 0.95, forehandOnly: true,
    lat: t => 0.05 * Math.sin(t * 6) });
}

/* goalkeeper kit for field hockey: helmet, padded smock, leg guards, kickers, hand protectors */
function gkKit(env, color = '#ffd23d', pad = '#ff7a1a') {
  const s = env.s, B = env.rig.bones, pm = std(pad, { roughness: 0.55 }), sm = std(color, { roughness: 0.8 }), dk = std('#22272b', { roughness: 0.6 });
  env.rig.setHeadwear('lacrosseHelmet');
  const smock = new THREE.Mesh(new THREE.SphereGeometry(0.19 * s, 18, 12), sm); smock.scale.set(1.3, 1.05, 0.95); smock.position.set(0, 0.11 * s, 0); env.addProp(smock, B.chest);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 16, 10), sm); belly.scale.set(1.25, 0.9, 0.95); belly.position.set(0, 0.06 * s, 0); env.addProp(belly, B.spine);
  for (const sd of ['l', 'r']) {
    const ua = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * s, 0.17 * s, 4, 10), sm); ua.position.set(0, -0.12 * s, 0); env.addProp(ua, B[sd + 'UpperArm']);
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.6 * s, 0.13 * s), pm); g.position.set(0, -0.27 * s, 0.07 * s); env.addProp(g, B[sd + 'Shin']);
    const th = new THREE.Mesh(new THREE.BoxGeometry(0.19 * s, 0.3 * s, 0.11 * s), pm); th.position.set(0, -0.25 * s, 0.07 * s); env.addProp(th, B[sd + 'Thigh']);
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.13 * s, 0.33 * s), pm); k.position.set(0, -0.045 * s, 0.07 * s); env.addProp(k, B[sd + 'Foot']);
    const h = new THREE.Mesh(new THREE.BoxGeometry(sd === 'l' ? 0.2 * s : 0.15 * s, 0.24 * s, 0.14 * s), sd === 'l' ? pm : dk); h.position.set(0, -0.08 * s, 0.03 * s); env.addProp(h, B[sd + 'Hand']);
  }
}
/* goalkeeper: come off the line, set, and kick the shot wide with the leg guard */
function gkSave(a) {
  const tShot = 1.65, tS = 1.95;
  const READY_G = { lHipF: 58, rHipF: 58, lKnee: 76, rKnee: 76, lAnk: -18, rAnk: -18, lHipA: 18, rHipA: 18, spineX: 22, chestX: 6, headX: -16, lShF: 50, rShF: 45, lShA: 25, rShA: 25, lEl: 40, rEl: 30 };
  const keys = [[0, Object.assign({ x: 0, z: 0.9, ry: 0 }, READY_G)], [0.35, { z: 1.5 }], [0.75, { z: 2.4, x: 0.15 }], [1.15, { z: 3.0, x: 0.25 }], [1.4, { z: 3.15, x: 0.25, lKnee: 82, rKnee: 82 }],
    [tShot + 0.08, { x: 0.25, z: 3.15, lHipF: 62, lKnee: 86, rHipF: 50, rKnee: 70, spineZ: 0 }],
    [tS, { x: 0.45, z: 3.2, lHipF: 70, lKnee: 104, lAnk: -30, lHipA: 12, rHipF: 30, rKnee: 8, rAnk: 10, rHipA: 62, rHipR: 30, hipsZ: 10, spineZ: 16, spineX: 18, lShA: 60, rShA: 50, headY: -18 }],
    [tS + 0.35, { x: 0.4, z: 3.2, rHipA: 40, rKnee: 20, lKnee: 96, spineZ: 10 }],
    [tS + 0.85, Object.assign({ x: 0.3, z: 3.0, hipsZ: 0, spineZ: 0, rHipR: 0, headY: 0 }, READY_G)],
    [tS + 1.3, { lHipF: 10, rHipF: 10, lKnee: 14, rKnee: 14, lAnk: -4, rAnk: -4, lHipA: 9, rHipA: 9, spineX: 0, chestX: -4, lShF: 160, rShF: 160, lShA: 25, rShA: 25, lEl: 10, rEl: 10, headX: -20 }], [tS + 2.0, {}]];
  const att = [[0, Object.assign({ x: 1.2, z: 15.5, ry: 182 }, STANCE_H)], [tShot - 0.3, { x: 0.6, z: 8.4, ry: 178 }], [tShot, { x: 0.55, z: 7.9, hipsY: 10, chestY: 14 }], [tShot + 0.5, { x: 0.5, z: 7.6, hipsY: 0, chestY: 0 }], [4, {}]];
  let save = null, stickA = null, stickG = null;
  return play(a, {
    venue: 'fldHockey', dur: tS + 2.1, keys, payoff: tS + 0.05, R: HBR, mirror: false, orbit: { base: 55, sweep: 55 },
    extras: [Object.assign(OPP(172, { gender: 'f', hairStyle: 'ponytail' }), { tag: 'att', keys: att, runs: [{ from: 0.05, to: tShot - 0.25, period: 0.5, k: 0.8, hold: true }], mood: t => ({ focus: 0.8, sad: t > tS + 0.3 ? 0.7 : 0 }) })],
    setup(env, S) {
      gkKit(env);
      stickG = env.addProp(hockeyStick('#ff7a1a')); stickG.scale.setScalar(Math.max(0.94, Math.min(1.06, env.s)));
      stickA = env.addProp(hockeyStick());
      env.pose(S.poseAt(tS)); save = env.rig.bones[env.side('r') + 'Shin'].localToWorld(V(0, -0.3 * env.s, 0.15 * env.s));
    },
    update(t, env, S) {
      const B = env.props.ball, x = S.x[0];
      // attacker's stick: carried in front, ball on the face until the shot
      const ab = x.bones.hips.localToWorld(V(-0.1, -0.85, 0.75)); ab.y = HBR;
      const shotFrom = V(0.45, HBR, 7.9 - 0.7);
      let bp;
      if (t < tShot) bp = ab; else if (t < tS) { const u = (t - tShot) / (tS - tShot); bp = shotFrom.clone().lerp(save, u); bp.y = Math.max(HBR, lerp(HBR, save.y, u)); }
      else { const tt = t - tS, d = V(-0.9, 0, 0.45).normalize(); bp = save.clone().addScaledVector(d, 9 * (1 - Math.exp(-tt * 1.2))); bp.y = Math.max(HBR, save.y + 2.5 * tt - 4.9 * tt * tt); if (bp.y <= HBR + 1e-4) bp.y = HBR + Math.abs(Math.sin((tt - 0.6) * 7)) * 0.15 * Math.exp(-tt); }
      B.position.copy(t < tShot ? ab : bp);
      const hands = x.bones.chest.localToWorld(V(-0.05, -0.3, 0.3)), ballA = t < tShot + 0.1 ? (t < tShot ? ab : shotFrom) : x.bones.hips.localToWorld(V(0.3, -0.7, 1.0));
      stickAt(stickA, ballA, ballA.clone().sub(hands), V(0, 1, 0)); x.reach('l', stickA.localToWorld(V(0, 0.05, 0)), x.bones.chest.localToWorld(V(0.6, 0, 0.2))); x.reach('r', stickA.localToWorld(V(0, 0.36, 0)), x.bones.chest.localToWorld(V(-0.6, -0.4, 0)));
      // keeper's stick in the right hand, held low and forward
      const rh = env.rig.bones[env.side('r') + 'Hand'], gp = env.handPos('r'), dir = chestDir(env, -0.35, -1, 0.9);
      orient(stickG, gp.clone().addScaledVector(dir, -0.12), dir, chestDir(env, 0, 0.6, 1)); void rh;
      return follow(env, B.position, 0.3 * win(t, 0.2, 1.0, tS + 0.6, tS + 1.2), 5.4);
    }
  });
}

/* ================================================================== lacrosse (right-handed: right hand on top, left hand at the butt) */
const LBR = 0.034;
const READY_L = { lHipF: 26, rHipF: 22, lKnee: 34, rKnee: 30, lAnk: -8, rAnk: -8, lHipA: 9, rHipA: 9, spineX: 16, chestX: 4, headX: -10 };
/* stick key: [t, butt (local), shaft dir (local), pocket-face dir (local), top-hand position along the shaft] */
const CARRY = [[0.05, 1.0, 0.28], [-0.32, 1, -0.28], [0, 0.2, 1], 0.46];
const OVER = { wind: [[0.12, 1.22, 0.3], [-0.5, 0.55, -1], [0, 1, 0.2], 0.48], rel: [[0.32, 1.02, 0.45], [-0.12, 1, 0.5], [0, 0.4, 1], 0.5], fol: [[0.42, 0.82, 0.2], [0.8, -0.35, 0.55], [0.2, -1, 0.4], 0.46] };
const SIDE = { wind: [[0.0, 1.0, 0.25], [-1, 0.25, -0.7], [0.3, 0.2, 1], 0.46], rel: [[0.2, 0.95, 0.42], [-0.7, 0.35, 0.8], [0.6, 0.1, 1], 0.48], fol: [[0.4, 0.85, 0.25], [0.9, 0.0, 0.5], [0.3, -0.6, 0.6], 0.46] };
const BTB = { wind: [[-0.05, 1.05, 0.22], [-1, 0.55, 0.1], [0.2, 0.7, 0.7], 0.46], rel: [[0.12, 1.22, 0.05], [0.75, 0.7, -0.75], [0.9, 0.2, -0.2], 0.46], fol: [[0.25, 1.1, 0.05], [0.95, 0.15, -0.35], [0.4, -0.7, -0.3], 0.46] };
function stickTracks(list) {
  const t = list.map(k => k[0]);
  const vt = i => vecTrack(list.map(k => [k[0], k[1][i]])), nt = numTrack(list.map(k => [k[0], k[1][3]]));
  return { butt: vt(0), dir: vt(1), face: vt(2), top: nt, t };
}
function laxPlay(a, cfg) {
  const st = stickTracks(cfg.stick), tRel = cfg.tRel, T = cfg.target, flight = cfg.flight || 0.32, tGoal = tRel + flight;
  let stick = null, rel = null, dirG = null;
  const place = (env, t) => { orient(stick, env.ws(st.butt(t)), env.dir(st.dir(t)), env.dir(st.face(t))); return stick; };
  return play(a, {
    venue: 'fldLacrosse', dur: cfg.dur || tGoal + 1.7, keys: cfg.keys, runs: cfg.runs, post: cfg.post, payoff: cfg.payoff || tGoal, R: LBR, extras: cfg.extras, orbit: cfg.orbit || { base: 160, sweep: 65 }, mirror: false,
    setup(env, S) {
      if (a.gender === 'f') env.rig.setHeadwear(null);
      stick = env.addProp(laxStick(a.gender === 'f' ? 0.72 : 0.78, cfg.head || '#f4f4ef')); stick.scale.setScalar(Math.max(0.94, Math.min(1.06, env.s))); S.stick = stick;
      env.pose(S.poseAt(tRel)); place(env, tRel); rel = stick.localToWorld(laxPocket(stick));
      dirG = V(T[0], T[1], T[2]).sub(rel).setY(0).normalize(); S.dirG = dirG;
      if (cfg.setup) cfg.setup(env, S);
    },
    update(t, env, S) {
      place(env, t);
      const B = env.props.ball;
      if (cfg.ball && cfg.ball(t, env, S, B)) { /* move-specific ball */ }
      else if (t < tRel) B.position.copy(stick.localToWorld(laxPocket(stick)));
      else if (t < tGoal) arc(rel, V(T[0], T[1], T[2]), cfg.apex || 0.12, (t - tRel) / flight, B.position);
      else { const tau = t - tGoal; B.position.copy(V(T[0], T[1], T[2])).addScaledVector(dirG, 1.1 * (1 - Math.exp(-7 * tau))); B.position.y = Math.max(LBR, T[1] - 4.9 * tau * tau); }
      if (t > tGoal - 0.05 && env.venue && env.venue.goal) env.venue.goal.push(B.position, dirG, LBR, 0.25, 0.4);
      const gw = cfg.grip ? cfg.grip(t) : [1, 1];
      env.reach('l', stick.localToWorld(V(0, 0.04, 0)), [0.55, 0.7, 0.05], { weight: gw[0] });
      env.reach('r', stick.localToWorld(V(0, st.top(t) * stick.userData.len / 0.78, 0)), [-0.7, 1.2, -0.25], { weight: gw[1] });
      if (cfg.update) cfg.update(t, env, S);
      return cfg.cam ? cfg.cam(t, env, S) : follow(env, B.position, 0.32 * win(t, tRel, tRel + 0.15, tGoal + 0.7, tGoal + 1.4), 5.4);
    }
  });
}
/* stick keys for a shot: carry → wind → release → follow-through (shot = OVER | SIDE | BTB) */
function shotStick(tRel, shot, tCarry = 0) {
  return [[0, CARRY], [Math.max(tCarry, tRel - 0.55), CARRY], [tRel - 0.24, shot.wind], [tRel, shot.rel], [tRel + 0.24, shot.fol], [tRel + 1.0, CARRY]].map(([t, k]) => [t, k]);
}
/* overhand crank shot on the run (Rabil); dodge first (North) */
function crank(a, o = {}) {
  const tRel = o.tRel || 1.9, S = o.S || [-1.0, 11.4], T = o.target || [0.62, 1.55, 0], ry = headingTo(S[0], S[1], T[0], T[2]);
  const path = o.path || [[-3.0, 19.5], [-1.6, 14.0]];
  const keys = [[0, Object.assign({}, READY_L, { spineX: 18 })]].concat(along(path.concat([[S[0], S[1] + 0.6]]), 0, tRel - 0.28, 8), [
    [tRel - 0.28, { ry: ry - 55, hipsY: -18, chestY: -30, lHipF: 40, lKnee: 30, rHipF: -10, rKnee: 40, spineX: 6, headY: 50 }],
    [tRel, { x: S[0], z: S[1], ry: ry - 10, hipsY: 22, chestY: 30, spineX: 18, lHipF: 34, lKnee: 28, rHipF: -18, rKnee: 30, rAnk: 30, headY: 10 }],
    [tRel + 0.3, { x: S[0] + 0.1, z: S[1] - 0.5, hipsY: 10, chestY: 22, spineX: 30, rHipF: 40, rKnee: 70, lKnee: 34, headY: 0 }],
    [tRel + 0.8, Object.assign({ x: S[0] + 0.2, z: S[1] - 1.0, ry: ry, hipsY: 0, chestY: 0 }, READY_L)], [tRel + 1.3, { lShF: 150, lShA: 30, lEl: 20, spineX: 2, headX: -14 }]], o.keys || []);
  return laxPlay(a, { keys, tRel, target: T, flight: 0.3, stick: shotStick(tRel, OVER), runs: [{ from: 0.02, to: tRel - 0.32, period: 0.5, k: 0.9, hold: true, phase: 0.25 }], extras: o.extras,
    grip: t => [1, 1 - smooth(span(t, tRel + 1.15, tRel + 1.35))] });
}
function north(a) {
  const tD = 0.95;
  return crank(a, { tRel: 1.95, S: [1.4, 10.6], target: [-0.6, 0.45, 0], path: [[-2.6, 18.5], [-1.4, 14.6], [1.0, 13.0]],
    keys: [[tD - 0.12, { spineZ: 0 }], [tD, { spineZ: -16, hipsZ: -8, rHipA: 30, rKnee: 56, spineX: 26 }], [tD + 0.25, { spineZ: 6, hipsZ: 0, rHipA: 9 }]],
    extras: [Object.assign(OPP(170, { gender: 'f', hairStyle: 'ponytail' }), { tag: 'dd', sport: 'lacrosse', keys: [[0, Object.assign({ x: -0.6, z: 11.6, ry: 10 }, READY_L, { lShF: 40, rShF: 40, lEl: 60, rEl: 60 })], [tD, { x: -1.1, z: 12.1, ry: -10 }], [tD + 0.35, { x: -1.0, z: 11.8, ry: 25, spineX: 30 }], [4, {}]] })] });
}
/* sidearm shot on the run (Schreiber) */
function runShot(a) {
  const tRel = 1.85, S = [3.4, 10.4], T = [-0.65, 0.55, 0], ry = headingTo(S[0], S[1], T[0], T[2]);
  const keys = [[0, Object.assign({}, READY_L, { spineX: 18 })]].concat(along([[7.6, 16.5], [5.2, 12.6], [S[0] + 0.5, S[1] + 0.5]], 0, tRel - 0.25, 8), [
    [tRel - 0.25, { ry: ry - 70, hipsY: -20, chestY: -35, spineX: 20, spineZ: 14, headY: 60, lHipF: 40, lKnee: 40 }],
    [tRel, { x: S[0], z: S[1], ry: ry - 15, hipsY: 20, chestY: 30, spineX: 26, spineZ: 18, headY: 15, rHipF: -15, rKnee: 30 }],
    [tRel + 0.35, { x: S[0] - 0.3, z: S[1] - 0.4, hipsY: 10, chestY: 20, spineX: 30, spineZ: 6, rHipF: 30, rKnee: 60 }],
    [tRel + 0.9, Object.assign({ ry, hipsY: 0, chestY: 0, spineZ: 0 }, READY_L)], [tRel + 1.3, { lShF: 150, lShA: 30, lEl: 20, spineX: 2, headX: -14 }]]);
  return laxPlay(a, { keys, tRel, target: T, flight: 0.3, stick: shotStick(tRel, SIDE), runs: [{ from: 0.02, to: tRel - 0.3, period: 0.5, k: 0.9, hold: true, phase: 0.25 }],
    grip: t => [1, 1 - smooth(span(t, tRel + 1.15, tRel + 1.35))] });
}
/* behind-the-back shot at the crease (Treanor, Lyle Thompson, Grant Jr.) */
function btbShot(a, o = {}) {
  const tRel = o.tRel || 1.75, S = o.S || [1.6, 4.3], T = o.target || [-0.55, 1.25, 0];
  const keys = [[0, Object.assign({}, READY_L, { spineX: 16 })]].concat(along([[4.6, 8.8], [2.6, 5.4], [S[0] + 0.2, S[1] + 0.1]], 0, tRel - 0.4, 6), [
    [tRel - 0.25, { x: S[0] + 0.1, z: S[1], ry: 105, hipsY: -10, chestY: -25, spineX: 14, headY: 60, lHipF: 30, lKnee: 34, rHipF: 10, rKnee: 34 }],
    [tRel, { x: S[0], z: S[1] - 0.1, ry: 95, hipsY: 15, chestY: 25, spineX: 8, spineZ: -10, headY: 80, neckY: 15, lHipF: 34, lKnee: 30, rHipF: -10, rKnee: 30 }],
    [tRel + 0.3, { hipsY: 5, chestY: 10, spineZ: -4, headY: 70 }], [tRel + 0.9, Object.assign({ ry: 140, hipsY: 0, chestY: 0, spineZ: 0, headY: 10, neckY: 0 }, READY_L)],
    [tRel + 1.3, { lShF: 150, lShA: 30, lEl: 20, spineX: 2, headX: -14 }]]);
  return laxPlay(a, { keys, tRel, target: T, flight: 0.28, stick: shotStick(tRel, BTB), runs: [{ from: 0.02, to: tRel - 0.45, period: 0.5, k: 0.8, hold: true, phase: 0.25 }],
    grip: t => [1 - win(t, tRel - 0.18, tRel - 0.08, tRel + 0.2, tRel + 0.4), 1 - smooth(span(t, tRel + 1.15, tRel + 1.35))], orbit: { base: 200, sweep: 70 } });
}
/* dodge from behind the goal (X), turn the corner around the crease and finish at the doorstep (Pannell) */
function xDodge(a) {
  const tR = 0.95, tRel = 2.05, S = [3.05, 0.95], T = [-0.55, 0.65, 0], ry = headingTo(S[0], S[1], T[0], T[2]);
  const keys = [[0, Object.assign({ x: 0.6, z: -4.7, ry: 10 }, READY_L, { spineX: 22 })], [0.4, { x: 1.2, z: -4.5, ry: 60 }],
    [tR - 0.1, { x: 2.4, z: -3.7, ry: 75, spineZ: 0 }], [tR, { x: 2.55, z: -3.55, ry: 40, spineZ: 12, hipsZ: 6, lHipA: 26, lKnee: 56 }], [tR + 0.2, { spineZ: 0, hipsZ: 0, lHipA: 9 }]]
    .concat(along([[2.75, -3.2], [3.45, -1.4], [S[0] + 0.25, S[1] - 0.45]], tR + 0.1, tRel - 0.25, 6).slice(1), [
    [tRel - 0.25, { ry: ry - 60, hipsY: -15, chestY: -30, spineX: 20, spineZ: 12, headY: 55, lHipF: 40, lKnee: 40 }],
    [tRel, { x: S[0], z: S[1], ry: ry - 15, hipsY: 20, chestY: 28, spineX: 26, spineZ: 16, headY: 15, rHipF: -15, rKnee: 30 }],
    [tRel + 0.35, { x: S[0] - 0.1, z: S[1] + 0.2, hipsY: 8, chestY: 18, spineX: 28, spineZ: 6 }],
    [tRel + 0.9, Object.assign({ ry: ry + 40, hipsY: 0, chestY: 0, spineZ: 0 }, READY_L)], [tRel + 1.3, { lShF: 150, lShA: 30, lEl: 20, spineX: 2, headX: -14 }]]);
  return laxPlay(a, { keys, tRel, target: T, flight: 0.2, stick: shotStick(tRel, SIDE), runs: [{ from: 0.05, to: tRel - 0.3, period: 0.5, k: 0.85, hold: true, phase: 0.25 }], orbit: { base: 140, sweep: 70 },
    grip: t => [1, 1 - smooth(span(t, tRel + 1.15, tRel + 1.35))] });
}
/* acrobatic leaping shot across the top of the crease (Powell) */
function leapShot(a) {
  const tJ = 1.45, tRel = 1.72, tL = 2.05, T = [-0.6, 1.45, 0];
  const keys = [[0, Object.assign({}, READY_L, { spineX: 18 })]].concat(along([[5.6, 6.6], [3.2, 4.6], [2.1, 3.9]], 0, tJ - 0.08, 6), [
    [tJ - 0.08, { lHipF: 46, lKnee: 60, rHipF: 12, rKnee: 46, spineX: 22 }],
    [tJ, { x: 1.8, z: 3.75, ry: 225, lHipF: 10, lKnee: 20, lAnk: 30, rHipF: 85, rKnee: 100, air: 0.25, spineX: 0, headX: -15 }],
    [tRel, { x: 0.8, z: 3.35, ry: 205, air: 0.62, lHipF: 40, lKnee: 80, rHipF: 60, rKnee: 90, spineX: 10, spineZ: -16, hipsY: 20, chestY: 30, headY: -20 }],
    [tL, { x: -0.1, z: 3.1, ry: 200, air: 0, lHipF: 40, rHipF: 30, lKnee: 60, rKnee: 50, spineX: 24, spineZ: 0, hipsY: 0, chestY: 0, headY: 0 }],
    [tL + 0.6, Object.assign({ x: -0.6, z: 3.2, ry: 200 }, READY_L)], [tL + 1.1, { lShF: 150, lShA: 30, lEl: 20, spineX: 2, headX: -14 }]]);
  const stick = [[0, CARRY], [tJ - 0.15, CARRY], [tRel - 0.2, OVER.wind], [tRel, OVER.rel], [tRel + 0.25, OVER.fol], [tL + 0.8, CARRY]];
  return laxPlay(a, { keys, tRel, target: T, flight: 0.24, stick, runs: [{ from: 0.02, to: tJ - 0.1, period: 0.5, k: 0.95, hold: true, phase: 0.25 }], orbit: { base: 120, sweep: 70 },
    grip: t => [1, 1 - smooth(span(t, tL + 0.95, tL + 1.15))] });
}
/* the Air Gait: leap from behind the goal over the crease and dunk the ball in over the crossbar */
function airGait(a) {
  const tJ = 1.55, tRel = 1.95, tL = 2.3, T = [0.15, 1.25, -0.25];
  const keys = [[0, Object.assign({}, READY_L, { spineX: 18 })]].concat(along([[4.2, -5.4], [3.9, -2.8], [3.0, -1.1]], 0, tJ - 0.1, 6), [
    [tJ - 0.1, { lHipF: 44, lKnee: 56, rHipF: 14, rKnee: 46, spineX: 22 }],
    [tJ, { x: 2.85, z: -0.85, ry: -35, lHipF: 10, lKnee: 18, lAnk: 30, rHipF: 85, rKnee: 95, air: 0.3, spineX: 0, headX: -25 }],
    [tRel, { x: 1.55, z: 0.75, ry: -75, air: 0.95, lHipF: 50, lKnee: 80, rHipF: 70, rKnee: 90, spineX: 26, chestX: 10, headX: 10, headY: 30 }],
    [tL, { x: 0.6, z: 1.9, ry: -85, air: 0, lHipF: 40, rHipF: 30, lKnee: 60, rKnee: 50, spineX: 24, headY: 20 }],
    [tL + 0.6, Object.assign({ x: -0.2, z: 2.8, ry: -60, headY: 0 }, READY_L)], [tL + 1.1, { lShF: 150, lShA: 30, lEl: 20, spineX: 2, headX: -14 }]]);
  const stick = [[0, CARRY], [tJ - 0.2, CARRY], [tJ + 0.15, [[0.1, 1.3, 0.25], [-0.2, 1, -0.2], [0, 0.3, 1], 0.5]], [tRel - 0.08, [[0.2, 1.45, 0.4], [-0.25, 1, 0.45], [0, -0.5, 1], 0.5]], [tRel, [[0.25, 1.2, 0.5], [-0.15, 0.3, 1], [0, -1, 0.3], 0.5]], [tRel + 0.3, [[0.3, 1.0, 0.4], [0.2, -0.4, 1], [0, -1, 0], 0.48]], [tL + 0.8, CARRY]];
  return laxPlay(a, { keys, tRel, target: T, flight: 0.14, apex: 0.02, stick, runs: [{ from: 0.02, to: tJ - 0.12, period: 0.5, k: 0.9, hold: true, phase: 0.25 }], orbit: { base: 90, sweep: 70 },
    grip: t => [1, 1 - smooth(span(t, tL + 0.95, tL + 1.15))] });
}
/* draw control: back-to-back sticks at the centre, lift on the whistle, leap and catch the ball at the top */
function drawControl(a) {
  const C = [0, 36.58], tUp = 0.9, tCatch = 1.75, apexY = 3.0;
  const DRAW = { lHipF: 30, rHipF: 30, lKnee: 40, rKnee: 40, lAnk: -10, rAnk: -10, lHipA: 14, rHipA: 14, spineX: 22, chestX: 4, headX: -18 };
  const keys = [[0, Object.assign({ x: C[0] - 0.66, z: C[1], ry: 90 }, DRAW)], [tUp - 0.05, {}], [tUp + 0.2, { lHipF: 10, rHipF: 10, lKnee: 14, rKnee: 14, spineX: 0, headX: -40 }],
    [tCatch - 0.2, { x: C[0] - 0.62, lHipF: 40, rHipF: 40, lKnee: 60, rKnee: 60, spineX: 10, headX: -45 }],
    [tCatch, { x: C[0] - 0.6, z: C[1] - 0.15, air: 0.42, lHipF: 10, lKnee: 30, rHipF: 50, rKnee: 80, spineX: -6, headX: -50 }],
    [tCatch + 0.35, { x: C[0] - 0.75, z: C[1] - 0.05, air: 0, lHipF: 30, rHipF: 30, lKnee: 50, rKnee: 50, spineX: 16, headX: -10, ry: 30 }],
    [tCatch + 1.2, { x: C[0] - 1.6, z: C[1] + 2.2, ry: -15 }], [tCatch + 1.6, Object.assign({}, READY_L)], [tCatch + 2.0, { lShF: 150, lShA: 30, lEl: 20, spineX: 2, headX: -14 }]];
  const stick = [[0, [[-0.38, 0.95, 0.56], [1, 0.0, 0.0], [0, 0, -1], 0.5]], [tUp, [[-0.38, 0.95, 0.56], [1, 0.0, 0.0], [0, 0, -1], 0.5]],
    [tUp + 0.25, [[-0.1, 1.2, 0.35], [0.4, 1, -0.2], [0, 0.2, -1], 0.5]], [tCatch - 0.2, [[0.05, 1.35, 0.25], [0.2, 1, 0.1], [0, 0.1, 1], 0.5]],
    [tCatch, [[0.1, 1.45, 0.25], [0.0, 1, 0.3], [0, 0.2, 1], 0.5]], [tCatch + 0.5, CARRY], [tCatch + 3, CARRY]];
  let ball0 = null, catchP = null, oppStick = null;
  return laxPlay(a, {
    keys, tRel: 99, target: [0, 1, 0], stick, dur: tCatch + 2.2, payoff: tCatch + 0.05, orbit: { base: 30, sweep: 80 },
    runs: [{ from: tCatch + 0.4, to: tCatch + 1.3, period: 0.5, k: 0.7, hold: true }],
    extras: [Object.assign(OPP(170, { gender: 'f', hairStyle: 'ponytail' }), { tag: 'opp', sport: 'lacrosse', keys: [[0, Object.assign({ x: C[0] + 0.66, z: C[1], ry: -90 }, DRAW)], [tUp, {}], [tUp + 0.25, { lHipF: 14, rHipF: 14, lKnee: 18, rKnee: 18, spineX: 4, headX: -35 }], [tCatch, { air: 0.2, headX: -40 }], [tCatch + 0.3, { air: 0, spineX: 14, headX: -10 }], [4, {}]], mood: t => ({ focus: 0.8, sad: t > tCatch + 0.2 ? 0.6 : 0 }) })],
    setup(env, S) {
      if (S.x[0]) S.x[0].setHeadwear(null);
      oppStick = env.addProp(laxStick(0.72, '#1d2d55'));
      env.pose(S.poseAt(0)); const st0 = S.stick; orient(st0, env.ws([-0.38, 0.95, 0.56]), env.dir([1, 0, 0]), env.dir([0, 0, -1])); ball0 = st0.localToWorld(V(0, st0.userData.len + 0.14, -0.05));
      env.pose(S.poseAt(tCatch)); const tr = stickTracks(stick); orient(st0, env.ws(tr.butt(tCatch)), env.dir(tr.dir(tCatch)), env.dir(tr.face(tCatch))); catchP = st0.localToWorld(laxPocket(st0));
    },
    ball(t, env, S, B) {
      if (t < tUp + 0.05) B.position.copy(ball0);
      else if (t < tCatch) { const u = (t - tUp - 0.05) / (tCatch - tUp - 0.05); B.position.lerpVectors(ball0, catchP, u); B.position.y = lerp(ball0.y, catchP.y, u) + 4 * (apexY - Math.max(ball0.y, catchP.y)) * u * (1 - u); }
      else B.position.copy(S.stick.localToWorld(laxPocket(S.stick)));
      return true;
    },
    update(t, env, S) {
      const x = S.x[0], up = smooth(span(t, tUp, tUp + 0.25)), R0 = x.root;
      const ml = v => { if (env.mirror) v.x = -v.x; return v; };
      const butt = R0.localToWorld(ml(V(0.38, 0.95, 0.56).lerp(V(0.1, 1.2, 0.35), up))), dir = ml(V(-1, 0, 0).lerp(V(-0.4, 1, -0.2), up)).applyQuaternion(R0.quaternion).normalize();
      orient(oppStick, butt, dir, ml(V(0, 0, -1)).applyQuaternion(R0.quaternion));
      reachX(env, x, 'r', oppStick.localToWorld(V(0, 0.04, 0)), x.bones.chest.localToWorld(V(-0.6, -0.3, -0.2))); reachX(env, x, 'l', oppStick.localToWorld(V(0, 0.4, 0)), x.bones.chest.localToWorld(V(0.6, 0.2, -0.2)));
    },
    cam(t, env, S) { const f = follow(env, env.props.ball.position, 0.35 * win(t, tUp, tUp + 0.2, tCatch, tCatch + 0.3), 4.8); return f; }
  });
}

export const MOVES = {
  soccer_curl: a => curlShot(a),
  soccer_knuckle: a => knuckle(a),
  soccer_bicycle: a => bicycle(a),
  soccer_volley: a => volley(a, { leftFoot: a.id === 'zinedine-zidane' }),
  soccer_header: a => header(a),
  soccer_corner: a => corner(a),
  soccer_slalom: a => slalom(a),
  soccer_sprint: a => a.id === 'mia-hamm' ? sprintShot(a, { period: 0.5, S0: [6.5, 35], S: [3.6, 18.4], target: [-2.9, 0.5, 0] }) : sprintShot(a),
  soccer_press: a => press(a),
  soccer_elastico: a => elastico(a),
  soccer_stepover: a => stepover(a, { count: a.id === 'neymar' ? 3 : 2 }),
  soccer_cruyffTurn: a => cruyffTurn(a),
  rugby_placeKick: a => placeKick(a),
  rugby_goromaru: a => placeKick(a, { ritual: true, B0: [-12, 23] }),
  rugby_dropGoal: a => dropGoal(a),
  rugby_handOff: a => lomu(a),
  rugby_sidestep: a => sidestep(a),
  rugby_cornerTry: a => cornerTry(a),
  rugby_lineBreak: a => lineBreak(a),
  rugby_jackal: a => jackal(a, { low: a.id === 'david-pocock' }),
  rugby_tackle: a => tackle(a),
  rugby_spinPass: a => spinPass(a),
  af_dropBack: a => brady(a),
  af_audible: a => manning(a),
  af_rollout: a => montana(a),
  af_sidearm: a => mahomes(a),
  af_slant: a => rice(a),
  af_leapCatch: a => moss(a),
  af_juke: a => sanders(a),
  af_stiffArm: a => payton(a),
  af_powerRun: a => jimBrown(a),
  af_sack: a => sack(a),
  flag_scramble: a => flores(a),
  flag_pumpFake: a => doucette(a),
  flag_flagPull: a => flagPull(a),
  fh_dragFlick: a => dragFlick(a, a.id === 'harmanpreet-singh' ? { target: [1.3, 0.45, 0] } : {}),
  fh_dribble: a => chand(a),
  fh_reverse: a => reverseShot(a, a.id === 'rani-rampal' ? { path: [[6.2, 20.5], [3.9, 16.6], [1.6, 13.4]], target: [1.4, 1.0, 0] } : a.id === 'teun-de-nooijer' ? { target: [-0.9, 0.35, 0] } : {}),
  fh_spin: a => aymarSpin(a),
  fh_shootout: a => shootout(a),
  fh_carry: a => vanDoren(a),
  fh_save: a => gkSave(a),
  lax_crank: a => crank(a),
  lax_splitDodge: a => north(a),
  lax_runShot: a => runShot(a),
  lax_btb: a => btbShot(a, a.id === 'lyle-thompson' ? { S: [1.9, 4.8], target: [0.5, 0.5, 0] } : a.id === 'john-grant-jr' ? { S: [1.5, 3.9], target: [-0.6, 1.5, 0] } : {}),
  lax_airGait: a => airGait(a),
  lax_draw: a => drawControl(a),
  lax_xDodge: a => xDodge(a),
  lax_leapShot: a => leapShot(a)
};
export const SIGNATURE = {
  'lionel-messi': 'soccer_curl', 'cristiano-ronaldo': 'soccer_knuckle', 'pel': 'soccer_bicycle', 'marta-footballer': 'soccer_stepover', 'mia-hamm': 'soccer_sprint',
  'son-heung-min': 'soccer_curl', 'neymar': 'soccer_stepover', 'zinedine-zidane': 'soccer_volley', 'ronaldinho': 'soccer_elastico', 'alex-morgan': 'soccer_header',
  'megan-rapinoe': 'soccer_corner', 'sun-wen': 'soccer_curl', 'park-ji-sung': 'soccer_press', 'kylian-mbappe': 'soccer_sprint', 'diego-maradona': 'soccer_slalom', 'johan-cruyff': 'soccer_cruyffTurn',
  'jonah-lomu': 'rugby_handOff', 'richie-mccaw': 'rugby_jackal', 'michaela-blyde': 'rugby_sidestep', 'dan-carter': 'rugby_placeKick', 'siya-kolisi': 'rugby_tackle',
  'portia-woodman': 'rugby_cornerTry', 'brian-odriscoll': 'rugby_lineBreak', 'jonny-wilkinson': 'rugby_dropGoal', 'david-pocock': 'rugby_jackal', 'ayumu-goromaru': 'rugby_goromaru',
  'tom-brady': 'af_dropBack', 'patrick-mahomes': 'af_sidearm', 'jerry-rice': 'af_slant', 'walter-payton': 'af_stiffArm', 'jim-brown': 'af_powerRun',
  'lawrence-taylor': 'af_sack', 'peyton-manning': 'af_audible', 'barry-sanders': 'af_juke', 'randy-moss': 'af_leapCatch', 'joe-montana': 'af_rollout',
  'diana-flores': 'flag_scramble', 'darrell-doucette': 'flag_pumpFake',
  'sohail-abbas': 'fh_dragFlick', 'harmanpreet-singh': 'fh_dragFlick', 'dhyan-chand': 'fh_dribble', 'jamie-dwyer': 'fh_reverse', 'luciana-aymar': 'fh_spin',
  'teun-de-nooijer': 'fh_reverse', 'arthur-van-doren': 'fh_carry', 'rani-rampal': 'fh_reverse', 'ellen-hoog': 'fh_shootout', 'maddie-hinch': 'fh_save',
  'gary-gait': 'lax_airGait', 'paul-rabil': 'lax_crank', 'lyle-thompson': 'lax_btb', 'taylor-cummings': 'lax_draw', 'kayla-treanor': 'lax_btb',
  'tom-schreiber': 'lax_runShot', 'rob-pannell': 'lax_xDodge', 'john-grant-jr': 'lax_btb', 'mikey-powell': 'lax_leapShot', 'charlotte-north': 'lax_splitDodge'
};
export const VENUES = {
  fldSoccer: { indoor: false, build: soccerPitch, ball: soccerBall },
  fldRugby: { indoor: false, build: rugbyPitch, ball: rugbyBall },
  fldGridiron: { indoor: false, build: s => gridiron(s, false), ball: football },
  fldFlag: { indoor: false, build: s => gridiron(s, true), ball: football },
  fldHockey: { indoor: false, build: hockeyTurf, ball: hockeyBall },
  fldLacrosse: { indoor: false, build: laxField, ball: laxBall }
};
const PREFIX = { soccer: 'soccer_', rugby: 'rugby_', 'american-football': 'af_', 'flag-football': 'flag_', 'field-hockey': 'fh_', lacrosse: 'lax_' };
export function movesFor(a) {
  const pre = PREFIX[a.sport], sig = SIGNATURE[a.id], list = sig ? [sig] : [];
  for (const id of Object.keys(MOVES)) if (pre && id.startsWith(pre) && !list.includes(id)) list.push(id);
  return list;
}
