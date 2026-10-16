/* SmartAction Sports — basketball signature moves (stylized animation of publicly known playing styles). MIT. */
import * as THREE from '../vendor/three/three.module.min.js';
import { poseTrack, vecTrack, numTrack, gait, addPose, arc, dribbleY, headingTo, span, smooth, lerp, clamp } from './motion.js';

const RIM = new THREE.Vector3(0, 3.05, 0);
const READY = { lHipF: 24, rHipF: 24, lKnee: 34, rKnee: 34, lAnk: 9, rAnk: 9, spineX: 11, chestX: 4, lHipA: 8, rHipA: 8, headX: -10 };
const LOAD = { lHipF: 40, rHipF: 40, lKnee: 66, rKnee: 66, lAnk: 18, rAnk: 18, spineX: 15, chestX: 5, headX: -16, air: 0 };
const AIR = { lHipF: 8, rHipF: 8, lKnee: 12, rKnee: 12, lAnk: -38, rAnk: -38, spineX: 1, chestX: -2, headX: -14 };
const LAND = { lHipF: 30, rHipF: 30, lKnee: 46, rKnee: 46, lAnk: 12, rAnk: 12, spineX: 9, air: 0 };
const FOLLOW = { rShF: 168, rShA: 6, rEl: 12, rWrF: 78, lShF: 122, lShA: 14, lEl: 52, lWrF: 10 };
const ARMS_DOWN = { rShF: 20, rShA: 10, rEl: 30, rWrF: 10, lShF: 18, lShA: 10, lEl: 28, lWrF: 8 };

/* ball after it drops through the net: falls, bounces twice and rolls toward the court */
function afterNet(t, out) {
  const g = 9.8, y0 = 2.55, fall = Math.sqrt(2 * (y0 - 0.12) / g);
  if (t < fall) return out.set(0, y0 - 0.5 * g * t * t, 0.15 + t * 0.4);
  let tt = t - fall, v = g * fall * 0.55, y = 0.12, z = 0.15 + fall * 0.4;
  for (let b = 0; b < 3; b++) { const up = 2 * v / g; if (tt < up) { y = 0.12 + v * tt - 0.5 * g * tt * tt; z += tt * 0.9; return out.set(0, y, z + b * 0.1); } tt -= up; z += up * 0.9; v *= 0.5; }
  return out.set(0, 0.12, z + tt * 0.6);
}

