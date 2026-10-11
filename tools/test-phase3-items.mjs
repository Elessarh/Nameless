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
    equal(d.querySelectorAll('.item-card').length, 48, 'The initial inventory actually renders 48 native items');
    equal(d.getElementById('items-per-page-select').value, '48', 'The default 48 item page agrees with its control');
    check([...d.querySelectorAll('.item-card')].every(card => card.dataset.rarity === data.find(item => item.id === card.dataset.id).rarity), 'Rarity accents use each item’s recorded rarity');
    check([...d.querySelectorAll('.item-card')].every(card => card.querySelector('.item-card-meta .item-cat') && card.querySelector('.item-card-meta .item-rarity-badge') && !card.querySelector('.item-media .item-rarity-badge')), 'Category and rarity sit below the native sprite in a dedicated metadata row');
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
    equal(modal.dataset.rarity, data[0].rarity, 'The selected detail inherits its real rarity');
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
    const s = surface(), { d, w } = s;
    // Read the actual immutable PNG dimensions, not a duplicated asset table.
    // JSDOM supplies the media geometry while the real load handler sizes it.
    const verifyImage = (image, width, height, expectedScale) => {
        const bytes = fs.readFileSync(path.join(root, decodeURIComponent(new URL(image.src).pathname).slice(1)));
        equal(bytes.subarray(1, 4).toString(), 'PNG', 'The fixture is an actual native PNG');
        const nativeWidth = bytes.readUInt32BE(16), nativeHeight = bytes.readUInt32BE(20);
        Object.defineProperties(image, { naturalWidth: { value: nativeWidth, configurable: true }, naturalHeight: { value: nativeHeight, configurable: true } });
        Object.defineProperties(image.parentElement, { clientWidth: { value: width, configurable: true }, clientHeight: { value: height, configurable: true } });
        image.dispatchEvent(new w.Event('load'));
        equal(Number(image.dataset.pixelScale), expectedScale, 'The real load handler chooses the largest supported integer factor');
        equal([Number.parseInt(image.style.getPropertyValue('--item-image-width')), Number.parseInt(image.style.getPropertyValue('--item-image-height'))], [nativeWidth * expectedScale, nativeHeight * expectedScale], 'Displayed PNG dimensions preserve both proportions at an integer scale');
    };
    const ring = d.querySelector('.item-card[data-id="anneau_faucheuse"] .item-image');
    verifyImage(ring, 200, 128, 2);
    // A 49px sprite must no longer fall back to 1x because of the old 32px inset.
    d.getElementById('items-next-page').click();
    const fur = d.querySelector('.item-card[data-id="fourrure_loup"] .item-image');
    check(!!fur, 'A real 49px source is present on the next native page');
    verifyImage(fur, 200, 128, 2);
    d.getElementById('it-reset').click(); d.querySelector('.item-card').click();
    verifyImage(d.querySelector('.item-modal-media img'), 320, 176, 3);
    s.close();
}
{
    const s = surface(1440), { d, w } = s;
    d.querySelector('.item-card').click();
    const modal = d.querySelector('.item-modal'), oldClose = modal.querySelector('.modal-close'); oldClose.focus();
    d.dispatchEvent(new w.CustomEvent('nameless:languagechange'));
    check(d.activeElement === modal.querySelector('.modal-close') && d.activeElement !== oldClose, 'A desktop language rebuild preserves focus inside its rebuilt detail rail');
    const search = d.getElementById('it-search'); search.focus();
    d.dispatchEvent(new w.CustomEvent('nameless:languagechange'));
    equal(d.activeElement, search, 'A desktop detail rebuild never steals focus from an active background control');
    let cancellations = 0;
    w.NamelessReferenceShell = { cancelPanelClose(panel) { equal(panel, modal, 'Destroy cancels the actual active detail panel'); cancellations++; } };
    w.NamelessItemsPage.destroy();
    equal(cancellations, 1, 'SPA teardown cancels any pending exit before removing the detail DOM');
    s.close();
}
{
    const s = surface(390), { d, w } = s;
    const audio = d.createElement('div'); audio.className = 'nm-audio-dock'; audio.inert = false; d.body.appendChild(audio);
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
    check(d.querySelector('.items-page').classList.contains('catalogue-filters-open') && d.activeElement.id === 'it-filter-close' && d.querySelector('.catalogue-results').inert && audio.inert, 'Mobile filter drawer focuses its close button and isolates the underlying results and audio controls');
    d.getElementById('it-filter-close').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    check(!d.querySelector('.items-page').classList.contains('catalogue-filters-open') && d.activeElement === toggle && !d.querySelector('.catalogue-results').inert && !audio.inert && d.body.style.overflow === '', 'Drawer Escape restores focus, inert state, audio controls and scroll');
    toggle.click(); w.innerWidth = 1440; w.dispatchEvent(new w.Event('resize'));
    check(!d.querySelector('.items-page').classList.contains('catalogue-filters-open') && !d.querySelector('.items-filters').inert && d.body.style.overflow === '', 'Desktop resize releases the drawer cleanly');
    s.close(); check(!d.getElementById('item-tooltip'), 'SPA destruction removes the tooltip and its controller');
}
{
    const s = surface(390), { d, w } = s;
    const header = d.querySelector('header'), hero = d.querySelector('.items-hero'), results = d.querySelector('.catalogue-results'), filters = d.querySelector('.items-filters'), footer = d.querySelector('footer');
    footer.inert = true;
    const audio = d.createElement('div'); audio.className = 'nm-audio-dock'; audio.inert = false;
    const palette = d.createElement('dialog'); palette.id = 'nameless-global-search'; palette.innerHTML = '<input aria-label="Search">'; d.body.appendChild(palette);
    d.body.style.overflow = 'clip';
    const opener = d.querySelector('.item-card'), openerId = opener.dataset.id; opener.focus(); opener.click();
    const modal = d.querySelector('.item-modal');
    check([header, hero, results, filters, footer].every(element => element.inert), 'The sheet isolates all background branches, including header and catalogue');
    d.body.appendChild(audio); await new Promise(resolve => setTimeout(resolve, 0));
    check(audio.inert, 'An audio dock mounted after the deep-linked sheet also becomes inert');
    check(!modal.inert && !modal.parentElement.inert && !d.querySelector('.catalogue-layout').inert && !d.querySelector('main').inert && !palette.inert, 'Neither sheet ancestors nor native dialogs receive explicit inert');
    const secondId = [...d.querySelectorAll('.item-card')][1].dataset.id;
    w.history.replaceState({}, '', '/items?item=' + secondId); d.dispatchEvent(new w.CustomEvent('nameless:routechange'));
    check(modal.dataset.item === secondId && header.inert && audio.inert && modal.contains(d.activeElement), 'Selecting another real item through its route preserves sheet isolation and focus');
    palette.setAttribute('open', ''); const query = palette.querySelector('input'); query.focus();
    d.dispatchEvent(new w.CustomEvent('nameless:languagechange'));
    check(d.activeElement === query && !palette.inert, 'A native search palette stays usable and keeps focus while the sheet rebuilds for language');
    palette.removeAttribute('open'); query.blur(); palette.dispatchEvent(new w.Event('close'));
    equal(d.activeElement, modal.querySelector('.modal-close'), 'Closing a native palette returns focus to the sheet after its old opener was rebuilt');
    const otherDialog = d.createElement('dialog'); otherDialog.setAttribute('open', ''); otherDialog.innerHTML = '<input aria-label="Another dialog">'; d.body.appendChild(otherDialog); otherDialog.querySelector('input').focus();
    palette.dispatchEvent(new w.Event('close'));
    equal(d.activeElement, otherDialog.querySelector('input'), 'A native dialog closing never steals focus from another open native dialog');
    otherDialog.remove(); modal.querySelector('.modal-close').focus();
    d.dispatchEvent(new w.CustomEvent('nameless:languagechange'));
    check(header.inert && audio.inert && filters.inert && modal.contains(d.activeElement), 'Language rebuild never releases the background or strands focus outside its sheet');
    w.innerWidth = 1440; w.dispatchEvent(new w.Event('resize'));
    check(modal.dataset.panelMode === 'rail' && !header.inert && !hero.inert && !results.inert && !filters.inert && !audio.inert && footer.inert && d.body.style.overflow === 'clip', 'Desktop resize restores the original inert values and current desktop filter baseline');
    header.querySelector('a').focus(); w.innerWidth = 900; w.dispatchEvent(new w.Event('resize'));
    check(modal.dataset.panelMode === 'sheet' && header.inert && filters.inert && modal.contains(d.activeElement), 'Tablet resize reinstates sheet isolation and moves background focus into the sheet');
    modal.querySelector('.modal-close').click();
    check(!header.inert && !hero.inert && !results.inert && !filters.inert && !audio.inert && footer.inert && d.body.style.overflow === 'clip', 'Closing restores each baseline rather than clearing pre-existing inert');
    equal(d.activeElement, d.querySelector('.item-card[data-id="' + openerId + '"]'), 'A related route selection retains the rebuilt original opener for return focus');
    w.innerWidth = 390; w.dispatchEvent(new w.Event('resize')); d.querySelector('.item-card').click();
    check(filters.inert && header.inert, 'Reopening on mobile recaptures the closed filter baseline');
    d.querySelector('main').remove(); w.NamelessItemsPage.destroy();
    check(!header.inert && !audio.inert && footer.inert && d.body.style.overflow === 'clip', 'SPA destruction restores external background and scroll even after the sheet DOM was detached');
    s.close();
}
{
    const index = JSON.parse(read('assets/search-index.json')).entries;
    const s = surface(1440, '?item=gelee_slime&rarity=common&rarity=rare', index), { d, w, data } = s;
    await new Promise(resolve => setTimeout(resolve, 0));
    equal(d.querySelectorAll('[data-filter-field="it-rarity"]:checked').length, 2, 'Repeated native URL filter values restore a real multiselection');
    const modal = d.querySelector('.item-modal');
    check(modal && modal.dataset.item === 'gelee_slime', 'Direct links select exactly the requested item');
    check(modal.querySelector('.item-sources a[href^="/bestiaire?creature="]') && modal.querySelector('.item-source-map-link'), 'Confirmed sources maintain native item to creature to map links');
    equal(modal.querySelectorAll('.item-source-row').length, index.find(entry => entry.kind === 'item' && entry.id === 'gelee_slime').sources.length, 'The compact source rows preserve every confirmed creature');
    equal(modal.querySelectorAll('.item-source-portrait').length, modal.querySelectorAll('.item-source-row').length, 'Every indexed source has its real portrait, including Gorbel classified as a boss');
    check([...modal.querySelectorAll('.item-source-portrait')].every(image => image.getAttribute('src').startsWith('/assets/mobs/')), 'Source portraits come exclusively from the native creature index');
    const region = modal.querySelector('.item-source-region-link');
    check(region && new URL(region.href).searchParams.get('entity') === 'location:1:marecage-putride', 'The source region links to the existing swamp location, rather than inventing a region');
    const sourceMap = modal.querySelector('.item-source-map-link');
    check(sourceMap.getAttribute('aria-label').includes('Gorbel') && sourceMap.querySelector('svg[aria-hidden="true"]'), 'Compact map actions retain a named accessible target');
    choose(s, 'it-source', 'known').click(); choose(s, 'it-source', 'unknown').click();
    equal(new Set(allIds(s)), new Set(data.filter(item => ['common', 'rare'].includes(item.rarity)).map(item => item.id)), 'Selecting both source groups includes all records matching the other filters');
    field(s, 'it-search', 'Slime');
    w.history.replaceState({}, '', '/items'); d.dispatchEvent(new w.CustomEvent('nameless:routechange'));
    check(modal.style.display === 'none' && !d.querySelector('.catalogue-has-selection') && !d.querySelectorAll('[data-filter-field]:checked').length && !d.getElementById('it-search').value, 'Same-route root navigation clears prior record and filter selections');
    s.close();
}
{
    const index = JSON.parse(read('assets/search-index.json')).entries;
    const s = surface(1440, '?item=fourrure_loup', index), { d, data } = s;
    await new Promise(resolve => setTimeout(resolve, 0));
    const modal = d.querySelector('.item-modal'), relatedTab = modal.querySelector('[data-detail-tab="related"]');
    check(!!relatedTab, 'A related-items tab appears only for recorded items sharing a confirmed creature source');
    const sourceUrls = new Set(index.find(entry => entry.kind === 'item' && entry.id === 'fourrure_loup').sources.map(source => source.url));
    const relatedLinks = [...modal.querySelectorAll('.catalogue-related-item')];
    check(relatedLinks.length > 0 && relatedLinks.length <= 6, 'The contextual list stays compact without fabricated filler');
    check(relatedLinks.every(link => {
        const id = new URL(link.href).searchParams.get('item'), record = data.find(item => item.id === id), indexed = index.find(entry => entry.kind === 'item' && entry.id === id);
        return record && indexed.sources.some(source => sourceUrls.has(source.url)) && link.dataset.rarity === record.rarity && link.querySelector('.item-related-label small').textContent === record.category.replace(/^\S+\s+/, '') && link.querySelector('.item-related-sprite .item-related-image');
    }), 'Related links preserve real provenance, category, rarity and native sprite supports');
    relatedTab.click();
    check(relatedTab.getAttribute('aria-selected') === 'true' && !modal.querySelector('[data-catalogue-tab-panel="related"]').hidden && modal.querySelector('[data-catalogue-tab-panel="overview"]').hidden, 'The compact related list opens in the existing accessible tab model');
    s.close();
}
{
    const index = JSON.parse(read('assets/search-index.json')).entries;
    const s = surface(1440, '?item=coeur_nautherion', index), { d } = s;
    await new Promise(resolve => setTimeout(resolve, 0));
    const source = d.querySelector('.item-source-creature[href="/bestiaire?creature=56"]'), boss = index.find(entry => entry.kind === 'boss' && entry.id === '56');
    check(source && boss && source.querySelector('.item-source-portrait'), 'Heart of Nautherion renders its confirmed Leviathan boss portrait');
    equal(source.querySelector('img').getAttribute('src'), boss.image, 'The boss portrait is the exact native indexed Leviathan image');
    const map = new URL(d.querySelector('.item-source-map-link').href);
    equal([map.searchParams.get('entity'), map.searchParams.get('floor')], ['creature:56', '1'], 'Adding a boss portrait preserves the existing source identifier and floor');
    s.close();
}
for (const width of [1440, 390]) {
    const s = surface(width), { d, w } = s;
    let pendingClose = null, cancellations = 0;
    w.NamelessReferenceShell = {
        cancelPanelClose(panel) { cancellations++; panel.removeAttribute('data-reference-closing'); pendingClose = null; },
        closePanel(panel, finish) { panel.dataset.referenceClosing = 'true'; pendingClose = () => { panel.removeAttribute('data-reference-closing'); pendingClose = null; finish(); }; }
    };
    const opener = d.querySelector('.item-card'), openerId = opener.dataset.id;
    opener.focus(); opener.click();
    const modal = d.querySelector('.item-modal'), previousCancellations = cancellations;
    modal.querySelector('.modal-close').click();
    check(modal.hasAttribute('data-reference-closing') && modal.style.display === 'flex' && pendingClose, width + ': a deferred exit retains its live panel until completion');
    d.dispatchEvent(new w.CustomEvent('nameless:languagechange'));
    w.innerWidth = width === 1440 ? 390 : 1440; w.dispatchEvent(new w.Event('resize'));
    equal(cancellations, previousCancellations, width + ': language rebuild and viewport resize never cancel or reopen a closing panel');
    check(!d.querySelector('.item-card.is-selected, .item-card[aria-expanded="true"]'), width + ': rebuilding the grid during exit does not recreate a selected-card ghost');
    check(modal.hasAttribute('data-reference-closing') && pendingClose, width + ': the original deferred exit remains pending');
    pendingClose();
    check(modal.style.display === 'none' && !modal.dataset.item && !d.querySelector('.catalogue-has-selection') && !d.querySelector('.item-card.is-selected'), width + ': the original completion releases the panel and its selection');
    check(d.body.style.overflow === '' && d.activeElement === d.querySelector('.item-card[data-id="' + openerId + '"]'), width + ': completion restores scrolling and the actual rebuilt opener');
    s.close();
}
console.log('Phase 3 item inventory: ' + checks + ' checks passed.');
