#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const equal = (value, expected, message) => { assert.deepEqual(value, expected, message); checks++; };
function surface(width = 1280, query = '', index = null) {
    const dom = new JSDOM(read('pages/bestiaire.html'), { url: 'https://nameless-sao.fr/bestiaire' + query, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    Object.defineProperty(w, 'innerWidth', { value: width, writable: true });
    w.NamelessSpaRouter = { controlsLifecycle: true };
    if (index) w.NamelessGlobalSearch = { getIndex: typeof index === 'function' ? index : () => Promise.resolve(index) };
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: true });
    w.eval(read('js/bestiaire.js') + '\nwindow.__records = JSON.stringify(creaturesData);');
    w.NamelessBestiaryPage.init(w.document);
    return { dom, w, d: w.document, data: JSON.parse(w.__records) };
}
function choice(s, field, value) { return [...s.d.querySelectorAll('[data-filter-field="' + field + '"]')].find(input => input.value === value); }
function allIds(s) {
    const ids = [...s.d.querySelectorAll('.creature-card')].map(card => Number(card.dataset.id));
    while (!s.d.getElementById('next-page').disabled) { s.d.getElementById('next-page').click(); ids.push(...[...s.d.querySelectorAll('.creature-card')].map(card => Number(card.dataset.id))); }
    return ids;
}
function key(s, target, value, extra = {}) { const event = new s.w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extra }); target.dispatchEvent(event); return event; }
function close(s) { s.w.NamelessBestiaryPage.destroy(); s.dom.window.close(); }

{
    const s = surface(), { d, data } = s;
    check(!d.querySelector('.creature-modal') && !d.querySelector('.bestiary-page').classList.contains('catalogue-has-selection'), 'A fresh bestiary gives catalogue space to its records without an empty detail rail');
    equal([...d.querySelectorAll('.creature-card')].map(card => Number(card.dataset.id)), data.slice(0, 48).map(creature => creature.id), 'The initial page presents the first 48 native records directly');
    equal(d.getElementById('items-per-page').value, '48', 'The visible page size control agrees with the 48 rendered records');
    equal([...d.querySelectorAll('.creature-card')].map(card => card.querySelector('.chip-category').textContent), data.slice(0, 48).map(creature => ({boss: 'Boss', elite: 'Élite', creature: 'Créature'})[creature.category]), 'Every visible card identifies its actual category rather than inventing a rarity');
    check([1, 2, 5].every(id => !d.querySelector('.creature-card[data-id="' + id + '"] .chip-type')) && d.querySelector('.creature-card[data-id="6"] .chip-type').textContent === 'Bête', 'Compact type badges omit generic Créature labels for bosses, creatures and elites while retaining meaningful native Bête types');
    equal(d.querySelector('.creature-card[data-id="6"] .creature-zone').textContent, data.find(creature => creature.id === 6).location, 'The compact zone label comes directly from its creature record');
    check(d.querySelectorAll('.catalogue-filter-section').length === 4 && d.querySelectorAll('.catalogue-filter-section > summary').length === 4, 'All four logical groups are real keyboard accessible disclosures');
    choice(s, 'bes-category', 'boss').click(); choice(s, 'bes-category', 'elite').click();
    equal(allIds(s), data.filter(creature => ['boss', 'elite'].includes(creature.category)).map(creature => creature.id), 'Category choices use a real union instead of overwriting each other');
    check(choice(s, 'bes-category', 'boss').checked && choice(s, 'bes-category', 'elite').checked, 'Both selected category checkboxes stay checked');
    equal(d.querySelector('[data-selected-count="bes-category"]').textContent, '2', 'Disclosure badge counts individually selected values');
    const zones = [...new Set(data.filter(creature => ['boss', 'elite'].includes(creature.category)).map(creature => creature.location))].slice(0, 2);
    zones.forEach(zone => choice(s, 'bes-zone', zone).click());
    equal(allIds(s), data.filter(creature => ['boss', 'elite'].includes(creature.category) && zones.includes(creature.location)).map(creature => creature.id), 'Unions in each group intersect across groups');
    const categoryChip = [...d.querySelectorAll('[data-clear-filter="bes-category"]')].find(chip => chip.dataset.clearValue === 'boss');
    categoryChip.click();
    equal(allIds(s), data.filter(creature => creature.category === 'elite' && zones.includes(creature.location)).map(creature => creature.id), 'Removing one chip preserves the other selected category and both selected regions');
    check(!choice(s, 'bes-category', 'boss').checked && choice(s, 'bes-category', 'elite').checked, 'Individual chip removal updates precisely its own checkbox');
    const regionCount = choice(s, 'bes-zone', zones[0]).parentElement.lastElementChild;
    equal(Number(regionCount.textContent), data.filter(creature => creature.category === 'elite' && creature.location === zones[0]).length, 'Facet counts obey selections in the other groups');
    const search = d.querySelector('[data-search-filter="bes-zone"]'); search.value = 'introuvable'; search.dispatchEvent(new s.w.Event('input', { bubbles: true }));
    check([...search.parentElement.querySelectorAll('.catalogue-filter-option')].every(row => row.hidden), 'Long region groups can be searched independently without clearing the actual filter');
    d.getElementById('bes-reset').click();
    equal(allIds(s), data.map(creature => creature.id), 'Reset restores the full 60-record source and clears all union filters');
    check(!d.querySelector('#bes-active-filters').children.length && !search.value && [...search.parentElement.querySelectorAll('.catalogue-filter-option')].every(row => !row.hidden), 'Reset also clears chips and local filter searches');
    const legacy = d.getElementById('bes-category'); legacy.value = 'creature'; legacy.dispatchEvent(new s.w.Event('change', { bubbles: true }));
    equal(allIds(s), data.filter(creature => creature.category === 'creature').map(creature => creature.id), 'Legacy select controls still update the actual filter when used by older integration paths');
    d.getElementById('bes-reset').click();
    const card = d.querySelector('.creature-card'); card.focus();
    check(!d.getElementById('bes-creature-tooltip').hidden && card.getAttribute('aria-describedby') === 'bes-creature-tooltip', 'A focused native creature card reveals an accessible descriptive tooltip');
    key(s, card, 'Escape');
    check(d.getElementById('bes-creature-tooltip').hidden && !card.hasAttribute('aria-describedby'), 'Escape dismisses a tooltip without opening or closing details');
    card.click();
    check(d.querySelector('.bestiary-page').classList.contains('catalogue-has-selection') && d.querySelector('.creature-modal').getAttribute('role') === 'region', 'An intentional desktop selection opens the contextual nonmodal rail');
    check(d.querySelector('.catalogue-share') && new URL(s.w.location.href).searchParams.get('creature') === card.dataset.id, 'A selected creature exposes sharing with its exact catalogue identity');
    d.querySelector('.modal-close').click();
    check(!d.querySelector('.bestiary-page').classList.contains('catalogue-has-selection') && d.activeElement === card, 'Closing details releases its rail and restores the actual opener');
    const tooltip = d.getElementById('bes-creature-tooltip');
    s.w.NamelessBestiaryPage.destroy();
    check(!tooltip.isConnected, 'Unmounting the SPA route removes tooltip DOM and listeners');
    s.dom.window.close();
}