/* Generic shot builder. Times in seconds; ball keys are local (athlete frame, 1.85 m scale). */
function shotMove(cfg) {
  const body = poseTrack(cfg.body), ball = vecTrack(cfg.ball);
  const poleR = vecTrack(cfg.poleR || [[0, [-0.9, 0.8, -0.3]], [cfg.rel - 0.25, [-0.5, 1.0, 0.4]], [cfg.rel, [-0.25, 1.5, 1.2]]]);
  const poleL = vecTrack(cfg.poleL || [[0, [0.9, 0.8, -0.3]], [cfg.rel, [0.7, 1.4, 0.6]]]);
  const ikR = numTrack(cfg.ikR || [[0, 1], [cfg.rel - 0.02, 1], [cfg.rel + 0.12, 0]]);
  const ikL = numTrack(cfg.ikL || [[0, 1], [cfg.rel - 0.12, 1], [cfg.rel + 0.05, 0]]);
  const handR = cfg.handR || [-0.03, -0.12, -0.06], handL = cfg.handL || [0.125, -0.01, -0.02];
  const flight = cfg.flight || 1.0, apex = cfg.apex || 1.4;
  let p0 = null, via = null;
  return {
    venue: 'court', dur: cfg.dur, hold: cfg.hold || 0.6,
    start(env) {
      const q = body(cfg.rel); env.pose(q); p0 = env.ws(ball(cfg.rel)).clone();
      via = cfg.bank ? env.W(cfg.bank[0], cfg.bank[1], cfg.bank[2]).clone() : null;
    },
    frame(t, env) {
      const q = body(t);
      if (cfg.dribble) for (const d of cfg.dribble) if (t >= d.from && t < d.to) q._drib = (t - d.from) / d.period;
      if (cfg.run) for (const r of cfg.run) if (t >= r.from && t < r.to) addPose(q, gait((t - r.from) / r.period + (r.phase || 0), r.k, true), Math.min(1, smooth(span(t, r.from, r.from + 0.15)) * (1 - smooth(span(t, r.to - 0.15, r.to)))));
      env.pose(q);
      const B = env.props.ball, out = { swish: 0 };
      if (t < cfg.rel) {
        let bl = ball(t);
        if (q._drib !== undefined) { const top = (cfg.dribbleTop || 0.95); bl = [bl[0], dribbleY(q._drib, top) / env.s, bl[2]]; }
        const bw = env.ws(bl); B.position.copy(bw);
        B.rotation.x -= 0.0;
        if (q._drib !== undefined) {
          const hand = bw.clone().add(env.dir([0, Math.max(0.12, (cfg.dribbleTop || 0.95) * env.s - bw.y + 0.02 + (env.rig.bones.hips.position.y - env.rig.len.hip)), -0.02]));
          env.reach('r', hand, [-1.0, 0.7, -0.5], { weight: 1 });
        } else {
          env.reach('r', bw.clone().add(env.dir(handR)), poleR(t), { weight: ikR(t) });
          env.reach('l', bw.clone().add(env.dir(handL)), poleL(t), { weight: ikL(t) });
        }
      } else {
        const u = (t - cfg.rel) / flight;
        env.reach('r', env.handPos('r'), poleR(t), { weight: ikR(t) });
        if (u <= 1) {
          if (via) { const k = 0.82; if (u < k) arc(p0, via, apex, u / k, B.position); else arc(via, new THREE.Vector3(RIM.x, RIM.y + 0.02, RIM.z), 0.05, (u - k) / (1 - k), B.position); }
          else arc(p0, new THREE.Vector3(RIM.x, RIM.y + 0.03, RIM.z), apex, u, B.position);
        } else { afterNet(t - cfg.rel - flight, B.position); }
        B.rotation.x -= 0.25;
        const tin = cfg.rel + flight; out.swish = t > tin - 0.05 ? Math.exp(-Math.pow((t - tin - 0.12) / 0.16, 2)) : 0;
      }
      if (cfg.extra) cfg.extra(t, env, out);
      const r = env.rig.root.position;
      out.focus = new THREE.Vector3(lerp(r.x, 0, 0.12), 1.35 + 0.25 * env.s, lerp(r.z, 0, 0.12));
      out.radius = Math.max(5.2, Math.hypot(r.x, r.z) * 0.45 + 3.6) * Math.max(1, env.s * 0.95);
      return out;
    }
  };
}
const at = (x, z, extra) => Object.assign({ x, z, ry: headingTo(x, z, 0, 0) }, extra || {});

