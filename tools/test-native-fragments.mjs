import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {JSDOM} = require('jsdom');
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const registrySource = read('js/page-registry.js');
const routerSource = read('js/app-router.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
let assertions = 0;
function equal(actual, expected, message) {
    assert.equal(actual, expected, message);
    assertions++;
}
function ok(value, message) {
    assert.ok(value, message);
    assertions++;
}
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
}
function nextEvent(target, name) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Missing native ' + name + ' event')), 2000);
        target.addEventListener(name, event => { clearTimeout(timeout); resolve(event); }, {once: true});
    });
}
async function settled() {
    // Drain fetch/text/asset promises after the native event, without pretending
    // that JSDOM implements the browser's actual fragment scroll positioning.
    await tick();
    await tick();
}
async function until(condition, message) {
    const deadline = Date.now() + 2000;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error(message);
        await tick();
    }
    await settled();
}

async function fixture(path = '/confidentialite') {
    const initial = new URL(path, 'https://nameless-sao.fr');
    const source = ({'/confidentialite': 'confidentialite', '/conditions': 'conditions', '/items': 'items', '/carte': 'map', '/bestiaire': 'bestiaire'})[initial.pathname];
    const dom = new JSDOM(read('pages/' + source + '.html'), {
        url: initial.href, runScripts: 'outside-only', pretendToBeVisual: true
    });
    const {window} = dom;
    await new Promise(resolve => window.document.addEventListener('DOMContentLoaded', resolve, {once: true}));
    window.eval(registrySource);
    const registry = window.NamelessPageRegistry;
    const trace = [], requests = [], scrolls = [], fragmentScrolls = [];
    // Retain the real route identities, aliases and capability flags. Assets and
    // page modules have separate integration tests; this fixture isolates the
    // router's ownership of native history, document replacement and lifecycle.
    for (const route of registry.routes) {
        route.css = [];
        route.scripts = [];
        route.init = () => trace.push('init:' + route.id);
        route.destroy = () => trace.push('destroy:' + route.id);
    }
    const main = window.document.getElementById('main-content');
    window.scrollTo = options => scrolls.push(options);
    window.HTMLElement.prototype.scrollIntoView = function (options) { fragmentScrolls.push({node: this, options}); };
    window.document.addEventListener('nameless:routechange', event => trace.push('change:' + event.detail.route));
    function response(url) {
        const requested = new URL(url);
        const route = registry.routes.find(candidate => requested.pathname === '/' + candidate.source);
        assert.ok(route, 'The router only requests an actual registered source document');
        return {ok: true, text: async () => read(route.source)};
    }
    window.fetch = async url => { requests.push(url); return response(url); };
    window.eval(routerSource);
    equal(trace.join(','), 'init:' + registry.get(initial.pathname).id + ',change:' + registry.get(initial.pathname).id,
        'The actual initial route boots exactly once');
    return {dom, window, registry, main, trace, requests, scrolls, fragmentScrolls, response, navigate: window.NamelessSpaRouter.navigate};
}

function snapshot(f, selector) {
    return {node: f.main.querySelector(selector), focus: f.window.document.activeElement, trace: f.trace.join(','), requests: f.requests.length, scrolls: f.scrolls.length, fragmentScrolls: f.fragmentScrolls.length};
}
function unchanged(f, before, selector, label) {
    equal(f.main.querySelector(selector), before.node, label + ': the reading content retains its identity');
    equal(f.window.document.activeElement, before.focus, label + ': the router does not take focus');
    equal(f.trace.join(','), before.trace, label + ': no page lifecycle or routechange is repeated');
    equal(f.requests.length, before.requests, label + ': no replacement document is fetched');
    equal(f.scrolls.length, before.scrolls, label + ': the router does not scroll back to the top');
    equal(f.fragmentScrolls.length, before.fragmentScrolls, label + ': the router leaves native fragment scrolling alone');
    equal(f.main.hasAttribute('aria-busy'), false, label + ': no loading state survives');
}
async function clickFragment(f, anchor) {
    const popped = nextEvent(f.window, 'popstate');
    const changed = nextEvent(f.window, 'hashchange');
    anchor.click();
    await Promise.all([popped, changed]);
    await settled();
}
async function traverse(f, direction, {hashchange = true} = {}) {
    const events = [nextEvent(f.window, 'popstate')];
    if (hashchange) events.push(nextEvent(f.window, 'hashchange'));
    f.window.history[direction]();
    await Promise.all(events);
    await settled();
}

