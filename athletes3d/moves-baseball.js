/* SmartAction Sports — baseball signature moves (stylized animation of publicly known playing styles). MIT.
   Authored for right-handers; left-handed batters/throwers are mirrored by the motion runtime. */
import * as THREE from '../vendor/three/three.module.min.js';
import { poseTrack, vecTrack, numTrack, gait, addPose, arc, headingTo, span, smooth, lerp, clamp } from './motion.js';
import { BATS_THROWS } from './rig.js';

const D2R = Math.PI / 180, MOUND = -18.2, MOUND_Y = 0.25, UPY = new THREE.Vector3(0, 1, 0);
const sideOf = (a, k) => (BATS_THROWS[a.id] || ['R', 'R'])[k];
function batDir(yaw, pitch) { const y = yaw * D2R, p = pitch * D2R; return [Math.cos(p) * Math.cos(y), Math.sin(p), Math.cos(p) * Math.sin(y)]; }
function setBat(env, knobLocal, yaw, pitch) {
  const bat = env.props.bat; bat.visible = true;
  const K = env.ws(knobLocal), D = env.dir(batDir(yaw, pitch)).normalize();
  bat.position.copy(K); bat.quaternion.setFromUnitVectors(UPY, D);
  return { K, D };
}
function attachGlove(env, side, big) {
  const g = big ? env.props.mitt : env.props.glove, hand = env.rig.bones[env.side(side) + 'Hand'];
  if (g.parent !== hand) { if (g.parent) g.parent.remove(g); hand.add(g); }
  g.position.set(0, -0.02, 0.03); g.rotation.set(0, 0, 0); g.scale.setScalar(env.s);
  return g;
}
/* pitched ball from the mound to a point, with late movement (x: arm side +, y: drop) */
function pitchPath(from, to, u, brk) {
  const p = new THREE.Vector3().lerpVectors(from, to, u); const late = u * u * u;
  p.x += (brk ? brk[0] : 0) * (late - u * 0.15); p.y += 4 * 0.35 * u * (1 - u) - (brk ? brk[1] : 0) * (late - u * 0.2);
  return p;
}
const STANCE = { lHipA: 15, rHipA: 15, lHipF: 22, rHipF: 22, lKnee: 24, rKnee: 26, lAnk: 6, rAnk: 6, spineX: 18, chestX: 6, headY: 72, neckY: 12, headX: -6, hipsY: -4 };

