#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }
function surface(kind, width = 1080, query = '') {
    const creature = kind === 'creature';
    const dom = new JSDOM(read(creature ? 'pages/bestiaire.html' : 'pages/items.html'), {
        url: 'https://nameless-sao.fr/' + (creature ? 'bestiaire' : 'items') + query,
        runScripts: 'outside-only', pretendToBeVisual: true
    });
    const w = dom.window;
    Object.defineProperty(w, 'innerWidth', { value: width, writable: true });
    w.NamelessSpaRouter = { controlsLifecycle: true };
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    w.matchMedia = () => ({ matches: true });
    w.eval((creature ? '' : read('js/items-catalog-hdv.js') + '\n') + read(creature ? 'js/bestiaire.js' : 'js/items.js') + '\nwindow.__hybridRecords = ' + (creature ? 'JSON.stringify(creaturesData);' : 'JSON.stringify(Object.values(itemsCatalog).flatMap(group => group.items.map(item => ({...item, category:group.name}))));'));
    const api = creature ? w.NamelessBestiaryPage : w.NamelessItemsPage;
    api.init(w.document);
    const data = JSON.parse(w.__hybridRecords);
    return { dom, w, d: w.document, api, data };
}
function field(s, id, value, event = 'change') {
    const input = s.d.getElementById(id); input.value = value;
    input.dispatchEvent(new s.w.Event(event, { bubbles: true }));
}
function ids(s, kind) { return [...s.d.querySelectorAll(kind === 'creature' ? '.creature-card' : '.item-card')].map(card => card.dataset.id); }
function allPages(s, kind) {
    const next = s.d.getElementById(kind === 'creature' ? 'next-page' : 'items-next-page');
    const result = ids(s, kind);
    while (!next.disabled) { next.click(); result.push(...ids(s, kind)); }
    return result;
}
function byName(a, b) { return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true }) || String(a.id).localeCompare(String(b.id)); }
function close(s) { s.api.destroy(); s.dom.window.close(); }

