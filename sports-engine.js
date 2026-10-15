/* SmartAction Sports v7 — original CPU practice simulations, MIT.
   29 simplified skill drills (plus 3×3 / 5×5 basketball in game-core.js). These are practice
   games with local computer opponents, not licensed league games, official rules or biometric models. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SASports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var DIFFICULTY = {
    easy:   { speed: 3.1, accuracy: 0.62, defense: 0.20, reaction: 0.24, zoneRate: 0.74, pitchSpeed: 0.78, window: 0.15, reach: 0.34 },
    normal: { speed: 3.9, accuracy: 0.79, defense: 0.38, reaction: 0.14, zoneRate: 0.64, pitchSpeed: 0.90, window: 0.11, reach: 0.30 },
    hard:   { speed: 4.7, accuracy: 0.91, defense: 0.58, reaction: 0.06, zoneRate: 0.55, pitchSpeed: 1.00, window: 0.08, reach: 0.26 }
  };
  var GRAVITY = 9.81;
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function finite(n, f) { return Number.isFinite(n) ? n : f; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  function bounds(x, z) { return { minX: -x, maxX: x, minZ: -z, maxZ: z }; }
  function rating(p, key) {
    var r = p.gameRatings || {};
    var v = key === 'accuracy' ? finite(r.accuracy, finite(r.skill, 70)) : finite(r[key], 70);
    return clamp(v, 35, 99);
  }
  var EV = { O: 'olympic', A: 'asianGames', E: 'eastAsian', W: 'winterOlympic', P: 'pro' };

  /* ---- Sport catalogue -------------------------------------------------------------------- */
  var sports = [
    { id: 'soccer5', family: 'goal', teamSize: 5, fieldType: 'goal', bounds: bounds(11, 17), kind: 'soccer', radius: 0.22, goalWidth: 5, goalHeight: 2.5, events: [EV.O, EV.A, EV.E] },
    { id: 'baseball', family: 'batting', teamSize: 5, fieldType: 'baseball', bounds: { minX: -30, maxX: 30, minZ: -27, maxZ: 17 }, kind: 'baseball', radius: 0.075, events: [EV.O, EV.A],
      batting: { plateZ: 13, moundZ: -1.2, releaseY: 1.85, underhand: false, bounce: false, fence: 38, fenceHeight: 2.6, exit: 24, zone: { halfWidth: 0.32, bottom: 0.45, top: 1.15 }, ballVisual: 0.075,
        pitches: [['fastball', 1.0, 0, 0], ['curveball', 0.84, 0.05, -0.42], ['slider', 0.92, 0.36, -0.1], ['changeup', 0.78, -0.08, -0.16]] } },
    { id: 'badminton', family: 'net', teamSize: 1, fieldType: 'net', bounds: bounds(3.05, 6.7), kind: 'shuttle', radius: 0.12, netHeight: 1.55, bounces: 0, events: [EV.O, EV.A, EV.E] },
    { id: 'badminton-doubles', family: 'net', teamSize: 2, fieldType: 'net', bounds: bounds(3.05, 6.7), kind: 'shuttle', radius: 0.12, netHeight: 1.55, bounces: 0, events: [EV.O, EV.A, EV.E] },
    { id: 'tabletennis', family: 'net', teamSize: 1, fieldType: 'net', bounds: bounds(2.2, 4), kind: 'tabletennis', radius: 0.10, netHeight: 0.9, bounces: 1, events: [EV.O, EV.A, EV.E] },
    { id: 'tabletennis-doubles', family: 'net', teamSize: 2, fieldType: 'net', bounds: bounds(2.2, 4), kind: 'tabletennis', radius: 0.10, netHeight: 0.9, bounces: 1, events: [EV.O, EV.A, EV.E] },
    { id: 'tennis', family: 'net', teamSize: 1, fieldType: 'net', bounds: bounds(5.5, 11), kind: 'tennis', radius: 0.13, netHeight: 1, bounces: 1, events: [EV.O, EV.A, EV.E] },
    { id: 'tennis-doubles', family: 'net', teamSize: 2, fieldType: 'net', bounds: bounds(5.5, 11), kind: 'tennis', radius: 0.13, netHeight: 1, bounces: 1, events: [EV.O, EV.A, EV.E] },
    { id: 'american-football', family: 'carry', teamSize: 5, fieldType: 'touchdown', bounds: bounds(10, 20), kind: 'oval', radius: 0.24, events: [EV.P] },
    { id: 'ice-hockey', family: 'goal', teamSize: 4, fieldType: 'ice', bounds: bounds(10, 17), kind: 'puck', radius: 0.16, goalWidth: 3.6, goalHeight: 1.5, events: [EV.W, EV.P] },
    { id: 'rugby', family: 'carry', teamSize: 5, fieldType: 'rugby', bounds: bounds(10, 20), kind: 'oval', radius: 0.24, events: [EV.O, EV.A, EV.E] },
    { id: 'volleyball', family: 'net', teamSize: 3, fieldType: 'volleyball', bounds: bounds(4.5, 9), kind: 'volleyball', radius: 0.22, netHeight: 2.43, bounces: 0, events: [EV.O, EV.A, EV.E] },
    { id: 'handball', family: 'goal', teamSize: 4, fieldType: 'goal', bounds: bounds(9, 16), kind: 'handball', radius: 0.18, goalWidth: 4, goalHeight: 2.4, events: [EV.O, EV.A] },
    { id: 'sprint', family: 'race', teamSize: 1, fieldType: 'sprint', bounds: bounds(4, 16), kind: 'marker', radius: 0.1, events: [EV.O, EV.A, EV.E] },
    { id: 'archery', family: 'target', teamSize: 1, fieldType: 'target', bounds: bounds(5, 14), kind: 'arrow', radius: 0.09, events: [EV.O, EV.A] },
    /* v7 additions — Olympic / Asian Games / East Asian Games ball sports */
    { id: 'field-hockey', family: 'goal', teamSize: 5, fieldType: 'hockey', bounds: bounds(11, 17), kind: 'hockeyball', radius: 0.075, goalWidth: 3.66, goalHeight: 2.14, stick: 'hockey', lowBall: true, events: [EV.O, EV.A, EV.E] },
    { id: 'water-polo', family: 'goal', teamSize: 4, fieldType: 'pool', bounds: bounds(8, 14), kind: 'waterpolo', radius: 0.11, goalWidth: 3, goalHeight: 0.9, swim: true, events: [EV.O, EV.A] },
    { id: 'softball', family: 'batting', teamSize: 5, fieldType: 'softball', bounds: { minX: -24, maxX: 24, minZ: -20, maxZ: 17 }, kind: 'softball', radius: 0.097, events: [EV.O, EV.A],
      batting: { plateZ: 13, moundZ: 3.2, releaseY: 0.7, underhand: true, bounce: false, fence: 32, fenceHeight: 2.2, exit: 20, zone: { halfWidth: 0.34, bottom: 0.45, top: 1.2 }, ballVisual: 0.097,
        pitches: [['fastball', 1.0, 0, 0.05], ['riseball', 0.9, 0.04, 0.42], ['dropball', 0.88, -0.04, -0.4], ['changeup', 0.72, 0, 0.1]] } },
    { id: 'beach-volleyball', family: 'net', teamSize: 2, fieldType: 'beach', bounds: bounds(4, 8), kind: 'volleyball', radius: 0.22, netHeight: 2.43, bounces: 0, events: [EV.O, EV.A] },
    { id: 'golf', family: 'golf', teamSize: 1, fieldType: 'green', bounds: { minX: -14, maxX: 14, minZ: -26, maxZ: 14 }, kind: 'golf', radius: 0.045, hole: { x: 1.5, z: -21 }, tee: { x: 0, z: 11 }, events: [EV.O, EV.A, EV.E] },
    { id: 'cricket', family: 'batting', teamSize: 5, fieldType: 'cricket', bounds: { minX: -34, maxX: 34, minZ: -30, maxZ: 22 }, kind: 'cricketball', radius: 0.072, events: [EV.O, EV.A],
      batting: { plateZ: 13, moundZ: -3.5, releaseY: 2.15, underhand: false, bounce: true, fence: 36, fenceHeight: 0.4, exit: 22, zone: { halfWidth: 0.42, bottom: 0.15, top: 1.35 }, ballVisual: 0.072, stumps: { z: 13.75, halfWidth: 0.115, height: 0.72 },
        pitches: [['fastball', 1.0, 0, 0], ['bouncer', 0.96, 0.06, 0.55], ['yorker', 0.94, 0, -0.5], ['spin', 0.7, 0.4, -0.05]] } },
    { id: 'sepak-takraw', family: 'net', teamSize: 3, fieldType: 'takraw', bounds: bounds(3.05, 6.7), kind: 'rattan', radius: 0.07, netHeight: 1.52, bounces: 0, kick: true, events: [EV.A] },
    { id: 'squash', family: 'wall', teamSize: 1, fieldType: 'squash', bounds: bounds(3.2, 4.9), kind: 'squash', radius: 0.04, tin: 0.48, outLine: 4.57, events: [EV.O, EV.A, EV.E] },
    { id: 'lacrosse', family: 'goal', teamSize: 5, fieldType: 'lacrosse', bounds: bounds(11, 17), kind: 'lacrosse', radius: 0.065, goalWidth: 1.83, goalHeight: 1.83, stick: 'lacrosse', events: [EV.O] },
    { id: 'bowling', family: 'lane', teamSize: 1, fieldType: 'lane', bounds: { minX: -1.2, maxX: 1.2, minZ: -10.5, maxZ: 9.5 }, kind: 'bowlingball', radius: 0.108, foulZ: 7.6, pinZ: -8.6, events: [EV.A, EV.E] },
    { id: 'soft-tennis', family: 'net', teamSize: 2, fieldType: 'net', bounds: bounds(5.5, 11), kind: 'softtennis', radius: 0.13, netHeight: 1.07, bounces: 1, slow: true, events: [EV.A, EV.E] },
    { id: 'billiards', family: 'cue', teamSize: 1, fieldType: 'table', bounds: bounds(1.905, 3.81), kind: 'cueball', radius: 0.0857, events: [EV.A, EV.E] },
    { id: 'flag-football', family: 'carry', teamSize: 5, fieldType: 'touchdown', bounds: bounds(10, 20), kind: 'oval', radius: 0.24, flag: true, events: [EV.O] }
  ].map(function (s) { s.key = 'sport_' + s.id; s.ruleKey = 'rule_' + s.id; return s; });

  /* ---- Core ------------------------------------------------------------------------------- */
  function Core(options) {
    options = options || {};
    this.spec = sports.find(function (s) { return s.id === options.sport; }) || sports[0];
    this.sport = this.spec.id;
    this.difficulty = DIFFICULTY[options.difficulty] ? options.difficulty : 'easy';
    this.seed = (Number(options.seed) >>> 0) || 531923;
    this.duration = clamp(finite(options.duration, 180), 10, 900);
    this.rosters = copy(options.rosters || []);
    this.reset();
  }
  Core.prototype._random = function () { var x = this._rng >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this._rng = x >>> 0; return this._rng / 4294967296; };
  Core.prototype._event = function (type, data) { this._events.push(Object.assign({ type: type, time: this.clock, sport: this.sport }, data || {})); if (this._events.length > 80) this._events.shift(); };
  Core.prototype.consumeEvents = function () { var e = this._events; this._events = []; return e; };
  Object.defineProperty(Core.prototype, 'selectedPlayer', { get: function () { return this.players[this.selectedId]; } });
  Core.prototype._profile = function (i) {
    var team = i < this.spec.teamSize ? 0 : 1, slot = i % this.spec.teamSize, r = this.rosters;
    var raw = (Array.isArray(r[team]) ? r[team][slot] : r[i]) || {};
    if (typeof raw === 'string') raw = { name: raw };
    var ratings = raw.gameRatings || raw.ratings || {};
    return { name: String(raw.name || ('Player ' + (slot + 1))).slice(0, 100), athleteId: raw.id || raw.athleteId || null,
      heightCm: clamp(finite(raw.heightCm, 182), 145, 235), weightKg: clamp(finite(raw.weightKg, 78), 40, 170),
      handedness: raw.handedness === 'left' ? 'left' : 'right',
      gameRatings: { speed: clamp(finite(ratings.speed, 70), 35, 99), power: clamp(finite(ratings.power, 70), 35, 99), accuracy: clamp(finite(ratings.accuracy, finite(ratings.skill, 70)), 35, 99), defense: clamp(finite(ratings.defense, 70), 35, 99) },
      appearance: raw.appearance ? copy(raw.appearance) : null, ratingBasis: 'fictional-game-balance' };
  };
  Core.prototype.reset = function () {
    this._rng = this.seed; this.clock = 0; this.timeRemaining = this.duration; this.shotClock = 40; this.score = [0, 0]; this.shotCharge = 0;
    this.selectedId = 0; this.possessionTeam = 0; this.ended = false; this._events = []; this._lastInput = {}; this._resetDelay = 0; this._nextTeam = 0;
    this._flight = null; this._rally = null; this._pitchTimer = 1.2; this._raceLastAction = null; this._raceBoost = 0; this._turn = 0;
    this.metrics = { rally: 0, longestRally: 0, hits: 0, strikes: 0, balls: 0, outs: 0, inning: 1, runs: 0, homeRuns: 0, wickets: 0, deliveries: 0, pitches: 0, bestDistance: 0, lastDistance: 0,
      swingTiming: 0, timingError: 0, contactQuality: 0, exitVelocity: 0, launchAngle: 0, pitchType: '', pitchSpeed: 0, lastResult: '', arrows: 0, lastRing: 0, wind: 0, windX: 0,
      strokes: 0, holeStrokes: 0, holes: 0, distanceToHole: 0, pins: 0, frame: 1, roll: 1, strikesBowl: 0, spares: 0, pocketed: 0, scratches: 0, turn: 0, practice: true };
    this.players = [];
    for (var i = 0; i < this.spec.teamSize * 2; i++) {
      this.players.push(Object.assign({ id: i, team: i < this.spec.teamSize ? 0 : 1, number: i % this.spec.teamSize + 1, x: 0, y: 0, z: 0, vx: 0, vz: 0,
        angle: i < this.spec.teamSize ? Math.PI : 0, armAngle: 0, torsoAngle: 0, shoulderAngle: 0, aimX: 0, aimZ: 0, stamina: 1, jumpTime: 0, crouching: false,
        action: 'idle', actionTime: 0, cooldown: 0, aiTimer: 0.4 + this._random() }, this._profile(i)));
    }
    this.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, holder: 0, ownerId: 0, state: 'held', kind: this.spec.kind, radius: this.spec.radius, lastTeam: 0 };
    this.objects = [];
    this._restart(0);
    return this;
  };

  /* ---- Positioning ------------------------------------------------------------------------ */
  Core.prototype._restart = function (team) {
    var s = this.spec, n = s.teamSize, b = s.bounds, self = this;
    this._flight = null; this._rally = null; this._resetDelay = 0; this._nextTeam = team; this.possessionTeam = team; this.shotClock = 40; this.shotCharge = 0;
    if (s.family !== 'batting') this.selectedId = 0;
    for (var i = 0; i < this.players.length; i++) {
      var p = this.players[i], slot = i % n, side = p.team === 0 ? 1 : -1;
      p.x = n === 1 ? 0 : (slot - (n - 1) / 2) * Math.min(3, (b.maxX - b.minX) * 0.62 / n);
      p.z = side * b.maxZ * (slot === 0 ? 0.28 : 0.58);
      p.y = 0; p.vx = p.vz = 0; p.jumpTime = 0; p.cooldown = 0; p.action = 'idle'; p.actionTime = 0; p.stamina = Math.max(0.65, p.stamina);
      p.aiTimer = 0.35 + this._random() * 0.4; p.angle = p.armAngle = p.team === 0 ? Math.PI : 0; p.torsoAngle = 0; p.shoulderAngle = 0;
    }
    if (s.family === 'net') {
      this.players.forEach(function (p) { p.z = (p.team === 0 ? 1 : -1) * b.maxZ * 0.69; p.x = n === 1 ? 0 : (p.id % n - (n - 1) / 2) * b.maxX; });
      this.metrics.rally = 0; this._take(this.players[team * n]);
      this._rally = { bounces: 0, lastTeam: team, lastId: team * n, crossed: false, lastBounceTeam: null };
    } else if (s.family === 'batting') this._battingRestart();
    else if (s.family === 'race') {
      this.players[0].x = -1.5; this.players[1].x = 1.5; this.players.forEach(function (p) { p.z = 14; });
      this.ball.holder = null; this.ball.state = 'marker'; this.ball.x = 0; this.ball.z = -14; this.ball.y = 0.2; this._raceBoost = 0; this._raceLastAction = null;
    } else if (s.family === 'target') {
      this.players[0].x = 0; this.players[0].z = 9; this.players[1].x = 3; this.players[1].z = 9; this._take(this.players[0]);
      this.metrics.wind = (this._random() - 0.5) * 0.5; this.metrics.aimX = 0; this.metrics.aimY = 0;
    } else if (s.family === 'wall') {
      this.players[0].x = -1.2; this.players[0].z = 1.6; this.players[1].x = 1.2; this.players[1].z = 1.6;
      this.players.forEach(function (p) { p.angle = p.armAngle = Math.PI; });
      this._take(this.players[team]); this.metrics.rally = 0;
      this._rally = { lastTeam: team, lastId: team, floorBounces: 0, hitWall: false, serve: true };
    } else if (s.family === 'golf') this._golfRestart();
    else if (s.family === 'lane') this._laneRestart();
    else if (s.family === 'cue') this._cueRestart();
    else this._take(this.players[team * n]);
    this._syncBall();
    void self;
  };
  Core.prototype._take = function (p) {
    this.ball.holder = p.id; this.ball.ownerId = p.id; this.ball.lastTeam = p.team; this.ball.state = 'held'; this.ball.vx = this.ball.vy = this.ball.vz = 0;
    this.possessionTeam = p.team; this._flight = null;
    if (p.team === 0 && this.spec.family !== 'batting') this.selectedId = p.id;
    this._syncBall();
  };
  Core.prototype._syncBall = function () {
    if (this.ball.holder === null) return;
    var p = this.players[this.ball.holder], k = this.spec.kind;
    var low = k === 'puck' || k === 'hockeyball' ? 0.09 : k === 'soccer' || k === 'rattan' ? 0.22 : k === 'waterpolo' ? 0.35 : k === 'lacrosse' ? 1.35 : k === 'golf' ? 0.05 : k === 'bowlingball' ? 0.75 : 1.1;
    var reach = this.spec.stick ? 0.75 : 0.4;
    this.ball.x = p.x + Math.sin(p.armAngle) * reach; this.ball.z = p.z + Math.cos(p.armAngle) * reach; this.ball.y = p.y + low;
  };
  Core.prototype._move = function (p, dx, dz, speed, dt) {
    var m = Math.hypot(dx, dz); if (m > 1) { dx /= m; dz /= m; }
    var b = this.spec.bounds, k = Math.min(1, dt * (this.spec.kind === 'puck' ? 5 : this.spec.swim ? 4 : 13));
    p.vx += (dx * speed - p.vx) * k; p.vz += (dz * speed - p.vz) * k;
    p.x = clamp(p.x + p.vx * dt, b.minX + 0.2, b.maxX - 0.2); p.z = clamp(p.z + p.vz * dt, b.minZ + 0.2, b.maxZ - 0.2);
    if (this.spec.family === 'net') p.z = p.team === 0 ? Math.max(0.65, p.z) : Math.min(-0.65, p.z);
    if (this.spec.family === 'wall') p.z = Math.max(b.minZ + 0.9, p.z);
    if (Math.abs(p.vx) + Math.abs(p.vz) > 0.2) { p.angle = Math.atan2(p.vx, p.vz); if (!p.actionTime) p.action = this.spec.swim ? 'swim' : 'run'; }
    else if (!p.actionTime) p.action = 'idle';
  };
  Core.prototype._toward = function (p, x, z, speed, dt) { var dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); this._move(p, dx / Math.max(d, 1), dz / Math.max(d, 1), speed, dt); };
  Core.prototype._point = function (team, points, style, playerId, delay) {
    if (this._resetDelay > 0) return;
    this.score[team] += points;
    this._event('score', { team: team, points: points, style: style, playerId: playerId === undefined ? team * this.spec.teamSize : playerId, highlight: true });
    this._nextTeam = 1 - team; this._resetDelay = delay || 1.0; this.ball.holder = null; this.ball.state = 'scored'; this.shotCharge = 0;
  };
  Core.prototype._jump = function (p) { if (p.jumpTime > 0) return; p.jumpTime = 0.65; p.action = 'jump'; p.actionTime = 0.65; };

  /* ---- Goal / carry families -------------------------------------------------------------- */
  Core.prototype._pass = function (p, ax, az) {
    if (this.ball.holder !== p.id || p.cooldown > 0) return false;
    var candidates = this.players.filter(function (q) { return q.team === p.team && q.id !== p.id; });
    if (this.sport === 'rugby') candidates = candidates.filter(function (q) { return (q.z - p.z) * (p.team === 0 ? 1 : -1) >= -0.05; });
    if (!candidates.length) { this._event('hint', { key: this.sport === 'rugby' ? 'backward_pass' : 'no_receiver' }); return false; }
    candidates.sort(function (a, b) { function merit(q) { return ax * (q.x - p.x) + az * (q.z - p.z) - dist(p, q) * 0.12; } return merit(b) - merit(a); });
    var q = candidates[0], t = clamp(dist(p, q) / 12, 0.18, 0.9);
    this._flight = { type: 'pass', elapsed: 0, duration: t, fromX: p.x, fromZ: p.z, fromY: this.ball.y, targetId: q.id, team: p.team };
    this.ball.holder = null; this.ball.state = 'pass'; p.action = 'pass'; p.actionTime = 0.4; p.cooldown = 0.45;
    this._event('pass', { team: p.team, playerId: p.id, targetId: q.id });
    return true;
  };
  Core.prototype._defend = function (p, dt) {
    if (this.ball.holder === null || p.cooldown > 0) return;
    var q = this.players[this.ball.holder];
    if (q.team === p.team || dist(p, q) > 1.05) return;
    var factor = (p.team === 0 ? 0.8 : DIFFICULTY[this.difficulty].defense) * (0.8 + rating(p, 'defense') / 350);
    if (this._random() < factor * dt * 1.8) {
      p.cooldown = 0.9; q.cooldown = 0.5;
      if (this.spec.family === 'carry') {
        this._event(this.spec.flag ? 'flagPull' : 'tackle', { team: p.team, playerId: p.id }); this._nextTeam = p.team; this._resetDelay = 0.55;
      } else { this._take(p); this.shotClock = 40; this._event('steal', { team: p.team, playerId: p.id }); }
    }
  };
  Core.prototype._goalShot = function (p, charge, isAI, ax, az) {
    if (this.ball.holder !== p.id || p.cooldown > 0) return false;
    var s = this.spec, b = s.bounds, targetZ = p.team === 0 ? b.minZ - 0.3 : b.maxZ + 0.3, dir = p.team === 0 ? -1 : 1, d = Math.abs(targetZ - p.z);
    var skill = isAI ? DIFFICULTY[this.difficulty].accuracy : 0.92 - Math.abs(charge - 0.65) * 0.25;
    skill *= 0.9 + rating(p, 'accuracy') / 700;
    var aim = Math.hypot(ax, az), targetX = aim > 0.18 ? p.x + ax / (Math.abs(az) + 0.6) * Math.min(d, 9) : 0;
    if (isAI) targetX = (this._random() - 0.5) * s.goalWidth * 0.65;
    targetX += (this._random() - 0.5) * (1 - skill) * 8;
    var speed = s.kind === 'puck' ? 16 : s.lowBall ? 14 : s.swim ? 10 : 12, t = clamp(Math.hypot(targetX - p.x, targetZ - p.z) / speed, 0.2, 2.8);
    var y = s.kind === 'puck' || s.lowBall ? 0.09 : s.kind === 'handball' || s.kind === 'lacrosse' ? 1.35 : s.swim ? 0.5 : 0.35;
    this.ball.x = p.x; this.ball.z = p.z + dir * 0.4; this.ball.y = y + p.y;
    this.ball.vx = (targetX - this.ball.x) / t; this.ball.vz = (targetZ - this.ball.z) / t;
    var flat = s.kind === 'puck' || s.lowBall;
    this.ball.vy = flat ? 0 : (((s.kind === 'handball' || s.kind === 'lacrosse') ? 0.9 : s.swim ? 0.6 : 0.35) - this.ball.y) / t + 0.5 * 4 * t;
    this.ball.holder = null; this.ball.state = 'shot'; this.ball.lastTeam = p.team;
    this._flight = { type: 'goal', team: p.team, playerId: p.id, elapsed: 0, duration: t }; this.shotCharge = 0;
    p.action = s.kind === 'soccer' ? 'kick' : s.stick ? 'stick' : 'throw'; p.actionTime = 0.55; p.cooldown = 0.8;
    this._event('shotAttempt', { team: p.team, playerId: p.id, style: s.kind === 'puck' ? 'slapshot' : 'goal' });
    return true;
  };
  Core.prototype._goalAI = function (p, dt) {
    var n = this.spec.teamSize, slot = p.id % n, b = this.spec.bounds, c = DIFFICULTY[this.difficulty];
    var holder = this.ball.holder === null ? null : this.players[this.ball.holder], dir = p.team === 0 ? -1 : 1;
    var speed = c.speed * (0.9 + rating(p, 'speed') / 700) * (this.spec.swim ? 0.55 : 1), x = p.x, z = p.z;
    if (holder && holder.id === p.id) {
      x = Math.sin(this.clock * 0.7 + p.id) * b.maxX * 0.32; z = dir * (b.maxZ - 1); p.aiTimer -= dt;
      if (p.aiTimer <= 0) {
        if (this.spec.family === 'goal' && (Math.abs(z - p.z) < 9 || this.shotClock < 4)) this._goalShot(p, 0.65, true, 0, dir);
        else if (this.spec.family === 'carry' && this._random() < 0.25) this._pass(p, 0, dir);
        p.aiTimer = 0.55 + this._random();
      }
    } else if (!holder) {
      if (this.ball.state === 'pass' && this._flight) { x = this.players[this._flight.targetId].x; z = this.players[this._flight.targetId].z; }
      else { x = this.ball.x; z = this.ball.z; }
    } else if (holder.team === p.team) {
      x = (slot - (n - 1) / 2) * b.maxX * 1.3 / n; z = holder.z + dir * (this.sport === 'rugby' ? -3 : 3) + (slot % 2 ? 2 : -2);
    } else {
      var designated = this.spec.family === 'goal' && slot === n - 1;
      if (designated) { x = clamp(this.ball.x, -this.spec.goalWidth / 2, this.spec.goalWidth / 2); z = -dir * (b.maxZ - 1.4); }
      else { var mark = this.players[(1 - p.team) * n + slot]; x = (mark.id === holder.id ? holder.x : mark.x) * 0.95; z = (mark.id === holder.id ? holder.z : mark.z) - dir * 0.65; }
      this._defend(p, dt);
    }
    this._toward(p, x, z, speed, dt); p.armAngle = p.angle;
  };
  Core.prototype._goalBall = function (dt) {
    var ball = this.ball, s = this.spec, b = s.bounds;
    if (ball.holder !== null) {
      this._syncBall();
      if (s.family === 'carry') {
        var owner = this.players[ball.holder], finish = owner.team === 0 ? b.minZ + 1 : b.maxZ - 1;
        if ((owner.team === 0 && owner.z <= finish) || (owner.team === 1 && owner.z >= finish)) this._point(owner.team, this.sport === 'rugby' ? 5 : 6, this.sport === 'rugby' ? 'try' : 'touchdown', owner.id);
      }
      return;
    }
    if (this._flight && this._flight.type === 'pass') {
      var f = this._flight; f.elapsed += dt; var q = this.players[f.targetId], u = Math.min(1, f.elapsed / f.duration);
      ball.x = f.fromX + (q.x - f.fromX) * u; ball.z = f.fromZ + (q.z - f.fromZ) * u; ball.y = f.fromY + Math.sin(u * Math.PI) * (s.kind === 'puck' || s.lowBall ? 0 : 0.6);
      if (u === 1) this._take(q);
      return;
    }
    var goal = this._flight && this._flight.type === 'goal', flat = s.kind === 'puck' || s.lowBall;
    if (!flat) ball.vy -= 4 * dt;
    ball.x += ball.vx * dt; ball.z += ball.vz * dt; ball.y = Math.max(s.radius, ball.y + ball.vy * dt);
    if (this._flight) this._flight.elapsed += dt;
    if (ball.y <= s.radius) { ball.vy = Math.abs(ball.vy) * 0.3; ball.vx *= Math.pow(0.99, dt * 60); ball.vz *= Math.pow(0.99, dt * 60); }
    if (s.family === 'goal' && (ball.z < b.minZ || ball.z > b.maxZ)) {
      var team = ball.z < b.minZ ? 0 : 1;
      if (Math.abs(ball.x) <= s.goalWidth / 2 && ball.y <= s.goalHeight) { this._point(team, 1, s.kind === 'puck' ? 'hockeyGoal' : 'goal', goal ? this._flight.playerId : team * s.teamSize); return; }
    }
    if (ball.x < b.minX || ball.x > b.maxX || ball.z < b.minZ || ball.z > b.maxZ) {
      this._event('turnover', { team: ball.lastTeam, reason: 'out' }); this._nextTeam = 1 - ball.lastTeam; this._resetDelay = 0.65; ball.state = 'out'; return;
    }
    for (var i = 0; i < this.players.length; i++) {
      var p = this.players[i];
      if (p.cooldown <= 0 && dist(p, ball) < (goal ? 0.65 : 0.8) && ball.y < p.y + 1.7) {
        if (goal && p.team === this._flight.team && this._flight.elapsed < 0.4) continue;
        var saved = goal; this._take(p); if (saved) this._event('save', { team: p.team, playerId: p.id }); break;
      }
    }
  };

  /* ---- Net family (badminton, table tennis, tennis, soft tennis, volleyball, beach, takraw) -- */
  Core.prototype._netHit = function (p, charge, lob, isAI) {
    var ball = this.ball, s = this.spec, r = this._rally, serve = ball.holder === p.id, tall = s.kind === 'volleyball' || s.kind === 'rattan';
    if (!serve && (ball.holder !== null || p.cooldown > 0 || !r || r.lastTeam === p.team || (p.team === 0 ? ball.z < 0 : ball.z > 0) || dist(p, ball) > (tall ? 2.2 : 1.9) || ball.y > p.y + (tall ? 3.2 : 2.7))) return false;
    if (!serve && s.bounces === 1 && (r.bounces < 1 || r.lastBounceTeam !== p.team)) return false;
    var b = s.bounds, dir = p.team === 0 ? -1 : 1;
    var t = s.kind === 'shuttle' ? 1.7 : tall ? 1.6 : s.kind === 'tabletennis' ? 1.03 : s.slow ? 1.55 : 1.35; t += lob ? 0.45 : 0;
    var targetX = isAI ? (this._random() - 0.5) * b.maxX * 1.4 : clamp(p.aimX * b.maxX * 0.85, -b.maxX * 0.95, b.maxX * 0.95);
    var targetZ = dir * b.maxZ * (0.55 + clamp(charge, 0, 1) * 0.23);
    if (isAI) {
      targetX += (this._random() - 0.5) * (1 - DIFFICULTY[this.difficulty].accuracy) * (1.3 - rating(p, 'accuracy') / 200) * b.maxX;
      var cleanChance = clamp(0.8 + DIFFICULTY[this.difficulty].accuracy * 0.18 + (rating(p, 'accuracy') - 70) / 1000, 0.65, 0.985);
      if (this._random() > cleanChance) targetX = (this._random() < 0.5 ? -1 : 1) * b.maxX * 1.35;
    }
    ball.holder = null; ball.state = 'rally'; ball.lastTeam = p.team;
    if (serve) { ball.x = p.x; ball.z = p.z; ball.y = tall ? 2.8 : 1.0; }
    ball.y = Math.max(ball.y, tall ? 2.5 : 0.6);
    ball.vx = (targetX - ball.x) / t; ball.vz = (targetZ - ball.z) / t; ball.vy = (s.radius - ball.y + 0.5 * GRAVITY * t * t) / t;
    this._rally = { lastTeam: p.team, lastId: p.id, bounces: 0, lastBounceTeam: null, crossed: false };
    this.metrics.rally++; this.metrics.longestRally = Math.max(this.metrics.longestRally, this.metrics.rally);
    this.possessionTeam = 1 - p.team; p.action = s.kick ? 'kick' : 'racket'; p.actionTime = 0.4; p.cooldown = 0.28; this.shotCharge = 0;
    this._event(serve ? 'serve' : 'rally', { team: p.team, playerId: p.id, count: this.metrics.rally });
    return true;
  };
  Core.prototype._netAI = function (p, dt) {
    var s = this.spec, b = this.ball, c = DIFFICULTY[this.difficulty], n = s.teamSize;
    if (b.holder === p.id) { p.aiTimer -= dt; if (p.aiTimer <= 0) this._netHit(p, 0.65, false, true); return; }
    var expected = this._rally && this._rally.lastTeam !== p.team && b.holder === null;
    var desiredX = (p.id % n - (n - 1) / 2) * s.bounds.maxX, desiredZ = (p.team === 0 ? 1 : -1) * s.bounds.maxZ * 0.65;
    if (expected) {
      var t = clamp(Math.abs(b.z - p.z) / Math.max(2, Math.abs(b.vz)), 0, 0.8);
      desiredX = clamp(b.x + b.vx * t, s.bounds.minX + 0.3, s.bounds.maxX - 0.3); desiredZ = clamp(b.z + b.vz * 0.1, s.bounds.minZ + 0.6, s.bounds.maxZ - 0.6);
      if ((p.team === 0 && desiredZ < 0.8) || (p.team === 1 && desiredZ > -0.8)) desiredZ = (p.team === 0 ? 1 : -1) * 1.5;
    }
    this._toward(p, desiredX, desiredZ, c.speed * (s.kind === 'tennis' || s.kind === 'softtennis' ? 1.3 : 1), dt); p.armAngle = p.team === 0 ? Math.PI : 0;
    if (expected && (p.team === 0 ? b.z > 0 : b.z < 0) && p.cooldown <= 0) { p.aiTimer -= dt; if (p.aiTimer <= 0) { this._netHit(p, 0.65, this._random() < 0.14, true); p.aiTimer = c.reaction; } }
  };
  Core.prototype._netBall = function (dt) {
    var b = this.ball, s = this.spec, r = this._rally;
    if (b.holder !== null) { this._syncBall(); return; }
    if (!r) return;
    var prevZ = b.z, prevY = b.y;
    b.vy -= GRAVITY * dt * (s.kind === 'shuttle' ? 1.15 : s.slow ? 0.8 : 1); b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    if ((prevZ < 0 && b.z >= 0) || (prevZ > 0 && b.z <= 0)) {
      var ratio = Math.abs(prevZ) / (Math.abs(prevZ) + Math.abs(b.z)), crossY = prevY + (b.y - prevY) * ratio;
      if (crossY < s.netHeight + s.radius) { this._point(1 - r.lastTeam, 1, 'netFault', r.lastId); return; }
      r.crossed = true;
    }
    if (b.x < s.bounds.minX || b.x > s.bounds.maxX || b.z < s.bounds.minZ || b.z > s.bounds.maxZ) { var winner = r.bounces > 0 ? r.lastTeam : 1 - r.lastTeam; this._point(winner, 1, 'out', winner * s.teamSize); return; }
    if (b.y <= s.radius) {
      var side = b.z >= 0 ? 0 : 1;
      if (side === r.lastTeam || !r.crossed) { this._point(1 - r.lastTeam, 1, 'short', r.lastId); return; }
      r.bounces++; r.lastBounceTeam = side;
      if (r.bounces > s.bounces) { this._point(r.lastTeam, 1, s.bounces ? 'doubleBounce' : 'rallyPoint', r.lastId); return; }
      b.y = s.radius; b.vy = Math.max(3.3, Math.abs(b.vy) * (s.slow ? 0.9 : 0.77)); this._event('bounce', { team: side, count: r.bounces });
    }
  };

  /* ---- Batting family v2 (baseball, softball, cricket) --------------------------------------
     Pitcher throws typed pitches at/around a strike zone. The batter moves a bat contact point
     inside the zone (left hand), sets loft/pull bias (right hand), loads (hold) and swings (release).
     Timing error × spatial error → contact quality → exit velocity / launch / direction → fielders. */
  Core.prototype._battingRestart = function () {
    var s = this.spec, bt = s.batting, n = s.teamSize, m = this.metrics;
    var batter = this.players[0], pitcher = this.players[n];
    batter.x = batter.handedness === 'left' ? 0.75 : -0.75; batter.z = bt.plateZ + 0.15; batter.angle = Math.PI; batter.armAngle = batter.handedness === 'left' ? Math.PI * 0.5 : -Math.PI * 0.5;
    pitcher.x = 0; pitcher.z = bt.moundZ; pitcher.angle = 0; pitcher.armAngle = 0;
    /* team-mates wait beside the plate (dugout side), fielders spread in the field */
    for (var i = 1; i < n; i++) { var mate = this.players[i]; mate.x = s.bounds.maxX * 0.55 + (i - 1) * 1.3; mate.z = bt.plateZ + 1.2 - (i - 1) * 0.3; mate.angle = Math.PI; }
    var spots = bt.bounce ? [[0.6, bt.plateZ + 1.4], [-7, bt.plateZ - 10], [8, bt.plateZ - 12], [-3, bt.plateZ - 22], [6, bt.plateZ - 24]]
      : [[0, bt.plateZ + 1.3], [-6.5, bt.plateZ - 9], [6.5, bt.plateZ - 9], [-9, bt.plateZ - 22], [9, bt.plateZ - 22]];
    for (var j = 1; j < n; j++) { var f = this.players[n + j], spot = spots[j - 1] || spots[spots.length - 1]; f.x = spot[0]; f.z = spot[1]; f.angle = 0; f.homeX = spot[0]; f.homeZ = spot[1]; }
    this.selectedId = 0;
    this.batter = this.batter || {};
    this.batter.cursorX = 0; this.batter.cursorY = (bt.zone.bottom + bt.zone.top) / 2; this.batter.loaded = false; this.batter.loadTime = 0; this.batter.swungAt = null; this.batter.swingKind = null;
    this.batter.lastContact = null; this.batter.fielderTarget = null;
    this._pitchTimer = 1.4; this._take(pitcher);
    if (!m.inningStarted) { m.inningStarted = true; }
  };
  Core.prototype._pitch = function () {
    var s = this.spec, bt = s.batting, c = DIFFICULTY[this.difficulty], pitcher = this.players[s.teamSize], b = this.ball;
    var types = bt.pitches, pick = types[Math.floor(this._random() * types.length)];
    var inZone = this._random() < c.zoneRate, zone = bt.zone;
    var targetX = inZone ? (this._random() - 0.5) * zone.halfWidth * 1.7 : (this._random() < 0.5 ? -1 : 1) * (zone.halfWidth + 0.12 + this._random() * 0.25);
    var targetY = inZone ? zone.bottom + 0.08 + this._random() * (zone.top - zone.bottom - 0.16) : (this._random() < 0.5 ? zone.bottom - 0.1 - this._random() * 0.2 : zone.top + 0.1 + this._random() * 0.25);
    targetX = clamp(targetX, -1.1, 1.1); targetY = clamp(targetY, 0.1, 1.9);
    var distance = Math.abs(bt.plateZ - bt.moundZ), speedScale = pick[1] * c.pitchSpeed * (0.92 + rating(pitcher, 'power') / 800);
    var baseSpeed = bt.underhand ? 15 : bt.bounce ? 20 : 20.5, speed = baseSpeed * speedScale;
    var duration = distance / speed;
    var release = { x: pitcher.x + (pitcher.handedness === 'left' ? 0.35 : -0.35), y: bt.releaseY, z: bt.moundZ + 0.6 };
    var flight = { type: 'pitch', elapsed: 0, duration: duration, pitch: pick[0], speed: speed, release: release, target: { x: targetX, y: targetY, z: bt.plateZ },
      breakX: pick[2] * (pitcher.handedness === 'left' ? -1 : 1), breakY: pick[3], team: 1, inZone: inZone, resolved: false };
    if (bt.bounce) {
      /* cricket: the delivery pitches (bounces) before the batter; a yorker bounces late, a bouncer early */
      var lengthFrac = pick[0] === 'yorker' ? 0.93 : pick[0] === 'bouncer' ? 0.6 : 0.78 + (this._random() - 0.5) * 0.1;
      flight.bounceZ = bt.moundZ + (bt.plateZ - bt.moundZ) * lengthFrac; flight.bounceT = duration * lengthFrac;
    }
    b.holder = null; b.state = 'pitch'; b.x = release.x; b.y = release.y; b.z = release.z; b.vx = b.vy = b.vz = 0; b.lastTeam = 1;
    this._flight = flight; this.metrics.pitches++; this.metrics.deliveries++; this.metrics.pitchType = pick[0]; this.metrics.pitchSpeed = speed;
    pitcher.action = bt.underhand ? 'pitchUnder' : bt.bounce ? 'bowl' : 'pitch'; pitcher.actionTime = 0.5; pitcher.cooldown = duration + 0.4;
    this.batter.swungAt = null; this.batter.swingKind = null; this.batter.lastContact = null;
    this._event('pitch', { duration: duration, pitch: pick[0], speed: speed, inZone: inZone });
  };
  Core.prototype._pitchPosition = function (f, t) {
    /* deterministic trajectory sampled at time t (seconds since release) */
    var bt = this.spec.batting, u = clamp(t / f.duration, 0, 1.15), r = f.release, g = f.target;
    var x = r.x + (g.x - r.x) * u, z = r.z + (g.z - r.z) * u, y;
    var late = u < 0.5 ? 0 : (u - 0.5) * 2;          // movement happens in the second half of the flight
    x += f.breakX * late * late * 0.9;
    if (bt.bounce) {
      var tb = f.bounceT / f.duration;
      if (u <= tb) { var v = u / tb; y = r.y + (0 - r.y) * v - Math.sin(v * Math.PI) * 0.1 + 0.05; }
      else { var w = (u - tb) / (1 - tb); var apex = clamp(g.y, 0.2, 1.6); y = 0.05 + Math.sin(Math.min(1, w) * Math.PI * 0.5) * apex * (1 - w * 0.15); }
      x += f.breakX * (u > tb ? (u - tb) * 1.3 : 0) * 0.8;
    } else if (bt.underhand) {
      y = r.y + (g.y - r.y) * u + Math.sin(u * Math.PI) * 0.75 + f.breakY * late * late * 0.9;
    } else {
      y = r.y + (g.y - r.y) * u + Math.sin(u * Math.PI) * 0.22 + f.breakY * late * late;
    }
    return { x: x, y: y, z: z };
  };
  Core.prototype._crossPoint = function (f) { return this._pitchPosition(f, f.duration); };
  Core.prototype._swing = function (p, kind) {
    /* kind: 'swing' | 'power' | 'contact' | 'bunt' — records the swing instant; contact resolves at the plate */
    if (p.cooldown > 0 || this.batter.swungAt !== null) return false;
    var f = this._flight, b = this.ball;
    p.action = kind === 'bunt' ? 'bunt' : 'swing'; p.actionTime = 0.42; p.cooldown = 0.5;
    this.batter.swungAt = this.clock; this.batter.swingKind = kind; this.batter.loaded = false;
    if (!f || b.state !== 'pitch') { this._event('swingMiss', { timing: 0, reason: 'noPitch' }); return false; }
    this.batter.swingTime = f.elapsed;
    return true;
  };
  Core.prototype._resolveContact = function () {
    var s = this.spec, bt = s.batting, c = DIFFICULTY[this.difficulty], f = this._flight, b = this.ball, p = this.players[0], m = this.metrics;
    var cross = this._crossPoint(f), kind = this.batter.swingKind, swung = this.batter.swungAt !== null;
    var inZone = Math.abs(cross.x) <= bt.zone.halfWidth && cross.y >= bt.zone.bottom && cross.y <= bt.zone.top;
    if (!swung) { this._call(inZone ? 'strike' : 'ball', cross); return; }
    var window = c.window * (kind === 'contact' ? 1.45 : kind === 'bunt' ? 1.8 : kind === 'power' ? 0.78 : 1) * (0.85 + rating(p, 'accuracy') / 400);
    var reach = c.reach * (kind === 'contact' ? 1.35 : kind === 'bunt' ? 1.6 : kind === 'power' ? 0.9 : 1);
    var e = this.batter.swingTime - f.duration;        // seconds; negative = early, positive = late
    var dxy = Math.hypot(this.batter.cursorX - cross.x, this.batter.cursorY - cross.y);
    m.timingError = e; m.swingTiming = clamp(1 - Math.abs(e) / window, 0, 1);
    if (Math.abs(e) > window || dxy > reach) {
      m.contactQuality = 0; this._event('swingMiss', { timing: m.swingTiming, spatial: dxy, kind: kind });
      this._call('strike', cross, true); return;
    }
    var q = clamp((1 - Math.abs(e) / window) * 0.6 + (1 - dxy / reach) * 0.4, 0.05, 1);
    var powerMult = kind === 'power' ? 1.16 : kind === 'contact' ? 0.82 : kind === 'bunt' ? 0.18 : 1;
    for (var fi = s.teamSize + 1; fi < this.players.length; fi++) this.players[fi].catchTried = false;
    var exit = bt.exit * (0.5 + 0.5 * q) * powerMult * (0.85 + rating(p, 'power') / 400);
    var under = cross.y - this.batter.cursorY;            // bat below ball → loft
    var launch = 14 + (-clamp(p.aimZ, -1, 1)) * 20 + under * 70 + (1 - q) * (this._random() - 0.4) * 24;
    if (kind === 'bunt') launch = -8 + this._random() * 10;
    launch = clamp(launch, -12, 68);
    var handSign = p.handedness === 'left' ? -1 : 1;
    var direction = handSign * (e / window) * 34 + clamp(p.aimX, -1, 1) * 18 + (this._random() - 0.5) * (1 - q) * 30;
    direction = clamp(direction, -75, 75);
    var rad = Math.PI / 180, dirRad = direction * rad, launchRad = launch * rad;
    b.state = 'hit'; b.x = cross.x; b.y = cross.y; b.z = bt.plateZ - 0.1;
    b.vx = Math.sin(dirRad) * Math.cos(launchRad) * exit; b.vz = -Math.cos(dirRad) * Math.cos(launchRad) * exit; b.vy = Math.sin(launchRad) * exit; b.lastTeam = 0;
    this._flight = { type: 'hit', elapsed: 0, startX: cross.x, startZ: bt.plateZ, team: 0, maxY: b.y, fair: Math.abs(direction) <= 45, direction: direction, kind: kind, fenceCleared: false };
    m.hits++; m.contactQuality = q; m.exitVelocity = exit; m.launchAngle = launch;
    this.batter.lastContact = { x: cross.x, y: cross.y, quality: q, timing: e };
    /* fielders start running toward the predicted landing spot */
    var vy = b.vy, tFlight = Math.max(0.2, (vy + Math.sqrt(Math.max(0, vy * vy + 2 * GRAVITY * b.y))) / GRAVITY);
    this.batter.fielderTarget = { x: b.x + b.vx * tFlight * 0.88, z: b.z + b.vz * tFlight * 0.88, t: tFlight };
    this._event('contact', { playerId: p.id, timing: m.swingTiming, power: exit, quality: q, launch: launch, direction: direction, kind: kind });
  };
  Core.prototype._call = function (call, cross, swinging) {
    var s = this.spec, bt = s.batting, m = this.metrics, b = this.ball;
    b.state = 'called'; b.vx = b.vy = b.vz = 0;
    if (bt.bounce) {
      /* cricket: a missed/unplayed ball that hits the stumps is a wicket; otherwise a dot ball */
      var st = bt.stumps, hitsStumps = Math.abs(cross.x) <= st.halfWidth + 0.03 && cross.y <= st.height + 0.02 && cross.y > 0;
      if (hitsStumps) { m.wickets++; m.lastResult = 'bowled'; this._event('wicket', { style: 'bowled', highlight: true }); this._point(1, 1, 'wicket', s.teamSize, 1.4); return; }
      m.lastResult = 'dot'; this._event('dotBall', { swinging: !!swinging }); this._nextTeam = 0; this._resetDelay = 0.9;
      if (m.deliveries % 6 === 0) this._event('overComplete', { over: Math.floor(m.deliveries / 6) });
      return;
    }
    if (call === 'ball') {
      m.balls++; m.lastResult = 'ball'; this._event('ballCall', { balls: m.balls });
      if (m.balls >= 4) { m.balls = 0; m.strikes = 0; m.lastResult = 'walk'; this._event('walk', {}); this._point(0, 1, 'walk', 0, 1.2); return; }
    } else {
      m.strikes++; m.lastResult = 'strike'; this._event('strike', { strikes: m.strikes, swinging: !!swinging });
      if (m.strikes >= 3) { this._out('strikeout'); return; }
    }
    this._nextTeam = 0; this._resetDelay = 0.9;
  };
  Core.prototype._out = function (style) {
    var m = this.metrics; m.outs++; m.strikes = 0; m.balls = 0; m.lastResult = style;
    this._event('out', { style: style, outs: m.outs });
    if (m.outs >= 3) { m.outs = 0; m.inning++; this._event('inningOver', { inning: m.inning }); this._point(1, 1, 'inning', this.spec.teamSize, 1.6); return; }
    this._nextTeam = 0; this._resetDelay = 1.1;
  };
  Core.prototype._battingStep = function (dt, input, actions) {
    var s = this.spec, bt = s.batting, b = this.ball, f = this._flight, m = this.metrics, batter = this.players[0], n = s.teamSize, c = DIFFICULTY[this.difficulty];
    /* batter controls */
    var cur = this.batter;
    cur.cursorX = clamp(cur.cursorX + clamp(finite(input.moveX, 0), -1, 1) * dt * 1.7, -bt.zone.halfWidth - 0.3, bt.zone.halfWidth + 0.3);
    cur.cursorY = clamp(cur.cursorY - clamp(finite(input.moveZ, 0), -1, 1) * dt * 1.7, bt.zone.bottom - 0.3, bt.zone.top + 0.3);
    batter.aimX = clamp(finite(input.aimX, 0), -1, 1); batter.aimZ = clamp(finite(input.aimZ, 0), -1, 1);
    batter.torsoAngle = clamp(batter.torsoAngle + ((input.shootHeld ? (batter.handedness === 'left' ? 0.55 : -0.55) : 0) - batter.torsoAngle) * Math.min(1, dt * 6), -1, 1);
    batter.shoulderAngle = clamp((cur.cursorY - (bt.zone.bottom + bt.zone.top) / 2) * 1.2, -0.8, 0.8);
    m.hipRotation = batter.torsoAngle; m.shoulder = batter.shoulderAngle;
    if (input.shootHeld && cur.swungAt === null) { cur.loaded = true; cur.loadTime += dt; batter.action = 'load'; batter.actionTime = 0.1; this.shotCharge = Math.min(1, cur.loadTime / 0.6); } else if (!input.shootHeld) { cur.loadTime = 0; this.shotCharge = 0; }
    if (actions.shootReleased) this._swing(batter, input.power ? 'power' : input.crouch ? 'contact' : 'swing');
    if (actions.pass) this._swing(batter, 'bunt');
    /* pitcher wind-up */
    var catcher = this.players[n + 1];
    if (b.state !== 'hit' && catcher) { catcher.action = 'crouch'; catcher.actionTime = 0.1; catcher.x = bt.bounce ? 0.6 : (this.players[0].handedness === 'left' ? -0.95 : 0.95); catcher.z = bt.plateZ + (bt.bounce ? 1.4 : 1.5); catcher.angle = 0; catcher.armAngle = 0; }
    if (b.state === 'held') {
      this._pitchTimer -= dt;
      var pitcher = this.players[n];
      if (bt.bounce) { pitcher.action = 'runup'; pitcher.actionTime = 0.1; pitcher.z = bt.moundZ - 4 + (1.4 - Math.max(0, this._pitchTimer)) / 1.4 * 4; }
      else if (this._pitchTimer < 0.5) { pitcher.action = 'windup'; pitcher.actionTime = 0.1; }
      if (this._pitchTimer <= 0) this._pitch();
      this._syncBall(); return;
    }
    if (b.state === 'pitch') {
      f.elapsed += dt;
      var pos = this._pitchPosition(f, f.elapsed), prev = { x: b.x, y: b.y, z: b.z };
      b.x = pos.x; b.y = pos.y; b.z = pos.z; b.vx = (b.x - prev.x) / dt; b.vy = (b.y - prev.y) / dt; b.vz = (b.z - prev.z) / dt;
      if (bt.bounce && f.bounceT && f.elapsed >= f.bounceT && !f.bounced) { f.bounced = true; this._event('bounce', { team: 1, count: 1 }); }
      if (f.elapsed >= f.duration && !f.resolved) { f.resolved = true; this._resolveContact(); }
      return;
    }
    if (b.state === 'called') { this._syncBallToCatcher(); return; }
    if (b.state === 'hit') {
      f.elapsed += dt;
      var speed = Math.hypot(b.vx, b.vy, b.vz), drag = 0.012 * speed;       // simple quadratic drag
      b.vx -= b.vx * drag * dt; b.vz -= b.vz * drag * dt; b.vy -= (GRAVITY + b.vy * drag) * dt;
      b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt; f.maxY = Math.max(f.maxY, b.y);
      var r = Math.hypot(b.x - f.startX, b.z - f.startZ);
      if (!f.fenceCleared && r >= bt.fence && b.y > bt.fenceHeight) { f.fenceCleared = true; }
      /* fielders react after a short delay, chase the predicted landing point, then the ball */
      var reaction = this.difficulty === 'easy' ? 0.5 : this.difficulty === 'normal' ? 0.32 : 0.16;
      for (var i = n + 1; i < this.players.length; i++) {
        var fd = this.players[i];
        if (f.elapsed < reaction) { fd.armAngle = fd.angle; continue; }
        var tgt = (f.elapsed < (cur.fielderTarget ? cur.fielderTarget.t * 0.6 : 0)) && cur.fielderTarget ? cur.fielderTarget : b;
        this._toward(fd, clamp(tgt.x, s.bounds.minX + 0.3, s.bounds.maxX - 0.3), clamp(tgt.z, s.bounds.minZ + 0.3, s.bounds.maxZ - 0.3), c.speed * 0.95 * (0.85 + rating(fd, 'speed') / 500), dt);
        fd.armAngle = fd.angle;
        /* catch in the air: one attempt per fielder per ball, success depends on difficulty and defence rating */
        if (!fd.catchTried && f.elapsed > 0.35 && b.y > 0.2 && b.y < fd.y + 2.4 && dist(fd, b) < 0.6 && f.fair && !f.fenceCleared) {
          fd.catchTried = true;
          var chance = (this.difficulty === 'easy' ? 0.5 : this.difficulty === 'normal' ? 0.68 : 0.84) * (0.8 + rating(fd, 'defense') / 400) * (f.maxY < 2.4 ? 0.8 : 1);
          if (this._random() < chance) {
            m.lastDistance = r; this._event('catch', { playerId: fd.id, highlight: true });
            if (bt.bounce) { m.wickets++; m.lastResult = 'caught'; this._event('wicket', { style: 'caught', highlight: true }); this._point(1, 1, 'wicket', fd.id, 1.4); }
            else this._out(f.maxY < 2.4 ? 'lineOut' : 'flyOut');
            return;
          }
          this._event('dropped', { playerId: fd.id });
        }
      }
      if (b.y <= bt.ballVisual || b.y <= 0.08) { b.y = Math.max(0.05, b.y); this._landed(r, f); }
      return;
    }
  };
  Core.prototype._syncBallToCatcher = function () { var catcher = this.players[this.spec.teamSize + 1]; this.ball.x = catcher.x; this.ball.z = catcher.z - 0.3; this.ball.y = 0.8; };
  Core.prototype._landed = function (r, f) {
    var s = this.spec, bt = s.batting, m = this.metrics, n = s.teamSize, b = this.ball;
    m.lastDistance = r; m.bestDistance = Math.max(m.bestDistance, r);
    if (!f.fair) {
      m.lastResult = 'foul'; this._event('foul', { distance: r });
      if (bt.bounce) { this._nextTeam = 0; this._resetDelay = 0.9; return; }
      if (m.strikes < 2) m.strikes++;
      this._nextTeam = 0; this._resetDelay = 0.9; return;
    }
    var nearest = Infinity;
    for (var i = n + 1; i < this.players.length; i++) nearest = Math.min(nearest, dist(this.players[i], b));
    var runnerSpeed = 0.8 + rating(this.players[0], 'speed') / 400;
    if (bt.bounce) {
      /* cricket runs */
      var runs = f.fenceCleared ? 6 : r >= bt.fence ? 4 : nearest < 1.2 ? 0 : r > 26 ? 3 : r > 15 ? 2 : 1;
      if (f.kind === 'bunt') runs = Math.min(runs, 1);
      m.runs += runs; m.lastResult = runs === 6 ? 'six' : runs === 4 ? 'four' : runs === 0 ? 'dot' : 'runs' + runs;
      if (runs) { this._event(runs >= 4 ? 'boundary' : 'runs', { runs: runs, distance: r, highlight: runs >= 4 }); this._point(0, runs, runs === 6 ? 'six' : runs === 4 ? 'four' : 'runs', 0, 1.3); }
      else { this._event('dotBall', { fielded: true }); this._nextTeam = 0; this._resetDelay = 0.9; }
      if (m.deliveries % 6 === 0) this._event('overComplete', { over: Math.floor(m.deliveries / 6) });
      return;
    }
    if (f.fenceCleared || r >= bt.fence) { m.homeRuns++; m.lastResult = 'homeRun'; this._event('homeRun', { distance: r, highlight: true }); this._point(0, 4, 'homeRun', 0, 1.8); m.strikes = 0; m.balls = 0; return; }
    var grounder = f.maxY < 2.4, fieldedQuick = nearest < (grounder ? 1.6 : 1.1) * runnerSpeed;
    if (grounder && fieldedQuick && r < 24 && f.kind !== 'bunt') { this._out('groundOut'); return; }
    if (f.kind === 'bunt' && nearest < 1.0) { this._out('groundOut'); return; }
    var bases = r >= 30 && Math.abs(f.direction) > 28 ? 3 : r >= 24 && nearest > 2.5 ? 2 : grounder && r > 20 && nearest > 3 ? 2 : 1;
    var names = ['', 'single', 'double', 'triple'];
    m.lastResult = names[bases]; m.strikes = 0; m.balls = 0;
    this._event('hit', { bases: bases, distance: r, highlight: bases >= 2 }); this._point(0, bases, names[bases], 0, 1.4);
  };

  /* ---- Target family (archery) ------------------------------------------------------------- */
  Core.prototype._targetShoot = function (p, charge) {
    if (this.ball.holder !== p.id || this._resetDelay > 0) return false;
    var b = this.ball, q = clamp(charge || 0.65, 0.15, 1), steadiness = Math.abs(q - 0.72);
    var tx = this.metrics.aimX + this.metrics.wind * 0.5 + Math.sin(this.clock * 4) * steadiness * 0.16, ty = 1.7 + this.metrics.aimY - Math.max(0, 0.5 - q) * 2, t = 0.5;
    b.x = p.x; b.z = p.z; b.y = 1.5; b.holder = null; b.state = 'arrow'; b.vx = (tx - b.x) / t; b.vz = (-12 - b.z) / t; b.vy = (ty - b.y) / t;
    this._flight = { type: 'arrow', elapsed: 0, duration: t, targetX: tx, targetY: ty }; p.action = 'throw'; p.actionTime = 0.5; this.shotCharge = 0; this.metrics.arrows++;
  };
  Core.prototype._targetStep = function (dt) {
    var f = this._flight, b = this.ball;
    if (!f || f.type !== 'arrow') { this._syncBall(); return; }
    f.elapsed += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (f.elapsed >= f.duration) {
      b.x = f.targetX; b.y = f.targetY; b.z = -12;
      var r = Math.hypot(f.targetX, f.targetY - 1.7), points = r <= 1.2 ? clamp(10 - Math.floor(r / 0.12), 1, 10) : 0;
      this.metrics.lastRing = points; this._event('target', { points: points, radius: r });
      if (points) this._point(0, points, 'target', 0); else { this._nextTeam = 0; this._resetDelay = 0.8; this._event('miss', { playerId: 0, team: 0 }); }
    }
  };

  /* ---- Race family (sprint) --------------------------------------------------------------- */
  Core.prototype._raceStep = function (dt, input, actions) {
    var p = this.players[0], q = this.players[1], action = actions.pass ? 'pass' : actions.shootReleased ? 'shoot' : null;
    if (action) { if (action !== this._raceLastAction) { this._raceBoost = Math.min(2, this._raceBoost + 0.42); p.stamina = Math.max(0.2, p.stamina - 0.05); } else this._raceBoost = Math.max(0, this._raceBoost - 0.3); this._raceLastAction = action; }
    this._raceBoost = Math.max(0, this._raceBoost - dt * 0.55);
    var speed = clamp(-finite(input.moveZ, 0), 0, 1) * 4.3 + this._raceBoost;
    this._move(p, finite(input.moveX, 0) * 0.15, -(speed > 0 ? 1 : 0), speed * (0.65 + p.stamina * 0.35) * (0.85 + rating(p, 'speed') / 500), dt);
    this._move(q, 0, -1, DIFFICULTY[this.difficulty].speed * (0.85 + rating(q, 'speed') / 500), dt);
    p.action = q.action = 'sprint'; this.metrics.distance = Math.min(30, 14 - p.z); this.metrics.cadence = this._raceBoost;
    var winner = p.z <= -14 ? 0 : q.z <= -14 ? 1 : null;
    if (winner !== null) this._point(winner, 1, 'finish', winner);
  };

  /* ---- Wall family (squash) ---------------------------------------------------------------- */
  Core.prototype._wallHit = function (p, charge, lob, isAI) {
    var b = this.ball, s = this.spec, r = this._rally, serve = b.holder === p.id;
    if (!serve && (b.holder !== null || p.cooldown > 0 || !r || r.lastTeam === p.team || !r.hitWall || dist(p, b) > 1.7 || b.y > p.y + 2.4)) return false;
    var bd = s.bounds, c = DIFFICULTY[this.difficulty];
    var targetX = isAI ? (this._random() - 0.5) * bd.maxX * 1.3 : clamp(p.aimX * bd.maxX * 0.9, bd.minX + 0.2, bd.maxX - 0.2);
    var wallY = (lob ? 2.6 : 0.95) + clamp(charge, 0, 1) * 0.9;                 // where it meets the front wall
    if (isAI) { wallY += (this._random() - 0.5) * (1 - c.accuracy) * 2.4; if (this._random() > 0.84 + c.accuracy * 0.12) wallY = 0.2 + this._random() * 0.2; }
    wallY = clamp(wallY, 0.1, 5.2);
    var speed = (lob ? 9 : 15 + clamp(charge, 0, 1) * 7) * (0.9 + rating(p, 'power') / 900);
    if (serve) { b.x = p.x; b.z = p.z; b.y = 1.1; }
    var dx = targetX - b.x, dz = bd.minZ - b.z, dy = wallY - b.y, len = Math.hypot(dx, dy, dz) || 1, t = len / speed;
    b.vx = dx / t; b.vz = dz / t; b.vy = dy / t + 0.5 * GRAVITY * t;
    b.holder = null; b.state = 'rally'; b.lastTeam = p.team;
    this._rally = { lastTeam: p.team, lastId: p.id, floorBounces: 0, hitWall: false, serve: false };
    this.metrics.rally++; this.metrics.longestRally = Math.max(this.metrics.longestRally, this.metrics.rally); this.possessionTeam = 1 - p.team;
    p.action = 'racket'; p.actionTime = 0.4; p.cooldown = 0.3; this.shotCharge = 0;
    this._event(serve ? 'serve' : 'rally', { team: p.team, playerId: p.id, count: this.metrics.rally });
    return true;
  };
  Core.prototype._wallAI = function (p, dt) {
    var b = this.ball, c = DIFFICULTY[this.difficulty], bd = this.spec.bounds;
    if (b.holder === p.id) { p.aiTimer -= dt; if (p.aiTimer <= 0) this._wallHit(p, 0.65, false, true); return; }
    var expected = this._rally && this._rally.lastTeam !== p.team && b.holder === null;
    var x = p.team === 0 ? -1.1 : 1.1, z = 1.8;
    if (expected && this._rally.hitWall) { var t = clamp((b.z - p.z) / Math.max(1, Math.abs(b.vz)), 0, 0.9); x = clamp(b.x + b.vx * t, bd.minX + 0.3, bd.maxX - 0.3); z = clamp(b.z + b.vz * 0.15, bd.minZ + 1.2, bd.maxZ - 0.3); }
    this._toward(p, x, z, c.speed * 1.2, dt); p.armAngle = Math.PI;
    if (expected && p.cooldown <= 0) { p.aiTimer -= dt; if (p.aiTimer <= 0) { this._wallHit(p, 0.65, this._random() < 0.18, true); p.aiTimer = c.reaction; } }
  };
  Core.prototype._wallBall = function (dt) {
    var b = this.ball, s = this.spec, r = this._rally, bd = s.bounds;
    if (b.holder !== null) { this._syncBall(); return; }
    if (!r) return;
    b.vy -= GRAVITY * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    if (b.z <= bd.minZ) {                                   // front wall
      if (b.y < s.tin) { this._point(1 - r.lastTeam, 1, 'tin', r.lastId); return; }
      if (b.y > s.outLine) { this._point(1 - r.lastTeam, 1, 'out', r.lastId); return; }
      b.z = bd.minZ + 0.01; b.vz = Math.abs(b.vz) * 0.88; r.hitWall = true; this._event('wallHit', { y: b.y });
    }
    if (b.x <= bd.minX || b.x >= bd.maxX) { b.x = clamp(b.x, bd.minX + 0.01, bd.maxX - 0.01); b.vx *= -0.85; }
    if (b.z >= bd.maxZ) { b.z = bd.maxZ - 0.01; b.vz = -Math.abs(b.vz) * 0.7; }
    if (b.y <= s.radius) {
      b.y = s.radius; b.vy = Math.abs(b.vy) * 0.72; b.vx *= 0.96; b.vz *= 0.96;
      if (!r.hitWall) { this._point(1 - r.lastTeam, 1, 'floorFirst', r.lastId); return; }
      r.floorBounces++; this._event('bounce', { team: 1 - r.lastTeam, count: r.floorBounces });
      if (r.floorBounces > 1) { this._point(r.lastTeam, 1, 'doubleBounce', r.lastId); return; }
    }
  };

  /* ---- Golf family ------------------------------------------------------------------------- */
  Core.prototype._golfRestart = function () {
    var s = this.spec, m = this.metrics, p = this.players[0], q = this.players[1];
    p.x = s.tee.x - 0.35; p.z = s.tee.z; p.angle = p.armAngle = Math.PI; q.x = s.tee.x + 2.4; q.z = s.tee.z + 0.6; q.angle = Math.PI;
    this.ball.holder = null; this.ball.state = 'rest'; this.ball.x = s.tee.x; this.ball.z = s.tee.z; this.ball.y = s.radius; this.ball.vx = this.ball.vy = this.ball.vz = 0;
    m.holeStrokes = 0; m.aimX = 0; m.aimY = 0; m.windX = (this._random() - 0.5) * 3.2; m.wind = m.windX; m.distanceToHole = dist(this.ball, s.hole);
    this.golf = { hole: s.hole, turn: 0 };
  };
  Core.prototype._golfShot = function (charge) {
    var b = this.ball, s = this.spec, p = this.players[0], m = this.metrics;
    if (b.state !== 'rest') return false;
    var toHole = Math.atan2(s.hole.x - b.x, s.hole.z - b.z), aim = toHole + m.aimX * 0.6;
    var d = dist(b, s.hole), putting = d < 6, q = clamp(charge || 0.5, 0.05, 1);
    var speed = putting ? 1.5 + q * 7 : 8 + q * 18, loft = putting ? 0 : (0.42 - clamp(m.aimY, -0.3, 0.3)) ;
    speed *= 0.92 + rating(p, 'power') / 1200;
    var wobble = (1 - clamp(0.6 + rating(p, 'accuracy') / 250, 0, 1)) * (this._random() - 0.5) * 0.14 + Math.abs(q - 0.7) * (this._random() - 0.5) * 0.1;
    aim += wobble;
    b.vx = Math.sin(aim) * Math.cos(loft) * speed; b.vz = Math.cos(aim) * Math.cos(loft) * speed; b.vy = Math.sin(loft) * speed; b.state = 'flight'; b.y = Math.max(b.y, s.radius + 0.001);
    m.strokes++; m.holeStrokes++; p.action = putting ? 'putt' : 'golfswing'; p.actionTime = 0.6; p.cooldown = 0.7; this.shotCharge = 0;
    this._event('golfShot', { strokes: m.holeStrokes, putting: putting, power: q });
    return true;
  };
  Core.prototype._golfStep = function (dt, input, actions) {
    var b = this.ball, s = this.spec, m = this.metrics, p = this.players[0];
    if (b.state === 'rest') {
      m.aimX = clamp(m.aimX + clamp(finite(input.aimX, 0), -1, 1) * dt * 1.4, -1.2, 1.2); m.aimY = clamp(m.aimY - clamp(finite(input.aimZ, 0), -1, 1) * dt, -0.3, 0.3);
      if (actions.pass) { m.aimX = 0; m.aimY = 0; }
      p.x = b.x - 0.35; p.z = b.z + 0.05; p.angle = Math.atan2(s.hole.x - b.x, s.hole.z - b.z); p.armAngle = p.angle;
      if (actions.shootReleased) this._golfShot(this.shotCharge);
      m.distanceToHole = dist(b, s.hole);
      return;
    }
    if (b.state === 'flight') {
      var airborne = b.y > s.radius + 0.002;
      if (airborne) { b.vx += m.windX * 0.4 * dt; b.vy -= GRAVITY * dt; var sp = Math.hypot(b.vx, b.vy, b.vz), drag = 0.02 * sp; b.vx -= b.vx * drag * dt; b.vz -= b.vz * drag * dt; b.vy -= b.vy * drag * dt; }
      else { var green = dist(b, s.hole) < 6, fr = green ? 1.1 : 2.6; var sp2 = Math.hypot(b.vx, b.vz); if (sp2 > 0) { var dec = Math.min(sp2, fr * dt); b.vx -= b.vx / sp2 * dec; b.vz -= b.vz / sp2 * dec; } b.vy = 0; }
      b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
      if (b.y < s.radius) { b.y = s.radius; if (b.vy < -0.5) { b.vy = -b.vy * 0.35; b.vx *= 0.6; b.vz *= 0.6; } else b.vy = 0; }
      var bd = s.bounds; if (b.x < bd.minX || b.x > bd.maxX || b.z < bd.minZ || b.z > bd.maxZ) { b.x = clamp(b.x, bd.minX + 0.3, bd.maxX - 0.3); b.z = clamp(b.z, bd.minZ + 0.3, bd.maxZ - 0.3); b.vx = b.vz = b.vy = 0; m.strokes++; m.holeStrokes++; this._event('outOfBounds', {}); }
      var dh = dist(b, s.hole), speedNow = Math.hypot(b.vx, b.vz);
      if (dh < 0.14 && speedNow < 2.2 && b.y <= s.radius + 0.01) { this._golfHoled(); return; }
      if (speedNow < 0.08 && b.y <= s.radius + 0.001) {
        b.vx = b.vz = 0; b.state = 'rest'; m.distanceToHole = dh; this._event('golfRest', { distance: dh, onGreen: dh < 6 });
        if (m.holeStrokes >= 7) { this._event('holeMax', {}); this._golfNextHole(0); }
      }
    }
  };
  Core.prototype._golfHoled = function () {
    var m = this.metrics, strokes = m.holeStrokes, points = strokes === 1 ? 10 : strokes === 2 ? 6 : strokes === 3 ? 4 : strokes === 4 ? 2 : 1;
    m.holes++; this.ball.state = 'holed'; this._event('holed', { strokes: strokes, highlight: strokes <= 2 });
    this._golfNextHole(points);
  };
  Core.prototype._golfNextHole = function (points) {
    var c = DIFFICULTY[this.difficulty], aiStrokes = 2 + (this._random() < c.accuracy ? 0 : 1) + (this._random() < 0.25 ? 1 : 0) - (this._random() < (this.difficulty === 'hard' ? 0.22 : 0.08) ? 1 : 0);
    aiStrokes = clamp(aiStrokes, 1, 5);
    var aiPoints = aiStrokes === 1 ? 10 : aiStrokes === 2 ? 6 : aiStrokes === 3 ? 4 : aiStrokes === 4 ? 2 : 1;
    this.score[1] += aiPoints; this._event('opponentHole', { strokes: aiStrokes, points: aiPoints });
    if (points) this._point(0, points, 'golfHole', 0, 1.6); else { this._nextTeam = 0; this._resetDelay = 1.2; }
  };

  /* ---- Lane family (bowling) --------------------------------------------------------------- */
  Core.prototype._laneRestart = function () {
    var s = this.spec, p = this.players[0], q = this.players[1], m = this.metrics;
    p.x = 0; p.z = s.foulZ + 1.6; p.angle = p.armAngle = Math.PI; q.x = -0.95; q.z = s.foulZ + 1.5; q.angle = Math.PI;
    this.ball.holder = null; this.ball.state = 'ready'; this.ball.x = 0; this.ball.z = s.foulZ + 0.9; this.ball.y = s.radius; this.ball.vx = this.ball.vz = this.ball.vy = 0;
    m.aimX = 0; m.hook = 0;
    if (!this.pins || m.roll === 1) this._setPins();
    this.objects = this.pins;
  };
  Core.prototype._setPins = function () {
    var s = this.spec, pins = [], spacing = 0.3048, rows = [[0], [-0.5, 0.5], [-1, 0, 1], [-1.5, -0.5, 0.5, 1.5]];
    for (var r = 0; r < rows.length; r++) for (var i = 0; i < rows[r].length; i++) pins.push({ id: pins.length, x: rows[r][i] * spacing, z: s.pinZ - r * spacing * 0.866, up: true, vx: 0, vz: 0, fall: 0 });
    this.pins = pins;
  };
  Core.prototype._laneRoll = function (charge) {
    var b = this.ball, m = this.metrics, p = this.players[0];
    if (b.state !== 'ready') return false;
    var q = clamp(charge || 0.5, 0.1, 1), speed = 6 + q * 6 * (0.9 + rating(p, 'power') / 900);
    var wobble = (this._random() - 0.5) * 0.08 * (1.3 - rating(p, 'accuracy') / 100);
    b.vz = -speed; b.vx = (m.aimX * 0.35 + wobble) * speed * 0.14; b.state = 'rolling'; b.hook = m.hook; b.y = this.spec.radius;
    p.action = 'bowl'; p.actionTime = 0.6; p.cooldown = 0.7; this.shotCharge = 0;
    this._event('roll', { frame: m.frame, roll: m.roll, power: q, hook: m.hook });
    return true;
  };
  Core.prototype._laneStep = function (dt, input, actions) {
    var b = this.ball, s = this.spec, m = this.metrics, p = this.players[0], bd = s.bounds;
    if (b.state === 'ready') {
      m.aimX = clamp(m.aimX + clamp(finite(input.aimX, 0), -1, 1) * dt * 1.5, -1, 1); m.hook = clamp(m.hook + clamp(finite(input.moveX, 0), -1, 1) * dt * 1.5, -1, 1);
      if (actions.pass) { m.aimX = 0; m.hook = 0; }
      b.x = clamp(m.aimX * 0.45, -0.5, 0.5); p.x = b.x + 0.55; p.armAngle = p.angle = Math.PI;
      if (actions.shootReleased) this._laneRoll(this.shotCharge);
      return;
    }
    if (b.state === 'rolling') {
      var progress = clamp((s.foulZ - b.z) / (s.foulZ - s.pinZ), 0, 1);
      b.vx += -b.hook * 1.6 * progress * dt * 2.2;          // hook builds as the ball reaches the oily/dry zone
      b.x += b.vx * dt; b.z += b.vz * dt; b.vz += 0.25 * dt;
      if (Math.abs(b.x) > 0.53 && !b.gutter) { b.gutter = true; b.x = Math.sign(b.x) * 0.62; b.vx = 0; this._event('gutter', {}); }
      if (b.gutter) b.x = Math.sign(b.x) * 0.62;
      var hit = false;
      for (var i = 0; i < this.pins.length; i++) {
        var pin = this.pins[i];
        if (!pin.up) { pin.fall = Math.min(1, pin.fall + dt * 3); continue; }
        if (!b.gutter && Math.hypot(pin.x - b.x, pin.z - b.z) < s.radius + 0.07) {
          pin.up = false; hit = true; pin.vx = (pin.x - b.x) * 6 + b.vx * 0.5; pin.vz = b.vz * 0.4;
          this._knockChain(pin, 1.0);
        }
      }
      if (hit) b.vz *= 0.97;
      if (b.z < s.pinZ - 1.6 || b.z < bd.minZ + 0.3) { b.state = 'done'; this._laneResolve(); }
      return;
    }
    if (b.state === 'done') { for (var k = 0; k < this.pins.length; k++) if (!this.pins[k].up) this.pins[k].fall = Math.min(1, this.pins[k].fall + dt * 3); }
  };
  Core.prototype._knockChain = function (pin, energy) {
    /* a falling pin topples neighbours behind it with decreasing probability */
    var spacing = 0.3048;
    for (var i = 0; i < this.pins.length; i++) {
      var o = this.pins[i];
      if (!o.up || o === pin) continue;
      var dx = o.x - pin.x, dz = o.z - pin.z;
      if (dz < -0.05 && Math.hypot(dx, dz) < spacing * 1.15 && this._random() < energy * 0.78) { o.up = false; o.vx = dx * 4; o.vz = -2; this._knockChain(o, energy * 0.72); }
    }
  };
  Core.prototype._laneResolve = function () {
    var m = this.metrics, down = this.pins.filter(function (p) { return !p.up; }).length, standing = 10 - down;
    var points = down, style = 'pins';
    if (m.roll === 1 && down === 10) { points += 5; style = 'strikeBowl'; m.strikesBowl++; }
    else if (m.roll === 2 && standing === 0) { points += 3; style = 'spare'; m.spares++; }
    m.pins = down; m.lastPins = down;
    this._event('pinsDown', { pins: down, roll: m.roll, style: style, highlight: style !== 'pins' });
    var frameOver = m.roll === 2 || standing === 0;
    if (frameOver) {
      /* the AI opponent bowls its frame statistically */
      var c = DIFFICULTY[this.difficulty], ai = Math.min(10, Math.floor(5 + this._random() * 4 + c.accuracy * 3)), aiPts = ai + (ai === 10 ? 5 : 0);
      this.score[1] += aiPts; this._event('opponentFrame', { pins: ai });
      m.frame++; m.roll = 1;
    } else m.roll = 2;
    if (points) this._point(0, points, style, 0, 1.5); else { this._nextTeam = 0; this._resetDelay = 1.2; }
    this._pendingReset = frameOver;
  };

  /* ---- Cue family (billiards) -------------------------------------------------------------- */
  Core.prototype._cueRestart = function () {
    var s = this.spec, p = this.players[0], q = this.players[1], r = s.radius, m = this.metrics;
    this.ball.holder = null; this.ball.state = 'ready'; this.ball.x = 0; this.ball.z = s.bounds.maxZ * 0.5; this.ball.y = r; this.ball.vx = this.ball.vz = this.ball.vy = 0;
    if (!this.balls || !this.balls.some(function (b) { return !b.pocketed; })) {
      this.balls = [];
      var rack = [[0, -s.bounds.maxZ * 0.45], [-r * 1.05, -s.bounds.maxZ * 0.45 - r * 1.85], [r * 1.05, -s.bounds.maxZ * 0.45 - r * 1.85], [0, -s.bounds.maxZ * 0.45 - r * 3.7]];
      for (var i = 0; i < rack.length; i++) this.balls.push({ id: i + 1, x: rack[i][0], z: rack[i][1], vx: 0, vz: 0, pocketed: false });
    }
    this.objects = this.balls;
    p.x = 0; p.z = s.bounds.maxZ + 0.9; p.angle = p.armAngle = Math.PI; q.x = s.bounds.maxX + 0.9; q.z = 0; q.angle = -Math.PI / 2;
    if (!Number.isFinite(m.aimX) || m.aimX === 0) m.aimX = Math.PI;      // aim down the table toward the rack
    m.turn = this._turn;
    if (this._turn === 1) { this._aiShotTimer = 1.1; }
  };
  Core.prototype._cueShot = function (angle, charge, byAI) {
    var b = this.ball, p = this.players[byAI ? 1 : 0];
    if (b.state !== 'ready') return false;
    var q = clamp(charge || 0.5, 0.08, 1), speed = 1.2 + q * 5.2;
    b.vx = Math.sin(angle) * speed; b.vz = Math.cos(angle) * speed; b.state = 'moving'; this.cuePocketedThisTurn = 0; this.scratchThisTurn = false;
    p.action = 'cue'; p.actionTime = 0.5; p.cooldown = 0.6; this.shotCharge = 0;
    this._event('cueShot', { power: q, byAI: !!byAI });
    return true;
  };
  Core.prototype._cueBest = function () {
    /* ghost-ball planning: the cue-ball line that sends the easiest object ball toward a pocket */
    var s = this.spec, b = this.ball, pockets = this._pockets(), best = null, bestScore = -Infinity, r = s.radius;
    for (var i = 0; i < this.balls.length; i++) {
      var o = this.balls[i]; if (o.pocketed) continue;
      for (var j = 0; j < pockets.length; j++) {
        var pk = pockets[j], dx = pk.x - o.x, dz = pk.z - o.z, d = Math.hypot(dx, dz) || 1;
        var ghost = { x: o.x - dx / d * 2 * r, z: o.z - dz / d * 2 * r };
        var cueDir = Math.atan2(ghost.x - b.x, ghost.z - b.z), cut = Math.abs(Math.atan2(Math.sin(cueDir - Math.atan2(dx, dz)), Math.cos(cueDir - Math.atan2(dx, dz))));
        var score = -d - cut * 2 - dist(b, ghost) * 0.3;
        if (cut < 1.2 && score > bestScore) { bestScore = score; best = { angle: cueDir, distance: dist(b, ghost) + d }; }
      }
    }
    return best;
  };
  Core.prototype._cueAI = function (dt) {
    var s = this.spec, b = this.ball, c = DIFFICULTY[this.difficulty];
    this._aiShotTimer -= dt;
    if (this._aiShotTimer > 0 || b.state !== 'ready') return;
    var best = this._cueBest();
    if (!best) best = { angle: this._random() * Math.PI * 2, distance: 2 };
    void s;
    var error = (this._random() - 0.5) * (1 - c.accuracy) * 0.18;
    this._cueShot(best.angle + error, clamp(0.25 + best.distance / 7, 0.2, 0.9), true);
  };
  Core.prototype._pockets = function () { var b = this.spec.bounds; return [{ x: b.minX, z: b.minZ }, { x: b.maxX, z: b.minZ }, { x: b.minX, z: 0 }, { x: b.maxX, z: 0 }, { x: b.minX, z: b.maxZ }, { x: b.maxX, z: b.maxZ }]; };
  Core.prototype._cueStep = function (dt, input, actions) {
    var b = this.ball, s = this.spec, m = this.metrics, p = this.players[0], r = s.radius, bd = s.bounds;
    if (b.state === 'ready') {
      if (this._turn === 1) { this._cueAI(dt); }
      else {
        m.aimX = finite(m.aimX, 0) + clamp(finite(input.aimX, 0), -1, 1) * dt * 1.4;
        if (actions.pass) { var plan = this._cueBest(); var target = this.balls.find(function (o) { return !o.pocketed; }); m.aimX = plan ? plan.angle : target ? Math.atan2(target.x - b.x, target.z - b.z) : m.aimX; this._event('hint', { key: 'aimAssist' }); }
        if (actions.shootReleased) this._cueShot(m.aimX, this.shotCharge, false);
      }
      /* cue player stands behind the cue ball */
      var shooter = this.players[this._turn], ang = this._turn === 1 ? this._aiAimAngle || Math.PI : m.aimX;
      /* the shooter stands at the rail behind the cue ball, never on the cloth */
      var dxs = -Math.sin(ang), dzs = -Math.cos(ang), tx = Math.abs(dxs) > 1e-6 ? ((dxs > 0 ? bd.maxX : bd.minX) - b.x) / dxs : Infinity, tz = Math.abs(dzs) > 1e-6 ? ((dzs > 0 ? bd.maxZ : bd.minZ) - b.z) / dzs : Infinity;
      var tRail = Math.max(0.3, Math.min(tx, tz)) + 0.75;
      shooter.x = b.x + dxs * tRail; shooter.z = b.z + dzs * tRail; shooter.angle = shooter.armAngle = ang;
      return;
    }
    if (b.state !== 'moving') return;
    var all = [b].concat(this.balls.filter(function (o) { return !o.pocketed; }));
    var pockets = this._pockets(), moving = false;
    for (var i = 0; i < all.length; i++) {
      var o = all[i], sp = Math.hypot(o.vx, o.vz);
      if (sp > 0) { var dec = Math.min(sp, (0.55 + sp * 0.12) * dt); o.vx -= o.vx / sp * dec; o.vz -= o.vz / sp * dec; }
      o.x += o.vx * dt; o.z += o.vz * dt;
      for (var k = 0; k < pockets.length; k++) if (Math.hypot(o.x - pockets[k].x, o.z - pockets[k].z) < r * 2.1) {
        if (o === b) { this.scratchThisTurn = true; o.vx = o.vz = 0; o.x = 0; o.z = bd.maxZ * 0.5; this._event('scratch', {}); m.scratches++; }
        else { o.pocketed = true; o.vx = o.vz = 0; this.cuePocketedThisTurn++; this._event('pocketed', { ball: o.id, highlight: true }); }
      }
      if (o.x < bd.minX + r) { o.x = bd.minX + r; o.vx = Math.abs(o.vx) * 0.82; } if (o.x > bd.maxX - r) { o.x = bd.maxX - r; o.vx = -Math.abs(o.vx) * 0.82; }
      if (o.z < bd.minZ + r) { o.z = bd.minZ + r; o.vz = Math.abs(o.vz) * 0.82; } if (o.z > bd.maxZ - r) { o.z = bd.maxZ - r; o.vz = -Math.abs(o.vz) * 0.82; }
    }
    for (var a = 0; a < all.length; a++) for (var c2 = a + 1; c2 < all.length; c2++) {
      var A = all[a], B = all[c2]; if (A.pocketed || B.pocketed) continue;
      var dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d < 2 * r && d > 1e-6) {
        var nx = dx / d, nz = dz / d, overlap = 2 * r - d;
        A.x -= nx * overlap / 2; A.z -= nz * overlap / 2; B.x += nx * overlap / 2; B.z += nz * overlap / 2;
        var rel = (A.vx - B.vx) * nx + (A.vz - B.vz) * nz;
        if (rel > 0) { A.vx -= rel * nx; A.vz -= rel * nz; B.vx += rel * nx; B.vz += rel * nz; this._event('ballClick', { speed: rel }); }
      }
    }
    for (var mIdx = 0; mIdx < all.length; mIdx++) if (!all[mIdx].pocketed && Math.hypot(all[mIdx].vx, all[mIdx].vz) > 0.02) moving = true;
    if (!moving) {
      var pts = this.cuePocketedThisTurn * 2 - (this.scratchThisTurn ? 1 : 0), shooterTeam = this._turn;
      this.balls.forEach(function (o) { o.vx = o.vz = 0; }); b.vx = b.vz = 0;
      var keepTurn = this.cuePocketedThisTurn > 0 && !this.scratchThisTurn;
      if (pts > 0) this.score[shooterTeam] += pts;
      this._event('turnEnd', { team: shooterTeam, pocketed: this.cuePocketedThisTurn, scratch: this.scratchThisTurn, points: Math.max(0, pts) });
      if (this.cuePocketedThisTurn) this._event('score', { team: shooterTeam, points: Math.max(0, pts), style: 'pocketed', playerId: shooterTeam, highlight: true });
      m.pocketed += this.cuePocketedThisTurn;
      if (!keepTurn) this._turn = 1 - this._turn;
      if (!this.balls.some(function (o) { return !o.pocketed; })) this._event('rackCleared', {});
      b.state = 'ready'; this._aiShotTimer = 1.1; m.turn = this._turn;
      if (this._turn === 1) this._aiAimAngle = Math.PI;
    }
  };

  /* ---- Main step ---------------------------------------------------------------------------- */
  Core.prototype._substep = function (dt, input, actions) {
    if (this.ended) return;
    this.clock += dt; this.timeRemaining = Math.max(0, this.duration - this.clock);
    if (this.timeRemaining <= 1e-7) { this.ended = true; this.timeRemaining = 0; this._event('gameOver', { score: this.score.slice(), winner: this.score[0] === this.score[1] ? null : this.score[0] > this.score[1] ? 0 : 1 }); return; }
    if (this._resetDelay > 0) {
      this._resetDelay -= dt;
      if (this._resetDelay <= 0) {
        if (this.spec.family === 'golf') { this._golfRestart(); }
        else if (this.spec.family === 'lane') { if (this._pendingReset) { this.metrics.roll = 1; this._setPins(); } this._pendingReset = false; this._laneRestart(); }
        else if (this.spec.family === 'cue') { this._cueRestart(); }
        else this._restart(this._nextTeam);
      }
      return;
    }
    var s = this.spec, selected = this.selectedPlayer;
    if (actions.switchPlayer && s.family !== 'batting' && s.teamSize > 1) { this.selectedId = (this.selectedId + 1) % s.teamSize; selected = this.selectedPlayer; this.shotCharge = 0; }
    for (var i = 0; i < this.players.length; i++) {
      var p = this.players[i];
      p.cooldown = Math.max(0, p.cooldown - dt); p.actionTime = Math.max(0, p.actionTime - dt); p.stamina = Math.min(1, p.stamina + dt * 0.065);
      p.crouching = p.id === this.selectedId && !!input.crouch && s.family !== 'batting';
      if (p.jumpTime > 0) { p.jumpTime = Math.max(0, p.jumpTime - dt); p.y = Math.sin((1 - p.jumpTime / 0.65) * Math.PI) * 0.9; } else p.y = 0;
    }
    if (s.family === 'batting') { this._battingStep(dt, input, actions); return; }
    if (s.family === 'golf') { if (input.shootHeld) this.shotCharge = Math.min(1, this.shotCharge + dt / 1.1); this._golfStep(dt, input, actions); return; }
    if (s.family === 'lane') { if (input.shootHeld) this.shotCharge = Math.min(1, this.shotCharge + dt / 1.0); this._laneStep(dt, input, actions); return; }
    if (s.family === 'cue') { if (input.shootHeld && this._turn === 0) this.shotCharge = Math.min(1, this.shotCharge + dt / 1.0); this._cueStep(dt, input, actions); return; }
    selected.aimX = clamp(finite(input.aimX, 0), -1, 1); selected.aimZ = clamp(finite(input.aimZ, 0), -1, 1);
    selected.armAngle = Math.hypot(selected.aimX, selected.aimZ) > 0.1 ? Math.atan2(selected.aimX, selected.aimZ) : selected.angle;
    if (actions.jump) this._jump(selected);
    if (input.shootHeld) this.shotCharge = Math.min(1, this.shotCharge + dt / 0.85);
    if (s.family === 'race') { this._raceStep(dt, input, actions); return; }
    var moveSpeed = (s.kind === 'puck' ? 5.6 : s.swim ? 2.4 : 4.7) * (selected.crouching ? 0.6 : 1) * (0.8 + rating(selected, 'speed') / 350);
    this._move(selected, clamp(finite(input.moveX, 0), -1, 1), clamp(finite(input.moveZ, 0), -1, 1), moveSpeed, dt);
    if (s.family === 'target') {
      this.metrics.aimX = clamp(this.metrics.aimX + selected.aimX * dt * 1.2, -2.5, 2.5); this.metrics.aimY = clamp(this.metrics.aimY - selected.aimZ * dt * 1.2, -2, 2);
      if (actions.pass) { this.metrics.aimX = 0; this.metrics.aimY = 0; }
      if (actions.shootReleased) this._targetShoot(selected, this.shotCharge);
      this._targetStep(dt); return;
    }
    for (var j = 0; j < this.players.length; j++) if (j !== this.selectedId) {
      if (s.family === 'net') this._netAI(this.players[j], dt); else if (s.family === 'wall') this._wallAI(this.players[j], dt); else this._goalAI(this.players[j], dt);
    }
    if (s.family === 'net') { if (actions.shootReleased || actions.pass) this._netHit(selected, this.shotCharge || 0.65, !!actions.pass, false); this._netBall(dt); return; }
    if (s.family === 'wall') { if (actions.shootReleased || actions.pass) this._wallHit(selected, this.shotCharge || 0.65, !!actions.pass, false); this._wallBall(dt); return; }
    if (input.crouch) this._defend(selected, dt);
    if (actions.pass) this._pass(selected, selected.aimX, selected.aimZ);
    if (actions.shootReleased) {
      if (s.family === 'goal') this._goalShot(selected, this.shotCharge || 0.65, false, selected.aimX, selected.aimZ);
      else if (this.ball.holder === selected.id) {
        if (s.id === 'american-football' || s.id === 'flag-football') this._pass(selected, selected.aimX, selected.aimZ || -1);
        else { selected.vz -= selected.team === 0 ? 2 : -2; selected.action = 'run'; selected.actionTime = 0.4; }
      }
      this.shotCharge = 0;
    }
    this._goalBall(dt);
    this.shotClock = Math.max(0, this.shotClock - dt);
    if (this.shotClock <= 0 && this._resetDelay <= 0) { this._event('turnover', { team: this.possessionTeam, reason: 'practiceClock' }); this._restart(1 - this.possessionTeam); }
  };
  Core.prototype.step = function (dt, input) {
    dt = clamp(finite(dt, 0), 0, 0.25); input = input || {};
    if (!dt || this.ended) return;
    var actions = { jump: !!input.jump && !this._lastInput.jump, pass: !!input.pass && !this._lastInput.pass, switchPlayer: !!input.switchPlayer && !this._lastInput.switchPlayer,
      shootReleased: !!input.shootReleased || (!!this._lastInput.shootHeld && !input.shootHeld) };
    var count = Math.ceil(dt * 60);
    for (var i = 0; i < count; i++) this._substep(dt / count, input, i === 0 ? actions : {});
    this._lastInput = { jump: !!input.jump, pass: !!input.pass, shootHeld: !!input.shootHeld, switchPlayer: !!input.switchPlayer };
  };

  /* ---- Snapshots --------------------------------------------------------------------------- */
  Core.prototype.getSnapshot = function () {
    var s = this.spec, goals = s.family === 'goal' ? [{ x: 0, z: s.bounds.minZ, width: s.goalWidth, height: s.goalHeight, team: 0 }, { x: 0, z: s.bounds.maxZ, width: s.goalWidth, height: s.goalHeight, team: 1 }] : null;
    var batting = null;
    if (s.family === 'batting') {
      var f = this._flight, cross = f && f.type === 'pitch' ? this._crossPoint(f) : null;
      batting = { plateZ: s.batting.plateZ, moundZ: s.batting.moundZ, zone: s.batting.zone, fence: s.batting.fence, fenceHeight: s.batting.fenceHeight, bounce: s.batting.bounce, stumps: s.batting.stumps || null,
        cursorX: this.batter.cursorX, cursorY: this.batter.cursorY, loaded: this.batter.loaded, swungAt: this.batter.swungAt, swingKind: this.batter.swingKind,
        pitch: f && f.type === 'pitch' ? { type: f.pitch, progress: clamp(f.elapsed / f.duration, 0, 1), crossX: cross.x, crossY: cross.y, inZone: f.inZone, duration: f.duration } : null,
        lastContact: this.batter.lastContact, state: this.ball.state };
    }
    return copy({ version: 7, sport: this.sport, family: s.family, fieldType: s.fieldType, practiceRules: true, difficulty: this.difficulty, seed: this.seed, duration: this.duration,
      players: this.players, ball: this.ball, bounds: s.bounds, net: s.netHeight ? { z: 0, height: s.netHeight } : null, goals: goals,
      target: s.family === 'target' ? { x: 0, y: 1.7, z: -12, radius: 1.2 } : null, finishZ: s.family === 'race' ? -14 : null,
      wall: s.family === 'wall' ? { z: s.bounds.minZ, tin: s.tin, outLine: s.outLine } : null,
      golf: s.family === 'golf' ? { hole: s.hole, tee: s.tee, windX: this.metrics.windX, aimX: this.metrics.aimX, aimY: this.metrics.aimY, strokes: this.metrics.holeStrokes } : null,
      lane: s.family === 'lane' ? { foulZ: s.foulZ, pinZ: s.pinZ, pins: this.pins, aimX: this.metrics.aimX, hook: this.metrics.hook } : null,
      cue: s.family === 'cue' ? { balls: this.balls, aim: this.metrics.aimX, turn: this._turn, pockets: this._pockets() } : null,
      batting: batting, turn: this._turn,
      clock: this.clock, timeRemaining: this.timeRemaining, shotClock: this.shotClock, score: this.score, shotCharge: this.shotCharge, selectedId: this.selectedId,
      possessionTeam: this.possessionTeam, ended: this.ended, metrics: this.metrics,
      internals: { rng: this._rng, lastInput: this._lastInput, resetDelay: this._resetDelay, nextTeam: this._nextTeam, flight: this._flight, rally: this._rally, pitchTimer: this._pitchTimer,
        raceLastAction: this._raceLastAction, raceBoost: this._raceBoost, batter: this.batter || null, pins: this.pins || null, balls: this.balls || null, turn: this._turn, aiShotTimer: this._aiShotTimer || 0,
        pendingReset: !!this._pendingReset, cuePocketed: this.cuePocketedThisTurn || 0, scratch: !!this.scratchThisTurn } });
  };
  Core.prototype.applySnapshot = function (snapshot) {
    if (!snapshot || snapshot.version !== 7 || !sports.some(function (s) { return s.id === snapshot.sport; })) throw new Error('Invalid sports snapshot');
    var s = copy(snapshot), spec = sports.find(function (p) { return p.id === s.sport; });
    function validNumbers(value) { if (typeof value === 'number') return Number.isFinite(value); if (value && typeof value === 'object') return Object.keys(value).every(function (k) { return validNumbers(value[k]); }); return true; }
    if (!validNumbers(snapshot) || !Array.isArray(s.players) || s.players.length !== spec.teamSize * 2 || !s.ball || !s.internals || !s.metrics || !Number.isInteger(s.selectedId) || s.selectedId < 0 || s.selectedId >= spec.teamSize ||
      ![0, 1].includes(s.possessionTeam) || !Array.isArray(s.score) || s.score.length !== 2 || !s.score.every(function (v) { return Number.isFinite(v) && v >= 0; }) ||
      ![s.clock, s.timeRemaining, s.shotClock, s.shotCharge, s.duration, s.ball.x, s.ball.y, s.ball.z].every(Number.isFinite)) throw new Error('Invalid sports state');
    if (s.players.some(function (p, i) { return p.id !== i || p.team !== (i < spec.teamSize ? 0 : 1) || ![p.x, p.y, p.z, p.vx, p.vz, p.angle].every(Number.isFinite); }) ||
      (s.ball.holder !== null && (!Number.isInteger(s.ball.holder) || s.ball.holder < 0 || s.ball.holder >= s.players.length))) throw new Error('Invalid sports player');
    this.spec = spec; this.sport = s.sport; this.difficulty = DIFFICULTY[s.difficulty] ? s.difficulty : 'easy'; this.seed = s.seed >>> 0; this.duration = s.duration;
    this.players = s.players; this.ball = s.ball; this.clock = s.clock; this.timeRemaining = s.timeRemaining; this.shotClock = s.shotClock; this.score = s.score; this.shotCharge = s.shotCharge;
    this.selectedId = s.selectedId; this.possessionTeam = s.possessionTeam; this.ended = !!s.ended; this.metrics = s.metrics;
    var it = s.internals;
    this._rng = it.rng >>> 0; this._lastInput = it.lastInput || {}; this._resetDelay = finite(it.resetDelay, 0); this._nextTeam = it.nextTeam || 0; this._flight = it.flight || null; this._rally = it.rally || null;
    this._pitchTimer = finite(it.pitchTimer, 1); this._raceLastAction = it.raceLastAction || null; this._raceBoost = finite(it.raceBoost, 0); this.batter = it.batter || (spec.family === 'batting' ? { cursorX: 0, cursorY: 0.8, loaded: false, loadTime: 0, swungAt: null, swingKind: null, lastContact: null } : null);
    this.pins = it.pins || null; this.balls = it.balls || null; this._turn = it.turn || 0; this._aiShotTimer = finite(it.aiShotTimer, 0); this._pendingReset = !!it.pendingReset; this.cuePocketedThisTurn = it.cuePocketed || 0; this.scratchThisTurn = !!it.scratch;
    this.objects = this.pins || this.balls || []; this._events = [];
    return this;
  };
  return { Core: Core, sports: copy(sports), version: '7.0.0', ratingBasis: 'fictional-game-balance', scoring: 'simplified-practice', events: EV };
});
