#!/usr/bin/env node
// Public catalogue regressions: shared URLs, keyboard access, modal focus and map input safety.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function surface(page, url, scripts) {
    const dom = new JSDOM(read(page), { url: 'https://nameless-sao.fr' + url, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.NamelessSpaRouter = { controlsLifecycle: true };
    w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.matchMedia = () => ({ matches: true });
    if (scripts.length) w.eval(scripts.map(read).join('\n'));
    return dom;
}
function key(w, target, value, options = {}) { target.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options })); }
function route(w, url) { w.history.replaceState({}, '', url); w.document.dispatchEvent(new w.CustomEvent('nameless:routechange')); }
function paletteIsolation(w, selector) {
    const d = w.document, entity = d.querySelector(selector);
    const palette = d.createElement('dialog'); palette.open = true;
    const field = d.createElement('input'); palette.appendChild(field); d.body.appendChild(palette); field.focus();
    for (const value of ['Tab', 'Escape']) {
        const event = new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }); field.dispatchEvent(event);
        check(!event.defaultPrevented && d.activeElement === field && entity.style.display === 'flex', 'A native palette owns ' + value + ' without closing or trapping its underlying catalogue modal');
    }
    palette.remove();
}

{
    const dom = surface('pages/bestiaire.html', '/bestiaire?creature=53', ['js/bestiaire.js']);
    const w = dom.window, d = w.document;
    w.NamelessBestiaryPage.init(d);
    check(d.querySelector('.creature-card .creature-name').tagName === 'H2', 'Creature cards follow the page H1 without skipping a heading level');
    check(d.querySelector('[role="dialog"] h2').textContent === 'Illfang', 'Bestiary deep link opens the requested creature');
    check(d.querySelector('.modal-section-title').tagName === 'H3', 'Creature detail sections follow the dialogue H2');
    check(d.activeElement.matches('.modal-close'), 'Creature modal receives focus');
    paletteIsolation(w, '.creature-modal');
    d.querySelector('.creature-modal .modal-close').focus();
    key(w, d.activeElement, 'Tab');
    check(d.activeElement.matches('.modal-close'), 'Single-control modal traps forward Tab');
    key(w, d.activeElement, 'Escape');
    check(!w.location.search.includes('creature='), 'Closing modal clears the entity parameter');
    const card = d.querySelector('.creature-card'); card.focus(); key(w, card, 'Enter');
    check(d.querySelector('.creature-modal').style.display === 'flex', 'Creature card opens with Enter');
    const drop = d.querySelector('a.drop-item');
    check(drop && drop.pathname === '/items' && drop.searchParams === undefined && drop.search.startsWith('?q='), 'Drops are native catalogue links');
    const controls = d.querySelectorAll('.creature-modal button, .creature-modal a');
    controls[controls.length - 1].focus(); key(w, d.activeElement, 'Tab');
    check(d.activeElement === controls[0], 'Creature modal wraps Tab from its last link');
    key(w, d.activeElement, 'Escape');
    check(d.activeElement === card, 'Closing creature modal restores the opener focus');
    route(w, '/bestiaire?creature=54');
    check(d.querySelector('.modal-name').textContent === 'Jira', 'Same-route navigation opens another creature');
    route(w, '/bestiaire?creature=53%22%3E%3Cscript%3E');
    check(d.querySelector('.creature-modal').style.display === 'none', 'Invalid creature identifiers are ignored');
    w.NamelessBestiaryPage.destroy(); dom.window.close();
}

