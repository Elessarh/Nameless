#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function surface(kind, getIndex, id) {
    const isCreature = kind === 'creature';
    const dom = new JSDOM(read(isCreature ? 'pages/bestiaire.html' : 'pages/items.html'), { url: 'https://nameless-sao.fr/' + (isCreature ? 'bestiaire?creature=' : 'items?item=') + id,
        runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.NamelessSpaRouter = { controlsLifecycle: true };
    w.NamelessGlobalSearch = { getIndex };
    w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.matchMedia = () => ({ matches: true });
    w.eval(isCreature ? read('js/bestiaire.js') : read('js/items-catalog-hdv.js') + '\n' + read('js/items.js'));
    (isCreature ? w.NamelessBestiaryPage : w.NamelessItemsPage).init(w.document);
    return dom;
}
const creatureEntry = (id, mapUrl = '/carte?floor=1&entity=creature%3A' + id) => ({ kind: id === '1' ? 'boss' : 'creature', id, title: 'Créature', mapUrl, location: 'Marécage putride', positionKnown: true });
const dropEntry = (id, title, creatureId, dropNames = [title], url = '/items?item=' + id) => ({ kind: 'item', id, title, url, dropNames, sources: [{ url: '/bestiaire?creature=' + creatureId }] });

{
    let calls = 0;
    const dom = surface('creature', () => { calls++; return Promise.resolve([creatureEntry('1'), dropEntry('gelee_slime', 'Gelée de Slime', 1)]); }, 1);
    await flush();
    const d = dom.window.document, link = d.querySelector('.creature-map-link');
    check(link && new URL(link.href).pathname === '/carte', 'Boss modal receives a native map link from the shared search index');
    check(new URL(link.href).searchParams.get('entity') === 'creature:1', 'Creature ID remains distinct from its zone');
    check(d.querySelector('.creature-map-location').textContent.includes('Repère de zone ; position exacte inconnue.'), 'Zone link explicitly preserves unknown exact spawn');
    assert.equal(calls, 1, 'One request uses the existing cache API');
    check(new URL(d.querySelector('.drop-item[data-item="Gelée de Slime"]').href).searchParams.get('item') === 'gelee_slime', 'A known normalized drop opens its exact item ID');
    check(new URL(d.querySelector('.drop-item[data-item="Essence de Gorbel"]').href).searchParams.has('q'), 'A drop absent from the shared index keeps its search fallback');
    dom.window.NamelessBestiaryPage.destroy(); dom.window.close();
}
{
    const dom = surface('creature', () => Promise.resolve([dropEntry('peau_glacial', "Peau d'ur Glacial", 22, ['Peau Dur Glacial'])]), 22);
    await flush();
    const d = dom.window.document, link = d.querySelector('.drop-item[data-item="Peau Dur Glacial"]');
    check(new URL(link.href).searchParams.get('item') === 'peau_glacial' && !new URL(link.href).searchParams.has('q'), 'The reviewed Glacial drop alias opens its actual catalogue item');
    check(!d.querySelector('.creature-map-link'), 'Direct item lookup does not depend on a known map position');
    dom.window.NamelessBestiaryPage.destroy(); dom.window.close();
}
for (const item of [
    dropEntry('gelee_slime', 'Gelée de Slime', 1, undefined, 'javascript:alert(1)'),
    dropEntry('gelee_slime', 'Gelée de Slime', 1, undefined, 'https://evil.test/items?item=gelee_slime'),
    dropEntry('gelee_slime', 'Gelée de Slime', 1, undefined, '/items?item=other'),
    dropEntry('gelee_slime', 'Gelée de Slime', 1, undefined, '/itemsevil?item=gelee_slime'),
    dropEntry('bad"><script>', 'Gelée de Slime', 1),
    dropEntry('gelee_slime', 'Gelée de Slime', 2),
    { ...dropEntry('gelee_slime', 'Gelée de Slime', 1), sources: [{url:'https://evil.test/bestiaire?creature=1'}] }
]) {
    const dom = surface('creature', () => Promise.resolve([item]), 1); await flush();
    check(new URL(dom.window.document.querySelector('.drop-item[data-item="Gelée de Slime"]').href).searchParams.has('q'), 'Unsafe item identity/URL or unrelated creature sources never replace the fallback');
    dom.window.NamelessBestiaryPage.destroy(); dom.window.close();
}
for (const mapUrl of ['https://evil.test/carte?floor=1&entity=creature%3A1', 'javascript:alert(1)', '/carteevil?floor=1&entity=creature%3A1', '/carte?floor=2&entity=creature%3A1', '/carte?floor=1&entity=creature%3A999']) {
    const dom = surface('creature', () => Promise.resolve([creatureEntry('1', mapUrl)]), 1);
    await flush();
    check(!dom.window.document.querySelector('.creature-map-link'), 'Unsafe, wrong-floor or wrong-entity map URL is rejected');
    check(dom.window.document.querySelector('.creature-map-location').textContent === 'Position non renseignée.', 'Rejected link never implies known coordinates');
    dom.window.NamelessBestiaryPage.destroy(); dom.window.close();
}
{
    const dom = surface('creature', () => Promise.resolve([{ kind: 'creature', id: '18', title: 'Néphantes' }]), 18);
    await flush();
    check(!dom.window.document.querySelector('.creature-map-link'), 'Missing location reference leaves the creature position unknown');
    dom.window.NamelessBestiaryPage.destroy(); dom.window.close();
}
{
    const dom = surface('creature', () => Promise.resolve([{ ...creatureEntry('18'), positionKnown: false }]), 18);
    await flush();
    const d = dom.window.document;
    check(!d.querySelector('.creature-map-link'), 'A valid map URL without a confirmed position never becomes a zone link');
    check(d.querySelector('.creature-map-location').textContent === 'Position non renseignée.', 'An unknown creature position keeps its truthful status despite an available map entry');
    dom.window.NamelessBestiaryPage.destroy(); dom.window.close();
}
{
    const pending = deferred(), dom = surface('creature', () => pending.promise, 1), d = dom.window.document;
    d.querySelector('.creature-modal .modal-close').click();
    pending.resolve([creatureEntry('1'), dropEntry('gelee_slime', 'Gelée de Slime', 1)]); await flush();
    check(d.querySelector('.creature-modal').style.display === 'none' && !d.querySelector('.creature-map-link'), 'Delayed lookup after close never updates or reopens the hidden modal');
    check(new URL(d.querySelector('.drop-item[data-item="Gelée de Slime"]').href).searchParams.has('q'), 'A delayed index result cannot rewrite drops in a closed modal');
    dom.window.NamelessBestiaryPage.destroy(); dom.window.close();
}
{
    const pending = deferred(), dom = surface('creature', () => pending.promise, 1), d = dom.window.document;
    dom.window.openCreatureModal(2);
    pending.resolve([creatureEntry('1'), creatureEntry('2')]); await flush();
    const links = d.querySelectorAll('.creature-map-link');
    check(links.length === 1 && new URL(links[0].href).searchParams.get('entity') === 'creature:2', 'Switching creature invalidates the old modal section');
    dom.window.NamelessBestiaryPage.destroy(); dom.window.close();
}
{
    const pending = deferred(), dom = surface('creature', () => pending.promise, 1), d = dom.window.document;
    dom.window.NamelessBestiaryPage.destroy();
    pending.resolve([creatureEntry('1')]); await flush();
    check(!d.querySelector('.creature-modal'), 'Page destruction aborts the lifecycle and prevents a stale modal');
    dom.window.close();
}

const itemEntry = sources => ({ kind: 'item', id: 'gelee_slime', title: 'Gelée de Slime', sources });
const sourceEntry = (overrides = {}) => ({ title: 'Gorbel', url: '/bestiaire?creature=1', floor: 1, location: 'Marécage putride', mapUrl: '/carte?floor=1&entity=creature%3A1', ...overrides });
{
    const dangerousText = '<img src=x onerror=alert(1)>', sources = [
        sourceEntry({ title: dangerousText, location: dangerousText }),
        sourceEntry({ title: 'Unknown zone', url: '/bestiaire?creature=18', location: 'Champ de Mizunari', mapUrl: undefined }),
        sourceEntry({ title: 'External', url: 'https://evil.test/bestiaire?creature=1' }),
        sourceEntry({ title: 'Script', mapUrl: 'javascript:alert(1)' }),
        sourceEntry({ title: 'Wrong creature', mapUrl: '/carte?floor=1&entity=creature%3A3' }),
        sourceEntry({ title: 'Wrong floor', mapUrl: '/carte?floor=2&entity=creature%3A1' }),
        sourceEntry({ title: 'Invalid path', url: '/bestiaireevil?creature=1' }), null
    ];
    const dom = surface('item', () => Promise.resolve([itemEntry(sources)]), 'gelee_slime'); await flush();
    const d = dom.window.document, list = d.querySelector('.item-sources ul'), rows = list.querySelectorAll('li');
    assert.equal(rows.length, 5, 'Invalid bestiary source URLs and malformed rows are omitted');
    check(rows[0].textContent.includes(dangerousText) && !rows[0].querySelector('img, script'), 'Source titles and zone names render as text, never HTML');
    check(rows[0].querySelector('.item-source-zone').textContent.includes(dangerousText), 'Every supplied known zone is displayed');
    check(list.querySelectorAll('.item-source-map-link').length === 1, 'Only a matching same-origin map reference produces a link');
    check(new URL(rows[0].querySelector('.item-source-map-link').href).searchParams.get('entity') === 'creature:1', 'Item source map link opens the actual creature relation');
    check(rows[1].textContent.includes('Champ de Mizunari') && !rows[1].querySelector('.item-source-map-link'), 'Unknown map zone retains its source name without a invented position');
    dom.window.NamelessItemsPage.destroy(); dom.window.close();
}
{
    const pending = deferred(), dom = surface('item', () => pending.promise, 'gelee_slime'), d = dom.window.document;
    d.querySelector('.item-modal .modal-close').click(); pending.resolve([itemEntry([sourceEntry()])]); await flush();
    check(d.querySelector('.item-modal').style.display === 'none' && !d.querySelector('.item-source-map-link'), 'Delayed item sources do not update or reopen a closed modal');
    dom.window.NamelessItemsPage.destroy(); dom.window.close();
}
{
    const pending = deferred(), dom = surface('item', () => pending.promise, 'gelee_slime'), d = dom.window.document;
    d.querySelector('.item-modal .modal-close').click(); pending.reject(new Error('Index unavailable')); await flush();
    check(d.querySelector('.item-sources').textContent.includes('Chargement des sources...')
        && !d.querySelector('.item-sources').textContent.includes('temporairement indisponibles'), 'A delayed rejection also leaves a closed item modal untouched');
    dom.window.NamelessItemsPage.destroy(); dom.window.close();
}
{
    const pending = deferred(), dom = surface('item', () => pending.promise, 'gelee_slime'), d = dom.window.document;
    dom.window.history.replaceState({}, '', '/items?item=noyau_slime');
    d.dispatchEvent(new dom.window.CustomEvent('nameless:routechange'));
    pending.resolve([itemEntry([sourceEntry()]), { kind: 'item', id: 'noyau_slime', sources: [sourceEntry({ title: 'Petit Slime', url: '/bestiaire?creature=2', mapUrl: '/carte?floor=1&entity=creature%3A2' })] }]); await flush();
    check(d.querySelector('.item-modal-name').textContent === 'Noyau de Slime' && d.querySelectorAll('.item-source-map-link').length === 1
        && new URL(d.querySelector('.item-source-map-link').href).searchParams.get('entity') === 'creature:2', 'Switching item retains only the current item sources');
    dom.window.NamelessItemsPage.destroy(); dom.window.close();
}
{
    const pending = deferred(), dom = surface('item', () => pending.promise, 'gelee_slime'), d = dom.window.document;
    dom.window.NamelessItemsPage.destroy(); pending.resolve([itemEntry([sourceEntry()])]); await flush();
    check(!d.querySelector('.item-modal'), 'Page destruction prevents stale item source content'); dom.window.close();
}
// Deferred scripts run after parsing, with readyState=interactive. Execute the
// actual script order and shared search implementation rather than preinstalling its API.
for (const [pageFile, route, controllerFile, catalogFile] of [
    ['pages/items.html', '/items?item=gelee_slime', 'js/items.js', 'js/items-catalog-hdv.js'],
    ['pages/bestiaire.html', '/bestiaire?creature=1', 'js/bestiaire.js', null]
]) {
    const dom = new JSDOM(read(pageFile), { url: 'https://nameless-sao.fr' + route, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window, d = w.document;
    const order = [...d.querySelectorAll('script[src]')].map(script => new URL(script.src).pathname.slice(1));
    check(order.indexOf('js/global-search.js') >= 0 && order.indexOf('js/global-search.js') < order.indexOf(controllerFile), 'Shared index script precedes the direct-visit controller in ' + pageFile);
    Object.defineProperty(d, 'readyState', { configurable: true, value: 'interactive' });
    let requests = 0;
    w.fetch = async url => {
        assert.equal(new URL(String(url), w.location.href).pathname, '/assets/search-index.json', 'Direct visit only requests the shared index'); requests++;
        return { ok: true, json: async () => ({ version: 1, entries: [
            { ...creatureEntry('1'), url: '/boss/gorbel' },
            { ...itemEntry([sourceEntry()]), url: '/items?item=gelee_slime', dropNames: ['Gelée de Slime'] }
        ] }) };
    };
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; w.matchMedia = () => ({ matches: true });
    const context = dom.getInternalVMContext();
    for (const file of order.filter(file => [controllerFile, catalogFile, 'js/global-search.js'].includes(file))) vm.runInContext(read(file), context, { filename: file });
    await flush();
    assert.equal(requests, 1, 'The real shared cache serves the direct visit with one index request');
    if (catalogFile) check(d.querySelector('.item-sources .item-source-map-link'), 'Direct item URL automatically renders real cached sources and their map link');
    else {
        check(d.querySelector('.creature-map-link'), 'Direct creature URL automatically renders its cached map link');
        check(new URL(d.querySelector('.drop-item[data-item="Gelée de Slime"]').href).searchParams.get('item') === 'gelee_slime', 'Direct creature URL automatically rewrites known drops to item IDs');
    }
    (catalogFile ? w.NamelessItemsPage : w.NamelessBestiaryPage).destroy(); dom.window.close();
}
console.log('Map links tests passed: ' + checks + ' checks for real deferred script order, cached data, safe URLs and stale modal lifecycles.');
