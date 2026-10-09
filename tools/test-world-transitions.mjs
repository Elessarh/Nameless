import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {JSDOM} = require('jsdom');
const router = fs.readFileSync(new URL('../js/app-router.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}

async function fixture({native = true, reduced = false, hidden = false, delayed = false, rejectReady = false, assets = false} = {}) {
    const dom = new JSDOM('<!doctype html><html><head><title>Home</title></head><body><header><a class="nav-link" href="/wiki">Wiki</a></header><main id="main-content"><h1>Home</h1></main><audio id="persistent-audio"></audio></body></html>', {
        url: 'https://nameless-sao.fr/', runScripts: 'outside-only'
    });
    const {window} = dom;
    await new Promise(resolve => window.document.addEventListener('DOMContentLoaded', resolve, {once: true}));
    const trace = [], transitions = [], pushes = [], scrolls = [];
    const main = window.document.querySelector('main');
    const header = window.document.querySelector('header');
    const audio = window.document.querySelector('audio');
    const routes = new Map(['home', 'wiki', 'items'].map(id => [id === 'home' ? '/' : '/' + id, {
        id, path: id === 'home' ? '/' : '/' + id,
        source: id === 'home' ? 'index.html' : 'pages/' + id + '.html',
        css: assets && id === 'wiki' ? ['css/wiki-test.css'] : [],
        scripts: assets && id === 'wiki' ? ['js/wiki-test.js'] : [],
        init: () => trace.push('init:' + id), destroy: () => trace.push('destroy:' + id)
    }]));
    window.NamelessPageRegistry = {normalize: path => path, get: path => routes.get(path)};
    window.NamelessWorldAtmosphere = {sync: id => trace.push('atmosphere:' + id)};
    window.matchMedia = () => ({matches: reduced});
    Object.defineProperty(window.document, 'hidden', {value: hidden, configurable: true});
    window.scrollTo = options => scrolls.push(options);
    const pushState = window.history.pushState.bind(window.history);
    window.history.pushState = (state, title, url) => { pushes.push(url); pushState(state, title, url); };
    window.document.addEventListener('nameless:routechange', event => trace.push('change:' + event.detail.route));
    window.fetch = async url => {
        const id = url.includes('wiki') ? 'wiki' : url.includes('items') ? 'items' : 'home';
        trace.push('fetch:' + id);
        return {ok: true, text: async () => '<html><head><title>' + id + '</title></head><body class="page-' + id + '"><main id="main-content" class="content-' + id + '"><h1>' + id + '</h1></main></body></html>'};
    };
    if (native) {
        window.document.startViewTransition = callback => {
            trace.push('transition');
            const ready = deferred(), finished = deferred(), update = deferred();
            const transition = {
                ready: ready.promise, finished: finished.promise, updateCallbackDone: update.promise,
                skipped: 0,
                skipTransition() {
                    this.skipped++;
                    ready.reject(new Error('Animation skipped'));
                    finished.reject(new Error('Animation skipped'));
                },
                async run() {
                    try { callback(); update.resolve(); } catch (error) { update.reject(error); }
                    if (rejectReady) ready.reject(new Error('Snapshot unavailable'));
                    else ready.resolve();
                },
                finish: () => finished.resolve(),
                failBeforeCallback: () => update.reject(new Error('Enhancement unavailable'))
            };
            transitions.push(transition);
            if (!delayed) window.queueMicrotask(() => transition.run());
            return transition;
        };
    }
    window.eval(router);
    assert.deepEqual(trace, ['atmosphere:home', 'init:home', 'change:home'], 'Initial atmosphere is synchronized before route initialization');
    return {dom, window, trace, transitions, pushes, scrolls, main, header, audio, navigate: window.NamelessSpaRouter.navigate};
}

// Native navigation resolves after the update, while the animation can keep running.
{
    const f = await fixture();
    const result = f.navigate('/wiki', {url: 'https://nameless-sao.fr/wiki?topic=map'});
    assert.equal(f.main.getAttribute('aria-busy'), 'true');
    assert.equal(await result, true);
    assert.equal(f.transitions.length, 1);
    assert.equal(f.window.location.search, '?topic=map');
    assert.equal(f.pushes.length, 1);
    assert.equal(f.window.document.activeElement, f.main, 'Keyboard focus moves to the persistent main after its update');
    assert.equal(f.main.hasAttribute('aria-busy'), false);
    assert.equal(f.window.document.querySelector('main'), f.main);
    assert.equal(f.window.document.querySelector('header'), f.header);
    assert.equal(f.window.document.querySelector('audio'), f.audio);
    assert.equal(f.scrolls.length, 1);
    assert.deepEqual(f.trace.slice(-4), ['destroy:home', 'atmosphere:wiki', 'init:wiki', 'change:wiki']);
    // The unfinished native animation is superseded even by a same-route query change.
    assert.equal(await f.navigate('/wiki', {url: 'https://nameless-sao.fr/wiki?topic=latest'}), true);
    assert.equal(f.transitions[0].skipped, 1);
    assert.equal(f.transitions.length, 1, 'Same-route changes retain their existing lifecycle behavior');
    assert.equal(f.trace.filter(value => value === 'init:wiki').length, 1);
    assert.equal(f.window.location.search, '?topic=latest');
    f.dom.window.close();
}

for (const options of [{native: false}, {reduced: true}, {hidden: true}]) {
    const f = await fixture(options);
    assert.equal(await f.navigate('/wiki', {push: false, scroll: false}), true);
    assert.equal(f.transitions.length, 0, 'Unsupported, reduced-motion and hidden documents commit directly');
    assert.equal(f.main.textContent, 'wiki');
    assert.equal(f.pushes.length, 0);
    assert.equal(f.scrolls.length, 0);
    assert.equal(f.main.hasAttribute('aria-busy'), false);
    f.dom.window.close();
}

// Styles and scripts must be ready before the native snapshot/update is started.
{
    const f = await fixture({assets: true});
    const navigation = f.navigate('/wiki');
    await tick();
    assert.equal(f.transitions.length, 0);
    const stylesheet = f.window.document.querySelector('link[data-spa-css="wiki"]');
    assert.ok(stylesheet);
    stylesheet.dispatchEvent(new f.window.Event('load'));
    await tick();
    assert.equal(f.transitions.length, 0);
    const script = f.window.document.querySelector('script[data-spa-script="wiki"]');
    assert.ok(script);
    script.dispatchEvent(new f.window.Event('load'));
    assert.equal(await navigation, true);
    assert.equal(f.transitions.length, 1);
    f.transitions[0].finish();
    f.dom.window.close();
}

// A newer destination owns the DOM and history even if skip leaves the old callback queued.
{
    const f = await fixture({delayed: true});
    const oldNavigation = f.navigate('/wiki');
    await tick();
    const newNavigation = f.navigate('/items');
    assert.equal(f.transitions[0].skipped, 1);
    await tick();
    await f.transitions[1].run();
    assert.equal(await newNavigation, true);
    await f.transitions[0].run();
    assert.equal(await oldNavigation, true, 'Stale navigation is handled without forcing a browser reload');
    assert.equal(f.main.textContent, 'items');
    assert.equal(f.window.location.pathname, '/items');
    assert.equal(f.pushes.length, 1);
    assert.equal(f.trace.includes('init:wiki'), false);
    assert.equal(f.trace.filter(value => value === 'destroy:home').length, 1);
    assert.equal(f.main.hasAttribute('aria-busy'), false);
    f.transitions[1].finish();
    f.dom.window.close();
}

// Returning to the currently displayed page also invalidates a deferred update callback.
{
    const f = await fixture({delayed: true});
    const oldNavigation = f.navigate('/wiki');
    await tick();
    assert.equal(await f.navigate('/', {url: 'https://nameless-sao.fr/?mode=latest'}), true);
    assert.equal(f.transitions[0].skipped, 1);
    assert.equal(f.main.hasAttribute('aria-busy'), false);
    await f.transitions[0].run();
    assert.equal(await oldNavigation, true);
    assert.equal(f.main.textContent, 'Home');
    assert.equal(f.window.location.search, '?mode=latest');
    assert.equal(f.trace.includes('init:wiki'), false);
    assert.equal(f.pushes.length, 1);
    f.dom.window.close();
}

// Snapshot failure does not repeat the successfully applied update or wait for animation.
{
    const f = await fixture({rejectReady: true});
    assert.equal(await f.navigate('/wiki'), true);
    await tick();
    assert.equal(f.pushes.length, 1);
    assert.equal(f.trace.filter(value => value === 'init:wiki').length, 1);
    assert.equal(f.trace.filter(value => value === 'change:wiki').length, 1);
    assert.equal(f.main.hasAttribute('aria-busy'), false);
    f.transitions[0].finish();
    f.dom.window.close();
}

// Fallback commit remains idempotent if an enhancement failure leaves its callback queued.
{
    const f = await fixture({delayed: true});
    const navigation = f.navigate('/wiki');
    await tick();
    f.transitions[0].failBeforeCallback();
    assert.equal(await navigation, true);
    await f.transitions[0].run();
    assert.equal(f.pushes.length, 1);
    assert.equal(f.trace.filter(value => value === 'init:wiki').length, 1);
    assert.equal(f.main.hasAttribute('aria-busy'), false);
    f.transitions[0].finish();
    f.dom.window.close();
}

// Exceptions after an update begins do not re-run initialization or create a second history entry.
{
    const f = await fixture();
    f.window.NamelessPageRegistry.get('/wiki').init = () => {
        f.trace.push('init:wiki');
        throw new Error('Route runtime unavailable');
    };
    assert.equal(await f.navigate('/wiki'), false);
    assert.equal(f.pushes.length, 1);
    assert.equal(f.trace.filter(value => value === 'init:wiki').length, 1);
    assert.equal(f.main.hasAttribute('aria-busy'), false);
    f.transitions[0].finish();
    f.dom.window.close();
}

for (const callbackStarted of [false, true]) {
    const f = await fixture();
    f.window.document.startViewTransition = callback => {
        if (callbackStarted) callback();
        throw new Error('Native enhancement unavailable');
    };
    assert.equal(await f.navigate('/wiki'), true);
    assert.equal(f.pushes.length, 1, 'A synchronous native failure must not duplicate history');
    assert.equal(f.trace.filter(value => value === 'init:wiki').length, 1);
    assert.equal(f.main.hasAttribute('aria-busy'), false);
    f.dom.window.close();
}

{
    const f = await fixture();
    f.window.fetch = async () => ({ok: true, text: async () => '<html><body>No route content</body></html>'});
    assert.equal(await f.navigate('/wiki'), false);
    assert.equal(f.pushes.length, 0, 'An invalid fetched document cannot change the route history');
    assert.equal(f.main.textContent, 'Home');
    assert.equal(f.main.hasAttribute('aria-busy'), false);
    f.transitions[0].finish();
    f.dom.window.close();
}

console.log('World transition tests passed: native updates, direct fallbacks, assets ready, stale callbacks, same-route return, animation rejection, single commit, shell/focus/history/aria-busy.');
