import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createSearchIndex} from './build-search-index.mjs';

const require = createRequire(import.meta.url);
const {JSDOM} = require('jsdom');
const source = fs.readFileSync(new URL('../js/global-search.js', import.meta.url), 'utf8');
const publicIndex = createSearchIndex();
const floorBoss = publicIndex.entries.find(entry => entry.kind === 'boss' && entry.url === '/boss/illfang');
const nativeItem = publicIndex.entries.find(entry => entry.kind === 'item' && /^\/assets\/items\/official\/previews\/[a-f0-9]{64}\.svg$/.test(entry.image));
const picturedCreature = publicIndex.entries.find(entry => entry.kind === 'creature' && /\.(png|webp|jpg)$/.test(entry.image || ''));
assert.ok(floorBoss && nativeItem && picturedCreature, 'The feedback test uses current published entry identities and artwork');
const payload = {version:1, entries:[floorBoss, nativeItem, picturedCreature]};
const flush = async () => {for (let i = 0; i < 10; i++) await Promise.resolve();};

function harness(saved = []) {
    const dom = new JSDOM('<nav class="nav-container"><button id="hamburger">Menu</button></nav>', {url:'https://nameless-sao.fr/', runScripts:'outside-only'});
    const {window} = dom;
    let language = 'fr';
    const requests = [];
    const pendingExits = new Map();
    window.HTMLDialogElement.prototype.showModal = function () {this.open = true;};
    window.HTMLDialogElement.prototype.close = function () {this.open = false; this.dispatchEvent(new window.Event('close'));};
    window.NamelessI18n = {getLanguage: () => language};
    window.localStorage.setItem('nameless-public-favorites-v1', JSON.stringify(saved));
    window.fetch = (url, options) => new Promise((resolve, reject) => {requests.push({url, options, resolve, reject});});
    window.eval(source);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    const find = selector => window.document.querySelector(selector);
    return {
        window, dom, requests, find,
        get dialog() {return find('#nameless-global-search');},
        get input() {return find('#nm-global-query');},
        get list() {return find('.nm-search-results');},
        get status() {return find('.nm-search-status');},
        get mode() {return find('.nm-search-favorites');},
        setLanguage(value) {language = value; window.document.dispatchEvent(new window.Event('nameless:languagechange'));},
        query(value) {this.input.value = value; this.input.dispatchEvent(new window.Event('input'));},
        succeed(index, data = payload) {requests[index].resolve({ok:true, json:async () => data});},
        useExitMotion() {
            window.NamelessReferenceShell = {
                closePanel(panel, finish) {panel.dataset.referenceClosing = 'true'; pendingExits.set(panel, finish);},
                cancelPanelClose(panel) {panel.removeAttribute('data-reference-closing'); pendingExits.delete(panel);}
            };
        },
        finishExit() {pendingExits.get(this.dialog)?.();},
        get pendingExitCount() {return pendingExits.size;}
    };
}