// The capability is deliberately restricted to the two static reading routes.
{
    const f = await fixture();
    equal(f.registry.routes.filter(route => route.nativeFragments === true).map(route => route.id).sort().join(','), 'conditions,confidentialite',
        'Only the actual privacy and terms routes opt into native fragment history');
    for (const path of ['/confidentialite/', '/pages/confidentialite.html', '/conditions/', '/pages/conditions.html']) {
        equal(f.registry.get(path).nativeFragments, true, 'The same legal capability survives the real alias ' + path);
    }
    f.dom.window.close();
}

for (const [path, fragment] of [['/confidentialite', 'services'], ['/conditions', 'acces']]) {
    const f = await fixture(path);
    const anchor = f.main.querySelector('a[href="#' + fragment + '"]');
    ok(anchor, 'The real document exposes its native table-of-contents destination');
    anchor.focus();
    const before = snapshot(f, '#' + fragment);
    await clickFragment(f, anchor);
    equal(f.window.location.hash, '#' + fragment, 'The default anchor action updates the real history URL');
    unchanged(f, before, '#' + fragment, path + ' native anchor click');
    await traverse(f, 'back');
    equal(f.window.location.hash, '', 'Native Back returns from the section to the unfragmented legal URL');
    unchanged(f, before, '#' + fragment, path + ' native Back');
    await traverse(f, 'forward');
    equal(f.window.location.hash, '#' + fragment, 'Native Forward returns to the reading section');
    unchanged(f, before, '#' + fragment, path + ' native Forward');
    f.dom.window.close();
}

// Selecting a reading section supersedes a destination whose fetch is pending.
{
    const f = await fixture();
    const waiting = deferred();
    f.window.fetch = url => { f.requests.push(url); return waiting.promise.then(() => f.response(url)); };
    const navigation = f.navigate('/items');
    equal(f.main.getAttribute('aria-busy'), 'true', 'A pending different route owns the loading state');
    const anchor = f.main.querySelector('a[href="#services"]');
    anchor.focus();
    const before = snapshot(f, '#services');
    await clickFragment(f, anchor);
    unchanged(f, before, '#services', 'Native fragment while another document is loading');
    waiting.resolve();
    equal(await navigation, true, 'The invalidated destination is handled without a full browser reload');
    await settled();
    unchanged(f, before, '#services', 'The old fetch resolves after the native fragment');
    equal(f.window.location.pathname + f.window.location.hash, '/confidentialite#services', 'The delayed destination cannot steal the native URL');
    f.dom.window.close();
}

// A skipped native transition may still deliver its queued update callback.
{
    const f = await fixture();
    let transition;
    const update = deferred(), finished = deferred();
    f.window.document.startViewTransition = callback => {
        transition = {
            ready: Promise.resolve(), finished: finished.promise, updateCallbackDone: update.promise,
            skipped: 0,
            skipTransition() { this.skipped++; finished.resolve(); },
            run() { callback(); update.resolve(); }
        };
        return transition;
    };
    const navigation = f.navigate('/items');
    await until(() => !!transition, 'The delayed native transition was not prepared');
    const anchor = f.main.querySelector('a[href="#services"]');
    anchor.focus();
    const before = snapshot(f, '#services');
    await clickFragment(f, anchor);
    equal(transition.skipped, 1, 'The native fragment cancels the active different-route transition');
    transition.run();
    equal(await navigation, true, 'A late skipped callback is handled without document fallback');
    unchanged(f, before, '#services', 'A skipped route callback runs after the native fragment');
    equal(f.window.location.pathname + f.window.location.hash, '/confidentialite#services', 'A late callback cannot replace fragment history');
    f.dom.window.close();
}