{
    const index = JSON.parse(read('assets/search-index.json')).entries;
    const s = surface(1280, '?creature=1', index), { d } = s;
    await new Promise(resolve => setTimeout(resolve, 0));
    const source = index.find(entry => entry.kind === 'location' && entry.title === 'Marécage putride');
    equal(d.querySelector('.creature-zone-link')?.getAttribute('href'), source.mapUrl, 'A real source zone becomes a direct map relation in the selected creature panel');
    const drop = [...d.querySelectorAll('.drop-item')].find(link => link.dataset.item === 'Gelée de Slime');
    const item = index.find(entry => entry.kind === 'item' && entry.sources?.some(source => source.url === '/bestiaire?creature=1') && entry.dropNames?.includes('Gelée de Slime'));
    equal(drop.getAttribute('href'), '/items?item=' + item.id, 'Known drops retain their exact catalogue identities while the source zone is linked');
    d.querySelector('[data-detail-tab="zones"]').click();
    check(!d.querySelector('[data-catalogue-tab-panel="zones"]').hidden && d.querySelector('[data-catalogue-tab-panel="zones"] .creature-zone-link'), 'The zone relation follows the active zone tab without becoming duplicated');
    d.querySelector('[data-detail-tab="overview"]').click();
    equal(d.querySelectorAll('.creature-zone-link').length, 1, 'Returning to overview moves the existing region relation instead of accumulating duplicate links');
    close(s);
}

