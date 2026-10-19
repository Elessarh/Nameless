// Public navigation against the shipped Leaflet, regions, atlas data and HTML.
// Only the extra P2 entry is a fixture: production P2 has no documented markers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const catalog = JSON.parse(read('assets/map/catalog.json'));
const zoneKey = 'location:1:zone-sanglier';
const baseZone = JSON.parse(read('assets/map/floor-1.json')).entities[zoneKey];
const fixture = { ...copy(baseZone), key: 'location:2:navigation-test', id: 'navigation-test', floor: 2,
    title: 'Navigation différée', titleEn: 'Deferred navigation', creatureKeys: [], relatedKeys: [], guideKeys: [] };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let checks = 0;
function equal(actual, expected, message) { assert.equal(actual, expected, message); ++checks; }
function check(value, message) { assert.ok(value, message); ++checks; }
async function waitFor(condition) {
    for (let n = 0; n < 40 && !condition(); ++n) await tick();
    assert.ok(condition(), 'Deferred route or selection settles');
}
function surface({ url = '/carte?floor=1', width = 390, floor2Wait, failFloor2 = false, extraFloor2 = false } = {}) {
    const errors = [], output = new VirtualConsole(); output.on('jsdomError', error => errors.push(error));
    const dom = new JSDOM(read('pages/map.html'), { url: 'https://nameless-sao.fr' + url,
        runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: output });
    const w = dom.window, d = w.document, container = d.getElementById('game-map');
    Object.defineProperty(w, 'innerWidth', { value: width, writable: true });
    Object.defineProperties(container, { clientWidth: { value: width <= 700 ? width - 32 : 850 }, clientHeight: { value: 600 } });
    container.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 600, right: width, width, height: 600 });
    w.SVGSVGElement.prototype.createSVGRect = () => ({});
    w.NamelessSpaRouter = { controlsLifecycle: true }; w.matchMedia = () => ({ matches: true }); w.scrollTo = () => {};
    w.supabase = { rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Function missing' } }) };
    w.fetch = async input => {
        const file = new URL(String(input), w.location.href).pathname.slice(1);
        if (file === 'assets/map/floor-2.json') {
            if (floor2Wait) await floor2Wait.promise;
            if (failFloor2) throw new Error('Isolated P2 failure');
        }
        const value = JSON.parse(read(file));
        if (extraFloor2 && file === 'assets/map/catalog.json') value.index.push(copy(fixture));
        if (extraFloor2 && file === 'assets/map/floor-2.json') { value.entities[fixture.key] = copy(fixture); value.points.push(fixture.key); }
        return { ok: true, json: async () => value };
    };
    for (const file of ['js/vendor/leaflet-1.9.4.js', 'js/map-regions.js', 'js/map.js']) w.eval(read(file));
    return { w, d, errors, init: () => w.NamelessMapPage.init(),
        search(value) { const input = d.getElementById('map-search-input'); input.value = value; input.dispatchEvent(new w.Event('input')); return input; },
        result(key = zoneKey) { return d.querySelector('.search-result-item[data-entity-key="' + key + '"]'); },
        route(value) { w.history.pushState(null, '', value); w.dispatchEvent(new w.PopStateEvent('popstate')); },
        async history(direction) { const changed = new Promise(resolve => w.addEventListener('popstate', resolve, { once: true })); w.history[direction](); await changed; await tick(); },
        destroy() { w.NamelessMapPage.destroy(); equal(errors.length, 0, errors.map(String).join('\n')); w.close(); } };
}
for (const width of [390, 1280]) {
    const p = surface({ width }); const bridge = await p.init(), d = p.d;
    p.search('Sanglier'); const result = p.result(); check(result, 'Search uses a real public atlas location');
    result.focus(); result.click(); await tick();
    equal(d.getElementById('map-panel').hidden, false, 'Focused search activation opens details');
    equal(d.activeElement, d.getElementById('map-panel-close'), 'Focus leaves hidden search results for the visible close control');
    equal(d.activeElement.closest('[hidden]'), null, 'The newly focused control has no hidden ancestor');
    d.activeElement.click(); equal(d.activeElement, d.getElementById('game-map'), 'Closing details restores map focus');
    p.search('Sanglier').focus(); const pointerResult = p.result(); pointerResult.click(); await tick();
    equal(d.activeElement, d.getElementById('map-search-input'), 'A click that did not own focus cannot steal input focus');
    await bridge.selectEntity(zoneKey, { activationSource: pointerResult });
    equal(d.activeElement, d.getElementById('map-search-input'), 'The bridge rejects a source control that does not actually own focus');
    d.getElementById('map-recenter').focus(); await bridge.selectEntity(zoneKey);
    equal(d.activeElement, d.getElementById('map-recenter'), 'Passive bridge selection never moves external focus');
    d.querySelector('[data-panel-tab="creatures"]').click();
    const related = d.querySelector('#map-panel-pane-creatures .map-relation');
    check(related, 'The selected real region exposes its documented creature');
    related.focus(); related.click(); await tick();
    equal(d.activeElement, d.getElementById('map-panel-close'), 'Activating a focused relation does not leave focus in replaced panel content');
    bridge.closeSelection(); p.search('');
    d.getElementById('map-filters-toggle').click();
    const region = d.querySelector('#map-region-list button'); check(region, 'The real region rail is populated');
    region.focus(); region.click(); await tick();
    equal(d.activeElement, d.getElementById('map-panel-close'), 'A focused region activation transfers focus through the shared bridge');
    equal(d.activeElement.closest('[hidden]'), null, 'Region selection leaves focus visible after its rail is replaced or hidden');
    bridge.closeSelection(); p.search(''); d.getElementById('map-filters-toggle').click();
    const passiveRegion = d.querySelector('#map-region-list button'); passiveRegion.focus();
    await bridge.selectEntity(zoneKey); await tick();
    check(d.activeElement !== d.getElementById('map-panel-close'), 'A focused old region control alone does not imply user activation');
    d.getElementById('map-recenter').focus();
    p.w.document.dispatchEvent(new p.w.CustomEvent('nameless:languagechange'));
    await bridge.reloadOverrides();
    equal(d.activeElement, d.getElementById('map-recenter'), 'Language and data refreshes preserve an unrelated focused control');
    p.destroy();
}
{
    const p = surface({ url: '/carte?floor=1&q=Sanglier' }); const bridge = await p.init(), d = p.d;
    const input = d.getElementById('map-search-input'), results = d.getElementById('map-search-results');
    const visibleRegions = () => d.querySelectorAll('#map-region-list button').length;
    const polygons = () => d.querySelectorAll('.leaflet-nameless-regions-pane path').length;
    equal(input.value, 'Sanglier', 'Direct query initializes the real search field');
    equal(visibleRegions(), 1, 'A direct query also filters regions initialized after the route');
    equal(polygons(), 1, 'The direct query applies to the actual Leaflet polygons');
    check(p.result(), 'Direct query exposes matching search results');
    d.getElementById('map-recenter').focus();
    p.route('/carte?floor=1'); await tick();
    equal(input.value, '', 'Restoring a URL without q clears the previous query');
    equal(results.hidden, true, 'Removing q closes the old result list');
    equal(visibleRegions(), 12, 'Removing q restores every documented region');
    equal(polygons(), 12, 'Removing q restores all genuine outlines');
    equal(d.activeElement, d.getElementById('map-recenter'), 'Query restoration does not steal focus');
    await p.history('back');
    equal(input.value, 'Sanglier', 'Native Back restores q'); equal(visibleRegions(), 1, 'Back restores the filtered region rail');
    equal(polygons(), 1, 'Back restores the filtered outlines'); equal(results.hidden, false, 'Back restores results');
    await p.history('forward');
    equal(input.value, '', 'Native Forward clears absent q again'); equal(visibleRegions(), 12, 'Forward restores the full rail');
    p.route('/carte?floor=1&q=Sanglier&entity=' + encodeURIComponent(zoneKey) + '&u=.4&v=.6&zoom=-1'); await tick();
    equal(bridge.getSelection(), zoneKey, 'Query restoration preserves explicit entity handling');
    equal(bridge.map.getZoom(), -1, 'Query restoration preserves an explicit camera');
    const expected = bridge.getLatLng({ u: .4, v: .6 });
    check(Math.abs(bridge.map.getCenter().lat - expected[0]) <= 1 && Math.abs(bridge.map.getCenter().lng - expected[1]) <= 1, 'The explicit camera center survives region filtering within Leaflet pixel rounding: ' + JSON.stringify({ center: bridge.map.getCenter(), expected }));
    await bridge.chooseFloor(3); await bridge.chooseFloor(1);
    equal(input.value, '', 'An explicit floor change clears the search field');
    equal(visibleRegions(), 12, 'Returning after a floor change does not resurrect the cleared region filter');
    p.destroy();
}
{
    const floor2Wait = deferred(), p = surface({ floor2Wait, extraFloor2: true });
    const bridge = await p.init(), d = p.d;
    d.getElementById('map-recenter').focus();
    p.route('/carte?floor=2&q=Navigation'); await tick();
    p.route('/carte?floor=1&q=Sanglier'); await waitFor(() => bridge.getData()?.floor === 1);
    floor2Wait.resolve(); await tick(); await tick();
    equal(bridge.getFloor(), 1, 'A late route floor cannot supersede newer history');
    equal(d.getElementById('map-search-input').value, 'Sanglier', 'A late route cannot overwrite the newer query');
    equal(d.querySelectorAll('#map-region-list button').length, 1, 'A late route cannot overwrite the newer region filter');
    equal(d.activeElement, d.getElementById('map-recenter'), 'Deferred passive routes never transfer focus');
    p.destroy();
}
for (const action of ['complete', 'move-focus', 'new-floor', 'route', 'destroy', 'failure']) {
    const floor2Wait = deferred(), p = surface({ floor2Wait, extraFloor2: true, failFloor2: action === 'failure' });
    const bridge = await p.init(), d = p.d;
    p.search('Navigation différée'); const result = p.result(fixture.key); result.focus(); result.click(); await tick();
    equal(bridge.getFloor(), 2, 'Search starts its lazy destination floor');
    if (action === 'move-focus') d.getElementById('map-recenter').focus();
    if (action === 'new-floor') { d.querySelector('[data-floor="3"]').focus(); await bridge.chooseFloor(3); }
    if (action === 'route') p.route('/carte?floor=1&q=Sanglier');
    if (action === 'destroy') { p.w.NamelessMapPage.destroy(); d.getElementById('map-recenter').focus(); }
    floor2Wait.resolve(); await tick(); await tick();
    if (action === 'complete') {
        await waitFor(() => bridge.getSelection() === fixture.key);
        equal(d.activeElement, d.getElementById('map-panel-close'), 'A successful awaited selection retains its activation focus intent');
    } else if (action === 'move-focus') {
        await waitFor(() => bridge.getSelection() === fixture.key);
        equal(d.activeElement, d.getElementById('map-recenter'), 'A delayed selection cannot reclaim focus after the user moves it');
    } else if (action === 'failure') {
        equal(d.getElementById('map-panel').hidden, true, 'A failed floor load cannot open details');
        equal(d.getElementById('map-search-results').hidden, false, 'Failed selection leaves its initiating result accessible');
        equal(d.activeElement, result, 'Failed selection keeps the focused visible result');
    } else {
        equal(d.getElementById('map-panel').hidden, true, 'Stale selection cannot reopen details after a newer lifecycle intent');
        check(d.activeElement !== d.getElementById('map-panel-close'), 'Stale selection cannot transfer focus');
        if (action === 'new-floor') equal(bridge.getFloor(), 3, 'A late floor cannot undo a newer explicit floor');
        if (action === 'route') { equal(d.getElementById('map-search-input').value, 'Sanglier', 'A late floor cannot overwrite the newer route query'); equal(d.querySelectorAll('#map-region-list button').length, 1, 'Newer route query remains synchronized with regions'); }
    }
    p.destroy();
}
console.log('Public map navigation: ' + checks + ' checks passed with bundled Leaflet and regions; focused activation, native query history, passive updates and deferred lifecycles.');