{
    const dom = surface('pages/items.html', '/items?item=potion_mana', ['js/items-catalog-hdv.js', 'js/items.js']);
    const w = dom.window, d = w.document;
    w.NamelessGlobalSearch = { getIndex: async () => [{ kind: 'item', id: 'potion_mana', sources: [{ title: '<script>unsafe</script>', url: '/bestiaire?creature=1', floor: 1 }] }] };
    w.NamelessItemsPage.init(d); await pause(0);
    check(d.querySelector('.item-card .item-name').tagName === 'H2', 'Item cards follow the page H1 without skipping a heading level');
    check(d.querySelector('[role="dialog"] h2').textContent === 'Potion de Mana', 'Item deep link opens a real catalogue ID');
    paletteIsolation(w, '.item-modal');
    check(d.querySelector('.item-sources a').textContent.includes('<script>unsafe</script>') && !d.querySelector('.item-sources script'), 'Derived item sources are rendered as plain text');
    const links = d.querySelectorAll('.item-modal button, .item-modal a'); links[links.length - 1].focus(); key(w, d.activeElement, 'Tab');
    check(d.activeElement === links[0], 'Item modal traps forward Tab');
    key(w, d.activeElement, 'Tab', { shiftKey: true });
    check(d.activeElement === links[links.length - 1], 'Item modal traps backward Tab');
    key(w, d.activeElement, 'Escape');
    route(w, '/items?q=ECLAT');
    check(d.querySelectorAll('.item-card').length > 0, 'Item search ignores accents and case');
    route(w, '/items?item=anneau_faucheuse');
    check(d.querySelector('.item-modal-name').textContent === 'Anneau de la Faucheuse', 'Same-route navigation opens another item');
    w.NamelessItemsPage.destroy(); dom.window.close();
}

{
    const dom = surface('pages/quetes.html', '/quetes?quest=p2-principale-1', ['js/quetes.js']);
    const w = dom.window, d = w.document; w.NamelessQuestPage.init(d);
    check(d.querySelector('#tier-select').value === '2', 'Quest deep link selects its floor');
    check(d.activeElement.id === 'p2-principale-1' && d.activeElement.style.display === 'block', 'Quest deep link focuses its visible step');
    const all = Array.from(d.querySelectorAll('.quest-step'));
    check(all.every(step => step.id) && new Set(all.map(step => step.id)).size === all.length, 'Quest IDs are permanent and unique');
    const coords = d.querySelector('#p2-principale-1 a.coordinates');
    check(coords && new URL(coords.href).searchParams.get('y') === '-888', 'Quest coordinate links preserve negative values');
    route(w, '/quetes?quest=p1-principale-1');
    check(d.activeElement.id === 'p1-principale-1' && d.querySelector('#tier-select').value === '1', 'Same-route quest navigation changes floor');
    check(d.querySelector('.quest-filter-btn.active').getAttribute('aria-pressed') === 'true', 'Quest category selection exposes state');
    w.NamelessQuestPage.destroy(); dom.window.close();
}

{
    const dom = surface('pages/wiki.html', '/wiki#reglement-aincrad', ['js/wiki.js']);
    const w = dom.window, d = w.document; w.NamelessWikiPage.init(d);
    check(d.querySelector('#page-reglement-aincrad').classList.contains('active'), 'Wiki hash opens its article');
    check(Array.from(d.querySelectorAll('a[data-page]')).every(link => link.hasAttribute('href')), 'Wiki navigation has native link destinations');
    const group = d.querySelector('.wiki-nav-group-header'); group.click();
    check(group.tagName === 'BUTTON' && group.getAttribute('aria-expanded') === 'false' && group.parentNode.querySelector('ul').hidden, 'Collapsed wiki groups hide their links from keyboard navigation');
    check(d.querySelectorAll('.wiki-toc a').length > 0, 'Long wiki articles offer a table of contents');
    const search = d.querySelector('#wiki-search'); search.value = 'reglement'; search.dispatchEvent(new w.Event('input'));
    await pause(180); key(w, search, 'ArrowDown');
    check(d.activeElement.matches('.wiki-search-result-item'), 'Wiki search results are accessible with ArrowDown');
    route(w, '/wiki#mage');
    check(d.querySelector('#page-mage').classList.contains('active'), 'Same-route wiki hash navigation updates the article');
    route(w, '/wiki');
    check(d.querySelector('#page-accueil').classList.contains('active'), 'Returning to the wiki root restores its overview');
    const tocLink = d.querySelector('#page-faq .wiki-toc a');
    if (tocLink) { route(w, '/wiki' + tocLink.hash); check(d.activeElement.id === tocLink.hash.split('/')[1], 'Wiki section links focus the referenced heading'); }
    w.NamelessWikiPage.destroy(); dom.window.close();
}

