/* SmartAction 3×3 — original, dependency-free Canvas renderer. */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const PRESETS = {
    lite: { dpr: 1, pixels: 700000, segments: 20, scenery: false, shadows: true },
    balanced: { dpr: 1.5, pixels: 1400000, segments: 32, scenery: true, shadows: true },
    full: { dpr: 2, pixels: 2400000, segments: 48, scenery: true, shadows: true }
  };
  const TEAM_COLORS = ['#13baad', '#ff7058'];

  class SAHoopsRenderer {
    constructor(canvas) {
      if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('A canvas is required.');
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      if (!this.ctx) throw new Error('Canvas 2D is unavailable.');
      this.quality = 'balanced';
      this.cssWidth = 0;
      this.cssHeight = 0;
      this.ratio = 1;
      this._camera = null;
      this._buildings = [
        { x: -15, z: -16, w: 4.3, d: 4, h: 6.5, c: '#bac7c8' },
        { x: -8.8, z: -18, w: 4, d: 4, h: 9, c: '#a4b9be' },
        { x: -2.7, z: -18.8, w: 4.5, d: 3.4, h: 5, c: '#c0ccca' },
        { x: 5, z: -18, w: 4, d: 3.5, h: 7.8, c: '#b5c7cc' },
        { x: 11.5, z: -16, w: 3.5, d: 4, h: 5.8, c: '#a6bdc3' },
        { x: 15, z: -9, w: 4, d: 4, h: 8.2, c: '#b8c7c6' }
      ];
      this.resize();
    }

    setQuality(quality) {
      this.quality = Object.prototype.hasOwnProperty.call(PRESETS, quality) ? quality : 'balanced';
      this.resize();
      return this.quality;
    }

    resize(width, height) {
      const rect = this.canvas.getBoundingClientRect();
      this.cssWidth = Math.max(1, Math.round(width || rect.width || this.canvas.clientWidth || 960));
      this.cssHeight = Math.max(1, Math.round(height || rect.height || this.canvas.clientHeight || 600));
      const preset = PRESETS[this.quality];
      this.ratio = Math.min(global.devicePixelRatio || 1, preset.dpr,
        Math.sqrt(preset.pixels / (this.cssWidth * this.cssHeight)));
      this.canvas.width = Math.max(1, Math.round(this.cssWidth * this.ratio));
      this.canvas.height = Math.max(1, Math.round(this.cssHeight * this.ratio));
      this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      return { width: this.cssWidth, height: this.cssHeight, pixelRatio: this.ratio };
    }

    _setupCamera(snapshot, options) {
      const focusId = options.focusId;
      const focus = (snapshot.players || []).find(p => p.id === focusId);
      const explicit = options.target;
      // An orbit follows the recorded key player; the default camera shows the whole court.
      const target = explicit || (options.replay && focus
        ? { x: focus.x * 0.38, y: 0.7 + (focus.y || 0) * 0.3, z: focus.z * 0.38 }
        : { x: 0, y: 0.4, z: -0.5 });
      const angle = Number.isFinite(options.cameraAngle) ? options.cameraAngle : 0;
      const replay = !!options.replay;
      const radius = Number.isFinite(options.cameraDistance) ? options.cameraDistance : (replay ? 18.5 : 22.5);
      const eye = {
        x: target.x + Math.sin(angle) * radius,
        y: replay ? 11.8 : 15,
        z: target.z + Math.cos(angle) * radius
      };
      let fx = target.x - eye.x, fy = target.y - eye.y, fz = target.z - eye.z;
      const fl = Math.hypot(fx, fy, fz);
      fx /= fl; fy /= fl; fz /= fl;
      let rx = -fz, rz = fx;
      const rl = Math.hypot(rx, rz);
      rx /= rl; rz /= rl;
      // up = right × forward
      const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
      const aspect = this.cssWidth / this.cssHeight;
      // Keep both sidelines visible on portrait phones as well as wide desktop canvases.
      const focal = Math.min(this.cssHeight * 1.35, this.cssWidth * 1.3);
      this._camera = {
        eye, fx, fy, fz, rx, rz, ux, uy, uz, focal,
        cx: this.cssWidth / 2, cy: this.cssHeight * (aspect < 0.9 ? 0.43 : 0.47)
      };
    }

    project(x, y, z) {
      if (typeof x === 'object') { z = x.z; y = x.y; x = x.x; }
      const c = this._camera;
      if (!c) return null;
      const dx = x - c.eye.x, dy = y - c.eye.y, dz = z - c.eye.z;
      const depth = dx * c.fx + dy * c.fy + dz * c.fz;
      if (depth <= 0.15) return null;
      const scale = c.focal / depth;
      return {
        x: c.cx + (dx * c.rx + dz * c.rz) * scale,
        y: c.cy - (dx * c.ux + dy * c.uy + dz * c.uz) * scale,
        depth, scale
      };
    }

    _polygon(points, fill, stroke, width) {
      const projected = points.map(p => this.project(p[0], p[1], p[2]));
      if (projected.some(p => !p)) return;
      const ctx = this.ctx;
      ctx.beginPath();
      projected.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1.5; ctx.stroke(); }
    }

    _line(points, color, width, dashed) {
      const projected = points.map(p => this.project(p[0], p[1], p[2]));
      if (projected.some(p => !p)) return;
      const ctx = this.ctx;
      ctx.beginPath();
      projected.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1.5;
      if (dashed) ctx.setLineDash([4, 4]);
      ctx.stroke();
      if (dashed) ctx.setLineDash([]);
    }

    _circle(x, y, z, radius, fill, stroke, width, start, end) {
      const points = [];
      const from = start === undefined ? 0 : start;
      const to = end === undefined ? TAU : end;
      const n = Math.max(12, Math.round(PRESETS[this.quality].segments * Math.abs(to - from) / TAU));
      for (let i = 0; i <= n; i++) {
        const a = from + (to - from) * i / n;
        points.push([x + Math.cos(a) * radius, y, z + Math.sin(a) * radius]);
      }
      if (fill) this._polygon(points, fill);
      if (stroke) this._line(points, stroke, width);
    }

    _box(x, z, width, depth, height, colors) {
      const l = x - width / 2, r = x + width / 2, b = z - depth / 2, f = z + depth / 2;
      const faces = [
        { pts: [[l, 0, b], [r, 0, b], [r, height, b], [l, height, b]], c: colors[1] },
        { pts: [[l, 0, f], [r, 0, f], [r, height, f], [l, height, f]], c: colors[0] },
        { pts: [[l, 0, b], [l, 0, f], [l, height, f], [l, height, b]], c: colors[1] },
        { pts: [[r, 0, b], [r, 0, f], [r, height, f], [r, height, b]], c: colors[2] },
        { pts: [[l, height, b], [r, height, b], [r, height, f], [l, height, f]], c: colors[2] }
      ];
      faces.sort((a, bFace) => {
        const depthFor = face => face.pts.reduce((sum, p) => sum + (this.project(p[0], p[1], p[2])?.depth || 0), 0) / 4;
        return depthFor(bFace) - depthFor(a);
      });
      faces.forEach(face => this._polygon(face.pts, face.c));
    }

    _background() {
      const ctx = this.ctx, w = this.cssWidth, h = this.cssHeight;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#cde6ed');
      sky.addColorStop(0.56, '#f4ead5');
      sky.addColorStop(1, '#afc2bd');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // Everything below is procedural and independent of map imagery or game assets.
      this._polygon([[-42, -0.045, -40], [42, -0.045, -40], [42, -0.045, 40], [-42, -0.045, 40]], '#cbd6c4');
      if (!PRESETS[this.quality].scenery) return;
      this._buildings.slice().sort((a, b) => (this.project(b.x, 0, b.z)?.depth || 0) - (this.project(a.x, 0, a.z)?.depth || 0))
        .forEach(b => this._box(b.x, b.z, b.w, b.d, b.h, [b.c, '#a4b6b9', '#d5dfdd']));
      const trees = [[-11, -9], [-10, -2], [-11, 7], [11, 5], [12, -4], [10, -11]];
      trees.sort((a, b) => (this.project(b[0], 0, b[1])?.depth || 0) - (this.project(a[0], 0, a[1])?.depth || 0));
      for (const [x, z] of trees) {
        const trunk = this.project(x, 1, z), crown = this.project(x, 3.3, z);
        if (!trunk || !crown) continue;
        this._line([[x, 0, z], [x, 3, z]], '#998065', Math.max(2, trunk.scale * 0.13));
        ctx.fillStyle = '#80aa8c';
        ctx.beginPath(); ctx.ellipse(crown.x, crown.y, crown.scale * 0.83, crown.scale * 1.04, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#a1c39e';
        ctx.beginPath(); ctx.ellipse(crown.x - crown.scale * 0.25, crown.y - crown.scale * 0.34,
          crown.scale * 0.55, crown.scale * 0.64, 0, 0, TAU); ctx.fill();
      }
    }

    _court() {
      const white = '#fff9e9';
      this._polygon([[-8.6, 0, -7.8], [8.6, 0, -7.8], [8.6, 0, 7.8], [-8.6, 0, 7.8]], '#d9d5bd');
      this._polygon([[-7.5, 0.008, -6.8], [7.5, 0.008, -6.8], [7.5, 0.008, 6.8], [-7.5, 0.008, 6.8]], '#dc9971');
      this._polygon([[-2.4, 0.015, -6.8], [2.4, 0.015, -6.8], [2.4, 0.015, -1.9], [-2.4, 0.015, -1.9]], '#e8b697');
      this._line([[-7.5, 0.024, -6.8], [7.5, 0.024, -6.8], [7.5, 0.024, 6.8], [-7.5, 0.024, 6.8], [-7.5, 0.024, -6.8]], white, 2.1);
      this._line([[-2.4, 0.026, -6.8], [-2.4, 0.026, -1.9], [2.4, 0.026, -1.9], [2.4, 0.026, -6.8]], white, 1.7);
      this._circle(0, 0.03, -1.9, 1.8, null, white, 1.6);
      this._circle(0, 0.035, -6, 6.15, null, white, 2, 0, Math.PI);
      this._line([[-6.15, 0.035, -6.8], [-6.15, 0.035, -6]], white, 2);
      this._line([[6.15, 0.035, -6.8], [6.15, 0.035, -6]], white, 2);
      this._circle(0, 0.035, -6, 1.25, null, white, 1.5, 0, Math.PI);
      this._circle(0, 0.036, 6.8, 1.8, null, white, 1.6, Math.PI, TAU);
      const emblem = this.project(0, 0.04, 3.9);
      if (emblem) {
        this._circle(0, 0.032, 3.9, 1.05, '#d28463');
        this.ctx.save();
        this.ctx.translate(emblem.x, emblem.y);
        const baseline = this.project(1, 0.04, 3.9);
        if (baseline) this.ctx.rotate(Math.atan2(baseline.y - emblem.y, baseline.x - emblem.x));
        this.ctx.scale(1, 0.7);
        this.ctx.font = `800 ${Math.max(11, emblem.scale * 0.55)}px system-ui, sans-serif`;
        this.ctx.fillStyle = '#fff3dc'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        this.ctx.fillText('SA', 0, 0);
        this.ctx.restore();
      }
    }

    _hoop(hoop) {
      const x = hoop.x || 0, z = hoop.z === undefined ? -6 : hoop.z, y = hoop.y || 3.05;
      this._line([[x, 0, z - 0.9], [x, 4.15, z - 0.9], [x, 4.15, z - 0.23]], '#495d63', 7);
      const bz = z - 0.25;
      this._polygon([[x - 0.92, y - 0.11, bz], [x + 0.92, y - 0.11, bz], [x + 0.92, y + 1.12, bz], [x - 0.92, y + 1.12, bz]],
        'rgba(250,255,255,0.83)', '#61787d', 2);
      this._line([[x - 0.31, y + 0.08, bz + 0.008], [x - 0.31, y + 0.51, bz + 0.008],
        [x + 0.31, y + 0.51, bz + 0.008], [x + 0.31, y + 0.08, bz + 0.008], [x - 0.31, y + 0.08, bz + 0.008]], '#e77b59', 1.6);
      const count = this.quality === 'lite' ? 6 : 9;
      for (let i = 0; i < count; i++) {
        const a = TAU * i / count;
        const top = [x + Math.cos(a) * 0.23, y, z + Math.sin(a) * 0.23];
        const bottom = [x + Math.cos(a + 0.35) * 0.13, y - 0.48, z + Math.sin(a + 0.35) * 0.13];
        this._line([top, bottom], 'rgba(255,255,248,0.9)', 1.1);
      }
      this._circle(x, y - 0.46, z, 0.13, null, 'rgba(255,255,248,0.9)', 1);
      this._circle(x, y, z, 0.23, null, '#ea5d37', 3);
    }

    _shadow(x, z, height, radius) {
      if (!PRESETS[this.quality].shadows) return;
      this._circle(x, 0.042, z, radius || 0.38, `rgba(42,58,59,${Math.max(0.07, 0.22 - (height || 0) * 0.04)})`);
    }

    _player(p, snapshot, options) {
      const x = p.x, z = p.z, y = p.y || 0;
      const pivot = this.project(x, y + 0.9, z);
      if (!pivot) return;
      const ctx = this.ctx;
      const angle = Number.isFinite(p.angle) ? p.angle : Math.PI;
      const sideX = Math.cos(angle), sideZ = -Math.sin(angle);
      const frontX = Math.sin(angle), frontZ = Math.cos(angle);
      const armAngle = Number.isFinite(p.armAngle) ? p.armAngle : angle;
      const armX = Math.sin(armAngle), armZ = Math.cos(armAngle);
      const speed = Math.min(1, Math.hypot(p.vx || 0, p.vz || 0) / 3.8);
      const phase = (snapshot.clock || 0) * 10 + (Number(p.id) || 0) * 0.83;
      const stride = Math.sin(phase) * 0.24 * speed;
      const action = String(p.action || '');
      const raised = /jump|block|shoot|dunk|layup/.test(action) || y > 0.22;
      const crouching = /crouch/.test(action);
      const waistY = crouching ? 0.62 : 0.86;
      const shoulderY = crouching ? 1.08 : 1.36;
      const headY = crouching ? 1.38 : 1.68;
      const color = TEAM_COLORS[p.team === 1 || p.team === 'away' ? 1 : 0];
      const skin = ['#d7a47e', '#a97753', '#efc7a5'][Math.abs(Number(p.id) || 0) % 3];
      const clothWidth = Math.max(3, pivot.scale * 0.13);
      const selectedId = options.selectedId === undefined ? snapshot.selectedId : options.selectedId;
      const highlighted = options.replay && options.focusId !== undefined ? p.id === options.focusId : p.id === selectedId;
      if (highlighted) {
        this._circle(x, 0.055, z, 0.54, null, p.team === 1 ? '#ff806d' : '#0d887d', Math.max(1.5, pivot.scale * 0.055));
        if (!options.replay) {
          const marker = this.project(x, y + headY + 0.4, z);
          if (marker) {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(marker.x - 5, marker.y - 3); ctx.lineTo(marker.x + 5, marker.y - 3);
            ctx.lineTo(marker.x, marker.y + 4); ctx.closePath(); ctx.fill();
          }
        }
      }
      for (const side of [-1, 1]) {
        const hip = [x + sideX * 0.115 * side, y + waistY, z + sideZ * 0.115 * side];
        const knee = [x + sideX * 0.13 * side + frontX * stride * side,
          y + waistY * 0.52, z + sideZ * 0.13 * side + frontZ * stride * side];
        const foot = [x + sideX * 0.13 * side - frontX * stride * side,
          y + 0.08, z + sideZ * 0.13 * side - frontZ * stride * side];
        this._line([hip, knee, foot], skin, clothWidth);
        this._line([hip, knee], '#294951', Math.max(3, pivot.scale * 0.16));
        this._line([foot, [foot[0] + frontX * 0.16, foot[1], foot[2] + frontZ * 0.16]], '#fff9ef', Math.max(3, pivot.scale * 0.11));
      }
      const leftShoulder = [x - sideX * 0.19, y + shoulderY, z - sideZ * 0.19];
      const rightShoulder = [x + sideX * 0.19, y + shoulderY, z + sideZ * 0.19];
      this._polygon([leftShoulder, rightShoulder,
        [x + sideX * 0.14, y + waistY, z + sideZ * 0.14],
        [x - sideX * 0.14, y + waistY, z - sideZ * 0.14]], color, null);
      // A broad central stroke keeps jerseys visible when the camera sees their side.
      this._line([[x, y + waistY + 0.12, z], [x, y + shoulderY - 0.04, z]], color, Math.max(4, pivot.scale * 0.29));
      for (const side of [-1, 1]) {
        const shoulder = side === -1 ? leftShoulder : rightShoulder;
        const elbow = [x + sideX * 0.29 * side + armX * 0.13,
          y + (raised ? 1.63 : 1.02), z + sideZ * 0.29 * side + armZ * 0.13];
        const hand = [x + sideX * (raised ? 0.2 : 0.3) * side + armX * (raised ? 0.11 : 0.37),
          y + (raised ? 1.98 : 0.95 + Math.sin(phase + side) * speed * 0.09),
          z + sideZ * (raised ? 0.2 : 0.3) * side + armZ * (raised ? 0.11 : 0.37)];
        this._line([shoulder, elbow, hand], skin, clothWidth * 0.8);
      }
      const head = this.project(x, y + headY, z);
      if (head) {
        const r = Math.max(2.3, head.scale * 0.155);
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#354047'; ctx.beginPath(); ctx.ellipse(head.x, head.y - r * 0.52, r * 0.92, r * 0.58, 0, Math.PI, TAU); ctx.fill();
      }
      if (options.labels !== false && this.quality !== 'lite') {
        const label = this.project(x, y + 1.21, z - 0.06);
        if (label) {
          ctx.font = `800 ${Math.max(8, label.scale * 0.2)}px system-ui, sans-serif`;
          ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(p.number === undefined ? Number(p.id) + 1 : p.number), label.x, label.y);
        }
      }
    }

    _ball(ball) {
      const p = this.project(ball.x, ball.y, ball.z);
      if (!p) return;
      const ctx = this.ctx, radius = Math.max(2.8, p.scale * 0.14);
      ctx.fillStyle = '#ed7c31';
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#714429'; ctx.lineWidth = Math.max(0.65, radius * 0.09);
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - radius, p.y); ctx.lineTo(p.x + radius, p.y); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(p.x, p.y, radius * 0.4, radius, 0.23, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,219,163,0.7)'; ctx.beginPath(); ctx.arc(p.x - radius * 0.3, p.y - radius * 0.33, radius * 0.22, 0, TAU); ctx.fill();
    }

    render(snapshot, options) {
      options = options || {};
      if (!snapshot) return;
      if (!this.cssWidth || !this.cssHeight) this.resize();
      const ctx = this.ctx;
      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      this._setupCamera(snapshot, options);
      this._background();
      this._court();
      const players = snapshot.players || [];
      players.forEach(p => this._shadow(p.x, p.z, p.y || 0, 0.36));
      if (snapshot.ball) this._shadow(snapshot.ball.x, snapshot.ball.z, snapshot.ball.y, 0.15);
      const objects = players.map(p => ({ type: 'player', value: p, depth: this.project(p.x, p.y || 0, p.z)?.depth || 0 }));
      const hoop = snapshot.hoop || { x: 0, z: -6, y: 3.05 };
      objects.push({ type: 'hoop', value: hoop, depth: this.project(hoop.x, 1.5, hoop.z)?.depth || 0 });
      if (snapshot.ball) objects.push({ type: 'ball', value: snapshot.ball, depth: this.project(snapshot.ball.x, snapshot.ball.y, snapshot.ball.z)?.depth || 0 });
      objects.sort((a, b) => b.depth - a.depth);
      for (const item of objects) {
        if (item.type === 'player') this._player(item.value, snapshot, options);
        else if (item.type === 'hoop') this._hoop(item.value);
        else this._ball(item.value);
      }
      if (options.replay) {
        const vignette = ctx.createRadialGradient(this.cssWidth / 2, this.cssHeight / 2,
          Math.min(this.cssWidth, this.cssHeight) * 0.15, this.cssWidth / 2, this.cssHeight / 2,
          Math.max(this.cssWidth, this.cssHeight) * 0.72);
        vignette.addColorStop(0, 'rgba(22,38,44,0)'); vignette.addColorStop(1, 'rgba(22,38,44,0.24)');
        ctx.fillStyle = vignette; ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
      }
    }

    getStats() {
      return { quality: this.quality, width: this.canvas.width, height: this.canvas.height, pixelRatio: this.ratio };
    }
  }

  global.SAHoopsRenderer = SAHoopsRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
