/* SmartAction original 3-on-3 basketball simulation. MIT license. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SAHoopsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var HOOP = { x: 0, z: -6, y: 3.05 };
  var BOUNDS = { minX: -7.5, maxX: 7.5, minZ: -6.75, maxZ: 6.75 };
  var GRAVITY = 9.81;
  var SETTINGS = {
    easy: { aiSpeed: 2.35, aiAccuracy: 0.51, defense: 0.38, playerSpeed: 4.4, shotBonus: 0.18 },
    normal: { aiSpeed: 2.8, aiAccuracy: 0.63, defense: 0.6, playerSpeed: 4.15, shotBonus: 0.08 },
    hard: { aiSpeed: 3.25, aiAccuracy: 0.73, defense: 0.8, playerSpeed: 4.0, shotBonus: 0 }
  };
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function finite(value, fallback) { return Number.isFinite(value) ? value : fallback; }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function Core(options) {
    options = options || {};
    this.difficulty = SETTINGS[options.difficulty] ? options.difficulty : 'easy';
    this.seed = (Number(options.seed) >>> 0) || 971031;
    this.duration = clamp(finite(options.duration, 180), 20, 900);
    this.reset();
  }
  Core.prototype._random = function () {
    var x = this._rng >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this._rng = x >>> 0;
    return this._rng / 4294967296;
  };
  Core.prototype.reset = function () {
    this._rng = this.seed;
    this.clock = 0;
    this.score = [0, 0];
    this.timeRemaining = this.duration;
    this.shotClock = 14;
    this.selectedId = 0;
    this.possessionTeam = 0;
    this.shotCharge = 0;
    this.ended = false;
    this._events = [];
    this._flight = null;
    this._resetDelay = 0;
    this._nextPossession = 0;
    this._lastInput = {};
    this.players = [];
    for (var i = 0; i < 6; i++) {
      this.players.push({ id: i, team: i < 3 ? 0 : 1, number: i % 3 + 1,
        x: 0, z: 0, y: 0, vx: 0, vz: 0, angle: Math.PI, armAngle: Math.PI, aimX: 0, aimZ: 0,
        stamina: 1, jumpTime: 0, crouching: false, action: 'idle',
        cooldown: 0, aiTimer: 0.8 + this._random() * 0.8, actionTime: 0 });
    }
    this.ball = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, holder: 0, ownerId: 0, state: 'held' };
    this._resetPossession(0);
    return this;
  };
  Object.defineProperty(Core.prototype, 'selectedPlayer', {
    get: function () { return this.players[this.selectedId]; }
  });
  Core.prototype._event = function (type, data) {
    var event = Object.assign({ type: type, time: this.clock }, data || {});
    this._events.push(event);
    if (this._events.length > 40) this._events.splice(0, this._events.length - 40);
  };
  Core.prototype.consumeEvents = function () {
    var result = this._events;
    this._events = [];
    return result;
  };
  Core.prototype._resetPossession = function (team) {
    var offense = team * 3;
    var defense = (1 - team) * 3;
    var positions = [{ x: 0, z: 2.2 }, { x: -4.1, z: 0.3 }, { x: 4.1, z: 0.3 }];
    for (var i = 0; i < 3; i++) {
      var a = this.players[offense + i];
      var b = this.players[defense + i];
      a.x = positions[i].x; a.z = positions[i].z; a.vx = 0; a.vz = 0;
      b.x = positions[i].x + (i === 1 ? 0.55 : -0.55); b.z = positions[i].z - 1.4;
      b.vx = 0; b.vz = 0;
      a.aiTimer = 0.7 + this._random() * 0.65;
      b.aiTimer = 0.7 + this._random() * 0.65;
      a.y = b.y = 0; a.jumpTime = b.jumpTime = 0;
      a.action = b.action = 'idle'; a.actionTime = b.actionTime = 0;
      a.crouching = b.crouching = false; a.cooldown = b.cooldown = 0;
      a.angle = b.angle = a.armAngle = b.armAngle = Math.PI;
      a.aimX = b.aimX = a.aimZ = b.aimZ = 0;
    }
    this._flight = null;
    this._resetDelay = 0;
    this.shotCharge = 0;
    this.shotClock = 14;
    this.possessionTeam = team;
    this.ball.holder = offense;
    this.ball.ownerId = offense;
    this.ball.state = 'held';
    this.ball.vx = this.ball.vy = this.ball.vz = 0;
    if (team === 0) this.selectedId = offense;
    this._syncHeldBall();
  };
  Core.prototype._syncHeldBall = function () {
    if (this.ball.holder === null) return;
    var p = this.players[this.ball.holder];
    var moving = Math.hypot(p.vx, p.vz) > 0.2;
    var ballDirection = Number.isFinite(p.armAngle) ? p.armAngle : p.angle;
    this.ball.x = p.x + Math.sin(ballDirection + 0.45) * 0.35;
    this.ball.z = p.z + Math.cos(ballDirection + 0.45) * 0.35;
    this.ball.y = p.y + (this.shotCharge > 0.01 && p.id === this.selectedId ? 1.7 :
      (moving ? 0.45 + Math.abs(Math.sin(this.clock * 10)) * 0.75 : 1.0));
    this.ball.ownerId = p.id;
  };
  Core.prototype._move = function (p, dx, dz, speed, dt) {
    var length = Math.hypot(dx, dz);
    if (length > 1) { dx /= length; dz /= length; }
    var desiredX = dx * speed, desiredZ = dz * speed;
    var smooth = Math.min(1, dt * 15);
    p.vx += (desiredX - p.vx) * smooth;
    p.vz += (desiredZ - p.vz) * smooth;
    p.x = clamp(p.x + p.vx * dt, BOUNDS.minX, BOUNDS.maxX);
    p.z = clamp(p.z + p.vz * dt, BOUNDS.minZ, BOUNDS.maxZ);
    if (Math.abs(p.vx) + Math.abs(p.vz) > 0.15) {
      p.angle = Math.atan2(p.vx, p.vz);
      if (p.actionTime <= 0) p.action = this.ball.holder === p.id ? 'dribble' : 'run';
    } else if (p.actionTime <= 0) p.action = 'idle';
  };
  Core.prototype._jump = function (p) {
    if (p.jumpTime > 0 || p.cooldown > 0.6) return;
    p.jumpTime = 0.66;
    p.action = 'jump'; p.actionTime = 0.66;
    p.stamina = Math.max(0.35, p.stamina - 0.1);
  };
  Core.prototype._takeBall = function (p, newClock) {
    var oldTeam = this.possessionTeam;
    this.possessionTeam = p.team;
    this.ball.holder = p.id; this.ball.ownerId = p.id;
    this.ball.state = 'held'; this._flight = null;
    this.ball.vx = this.ball.vy = this.ball.vz = 0;
    if (newClock || oldTeam !== p.team) this.shotClock = 14;
    if (p.team === 0) this.selectedId = p.id;
    p.aiTimer = 0.65 + this._random() * 0.7;
    this._syncHeldBall();
  };
  Core.prototype._pass = function (p, aimX, aimZ) {
    if (this.ball.holder !== p.id || p.cooldown > 0) return false;
    var candidates = this.players.filter(function (q) { return q.team === p.team && q.id !== p.id; });
    var aimLength = Math.hypot(aimX, aimZ);
    var best = candidates[0], bestValue = -Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var q = candidates[i], d = distance(p, q);
      var open = 8;
      for (var j = 0; j < this.players.length; j++) {
        if (this.players[j].team !== p.team) open = Math.min(open, distance(q, this.players[j]));
      }
      var alignment = aimLength > 0.2 ? ((q.x - p.x) * aimX + (q.z - p.z) * aimZ) / (d * aimLength + 0.01) * 4 : 0;
      var value = open - d * 0.08 + alignment;
      if (value > bestValue) { bestValue = value; best = q; }
    }
    this.ball.holder = null; this.ball.ownerId = null; this.ball.state = 'pass';
    this.ball.x = p.x; this.ball.z = p.z; this.ball.y = 1.4 + p.y;
    var travel = clamp(distance(p, best) / 11, 0.22, 0.7);
    this._flight = { type: 'pass', elapsed: 0, duration: travel, fromX: p.x, fromZ: p.z,
      fromY: this.ball.y, targetId: best.id, shooterId: p.id, team: p.team };
    p.action = 'pass'; p.actionTime = 0.35; p.cooldown = 0.4;
    this.shotCharge = 0;
    this._event('pass', { playerId: p.id, targetId: best.id, team: p.team });
    return true;
  };
  Core.prototype._shoot = function (p, charge, isAI, aimX, aimZ) {
    if (this.ball.holder !== p.id || p.cooldown > 0) return false;
    var settings = SETTINGS[this.difficulty];
    var d = distance(p, HOOP);
    var style = d < 1.75 && p.jumpTime > 0 ? 'dunk' : d < 3.1 ? 'layup' : d >= 6.1 ? 'three' : 'shot';
    var points = style === 'three' ? 3 : 2;
    var nearest = 10;
    for (var i = 0; i < this.players.length; i++) {
      var q = this.players[i];
      if (q.team !== p.team) nearest = Math.min(nearest, distance(p, q));
    }
    var timing = 1 - Math.min(1, Math.abs(charge - 0.62) / 0.62);
    var probability = isAI ? settings.aiAccuracy : 0.58 + settings.shotBonus + timing * 0.2;
    var aimLength = Math.hypot(finite(aimX, 0), finite(aimZ, 0));
    var aimAlignment = null;
    if (!isAI && aimLength > 0.2 && d > 0.1) {
      aimAlignment = clamp(((HOOP.x - p.x) * aimX + (HOOP.z - p.z) * aimZ) / (d * aimLength), -1, 1);
      // Zero aim uses assistance. An explicit wrong direction lowers accuracy,
      // while the modest penalty still lets a beginner recover with good timing.
      probability -= (1 - aimAlignment) * (this.difficulty === 'easy' ? 0.075 : 0.12);
    }
    probability -= Math.max(0, d - 4.8) * 0.038;
    probability -= Math.max(0, 1.7 - nearest) * 0.15;
    if (style === 'dunk') probability = 0.94;
    if (style === 'layup') probability += 0.08;
    probability = clamp(probability, 0.2, 0.96);
    var willScore = this._random() < probability;
    var angle = this._random() * Math.PI * 2;
    var miss = willScore ? this._random() * 0.14 : 0.65 + this._random() * 0.8;
    var targetX = HOOP.x + Math.cos(angle) * miss;
    var targetZ = HOOP.z + Math.sin(angle) * miss;
    var duration = style === 'dunk' ? 0.42 : clamp(0.8 + d * 0.052, 0.85, 1.38);
    this.ball.x = p.x; this.ball.y = (style === 'dunk' ? 2.35 : 1.72) + p.y; this.ball.z = p.z;
    this.ball.vx = (targetX - p.x) / duration;
    this.ball.vz = (targetZ - p.z) / duration;
    this.ball.vy = (HOOP.y - this.ball.y + 0.5 * GRAVITY * duration * duration) / duration;
    this.ball.holder = null; this.ball.ownerId = null; this.ball.state = 'shot';
    this._flight = { type: 'shot', elapsed: 0, duration: duration, fromX: p.x, fromY: this.ball.y,
      fromZ: p.z, initialVX: this.ball.vx, initialVY: this.ball.vy, initialVZ: this.ball.vz,
      shooterId: p.id, team: p.team, style: style, points: points, willScore: willScore, resolved: false };
    p.angle = Math.atan2(HOOP.x - p.x, HOOP.z - p.z);
    p.armAngle = p.angle;
    p.action = style; p.actionTime = 0.65; p.cooldown = 0.8;
    this.shotCharge = 0;
    this._event('shotAttempt', { playerId: p.id, team: p.team, style: style, points: points,
      aimAssisted: aimAlignment === null, aimAlignment: aimAlignment });
    return true;
  };
  Core.prototype._steal = function (p) {
    if (this.ball.holder === null || p.cooldown > 0) return;
    var owner = this.players[this.ball.holder];
    if (owner.team === p.team || distance(p, owner) > 1.35) return;
    p.cooldown = 0.85;
    var chance = p.team === 0 ? 0.38 + SETTINGS[this.difficulty].shotBonus : SETTINGS[this.difficulty].defense * 0.42;
    if (this._random() < chance) {
      this._takeBall(p, true);
      p.action = 'steal'; p.actionTime = 0.4;
      this._event('steal', { playerId: p.id, team: p.team });
    }
  };
  Core.prototype._ai = function (p, dt) {
    var settings = SETTINGS[this.difficulty];
    var holder = this.ball.holder === null ? null : this.players[this.ball.holder];
    var targetX = p.x, targetZ = p.z, speed = settings.aiSpeed;
    if (!holder) {
      if (this.ball.state === 'loose') { targetX = this.ball.x; targetZ = this.ball.z; }
      else {
        targetX = (p.id % 3 - 1) * 3.0;
        targetZ = p.team === this.possessionTeam ? -3.8 : -4.9;
      }
    } else if (holder.id === p.id) {
      var lane = Math.sin(this.clock * 0.55 + p.id) * 1.9;
      targetX = lane; targetZ = -3.2;
      p.aiTimer -= dt;
      var nearbyDefender = 8;
      for (var k = 0; k < this.players.length; k++) {
        if (this.players[k].team !== p.team) nearbyDefender = Math.min(nearbyDefender, distance(p, this.players[k]));
      }
      if (p.aiTimer <= 0) {
        if (nearbyDefender < 1.0 && this._random() < 0.35 && this.shotClock > 3) this._pass(p, 0, 0);
        else if (distance(p, HOOP) < 4.4 || this.shotClock < 3 || this._random() < 0.24) {
          if (distance(p, HOOP) < 1.75) this._jump(p);
          this._shoot(p, 0.6, true);
        }
        p.aiTimer = 0.65 + this._random() * 0.8;
      }
    } else if (p.team === holder.team) {
      var wing = p.id % 3;
      targetX = wing === 1 ? -4.9 : wing === 2 ? 4.9 : 0.4;
      targetZ = wing === 0 ? -3.2 : -1.4 + Math.sin(this.clock * 0.7 + p.id) * 0.7;
      if (distance(p, holder) < 1.4) targetX += p.x < holder.x ? -1 : 1;
    } else {
      var matchup = this.players[(1 - p.team) * 3 + p.id % 3];
      if (matchup.id === holder.id) {
        targetX = holder.x + (HOOP.x - holder.x) * 0.13;
        targetZ = holder.z + (HOOP.z - holder.z) * 0.13;
        if (distance(p, holder) < 1.12 && this._random() < dt * settings.defense * 0.8) this._steal(p);
      } else {
        targetX = matchup.x * 0.9;
        targetZ = matchup.z - 0.75;
      }
      speed *= 0.9;
    }
    var dx = targetX - p.x, dz = targetZ - p.z;
    var d = Math.hypot(dx, dz);
    if (d > 0.2) { dx /= Math.max(d, 1); dz /= Math.max(d, 1); }
    else dx = dz = 0;
    this._move(p, dx, dz, speed, dt);
  };
  Core.prototype._ballStep = function (dt) {
    if (this.ball.holder !== null) { this._syncHeldBall(); return; }
    var flight = this._flight;
    if (flight && flight.type === 'pass') {
      flight.elapsed += dt;
      var receiver = this.players[flight.targetId];
      var t = Math.min(1, flight.elapsed / flight.duration);
      this.ball.x = flight.fromX + (receiver.x - flight.fromX) * t;
      this.ball.z = flight.fromZ + (receiver.z - flight.fromZ) * t;
      this.ball.y = flight.fromY + (1.15 + receiver.y - flight.fromY) * t + Math.sin(t * Math.PI) * 0.25;
      if (t > 0.15 && t < 0.95) {
        for (var i = 0; i < this.players.length; i++) {
          var defender = this.players[i];
          if (defender.team !== flight.team && defender.cooldown <= 0 && distance(defender, this.ball) < 0.6 && this._random() < dt * 2.0) {
            this._takeBall(defender, true);
            this._event('steal', { playerId: defender.id, team: defender.team, intercepted: true });
            return;
          }
        }
      }
      if (t >= 1) this._takeBall(receiver, false);
      return;
    }
    if (flight && flight.type === 'shot') {
      flight.elapsed += dt;
      var elapsed = flight.elapsed;
      this.ball.x = flight.fromX + flight.initialVX * elapsed;
      this.ball.z = flight.fromZ + flight.initialVZ * elapsed;
      this.ball.y = flight.fromY + flight.initialVY * elapsed - 0.5 * GRAVITY * elapsed * elapsed;
      this.ball.vy = flight.initialVY - GRAVITY * elapsed;
      if (elapsed < Math.min(0.4, flight.duration * 0.6)) {
        for (var j = 0; j < this.players.length; j++) {
          var blocker = this.players[j];
          if (blocker.team !== flight.team && blocker.jumpTime > 0 && distance(blocker, this.ball) < 0.82 && this.ball.y < blocker.y + 2.35) {
            this.ball.state = 'loose'; this._flight = null;
            this.ball.vx *= -0.36; this.ball.vz *= -0.36; this.ball.vy = 1.6;
            blocker.action = 'block'; blocker.actionTime = 0.55;
            this._event('block', { playerId: blocker.id, team: blocker.team });
            return;
          }
        }
      }
      if (!flight.resolved && elapsed >= flight.duration) {
        flight.resolved = true;
        if (flight.willScore) {
          this.score[flight.team] += flight.points;
          this._event('score', { playerId: flight.shooterId, team: flight.team,
            points: flight.points, style: flight.style, highlight: true });
          this._event(flight.style === 'dunk' || flight.style === 'layup' || flight.style === 'three' ? flight.style : 'basket',
            { playerId: flight.shooterId, team: flight.team, points: flight.points, highlight: true });
          this.ball.x = HOOP.x; this.ball.z = HOOP.z;
          this.ball.vx = this.ball.vz = 0;
          this._nextPossession = 1 - flight.team;
          this._resetDelay = 0.78;
        } else {
          this.ball.state = 'loose'; this._flight = null;
          this.ball.vx *= 0.42; this.ball.vz *= -0.45; this.ball.vy = 1.7;
          this._event('miss', { playerId: flight.shooterId, team: flight.team, points: flight.points });
        }
      }
      return;
    }
    // A loose ball uses a damped CPU-only ballistic bounce and proximity pickup.
    this.ball.vy -= GRAVITY * dt;
    this.ball.x += this.ball.vx * dt; this.ball.z += this.ball.vz * dt;
    this.ball.y += this.ball.vy * dt;
    if (this.ball.y < 0.24) {
      this.ball.y = 0.24;
      this.ball.vy = Math.abs(this.ball.vy) * 0.56;
      this.ball.vx *= 0.7; this.ball.vz *= 0.7;
    }
    if (this.ball.x < BOUNDS.minX || this.ball.x > BOUNDS.maxX) {
      this.ball.x = clamp(this.ball.x, BOUNDS.minX, BOUNDS.maxX); this.ball.vx *= -0.65;
    }
    if (this.ball.z < BOUNDS.minZ || this.ball.z > BOUNDS.maxZ) {
      this.ball.z = clamp(this.ball.z, BOUNDS.minZ, BOUNDS.maxZ); this.ball.vz *= -0.65;
    }
    if (this.ball.y < 2.0) {
      var nearest = null, nearestDistance = 0.82;
      for (var q = 0; q < this.players.length; q++) {
        var current = distance(this.players[q], this.ball);
        if (current < nearestDistance && this.players[q].cooldown < 0.4) {
          nearest = this.players[q]; nearestDistance = current;
        }
      }
      if (nearest) {
        this._takeBall(nearest, true);
        this._event('rebound', { playerId: nearest.id, team: nearest.team });
      }
    }
  };
  Core.prototype._substep = function (dt, input, actions) {
    if (this.ended) return;
    this.clock += dt;
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining <= 0) {
      this.ended = true;
      this._event('gameOver', { score: this.score.slice(), winner: this.score[0] === this.score[1] ? null : this.score[0] > this.score[1] ? 0 : 1 });
      return;
    }
    if (this._resetDelay > 0) {
      this._resetDelay -= dt;
      this.ball.y = Math.max(0.24, this.ball.y - dt * 3.5);
      if (this._resetDelay <= 0) this._resetPossession(this._nextPossession);
      return;
    }
    var selected = this.players[this.selectedId];
    if (actions.switchPlayer) {
      this.selectedId = (this.selectedId + 1) % 3;
      selected = this.players[this.selectedId];
      this.shotCharge = 0;
    }
    for (var i = 0; i < this.players.length; i++) {
      var p = this.players[i];
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.actionTime = Math.max(0, p.actionTime - dt);
      p.stamina = Math.min(1, p.stamina + dt * 0.05);
      p.crouching = p.id === this.selectedId && !!input.crouch;
      if (p.jumpTime > 0) {
        p.jumpTime = Math.max(0, p.jumpTime - dt);
        p.y = Math.sin((1 - p.jumpTime / 0.66) * Math.PI) * 0.9;
      } else p.y = 0;
      if (p.id === this.selectedId) {
        var speed = SETTINGS[this.difficulty].playerSpeed * (p.crouching ? 0.55 : 1);
        if (input.shootHeld && this.ball.holder === p.id) {
          this.shotCharge = Math.min(1, this.shotCharge + dt / 0.9);
          speed *= 0.45;
          p.action = 'aim'; p.actionTime = 0.1;
        }
        this._move(p, finite(input.moveX, 0), finite(input.moveZ, 0), speed, dt);
        if (p.crouching && p.actionTime <= 0) p.action = 'crouch';
      } else {
        this._ai(p, dt);
        p.armAngle = p.angle; p.aimX = p.aimZ = 0;
      }
    }
    if (actions.jump) this._jump(selected);
    if (selected.crouching) this._steal(selected);
    if (actions.pass) this._pass(selected, finite(input.aimX, 0), finite(input.aimZ, 0));
    if (actions.shootReleased) this._shoot(selected, this.shotCharge > 0 ? this.shotCharge : 0.62, false,
      finite(input.aimX, 0), finite(input.aimZ, 0));
    var ax = finite(input.aimX, 0), az = finite(input.aimZ, 0);
    var aimLength = Math.hypot(ax, az);
    selected.aimX = aimLength > 1 ? ax / aimLength : ax;
    selected.aimZ = aimLength > 1 ? az / aimLength : az;
    selected.armAngle = aimLength > 0.2 ? Math.atan2(ax, az) : selected.angle;
    // A small stable separation avoids overlapping bodies without expensive rigid bodies.
    for (var a = 0; a < 6; a++) for (var b = a + 1; b < 6; b++) {
      var first = this.players[a], second = this.players[b];
      var dx = second.x - first.x, dz = second.z - first.z;
      var d = Math.hypot(dx, dz);
      if (d < 0.65) {
        if (d < 0.001) { dx = (a % 2 ? 1 : -1) * 0.01; dz = 0.01; d = Math.hypot(dx, dz); }
        var correction = (0.65 - d) * 0.35;
        first.x = clamp(first.x - dx / d * correction, BOUNDS.minX, BOUNDS.maxX);
        first.z = clamp(first.z - dz / d * correction, BOUNDS.minZ, BOUNDS.maxZ);
        second.x = clamp(second.x + dx / d * correction, BOUNDS.minX, BOUNDS.maxX);
        second.z = clamp(second.z + dz / d * correction, BOUNDS.minZ, BOUNDS.maxZ);
      }
    }
    this._ballStep(dt);
    if (this.ball.state !== 'shot') this.shotClock -= dt;
    if (this.shotClock <= 0 && this.ball.state !== 'shot') {
      this._event('turnover', { team: this.possessionTeam, reason: 'shotClock' });
      this._resetPossession(1 - this.possessionTeam);
    }
  };
  Core.prototype.step = function (dt, input) {
    input = input || {};
    dt = clamp(finite(dt, 0), 0, 0.25);
    if (!dt || this.ended) return;
    var actions = {
      jump: !!input.jump && !this._lastInput.jump,
      pass: !!input.pass && !this._lastInput.pass,
      switchPlayer: !!input.switchPlayer && !this._lastInput.switchPlayer,
      shootReleased: !!input.shootReleased || (!!this._lastInput.shootHeld && !input.shootHeld)
    };
    var count = Math.ceil(dt / (1 / 60));
    for (var i = 0; i < count; i++) {
      this._substep(dt / count, input, i === 0 ? actions : {});
    }
    this._lastInput = { jump: !!input.jump, pass: !!input.pass, switchPlayer: !!input.switchPlayer, shootHeld: !!input.shootHeld };
  };
  Core.prototype.getSnapshot = function () {
    return clone({ version: 1, difficulty: this.difficulty, seed: this.seed, duration: this.duration,
      players: this.players, ball: this.ball, hoop: HOOP, bounds: BOUNDS,
      clock: this.clock, timeRemaining: this.timeRemaining, shotClock: this.shotClock,
      score: this.score, selectedId: this.selectedId, possessionTeam: this.possessionTeam,
      shotCharge: this.shotCharge, ended: this.ended,
      internals: { rng: this._rng, flight: this._flight, resetDelay: this._resetDelay,
        nextPossession: this._nextPossession, lastInput: this._lastInput } });
  };
  Core.prototype.applySnapshot = function (snapshot) {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.players) || snapshot.players.length !== 6 || !snapshot.ball) {
      throw new Error('Invalid basketball snapshot');
    }
    var s = clone(snapshot);
    for (var i = 0; i < s.players.length; i++) {
      if (s.players[i].id !== i || (s.players[i].team !== 0 && s.players[i].team !== 1) ||
        !Number.isFinite(s.players[i].x) || !Number.isFinite(s.players[i].z)) throw new Error('Invalid player snapshot');
    }
    if (!Number.isInteger(s.selectedId) || s.selectedId < 0 || s.selectedId > 2 ||
      (s.ball.holder !== null && (!Number.isInteger(s.ball.holder) || s.ball.holder < 0 || s.ball.holder > 5))) throw new Error('Invalid possession snapshot');
    if (!Array.isArray(s.score) || s.score.length !== 2 || !s.score.every(Number.isFinite) ||
      !Number.isFinite(s.clock) || !Number.isFinite(s.timeRemaining) ||
      ![s.ball.x, s.ball.y, s.ball.z].every(Number.isFinite)) throw new Error('Invalid state snapshot');
    this.difficulty = SETTINGS[s.difficulty] ? s.difficulty : 'easy';
    this.seed = (s.seed >>> 0) || 971031; this.duration = s.duration;
    this.players = s.players; this.ball = s.ball; this.clock = s.clock;
    this.timeRemaining = s.timeRemaining; this.shotClock = s.shotClock;
    this.score = s.score; this.selectedId = s.selectedId; this.possessionTeam = s.possessionTeam;
    this.shotCharge = s.shotCharge; this.ended = !!s.ended;
    var internals = s.internals || {};
    this._rng = (internals.rng >>> 0) || this.seed;
    this._flight = internals.flight || null;
    this._resetDelay = finite(internals.resetDelay, 0);
    this._nextPossession = internals.nextPossession || 0;
    this._lastInput = internals.lastInput || {};
    this._events = [];
    return this;
  };
  return { Core: Core, hoop: clone(HOOP), bounds: clone(BOUNDS), scoring: 'recreational-2-and-3', version: '1.0.0' };
});
