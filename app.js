/* SmartAction Sports v7 application shell. All gameplay and replays run on this device. */
(function () {
  'use strict';
  const ownScript = document.currentScript;
  const assetBase = new URL('.', ownScript && ownScript.src ? ownScript.src : location.href);
  const $ = id => document.getElementById(id);
  const canvas = $('court'), stage = $('stage');
  let core = new SAHoopsCore.Core({ difficulty: 'easy', seed: 971031 });
  const renderer = new SAHoopsRenderer(canvas);
  const localeData = SAHoopsI18n;
  const supported = localeData.languages.map(x => x.code);
  let language = 'zh-Hant', recommended = 'balanced', activeQuality = 'balanced';
  let playing = false, paused = false, replayState = null, pendingHighlight = null;
  let latestClip = null, lastHighlightAt = -30, frameId = 0, tickAccumulator = 0;
  let captureAccumulator = 0, lastFrame = performance.now(), lastRender = 0, fpsStart = lastFrame, frameCount = 0;
  let lowFpsWindows = 0, muted = true, soundChosen = false, audio = null, toastTimer = 0, flashTimer = 0;
  let benchmarkDone = false, benchmarkCost = null;
  const history = [], MAX_HISTORY = 180, STEP = 1 / 60;
  const keys = new Set();
  const sticks = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0 };
  const actions = { jump: false, crouch: false, pass: false, shootHeld: false, shootReleased: false, switchPlayer: false };
  let swingMod = null;   // batting: which button loaded the swing (Q power, E contact, K normal)
  const family = () => (core && core.spec && core.spec.family) || 'basketball';
  let lastWhiff = 0;
  const emotes = {};   // playerId -> { kind: 'joy' | 'focus' | 'sad', until }
  function emote(id, kind, seconds) { if (id === undefined || id === null) return; emotes[id] = { kind, until: core.clock + (seconds || 1.6) }; }
  function liveEmotes() {
    const out = {}, now = core.clock;
    for (const id in emotes) { const e = emotes[id]; if (e.until > now) out[id] = { kind: e.kind, alpha: Math.min(1, (e.until - now) / 0.35) }; else delete emotes[id]; }
    const sel = core.selectedId !== undefined ? core.selectedId : core.selectedPlayer && core.selectedPlayer.id;
    if (!out[sel] && core.shotCharge > 0.15) out[sel] = { kind: 'focus', alpha: Math.min(1, core.shotCharge * 2) };
    return out;
  }
  const heldTouches = new Set();
  const languageLoads = new Map();
  function stored(name, fallback) { try { return localStorage.getItem(name) || fallback; } catch (_) { return fallback; } }
  function save(name, value) { try { localStorage.setItem(name, value); } catch (_) {} }
  function message(key) { const dict = localeData.messages[language] || {}; return dict[key] || (localeData.messages.en || {})[key] || (localeData.messages['zh-Hant'] || {})[key] || key; }
  function chooseLanguage(raw) {
    if (!raw) return null;
    if (supported.includes(raw)) return raw;
    const value = String(raw).toLowerCase();
    if (value.startsWith('zh')) return /hant|tw|hk|mo/.test(value) ? 'zh-Hant' : 'zh-Hans';
    if (value.startsWith('no') || value.startsWith('nn')) return supported.includes('nb') ? 'nb' : null;
    if (value.startsWith('tl')) return supported.includes('fil') ? 'fil' : null;
    if (value.startsWith('pt')) return 'pt';
    const short = value.split('-')[0];
    return supported.includes(short) ? short : null;
  }
  function languageFromRegion() {
    // Used only when none of the browser languages is supported: the IANA time zone hints at the region's main language.
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!zone) return null;
      const hit = localeData.languages.find(l => Array.isArray(l.tz) && l.tz.includes(zone));
      return hit ? hit.code : null;
    } catch (_) { return null; }
  }
  function applyLanguage() {
    document.documentElement.lang = language;
    document.documentElement.dir = (localeData.languages.find(x => x.code === language) || {}).dir || 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = message(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { const v = message(el.dataset.i18nTitle); el.title = v; el.setAttribute('aria-label', v); });
    document.title = message('titleV7') + ' · SmartAction Sports';
    $('language').value = language;
    $('language').setAttribute('aria-label', message('language'));
    $('movePad').setAttribute('aria-label', message('move'));
    $('aimPad').setAttribute('aria-label', message('aim'));
    $('dockToggle').title = message('dockToggle');
    canvas.setAttribute('aria-label', message('titleV7'));
    $('sound').textContent = message(muted ? 'sound' : 'mute');
    if (benchmarkDone) $('benchmarkStatus').textContent = message('quality') + ': ' + message(recommended);
    if (replayState) $('highlightTitle').textContent = highlightText(replayState.event);
    updateQualityLabels();
    window.dispatchEvent(new CustomEvent('sa-language', { detail: language }));
  }
  function loadDictionary(code) {
    if (localeData.messages[code]) return Promise.resolve(true);
    if (languageLoads.has(code)) return languageLoads.get(code);
    const job = fetch(new URL((localeData.lazyPath || 'i18n/') + code + '.json', assetBase).href, { credentials: 'omit' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(dict => { if (dict && typeof dict === 'object') localeData.messages[code] = dict; return true; })
      .catch(() => false);
    languageLoads.set(code, job);
    return job;
  }
  function setLanguage(code) {
    language = supported.includes(code) ? code : 'en';
    if (!localeData.messages[language]) {
      // Show the embedded fallback immediately, then re-render when the dictionary arrives.
      applyLanguage();
      return loadDictionary(language).then(ok => { if (!ok) toast('coachError'); applyLanguage(); return ok; });
    }
    applyLanguage();
    return Promise.resolve(true);
  }
  localeData.languages.forEach(entry => {
    const option = document.createElement('option'); option.value = entry.code; option.textContent = entry.name; $('language').appendChild(option);
  });
  const fixedLanguage = document.documentElement.dataset.defaultLang;
  const preferred = new URLSearchParams(location.search).get('lang') || fixedLanguage || stored('sa-court-language', '') ||
    (navigator.languages || [navigator.language]).map(chooseLanguage).find(Boolean) || languageFromRegion();
  setLanguage(chooseLanguage(preferred) || 'en');
  $('language').addEventListener('change', e => { save('sa-court-language', e.target.value); setLanguage(e.target.value); });
  if (!$('guideLink').getAttribute('href').startsWith('data:')) $('guideLink').href = new URL('guide.html', assetBase).href;
  function updateQualityLabels() {
    $('qualityBadge').textContent = activeQuality.toUpperCase();
    $('deviceQuality').textContent = message(activeQuality);
  }
  function setQuality(value) {
    activeQuality = value; renderer.setQuality(value); updateQualityLabels(); lowFpsWindows = 0;
  }
  $('quality').addEventListener('change', () => { setQuality($('quality').value === 'auto' ? recommended : $('quality').value); });
  $('difficulty').addEventListener('change', () => { core.difficulty = $('difficulty').value; });
  $('pitchPace').value = stored('sa-pitch-pace', 'slow');
  $('pitchPace').addEventListener('change', () => { save('sa-pitch-pace', $('pitchPace').value); core.pitchPace = $('pitchPace').value; });
  function toast(key) {
    clearTimeout(toastTimer); $('toast').textContent = message(key); $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
  }
  function flash(text) {
    const el = $('resultFlash'); clearTimeout(flashTimer);
    el.hidden = true; el.textContent = text; void el.offsetWidth; el.hidden = false;
    flashTimer = setTimeout(() => { el.hidden = true; }, 1700);
  }
  function clearInput() {
    keys.clear(); heldTouches.clear(); swingMod = null; Object.keys(actions).forEach(key => { actions[key] = false; });
    Object.keys(sticks).forEach(key => { sticks[key] = 0; });
    document.querySelectorAll('.stick-knob').forEach(el => { el.style.transform = ''; });
    document.querySelectorAll('[data-action]').forEach(el => el.classList.remove('active'));
  }
  function startMatch() {
    core.difficulty = $('difficulty').value; core.pitchPace = $('pitchPace').value; core.reset(); history.length = 0;
    window.dispatchEvent(new CustomEvent('sa-match-reset'));
    if (!soundChosen) { muted = false; $('sound').textContent = message('mute'); }
    playSound('pass');
    latestClip = null; replayState = null; pendingHighlight = null; tickAccumulator = captureAccumulator = 0;
    lastHighlightAt = -30; playing = true; paused = false; clearInput(); $('pickerOverlay').hidden = true;
    $('startOverlay').hidden = true; $('pauseOverlay').hidden = true; $('endOverlay').hidden = true; $('highlightBanner').hidden = true; $('pickerOverlay').hidden = true; $('starCard').hidden = true;
    $('pause').textContent = message('pause'); canvas.focus({ preventScroll: true }); updateHud();
    stage.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }
  $('start').addEventListener('click', startMatch);
  $('playAgain').addEventListener('click', startMatch);
  function setPaused(value) {
    if (!playing || core.ended || replayState) return;
    paused = value; clearInput(); $('pauseOverlay').hidden = !paused;
    $('pause').textContent = message(paused ? 'resume' : 'pause');
    if (!paused) canvas.focus({ preventScroll: true });
  }
  $('pause').addEventListener('click', () => setPaused(!paused)); $('resume').addEventListener('click', () => setPaused(false));
  $('switchPlayer').addEventListener('click', () => { actions.switchPlayer = true; canvas.focus({ preventScroll: true }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { finishReplay(); setPaused(true); clearInput(); } lastFrame = performance.now(); });
  window.addEventListener('blur', clearInput);
  const keyActions = { KeyQ: 'jump', KeyE: 'crouch', KeyJ: 'pass', KeyK: 'shootHeld', Tab: 'switchPlayer' };
  const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ...Object.keys(keyActions)];
  function allowsKeys(e) { return playing && !paused && !replayState && !core.ended && $('pickerOverlay').hidden && $('closeOverlay').hidden && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) && !document.querySelector('dialog[open]'); }
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && ingame && ingame.isOpen() && ingame.mode() === 'full') { ingame.stop('esc'); return; }
    if (e.code === 'Escape' && playing && !document.querySelector('dialog[open]')) { finishReplay(); setPaused(!paused); return; }
    if (!allowsKeys(e) || !gameKeys.includes(e.code)) return;
    e.preventDefault(); if (e.repeat) return; keys.add(e.code);
    // batting: Q (power) and E (contact) are swing buttons of their own — hold to load, release to swing
    if (family() === 'batting' && (e.code === 'KeyQ' || e.code === 'KeyE')) { actions.shootHeld = true; swingMod = e.code === 'KeyQ' ? 'power' : 'contact'; return; }
    if (family() === 'batting' && e.code === 'KeyK') swingMod = keys.has('KeyQ') ? 'power' : keys.has('KeyE') ? 'contact' : null;
    const action = keyActions[e.code]; if (action) actions[action] = true;
  });
  document.addEventListener('keyup', e => {
    const wasHeld = keys.has(e.code); keys.delete(e.code);
    if (e.code === 'KeyK' && wasHeld) { actions.shootHeld = false; actions.shootReleased = true; }
    if (family() === 'batting' && (e.code === 'KeyQ' || e.code === 'KeyE') && wasHeld && actions.shootHeld && !keys.has('KeyK')) { actions.shootHeld = false; actions.shootReleased = true; }
    if (e.code === 'KeyE') actions.crouch = false;
  });
  function installPad(id, prefix) {
    const pad = $(id), knob = pad.querySelector('.stick-knob'); let pointer = null;
    function set(e) {
      const rect = pad.getBoundingClientRect(), radius = rect.width * 0.31;
      let x = (e.clientX - rect.left - rect.width / 2) / radius;
      let z = (e.clientY - rect.top - rect.height / 2) / radius;
      const length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
      sticks[prefix + 'X'] = Math.abs(x) < 0.08 ? 0 : x;
      sticks[prefix + 'Z'] = Math.abs(z) < 0.08 ? 0 : z;
      knob.style.transform = `translate(${x * radius}px,${z * radius}px)`;
    }
    pad.addEventListener('pointerdown', e => { if (pointer !== null) return; e.preventDefault(); pointer = e.pointerId; pad.setPointerCapture(pointer); set(e); });
    pad.addEventListener('pointermove', e => { if (e.pointerId === pointer) set(e); });
    function release(e) { if (e.pointerId !== pointer) return; pointer = null; sticks[prefix + 'X'] = sticks[prefix + 'Z'] = 0; knob.style.transform = ''; }
    pad.addEventListener('pointerup', release); pad.addEventListener('pointercancel', release); pad.addEventListener('lostpointercapture', release);
  }
  installPad('movePad', 'move'); installPad('aimPad', 'aim');
  document.querySelectorAll('[data-action]').forEach(button => {
    const action = button.dataset.action; let pointer = null;
    button.addEventListener('pointerdown', e => {
      if (!playing || paused || replayState || core.ended || pointer !== null) return;
      e.preventDefault(); pointer = e.pointerId; try { button.setPointerCapture(pointer); } catch (_) {} heldTouches.add(action); button.classList.add('active');
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {}
      const swingButton = family() === 'batting' && (action === 'jump' || action === 'crouch');
      if (swingButton) { actions.shootHeld = true; swingMod = action === 'jump' ? 'power' : 'contact'; }
      else if (action === 'shoot') { actions.shootHeld = true; if (family() === 'batting') swingMod = heldTouches.has('jump') ? 'power' : heldTouches.has('crouch') ? 'contact' : null; }
      else actions[action] = true;
    });
    function release(e) {
      if (e.pointerId !== pointer) return; pointer = null; heldTouches.delete(action); button.classList.remove('active');
      if (action === 'shoot' || (family() === 'batting' && (action === 'jump' || action === 'crouch'))) {
        if (actions.shootHeld) { actions.shootHeld = keys.has('KeyK') || heldTouches.has('shoot'); actions.shootReleased = !actions.shootHeld; }
      }
      if (action === 'crouch') actions.crouch = keys.has('KeyE');
    }
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  });
  $('dockToggle').addEventListener('click', () => {
    const hidden = stage.classList.toggle('dock-hidden');
    $('dockToggle').setAttribute('aria-pressed', String(!hidden)); save('sa-dock', hidden ? 'hidden' : 'shown'); clearInput(); renderer.resize();
  });
  if (stored('sa-dock', 'shown') === 'hidden' && matchMedia('(pointer:fine)').matches) { stage.classList.add('dock-hidden'); $('dockToggle').setAttribute('aria-pressed', 'false'); }
  /* ---- first screen: sport picker; ✕ closes the page ---- */
  function showPicker() {
    finishReplay(); if (playing && !core.ended) setPaused(true);
    $('pickerOverlay').hidden = false; $('startOverlay').hidden = true; $('endOverlay').hidden = true; $('closeOverlay').hidden = true;
    window.dispatchEvent(new CustomEvent('sa-picker-open'));
  }
  function hidePicker() { $('pickerOverlay').hidden = true; if (!playing) $('startOverlay').hidden = false; }
  $('changeSport').addEventListener('click', showPicker); $('endChangeSport').addEventListener('click', showPicker);
  /* Two exits, like any desktop or phone app: "End match" (back to the sports menu, page stays) and ✕ "Close app". */
  function endMatch() {
    finishReplay(); playing = false; paused = false; pendingHighlight = null; clearInput();
    $('pauseOverlay').hidden = true; $('closeOverlay').hidden = true; $('endOverlay').hidden = true; $('chargeHud').hidden = true;
    core.reset(); history.length = 0; window.dispatchEvent(new CustomEvent('sa-match-reset')); showPicker();
  }
  function askLeave(focus) {
    if (!playing || core.ended) { if (focus === 'quit') { endMatch(); return; } }
    finishReplay(); if (playing && !core.ended) setPaused(true);
    $('pauseOverlay').hidden = true; $('closeOverlay').hidden = false;
    $('quitConfirm').classList.toggle('suggested', focus === 'quit'); $('closeConfirm').classList.toggle('suggested', focus === 'exit');
    try { (focus === 'quit' ? $('quitConfirm') : $('closeConfirm')).focus({ preventScroll: true }); } catch (_) {}
  }
  $('quitMatch').addEventListener('click', () => askLeave('quit'));
  $('closeApp').addEventListener('click', () => askLeave('exit'));
  $('quitConfirm').addEventListener('click', endMatch);
  $('closeCancel').addEventListener('click', () => { $('closeOverlay').hidden = true; if (playing && paused) $('pauseOverlay').hidden = false; });
  $('closeConfirm').addEventListener('click', async () => {
    playing = false; clearInput(); $('closeOverlay').hidden = true; $('closedOverlay').hidden = false;
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (_) {}
    try { window.close(); } catch (_) {}
    // A page that was not opened by script cannot close itself: leave a blank page instead so nothing keeps running.
    setTimeout(() => { if (!document.hidden && !window.closed) { try { location.replace('about:blank'); } catch (_) {} } }, 350);
  });
  $('reopen').addEventListener('click', () => location.reload());
  function input() {
    return Object.assign({}, actions, {
      moveX: sticks.moveX + (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
      moveZ: sticks.moveZ + (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0),
      aimX: sticks.aimX + (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0),
      aimZ: sticks.aimZ + (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0),
      crouch: family() === 'batting' ? swingMod === 'contact' : actions.crouch || heldTouches.has('crouch'),
      power: family() === 'batting' ? swingMod === 'power' : keys.has('KeyQ') || heldTouches.has('jump')
    });
  }
  function updateHud() {
    $('blueScore').textContent = String(core.score[0]).padStart(2, '0'); $('orangeScore').textContent = String(core.score[1]).padStart(2, '0');
    const seconds = Math.ceil(core.timeRemaining); $('gameClock').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    $('shotClock').textContent = Number.isFinite(core.shotClock) ? String(Math.ceil(core.shotClock)).padStart(2, '0') : '—';
    if (window.SASportsUI) window.SASportsUI.updateMetrics(core);
    const charging = core.shotCharge > 0 && !replayState;
    $('chargeHud').hidden = !charging; $('chargeFill').style.width = Math.min(100, core.shotCharge * 100) + '%';
  }
  function capture(dt) {
    captureAccumulator += dt;
    if (captureAccumulator < 1 / 30) return;
    captureAccumulator %= 1 / 30; history.push(core.getSnapshot()); if (history.length > MAX_HISTORY) history.shift();
  }
  const HIGHLIGHT_KEYS = { dunk: 'highlight_dunk', three: 'highlight_three', layup: 'highlight_layup', block: 'highlight_block', steal: 'highlight_steal', score: 'highlight_score',
    goal: 'highlight_goal', homeRun: 'highlight_homeRun', hit: 'highlight_hit', try: 'highlight_try', touchdown: 'highlight_touchdown', rally: 'highlight_rally', serve: 'highlight_ace',
    wicket: 'highlight_wicket', boundary: 'highlight_hit', pinsDown: 'highlight_strikeBowl', holed: 'highlight_holeOut', pocketed: 'highlight_score', catch: 'highlight_block', target: 'highlight_score', finish: 'highlight_score' };
  function highlightText(event) {
    const type = typeof event === 'string' ? event : (event && event.type) || 'score';
    if (!core.sport || core.sport === 'basketball' || core.sport === 'basketball5') return message(HIGHLIGHT_KEYS[type] || 'highlight_score');
    return message(HIGHLIGHT_KEYS[type] || 'replayGeneric');
  }
  function beginReplay(clip) {
    if (!clip || clip.frames.length < 2) { toast('replayUnavailable'); return; }
    latestClip = clip; replayState = { event: clip.event, frames: clip.frames, elapsed: 0, manualAngle: 0,
      duration: Math.max(0.5, clip.frames[clip.frames.length - 1].clock - clip.frames[0].clock) / 0.45 };
    clearInput(); canvas.style.touchAction = 'none'; $('pauseOverlay').hidden = true; $('highlightTitle').textContent = highlightText(clip.event); $('highlightBanner').hidden = false;
    // star card: who made the play
    const star = core.players.find(p => p.id === clip.event.playerId);
    const info = star && window.SASportsUI && SASportsUI.athleteFor ? SASportsUI.athleteFor(star.athleteId) : null;
    if (star && !window.SA_NO_3D) show3D(star, 'pip');
    if (star) {
      $('starName').textContent = (info ? (window.SASportsUI.localeName ? SASportsUI.localeName(info) : info.name) : star.displayName || '#' + (star.number || star.id + 1));
      $('starMeta').textContent = [highlightText(clip.event), info && info.position ? message('pos_' + info.position) : '', info && info.country ? info.country : '', info && info.notes ? info.notes : ''].filter(Boolean).join(' · ');
      if (info && info.photo) { $('starPhoto').src = new URL(info.photo, assetBase).href; $('starPhoto').hidden = false; } else $('starPhoto').hidden = true;
      $('starCard').hidden = false;
    }
  }
  /* ---- 3D signature moves inside the game (Three.js loaded only when first needed) ---- */
  let ingame = null, ingameJob = null, pausedFor3D = false;
  function load3D() {
    if (ingame) return Promise.resolve(ingame);
    if (!ingameJob) ingameJob = import(new URL('athletes3d/ingame.js?v=7.4.0', assetBase).href).then(m => (ingame = m)).catch(err => { ingameJob = null; throw err; });
    return ingameJob;
  }
  function athleteOf(player) { const id = player && player.athleteId; return id && window.SASportsData ? window.SASportsData.athletes.find(a => a.id === id) || null : null; }
  function show3D(player, mode) {
    const a = athleteOf(player); if (!a) return;
    load3D().then(m => {
      if (!m.available(a)) { if (mode === 'full') toast('s3d_noRecord'); return; }
      const name = language.startsWith('zh') && a.nameZh ? a.nameZh + ' ' + a.name : a.name, mv = m.signatureMove(a);
      if (mode === 'full' && playing && !paused && !core.ended) { setPaused(true); pausedFor3D = true; $('pauseOverlay').hidden = true; }
      stage.classList.add('with3d');
      m.play(stage, a, { mode, uniform: player.team === 1 ? 'coral' : 'teal', title: name + (a.appearance && a.appearance.jerseyNumber != null ? '  #' + a.appearance.jerseyNumber : ''), subtitle: message('mv_' + mv),
        onEnd: () => { stage.classList.remove('with3d'); if (pausedFor3D) { pausedFor3D = false; setPaused(false); } } });
    }).catch(() => {});
  }
  window.addEventListener('sa-show3d', e => { const d = e.detail || {}; const player = core.players.find(p => p.athleteId === d.athleteId) || { athleteId: d.athleteId, team: d.team || 0 }; show3D(player, d.mode || 'full'); });
  function finishReplay() { if (!replayState) return; replayState = null; if (ingame && ingame.isOpen() && ingame.mode() === 'pip') ingame.stop('replayEnd'); canvas.style.touchAction = ''; $('highlightBanner').hidden = true; $('starCard').hidden = true; tickAccumulator = 0; clearInput(); $('pauseOverlay').hidden = !paused; }
  let orbitPointer = null, orbitX = 0, zonePointer = null;
  function zoneTouch(e) {
    // batting: a tap or drag inside the strike zone moves the bat straight to that spot
    if (!playing || paused || replayState || core.ended || !core.batter || !renderer.zoneFromScreen) return false;
    const rect = canvas.getBoundingClientRect(), hit = renderer.zoneFromScreen(e.clientX - rect.left, e.clientY - rect.top, core.getSnapshot());
    if (!hit) return false;
    core.batter.cursorX = hit.x; core.batter.cursorY = hit.y; return true;
  }
  canvas.addEventListener('pointerdown', e => {
    if (replayState) { e.preventDefault(); orbitPointer = e.pointerId; orbitX = e.clientX; canvas.setPointerCapture(e.pointerId); return; }
    if (zoneTouch(e)) { e.preventDefault(); zonePointer = e.pointerId; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointermove', e => {
    if (replayState && e.pointerId === orbitPointer) { replayState.manualAngle += (e.clientX - orbitX) / Math.max(1, canvas.clientWidth) * Math.PI * 2; orbitX = e.clientX; return; }
    if (e.pointerId === zonePointer) zoneTouch(e);
  });
  function endOrbit(e) { if (e.pointerId === orbitPointer) orbitPointer = null; if (e.pointerId === zonePointer) zonePointer = null; }
  canvas.addEventListener('pointerup', endOrbit); canvas.addEventListener('pointercancel', endOrbit); canvas.addEventListener('lostpointercapture', endOrbit);
  $('skipReplay').addEventListener('click', finishReplay);
  $('replay').addEventListener('click', () => beginReplay(latestClip));
  $('play3d').addEventListener('click', () => { finishReplay(); const p = core.selectedPlayer || core.players[core.selectedId || 0]; show3D(p, 'full'); });
  function lerpSnapshot(a, b, t) {
    const out = Object.assign({}, a, { clock: a.clock + (b.clock - a.clock) * t,
      players: a.players.map((p, i) => { const q = b.players[i] || p; return Object.assign({}, p, { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t }); }),
      ball: Object.assign({}, a.ball, { x: a.ball.x + (b.ball.x - a.ball.x) * t, y: a.ball.y + (b.ball.y - a.ball.y) * t, z: a.ball.z + (b.ball.z - a.ball.z) * t }) });
    return out;
  }
  function replaySnapshot() {
    const frames = replayState.frames, first = frames[0], target = first.clock + replayState.elapsed * 0.45;
    let index = 0; while (index < frames.length - 2 && frames[index + 1].clock < target) index++;
    const a = frames[index], b = frames[Math.min(index + 1, frames.length - 1)];
    const t = Math.max(0, Math.min(1, (target - a.clock) / Math.max(0.0001, b.clock - a.clock)));
    return lerpSnapshot(a, b, t);
  }
  function playSound(type) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const hit = type === 'hit';
      oscillator.type = hit ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(type === 'score' ? 600 : hit ? 320 : 140, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(type === 'score' ? 900 : hit ? 90 : 65, audio.currentTime + (hit ? 0.08 : 0.13));
      gain.gain.setValueAtTime(hit ? 0.08 : 0.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.17);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.18);
      if (type === 'score' && $('venueMode') && $('venueMode').value !== 'park') {
        const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 1.1), audio.sampleRate), samples = buffer.getChannelData(0);
        let v = 0; for (let i = 0; i < samples.length; i++) { v = v * .92 + (Math.random() * 2 - 1) * .08; samples[i] = v; }
        const crowd = audio.createBufferSource(), filter = audio.createBiquadFilter(), envelope = audio.createGain();
        crowd.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 950; filter.Q.value = .5;
        envelope.gain.setValueAtTime(.001, audio.currentTime); envelope.gain.linearRampToValueAtTime(.48, audio.currentTime + .15); envelope.gain.exponentialRampToValueAtTime(.001, audio.currentTime + 1.08);
        crowd.connect(filter); filter.connect(envelope); envelope.connect(audio.destination); crowd.start(); crowd.stop(audio.currentTime + 1.1);
      }
    } catch (_) { muted = true; }
  }
  $('sound').addEventListener('click', () => { soundChosen = true; muted = !muted; $('sound').textContent = message(muted ? 'sound' : 'mute'); if (!muted) playSound('score'); });
  $('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (stage.requestFullscreen) await stage.requestFullscreen(); else toast('rotateHint'); } catch (_) { toast('rotateHint'); }
  });
  function openDialog(id) { finishReplay(); setPaused(true); $(id).showModal(); }
  $('help').addEventListener('click', () => openDialog('helpDialog')); $('courts').addEventListener('click', () => openDialog('mapDialog'));
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $('locate').addEventListener('click', () => {
    if (!navigator.geolocation) { $('mapStatus').textContent = message('mapUnavailable'); return; }
    $('locate').disabled = true; $('mapStatus').textContent = message('locating');
    navigator.geolocation.getCurrentPosition(position => {
      const latitude = position.coords.latitude, longitude = position.coords.longitude;
      const point = latitude.toFixed(6) + ',' + longitude.toFixed(6);
      $('coordinates').textContent = point + ' · ±' + Math.round(position.coords.accuracy) + ' m';
      const current = new URL('https://www.google.com/maps/search/'); current.searchParams.set('api', '1'); current.searchParams.set('query', point);
      const nearby = new URL('https://www.google.com/maps/search/'); nearby.searchParams.set('api', '1'); nearby.searchParams.set('query', 'basketball courts near ' + point);
      $('currentMap').href = current.href; $('nearbyMap').href = nearby.href; $('mapActions').hidden = false; $('mapStatus').textContent = message('mapReady'); $('locate').disabled = false;
      const key = window.SAHoopsConfig && window.SAHoopsConfig.mapsEmbedApiKey;
      if (key) {
        const embed = new URL('https://www.google.com/maps/embed/v1/view'); embed.searchParams.set('key', key); embed.searchParams.set('center', point); embed.searchParams.set('zoom', '15');
        $('embeddedMap').src = embed.href; $('embeddedMap').hidden = false;
      }
    }, error => { $('locate').disabled = false; $('mapStatus').textContent = message(error.code === 1 ? 'mapDenied' : 'mapUnavailable'); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
  async function benchmark() {
    const costs = [];
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const before = performance.now(); renderer.render(core.getSnapshot(), { cameraAngle: 0, view: 'wide' }); costs.push(performance.now() - before);
    }
    costs.sort((a, b) => a - b); benchmarkCost = costs[Math.floor(costs.length * 0.8)];
    const memoryHint = Number(navigator.deviceMemory) || null, coreHint = Number(navigator.hardwareConcurrency) || null;
    recommended = (memoryHint && memoryHint <= 2) || benchmarkCost > 15 ? 'lite' : (memoryHint && memoryHint <= 4) || (coreHint && coreHint <= 4) || benchmarkCost > 7 ? 'balanced' : 'full';
    benchmarkDone = true; if ($('quality').value === 'auto') setQuality(recommended);
    $('benchmarkStatus').textContent = message('quality') + ': ' + message(recommended);
    $('start').disabled = false;
  }
  $('start').disabled = true;
  const RESULT_KEYS = { single: 'result_single', double: 'result_double', triple: 'result_triple', homeRun: 'result_homeRun', walk: 'result_walk', strikeout: 'result_strikeout', flyOut: 'result_flyOut', groundOut: 'result_groundOut', lineOut: 'result_lineOut',
    foul: 'result_foul', bowled: 'result_bowled', caught: 'result_caught', six: 'result_six', four: 'result_four', dot: 'result_dot', strikeBowl: 'strikeBowling', spare: 'spare', gutter: 'gutter', scratch: 'scratch', holeInOne: 'holeInOne' };
  function onEvents(events) {
    if (events.length) window.dispatchEvent(new CustomEvent('sa-events', { detail: events }));
    if (events.some(e => e.type === 'score')) playSound('score'); else if (events.some(e => e.type === 'contact' || e.type === 'pinsDown' || e.type === 'ballClick')) playSound('hit'); else if (events.some(e => e.type === 'pass')) playSound('pass');
    const rank = { dunk: 6, three: 5, layup: 4, block: 3, steal: 2, score: 1, goal: 5, homeRun: 6, hit: 3, touchdown: 6, try: 5, point: 4, bullseye: 6, finish: 5, wicket: 5, boundary: 5, holed: 6, pinsDown: 2, pocketed: 3, catch: 4 };
    window.dispatchEvent(new CustomEvent('sa-game-events', { detail: events }));
    for (const e of events) {
      if (e.type === 'score' || e.type === 'goal' || e.type === 'homeRun' || e.type === 'touchdown' || e.type === 'try' || e.type === 'boundary' || e.type === 'wicket') {
        const scorer = e.playerId !== undefined ? e.playerId : e.shooterId; emote(scorer, 'joy', 1.8);
        const team = e.team !== undefined ? e.team : core.players[scorer] && core.players[scorer].team;
        const rival = core.players.filter(p => p.team !== team).sort((a, b) => Math.hypot(a.x - core.ball.x, a.z - core.ball.z) - Math.hypot(b.x - core.ball.x, b.z - core.ball.z))[0];
        if (rival) emote(rival.id, 'sad', 1.6);
      }
      if (e.type === 'steal' || e.type === 'block' || e.type === 'save' || e.type === 'catch' || e.type === 'tackle') emote(e.playerId, 'joy', 1.2);
      if (e.type === 'whiff') emote(e.playerId, 'sad', 0.9);
      if (e.type === 'whiff' && core.clock - lastWhiff > 1.2) { lastWhiff = core.clock; toast(e.reason === 'wait' ? 'hintWait' : e.reason === 'missed' ? 'hintMissed' : 'hintTooFar'); }
      if (e.type === 'switch') toast('hintSwitched');
      if (e.type === 'rally' && e.shot === 'smash' && e.playerId === 0) flash(message('shotSmash'));
      if (e.type === 'out' && RESULT_KEYS[e.style]) flash(message(RESULT_KEYS[e.style]));
      else if (e.type === 'hit' && e.bases) flash(message(RESULT_KEYS[['', 'single', 'double', 'triple'][e.bases]]));
      else if (e.type === 'homeRun') flash(message('result_homeRun'));
      else if (e.type === 'walk') flash(message('result_walk'));
      else if (e.type === 'foul') flash(message('result_foul'));
      else if (e.type === 'wicket') flash(message(e.style === 'caught' ? 'result_caught' : 'result_bowled'));
      else if (e.type === 'boundary') flash(message(e.runs === 6 ? 'result_six' : 'result_four'));
      else if (e.type === 'strike' && e.strikes === 3) { /* strikeout flash comes from the out event */ }
      else if (e.type === 'pinsDown' && e.style !== 'pins') flash(message(RESULT_KEYS[e.style]));
      else if (e.type === 'gutter') flash(message('gutter'));
      else if (e.type === 'scratch') flash(message('scratch'));
      else if (e.type === 'holed') flash(message(e.strokes === 1 ? 'holeInOne' : 'inHole'));
      else if (e.type === 'inningOver') flash(message('inningOver'));
      else if (e.type === 'flagPull') flash(message('flagPulled'));
    }
    const event = events.filter(e => rank[e.type]).sort((a, b) => rank[b.type] - rank[a.type])[0];
    if (event && !pendingHighlight && core.clock - lastHighlightAt > 12 && history.length > 20 && !(event.type === 'pinsDown' && event.style === 'pins')) { pendingHighlight = { event, until: core.clock + 0.65 }; lastHighlightAt = core.clock; }
    if (events.some(e => e.type === 'gameOver')) {
      pendingHighlight = null; $('result').textContent = message(core.score[0] === core.score[1] ? 'draw' : core.score[0] > core.score[1] ? 'winnerBlue' : 'winnerOrange');
      $('endOverlay').hidden = false; clearInput();
    }
  }
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
    if (!document.hidden) {
      if (replayState) { replayState.elapsed += dt; if (replayState.elapsed >= replayState.duration) finishReplay(); }
      else if (playing && !paused && !core.ended) {
        tickAccumulator += dt; let steps = 0;
        while (tickAccumulator >= STEP && steps++ < 6) {
          const released = actions.shootReleased;
          core.step(STEP, input()); actions.jump = actions.pass = actions.shootReleased = actions.switchPlayer = false; if (released) swingMod = null;
          tickAccumulator -= STEP; capture(STEP); onEvents(core.consumeEvents());
          if (pendingHighlight && core.clock >= pendingHighlight.until) {
            const clip = { event: pendingHighlight.event, frames: history.filter(s => s.clock >= pendingHighlight.event.time - 2.8) };
            pendingHighlight = null; beginReplay(clip); tickAccumulator = 0; break;
          }
        }
      }
      const renderInterval = activeQuality === 'lite' ? 1000 / 30 : 1000 / 60;
      if (now - lastRender >= renderInterval - 1) {
        const snapshot = replayState ? replaySnapshot() : core.getSnapshot();
        const viewOptions = window.SASportsUI ? window.SASportsUI.renderOptions(snapshot) : { cameraAngle: 0, view: 'wide' };
        let replayOptions = {};
        if (replayState) {
          const t = replayState.elapsed / replayState.duration;           // 0..1 over the slow-motion clip
          const closeUp = t < 0.35 ? 1 : t < 0.8 ? 1 - (t - 0.35) / 0.45 : 0;  // start tight on the star, pull back while orbiting
          replayOptions = { replay: true, cameraAngle: t * Math.PI * 2 + replayState.manualAngle, focusId: replayState.event.playerId,
            replayZoom: 1 + closeUp * 1.1, playerScale: (viewOptions.playerScale || 0.59) * (1 + closeUp * 0.9), trail: true, spotlight: true };
        }
        renderer.render(snapshot, Object.assign({}, viewOptions, replayOptions, { emotes: replayState ? {} : liveEmotes() }));
        lastRender = now; frameCount++; updateHud();
      }
      if (now - fpsStart > 3000) {
        const fps = frameCount * 1000 / (now - fpsStart); $('fps').textContent = Math.round(fps) + ' FPS'; frameCount = 0; fpsStart = now;
        if (playing && !paused && $('quality').value === 'auto' && fps < (activeQuality === 'lite' ? 20 : 38)) lowFpsWindows++; else lowFpsWindows = 0;
        if (lowFpsWindows >= 2 && activeQuality !== 'lite') { setQuality(activeQuality === 'full' ? 'balanced' : 'lite'); toast('lowFps'); }
      }
    } else { tickAccumulator = 0; fpsStart = now; frameCount = 0; }
    frameId = requestAnimationFrame(frame);
  }
  window.addEventListener('resize', () => renderer.resize());
  if (window.ResizeObserver) new ResizeObserver(() => renderer.resize()).observe(stage);
  window.SAHoopsApp = {
    get core() { return core; }, renderer,
    getLanguage: () => language, message, setLanguage, loadDictionary,
    setPaused, toast, flash, showPicker, hidePicker,
    setSport: (sport) => {
      finishReplay(); clearInput(); history.length = 0; latestClip = null; pendingHighlight = null; playing = false; paused = false;
      core = sport === 'basketball' ? new SAHoopsCore.Core({ difficulty: $('difficulty').value, seed: 971031 })
        : sport === 'basketball5' ? new SAHoopsCore.Core({ difficulty: $('difficulty').value, seed: 971031, fullCourt: true })
        : new SASports.Core({ sport, difficulty: $('difficulty').value, seed: 971031, pitchPace: $('pitchPace').value });
      $('startOverlay').hidden = !$('pickerOverlay').hidden; $('endOverlay').hidden = true; $('pauseOverlay').hidden = true; $('pause').textContent = message('pause'); $('starCard').hidden = true;
      tickAccumulator = captureAccumulator = 0; updateHud(); window.dispatchEvent(new CustomEvent('sa-match-reset')); return core;
    },
    diagnostics: () => ({ language, playing, paused, replay: !!replayState, quality: activeQuality, recommended, benchmarkCost, historyFrames: history.length, clipFrames: latestClip ? latestClip.frames.length : 0, liveClock: core.clock, canvasPixels: canvas.width * canvas.height, localAI: true, networkMultiplayer: false, languages: supported.length }),
    getReplay: () => latestClip,
    restart: startMatch
  };
  frameId = requestAnimationFrame(frame);
  benchmark().catch(() => { benchmarkDone = true; setQuality('lite'); $('start').disabled = false; $('benchmarkStatus').textContent = message('lite'); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && ownScript && ownScript.src) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register(new URL('sw.js', assetBase).href, { updateViaCache: 'none' }).then(reg => reg.update && reg.update()).catch(() => {});
    // a newer version took over: reload once (only when no match is running) so HTML, JS and CSS never mix versions
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return; let done = false; try { done = sessionStorage.getItem('sa-sw-reloaded') === '1'; sessionStorage.setItem('sa-sw-reloaded', '1'); } catch (_) {}
      if (!done && !playing) location.reload(); else toast('versionUpdated');
    });
  }
  window.addEventListener('pagehide', () => { clearInput(); cancelAnimationFrame(frameId); });
  window.addEventListener('pageshow', e => { if (e.persisted) { lastFrame = performance.now(); frameId = requestAnimationFrame(frame); } });
})();
