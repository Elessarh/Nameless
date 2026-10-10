#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
function surface(width = 1440, query = '', sourceIndex) {
    const dom = new JSDOM(read('pages/items.html'), { url: 'https://nameless-sao.fr/items' + query, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window, d = w.document;
    Object.defineProperty(w, 'innerWidth', { value: width, writable: true });
    Object.defineProperty(w, 'innerHeight', { value: 800, writable: true });
    w.NamelessSpaRouter = { controlsLifecycle: true };
    w.matchMedia = () => ({ matches: true }); w.HTMLElement.prototype.scrollIntoView = () => {};
    if (sourceIndex) w.NamelessGlobalSearch = { getIndex: async () => sourceIndex };
    w.eval(read('js/items-catalog-hdv.js') + '\n' + read('js/items.js') + '\nwindow.__items = JSON.stringify(Object.values(itemsCatalog).flatMap(group => group.items.map(item => ({...item, category: group.name}))));');
    const data = JSON.parse(w.__items); w.NamelessItemsPage.init(d);
    return { dom, w, d, data, close() { w.NamelessItemsPage.destroy(); dom.window.close(); } };
}
function field(s, id, value) { const node = s.d.getElementById(id); node.value = value; node.dispatchEvent(new s.w.Event(id === 'it-search' ? 'input' : 'change', { bubbles: true })); }
function allIds(s) { const ids = [...s.d.querySelectorAll('.item-card')].map(card => card.dataset.id), next = s.d.getElementById('items-next-page'); while (!next.disabled) { next.click(); ids.push(...[...s.d.querySelectorAll('.item-card')].map(card => card.dataset.id)); } return ids; }
const choose = (s, id, value) => [...s.d.querySelectorAll('[data-filter-field="' + id + '"]')].find(node => node.value === value);

{
    const s = surface(), { d, data } = s;
    check(!d.querySelector('.item-modal') && !d.querySelector('.catalogue-has-selection'), 'Initial inventory uses its full catalogue area without selecting an arbitrary record');
    check(!d.querySelector('.catalogue-detail-slot').children.length, 'The unused detail slot contains no empty panel');
    equal(data.length, 104, 'All 104 native item records are preserved');
    equal(allIds(s), data.map(item => item.id), 'Every item appears once through native pagination');
    d.getElementById('it-reset').click();
    const categories = [...new Set(data.map(item => item.category))].slice(0, 2);
    categories.forEach(category => choose(s, 'it-category', category).click());
    equal(new Set(allIds(s)), new Set(data.filter(item => categories.includes(item.category)).map(item => item.id)), 'Two categories combine with OR');
    ['rare', 'epic'].forEach(rarity => choose(s, 'it-rarity', rarity).click());
    const expected = data.filter(item => categories.includes(item.category) && ['rare', 'epic'].includes(item.rarity));
    equal(new Set(allIds(s)), new Set(expected.map(item => item.id)), 'Multiple rarities combine with OR and intersect categories with AND');
    equal(d.querySelectorAll('#it-active-filters button').length, 4, 'Each selected value gets an individual removable chip');
    equal(d.querySelector('[data-filter-group="it-category"] .catalogue-filter-selected-count').textContent, '2', 'Collapsed group badge records the number of selected categories');
    const categoryChip = [...d.querySelectorAll('[data-clear-filter="it-category"]')].find(chip => chip.dataset.filterValue === categories[0]); categoryChip.click();
    check(!choose(s, 'it-category', categories[0]).checked && choose(s, 'it-category', categories[1]).checked, 'Removing one chip preserves the other category');
    const rare = choose(s, 'it-rarity', 'rare');
    equal(Number(rare.parentElement.lastElementChild.textContent), data.filter(item => item.category === categories[1] && item.rarity === 'rare').length, 'Faceted counts use real matching records from the other groups');
    field(s, 'it-category', categories[0]);
    equal(d.querySelectorAll('[data-filter-field="it-category"]:checked').length, 1, 'Legacy select change remains compatible and replaces only its group');
    const group = d.querySelector('[data-filter-group="it-category"]'); group.open = false;
    d.dispatchEvent(new s.w.CustomEvent('nameless:languagechange'));
    check(!d.querySelector('[data-filter-group="it-category"]').open, 'Language rebuild preserves user-collapsed groups and selection');
    d.getElementById('it-reset').click(); const card = d.querySelector('.item-card'); card.focus(); card.click();
    const modal = d.querySelector('.item-modal');
    check(d.querySelector('.items-page').classList.contains('catalogue-has-selection') && modal.dataset.panelMode === 'rail', 'Only a real item selection opens the desktop rail');
    check(modal.querySelector('.item-detail-description').textContent.includes('Aucune description'), 'Missing native descriptions are stated honestly');
    equal([...modal.querySelectorAll('.item-verified-facts dd')].map(node => node.textContent), [data[0].category.replace(/^\S+\s+/, ''), 'Légendaire'], 'The facts section only contains verified category and rarity');
    check(!modal.querySelector('.modal-stats, .item-damage, .item-defense'), 'No combat statistics or invented item characteristics are rendered');
    modal.querySelector('.item-share-button').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    check(modal.querySelector('.item-share input').value.endsWith('/items?item=' + data[0].id) && !modal.querySelector('.item-share input').hidden, 'Unavailable clipboard offers a selectable native permalink');
    modal.querySelector('.modal-close').click();
    check(!d.querySelector('.items-page').classList.contains('catalogue-has-selection') && d.activeElement === card && !d.querySelector('[aria-expanded="true"].item-card'), 'Close clears selection, releases the rail and restores the actual opener');
    s.close();
}
{
    const s = surface(390), { d, w } = s;
    const card = d.querySelector('.item-card'); card.getBoundingClientRect = () => ({ left: 355, right: 405, top: 1, bottom: 51, width: 50, height: 50 });
    const original = w.HTMLElement.prototype.getBoundingClientRect;
    w.HTMLElement.prototype.getBoundingClientRect = function () { return this.id === 'item-tooltip' ? { width: 250, height: 90 } : original.call(this); };
    card.focus(); const tooltip = d.getElementById('item-tooltip');
    check(tooltip && !tooltip.hidden && tooltip.getAttribute('role') === 'tooltip' && card.getAttribute('aria-describedby') === tooltip.id, 'Keyboard focus exposes a described, accessible tooltip');
    check(Number.parseInt(tooltip.style.left, 10) >= 12 && Number.parseInt(tooltip.style.left, 10) + 250 <= 378 && Number.parseInt(tooltip.style.top, 10) >= 12, 'Tooltip fits the viewport even beside its top-right boundary');
    card.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    check(tooltip.hidden && !card.hasAttribute('aria-describedby'), 'Escape dismisses the tooltip without opening or closing another control');
    card.click(); const modal = d.querySelector('.item-modal');
    check(modal.getAttribute('role') === 'dialog' && modal.getAttribute('aria-modal') === 'true' && d.body.style.overflow === 'hidden', 'Mobile selection opens a scrolling-safe dialog');
    const close = modal.querySelector('.modal-close'); close.focus();
    close.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    check(modal.contains(d.activeElement) && d.activeElement !== close, 'Mobile dialog contains keyboard focus');
    close.click();
    const toggle = d.getElementById('it-filter-toggle'); toggle.focus(); toggle.click();
    check(d.querySelector('.items-page').classList.contains('catalogue-filters-open') && d.activeElement.id === 'it-filter-close' && d.querySelector('.catalogue-results').inert, 'Mobile filter drawer focuses its close button and isolates the underlying results');
    d.getElementById('it-filter-close').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    check(!d.querySelector('.items-page').classList.contains('catalogue-filters-open') && d.activeElement === toggle && !d.querySelector('.catalogue-results').inert && d.body.style.overflow === '', 'Drawer Escape restores focus, inert state and scroll');
    toggle.click(); w.innerWidth = 1440; w.dispatchEvent(new w.Event('resize'));
    check(!d.querySelector('.items-page').classList.contains('catalogue-filters-open') && !d.querySelector('.items-filters').inert && d.body.style.overflow === '', 'Desktop resize releases the drawer cleanly');
    s.close(); check(!d.getElementById('item-tooltip'), 'SPA destruction removes the tooltip and its controller');
}
{
    const index = JSON.parse(read('assets/search-index.json')).entries;
    const s = surface(1440, '?item=gelee_slime&rarity=common&rarity=rare', index), { d, w, data } = s;
    await new Promise(resolve => setTimeout(resolve, 0));
    equal(d.querySelectorAll('[data-filter-field="it-rarity"]:checked').length, 2, 'Repeated native URL filter values restore a real multiselection');
    const modal = d.querySelector('.item-modal');
    check(modal && modal.dataset.item === 'gelee_slime', 'Direct links select exactly the requested item');
    check(modal.querySelector('.item-sources a[href^="/bestiaire?creature="]') && modal.querySelector('.item-source-map-link'), 'Confirmed sources maintain native item to creature to map links');
    choose(s, 'it-source', 'known').click(); choose(s, 'it-source', 'unknown').click();
    equal(new Set(allIds(s)), new Set(data.filter(item => ['common', 'rare'].includes(item.rarity)).map(item => item.id)), 'Selecting both source groups includes all records matching the other filters');
    field(s, 'it-search', 'Slime');
    w.history.replaceState({}, '', '/items'); d.dispatchEvent(new w.CustomEvent('nameless:routechange'));
    check(modal.style.display === 'none' && !d.querySelector('.catalogue-has-selection') && !d.querySelectorAll('[data-filter-field]:checked').length && !d.getElementById('it-search').value, 'Same-route root navigation clears prior record and filter selections');
    s.close();
}
console.log('Phase 3 item inventory: ' + checks + ' checks passed.');
