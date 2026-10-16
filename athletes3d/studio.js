/* SmartAction Sports — 3D star studio: pick a basketball or baseball star, watch the signature move in 360°,
   slow it down, drag to look around, record it to a video file. Runs entirely in the browser. MIT. */
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { Stage3D, signatureMove, movesFor } from './stage3d.js';
import { drawOverlay } from './overlay.js';
import { bodyProfile } from './rig.js';

const $ = id => document.getElementById(id);
const L = window.SAHoopsI18n, catalog = window.SASportsData;
const supported = L.languages.map(l => l.code);
let lang = 'en';
const t = k => (L.messages[lang] && L.messages[lang][k]) || L.messages.en[k] || k;
function chooseLanguage(raw) {
  if (!raw) return null; if (supported.includes(raw)) return raw;
  const v = String(raw).toLowerCase();
  if (v.startsWith('zh')) return /hant|tw|hk|mo/.test(v) ? 'zh-Hant' : 'zh-Hans';
  if (v.startsWith('no') || v.startsWith('nn')) return 'nb'; if (v.startsWith('tl')) return 'fil'; if (v.startsWith('pt')) return 'pt';
  const s = v.split('-')[0]; return supported.includes(s) ? s : null;
}
function regionLanguage() { try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; const hit = L.languages.find(l => (l.tz || []).includes(z)); return hit ? hit.code : null; } catch (_) { return null; } }
const store = { get(k, d) { try { return localStorage.getItem(k) || d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} } };
async function setLanguage(code) {
  lang = supported.includes(code) ? code : 'en';
  if (!L.messages[lang]) { try { const r = await fetch(new URL('../i18n/' + lang + '.json', import.meta.url), { credentials: 'omit' }); if (r.ok) L.messages[lang] = await r.json(); } catch (_) {} }
  const meta = L.languages.find(l => l.code === lang); document.documentElement.lang = lang; document.documentElement.dir = meta && meta.dir === 'rtl' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.title = t('s3d_title') + ' · SmartAction Sports';
  renderList(); renderMoves(); renderCard();
}

/* ------------------------------------------------------------------ state */
const params = new URLSearchParams(location.search);
const pool = s => catalog.athletes.filter(a => a.sport === s);
let athlete = catalog.athletes.find(a => a.id === params.get('id') && (a.sport === 'basketball' || a.sport === 'baseball')) || catalog.athletes.find(a => a.id === 'michael-jordan');
let sport = athlete.sport, moveId = params.get('move') || signatureMove(athlete), uniform = store.get('sa-3d-uniform', 'teal');
let time = 0, playing = true, speed = 1, autoOrbit = true, angle = 35, zoom = 1, last = performance.now(), recording = null;
const localName = a => (lang.startsWith('zh') && a.nameZh) ? a.nameZh : a.name;
const initials = a => String(a.name).split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
const posLabel = a => a.position ? t('pos_' + (a.position === 'C' && a.sport === 'basketball' ? 'C' : a.position)) : '';

