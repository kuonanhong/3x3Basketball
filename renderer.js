/* SmartAction Sports v7 — original, dependency-free Canvas renderer.
 * Licensed place photographs are flat backdrops; courts, arenas and player animation are procedural.
 * Player figures are stylized: height/weight/build from catalogue data, licensed portrait billboards for faces
 * where available, hair/skin/accessory colours from catalogue descriptors. Not a reconstructed likeness. */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const PRESETS = {
    lite: { dpr: 1, pixels: 700000, segments: 20, scenery: false, shadows: true },
    balanced: { dpr: 1.5, pixels: 1400000, segments: 32, scenery: true, shadows: true },
    full: { dpr: 2, pixels: 2400000, segments: 48, scenery: true, shadows: true }
  };
  const TEAM_COLORS = ['#13baad', '#ff7058'];
  const TEAM_DARK = ['#0d887d', '#c94f3a'];
  const DEFAULT_SKIN = ['#d7a47e', '#a97753', '#efc7a5', '#8a5a3c', '#f1d2b4', '#6b3f28'];
  const WIDE_K = -0.085;              // mild barrel distortion for the wide-angle view

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

    _bounds(snapshot) {
      const b = snapshot.bounds || {};
      return { minX: Number.isFinite(b.minX) ? b.minX : -7.5,
        maxX: Number.isFinite(b.maxX) ? b.maxX : 7.5,
        minZ: Number.isFinite(b.minZ) ? b.minZ : -6.8,
        maxZ: Number.isFinite(b.maxZ) ? b.maxZ : 6.8 };
    }

    /* ---------------------------------------------------------------- camera */
    _setupCamera(snapshot, options) {
      const selectedId = options.selectedId === undefined ? snapshot.selectedId : options.selectedId;
      const focusId = options.replay && options.focusId !== undefined ? options.focusId : selectedId;
      const players = snapshot.players || [];
      const focus = players.find(p => p.id === focusId) || players[0];
      const b = this._bounds(snapshot);
      const zoom = Math.max(0.6, Math.min(1.8, Number(options.zoom) || 1));
      const angle = Number.isFinite(options.cameraAngle) ? options.cameraAngle : 0;
      const batting = snapshot.family === 'batting' && snapshot.batting;
      let view = options.replay ? 'third' : (['first', 'close', 'wide', 'batter'].includes(options.view) && focus ? options.view : 'third');
      if (!options.replay && batting && (view === 'wide' || view === 'batter' || view === 'third') && options.view !== 'third') view = 'batter';
      const followSport = !options.replay && (snapshot.family === 'golf' || snapshot.family === 'lane') && (view === 'wide' || view === 'batter');
      if (followSport) view = 'follow';
      const aspect = this.cssWidth / this.cssHeight;
      let target, eye, focal, wide = false;
      if (view === 'first' || view === 'close') {
        const aim = Number.isFinite(snapshot.aimAngle) ? snapshot.aimAngle :
          (Number.isFinite(focus.armAngle) ? focus.armAngle : Number.isFinite(focus.angle) ? focus.angle : Math.PI);
        const facing = aim + angle, fx = Math.sin(facing), fz = Math.cos(facing);
        const height = Math.max(1.35, Math.min(2.5, (focus.heightCm || 180) / 100));
        const headY = (focus.y || 0) + height * 0.93;
        const crouch = /crouch/.test(String(focus.action || '')) ? 0.3 : 0;
        if (view === 'first') {
          eye = { x: focus.x + fx * 0.1, y: headY - crouch, z: focus.z + fz * 0.1 };
          target = { x: eye.x + fx * 10, y: eye.y - 0.5, z: eye.z + fz * 10 };
        } else {
          const distance = 3.8 / zoom;
          eye = { x: focus.x - fx * distance + Math.cos(facing) * 0.55,
            y: headY + 1.7 / zoom, z: focus.z - fz * distance - Math.sin(facing) * 0.55 };
          target = { x: focus.x + fx * 3, y: headY * 0.65, z: focus.z + fz * 3 };
        }
      } else if (view === 'batter') {
        /* behind-the-batter view: the pitch comes toward the player, the whole field is visible beyond */
        const plateZ = batting ? batting.plateZ : b.maxZ - 4, ballFollow = snapshot.ball && snapshot.ball.state === 'hit';
        if (ballFollow) {
          const ball = snapshot.ball, speed = Math.hypot(ball.vx || 0, ball.vz || 0) || 1;
          eye = { x: ball.x - (ball.vx || 0) / speed * 6 / zoom, y: Math.max(2.2, (ball.y || 0) + 2.4), z: ball.z - (ball.vz || 0) / speed * 6 / zoom };
          target = { x: ball.x + (ball.vx || 0) / speed * 4, y: Math.max(0.3, ball.y || 0), z: ball.z + (ball.vz || 0) / speed * 4 };
        } else {
          eye = { x: 0, y: 3.9 / Math.sqrt(zoom), z: plateZ + 7.6 / zoom };
          target = { x: 0, y: 0.9, z: plateZ - 10 };
        }
        wide = true;
      } else if (view === 'follow') {
        /* golf / bowling: stand behind the ball and look down the hole or lane; chase the ball while it travels */
        const ball = snapshot.ball || { x: 0, y: 0, z: 0 };
        const goal = snapshot.family === 'golf' ? (snapshot.golf && snapshot.golf.hole) || { x: 0, z: -20 } : { x: 0, z: (snapshot.lane && snapshot.lane.pinZ) || -8.6 };
        const moving = Math.hypot(ball.vx || 0, ball.vz || 0) > 0.3 && (ball.state === 'flight' || ball.state === 'rolling');
        let dx = goal.x - ball.x, dz = goal.z - ball.z; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
        if (moving) { const sp = Math.hypot(ball.vx || 0, ball.vz || 0) || 1; dx = (ball.vx || 0) / sp; dz = (ball.vz || 0) / sp; }
        const back = snapshot.family === 'golf' ? (moving ? 7 : 5.5) / zoom : 4.2 / zoom, up = snapshot.family === 'golf' ? (moving ? Math.max(2.4, (ball.y || 0) + 2.2) : 2.3) : 1.9;
        eye = { x: ball.x - dx * back, y: up / Math.sqrt(zoom), z: ball.z - dz * back };
        target = { x: ball.x + dx * 9, y: Math.max(0.2, (ball.y || 0) * 0.5), z: ball.z + dz * 9 };
        wide = true;
      } else if (view === 'wide') {
        /* broadcast wide-angle: elevated behind the home side, whole arena plus surroundings in frame */
        const width = b.maxX - b.minX, depth = b.maxZ - b.minZ;
        const portrait = aspect < 0.9;
        const span = Math.max(width * (portrait ? 0.95 : 0.72), depth * (portrait ? 0.7 : 0.95));
        const centreZ = (b.minZ + b.maxZ) / 2;
        target = options.target || { x: (b.minX + b.maxX) / 2, y: 0.6, z: centreZ + depth * 0.02 };
        const tight = snapshot.fieldType === 'table' ? 0.5 : snapshot.fieldType === 'target' ? 0.62 : 0.78;
        const radius = Math.max(snapshot.fieldType === 'table' ? 4.5 : 9, span * tight) / zoom;
        eye = { x: target.x + Math.sin(angle) * radius * 0.35, y: target.y + radius * (portrait ? 0.95 : 0.68), z: target.z + Math.cos(angle) * radius * (portrait ? 0.8 : 0.92) };
        wide = true;
      } else {
        target = options.target || (options.replay && focus
          ? { x: focus.x * 0.68, y: 0.7 + (focus.y || 0) * 0.3, z: focus.z * 0.68 }
          : { x: (b.minX + b.maxX) / 2, y: 0.4, z: (b.minZ + b.maxZ) / 2 - 0.5 });
        const fieldScale = Math.max((b.maxX - b.minX) / 15, (b.maxZ - b.minZ) / 13.6);
        const radius = (Number.isFinite(options.cameraDistance) ? options.cameraDistance :
          (options.replay ? 18.5 : 22.5 * Math.max(0.62, fieldScale))) / zoom;
        eye = { x: target.x + Math.sin(angle) * radius,
          y: target.y + radius * (options.replay ? 0.6 : 0.65), z: target.z + Math.cos(angle) * radius };
      }
      let fx = target.x - eye.x, fy = target.y - eye.y, fz = target.z - eye.z;
      const fl = Math.hypot(fx, fy, fz) || 1;
      fx /= fl; fy /= fl; fz /= fl;
      let rx = -fz, rz = fx;
      const rl = Math.hypot(rx, rz) || 1;
      rx /= rl; rz /= rl;
      const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
      focal = view === 'first' ? Math.min(this.cssHeight, this.cssWidth) * 0.85 * zoom
        : wide ? Math.min(this.cssHeight * 1.05, this.cssWidth * 0.92)
        : Math.min(this.cssHeight * 1.35, this.cssWidth * 1.3);
      const cy = view === 'third' ? (aspect < 0.9 ? 0.43 : 0.47) : view === 'batter' || view === 'follow' ? 0.5 : view === 'wide' ? (aspect < 0.9 ? 0.46 : 0.44) : 0.48;
      this._camera = { eye, target, view, focusId: focus && focus.id, fx, fy, fz, rx, rz, ux, uy, uz, focal, wide,
        cx: this.cssWidth / 2, cy: this.cssHeight * cy, playerScale: Math.max(0.8, Math.min(1.6, Number(options.playerScale) || 1.18)) };
    }

    _depth(p) {
      const c = this._camera;
      return (p[0] - c.eye.x) * c.fx + (p[1] - c.eye.y) * c.fy + (p[2] - c.eye.z) * c.fz;
    }

    _clipPolygon(points) {
      const near = 0.16, output = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[(i + points.length - 1) % points.length], b = points[i];
        const da = this._depth(a), db = this._depth(b);
        if ((da >= near) !== (db >= near)) {
          const t = (near - da) / (db - da);
          output.push(a.map((v, k) => v + (b[k] - v) * t));
        }
        if (db >= near) output.push(b);
      }
      return output;
    }

    project(x, y, z) {
      if (typeof x === 'object') { z = x.z; y = x.y; x = x.x; }
      const c = this._camera;
      if (!c) return null;
      const dx = x - c.eye.x, dy = y - c.eye.y, dz = z - c.eye.z;
      const depth = dx * c.fx + dy * c.fy + dz * c.fz;
      if (depth <= 0.15) return null;
      const scale = c.focal / depth;
      let sx = (dx * c.rx + dz * c.rz) * scale, sy = -(dx * c.ux + dy * c.uy + dz * c.uz) * scale;
      if (c.wide) {
        // wide-angle lens: points far from the centre are pulled inward so the edges of the arena stay in frame
        const norm = Math.hypot(sx / this.cssWidth, sy / this.cssHeight) * 2;
        if (norm > 1e-6) {
          let pulled = norm / (1 - WIDE_K * norm * norm);  // always positive: edges are pulled in, never folded
          if (norm > 1.15) pulled = Math.max(pulled, 1.15); // points outside the frame stay outside (ground quads keep covering the floor)
          const k = pulled / norm; sx *= k; sy *= k;
        }
      }
      return { x: c.cx + sx, y: c.cy + sy, depth, scale };
    }

    _polygon(points, fill, stroke, width) {
      let clipped = this._clipPolygon(points);
      if (this._camera && this._camera.wide && clipped.length >= 3) {
        // subdivide long edges so the wide-angle lens bends them smoothly instead of folding the quad
        const dense = [];
        for (let i = 0; i < clipped.length; i++) {
          const a = clipped[i], b = clipped[(i + 1) % clipped.length];
          const steps = Math.min(10, Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 4)));
          for (let s = 0; s < steps; s++) { const t = s / steps; dense.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
        }
        clipped = dense;
      }
      const projected = clipped.map(p => this.project(p[0], p[1], p[2]));
      if (projected.length < 3 || projected.some(p => !p)) return;
      const ctx = this.ctx;
      ctx.beginPath();
      projected.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1.5; ctx.stroke(); }
    }

    _line(points, color, width, dashed) {
      const ctx = this.ctx, near = 0.16;
      ctx.beginPath();
      let visible = false;
      const subdivide = this._camera && this._camera.wide;
      for (let i = 1; i < points.length; i++) {
        let a = points[i - 1], b = points[i];
        const da = this._depth(a), db = this._depth(b);
        if (da < near && db < near) continue;
        if (da < near || db < near) {
          const t = (near - da) / (db - da);
          const cut = a.map((v, k) => v + (b[k] - v) * t);
          if (da < near) a = cut; else b = cut;
        }
        const steps = subdivide ? Math.min(8, Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 3))) : 1;
        let prev = this.project(a[0], a[1], a[2]);
        if (!prev) continue;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps, q = this.project(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
          if (!q) { prev = null; break; }
          visible = true; ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); prev = q;
        }
      }
      if (!visible) return;
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.5, Math.min(60, width || 1.5));
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

    _vcircle(x, y, z, radius, fill, stroke, width) {
      // vertical circle facing the camera along z (targets, rackets, hoops of lacrosse goals)
      const points = [];
      for (let i = 0; i <= 20; i++) { const a = i * TAU / 20; points.push([x + Math.cos(a) * radius, y + Math.sin(a) * radius, z]); }
      if (fill) this._polygon(points, fill);
      if (stroke) this._line(points, stroke, width);
    }

    _box(x, z, width, depth, height, colors, baseY) {
      const y0 = baseY || 0;
      const l = x - width / 2, r = x + width / 2, b = z - depth / 2, f = z + depth / 2;
      const faces = [
        { pts: [[l, y0, b], [r, y0, b], [r, y0 + height, b], [l, y0 + height, b]], c: colors[1] },
        { pts: [[l, y0, f], [r, y0, f], [r, y0 + height, f], [l, y0 + height, f]], c: colors[0] },
        { pts: [[l, y0, b], [l, y0, f], [l, y0 + height, f], [l, y0 + height, b]], c: colors[1] },
        { pts: [[r, y0, b], [r, y0, f], [r, y0 + height, f], [r, y0 + height, b]], c: colors[2] },
        { pts: [[l, y0 + height, b], [r, y0 + height, b], [r, y0 + height, f], [l, y0 + height, f]], c: colors[2] }
      ];
      faces.sort((a, bFace) => {
        const depthFor = face => face.pts.reduce((sum, p) => sum + (this.project(p[0], p[1], p[2])?.depth || 0), 0) / 4;
        return depthFor(bFace) - depthFor(a);
      });
      faces.forEach(face => this._polygon(face.pts, face.c));
    }

    _cylinder(x, z, radius, height, color, top, baseY) {
      const y0 = baseY || 0, p = this.project(x, y0 + height / 2, z);
      if (!p) return;
      const ctx = this.ctx, rw = Math.max(1, p.scale * radius), base = this.project(x, y0, z), cap = this.project(x, y0 + height, z);
      if (!base || !cap) return;
      ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(base.x - rw, base.y); ctx.lineTo(cap.x - rw, cap.y); ctx.lineTo(cap.x + rw, cap.y); ctx.lineTo(base.x + rw, base.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = top || color; ctx.beginPath(); ctx.ellipse(cap.x, cap.y, rw, Math.max(0.5, rw * 0.45), 0, 0, TAU); ctx.fill();
    }

    /* ------------------------------------------------------------ background */
    _background(snapshot, options) {
      const ctx = this.ctx, w = this.cssWidth, h = this.cssHeight;
      const env = options.environment || {}, time = env.time || 'day';
      const palettes = {
        day: ['#acddec', '#f4ead5', '#cbd6c4'], dawn: ['#929dc7', '#f8cab2', '#aaaeb2'],
        sunset: ['#9e8abd', '#f5b78e', '#bbb3a0'], night: ['#0b1730', '#314964', '#5a6967']
      };
      const palette = palettes[time] || palettes.day;
      const indoorHall = ['table', 'lane', 'squash'].includes(snapshot.fieldType);
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      if (indoorHall) { sky.addColorStop(0, '#1b2229'); sky.addColorStop(0.5, '#2a3238'); sky.addColorStop(1, '#3a3f44'); }
      else { sky.addColorStop(0, palette[0]); sky.addColorStop(0.56, palette[1]); sky.addColorStop(1, palette[2]); }
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      const photo = indoorHall ? null : env.photo;
      if (photo && (photo.naturalWidth || photo.width) > 0 && (photo.naturalHeight || photo.height) > 0) {
        const pw = photo.naturalWidth || photo.width, ph = photo.naturalHeight || photo.height;
        const scale = Math.max(w / pw, h * 0.82 / ph);
        ctx.save(); ctx.globalAlpha = 0.78;
        try { ctx.drawImage(photo, (w - pw * scale) / 2, (h * 0.82 - ph * scale) / 2, pw * scale, ph * scale); } catch (_) {}
        ctx.restore();
        ctx.fillStyle = time === 'night' ? 'rgba(9,18,40,.62)' : time === 'sunset' ? 'rgba(214,106,53,.18)' : 'rgba(194,227,240,.08)';
        ctx.fillRect(0, 0, w, h);
      } else if (time !== 'night' && !indoorHall) {
        ctx.fillStyle = time === 'day' ? '#fff4c3' : '#ffe0ab';
        ctx.beginPath(); ctx.arc(w * 0.78, h * (time === 'day' ? 0.12 : 0.3), 18, 0, TAU); ctx.fill();
      }
      const b = this._bounds(snapshot), ext = Math.max(42, Math.abs(b.maxZ) + 25, Math.abs(b.minZ) + 25, Math.abs(b.maxX) + 25);
      const indoor = ['table', 'lane', 'squash'].includes(snapshot.fieldType);
      const ground = indoor ? '#4a4d52' : env.season === 'winter' || env.climate === 'polar' ? '#dce4e4' :
        env.climate === 'arid' ? '#d4bc92' : env.season === 'autumn' ? '#b4b78d' : snapshot.fieldType === 'beach' ? '#e2cfa4' : palette[2];
      this._polygon([[-ext, -0.045, -ext], [ext, -0.045, -ext], [ext, -0.045, ext], [-ext, -0.045, ext]], ground);
      if (!PRESETS[this.quality].scenery || indoor) { this._audience(snapshot, options); return; }
      if (!photo) this._buildings.slice().sort((a, b) => (this.project(b.x, 0, b.z)?.depth || 0) - (this.project(a.x, 0, a.z)?.depth || 0))
        .forEach(building => {
          const shiftedZ = building.z - Math.max(0, Math.abs(b.minZ) - 7);
          this._box(building.x, shiftedZ, building.w, building.d, building.h,
            [time === 'night' ? '#3c5064' : building.c, '#82989e', '#b4c7cb']);
        });
      const trees = [[b.minX - 4, b.minZ - 3], [b.minX - 5, b.minZ * 0.3], [b.minX - 6, b.maxZ * 0.4], [b.maxX + 6, b.maxZ * 0.4], [b.maxX + 5, b.minZ * 0.3], [b.maxX + 4, b.minZ - 3]];
      trees.sort((a, b) => (this.project(b[0], 0, b[1])?.depth || 0) - (this.project(a[0], 0, a[1])?.depth || 0));
      for (const [x, z] of trees) {
        const trunk = this.project(x, 1, z), crown = this.project(x, 3.3, z);
        if (!trunk || !crown) continue;
        this._line([[x, 0, z], [x, 3, z]], '#998065', Math.max(2, trunk.scale * 0.13));
        ctx.fillStyle = env.season === 'autumn' ? '#b77949' : env.season === 'winter' ? '#cadbd0' : time === 'night' ? '#294b48' : '#80aa8c';
        ctx.beginPath(); ctx.ellipse(crown.x, crown.y, Math.min(70, crown.scale * 0.83), Math.min(88, crown.scale * 1.04), 0, 0, TAU); ctx.fill();
      }
      this._audience(snapshot, options);
    }

    _audience(snapshot, options) {
      const env = options.environment || {};
      if (!['home', 'away'].includes(env.venue)) return;
      const b = this._bounds(snapshot), segments = this.quality === 'lite' ? 10 : this.quality === 'full' ? 26 : 18;
      const rows = this.quality === 'lite' ? 2 : 3, clock = snapshot.clock || 0;
      for (const side of [-1, 1]) {
        const z = side < 0 ? b.minZ - 3 : b.maxZ + 3;
        this._box((b.minX + b.maxX) / 2, z, b.maxX - b.minX + 3, 2.4, 0.8, ['#5d6d7d', '#435462', '#7e8b95']);
        for (let row = rows - 1; row >= 0; row--) for (let i = 0; i < segments; i++) {
          const x = b.minX + (b.maxX - b.minX) * (i + 0.5) / segments;
          const wave = Math.sin(clock * 3 + i * 0.87 + row * 1.7) * 0.1;
          const p = this.project(x, 1.1 + row * 0.38 + wave, z + side * row * 0.5);
          if (!p) continue;
          const r = Math.min(9, Math.max(1.4, p.scale * 0.14));
          this.ctx.fillStyle = i % 4 === 0 ? '#ecd2af' : TEAM_COLORS[(env.venue === 'away' ? 1 : 0) ^ (i % 5 === 0 ? 1 : 0)];
          this.ctx.fillRect(p.x - r, p.y, r * 2, r * 2.3);
          this.ctx.fillStyle = '#d8b18c'; this.ctx.beginPath(); this.ctx.arc(p.x, p.y - r * 0.55, r * 0.72, 0, TAU); this.ctx.fill();
        }
      }
    }

    _weather(snapshot, options) {
      const env = options.environment || {}, ctx = this.ctx, w = this.cssWidth, h = this.cssHeight;
      const count = this.quality === 'lite' ? 20 : this.quality === 'full' ? 72 : 44;
      const clock = snapshot.clock || 0;
      if (env.weather === 'rain' || env.weather === 'snow') {
        ctx.strokeStyle = 'rgba(204,228,251,.6)'; ctx.fillStyle = 'rgba(249,252,255,.82)'; ctx.lineWidth = 1;
        for (let i = 0; i < count; i++) {
          const x = (((i * 0.6180339887 + clock * 0.015) % 1) + 1) % 1 * w;
          const y = (((i * 0.382978 + clock * (env.weather === 'rain' ? 0.9 : 0.11)) % 1) + 1) % 1 * h;
          if (env.weather === 'rain') { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); ctx.stroke(); }
          else { ctx.beginPath(); ctx.arc(x + Math.sin(clock + i) * 6, y, 1.5 + (i % 3) * 0.5, 0, TAU); ctx.fill(); }
        }
      }
      if (env.weather === 'fog') { ctx.fillStyle = 'rgba(214,225,229,.27)'; ctx.fillRect(0, 0, w, h); }
      if (env.time === 'night') { ctx.fillStyle = 'rgba(7,17,37,.12)'; ctx.fillRect(0, 0, w, h); }
    }

    /* ------------------------------------------------------------- courts */
    _court(snapshot) {
      const white = '#fff9e9', full = snapshot && snapshot.courtMode === 'full';
      if (!full) {
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
        this._emblem(0, 3.9, 1.05);
        return;
      }
      const b = this._bounds(snapshot), arc = snapshot.arc || 6.75;
      this._polygon([[b.minX - 1.1, 0, b.minZ - 1.1], [b.maxX + 1.1, 0, b.minZ - 1.1], [b.maxX + 1.1, 0, b.maxZ + 1.1], [b.minX - 1.1, 0, b.maxZ + 1.1]], '#d9d5bd');
      this._polygon([[b.minX, 0.008, b.minZ], [b.maxX, 0.008, b.minZ], [b.maxX, 0.008, b.maxZ], [b.minX, 0.008, b.maxZ]], '#dc9971');
      this._line([[b.minX, 0.024, b.minZ], [b.maxX, 0.024, b.minZ], [b.maxX, 0.024, b.maxZ], [b.minX, 0.024, b.maxZ], [b.minX, 0.024, b.minZ]], white, 2.1);
      this._line([[b.minX, 0.026, 0], [b.maxX, 0.026, 0]], white, 1.8);
      this._circle(0, 0.03, 0, 1.8, null, white, 1.6);
      for (const hoop of snapshot.hoops || []) {
        const sign = hoop.z < 0 ? 1 : -1, end = hoop.z < 0 ? b.minZ : b.maxZ;
        this._polygon([[-2.45, 0.015, end], [2.45, 0.015, end], [2.45, 0.015, end + sign * 5.8], [-2.45, 0.015, end + sign * 5.8]], '#e8b697');
        this._line([[-2.45, 0.026, end], [-2.45, 0.026, end + sign * 5.8], [2.45, 0.026, end + sign * 5.8], [2.45, 0.026, end]], white, 1.7);
        this._circle(0, 0.03, end + sign * 5.8, 1.8, null, white, 1.6, hoop.z < 0 ? 0 : Math.PI, hoop.z < 0 ? Math.PI : TAU);
        this._circle(hoop.x, 0.035, hoop.z, arc, null, white, 2, hoop.z < 0 ? 0 : Math.PI, hoop.z < 0 ? Math.PI : TAU);
        this._line([[-arc, 0.035, end], [-arc, 0.035, hoop.z]], white, 2); this._line([[arc, 0.035, end], [arc, 0.035, hoop.z]], white, 2);
        this._circle(hoop.x, 0.035, hoop.z, 1.25, null, white, 1.5, hoop.z < 0 ? 0 : Math.PI, hoop.z < 0 ? Math.PI : TAU);
      }
      this._emblem(0, 0, 1.4);
    }

    _emblem(x, z, radius) {
      const emblem = this.project(x, 0.04, z);
      if (!emblem) return;
      this._circle(x, 0.032, z, radius, '#d28463');
      this.ctx.save();
      this.ctx.translate(emblem.x, emblem.y);
      const baseline = this.project(x + 1, 0.04, z);
      if (baseline) this.ctx.rotate(Math.atan2(baseline.y - emblem.y, baseline.x - emblem.x));
      this.ctx.scale(1, 0.7);
      this.ctx.font = `800 ${Math.max(11, emblem.scale * 0.55 * radius)}px system-ui, sans-serif`;
      this.ctx.fillStyle = '#fff3dc'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
      this.ctx.fillText('SA', 0, 0);
      this.ctx.restore();
    }

    _sportField(snapshot) {
      const b = this._bounds(snapshot), sport = snapshot.sport || 'basketball', type = snapshot.fieldType || '';
      const white = '#f4f7e9', cy = 0.026, mx = (b.minX + b.maxX) / 2;
      const netSport = /tennis|badminton|volleyball|takraw/.test(sport) || type === 'net' || type === 'volleyball' || type === 'beach' || type === 'takraw';
      const batting = ['baseball', 'softball', 'cricket'].includes(type);
      if (batting) { this._battingField(snapshot); return; }
      if (type === 'green') { this._golfField(snapshot); return; }
      if (type === 'lane') { this._laneField(snapshot); return; }
      if (type === 'table') { this._tableField(snapshot); return; }
      if (type === 'squash') { this._squashField(snapshot); return; }
      const surface = type === 'ice' ? '#dbeff2' : type === 'pool' ? '#3f8ec4' : type === 'beach' ? '#e9d7ad' : type === 'hockey' ? '#3d7fc0' : type === 'lacrosse' ? '#5f9a63' :
        sport === 'sprint' ? '#c57561' : netSport ? (sport.includes('table') ? '#557fa3' : type === 'takraw' ? '#8f5f45' : '#6496a0') : '#619368';
      this._polygon([[b.minX - 1, 0, b.minZ - 1], [b.maxX + 1, 0, b.minZ - 1], [b.maxX + 1, 0, b.maxZ + 1], [b.minX - 1, 0, b.maxZ + 1]], type === 'pool' ? '#cfd8dc' : type === 'beach' ? '#d9c398' : '#c4c8b4');
      this._polygon([[b.minX, 0.008, b.minZ], [b.maxX, 0.008, b.minZ], [b.maxX, 0.008, b.maxZ], [b.minX, 0.008, b.maxZ]], surface);
      if (type === 'pool') {
        // water: lane ropes and animated ripples
        const clock = snapshot.clock || 0;
        for (let i = 1; i < 6; i++) { const x = b.minX + (b.maxX - b.minX) * i / 6; this._line([[x, cy, b.minZ], [x, cy, b.maxZ]], 'rgba(255,255,255,.35)', 1.2); }
        for (let i = 0; i < 9; i++) { const z = b.minZ + (b.maxZ - b.minZ) * (i + 0.5) / 9 + Math.sin(clock * 1.3 + i) * 0.4; this._line([[b.minX + 0.5, cy, z], [b.maxX - 0.5, cy, z + Math.sin(clock + i) * 0.3]], 'rgba(220,240,255,.22)', 1.5); }
      }
      const outline = [[b.minX, cy, b.minZ], [b.maxX, cy, b.minZ], [b.maxX, cy, b.maxZ], [b.minX, cy, b.maxZ], [b.minX, cy, b.minZ]];
      this._line(outline, white, 1.8);
      if (sport === 'sprint') {
        const lanes = Math.max(3, Math.min(8, Math.round((b.maxX - b.minX) / 1.2)));
        for (let i = 1; i < lanes; i++) { const x = b.minX + (b.maxX - b.minX) * i / lanes; this._line([[x, cy, b.minZ], [x, cy, b.maxZ]], white, 1.4); }
        const finish = snapshot.finishZ === undefined ? b.minZ + 1 : snapshot.finishZ;
        this._line([[b.minX, cy, finish], [b.maxX, cy, finish]], '#fff', 4);
      } else if (sport === 'archery') {
        this._line([[b.minX, cy, b.maxZ - 2], [b.maxX, cy, b.maxZ - 2]], white, 2);
        for (let i = 0; i < 4; i++) this._line([[mx - .35, cy, b.maxZ - i * 3], [mx + .35, cy, b.maxZ - i * 3]], white, 1.4);
      } else if (netSport) {
        this._line([[b.minX, cy, 0], [b.maxX, cy, 0]], white, 1.8);
        for (const side of [-1, 1]) {
          const z = side * (sport.includes('table') ? 1.5 : (b.maxZ - b.minZ) * .25);
          this._line([[b.minX, cy, z], [b.maxX, cy, z]], white, 1.5);
          if (type !== 'beach') this._line([[mx, cy, 0], [mx, cy, z]], white, 1.5);
          if (type === 'takraw') this._circle(mx, cy, side * (b.maxZ - b.minZ) * .2, 0.3, null, white, 1.4);
        }
        if (!sport.includes('doubles') && !sport.includes('table') && type !== 'beach' && type !== 'takraw') {
          const inset = (b.maxX - b.minX) * .085;
          for (const x of [b.minX + inset, b.maxX - inset]) this._line([[x, cy, b.minZ], [x, cy, b.maxZ]], white, 1.2);
        }
      } else if (type === 'hockey') {
        this._line([[b.minX, cy, 0], [b.maxX, cy, 0]], white, 1.6);
        for (const side of [-1, 1]) {
          const z = side < 0 ? b.minZ : b.maxZ;
          this._circle(mx, cy + .01, z, Math.min(6.5, (b.maxZ - b.minZ) * .32), null, white, 1.6, side < 0 ? 0 : Math.PI, side < 0 ? Math.PI : TAU);
          this._line([[b.minX, cy, z - side * (b.maxZ - b.minZ) * .25], [b.maxX, cy, z - side * (b.maxZ - b.minZ) * .25]], white, 1.2);
        }
      } else if (type === 'lacrosse') {
        this._line([[b.minX, cy, 0], [b.maxX, cy, 0]], white, 1.6);
        this._circle(mx, cy + .01, 0, 1.5, null, white, 1.4);
        for (const side of [-1, 1]) { const z = side < 0 ? b.minZ : b.maxZ; this._circle(mx, cy + .01, z - side * 0.6, 2.2, null, white, 1.4); this._line([[b.minX, cy, z - side * 7], [b.maxX, cy, z - side * 7]], white, 1.1); }
      } else if (type === 'pool') {
        for (const side of [-1, 1]) { const z = side < 0 ? b.minZ : b.maxZ; this._line([[b.minX, cy, z - side * 2], [b.maxX, cy, z - side * 2]], '#ffd54f', 1.6); this._line([[b.minX, cy, z - side * 6], [b.maxX, cy, z - side * 6]], '#ff5252', 1.3); }
      } else {
        this._line([[b.minX, cy, 0], [b.maxX, cy, 0]], white, 1.7);
        this._circle(mx, cy + .01, 0, Math.min(2.5, (b.maxX - b.minX) * .18), null, white, 1.5);
        if (['american-football', 'rugby', 'flag-football'].includes(sport)) {
          for (let i = 1; i < 10; i++) { const z = b.minZ + (b.maxZ - b.minZ) * i / 10; this._line([[b.minX, cy, z], [b.maxX, cy, z]], white, 1); }
          this._polygon([[b.minX, cy, b.minZ], [b.maxX, cy, b.minZ], [b.maxX, cy, b.minZ + 2.2], [b.minX, cy, b.minZ + 2.2]], 'rgba(53,91,131,.4)');
          this._polygon([[b.minX, cy, b.maxZ - 2.2], [b.maxX, cy, b.maxZ - 2.2], [b.maxX, cy, b.maxZ], [b.minX, cy, b.maxZ]], 'rgba(182,71,53,.35)');
        } else {
          for (const side of [-1, 1]) {
            const z = side < 0 ? b.minZ : b.maxZ, inside = z - side * Math.min(4, (b.maxZ - b.minZ) * .2);
            this._line([[mx - 3, cy, z], [mx - 3, cy, inside], [mx + 3, cy, inside], [mx + 3, cy, z]], white, 1.5);
          }
        }
      }
    }

    _battingField(snapshot) {
      const b = this._bounds(snapshot), bt = snapshot.batting || {}, type = snapshot.fieldType, white = '#f6f7ee', cy = 0.026;
      const plateZ = Number.isFinite(bt.plateZ) ? bt.plateZ : b.maxZ - 4, moundZ = Number.isFinite(bt.moundZ) ? bt.moundZ : plateZ - 14, fence = bt.fence || 36;
      const grass = type === 'cricket' ? '#5f9a5a' : '#5d9361';
      this._polygon([[b.minX - 2, 0, b.minZ - 2], [b.maxX + 2, 0, b.minZ - 2], [b.maxX + 2, 0, b.maxZ + 2], [b.minX - 2, 0, b.maxZ + 2]], grass);
      if (type === 'cricket') {
        // oval with boundary rope and the 22-yard pitch strip
        const oval = [];
        for (let i = 0; i <= 40; i++) { const a = i * TAU / 40; oval.push([Math.cos(a) * fence, 0.006, plateZ - 10 + Math.sin(a) * (fence - 2)]); }
        this._polygon(oval, '#6aa366'); this._line(oval, white, 2.2);
        this._polygon([[-1.6, 0.012, plateZ + 1.2], [1.6, 0.012, plateZ + 1.2], [1.6, 0.012, moundZ - 1], [-1.6, 0.012, moundZ - 1]], '#d8c594');
        for (const z of [plateZ, plateZ + 1.0, moundZ, moundZ - 1.0]) this._line([[-1.4, cy, z], [1.4, cy, z]], white, 1.4);
        const st = bt.stumps || { z: plateZ + 0.75, halfWidth: 0.115, height: 0.72 };
        for (const end of [st.z, moundZ - 1.2]) for (const x of [-st.halfWidth, 0, st.halfWidth]) this._line([[x, 0, end], [x, st.height, end]], '#e8d3a3', 2.4);
        return;
      }
      // baseball / softball diamond: infield dirt, bases, mound, batter's boxes, foul lines, outfield fence
      const step = type === 'softball' ? 8.2 : 9.6, dirtR = step * 1.35;
      const infield = [[-2.6, 0.008, plateZ + 1.8], [2.6, 0.008, plateZ + 1.8]];
      for (let i = 0; i <= 24; i++) { const a = Math.PI * 0.3 - i * (Math.PI * 0.6) / 24; infield.push([Math.sin(a) * dirtR, 0.008, plateZ - Math.cos(a) * dirtR]); }
      this._polygon(infield, '#c79b6b');
      this._polygon([[-7.2, 0.01, plateZ - 7.2], [0, 0.01, plateZ - 14.4], [7.2, 0.01, plateZ - 7.2], [0, 0.01, plateZ]].map(p => [p[0] * step / 9.6, p[1], plateZ + (p[2] - plateZ) * step / 9.6]), '#78a86b');
      const bases = [[0, plateZ], [step, plateZ - step], [0, plateZ - step * 2], [-step, plateZ - step]];
      this._polygon(bases.map(p => [p[0], 0.012, p[1]]), '#78a86b', white, 1.6);
      this._line([[0, cy, plateZ], [-fence * 0.74, cy, plateZ - fence * 0.74]], white, 1.8);
      this._line([[0, cy, plateZ], [fence * 0.74, cy, plateZ - fence * 0.74]], white, 1.8);
      for (const [x, z] of bases.slice(1)) this._polygon([[x - .22, .02, z - .22], [x + .22, .02, z - .22], [x + .22, .02, z + .22], [x - .22, .02, z + .22]], white);
      this._polygon([[-.22, .02, plateZ + .22], [.22, .02, plateZ + .22], [.22, .02, plateZ - .1], [0, .02, plateZ - .3], [-.22, .02, plateZ - .1]], white);
      for (const side of [-1, 1]) this._line([[side * .45, cy, plateZ + .7], [side * 1.4, cy, plateZ + .7], [side * 1.4, cy, plateZ - .9], [side * .45, cy, plateZ - .9], [side * .45, cy, plateZ + .7]], white, 1.2);
      this._circle(0, cy, moundZ, type === 'softball' ? 2.4 : 2.7, '#c79b6b'); this._circle(0, cy + .01, moundZ, 2.2, null, white, 1);
      this._polygon([[-.3, .03, moundZ + .1], [.3, .03, moundZ + .1], [.3, .03, moundZ - .1], [-.3, .03, moundZ - .1]], white);
      const arc = [];
      for (let i = 0; i <= 24; i++) { const a = -Math.PI * 0.26 + i * (Math.PI * 0.52) / 24; arc.push([Math.sin(a) * fence, 0, plateZ - Math.cos(a) * fence]); }
      this._line(arc, '#f1dca6', 2);
      const fenceH = bt.fenceHeight || 2.6;
      for (let i = 0; i < arc.length - 1; i++) this._polygon([arc[i], arc[i + 1], [arc[i + 1][0], fenceH, arc[i + 1][2]], [arc[i][0], fenceH, arc[i][2]]], 'rgba(44,88,70,.72)');
      this._line(arc.map(p => [p[0], fenceH, p[2]]), '#f4e7b0', 1.6);
    }

    _golfField(snapshot) {
      const b = this._bounds(snapshot), g = snapshot.golf || { hole: { x: 1.5, z: -21 }, tee: { x: 0, z: 11 } }, hole = g.hole, tee = g.tee;
      this._polygon([[b.minX - 4, 0, b.minZ - 4], [b.maxX + 4, 0, b.minZ - 4], [b.maxX + 4, 0, b.maxZ + 4], [b.minX - 4, 0, b.maxZ + 4]], '#4f8a4a');
      const fairway = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30, z = tee.z + (hole.z - tee.z) * t, w = 4.2 + Math.sin(t * Math.PI) * 2.8 + Math.sin(t * 9) * 0.8; fairway.push([Math.sin(t * 2.2) * 1.6 + w, 0.006, z]); }
      for (let i = 30; i >= 0; i--) { const t = i / 30, z = tee.z + (hole.z - tee.z) * t, w = 4.2 + Math.sin(t * Math.PI) * 2.8 + Math.sin(t * 9) * 0.8; fairway.push([Math.sin(t * 2.2) * 1.6 - w, 0.006, z]); }
      this._polygon(fairway, '#78b56a');
      this._circle(hole.x, 0.012, hole.z, 6, '#9ad87f');
      this._circle(hole.x + 7.5, 0.01, hole.z + 3, 2.2, '#e9d9a8');
      this._polygon([[tee.x - 1.6, 0.012, tee.z + 1.2], [tee.x + 1.6, 0.012, tee.z + 1.2], [tee.x + 1.6, 0.012, tee.z - 1.2], [tee.x - 1.6, 0.012, tee.z - 1.2]], '#8fcb7d');
      this._circle(hole.x, 0.03, hole.z, 0.16, '#1f2b22');
      this._line([[hole.x, 0, hole.z], [hole.x, 2.2, hole.z]], '#f3f1e6', 2);
      this._polygon([[hole.x, 2.2, hole.z], [hole.x + 0.7, 1.95, hole.z], [hole.x, 1.7, hole.z]], '#f5c342');
      if (Number.isFinite(g.windX)) {
        const base = this.project(tee.x - 4, 2.5, tee.z - 2);
        if (base) { this._line([[tee.x - 4, 2.5, tee.z - 2], [tee.x - 4 + Math.sign(g.windX) * Math.min(2, Math.abs(g.windX)), 2.5, tee.z - 2]], '#fff8d6', 2.5); }
      }
      // aim line while resting
      if (snapshot.ball && snapshot.ball.state === 'rest') {
        const ball = snapshot.ball, ang = Math.atan2(hole.x - ball.x, hole.z - ball.z) + (g.aimX || 0) * 0.6;
        const len = Math.min(12, Math.hypot(hole.x - ball.x, hole.z - ball.z));
        this._line([[ball.x, 0.04, ball.z], [ball.x + Math.sin(ang) * len, 0.04, ball.z + Math.cos(ang) * len]], 'rgba(255,255,255,.75)', 1.6, true);
      }
    }

    _laneField(snapshot) {
      const lane = snapshot.lane || { foulZ: 7.6, pinZ: -8.6, pins: [] }, half = 0.53;
      this._polygon([[-1.3, 0, lane.foulZ + 3], [1.3, 0, lane.foulZ + 3], [1.3, 0, lane.pinZ - 2], [-1.3, 0, lane.pinZ - 2]], '#2b2f36');
      this._polygon([[-half, 0.01, lane.foulZ], [half, 0.01, lane.foulZ], [half, 0.01, lane.pinZ - 1.4], [-half, 0.01, lane.pinZ - 1.4]], '#d9b57c');
      for (const side of [-1, 1]) this._polygon([[side * half, 0.005, lane.foulZ], [side * (half + 0.22), 0.005, lane.foulZ], [side * (half + 0.22), 0.005, lane.pinZ - 1.4], [side * half, 0.005, lane.pinZ - 1.4]], '#3c4654');
      this._polygon([[-1.1, 0.01, lane.foulZ + 3], [1.1, 0.01, lane.foulZ + 3], [1.1, 0.01, lane.foulZ], [-1.1, 0.01, lane.foulZ]], '#b9a07a');
      this._line([[-half, 0.03, lane.foulZ], [half, 0.03, lane.foulZ]], '#d44', 2);
      for (let i = 0; i < 7; i++) { const x = -0.33 + i * 0.11, z = lane.foulZ - 4.6 + (i % 2 ? 0.3 : 0) - Math.abs(i - 3) * 0.25; this._polygon([[x - .02, .03, z], [x + .02, .03, z], [x, .03, z - .25]], '#222'); }
      for (let i = 1; i < 40; i++) this._line([[-half + i * half * 2 / 40, 0.012, lane.foulZ], [-half + i * half * 2 / 40, 0.012, lane.pinZ - 1.4]], 'rgba(120,80,40,.12)', 0.6);
      this._polygon([[-1.3, 0, lane.pinZ - 1.4], [1.3, 0, lane.pinZ - 1.4], [1.3, 1.6, lane.pinZ - 1.4], [-1.3, 1.6, lane.pinZ - 1.4]], '#1d2229');
      const pins = (lane.pins || []).slice().sort((a, b) => (this.project(b.x, 0, b.z)?.depth || 0) - (this.project(a.x, 0, a.z)?.depth || 0));
      for (const pin of pins) {
        if (pin.up) { this._cylinder(pin.x, pin.z, 0.06, 0.38, '#f6f3ea', '#e2423c'); const band = this.project(pin.x, 0.26, pin.z); if (band) { this.ctx.strokeStyle = '#e2423c'; this.ctx.lineWidth = Math.max(1, band.scale * 0.02); this.ctx.beginPath(); this.ctx.moveTo(band.x - band.scale * 0.055, band.y); this.ctx.lineTo(band.x + band.scale * 0.055, band.y); this.ctx.stroke(); } }
        else { const f = Math.min(1, pin.fall || 1); this._line([[pin.x, 0.04, pin.z], [pin.x + (pin.vx || 0.2) * 0.12 * f, 0.04 + (1 - f) * 0.3, pin.z - 0.25 * f]], '#f6f3ea', 5); }
      }
      if (snapshot.ball && snapshot.ball.state === 'ready') {
        const ball = snapshot.ball, ang = (lane.aimX || 0) * 0.2;
        this._line([[ball.x, 0.03, ball.z], [ball.x + Math.sin(ang) * 9, 0.03, ball.z - Math.cos(ang) * 9]], 'rgba(255,255,255,.6)', 1.4, true);
      }
    }

    _tableField(snapshot) {
      const b = this._bounds(snapshot), r = 0.0857, cue = snapshot.cue || { balls: [], pockets: [] };
      this._polygon([[b.minX - 0.35, 0.8, b.minZ - 0.35], [b.maxX + 0.35, 0.8, b.minZ - 0.35], [b.maxX + 0.35, 0.8, b.maxZ + 0.35], [b.minX - 0.35, 0.8, b.maxZ + 0.35]], '#5a3c26');
      for (const corner of [[b.minX - 0.3, b.minZ - 0.3], [b.maxX + 0.3, b.minZ - 0.3], [b.minX - 0.3, b.maxZ + 0.3], [b.maxX + 0.3, b.maxZ + 0.3]]) this._box(corner[0], corner[1], 0.14, 0.14, 0.8, ['#3f2a1a', '#2d1d12', '#4a3220']);
      this._polygon([[b.minX, 0.81, b.minZ], [b.maxX, 0.81, b.minZ], [b.maxX, 0.81, b.maxZ], [b.minX, 0.81, b.maxZ]], '#2e8b57');
      for (const pk of cue.pockets || []) this._circle(pk.x, 0.815, pk.z, r * 1.7, '#111');
      this._line([[b.minX, 0.82, b.maxZ * 0.5], [b.maxX, 0.82, b.maxZ * 0.5]], 'rgba(255,255,255,.3)', 1);
      const colors = ['#f4d03f', '#2e86de', '#e74c3c', '#8e44ad', '#e67e22', '#27ae60', '#7f1d1d'];
      const balls = (cue.balls || []).filter(o => !o.pocketed).map(o => ({ o, d: this.project(o.x, 0.9, o.z)?.depth || 0 })).sort((a, c) => c.d - a.d);
      for (const { o } of balls) { const p = this.project(o.x, 0.8 + r, o.z); if (!p) continue; const rr = Math.max(2, p.scale * r); this.ctx.fillStyle = colors[(o.id - 1) % colors.length]; this.ctx.beginPath(); this.ctx.arc(p.x, p.y, rr, 0, TAU); this.ctx.fill(); this.ctx.fillStyle = '#fff'; this.ctx.beginPath(); this.ctx.arc(p.x, p.y, rr * 0.42, 0, TAU); this.ctx.fill(); if (rr > 6) { this.ctx.fillStyle = '#222'; this.ctx.font = `700 ${rr * 0.7}px system-ui`; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle'; this.ctx.fillText(String(o.id), p.x, p.y); } }
      if (snapshot.ball && snapshot.ball.state === 'ready' && snapshot.turn === 0) {
        const ball = snapshot.ball, ang = cue.aim || 0;
        this._line([[ball.x, 0.82 + r, ball.z], [ball.x + Math.sin(ang) * 3, 0.82 + r, ball.z + Math.cos(ang) * 3]], 'rgba(255,255,255,.7)', 1.2, true);
      }
    }

    _squashField(snapshot) {
      const b = this._bounds(snapshot), wall = snapshot.wall || { z: b.minZ, tin: 0.48, outLine: 4.57 }, white = '#f0ede4';
      this._polygon([[b.minX, 0.008, b.minZ], [b.maxX, 0.008, b.minZ], [b.maxX, 0.008, b.maxZ], [b.minX, 0.008, b.maxZ]], '#d7b98a');
      this._polygon([[b.minX, 0, wall.z], [b.maxX, 0, wall.z], [b.maxX, 5.2, wall.z], [b.minX, 5.2, wall.z]], '#efeae0');
      for (const x of [b.minX, b.maxX]) this._polygon([[x, 0, wall.z], [x, 0, b.maxZ], [x, 4.0, b.maxZ], [x, 5.2, wall.z]], 'rgba(230,226,215,.55)');
      this._line([[b.minX, wall.tin, wall.z + .005], [b.maxX, wall.tin, wall.z + .005]], '#d33', 3);
      this._line([[b.minX, 1.78, wall.z + .005], [b.maxX, 1.78, wall.z + .005]], '#d33', 2);
      this._line([[b.minX, wall.outLine, wall.z + .005], [b.maxX, wall.outLine, wall.z + .005]], '#d33', 2);
      this._line([[b.minX, 0.03, 0.4], [b.maxX, 0.03, 0.4]], '#c33', 1.6);
      this._line([[0, 0.03, 0.4], [0, 0.03, b.maxZ]], '#c33', 1.6);
      for (const side of [-1, 1]) this._line([[side * b.maxX, 0.03, 0.4], [side * b.maxX, 0.03, 2.0], [side * (b.maxX - 1.6), 0.03, 2.0], [side * (b.maxX - 1.6), 0.03, 0.4]], '#c33', 1.4);
    }

    /* ------------------------------------------------------------ fixtures */
    _goal(goal, sport) {
      const x = goal.x || 0, z = goal.z, width = goal.width || 3, h = goal.height || 2;
      if (sport === 'american-football' || sport === 'rugby' || sport === 'flag-football') {
        this._line([[x, 0, z], [x, 2, z]], '#e4db80', 4);
        this._line([[x - width / 2, 4.7, z], [x - width / 2, 2, z], [x + width / 2, 2, z], [x + width / 2, 4.7, z]], '#f4dc81', 3);
        return;
      }
      const back = z + (z < 0 ? -1 : 1) * .8;
      this._polygon([[x - width / 2, 0, back], [x + width / 2, 0, back], [x + width / 2, h, back], [x - width / 2, h, back]], 'rgba(241,251,251,.22)');
      const segments = this.quality === 'lite' ? 4 : 8;
      for (let i = 0; i <= segments; i++) { const xx = x - width / 2 + width * i / segments; this._line([[xx, 0, back], [xx, h, back]], 'rgba(241,251,251,.6)', .7); }
      for (let i = 1; i <= 4; i++) this._line([[x - width / 2, h * i / 4, back], [x + width / 2, h * i / 4, back]], 'rgba(241,251,251,.6)', .7);
      const frame = sport === 'water-polo' ? '#ffd54f' : sport === 'lacrosse' ? '#f0804a' : '#faf4e5';
      this._line([[x - width / 2, 0, z], [x - width / 2, h, z], [x + width / 2, h, z], [x + width / 2, 0, z]], frame, 3.5);
      for (const side of [-1, 1]) this._line([[x + side * width / 2, h, z], [x + side * width / 2, h, back], [x + side * width / 2, 0, back]], '#e7edf0', 2);
    }

    _net(net, snapshot) {
      const b = this._bounds(snapshot), z = net.z || 0, h = net.height || 1;
      const tall = snapshot.sport === 'volleyball' || snapshot.sport === 'beach-volleyball' || snapshot.sport === 'sepak-takraw';
      const low = tall ? Math.max(.7, h - .95) : .15;
      this._polygon([[b.minX, low, z], [b.maxX, low, z], [b.maxX, h, z], [b.minX, h, z]], 'rgba(224,240,239,.2)');
      for (const x of [b.minX, b.maxX]) this._line([[x, 0, z], [x, h + .1, z]], '#f0e7dc', 3);
      this._line([[b.minX, h, z], [b.maxX, h, z]], '#faf7e8', 3);
      const count = this.quality === 'lite' ? 8 : 16;
      for (let i = 1; i < count; i++) { const x = b.minX + (b.maxX - b.minX) * i / count; this._line([[x, low, z], [x, h, z]], 'rgba(237,244,242,.65)', .7); }
      this._line([[b.minX, (h + low) / 2, z], [b.maxX, (h + low) / 2, z]], 'rgba(237,244,242,.65)', .7);
    }

    _target(target) {
      for (const [factor, color] of [[1, '#f6f4e7'], [.8, '#333e48'], [.6, '#4d9acb'], [.4, '#df6360'], [.2, '#f5ce48']]) this._vcircle(target.x, target.y, target.z, (target.radius || 1.2) * factor, color);
      this._line([[target.x - .65, 0, target.z + .3], [target.x, target.y, target.z], [target.x + .65, 0, target.z + .3]], '#745842', 2);
    }

    _hoop(hoop) {
      const x = hoop.x || 0, z = hoop.z === undefined ? -6 : hoop.z, y = hoop.y || 3.05, s = z < 0 ? -1 : 1;
      this._line([[x, 0, z + s * 0.9], [x, 4.15, z + s * 0.9], [x, 4.15, z + s * 0.23]], '#495d63', 7);
      const bz = z + s * 0.25;
      this._polygon([[x - 0.92, y - 0.11, bz], [x + 0.92, y - 0.11, bz], [x + 0.92, y + 1.12, bz], [x - 0.92, y + 1.12, bz]], 'rgba(250,255,255,0.83)', '#61787d', 2);
      this._line([[x - 0.31, y + 0.08, bz - s * 0.008], [x - 0.31, y + 0.51, bz - s * 0.008], [x + 0.31, y + 0.51, bz - s * 0.008], [x + 0.31, y + 0.08, bz - s * 0.008], [x - 0.31, y + 0.08, bz - s * 0.008]], '#e77b59', 1.6);
      const count = this.quality === 'lite' ? 6 : 9;
      for (let i = 0; i < count; i++) {
        const a = TAU * i / count;
        this._line([[x + Math.cos(a) * 0.23, y, z + Math.sin(a) * 0.23], [x + Math.cos(a + 0.35) * 0.13, y - 0.48, z + Math.sin(a + 0.35) * 0.13]], 'rgba(255,255,248,0.9)', 1.1);
      }
      this._circle(x, y - 0.46, z, 0.13, null, 'rgba(255,255,248,0.9)', 1);
      this._circle(x, y, z, 0.23, null, '#ea5d37', 3);
    }

    _shadow(x, z, height, radius) {
      if (!PRESETS[this.quality].shadows) return;
      this._circle(x, 0.042, z, radius || 0.38, `rgba(42,58,59,${Math.max(0.07, 0.22 - (height || 0) * 0.04)})`);
    }

    /* ------------------------------------------------------------- players */
    _appearance(p) {
      const a = p.appearance || {};
      const id = Math.abs(Number(p.id) || 0);
      return {
        skin: a.skin || DEFAULT_SKIN[id % DEFAULT_SKIN.length], hair: a.hair || ['#1b1b1b', '#3b2a1e', '#5a3a22', '#8a5a2b', '#d9b36c', '#2a2a2a'][id % 6],
        hairStyle: a.hairStyle || ['short', 'buzz', 'curly', 'long', 'ponytail', 'short'][id % 6], facialHair: a.facialHair || 'none',
        build: a.build || 'athletic', accessory: a.accessory || 'none', jerseyNumber: Number.isFinite(a.jerseyNumber) ? a.jerseyNumber : null
      };
    }

    _player(p, snapshot, options) {
      if (this._camera.view === 'first' && p.id === this._camera.focusId) return;
      const look = this._appearance(p), ps = this._camera.playerScale || 1;
      const x = p.x, z = p.z, y = p.y || 0, height = Math.max(1.35, Math.min(2.5, (p.heightCm || 180) / 100));
      const size = height / 1.8 * ps, buildW = look.build === 'slim' ? 0.86 : look.build === 'stocky' ? 1.16 : look.build === 'compact' ? 0.94 : look.build === 'tall' ? 0.96 : 1;
      const weight = Math.max(.84, Math.min(1.18, Math.sqrt((p.weightKg || 82) / 82))) * buildW;
      const pivot = this.project(x, y + size * .9, z);
      if (!pivot) return;
      const ctx = this.ctx, angle = Number.isFinite(p.angle) ? p.angle : Math.PI;
      const torso = Number.isFinite(p.torsoAngle) && snapshot.family !== 'batting' ? p.torsoAngle : (snapshot.family === 'batting' ? angle + (p.torsoAngle || 0) : angle);
      const sideX = Math.cos(torso), sideZ = -Math.sin(torso), frontX = Math.sin(angle), frontZ = Math.cos(angle);
      const armAngle = Number.isFinite(p.armAngle) ? p.armAngle : torso, armX = Math.sin(armAngle), armZ = Math.cos(armAngle);
      const speed = Math.min(1, Math.hypot(p.vx || 0, p.vz || 0) / 3.8), phase = (snapshot.clock || 0) * 10 + (Number(p.id) || 0) * .83;
      const stride = Math.sin(phase) * .24 * speed * size, action = String(p.action || '');
      const swim = snapshot.fieldType === 'pool';
      const raised = /jump|block|shoot|dunk|layup/.test(action) || y > .22, crouching = /crouch|load/.test(action);
      const shoulderAngle = snapshot.family === 'batting' || snapshot.sport === 'baseball' ? Math.max(-.8, Math.min(.8, Number(p.shoulderAngle) || 0)) : 0;
      const shoulderLift = Math.sin(shoulderAngle) * .48;
      const waterY = swim ? -0.85 * size : 0;
      const waistY = (crouching ? .62 : .86) * size + waterY, shoulderY = (crouching ? 1.08 : 1.36) * size + waterY, headY = (crouching ? 1.38 : 1.68) * size + waterY;
      const color = TEAM_COLORS[p.team === 1 || p.team === 'away' ? 1 : 0];
      const skin = look.skin;
      const clothWidth = Math.min(45, Math.max(3, pivot.scale * .13 * size * weight));
      const selectedId = options.selectedId === undefined ? snapshot.selectedId : options.selectedId;
      const highlighted = options.replay && options.focusId !== undefined ? p.id === options.focusId : p.id === selectedId;
      if (highlighted) {
        this._circle(x, .055, z, .54, null, p.team === 1 ? '#ff806d' : '#0d887d', Math.max(1.5, pivot.scale * .055));
        if (!options.replay) {
          const marker = this.project(x, y + headY + .4, z);
          if (marker) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(marker.x - 5, marker.y - 3); ctx.lineTo(marker.x + 5, marker.y - 3); ctx.lineTo(marker.x, marker.y + 4); ctx.closePath(); ctx.fill(); }
        }
      }
      if (swim) {
        // swimmers: body below the water line is hidden; a splash ring marks the surface
        this._circle(x, 0.03, z, .55 * size, 'rgba(230,245,255,.35)', 'rgba(255,255,255,.55)', 1.2);
      } else {
        for (const side of [-1, 1]) {
          const hip = [x + sideX * .115 * side * size, y + waistY, z + sideZ * .115 * side * size];
          const knee = [x + sideX * .13 * side * size + frontX * stride * side, y + waistY * .52, z + sideZ * .13 * side * size + frontZ * stride * side];
          const foot = [x + sideX * .13 * side * size - frontX * stride * side, y + .08, z + sideZ * .13 * side * size - frontZ * stride * side];
          this._line([hip, knee, foot], skin, clothWidth); this._line([hip, knee], TEAM_DARK[p.team === 1 ? 1 : 0], clothWidth * 1.23);
          this._line([foot, [foot[0] + frontX * .16, foot[1], foot[2] + frontZ * .16]], '#fff9ef', clothWidth * .9);
        }
      }
      const sw = .19 * size * weight, left = [x - sideX * sw, y + shoulderY, z - sideZ * sw], right = [x + sideX * sw, y + shoulderY, z + sideZ * sw];
      this._polygon([left, right, [x + sideX * .14 * size, y + waistY, z + sideZ * .14 * size], [x - sideX * .14 * size, y + waistY, z - sideZ * .14 * size]], color);
      this._line([[x, y + waistY + .12 * size, z], [x, y + shoulderY - .04 * size, z]], color, Math.max(4, pivot.scale * .29 * size * weight));
      let equipmentHand, otherHand;
      for (const side of [-1, 1]) {
        const shoulder = side === -1 ? left : right;
        const swing = /swing|racket|kick|throw|stick|cue|golf|putt|bowl|pitch|bunt/.test(action) ? Math.sin(Math.min(1, p.actionTime || .5) * Math.PI) : 0;
        const elbow = [x + sideX * .29 * side * size + armX * .13, y + ((raised ? 1.63 : 1.02) + shoulderLift * .55) * size + waterY, z + sideZ * .29 * side * size + armZ * .13];
        const reach = raised ? .11 : .37 + swing * .2;
        const hand = [x + sideX * (raised ? .2 : .3) * side * size + armX * reach, y + ((raised ? 1.98 : .95 + Math.sin(phase + side) * speed * .09 + swing * .15) + shoulderLift) * size + waterY, z + sideZ * (raised ? .2 : .3) * side * size + armZ * reach];
        this._line([shoulder, elbow, hand], skin, clothWidth * .8);
        if (side === 1) equipmentHand = hand; else otherHand = hand;
      }
      // jersey number on the chest
      if (this.quality !== 'lite') {
        const chest = this.project(x + frontX * .16 * size, y + (waistY + shoulderY) / 2 + .05, z + frontZ * .16 * size);
        if (chest && chest.scale * size > 36) {
          ctx.font = `800 ${Math.max(7, Math.min(26, chest.scale * .11 * size))}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(look.jerseyNumber !== null ? look.jerseyNumber : (p.number === undefined ? Number(p.id) + 1 : p.number)), chest.x, chest.y);
        }
      }
      const head = this.project(x, y + headY, z);
      if (head) {
        const r = Math.min(70, Math.max(2.3, head.scale * .155 * size));
        const portrait = options.portraits && options.portraits[p.athleteId];
        // hair behind the head first (long/afro/braids)
        this._hairBack(head, r, look, frontX);
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, TAU); ctx.fill();
        if (portrait && (portrait.naturalWidth || portrait.width) > 0) {
          const iw = portrait.naturalWidth || portrait.width, ih = portrait.naturalHeight || portrait.height;
          // Licensed portrait billboards (catalogue photos), not a reconstructed or branded 3D likeness.
          if (ih > 0) { ctx.save(); ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, TAU); ctx.clip(); const crop = Math.min(iw, ih); try { ctx.drawImage(portrait, (iw - crop) / 2, 0, crop, crop, head.x - r, head.y - r, r * 2, r * 2); } catch (_) {} ctx.restore(); }
          ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, r * .12); ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, TAU); ctx.stroke();
        } else {
          this._hairFront(head, r, look);
          if (r > 5.5) {
            // simple face: eyes + mouth, facial hair
            const facing = this._camera.view === 'batter' || frontZ > 0 ? 1 : (frontZ < -0.3 ? 0 : 0.5);
            if (facing) {
              ctx.fillStyle = '#2b2622'; ctx.beginPath(); ctx.arc(head.x - r * .32, head.y - r * .05, r * .09, 0, TAU); ctx.arc(head.x + r * .32, head.y - r * .05, r * .09, 0, TAU); ctx.fill();
              if (look.facialHair !== 'none') { ctx.strokeStyle = look.hair; ctx.lineWidth = Math.max(1, r * (look.facialHair === 'beard' ? .22 : .1)); ctx.beginPath(); ctx.arc(head.x, head.y + r * (look.facialHair === 'mustache' ? .3 : .45), r * (look.facialHair === 'beard' ? .62 : look.facialHair === 'goatee' ? .25 : .5), look.facialHair === 'mustache' ? Math.PI * 1.15 : 0.15 * Math.PI, look.facialHair === 'mustache' ? Math.PI * 1.85 : 0.85 * Math.PI); ctx.stroke(); }
              else { ctx.strokeStyle = 'rgba(70,40,30,.6)'; ctx.lineWidth = Math.max(0.8, r * .07); ctx.beginPath(); ctx.arc(head.x, head.y + r * .32, r * .3, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
            }
          }
        }
        this._accessory(head, r, look, color);
      }
      if (equipmentHand) this._equipment(equipmentHand, armAngle, snapshot.sport, action, shoulderAngle, otherHand, snapshot, p);
      if (options.labels !== false && this.quality !== 'lite') {
        const label = this.project(x, y + 1.21 * size + waterY, z - .06);
        if (label && !swim) { ctx.font = `800 ${Math.max(8, Math.min(35, label.scale * .2))}px system-ui, sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(p.number === undefined ? Number(p.id) + 1 : p.number), label.x, label.y); }
      }
      if (options.names && p.displayName && this.quality !== 'lite') {
        const tag = this.project(x, y + headY + .62, z);
        if (tag && tag.scale * size > 40) { ctx.font = `700 ${Math.max(9, Math.min(15, tag.scale * .085))}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(String(p.displayName).split(' ').slice(-1)[0], tag.x, tag.y); }
      }
    }

    _hairBack(head, r, look) {
      const ctx = this.ctx, s = look.hairStyle;
      if (s === 'long' || s === 'braids') { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(head.x, head.y + r * .35, r * 1.05, r * 1.25, 0, 0, TAU); ctx.fill(); }
      else if (s === 'afro' || s === 'curly') { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(head.x, head.y - r * .15, r * (s === 'afro' ? 1.35 : 1.12), 0, TAU); ctx.fill(); }
      else if (s === 'ponytail') { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(head.x + r * .7, head.y + r * .4, r * .32, r * .9, -.4, 0, TAU); ctx.fill(); }
      else if (s === 'bun') { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(head.x, head.y - r * .95, r * .42, 0, TAU); ctx.fill(); }
    }

    _hairFront(head, r, look) {
      const ctx = this.ctx, s = look.hairStyle;
      if (s === 'bald' || s === 'hijab' || s === 'turban') {
        if (s === 'hijab') { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(head.x, head.y, r * 1.08, Math.PI * .85, Math.PI * 2.15); ctx.lineTo(head.x + r * .9, head.y + r * 1.1); ctx.lineTo(head.x - r * .9, head.y + r * 1.1); ctx.closePath(); ctx.fill(); }
        if (s === 'turban') { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(head.x, head.y - r * .55, r * 1.05, r * .72, 0, 0, TAU); ctx.fill(); }
        return;
      }
      ctx.fillStyle = look.hair; ctx.beginPath();
      if (s === 'buzz') ctx.ellipse(head.x, head.y - r * .5, r * .9, r * .5, 0, Math.PI, TAU);
      else if (s === 'mohawk') { ctx.ellipse(head.x, head.y - r * .55, r * .3, r * .95, 0, Math.PI, TAU); }
      else if (s === 'headband') { ctx.ellipse(head.x, head.y - r * .55, r * .95, r * .62, 0, Math.PI, TAU); }
      else ctx.ellipse(head.x, head.y - r * .52, r * .92, r * .58, 0, Math.PI, TAU);
      ctx.fill();
    }

    _accessory(head, r, look, color) {
      const ctx = this.ctx, a = look.accessory, s = look.hairStyle;
      if (a === 'headband' || s === 'headband') { ctx.strokeStyle = a === 'headband' ? '#f7f7f2' : color; ctx.lineWidth = Math.max(1, r * .18); ctx.beginPath(); ctx.arc(head.x, head.y, r * .96, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
      if (a === 'cap' || s === 'cap') { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(head.x, head.y - r * .18, r * .98, Math.PI, TAU); ctx.fill(); ctx.fillRect(head.x - r * .2, head.y - r * .25, r * 1.5, Math.max(1, r * .14)); }
      if (a === 'helmet' || s === 'helmet') { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(head.x, head.y - r * .08, r * 1.08, Math.PI * .95, Math.PI * 2.05); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1, r * .08); ctx.beginPath(); ctx.arc(head.x, head.y - r * .08, r * 1.08, Math.PI * .95, Math.PI * 2.05); ctx.stroke(); }
      if (a === 'visor') { ctx.fillStyle = color; ctx.fillRect(head.x - r * .95, head.y - r * .6, r * 1.9, Math.max(1, r * .22)); ctx.fillRect(head.x - r * .3, head.y - r * .55, r * 1.5, Math.max(1, r * .1)); }
      if (a === 'glasses' || a === 'goggles') { ctx.strokeStyle = a === 'goggles' ? '#1f2a33' : '#3a3f45'; ctx.lineWidth = Math.max(1, r * .1); ctx.beginPath(); ctx.arc(head.x - r * .33, head.y - r * .05, r * .26, 0, TAU); ctx.arc(head.x + r * .33, head.y - r * .05, r * .26, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(head.x - r * .07, head.y - r * .05); ctx.lineTo(head.x + r * .07, head.y - r * .05); ctx.stroke(); }
      if (a === 'wristband') { /* drawn on the arm is too small to read; indicated by colour on the number label */ }
    }

    _equipment(hand, angle, sport, action, shoulderAngle = 0, otherHand, snapshot, p) {
      const dx = Math.sin(angle), dz = Math.cos(angle);
      if ((sport === 'baseball' || sport === 'softball' || sport === 'cricket') && p && p.id !== 0) return;   // only the batter carries a bat
      if (sport === 'baseball' || sport === 'softball') {
        const lift = (/swing/.test(action) ? 0.05 : .7) + Math.sin(shoulderAngle) * .8;
        const reach = .95 * Math.cos(shoulderAngle);
        this._line([hand, [hand[0] + dx * reach, hand[1] + lift, hand[2] + dz * reach]], sport === 'softball' ? '#c9c9c4' : '#d7b77e', 5);
      } else if (sport === 'cricket') {
        const lift = /swing/.test(action) ? 0.1 : -0.55;
        this._line([hand, [hand[0] + dx * .55, hand[1] + lift, hand[2] + dz * .55]], '#e8d6a8', 7);
      } else if (/tennis|badminton|squash/.test(sport || '')) {
        const end = [hand[0] + dx * .55, hand[1] + .16, hand[2] + dz * .55];
        this._line([hand, end], '#293b51', 2);
        const points = [], r = sport.includes('table') ? .17 : sport === 'squash' ? .2 : .27;
        for (let i = 0; i <= 16; i++) { const a = i * TAU / 16; points.push([end[0] + Math.cos(angle) * Math.cos(a) * r, end[1] + Math.sin(a) * r * 1.25, end[2] - Math.sin(angle) * Math.cos(a) * r]); }
        this._polygon(points, sport.includes('table') ? '#c64a48' : 'rgba(239,246,241,.25)', '#e9f1eb', 1.7);
      } else if (sport === 'ice-hockey') {
        const end = [hand[0] + dx * .7, .08, hand[2] + dz * .7];
        this._line([hand, end, [end[0] + dx * .45, .08, end[2] + dz * .45]], '#665a4c', 3);
      } else if (sport === 'field-hockey') {
        const end = [hand[0] + dx * .75, .07, hand[2] + dz * .75];
        this._line([hand, end, [end[0] + Math.cos(angle) * .22, .07, end[2] - Math.sin(angle) * .22]], '#2f3a46', 3.5);
      } else if (sport === 'lacrosse') {
        const end = [hand[0] + dx * .95, hand[1] + .6, hand[2] + dz * .95];
        this._line([hand, end], '#9aa4ad', 2.5);
        const pts = []; for (let i = 0; i <= 12; i++) { const a = i * TAU / 12; pts.push([end[0] + Math.cos(angle) * Math.cos(a) * .12 + dx * Math.sin(a) * .15, end[1] + Math.sin(a) * .22 + .18, end[2] - Math.sin(angle) * Math.cos(a) * .12 + dz * Math.sin(a) * .15]); }
        this._polygon(pts, 'rgba(255,255,255,.25)', '#f2f2f2', 1.4);
      } else if (sport === 'golf') {
        const swinging = /golf|putt/.test(action), low = swinging ? .3 : .05;
        const end = [hand[0] + dx * .3, low, hand[2] + dz * .3];
        this._line([hand, end], '#aab3bb', 2); this._line([end, [end[0] + Math.cos(angle) * .12, low, end[2] - Math.sin(angle) * .12]], '#2f2f33', 4);
      } else if (sport === 'billiards') {
        const cue = snapshot && snapshot.cue, ang = cue && Number.isFinite(cue.aim) && p && p.id === (snapshot.turn || 0) ? cue.aim : angle;
        this._line([[hand[0] - Math.sin(ang) * 1.1, hand[1] - .05, hand[2] - Math.cos(ang) * 1.1], [hand[0] + Math.sin(ang) * .45, hand[1] - .1, hand[2] + Math.cos(ang) * .45]], '#c99a5b', 2.4);
      } else if (sport === 'bowling') {
        if (snapshot && snapshot.ball && snapshot.ball.state === 'ready') { const q = this.project(hand[0], hand[1], hand[2]); if (q) { this.ctx.fillStyle = '#1f3a5f'; this.ctx.beginPath(); this.ctx.arc(q.x, q.y, Math.max(3, q.scale * .108), 0, TAU); this.ctx.fill(); } }
      } else if (sport === 'archery') {
        const center = [hand[0] + dx * .3, hand[1] + .2, hand[2] + dz * .3];
        this._line([[center[0], center[1] - .55, center[2]], [center[0] + dx * .18, center[1], center[2] + dz * .18], [center[0], center[1] + .55, center[2]]], '#a28662', 2.5);
        this._line([[center[0], center[1] - .55, center[2]], [center[0], center[1] + .55, center[2]]], '#eef0dd', 1);
      }
    }

    _ball(ball, sport) {
      if (!ball || ball.state === 'marker' || ball.state === 'scored' || ball.state === 'holed') return;
      const p = this.project(ball.x, ball.y || 0, ball.z);
      if (!p) return;
      const ctx = this.ctx, kind = ball.kind || sport || 'basketball';
      const visual = ball.radius && ball.radius < 0.1 ? Math.max(ball.radius, 0.075) : ball.radius;
      const radius = Math.min(60, Math.max(2.8, p.scale * (visual || (/tennis|baseball/.test(kind) ? .065 : .14))));
      if (kind === 'arrow') { this._line([[ball.x, ball.y, ball.z], [ball.x - (ball.vx || 0) * .025, ball.y - (ball.vy || 0) * .025, ball.z - (ball.vz || 0) * .025]], '#e6cf80', 2); return; }
      const color = kind === 'puck' ? '#23323c' : kind === 'tennis' ? '#dbe647' : kind === 'softtennis' ? '#f5f5f5' : kind === 'cricketball' ? '#b8302a' : kind === 'golf' ? '#ffffff' : kind === 'bowlingball' ? '#1f3a5f' : kind === 'cueball' ? '#f7f7f0' :
        kind === 'rattan' ? '#c9a062' : kind === 'waterpolo' ? '#f5d547' : kind === 'hockeyball' ? '#f6f6f0' : kind === 'lacrosse' ? '#f7f7f7' :
        /shuttle|baseball|soccer|volleyball|tabletennis|badminton|softball/.test(kind) ? '#f7f7ef' : kind === 'oval' ? '#a87247' : '#ed7c31';
      ctx.fillStyle = color; ctx.beginPath();
      if (kind === 'puck' || kind === 'oval') ctx.ellipse(p.x, p.y, radius * (kind === 'oval' ? 1.45 : 1.2), radius * (kind === 'puck' ? .4 : .8), kind === 'oval' ? -.25 : 0, 0, TAU);
      else ctx.arc(p.x, p.y, radius, 0, TAU);
      ctx.fill(); ctx.strokeStyle = kind === 'soccer' ? '#3e4955' : kind === 'softball' ? '#d9a21b' : '#765744'; ctx.lineWidth = Math.max(.65, radius * .08); ctx.stroke();
      if (kind === 'soccer') { ctx.fillStyle = '#35424b'; ctx.beginPath(); ctx.arc(p.x, p.y, radius * .4, 0, TAU); ctx.fill(); }
      else if (kind === 'rattan') { ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = Math.max(.6, radius * .1); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(p.x, p.y, radius * .9, radius * .35, i * Math.PI / 3, 0, TAU); ctx.stroke(); } }
      else if (kind === 'baseball' || kind === 'softball' || kind === 'cricketball') { ctx.strokeStyle = kind === 'cricketball' ? '#f1e3c8' : '#c6453a'; ctx.lineWidth = Math.max(.6, radius * .09); ctx.beginPath(); ctx.arc(p.x - radius * .55, p.y, radius * .7, -.6, .6); ctx.stroke(); ctx.beginPath(); ctx.arc(p.x + radius * .55, p.y, radius * .7, Math.PI - .6, Math.PI + .6); ctx.stroke(); }
      else if (kind === 'volleyball') { ctx.strokeStyle = '#3b6ea8'; ctx.lineWidth = Math.max(.6, radius * .1); ctx.beginPath(); ctx.arc(p.x, p.y, radius * .62, .5, 2.6); ctx.stroke(); ctx.beginPath(); ctx.arc(p.x, p.y, radius * .62, 3.5, 5.6); ctx.stroke(); }
      else if (!['puck', 'tennis', 'shuttle', 'arrow', 'golf', 'bowlingball', 'cueball', 'hockeyball', 'lacrosse', 'softtennis', 'waterpolo', 'tabletennis'].includes(kind)) {
        ctx.beginPath(); ctx.moveTo(p.x - radius * .75, p.y); ctx.lineTo(p.x + radius * .75, p.y); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(p.x, p.y, radius * .4, radius, 0.23, 0, TAU); ctx.stroke();
      }
      if (kind === 'bowlingball') { ctx.fillStyle = '#0d1a2b'; ctx.beginPath(); ctx.arc(p.x - radius * .2, p.y - radius * .3, radius * .12, 0, TAU); ctx.arc(p.x + radius * .2, p.y - radius * .3, radius * .12, 0, TAU); ctx.arc(p.x, p.y - radius * .05, radius * .12, 0, TAU); ctx.fill(); }
      if (kind === 'shuttle') { ctx.fillStyle = '#eeeae2'; ctx.beginPath(); ctx.moveTo(p.x, p.y + radius); ctx.lineTo(p.x - radius * 1.3, p.y - radius * 2); ctx.lineTo(p.x + radius * 1.3, p.y - radius * 2); ctx.closePath(); ctx.fill(); }
    }

    /* --------------------------------------------------- batting overlays */
    _battingOverlay(snapshot) {
      const bt = snapshot.batting; if (!bt) return;
      const z = bt.plateZ - 0.1, zone = bt.zone || { halfWidth: 0.32, bottom: 0.45, top: 1.15 }, ctx = this.ctx;
      const corners = [[-zone.halfWidth, zone.bottom, z], [zone.halfWidth, zone.bottom, z], [zone.halfWidth, zone.top, z], [-zone.halfWidth, zone.top, z]];
      this._polygon(corners, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.75)', 1.6);
      for (let i = 1; i < 3; i++) {
        const x = -zone.halfWidth + zone.halfWidth * 2 * i / 3, y = zone.bottom + (zone.top - zone.bottom) * i / 3;
        this._line([[x, zone.bottom, z], [x, zone.top, z]], 'rgba(255,255,255,.28)', .8); this._line([[-zone.halfWidth, y, z], [zone.halfWidth, y, z]], 'rgba(255,255,255,.28)', .8);
      }
      if (bt.stumps) for (const x of [-bt.stumps.halfWidth, 0, bt.stumps.halfWidth]) this._line([[x, 0, bt.stumps.z], [x, bt.stumps.height, bt.stumps.z]], '#f3e2b0', 3);
      // predicted crossing point (fades in as the pitch travels; hidden on hard until late)
      if (bt.pitch && bt.state === 'pitch') {
        const show = snapshot.difficulty === 'hard' ? bt.pitch.progress > 0.7 : snapshot.difficulty === 'normal' ? bt.pitch.progress > 0.35 : true;
        if (show) { const q = this.project(bt.pitch.crossX, bt.pitch.crossY, z); if (q) { ctx.strokeStyle = bt.pitch.inZone ? 'rgba(255,230,120,.9)' : 'rgba(255,120,120,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(6, q.scale * .09), 0, TAU); ctx.stroke(); } }
        // timing ring shrinks toward the plate marker
        const ring = this.project(0, (zone.top + zone.bottom) / 2, z);
        if (ring) { const rr = Math.max(8, ring.scale * (0.1 + (1 - bt.pitch.progress) * 0.9)); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(ring.x, ring.y, rr, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      }
      // bat contact cursor
      const cursor = this.project(bt.cursorX, bt.cursorY, z - 0.05);
      if (cursor) {
        const w = Math.max(10, cursor.scale * .34), h = Math.max(5, cursor.scale * .11);
        ctx.save(); ctx.translate(cursor.x, cursor.y); ctx.rotate(-0.35);
        ctx.fillStyle = bt.loaded ? 'rgba(255,220,90,.85)' : 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      }
      if (bt.lastContact && bt.state === 'hit') { const c = this.project(bt.lastContact.x, bt.lastContact.y, z); if (c) { ctx.fillStyle = 'rgba(255,240,150,.8)'; ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(3, c.scale * .05), 0, TAU); ctx.fill(); } }
    }

    /* --------------------------------------------------------------- render */
    render(snapshot, options) {
      options = options || {};
      if (!snapshot) return;
      if (!this.cssWidth || !this.cssHeight) this.resize();
      const ctx = this.ctx;
      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      this._setupCamera(snapshot, options);
      this._background(snapshot, options);
      const basketball = !snapshot.sport || snapshot.sport === 'basketball' || snapshot.sport === 'basketball5';
      if (basketball) this._court(snapshot); else this._sportField(snapshot);
      const players = snapshot.players || [];
      const swim = snapshot.fieldType === 'pool', table = snapshot.fieldType === 'table';
      if (!swim && !table) players.forEach(p => this._shadow(p.x, p.z, p.y || 0, 0.36));
      if (snapshot.ball && !table && !['marker', 'scored', 'holed'].includes(snapshot.ball.state)) this._shadow(snapshot.ball.x, snapshot.ball.z, snapshot.ball.y, 0.15);
      const objects = players.map(p => ({ type: 'player', value: p, depth: this.project(p.x, p.y || 0, p.z)?.depth || 0 }));
      if (basketball) {
        const hoops = snapshot.hoops || [snapshot.hoop || { x: 0, z: -6, y: 3.05 }];
        hoops.forEach(hoop => objects.push({ type: 'hoop', value: hoop, depth: this.project(hoop.x, 1.5, hoop.z)?.depth || 0 }));
      } else {
        for (const goal of snapshot.goals || []) objects.push({ type: 'goal', value: goal, depth: this.project(goal.x || 0, 1, goal.z)?.depth || 0 });
        if (snapshot.net) objects.push({ type: 'net', value: snapshot.net, depth: this.project(0, 1, snapshot.net.z || 0)?.depth || 0 });
        if (snapshot.target) objects.push({ type: 'target', value: snapshot.target, depth: this.project(snapshot.target.x, snapshot.target.y, snapshot.target.z)?.depth || 0 });
      }
      if (snapshot.ball) objects.push({ type: 'ball', value: snapshot.ball, depth: this.project(snapshot.ball.x, snapshot.ball.y, snapshot.ball.z)?.depth || 0 });
      objects.sort((a, b) => b.depth - a.depth);
      for (const item of objects) {
        if (item.type === 'player') this._player(item.value, snapshot, options);
        else if (item.type === 'hoop') this._hoop(item.value);
        else if (item.type === 'goal') this._goal(item.value, snapshot.sport);
        else if (item.type === 'net') this._net(item.value, snapshot);
        else if (item.type === 'target') this._target(item.value);
        else this._ball(item.value, snapshot.sport);
      }
      if (snapshot.family === 'batting' && !options.replay) this._battingOverlay(snapshot);
      this._weather(snapshot, options);
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
