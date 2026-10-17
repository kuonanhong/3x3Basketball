/* SmartAction Sports — procedural 3D athlete rig (stylized, not a likeness).
   Body proportions come from catalogue data: height, weight, build, gender, handedness, hair, facial hair,
   accessories and jersey number. No photos or scans are used for the 3D body or face. MIT. */
import * as THREE from '../vendor/three/three.module.min.js';

export const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Baseball batting / throwing sides (the catalogue's single "handedness" field is not enough for hitters). */
export const BATS_THROWS = {
  'shohei-ohtani': ['L', 'R'], 'ichiro-suzuki': ['L', 'R'], 'babe-ruth': ['L', 'L'], 'chien-ming-wang': ['R', 'R'], 'mariano-rivera': ['R', 'R'],
  'manny-ramirez': ['R', 'R'], 'derek-jeter': ['R', 'R'], 'ken-griffey-jr': ['L', 'L'], 'sadaharu-oh': ['L', 'L'], 'peng-cheng-min': ['R', 'R'],
  'wang-po-jung': ['L', 'R'], 'chen-wei-yin': ['L', 'L'], 'aaron-judge': ['R', 'R'], 'mike-trout': ['R', 'R'], 'hideki-matsui': ['L', 'R'],
  'mike-piazza': ['R', 'R'], 'yadier-molina': ['R', 'R'], 'albert-pujols': ['R', 'R'], 'jackie-robinson': ['R', 'R'], 'jose-altuve': ['R', 'R'],
  'cal-ripken-jr': ['R', 'R'], 'adrian-beltre': ['R', 'R'], 'willie-mays': ['R', 'R'], 'roberto-clemente': ['R', 'R'], 'mookie-betts': ['R', 'R'],
  'yu-darvish': ['R', 'R'], 'clayton-kershaw': ['L', 'L'], 'randy-johnson': ['R', 'L']
};

export const UNIFORMS = {
  teal: { jersey: '#0f8a80', trim: '#e9f5f2', number: '#ffffff', outline: '#0b3c3a', shorts: '#0d7a71', pants: '#f2f2ee', socks: '#0f8a80', cap: '#0f6e67', shoe: '#f5f5f2', sole: '#1d2428', accent: '#ffd66b', pin: null },
  coral: { jersey: '#d8553f', trim: '#fff1e8', number: '#ffffff', outline: '#5a1f15', shorts: '#c44934', pants: '#efeee8', socks: '#d8553f', cap: '#b9432f', shoe: '#1d2428', sole: '#f5f5f2', accent: '#ffd66b', pin: null },
  navy: { jersey: '#1d2d55', trim: '#e9edf6', number: '#ffffff', outline: '#c9a227', shorts: '#18264a', pants: '#a9adb4', socks: '#1d2d55', cap: '#16234a', shoe: '#f5f5f2', sole: '#1d2428', accent: '#c9a227', pin: null },
  white: { jersey: '#f3f3ee', trim: '#0f8a80', number: '#0f8a80', outline: '#0b3c3a', shorts: '#ecece6', pants: '#f3f3ee', socks: '#0f8a80', cap: '#0f6e67', shoe: '#1d2428', sole: '#f5f5f2', accent: '#0f8a80', pin: '#0f8a8055' }
};

/* What each sport wears. top: tank | tee | long | baseball | polo | singlet | swim | none; lower: shorts | short | pants | trunks | tights | hockey;
   socks: crew | high | none; shoes: sneaker | cleat | skate | none; pads: shoulder-pad bulk; head: default headwear. */
export const OUTFITS = {
  basketball: { top: 'tank', lower: 'shorts', socks: 'crew', shoes: 'sneaker' },
  baseball: { top: 'baseball', lower: 'pants', socks: 'high', shoes: 'cleat', head: 'cap' },
  softball: { top: 'baseball', lower: 'pants', socks: 'high', shoes: 'cleat', head: 'visor' },
  cricket: { top: 'polo', lower: 'pants', socks: 'crew', shoes: 'cleat', whites: true },
  soccer: { top: 'tee', lower: 'short', socks: 'high', shoes: 'cleat' },
  rugby: { top: 'tee', lower: 'short', socks: 'high', shoes: 'cleat', pads: 1.08 },
  'american-football': { top: 'tee', lower: 'pants', socks: 'high', shoes: 'cleat', pads: 1.38, head: 'footballHelmet', knee: true },
  'flag-football': { top: 'tee', lower: 'short', socks: 'crew', shoes: 'cleat', flags: true },
  'field-hockey': { top: 'tee', lower: 'short', socks: 'high', shoes: 'cleat', shinGuards: true },
  lacrosse: { top: 'tee', lower: 'short', socks: 'crew', shoes: 'cleat', pads: 1.12, head: 'lacrosseHelmet', gloves: true },
  'ice-hockey': { top: 'long', lower: 'hockey', socks: 'high', shoes: 'skate', pads: 1.28, head: 'hockeyHelmet', gloves: true },
  handball: { top: 'tee', lower: 'short', socks: 'crew', shoes: 'sneaker' },
  volleyball: { top: 'tee', lower: 'short', socks: 'crew', shoes: 'sneaker', kneePads: true },
  'beach-volleyball': { top: 'singlet', lower: 'trunks', socks: 'none', shoes: 'none', beach: true },
  'sepak-takraw': { top: 'tee', lower: 'short', socks: 'crew', shoes: 'sneaker' },
  badminton: { top: 'tee', lower: 'short', socks: 'crew', shoes: 'sneaker' },
  tabletennis: { top: 'tee', lower: 'short', socks: 'crew', shoes: 'sneaker' },
  tennis: { top: 'tee', lower: 'short', socks: 'crew', shoes: 'sneaker' },
  'soft-tennis': { top: 'tee', lower: 'short', socks: 'crew', shoes: 'sneaker', head: 'visor' },
  squash: { top: 'tee', lower: 'short', socks: 'crew', shoes: 'sneaker', goggles: true },
  'water-polo': { top: 'swim', lower: 'trunks', socks: 'none', shoes: 'none', head: 'swimCap' },
  sprint: { top: 'singlet', lower: 'tights', socks: 'none', shoes: 'sneaker', bib: true },
  archery: { top: 'polo', lower: 'pants', socks: 'crew', shoes: 'sneaker', head: 'none', armGuard: true },
  golf: { top: 'polo', lower: 'pants', socks: 'crew', shoes: 'sneaker', head: 'cap', glove: true },
  bowling: { top: 'polo', lower: 'pants', socks: 'crew', shoes: 'sneaker' },
  billiards: { top: 'polo', lower: 'pants', socks: 'crew', shoes: 'sneaker', vest: true }
};

const mats = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.62, metalness: 0.02 }, opts)));
  return mats.get(key);
}
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }
function mesh(geo, material, parent, pos, rot, scale) {
  const m = new THREE.Mesh(geo, material); m.castShadow = true; m.receiveShadow = true;
  if (pos) m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  parent.add(m); return m;
}
/* tapered limb hanging from the joint along -Y, with rounded ends */
function limb(parent, len, r1, r2, material, seg = 14, from = 0, to = 1) {
  const g = new THREE.Group(); parent.add(g);
  const y0 = -len * from, y1 = -len * to, ra = r1 + (r2 - r1) * from, rb = r1 + (r2 - r1) * to;
  mesh(new THREE.CylinderGeometry(ra, rb, y0 - y1, seg, 1, true), material, g, [0, (y0 + y1) / 2, 0]);
  mesh(new THREE.SphereGeometry(ra, seg, 8), material, g, [0, y0, 0]);
  mesh(new THREE.SphereGeometry(rb, seg, 8), material, g, [0, y1, 0]);
  return g;
}
/* elliptical lathe for torso segments: profile [[y, r], ...] */
function lathe(parent, profile, sx, sz, material, seg = 28) {
  const pts = profile.map(([y, r]) => new THREE.Vector2(r, y));
  const m = mesh(new THREE.LatheGeometry(pts, seg), material, parent); m.scale.set(sx, 1, sz); return m;
}
function numberTexture(text, fg, outline, name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  if (name) { x.font = '800 34px "Arial Narrow", Arial, sans-serif'; x.lineWidth = 6; x.strokeStyle = outline; x.strokeText(name, 128, 34); x.fillStyle = fg; x.fillText(name, 128, 34); }
  x.font = `900 ${String(text).length > 1 ? 150 : 170}px Arial, sans-serif`; x.lineWidth = 14; x.strokeStyle = outline; x.strokeText(String(text), 128, name ? 150 : 135); x.fillStyle = fg; x.fillText(String(text), 128, name ? 150 : 135);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function pinstripeTexture(base, pin) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 64, 64); x.fillStyle = pin; x.fillRect(30, 0, 3, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 3); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------------------------------------------------------------- body profile from catalogue data */