/* ------------------------------------------------------------------ jumpers */
function jumper(o) {
  const [x, z] = o.pos, face = headingTo(x, z, 0, 0), back = o.turn ? face + 180 * (o.turn > 0 ? 1 : -1) * Math.abs(o.turn) : face;
  const q = o.quick ? 0.6 : 1, d0 = o.dribbles || 0, td = 0.45;
  const tg = 0.35 + d0 * td, tl = tg + 0.22 * q, tt = tl + 0.2 * q, rel = tt + (o.quick ? 0.17 : 0.26), tland = rel + 0.32, dur = tland + (o.celebrate ? 2.2 : 1.6);
  const fx = Math.sin(face * Math.PI / 180), fz = Math.cos(face * Math.PI / 180);
  const sb = o.stepBack || 0, fade = o.fade || 0;
  const pre = [x + fx * (sb - 0.0), z + fz * (sb - 0.0)], post = [x - fx * fade, z - fz * fade];
  const lean = -(o.lean || 0), oneLeg = o.oneLeg ? { rHipF: 78, rKnee: 92, rAnk: -20, lHipF: 4, lKnee: 4, lAnk: -40 } : {};
  const airH = (o.air || 0.42);
  const body = [
    [0, Object.assign({ x: pre[0], z: pre[1], ry: back }, READY, d0 ? { rShF: 30, rEl: 50 } : {})],
    [Math.max(0.05, tg - 0.25), { x: pre[0], z: pre[1], ry: back }],
    [tg, Object.assign({ x: x, z: z, ry: lerp(back, face, o.turn ? 0.4 : 1) }, READY, sb ? { air: 0.12 } : {})],
    [tl, Object.assign({ ry: face }, LOAD)],
    [tt, Object.assign({}, AIR, { air: airH * 0.6, spineX: lean * 0.4, rShF: 150, rShA: 10, rEl: 95, rWrF: -40, lShF: 140, lShA: 18, lEl: 85 })],
    [rel, Object.assign({}, AIR, { x: lerp(x, post[0], 0.6), z: lerp(z, post[1], 0.6), air: airH, spineX: lean, chestX: lean * 0.3, headX: -16, rShF: 165, rShA: 6, rEl: 25, rWrF: 20, lShF: 135, lShA: 16, lEl: 60 }, fade ? { lHipF: 28, rHipF: 28, lKnee: 34, rKnee: 34 } : {}, oneLeg, o.lean2 || {})],
    [rel + 0.14, Object.assign({}, FOLLOW, { air: airH * 0.7 })],
    [tland, Object.assign({ x: post[0], z: post[1] }, LAND, FOLLOW)],
    [tland + 0.5, Object.assign({}, READY, { rShF: 150, rEl: 20, rWrF: 70, lShF: 40, lEl: 35 })],
    [tland + 1.0, Object.assign({}, READY, ARMS_DOWN, { spineX: 4, lKnee: 12, rKnee: 12, lHipF: 8, rHipF: 8 })]
  ];
  if (o.celebrate) body.push([tland + 1.3, { ry: face + 170, rShF: 20, lShF: 20 }], [tland + 1.9, { ry: face + 175, rShF: 120, rShA: 30, rEl: 140, lShF: 120, lShA: 30, lEl: 140, headZ: 18, neckY: 10 }]);
  const set = o.setHigh ? [-0.08, 2.15, 0.12] : [-0.12, 1.98, 0.16];
  const ball = [[0, [-0.06, 1.12, 0.34]], [Math.max(0.05, tg - 0.25), [-0.06, 1.12, 0.34]], [tg, [-0.05, 1.12, 0.34]], [tl, [-0.08, 1.0, 0.36]], [tt, set], [rel, [-0.1, 2.28, 0.34]]];
  return shotMove({ dur, rel, body, ball, flight: o.flight || (Math.hypot(x, z) > 6 ? 1.15 : 0.95), apex: o.apex || (Math.hypot(x, z) > 6 ? 2.2 : 1.6),
    dribble: d0 ? [{ from: 0.1, to: 0.1 + d0 * td, period: td }] : null, bank: o.bank, hold: 0.5 });
}

