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
    w.innerWidth = 390;
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
    w.innerWidth = 390;
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
    const dom = surface('pages/items.html', '/items', ['js/items-catalog-hdv.js', 'js/items.js']);
    const w = dom.window, d = w.document;
    w.NamelessItemsPage.init(d);
    const image = d.querySelector('.item-image'), media = image.parentElement;
    let frame = 160;
    Object.defineProperty(media, 'clientWidth', { get: () => frame });
    Object.defineProperty(media, 'clientHeight', { get: () => frame });
    Object.defineProperty(image, 'naturalWidth', { value: 47 });
    Object.defineProperty(image, 'naturalHeight', { value: 48 });
    image.dispatchEvent(new w.Event('load'));
    check(image.classList.contains('is-pixel-art') && image.style.getPropertyValue('--item-image-width') === '94px' && image.style.getPropertyValue('--item-image-height') === '96px', 'Small item sprites use a whole 2x enlargement that preserves their ratio');
    check(image.src.endsWith('?v=items-cleaned-20261007'), 'Replacement PNG requests have a cache version without changing the path');
    frame = 100; w.dispatchEvent(new w.Event('resize'));
    check(image.style.getPropertyValue('--item-image-width') === '47px', 'A narrow sprite frame uses native pixels rather than a fractional scale');
    frame = 500; w.dispatchEvent(new w.Event('resize'));
    check(image.style.getPropertyValue('--item-image-width') === '94px', 'Wide frames never enlarge sprites beyond 2x');
    image.dispatchEvent(new w.Event('error'));
    check(!image.classList.contains('is-pixel-art') && !image.hasAttribute('width') && image.style.getPropertyValue('--item-image-width') === '' && image.classList.contains('is-fallback'), 'Image failure clears all sprite sizing before displaying the fallback');
    const remaining = d.querySelectorAll('.item-image')[1];
    Object.defineProperty(remaining, 'naturalWidth', { value: 47 }); Object.defineProperty(remaining, 'naturalHeight', { value: 48 });
    remaining.dispatchEvent(new w.Event('load'));
    w.NamelessItemsPage.destroy(); remaining.style.setProperty('--item-image-width', '19px');
    w.dispatchEvent(new w.Event('resize'));
    check(remaining.style.getPropertyValue('--item-image-width') === '19px', 'Unmounted catalogue removes the sprite resize listener');
    dom.window.close();
}

{
    const dom = surface('pages/quetes.html', '/quetes?quest=p2-secondaire-minutiare', ['js/quetes.js']);
    const w = dom.window, d = w.document; w.NamelessQuestPage.init(d);
    check(d.querySelector('#tier-select').value === '2', 'Quest deep link selects its floor');
    check(d.activeElement.id === 'p2-secondaire-minutiare' && d.activeElement.style.display === 'block', 'Secondary archive deep link focuses its visible step');
    const all = Array.from(d.querySelectorAll('.quest-step'));
    check(all.every(step => step.id) && new Set(all.map(step => step.id)).size === all.length, 'Quest IDs are permanent and unique');
    const coords = d.querySelector('.quest-section[data-tier="2"] a.coordinates[data-y^="-"]');
    check(coords && Number(new URL(coords.href).searchParams.get('y')) < 0, 'Secondary archive coordinate links preserve negative values');
    route(w, '/quetes?quest=p1-secondaire-varn');
    check(d.activeElement.id === 'p1-secondaire-varn' && d.querySelector('#tier-select').value === '1', 'Same-route secondary navigation changes floor');
    route(w, '/quetes?quest=p1-principale-1');
    check(!d.querySelector('#p1-principale-1') && !d.querySelector('#quest-archived-target').hidden && d.activeElement.id === 'quest-archived-target', 'Old main quest URL explains archiving without exposing obsolete content');
    check(!d.querySelector('.quest-filter-btn') && !d.querySelector('.quest-section[data-category="principale"]'), 'The secondary archive offers no misleading category toggle for retired main quests');
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

// Map lifecycle, coordinates and progressive images are exercised in test-map-view.mjs.
console.log(`Catalogue DOM regressions: ${checks} checks passed.`);