/* ------------------------------------------------------------------ batting */
function swing(a, o = {}) {
  const pre = o.ritual ? 1.5 : o.calledShot ? 1.6 : 0, tc = pre + 2.05, dur = tc + (o.slap ? 2.4 : 2.1);
  const kick = o.kick || 'toe', k = { none: [8, 10], toe: [26, 32], high: [62, 78], flamingo: [92, 100] }[kick];
  const kickStart = kick === 'flamingo' ? tc - 1.0 : tc - 0.55;
  const wide = o.stance === 'wide' ? 8 : o.stance === 'closed' ? -2 : 0, openSt = o.stance === 'open' ? 18 : o.stance === 'closed' ? -12 : 0;
  const x0 = -0.95, z0 = -0.2;
  const keys = [
    [0, Object.assign({ x: x0, z: z0, ry: 90 }, STANCE, { lHipA: 15 + wide, rHipA: 15 + wide, hipsY: -4 + openSt })],
    [tc - 0.9, { hipsY: -4 + openSt }],
    [kickStart, { hipsY: -14 + openSt * 0.5, chestY: -8, rKnee: 30, lKnee: 24 }],
    [kickStart + (kick === 'flamingo' ? 0.4 : 0.22), { lHipF: k[0], lKnee: k[1], lHipA: 6, lAnk: 25, rKnee: 30, hipsY: -18, chestY: -10, spineX: 16 }],
    [tc - 0.2, { lHipF: k[0] * (kick === 'flamingo' ? 0.95 : 0.6), lKnee: k[1] * (kick === 'flamingo' ? 0.95 : 0.6), hipsY: -20 }],
    [tc - 0.12, { lHipF: 14, lKnee: 14, lHipA: 22 + wide, lAnk: 0, hipsY: -12, chestY: -12, rKnee: 30 }],
    [tc, { hipsY: 52, chestY: 14, spineX: 18, spineZ: 10, rHipR: 30, rKnee: 36, rAnk: 26, lKnee: 8, headY: 42, neckY: 8, headX: 4 }],
    [tc + 0.12, { hipsY: 72, chestY: 26, spineZ: 6, headY: 30 }],
    [tc + 0.35, { hipsY: 84, chestY: 30, spineX: 10, spineZ: 4, rHipR: 40, rKnee: 40, rAnk: 34, headY: 26, headX: -10 }],
    [tc + 1.1, { hipsY: 80, chestY: 24, spineX: 8, headY: 22, headX: -14 }],
    [dur, Object.assign({}, { hipsY: 60, chestY: 10, spineX: 6, lHipA: 10, rHipA: 10, lKnee: 10, rKnee: 12, rAnk: 4, rHipR: 10, headY: 30 })]
  ];
  if (o.knee) keys.splice(6, 1, [tc, { hipsY: 50, chestY: 12, spineX: 22, spineZ: 14, rHipR: 30, rHipF: -8, rKnee: 92, rAnk: 40, lHipF: 72, lKnee: 98, lAnk: 20, headY: 42 }], [tc + 0.12, { rKnee: 95, lHipF: 75, lKnee: 100 }]),
    keys.splice(8, 1, [tc + 0.35, { hipsY: 78, chestY: 28, spineX: 14, rHipF: -8, rKnee: 95, rAnk: 40, lHipF: 74, lKnee: 100, headY: 26 }]);
  if (o.ritual) keys.splice(0, 1, [0, { x: x0, z: z0 - 0.35, ry: 90, hipsY: 25, chestY: 15, lHipA: 8, rHipA: 8, lKnee: 6, rKnee: 6, headY: 45, spineX: 2 }],
    [0.9, { headY: 45 }], [1.25, Object.assign({ x: x0, z: z0, chestY: 0 }, STANCE)]);
  if (o.calledShot) keys.splice(0, 1, [0, { x: x0, z: z0 - 0.2, ry: 90, lHipA: 8, rHipA: 8, lKnee: 6, rKnee: 6, headY: 40, headX: -10, lShF: 120, lShA: 30, lEl: 4, lWrF: -10 }],
    [1.0, { lShF: 125, lShA: 30, headY: 38 }], [1.35, Object.assign({ x: x0, z: z0 }, STANCE)]);
  if (o.slap) keys.push([tc + 0.55, { x: x0 - 0.9, z: z0 - 0.3, ry: 140, hipsY: 0, chestY: 0, rHipR: 0 }], [dur, { x: x0 - 4.2, z: z0 - 4.0, ry: 135 }]);
  const body = poseTrack(keys);
  const one = o.finish === 'one';
  const knob = vecTrack([
    [0, [-0.18, 1.32, 0.12]], [tc - 0.6, [-0.2, 1.34, 0.1]], [tc - 0.35, [-0.27, 1.36, 0.06]], [tc - 0.17, [-0.14, 1.14, 0.2]],
    [tc - 0.06, [0.05, 1.0, 0.34]], [tc, [0.26, 0.95, 0.38]], [tc + 0.08, [0.42, 1.02, 0.28]], [tc + 0.3, one ? [0.42, 1.48, 0.02] : [0.2, 1.46, -0.12]], [tc + 1.0, one ? [0.38, 1.38, 0.08] : [0.18, 1.4, -0.08]], [dur, [0.1, 1.0, 0.25]]]);
  const yaw = numTrack([[0, 200], [tc - 0.35, 206], [tc - 0.17, 186], [tc - 0.06, 136], [tc, 92], [tc + 0.08, 30], [tc + 0.3, one ? -30 : -78], [tc + 1.0, one ? -20 : -72], [dur, -10]]);
  const pitch = numTrack([[0, 62], [tc - 0.35, 54], [tc - 0.17, 26], [tc - 0.06, 6], [tc, -6], [tc + 0.08, 4], [tc + 0.3, one ? 58 : 40], [tc + 1.0, one ? 50 : 36], [dur, -40]]);
  const topIK = numTrack(one ? [[0, 1], [tc + 0.12, 1], [tc + 0.3, 0]] : [[0, 1], [dur, 1]]);
  const releaseT = tc - 0.42, flightT = 0.42;
  let C = null, R0 = null;
  const ritual = t => o.ritual && t < 1.25 ? 1 - smooth(span(t, 0.95, 1.25)) : 0, called = t => o.calledShot && t < 1.35 ? 1 - smooth(span(t, 1.05, 1.35)) : 0;
  return {
    venue: 'diamond', dur, mirror: sideOf(a, 0) === 'L', hold: 0.4,
    start(env) {
      env.rig.setHeadwear('helmet', env.mirror ? 'R' : 'L'); env.props.ball.visible = true;
      env.pose(body(tc)); const b = setBat(env, knob(tc), yaw(tc), pitch(tc)); C = b.K.clone().add(b.D.clone().multiplyScalar(0.68)); R0 = new THREE.Vector3(env.mirror ? 0.4 : -0.4, 1.95, MOUND + 1.3);
    },
    frame(t, env) {
      const q = body(t);
      if (o.slap && t > tc + 0.45) addPose(q, gait((t - tc - 0.45) / 0.5, 0.95, false), smooth(span(t, tc + 0.45, tc + 0.7)));
      env.pose(q);
      const wag = t < tc - 0.6 ? Math.sin(t * 5.5) : 0;
      let kL = knob(t), yw = yaw(t) + wag * 8, pt = pitch(t) + wag * 5;
      const rit = ritual(t), cs = called(t);
      if (rit > 0) { kL = [lerp(kL[0], 0.78, rit), lerp(kL[1], 1.36, rit), lerp(kL[2], 0.32, rit)]; yw = lerp(yw, 20, rit); pt = lerp(pt, 84, rit); }   // bat held upright at arm's length toward the pitcher
      if (cs > 0) { kL = [lerp(kL[0], -0.2, cs), lerp(kL[1], 1.0, cs), lerp(kL[2], 0.2, cs)]; yw = lerp(yw, 180, cs); pt = lerp(pt, -55, cs); }       // bat resting down while pointing
      let slapOff = o.slap && t > tc + 0.3;
      if (slapOff) {   // bat released, tumbles away
        const u = Math.min(1, (t - tc - 0.3) / 0.5), b = env.props.bat, Kw = env.ws([0.4, 1.1, 0.3], false);
        if (!this._drop) this._drop = Kw.clone(); b.position.set(this._drop.x - (env.mirror ? -0.6 : 0.6) * u, Math.max(0.03, 1.0 * (1 - u) + 0.6 * u * (1 - u)), this._drop.z + 0.6 * u); b.rotation.set(1.2 * u, 0.5, 1.5 + 2 * u);
      } else { this._drop = null;
        const { K, D } = setBat(env, kL, yw, pt);
        const bottom = K.clone().add(D.clone().multiplyScalar(0.07)), top = K.clone().add(D.clone().multiplyScalar(0.16));
        if (rit > 0.5) {
          env.reach('l', bottom, [0.5, 0.9, -0.2], { weight: 1 });
          const sleeve = env.bonePos(env.side('l') + 'UpperArm').lerp(env.bonePos(env.side('l') + 'Forearm'), 0.35);   // tug the sleeve
          env.reach('r', sleeve.add(env.dir([0, 0.02, 0.06])), [-0.6, 0.8, 0.2], { weight: 1 });
        }
        else if (cs > 0.5) { env.reach('r', bottom, [-0.6, 0.6, -0.2], { weight: 1 }); }
        else {
          env.reach('l', bottom, [0.75, 0.7, 0.35], { weight: 1 });
          env.reach('r', top, [-0.55, 0.55, -0.35], { weight: topIK(t) });
        }
      }
      // the pitch and the batted ball
      const B = env.props.ball;
      if (t < releaseT) B.position.set(0, -5, 0);
      else if (t < tc) B.position.copy(pitchPath(R0, C, (t - releaseT) / flightT, [0.15, 0.25]));
      else {
        const tt = t - tc, kind = o.slap ? 'grounder' : o.contact || 'hr', dirY = (env.mirror ? 1 : -1);
        const ang = kind === 'grounder' ? 30 : kind === 'line' ? 22 : 18, v = kind === 'grounder' ? 30 : kind === 'line' ? 40 : 46, la = kind === 'grounder' ? -6 : kind === 'line' ? 14 : 30;
        const h = new THREE.Vector3(Math.sin(ang * D2R) * dirY, 0, -Math.cos(ang * D2R));
        const vx = Math.cos(la * D2R) * v, vy = Math.sin(la * D2R) * v;
        let y = C.y + vy * tt - 4.9 * tt * tt;
        if (kind === 'grounder' && y < 0.04) { const tb = (vy + Math.sqrt(vy * vy + 2 * 9.8 * C.y)) / 9.8; const r = tt - tb; y = Math.max(0.04, Math.abs(Math.sin(r * 6)) * 0.4 * Math.exp(-r * 2)); }
        B.position.copy(C).addScaledVector(h, vx * tt); B.position.y = Math.max(0.04, y);
      }
      const r = env.rig.root.position;
      return { focus: new THREE.Vector3(r.x * 0.9 + (o.slap ? 0 : 0), 1.2 * env.s, r.z * 0.9), radius: 4.6 * Math.max(1, env.s), fixedY: false };
    }
  };
}

