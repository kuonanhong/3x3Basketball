/* SmartAction Sports — 3D venues and props for the athlete studio (procedural, no external assets). MIT. */
import * as THREE from '../vendor/three/three.module.min.js';

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
export function add(parent, geo, material, pos, rot, shadow = true) {
  const m = new THREE.Mesh(geo, material); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot);
  m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function crowd(w, h, seed, base) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h); const r = rng(seed);
    const cols = ['#d8c6b2', '#b98a68', '#6e4a30', '#e6c3a2', '#3b2a1e', '#2f6f6a', '#9c4a3c', '#d9d9d2', '#2a3550', '#b59a52'];
    const rowH = 14;
    for (let row = 0; row < h / rowH; row++) {
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, row * rowH + rowH - 3, w, 3);
      for (let i = 0; i < w / 9; i++) {
        if (r() < 0.12) continue;
        const px = i * 9 + r() * 3, py = row * rowH + 4 + r() * 1.5; x.globalAlpha = 0.45 + r() * 0.3;
        x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(px - 3, py + 3, 6, 6);
        x.fillStyle = cols[Math.floor(r() * 5)]; x.beginPath(); x.arc(px, py + 1, 2.4, 0, Math.PI * 2); x.fill();
      }
    }
    x.globalAlpha = 1;
  });
}

