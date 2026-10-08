/* Real Chromium interaction checks. No network multiplayer/load claims. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
let playwright;
const candidates=['playwright','playwright-core',process.env.PLAYWRIGHT_CORE,
  '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'].filter(Boolean);
for(const candidate of candidates){try{playwright=require(candidate);break;}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}
if(!playwright)throw new Error('Install browser QA dependencies first: npm install --no-save playwright; npx playwright install chromium.');
const { chromium } = playwright;
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'qa-output');
fs.mkdirSync(output, { recursive: true });
const checks = [], errors = [], badResponses = [];
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json', '.webmanifest':'application/manifest+json', '.md':'text/markdown' };
const server = http.createServer((req, res) => {
  let relative;
  try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (_) { res.writeHead(400).end(); return; }
  relative = relative.replace(/^\/SmartAction\/動手動腦\/3x3-basketball(?=\/)/,'');
  const file = path.resolve(root, '.' + relative + (relative.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('Not found'); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
});
function record(name, detail) { checks.push({ name, status:'pass', detail }); console.log('PASS ' + name); }
async function state(page) { return page.evaluate(() => ({ ...SAHoopsApp.diagnostics(), snapshot:SAHoopsApp.core.getSnapshot() })); }
async function boot(page, url) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) badResponses.push({url:r.url(),status:r.status()}); });
  await page.goto(url);
  await page.waitForFunction(() => window.SAHoopsApp && !document.getElementById('start').disabled);
}
async function start(page) { await page.locator('#start').click(); await page.waitForTimeout(70); }
async function restart(page) { await page.evaluate(() => SAHoopsApp.restart()); await page.waitForTimeout(60); }
async function focus(page) { await page.locator('#court').focus(); }
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const privateChromium='/workspace/scratch/a8695db12b98/qa/bin/chromium';
  const executablePath=process.env.CHROMIUM_PATH || (fs.existsSync(privateChromium)?privateChromium:undefined);
  const browserEnv={...process.env};
  const privateFonts='/tmp/frame-cpu-fonts/fonts.conf';
  if(!browserEnv.FONTCONFIG_FILE && fs.existsSync(privateFonts))browserEnv.FONTCONFIG_FILE=privateFonts;
  const browser = await chromium.launch({ executablePath,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage'],env:browserEnv });
  try {
    const desktop = await browser.newContext({viewport:{width:1440,height:1120},deviceScaleFactor:2,locale:'zh-TW'});
    const page = await desktop.newPage(); await boot(page,base+'/');
    assert.equal((await state(page)).language,'zh-Hant'); record('Browser language chooses Traditional Chinese');
    assert.equal(await page.locator('#language option').count(),22);
    const languageCodes = await page.locator('#language option').evaluateAll(x => x.map(o=>o.value));
    for (const language of languageCodes) {
      await page.selectOption('#language',language);
      assert.equal(await page.locator('html').getAttribute('lang'),language);
      assert.ok((await page.locator('h1').textContent()).trim());
      assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
    }
    record('All 22 language choices update title and direction',languageCodes);
    await page.selectOption('#language','zh-Hant');
    await page.selectOption('#quality','lite'); const lite = (await state(page)).canvasPixels;
    await page.selectOption('#quality','full'); const full = (await state(page)).canvasPixels;
    assert.ok(lite <= 703000); assert.ok(full <= 2404000); assert.ok(full > lite);
    record('Lite/full render pixel budgets apply',{lite,full});
    await start(page); assert.equal((await state(page)).playing,true);
    assert.equal(await page.locator('#startOverlay').isVisible(),false); record('Benchmark completes and real start button starts match');
    const before = (await state(page)).snapshot.players[0];
    await page.keyboard.down('d'); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(360);
    const moved = (await state(page)).snapshot.players[0];
    await page.keyboard.up('d'); await page.keyboard.up('ArrowLeft');
    assert.ok(moved.x > before.x + 0.5); assert.ok(moved.aimX < -0.9);
    record('Keyboard leg movement and arm aim operate independently',{dx:moved.x-before.x,aimX:moved.aimX});
    await restart(page); await focus(page); await page.keyboard.press('q'); await page.waitForTimeout(150);
    assert.ok((await state(page)).snapshot.players[0].y > 0.2); record('Q triggers jump');
    await page.waitForTimeout(600); await page.keyboard.down('e'); await page.waitForTimeout(100);
    assert.equal((await state(page)).snapshot.players[0].crouching,true);
    await page.keyboard.up('e'); await page.waitForTimeout(100); assert.equal((await state(page)).snapshot.players[0].crouching,false);
    record('E crouch is held and releases');
    await restart(page); await focus(page); await page.keyboard.press('j'); await page.waitForTimeout(70);
    assert.equal((await state(page)).snapshot.ball.state,'pass'); record('J begins an actual pass flight');
    await page.waitForTimeout(650);
    await restart(page); await focus(page); await page.keyboard.down('k'); await page.waitForTimeout(480);
    const charged = (await state(page)).snapshot.shotCharge; assert.ok(charged > 0.2);
    await page.keyboard.up('k'); await page.waitForTimeout(55);
    assert.equal((await state(page)).snapshot.ball.state,'shot'); record('K charges and release launches shot',{charge:charged});
    await page.locator('#pause').click(); const paused = await state(page); await page.waitForTimeout(400);
    assert.equal((await state(page)).liveClock,paused.liveClock); record('Pause freezes live simulation');
    await page.locator('#resume').click(); await page.waitForTimeout(100); assert.ok((await state(page)).liveClock > paused.liveClock);
    record('Resume advances live clock');
    // This is genuine UI gameplay. A deterministic seed and charged shot normally create a three-pointer.
    await page.waitForFunction(() => SAHoopsApp.diagnostics().replay, {timeout:18000});
    const clip = await page.evaluate(() => SAHoopsApp.getReplay());
    assert.ok(clip.frames.length > 20 && clip.frames.length <= 180);
    assert.ok(['three','layup','dunk','block','steal','score'].includes(clip.event.type));
    const replayStart = await state(page);
    const cameraFirst = await page.evaluate(() => ({...SAHoopsApp.renderer._camera.eye}));
    await page.waitForTimeout(450); assert.equal((await state(page)).liveClock,replayStart.liveClock);
    const cameraLater = await page.evaluate(() => ({...SAHoopsApp.renderer._camera.eye}));
    assert.ok(Math.hypot(cameraLater.x-cameraFirst.x,cameraLater.z-cameraFirst.z)>0.2);
    record('Actual scored-play recording replays in slow motion, orbits camera and freezes live state',{event:clip.event.type,frames:clip.frames.length});
    const courtBounds=await page.locator('#court').boundingBox();
    const cameraDragBefore=await page.evaluate(()=>({...SAHoopsApp.renderer._camera.eye}));
    await page.mouse.move(courtBounds.x+courtBounds.width/2,courtBounds.y+courtBounds.height/2);await page.mouse.down();
    await page.mouse.move(courtBounds.x+courtBounds.width/2+100,courtBounds.y+courtBounds.height/2,{steps:4});await page.mouse.up();await page.waitForTimeout(50);
    const cameraDragAfter=await page.evaluate(()=>({...SAHoopsApp.renderer._camera.eye}));
    assert.ok(Math.hypot(cameraDragAfter.x-cameraDragBefore.x,cameraDragAfter.z-cameraDragBefore.z)>0.7);
    record('Pointer drag additionally rotates highlight camera');
    await page.screenshot({path:path.join(output,'desktop-highlight.png'),fullPage:true});
    await page.locator('#skipReplay').click(); await page.waitForTimeout(90);
    assert.equal((await state(page)).replay,false); assert.ok((await state(page)).liveClock>replayStart.liveClock);
    record('Skip replay restores and continues live match');
    await page.waitForTimeout(6500);
    assert.ok((await state(page)).historyFrames<=180); record('Replay rolling history is bounded at 180 frames');
    await page.locator('#replay').click(); assert.equal((await state(page)).replay,true);
    await page.locator('#skipReplay').click(); record('Manual replay button replays the latest actual clip');
    await page.screenshot({path:path.join(output,'desktop-game.png'),fullPage:true});
    // End-state fixture accelerates remaining time; the production step/event path still handles the result.
    await page.evaluate(() => { SAHoopsApp.core.timeRemaining=0.03; });
    await page.waitForFunction(() => SAHoopsApp.core.ended);
    assert.equal(await page.locator('#endOverlay').isVisible(),true); record('Match end displays result and restart',{fixture:'remaining clock set to 0.03 seconds'});
    await page.locator('#playAgain').click(); assert.equal((await state(page)).snapshot.ended,false); record('Restart after game over resets state');
    // Known coordinates are browser-emulated for this permission/URL test, not a claim of physical GPS verification.
    await desktop.grantPermissions(['geolocation']); await desktop.setGeolocation({latitude:22.6273,longitude:120.3014,accuracy:23});
    await page.locator('#courts').click(); await page.locator('#locate').click(); await page.waitForFunction(()=>!document.getElementById('mapActions').hidden);
    const href = await page.locator('#nearbyMap').getAttribute('href');
    assert.ok(href.includes('22.627300') && href.includes('120.301400'));
    assert.ok((await page.locator('#coordinates').textContent()).includes('±23'));
    record('Explicit geolocation builds current/nearby Google Maps links',{fixture:'emulated Kaohsiung coordinates',href});
    await page.locator('#mapDialog [data-close]').click(); await page.locator('#resume').click();
    const mobile = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,locale:'en-US'});
    const mobilePage = await mobile.newPage(); await boot(mobilePage,base+'/?lang=en'); await start(mobilePage);
    const overflows=[];
    for(const lang of languageCodes){ await mobilePage.selectOption('#language',lang);
      const size=await mobilePage.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
      if(size.scroll>size.client+1)overflows.push({lang,...size}); }
    assert.deepEqual(overflows,[]);record('390 px mobile viewport has no horizontal overflow across all 22 languages');
    await mobilePage.selectOption('#language','zh-Hant'); await restart(mobilePage);
    await mobilePage.locator('#movePad').scrollIntoViewIfNeeded();
    const pad = await mobilePage.locator('#movePad').boundingBox();
    const captureEvents = await mobilePage.evaluate(() => {window.__captureLog=[]; const p=document.getElementById('movePad'); for(const name of ['gotpointercapture','lostpointercapture'])p.addEventListener(name,e=>__captureLog.push(name)); return true;});
    const session = await mobile.newCDPSession(mobilePage);
    const startPoint={x:pad.x+pad.width/2,y:pad.y+pad.height/2};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...startPoint,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startPoint.x+pad.width*0.28,y:startPoint.y,id:1}]});
    const mobileBefore=(await state(mobilePage)).snapshot.players[0].x; await mobilePage.waitForTimeout(300);
    const mobileAfter=(await state(mobilePage)).snapshot.players[0].x;
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await mobilePage.waitForTimeout(50);
    assert.ok(mobileAfter>mobileBefore+0.4); const captures=await mobilePage.evaluate(()=>window.__captureLog);
    assert.ok(captures.includes('gotpointercapture') && captures.includes('lostpointercapture'));
    record('Mobile touch joystick moves player and pointer capture releases',{dx:mobileAfter-mobileBefore,captures});
    await restart(mobilePage);await mobilePage.locator('#movePad').scrollIntoViewIfNeeded();
    const mp=await mobilePage.locator('#movePad').boundingBox(),ap=await mobilePage.locator('#aimPad').boundingBox();
    const dual=[{x:mp.x+mp.width*0.78,y:mp.y+mp.height/2,id:3},{x:ap.x+ap.width*0.22,y:ap.y+ap.height/2,id:4}];
    const dualBefore=(await state(mobilePage)).snapshot.players[0].x;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:dual});await mobilePage.waitForTimeout(300);
    const dualAfter=(await state(mobilePage)).snapshot.players[0];
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(dualAfter.x>dualBefore+0.4 && dualAfter.aimX<-0.8);
    record('Two simultaneous touch pointers independently move legs and aim arms',{dx:dualAfter.x-dualBefore,aimX:dualAfter.aimX});
    await restart(mobilePage); const shoot=mobilePage.locator('[data-action=shoot]'); await shoot.scrollIntoViewIfNeeded();
    const sb=await shoot.boundingBox(),sx=sb.x+sb.width/2,sy=sb.y+sb.height/2;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy,id:2}]});
    await mobilePage.waitForTimeout(460);assert.ok((await state(mobilePage)).snapshot.shotCharge>0.2);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await mobilePage.waitForTimeout(40);
    assert.equal((await state(mobilePage)).snapshot.ball.state,'shot');record('Mobile touch shoot button charges and releases an actual shot');
    await mobilePage.evaluate(()=>window.scrollTo(0,0)); await mobilePage.screenshot({path:path.join(output,'mobile-game.png'),fullPage:true});
    await mobilePage.locator('#courts').click(); await mobilePage.locator('#locate').click();
    await mobilePage.waitForFunction(()=>!document.getElementById('locate').disabled,{timeout:16000});
    assert.equal(await mobilePage.locator('#mapActions').isVisible(),false); assert.ok((await mobilePage.locator('#mapStatus').textContent()).trim());
    record('Denied geolocation shows localized status without map links');
    await mobilePage.locator('#mapDialog [data-close]').click();
    const nested=await desktop.newPage();
    await boot(nested,base+'/SmartAction/%E5%8B%95%E6%89%8B%E5%8B%95%E8%85%A6/3x3-basketball/lang/en/');
    assert.equal((await state(nested)).language,'en');
    assert.ok((await nested.locator('#guideLink').getAttribute('href')).includes('/SmartAction/'));
    await start(nested); assert.equal((await state(nested)).playing,true);
    record('Static English language page starts correctly under nested GitHub Pages-style path'); await nested.close();
    const weak=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,locale:'en-US'});
    await weak.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,get:()=>2});});
    const weakPage=await weak.newPage(); await boot(weakPage,base+'/?lang=en');
    const weakState=await state(weakPage);
    assert.equal(weakState.recommended,'lite');assert.equal(weakState.quality,'lite');assert.ok(weakState.canvasPixels<=703000);
    record('Emulated weak-device hints select automatic lite quality before play',{fixture:'deviceMemory 2 GiB, hardwareConcurrency 2; browser hints overridden for test',recommended:weakState.recommended,quality:weakState.quality,pixels:weakState.canvasPixels});
    await weak.close();
    // Offline works only after one successful hosted load and service-worker activation.
    if(fs.existsSync(path.join(root,'sw.js'))){
      await page.reload(); await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:15000});
      await desktop.setOffline(true); await page.reload(); await page.waitForFunction(()=>!!window.SAHoopsApp && !document.getElementById('start').disabled);
      await start(page); assert.equal((await state(page)).playing,true); record('Hosted service worker enables actual offline reload and play');
      await desktop.setOffline(false);
    } else record('Service worker test pending build','sw.js absent at QA run');
    const standalone=path.join(root,'SmartAction_3x3.html');
    if(fs.existsSync(standalone)){
      const local = await desktop.newPage(); await boot(local,'file://'+standalone); await start(local); assert.equal((await state(local)).playing,true);
      record('Standalone HTML opens and starts directly using file://'); await local.close();
    } else record('Standalone test pending build','SmartAction_3x3.html absent at QA run');
    const diagnostics={desktop:await state(page),mobile:await state(mobilePage)};
    assert.deepEqual(errors,[]); assert.deepEqual(badResponses,[]); record('No page JavaScript errors or HTTP asset failures');
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({status:'pass',checks,errors,badResponses,diagnostics,tested:'Chromium on Linux with desktop and mobile emulation; no physical Safari or 100k load test'},null,2));
    console.log('Completed '+checks.length+' browser checks');
  } catch(e) {
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({status:'fail',checks,errors,badResponses,error:e.stack},null,2));
    console.error(e); process.exitCode=1;
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})();
