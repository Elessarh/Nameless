#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let checks = 0;
const check = (actual, message) => { assert.ok(actual, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

async function surface(kind, query = '') {
    const items = kind === 'items', prefix = items ? 'it' : 'bes';
    const dom = new JSDOM(read('pages/' + (items ? 'items' : 'bestiaire') + '.html'), {
        url: 'https://nameless-sao.fr/' + (items ? 'items' : 'bestiaire') + query,
        runScripts: 'outside-only', pretendToBeVisual: true
    });
    const w = dom.window, d = w.document;
    Object.defineProperty(w, 'innerWidth', { value: 1440, writable: true });
    w.NamelessSpaRouter = { controlsLifecycle: true };
    w.matchMedia = () => ({ matches: true });
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    const source = read('js/' + (items ? 'items' : 'bestiaire') + '.js');
    if (items) {
        w.eval(read('js/items-catalog-official.js') + '\n' + source + '\nwindow.__chipRecords = Object.values(itemsCatalog).flatMap(group => group.items.map(item => ({...item, category: group.name})));');
        w.NamelessGlobalSearch = { getIndex: async () => [{ kind: 'item', id: w.__chipRecords[0].id,
            sources: [{title: 'Source vérifiée', url: '/bestiaire?creature=1'}] }] };
    } else w.eval(source + '\nwindow.__chipRecords = creaturesData;');
    const api = items ? w.NamelessItemsPage : w.NamelessBestiaryPage;
    api.init(d);
    await new Promise(resolve => setTimeout(resolve, 0));
    return {
        kind, prefix, w, d, api, data: JSON.parse(JSON.stringify(w.__chipRecords)),
        chips: () => [...d.querySelectorAll('#' + prefix + '-active-filters [data-clear-filter]')],
        close() { api.destroy(); dom.window.close(); }
    };
}

function setSearch(s, value) {
    const search = s.d.getElementById(s.prefix + '-search');
    search.value = value; search.dispatchEvent(new s.w.Event('input', {bubbles: true}));
}

function choose(s, field, value) {
    const choice = [...s.d.querySelectorAll('[data-filter-field="' + field + '"]')].find(input => input.value === value);
    assert.ok(choice, 'Fixture choice exists: ' + field + '=' + value);
    choice.click();
}

function chipIdentity(button) {
    return [button.dataset.clearFilter, button.dataset.filterValue ?? button.dataset.clearValue ?? null];
}

function selectFourChips(s) {
    if (s.kind === 'items') {
        [...new Set(s.data.map(item => item.category))].slice(0, 3).forEach(value => choose(s, 'it-category', value));
    } else {
        choose(s, 'bes-palier', '1');
        choose(s, 'bes-category', 'boss');
        choose(s, 'bes-category', 'miniboss');
    }
    setSearch(s, 'slime');
    equal(s.chips().length, 4, s.kind + ': fixture has four independently removable filters');
}

for (const kind of ['items', 'bestiary']) {
    for (const index of [0, 1, 3]) {
        const s = await surface(kind);
        selectFourChips(s);
        const before = s.chips(), removed = before[index];
        const expected = before.filter(button => button !== removed).map(chipIdentity);
        removed.focus();
        // JSDOM does not synthesize native button activation from Enter/Space.
        // Invoke that native click with the keyboard-owned focus left in place.
        removed.click();
        equal(s.chips().map(chipIdentity), expected, kind + ': removing chip ' + index + ' keeps all other selections');
        check(!removed.isConnected && s.d.activeElement === s.chips()[Math.min(index, expected.length - 1)],
            kind + ': keyboard activation at index ' + index + ' focuses the nearest surviving chip after the real DOM rebuild');
        s.close();
    }

    const s = await surface(kind), search = s.d.getElementById(s.prefix + '-search');
    setSearch(s, 'slime');
    const finalChip = s.chips()[0]; finalChip.focus(); finalChip.click();
    check(!s.chips().length && s.d.activeElement === search, kind + ': the final keyboard-removed chip returns focus to the main search');
    selectFourChips(s);
    search.focus();
    s.chips()[1].dispatchEvent(new s.w.MouseEvent('click', {bubbles: true}));
    check(s.d.activeElement === search && s.chips().length === 3, kind + ': removing an unfocused chip never steals focus from the search field');
    s.close();
}

for (const kind of ['items', 'bestiary']) {
    const params = new URLSearchParams([
        ['q', 'slime'], ['q', 'obsolete query'], ['floor', '1'], ['lang', 'en'],
        ['entity', 'location:1:marecage-putride'], ['extra', 'one'], ['extra', 'two'],
        // These values are only URL filters on items. Bestiary must preserve them.
        ['category', 'unmapped'], ['rarity', 'unmapped'], ['source', 'unmapped']
    ]);
    const s = await surface(kind, '?' + params + '#catalogue'), {w, d} = s;
    const selectionKey = kind === 'items' ? 'item' : 'creature';
    const url = new w.URL(w.location.href); url.searchParams.set(selectionKey, String(s.data[0].id));
    const state = { route: kind, scroll: { x: 17, y: 240 }, token: 'keep-router-state' };
    w.history.replaceState(state, '', url.href);
    const expected = new w.URL(w.location.href); expected.searchParams.delete('q');
    s.chips()[0].focus(); s.chips()[0].click();
    equal(w.location.href, expected.href, kind + ': search chip removes every stale q while preserving selection, unrelated/repeated parameters and fragment');
    equal(w.history.state, state, kind + ': clearing a URL query preserves the current router history state');
    d.dispatchEvent(new w.CustomEvent('nameless:routechange'));
    check(d.getElementById(s.prefix + '-search').value === '' && !s.chips().some(button => button.dataset.clearFilter === s.prefix + '-search'),
        kind + ': same-route history reconciliation cannot resurrect a removed query');
    s.api.init(d);
    await new Promise(resolve => setTimeout(resolve, 0));
    check(d.getElementById(s.prefix + '-search').value === '' && !s.chips().some(button => button.dataset.clearFilter === s.prefix + '-search'),
        kind + ': reinitializing the actual page controller keeps the deep-link search cleared');
    const resetUrl = new w.URL(w.location.href);
    (kind === 'items' ? ['q', 'category', 'rarity', 'source'] : ['q']).forEach(name => resetUrl.searchParams.delete(name));
    d.getElementById(s.prefix + '-reset').click();
    equal(w.location.href, resetUrl.href, kind + ': full reset retains selection, unrelated URL values and fragment');
    equal(w.history.state, state, kind + ': full reset retains the existing router history state');
    check(!s.chips().length && d.getElementById(s.prefix + '-search').value === '', kind + ': full reset still clears every active filter');
    s.close();
}

{
    const baseline = await surface('items');
    const categories = [...new Set(baseline.data.map(item => item.category))].slice(0, 2);
    const rarities = [...new Set(baseline.data.map(item => item.rarity))].slice(0, 2);
    const firstItem = baseline.data[0].id;
    baseline.close();
    for (const [name, values] of [['category', categories], ['rarity', rarities], ['source', ['known', 'unknown']]]) {
        const params = new URLSearchParams([
            ['q', 'slime'], ['category', categories[0]], ['rarity', rarities[0]], ['source', 'known'],
            ['item', firstItem], ['entity', 'location:1:marecage-putride'], ['floor', '1'], ['lang', 'en'],
            ['extra', 'one'], ['extra', 'two']
        ]);
        params.delete(name); values.concat(values[0]).forEach(value => params.append(name, value));
        const s = await surface('items', '?' + params + '#inventory'), {w, d} = s;
        const state = { route: 'items', previous: { id: 'unchanged' } };
        w.history.replaceState(state, '', w.location.href);
        const removed = s.chips().find(button => button.dataset.clearFilter === 'it-' + name && button.dataset.filterValue === values[0]);
        check(removed, 'items: real repeated ' + name + ' URL creates its matching chip');
        const expected = new w.URL(w.location.href); expected.searchParams.delete(name, values[0]);
        removed.focus(); removed.click();
        equal(w.location.href, expected.href, 'items: removing ' + name + ' clears only matching repeated values and preserves the remaining URL exactly');
        equal(w.history.state, state, 'items: ' + name + ' chip preserves nested router history state');
        equal(new w.URL(w.location.href).searchParams.getAll(name), [values[1]], 'items: the other repeated ' + name + ' value remains shareable');
        d.dispatchEvent(new w.CustomEvent('nameless:routechange'));
        equal(s.chips().filter(button => button.dataset.clearFilter === 'it-' + name).map(button => button.dataset.filterValue), [values[1]],
            'items: route reconciliation does not resurrect the removed ' + name + ' filter');
        s.api.init(d); await new Promise(resolve => setTimeout(resolve, 0));
        equal(s.chips().filter(button => button.dataset.clearFilter === 'it-' + name).map(button => button.dataset.filterValue), [values[1]],
            'items: reinitialization keeps only the surviving repeated ' + name + ' filter');
        s.close();
    }
}

console.log('Catalogue filter chips: ' + checks + ' checks passed for focus restoration and persistent URL removal.');
