/* SmartAction Court application. All gameplay and replays run on this device. */
(function () {
  'use strict';
  const ownScript = document.currentScript;
  const assetBase = new URL('.', ownScript && ownScript.src ? ownScript.src : location.href);
  const $ = id => document.getElementById(id);
  const canvas = $('court');
  const core = new SAHoopsCore.Core({ difficulty: 'easy', seed: 971031 });
  const renderer = new SAHoopsRenderer(canvas);
  const localeData = SAHoopsI18n;
  const supported = localeData.languages.map(x => x.code);
  let language = 'zh-Hant', recommended = 'balanced', activeQuality = 'balanced';
  let playing = false, paused = false, replayState = null, pendingHighlight = null;
  let latestClip = null, lastHighlightAt = -30, frameId = 0, tickAccumulator = 0;
  let captureAccumulator = 0, lastFrame = performance.now(), lastRender = 0, fpsStart = lastFrame, frameCount = 0;
  let lowFpsWindows = 0, muted = true, audio = null, toastTimer = 0;
  let benchmarkDone = false, benchmarkCost = null;
  const history = [], MAX_HISTORY = 180, STEP = 1 / 60;
  const keys = new Set();
  const sticks = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0 };
  const actions = { jump: false, crouch: false, pass: false, shootHeld: false, shootReleased: false, switchPlayer: false };
  const heldTouches = new Set();
  function stored(name, fallback) { try { return localStorage.getItem(name) || fallback; } catch (_) { return fallback; } }
  function save(name, value) { try { localStorage.setItem(name, value); } catch (_) {} }
  function message(key) { return localeData.messages[language][key] || localeData.messages.en[key] || key; }
  function chooseLanguage(raw) {
    if (!raw) return null;
    if (supported.includes(raw)) return raw;
    const value = raw.toLowerCase();
    if (value.startsWith('zh')) return /hant|tw|hk|mo/.test(value) ? 'zh-Hant' : 'zh-Hans';
    const short = value.split('-')[0];
    return supported.includes(short) ? short : null;
  }
  function setLanguage(code) {
    language = supported.includes(code) ? code : 'en';
    document.documentElement.lang = language;
    document.documentElement.dir = localeData.languages.find(x => x.code === language).dir || 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = message(el.dataset.i18n); });
    document.title = message('title') + ' · SmartAction Court';
    $('language').value = language;
    $('language').setAttribute('aria-label', message('language'));
    $('movePad').setAttribute('aria-label', message('move'));
    $('aimPad').setAttribute('aria-label', message('aim'));
    canvas.setAttribute('aria-label', message('title'));
    $('sound').textContent = message(muted ? 'sound' : 'mute');
    if (benchmarkDone) $('benchmarkStatus').textContent = message('quality') + ': ' + message(recommended);
    if (replayState) $('highlightTitle').textContent = highlightText(replayState.event.type);
    updateQualityLabels();
  }
  localeData.languages.forEach(entry => {
    const option = document.createElement('option'); option.value = entry.code; option.textContent = entry.name; $('language').appendChild(option);
  });
  const fixedLanguage = document.documentElement.dataset.defaultLang;
  const preferred = new URLSearchParams(location.search).get('lang') || fixedLanguage || stored('sa-court-language', '') || (navigator.languages || [navigator.language]).find(x => chooseLanguage(x));
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
  function toast(key) {
    clearTimeout(toastTimer); $('toast').textContent = message(key); $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
  }
  function clearInput() {
    keys.clear(); heldTouches.clear(); Object.keys(actions).forEach(key => { actions[key] = false; });
    Object.keys(sticks).forEach(key => { sticks[key] = 0; });
    document.querySelectorAll('.stick-knob').forEach(el => { el.style.transform = ''; });
    document.querySelectorAll('[data-action]').forEach(el => el.classList.remove('active'));
  }
  function startMatch() {
    core.difficulty = $('difficulty').value; core.reset(); history.length = 0;
    latestClip = null; replayState = null; pendingHighlight = null; tickAccumulator = captureAccumulator = 0;
    lastHighlightAt = -30; playing = true; paused = false; clearInput();
    $('startOverlay').hidden = true; $('pauseOverlay').hidden = true; $('endOverlay').hidden = true; $('highlightBanner').hidden = true;
    $('pause').textContent = message('pause'); canvas.focus({ preventScroll: true }); updateHud();
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
  function allowsKeys(e) { return playing && !paused && !replayState && !core.ended && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) && !document.querySelector('dialog[open]'); }
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && playing && !document.querySelector('dialog[open]')) { finishReplay(); setPaused(!paused); return; }
    if (!allowsKeys(e) || !gameKeys.includes(e.code)) return;
    e.preventDefault(); if (e.repeat) return; keys.add(e.code);
    const action = keyActions[e.code]; if (action) actions[action] = true;
  });
  document.addEventListener('keyup', e => {
    const wasHeld = keys.has(e.code); keys.delete(e.code);
    if (e.code === 'KeyK' && wasHeld) { actions.shootHeld = false; actions.shootReleased = true; }
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
      e.preventDefault(); pointer = e.pointerId; button.setPointerCapture(pointer); heldTouches.add(action); button.classList.add('active');
      if (action === 'shoot') actions.shootHeld = true; else actions[action] = true;
    });
    function release(e) {
      if (e.pointerId !== pointer) return; pointer = null; heldTouches.delete(action); button.classList.remove('active');
      if (action === 'shoot') { actions.shootHeld = keys.has('KeyK'); actions.shootReleased = !actions.shootHeld; }
      if (action === 'crouch') actions.crouch = keys.has('KeyE');
    }
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  });
  function input() {
    return Object.assign({}, actions, {
      moveX: sticks.moveX + (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
      moveZ: sticks.moveZ + (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0),
      aimX: sticks.aimX + (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0),
      aimZ: sticks.aimZ + (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0),
      crouch: actions.crouch || heldTouches.has('crouch')
    });
  }
  function updateHud() {
    $('blueScore').textContent = String(core.score[0]).padStart(2, '0'); $('orangeScore').textContent = String(core.score[1]).padStart(2, '0');
    const seconds = Math.ceil(core.timeRemaining); $('gameClock').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    $('shotClock').textContent = String(Math.ceil(core.shotClock)).padStart(2, '0');
    $('chargeHud').hidden = !(core.shotCharge > 0 && !replayState); $('chargeFill').style.width = Math.min(100, core.shotCharge * 100) + '%';
  }
  function capture(dt) {
    captureAccumulator += dt;
    if (captureAccumulator < 1 / 30) return;
    captureAccumulator %= 1 / 30; history.push(core.getSnapshot()); if (history.length > MAX_HISTORY) history.shift();
  }
  function highlightText(type) {
    return message('highlight_' + ({ dunk: 'dunk', three: 'three', layup: 'layup', block: 'block', steal: 'steal' }[type] || 'score'));
  }
  function beginReplay(clip) {
    if (!clip || clip.frames.length < 2) { toast('replayUnavailable'); return; }
    latestClip = clip; replayState = { event: clip.event, frames: clip.frames, elapsed: 0, manualAngle: 0,
      duration: Math.max(0.5, clip.frames[clip.frames.length - 1].clock - clip.frames[0].clock) / 0.45 };
    clearInput(); canvas.style.touchAction = 'none'; $('pauseOverlay').hidden = true; $('highlightTitle').textContent = highlightText(clip.event.type); $('highlightBanner').hidden = false;
  }
  function finishReplay() { if (!replayState) return; replayState = null; canvas.style.touchAction = ''; $('highlightBanner').hidden = true; tickAccumulator = 0; clearInput(); $('pauseOverlay').hidden = !paused; }
  let orbitPointer = null, orbitX = 0;
  canvas.addEventListener('pointerdown', e => { if (!replayState) return; e.preventDefault(); orbitPointer = e.pointerId; orbitX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!replayState || e.pointerId !== orbitPointer) return; replayState.manualAngle += (e.clientX - orbitX) / Math.max(1, canvas.clientWidth) * Math.PI * 2; orbitX = e.clientX; });
  function endOrbit(e) { if (e.pointerId === orbitPointer) orbitPointer = null; }
  canvas.addEventListener('pointerup', endOrbit); canvas.addEventListener('pointercancel', endOrbit); canvas.addEventListener('lostpointercapture', endOrbit);
  $('skipReplay').addEventListener('click', finishReplay);
  $('replay').addEventListener('click', () => beginReplay(latestClip));
  function replaySnapshot() {
    const frames = replayState.frames, first = frames[0], target = first.clock + replayState.elapsed * 0.45;
    let index = 0; while (index < frames.length - 2 && frames[index + 1].clock < target) index++;
    const a = frames[index], b = frames[Math.min(index + 1, frames.length - 1)];
    const t = Math.max(0, Math.min(1, (target - a.clock) / Math.max(0.0001, b.clock - a.clock)));
    const out = Object.assign({}, a, { clock: a.clock + (b.clock - a.clock) * t,
      players: a.players.map((p, i) => { const q = b.players[i]; return Object.assign({}, p, {x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,z:p.z+(q.z-p.z)*t}); }),
      ball: Object.assign({}, a.ball, {x:a.ball.x+(b.ball.x-a.ball.x)*t,y:a.ball.y+(b.ball.y-a.ball.y)*t,z:a.ball.z+(b.ball.z-a.ball.z)*t}) });
    return out;
  }
  function playSound(type) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(type === 'score' ? 600 : 140, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(type === 'score' ? 900 : 65, audio.currentTime + 0.13);
      gain.gain.setValueAtTime(0.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.17);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.18);
    } catch (_) { muted = true; }
  }
  $('sound').addEventListener('click', () => { muted = !muted; $('sound').textContent = message(muted ? 'sound' : 'mute'); if (!muted) playSound('score'); });
  $('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.querySelector('.arena-panel').requestFullscreen) await document.querySelector('.arena-panel').requestFullscreen(); else toast('rotateHint'); } catch (_) { toast('rotateHint'); }
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
    }, error => { $('locate').disabled = false; $('mapStatus').textContent = message(error.code === 1 ? 'mapDenied' : 'mapUnavailable'); }, {enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  });
  async function benchmark() {
    const costs = [];
    // Measure actual drawing submission. RAM hints are optional and approximate.
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const before = performance.now(); renderer.render(core.getSnapshot(), { cameraAngle: 0 }); costs.push(performance.now() - before);
    }
    costs.sort((a, b) => a - b); benchmarkCost = costs[Math.floor(costs.length * 0.8)];
    const memoryHint = Number(navigator.deviceMemory) || null, coreHint = Number(navigator.hardwareConcurrency) || null;
    recommended = (memoryHint && memoryHint <= 2) || benchmarkCost > 15 ? 'lite' : (memoryHint && memoryHint <= 4) || (coreHint && coreHint <= 4) || benchmarkCost > 7 ? 'balanced' : 'full';
    benchmarkDone = true; if ($('quality').value === 'auto') setQuality(recommended);
    $('benchmarkStatus').textContent = message('quality') + ': ' + message(recommended);
    $('start').disabled = false;
  }
  $('start').disabled = true;
  function onEvents(events) {
    if (events.some(e => e.type === 'score')) playSound('score'); else if (events.some(e => e.type === 'pass')) playSound('pass');
    const rank = {dunk:6,three:5,layup:4,block:3,steal:2,score:1};
    const event = events.filter(e => rank[e.type]).sort((a,b) => rank[b.type] - rank[a.type])[0];
    if (event && !pendingHighlight && core.clock - lastHighlightAt > 12 && history.length > 20) { pendingHighlight = {event,until:core.clock+0.65}; lastHighlightAt = core.clock; }
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
          core.step(STEP, input()); actions.jump = actions.pass = actions.shootReleased = actions.switchPlayer = false;
          tickAccumulator -= STEP; capture(STEP); onEvents(core.consumeEvents());
          if (pendingHighlight && core.clock >= pendingHighlight.until) {
            const clip = {event:pendingHighlight.event,frames:history.filter(s => s.clock >= pendingHighlight.event.time - 2.8)};
            pendingHighlight = null; beginReplay(clip); tickAccumulator = 0; break;
          }
        }
      }
      const renderInterval = activeQuality === 'lite' ? 1000 / 30 : 1000 / 60;
      if (now - lastRender >= renderInterval - 1) {
        const snapshot = replayState ? replaySnapshot() : core.getSnapshot();
        renderer.render(snapshot, replayState ? {replay:true,cameraAngle:replayState.elapsed/replayState.duration*Math.PI*2+replayState.manualAngle,focusId:replayState.event.playerId} : {cameraAngle:0});
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
  if (window.ResizeObserver) new ResizeObserver(() => renderer.resize()).observe(canvas.parentElement);
  window.SAHoopsApp = {
    core, renderer,
    diagnostics: () => ({language,playing,paused,replay:!!replayState,quality:activeQuality,recommended,benchmarkCost,historyFrames:history.length,clipFrames:latestClip?latestClip.frames.length:0,liveClock:core.clock,canvasPixels:canvas.width*canvas.height,localAI:true,networkMultiplayer:false}),
    getReplay: () => latestClip,
    restart: startMatch
  };
  frameId = requestAnimationFrame(frame);
  benchmark().catch(() => { benchmarkDone = true; setQuality('lite'); $('start').disabled = false; $('benchmarkStatus').textContent = message('lite'); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && ownScript && ownScript.src) {
    navigator.serviceWorker.register(new URL('sw.js', assetBase).href).catch(() => {});
  }
  window.addEventListener('pagehide', () => { clearInput(); cancelAnimationFrame(frameId); });
  window.addEventListener('pageshow', e => { if(e.persisted){lastFrame=performance.now();frameId=requestAnimationFrame(frame);} });
})();