export function bodyProfile(a, sport) {
  const female = a.gender === 'f';
  const H = clamp((a.heightCm || (female ? 175 : 185)) / 100, 1.55, 2.32);
  const W = a.weightKg || H * H * (female ? 21.5 : 24.5);
  const bmi = W / (H * H);
  const build = (a.appearance && a.appearance.build) || 'athletic';
  const buildF = { slim: 0.9, tall: 0.95, stocky: 1.1, power: 1.08, compact: 1.0, athletic: 1.0 }[build] || 1;
  const g = clamp(Math.sqrt(bmi / 23.5), 0.86, 1.3) * buildF;
  const bt = BATS_THROWS[a.id] || [a.handedness === 'left' ? 'L' : 'R', a.handedness === 'left' ? 'L' : 'R'];
  return { id: a.id, H, W, bmi, g, female, build, sport, bats: bt[0], throws: bt[1], shoots: a.handedness === 'left' ? 'L' : 'R',
    look: Object.assign({ skin: '#c8956b', hair: '#1b1b1b', hairStyle: 'short', facialHair: 'none', accessory: 'none', jerseyNumber: null }, a.appearance || {}),
    name: a.name, lastName: (a.name || '').replace(/\s+(Jr\.?|Sr\.?)$/i, '').split(/\s+/).slice(-1)[0].toUpperCase() };
}