const qa = harness(['boss:' + floorBoss.id]);
const firstOpen = qa.window.NamelessGlobalSearch.open();
const secondOpen = qa.window.NamelessGlobalSearch.open();
await flush();
assert.equal(qa.requests.length, 1, 'Repeated opens share the one pending index request');
assert.equal(qa.requests[0].options.credentials, 'omit', 'The public index never receives account credentials');
assert.equal(qa.list.getAttribute('aria-busy'), 'true');
assert.equal(qa.find('.nm-search-index-meta').textContent, 'Chargement de l’index…');
assert.equal(qa.find('.nm-search-favorite-count').textContent, '1', 'Stored favorites are not presented as erased while their index is unavailable');
qa.query('aucune correspondance');
qa.mode.click();
assert.equal(qa.mode.getAttribute('aria-pressed'), 'true');
assert.equal(qa.list.querySelectorAll('.nm-search-result[data-kind="action"]').length, 5, 'Unrelated input and favorites mode do not hide quick navigation during loading');
assert.equal(qa.find('.nm-search-empty'), null, 'Loading is not announced as an empty collection');
qa.setLanguage('en');
assert.equal(qa.find('.nm-search-index-meta').textContent, 'Loading the index…');
assert.match(qa.status.textContent, /^Loading the index/);
qa.requests[0].reject(new Error('offline'));
await Promise.all([firstOpen, secondOpen]);
assert.equal(qa.list.getAttribute('aria-busy'), 'false');
assert.equal(qa.find('.nm-search-index-meta').textContent, 'Index unavailable');
assert.equal(qa.find('.nm-search-retry').textContent, 'Retry');
assert.equal(qa.find('.nm-search-feedback strong').textContent, 'The codex is temporarily unavailable');
assert.match(qa.status.textContent, /^Index unavailable/);
assert.equal(qa.list.querySelectorAll('.nm-search-result[data-kind="action"]').length, 5);
assert.equal(qa.find('.nm-search-entry-link[href="/wiki"]').textContent.includes('Explore the wiki'), true);

qa.query('requête conservée');
qa.mode.click();
qa.mode.click();
qa.setLanguage('fr');
assert.equal(qa.requests.length, 1, 'Query, favorites and language renders do not silently refetch a failed index');
assert.equal(qa.find('.nm-search-feedback strong').textContent, 'Le codex est momentanément indisponible');
assert.equal(qa.find('.nm-search-index-meta').textContent, 'Index indisponible');
assert.equal(qa.find('.nm-search-retry').textContent, 'Réessayer');
assert.match(qa.status.textContent, /^Index indisponible/);
qa.find('.nm-search-retry').focus();
qa.setLanguage('en');
assert.equal(qa.window.document.activeElement, qa.find('.nm-search-retry'), 'Language changes retain native focus on the replacement retry button');

qa.find('.nm-search-close').click();
assert.equal(qa.dialog.open, false);
await qa.window.NamelessGlobalSearch.open();
assert.equal(qa.requests.length, 1, 'An explicit error persists across closing and reopening until retry is requested');
assert.equal(qa.input.value, 'requête conservée');
assert.equal(qa.mode.getAttribute('aria-pressed'), 'true');
const retry = qa.find('.nm-search-retry');
retry.focus(); retry.click(); retry.click();
await flush();
assert.equal(qa.requests.length, 2, 'Retry has one request even when its former control is activated twice');
assert.equal(qa.window.document.activeElement, qa.input, 'A disappearing retry control returns focus to the query');
assert.equal(qa.input.value, 'requête conservée');
assert.equal(qa.mode.getAttribute('aria-pressed'), 'true');
assert.equal(qa.find('.nm-search-retry'), null);
assert.equal(qa.list.getAttribute('aria-busy'), 'true');
assert.match(qa.status.textContent, /^Loading the index/);
qa.query('Illfang');
qa.succeed(1);
await flush();
assert.equal(qa.list.getAttribute('aria-busy'), 'false');
assert.equal(qa.find('.nm-search-feedback'), null, 'Successful retry removes the error state');
assert.equal(qa.find('.nm-search-index-meta').textContent, '3 indexed entries');
assert.equal(qa.list.querySelectorAll('.nm-search-result').length, 1);
assert.equal(qa.find('.nm-search-entry-link').getAttribute('href'), floorBoss.url, 'The latest query and favorites mode govern the completed retry');
assert.equal(qa.input.value, 'Illfang');
assert.equal(qa.find('.nm-search-favorite-count').textContent, '1');

