import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const script = fs.readFileSync(new URL('../js/world-atmosphere.js', import.meta.url), 'utf8');
let checks = 0;
const check = (value, message) => { checks++; assert.ok(value, message); };
const equal = (actual, expected, message) => { checks++; assert.equal(actual, expected, message); };
const home = '<p class="home-signature">Nameless</p><h1 class="home-title">Explorez</h1><p class="home-description">Aincrad</p><div class="home-actions"><button>Rechercher</button></div><ul class="home-access"><li><a class="home-entry" href="/carte"><span>Carte</span></a></li></ul><ul class="home-selection"><li><a class="home-record" href="/items">Gelée</a></li></ul><aside class="home-guild-card">Guilde</aside>';
const card = (id = 'one') => `<button class="item-card" data-id="${id}">${id}</button>`;

function fixture({page = 'home', html = home, reduced = false, hidden = false, width = 1280, intersection = true, animation = true, media = true, translate = true, legacyMedia = false} = {}) {
    const dom = new JSDOM(`<html><body><main id="main-content">${html}</main></body></html>`, {url: `https://nameless-sao.fr/${page === 'home' ? '' : page + '/'}`, runScripts: 'outside-only', pretendToBeVisual: true});
    const w = dom.window;
    const observers = [];
    const animations = [];
    const mediaListeners = new Set();
    const frames = new Map();
    let nextFrame = 1;
    Object.defineProperty(w.document, 'hidden', {value: hidden, configurable: true});
    Object.defineProperty(w, 'innerWidth', {value: width, configurable: true});
    w.CSS = {supports: () => translate};
    const query = {matches: reduced};
    if (legacyMedia) {
        query.addListener = listener => mediaListeners.add(listener);
        query.removeListener = listener => mediaListeners.delete(listener);
    } else {
        query.addEventListener = (_, listener) => mediaListeners.add(listener);
        query.removeEventListener = (_, listener) => mediaListeners.delete(listener);
    }
    if (media) w.matchMedia = () => query;
    w.requestAnimationFrame = callback => { const id = nextFrame++; frames.set(id, callback); return id; };
    w.cancelAnimationFrame = id => frames.delete(id);
    if (intersection) {
        w.IntersectionObserver = class {
            constructor(callback, options) { this.callback = callback; this.options = options; this.targets = new Set(); this.disconnected = false; observers.push(this); }
            observe(target) { this.targets.add(target); }
            unobserve(target) { this.targets.delete(target); }
            disconnect() { this.disconnected = true; this.targets.clear(); }
            enter(targets = [...this.targets]) { this.callback(targets.map(target => ({target, isIntersecting: true, intersectionRatio: 1}))); }
        };
    }
    if (animation) {
        w.Element.prototype.animate = function (keyframes, options) {
            const entry = {target: this, keyframes, options, cancelled: false, onfinish: null, oncancel: null,
                cancel() { this.cancelled = true; this.oncancel?.(); }, finish() { this.onfinish?.(); }};
            animations.push(entry);
            return entry;
        };
    }
    w.eval(script);
    return {w, dom, observers, animations, frames,
        main: w.document.getElementById('main-content'),
        visible(value) { Object.defineProperty(w.document, 'hidden', {value: !value, configurable: true}); w.document.dispatchEvent(new w.Event('visibilitychange')); },
        reduce(value) { query.matches = value; mediaListeners.forEach(listener => listener({matches: value})); },
        async flush() { await Promise.resolve(); [...frames.values()].forEach(callback => callback()); frames.clear(); await Promise.resolve(); },
        close() { w.NamelessWorldAtmosphere.sync('carte'); dom.window.close(); }
    };
}

