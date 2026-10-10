import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createSearchIndex } from './build-search-index.mjs';

const source = fs.readFileSync(new URL('../pages/wiki.html', import.meta.url), 'utf8');
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const dom = new JSDOM(source, { url: 'https://nameless-sao.fr/wiki', runScripts: 'outside-only' });
const w = dom.window;
for (const file of ['i18n-en.js', 'i18n-en-reviewed.js', 'i18n-quests-en-reviewed.js', 'i18n-game-en-reviewed.js', 'i18n-information-en-reviewed.js', 'i18n.js']) {
    w.eval(fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'));
}
const index = createSearchIndex();
const entries = index.entries.filter(entry => entry.kind === 'wiki');
assert.equal(entries.length, 55, 'All real Wiki articles keep their public search entry');
const originals = new Map([...w.document.querySelectorAll('.wiki-page')].map(page => [page.id.replace(/^page-/, ''), clean(page.querySelector('p')?.textContent)]));
w.NamelessI18n.setLanguage('en');
for (const entry of entries) {
    const page = w.document.getElementById('page-' + entry.id);
    assert.equal(entry.url, '/wiki#' + entry.id);
    assert.equal(entry.summary, originals.get(entry.id).slice(0, 160));
    assert.equal(entry.summaryEn, clean(page.querySelector('p')?.textContent).slice(0, 160), entry.id + ': translate inline source text before clipping its search summary');
}
const rules = entries.find(entry => entry.id === 'reglement-aincrad');
assert.notEqual(rules.summaryEn, rules.summary, 'A long rules paragraph no longer falls back to French in English search');
assert.match(rules.summaryEn, /insults/i);
w.NamelessI18n.setLanguage('fr');
for (const [id, original] of originals) assert.equal(clean(w.document.getElementById('page-' + id).querySelector('p')?.textContent), original);
dom.window.close();
console.log('Wiki search language passed: 55 native links, translated inline summaries before truncation and exact French restoration.');
