/** Browser proofs for logo restraint and original-map region tools. No live account writes.
 * node tools/verify-map-regions.mjs --before | --after
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const stage = process.argv.includes('--before') ? 'before' : 'after';
const clipOnly=process.argv.includes('--clip-only'),checksOnly=process.argv.includes('--checks-only'),selectedOnly=process.argv.includes('--selected-only');
const base = process.env.NAMELESS_BASE_URL || 'http://127.0.0.1:4173';
const output = path.resolve('docs/map-regions-2026-10-10');
const profile = process.env.USERPROFILE || 'C:/Users/julie';
const { chromium } = await import(pathToFileURL(process.env.NAMELESS_PLAYWRIGHT_MODULE || path.join(profile, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.NAMELESS_CHROMIUM || path.join(profile, 'AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe'), headless: true });
fs.mkdirSync(output, { recursive: true });
const report = { stage, base, browser: browser.version(), generatedAt: new Date().toISOString(), captures: [], layouts: [], checks: [], errors: [], external: [], cancellations: [] };
const catalog = JSON.parse(fs.readFileSync('assets/map/catalog.json','utf8'));
const assetPaths = [...new Set([...catalog.floors.flatMap(floor=>[floor.originalImage,floor.overview,floor.overviewMobile,floor.image]),'/assets/carte.png','/assets/Palier2-map.png','/assets/Palier3-map.png'])];
report.mapAssetHashes = Object.fromEntries(assetPaths.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file.slice(1))).digest('hex')]));
const viewports = [{ width:360,height:844 },{ width:390,height:844 },{ width:768,height:1024 },{ width:1280,height:1080 },{ width:1920,height:1080 },{ width:2560,height:1440 }];
function observe(page, name) {
  page.setDefaultTimeout(9000);
  page.on('pageerror', error => report.errors.push({ page:name, message:error.message }));
  page.on('requestfailed', request => { const item={ page:name,url:request.url(),message:request.failure()?.errorText }; if(item.message==='net::ERR_ABORTED') report.cancellations.push(item); else (request.url().startsWith(base)?report.errors:report.external).push(item); });
  page.on('response', response => { if(response.status()>=400) (response.url().startsWith(base)?report.errors:report.external).push({ page:name,url:response.url(),status:response.status() }); });
}
async function context(viewport, options={}) {
  const ctx=await browser.newContext({ viewport,locale:'fr-FR',deviceScaleFactor:1,...options });
  await ctx.addInitScript(()=>localStorage.setItem('nameless-language','fr'));
  await ctx.route('**/*',async route=> { const req=route.request(),url=new URL(req.url()),readRpc=/\/rest\/v1\/rpc\/(read_map_marker_overrides|current_user_role|read_map_regions)$/.test(url.pathname); if(!['localhost','127.0.0.1'].includes(url.hostname)&&!['GET','HEAD','OPTIONS'].includes(req.method())&&!readRpc) await route.abort(); else await route.continue(); });
  return ctx;
}
async function visit(page, route) {
  await page.goto(base+route,{ waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>document.fonts.status==='loaded');
  if(route.startsWith('/carte')) await page.waitForFunction(()=>!!window.NamelessMapPage?.active?.getData());
  if(stage==='after'&&route.startsWith('/carte')) await page.waitForFunction(()=>!!window.NamelessMapRegions?.active);
  if(route.startsWith('/wiki')) await page.locator('.wiki-page.active').waitFor();
  await page.waitForTimeout(route==='/'?1700:450);
}
async function screenshot(page,name,options={}) {
  const file=`${stage}-${name}.png`;
  await page.screenshot({ path:path.join(output,file),...options });
  report.captures.push({ file,url:page.url(),viewport:page.viewportSize() }); console.log('Captured '+file);
}
async function layout(page,name) {
  const value=await page.evaluate(()=>({ width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,title:document.querySelector('main h1')?.textContent.trim(),visibleLogos:[...document.images].filter(img=>img.checkVisibility()&&/assets\/brand\/(nameless-(emblem|logo|reference)|favicon)/.test(img.currentSrc||img.src)).map(img=>({src:img.currentSrc,width:Math.round(img.getBoundingClientRect().width),height:Math.round(img.getBoundingClientRect().height)})),brokenImages:[...document.images].filter(img=>img.checkVisibility()&&img.complete&&!img.naturalWidth).map(img=>img.currentSrc||img.src),mapImages:[...document.querySelectorAll('#game-map .leaflet-image-layer')].map(img=>img.src),mapReady:!!window.NamelessMapPage?.active,privateEditor:!!document.querySelector('.map-admin-editor:not([hidden])') }));
  report.layouts.push({ name,url:page.url(),...value }); return value;
}
async function check(name, fn) { console.log('Check '+name);try{report.checks.push({ name,passed:true,detail:await fn() });}catch(error){report.checks.push({ name,passed:false,message:error.message });console.log('FAILED '+error.message);} }
async function clickRelative(page,u,v) {
  const target=await page.evaluate(({u,v})=> { const bridge=window.NamelessMapPage.active,point=bridge.map.latLngToContainerPoint(bridge.getLatLng({u,v})),rect=document.querySelector('#game-map').getBoundingClientRect();return {x:rect.x+point.x,y:rect.y+point.y,map:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}}; },{u,v});
  assert.ok(target.x>target.map.x&&target.x<target.map.x+target.map.width&&target.y>target.map.y&&target.y<target.map.y+target.map.height,'Chosen original-image coordinate is inside the visible map: '+JSON.stringify({u,v,...target}));
  await page.mouse.click(target.x,target.y);
}
async function regionDraft(page) { return page.evaluate(()=>window.NamelessMapRegions.active.editor.getDraft()); }
async function regionAction(page, action) { await page.locator(`[data-region-action="${action}"]`).click(); }
async function vertexFocus(page,index=0){const handle=page.locator('.map-region-vertex').nth(index),button=handle.locator('button');await(await button.count()?button:handle).focus();}
async function polygonPoint(locator) {
  return locator.evaluate(element=>{const r=element.getBoundingClientRect();for(let y=1;y<10;y++)for(let x=1;x<10;x++){const point={x:r.x+r.width*x/10,y:r.y+r.height*y/10};if(document.elementFromPoint(point.x,point.y)===element)return point;}return null;});
}
try {
  if(!clipOnly&&!checksOnly&&!selectedOnly)for(const viewport of viewports) {
    const ctx=await context(viewport),page=await ctx.newPage(); observe(page,'capture-'+viewport.width);
    const routes=(viewport.width===390||viewport.width===1920)?[['/','home'],['/wiki/','wiki'],['/connexion/','connexion'],['/carte/','map']]:[['/carte/','map']];
    for(const [route,name] of routes) { await visit(page,route);await screenshot(page,`${name}-${viewport.width}x${viewport.height}`);await layout(page,name+'-'+viewport.width); }
    await ctx.close();
  }
  console.log('CAPTURES READY: '+report.captures.length+' images.');
  if(selectedOnly)await check('Selected-region close-up shows the actual chosen outline after camera settles',selectedProof);
  else if(clipOnly)await check('Actual public interaction clip is recorded',recordVideo);
  else if(stage==='after')await behavioralChecks();
} finally {
  fs.writeFileSync(path.join(output,stage+(clipOnly?'-clip':checksOnly?'-checks':selectedOnly?'-selected':'')+'-verification.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
if(report.checks.some(item=>!item.passed)||report.errors.length) process.exitCode=1;
async function behavioralChecks() {
  for(const item of report.layouts) await check(item.name+': responsive and image integrity',async()=>{assert.equal(item.scrollWidth,item.width);assert.deepEqual(item.brokenImages,[]);return {width:item.width,visibleLogos:item.visibleLogos.length};});
  await check('Original map images and display variants remain byte-for-byte intact',async()=>{const before=JSON.parse(fs.readFileSync(path.join(output,'before-verification.json'),'utf8'));assert.deepEqual(report.mapAssetHashes,before.mapAssetHashes);return {unchangedAssets:assetPaths.length};});
  await check('Logo restraint across public home, Wiki, login and map',async()=>{for(const item of report.layouts) assert.ok(item.visibleLogos.length<=1,`${item.name}: ${item.visibleLogos.length} visible logos`);return report.layouts.map(item=>({page:item.name,logos:item.visibleLogos.length}));});
  const ctx=await context({width:1920,height:1080});
  const page=await ctx.newPage();observe(page,'desktop-behavior');
  await check('Public map retains genuine authentication gates',async()=>{
    await visit(page,'/carte/');assert.equal(await page.locator('#map-admin-tools').isVisible(),false);assert.equal(await page.locator('#login-link').isVisible(),true);
    await visit(page,'/espace-guilde/');assert.equal(await page.locator('#access-denied').isVisible(),true);assert.equal(await page.locator('#guilde-content').isVisible(),false);
    return {privateAdminHidden:true,privateGuildGated:true};
  });
  await check('Secondary pages also retain a single public logo',async()=>{
    const counts=[];for(const route of ['/bestiaire/','/items/','/profil/','/espace-guilde/','/quetes/','/conditions/','/confidentialite/','/admin-dashboard/']){await visit(page,route);const count=await page.evaluate(()=>[...document.images].filter(img=>img.checkVisibility()&&/assets\/brand\/(nameless-(emblem|logo|reference)|favicon)/.test(img.currentSrc||img.src)).length);assert.ok(count<=1,`${route}: ${count} visible logos`);counts.push({route,logos:count});}return counts;
  });
  await check('Map search, selection and share retain actual entity identity',async()=>{
    await visit(page,'/carte/?floor=1');const input=page.locator('#map-search-input');await input.fill('Vallée des Loups');await input.press('ArrowDown');
    assert.ok(await page.locator('.search-result-item').first().evaluate(el=>el===document.activeElement));const zone=page.locator('.search-result-item[data-entity-key="location:1:vallee-loups"]');await zone.focus();await page.keyboard.press('Enter');
    await page.locator('#map-panel').waitFor({state:'visible'});await page.waitForFunction(()=>new URL(location.href).searchParams.get('entity')==='location:1:vallee-loups');
    assert.match(await page.locator('#map-panel-content').innerText(),/Vallée des Loups/);await page.locator('#map-share').click();
    const url=new URL(page.url());assert.equal(url.searchParams.get('entity'),'location:1:vallee-loups');assert.equal(url.searchParams.get('floor'),'1');assert.ok(url.searchParams.has('u'));await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.NamelessMapPage?.active?.getData());assert.match(await page.locator('#map-panel-content').innerText(),/Vallée des Loups/);return {entity:url.searchParams.get('entity'),shareRouteRestored:true};
  });
  await check('Twelve honest indicative contours reuse real existing zone entries',async()=>{
    await visit(page,'/carte/?floor=1');await page.locator('#map-region-list [data-region-id]').first().waitFor();const regions=await page.evaluate(()=>window.NamelessMapRegions.active.getRegions());
    assert.equal(regions.length,12);assert.ok(regions.every(region=>region.status==='indicative'&&catalog.index.some(entry=>entry.key===region.entityKey&&entry.floor===1&&entry.markerType==='zone')));
    assert.equal(await page.locator('.leaflet-nameless-regions-pane path').count(),12);assert.equal(await page.locator('#map-region-list [data-region-id]').count(),12);assert.match(await page.locator('#map-region-status').innerText(),/indicatifs.*valider/);
    return {regions:regions.length,allIndicative:true,realEntityKeys:true};
  });
  await check('Polygon hover, pointer selection and equivalent keyboard list',async()=>{
    const path=page.locator('.leaflet-nameless-regions-pane path').first();const before=await path.getAttribute('fill-opacity'),point=await polygonPoint(path);assert.ok(point,'A visible uncovered polygon area exists');
    await page.mouse.move(point.x,point.y);await page.locator('.map-region-tooltip').waitFor();assert.match(await page.locator('.map-region-tooltip').innerText(),/Contour indicatif/);assert.notEqual(await path.getAttribute('fill-opacity'),before);await page.mouse.click(point.x,point.y);
    await page.waitForFunction(()=>document.querySelector('#map-region-list button')?.getAttribute('aria-pressed')==='true');await page.waitForTimeout(600);const first=page.locator('#map-region-list button').first(),second=page.locator('#map-region-list button').nth(1);const firstId=await first.getAttribute('data-region-id');
    await second.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('#map-region-list button')[1]?.getAttribute('aria-pressed')==='true');const entity=new URL(page.url()).searchParams.get('entity');assert.ok(catalog.index.some(entry=>entry.key===entity&&entry.markerType==='zone'));await page.waitForTimeout(750);await screenshot(page,'region-selected-1920x1080');
    return {pointerRegion:firstId,keyboardEntity:entity,visibleIndicativeTooltip:true};
  });
  await check('Contour visibility toggle hides shapes without changing the map image',async()=>{
    const images=await page.locator('#game-map .leaflet-image-layer').evaluateAll(nodes=>nodes.map(node=>node.src));await page.locator('#map-regions-toggle').click();assert.equal(await page.locator('.leaflet-nameless-regions-pane path').count(),0);assert.equal(await page.locator('#map-regions-toggle').isChecked(),false);
    await page.locator('#map-regions-toggle').click();assert.equal(await page.locator('.leaflet-nameless-regions-pane path').count(),12);assert.deepEqual(await page.locator('#game-map .leaflet-image-layer').evaluateAll(nodes=>nodes.map(node=>node.src)),images);return {toggle:true,sameOriginalImage:true};
  });
  await check('Existing map search filters polygons and list, and clear restores all proposals',async()=>{
    await page.locator('#map-search-input').fill('Vallée');assert.equal(await page.locator('#map-region-list button').count(),1);assert.equal(await page.locator('.leaflet-nameless-regions-pane path').count(),1);assert.match(await page.locator('#map-region-list').innerText(),/Vallée des Loups/);
    await page.locator('#map-search-input').fill('zzzzzzzz-introuvable');assert.equal(await page.locator('#map-region-list button').count(),0);assert.equal(await page.locator('.leaflet-nameless-regions-pane path').count(),0);await page.locator('#map-search-clear').click();assert.equal(await page.locator('#map-region-list button').count(),12);assert.equal(await page.locator('.leaflet-nameless-regions-pane path').count(),12);return {queryMatchesShapesAndList:true,emptyState:true,clearRestoresAll:true};
  });
  await check('Only real floors, keyboard switching and original floor images',async()=>{
    await visit(page,'/carte/?floor=1');const floors=await page.locator('#map-floor-buttons [data-floor]').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.floor)));assert.deepEqual(floors,catalog.floors.map(floor=>floor.id));
    await page.locator('[data-floor="1"]').focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.NamelessMapPage.active.getFloor()===2&&window.NamelessMapPage.active.getData()?.floor===2);
    assert.equal(await page.locator('.leaflet-nameless-regions-pane path').count(),0);assert.equal(await page.locator('#map-region-list [data-region-id]').count(),0);
    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.NamelessMapPage.active.getFloor()===3&&window.NamelessMapPage.active.getData()?.floor===3);assert.equal(await page.locator('#map-floor-next').isDisabled(),true);assert.equal(await page.locator('.leaflet-nameless-regions-pane path').count(),0);
    assert.match(await page.locator('#map-route-status').innerText(),/non calibrés|not calibrated/);await page.keyboard.press('Home');await page.waitForFunction(()=>window.NamelessMapPage.active.getData()?.floor===1);return {floors,imageOnlyFloorHonest:true};
  });
  await check('Map SPA exit releases Leaflet and re-entry mounts once',async()=>{
    await visit(page,'/carte/?floor=1');await page.locator('.nav-link[href*="/wiki"]').click();await page.locator('.wiki-page.active').waitFor();assert.equal(await page.evaluate(()=>window.NamelessMapPage?.active||null),null);assert.equal(await page.evaluate(()=>window.NamelessMapRegions?.active||null),null);
    await page.locator('.nav-link[href*="/carte"]').click();await page.waitForFunction(()=>!!window.NamelessMapPage?.active?.getData()&&!!window.NamelessMapRegions?.active);assert.equal(await page.locator('#game-map').count(),1);assert.equal(await page.locator('#game-map .leaflet-map-pane').count(),1);return {destroyedOnExit:true,oneMapOnReturn:true};
  });
  await editorChecks(page);
  await ctx.close();
  await compactAndMotionChecks();
  await check('Actual public interaction clip is recorded', recordVideo);
}
async function openTools(page,touch=false){const tools=page.locator('#map-regions-tools');if(!await tools.isVisible())await page.locator('#map-filters-toggle')[touch?'tap':'click']();await tools[touch?'tap':'click']();await page.locator('#map-regions-editor').waitFor();}
async function selectedProof(){
  const ctx=await context({width:1920,height:1080});const page=await ctx.newPage();observe(page,'selected-close-up');
  try{await visit(page,'/carte/?floor=1');await page.locator('#map-region-list button[data-region-id="vallee-loups"]').click();await page.waitForTimeout(900);const camera=await page.evaluate(()=>{const b=window.NamelessMapPage.active,r=window.NamelessMapRegions.active.findByEntity('location:1:vallee-loups'),center=b.getRelative(b.map.getCenter());return{center,u:[Math.min(...r.vertices.map(p=>p.u)),Math.max(...r.vertices.map(p=>p.u))],v:[Math.min(...r.vertices.map(p=>p.v)),Math.max(...r.vertices.map(p=>p.v))]}});assert.ok(camera.center.u>=camera.u[0]&&camera.center.u<=camera.u[1]&&camera.center.v>=camera.v[0]&&camera.center.v<=camera.v[1]);await page.mouse.move(80,80);await screenshot(page,'region-selected-1920x1080');return camera;}finally{await ctx.close();}
}
async function compactAndMotionChecks(){
  for(const width of [360,390]){
    const ctx=await context({width,height:844},{isMobile:true,hasTouch:true});const page=await ctx.newPage();observe(page,'touch-'+width);
    await check(width+'px touch: editor, selected outline, Escape and tap targets',async()=>{
      await visit(page,'/carte/?floor=1');await openTools(page,true);const sizes=await page.locator('#map-regions-editor [data-region-action]').evaluateAll(nodes=>nodes.filter(node=>node.checkVisibility()).map(node=>({action:node.dataset.regionAction,width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));
      assert.ok(sizes.every(item=>item.width>=44&&item.height>=44),'Critical contour actions meet 44px touch targets');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await screenshot(page,`editor-${width}x844`);await page.keyboard.press('Escape');await page.locator('#map-regions-editor').waitFor({state:'hidden'});
      if(!await page.locator('#map-region-list button').first().isVisible())await page.locator('#map-filters-toggle').tap();const region=page.locator('#map-region-list button').first();await region.tap();await page.locator('#map-panel').waitFor({state:'visible'});assert.ok(new URL(page.url()).searchParams.get('entity')?.startsWith('location:1:'));await screenshot(page,`region-selected-${width}x844`);return {touchActions:sizes,actualEntitySelected:true};
    });await ctx.close();
  }
  const ctx=await context({width:1920,height:1080},{reducedMotion:'reduce'});const page=await ctx.newPage();observe(page,'reduced-motion-language');
  await check('Reduced-motion preference and language change keep contour state coherent',async()=>{
    await visit(page,'/carte/?floor=1');assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);await openTools(page);const draft=await regionDraft(page);await page.locator('[data-language-option="en"]').click();await page.waitForFunction(()=>document.documentElement.lang==='en');assert.match(await page.locator('.map-region-local-note').innerText(),/this browser only/);assert.deepEqual((await regionDraft(page)).vertices,draft.vertices);assert.match(await page.locator('[data-region-action="save"]').innerText(),/locally/);await screenshot(page,'editor-en-reduced-1920x1080');await page.keyboard.press('Escape');return {reducedMotion:true,realEnglishLabels:true,draftRetained:true};
  });await ctx.close();
}
async function recordVideo(){
  const raw=path.join(output,'video-work');fs.mkdirSync(raw,{recursive:true});const ctx=await context({width:1920,height:1080},{recordVideo:{dir:raw,size:{width:1920,height:1080}}});const page=await ctx.newPage();observe(page,'motion-recording');
  await visit(page,'/carte/?floor=1');await page.waitForTimeout(1200);const polygon=page.locator('.leaflet-nameless-regions-pane path').first(),point=await polygonPoint(polygon);assert.ok(point);await page.mouse.move(point.x,point.y,{steps:18});await page.waitForTimeout(1100);await page.mouse.click(point.x,point.y);await page.waitForTimeout(1300);
  await page.locator('#map-region-list button').nth(1).click();await page.waitForTimeout(1100);await openTools(page);await page.waitForTimeout(1100);await vertexFocus(page);await page.keyboard.press('ArrowRight');await page.waitForTimeout(900);await regionAction(page,'undo');await page.waitForTimeout(700);await page.keyboard.press('Escape');await page.waitForTimeout(800);
  await page.locator('#map-regions-toggle').click();await page.waitForTimeout(650);await page.locator('#map-regions-toggle').click();await page.waitForTimeout(850);await page.locator('[data-floor="2"]').click();await page.waitForTimeout(900);await page.locator('[data-floor="1"]').click();await page.waitForTimeout(1000);
  const video=page.video();await ctx.close();const file=await video.path(),target=path.join(output,'map-regions-motion.webm');fs.copyFileSync(file,target);fs.unlinkSync(file);fs.rmdirSync(raw);report.video={file:'map-regions-motion.webm',kind:'actual local public proposed outlines and unsaved editor draft; no remote writes'};return report.video;
}
async function editorChecks(page) {
  await check('Local contour editor traces pointer vertices, finishes, undoes and redoes',async()=>{
    await visit(page,'/carte/?floor=1');await page.locator('#map-regions-tools').click();await page.locator('#map-regions-editor').waitFor();await page.waitForTimeout(500);await regionAction(page,'new');await page.locator('.map-region-name').fill('Contour de contrôle local');
    await page.locator('#map-recenter').click();await page.waitForTimeout(350);await regionAction(page,'draw');for(const [u,v]of[[.42,.42],[.48,.42],[.48,.48],[.42,.48]])await clickRelative(page,u,v);
    const draft=await regionDraft(page);assert.equal(draft.vertices.length,4);await regionAction(page,'finish');assert.equal(await page.locator('#map-regions-editor').getAttribute('data-mode'),'edit');
    await regionAction(page,'undo');assert.equal((await regionDraft(page)).vertices.length,3);await regionAction(page,'redo');assert.equal((await regionDraft(page)).vertices.length,4);assert.deepEqual((await regionDraft(page)).vertices,draft.vertices);return {pointerVertices:4,finish:true,undoRedo:true};
  });
  await check('Escape in a superimposed legend preserves the underlying outline draft',async()=>{
    const draft=await regionDraft(page);await page.locator('#map-legend-open').click();await page.locator('#map-legend').waitFor();await page.keyboard.press('Escape');await page.locator('#map-legend').waitFor({state:'hidden'});assert.equal(await page.locator('#map-regions-editor').isVisible(),true);assert.deepEqual(await regionDraft(page),draft);return {legendClosed:true,editorAndDraftRetained:true};
  });
  await check('Vertices support actual dragging, fine keyboard movement, insertion and deletion',async()=>{
    const handle=page.locator('.map-region-vertex').first();const before=await regionDraft(page),box=await handle.boundingBox();assert.ok(box);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+12,box.y+box.height/2-8,{steps:5});await page.mouse.up();
    assert.notDeepEqual((await regionDraft(page)).vertices[0],before.vertices[0]);await vertexFocus(page);const moved=await regionDraft(page);await page.keyboard.press('Shift+ArrowRight');assert.ok(Math.abs((await regionDraft(page)).vertices[0].u-moved.vertices[0].u-.0001)<1e-9);
    await regionAction(page,'add-vertex');assert.equal((await regionDraft(page)).vertices.length,5);await regionAction(page,'delete-vertex');assert.equal((await regionDraft(page)).vertices.length,4);
    await vertexFocus(page);await page.keyboard.press('Delete');assert.equal((await regionDraft(page)).vertices.length,3);assert.equal(await page.locator('[data-region-action="delete-vertex"]').isDisabled(),true);return {drag:true,keyboardFineStep:.0001,insertDelete:true,minimumThreeProtected:true};
  });
  await check('Save is browser-local, export is real JSON and malformed import leaves draft intact',async()=>{
    await regionAction(page,'save');assert.match(await page.locator('.map-region-message').innerText(),/navigateur uniquement/);const saved=await page.evaluate(()=>localStorage.getItem('nameless.map-regions.v1'));assert.ok(saved);
    const promise=page.waitForEvent('download');await regionAction(page,'export');const download=await promise,exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.schemaVersion,1);assert.equal(exported.coordinateSystem,'image-relative-top-left');assert.ok(exported.floors.every(floor=>floor.regions.every(region=>region.status==='indicative')));
    const draft=await regionDraft(page),bad=structuredClone(exported);bad.floors[0].regions[0].vertices=[{u:.3,v:.3},{u:.6,v:.6},{u:.3,v:.6},{u:.6,v:.3}];
    await page.locator('.map-region-file').setInputFiles({name:'invalid-self-crossing.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.waitForTimeout(150);assert.deepEqual(await regionDraft(page),draft);assert.match(await page.locator('.map-region-message').innerText(),/croise/);assert.equal(await page.evaluate(()=>localStorage.getItem('nameless.map-regions.v1')),saved);
    await page.locator('.map-region-file').setInputFiles({name:'valid-contours.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.waitForTimeout(150);assert.match(await page.locator('.map-region-message').innerText(),/importés pour révision/);assert.equal(await page.evaluate(()=>localStorage.getItem('nameless.map-regions.v1')),saved);return {localOnly:true,actualDownload:download.suggestedFilename(),invalidRejectedAtomically:true,validImportStillNeedsSave:true};
  });
  await check('Saved local outline survives reload and original proposal can be restored',async()=>{
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.NamelessMapRegions?.active?.getRegions().some(region=>region.local));const local=await page.evaluate(()=>window.NamelessMapRegions.active.getRegions().find(region=>region.local));assert.equal(local.title,'Contour de contrôle local');await page.locator('#map-region-list [data-region-id="'+local.id+'"]').click();if(await page.locator('#map-panel').isVisible())assert.match(await page.locator('#map-panel-content').innerText(),/Contour de contrôle local/,'A personal contour never keeps another zone’s entry');
    await page.locator('#map-regions-tools').click();await page.locator('.map-region-selector').selectOption(local.id);await regionAction(page,'reset');assert.equal(await page.evaluate(()=>window.NamelessMapRegions.active.getRegions().some(region=>region.id===window.NamelessMapRegions.active.editor.getDraft()?.id&&region.local)),false);
    const proposed=await page.evaluate(()=>window.NamelessMapRegions.active.getRegions()[0]);await page.locator('.map-region-selector').selectOption(proposed.id);await page.locator('.map-region-name').fill('Nom provisoire local');await regionAction(page,'save');assert.equal(await page.evaluate(id=>window.NamelessMapRegions.active.getRegions().find(region=>region.id===id)?.local,proposed.id),true);await regionAction(page,'reset');const restored=await page.evaluate(id=>window.NamelessMapRegions.active.getRegions().find(region=>region.id===id),proposed.id);assert.equal(restored.local,false);assert.equal(restored.title,proposed.title);assert.deepEqual(restored.vertices,proposed.vertices);
    await page.keyboard.press('Escape');await page.locator('#map-regions-editor').waitFor({state:'hidden'});assert.ok(await page.locator('#map-regions-tools').evaluate(node=>node===document.activeElement));return {reloadPersistence:true,localReset:true,escapeFocusReturned:true};
  });
}