/* ------------------------------------------------------------------ 3D */
const canvas = $('view'), st = new Stage3D(canvas, {});
const controls = new OrbitControls(st.camera, canvas); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 2.2; controls.maxDistance = 40; controls.maxPolarAngle = Math.PI * 0.49;
controls.enabled = true;
controls.addEventListener('start', () => { if (autoOrbit) setOrbit(false); });
function setOrbit(on) {
  autoOrbit = on; $('orbit').setAttribute('aria-pressed', on ? 'true' : 'false');
  if (on) { const d = st.camera.position.clone().sub(st.focus); angle = Math.atan2(d.x, d.z) * 180 / Math.PI - (st.baseHeading || 0); }
}
function load() {
  st.load(athlete, moveId, uniform); moveId = st.moveId; time = 0; angle = st.move.orbit ? st.move.orbit.base : 35;
  st.placeCamera(angle, zoom); controls.target.copy(st.focus);
  history.replaceState(null, '', '?id=' + athlete.id + '&move=' + moveId + (params.get('lang') ? '&lang=' + params.get('lang') : ''));
  renderList(); renderMoves(); renderCard();
}
function resize() {
  const r = $('viewport').getBoundingClientRect(); if (recording) return;
  st.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); st.resize(Math.max(320, r.width), Math.max(240, r.height));
}
new ResizeObserver(resize).observe($('viewport'));
const prevFocus = new THREE.Vector3();
function loop(now) {
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  const hold = st.move.hold || 0.6, cycle = st.duration + hold;
  if (playing) { time += dt * speed; if (time > cycle) { time = 0; if (recording) { finishRecording(); } } }
  prevFocus.copy(st.focus); st.frame(Math.min(time, st.duration));
  const orb = st.move.orbit;
  if (autoOrbit) {
    if (orb) angle = orb.base + orb.sweep * Math.sin(time / cycle * Math.PI * 2);
    else angle += dt * speed * 360 / cycle * (recording ? 1 : 0.55);
    st.placeCamera(angle, zoom); controls.target.copy(st.focus);
  } else {
    st.camera.position.add(st.focus.clone().sub(prevFocus)); controls.target.copy(st.focus); controls.update();
  }
  st.render();
  $('progress').style.width = (Math.min(1, time / st.duration) * 100).toFixed(1) + '%';
  if (recording) { const x = recording.cx; x.drawImage(canvas, 0, 0, 1280, 720); drawOverlay(x, 1280, 720, overlayInfo(), Math.min(1, time / 0.3)); }
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------------ recording */
function overlayInfo() {
  const p = bodyProfile(athlete, sport), sub = [posLabel(athlete), athlete.heightCm ? athlete.heightCm + ' cm' : '', athlete.weightKg ? athlete.weightKg + ' kg' : '', sport === 'baseball' ? (t('bats') + ' ' + p.bats + ' / ' + t('throws') + ' ' + p.throws) : ''].filter(Boolean).join(' · ');
  const name = localName(athlete) + (localName(athlete) !== athlete.name ? '  ' + athlete.name : '');
  return { title: name, number: athlete.appearance && athlete.appearance.jerseyNumber != null ? String(athlete.appearance.jerseyNumber) : '', sub, move: t('s3d_move') + ': ' + t('mv_' + moveId), note: t('s3d_videoNote') };
}
function record() {
  if (recording) { finishRecording(); return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast(t('s3d_noRecord')); return; }
  const comp = document.createElement('canvas'); comp.width = 1280; comp.height = 720;
  const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  let rec; try { rec = new MediaRecorder(comp.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : {}); } catch (_) { toast(t('s3d_noRecord')); return; }
  const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    const type = rec.mimeType || mime || 'video/webm', blob = new Blob(chunks, { type }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'SmartAction3D-' + athlete.id + '-' + moveId + (/mp4/.test(type) && /avc1/.test(type) ? '.mp4' : '.webm'); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(t('s3d_saved'));
  };
  st.renderer.setPixelRatio(1); st.resize(1280, 720); canvas.style.objectFit = 'contain';
  recording = { rec, comp, cx: comp.getContext('2d') }; time = 0; playing = true; setOrbit(true); angle = st.move.orbit ? st.move.orbit.base : 35;
  $('play').setAttribute('aria-pressed', 'true'); $('record').classList.add('on'); $('record').textContent = t('s3d_recording'); rec.start();
}
function finishRecording() {
  if (!recording) return; const r = recording; recording = null; try { r.rec.stop(); } catch (_) {}
  canvas.style.objectFit = ''; $('record').classList.remove('on'); $('record').textContent = t('s3d_record'); resize();
}
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600); }

/* ------------------------------------------------------------------ panel */
function renderList() {
  $('tabBasketball').setAttribute('aria-selected', sport === 'basketball' ? 'true' : 'false'); $('tabBaseball').setAttribute('aria-selected', sport === 'baseball' ? 'true' : 'false');
  const host = $('list'); host.replaceChildren();
  for (const a of pool(sport)) {
    const b = document.createElement('button'); b.type = 'button'; if (a.id === athlete.id) b.setAttribute('aria-current', 'true');
    if (a.photo) { const im = document.createElement('img'); im.src = new URL('../' + a.photo, import.meta.url).href; im.alt = ''; im.loading = 'lazy'; b.append(im); } else { const s = document.createElement('span'); s.className = 'ini'; s.textContent = initials(a); b.append(s); }
    const tx = document.createElement('span'); const nb = document.createElement('b'); nb.textContent = localName(a); const sm = document.createElement('small'); sm.textContent = [posLabel(a), t('mv_' + signatureMove(a))].filter(Boolean).join(' · ');
    tx.append(nb, sm); b.append(tx); b.addEventListener('click', () => { athlete = a; moveId = signatureMove(a); load(); if (window.innerWidth < 900) $('viewport').scrollIntoView({ behavior: 'smooth' }); });
    host.append(b);
  }
}
function renderMoves() {
  const sel = $('move'); sel.replaceChildren(); const sig = signatureMove(athlete);
  for (const m of movesFor(athlete)) { const o = document.createElement('option'); o.value = m; o.textContent = (m === sig ? '★ ' : '') + t('mv_' + m); sel.append(o); }
  sel.value = moveId;
  const u = $('uniform'); for (const o of u.options) o.textContent = t('s3d_' + o.value); u.value = uniform;
}
function renderCard() {
  const a = athlete, card = $('card'); card.replaceChildren(); const p = bodyProfile(a, sport);
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  if (a.photo) { const im = el('img'); im.src = new URL('../' + a.photo, import.meta.url).href; im.alt = a.name; card.append(im); }
  card.append(el('h2', localName(a) + (localName(a) !== a.name ? ' · ' + a.name : '') + (a.appearance && a.appearance.jerseyNumber != null ? '  #' + a.appearance.jerseyNumber : '')));
  card.append(el('p', [posLabel(a), a.country, a.era].filter(Boolean).join(' · ')));
  card.append(el('p', t('height') + ': ' + (a.heightCm ? a.heightCm + ' cm' : t('notAvailable')) + ' · ' + t('weight') + ': ' + (a.weightKg ? a.weightKg + ' kg' : t('notAvailable')) + (sport === 'baseball' ? ' · ' + t('bats') + ' ' + p.bats + ' / ' + t('throws') + ' ' + p.throws : '')));
  card.append(el('p', t('s3d_move') + ': ' + t('mv_' + signatureMove(a)), 'mv'));
  if (a.notes) card.append(el('p', t('famousFor') + ': ' + a.notes));
  for (const k of ['speed', 'skill', 'power', 'defense', 'accuracy']) { const v = a.gameRatings && a.gameRatings[k]; if (v == null) continue; const r = el('div', undefined, 'rating'); r.append(el('span', t(k))); const m = el('meter'); m.min = 0; m.max = 100; m.value = v; r.append(m, el('b', String(v))); card.append(r); }
  if (a.credit) { const c = el('p', undefined, 'fine'); c.append(document.createTextNode('📷 ' + (a.credit.author || '') + ' · ')); const l = el('a', a.credit.license || 'license'); l.href = a.credit.licenseUrl || a.credit.sourceUrl || '#'; l.target = '_blank'; l.rel = 'noopener noreferrer'; c.append(l); card.append(c); }
  // name card on the stage
  const nc = $('namecard'); nc.replaceChildren();
  if (a.photo) { const im = el('img'); im.src = new URL('../' + a.photo, import.meta.url).href; im.alt = ''; nc.append(im); } else nc.append(el('span', initials(a), 'ini'));
  const tx = el('div'); tx.append(el('strong', localName(a)), el('span', [posLabel(a), a.heightCm ? a.heightCm + ' cm' : '', a.weightKg ? a.weightKg + ' kg' : ''].filter(Boolean).join(' · ')), el('span', t('mv_' + moveId), 'mv')); nc.append(tx);
}

