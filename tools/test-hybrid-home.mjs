import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('index.html');
const runtime = read('js/home-carousel.js');
const index = JSON.parse(read('assets/search-index.json')).entries;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const page = () => new JSDOM(html, { url: 'https://nameless-sao.fr/', runScripts: 'outside-only', pretendToBeVisual: true });
const reducedQuery = '(prefers-reduced-motion: reduce)';
const pointerQuery = '(hover: hover) and (pointer: fine)';
function mediaPreferences(w, { reduced = false, fine = true, legacy = false } = {}) {
    const queries = new Map([[reducedQuery, reduced], [pointerQuery, fine]].map(([query, matches]) => {
        const listeners = new Set();
        const media = { matches, listeners };
        if (legacy) {
            media.addListener = fn => listeners.add(fn);
            media.removeListener = fn => listeners.delete(fn);
        } else {
            media.addEventListener = (_type, fn) => listeners.add(fn);
            media.removeEventListener = (_type, fn) => listeners.delete(fn);
        }
        return [query, media];
    }));
    w.matchMedia = query => {
        assert.ok(queries.has(query), 'Each motion capability has a distinct media query: ' + query);
        return queries.get(query);
    };
    return {
        queries,
        change(query, matches) {
            const media = queries.get(query);
            media.matches = matches;
            for (const fn of media.listeners) fn();
        },
        listenerCount: () => [...queries.values()].reduce((sum, media) => sum + media.listeners.size, 0)
    };
}

function motionEnvironment(w, preferences = {}) {
    const media = mediaPreferences(w, preferences);
    const hero = w.document.querySelector('.home-hero');
    const main = w.document.querySelector('main[data-home]');
    const rectangle = { left: 100, top: 80, width: 1000, height: 500, right: 1100, bottom: 580 };
    let measurements = 0;
    hero.getBoundingClientRect = () => { measurements++; return rectangle; };
    let hidden = false;
    Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(w.document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
    let nextFrame = 0;
    const frames = new Map();
    const cancelled = [];
    w.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
    w.cancelAnimationFrame = id => { cancelled.push(id); frames.delete(id); };
    const observers = [];
    w.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; this.target = null; this.disconnected = false; observers.push(this); }
        observe(target) { this.target = target; }
        disconnect() { this.disconnected = true; this.target = null; }
        emit(visible) { if (this.target) this.callback([{ target: this.target, isIntersecting: visible }]); }
    };
    return {
        media, hero, main, frames, cancelled, observers, rectangle,
        measurements: () => measurements,
        pointer(type, x = 600, y = 330, pointerType = 'mouse') {
            const event = new w.MouseEvent(type, { clientX: x, clientY: y });
            Object.defineProperty(event, 'pointerType', { value: pointerType });
            hero.dispatchEvent(event);
        },
        show(visible) { observers.at(-1).emit(visible); },
        visibility(value) { hidden = value; w.document.dispatchEvent(new w.Event('visibilitychange')); },
        flush() {
            for (const [id, callback] of [...frames]) { frames.delete(id); callback(0); }
        },
        depth: () => [parseFloat(main.style.getPropertyValue('--home-depth-x')), parseFloat(main.style.getPropertyValue('--home-depth-y'))]
    };
}
const art = JSON.parse(read('docs/hybrid-mmorpg-2026-10-08/home-art-manifest.json'));
const minecraftArt = JSON.parse(read('docs/sao-minecraft-home-2026-10-08/asset-manifest.json'));
const heroArt = JSON.parse(read('docs/definitive-hybrid-2026-10-09/hero-manifest.json'));
const referenceArt = JSON.parse(read('assets/reference-v2/asset-manifest.json'));
const derivedImages = new Map();
const fileHash = name => createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
for (const source of referenceArt.sources) assert.equal(fileHash(source.path), source.sha256, 'Reference sources remain intact');
for (const output of referenceArt.exports) {
    assert.equal(fileHash(output.path), output.sha256);
    assert.equal(fs.statSync(path.join(root, output.path)).size, output.bytes);
    const source = referenceArt.sources.find(source => source.path.endsWith(output.source || referenceArt.source));
    assert.ok(source);
    const width = output.crop ? output.crop[2] - output.crop[0] : source.width;
    const height = output.crop ? output.crop[3] - output.crop[1] : source.height;
    assert.ok(output.width <= width, 'Reference exports do not upscale');
    assert.ok(Math.abs(output.height - height * output.width / width) <= .5);
    derivedImages.set(output.path, { ...output, dimensions: [output.width, output.height] });
}

