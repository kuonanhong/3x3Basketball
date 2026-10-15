/* SmartAction Sports v7: sport picker, athlete line-ups with portraits, control labels, world venues,
   on-stage HUD text and the optional on-device CPU coach. MIT. */
(function () {
'use strict';
const ownScript = document.currentScript, assetBase = new URL('./', ownScript.src || document.baseURI);
const $ = id => document.getElementById(id), app = window.SAHoopsApp, catalog = window.SASportsData || { venues: [], athletes: [] };
const t = key => app.message(key);
const ORDER = ['basketball', 'basketball5', 'soccer5', 'baseball', 'softball', 'cricket', 'badminton', 'badminton-doubles', 'tabletennis', 'tabletennis-doubles', 'tennis', 'tennis-doubles', 'soft-tennis',
  'volleyball', 'beach-volleyball', 'sepak-takraw', 'handball', 'field-hockey', 'ice-hockey', 'water-polo', 'lacrosse', 'rugby', 'american-football', 'flag-football', 'squash', 'golf', 'bowling', 'billiards', 'sprint', 'archery'];
const basketballDefs = [
  { id: 'basketball', key: 'sport_basketball', ruleKey: 'rule_basketball', family: 'basketball', teamSize: 3, events: ['olympic', 'asianGames'] },
  { id: 'basketball5', key: 'sport_basketball5', ruleKey: 'rule_basketball5', family: 'basketball', teamSize: 5, events: ['olympic', 'asianGames', 'eastAsian'] }];
const sportDefinitions = ORDER.map(id => basketballDefs.find(d => d.id === id) || SASports.sports.find(s => s.id === id)).filter(Boolean);
let currentSport = 'basketball', selectedVenue = null, sceneImage = null, photoRequest = 0, currentPosition = null, locationBusy = false, coachBusy = false;
const imageCache = new Map(), portraits = {}, anonymous = { id: 'original', name: 'SmartAction', heightCm: 180, weightKg: 78, gameRatings: { speed: 60, skill: 60, power: 60, defense: 60, accuracy: 60 } };
let homeProfile = anonymous, awayProfile = anonymous;
function node(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function url(path) { return new URL(path, assetBase).href; }
function safeExternal(value) { try { const u = new URL(value); if (u.protocol === 'http:' && u.hostname === 'creativecommons.org') u.protocol = 'https:'; return u.protocol === 'https:' ? u.href : '#'; } catch { return '#'; } }
function link(text, href) { const a = node('a', text); a.href = safeExternal(href); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function cleanText(value) { const d = new DOMParser().parseFromString(String(value || ''), 'text/html'); return (d.body.textContent || '').trim().slice(0, 280); }
function localeName(item) { return app.getLanguage().startsWith('zh') && item.nameZh ? item.nameZh : item.name; }
function currentDefinition() { return sportDefinitions.find(s => s.id === currentSport) || sportDefinitions[0]; }
/* which catalogue pools feed each mode (first pool preferred, later pools fill the bench) */
function pools(sport) {
  const base = sport.replace(/-doubles$/, '');
  const map = { basketball5: ['basketball'], soccer5: ['soccer'], 'flag-football': ['flag-football', 'american-football'], 'beach-volleyball': ['beach-volleyball', 'volleyball'],
    'soft-tennis': ['soft-tennis', 'tennis'], softball: ['softball', 'baseball'], cricket: ['cricket'], 'sepak-takraw': ['sepak-takraw', 'volleyball'] };
  return map[base] || [base];
}
function athletePool() { const keys = pools(currentSport); return keys.flatMap(k => catalog.athletes.filter(a => a.sport === k)); }
function mapsURL(query) { const u = new URL('https://www.google.com/maps/search/'); u.searchParams.set('api', '1'); u.searchParams.set('query', query); return u.href; }
function configureMapLinks(lat, lon) { const p = lat.toFixed(6) + ',' + lon.toFixed(6); $('nearbyParksLink').href = mapsURL('parks near ' + p); $('nearbyCourtsLink').href = mapsURL(t(currentDefinition().key) + ' courts near ' + p); }
function photo(path) { if (!path) return Promise.resolve(null); const key = url(path); if (imageCache.has(key)) return imageCache.get(key); const job = new Promise(resolve => { const img = new Image(); img.decoding = 'async'; if (!key.startsWith(assetBase.origin)) img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = key; }); imageCache.set(key, job); return job; }
function creditNodes(host, credit) { host.replaceChildren(); if (!credit) { host.textContent = t('photoUnavailable'); return; } host.append(node('span', credit.author || '')); host.append(document.createTextNode(' · '), link(credit.license || t('license'), credit.licenseUrl || credit.sourceUrl), document.createTextNode(' · '), link(t('license'), credit.sourceUrl)); }
async function chooseVenue(venue) {
  selectedVenue = venue; const request = ++photoRequest; sceneImage = null;
  $('venueTitle').textContent = localeName(venue); $('sceneName').textContent = localeName(venue); $('venueBadge').textContent = venue.country || 'WORLD';
  $('venueMap').href = mapsURL(venue.lat + ',' + venue.lon); configureMapLinks(venue.lat, venue.lon);
  $('customLat').value = Number(venue.lat).toFixed(6); $('customLon').value = Number(venue.lon).toFixed(6);
  creditNodes($('venuePhotoCredit'), venue.credit); $('sceneCredit').textContent = venue.credit ? venue.credit.license + ' · ' + (venue.credit.author || '') : t('photoUnavailable'); $('sceneCredit').href = safeExternal(venue.credit?.sourceUrl || 'https://commons.wikimedia.org/');
  const img = await photo(venue.photo); if (request !== photoRequest) return; sceneImage = img;
  $('venuePhoto').hidden = !img; if (img) { $('venuePhoto').src = img.src; $('venuePhoto').alt = localeName(venue); }
}
function updateDestinationNames() { const old = $('destination').value; $('destination').replaceChildren(); catalog.venues.forEach(v => { const o = node('option', localeName(v)); o.value = v.id; $('destination').append(o); }); if (old) $('destination').value = old; }
function sportChanged(value) { currentSport = value || $('sport').value; $('sport').value = currentSport; $('sportQuick').value = currentSport; app.setSport(currentSport); populateAthletes(); refreshText(); }
function profilesChanged() { const pool = athletePool(); homeProfile = pool.find(a => a.id === $('homeAthlete').value) || anonymous; awayProfile = pool.find(a => a.id === $('awayAthlete').value) || anonymous; applyRoster(); renderCards(); }
function populateAthletes() {
  const pool = athletePool();
  for (const id of ['homeAthlete', 'awayAthlete']) {
    const old = $(id).value; $(id).replaceChildren(); const values = pool.length ? pool : [anonymous];
    values.forEach(a => { const o = node('option', localeName(a)); o.value = a.id; $(id).append(o); });
    if (values.some(a => a.id === old)) $(id).value = old; else $(id).selectedIndex = id === 'awayAthlete' && values.length > 1 ? 1 : 0;
  }
  profilesChanged();
}
/* Every on-field slot gets a distinct real athlete (when the pool is large enough): captain first, then the rest of the pool. */
function applyRoster() {
  const pool = athletePool(), n = app.core.players.filter(p => p.team === 0).length;
  const awayCaptain = awayProfile === homeProfile && pool.length > 1 ? (pool.find(a => a.id !== homeProfile.id) || anonymous) : awayProfile;
  const used = new Set([homeProfile.id, awayCaptain.id]);           // both captains are reserved before the benches fill
  function pick(captain, count) {
    const list = [];
    if (captain !== anonymous) list.push(captain);
    for (const a of pool) { if (list.length >= count) break; if (used.has(a.id)) continue; list.push(a); used.add(a.id); }
    let i = 0; while (list.length < count) list.push(pool.length ? pool[i++ % pool.length] : anonymous);     // small pools: reuse rather than leave slots empty
    return list;
  }
  const home = pick(homeProfile, n), away = pick(awayCaptain, n);
  app.core.players.forEach(p => {
    const slot = app.core.players.filter(x => x.team === p.team && x.id < p.id).length, profile = (p.team === 0 ? home : away)[slot] || anonymous;
    p.athleteId = profile.id; p.heightCm = profile.heightCm || 180; p.weightKg = profile.weightKg || 78; p.handedness = profile.handedness || 'right';
    p.gameRatings = Object.assign({ accuracy: profile.gameRatings?.skill || 60 }, profile.gameRatings); p.displayName = profile.name; p.appearance = profile.appearance ? Object.assign({}, profile.appearance) : null;
    if (profile.photo) photo(profile.photo).then(img => { if (img) portraits[profile.id] = img; });
  });
  const strip = $('teamRosters'); strip.replaceChildren();
  for (const [team, list] of [[0, home], [1, away]]) {
    const row = node('p'); row.append(node('span', (team ? t('awayTeam') : t('homeTeam')) + ' · '));
    list.forEach(a => row.append(node('span', localeName(a) + (a.countryCode ? ' ' + a.countryCode : ''), 'roster-chip' + (team ? ' away' : ''))));
    strip.append(row);
  }
}
function renderCards() {
  $('athleteCards').replaceChildren(); [homeProfile, awayProfile].forEach((a, index) => {
    const card = node('article', undefined, 'athlete-card ' + (index ? 'away' : 'home')); const img = node('img'); img.alt = a.name; img.loading = 'lazy';
    if (a.photo) { img.src = url(a.photo); img.addEventListener('error', () => { img.hidden = true; }, { once: true }); card.append(img); } else card.append(node('div', '◉', 'portrait-fallback'));
    card.append(node('h3', localeName(a) + (a.nameZh && !app.getLanguage().startsWith('zh') ? ' · ' + a.nameZh : '')), node('p', [a.country, a.era, a.notes].filter(Boolean).join(' · '), 'fine-note'));
    card.append(node('p', t('height') + ': ' + (a.heightCm ? a.heightCm + ' cm' : t('notAvailable')) + ' · ' + t('weight') + ': ' + (a.weightKg ? a.weightKg + ' kg' : t('notAvailable')), 'dimensions'));
    for (const key of ['speed', 'skill', 'power', 'defense', 'accuracy']) { const raw = a.gameRatings?.[key] ?? (key === 'accuracy' ? a.gameRatings?.skill : undefined); if (raw === undefined) continue; const v = Math.max(1, Math.min(99, Number(raw) || 50)), row = node('div', undefined, 'rating-row'); row.append(node('span', t(key))); const bar = node('meter'); bar.min = 0; bar.max = 100; bar.value = v; bar.setAttribute('aria-label', t(key)); row.append(bar, node('b', String(v))); card.append(row); }
    if (a.traits?.length) card.append(node('p', a.traits.join(' · '), 'fine-note'));
    const credits = node('p', undefined, 'photo-credit'); creditNodes(credits, a.credit); card.append(credits);
    if (a.sources?.length) { const refs = node('div', undefined, 'source-links'); a.sources.slice(0, 2).forEach((source, i) => { const href = typeof source === 'string' ? source : source.url || source.href; if (href) refs.append(link('↗ ' + (i + 1), href)); }); card.append(refs); }
    $('athleteCards').append(card);
  });
}
/* ---- control labels per sport family ---- */
function scheme() {
  const d = currentDefinition(), f = d.family, id = d.id;
  if (f === 'basketball') return { q: 'jump', e: 'crouch', j: 'pass', k: 'shoot', move: 'move', aim: 'aim', keyboard: 'keyboardActions', touch: 'touchHelp', charge: 'shootCharge', release: 'releaseToShoot', help: true };
  if (f === 'batting') return { q: 'powerSwing', e: 'contactSwing', j: 'actionBunt', k: 'actionSwing', move: 'batCursor', aim: 'launchAngle', keyboard: 'keyboardBatting', touch: 'touchBatting', charge: 'loadSwing', release: 'releaseToSwing' };
  if (f === 'golf') return { q: null, e: null, j: 'aimLine', k: 'actionGolf', move: 'move', aim: 'aim', keyboard: 'keyboardTarget', touch: 'touchGeneric', charge: 'powerMeter', release: 'releaseToShoot' };
  if (f === 'lane') return { q: null, e: null, j: 'aimLine', k: 'actionBowl', move: 'hook', aim: 'aim', keyboard: 'keyboardTarget', touch: 'touchGeneric', charge: 'powerMeter', release: 'releaseToShoot' };
  if (f === 'cue') return { q: null, e: null, j: 'aimLine', k: 'actionCue', move: 'move', aim: 'aim', keyboard: 'keyboardTarget', touch: 'touchGeneric', charge: 'powerMeter', release: 'releaseToShoot' };
  if (f === 'target') return { q: null, e: null, j: 'aimLine', k: 'actionTarget', move: 'move', aim: 'aim', keyboard: 'keyboardTarget', touch: 'touchGeneric', charge: 'powerMeter', release: 'releaseToShoot' };
  if (f === 'race') return { q: null, e: null, j: 'actionRun', k: 'actionRun', move: 'move', aim: 'aim', keyboard: 'keyboardGeneric', touch: 'touchGeneric', charge: 'powerMeter', release: 'releaseToShoot' };
  if (f === 'wall') return { q: 'jump', e: 'crouch', j: 'pass', k: 'actionWallHit', move: 'move', aim: 'aim', keyboard: 'keyboardGeneric', touch: 'touchGeneric', charge: 'powerMeter', release: 'releaseToShoot' };
  if (f === 'net') return { q: 'jump', e: 'crouch', j: 'pass', k: d.kick ? 'actionKick' : 'actionRacket', move: 'move', aim: 'aim', keyboard: 'keyboardGeneric', touch: 'touchGeneric', charge: 'powerMeter', release: 'releaseToShoot' };
  if (f === 'carry') return { q: 'jump', e: 'actionDefend', j: 'pass', k: 'actionThrow', move: 'move', aim: 'aim', keyboard: 'keyboardGeneric', touch: 'touchGeneric', charge: 'powerMeter', release: 'releaseToShoot' };
  return { q: 'jump', e: 'actionDefend', j: 'pass', k: id === 'water-polo' ? 'actionSwimThrow' : d.stick ? 'actionStick' : id === 'soccer5' ? 'actionKick' : 'actionGoal', move: 'move', aim: 'aim', keyboard: 'keyboardGeneric', touch: 'touchGeneric', charge: 'powerMeter', release: 'releaseToShoot' };
}
function eventTags(def) { return (def.events || []).map(tag => t('tag_' + tag)).join(' · '); }
function refreshText() {
  for (const select of [$('sport'), $('sportQuick')]) Array.from(select.options).forEach(o => o.textContent = t('sport_' + o.value));
  const def = currentDefinition(), s = scheme();
  $('sportRules').textContent = t('rule_' + currentSport); $('eventTags').textContent = eventTags(def);
  $('sportBadge').textContent = currentSport === 'basketball' ? '3×3' : currentSport === 'basketball5' ? '5×5' : currentSport === 'soccer5' ? '5×5' : t('sport_' + currentSport);
  $('eventBadge').textContent = eventTags(def);
  $('startTitle').textContent = t('sport_' + currentSport); $('startRule').textContent = t('rule_' + currentSport);
  $('primaryAction').textContent = t(s.k); $('labelPass').textContent = t(s.j); $('labelJump').textContent = s.q ? t(s.q) : ''; $('labelCrouch').textContent = s.e ? t(s.e) : '';
  document.querySelector('[data-action="jump"]').hidden = !s.q; document.querySelector('[data-action="crouch"]').hidden = !s.e;
  $('moveCaption').textContent = t(s.move); $('aimCaption').textContent = t(s.aim);
  $('chargeAction').textContent = t(s.charge); $('chargeHint').textContent = t(s.release);
  $('keyboardActionsText').textContent = t(s.keyboard); $('touchActionsText').textContent = t(s.touch);
  $('keyboardMoveText').textContent = s.move === 'move' ? t('keyboardMove') : 'W/A/S/D: ' + t(s.move); $('keyboardAimText').textContent = s.aim === 'aim' ? t('keyboardAim') : '← ↑ ↓ →: ' + t(s.aim);
  $('chargeHelpText').hidden = def.family !== 'basketball'; $('helpCharge').hidden = def.family !== 'basketball'; $('helpPractice').hidden = def.family !== 'basketball';
  $('helpSportRule').textContent = t('rule_' + currentSport); $('helpKeyboard').textContent = t(s.keyboard); $('helpTouch').textContent = t(s.touch);
  $('countHud').hidden = def.family !== 'batting';
  $('coachQuestion').placeholder = t('coachPlaceholder'); $('zoom').setAttribute('aria-label', t('zoom'));
  updateDestinationNames(); if (selectedVenue) { $('venueTitle').textContent = localeName(selectedVenue); $('sceneName').textContent = localeName(selectedVenue); }
  Array.from($('homeAthlete').options).forEach(o => { const a = catalog.athletes.find(x => x.id === o.value); if (a) o.textContent = localeName(a); });
  Array.from($('awayAthlete').options).forEach(o => { const a = catalog.athletes.find(x => x.id === o.value); if (a) o.textContent = localeName(a); });
  renderCards(); applyRoster(); updateCoachStatus(); updateMetrics(app.core);
}
function competitionChanged() { const d = { street: 'easy', professional: 'normal', elite: 'hard' }[$('competition').value]; $('difficulty').value = d; app.core.difficulty = d; if ($('competition').value !== 'street' && $('venueMode').value === 'park') $('venueMode').value = 'home'; }
function updateCoachStatus(extra) { const st = window.SACoach?.status?.() || { state: 'unloaded' }; const map = { unloaded: 'coachIdle', loading: 'coachLoading', ready: 'coachReady', generating: 'coachThinking', error: 'coachError' }; $('coachStatus').textContent = t(map[st.state] || 'coachIdle') + ((extra || st.error) ? ' · ' + String(extra || st.error).slice(0, 180) : ''); $('loadCoach').disabled = st.state === 'loading' || st.state === 'generating'; }
function line(role, text) { const p = node('p', text, 'chat-line ' + role); $('coachTranscript').append(p); while ($('coachTranscript').children.length > 12) $('coachTranscript').firstElementChild.remove(); $('coachTranscript').scrollTop = $('coachTranscript').scrollHeight; return p; }
async function askCoach() {
  const question = $('coachQuestion').value.trim(); if (!question || coachBusy) return; app.setPaused(true); line('user', question); const output = line('assistant', '');
  if (!window.SACoach || SACoach.status().state !== 'ready') { output.textContent = t('coachOffline') + ' · ' + t('rule_' + currentSport); return; }
  coachBusy = true; $('askCoach').disabled = true;
  try { output.textContent = t('coachThinking'); const answer = await SACoach.ask(question, { language: app.getLanguage(), sport: currentSport, sportName: t('sport_' + currentSport), rule: t('rule_' + currentSport), level: $('competition').value, player: { name: homeProfile.name, gameRatings: homeProfile.gameRatings, traits: homeProfile.traits }, opponent: { name: awayProfile.name, gameRatings: awayProfile.gameRatings }, metrics: app.core.metrics || null, onToken: token => { if (output.textContent === t('coachThinking')) output.textContent = ''; output.textContent += token; } }); output.textContent = answer || t('coachError'); }
  catch (e) { output.textContent = t('coachError') + ' · ' + String(e.message || e).slice(0, 180); }
  finally { coachBusy = false; $('askCoach').disabled = false; updateCoachStatus(); }
}
function nearestVenues(lat, lon) { return catalog.venues.map(v => ({ ...v, distance: 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin((v.lat - lat) * Math.PI / 360) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(v.lat * Math.PI / 180) * Math.sin((v.lon - lon) * Math.PI / 360) ** 2))) })).sort((a, b) => a.distance - b.distance).slice(0, 3); }
function localNearby(lat, lon) { $('nearbyResults').replaceChildren(); nearestVenues(lat, lon).forEach(v => { const b = node('button', undefined, 'nearby-card'); if (v.photo) { const im = node('img'); im.src = url(v.photo); im.alt = localeName(v); im.loading = 'lazy'; b.append(im); } b.append(node('strong', localeName(v)), node('span', v.distance.toFixed(1) + ' km')); b.addEventListener('click', () => { chooseVenue(v); $('destination').value = v.id; }); $('nearbyResults').append(b); }); }
function usePosition(lat, lon, accuracy) { currentPosition = { lat, lon }; configureMapLinks(lat, lon); $('worldStatus').textContent = lat.toFixed(6) + ', ' + lon.toFixed(6) + (accuracy ? ' · ±' + Math.round(accuracy) + ' m' : ''); $('customLat').value = lat; $('customLon').value = lon; localNearby(lat, lon); }
function locate() { if (locationBusy) return; if (!navigator.geolocation) { $('worldStatus').textContent = t('locationError'); return; } locationBusy = true; $('locateWorld').disabled = true; $('worldStatus').textContent = t('locating'); navigator.geolocation.getCurrentPosition(p => { locationBusy = false; $('locateWorld').disabled = false; usePosition(p.coords.latitude, p.coords.longitude, p.coords.accuracy); }, e => { locationBusy = false; $('locateWorld').disabled = false; $('worldStatus').textContent = t(e.code === 1 ? 'locationDenied' : 'locationError'); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }); }
async function searchNearby() {
  const pos = currentPosition || selectedVenue; if (!pos) return; const lat = pos.lat, lon = pos.lon; $('searchNearby').disabled = true; $('worldStatus').textContent = t('searching'); const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const api = new URL('https://commons.wikimedia.org/w/api.php'); Object.entries({ action: 'query', format: 'json', origin: '*', generator: 'geosearch', ggscoord: lat + '|' + lon, ggsradius: '10000', ggsnamespace: '6', ggslimit: '18', prop: 'imageinfo|coordinates', iiprop: 'url|extmetadata|mime', iiurlwidth: '720', coprimary: 'primary' }).forEach(([k, v]) => api.searchParams.set(k, v));
    const response = await fetch(api, { signal: controller.signal, credentials: 'omit' }); if (!response.ok) throw Error('HTTP ' + response.status); const json = await response.json(); const found = [];
    for (const page of Object.values(json.query?.pages || {})) { const ii = page.imageinfo?.[0], meta = ii?.extmetadata, license = cleanText(meta?.LicenseShortName?.value); if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime) || !/(^CC BY(?:-SA)?\s*[1-4]|^CC0|public domain)/i.test(license)) continue; const photoURL = ii.thumburl || ii.url; if (!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(photoURL)) continue; const c = page.coordinates?.[0]; found.push({ id: 'commons-' + page.pageid, name: page.title.replace(/^File:/, ''), lat: c?.lat ?? lat, lon: c?.lon ?? lon, kind: 'nearby', photo: photoURL, credit: { author: cleanText(meta.Artist?.value), license, licenseUrl: meta.LicenseUrl?.value || ii.descriptionurl, sourceUrl: ii.descriptionurl } }); }
    if (!found.length) { $('worldStatus').textContent = t('nearbyEmpty'); localNearby(lat, lon); return; }
    $('nearbyResults').replaceChildren(); found.slice(0, 8).forEach(v => { const b = node('button', undefined, 'nearby-card'), im = node('img'); im.src = v.photo; im.alt = v.name; im.loading = 'lazy'; b.append(im, node('strong', v.name), node('span', v.credit.license)); b.addEventListener('click', () => chooseVenue(v)); $('nearbyResults').append(b); }); $('worldStatus').textContent = t('nearbyCredit') + ' · ' + found.length;
  } catch (e) { $('worldStatus').textContent = t('locationError') + ' · ' + t('nearbyEmpty'); localNearby(lat, lon); } finally { clearTimeout(timer); $('searchNearby').disabled = false; }
}
/* ---- on-stage metrics ---- */
const SCALE = 3;        // batting fields are modelled at 1/3 scale; distances and speeds are shown in real-world-like units
function fmt(n, d) { return Number.isFinite(n) ? n.toFixed(d === undefined ? 1 : d) : '—'; }
function updateMetrics(core) {
  const m = core.metrics || {}, def = currentDefinition(), f = def.family, parts = [], hud = [];
  if (f === 'batting') {
    const cricket = def.id === 'cricket';
    $('countBalls').textContent = cricket ? String(m.runs || 0) : String(m.balls || 0); $('countStrikes').textContent = cricket ? String(m.wickets || 0) : String(m.strikes || 0);
    $('countOuts').textContent = cricket ? String(Math.floor((m.deliveries || 0) / 6)) + '.' + ((m.deliveries || 0) % 6) : String(m.outs || 0); $('countInning').textContent = cricket ? String(m.deliveries || 0) : String(m.inning || 1);
    const labels = cricket ? ['runs', 'wickets', 'overs', 'balls'] : ['balls', 'strikes', 'outs', 'inning'];
    $('countHud').querySelectorAll('.count-group b').forEach((b, i) => { b.textContent = t(labels[i]); });
    $('countPitch').textContent = m.pitchType ? t('pitch_' + m.pitchType) + ' · ' + Math.round((m.pitchSpeed || 0) * SCALE * 3.6 / 1.25) + ' km/h' : t('pitcherReady');
    if (m.hits) { hud.push(t('exitVelocity') + ' ' + Math.round((m.exitVelocity || 0) * SCALE * 3.6 / 1.25) + ' km/h'); hud.push(t('launchAngle') + ' ' + fmt(m.launchAngle, 0) + '°'); hud.push(t('distance') + ' ' + fmt((m.lastDistance || 0) * SCALE, 0) + ' m'); }
    if (m.timingError) hud.push(t('swingTiming') + ' ' + (m.swingTiming > 0.85 ? t('timingPerfect') : m.timingError < 0 ? t('timingEarly') : t('timingLate')) + ' ' + fmt(Math.abs(m.timingError) * 1000, 0) + ' ms');
    parts.push(t('hits' in m ? 'contactQuality' : 'accuracy') + ': ' + fmt(m.contactQuality, 2), t('distance') + ': ' + fmt((m.bestDistance || 0) * SCALE, 0) + ' m', (cricket ? t('runs') : t('result_homeRun')) + ': ' + (cricket ? m.runs : m.homeRuns));
  } else if (f === 'golf') { hud.push(t('strokes') + ' ' + (m.holeStrokes || 0), t('distanceToHole') + ' ' + fmt(m.distanceToHole, 1) + ' m', t('windLabel') + ' ' + (m.windX > 0 ? '→' : '←') + ' ' + fmt(Math.abs(m.windX), 1)); parts.push(t('strokes') + ': ' + (m.strokes || 0)); }
  else if (f === 'lane') { hud.push(t('inning') + ' ' + (m.frame || 1) + ' · ' + (m.roll || 1), t('pins') + ' ' + (m.lastPins || 0), t('strikeBowling') + ' ' + (m.strikesBowl || 0) + ' · ' + t('spare') + ' ' + (m.spares || 0)); }
  else if (f === 'cue') { hud.push(t('pocketed') + ' ' + (m.pocketed || 0), t('scratch') + ' ' + (m.scratches || 0), (core.getSnapshot ? (m.turn === 1 ? t('awayTeam') : t('homeTeam')) : '')); }
  else if (f === 'net' || f === 'wall') { hud.push(t('highlight_rally') + ' ' + (m.rally || 0) + ' / ' + (m.longestRally || 0)); }
  else if (f === 'race') { hud.push(t('distance') + ' ' + fmt(m.distance, 1) + ' m'); }
  else if (f === 'target') { hud.push(t('accuracy') + ' ' + (m.lastRing || 0), t('windLabel') + ' ' + fmt(m.wind, 2)); }
  else if (currentSport === 'basketball' || currentSport === 'basketball5' || f === 'goal' || f === 'carry') { hud.push(t('possession') + ' ' + (core.possessionTeam === 0 ? t('homeTeam') : t('awayTeam'))); }
  const fields = currentSport === 'sprint' ? ['distance'] : [];
  for (const k of fields) if (Number.isFinite(m[k])) parts.push(t(k) + ': ' + m[k].toFixed(2));
  if (f === 'batting' && Number.isFinite(m.swingTiming)) parts.unshift(t('batTiming') + ': ' + m.swingTiming.toFixed(2), t('distance') + ': ' + fmt(m.lastDistance, 2));
  $('sportMetrics').textContent = parts.join(' · '); $('metricsHud').textContent = hud.join('  ·  ');
}
window.SASportsUI = {
  renderOptions: () => ({ view: $('camera').value, zoom: Number($('zoom').value), cameraAngle: 0, playerScale: 1.18, names: true, environment: { time: $('timeOfDay').value, weather: $('weather').value, season: $('season').value, climate: $('climate').value, venue: $('venueMode').value, photo: sceneImage }, portraits }),
  updateMetrics,
  getContext: () => ({ sport: currentSport, venue: selectedVenue?.id, language: app.getLanguage(), home: homeProfile.id, away: awayProfile.id }), applyRoster, selectVenue: chooseVenue, definitions: sportDefinitions, pools
};
for (const select of [$('sport'), $('sportQuick')]) sportDefinitions.forEach(s => { const o = node('option', t(s.key)); o.value = s.id; select.append(o); });
$('sport').addEventListener('change', () => sportChanged($('sport').value)); $('sportQuick').addEventListener('change', () => sportChanged($('sportQuick').value));
$('camera').addEventListener('change', () => { $('cameraQuick').value = $('camera').value; }); $('cameraQuick').addEventListener('change', () => { $('camera').value = $('cameraQuick').value; });
$('competition').addEventListener('change', competitionChanged); $('homeAthlete').addEventListener('change', profilesChanged); $('awayAthlete').addEventListener('change', profilesChanged);
$('destination').addEventListener('change', () => { const v = catalog.venues.find(v => v.id === $('destination').value); if (v) chooseVenue(v); });
$('locateWorld').addEventListener('click', locate); $('searchNearby').addEventListener('click', searchNearby); $('applyLocation').addEventListener('click', () => { const lat = Number($('customLat').value), lon = Number($('customLon').value); if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !$('customLat').value.trim() || !$('customLon').value.trim()) { $('worldStatus').textContent = t('locationError'); return; } usePosition(lat, lon); });
$('court').addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); $('zoom').value = String(Math.max(.6, Math.min(1.8, Number($('zoom').value) - Math.sign(e.deltaY) * .05))); } }, { passive: false });
window.addEventListener('sa-language', refreshText); window.addEventListener('sa-match-reset', applyRoster);
if (window.SACoach) { SACoach.init({ onState: () => updateCoachStatus(), onProgress: p => { const number = typeof p === 'number' ? p : (p.progress ?? p.ratio ?? 0); $('coachProgress').hidden = false; $('coachProgress').value = number > 1 ? number / 100 : number; updateCoachStatus(); } }); }
$('loadCoach').addEventListener('click', async () => { app.setPaused(true); try { await SACoach.load({ onProgress: p => { const ratio = typeof p === 'number' ? p : (p.progress ?? p.ratio ?? 0); $('coachProgress').hidden = false; $('coachProgress').value = ratio > 1 ? ratio / 100 : ratio; } }); } catch (e) { updateCoachStatus(String(e.message || e).slice(0, 150)); } finally { $('coachProgress').hidden = true; updateCoachStatus(); } });
$('unloadCoach').addEventListener('click', () => { SACoach?.unload(); updateCoachStatus(); }); $('cancelCoach').addEventListener('click', () => { SACoach?.cancel(); updateCoachStatus(); }); $('askCoach').addEventListener('click', askCoach); $('coachQuestion').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); askCoach(); } });
$('offlinePrepare').addEventListener('click', async () => { const b = $('offlinePrepare'); b.disabled = true; b.textContent = t('offlinePreparing'); try { if (!('serviceWorker' in navigator) || location.protocol === 'file:') throw Error('HTTPS or localhost required'); let readyTimer; const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => { readyTimer = setTimeout(() => reject(Error('Service Worker unavailable')), 30000); })]).finally(() => clearTimeout(readyTimer)); const channel = new MessageChannel(); await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(Error('timeout')), 90000); channel.port1.onmessage = e => { if (e.data.done || e.data.ok) { clearTimeout(timeout); resolve(); } if (e.data.error) { clearTimeout(timeout); reject(Error(e.data.error)); } }; reg.active.postMessage({ type: 'CACHE_SPORTS' }, [channel.port2]); }); b.textContent = t('offlineReady'); } catch (e) { b.textContent = t('offlineError'); } finally { b.disabled = false; } });
const initialSport = new URLSearchParams(location.search).get('sport');
updateDestinationNames(); populateAthletes(); refreshText(); if (catalog.venues[0]) chooseVenue(catalog.venues[0]);
if (initialSport && sportDefinitions.some(s => s.id === initialSport)) sportChanged(initialSport);
})();