/* ------------------------------------------------------------------ hooks (skyhook, baby hook, spin hook) */
function hook(o) {
  const [x, z] = o.pos, toHoop = headingTo(x, z, 0, 0), backTo = toHoop + 180, side = backTo + 90 - (o.spin ? 360 : 0), finalFace = side + 90;   // left shoulder to the rim
  const spin = o.spin ? 120 : 0, sky = o.sky;
  const tg = 0.9, tstep = 1.25, tt = 1.45, rel = sky ? 1.82 : 1.72, tland = rel + 0.35, dur = tland + 1.5;
  const sx = Math.sin(toHoop * Math.PI / 180), sz = Math.cos(toHoop * Math.PI / 180), step = sky ? 0.55 : 0.4;
  const body = [
    [0, Object.assign({ x, z, ry: backTo }, READY, { spineX: 18, lHipA: 14, rHipA: 14 })],
    [0.45, { rShF: 30, rEl: 50 }],
    [tg, Object.assign({ ry: backTo - spin }, READY, { spineX: 16 })],
    [tstep, { x: x + sx * step * 0.6, z: z + sz * step * 0.6, ry: side, lHipF: 40, lKnee: 45, rHipF: 10, rKnee: 25, spineX: 8, chestY: -10, headY: 70 }],
    [tt, { x: x + sx * step, z: z + sz * step, lHipF: 10, lKnee: 14, lAnk: -30, rHipF: sky ? 70 : 55, rKnee: 85, rAnk: -10, air: sky ? 0.3 : 0.25, spineZ: sky ? 14 : 8, chestZ: 8, spineX: 0, headY: 70, headX: -20 }],
    [rel, { air: sky ? 0.42 : 0.33, rShF: 175, rShA: 18, rEl: 5, rWrF: 60, lShF: 85, lShA: 45, lEl: 75, spineZ: sky ? 18 : 10 }],
    [rel + 0.2, { rShF: 172, rShA: 16, rEl: 8, rWrF: 70 }],
    [tland, Object.assign({}, LAND, { rShF: 150, rShA: 16, rEl: 20, spineZ: 4, headY: 50, lShF: 50, lShA: 30, lEl: 60 })],
    [tland + 0.8, Object.assign({ ry: finalFace }, READY, ARMS_DOWN, { headY: 0 })]
  ];
  const ball = [[0, [-0.05, 1.18, 0.36]], [0.3, [-0.1, 1.1, 0.4]], [tg, [-0.12, 1.15, 0.36]], [tstep, [-0.45, 1.25, 0.12]], [tt, [-0.55, 1.95, -0.02]], [rel, [sky ? -0.02 : -0.12, sky ? 2.62 : 2.38, 0.02]]];
  return shotMove({ dur, rel, body, ball, flight: sky ? 0.95 : 0.8, apex: sky ? 1.1 : 0.9, dribble: [{ from: 0.2, to: 0.65, period: 0.45 }],
    poleR: [[0, [-0.9, 0.8, -0.3]], [tstep, [-1.1, 1.0, -0.2]], [rel, [-1.0, 2.0, -0.3]]], poleL: [[0, [0.9, 0.8, -0.2]], [rel, [1.0, 1.0, 0.3]]],
    handR: [-0.02, -0.12, 0.0], ikL: [[0, 1], [tstep - 0.15, 1], [tstep + 0.05, 0]], ikR: [[0, 1], [rel - 0.02, 1], [rel + 0.15, 0]] });
}

/* ------------------------------------------------------------------ drives: layup, teardrop, dunks */
function drive(o) {
  const path = o.path, n = path.length, tEnd = o.tGather;
  const segs = []; let L = 0; for (let i = 1; i < n; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(d); L += d; }
  const at2 = u => { let d = u * L; for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const k = clamp(d / segs[i], 0, 1); return [lerp(path[i][0], path[i + 1][0], k), lerp(path[i][1], path[i + 1][1], k), headingTo(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1])]; } d -= segs[i]; } return path[n - 1]; };
  const keys = []; const steps = 10;
  for (let i = 0; i <= steps; i++) { const u = i / steps, p = at2(u); keys.push([o.t0 + u * (tEnd - o.t0), { x: p[0], z: p[1], ry: p[2] }]); }
  return keys;
}