for (const record of art.artwork) {
    assert.equal(fileHash(record.source), record.sourceSha256, 'Original artwork stays untouched: ' + record.source);
    assert.ok(!record.source.startsWith('assets/items/'), 'Pixel item PNGs never enter the thumbnail pipeline');
    for (const output of record.outputs) {
        assert.equal(fileHash(output.path), output.sha256, 'Derived artwork matches its inspected manifest');
        assert.equal(fs.statSync(path.join(root, output.path)).size, output.bytes);
        assert.equal(output.decodedAlphaSha256, output.resizedAlphaSha256, 'Encoding retains the resized silhouette alpha');
        const [width, height] = output.dimensions;
        assert.ok(width <= record.sourceDimensions[0], 'Thumbnails never enlarge a source');
        const displayDimensions = record.displaySourceDimensions || record.sourceDimensions;
        assert.ok(Math.abs(height - displayDimensions[1] * width / displayDimensions[0]) <= .5, 'Thumbnails keep the aspect ratio of the recorded source framing');
        derivedImages.set(output.path, output);
    }
}
assert.ok(art.largestVariantBytesTotal < art.sourceBytesTotal * .3, 'Home thumbnails reduce the source transfer by at least 70%');
for (const record of minecraftArt.artwork) {
    assert.equal(fileHash(record.source.path), record.source.sha256, 'Minecraft source stays untouched: ' + record.source.path);
    for (const output of record.outputs) {
        assert.equal(fileHash(output.path), output.sha256);
        assert.equal(fs.statSync(path.join(root, output.path)).size, output.bytes);
        const [width, height] = output.dimensions;
        const [framedWidth, framedHeight] = output.croppedSourceDimensions;
        assert.ok(width <= framedWidth, 'No artificial resolution is invented');
        assert.ok(Math.abs(height - framedHeight * width / framedWidth) <= .5, 'Recorded crops retain their proportions');
        if (output.hasAlpha) assert.equal(output.decodedAlphaSha256, output.resizedAlphaSha256, 'Map alpha is preserved');
        derivedImages.set(output.path, output);
    }
}

assert.equal(fileHash(heroArt.source), heroArt.sourceSha256, 'The inspected Minecraft hero source is preserved');
const wolf = heroArt.creatureThumbnail;
assert.equal(fileHash(wolf.source), wolf.sourceSha256, 'The White Wolf catalogue model stays untouched');
assert.equal(fileHash(wolf.path), wolf.sha256);
assert.equal(wolf.decodedAlphaSha256, wolf.resizedAlphaSha256, 'The resized wolf contour alpha stays exact');
derivedImages.set(wolf.path, wolf);
for (const output of heroArt.outputs) {
    assert.equal(fileHash(output.path), output.sha256);
    const framedWidth = output.crop ? output.crop[2] - output.crop[0] : heroArt.sourceDimensions[0];
    const framedHeight = output.crop ? output.crop[3] - output.crop[1] : heroArt.sourceDimensions[1];
    assert.ok(output.dimensions[0] <= framedWidth, 'Hero variants never upscale the source');
    assert.ok(Math.abs(output.dimensions[1] - framedHeight * output.dimensions[0] / framedWidth) <= .5);
    derivedImages.set(output.path, output);
}