/* ------------------------------------------------------------------ lights */
export function makeLights(scene, kind) {
  const hemi = new THREE.HemisphereLight(kind === 'court' ? '#fff4e6' : '#e6f2ff', kind === 'court' ? '#6b4a2e' : '#5a6b3a', kind === 'court' ? 1.05 : 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(kind === 'court' ? '#fff3e0' : '#fff8ea', kind === 'court' ? 2.0 : 2.6);
  sun.position.set(6, 14, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 50;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#cfe3ff', 0.55); fill.position.set(-8, 6, -6); scene.add(fill);
  return { hemi, sun, fill, follow(p) { sun.position.set(p.x + 6, 14, p.z + 8); sun.target.position.set(p.x, 0, p.z); sun.target.updateMatrixWorld(); } };
}

/* ------------------------------------------------------------------ basketball arena (rim centre at origin, court toward +Z) */
export function makeCourt(scene) {
  const g = new THREE.Group(); scene.add(g);
  scene.background = new THREE.Color('#14171c'); scene.fog = new THREE.Fog('#14171c', 26, 60);
  const L = 15, Wd = 15.24;   // half court from the baseline (z = -1.575) to half-court line
  const floorTex = canvasTex(2048, 2048, (x, w, h) => {
    // maple planks
    for (let i = 0; i < 64; i++) { const v = 0.86 + ((i * 37) % 11) / 90; x.fillStyle = `rgb(${Math.round(214 * v)},${Math.round(160 * v)},${Math.round(104 * v)})`; x.fillRect(i * w / 64, 0, w / 64 + 1, h); }
    const r = rng(7); for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(90,50,20,${r() * 0.08})`; x.fillRect(r() * w, r() * h, 2, 30 + r() * 80); }
    for (let i = 0; i < 64; i++) { x.fillStyle = 'rgba(70,40,15,.25)'; x.fillRect(i * w / 64, 0, 1.5, h); }
  });
  // floor plane: x in [-12, 12], z in [-6, 18] (2048 px ≙ 24 m)
  const floor = add(g, new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.38, metalness: 0.02 }), [0, 0, 6], [-Math.PI / 2, 0, 0], false);
  floor.receiveShadow = true;
  // painted lines and key (separate decal canvas so lines stay crisp)
  const lines = canvasTex(2048, 2048, (x, w) => {
    const m = w / 24, X = v => (v + 12) * m, Z = v => (v + 6) * m;
    x.clearRect(0, 0, w, w);
    // key paint
    x.fillStyle = 'rgba(13,122,113,.82)'; x.fillRect(X(-2.45), Z(-1.575), 4.9 * m, 5.8 * m);
    x.fillStyle = 'rgba(13,122,113,.35)'; x.beginPath(); x.arc(X(0), Z(4.225), 1.8 * m, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#f7f5ef'; x.lineWidth = 0.05 * m;
    x.strokeRect(X(-7.62), Z(-1.575), 15.24 * m, 15.0 * m);                                   // boundary
    x.strokeRect(X(-2.45), Z(-1.575), 4.9 * m, 5.8 * m);                                       // lane
    x.beginPath(); x.arc(X(0), Z(4.225), 1.8 * m, 0, Math.PI * 2); x.stroke();                  // free-throw circle
    x.beginPath(); x.arc(X(0), Z(0), 1.25 * m, 0, Math.PI); x.stroke();                         // restricted area
    x.beginPath(); x.moveTo(X(-6.6), Z(-1.575)); x.lineTo(X(-6.6), Z(1.4)); x.arc(X(0), Z(0), 6.75 * m, Math.PI - Math.asin(6.6 / 6.75) - 0.0, Math.asin(6.6 / 6.75), true); x.lineTo(X(6.6), Z(-1.575)); x.stroke();   // three-point line
    x.beginPath(); x.arc(X(0), Z(13.425), 1.8 * m, Math.PI, 0, false); x.stroke();             // centre circle half
    x.fillStyle = 'rgba(247,245,239,.9)'; x.font = `900 ${1.1 * m}px Arial, sans-serif`; x.textAlign = 'center'; x.fillText('SMARTACTION', X(0), Z(10.5));
  });
  add(g, new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: lines, transparent: true, roughness: 0.35, depthWrite: false }), [0, 0.003, 6], [-Math.PI / 2, 0, 0], false);
  // apron / stands around the court
  add(g, new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#1d2a30', roughness: 0.9 }), [0, -0.01, 6], [-Math.PI / 2, 0, 0], false);
  const stands = crowd(2048, 448, 3, '#232a33');
  for (const [px, pz, ry, w] of [[0, -9, 0, 40], [-14, 6, Math.PI / 2, 34], [14, 6, -Math.PI / 2, 34], [0, 22, Math.PI, 40]]) {
    const st = add(g, new THREE.PlaneGeometry(w, 9), new THREE.MeshStandardMaterial({ map: stands, roughness: 1, color: '#c9ced4', emissive: '#0d1116', emissiveIntensity: 1 }), [px, 4.6, pz], [-0.25, ry, 0], false);
    st.receiveShadow = false;
  }
  // ceiling light rig glow
  for (let i = -2; i <= 2; i++) add(g, new THREE.BoxGeometry(2.4, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: '#fff6e0' }), [i * 4, 13, 5], null, false);
  const hoop = makeHoop(); g.add(hoop.group);
  return { group: g, hoop, rim: new THREE.Vector3(0, 3.05, 0) };
}

export function makeHoop() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#2e3a40', roughness: 0.45, metalness: 0.6, transparent: true }), pad = new THREE.MeshStandardMaterial({ color: '#273036', roughness: 0.75, transparent: true });
  const support = [
    add(group, new THREE.BoxGeometry(0.22, 3.4, 0.22), steel, [0, 1.7, -2.95]),                       // stanchion
    add(group, new THREE.BoxGeometry(0.22, 0.22, 1.6), steel, [0, 3.3, -2.1]),                        // arm
    add(group, new THREE.BoxGeometry(1.0, 1.5, 0.9), pad, [0, 0.75, -3.25])];                          // padded base
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f6f8', roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.22, depthWrite: false });
  add(group, new THREE.BoxGeometry(1.83, 1.07, 0.04), glass, [0, 3.35, -0.4], null, false);
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const frame = (w, h, y, t) => { for (const [px, py, sw, sh] of [[0, y + h / 2, w, t], [0, y - h / 2, w, t], [-w / 2, y, t, h], [w / 2, y, t, h]]) add(group, new THREE.BoxGeometry(sw, sh, 0.012), white, [px, py, -0.375], null, false); };
  frame(1.83, 1.07, 3.35, 0.05); frame(0.59, 0.45, 3.28, 0.05);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#ff5a1f', roughness: 0.35, metalness: 0.4 });
  add(group, new THREE.TorusGeometry(0.229, 0.011, 10, 40), rimMat, [0, 3.05, 0], [Math.PI / 2, 0, 0]);
  add(group, new THREE.BoxGeometry(0.06, 0.03, 0.17), rimMat, [0, 3.05, -0.31]);
  // net: rings joined by zig-zag strings
  const pts = [], rings = 6, around = 12;
  const ringR = i => 0.229 - i * 0.017, ringY = i => 3.05 - i * 0.075;
  for (let i = 0; i < rings - 1; i++) for (let k = 0; k < around; k++) {
    const a0 = k / around * Math.PI * 2 + (i % 2) * Math.PI / around, a1 = a0 + Math.PI / around, a2 = a0 - Math.PI / around;
    const p0 = new THREE.Vector3(Math.cos(a0) * ringR(i), ringY(i), Math.sin(a0) * ringR(i));
    for (const a of [a1, a2]) pts.push(p0, new THREE.Vector3(Math.cos(a) * ringR(i + 1), ringY(i + 1), Math.sin(a) * ringR(i + 1)));
  }
  const net = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.9 }));
  group.add(net);
  const base = net.geometry.attributes.position.array.slice();
  return { group, net, support, ghost(k) { for (const m of [steel, pad]) { m.opacity = 1 - 0.85 * k; m.depthWrite = k < 0.5; } for (const o of support) o.castShadow = k < 0.5; }, swish(k) {   // k: 0..1 impulse, stretches the net downward
    const a = net.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const depth = Math.max(0, 3.05 - base[i + 1]); a[i + 1] = base[i + 1] - depth * 0.45 * k; a[i] = base[i] * (1 - 0.18 * k); a[i + 2] = base[i + 2] * (1 - 0.18 * k); }
    net.geometry.attributes.position.needsUpdate = true;
  } };
}

/* ------------------------------------------------------------------ baseball park (home plate at origin, mound toward -Z) */
export function makeDiamond(scene) {
  const g = new THREE.Group(); scene.add(g);
  const sky = canvasTex(16, 256, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5f9fd9'); gr.addColorStop(0.55, '#a9d1ef'); gr.addColorStop(1, '#e8f1f2'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  scene.background = sky; scene.fog = new THREE.Fog('#cfe3ee', 90, 260);
  const grass = canvasTex(512, 512, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#3f8c3c' : '#4a9a45'; x.fillRect(0, i * h / 8, w, h / 8); }
    const r = rng(11); for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${20 + r() * 40},${70 + r() * 60},${20 + r() * 30},.25)`; x.fillRect(r() * w, r() * h, 1.5, 3); }
  }, [40, 40]);
  add(g, new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }), [0, 0, -60], [-Math.PI / 2, 0, 0], false);
  const dirt = new THREE.MeshStandardMaterial({ color: '#b9875a', roughness: 1 });
  // infield dirt: arc of radius 29 m centred on the pitcher's plate, closed along both foul lines (shape y = -world z)
  const shape = new THREE.Shape(); const mz = -18.44, b = 27.43 / Math.SQRT2;
  shape.moveTo(0, -2.2); shape.lineTo(27.5, 27.5);
  for (let i = 0; i <= 48; i++) { const a = -0.318 - i / 48 * (Math.PI - 0.636); shape.lineTo(Math.cos(a) * 29, 18.44 - Math.sin(a) * 29); }
  shape.lineTo(-27.5, 27.5); shape.closePath();
  add(g, new THREE.ShapeGeometry(shape, 48), dirt, [0, 0.006, 0], [-Math.PI / 2, 0, 0], false);
  // grass inside the base paths
  const inner = new THREE.Shape();
  inner.moveTo(0, 1.6); inner.lineTo(b - 1.6, b); inner.lineTo(0, 2 * b - 1.6); inner.lineTo(-b + 1.6, b); inner.closePath();
  add(g, new THREE.ShapeGeometry(inner), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }), [0, 0.012, 0], [-Math.PI / 2, 0, 0], false);
  // home plate circle and mound
  add(g, new THREE.CircleGeometry(4, 40), dirt, [0, 0.014, 0], [-Math.PI / 2, 0, 0], false);
  const mound = add(g, new THREE.CylinderGeometry(2.74, 2.9, 0.25, 40), dirt, [0, 0.125, mz]); mound.castShadow = false;
  add(g, new THREE.BoxGeometry(0.61, 0.03, 0.15), new THREE.MeshStandardMaterial({ color: '#f7f7f2' }), [0, 0.26, mz + 0.05]);
  // home plate (pentagon pointing to the catcher, +Z)
  const hp = new THREE.Shape(); hp.moveTo(-0.216, 0); hp.lineTo(0.216, 0); hp.lineTo(0.216, -0.216); hp.lineTo(0, -0.432); hp.lineTo(-0.216, -0.216); hp.closePath();
  add(g, new THREE.ShapeGeometry(hp), new THREE.MeshStandardMaterial({ color: '#fbfbf7', roughness: 0.6 }), [0, 0.02, -0.216], [-Math.PI / 2, 0, Math.PI], false);
  // bases
  const baseMat = new THREE.MeshStandardMaterial({ color: '#fbfbf7', roughness: 0.7 });
  for (const [x, z] of [[b, -b], [0, -2 * b], [-b, -b]]) add(g, new THREE.BoxGeometry(0.46, 0.08, 0.46), baseMat, [x, 0.04, z], [0, Math.PI / 4, 0]);
  // chalk: foul lines, batter's boxes, catcher's box
  const chalk = new THREE.MeshBasicMaterial({ color: '#f7f7f2' });
  for (const sx of [1, -1]) {
    add(g, new THREE.PlaneGeometry(0.08, 112 * 2 * 0.5 * 2 / 2), chalk, [sx * 39.6, 0.02, -39.6], [-Math.PI / 2, 0, -sx * Math.PI / 4], false);
    // batter's box outline 1.22 x 1.83 m, inner edge 0.15 m from plate
    const cx = sx * (0.216 + 0.15 + 0.61), cz = -0.2;
    for (const [dx, dz, w, h] of [[0, -0.915, 1.22, 0.05], [0, 0.915, 1.22, 0.05], [-0.61, 0, 0.05, 1.83], [0.61, 0, 0.05, 1.83]]) add(g, new THREE.PlaneGeometry(w, h), chalk, [cx + dx, 0.021, cz + dz], [-Math.PI / 2, 0, 0], false);
  }
  // outfield wall + yellow line, foul poles, stands
  const wallR = 112, wallH = 3.0;
  const wall = add(g, new THREE.CylinderGeometry(wallR, wallR, wallH, 90, 1, true, Math.PI - Math.PI / 4 - 0.02, Math.PI / 2 + 0.04), new THREE.MeshStandardMaterial({ color: '#1f4a35', roughness: 0.85, side: THREE.DoubleSide }), [0, wallH / 2, 0]);
  wall.receiveShadow = true;
  add(g, new THREE.CylinderGeometry(wallR - 0.05, wallR - 0.05, 0.12, 90, 1, true, Math.PI - Math.PI / 4 - 0.02, Math.PI / 2 + 0.04), new THREE.MeshBasicMaterial({ color: '#f2c94c', side: THREE.DoubleSide }), [0, wallH, 0], null, false);
  add(g, new THREE.RingGeometry(wallR - 4.5, wallR, 90, 1, Math.PI / 4 - 0.02, Math.PI / 2 + 0.04), new THREE.MeshStandardMaterial({ color: '#8a6440', roughness: 1 }), [0, 0.01, 0], [-Math.PI / 2, 0, 0], false);   // warning track
  for (const sx of [1, -1]) add(g, new THREE.CylinderGeometry(0.15, 0.15, 14, 8), new THREE.MeshStandardMaterial({ color: '#f2c94c' }), [sx * wallR * Math.SQRT1_2, 7, -wallR * Math.SQRT1_2]);
  const stands = crowd(4096, 256, 5, '#2b3a44');
  add(g, new THREE.CylinderGeometry(wallR + 18, wallR + 4, 22, 90, 1, true, Math.PI - Math.PI / 4 - 0.25, Math.PI / 2 + 0.5), new THREE.MeshStandardMaterial({ map: stands, side: THREE.BackSide, roughness: 1 }), [0, 11, 0], null, false);
  // backstop behind home: low brick wall + see-through netting
  add(g, new THREE.CylinderGeometry(18, 18, 1.2, 40, 1, true, -0.9, 1.8), new THREE.MeshStandardMaterial({ color: '#7a4a38', roughness: 0.9, side: THREE.DoubleSide }), [0, 0.6, 0], null, false);
  const net = canvasTex(64, 64, (x) => { x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(30,38,44,.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke(); }, [60, 10]);
  add(g, new THREE.CylinderGeometry(18, 18, 7, 40, 1, true, -0.9, 1.8), new THREE.MeshBasicMaterial({ map: net, transparent: true, side: THREE.DoubleSide, depthWrite: false }), [0, 4.7, 0], null, false);
  return { group: g, plate: new THREE.Vector3(0, 0, 0), mound: new THREE.Vector3(0, 0.25, mz), bases: { first: new THREE.Vector3(b, 0, -b), second: new THREE.Vector3(0, 0, -2 * b), third: new THREE.Vector3(-b, 0, -b) }, wallR, wallH };
}

