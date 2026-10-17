/* SmartAction Sports — 3D stage: renderer, venue, athlete, props and the orbiting camera. MIT. */
import * as THREE from '../vendor/three/three.module.min.js';
import { AthleteRig } from './rig.js';
import { MotionEnv } from './motion.js';
import { makeCourt, makeDiamond, makeLights, makeBasketball, makeBaseball, makeBat, makeGlove } from './scenes.js';
import { BASKETBALL_MOVES, BASKETBALL_SIGNATURE } from './moves-basketball.js';
import { BASEBALL_MOVES, BASEBALL_SIGNATURE, baseballMovesFor } from './moves-baseball.js';
import * as FIELD from './sports/field.js';
import * as RACKET from './sports/racket.js';
import * as GOALS from './sports/goals.js';
import * as SOLO from './sports/solo.js';

/* every sport library: { SPORTS, MOVES, SIGNATURE, movesFor(athlete), VENUES } */
const LIBRARIES = [
  { SPORTS: ['basketball'], MOVES: BASKETBALL_MOVES, SIGNATURE: BASKETBALL_SIGNATURE, movesFor: () => Object.keys(BASKETBALL_MOVES), VENUES: {} },
  { SPORTS: ['baseball'], MOVES: BASEBALL_MOVES, SIGNATURE: BASEBALL_SIGNATURE, movesFor: baseballMovesFor, VENUES: {} },
  FIELD, RACKET, GOALS, SOLO
];
const VENUES = Object.assign({}, ...LIBRARIES.map(l => l.VENUES || {}));
export function libraryFor(sport) { return LIBRARIES.find(l => (l.SPORTS || []).includes(sport)) || null; }
export function hasLibrary(sport) { const l = libraryFor(sport); return !!(l && Object.keys(l.MOVES || {}).length); }
export const MOVES = Object.fromEntries(LIBRARIES.flatMap(l => (l.SPORTS || []).map(s => [s, l.MOVES])));
export function signatureMove(athlete) {
  const l = libraryFor(athlete.sport); if (!l) return null;
  return (l.SIGNATURE || {})[athlete.id] || (l.movesFor ? l.movesFor(athlete)[0] : Object.keys(l.MOVES)[0]);
}
export function movesFor(athlete) { const l = libraryFor(athlete.sport); return l ? (l.movesFor ? l.movesFor(athlete) : Object.keys(l.MOVES)) : []; }

