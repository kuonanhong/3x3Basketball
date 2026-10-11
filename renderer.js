/* SmartAction Sports — original, dependency-free Canvas renderer.
 * Licensed place photographs are flat backdrops; courts and player animation are procedural. */
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

    _bounds(snapshot) {
      const b = snapshot.bounds || {};
      return { minX: Number.isFinite(b.minX) ? b.minX : -7.5,
        maxX: Number.isFinite(b.maxX) ? b.maxX : 7.5,
        minZ: Number.isFinite(b.minZ) ? b.minZ : -6.8,
        maxZ: Number.isFinite(b.maxZ) ? b.maxZ : 6.8 };
    }

    _setupCamera(snapshot, options) {
      const selectedId = options.selectedId === undefined ? snapshot.selectedId : options.selectedId;
      const focusId = options.replay && options.focusId !== undefined ? options.focusId : selectedId;
      const players = snapshot.players || [];
      const focus = players.find(p => p.id === focusId) || players[0];
      const b = this._bounds(snapshot);
      const zoom = Math.max(0.6, Math.min(1.8, Number(options.zoom) || 1));
      const angle = Number.isFinite(options.cameraAngle) ? options.cameraAngle : 0;
      const view = options.replay ? 'third' : (['first', 'close'].includes(options.view) && focus ? options.view : 'third');
      let target, eye;
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
      const aspect = this.cssWidth / this.cssHeight;
      const focal = view === 'first'
        ? Math.min(this.cssHeight, this.cssWidth) * 0.85 * zoom
        : Math.min(this.cssHeight * 1.35, this.cssWidth * 1.3);
      this._camera = { eye, target, view, focusId: focus && focus.id, fx, fy, fz, rx, rz, ux, uy, uz, focal,
        cx: this.cssWidth / 2, cy: this.cssHeight * (view === 'third' ? (aspect < 0.9 ? 0.43 : 0.47) : 0.48) };
    }

    // Clip world geometry at the near plane. First-person courts must remain visible
    // even when their back corners are behind the viewer.
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
      return {
        x: c.cx + (dx * c.rx + dz * c.rz) * scale,
        y: c.cy - (dx * c.ux + dy * c.uy + dz * c.uz) * scale,
        depth, scale
      };
    }

    _polygon(points, fill, stroke, width) {
      const projected = this._clipPolygon(points).map(p => this.project(p[0], p[1], p[2]));
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
      for (let i = 1; i < points.length; i++) {
        let a = points[i - 1], b = points[i];
        const da = this._depth(a), db = this._depth(b);
        if (da < near && db < near) continue;
        if (da < near || db < near) {
          const t = (near - da) / (db - da);
          const cut = a.map((v, k) => v + (b[k] - v) * t);
          if (da < near) a = cut; else b = cut;
        }
        const pa = this.project(a[0], a[1], a[2]), pb = this.project(b[0], b[1], b[2]);
        if (!pa || !pb) continue;
        visible = true; ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
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

    _background(snapshot, options) {
      const ctx = this.ctx, w = this.cssWidth, h = this.cssHeight;
      const env = options.environment || {}, time = env.time || 'day';
      const palettes = {
        day: ['#acddec', '#f4ead5', '#cbd6c4'], dawn: ['#929dc7', '#f8cab2', '#aaaeb2'],
        sunset: ['#9e8abd', '#f5b78e', '#bbb3a0'], night: ['#0b1730', '#314964', '#5a6967']
      };
      const palette = palettes[time] || palettes.day;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, palette[0]); sky.addColorStop(0.56, palette[1]); sky.addColorStop(1, palette[2]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      const photo = env.photo;
      if (photo && (photo.naturalWidth || photo.width) > 0 && (photo.naturalHeight || photo.height) > 0) {
        const pw = photo.naturalWidth || photo.width, ph = photo.naturalHeight || photo.height;
        const scale = Math.max(w / pw, h * 0.82 / ph);
        ctx.save(); ctx.globalAlpha = 0.78;
        try { ctx.drawImage(photo, (w - pw * scale) / 2, (h * 0.82 - ph * scale) / 2, pw * scale, ph * scale); } catch (_) {}
        ctx.restore();
        ctx.fillStyle = time === 'night' ? 'rgba(9,18,40,.62)' : time === 'sunset' ? 'rgba(214,106,53,.18)' : 'rgba(194,227,240,.08)';
        ctx.fillRect(0, 0, w, h);
      } else if (time !== 'night') {
        ctx.fillStyle = time === 'day' ? '#fff4c3' : '#ffe0ab';
        ctx.beginPath(); ctx.arc(w * 0.78, h * (time === 'day' ? 0.12 : 0.3), 18, 0, TAU); ctx.fill();
      }
      const b = this._bounds(snapshot), ext = Math.max(42, Math.abs(b.maxZ) + 25);
      const ground = env.season === 'winter' || env.climate === 'polar' ? '#dce4e4' :
        env.climate === 'arid' ? '#d4bc92' : env.season === 'autumn' ? '#b4b78d' : palette[2];
      this._polygon([[-ext, -0.045, -ext], [ext, -0.045, -ext], [ext, -0.045, ext], [-ext, -0.045, ext]], ground);
      if (!PRESETS[this.quality].scenery) { this._audience(snapshot, options); return; }
      if (!photo) this._buildings.slice().sort((a, b) => (this.project(b.x, 0, b.z)?.depth || 0) - (this.project(a.x, 0, a.z)?.depth || 0))
        .forEach(building => {
          const shiftedZ = building.z - Math.max(0, Math.abs(b.minZ) - 7);
          this._box(building.x, shiftedZ, building.w, building.d, building.h,
            [time === 'night' ? '#3c5064' : building.c, '#82989e', '#b4c7cb']);
        });
      const trees = [[b.minX-3,b.minZ-2],[b.minX-3,0],[b.minX-3,b.maxZ],[b.maxX+3,b.maxZ],[b.maxX+3,0],[b.maxX+3,b.minZ-2]];
      trees.sort((a, b) => (this.project(b[0], 0, b[1])?.depth || 0) - (this.project(a[0], 0, a[1])?.depth || 0));
      for (const [x, z] of trees) {
        const trunk = this.project(x, 1, z), crown = this.project(x, 3.3, z);
        if (!trunk || !crown) continue;
        this._line([[x, 0, z], [x, 3, z]], '#998065', Math.max(2, trunk.scale * 0.13));
        ctx.fillStyle = env.season === 'autumn' ? '#b77949' : env.season === 'winter' ? '#cadbd0' : time === 'night' ? '#294b48' : '#80aa8c';
        ctx.beginPath(); ctx.ellipse(crown.x, crown.y, crown.scale * 0.83, crown.scale * 1.04, 0, 0, TAU); ctx.fill();
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
        this._box((b.minX + b.maxX) / 2, z, b.maxX - b.minX + 3, 2.4, 0.8, ['#5d6d7d','#435462','#7e8b95']);
        for (let row = rows - 1; row >= 0; row--) for (let i = 0; i < segments; i++) {
          const x = b.minX + (b.maxX - b.minX) * (i + 0.5) / segments;
          const wave = Math.sin(clock * 3 + i * 0.87 + row * 1.7) * 0.1;
          const p = this.project(x, 1.1 + row * 0.38 + wave, z + side * row * 0.5);
          if (!p) continue;
          const r = Math.min(9, Math.max(1.4, p.scale * 0.14));
          this.ctx.fillStyle = i % 4 === 0 ? '#ecd2af' : TEAM_COLORS[(env.venue === 'away' ? 1 : 0) ^ (i % 5 === 0 ? 1 : 0)];
          this.ctx.fillRect(p.x-r, p.y, r*2, r*2.3);
          this.ctx.fillStyle = '#d8b18c'; this.ctx.beginPath(); this.ctx.arc(p.x, p.y-r*0.55, r*0.72, 0, TAU); this.ctx.fill();
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
          if (env.weather === 'rain') { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-3,y+12); ctx.stroke(); }
          else { ctx.beginPath(); ctx.arc(x + Math.sin(clock + i)*6,y,1.5+(i%3)*0.5,0,TAU); ctx.fill(); }
        }
      }
      if (env.weather === 'fog') { ctx.fillStyle = 'rgba(214,225,229,.27)'; ctx.fillRect(0, 0, w, h); }
      if (env.time === 'night') { ctx.fillStyle = 'rgba(7,17,37,.12)'; ctx.fillRect(0, 0, w, h); }
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

    _sportField(snapshot) {
      const b = this._bounds(snapshot), sport = snapshot.sport || 'basketball';
      const white = '#f4f7e9', cy = 0.026, mx = (b.minX+b.maxX)/2;
      const netSport = /tennis|badminton|volleyball/.test(sport);
      const surface = sport === 'ice-hockey' ? '#dbeff2' : sport === 'baseball' ? '#759762' :
        sport === 'sprint' ? '#c57561' : netSport ? (sport.includes('table') ? '#557fa3' : '#6496a0') : '#619368';
      this._polygon([[b.minX-1,0,b.minZ-1],[b.maxX+1,0,b.minZ-1],[b.maxX+1,0,b.maxZ+1],[b.minX-1,0,b.maxZ+1]], '#c4c8b4');
      this._polygon([[b.minX,0.008,b.minZ],[b.maxX,0.008,b.minZ],[b.maxX,0.008,b.maxZ],[b.minX,0.008,b.maxZ]],surface);
      const outline = [[b.minX,cy,b.minZ],[b.maxX,cy,b.minZ],[b.maxX,cy,b.maxZ],[b.minX,cy,b.maxZ],[b.minX,cy,b.minZ]];
      this._line(outline,white,1.8);
      if (sport === 'baseball') {
        const z = b.maxZ-1.2, step = Math.min(5,(b.maxX-b.minX)*0.4);
        const bases = [[mx,cy,z],[mx+step,cy,z-step],[mx,cy,z-step*2],[mx-step,cy,z-step]];
        this._polygon(bases,'#bd9770',white,1.6);
        this._line([[b.minX,cy,b.minZ],[mx,cy,z],[b.maxX,cy,b.minZ]],white,1.4);
        for (const [x,y,z0] of bases) this._polygon([[x-.18,y+.01,z0-.18],[x+.18,y+.01,z0-.18],[x+.18,y+.01,z0+.18],[x-.18,y+.01,z0+.18]],white);
        this._circle(mx,cy+.01,z-step,0.5,'#dcc4a0');
      } else if (sport === 'sprint') {
        const lanes = Math.max(3, Math.min(8, Math.round((b.maxX-b.minX)/1.2)));
        for (let i=1;i<lanes;i++) {
          const x = b.minX + (b.maxX-b.minX)*i/lanes;
          this._line([[x,cy,b.minZ],[x,cy,b.maxZ]],white,1.4);
        }
        const finish = snapshot.finishZ === undefined ? b.minZ+1 : snapshot.finishZ;
        this._line([[b.minX,cy,finish],[b.maxX,cy,finish]],'#fff',4);
      } else if (sport === 'archery') {
        this._line([[b.minX,cy,b.maxZ-2],[b.maxX,cy,b.maxZ-2]],white,2);
        for (let i=0;i<4;i++) this._line([[mx-.35,cy,b.maxZ-i*3],[mx+.35,cy,b.maxZ-i*3]],white,1.4);
      } else if (netSport) {
        this._line([[b.minX,cy,0],[b.maxX,cy,0]],white,1.8);
        for (const side of [-1,1]) {
          const z = side*(sport.includes('table') ? 1.5 : (b.maxZ-b.minZ)*.25);
          this._line([[b.minX,cy,z],[b.maxX,cy,z]],white,1.5);
          this._line([[mx,cy,0],[mx,cy,z]],white,1.5);
        }
        if (!sport.includes('doubles') && !sport.includes('table')) {
          const inset = (b.maxX-b.minX)*.085;
          for (const x of [b.minX+inset,b.maxX-inset]) this._line([[x,cy,b.minZ],[x,cy,b.maxZ]],white,1.2);
        }
      } else {
        this._line([[b.minX,cy,0],[b.maxX,cy,0]],white,1.7);
        this._circle(mx,cy+.01,0,Math.min(2.5,(b.maxX-b.minX)*.18),null,white,1.5);
        if (['american-football','rugby'].includes(sport)) {
          for(let i=1;i<10;i++) {
            const z=b.minZ+(b.maxZ-b.minZ)*i/10;
            this._line([[b.minX,cy,z],[b.maxX,cy,z]],white,1);
          }
          this._polygon([[b.minX,cy,b.minZ],[b.maxX,cy,b.minZ],[b.maxX,cy,b.minZ+2.2],[b.minX,cy,b.minZ+2.2]],'rgba(53,91,131,.4)');
          this._polygon([[b.minX,cy,b.maxZ-2.2],[b.maxX,cy,b.maxZ-2.2],[b.maxX,cy,b.maxZ],[b.minX,cy,b.maxZ]],'rgba(182,71,53,.35)');
        } else {
          for (const side of [-1,1]) {
            const z=side<0?b.minZ:b.maxZ, inside=z-side*Math.min(4,(b.maxZ-b.minZ)*.2);
            this._line([[mx-3,cy,z],[mx-3,cy,inside],[mx+3,cy,inside],[mx+3,cy,z]],white,1.5);
          }
        }
      }
    }

    _goal(goal, sport) {
      const x = goal.x || 0, z = goal.z, width = goal.width || 3, h = goal.height || 2;
      if (sport === 'american-football' || sport === 'rugby') {
        this._line([[x,0,z],[x,2,z]],'#e4db80',4);
        this._line([[x-width/2,4.7,z],[x-width/2,2,z],[x+width/2,2,z],[x+width/2,4.7,z]],'#f4dc81',3);
        return;
      }
      const back = z+(z<0?-1:1)*.8;
      this._polygon([[x-width/2,0,back],[x+width/2,0,back],[x+width/2,h,back],[x-width/2,h,back]],'rgba(241,251,251,.22)');
      const segments = this.quality === 'lite' ? 4 : 8;
      for (let i=0;i<=segments;i++) {
        const xx=x-width/2+width*i/segments;
        this._line([[xx,0,back],[xx,h,back]],'rgba(241,251,251,.6)',.7);
      }
      for(let i=1;i<=4;i++) this._line([[x-width/2,h*i/4,back],[x+width/2,h*i/4,back]],'rgba(241,251,251,.6)',.7);
      this._line([[x-width/2,0,z],[x-width/2,h,z],[x+width/2,h,z],[x+width/2,0,z]],'#faf4e5',3.5);
      for(const side of [-1,1]) this._line([[x+side*width/2,h,z],[x+side*width/2,h,back],[x+side*width/2,0,back]],'#e7edf0',2);
    }

    _net(net, snapshot) {
      const b=this._bounds(snapshot), z=net.z || 0, h=net.height || 1;
      const low = snapshot.sport === 'volleyball' ? Math.max(.7,h-.95) : .15;
      this._polygon([[b.minX,low,z],[b.maxX,low,z],[b.maxX,h,z],[b.minX,h,z]],'rgba(224,240,239,.2)');
      for(const x of [b.minX,b.maxX]) this._line([[x,0,z],[x,h+.1,z]],'#f0e7dc',3);
      this._line([[b.minX,h,z],[b.maxX,h,z]],'#faf7e8',3);
      const count=this.quality==='lite'?8:16;
      for(let i=1;i<count;i++) {
        const x=b.minX+(b.maxX-b.minX)*i/count;
        this._line([[x,low,z],[x,h,z]],'rgba(237,244,242,.65)',.7);
      }
      this._line([[b.minX,(h+low)/2,z],[b.maxX,(h+low)/2,z]],'rgba(237,244,242,.65)',.7);
    }

    _target(target) {
      for (const [factor,color] of [[1,'#f6f4e7'],[.8,'#333e48'],[.6,'#4d9acb'],[.4,'#df6360'],[.2,'#f5ce48']]) {
        const points=[],radius=(target.radius||1.2)*factor;
        for(let i=0;i<=24;i++) { const a=i*TAU/24; points.push([target.x+Math.cos(a)*radius,target.y+Math.sin(a)*radius,target.z]); }
        this._polygon(points,color);
      }
      this._line([[target.x-.65,0,target.z+.3],[target.x,target.y,target.z],[target.x+.65,0,target.z+.3]],'#745842',2);
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
      if (this._camera.view === 'first' && p.id === this._camera.focusId) return;
      const x=p.x, z=p.z, y=p.y||0, height=Math.max(1.35,Math.min(2.5,(p.heightCm||180)/100));
      const size=height/1.8, weight=Math.max(.84,Math.min(1.18,Math.sqrt((p.weightKg||82)/82)));
      const pivot=this.project(x,y+size*.9,z);
      if(!pivot) return;
      const ctx=this.ctx, angle=Number.isFinite(p.angle)?p.angle:Math.PI;
      const torso=Number.isFinite(p.torsoAngle)?p.torsoAngle:angle;
      const sideX=Math.cos(torso),sideZ=-Math.sin(torso),frontX=Math.sin(angle),frontZ=Math.cos(angle);
      const armAngle=Number.isFinite(p.armAngle)?p.armAngle:torso,armX=Math.sin(armAngle),armZ=Math.cos(armAngle);
      const speed=Math.min(1,Math.hypot(p.vx||0,p.vz||0)/3.8), phase=(snapshot.clock||0)*10+(Number(p.id)||0)*.83;
      const stride=Math.sin(phase)*.24*speed*size,action=String(p.action||'');
      const raised=/jump|block|shoot|dunk|layup/.test(action)||y>.22,crouching=/crouch/.test(action);
      const shoulderAngle=snapshot.sport==='baseball'?Math.max(-.8,Math.min(.8,Number(p.shoulderAngle)||0)):0;
      const shoulderLift=Math.sin(shoulderAngle)*.48;
      const waistY=(crouching?.62:.86)*size,shoulderY=(crouching?1.08:1.36)*size,headY=(crouching?1.38:1.68)*size;
      const color=TEAM_COLORS[p.team===1||p.team==='away'?1:0];
      const skin=['#d7a47e','#a97753','#efc7a5'][Math.abs(Number(p.id)||0)%3];
      const clothWidth=Math.min(45,Math.max(3,pivot.scale*.13*size*weight));
      const selectedId=options.selectedId===undefined?snapshot.selectedId:options.selectedId;
      const highlighted=options.replay&&options.focusId!==undefined?p.id===options.focusId:p.id===selectedId;
      if(highlighted) {
        this._circle(x,.055,z,.54,null,p.team===1?'#ff806d':'#0d887d',Math.max(1.5,pivot.scale*.055));
        if(!options.replay) {
          const marker=this.project(x,y+headY+.4,z);
          if(marker) { ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(marker.x-5,marker.y-3);ctx.lineTo(marker.x+5,marker.y-3);ctx.lineTo(marker.x,marker.y+4);ctx.closePath();ctx.fill(); }
        }
      }
      for(const side of [-1,1]) {
        const hip=[x+sideX*.115*side*size,y+waistY,z+sideZ*.115*side*size];
        const knee=[x+sideX*.13*side*size+frontX*stride*side,y+waistY*.52,z+sideZ*.13*side*size+frontZ*stride*side];
        const foot=[x+sideX*.13*side*size-frontX*stride*side,y+.08,z+sideZ*.13*side*size-frontZ*stride*side];
        this._line([hip,knee,foot],skin,clothWidth);this._line([hip,knee],'#294951',clothWidth*1.23);
        this._line([foot,[foot[0]+frontX*.16,foot[1],foot[2]+frontZ*.16]],'#fff9ef',clothWidth*.9);
      }
      const sw=.19*size*weight,left=[x-sideX*sw,y+shoulderY,z-sideZ*sw],right=[x+sideX*sw,y+shoulderY,z+sideZ*sw];
      this._polygon([left,right,[x+sideX*.14*size,y+waistY,z+sideZ*.14*size],[x-sideX*.14*size,y+waistY,z-sideZ*.14*size]],color);
      this._line([[x,y+waistY+.12*size,z],[x,y+shoulderY-.04*size,z]],color,Math.max(4,pivot.scale*.29*size*weight));
      let equipmentHand;
      for(const side of [-1,1]) {
        const shoulder=side===-1?left:right;
        const swing=/swing|racket|kick|throw/.test(action)?Math.sin(Math.min(1,p.actionTime||.5)*Math.PI):0;
        const elbow=[x+sideX*.29*side*size+armX*.13,y+((raised?1.63:1.02)+shoulderLift*.55)*size,z+sideZ*.29*side*size+armZ*.13];
        const reach=raised?.11:.37+swing*.2;
        const hand=[x+sideX*(raised?.2:.3)*side*size+armX*reach,y+((raised?1.98:.95+Math.sin(phase+side)*speed*.09+swing*.15)+shoulderLift)*size,z+sideZ*(raised?.2:.3)*side*size+armZ*reach];
        this._line([shoulder,elbow,hand],skin,clothWidth*.8);
        if(side===1) equipmentHand=hand;
      }
      const head=this.project(x,y+headY,z);
      if(head) {
        const r=Math.min(70,Math.max(2.3,head.scale*.155*size));
        ctx.fillStyle=skin;ctx.beginPath();ctx.arc(head.x,head.y,r,0,TAU);ctx.fill();
        const portrait=options.portraits&&options.portraits[p.athleteId];
        if(portrait&&(portrait.naturalWidth||portrait.width)>0) {
          const iw=portrait.naturalWidth||portrait.width,ih=portrait.naturalHeight||portrait.height;
          // These are licensed portrait billboards, not a reconstructed or branded 3D likeness.
          if(ih>0) { ctx.save();ctx.beginPath();ctx.arc(head.x,head.y,r,0,TAU);ctx.clip();
            const crop=Math.min(iw,ih);try {ctx.drawImage(portrait,(iw-crop)/2,0,crop,crop,head.x-r,head.y-r,r*2,r*2);}catch(_){}ctx.restore(); }
        } else {
          ctx.fillStyle='#354047';ctx.beginPath();ctx.ellipse(head.x,head.y-r*.52,r*.92,r*.58,0,Math.PI,TAU);ctx.fill();
        }
      }
      if(equipmentHand) this._equipment(equipmentHand,armAngle,snapshot.sport,action,shoulderAngle);
      if(options.labels!==false&&this.quality!=='lite') {
        const label=this.project(x,y+1.21*size,z-.06);
        if(label) {ctx.font=`800 ${Math.max(8,Math.min(35,label.scale*.2))}px system-ui, sans-serif`;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(p.number===undefined?Number(p.id)+1:p.number),label.x,label.y);}
      }
    }

    _equipment(hand,angle,sport,action,shoulderAngle=0) {
      const dx=Math.sin(angle),dz=Math.cos(angle);
      if(sport==='baseball') {
        const lift=(/swing/.test(action)?0.05:.7)+Math.sin(shoulderAngle)*.8;
        const reach=.95*Math.cos(shoulderAngle);
        this._line([hand,[hand[0]+dx*reach,hand[1]+lift,hand[2]+dz*reach]],'#d7b77e',5);
      } else if(/tennis|badminton/.test(sport||'')) {
        const end=[hand[0]+dx*.55,hand[1]+.16,hand[2]+dz*.55];
        this._line([hand,end],'#293b51',2);
        const points=[],r=sport.includes('table')?.17:.27;
        for(let i=0;i<=16;i++) {const a=i*TAU/16;points.push([end[0]+Math.cos(angle)*Math.cos(a)*r,end[1]+Math.sin(a)*r*1.25,end[2]-Math.sin(angle)*Math.cos(a)*r]);}
        this._polygon(points,sport.includes('table')?'#c64a48':'rgba(239,246,241,.25)','#e9f1eb',1.7);
      } else if(sport==='ice-hockey') {
        const end=[hand[0]+dx*.7,.08,hand[2]+dz*.7];
        this._line([hand,end,[end[0]+dx*.45,.08,end[2]+dz*.45]],'#665a4c',3);
      } else if(sport==='archery') {
        const center=[hand[0]+dx*.3,hand[1]+.2,hand[2]+dz*.3];
        this._line([[center[0],center[1]-.55,center[2]],[center[0]+dx*.18,center[1],center[2]+dz*.18],[center[0],center[1]+.55,center[2]]],'#a28662',2.5);
        this._line([[center[0],center[1]-.55,center[2]],[center[0],center[1]+.55,center[2]]],'#eef0dd',1);
      }
    }

    _ball(ball, sport) {
      const p=this.project(ball.x,ball.y||0,ball.z);
      if(!p) return;
      const ctx=this.ctx,kind=ball.kind||sport||'basketball';
      const radius=Math.min(60,Math.max(2.8,p.scale*(ball.radius||(/tennis|baseball/.test(kind)?.065:.14))));
      if(kind==='arrow') {
        this._line([[ball.x,ball.y,ball.z],[ball.x-(ball.vx||0)*.025,ball.y-(ball.vy||0)*.025,ball.z-(ball.vz||0)*.025]],'#e6cf80',2);return;
      }
      const color=kind==='puck'?'#23323c':kind==='tennis'?'#dbe647':/shuttle|baseball|soccer|volleyball|tabletennis|badminton/.test(kind)?'#f7f7ef':kind==='oval'?'#a87247':'#ed7c31';
      ctx.fillStyle=color;ctx.beginPath();
      if(kind==='puck'||kind==='oval')ctx.ellipse(p.x,p.y,radius*(kind==='oval'?1.45:1.2),radius*(kind==='puck'?.4:.8),kind==='oval'?-.25:0,0,TAU);
      else ctx.arc(p.x,p.y,radius,0,TAU);
      ctx.fill();ctx.strokeStyle=kind==='soccer'?'#3e4955':'#765744';ctx.lineWidth=Math.max(.65,radius*.08);ctx.stroke();
      if(kind==='soccer') {ctx.fillStyle='#35424b';ctx.beginPath();ctx.arc(p.x,p.y,radius*.4,0,TAU);ctx.fill();}
      else if(!['puck','tennis','shuttle','arrow'].includes(kind)) {
        ctx.beginPath();ctx.moveTo(p.x-radius*.75,p.y);ctx.lineTo(p.x+radius*.75,p.y);ctx.stroke();
        ctx.beginPath();ctx.ellipse(p.x,p.y,radius*.4,radius,0.23,0,TAU);ctx.stroke();
      }
      if(kind==='shuttle') {ctx.fillStyle='#eeeae2';ctx.beginPath();ctx.moveTo(p.x,p.y+radius);ctx.lineTo(p.x-radius*1.3,p.y-radius*2);ctx.lineTo(p.x+radius*1.3,p.y-radius*2);ctx.closePath();ctx.fill();}
    }

    render(snapshot, options) {
      options = options || {};
      if (!snapshot) return;
      if (!this.cssWidth || !this.cssHeight) this.resize();
      const ctx = this.ctx;
      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      this._setupCamera(snapshot, options);
      this._background(snapshot, options);
      const basketball = !snapshot.sport || snapshot.sport === 'basketball';
      if (basketball) this._court(); else this._sportField(snapshot);
      const players = snapshot.players || [];
      players.forEach(p => this._shadow(p.x, p.z, p.y || 0, 0.36));
      if (snapshot.ball) this._shadow(snapshot.ball.x, snapshot.ball.z, snapshot.ball.y, 0.15);
      const objects = players.map(p => ({ type: 'player', value: p, depth: this.project(p.x, p.y || 0, p.z)?.depth || 0 }));
      if (basketball) {
        const hoop = snapshot.hoop || { x: 0, z: -6, y: 3.05 };
        objects.push({ type: 'hoop', value: hoop, depth: this.project(hoop.x, 1.5, hoop.z)?.depth || 0 });
      } else {
        for(const goal of snapshot.goals || []) objects.push({ type:'goal', value:goal, depth:this.project(goal.x||0,1,goal.z)?.depth||0 });
        if(snapshot.net) objects.push({type:'net',value:snapshot.net,depth:this.project(0,1,snapshot.net.z||0)?.depth||0});
        if(snapshot.target) objects.push({type:'target',value:snapshot.target,depth:this.project(snapshot.target.x,snapshot.target.y,snapshot.target.z)?.depth||0});
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
