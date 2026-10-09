/* Local-only member UI previews. Not copied into the public build. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const workspace = path.resolve(import.meta.dirname, '..');
const built = path.join(workspace, '_site');
const port = 4181;
const routes = new Map([['/qa/guild', 'espace-guilde'], ['/qa/profile', 'profil'], ['/qa/admin', 'admin-dashboard']]);
const scripts = new Set([
    'i18n-en.js', 'i18n-en-reviewed.js', 'i18n-quests-en-reviewed.js', 'i18n-game-en-reviewed.js',
    'i18n-information-en-reviewed.js', 'i18n.js', 'guild-date-utils.js', 'cache-manager.js', 'security-utils.js',
    'navbar-mobile.js', 'global-search.js', 'reference-shell.js', 'guild-expeditions.js', 'espace-guilde.js', 'profil.js', 'admin-dashboard.js', 'guild-chat.js', 'guild-dm.js'
]);
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';";
const headers = {
    'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
const fixtureCss = `.qa-fixture-banner{position:relative;z-index:1;padding:10px 16px;color:#f1ebdd;background:#35454a;border-bottom:1px solid #bba47a;font:500 13px/1.5 system-ui,sans-serif}.qa-fixture-banner a{color:#f1ebdd;margin-left:12px;text-decoration:underline}.qa-fixture-banner a:focus-visible{outline:2px solid #d3be91;outline-offset:3px}`;

// This SDK never contacts a server. Every read/write is confined to the current tab.
const boot = `(() => {
 'use strict';
 const now = new Date();
 const userId = '11111111-1111-4111-8111-111111111111';
 const peerId = '22222222-2222-4222-8222-222222222222';
 const source = '/assets/brand/nameless-emblem-256.webp';
 const current = {id:userId, username:'QA Commandant', role:'admin', classe:'Guerrier', niveau:40, minecraft_uuid:null, minecraft_username:null, created_at:'2026-01-01T12:00:00.000Z'};
 const tables = {
  user_profiles:[current,{id:peerId,username:'QA Éclaireur',role:'membre',classe:'Archer',niveau:32,minecraft_uuid:null,minecraft_username:null,created_at:'2026-02-01T12:00:00.000Z'}],
  guild_planning:[{id:'33333333-3333-4333-8333-333333333333',titre:'QA Préparation de sortie',description:'Exemple fictif réservé au contrôle de mise en page. Aucune sortie réelle.',type_event:'reunion',date_event:new Date(now.getTime()+86400000).toISOString(),created_at:now.toISOString()}],
  guild_objectives:[{id:'44444444-4444-4444-8444-444444444444',titre:'QA Réserve de consommables',description:'Objectif fictif pour vérifier la présentation de la progression.',progression:65,statut:'en_cours',created_at:now.toISOString()}],
  guild_presence:[],
  guild_activity_wall:[{id:'55555555-5555-4555-8555-555555555555',titre:'QA Note de préparation',contenu:'Publication fictive. Cette prévisualisation utilise les composants réels avec des données isolées en mémoire.',type:'annonce',image_url:null,created_at:now.toISOString(),created_by:userId}],
  guild_chat:[]
 };
 const writes = [];
 const session = {access_token:'QA-NOT-REAL',user:{id:userId,user_metadata:{},app_metadata:{}}};
 window.currentUser = session.user; window.userProfile = current; window.namelessAuthReady = true;
 let nextId = 1;
 function rowId(){return 'aaaaaaaa-aaaa-4aaa-8aaa-'+String(nextId++).padStart(12,'0')}
 const ok = data => Promise.resolve({data,error:null});
 function query(table) {
  const filters=[];const orders=[];let max=null;let single=false;let operation=null;let payload=null;let head=false;
  const q = {
   select(_columns,options={}){head=options.head===true;return q},
   eq(key,value){filters.push(row=>row[key]===value);return q},neq(key,value){filters.push(row=>row[key]!==value);return q},
   in(key,values){filters.push(row=>values.includes(row[key]));return q},
   gte(key,value){filters.push(row=>row[key]>=value);return q},gt(key,value){filters.push(row=>row[key]>value);return q},
   lte(key,value){filters.push(row=>row[key]<=value);return q},lt(key,value){filters.push(row=>row[key]<value);return q},
   or(){return q},order(key,options={}){orders.push([key,options.ascending!==false]);return q},
   limit(value){max=value;return q},range(start,end){max=end-start+1;return q},
   single(){single=true;return q},maybeSingle(){single=true;return q},
   insert(value){operation='insert';payload=value;return q},update(value){operation='update';payload=value;return q},
   upsert(value){operation='upsert';payload=value;return q},delete(){operation='delete';return q},
   then(resolve,reject){
    const all=tables[table]||(tables[table]=[]);const match=row=>filters.every(fn=>fn(row));
    if(operation){
     writes.push({table,operation,payload});
     if(operation==='delete') tables[table]=all.filter(row=>!match(row));
     else if(operation==='update') all.filter(match).forEach(row=>Object.assign(row,payload));
     else for(const value of Array.isArray(payload)?payload:[payload]) {
      const existing=operation==='upsert'?all.find(row=>row.id===value.id||(value.user_id&&row.user_id===value.user_id&&row.date_presence===value.date_presence)):null;
      if(existing)Object.assign(existing,value);else all.push({id:rowId(),created_at:new Date().toISOString(),created_by:userId,...value});
     }
    }
    let rows=(tables[table]||[]).filter(match).map(row=>({...row}));
    for(const [key,asc] of orders.reverse()) rows.sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''))*(asc?1:-1));
    const count=rows.length;if(max!==null)rows=rows.slice(0,max);
    if(table==='guild_presence')rows=rows.map(row=>({...row,user_profiles:tables.user_profiles.find(p=>p.id===row.user_id)}));
    return Promise.resolve({data:head?null:single?(rows[0]||null):rows,error:null,count}).then(resolve,reject);
   }
  };return q;
 }
 const channel = () => {const value={on(){return value},subscribe(){return value},unsubscribe(){return ok(null)}};return value};
 window.supabase = {
  auth:{getUser:()=>ok({user:session.user}),getSession:()=>ok({session}),signOut:()=>ok(null),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc: name => name==='current_user_role'?ok('admin'):ok(null),from:query,channel,removeChannel:()=>ok(null),
  functions:{invoke:async(_name,{body})=>{
   writes.push({operation:'edge-action',payload:body});
   const target=tables.user_profiles.find(row=>row.id===body.target_user_id);
   if(body.action==='update_role'&&target)target.role=body.role;
   if(body.action==='delete_user')tables.user_profiles=tables.user_profiles.filter(row=>row.id!==body.target_user_id);
   return {data:{success:true},error:null};
  }},
  storage:{from:()=>({createSignedUrl:()=>ok({signedUrl:location.origin+source}),upload:(_path)=>ok({path:_path}),remove:()=>ok(null)})}
 };
 Object.defineProperty(window,'NamelessQaFixture',{value:{tables,writes,session},writable:false});
 const realFetch=window.fetch.bind(window);
 window.fetch=(input,options)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==location.origin)return Promise.reject(new Error('External network disabled in QA fixture'));return realFetch(input,options)};
 const realOpen=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(method,url,...args){if(new URL(url,location.href).origin!==location.origin)throw new Error('External network disabled in QA fixture');return realOpen.call(this,method,url,...args)};
 const imageDescriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
 Object.defineProperty(HTMLImageElement.prototype,'src',{...imageDescriptor,set(value){let url;try{url=new URL(value,location.href)}catch{}imageDescriptor.set.call(this,url&&url.origin!==location.origin?source:value)}});
 function localImages(){if(typeof document==='undefined'||!document)return;for(const image of document.querySelectorAll('img[src]')){try{if(new URL(image.getAttribute('src'),location.href).origin!==location.origin)image.src=source}catch{image.src=source}}}
 new MutationObserver(localImages).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
 document.addEventListener('DOMContentLoaded',()=>{
  const week=window.NamelessGuildDates.isoWeek(now);tables.guild_objectives[0].semaine_numero=week.week;tables.guild_objectives[0].annee=week.year;
  tables.guild_presence.push({id:'66666666-6666-4666-8666-666666666666',user_id:peerId,date_presence:window.NamelessGuildDates.dateKey(now),statut:'present',created_at:now.toISOString()});
  document.getElementById('login-link')?.style.setProperty('display','none');document.getElementById('user-info')?.style.setProperty('display','flex');
  const username=document.getElementById('username');if(username)username.textContent=current.username;
  document.getElementById('logout-btn')?.addEventListener('click',()=>{window.alert('Prévisualisation QA : aucune session réelle à déconnecter.')});localImages();
 });
})();`;

function fixture(name) {
    const dom = new JSDOM(fs.readFileSync(path.join(workspace, 'pages', name + '.html'), 'utf8'));
    const doc = dom.window.document;
    for (const meta of doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')) meta.content = csp;
    for (const script of [...doc.scripts]) {
        const file = path.basename((script.getAttribute('src') || '').split('?')[0]);
        if (!scripts.has(file)) script.remove();
        else script.setAttribute('src', '/js/' + file);
    }
    const bootScript = doc.createElement('script'); bootScript.src = '/qa/boot.js'; bootScript.defer = true;
    doc.head.append(bootScript);
    // Deferred boot must precede the application modules while DOMContentLoaded sees all helpers.
    const firstScript = doc.querySelector('script'); if (firstScript !== bootScript) firstScript.before(bootScript);
    for (const element of doc.querySelectorAll('[href], [src]')) {
        for (const attribute of ['href', 'src']) {
            const value = element.getAttribute(attribute);
            if (value?.startsWith('../')) element.setAttribute(attribute, '/' + value.slice(3));
        }
    }
    for (const anchor of doc.querySelectorAll('a[href]')) {
        const alias = {'/espace-guilde':'/qa/guild','/profil':'/qa/profile','/admin-dashboard':'/qa/admin'}[anchor.getAttribute('href')];
        if (alias) anchor.href = alias;
    }
    const style = doc.createElement('link'); style.rel = 'stylesheet'; style.href = '/qa/fixture.css'; doc.head.append(style);
    const banner = doc.createElement('aside'); banner.className = 'qa-fixture-banner'; banner.setAttribute('aria-label', 'Prévisualisation isolée');
    banner.innerHTML = 'Prévisualisation QA · données fictives · aucune API réelle <a href="/qa/guild">Guilde</a><a href="/qa/profile">Profil</a><a href="/qa/admin">Administration</a>';
    doc.querySelector('header').after(banner);
    doc.title = 'QA isolée — ' + doc.title;
    const html = '<!doctype html>\n' + doc.documentElement.outerHTML;
    dom.window.close(); return html;
}

const types = {'.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg'};
function builtFile(url) {
    const extension = path.extname(url).toLowerCase();
    if (url.startsWith('/css/') && extension !== '.css') return null;
    if (url.startsWith('/js/') && (!scripts.has(path.basename(url)) || extension !== '.js')) return null;
    if (url.startsWith('/assets/') && !['.json','.png','.webp','.jpg','.jpeg','.svg','.woff2','.woff','.mp3'].includes(extension)) return null;
    if (!/^\/(css|js|assets)\//.test(url)) return null;
    const folder = url.split('/')[1];
    const target = path.resolve(built, '.' + url);
    if (!target.startsWith(path.join(built, folder) + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
    return target;
}

if (!fs.existsSync(built)) throw new Error('Root must build the site before starting QA fixtures.');
http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch { response.writeHead(400, headers); response.end(); return; }
    let body; let type;
    if (routes.has(pathname)) { body = fixture(routes.get(pathname)); type = 'text/html; charset=utf-8'; }
    else if (pathname === '/qa/boot.js') { body = boot; type = types['.js']; }
    else if (pathname === '/qa/fixture.css') { body = fixtureCss; type = types['.css']; }
    else {
        const file = builtFile(pathname);
        if (!file) { response.writeHead(404, {...headers,'Content-Type':'text/plain; charset=utf-8'}); response.end('QA fixture route not found.'); return; }
        response.writeHead(200, {...headers,'Content-Type':types[path.extname(file).toLowerCase()]});
        if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response); return;
    }
    response.writeHead(200, {...headers,'Content-Type':type});
    response.end(request.method === 'HEAD' ? undefined : body);
}).listen(port, '127.0.0.1', () => console.log('Isolated UI QA fixtures: http://127.0.0.1:4181/qa/guild · /qa/profile · /qa/admin'));