/* ------------------------------------------------------------------ pitching */
function pitch(a, o = {}) {
  const pause = o.pause ? 0.4 : 0, lift = o.leg === 'high' ? 1.15 : 1.0, tempo = o.tempo || 1;
  const tLift = 0.9, tTop = tLift + 0.5 * tempo, tStride = tTop + pause + 0.32 * tempo, tFoot = tStride + 0.16, tRel = tFoot + 0.13, tFin = tRel + 0.38, dur = tFin + 1.8;
  const slot = { over: [-0.12, 2.06], '34': [-0.42, 1.8], low34: [-0.72, 1.5] }[o.slot || '34'];
  const g = MOUND_Y, z0 = MOUND, s = 1;
  const keys = [
    [0, { x: 0, z: z0, ry: -90, ground: g, lHipA: 6, rHipA: 6, lKnee: 8, rKnee: 8, spineX: 6, headY: 80, neckY: 10, lShF: 40, lEl: 100, rShF: 40, rEl: 100 }],
    [tLift - 0.3, { headY: 78 }],
    [tLift, { lHipF: 20, lKnee: 30, spineX: 4 }],
    [tTop, { lHipF: 92 * lift, lKnee: 95, lAnk: 20, lHipA: 0, hipsY: -18, chestY: -10, rKnee: 16, spineX: 2, headY: 82 }],
    [tTop + pause, { lHipF: 88 * lift, lKnee: 92, hipsY: -20 }],
    [tStride, { x: 0, z: z0 + 0.35, lHipF: 40, lKnee: 30, lHipA: 32, lAnk: -10, rKnee: 30, rHipF: 10, hipsY: -12, chestY: -16, spineX: 0, spineZ: 8, headY: 80, lShF: 90, lShA: 30, lEl: 20 }],
    [tFoot, { z: z0 + 0.62, lHipF: 48, lKnee: 34, lHipA: 34, rKnee: 22, rHipF: -14, rHipA: 20, hipsY: 10, chestY: -10, spineZ: 4, headY: 70 }],
    [tRel, { ry: -10, z: z0 + 0.95, hipsY: 40, chestY: 25, spineX: 22, spineZ: -6, lKnee: 26, rHipF: -22, rKnee: 30, rAnk: 30, headY: 8, headX: -12, lShF: 40, lShA: 20, lEl: 100 }],
    [tFin, { ry: 0, z: z0 + 1.15, hipsY: 30, chestY: 20, spineX: 40, chestX: 10, lKnee: 34, lHipF: 50, rHipF: 10, rKnee: 70, rAnk: 20, headY: 0, headX: -22 }],
    [tFin + 0.5, { ry: 0, z: z0 + 1.35, hipsY: 0, chestY: 0, spineX: 18, chestX: 6, lHipF: 30, rHipF: 30, lKnee: 34, rKnee: 34, lHipA: 12, rHipA: 12, rAnk: 8, headX: -6, lShF: 40, lEl: 70 }],
    [dur, { spineX: 10, lKnee: 20, rKnee: 20, headX: -2 }]
  ];
  const body = poseTrack(keys);
  const Y = y => y * a.heightCm / 185 / 100 * 1 + g;   // scaled heights on the mound
  const hs = () => (a.heightCm || 185) / 185;
  const hand = vecTrack([
    [0, [-0.3, 1.32, z0]], [tLift, [-0.3, 1.36, z0]], [tTop, [-0.32, 1.42, z0 + 0.02]],
    [tTop + pause + 0.12 * tempo, [0.08, 1.02, z0 - 0.45]], [tStride, [0.2, 1.45, z0 - 0.75]], [tFoot, [0.1, 1.86, z0 - 0.5]],
    [tRel - 0.05, [slot[0] * 0.6, slot[1] - 0.04, z0 + 0.5]], [tRel, [slot[0], slot[1], z0 + 1.3]], [tRel + 0.1, [slot[0] * 0.4, slot[1] - 0.3, z0 + 1.75]], [tFin, [0.42, 0.62, z0 + 1.65]],
    [tFin + 0.55, [-0.12, 1.05, z0 + 1.75]], [dur, [-0.12, 1.05, z0 + 1.78]]]);
  const pole = vecTrack([[0, [-0.6, 0.9, z0 - 0.2]], [tTop, [-0.4, 0.9, z0 - 0.3]], [tStride, [0.3, 1.0, z0 - 1.0]], [tFoot, [0.2, 1.45, z0 - 1.1]], [tRel, [-1.2, 1.45, z0 + 0.6]], [tFin, [-0.5, 1.0, z0 + 1.6]], [dur, [-0.6, 0.6, z0 + 1.2]]]);
  const brk = { sinker: [0.32, 0.38], cutter: [-0.3, 0.12], curve: [-0.32, 1.05], slider: [-0.65, 0.35], fast: [0.1, 0.05], split: [0.05, 0.6] }[o.type || 'fast'];
  const fl = o.type === 'curve' ? 0.6 : o.type === 'slider' ? 0.5 : 0.44;
  let R = null; const target = new THREE.Vector3(0, 0.78, 0.35);
  return {
    venue: 'diamond', dur, mirror: o.mirror !== undefined ? o.mirror : sideOf(a, 1) === 'L', hold: 0.5,
    start(env) { env.rig.setHeadwear('cap'); attachGlove(env, 'l'); env.pose(body(tRel)); const h = hand(tRel); R = env.W(h[0] * hs(), h[1] * hs() + g, h[2]).clone(); },
    frame(t, env) {
      const q = body(t); env.pose(q);
      const h = hand(t), p = pole(t), H = hs();
      const T = env.W(h[0] * H, h[1] * H + g, h[2]), P = env.W(p[0] * H, p[1] * H + g, p[2]);
      env.rig.reach(env.side('r'), T, P, { weight: 1 });
      // glove hand stays with the ball until the hands break
      const B = env.props.ball;
      if (t < tTop + pause + 0.05) { const gT = env.W(h[0] * H + 0.05, h[1] * H + g - 0.02, h[2] + 0.12); env.rig.reach(env.side('l'), gT, env.W(0.3, 0.9 * H + g, z0 + 0.2)); }
      else if (t > tFin + 0.2) { const k = smooth(span(t, tFin + 0.2, tFin + 0.6)); env.rig.reach(env.side('l'), env.W(0.12, 1.08 * H + g, z0 + 1.82), env.W(0.8, 0.7 * H + g, z0 + 1.3), { weight: k }); }
      if (t < tRel) B.position.copy(env.handPos('r'));
      else { const u = (t - tRel) / fl; if (u <= 1) B.position.copy(pitchPath(R, env.W(target.x, target.y, target.z), u, env.mirror ? [-brk[0], brk[1]] : brk)); else B.position.set(env.mirror ? -brk[0] * 0.2 : brk[0] * 0.2, 0.7, 0.35 + (u - 1) * 0.4); }
      const r = env.rig.root.position;
      return { focus: new THREE.Vector3(r.x, 1.25 * H + g, r.z + 0.4), radius: 5.0 * Math.max(1, H), view: 0 };
    }
  };
}

