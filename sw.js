/* Scope-isolated shell. Large AI weights are opt-in, cached by coach-worker. */
const ROOT=self.registration.scope;
const PREFIX='sa-sports-'+encodeURIComponent(new URL(ROOT).pathname)+'-';
const CACHE=PREFIX+'v7-20261015';
const CORE=['index.html','styles.css','sports.css','stage.css','locales.js','i18n/en.json','i18n/zh-Hant.json','data/catalog.js','game-core.js','sports-engine.js','renderer.js','coach.js','coach-worker.js','app.js','sports-ui.js','icon.svg','manifest.webmanifest','offline-manifest.json'];
const local=p=>new URL(p,ROOT).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(local))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(ROOT))return;
 const path=url.href.slice(ROOT.length).split('?')[0];
 if(path.startsWith('models/'))return;
 if(!/\.(?:js|mjs|css|json|html|wasm|jpg|png|svg|webmanifest)$/.test(path)&&req.mode!=='navigate')return;
 event.respondWith((async()=>{
  const c=await caches.open(CACHE),hit=await c.match(req);
  if(hit&&(path.startsWith('assets/')||path.startsWith('vendor/')))return hit;
  try{const response=await fetch(req);if(response.ok&&response.type!=='opaque')await c.put(req,response.clone());return response;}
  catch(error){if(hit)return hit;if(req.mode==='navigate'){const shell=await c.match(local('index.html'));if(shell)return shell;}throw error;}
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type!=='CACHE_SPORTS')return;
 const port=event.ports?.[0];
 event.waitUntil((async()=>{
  try{
   const response=await fetch(local('offline-manifest.json'),{cache:'no-cache'});if(!response.ok)throw Error('Offline manifest unavailable');
   const manifest=await response.json(),c=await caches.open(CACHE);let completed=0;
   const entries=manifest.files.filter(x=>!x.path.startsWith('models/'));
   for(let i=0;i<entries.length;i+=3)await Promise.all(entries.slice(i,i+3).map(async entry=>{
    const target=new URL(entry.path,ROOT);if(!target.href.startsWith(ROOT)||target.origin!==self.location.origin)throw Error('Invalid offline path');
    if(!await c.match(target.href)){const r=await fetch(target.href);if(!r.ok)throw Error('Offline download: '+entry.path);await c.put(target.href,r);}
    completed++;
   }));
   port?.postMessage({ok:true,count:completed});
  }catch(error){port?.postMessage({ok:false,error:String(error.message||error)});}
 })());
});