{
    const index = JSON.parse(read('assets/search-index.json')).entries;
    for (const replacement of ['https://foreign.example/carte?floor=1&entity=location:1:marecage-putride', '/carte?floor=2&entity=location:2:marecage-putride', '/carte?floor=1&entity=creature:1']) {
        const altered = index.map(entry => entry.kind === 'location' && entry.title === 'Marécage putride' ? {...entry, mapUrl: replacement} : entry);
        const s = surface(1280, '?creature=1', altered);
        await new Promise(resolve => setTimeout(resolve, 0));
        check(!s.d.querySelector('.creature-zone-link') && s.d.querySelector('.modal-stat-value').textContent === 'Marécage putride', 'A foreign, wrong-floor or wrong-kind region URL stays plain source text: ' + replacement);
        close(s);
    }
}

{
    const index = JSON.parse(read('assets/search-index.json')).entries;
    const pending = [];
    const s = surface(1280, '', () => new Promise(resolve => pending.push(resolve))), { d } = s;
    d.querySelector('.creature-card[data-id="1"]').click();
    d.querySelector('.creature-card[data-id="2"]').click();
    pending[1](index); await new Promise(resolve => setTimeout(resolve, 0));
    pending[0](index); await new Promise(resolve => setTimeout(resolve, 0));
    check(d.querySelector('.modal-name').textContent === 'Petit Slime' && d.querySelectorAll('.creature-zone-link').length === 1 && !d.querySelector('.catalogue-complete-link'), 'A late lookup for a former boss cannot alter the newer creature selection or duplicate its zone relation');
    close(s);
}

{
    const s = surface(), { d, w } = s;
    let finishClose = null, cancelled = 0;
    w.NamelessReferenceShell = {
        cancelPanelClose: () => { cancelled++; },
        closePanel: (panel, finish) => {
            panel.setAttribute('data-reference-closing', '');
            finishClose = () => { panel.removeAttribute('data-reference-closing'); finish(); };
        }
    };
    const card = d.querySelector('.creature-card[data-id="1"]'); card.focus(); card.click();
    const panel = d.querySelector('.creature-modal');
    const cancellationsBeforeClose = cancelled;
    d.querySelector('.modal-close').click();
    check(panel.hasAttribute('data-reference-closing') && panel.style.display === 'flex', 'A deferred panel animation leaves the closing selection visible until its real completion callback');
    d.dispatchEvent(new w.CustomEvent('nameless:languagechange'));
    equal(cancelled, cancellationsBeforeClose, 'Changing language during close does not cancel the pending close or reopen the selected creature');
    check(panel.hasAttribute('data-reference-closing'), 'Language changes preserve the actual closing state until the animation completes');
    finishClose();
    check(panel.style.display === 'none' && !d.querySelector('.bestiary-page').classList.contains('catalogue-has-selection') && !w.location.search.includes('creature='), 'The deferred close still clears the selected panel and its URL after the language event');
    check(d.activeElement === d.querySelector('.creature-card[data-id="1"]'), 'Completing close restores focus to the matching card rerendered by the language change');
    close(s);
}

{
    const s = surface(390), { d, w } = s;
    check(d.getElementById('bes-filter-drawer').inert === true, 'The closed mobile filter rail is inert before any drawer interaction');
    const background = [d.querySelector('body > header'), d.querySelector('.bes-hero'), d.querySelector('.catalogue-results'), d.querySelector('body > footer')];
    background[0].inert = true;
    const backgroundBefore = background.map(element => element.inert);
    const toggle = d.getElementById('bes-filter-toggle'); toggle.focus(); toggle.click();
    check(d.querySelector('.bestiary-page').classList.contains('catalogue-filters-open') && toggle.getAttribute('aria-expanded') === 'true' && d.body.style.overflow === 'hidden', 'Mobile filters open a dedicated scroll-safe drawer');
    check(d.getElementById('bes-filter-drawer').getAttribute('aria-modal') === 'true' && d.activeElement === d.getElementById('bes-filter-close'), 'Mobile filter dialog announces itself and receives keyboard focus');
    check(background.every(element => element.inert === true) && d.getElementById('bes-filter-drawer').inert === false, 'The open drawer isolates header, hero, results and footer while making its own controls available');
    check(!d.getElementById('bes-filter-drawer').contains(d.getElementById('bes-search')), 'Main creature search remains outside the mobile filter drawer');
    const event = key(s, d.activeElement, 'Tab', { shiftKey: true });
    check(event.defaultPrevented && d.getElementById('bes-filter-drawer').contains(d.activeElement), 'Filter drawer traps reverse Tab within its visible controls');
    key(s, d.activeElement, 'Escape');
    check(!d.querySelector('.bestiary-page').classList.contains('catalogue-filters-open') && d.body.style.overflow === '' && d.activeElement === toggle, 'Escape closes the filter drawer, restores scroll, and returns to its toggle');
    equal(background.map(element => element.inert), backgroundBefore, 'Closing restores the precise prior inert state of every background region');
    check(d.getElementById('bes-filter-drawer').inert === true, 'Closing makes the hidden mobile rail inert again');
    toggle.click(); w.innerWidth = 1280; w.dispatchEvent(new w.Event('resize'));
    check(!d.querySelector('.bestiary-page').classList.contains('catalogue-filters-open') && !d.getElementById('bes-filter-drawer').hasAttribute('aria-modal') && d.body.style.overflow === '', 'Resizing to desktop releases the filter dialog and page scroll');
    check(d.getElementById('bes-filter-drawer').inert === false, 'Desktop resizing makes the normal filter rail available again');
    equal(background.map(element => element.inert), backgroundBefore, 'Desktop resizing restores saved background inert values');
    w.innerWidth = 390; w.dispatchEvent(new w.Event('resize')); toggle.click();
    s.w.NamelessBestiaryPage.destroy();
    equal(background.map(element => element.inert), backgroundBefore, 'SPA cleanup restores background inert even when the route unmounts an open drawer');
    check(d.body.style.overflow === '', 'SPA cleanup restores page scroll from an open drawer');
    s.dom.window.close();
}

