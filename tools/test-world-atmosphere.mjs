import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const entries = ['index.html','404.html',...fs.readdirSync(path.join(root,'pages')).filter(f=>f.endsWith('.html')).map(f=>'pages/'+f)];
for (const file of entries) {
    const dom = new JSDOM(read(file));
    const d = dom.window.document;
    assert.equal(d.querySelectorAll('script[src*="js/world-atmosphere.js"]').length,1,'Direct loads mount atmosphere exactly once: '+file);
    assert.equal(d.querySelectorAll('link[href*="world-experience.css"]').length,1,'Direct loads receive the common system: '+file);
    assert.ok(['aincrad','forest','armory','guild','dungeon'].includes(d.documentElement.dataset.worldAtmosphere));
    dom.window.close();
}
for (const [route,theme] of [['/boss/illfang/','dungeon'],['/pages/items.html','armory'],['/bestiaire/','forest'],['/espace-guilde/','guild'],['/quetes/','dungeon']]) {
    const dom = new JSDOM('<html data-world-atmosphere="aincrad"><body class="preserved"><main>Real content</main></body></html>',{url:'https://nameless-sao.fr'+route,runScripts:'outside-only',pretendToBeVisual:true});
    const w = dom.window;
    w.eval(read('js/world-atmosphere.js'));
    const atmosphere=w.document.querySelector('.nm-page-atmosphere');
    assert.equal(atmosphere.parentElement,w.document.body,'Atmosphere sits outside the route container');
    assert.equal(atmosphere.getAttribute('aria-hidden'),'true','Decoration is excluded from navigation');
    assert.ok(atmosphere.hasAttribute('inert'),'Decoration cannot receive input');
    assert.equal(w.document.documentElement.dataset.worldAtmosphere,theme,'Atmosphere on direct/legacy route: '+route);
    w.NamelessWorldAtmosphere.sync('home');
    assert.equal(w.document.documentElement.dataset.worldAtmosphere,'aincrad');
    w.NamelessWorldAtmosphere.sync('bestiaire');
    assert.equal(w.document.documentElement.dataset.worldAtmosphere,'forest');
    w.NamelessWorldAtmosphere.sync('wiki');
    assert.ok(atmosphere.querySelector('img').getAttribute('src').includes('art-v6/archives-1672.webp'),'Codex has its archive environment');
    w.NamelessWorldAtmosphere.sync('carte');
    assert.ok(atmosphere.querySelector('img').getAttribute('src').includes('art-v4/guild-1280.webp'),'Map decoration is independent of the calibrated atlas');
    assert.equal(w.document.querySelectorAll('.nm-page-atmosphere').length,1,'SPA switches do not stack environments');
    assert.equal(w.document.querySelector('.nm-page-atmosphere'),atmosphere,'The shared layer is reused');
    assert.equal(w.document.body.className,'preserved','Atmosphere does not replace private/page classes');
    assert.equal(w.document.querySelector('main').textContent,'Real content','Atmosphere never writes game data');
    Object.defineProperty(w.document,'hidden',{value:true,configurable:true});
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    assert.equal(w.document.documentElement.dataset.worldHidden,'true');
    Object.defineProperty(w.document,'hidden',{value:false,configurable:true});
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    assert.equal(w.document.documentElement.dataset.worldHidden,'false');
    dom.window.close();
}
const boss = new JSDOM(read('_site/boss/illfang/index.html'));
assert.equal(boss.window.document.documentElement.dataset.worldAtmosphere,'dungeon','Static boss output has the right initial atmosphere');
assert.equal(boss.window.document.querySelectorAll('script[src*="world-atmosphere.js"]').length,1,'Static pages preserve common atmosphere boot');
boss.window.close();
console.log('World atmosphere passed: 13 direct shells, legacy routes, static boss, SPA sync, hidden state and preserved content/classes.');