function dunk(o) {
  const start = o.start, gx = o.gather[0], gz = o.gather[1], t0 = 0.3, tg = o.tg || 1.6, tj = tg + 0.28, tslam = tj + 0.36, thang = tslam + 0.35, tland = thang + 0.25, dur = tland + 1.4;
  const runKeys = drive({ path: [start].concat(o.via || []).concat([[gx, gz]]), t0, tGather: tg });
  const face = headingTo(gx, gz, 0, 0), sx = Math.sin(face * Math.PI / 180), sz = Math.cos(face * Math.PI / 180);
  const atRim = [0 - sx * 0.42, 0 - sz * 0.42], H2 = o.twoHand;
  const air = o.air || 0.85;
  const body = [[0, Object.assign({ x: start[0], z: start[1], ry: headingTo(start[0], start[1], gx, gz) }, READY)]].concat(runKeys).concat([
    [tg + 0.1, Object.assign({ ry: face }, LOAD, { spineX: 18 }, o.euro ? {} : {})],
    [tj, Object.assign({}, AIR, { x: lerp(gx, atRim[0], 0.5), z: lerp(gz, atRim[1], 0.5), air: air * 0.75, lHipF: 30, lKnee: 70, rHipF: 5, rKnee: 15 })],
    [tslam - 0.08, { x: atRim[0], z: atRim[1], air: air, spineX: -8, chestX: -6, headX: -18 }],
    [tslam, { air: air * 0.98, spineX: 14, chestX: 10, rShF: 150, rEl: 10, lShF: H2 ? 150 : 70, lEl: H2 ? 10 : 50, lKnee: 50, rKnee: 50 }],
    [thang, { air: air * 0.78, rShF: 175, rEl: 5, lShF: H2 ? 175 : 60, lEl: H2 ? 5 : 40, lHipF: 30, rHipF: 30, lKnee: 70, rKnee: 70, spineX: 4 }],
    [tland, Object.assign({}, LAND, { x: atRim[0] + sx * -0.5, z: atRim[1] + sz * -0.5, rShF: 60, lShF: 50 })],
    [tland + 0.6, Object.assign({}, READY, ARMS_DOWN, o.flex ? { rShF: 95, rShA: 70, rEl: 120, lShF: 95, lShA: 70, lEl: 120, spineX: -4, headX: 10 } : {})],
    [tland + 1.2, Object.assign({}, READY, ARMS_DOWN)]
  ]);
  if (o.euro) {   // two long lateral steps after the gather
    const e1 = [gx + 0.9, gz + 0.9], e2 = [gx - 0.3, gz - 0.6];
    body.splice(body.length - 7, 0, [tg - 0.35, { x: e1[0], z: e1[1], lHipF: 50, lKnee: 40, rHipF: -10, rKnee: 30, spineZ: 10, air: 0.1 }], [tg - 0.05, { x: e2[0], z: e2[1], rHipF: 50, rKnee: 40, lHipF: -10, lKnee: 30, spineZ: -10, air: 0.1 }]);
  }
  const cock = H2 ? [0.0, 2.35, -0.05] : [-0.12, 2.4, -0.28];
  const ballK = [[0, [-0.3, 0.9, 0.42]], [tg - 0.1, [-0.05, 1.15, 0.36]], [tg + 0.1, [-0.05, 1.1, 0.38]], [tj, H2 ? [0, 2.0, 0.3] : [-0.15, 2.2, -0.05]], [tslam - 0.12, cock], [tslam, [0, 2.15, 0.6]]];
  const ball = vecTrack(ballK), bodyT = poseTrack(body);
  const run = [{ from: t0, to: tg - (o.euro ? 0.4 : 0.05), period: 0.62, k: 0.9 }];
  return {
    venue: 'court', dur, hold: 0.5,
    frame(t, env) {
      const q = bodyT(t);
      for (const r of run) if (t >= r.from && t < r.to) addPose(q, gait((t - r.from) / r.period, r.k, true), Math.min(1, smooth(span(t, r.from, r.from + 0.2)) * (1 - smooth(span(t, r.to - 0.2, r.to)))));
      env.pose(q);
      const B = env.props.ball, out = { swish: 0 };
      if (t < tg - 0.1) {   // dribble while running
        const ph = (t - t0) / 0.62 * 2; const bl = [-0.32, dribbleY(ph, 0.95) / env.s, 0.5];
        const bw = env.ws(bl, false); B.position.copy(bw);
        env.reach('r', bw.clone().add(new THREE.Vector3(0, Math.max(0.12, 0.92 * env.s - bw.y + (env.rig.bones.hips.position.y - env.rig.len.hip)), 0)), [-1.0, 0.7, -0.5]);
      } else if (t < tslam + 0.04) {
        const bw = env.ws(ball(t)); B.position.copy(bw);
        if (t > tslam - 0.1) B.position.lerp(new THREE.Vector3(env.mirror ? -0 : 0, 3.1, 0.02), smooth(span(t, tslam - 0.1, tslam)));
        env.reach('r', B.position.clone().add(env.dir(H2 ? [-0.12, 0.02, -0.04] : [0, 0.11, -0.05])), [-0.8, 1.6, -0.4]);
        if (H2 || t < tj) env.reach('l', B.position.clone().add(env.dir(H2 ? [0.12, 0.02, -0.04] : [0.12, -0.01, -0.02])), [0.9, 1.4, -0.3]);
      } else {
        const tt = t - tslam - 0.04;
        if (tt < 0.3) B.position.set(0, 3.0 - 2.2 * tt * tt * 4, 0.05); else afterNet(tt - 0.3, B.position);
        out.swish = Math.exp(-Math.pow((t - tslam - 0.1) / 0.18, 2)) * 1.3;
        if (t < thang + 0.05) { env.reach('r', new THREE.Vector3(-0.08, 3.08, 0.2), [-0.8, 2.2, 0.3]); if (H2) env.reach('l', new THREE.Vector3(0.12, 3.08, 0.2), [0.8, 2.2, 0.3]); }
      }
      B.rotation.x -= 0.15;
      const r = env.rig.root.position;
      out.focus = new THREE.Vector3(lerp(r.x, 0, 0.35), 1.7, lerp(r.z, 0, 0.35));
      out.radius = Math.max(7, Math.hypot(r.x, r.z) * 0.7 + 5.2) * Math.max(1, env.s * 0.95);
      return out;
    }
  };
}