// Legal pages still fetch and activate normally when the route itself changes.
{
    const f = await fixture('/confidentialite#services');
    const originalSection = f.main.querySelector('#services');
    equal(await f.navigate('/conditions'), true, 'A different legal route is committed through the SPA');
    equal(f.requests.length, 1, 'Cross-route legal navigation fetches its actual source');
    ok(f.main.querySelector('#acces'), 'The terms document replaces privacy content');
    equal(f.window.document.activeElement, f.main, 'A full route change places focus on the new main');
    await traverse(f, 'back');
    equal(f.window.location.pathname + f.window.location.hash, '/confidentialite#services', 'Back restores the legal destination and its fragment');
    equal(f.requests.length, 2, 'Back across legal routes still fetches the destination');
    ok(f.main.querySelector('#services') && f.main.querySelector('#services') !== originalSection, 'Cross-route Back creates the new privacy content');
    equal(f.trace.join(','), 'init:confidentialite,change:confidentialite,destroy:confidentialite,init:conditions,change:conditions,destroy:conditions,init:confidentialite,change:confidentialite', 'Cross-route legal navigation preserves the complete lifecycle');
    equal(f.scrolls.length, 1, 'Only the unfragmented terms destination uses the page start');
    equal(f.fragmentScrolls.length, 1, 'Cross-route legal Back restores the reading target after replacement');
    equal(f.fragmentScrolls[0].node, f.main.querySelector('#services'), 'Cross-route legal Back targets the new section, not the removed document');
    equal(f.fragmentScrolls[0].options.block, 'start', 'The restored reading section aligns to the section start');
    equal(f.fragmentScrolls[0].options.behavior, 'auto', 'Restored history does not force a decorative smooth scroll');
    equal(f.main.hasAttribute('aria-busy'), false, 'Cross-route legal Back finishes its loading state');
    f.dom.window.close();
}

for (const [hash, expectedTarget] of [['#%73ervices', '#services'], ['#missing-section', null], ['#%ZZ', null], ['#user-info', null]]) {
    const f = await fixture('/conditions');
    equal(await f.navigate('/confidentialite', {url: 'https://nameless-sao.fr/confidentialite' + hash}), true, 'A full legal route navigation handles ' + hash);
    if (expectedTarget) {
        equal(f.fragmentScrolls.length, 1, 'A valid encoded legal fragment uses its restored reading section');
        equal(f.fragmentScrolls[0].node, f.main.querySelector(expectedTarget), 'Decoded legal fragments resolve within the new main');
        equal(f.scrolls.length, 0, 'A valid reading section avoids the ordinary page-start scroll');
    } else {
        equal(f.fragmentScrolls.length, 0, 'Unknown, malformed and outside-main fragments cannot choose a reading target');
        equal(f.scrolls.length, 1, 'An unusable fragment falls back to the ordinary page start');
        equal(f.scrolls[0].top, 0, 'The unusable-fragment fallback has a defined starting position');
    }
    equal(f.window.document.activeElement, f.main, 'Complete legal navigation still focuses the new content for ' + hash);
    equal(f.main.hasAttribute('aria-busy'), false, 'Fragment restoration finishes loading for ' + hash);
    f.dom.window.close();
}

{
    const f = await fixture('/conditions');
    equal(await f.navigate('/items', {url: 'https://nameless-sao.fr/items#main-content'}), true, 'An ordinary route remains navigable with a fragment');
    equal(f.fragmentScrolls.length, 0, 'A non-opted-in route retains its page module scroll ownership');
    equal(f.scrolls.length, 1, 'An ordinary route still follows the existing page-start policy');
    f.dom.window.close();
}

