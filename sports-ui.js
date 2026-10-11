/* SmartAction Sports v6: local UI, open maps, licensed photos and optional CPU coach. MIT. */
(function(){
'use strict';
const ownScript=document.currentScript, assetBase=new URL('./',ownScript.src||document.baseURI);
const $=id=>document.getElementById(id), app=window.SAHoopsApp, catalog=window.SASportsData||{venues:[],athletes:[]};
const t=key=>app.message(key), sportDefinitions=[{id:'basketball',key:'sport_basketball',ruleKey:'rule_basketball',family:'basketball'},...SASports.sports];
let currentSport='basketball', selectedVenue=null, sceneImage=null, photoRequest=0, currentPosition=null, locationBusy=false, coachBusy=false;
const imageCache=new Map(), anonymous={id:'original',name:'SmartAction',heightCm:180,weightKg:78,gameRatings:{speed:60,skill:60,power:60,defense:60}};
let homeProfile=anonymous,awayProfile=anonymous;
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function url(path){return new URL(path,assetBase).href;}
function safeExternal(value){try{const u=new URL(value);if(u.protocol==='http:'&&u.hostname==='creativecommons.org')u.protocol='https:';return u.protocol==='https:'?u.href:'#';}catch{return '#';}}
function link(text,href){const a=node('a',text);a.href=safeExternal(href);a.target='_blank';a.rel='noopener noreferrer';return a;}
function cleanText(value){const d=new DOMParser().parseFromString(String(value||''),'text/html');return(d.body.textContent||'').trim().slice(0,280);}
function localeName(item){return app.getLanguage().startsWith('zh')&&item.nameZh?item.nameZh:item.name;}
function currentDefinition(){return sportDefinitions.find(s=>s.id===currentSport)||sportDefinitions[0];}
function category(){return currentSport.startsWith('soccer')?'soccer':currentSport.replace(/-doubles$/,'')==='sprint'?'athletics':currentSport.replace(/-doubles$/,'');}
function athletePool(){return catalog.athletes.filter(a=>a.sport===category());}
function mapsURL(query){const u=new URL('https://www.google.com/maps/search/');u.searchParams.set('api','1');u.searchParams.set('query',query);return u.href;}
function configureMapLinks(lat,lon){const p=lat.toFixed(6)+','+lon.toFixed(6);$('nearbyParksLink').href=mapsURL('parks near '+p);$('nearbyCourtsLink').href=mapsURL(t(currentDefinition().key)+' courts near '+p);}
function photo(path){if(!path)return Promise.resolve(null);const key=url(path);if(imageCache.has(key))return imageCache.get(key);const job=new Promise(resolve=>{const img=new Image();img.decoding='async';if(!key.startsWith(assetBase.origin))img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=key;});imageCache.set(key,job);return job;}
function creditNodes(host,credit){host.replaceChildren();if(!credit){host.textContent=t('photoUnavailable');return;}host.append(node('span',credit.author||''));host.append(document.createTextNode(' · '),link(credit.license||t('license'),credit.licenseUrl||credit.sourceUrl),document.createTextNode(' · '),link(t('license'),credit.sourceUrl));}
async function chooseVenue(venue){
 selectedVenue=venue;const request=++photoRequest;sceneImage=null;
 $('venueTitle').textContent=localeName(venue);$('sceneName').textContent=localeName(venue);$('venueBadge').textContent=venue.country||'WORLD';
 $('venueMap').href=mapsURL(venue.lat+','+venue.lon);configureMapLinks(venue.lat,venue.lon);
 $('customLat').value=Number(venue.lat).toFixed(6);$('customLon').value=Number(venue.lon).toFixed(6);
 creditNodes($('venuePhotoCredit'),venue.credit);$('sceneCredit').textContent=venue.credit?venue.credit.license+' · '+(venue.credit.author||''):t('photoUnavailable');$('sceneCredit').href=safeExternal(venue.credit?.sourceUrl||'https://commons.wikimedia.org/');
 const img=await photo(venue.photo);if(request!==photoRequest)return;sceneImage=img;
 $('venuePhoto').hidden=!img;if(img){$('venuePhoto').src=img.src;$('venuePhoto').alt=localeName(venue);}
}
function updateDestinationNames(){const old=$('destination').value;$('destination').replaceChildren();catalog.venues.forEach(v=>{const o=node('option',localeName(v));o.value=v.id;$('destination').append(o);});if(old)$('destination').value=old;}
function sportChanged(){currentSport=$('sport').value;app.setSport(currentSport);populateAthletes();refreshText();}
function profilesChanged(){const pool=athletePool();homeProfile=pool.find(a=>a.id===$('homeAthlete').value)||anonymous;awayProfile=pool.find(a=>a.id===$('awayAthlete').value)||anonymous;applyRoster();renderCards();}
function populateAthletes(){const pool=athletePool();for(const id of ['homeAthlete','awayAthlete']){const old=$(id).value;$(id).replaceChildren();const values=pool.length?pool:[anonymous];values.forEach(a=>{const o=node('option',a.name);o.value=a.id;$(id).append(o);});if(values.some(a=>a.id===old))$(id).value=old;else $(id).selectedIndex=id==='awayAthlete'&&values.length>1?1:0;}profilesChanged();}
function applyRoster(){
 const pool=athletePool(), roster=[[],[]];
 app.core.players.forEach((p,index)=>{const captain=p.team===0?homeProfile:awayProfile;const teamIndex=app.core.players.filter(x=>x.team===p.team&&x.id<p.id).length;const start=Math.max(0,pool.findIndex(a=>a.id===captain.id));const profile=teamIndex===0?captain:(pool[(start+teamIndex)%Math.max(pool.length,1)]||anonymous);
  p.athleteId=profile.id;p.heightCm=profile.heightCm||180;p.weightKg=profile.weightKg||78;p.gameRatings={...profile.gameRatings};p.displayName=profile.name;roster[p.team].push(profile===anonymous?'S'+(teamIndex+1):profile.name);
 });
 $('teamRosters').replaceChildren(node('p',t('homeTeam')+' · '+roster[0].join(' / ')),node('p',t('awayTeam')+' · '+roster[1].join(' / ')));
}
function renderCards(){
 $('athleteCards').replaceChildren();[homeProfile,awayProfile].forEach((a,index)=>{
  const card=node('article',undefined,'athlete-card '+(index?'away':'home'));const img=node('img');img.alt=a.name;img.loading='lazy';if(a.photo){img.src=url(a.photo);img.addEventListener('error',()=>{img.hidden=true;},{once:true});card.append(img);}else card.append(node('div','◉','portrait-fallback'));
  card.append(node('h3',a.name),node('p',[a.country,a.era].filter(Boolean).join(' · '),'fine-note'));
  card.append(node('p',t('height')+': '+(a.heightCm?a.heightCm+' cm':t('notAvailable'))+' · '+t('weight')+': '+(a.weightKg?a.weightKg+' kg':t('notAvailable')),'dimensions'));
  for(const key of ['speed','skill','power','defense']){const v=Math.max(1,Math.min(99,Number(a.gameRatings?.[key])||50)),row=node('div',undefined,'rating-row');row.append(node('span',t(key)));const bar=node('meter');bar.min=0;bar.max=100;bar.value=v;bar.setAttribute('aria-label',t(key));row.append(bar,node('b',String(v)));card.append(row);}
  const credits=node('p',undefined,'photo-credit');creditNodes(credits,a.credit);card.append(credits);
  if(a.sources?.length){const refs=node('div',undefined,'source-links');a.sources.slice(0,2).forEach((source,i)=>{const href=typeof source==='string'?source:source.url||source.href; if(href)refs.append(link('↗ '+(i+1),href));});card.append(refs);}
  $('athleteCards').append(card);
 });
}
function refreshText(){
 Array.from($('sport').options).forEach(o=>o.textContent=t('sport_'+o.value));
 $('sportRules').textContent=t('rule_'+currentSport);$('sportBadge').textContent=currentSport==='basketball'?'3×3':currentSport==='soccer5'?'5×5':t('sport_'+currentSport);
 const family=currentDefinition().family;
 const action=currentSport==='basketball'?'shoot':currentSport==='baseball'?'actionBat':currentSport==='archery'?'actionTarget':currentSport==='sprint'?'actionRun':/net|racket/.test(family)||/tennis|badminton|volleyball/.test(currentSport)?'actionRacket':/american|rugby/.test(currentSport)?'actionThrow':'actionGoal';
 $('primaryAction').textContent=t(action);document.querySelectorAll('[data-action="twistLeft"],[data-action="twistRight"],[data-action="shoulderUp"],[data-action="shoulderDown"]').forEach(e=>{e.hidden=currentSport!=='baseball';});
 $('helpSportRule').textContent=t('rule_'+currentSport);$('chargeAction').textContent=t(action);
 document.querySelectorAll('[data-i18n="practiceNotice"],[data-i18n="chargeHelp"],[data-i18n="keyboardActions"],[data-i18n="keyboardHelp"],[data-i18n="touchHelp"]').forEach(e=>{e.hidden=currentSport!=='basketball';});
 $('coachQuestion').placeholder=t('coachPlaceholder');$('zoom').setAttribute('aria-label',t('zoom'));
 updateDestinationNames();if(selectedVenue){$('venueTitle').textContent=localeName(selectedVenue);$('sceneName').textContent=localeName(selectedVenue);}renderCards();applyRoster();updateCoachStatus();
}
function competitionChanged(){const d={street:'easy',professional:'normal',elite:'hard'}[$('competition').value];$('difficulty').value=d;app.core.difficulty=d;if($('competition').value!=='street'&&$('venueMode').value==='park')$('venueMode').value='home';}
function updateCoachStatus(extra){const st=window.SACoach?.status?.()||{state:'unloaded'};const map={unloaded:'coachIdle',loading:'coachLoading',ready:'coachReady',generating:'coachThinking',error:'coachError'};$('coachStatus').textContent=t(map[st.state]||'coachIdle')+((extra||st.error)?' · '+String(extra||st.error).slice(0,180):'');$('loadCoach').disabled=st.state==='loading'||st.state==='generating';}
function line(role,text){const p=node('p',text,'chat-line '+role);$('coachTranscript').append(p);while($('coachTranscript').children.length>12)$('coachTranscript').firstElementChild.remove();$('coachTranscript').scrollTop=$('coachTranscript').scrollHeight;return p;}
async function askCoach(){const question=$('coachQuestion').value.trim();if(!question||coachBusy)return;app.setPaused(true);line('user',question);const output=line('assistant','');
 if(!window.SACoach||SACoach.status().state!=='ready'){output.textContent=t('coachRuleLabel')+' · '+t('rule_'+currentSport);return;}
 coachBusy=true;$('askCoach').disabled=true;try{output.textContent=t('coachThinking');const answer=await SACoach.ask(question,{language:app.getLanguage(),sport:currentSport,level:$('competition').value,player:{name:homeProfile.name,gameRatings:homeProfile.gameRatings},opponent:{name:awayProfile.name,gameRatings:awayProfile.gameRatings},onToken:token=>{if(output.textContent===t('coachThinking'))output.textContent='';output.textContent+=token;}});output.textContent=answer||t('coachError');}catch(e){output.textContent=t('coachError')+' · '+String(e.message||e).slice(0,180);}finally{coachBusy=false;$('askCoach').disabled=false;updateCoachStatus();}}
function nearestVenues(lat,lon){return catalog.venues.map(v=>({...v,distance:6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin((v.lat-lat)*Math.PI/360)**2+Math.cos(lat*Math.PI/180)*Math.cos(v.lat*Math.PI/180)*Math.sin((v.lon-lon)*Math.PI/360)**2)))})).sort((a,b)=>a.distance-b.distance).slice(0,3);}
function localNearby(lat,lon){$('nearbyResults').replaceChildren();nearestVenues(lat,lon).forEach(v=>{const b=node('button',undefined,'nearby-card');if(v.photo){const im=node('img');im.src=url(v.photo);im.alt=localeName(v);im.loading='lazy';b.append(im);}b.append(node('strong',localeName(v)),node('span',v.distance.toFixed(1)+' km'));b.addEventListener('click',()=>{chooseVenue(v);$('destination').value=v.id;});$('nearbyResults').append(b);});}
function usePosition(lat,lon,accuracy){currentPosition={lat,lon};configureMapLinks(lat,lon);$('worldStatus').textContent=lat.toFixed(6)+', '+lon.toFixed(6)+(accuracy?' · ±'+Math.round(accuracy)+' m':'');$('customLat').value=lat;$('customLon').value=lon;localNearby(lat,lon);}
function locate(){if(locationBusy)return;if(!navigator.geolocation){$('worldStatus').textContent=t('locationError');return;}locationBusy=true;$('locateWorld').disabled=true;$('worldStatus').textContent=t('locating');navigator.geolocation.getCurrentPosition(p=>{locationBusy=false;$('locateWorld').disabled=false;usePosition(p.coords.latitude,p.coords.longitude,p.coords.accuracy);},e=>{locationBusy=false;$('locateWorld').disabled=false;$('worldStatus').textContent=t(e.code===1?'locationDenied':'locationError');},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});}
async function searchNearby(){const pos=currentPosition||selectedVenue;if(!pos)return;const lat=pos.lat,lon=pos.lon;$('searchNearby').disabled=true;$('worldStatus').textContent=t('searching');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const api=new URL('https://commons.wikimedia.org/w/api.php');Object.entries({action:'query',format:'json',origin:'*',generator:'geosearch',ggscoord:lat+'|'+lon,ggsradius:'10000',ggsnamespace:'6',ggslimit:'18',prop:'imageinfo|coordinates',iiprop:'url|extmetadata|mime',iiurlwidth:'720',coprimary:'primary'}).forEach(([k,v])=>api.searchParams.set(k,v));const response=await fetch(api,{signal:controller.signal,credentials:'omit'});if(!response.ok)throw Error('HTTP '+response.status);const json=await response.json();const found=[];
 for(const page of Object.values(json.query?.pages||{})){const ii=page.imageinfo?.[0],meta=ii?.extmetadata,license=cleanText(meta?.LicenseShortName?.value);if(!ii||!/^image\/(jpeg|png|webp)$/.test(ii.mime)||!/(^CC BY(?:-SA)?\s*[1-4]|^CC0|public domain)/i.test(license))continue;const photoURL=ii.thumburl||ii.url;if(!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(photoURL))continue;const c=page.coordinates?.[0];found.push({id:'commons-'+page.pageid,name:page.title.replace(/^File:/,''),lat:c?.lat??lat,lon:c?.lon??lon,kind:'nearby',photo:photoURL,credit:{author:cleanText(meta.Artist?.value),license,licenseUrl:meta.LicenseUrl?.value||ii.descriptionurl,sourceUrl:ii.descriptionurl}});}
 if(!found.length){$('worldStatus').textContent=t('nearbyEmpty');localNearby(lat,lon);return;}$('nearbyResults').replaceChildren();found.slice(0,8).forEach(v=>{const b=node('button',undefined,'nearby-card'),im=node('img');im.src=v.photo;im.alt=v.name;im.loading='lazy';b.append(im,node('strong',v.name),node('span',v.credit.license));b.addEventListener('click',()=>chooseVenue(v));$('nearbyResults').append(b);});$('worldStatus').textContent=t('nearbyCredit')+' · '+found.length;
 }catch(e){$('worldStatus').textContent=t('locationError')+' · '+t('nearbyEmpty');localNearby(lat,lon);}finally{clearTimeout(timer);$('searchNearby').disabled=false;}}