function layup(o) {   // drive + finger roll / teardrop
  const start = o.start, g = o.gather, t0 = 0.25, tg = o.tg || 1.7, rel = tg + (o.floater ? 0.42 : 0.5), tland = rel + 0.3, dur = tland + 1.4;
  const face = headingTo(g[0], g[1], 0, 0), sx = Math.sin(face * Math.PI / 180), sz = Math.cos(face * Math.PI / 180);
  const jump = [g[0] + sx * (o.floater ? 0.3 : 0.9), g[1] + sz * (o.floater ? 0.3 : 0.9)];
  const body = [[0, Object.assign({ x: start[0], z: start[1], ry: headingTo(start[0], start[1], g[0], g[1]) }, READY)]]
    .concat(drive({ path: [start].concat(o.via || []).concat([g]), t0, tGather: tg }))
    .concat([
      [tg + 0.2, Object.assign({ ry: face }, { lHipF: 45, lKnee: 50, rHipF: 5, rKnee: 30, spineX: 12, air: 0.05 })],
      [rel, Object.assign({}, AIR, { x: jump[0], z: jump[1], air: o.floater ? 0.38 : 0.62, lHipF: o.floater ? 20 : 80, lKnee: o.floater ? 30 : 95, rHipF: 4, rKnee: 8, rAnk: -40, spineX: 2, headX: -20 })],
      [rel + 0.15, Object.assign({}, FOLLOW, { air: o.floater ? 0.3 : 0.5, rWrF: o.floater ? 50 : 30 })],
      [tland, Object.assign({}, LAND, { rShF: 90, lShF: 40 })],
      [tland + 0.8, Object.assign({}, READY, ARMS_DOWN)]
    ]);
  const ball = [[0, [-0.3, 0.9, 0.42]], [tg - 0.1, [-0.05, 1.1, 0.38]], [tg + 0.2, [-0.05, 1.3, 0.35]], [rel, o.floater ? [-0.08, 2.32, 0.3] : [-0.06, 2.38, 0.42]]];
  const runs = [{ from: t0, to: tg - 0.05, period: 0.6, k: 0.85 }];
  const m = shotMove({ dur, rel, body, ball, flight: o.floater ? 0.85 : 0.5, apex: o.floater ? 1.25 : 0.35, bank: o.bank,
    dribble: [{ from: t0, to: tg - 0.12, period: 0.3 }], run: runs, ikL: [[0, 1], [rel - 0.18, 1], [rel - 0.02, 0]] });
  m.dribbleOffset = true; return m;
}