qa.setLanguage('fr');
qa.query('aucun-favori-ne-correspond');
assert.equal(qa.find('.nm-search-empty strong').textContent, 'Aucun favori ne correspond');
assert.equal(qa.status.textContent, 'Aucun favori ne correspond à cette recherche.');
assert.equal(qa.find('.nm-search-clear').hidden, false, 'The original query clear control remains available');
assert.equal(qa.find('.nm-search-empty-action').textContent, 'Effacer la recherche');
qa.find('.nm-search-empty-action').focus();
qa.setLanguage('en');
assert.equal(qa.find('.nm-search-empty strong').textContent, 'No matching favorite');
assert.equal(qa.status.textContent, 'No saved entry matches this search.');
assert.equal(qa.find('.nm-search-empty-action').textContent, 'Clear search');
assert.equal(qa.window.document.activeElement, qa.find('.nm-search-empty-action'));
qa.find('.nm-search-empty-action').click();
assert.equal(qa.input.value, '');
assert.equal(qa.window.document.activeElement, qa.input);
assert.equal(qa.mode.getAttribute('aria-pressed'), 'true');
assert.equal(qa.list.querySelectorAll('.nm-search-result').length, 1, 'Clearing a favorites miss returns the saved entry without changing mode');
qa.find('.nm-search-star').click();
assert.equal(qa.find('.nm-search-empty strong').textContent, 'No favorites to show');
assert.match(qa.status.textContent, /^No favorites\./);
assert.equal(qa.find('.nm-search-empty-action'), null, 'A genuinely empty favorite collection does not promise results by clearing its query');
qa.setLanguage('fr');
assert.equal(qa.find('.nm-search-empty strong').textContent, 'Aucun favori à afficher');
assert.match(qa.status.textContent, /^Aucun favori\./);

qa.mode.click();
for (const entry of [nativeItem, picturedCreature]) {
    qa.query(entry.title);
    const row = Array.from(qa.list.querySelectorAll('.nm-search-result')).find(row => row.dataset.entityKey === entry.kind + ':' + entry.id);
    const link = row.querySelector('.nm-search-entry-link');
    const oldText = link.textContent;
    const thumbnail = link.querySelector('img');
    assert.ok(thumbnail, 'A verified native SVG or local raster image is initially used');
    assert.equal(thumbnail.alt, '');
    assert.equal(thumbnail.getAttribute('aria-hidden'), 'true');
    thumbnail.dispatchEvent(new qa.window.Event('error'));
    assert.equal(link.querySelector('img'), null, 'A failed image cannot remain a broken image');
    assert.equal(row.querySelector('.nm-search-entry-link'), link, 'Thumbnail failure does not replace the destination or its focusable link');
    assert.equal(link.getAttribute('href'), entry.url);
    assert.equal(link.textContent, oldText, 'Thumbnail failure preserves the indexed title and description');
    assert.equal(link.querySelectorAll('.nm-search-result-symbol').length, 1);
    assert.equal(link.querySelector('.nm-search-result-symbol').getAttribute('aria-hidden'), 'true');
    assert.equal(link.querySelector('.nm-search-result-symbol svg').getAttribute('aria-hidden'), 'true');
    thumbnail.dispatchEvent(new qa.window.Event('error'));
    assert.equal(link.querySelectorAll('.nm-search-result-symbol').length, 1, 'The error fallback is installed only once');
}
qa.dom.window.close();

// A request may finish after native close, during a staged exit, or after reopen.
for (const outcome of ['success', 'failure']) {
    const lifecycle = harness();
    const opened = lifecycle.window.NamelessGlobalSearch.open();
    await flush();
    lifecycle.query('Illfang');
    lifecycle.find('.nm-search-close').click();
    const closedMarkup = lifecycle.list.innerHTML;
    if (outcome === 'success') lifecycle.succeed(0);
    else lifecycle.requests[0].reject(new Error('offline'));
    await opened;
    assert.equal(lifecycle.dialog.open, false, 'Pending completion never reopens the dialog');
    assert.equal(lifecycle.list.innerHTML, closedMarkup, 'Pending completion never replaces the closed dialog contents');
    await lifecycle.window.NamelessGlobalSearch.open();
    assert.equal(lifecycle.requests.length, 1, 'Reopen uses the completed state rather than an obsolete open callback');
    assert.equal(lifecycle.input.value, 'Illfang');
    if (outcome === 'success') assert.equal(lifecycle.find('.nm-search-entry-link').getAttribute('href'), floorBoss.url);
    else assert.ok(lifecycle.find('.nm-search-retry'));
    lifecycle.dom.window.close();
}

