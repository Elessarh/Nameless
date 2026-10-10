/** Three incremental real-browser regressions after the original 32 passed checks.
 * No build, backend mutation, account fixture or broad rerun.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const output=path.resolve('docs/map-regions-2026-10-10');
const base=process.env.NAMELESS_BASE_URL||'http://127.0.0.1:4173';
const version=process.argv.find(arg=>arg.startsWith('--version='))?.slice('--version='.length)||'20261010regions3';
const profile=process.env.USERPROFILE||'C:/Users/julie';
const {chromium}=await import(pathToFileURL(process.env.NAMELESS_PLAYWRIGHT_MODULE||path.join(profile,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch({executablePath:process.env.NAMELESS_CHROMIUM||path.join(profile,'AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe'),headless:true});
const report={scope:'Three incremental regressions; original 32 layout/editor/logo/image checks retained',base,browser:browser.version(),generatedAt:new Date().toISOString(),checks:[],errors:[],external:[],captures:[],version};
const ctx=await browser.newContext({viewport:{width:1920,height:1080},locale:'fr-FR',deviceScaleFactor:1});
await ctx.addInitScript(()=>localStorage.setItem('nameless-language','fr'));
await ctx.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  const local=['localhost','127.0.0.1'].includes(url.hostname);
  const readRpc=/\/rest\/v1\/rpc\/(read_map_marker_overrides|current_user_role)$/.test(url.pathname);
  if(!local&&!['GET','HEAD','OPTIONS'].includes(req.method())&&!readRpc)await route.abort();
  else await route.continue();
});
const page=await ctx.newPage();page.setDefaultTimeout(9000);
page.on('pageerror',error=>report.errors.push({message:error.message}));
page.on('response',response=>{if(response.status()>=400)(response.url().startsWith(base)?report.errors:report.external).push({url:response.url(),status:response.status()});});
async function check(name,fn){console.log('Check '+name);try{report.checks.push({name,passed:true,detail:await fn()});}catch(error){report.checks.push({name,passed:false,message:error.message});console.log('FAILED '+error.message);}}
async function visit(route='/carte/?floor=1'){
  await page.goto(base+route,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.fonts.status==='loaded'&&window.NamelessMapRegions?.active?.getRegions().length===12);
  assert.ok(await page.locator('script[src*="map-regions.js"]').evaluate((el,version)=>el.src.includes('v='+version),version));
  await page.evaluate(()=>{const m=window.NamelessMapPage.active.map,state=window.__qaMapMotion={moving:false,zooming:false};m.on('movestart',()=>state.moving=true);m.on('moveend',()=>state.moving=false);m.on('zoomstart',()=>state.zooming=true);m.on('zoomend',()=>state.zooming=false);});
}
async function awaitChosen(id,key){
  await page.waitForFunction(({id,key})=>{
    const api=window.NamelessMapRegions?.active,bridge=window.NamelessMapPage?.active;
    const region=api?.getRegions().find(region=>region.id===id);
    if(!region||!bridge)return false;
    const center=bridge.getRelative(bridge.map.getCenter());
    const expectedU=(Math.min(...region.vertices.map(p=>p.u))+Math.max(...region.vertices.map(p=>p.u)))/2;
    const expectedV=(Math.min(...region.vertices.map(p=>p.v))+Math.max(...region.vertices.map(p=>p.v)))/2;
    return document.querySelector('#map-region-list [data-region-id="'+id+'"]')?.getAttribute('aria-pressed')==='true'&&new URL(location.href).searchParams.get('entity')===key&&Math.abs(center.u-expectedU)<.0003&&Math.abs(center.v-expectedV)<.0003&&!window.__qaMapMotion.moving&&!window.__qaMapMotion.zooming;
  },{id,key});
  return page.evaluate(()=>{const b=window.NamelessMapPage.active;return{entity:b.getSelection(),center:b.getRelative(b.map.getCenter()),zoom:b.map.getZoom(),url:location.href};});
}
async function awaitExplicit(view){
  try{await page.waitForFunction(view=>{const b=window.NamelessMapPage?.active;if(!b)return false;const center=b.getRelative(b.map.getCenter());return Math.abs(center.u-view.u)<.0003&&Math.abs(center.v-view.v)<.0003&&Math.abs(b.map.getZoom()-view.zoom)<1e-9&&!window.__qaMapMotion.moving&&!window.__qaMapMotion.zooming;},view);}catch(error){const actual=await page.evaluate(()=>{const b=window.NamelessMapPage?.active;return{url:location.href,center:b&&b.getRelative(b.map.getCenter()),zoom:b?.map.getZoom(),entity:b?.getSelection(),motion:window.__qaMapMotion,regions:window.NamelessMapRegions?.active?.getRegions().length};});throw new Error(error.message+'; explicit expected '+JSON.stringify(view)+'; actual '+JSON.stringify(actual));}
  return page.evaluate(()=>{const b=window.NamelessMapPage.active;return{entity:b.getSelection(),center:b.getRelative(b.map.getCenter()),zoom:b.map.getZoom(),url:location.href};});
}
try{
  await check('Accentless native map search filters the exact region and keyboard selection uses its camera',async()=>{
    await visit();await page.locator('#map-search-input').fill('vallee');
    assert.equal(await page.locator('#map-region-list [data-region-id]').count(),1);
    assert.equal(await page.locator('.map-region-outline').count(),1);
    assert.equal(await page.locator('#map-region-list [data-region-id="vallee-loups"]').count(),1);
    const result=page.locator('.search-result-item[data-entity-key="location:1:vallee-loups"]');
    await result.focus();await page.keyboard.press('Enter');
    const camera=await awaitChosen('vallee-loups','location:1:vallee-loups');
    assert.match(await page.locator('#map-panel-content').innerText(),/Vallée des Loups/);
    return{query:'vallee',exactRegion:true,nativeZoneResult:true,keyboardCamera:camera};
  });
  await check('Rapid A to B to C selection during zoom keeps the final native entity, panel and camera',async()=>{
    await visit();
    const choices=[['zone-sanglier','location:1:zone-sanglier'],['vallee-loups','location:1:vallee-loups'],['ruines-maudites','location:1:ruines-maudites']];
    const started=Date.now();
    for(const[id]of choices)await page.locator('#map-region-list [data-region-id="'+id+'"]').click({noWaitAfter:true});
    const inputDurationMs=Date.now()-started;
    const camera=await awaitChosen(...choices[2]);
    assert.match(await page.locator('#map-panel-content').innerText(),/Ruines Maudites/);
    assert.equal(await page.locator('#map-region-list [aria-pressed="true"]').count(),1);
    await page.locator('#map-region-list [data-region-id="vallee-loups"]').focus();await page.keyboard.press('Enter');
    const keyboardCamera=await awaitChosen(...choices[1]);
    if(!process.argv.includes('--no-capture')){await page.mouse.move(80,80);const file='after-region-selected-1920x1080.png';await page.screenshot({path:path.join(output,file)});report.captures.push({file,url:page.url(),viewport:page.viewportSize(),selectedRegion:'vallee-loups'});}
    return{sequence:choices.map(choice=>choice[0]),artificialIntermediateWaits:0,inputDurationMs,finalCamera:camera,keyboardCamera};
  });
  await check('Explicit shared viewport survives region mount and native Back restores it during queued zoom',async()=>{
    const view={u:.4,v:.6,zoom:-1.25};
    const route='/carte/?floor=1&entity=location%3A1%3Avallee-loups&u=0.4&v=0.6&zoom=-1.25';
    await visit(route);const mountedView=await awaitExplicit(view);
    assert.equal(await page.locator('.map-region-outline').count(),12);
    await page.evaluate(()=>window.__qaInitialMapBridge=window.NamelessMapPage.active);
    const started=Date.now();await page.locator('#map-region-list [data-region-id="zone-sanglier"]').click({noWaitAfter:true});await page.locator('#map-region-list [data-region-id="ruines-maudites"]').click({noWaitAfter:true});
    const inputDurationMs=Date.now()-started;
    await page.goBack({waitUntil:'domcontentloaded'});await page.goBack({waitUntil:'domcontentloaded'});
    await page.waitForURL(url=>url.searchParams.get('u')==='0.4'&&url.searchParams.get('v')==='0.6'&&url.searchParams.get('zoom')==='-1.25');
    const restoredView=await awaitExplicit(view);
    assert.equal(await page.evaluate(()=>window.__qaInitialMapBridge===window.NamelessMapPage.active),true,'Back keeps the already-mounted map bridge');
    assert.equal(restoredView.entity,'location:1:vallee-loups');
    assert.match(await page.locator('#map-panel-content').innerText(),/Vallée des Loups/);
    return{requestedView:view,mountedView,inputDurationMs,artificialIntermediateWaits:0,nativeBackSteps:2,restoredView,sameMapBridge:true};
  });
}finally{
  fs.writeFileSync(path.join(output,'final-verification.json'),JSON.stringify(report,null,2)+'\n');
  await ctx.close();await browser.close();
}
if(report.checks.some(check=>!check.passed)||report.errors.length)process.exitCode=1;