{
    const f = fixture();
    equal(f.observers.length, 1, 'Direct boot does not immediately destroy its first reveal observer');
    equal(f.observers[0].targets.size, 7, 'Home reveals individual text/choice units without nested double animation');
    equal(f.animations.length, 0, 'Offscreen content is never pre-hidden or animated');
    check([...f.main.querySelectorAll('*')].every(node => !node.hasAttribute('style') && !node.hasAttribute('hidden')), 'No inline hidden state is written while waiting for intersection');
    f.observers[0].enter();
    equal(f.animations.length, 7, 'Each eligible unit animates once on entry');
    check(f.animations.every(entry => entry.keyframes[0].opacity >= 0.5), 'Reading remains possible even during the entrance');
    check(f.animations.every(entry => !('transform' in entry.keyframes[0])), 'Entrance never overrides the hover transform');
    check(f.animations.every(entry => entry.keyframes[0].translate === '0 7px' && entry.options.fill === 'backwards'), 'Small independent translation applies during stagger without retaining its last frame');
    equal(Math.max(...f.animations.map(entry => entry.options.delay)), 140, 'Stagger is capped even for a large intersecting group');
    f.observers[0].enter([f.main.querySelector('.home-title')]);
    equal(f.animations.length, 7, 'Duplicate observer entries do not replay content');
    f.animations[0].finish();
    f.w.NamelessWorldAtmosphere.sync('home');
    check(f.observers[0].disconnected, 'SPA sync disconnects the old intersection observer');
    equal(f.observers[1].targets.size, 0, 'A same-DOM sync does not replay all existing content');
    check(!f.animations[0].cancelled && f.animations.slice(1).every(entry => entry.cancelled), 'Completed effects are released and running effects cancel cleanly');
    check(f.main.querySelector('.home-title').textContent === 'Explorez', 'Enhancement does not mutate actual content');
    f.close();
}

{
    const f = fixture();
    const link = f.main.querySelector('.home-entry');
    link.focus();
    check(!f.observers[0].targets.has(link), 'Keyboard focus removes a pending entrance immediately');
    f.observers[0].enter();
    const actions = f.main.querySelector('.home-actions');
    const active = f.animations.find(entry => entry.target === actions);
    actions.querySelector('button').focus();
    check(active.cancelled, 'Focusing a descendant immediately clears the running parent entrance');
    equal(f.w.document.activeElement, actions.querySelector('button'), 'Motion handling preserves actual keyboard focus');
    const record = f.main.querySelector('.home-record');
    const recordAnimation = f.animations.find(entry => entry.target === record);
    record.dispatchEvent(new f.w.Event('pointerdown', {bubbles: true}));
    check(recordAnimation.cancelled, 'Pointer activation is immediate while an entrance is running');
    f.close();
}

for (const reason of ['intersection', 'animation', 'media']) {
    const f = fixture({[reason]: false});
    equal(f.observers.length, 0, `Missing ${reason} support keeps the page static`);
    equal(f.animations.length, 0, `Missing ${reason} support does not create partial effects`);
    check(!f.main.querySelector('[style],[hidden]'), `Missing ${reason} support keeps all content visible`);
    f.close();
}

for (const state of ['reduced', 'hidden']) {
    const f = fixture({[state]: true});
    equal(f.observers.length, 0, `Initial ${state} state has no active observer`);
    if (state === 'reduced') f.reduce(false); else f.visible(true);
    equal(f.observers.length, 1, `Leaving initial ${state} state can enhance new visible content`);
    f.observers[0].enter();
    check(f.animations.length > 0, `Eligible visible content animates after ${state} is lifted`);
    if (state === 'reduced') f.reduce(true); else f.visible(false);
    check(f.animations.every(entry => entry.cancelled), `Entering ${state} immediately clears all active effects`);
    check(f.observers[0].disconnected, `Entering ${state} disconnects pending observation`);
    if (state === 'reduced') f.reduce(false); else f.visible(true);
    equal(f.observers[1].targets.size, 0, `Returning from ${state} never replays already displayed content`);
    f.close();
}