{
    const dom = surface('pages/wiki.html', '/wiki', ['js/wiki.js']);
    const w = dom.window, d = w.document;
    Object.defineProperty(w, 'innerWidth', { value: 390, writable: true });
    d.body.style.overflow = 'clip';
    w.NamelessWikiPage.init(d);
    const toggle = d.querySelector('#sidebar-toggle'), sidebar = d.querySelector('#wiki-sidebar'), content = d.querySelector('.wiki-content'), search = d.querySelector('#wiki-search');
    check(sidebar.inert === true && content.inert !== true, 'Closed mobile wiki sidebar does not disable the article');
    toggle.click();
    check(sidebar.classList.contains('open') && content.inert === true && d.activeElement === search && d.body.style.overflow === 'hidden', 'Mobile wiki sidebar focuses search and makes the article inert');
    key(w, search, 'Tab', { shiftKey: true });
    check(d.activeElement === toggle, 'Mobile wiki sidebar wraps backward Tab to its close toggle');
    key(w, toggle, 'Tab');
    check(d.activeElement === search, 'Mobile wiki sidebar wraps forward Tab to search');
    const palette = d.createElement('dialog'); palette.open = true;
    const field = d.createElement('input'); palette.appendChild(field); d.body.appendChild(palette); field.focus();
    const escape = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); field.dispatchEvent(escape);
    check(!escape.defaultPrevented && sidebar.classList.contains('open') && content.inert === true, 'Palette Escape does not close the underlying wiki sidebar');
    palette.remove(); search.focus(); key(w, search, 'Escape');
    check(!sidebar.classList.contains('open') && content.inert !== true && d.activeElement === toggle && d.body.style.overflow === 'clip', 'Closing mobile wiki restores focus, article interactivity and prior overflow');
    toggle.click(); w.innerWidth = 1080; w.dispatchEvent(new w.Event('resize'));
    check(!sidebar.classList.contains('open') && sidebar.inert === false && content.inert !== true && d.body.style.overflow === 'clip', 'Desktop resize closes the drawer and releases scroll/interactivity');
    w.innerWidth = 390; w.dispatchEvent(new w.Event('resize')); toggle.click(); w.NamelessWikiPage.destroy();
    check(content.inert !== true && d.body.style.overflow === 'clip', 'Wiki destruction restores drawer side effects');
    dom.window.close();
}