{
    const s = surface(390), { d } = s;
    const header = d.querySelector('body > header'); header.inert = false;
    d.getElementById('bes-filter-toggle').click();
    d.querySelector('.bestiary-page').remove();
    s.w.NamelessBestiaryPage.destroy();
    check(header.inert === false && d.body.style.overflow === '', 'Cleanup after the route DOM was already replaced still releases saved background inert and scroll');
    s.dom.window.close();
}

{
    const s = surface(390, '?creature=53'), { d } = s;
    check(d.querySelector('.modal-name').textContent === 'Illfang' && d.querySelector('.creature-modal').getAttribute('aria-modal') === 'true', 'Existing mobile creature deep links still open a focus-contained sheet');
    key(s, d.activeElement, 'Escape');
    check(!d.querySelector('.bestiary-page').classList.contains('catalogue-has-selection') && !s.w.location.search.includes('creature='), 'Closing a mobile deep link clears precisely the selection parameter');
    close(s);
}

{
    const s = surface(1280, '?q=slime'), { d, w, data } = s;
    check(d.getElementById('bes-search').value === 'slime' && d.querySelectorAll('.creature-card').length < 12, 'Search deep links initialize the corresponding query');
    choice(s, 'bes-category', 'boss').click();
    w.history.replaceState({}, '', '/bestiaire'); d.dispatchEvent(new w.CustomEvent('nameless:routechange'));
    check(d.getElementById('bes-search').value === '', 'A same-route URL without q clears the former search query');
    equal(allIds(s), data.filter(creature => creature.category === 'boss').map(creature => creature.id), 'Clearing the URL query preserves the user-selected union filters');
    w.history.replaceState({}, '', '/bestiaire?q=slime'); d.dispatchEvent(new w.CustomEvent('nameless:routechange'));
    check(d.getElementById('bes-search').value === 'slime' && d.querySelectorAll('.creature-card').length === 1, 'Returning to a search URL restores its exact query and composes with existing filters');
    close(s);
}

{
    const s = surface(390, '?creature=53'), { d, w } = s;
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } } });
    d.querySelector('.catalogue-share').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const field = d.querySelector('.catalogue-share-url');
    check(field && field.readOnly && field.value === 'https://nameless-sao.fr/bestiaire?creature=53' && d.activeElement === field, 'Clipboard refusal exposes and selects the exact share URL');
    // With the tab bar outside the tab order, this real fallback field is the
    // final focusable control and must remain part of the sheet focus loop.
    d.querySelectorAll('[role="tab"]').forEach(tab => { tab.tabIndex = -1; });
    const closeButton = d.querySelector('.modal-close'); closeButton.focus();
    const reverse = key(s, closeButton, 'Tab', { shiftKey: true });
    check(reverse.defaultPrevented && d.activeElement === field, 'Reverse Tab from the sheet close button reaches a focusable share input');
    const forward = key(s, field, 'Tab');
    check(forward.defaultPrevented && d.activeElement === closeButton, 'Forward Tab from the share input wraps to the first sheet control');
    close(s);
}

console.log('Phase 3 bestiary regressions: ' + checks + ' checks passed for union filters, compact details, accessible tooltips and mobile drawer lifecycles.');
