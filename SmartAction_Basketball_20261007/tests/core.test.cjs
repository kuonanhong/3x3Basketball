'use strict';
const assert = require('node:assert/strict');
const { Core, bounds } = require('../game-core.js');
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function advance(core, seconds, input = {}) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) core.step(1 / 60, input);
}
test('six players and two balanced teams start with playable possession', () => {
  const core = new Core({ seed: 42 });
  assert.equal(core.players.length, 6);
  assert.equal(core.players.filter(p => p.team === 0).length, 3);
  assert.equal(core.ball.holder, 0);
  assert.equal(core.selectedPlayer.id, 0);
  assert.deepEqual(core.score, [0, 0]);
});
test('seeded AI is deterministic over a real 30-second sequence', () => {
  const a = new Core({ seed: 42 });
  const b = new Core({ seed: 42 });
  for (let i = 0; i < 1800; i++) {
    const input = { moveX: Math.sin(i / 80), moveZ: Math.cos(i / 91), shootHeld: i % 120 < 30, jump: i % 200 === 0, pass: i % 178 === 0 };
    a.step(1 / 60, input); b.step(1 / 60, input);
  }
  assert.deepEqual(a.getSnapshot(), b.getSnapshot());
});
test('diagonal controls are normalized and court boundaries remain finite', () => {
  const core = new Core({ seed: 12 });
  advance(core, 10, { moveX: 100, moveZ: 100 });
  for (const p of core.players) {
    assert(Number.isFinite(p.x) && Number.isFinite(p.z));
    assert(p.x >= bounds.minX && p.x <= bounds.maxX);
    assert(p.z >= bounds.minZ && p.z <= bounds.maxZ);
  }
  assert(Math.hypot(core.selectedPlayer.vx, core.selectedPlayer.vz) <= 4.4 + 1e-9);
});
test('jump rises above the floor and returns without retriggering while held', () => {
  const core = new Core({ seed: 2 });
  advance(core, 0.2, { jump: true });
  assert(core.players[0].y > 0.4);
  advance(core, 0.9, { jump: true });
  assert.equal(core.players[0].y, 0);
  assert.equal(core.players[0].jumpTime, 0);
});
test('right-hand aiming stays independent of leg movement direction', () => {
  const core = new Core({ seed: 3 });
  advance(core, 0.2, { moveX: 1, moveZ: 0, aimX: 0, aimZ: -1 });
  assert(Math.abs(core.players[0].angle - Math.PI / 2) < 1e-6);
  assert(Math.abs(Math.abs(core.players[0].armAngle) - Math.PI) < 1e-6);
  assert.equal(core.players[0].aimX, 0);
  assert.equal(core.players[0].aimZ, -1);
});
test('a directed pass transfers possession to the left teammate', () => {
  const core = new Core({ seed: 51 });
  core.step(1 / 60, { pass: true, aimX: -1, aimZ: 0 });
  const events = core.consumeEvents();
  const pass = events.find(e => e.type === 'pass');
  assert(pass && pass.targetId === 1);
  advance(core, 0.7);
  assert.equal(core.ball.holder, 1);
  assert.equal(core.selectedId, 1);
});
test('outside-arc release creates a three-point attempt and can score', () => {
  let scored = false;
  for (let seed = 1; seed < 30 && !scored; seed++) {
    const core = new Core({ seed });
    core.step(1 / 60, { shootReleased: true });
    const attempt = core.consumeEvents().find(e => e.type === 'shotAttempt');
    assert.equal(attempt.points, 3);
    assert.equal(attempt.style, 'three');
    advance(core, 1.5);
    const score = core.consumeEvents().find(e => e.type === 'score');
    if (score) {
      assert.equal(score.points, 3);
      assert.equal(core.score[0], 3);
      scored = true;
    }
  }
  assert(scored, 'at least one seeded open shot must score');
});
test('aiming toward the basket improves actual success over aiming away', () => {
  let toward = 0, away = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const a = new Core({ seed, difficulty: 'normal' });
    const b = new Core({ seed, difficulty: 'normal' });
    a.step(1 / 60, { shootReleased: true, aimZ: -1 });
    b.step(1 / 60, { shootReleased: true, aimZ: 1 });
    advance(a, 1.5); advance(b, 1.5);
    if (a.score[0] === 3) toward++;
    if (b.score[0] === 3) away++;
  }
  assert(toward > away + 15, `toward=${toward}, away=${away}`);
});
test('near-rim jump and shoot creates a dunk highlight', () => {
  const core = new Core({ seed: 1 });
  core.players[0].x = 0; core.players[0].z = -4.6;
  core.players[3].x = 7; core.players[3].z = 5;
  core.step(1 / 60, { jump: true });
  core.step(1 / 60, { shootReleased: true });
  const attempt = core.consumeEvents().find(e => e.type === 'shotAttempt');
  assert.equal(attempt.style, 'dunk');
  advance(core, 0.6);
  assert(core.consumeEvents().some(e => e.type === 'dunk' && e.highlight));
});
test('a saved flight snapshot restores deterministic shot and score continuation', () => {
  const a = new Core({ seed: 19 });
  a.step(1 / 60, { shootReleased: true });
  advance(a, 0.4);
  const snapshot = a.getSnapshot();
  const b = new Core({ seed: 999 }).applySnapshot(snapshot);
  advance(a, 2.5); advance(b, 2.5);
  assert.deepEqual(a.getSnapshot(), b.getSnapshot());
  assert.equal(snapshot.ball.state, 'shot');
});
test('snapshots are isolated values and invalid snapshots are rejected', () => {
  const core = new Core();
  const snapshot = core.getSnapshot();
  snapshot.players[0].x = NaN;
  assert.notEqual(core.players[0].x, snapshot.players[0].x);
  assert.throws(() => core.applySnapshot(snapshot), /Invalid/);
  assert.throws(() => core.applySnapshot({}), /Invalid/);
});
test('shot-clock expiration changes possession without locking gameplay', () => {
  const core = new Core({ seed: 17 });
  core.shotClock = 0.02;
  core.step(1 / 20, {});
  assert.equal(core.possessionTeam, 1);
  assert(core.consumeEvents().some(e => e.type === 'turnover'));
  assert(core.shotClock > 13);
});
test('event buffering stays bounded when consumed late', () => {
  const core = new Core();
  for (let i = 0; i < 1000; i++) core._event('test', { i });
  assert.equal(core.consumeEvents().length, 40);
  assert.equal(core.consumeEvents().length, 0);
});
test('a complete three-minute match terminates with finite state', () => {
  const core = new Core({ seed: 444, difficulty: 'hard' });
  for (let i = 0; i < 11000 && !core.ended; i++) {
    core.step(1 / 60, { moveX: Math.sin(i / 133), moveZ: Math.cos(i / 173), shootHeld: i % 150 < 35, pass: i % 320 === 0, jump: i % 100 === 0 });
  }
  assert(core.ended);
  assert.equal(core.timeRemaining, 0);
  const s = core.getSnapshot();
  assert(s.players.every(p => Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.y)));
  assert(Number.isFinite(s.ball.x) && Number.isFinite(s.ball.y));
  assert(s.score.every(n => Number.isInteger(n) && n >= 0));
});
test('invalid frame durations do not damage the simulation', () => {
  const core = new Core();
  const before = core.getSnapshot();
  core.step(NaN, { moveX: Infinity });
  core.step(-1, {});
  assert.deepEqual(core.getSnapshot(), before);
  core.step(3, { moveX: Infinity, moveZ: NaN });
  assert(Math.abs(core.clock - 0.25) < 1e-9);
  assert(core.players.every(p => Number.isFinite(p.x)));
});
console.log(`\n${count} core tests passed.`);