{
    const dom = page();
    const doc = dom.window.document;
    const main = doc.querySelector('main[data-home]');
    assert.equal(doc.querySelectorAll('main').length, 1);
    assert.equal(main.querySelector('h1').textContent, 'Explorez Aincrad, ensemble');
    assert.deepEqual([...main.querySelectorAll('.home-entry')].map(link => new URL(link.href).pathname), ['/carte', '/bestiaire', '/items', '/espace-guilde']);
    assert.equal(main.querySelector('[data-carousel], [inert], [aria-hidden="true"] a'), null, 'Every destination stays visible and focusable');
    assert.equal(main.querySelector('a[href="/quetes"]'), null, 'Home must not promote obsolete main quests');
    assert.doesNotMatch(main.textContent, /\b(?:HP|PV)\b|Points de vie|600|Dernières découvertes/, 'Home shows no unverified combat stats or fabricated recent activity');
    assert.equal(main.querySelector('.home-actions a').getAttribute('href'), '/carte');
    assert.equal(main.querySelector('[data-home-search]').type, 'button');
    for (const link of main.querySelectorAll('[data-home-record]')) {
        const [kind, id] = link.dataset.homeRecord.split(':');
        const entry = index.find(item => item.kind === kind && item.id === id);
        assert.ok(entry, 'Featured record exists in the actual catalogue: ' + link.dataset.homeRecord);
        assert.equal(link.getAttribute('href'), entry.url);
        assert.equal(link.querySelector('h3').textContent, entry.title);
        if (kind === 'boss' || kind === 'creature') assert.ok(link.textContent.includes(entry.location), 'Creature location is sourced from its actual entry');
    }
    assert.equal(main.querySelector('img[src*="/assets/illustrations/"]'), null, 'Rejected fantasy paintings never return to the homepage');
    const creature = main.querySelector('[data-home-creature-source] img');
    assert.equal(creature.getAttribute('src'), '/assets/home/illfang-256.webp', 'Bestiary highlights the preserved real game render');
    for (const tile of main.querySelectorAll('[data-home-item-source]')) {
        const entry = index.find(item => item.kind === 'item' && item.id === tile.dataset.homeItemSource);
        assert.ok(entry, 'Inventory preview uses a real catalogue item');
        assert.equal(tile.querySelector('img').getAttribute('src'), entry.image);
    }
    const hero = main.querySelector('.home-hero-scene img');
    assert.equal(hero.getAttribute('src'), '/assets/reference-v2/home-environment-1672.webp');
    assert.equal(hero.getAttribute('fetchpriority'), 'high');
    assert.equal(main.querySelector('.home-scene-caption').textContent, 'Illustration d’ambiance', 'The hero interpretation is not presented as an official server location');
    assert.equal(hero.getAttribute('loading'), null, 'The hero must load immediately');
    assert.ok(doc.head.querySelector('link[rel="preload"][href="/assets/reference-v2/home-environment-mobile.webp"]'));
    for (const image of main.querySelectorAll('img')) {
        const relative = decodeURIComponent(new URL(image.src).pathname).slice(1);
        const filename = path.join(root, relative);
        assert.ok(fs.existsSync(filename), 'Local artwork exists: ' + relative);
        assert.ok(Number(image.getAttribute('width')) > 0 && Number(image.getAttribute('height')) > 0, 'Artwork reserves its dimensions');
        if (image.closest('.home-access, .home-selection')) assert.equal(image.loading || image.getAttribute('loading'), 'lazy');
        const derived = derivedImages.get(relative);
        if (derived) {
            assert.deepEqual([Number(image.getAttribute('width')), Number(image.getAttribute('height'))], derived.dimensions);
        }
        if (image.classList.contains('home-entry-art')) {
            assert.ok(derived, 'Every navigation illustration uses a small derived file');
            assert.ok(image.closest('picture'));
            assert.match(image.getAttribute('sizes'), /max-width: 480px/);
            const candidates = image.getAttribute('srcset').split(',').map(candidate => candidate.trim().split(/\s+/));
            assert.deepEqual(candidates.map(([, width]) => width), relative.startsWith('assets/reference-v2/') ? ['320w', '640w'] : ['256w', '512w']);
            for (const [candidate] of candidates) assert.ok(derivedImages.has(decodeURIComponent(new URL(candidate, doc.URL).pathname).slice(1)));
        }
        if (relative.endsWith('.png')) {
            const png = fs.readFileSync(filename);
            assert.equal(Number(image.getAttribute('width')), png.readUInt32BE(16));
            assert.equal(Number(image.getAttribute('height')), png.readUInt32BE(20));
        }
    }
    dom.window.close();
}