/* ------------------------------------------------------------------ fielding helpers */
function throwArm(env, t, tStart, tRel, H, from, toward, height) {   // overhand throw driven by IK in the athlete frame
  const k = clamp((t - tStart) / (tRel - tStart), 0, 1.6);
  const back = [-0.35, 1.75, -0.45], rel = [-0.25, 1.85, 0.55], fin = [0.35, 0.8, 0.5];
  const p = k < 1 ? [lerp(back[0], rel[0], smooth(k)), lerp(back[1], rel[1], smooth(k)), lerp(back[2], rel[2], smooth(k))] : [lerp(rel[0], fin[0], smooth((k - 1) / 0.6)), lerp(rel[1], fin[1], smooth((k - 1) / 0.6)), lerp(rel[2], fin[2], smooth((k - 1) / 0.6))];
  env.reach('r', env.ws(p), k < 1 ? [-1.0, 1.0, -0.6] : [-0.9, 1.2, 0.6]);
}
function ballThrow(from, to, u, apexK, out) { const d = from.distanceTo(to); return arc(from, to, Math.max(0.3, d * (apexK || 0.06)), clamp(u, 0, 1), out); }

/* shortstop: field a grounder and throw to first (Ripken); jump throw from the hole (Jeter) */
function infield(a, o = {}) {
  const jump = o.jump, start = jump ? [-10.5, -31] : [-9.6, -30.5], fieldAt = jump ? [-13.6, -27.4] : [-9.2, -29.6];
  const tCatch = jump ? 1.75 : 1.55, tRel = jump ? tCatch + 0.62 : tCatch + 0.72, dur = tRel + 2.0;
  const faceHome = headingTo(fieldAt[0], fieldAt[1], 0, 0), face1B = headingTo(fieldAt[0], fieldAt[1], 19.4, -19.4);
  const keys = [
    [0, Object.assign({ x: start[0], z: start[1], ry: headingTo(start[0], start[1], 0, 0) }, { lHipA: 14, rHipA: 14, lHipF: 30, rHipF: 30, lKnee: 40, rKnee: 40, spineX: 30, lShF: 30, rShF: 30, lEl: 60, rEl: 60, headX: -4 })],
    [0.55, { lHipF: 34, rHipF: 34, lKnee: 46, rKnee: 46 }],
    [tCatch - 0.25, { x: fieldAt[0] + (jump ? 0.5 : 0.1), z: fieldAt[1] - (jump ? 0.4 : 0.1), ry: jump ? faceHome - 60 : faceHome }],
    [tCatch, Object.assign({ x: fieldAt[0], z: fieldAt[1], ry: jump ? faceHome - 75 : faceHome }, { lHipF: 70, rHipF: 60, lKnee: 85, rKnee: 95, lHipA: 22, rHipA: 22, spineX: 48, chestX: 10, headX: 20 })],
    [tCatch + 0.2, { spineX: 30, lKnee: 50, rKnee: 60, lHipF: 40, rHipF: 40 }],
    [tRel - 0.3, Object.assign({ ry: face1B - 70, air: jump ? 0.25 : 0 }, jump ? { lHipF: 60, lKnee: 80, rHipF: 20, rKnee: 30, spineX: 6 } : { lHipF: 30, rHipF: 10, lKnee: 30, rKnee: 25, spineX: 10 })],
    [tRel, Object.assign({ ry: face1B - 10, air: jump ? 0.55 : 0, x: fieldAt[0] + (jump ? -0.2 : 0.5), z: fieldAt[1] + (jump ? 0.35 : 0.3) }, { spineX: 18, hipsY: 30, chestY: 25, lHipF: 30, lKnee: 30, rHipF: jump ? 40 : -10, rKnee: jump ? 70 : 20, lShF: 40, lEl: 90 })],
    [tRel + 0.35, Object.assign({ air: 0, ry: face1B }, { spineX: 26, hipsY: 10, chestY: 10, lHipF: 40, lKnee: 40, rHipF: 20, rKnee: 40 })],
    [dur, { spineX: 10, lKnee: 14, rKnee: 14, lHipF: 10, rHipF: 10, hipsY: 0, chestY: 0, lShF: 20, lEl: 30 }]
  ];
  if (jump) keys.splice(2, 0, [0.9, { x: -12.2, z: -29.2, ry: faceHome - 60 }]);
  const body = poseTrack(keys);
  const hit = new THREE.Vector3(0, 0.9, -0.5), catchP = new THREE.Vector3(), first = new THREE.Vector3(19.4, 1.3, -19.4);
  let relP = null;
  return {
    venue: 'diamond', dur, mirror: sideOf(a, 1) === 'L', hold: 0.5,
    start(env) { env.rig.setHeadwear('cap'); attachGlove(env, 'l'); env.pose(body(tCatch)); catchP.copy(env.W(fieldAt[0], 0.2, fieldAt[1])); env.pose(body(tRel)); relP = env.handPos('r').clone(); },
    frame(t, env) {
      const q = body(t); if (t > 0.6 && t < tCatch - 0.2) addPose(q, gait((t - 0.6) / 0.42, 0.7, true), smooth(span(t, 0.6, 0.8)) * (1 - smooth(span(t, tCatch - 0.45, tCatch - 0.2))));
      env.pose(q);
      const B = env.props.ball, H = env.s;
      const gl = env.ws(jump ? [-0.7, 0.35, 0.35] : [0.0, 0.15, 0.55]);
      if (t < tCatch + 0.05) env.reach('l', t > tCatch - 0.5 ? gl : env.ws([0.35, 0.9, 0.4]), [0.9, 0.9, 0.2], { weight: smooth(span(t, tCatch - 0.6, tCatch - 0.3)) });
      if (t < tCatch) {   // grounder: two hops from the plate
        const u = clamp(t / tCatch, 0, 1); B.position.lerpVectors(env.W(hit.x, hit.y, hit.z), catchP, u); B.position.y = 0.04 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.9 * (1 - u) + 0.15 * u;
      } else if (t < tRel) {
        const k = smooth(span(t, tCatch + 0.05, tCatch + 0.3));
        if (k < 1) env.reach('l', env.ws([0.1, 1.2, 0.4]), [0.9, 0.9, -0.2]);
        throwArm(env, t, tCatch + 0.25, tRel, H);
        B.position.copy(t < tCatch + 0.2 ? env.handPos('l') : env.handPos('r'));
      } else { throwArm(env, t, tCatch + 0.25, tRel, H); ballThrow(relP, env.W(first.x, first.y, first.z), (t - tRel) / 0.85, 0.03, B.position); }
      const r = env.rig.root.position;
      return { focus: new THREE.Vector3(r.x, 1.1 * H, r.z), radius: 5.2 * Math.max(1, H) };
    }
  };
}