// Content-driven query history must keep reinitializing its actual route modules.
for (const [path, previous, next] of [
    ['/items', '?item=first', '?item=second'],
    ['/carte', '?floor=1', '?floor=2'],
    ['/bestiaire', '?creature=1', '?creature=2']
]) {
    const f = await fixture(path + previous);
    const id = f.registry.get(path).id;
    const original = f.main.firstElementChild;
    f.window.history.pushState({}, '', path + next);
    await traverse(f, 'back', {hashchange: false});
    equal(f.window.location.search, previous, id + ' Back restores the actual query');
    equal(f.requests.length, 1, id + ' query Back still fetches the route');
    ok(f.main.firstElementChild !== original, id + ' query Back replaces route content');
    equal(f.trace.join(','), 'init:' + id + ',change:' + id + ',destroy:' + id + ',init:' + id + ',change:' + id, id + ' query Back repeats the required module lifecycle');
    equal(f.window.document.activeElement, f.main, id + ' query Back retains route focus behavior');
    equal(f.scrolls.length, 1, id + ' query Back retains its scroll policy');
    equal(f.main.hasAttribute('aria-busy'), false, id + ' query Back clears its loading state');
    await traverse(f, 'forward', {hashchange: false});
    equal(f.window.location.search, next, id + ' Forward restores the next query');
    equal(f.requests.length, 2, id + ' query Forward still fetches the route');
    equal(f.trace.filter(event => event === 'init:' + id).length, 3, id + ' query Forward initializes the restored module once');
    f.dom.window.close();
}

// Even an opted-in legal route cannot treat a changed query as a fragment-only
// traversal. First adopt one query through the normal same-route API, then Back.
{
    const f = await fixture('/confidentialite?view=first');
    equal(await f.navigate('/confidentialite', {url: 'https://nameless-sao.fr/confidentialite?view=second'}), true, 'A same-route query can be adopted without fetching');
    equal(f.requests.length, 0, 'The normal same-route API remains lightweight');
    await traverse(f, 'back', {hashchange: false});
    equal(f.window.location.search, '?view=first', 'Legal query Back restores the previous query');
    equal(f.requests.length, 1, 'A changed legal query does not take the fragment-only shortcut');
    equal(f.trace.filter(event => event === 'init:confidentialite').length, 2, 'Changed legal query history repeats the route lifecycle');
    equal(f.scrolls.length, 1, 'Changed legal query history retains the full navigation scroll');
    const anchor = f.main.querySelector('a[href="#services"]');
    anchor.focus();
    const before = snapshot(f, '#services');
    await clickFragment(f, anchor);
    unchanged(f, before, '#services', 'Native fragments work after a legal query traversal');
    f.dom.window.close();
}

// A restored SPA node can exist before the browser resolves its :target.
// Its fixed-header clearance must already apply when scrollIntoView runs.
for (const page of ['confidentialite', 'conditions']) {
    const dom = new JSDOM(read('pages/' + page + '.html'), {url: 'https://nameless-sao.fr/' + page});
    const {document} = dom.window;
    const style = document.createElement('style');
    style.textContent = read('css/components/information.css');
    document.head.appendChild(style);
    const sections = document.querySelectorAll('.information-page section[id]');
    ok(sections.length > 0, page + ' has actual reading destinations');
    for (const section of sections) {
        equal(section.matches(':target'), false, 'The restored ' + section.id + ' node need not match :target');
        const margin = dom.window.getComputedStyle(section).scrollMarginTop;
        ok(margin && margin !== '0px' && margin !== '0', 'Fixed-header clearance applies before targeting ' + section.id);
    }
    dom.window.close();
}

console.log('Native fragment tests passed: ' + assertions + ' checks of real legal anchors, registry aliases, native Back/Forward, pending fetch/transition cancellation, cross-route lifecycle, anchor clearance and unchanged catalogue/map query history.');