{
    const dom = page();
    const w = dom.window;
    const media = mediaPreferences(w);
    w.eval(runtime);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const main = w.document.querySelector('main');
    const button = main.querySelector('[data-home-motion]');
    assert.equal(media.listenerCount(), 2);
    for (const preference of media.queries.values()) assert.equal(preference.listeners.size, 1);
    button.click();
    assert.equal(main.dataset.motionPaused, 'true', 'The scenery can be paused with a native button');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    w.NamelessHomePage.init(main);
    assert.equal(media.listenerCount(), 2, 'SPA init cannot accumulate either media preference listener');
    assert.equal(main.dataset.motionPaused, 'true', 'The chosen pause survives route initialization');
    media.change(reducedQuery, true);
    assert.equal(button.disabled, true, 'Reduced motion disables the animated scenery');
    assert.match(button.getAttribute('aria-label'), /mouvements réduits/);
    media.change(reducedQuery, false);
    button.click();
    assert.equal(main.dataset.motionPaused, 'false');
    w.NamelessI18n = { getLanguage: () => 'en' };
    w.document.dispatchEvent(new w.Event('nameless:languagechange'));
    assert.equal(button.getAttribute('aria-label'), 'Pause scenery');
    w.NamelessHomePage.destroy();
    assert.equal(media.listenerCount(), 0, 'Leaving home removes both preference listeners');
    button.click();
    assert.equal(main.dataset.motionPaused, 'false', 'Destroyed home no longer handles scenery controls');
    dom.window.close();
}

{
    const dom = page();
    const w = dom.window;
    const media = mediaPreferences(w);
    const storageKey = 'nameless-world-motion-paused';
    w.sessionStorage.setItem(storageKey, 'true');
    w.eval(runtime);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const main = w.document.querySelector('main[data-home]');
    const button = main.querySelector('[data-home-motion]');
    assert.equal(main.dataset.motionPaused, 'true', 'A new document restores the session’s chosen pause');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    button.click();
    assert.equal(main.dataset.motionPaused, 'false');
    assert.equal(w.sessionStorage.getItem(storageKey), 'false', 'Resuming saves the user’s choice for the next document');
    media.change(reducedQuery, true);
    assert.equal(main.dataset.motionPaused, 'true');
    assert.equal(w.sessionStorage.getItem(storageKey), 'false', 'Reduced motion never overwrites the saved user choice');
    media.change(reducedQuery, false);
    assert.equal(main.dataset.motionPaused, 'false', 'The stored choice resumes after reduced motion is removed');
    button.click();
    assert.equal(w.sessionStorage.getItem(storageKey), 'true', 'Pausing saves the user’s explicit choice');
    w.NamelessHomePage.destroy();
    dom.window.close();
}

{
    const dom = page();
    const w = dom.window;
    mediaPreferences(w);
    const errors = [];
    w.addEventListener('error', event => errors.push(event.error));
    Object.defineProperty(w, 'sessionStorage', { configurable: true, get() { throw new w.DOMException('Storage refused', 'SecurityError'); } });
    assert.doesNotThrow(() => w.eval(runtime), 'Unavailable session storage cannot block module loading');
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const main = w.document.querySelector('main[data-home]');
    const button = main.querySelector('[data-home-motion]');
    assert.equal(main.dataset.motionPaused, 'false');
    button.click();
    assert.equal(main.dataset.motionPaused, 'true', 'Pause still works when storage is refused');
    w.NamelessHomePage.init(main);
    assert.equal(main.dataset.motionPaused, 'true', 'The module keeps the SPA choice without storage');
    button.click();
    assert.equal(main.dataset.motionPaused, 'false', 'Resume still works when storage is refused');
    assert.equal(errors.length, 0, 'Storage refusal emits no unhandled event error');
    w.NamelessHomePage.destroy();
    dom.window.close();
}