/* ---------------------------------------------------------------- the rig */
export class AthleteRig {
  constructor(athlete, sport, uniformKey = 'teal') {
    this.athlete = athlete; this.sport = sport;
    const p = this.p = bodyProfile(athlete, sport), H = p.H, s = H / 1.85, g = p.g, look = p.look, f = p.female;
    let u = this.u = UNIFORMS[uniformKey] || UNIFORMS.teal;
    const L = this.len = { hip: 0.53 * H, thigh: 0.245 * H, shin: 0.246 * H, ankle: 0.039 * H, upperArm: 0.186 * H, forearm: 0.146 * H, hand: 0.095 * H,
      spine: 0.15 * H, chest: 0.138 * H, neck: 0.028 * H, shoulderX: (f ? 0.104 : 0.112) * H, hipX: (f ? 0.088 : 0.084) * H, foot: 0.15 * H };
    this.root = new THREE.Group(); this.root.name = 'athlete-' + athlete.id;
    const B = this.bones = {};
    const bone = (name, parent, x, y, z) => { const b = new THREE.Group(); b.name = name; b.position.set(x, y, z); parent.add(b); B[name] = b; return b; };
    const skin = mat(look.skin, { roughness: 0.55 }), hair = mat(look.hair, { roughness: 0.85 });
    const O = this.outfit = Object.assign({}, OUTFITS[sport] || OUTFITS.basketball);
    if (O.whites) Object.assign(u = this.u = Object.assign({}, u), { jersey: '#f4f2ea', shorts: '#f1efe6', pants: '#f1efe6', number: u.jersey, outline: u.outline, trim: u.jersey });
    const baseball = O.top === 'baseball', skinTop = O.top === 'none' || (O.top === 'swim' && !f), longLower = O.lower === 'pants';
    const pin = baseball && u.pin;
    const jerseyMat = pin ? new THREE.MeshStandardMaterial({ map: pinstripeTexture(u.jersey, u.pin), roughness: 0.78 }) : mat(u.jersey, { roughness: O.top === 'swim' ? 0.35 : 0.75 });
    const lowerCol = longLower ? u.pants : u.shorts;
    const lowerMat = pin && longLower ? new THREE.MeshStandardMaterial({ map: pinstripeTexture(u.pants, u.pin), roughness: 0.8 }) : mat(O.lower === 'trunks' || O.lower === 'tights' ? shade(u.jersey, 0.6) : lowerCol, { roughness: 0.75 });
    const sockMat = mat(O.socks === 'high' ? u.socks : '#f4f4f0', { roughness: 0.8 }), shoeMat = mat(O.shoes === 'cleat' ? '#1d2428' : u.shoe, { roughness: 0.45 }), soleMat = mat(u.sole, { roughness: 0.7 }), trimMat = mat(u.trim, { roughness: 0.7 });
    const torsoMat = skinTop ? skin : jerseyMat;

    /* skeleton */
    const hips = bone('hips', this.root, 0, L.hip, 0);
    const spine = bone('spine', hips, 0, 0.02 * H, 0);
    const chest = bone('chest', spine, 0, L.spine, 0);
    const neck = bone('neck', chest, 0, L.chest, 0);
    const head = bone('head', neck, 0, L.neck, 0);
    for (const [side, sx] of [['l', 1], ['r', -1]]) {
      const sh = bone(side + 'Shoulder', chest, sx * L.shoulderX, L.chest - 0.02 * H, 0);
      const ua = bone(side + 'UpperArm', sh, 0, 0, 0); ua.rotation.order = 'XYZ';
      const fa = bone(side + 'Forearm', ua, 0, -L.upperArm, 0);
      bone(side + 'Hand', fa, 0, -L.forearm, 0);
      const th = bone(side + 'Thigh', hips, sx * L.hipX, 0, 0); th.rotation.order = 'XYZ';
      const sn = bone(side + 'Shin', th, 0, -L.thigh, 0);
      bone(side + 'Foot', sn, 0, -L.shin, 0);
    }
    hips.rotation.order = spine.rotation.order = chest.rotation.order = 'YXZ';

    /* torso: pelvis + abdomen (shorts / pants) and chest (jersey) */
    const tw = 1.0 * g, cx = (f ? 1.12 : 1.2) * (O.pads ? 1 + (O.pads - 1) * 0.5 : 1), cz = 0.72;
    lathe(hips, [[-0.065 * H, 0.0], [-0.065 * H, 0.055 * H * tw], [-0.035 * H, 0.074 * H * tw * (f ? 1.07 : 1)], [0.02 * H, 0.072 * H * tw], [0.06 * H, 0.066 * H * tw]], cx * 1.02, cz * 1.15, lowerMat);
    lathe(spine, [[0, 0.067 * H * tw], [0.05 * H, 0.064 * H * tw], [0.1 * H, 0.069 * H * tw], [L.spine + 0.01 * H, 0.077 * H * tw]], cx, cz * 1.05, torsoMat);
    const chestR = 0.084 * H * Math.min(1.25, g * (f ? 0.94 : 1.03));
    lathe(chest, [[-0.01 * H, 0.08 * H * tw], [0.05 * H, chestR], [0.1 * H, chestR * 1.02], [L.chest - 0.03 * H, chestR * 0.9], [L.chest - 0.008 * H, chestR * 0.62], [L.chest + 0.002 * H, 0.032 * H], [L.chest + 0.004 * H, 0]], cx, cz, torsoMat);
    if (O.pads && O.pads > 1.05) {   // shoulder pads under the jersey (american football, hockey, lacrosse)
      const pad = mesh(new THREE.SphereGeometry(chestR * 1.05, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), jerseyMat, chest, [0, L.chest - 0.05 * H, 0]); pad.scale.set(cx * O.pads * 1.05, 0.9, cz * 1.25);
    }
    if (O.top === 'tank' || O.top === 'singlet') {
      const collar = mesh(new THREE.TorusGeometry(0.036 * H, 0.0045 * H, 6, 24), trimMat, chest, [0, L.chest - 0.006 * H, 0.004 * H], [Math.PI / 2 + 0.25, 0, 0]); collar.scale.set(1.15, 1, 0.9);
    }
    if (O.lower === 'shorts' || O.lower === 'short') for (const sx of [1, -1]) mesh(new THREE.BoxGeometry(0.004 * H, 0.09 * H, 0.02 * H), trimMat, hips, [sx * 0.085 * H * cx * tw * 0.98, -0.02 * H, 0]);
    if (baseball) mesh(new THREE.BoxGeometry(0.008 * H, L.chest + L.spine * 0.9, 0.004 * H), trimMat, spine, [0, (L.chest + L.spine) / 2 - 0.01 * H, 0.074 * H * tw * cz * 1.05 + 0.002 * H]);
    if (O.top === 'polo') mesh(new THREE.BoxGeometry(0.05 * H, 0.012 * H, 0.03 * H), trimMat, chest, [0, L.chest - 0.004 * H, 0.04 * H], [0.6, 0, 0]);
    if (longLower && !O.knee) { const belt = mesh(new THREE.TorusGeometry(0.075 * H * tw, 0.006 * H, 6, 28), mat('#1b1b1b', { roughness: 0.5 }), hips, [0, 0.052 * H, 0], [Math.PI / 2, 0, 0]); belt.scale.set(cx * 1.0, cz * 1.12, 1); }
    if (O.vest) { const v = lathe(chest, [[-0.012 * H, 0.083 * H * tw], [0.05 * H, chestR * 1.03], [0.1 * H, chestR * 1.04], [L.chest - 0.035 * H, chestR * 0.9]], cx * 1.02, cz * 1.04, mat('#1d2125', { roughness: 0.6 })); void v; }
    if (O.flags) for (const sx of [1, -1]) mesh(new THREE.BoxGeometry(0.012 * H, 0.16 * H, 0.03 * H), mat('#ffd23d'), hips, [sx * 0.09 * H * cx * tw, -0.09 * H, 0]);
    if (O.bib) { const bt = document.createElement('canvas'); bt.width = 128; bt.height = 96; const bx = bt.getContext('2d'); bx.fillStyle = '#f7f7f2'; bx.fillRect(0, 0, 128, 96); bx.fillStyle = '#111'; bx.font = '900 54px Arial, sans-serif'; bx.textAlign = 'center'; bx.textBaseline = 'middle'; bx.fillText(String(look.jerseyNumber ?? ''), 64, 50); const tx = new THREE.CanvasTexture(bt); tx.colorSpace = THREE.SRGBColorSpace; mesh(new THREE.PlaneGeometry(0.1 * H, 0.075 * H), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8 }), chest, [0, 0.06 * H, chestR * cz * 1.04]); }
    /* jersey numbers (front small, back with name) */
    const num = look.jerseyNumber !== null && look.jerseyNumber !== undefined ? String(look.jerseyNumber) : '';
    if (num && !skinTop && !O.bib && !['polo'].includes(O.top)) {
      const R = chestR * (O.pads ? 1.035 * O.pads : 1.035), h = 0.105 * H;
      const decal = (tex, theta0, y, sc) => {
        const geo = new THREE.CylinderGeometry(R, R, h, 24, 1, true, theta0 - 0.7, 1.4);
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false, side: THREE.FrontSide }));
        m.position.set(0, y, 0); m.scale.set(cx * sc, 1, cz * sc); chest.add(m); return m;
      };
      decal(numberTexture(num, u.number, u.outline, ''), 0, 0.055 * H, 1.0);
      decal(numberTexture(num, u.number, u.outline, p.lastName), Math.PI, 0.058 * H, 1.01);
    }
    /* neck + head */
    limb(neck, L.neck + 0.01 * H, 0.03 * H * Math.min(1.2, g), 0.034 * H * Math.min(1.2, g), skin, 14).rotation.x = Math.PI;
    this._head(head, H, s, look, skin, hair, baseball);
    /* arms */
    const sleeve = { tank: 0, singlet: 0, swim: 0, none: 0, tee: 0.42, polo: 0.42, baseball: 0.5, long: 1 }[O.top] || 0;
    for (const [side, sx] of [['l', 1], ['r', -1]]) {
      const ua = B[side + 'UpperArm'], fa = B[side + 'Forearm'], hd = B[side + 'Hand'];
      const ar = 0.031 * H * Math.min(1.3, g * (f ? 0.9 : 1)) * (O.pads ? 1 + (O.pads - 1) * 0.4 : 1);
      mesh(new THREE.SphereGeometry(ar * 1.12, 14, 10), sleeve && !skinTop ? jerseyMat : skin, ua, [0, -0.012 * H, 0]).scale.set(1, 1.25, 1);           // deltoid
      limb(ua, L.upperArm, ar * 1.12, ar * 0.84, skin);
      if (sleeve) limb(ua, L.upperArm, ar * 1.3, ar * (sleeve >= 1 ? 1.0 : 1.12), jerseyMat, 14, 0, Math.min(1, sleeve));             // sleeve
      limb(fa, L.forearm, ar * 0.86, ar * 0.62, skin);
      if (sleeve >= 1) limb(fa, L.forearm, ar * 1.02, ar * 0.82, jerseyMat, 14, 0, 0.82);
      if (look.accessory === 'wristband') { const wb = mesh(new THREE.CylinderGeometry(ar * 0.78, ar * 0.78, 0.035 * H, 14), mat('#e23b2e'), fa, [0, -L.forearm * 0.86, 0]); wb.castShadow = true; }
      if (O.armGuard && side === 'r') mesh(new THREE.CylinderGeometry(ar * 0.95, ar * 0.75, L.forearm * 0.6, 12, 1, true), mat('#2b2f33'), fa, [0, -L.forearm * 0.45, 0]);
      // hand: palm + thumb (fingers implied); gloves for hockey / lacrosse / golf (left hand)
      const handMat = O.gloves ? mat(shade(u.jersey, 0.55), { roughness: 0.7 }) : O.glove && side === 'l' ? mat('#f4f4ef') : skin;
      const palm = mesh(new THREE.SphereGeometry(0.03 * H * (O.gloves ? 1.35 : 1), 12, 10), handMat, hd, [0, -0.034 * H, 0.004 * H]); palm.scale.set(0.82, 1.25, O.gloves ? 0.8 : 0.48);
      mesh(new THREE.CapsuleGeometry(0.0085 * H, 0.025 * H, 4, 8), handMat, hd, [sx * 0.018 * H, -0.03 * H, 0.016 * H], [0.5, 0, sx * 0.5]);
      if (O.gloves) mesh(new THREE.CylinderGeometry(ar * 1.15, ar * 0.95, L.forearm * 0.35, 12), handMat, fa, [0, -L.forearm * 0.8, 0]);
      this['handTip_' + side] = new THREE.Object3D(); this['handTip_' + side].position.set(0, -0.06 * H, 0.02 * H); hd.add(this['handTip_' + side]);
      this['grip_' + side] = new THREE.Object3D(); this['grip_' + side].position.set(0, -0.045 * H, 0.012 * H); hd.add(this['grip_' + side]);
    }
    /* legs */
    const blade = O.shoes === 'skate' ? 0.06 * s : 0;
    for (const side of ['l', 'r']) {
      const th = B[side + 'Thigh'], sn = B[side + 'Shin'], ft = B[side + 'Foot'];
      const lr = 0.047 * H * Math.min(1.3, g) * (f ? 1.02 : 1);
      const thighCover = longLower || O.lower === 'hockey' ? 1 : O.lower === 'shorts' ? 0.66 : O.lower === 'short' ? 0.42 : O.lower === 'tights' ? 0.5 : O.lower === 'trunks' ? 0.12 : 0;
      limb(th, L.thigh, lr, lr * 0.72, longLower ? lowerMat : skin);
      if (!longLower && thighCover) limb(th, L.thigh, lr * (O.lower === 'tights' || O.lower === 'trunks' ? 1.03 : O.lower === 'hockey' ? 1.32 : 1.16), lr * (O.lower === 'hockey' ? 1.2 : 1.04), lowerMat, 16, 0, thighCover);
      const shinMat = longLower ? lowerMat : skin;
      limb(sn, L.shin, lr * 0.74, lr * 0.46, shinMat, 14, 0, longLower && O.socks === 'high' && baseball ? 0.48 : 1);
      if (O.socks === 'high') limb(sn, L.shin, lr * (O.shinGuards || O.lower === 'hockey' ? 0.86 : 0.76), lr * 0.5, sockMat, 14, longLower && baseball ? 0.46 : 0.04, 1);
      else if (O.socks === 'crew') limb(sn, L.shin, lr * 0.72, lr * 0.5, sockMat, 14, longLower ? 0.82 : 0.66, 1.0);
      if (O.kneePads || O.knee) limb(sn, L.shin, lr * 0.86, lr * 0.8, mat(O.knee ? lowerCol : '#2a2d31'), 14, -0.04, 0.12);
      // footwear
      if (O.shoes !== 'none') {
        const shoe = mesh(new THREE.CapsuleGeometry(0.036 * H * 0.9, L.foot * 0.62, 6, 12), shoeMat, ft, [0, -L.ankle * 0.55, L.foot * 0.28], [Math.PI / 2, 0, 0]); shoe.scale.set(1, 1, O.shoes === 'skate' ? 1.05 : 0.7);
        if (O.shoes === 'skate') { mesh(new THREE.BoxGeometry(0.006 * H, blade, L.foot * 1.05), mat('#cfd6db', { metalness: 0.8, roughness: 0.25 }), ft, [0, -L.ankle - blade * 0.5, L.foot * 0.28]); mesh(new THREE.BoxGeometry(0.03 * H, 0.012 * H, L.foot * 0.9), mat('#1d2428'), ft, [0, -L.ankle + 0.004 * H, L.foot * 0.28]); }
        else mesh(new THREE.BoxGeometry(0.06 * H * 0.9, 0.012 * H, L.foot * 1.02), soleMat, ft, [0, -L.ankle * 0.98, L.foot * 0.28]);
      } else {
        const foot = mesh(new THREE.CapsuleGeometry(0.03 * H * 0.85, L.foot * 0.6, 6, 10), skin, ft, [0, -L.ankle * 0.6, L.foot * 0.28], [Math.PI / 2, 0, 0]); foot.scale.set(1, 1, 0.6);
      }
      // sole contact points for ground solving
      const heel = new THREE.Object3D(); heel.position.set(0, -L.ankle - blade, -L.foot * 0.2); ft.add(heel);
      const toe = new THREE.Object3D(); toe.position.set(0, -L.ankle - blade, L.foot * 0.78); ft.add(toe);
      this['heel_' + side] = heel; this['toe_' + side] = toe;
    }
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.pose = Object.assign({}, BASE_POSE); this.applyPose(this.pose);
  }

  _head(head, H, s, look, skin, hair, baseball) {
    const R = 0.1 * Math.pow(s, 0.35), hc = R * 0.98;
    const hg = new THREE.Group(); hg.position.set(0, hc, 0.004); head.add(hg); this.headGroup = hg; this.headR = R;
    const sk = mesh(new THREE.SphereGeometry(R, 28, 20), skin, hg); sk.scale.set(0.9, 1.1, 0.98);
    const jaw = mesh(new THREE.SphereGeometry(R * 0.78, 20, 14), skin, hg, [0, -R * 0.38, R * 0.1]); jaw.scale.set(0.95, 0.85, 1.0);
    // ears
    for (const sx of [1, -1]) { const e = mesh(new THREE.SphereGeometry(R * 0.22, 10, 8), mat(shade(look.skin, 0.95), { roughness: 0.6 }), hg, [sx * R * 0.9, -R * 0.02, -R * 0.05]); e.scale.set(0.45, 1, 0.7); }
    // eyes, brows, nose, mouth
    const white = mat('#f7f4ee', { roughness: 0.3 }), dark = mat('#1d1a18', { roughness: 0.25 });
    for (const sx of [1, -1]) {
      mesh(new THREE.SphereGeometry(R * 0.13, 12, 8), white, hg, [sx * R * 0.34, R * 0.1, R * 0.83]).scale.set(1, 0.72, 0.6);
      mesh(new THREE.SphereGeometry(R * 0.075, 10, 8), dark, hg, [sx * R * 0.34, R * 0.1, R * 0.9]);
      const brow = mesh(new THREE.BoxGeometry(R * 0.32, R * 0.06, R * 0.08), mat(look.hair === '#d9b36c' ? '#a98446' : look.hair), hg, [sx * R * 0.34, R * 0.3, R * 0.86], [0, 0, sx * -0.12]);
      (this.brows = this.brows || []).push({ m: brow, sx });
    }
    const nose = mesh(new THREE.CapsuleGeometry(R * 0.1, R * 0.22, 4, 8), mat(shade(look.skin, 0.93), { roughness: 0.55 }), hg, [0, -R * 0.08, R * 0.98], [0.25, 0, 0]); void nose;
    // mouth: a lip arc that bends into a smile or a frown, plus an opening for cheering (stylized expressions, not a likeness)
    const lip = mat('#7a3b33', { roughness: 0.5 });
    const smile = mesh(new THREE.TorusGeometry(R * 0.2, R * 0.03, 6, 16, Math.PI * 0.8), lip, hg, [0, -R * 0.32, R * 0.88], [0, 0, Math.PI * 1.1]);
    const flat = mesh(new THREE.BoxGeometry(R * 0.36, R * 0.05, R * 0.06), lip, hg, [0, -R * 0.42, R * 0.86]);
    const open = mesh(new THREE.SphereGeometry(R * 0.16, 12, 8), mat('#3a1714', { roughness: 0.6 }), hg, [0, -R * 0.45, R * 0.82]); open.scale.set(1.1, 0.1, 0.4);
    this.mouth = { smile, flat, open, R };
    this.setExpression({});
    // hair
    const hs = look.hairStyle, hm = hair;
    const cap = (r, theta, tilt) => { const c = mesh(new THREE.SphereGeometry(r, 26, 14, 0, Math.PI * 2, 0, theta), hm, hg); c.scale.set(0.92, 1.12, 1.0); c.rotation.x = tilt; return c; };
    if (hs === 'short' || hs === 'ponytail' || hs === 'long' || hs === 'braids' || hs === 'headband') cap(R * 1.05, Math.PI * 0.4, -0.32);
    if (hs === 'buzz') { const c = cap(R * 1.012, Math.PI * 0.42, -0.3); c.material = mat(shade(look.hair, 1.0), { roughness: 0.95, transparent: true, opacity: 0.85 }); }
    if (hs === 'long') { const l = mesh(new THREE.SphereGeometry(R * 1.06, 20, 14), hm, hg, [0, -R * 0.45, -R * 0.28]); l.scale.set(1.0, 1.45, 0.72); }
    if (hs === 'ponytail') { const pt = mesh(new THREE.CapsuleGeometry(R * 0.18, R * 1.3, 4, 8), hm, hg, [0, -R * 0.2, -R * 1.05], [0.5, 0, 0]); void pt; }
    if (hs === 'braids') for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.275; mesh(new THREE.CapsuleGeometry(R * 0.07, R * 1.4, 3, 6), hm, hg, [Math.sin(a) * R * 0.85, -R * 0.75, -Math.cos(a) * R * 0.8], [0.25, 0, Math.sin(a) * 0.2]); }
    // facial hair
    const fh = look.facialHair;
    if (fh === 'beard' || fh === 'stubble') {
      const b = mesh(new THREE.SphereGeometry(R * 1.02, 22, 12, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.5, Math.PI * 0.36), fh === 'beard' ? hm : mat(shade(look.skin, 0.62), { roughness: 0.95, transparent: true, opacity: 0.45 }), hg);
      b.scale.set(0.92, 1.12, 1.02);
      if (fh === 'beard') { const c = mesh(new THREE.SphereGeometry(R * 0.36, 12, 10), hm, hg, [0, -R * 0.78, R * 0.56]); c.scale.set(1.2, 0.8, 0.8); }
    }
    if (fh === 'goatee') { const c = mesh(new THREE.SphereGeometry(R * 0.2, 10, 8), hm, hg, [0, -R * 0.78, R * 0.66]); c.scale.set(1, 1.2, 0.7); mesh(new THREE.CapsuleGeometry(R * 0.05, R * 0.3, 3, 6), hm, hg, [0, -R * 0.3, R * 0.93], [0, 0, Math.PI / 2]); }
    if (fh === 'mustache') mesh(new THREE.CapsuleGeometry(R * 0.07, R * 0.38, 3, 8), hm, hg, [0, -R * 0.29, R * 0.93], [0, 0, Math.PI / 2]);
    // accessories / headwear
    const acc = look.accessory;
    if (acc === 'headband' || hs === 'headband') { const hb = mesh(new THREE.TorusGeometry(R * 0.95, R * 0.09, 8, 28), mat('#f5f5f2', { roughness: 0.8 }), hg, [0, R * 0.42, 0], [Math.PI / 2 - 0.12, 0, 0]); hb.scale.set(0.95, 1.06, 1); }
    if (acc === 'goggles') {
      const strap = mesh(new THREE.TorusGeometry(R * 0.96, R * 0.06, 8, 28), mat('#2a2a2a'), hg, [0, R * 0.1, 0], [Math.PI / 2, 0, 0]); strap.scale.set(0.95, 1.05, 1);
      for (const sx of [1, -1]) { const l = mesh(new THREE.SphereGeometry(R * 0.24, 14, 10), new THREE.MeshPhysicalMaterial({ color: '#cfe6f0', roughness: 0.05, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.55 }), hg, [sx * R * 0.34, R * 0.1, R * 0.86]); l.scale.set(1, 0.85, 0.45); }
    }
    if (acc === 'glasses') {
      // thin dark frames: two rims, a bridge and two temples back to the ears
      const fm = mat('#202326', { roughness: 0.4, metalness: 0.3 }), lens = new THREE.MeshPhysicalMaterial({ color: '#dfe9ee', roughness: 0.05, transparent: true, opacity: 0.25 });
      for (const sx of [1, -1]) {
        const rim = mesh(new THREE.TorusGeometry(R * 0.2, R * 0.026, 6, 22), fm, hg, [sx * R * 0.34, R * 0.08, R * 0.94]); rim.scale.set(1, 0.78, 1);
        const l = mesh(new THREE.CircleGeometry(R * 0.19, 18), lens, hg, [sx * R * 0.34, R * 0.08, R * 0.935]); l.scale.set(1, 0.78, 1);
        mesh(new THREE.BoxGeometry(R * 0.03, R * 0.03, R * 0.85), fm, hg, [sx * R * 0.53, R * 0.1, R * 0.5]);
      }
      mesh(new THREE.BoxGeometry(R * 0.26, R * 0.03, R * 0.03), fm, hg, [0, R * 0.12, R * 0.96]);
    }
    if (this.outfit.goggles) for (const sx of [1, -1]) { const l = mesh(new THREE.SphereGeometry(R * 0.24, 14, 10), new THREE.MeshPhysicalMaterial({ color: '#d8eef5', roughness: 0.05, transparent: true, opacity: 0.45 }), hg, [sx * R * 0.34, R * 0.1, R * 0.86]); l.scale.set(1, 0.85, 0.45); }
    this.headwear = null;
    if (this.outfit.head && this.outfit.head !== 'none') this.setHeadwear(this.outfit.head);
  }

  /* stylized emotions: joy (smile, raised brows, open mouth when > 0.6), focus (lowered inner brows, pressed lips), frustration (frown) */
  setExpression(e) {
    if (!this.mouth) return;
    const joy = clamp(e.joy || 0, 0, 1), focus = clamp(e.focus || 0, 0, 1), sad = clamp(e.sad || 0, 0, 1), R = this.mouth.R;
    const { smile, flat, open } = this.mouth;
    const bend = joy - sad;
    smile.visible = Math.abs(bend) > 0.15; flat.visible = !smile.visible;
    smile.rotation.z = bend >= 0 ? Math.PI * 1.1 : Math.PI * 0.1; smile.position.y = bend >= 0 ? -R * 0.3 : -R * 0.52;
    smile.scale.set(0.7 + 0.5 * Math.abs(bend), 0.7 + 0.5 * Math.abs(bend), 1);
    open.scale.y = joy > 0.6 ? 0.1 + (joy - 0.6) * 1.6 : focus > 0.8 ? 0.05 : 0.1; open.visible = joy > 0.6;
    flat.scale.set(1 - focus * 0.25, 1 + focus * 0.4, 1);
    for (const b of this.brows || []) {
      b.m.position.y = R * (0.3 + joy * 0.07 - focus * 0.05 + sad * 0.02);
      b.m.rotation.z = b.sx * (-0.12 - focus * 0.32 + sad * 0.42 + joy * 0.05);
    }
    this.expression = { joy, focus, sad };
  }

  /* baseball cap for fielders/pitchers, batting helmet (ear flap toward the pitcher) at the plate */
  setHeadwear(kind, flapSide) {
    if (this.headwear) { this.headGroup.remove(this.headwear); this.headwear = null; }
    if (!kind || kind === 'none') return;
    if (kind !== 'cap' && kind !== 'helmet') return this._gear(kind);
    const R = this.headR, g = new THREE.Group(), glossy = kind === 'helmet';
    const m = mat(this.u.cap, { roughness: glossy ? 0.18 : 0.75, metalness: glossy ? 0.08 : 0 });
    const dome = mesh(new THREE.SphereGeometry(R * (glossy ? 1.13 : 1.08), 28, 16, 0, Math.PI * 2, 0, Math.PI * (glossy ? 0.56 : 0.48)), m, g); dome.scale.set(0.95, 1.08, 1.03); dome.rotation.x = -0.12;
    const bill = mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.72, R * 0.06, 24, 1, false, -0.95, 1.9), m, g, [0, R * 0.36, R * 0.56], [0.12, 0, 0]); bill.scale.set(1, 1, glossy ? 0.85 : 1.05);
    if (glossy) {
      const sx = flapSide === 'R' ? -1 : 1;
      const flap = mesh(new THREE.SphereGeometry(R * 0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), m, g, [sx * R * 0.92, -R * 0.08, R * 0.02], [0, 0, sx * -Math.PI / 2]); flap.scale.set(0.9, 0.35, 1.05);
    } else {
      // cap logo dot (generic, no team marks)
      mesh(new THREE.CircleGeometry(R * 0.18, 16), mat(this.u.accent, { roughness: 0.6 }), g, [0, R * 0.62, R * 0.86], [-0.55, 0, 0]);
    }
    this.headGroup.add(g); this.headwear = g;
  }

  /* sport headgear: football / hockey / lacrosse / cricket helmets with face guards, swim cap, visor */
  _gear(kind) {
    const R = this.headR, g = new THREE.Group(), u = this.u;
    const shell = mat(kind === 'cricketHelmet' ? '#1d2d55' : u.cap, { roughness: 0.2, metalness: 0.05 }), cage = mat(kind === 'footballHelmet' ? '#e8e8e2' : '#2a2a2a', { roughness: 0.35, metalness: 0.4 });
    if (kind === 'visor') {
      const band = mesh(new THREE.TorusGeometry(R * 0.98, R * 0.07, 6, 28), mat(u.cap), g, [0, R * 0.38, 0], [Math.PI / 2 - 0.15, 0, 0]); band.scale.set(0.93, 1.06, 1);
      mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.72, R * 0.05, 24, 1, false, -0.95, 1.9), mat(u.cap), g, [0, R * 0.42, R * 0.56], [0.15, 0, 0]);
    } else if (kind === 'swimCap') {
      const c = mesh(new THREE.SphereGeometry(R * 1.07, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(u.cap, { roughness: 0.3 }), g); c.scale.set(0.95, 1.1, 1.03); c.rotation.x = -0.2;
      for (const sx of [1, -1]) { const e = mesh(new THREE.SphereGeometry(R * 0.3, 12, 8), mat(shade(u.cap, 0.7), { roughness: 0.4 }), g, [sx * R * 0.92, -R * 0.02, -R * 0.05]); e.scale.set(0.35, 1, 0.9); }
      if (this.p.look.jerseyNumber != null) { const n = mesh(new THREE.PlaneGeometry(R * 0.7, R * 0.7), new THREE.MeshStandardMaterial({ map: numberTexture(String(this.p.look.jerseyNumber), '#fff', '#111', ''), transparent: true }), g, [R * 0.99, R * 0.25, -R * 0.1], [0, Math.PI / 2, 0]); void n; }
    } else {
      const big = kind === 'footballHelmet' ? 1.24 : kind === 'cricketHelmet' ? 1.14 : 1.18;
      const dome = mesh(new THREE.SphereGeometry(R * big, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), shell, g); dome.scale.set(0.98, 1.05, 1.08); dome.rotation.x = -0.12;
      if (kind === 'footballHelmet') { for (const sx of [1, -1]) { const ear = mesh(new THREE.SphereGeometry(R * 0.55, 14, 10), shell, g, [sx * R * 0.8, -R * 0.3, 0]); ear.scale.set(0.45, 1, 1); } mesh(new THREE.BoxGeometry(R * 0.12, R * 0.06, R * 1.9), mat(u.trim), g, [0, R * big * 0.98, -R * 0.05], [-0.12, 0, 0]); }
      if (kind === 'hockeyHelmet' || kind === 'cricketHelmet') mesh(new THREE.CylinderGeometry(R * 0.7, R * 0.7, R * 0.05, 24, 1, false, -0.9, 1.8), shell, g, [0, R * 0.45, R * 0.62], [0.1, 0, 0]);
      // face guard bars
      const bars = kind === 'hockeyHelmet' ? 0 : kind === 'cricketHelmet' ? 3 : 4;
      for (let i = 0; i < bars; i++) { const b = mesh(new THREE.TorusGeometry(R * 0.98, R * 0.035, 6, 20, Math.PI * 0.85), cage, g, [0, -R * 0.05 - i * R * 0.2, R * 0.12], [-0.15, 0, Math.PI * 1.075]); b.scale.set(0.95, 1, 0.95); }
      if (kind === 'lacrosseHelmet' || kind === 'footballHelmet') { const chin = mesh(new THREE.SphereGeometry(R * 0.3, 12, 8), mat('#ffffff'), g, [0, -R * 0.82, R * 0.62]); chin.scale.set(1, 0.6, 0.6); }
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.headGroup.add(g); this.headwear = g;
  }

  /* -------------------------------------------------------------- pose application */
  applyPose(q) {
    const B = this.bones;
    this.root.position.set(q.x || 0, 0, q.z || 0); this.root.rotation.y = (q.ry || 0) * D2R;
    B.hips.position.y = this.len.hip; B.hips.rotation.set(q.hipsX * D2R, q.hipsY * D2R, q.hipsZ * D2R);
    B.spine.rotation.set(q.spineX * D2R, q.spineY * D2R, q.spineZ * D2R);
    B.chest.rotation.set(q.chestX * D2R, q.chestY * D2R, q.chestZ * D2R);
    B.neck.rotation.set(q.neckX * D2R, q.neckY * D2R, 0);
    B.head.rotation.set(q.headX * D2R, q.headY * D2R, q.headZ * D2R);
    for (const [s, sg] of [['l', 1], ['r', -1]]) {
      B[s + 'UpperArm'].rotation.set(-q[s + 'ShF'] * D2R, sg * q[s + 'ShR'] * D2R, sg * q[s + 'ShA'] * D2R);
      B[s + 'Forearm'].rotation.set(-q[s + 'El'] * D2R, sg * (q[s + 'FaR'] || 0) * D2R, 0);
      B[s + 'Hand'].rotation.set(-q[s + 'WrF'] * D2R, 0, sg * q[s + 'WrZ'] * D2R);
      B[s + 'Thigh'].rotation.set(-q[s + 'HipF'] * D2R, sg * q[s + 'HipR'] * D2R, sg * q[s + 'HipA'] * D2R);
      B[s + 'Shin'].rotation.set(q[s + 'Knee'] * D2R, 0, 0);
      B[s + 'Foot'].rotation.set(q[s + 'Ank'] * D2R, 0, 0);
    }
    if (q.joy !== undefined || q.focus !== undefined || q.sad !== undefined) this.setExpression(q);
    this.root.updateMatrixWorld(true);
    // keep the lowest sole point on the floor, then add the jump height
    const v = new THREE.Vector3(); let lo = Infinity;
    for (const o of [this.heel_l, this.toe_l, this.heel_r, this.toe_r]) { o.getWorldPosition(v); lo = Math.min(lo, v.y); }
    const ground = q.ground === undefined ? 0 : q.ground;
    B.hips.position.y += ground - lo + (q.air || 0);
    if (q.seat > 0) {   // sliding / lying poses: hips at an absolute height, but never push a foot through the floor
      B.hips.position.y = B.hips.position.y * (1 - q.seat) + (q.seatY || 0.3) * q.seat; this.root.updateMatrixWorld(true);
      let lo2 = Infinity; for (const o of [this.heel_l, this.toe_l, this.heel_r, this.toe_r]) { o.getWorldPosition(v); lo2 = Math.min(lo2, v.y); }
      if (lo2 < ground) B.hips.position.y += ground - lo2;
    }
    this.root.updateMatrixWorld(true);
  }

  /* -------------------------------------------------------------- two-bone IK (arms) */
  reach(side, target, pole, opts = {}) {
    const B = this.bones, ua = B[side + 'UpperArm'], fa = B[side + 'Forearm'], hd = B[side + 'Hand'];
    const w = opts.weight === undefined ? 1 : opts.weight; if (w <= 0) return;
    const fk = [ua.quaternion.clone(), fa.quaternion.clone(), hd.quaternion.clone()];
    const S = new THREE.Vector3(); ua.getWorldPosition(S);
    const a = this.len.upperArm, b = this.len.forearm + (opts.extra || 0.03 * this.p.H);
    const d = new THREE.Vector3().subVectors(target, S); let dist = d.length();
    dist = clamp(dist, Math.abs(a - b) + 1e-3, a + b - 1e-4);
    const dir = d.normalize();
    const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const pv = new THREE.Vector3().subVectors(pole, S); pv.sub(dir.clone().multiplyScalar(pv.dot(dir)));
    if (pv.lengthSq() < 1e-8) pv.set(0, -1, 0); pv.normalize();
    const elbow = S.clone().add(dir.clone().multiplyScalar(a * cosA)).add(pv.clone().multiplyScalar(a * sinA));
    const tgt = S.clone().add(dir.clone().multiplyScalar(dist));
    aimBone(ua, new THREE.Vector3().subVectors(elbow, S), pv.clone().negate());
    ua.updateMatrixWorld(true);
    aimBone(fa, new THREE.Vector3().subVectors(tgt, elbow), pv.clone().negate());
    fa.updateMatrixWorld(true);
    if (opts.handDir) { aimBone(hd, opts.handDir, opts.handUp || pv.clone().negate()); }
    if (w < 1) { ua.quaternion.slerpQuaternions(fk[0], ua.quaternion.clone(), w); fa.quaternion.slerpQuaternions(fk[1], fa.quaternion.clone(), w); hd.quaternion.slerpQuaternions(fk[2], hd.quaternion.clone(), w); }
    ua.updateMatrixWorld(true);
  }
  worldOf(obj, out = new THREE.Vector3()) { return obj.getWorldPosition(out); }
}