const metricKeys={distance:'distance',bestDistance:'distance',lastDistance:'distance',swingTiming:'batTiming',hipRotation:'waist',shoulderAngle:'shoulder',shoulder:'shoulder',lastRing:'accuracy'};
window.SASportsUI={
 renderOptions:()=>({view:$('camera').value,zoom:Number($('zoom').value),cameraAngle:0,environment:{time:$('timeOfDay').value,weather:$('weather').value,season:$('season').value,climate:$('climate').value,venue:$('venueMode').value,photo:sceneImage},portraits:{}}),
 updateMetrics:core=>{const m=core.metrics||{};const fields=currentSport==='baseball'?['swingTiming','lastDistance','hipRotation','shoulder']:currentSport==='archery'?['lastRing']:currentSport==='sprint'?['distance']:[];const selected=fields.filter(k=>Number.isFinite(m[k])).map(k=>[k,m[k]]);$('sportMetrics').textContent=selected.map(([k,v])=>t(metricKeys[k])+': '+v.toFixed(2)).join(' · ');},
 getContext:()=>({sport:currentSport,venue:selectedVenue?.id,language:app.getLanguage(),home:homeProfile.id,away:awayProfile.id}),applyRoster,selectVenue:chooseVenue
};
sportDefinitions.forEach(s=>{const o=node('option',t(s.key));o.value=s.id;$('sport').append(o);});
$('sport').addEventListener('change',sportChanged);$('competition').addEventListener('change',competitionChanged);$('homeAthlete').addEventListener('change',profilesChanged);$('awayAthlete').addEventListener('change',profilesChanged);
$('destination').addEventListener('change',()=>{const v=catalog.venues.find(v=>v.id===$('destination').value);if(v)chooseVenue(v);});
$('locateWorld').addEventListener('click',locate);$('searchNearby').addEventListener('click',searchNearby);$('applyLocation').addEventListener('click',()=>{const lat=Number($('customLat').value),lon=Number($('customLon').value);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!$('customLat').value.trim()||!$('customLon').value.trim()){$('worldStatus').textContent=t('locationError');return;}usePosition(lat,lon);});
$('court').addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey){e.preventDefault();$('zoom').value=String(Math.max(.6,Math.min(1.8,Number($('zoom').value)-Math.sign(e.deltaY)*.05)));}},{passive:false});
window.addEventListener('sa-language',refreshText);window.addEventListener('sa-match-reset',applyRoster);
if(window.SACoach){SACoach.init({onState:()=>updateCoachStatus(),onProgress:p=>{const number=typeof p==='number'?p:(p.progress??p.ratio??0);$('coachProgress').hidden=false;$('coachProgress').value=number>1?number/100:number;updateCoachStatus();}});}
$('loadCoach').addEventListener('click',async()=>{app.setPaused(true);try{await SACoach.load({onProgress:p=>{const ratio=typeof p==='number'?p:(p.progress??p.ratio??0);$('coachProgress').hidden=false;$('coachProgress').value=ratio>1?ratio/100:ratio;}});}catch(e){updateCoachStatus(String(e.message||e).slice(0,150));}finally{$('coachProgress').hidden=true;updateCoachStatus();}});
$('unloadCoach').addEventListener('click',()=>{SACoach?.unload();updateCoachStatus();});$('cancelCoach').addEventListener('click',()=>{SACoach?.cancel();updateCoachStatus();});$('askCoach').addEventListener('click',askCoach);$('coachQuestion').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();askCoach();}});
$('offlinePrepare').addEventListener('click',async()=>{const b=$('offlinePrepare');b.disabled=true;b.textContent=t('offlinePreparing');try{if(!('serviceWorker'in navigator)||location.protocol==='file:')throw Error('HTTPS or localhost required');let readyTimer;const reg=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{readyTimer=setTimeout(()=>reject(Error('Service Worker unavailable')),30000);})]).finally(()=>clearTimeout(readyTimer));const channel=new MessageChannel();await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('timeout')),90000);channel.port1.onmessage=e=>{if(e.data.done||e.data.ok){clearTimeout(timeout);resolve();}if(e.data.error){clearTimeout(timeout);reject(Error(e.data.error));}};reg.active.postMessage({type:'CACHE_SPORTS'},[channel.port2]);});b.textContent=t('offlineReady');}catch(e){b.textContent=t('offlineError');}finally{b.disabled=false;}});
updateDestinationNames();populateAthletes();refreshText();if(catalog.venues[0])chooseVenue(catalog.venues[0]);
})();