{
    const dom = page();
    const w = dom.window;
    const motion = motionEnvironment(w);
    let timers = 0;
    w.setInterval = () => { timers++; return 1; };
    w.eval(runtime);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    assert.equal(motion.main.dataset.motionSuspended, 'true', 'Decorative motion waits for confirmed hero visibility');
    motion.show(true);
    assert.equal(motion.main.dataset.motionSuspended, 'false');
    motion.pointer('pointerenter');
    const initialMeasurements = motion.measurements();
    motion.pointer('pointermove', 1100, 580);
    motion.pointer('pointermove', 5100, 2580);
    assert.equal(motion.frames.size, 1, 'Pointer events coalesce into one pending frame');
    assert.equal(motion.measurements(), initialMeasurements, 'Pointer moves do not force layout');
    motion.flush();
    assert.deepEqual(motion.depth(), [10, 5], 'Parallax amplitude is bounded even for outlying coordinates');
    assert.equal(motion.measurements(), initialMeasurements, 'The animation frame does not force layout');
    motion.pointer('pointermove', -4000, -2000);
    motion.flush();
    assert.deepEqual(motion.depth(), [-10, -5]);
    motion.pointer('pointerleave');
    assert.deepEqual(motion.depth(), [0, 0], 'Leaving the hero restores its neutral framing');

    motion.pointer('pointerenter');
    motion.pointer('pointermove', 1100, 580);
    const beforePause = motion.cancelled.length;
    motion.main.querySelector('[data-home-motion]').click();
    assert.equal(motion.cancelled.length, beforePause + 1, 'Choosing pause cancels the pending frame');
    assert.equal(motion.frames.size, 0);
    assert.deepEqual(motion.depth(), [0, 0]);
    motion.pointer('pointermove', 1100, 580);
    assert.equal(motion.frames.size, 0, 'Paused scenery never schedules pointer motion');
    motion.main.querySelector('[data-home-motion]').click();

    motion.media.change(pointerQuery, false);
    motion.pointer('pointermove', 1100, 580);
    assert.equal(motion.frames.size, 0, 'Coarse or non-hover input never schedules parallax');
    assert.equal(motion.main.dataset.motionPaused, 'false', 'Pointer capability does not replace the user’s pause preference');
    motion.media.change(pointerQuery, true);
    motion.media.change(reducedQuery, true);
    motion.pointer('pointermove', 1100, 580);
    assert.equal(motion.frames.size, 0, 'Reduced motion never schedules parallax');
    assert.equal(motion.main.dataset.motionPaused, 'true');
    assert.deepEqual(motion.depth(), [0, 0]);
    motion.media.change(reducedQuery, false);

    motion.pointer('pointermove', 1100, 580);
    motion.visibility(true);
    assert.equal(motion.main.dataset.motionSuspended, 'true', 'A hidden tab suspends all decoration');
    assert.equal(motion.frames.size, 0, 'Hiding the tab cancels queued pointer motion');
    assert.deepEqual(motion.depth(), [0, 0]);
    motion.pointer('pointermove', 1100, 580);
    assert.equal(motion.frames.size, 0, 'A hidden tab never schedules new pointer motion');
    motion.visibility(false);
    assert.equal(motion.main.dataset.motionSuspended, 'false');
    motion.pointer('pointermove', 1100, 580);
    motion.show(false);
    assert.equal(motion.main.dataset.motionSuspended, 'true', 'An offscreen hero suspends all decoration');
    assert.equal(motion.frames.size, 0);
    motion.pointer('pointermove', 1100, 580);
    assert.equal(motion.frames.size, 0, 'An offscreen hero never schedules new pointer motion');
    motion.show(true);
    motion.pointer('pointermove', 1100, 580, 'touch');
    assert.equal(motion.frames.size, 0, 'A touch event cannot use a fine pointer’s parallax');

    const desktopWidth = w.innerWidth;
    w.innerWidth = 768;
    w.dispatchEvent(new w.Event('resize'));
    motion.pointer('pointermove', 1100, 580);
    assert.equal(motion.frames.size, 0, 'A narrow viewport stays fixed even with a fine desktop pointer');
    assert.deepEqual(motion.depth(), [0, 0]);
    w.innerWidth = desktopWidth;
    w.dispatchEvent(new w.Event('resize'));

    motion.pointer('pointermove', 1100, 580);
    w.dispatchEvent(new w.Event('resize'));
    assert.equal(motion.frames.size, 0, 'Resizing discards motion based on stale coordinates');
    assert.equal(motion.measurements(), initialMeasurements + 4, 'Bounds are measured only on entry and resize');
    motion.pointer('pointermove', 1100, 580);
    const oldObserver = motion.observers.at(-1);
    const oldFrame = [...motion.frames.values()][0];
    const beforeReinit = motion.cancelled.length;
    w.NamelessHomePage.init(motion.main);
    assert.equal(motion.cancelled.length, beforeReinit + 1, 'SPA reinitialization cancels the previous frame');
    assert.equal(oldObserver.disconnected, true);
    assert.equal(motion.media.listenerCount(), 2, 'Only the new route’s media listeners survive');
    assert.equal(motion.observers.filter(observer => !observer.disconnected).length, 1);
    assert.deepEqual(motion.depth(), [0, 0]);
    motion.show(true);
    const beforeNewEntry = motion.measurements();
    motion.pointer('pointerenter');
    assert.equal(motion.measurements(), beforeNewEntry + 1, 'SPA reinitialization has a single pointer listener');
    motion.pointer('pointermove', 1100, 580);
    assert.equal(motion.frames.size, 1);
    motion.flush();
    assert.deepEqual(motion.depth(), [10, 5]);
    oldFrame();
    assert.deepEqual(motion.depth(), [10, 5], 'A previous route’s callback cannot reset the active route’s depth');
    motion.pointer('pointermove', 1100, 580);
    const staleCallback = [...motion.frames.values()][0];
    w.NamelessHomePage.destroy();
    assert.equal(motion.frames.size, 0, 'Destroy cancels the final frame');
    assert.equal(motion.observers.at(-1).disconnected, true);
    assert.equal(motion.media.listenerCount(), 0);
    assert.equal(motion.main.dataset.motionSuspended, 'true');
    staleCallback();
    assert.deepEqual(motion.depth(), [0, 0], 'A stale frame cannot change a destroyed home');
    const beforeDestroyedEvents = motion.measurements();
    motion.pointer('pointerenter');
    motion.pointer('pointermove', 1100, 580);
    w.dispatchEvent(new w.Event('resize'));
    motion.visibility(true);
    assert.equal(motion.measurements(), beforeDestroyedEvents);
    assert.equal(motion.frames.size, 0);
    assert.equal(timers, 0, 'Parallax and visibility do not create permanent timers');
    dom.window.close();
}