/* ------------------------------------------------------------------ no-look pass */
function noLook() {
  const start = [5.5, 12.5], end = [1.2, 5.0], t0 = 0.2, tg = 1.9, rel = 2.25, dur = 4.1;
  const body = [[0, Object.assign({ x: start[0], z: start[1], ry: headingTo(start[0], start[1], end[0], end[1]) }, READY)]]
    .concat(drive({ path: [start, end], t0, tGather: tg }))
    .concat([
      [tg + 0.15, Object.assign({}, READY, { headY: 70, neckY: 15, spineX: 10 })],
      [rel, { rShF: 70, rShA: 60, rEl: 10, rWrF: 40, headY: 75, chestY: 25, lShF: 30 }],
      [rel + 0.3, { rShF: 40, rShA: 40, rEl: 30, headY: 60 }],
      [rel + 0.9, Object.assign({}, READY, ARMS_DOWN, { headY: -40, chestY: -10 })],
      [rel + 1.6, Object.assign({}, READY, ARMS_DOWN, { headY: 0, chestY: 0, rShF: 160, rEl: 30, rShA: 20 })]
    ]);
  const ballT = vecTrack([[0, [-0.3, 0.9, 0.42]], [tg - 0.1, [-0.05, 1.15, 0.38]], [tg + 0.15, [-0.05, 1.15, 0.4]], [rel, [-0.55, 1.2, 0.25]]]);
  const bodyT = poseTrack(body); let p0 = null; const target = new THREE.Vector3(-6.5, 1.2, 5.5);
  return {
    venue: 'court', dur, hold: 0.4,
    start(env) { env.pose(bodyT(rel)); p0 = env.ws(ballT(rel)).clone(); },
    frame(t, env) {
      const q = bodyT(t); if (t > t0 && t < tg - 0.05) addPose(q, gait((t - t0) / 0.6, 0.8, true), smooth(span(t, t0, t0 + 0.2)) * (1 - smooth(span(t, tg - 0.25, tg - 0.05))));
      env.pose(q);
      const B = env.props.ball;
      if (t < tg - 0.1) { const bw = env.ws([-0.32, dribbleY((t - t0) / 0.3, 0.95) / env.s, 0.5], false); B.position.copy(bw); env.reach('r', bw.clone().add(new THREE.Vector3(0, Math.max(0.12, 0.92 * env.s - bw.y), 0)), [-1, 0.7, -0.5]); }
      else if (t < rel) { const bw = env.ws(ballT(t)); B.position.copy(bw); env.reach('r', bw.clone().add(env.dir([0.0, -0.06, -0.11])), [-1, 0.9, -0.4]); env.reach('l', bw.clone().add(env.dir([0.12, 0, 0])), [0.9, 0.9, -0.3], { weight: 1 - smooth(span(t, rel - 0.25, rel - 0.05)) }); }
      else { const u = Math.min(1, (t - rel) / 0.7); arc(p0, env.W(target.x, target.y, target.z), 0.25, u, B.position); }
      B.rotation.y += 0.1;
      const r = env.rig.root.position; return { focus: new THREE.Vector3(r.x * 0.8 - 1, 1.4, r.z * 0.8 + 1), radius: 8.5 * Math.max(1, env.s * 0.95), swish: 0, marker: env.W(target.x, 0.02, target.z) };
    }
  };
}

