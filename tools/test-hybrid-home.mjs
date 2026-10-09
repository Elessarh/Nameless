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
const art = JSON.parse(read('docs/hybrid-mmorpg-2026-10-08/home-art-manifest.json'));
const minecraftArt = JSON.parse(read('docs/sao-minecraft-home-2026-10-08/asset-manifest.json'));
const heroArt = JSON.parse(read('docs/definitive-hybrid-2026-10-09/hero-manifest.json'));
const derivedImages = new Map();
const fileHash = name => createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');

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
    assert.equal(hero.getAttribute('src'), '/assets/home/aincrad-minecraft-1920.webp');
    assert.equal(hero.getAttribute('fetchpriority'), 'high');
    assert.equal(main.querySelector('.home-scene-caption').textContent, 'Illustration d’ambiance', 'The hero interpretation is not presented as an official server location');
    assert.equal(hero.getAttribute('loading'), null, 'The hero must load immediately');
    assert.ok(doc.head.querySelector('link[rel="preload"][href="/assets/home/aincrad-minecraft-mobile.webp"]'));
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
            assert.deepEqual(candidates.map(([, width]) => width), ['256w', '512w']);
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
    const mediaListeners = new Set();
    const media = { matches: false, addEventListener(_type, fn) { mediaListeners.add(fn); }, removeEventListener(_type, fn) { mediaListeners.delete(fn); } };
    w.matchMedia = () => media;
    w.eval(runtime);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const main = w.document.querySelector('main');
    const button = main.querySelector('[data-home-motion]');
    assert.equal(mediaListeners.size, 1);
    button.click();
    assert.equal(main.dataset.motionPaused, 'true', 'The scenery can be paused with a native button');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    w.NamelessHomePage.init(main);
    assert.equal(mediaListeners.size, 1, 'SPA init cannot accumulate media preference listeners');
    assert.equal(main.dataset.motionPaused, 'true', 'The chosen pause survives route initialization');
    media.matches = true;
    for (const fn of mediaListeners) fn();
    assert.equal(button.disabled, true, 'Reduced motion disables the animated scenery');
    assert.match(button.getAttribute('aria-label'), /mouvements réduits/);
    media.matches = false;
    for (const fn of mediaListeners) fn();
    button.click();
    assert.equal(main.dataset.motionPaused, 'false');
    w.NamelessI18n = { getLanguage: () => 'en' };
    w.document.dispatchEvent(new w.Event('nameless:languagechange'));
    assert.equal(button.getAttribute('aria-label'), 'Pause scenery');
    w.NamelessHomePage.destroy();
    assert.equal(mediaListeners.size, 0, 'Leaving home removes the preference listener');
    button.click();
    assert.equal(main.dataset.motionPaused, 'false', 'Destroyed home no longer handles scenery controls');
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

console.log('Hybrid home tests passed: genuine records/routes, artwork, shared search/focus, scenery pause/reduced-motion, SPA cleanup, scroll and delayed failure.');