{
    const dom = page();
    const w = dom.window;
    const media = mediaPreferences(w, { legacy: true });
    w.IntersectionObserver = undefined;
    let frames = 0;
    w.requestAnimationFrame = () => { frames++; return 1; };
    w.eval(runtime);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const main = w.document.querySelector('main[data-home]');
    const hero = main.querySelector('.home-hero');
    assert.equal(main.dataset.motionSuspended, 'true', 'Without visibility observation, the safe fallback is still scenery');
    hero.dispatchEvent(new w.MouseEvent('pointerenter'));
    hero.dispatchEvent(new w.MouseEvent('pointermove', { clientX: 1000, clientY: 500 }));
    assert.equal(frames, 0);
    assert.equal(media.listenerCount(), 2, 'Legacy media listeners are supported separately');
    media.change(reducedQuery, true);
    assert.equal(main.querySelector('[data-home-motion]').disabled, true);
    w.NamelessHomePage.destroy();
    assert.equal(media.listenerCount(), 0, 'Legacy listeners are removed at destroy');
    dom.window.close();
}

{
    const dom = page();
    const w = dom.window;
    let timers = 0;
    let calls = 0;
    w.setInterval = () => { timers++; return 1; };
    w.NamelessGlobalSearch = { open() { calls++; } };
    w.eval(runtime);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const main = w.document.querySelector('main');
    const initialButton = main.querySelector('[data-home-search]');
    w.NamelessHomePage.init(main);
    w.NamelessHomePage.init(main);
    initialButton.click();
    assert.equal(calls, 1, 'Repeated SPA init must not accumulate listeners');
    assert.equal(timers, 0, 'Home has no rotating content or autoplay timer');
    const keyboard = new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    const wheel = new w.WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    main.dispatchEvent(keyboard);
    main.dispatchEvent(wheel);
    assert.equal(keyboard.defaultPrevented, false, 'Normal keyboard page scrolling stays available');
    assert.equal(wheel.defaultPrevented, false, 'Normal wheel scrolling stays available');
    assert.equal(w.document.body.style.overflow, '');
    assert.equal(main.inert, undefined);
    w.NamelessHomePage.destroy();
    initialButton.click();
    assert.equal(calls, 1, 'Destroyed home stops handling actions');
    const replacement = main.cloneNode(true);
    main.replaceWith(replacement);
    w.NamelessHomePage.init(replacement);
    replacement.querySelector('[data-home-search]').click();
    initialButton.click();
    assert.equal(calls, 2, 'A fresh home activates only its own action');
    w.NamelessHomePage.destroy();
    dom.window.close();
}