/* ------------------------------------------------------------------ wiring */
$('tabBasketball').addEventListener('click', () => { if (sport === 'basketball') return; sport = 'basketball'; athlete = pool(sport).find(a => a.id === 'michael-jordan') || pool(sport)[0]; moveId = signatureMove(athlete); load(); });
$('tabBaseball').addEventListener('click', () => { if (sport === 'baseball') return; sport = 'baseball'; athlete = pool(sport).find(a => a.id === 'shohei-ohtani') || pool(sport)[0]; moveId = signatureMove(athlete); load(); });
$('move').addEventListener('change', e => { moveId = e.target.value; load(); });
$('uniform').addEventListener('change', e => { uniform = e.target.value; store.set('sa-3d-uniform', uniform); load(); });
$('play').addEventListener('click', () => { playing = !playing; $('play').setAttribute('aria-pressed', playing ? 'true' : 'false'); $('play').textContent = t(playing ? 'pause' : 's3d_play'); });
$('restart').addEventListener('click', () => { time = 0; playing = true; $('play').setAttribute('aria-pressed', 'true'); $('play').textContent = t('pause'); });
$('speed').addEventListener('change', e => { speed = Number(e.target.value) || 1; });
$('orbit').addEventListener('click', () => setOrbit(!autoOrbit));
$('record').addEventListener('click', record);
canvas.addEventListener('wheel', e => { if (autoOrbit) { zoom = Math.max(0.5, Math.min(2.6, zoom * (e.deltaY > 0 ? 0.92 : 1.08))); e.preventDefault(); } }, { passive: false });
document.addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); $('play').click(); } });
const langSel = $('lang'); L.languages.forEach(l => { const o = document.createElement('option'); o.value = l.code; o.textContent = l.name; langSel.append(o); });
langSel.addEventListener('change', e => { store.set('sa-court-language', e.target.value); setLanguage(e.target.value); });
const preferred = params.get('lang') || store.get('sa-court-language', '') || (navigator.languages || [navigator.language]).map(chooseLanguage).find(Boolean) || regionLanguage();
lang = chooseLanguage(preferred) || 'en'; langSel.value = lang;
// "Back to the game": when this page is hosted on its own, point to the public game instead of a missing index.html
fetch(new URL('../index.html', import.meta.url), { method: 'HEAD' }).then(r => { if (!r.ok) throw 0; }).catch(() => { document.querySelector('.back').href = 'https://kuonanhong.github.io/3x3Basketball/'; });
resize(); load(); setLanguage(lang).then(() => { $('play').textContent = t('pause'); });
requestAnimationFrame(loop);
window.SAStudio = { stage: st, get time() { return time; }, set time(v) { time = v; }, load: (id, mv) => { athlete = catalog.athletes.find(a => a.id === id) || athlete; sport = athlete.sport; moveId = mv || signatureMove(athlete); load(); } };