export class Stage3D {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.antialias !== false, preserveDrawingBuffer: !!opts.capture, powerPreference: 'high-performance', alpha: false });
    r.setPixelRatio(opts.pixelRatio || Math.min(2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = opts.shadows !== false; r.shadowMap.type = THREE.PCFSoftShadowMap; r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(opts.fov || 38, 16 / 9, 0.1, 600);
    this.venueKind = null; this.scene = null; this.rig = null; this.move = null; this.t = 0; this.extras = [];
    this.focus = new THREE.Vector3(0, 1.4, 0); this.radius = 7; this.angle = 0; this.elev = 0.16;
  }
  resize(w, h) { this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  _venue(kind) {
    if (this.venueKind === kind && this.scene) return;
    this.scene = new THREE.Scene(); this.venueKind = kind;
    const spec = VENUES[kind];
    this.lights = makeLights(this.scene, kind === 'court' || (spec && spec.indoor) ? 'court' : 'park');
    this.venue = kind === 'court' ? makeCourt(this.scene) : kind === 'diamond' ? makeDiamond(this.scene) : spec.build(this.scene);
    const ball = kind === 'court' ? makeBasketball() : kind === 'diamond' ? makeBaseball() : (spec.ball ? spec.ball() : new THREE.Group());
    const props = this.props = { ball, bat: makeBat(), glove: makeGlove(), mitt: makeGlove('#6b3f1d', true), cap: null, marker: null };
    this.scene.add(ball); this.scene.add(props.bat); props.bat.visible = false;
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: '#daef90', transparent: true, opacity: 0.8 }));
    marker.rotation.x = -Math.PI / 2; marker.visible = false; this.scene.add(marker); props.marker = marker;
  }

  load(athlete, moveId, uniform) {
    const lib = libraryFor(athlete.sport); if (!lib) throw new Error('No 3D library for ' + athlete.sport);
    const builders = lib.MOVES; moveId = builders[moveId] ? moveId : signatureMove(athlete);
    const move = builders[moveId](athlete);
    this._venue(move.venue);
    if (this.rig) { this.scene.remove(this.rig.root); }
    for (const k of ['glove', 'mitt']) if (this.props[k].parent) this.props[k].parent.remove(this.props[k]);
    if (this.props.loose) { this.scene.remove(this.props.loose); this.props.loose = null; }
    for (const o of this.extras) if (o.parent) o.parent.remove(o);
    this.extras = [];
    this.props.bat.visible = false; this.props.marker.visible = false; this.props.ball.visible = true;
    this.rig = new AthleteRig(athlete, athlete.sport, uniform || 'teal');
    this.scene.add(this.rig.root);
    this.env = new MotionEnv(this.rig, this.props, this.venue, !!move.mirror);
    this.env.scene = this.scene; this.env.athlete = athlete;
    /* props created by a move (rackets, sticks, clubs, pins…) are registered here and removed on the next load */
    this.env.addProp = (obj, parent) => { (parent || this.scene).add(obj); this.extras.push(obj); obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return obj; };
    this.move = move; this.moveId = moveId; this.athlete = athlete;
    if (move.start) move.start(this.env);
    this.frame(0); this.baseHeading = move.view !== undefined ? move.view : this.rig.root.rotation.y * 180 / Math.PI; return move;
  }
  get duration() { return this.move ? this.move.dur : 1; }

  /* deterministic: apply the move at time t (seconds) */
  frame(t) {
    this.t = t; const out = this.move.frame(Math.max(0, Math.min(this.move.dur, t)), this.env) || {};
    if (this.venue.hoop) this.venue.hoop.swish(Math.min(1, out.swish || 0));
    // stylized emotion: concentration while preparing, joy once the play is made (moves can override with out.mood)
    const d = this.move.dur, pay = this.move.payoff !== undefined ? this.move.payoff : d * 0.66;
    const mood = out.mood || (t < pay ? { focus: Math.min(1, 0.35 + t / Math.max(0.3, pay) * 0.65), joy: 0 } : { focus: 0, joy: Math.min(1, (t - pay) / 0.35) });
    this.rig.setExpression(mood);
    if (out.marker) { this.props.marker.visible = true; this.props.marker.position.copy(out.marker); } else this.props.marker.visible = false;
    if (out.focus) this.focus.copy(out.focus); if (out.radius) this.radius = out.radius;
    // follow jumps: keep the athlete's hips and hands in frame
    const hy = this.rig.bones.hips.getWorldPosition(this._v || (this._v = new THREE.Vector3())).y;
    if (!out.fixedY) this.focus.y = Math.max(this.focus.y, hy + 0.25 * this.rig.p.H / 1.85 + 0.15);
    this.lights.follow(this.rig.root.position);
    return out;
  }
  /* camera orbit around the focus point; angle in degrees, 0 = in front of the athlete's starting heading */
  placeCamera(angleDeg, zoom = 1) {
    const a = (angleDeg + (this.baseHeading || 0)) * Math.PI / 180, R = this.radius / zoom, c = this.camera;
    c.position.set(this.focus.x + Math.sin(a) * R, Math.max(0.6, this.focus.y + R * this.elev + 0.4), this.focus.z + Math.cos(a) * R);
    // never put the camera behind an outfield wall: rise above it instead
    if (this.venue && this.venue.wallR) { const d = Math.hypot(c.position.x, c.position.z); if (d > this.venue.wallR - 1.2) c.position.y = Math.max(c.position.y, this.venue.wallH + 3.2 + (d - this.venue.wallR) * 0.35); }
    // venues may keep the camera inside a box (squash court, bowling alley…): venue.clampCamera(position)
    if (this.venue && this.venue.clampCamera) this.venue.clampCamera(c.position);
    c.lookAt(this.focus);
    // basketball: when the camera passes behind the basket, the support pole would block the view — fade it out
    if (this.venue && this.venue.hoop) { const p = c.position, near = p.z < -1.0 ? 1 : p.z < 0.2 ? (0.2 - p.z) / 1.2 : 0, side = Math.abs(p.x) < 3.5 ? 1 : Math.max(0, 1 - (Math.abs(p.x) - 3.5) / 2); this.venue.hoop.ghost(Math.min(1, near * side)); }
    if (this.venue && this.venue.onCamera) this.venue.onCamera(c.position);
  }
  render() { this.renderer.render(this.scene, this.camera); }
}