// A small Leaflet double exercises real map lifecycle and coordinate code without network or GPU.
function mockLeaflet(w) {
    const layers = new Set(), handlers = new Map();
    const record = { views: [], markers: [], images: [], overlays: [], activeLayers: layers };
    const m = {
        center: { lat: 2561, lng: 2560 }, zoom: -3,
        on(name, fn) { handlers.set(name, [...(handlers.get(name) || []), fn]); return this; },
        addLayer(layer) { layers.add(layer); return this; }, removeLayer(layer) { layers.delete(layer); return this; }, hasLayer(layer) { return layers.has(layer); },
        getCenter() { return this.center; }, getZoom() { return this.zoom; }, getMinZoom() { return -6; }, getMaxZoom() { return 10; },
        getContainer() { return w.document.querySelector('#game-map'); },
        setView(coords, zoom, options) { assert.ok(coords.every(Number.isFinite), 'Leaflet must never receive NaN coordinates'); this.center = { lat: coords[0], lng: coords[1] }; this.zoom = zoom; record.views.push({ coords: [...coords], zoom, options }); return this; },
        fitBounds(bounds) { this.center = { lat: (bounds[0][0] + bounds[1][0]) / 2, lng: (bounds[0][1] + bounds[1][1]) / 2 }; for (const fn of handlers.get('moveend') || []) fn(); return this; },
        setMaxBounds() {}, invalidateSize() {}, closePopup() {}, zoomIn() {}, zoomOut() {}, remove() { layers.clear(); handlers.clear(); }
    };
    w.L = {
        CRS: { Simple: {} }, map: () => m, icon: value => value, divIcon: value => value,
        layerGroup() { const values = []; return { addLayer(value) { values.push(value); return this; }, addTo(map) { map.addLayer(this); return this; }, eachLayer(fn) { values.forEach(fn); }, getLayers() { return values; }, clearLayers() { values.length = 0; } }; },
        marker(coords, options) { const marker = { options, getLatLng: () => ({ lat: coords[0], lng: coords[1] }), bindPopup() { return this; }, addTo(map) { map.addLayer(this); return this; } }; record.markers.push(marker); return marker; },
        imageOverlay(url, bounds, options = {}) {
            const events = new Map();
            const overlay = { url, bounds, opacity: options.opacity ?? 1, events,
                addTo(map) { map.addLayer(this); return this; }, bringToBack() {}, setOpacity(value) { this.opacity = value; return this; },
                on(name, fn) { events.set(name, [...(events.get(name) || []), fn]); return this; },
                off(name, fn) { events.set(name, (events.get(name) || []).filter(handler => handler !== fn)); return this; },
                emit(name) { for (const fn of [...(events.get(name) || [])]) fn(); }
            };
            record.images.push(url); record.overlays.push(overlay); return overlay;
        },
        control() { return { addTo(map) { if (this.onAdd) map.getContainer().appendChild(this.onAdd(map)); } }; },
        popup() { return { setLatLng() { return this; }, setContent() { return this; }, openOn() { return this; } }; },
        DomUtil: { create: (tag, name) => { const el = w.document.createElement(tag); el.className = name; return el; } }
    };
    record.zoom = zoom => { m.zoom = zoom; for (const fn of [...(handlers.get('zoomend') || [])]) fn(); };
    return record;
}
{
    const dom = surface('pages/map.html', '/carte?x=invalid&y=1', []), w = dom.window;
    const record = mockLeaflet(w);
    Object.defineProperty(w, 'localStorage', { get() { throw new w.DOMException('Storage denied', 'SecurityError'); } });
    w.eval(read('js/map.js')); w.NamelessMapPage.init();
    check(w.document.querySelector('#map-route-status').textContent.includes('invalides'), 'Malformed coordinate URL produces an accessible message');
    check(record.images[0].endsWith('.webp'), 'Map loads its optimized image');
    route(w, '/carte?floor=2&x=-40&y=-888'); await pause(330);
    check(record.views.some(view => view.coords[0] === 6009 && view.coords[1] === -40), 'Negative floor-two coordinates focus the correct map position');
    check(w.location.search.includes('y=-888'), 'Targeted map URL remains shareable');
    const search = w.document.querySelector('#map-search-input'); search.value = 'Maître'; search.dispatchEvent(new w.Event('input'));
    check(w.document.querySelector('.search-result-coords').textContent.includes('-888'), 'Floor-two search displays the original game Z coordinate');
    check(record.views.every(view => !view.options || !view.options.animate), 'Map honors reduced motion preference');
    route(w, '/carte?floor=3&q=Maître');
    check(w.document.querySelector('.search-no-results'), 'Floor three does not expose stale floor-one markers');
    w.NamelessMapPage.destroy(); dom.window.close();
}
{
    const dom = surface('pages/map.html', '/carte', []), w = dom.window;
    w.localStorage.setItem('ironOathMapState', JSON.stringify({ lat: 5121, lng: 0, zoom: 0, floor: 2 }));
    const record = mockLeaflet(w); w.eval(read('js/map.js')); w.NamelessMapPage.init(); await pause(230);
    check(record.views.some(view => view.coords[0] === 5121 && view.coords[1] === 0 && view.zoom === 0), 'Saved map position survives initial fitBounds and restores zero coordinates/zoom');
    w.NamelessMapPage.destroy(); dom.window.close();
}
{
    const dom = surface('pages/map.html', '/carte', []), w = dom.window;
    const record = mockLeaflet(w); w.eval(read('js/map.js')); w.NamelessMapPage.init();
    const preview = record.overlays[0];
    check(preview.url.endsWith('/carte-overview.webp') && !record.images.some(url => url.endsWith('/carte.webp')), 'Desktop overview loads without downloading the full bitmap');
    check(JSON.stringify(preview.bounds) === '[[85,85],[5036,5036]]', 'Progressive overview preserves the confirmed coordinate bounds');
    record.zoom(-1.65);
    check(record.overlays.length === 1, 'Full desktop image is deferred while overview resolution is sufficient');
    record.zoom(-1.6);
    const full = record.overlays[1];
    check(full.url.endsWith('/carte.webp') && full.opacity === 0 && record.activeLayers.has(preview), 'Full image loads transparently while overview stays visible');
    check(JSON.stringify(full.bounds) === JSON.stringify(preview.bounds), 'Full and overview overlays use identical bounds');
    record.zoom(0); check(record.overlays.length === 2, 'Repeated zoom does not start duplicate full image requests');
    full.emit('load');
    check(full.opacity === 1 && record.activeLayers.has(full) && !record.activeLayers.has(preview), 'Ready full image replaces the preview after its load event');
    record.zoom(-4); record.zoom(1);
    check(record.overlays.length === 2 && record.activeLayers.has(full), 'Zooming out retains the loaded full image');
    route(w, '/carte?floor=2'); check(!record.activeLayers.has(full), 'Changing floors removes the previous full overlay');
    route(w, '/carte?floor=1');
    check(record.activeLayers.has(full) && record.images.filter(url => url.endsWith('/carte.webp')).length === 1, 'Returning to floor one reuses its loaded full layer');
    w.NamelessMapPage.destroy(); check(!record.activeLayers.has(full), 'Destroy removes the cached full overlay'); dom.window.close();
}
{
    const dom = surface('pages/map.html', '/carte', []), w = dom.window;
    Object.defineProperty(w, 'innerWidth', { value: 390, writable: true });
    const record = mockLeaflet(w); w.eval(read('js/map.js')); w.NamelessMapPage.init();
    const preview = record.overlays[0];
    check(preview.url.endsWith('/carte-overview-mobile.webp'), 'Mobile loads the smaller overview');
    record.zoom(-2.3); check(record.overlays.length === 1, 'Mobile full image stays deferred below its own resolution threshold');
    record.zoom(-2.25); const pending = record.overlays[1];
    check(pending.url.endsWith('/carte.webp'), 'Mobile loads detail at its smaller overview resolution threshold');
    const staleLoad = pending.events.get('load')[0];
    route(w, '/carte?floor=2');
    check(!record.activeLayers.has(preview) && !record.activeLayers.has(pending), 'Floor change removes both preview and pending detail');
    staleLoad(); check(!record.activeLayers.has(pending), 'A stale full-image load cannot replace another floor');
    route(w, '/carte?floor=1'); record.zoom(-2.25); const retry = record.overlays.at(-1), currentPreview = record.overlays.at(-2);
    retry.emit('error');
    check(record.activeLayers.has(currentPreview) && !record.activeLayers.has(retry) && w.document.querySelector('#map-route-status').textContent.includes('aperçu'), 'Full-image failure retains the overview and announces an accessible message');
    const requested = record.overlays.length; record.zoom(1); check(record.overlays.length === requested, 'Failed detail does not retry repeatedly on every zoom event');
    route(w, '/carte?floor=2'); route(w, '/carte?floor=1'); record.zoom(0);
    const destroyedLoad = record.overlays.at(-1).events.get('load')[0]; w.NamelessMapPage.destroy(); destroyedLoad();
    check(record.activeLayers.size === 0 && !w.document.querySelector('#map-route-status'), 'Destroy prevents stale detail callbacks and clears map layers/status');
    dom.window.close();
}
console.log(`Catalogue DOM regressions: ${checks} checks passed.`);