/* catcher: receive, pop up, throw to second (Molina / Piazza) */
function catcherThrow(a) {
  const tCatch = 1.6, tRel = tCatch + 0.62, dur = tRel + 2.0;
  const keys = [
    [0, { x: 0, z: 1.05, ry: 180, lHipA: 30, rHipA: 30, lHipF: 105, rHipF: 105, lKnee: 135, rKnee: 135, lAnk: 25, rAnk: 25, lHipR: -20, rHipR: -20, spineX: 20, headX: -8, seat: 0 }],
    [tCatch, {}],
    [tCatch + 0.22, { lHipF: 50, rHipF: 40, lKnee: 60, rKnee: 60, spineX: 12, ry: 170 }],
    [tRel - 0.12, { ry: 110, lHipF: 30, lKnee: 30, rHipF: 5, rKnee: 25, spineX: 8, hipsY: -20 }],
    [tRel, { ry: 168, z: 0.75, hipsY: 35, chestY: 22, spineX: 22, lHipF: 30, lKnee: 25, rHipF: -15, rKnee: 30, rAnk: 25 }],
    [tRel + 0.4, { ry: 180, z: 0.6, hipsY: 0, chestY: 0, spineX: 26, lHipF: 40, rHipF: 30, lKnee: 40, rKnee: 50 }],
    [dur, { spineX: 10, lHipF: 10, rHipF: 10, lKnee: 12, rKnee: 12, lHipA: 10, rHipA: 10 }]
  ];
  const body = poseTrack(keys); let relP = null; const R0 = new THREE.Vector3(-0.4, 1.9, MOUND + 1.3), second = new THREE.Vector3(0, 1.0, -38.6);
  return {
    venue: 'diamond', dur, mirror: false, hold: 0.5, view: 200,
    start(env) { env.rig.setHeadwear(null); attachGlove(env, 'l', true); const hw = env.rig.headGroup; this._mask = this._mask || makeMask(env); env.pose(body(tRel)); relP = env.handPos('r').clone(); },
    frame(t, env) {
      env.pose(body(t)); const B = env.props.ball, H = env.s;
      const mittT = env.ws([0.05, 0.85, 0.45]);
      if (t < tCatch + 0.25) env.reach('l', mittT, [0.9, 0.6, 0.0]);
      else if (t < tRel) env.reach('l', env.ws([0.15, 1.35, 0.35]), [0.9, 0.9, -0.2]);
      if (t < tCatch - 0.42) B.position.set(0, -5, 0);
      else if (t < tCatch) B.position.copy(pitchPath(R0, mittT, (t - tCatch + 0.42) / 0.42, [0.1, 0.2]));
      else if (t < tRel) { throwArm(env, t, tCatch + 0.18, tRel, H); B.position.copy(t < tCatch + 0.2 ? mittT : env.handPos('r')); }
      else { throwArm(env, t, tCatch + 0.18, tRel, H); ballThrow(relP, second, (t - tRel) / 1.05, 0.02, B.position); }
      if (t < tCatch + 0.2) env.reach('r', env.ws([-0.25, 0.7, 0.25]), [-0.9, 0.5, -0.2]);
      return { focus: new THREE.Vector3(0, 1.0 * H, 0.9), radius: 4.6 * Math.max(1, H) };
    }
  };
}
function makeMask(env) {   // catcher's helmet + face cage
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: env.rig.u.cap, roughness: 0.25 }), wire = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.4, metalness: 0.5 });
  const R = env.rig.headR;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.14, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), m); dome.scale.set(0.95, 1.05, 1.05); g.add(dome);
  for (let i = 0; i < 4; i++) { const bar = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, R * 0.04, 6, 20, Math.PI * 0.9), wire); bar.position.set(0, -R * 0.15 - i * R * 0.22, R * 0.05); bar.rotation.set(-0.15, 0, Math.PI * 1.05); bar.scale.set(0.95, 1, 0.9); g.add(bar); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  env.rig.headGroup.add(g); env.rig.headwear = g; return g;
}