{
    const dom = page();
    const w = dom.window;
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
    w.fetch = async () => ({ ok: true, json: async () => ({ version: 1, entries: index }) });
    w.eval(runtime);
    w.eval(read('js/global-search.js'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const button = w.document.querySelector('[data-home-search]');
    button.focus();
    button.click();
    await tick();
    const dialog = w.document.getElementById('nameless-global-search');
    assert.equal(dialog.open, true, 'Hero opens the actual shared search dialogue');
    assert.equal(w.document.activeElement.id, 'nm-global-query');
    const input = w.document.getElementById('nm-global-query');
    input.value = 'Illfang';
    input.dispatchEvent(new w.Event('input'));
    assert.ok(dialog.querySelector('a[href="/boss/illfang"]'), 'The real search can reach a featured boss');
    dialog.querySelector('.nm-search-close').click();
    assert.equal(w.document.activeElement, button, 'Closing search returns keyboard focus to the hero action');
    w.NamelessHomePage.destroy();
    dom.window.close();
}

{
    const dom = page();
    const w = dom.window;
    w.eval(runtime);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const button = w.document.querySelector('[data-home-search]');
    const status = w.document.querySelector('[data-home-search-status]');
    button.click();
    assert.match(status.textContent, /recherche se charge/);
    w.NamelessI18n = { getLanguage: () => 'en' };
    button.click();
    assert.match(status.textContent, /Search is loading/);
    let rejectSearch;
    w.NamelessGlobalSearch = { open: () => new Promise((_resolve, reject) => { rejectSearch = reject; }) };
    button.click();
    w.NamelessHomePage.destroy();
    rejectSearch(new Error('late failure'));
    await tick();
    assert.equal(status.textContent, '', 'An old asynchronous failure cannot write into a destroyed home');
    dom.window.close();
}

console.log('Hybrid home tests passed: genuine records/routes, artwork, shared search/focus, bounded/coalesced parallax, session pause/storage refusal, reduced/coarse/narrow/hidden/offscreen motion, SPA cleanup, scroll and delayed failure.');