{
    const f = fixture({page: 'items', html: '<section id="items-grid"></section>'});
    equal(f.observers[0].targets.size, 0, 'Direct catalogue boot can precede its data render');
    const grid = f.main.querySelector('#items-grid');
    grid.innerHTML = Array.from({length: 48}, (_, index) => card(String(index))).join('');
    await f.flush();
    equal(f.observers[0].targets.size, 48, 'Result replacement observes all 48 default catalogue cards');
    f.observers[0].enter();
    equal(f.animations.length, 48, 'Visible catalogue cards share the same bounded entrance');
    equal(Math.max(...f.animations.map(entry => entry.options.delay)), 140, 'A 48-result render never accumulates multi-second stagger');
    const previous = [...grid.children];
    grid.innerHTML = card('new');
    await f.flush();
    check(f.animations.every(entry => entry.cancelled), 'Replacing a filter/page result cancels removed card animations');
    equal(f.observers[0].targets.size, 1, 'Only the new result remains observed');
    f.observers[0].enter(previous);
    equal(f.animations.length, 48, 'Late entries for detached cards cannot restart an animation');
    f.observers[0].enter();
    equal(f.animations.length, 49, 'A replacement result receives its own entrance');
    grid.firstElementChild.setAttribute('data-hovered', 'true');
    grid.firstElementChild.appendChild(f.w.document.createElement('span'));
    await f.flush();
    equal(f.frames.size, 0, 'Tooltip/metadata changes inside a card do not schedule scans');
    grid.innerHTML = card('queued-before-route');
    await Promise.resolve();
    equal(f.frames.size, 1, 'Result replacements coalesce into one pending frame');
    f.w.NamelessWorldAtmosphere.sync('carte');
    equal(f.frames.size, 0, 'SPA cleanup cancels a queued result scan before it runs');
    grid.innerHTML = card('after-route');
    await f.flush();
    check(f.observers[0].disconnected && f.frames.size === 0, 'Leaving the catalogue cleans up result mutation observation');
    f.close();
}

{
    const f = fixture({page: 'bestiaire', html: '<section id="creatures-grid"><button class="creature-card">Loup</button></section>'});
    equal(f.observers[0].targets.size, 1, 'Bestiary shares the independent result lifecycle');
    f.observers[0].enter();
    const old = f.observers[0];
    f.main.innerHTML = home;
    f.w.NamelessWorldAtmosphere.sync('home');
    const lateCount = f.animations.length;
    old.enter([f.main.querySelector('.home-title')]);
    equal(f.animations.length, lateCount, 'A queued callback from an old SPA route cannot animate the new route');
    equal(f.observers[1].targets.size, 7, 'New SPA content receives a fresh set of eligible targets');
    check(f.animations[0].cancelled, 'SPA route replacement cancels its previous animation');
    f.close();
}

{
    const f = fixture({page: 'items', html: `<section id="items-grid">${Array.from({length: 200}, (_, index) => card(String(index))).join('')}</section>`});
    equal(f.observers[0].targets.size, 64, 'Unexpected oversized result insertion cannot create unbounded observer work');
    check(!f.main.querySelector('[style],[hidden]'), 'Overflowing the enhancement budget leaves the other results visible');
    f.close();
}

{
    const f = fixture({page: 'wiki', html: '<section class="wiki-page active"><div class="wiki-codex-intro"><span class="wiki-kicker">Guides</span><h1>Codex</h1><p>Lire</p><form><input><button>Search</button></form></div><a class="wiki-portal" href="/carte">Carte</a><a class="wiki-category" href="#guide">Guide</a></section>'});
    equal(f.observers[0].targets.size, 5, 'Codex reveals text and choices rather than its enclosing reading/form panels');
    check(![...f.observers[0].targets].some(node => node.matches('form,input,button,.wiki-codex-intro,.wiki-page')), 'Forms and enclosing parents are excluded');
    f.close();
}

for (const page of ['carte', 'admin-dashboard', 'profil', 'connexion', 'espace-guilde', 'boss']) {
    const f = fixture({page, html: `<section class="leaflet-container"><button class="item-card">Map</button></section>${home}`});
    equal(f.observers.length, 0, `The ${page} page is never given card/reading entrances`);
    f.close();
}

{
    const f = fixture({width: 390, translate: false, legacyMedia: true});
    f.observers[0].enter();
    check(f.animations.every(entry => entry.options.duration === 240 && entry.options.delay <= 70), 'Small screens use a shorter, tightly bounded entrance');
    check(f.animations.every(entry => !('translate' in entry.keyframes[0]) && !('transform' in entry.keyframes[0])), 'Browsers without independent translate receive opacity only');
    f.reduce(true);
    check(f.animations.every(entry => entry.cancelled), 'Legacy media listeners also immediately respect reduced motion changes');
    f.close();
}

{
    const f = fixture();
    f.w.Element.prototype.animate = () => { throw new Error('Effect refused'); };
    f.observers[0].enter();
    equal(f.animations.length, 0, 'An animation API failure remains a static enhancement failure');
    check(!f.main.querySelector('[style],[hidden]'), 'Animation failure cannot leave content hidden');
    f.close();
}

console.log(`World motion passed: ${checks} checks covering progressive visibility, independent hover transforms, 48-card rerenders, focus, SPA races, cleanup, API fallback and motion preferences.`);