/* ------------------------------------------------------------------ props */
export function makeBasketball() {
  const tex = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#d9692b'; x.fillRect(0, 0, w, h);
    const r = rng(2); for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(80,30,10,${r() * 0.18})`; x.fillRect(r() * w, r() * h, 1.5, 1.5); }
    x.strokeStyle = '#1a1210'; x.lineWidth = 5;
    for (const u of [0, 0.25, 0.5, 0.75]) { x.beginPath(); x.moveTo(u * w, 0); x.lineTo(u * w, h); x.stroke(); }
    x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    for (const o of [0.125, 0.625]) { x.beginPath(); for (let i = 0; i <= 64; i++) { const v = i / 64; const px = (o + Math.sin(v * Math.PI) * 0.09) * w; if (i) x.lineTo(px, v * h); else x.moveTo(px, v * h); } x.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
  m.castShadow = true; return m;
}
export function makeBaseball() {
  const tex = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#fbfaf4'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c8302a'; x.lineWidth = 3;
    for (const o of [0.25, 0.75]) { x.beginPath(); for (let i = 0; i <= 64; i++) { const v = i / 64, px = (o + Math.sin(v * Math.PI * 2) * 0.12) * w; if (i) x.lineTo(px, v * h); else x.moveTo(px, v * h); } x.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.037, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  m.castShadow = true; return m;
}
/* bat: knob at local origin, barrel along +Y (0.86 m) */
export function makeBat(color = '#c89a5c') {
  const prof = [[0, 0], [0.024, 0.0], [0.026, 0.012], [0.015, 0.03], [0.0125, 0.2], [0.014, 0.36], [0.022, 0.52], [0.031, 0.66], [0.034, 0.78], [0.033, 0.85], [0.02, 0.862], [0, 0.864]];
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20), new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.02 }));
  m.castShadow = true;
  const tape = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0135, 0.2, 14), new THREE.MeshStandardMaterial({ color: '#1d2428', roughness: 0.8 })); tape.position.y = 0.13; m.add(tape);
  const g = new THREE.Group(); g.add(m); return g;
}
/* fielding glove, attached to the glove hand (pocket faces the hand's +Z) */
export function makeGlove(color = '#8b5a2b', big = false) {
  const g = new THREE.Group(), leather = new THREE.MeshStandardMaterial({ color, roughness: 0.65 }), dark = new THREE.MeshStandardMaterial({ color: '#4a2f17', roughness: 0.7 });
  const s = big ? 1.25 : 1;
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 16, 12), leather); palm.scale.set(1, 1.35, 0.42); palm.position.set(0, -0.08 * s, 0.01); g.add(palm);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.022 * s, 0.12 * s, 4, 8), leather); f.position.set((i - 1.5) * 0.042 * s, -0.2 * s, 0.012); f.rotation.z = (i - 1.5) * 0.08; g.add(f); }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.024 * s, 0.09 * s, 4, 8), leather); th.position.set(0.085 * s, -0.07 * s, 0.03); th.rotation.z = -0.7; g.add(th);
  const web = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.07 * s, 0.01), dark); web.position.set(0.075 * s, -0.17 * s, 0.03); web.rotation.z = -0.3; g.add(web);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