/* orient a bone so that its local -Y points along dir (world) and local +Z leans toward hint */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
export function aimBone(bone, dir, hint) {
  const y = dir.clone().normalize().negate();
  let z = hint.clone().sub(y.clone().multiplyScalar(hint.dot(y)));
  if (z.lengthSq() < 1e-8) z = Math.abs(y.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(y) : new THREE.Vector3(1, 0, 0).cross(y);
  z.normalize(); const x = new THREE.Vector3().crossVectors(y, z).normalize();
  _m.makeBasis(x, y, z); _q.setFromRotationMatrix(_m);
  bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_q));
}

export const BASE_POSE = {
  x: 0, z: 0, ry: 0, air: 0,
  hipsX: 0, hipsY: 0, hipsZ: 0, spineX: 2, spineY: 0, spineZ: 0, chestX: 2, chestY: 0, chestZ: 0, neckX: 0, neckY: 0, headX: -3, headY: 0, headZ: 0,
  lShF: 4, lShA: 8, lShR: 0, lEl: 14, lFaR: 0, lWrF: 4, lWrZ: 0, rShF: 4, rShA: 8, rShR: 0, rEl: 14, rFaR: 0, rWrF: 4, rWrZ: 0,
  lHipF: 4, lHipA: 4, lHipR: 0, lKnee: 7, lAnk: -2, rHipF: 4, rHipA: 4, rHipR: 0, rKnee: 7, rAnk: -2,
  joy: 0, focus: 0.35, sad: 0
};