const motion = harness();
motion.useExitMotion();
const motionOpen = motion.window.NamelessGlobalSearch.open();
await flush();
motion.query('Illfang');
motion.find('.nm-search-close').click();
assert.equal(motion.dialog.open, true, 'The modal remains open during its existing exit animation');
assert.equal(motion.pendingExitCount, 1);
const exitMarkup = motion.list.innerHTML;
motion.succeed(0);
await motionOpen;
assert.equal(motion.list.innerHTML, exitMarkup, 'Async index completion does not mutate an exiting panel');
await motion.window.NamelessGlobalSearch.open();
assert.equal(motion.pendingExitCount, 0, 'Reopen cancels the stale exit callback');
assert.equal(motion.dialog.hasAttribute('data-reference-closing'), false);
assert.equal(motion.requests.length, 1);
assert.equal(motion.find('.nm-search-entry-link').getAttribute('href'), floorBoss.url);
assert.equal(motion.window.document.activeElement, motion.input);
motion.dom.window.close();

const reopened = harness();
const oldOpen = reopened.window.NamelessGlobalSearch.open();
await flush();
reopened.find('.nm-search-close').click();
const newOpen = reopened.window.NamelessGlobalSearch.open();
reopened.query(nativeItem.title);
await flush();
assert.equal(reopened.requests.length, 1, 'Close/reopen while pending still shares the request');
reopened.succeed(0);
await Promise.all([oldOpen, newOpen]);
assert.equal(reopened.find('.nm-search-entry-link').getAttribute('href'), nativeItem.url, 'Only current query state appears after reopening a pending search');
reopened.dom.window.close();

const emptyIndex = harness();
const emptyOpen = emptyIndex.window.NamelessGlobalSearch.open();
await flush();
emptyIndex.succeed(0, {version:1, entries:[]});
await emptyOpen;
assert.equal(emptyIndex.find('.nm-search-index-meta').textContent, '0 fiches indexées', 'An empty valid index is distinct from a loading or failed index');
assert.equal(emptyIndex.list.getAttribute('aria-busy'), 'false');
emptyIndex.find('.nm-search-close').click();
await emptyIndex.window.NamelessGlobalSearch.open();
assert.equal(emptyIndex.requests.length, 1, 'A valid empty index remains cached');
emptyIndex.dom.window.close();

for (const response of [
    {ok:false, json:async () => payload},
    {ok:true, json:async () => ({version:2, entries:payload.entries})},
    {ok:true, json:async () => {throw new Error('Invalid JSON');}}
]) {
    const invalid = harness(['boss:' + floorBoss.id]);
    const invalidOpen = invalid.window.NamelessGlobalSearch.open();
    await flush();
    invalid.requests[0].resolve(response);
    await invalidOpen;
    assert.equal(invalid.list.getAttribute('aria-busy'), 'false');
    assert.equal(invalid.find('.nm-search-index-meta').textContent, 'Index indisponible', 'HTTP, schema and parsing failures all retain the explicit unavailable state');
    assert.ok(invalid.find('.nm-search-retry'));
    assert.equal(invalid.find('.nm-search-favorite-count').textContent, '1', 'An invalid response cannot prune saved identities');
    assert.equal(invalid.list.querySelectorAll('.nm-search-result[data-kind="action"]').length, 5);
    invalid.dom.window.close();
}

console.log('Search feedback tests passed: FR/EN loading/error/retry, current query and favorites, empty distinctions, native focus, broken thumbnails, single request and close/reopen/exit lifecycle.');