{
    const s = surface('creature'), { d, data } = s;
    equal(data.length, 60, 'The codex retains the actual 60 creature records');
    equal([...d.querySelectorAll('#bes-palier option')].map(o => o.value), ['', ...new Set(data.map(c => String(c.palier)))].sort(), 'Floor choices come exclusively from the real bestiary');
    equal(new Set([...d.querySelectorAll('#bes-category option')].map(o => o.value).filter(Boolean)), new Set(data.map(c => c.category)), 'Creature categories derive from current records');
    check(d.querySelector('#bes-filter-details').open, 'Desktop opens the filter rail');
    const unknownZone = d.querySelector('#bes-zone option[value="???"]');
    if (unknownZone) check(unknownZone.textContent === 'Zone non renseignée', 'Unknown zone is labelled honestly without changing its data value');
    equal(ids(s, 'creature'), data.slice(0, 12).map(c => String(c.id)), 'Default order preserves the established codex order');
    field(s, 'bes-sort', 'name-asc');
    equal(allPages(s, 'creature'), [...data].sort(byName).map(c => String(c.id)), 'Name ascending applies across every page without duplicates');
    field(s, 'bes-sort', 'name-desc');
    equal(allPages(s, 'creature'), [...data].sort((a, b) => -byName(a, b)).map(c => String(c.id)), 'Name descending changes the actual dataset order');
    field(s, 'bes-sort', 'category');
    const categoryOrder = { boss: 0, elite: 1, creature: 2 };
    equal(allPages(s, 'creature'), [...data].sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category] || byName(a, b)).map(c => String(c.id)), 'Category sort puts boss, elite and creature records in their real groups');
    const target = data.find(c => c.category === 'creature' && c.location !== '???');
    field(s, 'bes-category', target.category); field(s, 'bes-zone', target.location);
    equal(allPages(s, 'creature'), data.filter(c => c.category === target.category && c.location === target.location).sort(byName).map(c => String(c.id)), 'Category and zone filters intersect rather than replace each other');
    check(d.getElementById('bes-count').textContent.startsWith(String(data.filter(c => c.category === target.category && c.location === target.location).length)), 'The result count reflects the filtered dataset');
    field(s, 'bes-search', 'zzzz-no-known-creature', 'input');
    check(d.querySelector('.bes-empty') && !ids(s, 'creature').length && d.querySelector('#pagination-container').style.display === 'none', 'Empty search has a truthful state and no dangling page controls');
    s.w.history.replaceState({}, '', '/bestiaire?q=zzzz'); d.getElementById('bes-reset').click();
    equal(ids(s, 'creature'), data.slice(0, 12).map(c => String(c.id)), 'Reset restores the entire original codex on page one');
    check(!new URL(s.w.location.href).searchParams.has('q'), 'Reset clears the legacy search query so re-entry cannot restore an obsolete filter');
    const card = d.querySelector('.creature-card'); card.focus(); card.click();
    check(card.classList.contains('is-selected') && d.querySelector('.creature-modal').style.display === 'flex', 'Opening a creature gives the selected card a visible state');
    d.querySelector('.modal-close').click();
    check(!card.classList.contains('is-selected') && d.activeElement === card, 'Closing a creature clears selection and restores its opener');
    close(s);
}
{
    const s = surface('item'), { d, data } = s;
    equal(data.length, 104, 'The inventory retains every supplied item');
    equal(ids(s, 'item'), data.slice(0, 12).map(c => c.id), 'Default item order preserves the catalogue source');
    field(s, 'it-sort', 'name-asc');
    equal(allPages(s, 'item'), [...data].sort(byName).map(c => c.id), 'Item name ascending sorts across all pages');
    field(s, 'it-sort', 'name-desc');
    equal(allPages(s, 'item'), [...data].sort((a, b) => -byName(a, b)).map(c => c.id), 'Item name descending reverses the real names');
    const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    for (const direction of ['asc', 'desc']) {
        field(s, 'it-sort', 'rarity-' + direction);
        equal(allPages(s, 'item'), [...data].sort((a, b) => (direction === 'asc' ? 1 : -1) * (rarityOrder[a.rarity] - rarityOrder[b.rarity]) || byName(a, b)).map(c => c.id), 'Rarity ' + direction + ' uses the defined order with stable name ties');
    }
    const target = data.find(c => c.rarity === 'rare');
    field(s, 'it-category', target.category); field(s, 'it-rarity', target.rarity);
    equal(new Set(allPages(s, 'item')), new Set(data.filter(c => c.category === target.category && c.rarity === target.rarity).map(c => c.id)), 'Category and rarity intersect on actual item properties');
    field(s, 'it-search', 'no-known-item-zzzz', 'input');
    check(d.querySelector('.items-empty') && d.querySelector('#items-pagination-container').style.display === 'none', 'An empty inventory filter suppresses pagination');
    s.w.history.replaceState({}, '', '/items?q=zzzz'); d.getElementById('it-reset').click();
    equal(ids(s, 'item'), data.slice(0, 12).map(c => c.id), 'Item reset restores the original catalogue and sort');
    check(!new URL(s.w.location.href).searchParams.has('q'), 'Item reset clears the inherited search URL');
    field(s, 'items-per-page-select', '24');
    equal(ids(s, 'item').length, 24, 'Per-page selection changes the actual inventory render');
    d.getElementById('items-next-page').click();
    equal(ids(s, 'item'), data.slice(24, 48).map(c => c.id), 'Next-page navigation preserves the selected page size');
    const card = d.querySelector('.item-card'); card.focus(); card.click();
    check(card.classList.contains('is-selected') && d.querySelector('.item-modal').style.display === 'flex', 'Opening an item marks only its actual card');
    d.querySelector('.modal-close').click();
    check(!card.classList.contains('is-selected') && d.activeElement === card, 'Closing an item clears selection and restores focus');
    close(s);
}
for (const kind of ['creature', 'item']) {
    const s = surface(kind, 390), id = kind === 'creature' ? 'bes-filter-details' : 'it-filter-details';
    const details = s.d.getElementById(id);
    check(!details.open, kind + ' filters start collapsed on mobile while search stays outside the disclosure');
    check(!details.contains(s.d.getElementById(kind === 'creature' ? 'bes-search' : 'it-search')), 'Search remains available with ' + kind + ' filters closed');
    check(!details.contains(s.d.getElementById(kind === 'creature' ? 'bes-reset' : 'it-reset')), 'Reset remains available with ' + kind + ' filters closed');
    details.querySelector('summary').click();
    check(details.open, kind + ' native filter disclosure really opens');
    s.w.innerWidth = 360; s.w.dispatchEvent(new s.w.Event('resize'));
    check(details.open, 'Small same-mode resizes preserve the user-opened ' + kind + ' filters');
    s.w.innerWidth = 1080; s.w.dispatchEvent(new s.w.Event('resize'));
    check(details.open, kind + ' filter rail is expanded on desktop');
    s.w.innerWidth = 768; s.w.dispatchEvent(new s.w.Event('resize'));
    check(!details.open, kind + ' rail returns to a disclosure at the compact breakpoint');
    s.api.destroy(); details.open = true;
    s.w.innerWidth = 360; s.w.dispatchEvent(new s.w.Event('resize'));
    check(details.open, 'Destroyed ' + kind + ' controller removes the filter resize listener');
    s.dom.window.close();
}