/* outfield: The Catch (Mays), wall catch (Trout), cannon throw (Clemente) */
function theCatch(a) {
  const start = [0, -88], catchAt = [-1.2, -103.5], tCatch = 2.75, tRel = tCatch + 1.0, dur = tRel + 1.8;
  const keys = [
    [0, { x: start[0], z: start[1], ry: 0, lHipF: 20, rHipF: 20, lKnee: 25, rKnee: 25, spineX: 14, headX: -20 }],
    [0.45, { ry: 180, headY: 150 > 90 ? 70 : 0 }],
    [tCatch - 0.2, { x: catchAt[0], z: catchAt[1], ry: 185, headY: 35, headX: -25 }],
    [tCatch, { headY: 25, headX: -10, spineX: 18 }],
    [tCatch + 0.35, { ry: 190, spineX: 20, lKnee: 40, rKnee: 40, lHipF: 30, rHipF: 30, headY: 0 }],
    [tRel - 0.25, { ry: 330, x: catchAt[0] - 0.2, z: catchAt[1] - 0.4, hipsY: -30, lHipF: 40, lKnee: 40, rHipF: 20, rKnee: 30, spineX: 10 }],
    [tRel, { ry: 362, hipsY: 30, chestY: 20, spineX: 26, rHipF: -15, rKnee: 30, rAnk: 25, lHipF: 30, lKnee: 25, air: 0.05 }],
    [tRel + 0.4, { ry: 365, hipsY: 0, chestY: 0, spineX: 30, rHipF: 30, rKnee: 60, lHipF: 30, lKnee: 40, air: 0 }],
    [dur, { spineX: 12, lKnee: 16, rKnee: 16, lHipF: 10, rHipF: 10 }]
  ];
  const body = poseTrack(keys); let relP = null, catchP = null; const hitFrom = new THREE.Vector3(0, 1, -1), cut = new THREE.Vector3(-1, 2, -60);
  return {
    venue: 'diamond', dur, mirror: sideOf(a, 1) === 'L', hold: 0.6,
    start(env) { env.rig.setHeadwear('cap'); attachGlove(env, 'l'); env.pose(body(tCatch)); catchP = env.ws([0.05, 1.05, 0.45]).clone(); env.pose(body(tRel)); relP = env.handPos('r').clone(); },
    frame(t, env) {
      const q = body(t); if (t > 0.4 && t < tCatch - 0.1) addPose(q, gait((t - 0.4) / 0.5, 1, false), smooth(span(t, 0.4, 0.65)) * (1 - smooth(span(t, tCatch - 0.45, tCatch - 0.1))));
      env.pose(q); const B = env.props.ball, H = env.s;
      if (t > tCatch - 0.55 && t < tCatch + 0.4) { const basket = env.ws([0.05, 1.05, 0.45]); env.reach('l', basket, [0.9, 0.6, 0.1], { weight: smooth(span(t, tCatch - 0.55, tCatch - 0.25)) }); env.reach('r', basket.clone().add(env.dir([-0.12, 0.02, 0])), [-0.9, 0.6, 0.1], { weight: smooth(span(t, tCatch - 0.5, tCatch - 0.25)) * (1 - smooth(span(t, tCatch + 0.2, tCatch + 0.4))) }); }
      if (t < tCatch) { const u = t / tCatch; B.position.copy(arc(env.W(hitFrom.x, hitFrom.y, hitFrom.z), catchP, 32, u)); }
      else if (t < tRel) { if (t > tCatch + 0.4) throwArm(env, t, tCatch + 0.55, tRel, H); B.position.copy(t < tCatch + 0.45 ? catchP : env.handPos('r')); if (t < tCatch + 0.45) B.position.copy(env.ws([0.05, 1.05, 0.45])); }
      else { throwArm(env, t, tCatch + 0.55, tRel, H); ballThrow(relP, env.W(cut.x, cut.y, cut.z), (t - tRel) / 1.4, 0.05, B.position); }
      // his cap flies off while he runs (a famous detail of the play)
      const cap = env.rig.headwear;
      if (cap) { if (t > 1.1) { const u = t - 1.1; cap.position.set(0, Math.min(0.25, u * 0.8), -u * 2.2); cap.rotation.x = -u * 4; cap.visible = u < 1.2; } else { cap.position.set(0, 0, 0); cap.rotation.x = 0; cap.visible = true; } }
      const r = env.rig.root.position;
      return { focus: new THREE.Vector3(r.x, 1.2 * H, r.z), radius: 6.0 * Math.max(1, H) };
    }
  };
}
function wallCatch(a) {
  const wallZ = -(112 - 0.55), start = [3, -97], tPlant = 1.9, tJump = 2.08, tCatch = 2.3, tLand = 2.62, dur = tLand + 2.0;
  const keys = [
    [0, { x: start[0], z: start[1], ry: 180, spineX: 12, headX: -20, headY: 0 }],
    [tPlant - 0.1, { x: 3.1, z: wallZ + 0.65, ry: 180 }],
    [tPlant, { lHipF: 50, rHipF: 50, lKnee: 70, rKnee: 70, spineX: 18, lShF: -20, rShF: -20 }],
    [tJump, Object.assign({}, { lHipF: 30, rHipF: 5, lKnee: 60, rKnee: 10, rAnk: -40, lAnk: -20, spineX: -4, air: 0.45, headX: -40 })],
    [tCatch, { air: 0.78, lHipF: 40, lKnee: 70, rHipF: 10, rKnee: 30, rShF: 40, rShA: 30, rEl: 60, spineX: 4 }],
    [tLand - 0.05, { air: 0.2 }],
    [tLand, Object.assign({ air: 0 }, { lHipF: 45, rHipF: 45, lKnee: 70, rKnee: 70, spineX: 20 })],
    [tLand + 0.5, { ry: 0, lHipF: 10, rHipF: 10, lKnee: 12, rKnee: 12, spineX: 4, headX: 0 }],
    [dur, { ry: 0 }]
  ];
  const body = poseTrack(keys); let gloveP = null; const hitFrom = new THREE.Vector3(0, 1, -1);
  return {
    venue: 'diamond', dur, mirror: sideOf(a, 1) === 'L', hold: 0.6, orbit: { base: 180, sweep: 65 },
    start(env) { env.rig.setHeadwear('cap'); attachGlove(env, 'l'); env.pose(body(tCatch)); gloveP = env.W(3.05, 3.42, wallZ - 0.35).clone(); },
    frame(t, env) {
      const q = body(t); if (t > 0.1 && t < tPlant - 0.05) addPose(q, gait(t / 0.48, 1, false), smooth(span(t, 0.1, 0.3)) * (1 - smooth(span(t, tPlant - 0.3, tPlant - 0.05))));
      env.pose(q); const B = env.props.ball, H = env.s;
      const reachW = smooth(span(t, tJump - 0.1, tJump + 0.1)) * (1 - smooth(span(t, tLand + 0.1, tLand + 0.4)));
      if (reachW > 0) env.reach('l', gloveP.clone().setY(gloveP.y - (1 - smooth(span(t, tJump, tCatch))) * 0.6 + (env.rig.bones.hips.position.y - env.rig.len.hip) - 0.78 + (t > tCatch ? 0 : 0)), [0.9, 2.2, 0.3], { weight: reachW });
      if (t > tLand + 0.4) env.reach('l', env.ws([0.25, 2.25, 0.25]), [1, 1.5, 0], { weight: smooth(span(t, tLand + 0.4, tLand + 0.8)) });
      if (t < tCatch) B.position.copy(arc(env.W(hitFrom.x, hitFrom.y, hitFrom.z), gloveP, 34, t / tCatch));
      else B.position.copy(env.handPos('l')).add(new THREE.Vector3(0, 0.02, 0));
      const r = env.rig.root.position;
      return { focus: new THREE.Vector3(r.x, Math.max(1.5, 1.2 * H + (env.rig.bones.hips.position.y - env.rig.len.hip)), r.z + 1.2), radius: 6.2 * Math.max(1, H), fixedY: false };
    }
  };
}
function cannon(a) {
  const start = [31, -64], fieldAt = [28.6, -58.2], tField = 1.7, tRel = tField + 0.75, dur = tRel + 2.0;
  const toThird = headingTo(fieldAt[0], fieldAt[1], -19.4, -19.4), toHome = headingTo(start[0], start[1], 0, 0);
  const keys = [
    [0, { x: start[0], z: start[1], ry: toHome, spineX: 12, lHipF: 20, rHipF: 20, lKnee: 25, rKnee: 25 }],
    [tField - 0.15, { x: fieldAt[0] + 0.3, z: fieldAt[1] - 0.6, ry: toHome }],
    [tField, { x: fieldAt[0], z: fieldAt[1], lHipF: 70, rHipF: 30, lKnee: 70, rKnee: 60, spineX: 45, headX: 20 }],
    [tField + 0.25, { ry: toThird - 80, spineX: 14, lHipF: 30, lKnee: 30, rHipF: 30, rKnee: 30, air: 0.18 }],
    [tRel - 0.1, { x: fieldAt[0] - 0.9, z: fieldAt[1] + 0.5, ry: toThird - 85, air: 0, lHipF: 45, lKnee: 30, rHipF: 0, rKnee: 25, hipsY: -15 }],
    [tRel, { ry: toThird - 10, hipsY: 40, chestY: 25, spineX: 24, rHipF: -20, rKnee: 30, rAnk: 30, lHipF: 30, lKnee: 20 }],
    [tRel + 0.4, { ry: toThird, hipsY: 10, chestY: 10, spineX: 34, rHipF: 40, rKnee: 70, lKnee: 40 }],
    [dur, { spineX: 12, lKnee: 14, rKnee: 14, lHipF: 10, rHipF: 10, hipsY: 0, chestY: 0 }]
  ];
  const body = poseTrack(keys); let relP = null, gP = null; const third = new THREE.Vector3(-19.4, 1.0, -19.4);
  return {
    venue: 'diamond', dur, mirror: sideOf(a, 1) === 'L', hold: 0.6,
    start(env) { env.rig.setHeadwear('cap'); attachGlove(env, 'l'); env.pose(body(tField)); gP = env.ws([0, 0.15, 0.6]).clone(); env.pose(body(tRel)); relP = env.handPos('r').clone(); },
    frame(t, env) {
      const q = body(t); if (t > 0.1 && t < tField - 0.1) addPose(q, gait(t / 0.45, 0.9, false), smooth(span(t, 0.1, 0.3)) * (1 - smooth(span(t, tField - 0.35, tField - 0.1))));
      env.pose(q); const B = env.props.ball, H = env.s;
      if (t > tField - 0.5 && t < tField + 0.2) env.reach('l', env.ws([0, 0.15, 0.6]), [0.9, 0.8, 0.3], { weight: smooth(span(t, tField - 0.5, tField - 0.25)) });
      if (t < tField) { const u = t / tField; B.position.lerpVectors(env.W(14, 0.1, -40), gP, u); B.position.y = 0.05 + Math.abs(Math.sin(u * 7)) * 0.5 * (1 - u); }
      else if (t < tRel) { throwArm(env, t, tField + 0.25, tRel, H); B.position.copy(t < tField + 0.2 ? gP : env.handPos('r')); }
      else { throwArm(env, t, tField + 0.25, tRel, H); ballThrow(relP, env.W(third.x, third.y, third.z), (t - tRel) / 1.9, 0.08, B.position); }
      const r = env.rig.root.position;
      return { focus: new THREE.Vector3(r.x, 1.15 * H, r.z), radius: 5.6 * Math.max(1, H) };
    }
  };
}
/* steal of home with a hook slide (Jackie Robinson) */
function stealHome(a) {
  const start = [-16.6, -17.2], tGo = 1.1, tSlide = 3.05, tPlate = 3.45, dur = tPlate + 1.6;
  const toHome = headingTo(start[0], start[1], -0.6, -0.4);
  const keys = [
    [0, { x: start[0], z: start[1], ry: toHome + 80, lHipA: 18, rHipA: 18, lHipF: 30, rHipF: 30, lKnee: 40, rKnee: 40, spineX: 26, lShF: 20, rShF: 20, lEl: 40, rEl: 40, headY: -70 }],
    [0.6, { x: start[0] + 0.5, z: start[1] + 0.5, headY: -60 }],
    [tGo, { ry: toHome, headY: 0 }],
    [tSlide, { x: -2.6, z: -2.3, ry: toHome }],
    [tSlide + 0.15, { hipsX: -30, lHipF: 60, lKnee: 10, rHipF: 25, rKnee: 100, spineX: -25, chestX: -10, headX: 30, lShF: 140, lShA: 20, lEl: 10, rShF: 60, rShA: 50, rEl: 20, seat: 0.8, seatY: 0.32 }],
    [tPlate, { x: -0.55, z: -0.5, hipsX: -40, lHipF: 62, lKnee: 4, rHipF: 30, rKnee: 105, spineX: -25, seat: 1, seatY: 0.26 }],
    [tPlate + 0.6, { seat: 1, seatY: 0.26 }],
    [dur, { seat: 0.6, seatY: 0.45, hipsX: -10, spineX: -20, lHipF: 60, lKnee: 30, rHipF: 50, rKnee: 70, lShF: 60, rShF: 160, rShA: 30, rEl: 10, headX: 0 }]
  ];
  const body = poseTrack(keys); const R0 = new THREE.Vector3(-0.4, 1.9, MOUND + 1.3);
  return {
    venue: 'diamond', dur, mirror: false, hold: 0.6,
    start(env) { env.rig.setHeadwear('helmet', 'L'); },
    frame(t, env) {
      const q = body(t); if (t > tGo - 0.2 && t < tSlide + 0.05) addPose(q, gait((t - tGo) / 0.42, 1, false), smooth(span(t, tGo - 0.2, tGo + 0.1)) * (1 - smooth(span(t, tSlide - 0.15, tSlide + 0.05))));
      env.pose(q);
      const B = env.props.ball; const rel = 2.6, u = (t - rel) / 0.5;
      if (t < rel) B.position.set(0, -5, 0); else if (u < 1) B.position.copy(pitchPath(R0, new THREE.Vector3(0.1, 0.6, 0.6), u, [0.1, 0.2])); else B.position.set(0.1, 0.6, 0.6);
      const r = env.rig.root.position;
      return { focus: new THREE.Vector3(r.x, 1.0 * env.s, r.z), radius: 6.0 * Math.max(1, env.s) };
    }
  };
}