/* ------------------------------------------------------------------ catalogue: move id → builder, athlete → signature */
export const BASKETBALL_MOVES = {
  skyhook: () => hook({ pos: [1.9, 1.4], sky: true }),
  babyHook: () => hook({ pos: [-1.8, 1.3] }),
  spinHook: () => hook({ pos: [1.8, 1.6], spin: true }),
  fadeaway: () => jumper({ pos: [3.4, 3.4], dribbles: 2, fade: 0.7, lean: 14, air: 0.45 }),
  turnFadeaway: () => jumper({ pos: [-3.0, 2.6], dribbles: 1, turn: 1, fade: 0.6, lean: 12, air: 0.42 }),
  oneLegFadeaway: () => jumper({ pos: [3.6, 2.4], dribbles: 1, turn: -1, fade: 0.45, lean: 13, oneLeg: true, air: 0.36, setHigh: true }),
  somborShuffle: () => jumper({ pos: [-3.2, 3.0], dribbles: 1, turn: 1, fade: 0.35, lean: 8, oneLeg: true, air: 0.24, lean2: { spineZ: -10 } }),
  quickThree: () => jumper({ pos: [-2.6, 7.6], dribbles: 2, quick: true, air: 0.36, apex: 2.8, flight: 1.25, celebrate: true }),
  setThree: () => jumper({ pos: [-6.2, 3.2], dribbles: 0, air: 0.3, apex: 2.4, flight: 1.2 }),
  stepBackThree: () => jumper({ pos: [6.0, 4.2], dribbles: 2, stepBack: 0.9, air: 0.36, apex: 2.4, flight: 1.2 }),
  pullUp: () => jumper({ pos: [3.4, 4.3], dribbles: 2, air: 0.42 }),
  bankShot: () => jumper({ pos: [-3.0, 2.9], dribbles: 1, air: 0.32, apex: 0.9, flight: 0.85, bank: [-0.28, 3.42, -0.33] }),
  tomahawk: () => dunk({ start: [0.6, 11.5], gather: [0.4, 2.3], air: 0.95, flex: true }),
  euroDunk: () => dunk({ start: [5.5, 10.5], gather: [2.0, 3.6], via: [[4.0, 7.0]], euro: true, twoHand: true, air: 0.82, tg: 1.75 }),
  oneHandDunk: () => dunk({ start: [-0.5, 12], gather: [-0.3, 2.2], air: 0.68 }),
  teardrop: () => layup({ start: [0.3, 9.5], gather: [0.6, 3.6], floater: true }),
  crossLayup: () => layup({ start: [1.2, 8.0], gather: [-0.9, 2.6], via: [[-1.2, 6.2]], bank: [-0.22, 3.35, -0.33] }),
  noLookPass: () => noLook()
};
export const BASKETBALL_SIGNATURE = {
  'kareem-abdul-jabbar': 'skyhook', 'michael-jordan': 'fadeaway', 'kobe-bryant': 'turnFadeaway', 'dirk-nowitzki': 'oneLegFadeaway',
  'nikola-joki': 'somborShuffle', 'stephen-curry': 'quickThree', 'larry-bird': 'setThree', 'diana-taurasi': 'stepBackThree',
  'rui-hachimura': 'pullUp', 'tim-duncan': 'bankShot', 'lebron-james': 'tomahawk', 'giannis-antetokounmpo': 'euroDunk',
  'lisa-leslie': 'oneHandDunk', 'tony-parker': 'teardrop', 'jeremy-lin': 'crossLayup', 'magic-johnson': 'noLookPass',
  'yao-ming': 'babyHook', 'pau-gasol': 'spinHook'
};