// Load the real dictionaries and language engine. Metadata and select values
// remain French/IDs; queries accept both languages and sorting follows display.
for (const kind of ['creature', 'item']) {
    const s = surface(kind), { w, d, data } = s;
    for (const file of ['js/i18n-en.js', 'js/i18n-en-reviewed.js', 'js/i18n-game-en-reviewed.js', 'js/i18n.js']) w.eval(read(file));
    w.NamelessI18n.setLanguage('en');
    const searchId = kind === 'creature' ? 'bes-search' : 'it-search';
    const sortId = kind === 'creature' ? 'bes-sort' : 'it-sort';
    const compact = value => String(value).normalize('NFD').replace(/[\u0300-\u036f\s]/g, '').toLowerCase();
    for (const query of kind === 'creature' ? ['WhiteWolf'] : ['ManaPotion', 'SlimeJelly']) {
        field(s, searchId, query, 'input');
        equal(new Set(allPages(s, kind)), new Set(data.filter(record => compact(w.NamelessTranslations.en[record.name] || record.name).includes(compact(query))).map(record => String(record.id))), query + ' finds actual translated names while preserving IDs');
    }
    field(s, searchId, kind === 'creature' ? 'Loup Blanc' : 'Gelée de Slime', 'input');
    check(ids(s, kind).length > 0, 'Original French ' + kind + ' names remain searchable in English');
    field(s, searchId, kind === 'creature' ? 'Beast' : 'Resources', 'input');
    check(ids(s, kind).length > 0, 'Translated ' + kind + ' type/category is searchable');
    field(s, searchId, '', 'input'); field(s, sortId, 'name-asc');
    const compareVisible = (a, b) => w.NamelessI18n.translate(a.name).localeCompare(w.NamelessI18n.translate(b.name), w.NamelessI18n.getLocale(), { sensitivity: 'base', numeric: true }) || String(a.id).localeCompare(String(b.id));
    equal(allPages(s, kind), [...data].sort(compareVisible).map(record => String(record.id)), 'English ' + kind + ' order matches translated names and en-GB collation');
    field(s, sortId, 'name-asc'); w.NamelessI18n.apply(d.getElementById('main-content'));
    equal([...d.querySelectorAll(kind === 'creature' ? '.creature-name' : '.item-name')].map(node => node.textContent), [...data].sort(compareVisible).slice(0, 12).map(record => w.NamelessI18n.translate(record.name)), 'Visible English ' + kind + ' names appear in the tested order');
    const card = d.querySelector(kind === 'creature' ? '.creature-card' : '.item-card'); card.focus(); card.click();
    const modal = d.querySelector(kind === 'creature' ? '.creature-modal' : '.item-modal');
    const identity = modal.dataset[kind === 'creature' ? 'creature' : 'item'], url = w.location.href;
    w.NamelessI18n.setLanguage('fr');
    check(modal.isConnected && modal.style.display === 'flex' && modal.dataset[kind === 'creature' ? 'creature' : 'item'] === identity && w.location.href === url, 'Switching language preserves the same open ' + kind + ' detail and URL');
    equal(allPages(s, kind), [...data].sort(byName).map(record => String(record.id)), 'Language change reapplies the French ' + kind + ' sort');
    s.api.destroy();
    const retainedCards = ids(s, kind);
    field(s, searchId, 'unmatched-after-destroy', 'input'); w.NamelessI18n.setLanguage('en');
    equal(ids(s, kind), retainedCards, 'Destroyed ' + kind + ' lifecycle removes language and filter handlers');
    s.dom.window.close();
}
console.log('Hybrid catalogue regressions: ' + checks + ' checks passed for actual data, filters, sorting, pagination and mobile disclosure lifecycles.');