/* ------------------------------------------------------------------ catalogue */
export const BASEBALL_MOVES = {
  swing: a => swing(a, { kick: 'toe' }),
  flamingo: a => swing(a, { kick: 'flamingo', finish: 'high' }),
  ichiroSlap: a => swing(a, { kick: 'none', ritual: true, slap: true }),
  calledShot: a => swing(a, { kick: 'toe', calledShot: true, contact: 'hr' }),
  powerSwing: a => swing(a, { kick: 'toe', finish: 'high', contact: 'hr' }),
  oneHandFinish: a => swing(a, { kick: 'toe', finish: 'one', contact: 'hr' }),
  legKickSwing: a => swing(a, { kick: 'high', contact: 'line' }),
  wideStance: a => swing(a, { kick: 'none', stance: 'wide', finish: 'one', contact: 'hr' }),
  closedStance: a => swing(a, { kick: 'toe', stance: 'closed', contact: 'line' }),
  kneeHomer: a => swing(a, { kick: 'toe', knee: true, contact: 'hr' }),
  sinker: a => pitch(a, { slot: '34', type: 'sinker' }),
  cutter: a => pitch(a, { slot: '34', type: 'cutter', tempo: 1.1 }),
  curveHitch: a => pitch(a, { slot: 'over', type: 'curve', pause: true }),
  slider: a => pitch(a, { slot: '34', type: 'slider', leg: 'high' }),
  lowSlot: a => pitch(a, { slot: 'low34', type: 'fast', leg: 'high' }),
  fastball: a => pitch(a, { slot: '34', type: 'fast' }),
  twoWayPitch: a => pitch(a, { slot: '34', type: 'split', mirror: false, leg: 'high' }),
  fieldThrow: a => infield(a, {}),
  jumpThrow: a => infield(a, { jump: true }),
  catcherThrow: a => catcherThrow(a),
  theCatch: a => theCatch(a),
  wallCatch: a => wallCatch(a),
  cannon: a => cannon(a),
  stealHome: a => stealHome(a)
};
export const BASEBALL_SIGNATURE = {
  'shohei-ohtani': 'oneHandFinish', 'ichiro-suzuki': 'ichiroSlap', 'babe-ruth': 'calledShot', 'chien-ming-wang': 'sinker', 'mariano-rivera': 'cutter',
  'manny-ramirez': 'closedStance', 'derek-jeter': 'jumpThrow', 'ken-griffey-jr': 'powerSwing', 'sadaharu-oh': 'flamingo', 'peng-cheng-min': 'closedStance',
  'wang-po-jung': 'legKickSwing', 'chen-wei-yin': 'fastball', 'aaron-judge': 'powerSwing', 'mike-trout': 'wallCatch', 'hideki-matsui': 'powerSwing',
  'mike-piazza': 'oneHandFinish', 'yadier-molina': 'catcherThrow', 'albert-pujols': 'wideStance', 'jackie-robinson': 'stealHome', 'jose-altuve': 'legKickSwing',
  'cal-ripken-jr': 'fieldThrow', 'adrian-beltre': 'kneeHomer', 'willie-mays': 'theCatch', 'roberto-clemente': 'cannon', 'mookie-betts': 'legKickSwing',
  'yu-darvish': 'slider', 'clayton-kershaw': 'curveHitch', 'randy-johnson': 'lowSlot'
};
const PITCH = ['sinker', 'cutter', 'curveHitch', 'slider', 'lowSlot', 'fastball'], BAT = ['swing', 'flamingo', 'ichiroSlap', 'calledShot', 'powerSwing', 'oneHandFinish', 'legKickSwing', 'wideStance', 'closedStance', 'kneeHomer'];
export function baseballMovesFor(a) {
  const sig = BASEBALL_SIGNATURE[a.id] || 'swing', pos = a.position;
  const list = [sig];
  if (a.id === 'shohei-ohtani') list.push('twoWayPitch');
  if (pos === 'P') list.push(...PITCH.filter(m => m !== sig)); else list.push(...BAT.filter(m => m !== sig));
  for (const m of ['fieldThrow', 'jumpThrow', 'catcherThrow', 'theCatch', 'wallCatch', 'cannon', 'stealHome']) if (!list.includes(m)) list.push(m);
  return list;
}
