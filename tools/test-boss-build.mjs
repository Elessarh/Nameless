import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { bossSlug, buildBossPages } from './build-boss-pages.mjs';
import { createSearchIndex } from './build-search-index.mjs';
import { creatureCategory, LEGACY_BOSS_ROUTES } from './creature-taxonomy.mjs';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'nameless-boss-build-'));
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
try {
    check(bossSlug('Léviathan') === 'leviathan' && bossSlug('Soul Knight') === 'soul-knight', 'Stable accent-insensitive boss slugs');
    const pages = buildBossPages({ root, output });
    check(pages.length === 14 && new Set(pages.map(page => page.path)).size === pages.length, 'Only the user-confirmed 14 boss-family entries get canonical static pages');
    assert.deepEqual(pages.filter(page => page.category === 'boss').map(page => page.id).sort((a, b) => a - b), [19, 21, 58, 60], 'The four confirmed bosses are exact');
    assert.deepEqual(pages.filter(page => page.category === 'miniboss').map(page => page.id).sort((a, b) => a - b), [11, 15, 17, 41, 43, 44, 46, 47, 56], 'The nine confirmed mini-bosses include Gardien Déchu, not Guerrier Déchu');
    assert.deepEqual(pages.filter(page => page.category === 'floor-boss').map(page => page.id), [53], 'Illfang is the sole floor boss');
    for (const page of pages) {
        const html = fs.readFileSync(path.join(output, page.path, 'index.html'), 'utf8');
        const dom = new JSDOM(html), d = dom.window.document;
        check(d.querySelector('h1').textContent === page.title, 'Boss name is present in static page content');
        check(d.querySelector('main').classList.contains('boss-detail-page') && d.querySelectorAll('h1').length === 1
            && d.querySelector('.boss-fact').getAttribute('aria-labelledby') === d.querySelector('h1').id,
        'Static facts use their dedicated page surface and one named reading article');
        const stylesheets = Array.from(d.querySelectorAll('link[rel="stylesheet"]'));
        const detailStylesheet = stylesheets.at(-1)?.getAttribute('href');
        check(detailStylesheet?.startsWith('/css/components/boss-detail.css?v=')
            && fs.existsSync(path.join(root, detailStylesheet.split('?')[0])) && !d.querySelector('style'),
        'Static facts load an existing dedicated stylesheet after the shared shell without injected dialog overrides');
        assert.deepEqual(Array.from(d.querySelectorAll('.boss-fact > section > h2')).map(node => node.textContent),
            ['Description', 'Butin possible', 'Poursuivre la lecture'], 'Facts preserve their readable content section headings');
        checks++;
        check(d.title.includes(page.title) && d.querySelector('meta[name="description"]').content.includes(page.title), 'Entity-specific title and description');
        const label = creatureCategory(page.category).label;
        check(d.title.includes(' — ' + label + ' · Palier ') && d.querySelector('.modal-badges .creature-chip').textContent === label, 'Static title and badge use the true boss family');
        check(d.querySelector('.bes-subtitle').textContent.startsWith(label + ' · Palier '), 'Page hero distinguishes mini-boss, boss and floor boss');
        check(!d.title.includes('Boss du palier'), 'Ordinary bosses are not advertised as floor bosses');
        check(d.querySelector('link[rel="canonical"]').href === 'https://nameless-sao.fr' + page.path, 'Boss canonical URL is stable');
        const image = d.querySelector('meta[property="og:image"]').content;
        check(image.startsWith('https://nameless-sao.fr/assets/') && fs.existsSync(path.join(root, decodeURIComponent(new URL(image).pathname))), 'Social image references an existing project asset');
        check(d.querySelector('meta[property="og:title"]').content.includes(page.title), 'Discord title identifies this boss');
        check(!d.querySelector('#creatures-grid') && !d.querySelector('script[src*="bestiaire.js"]'), 'Boss facts remain accessible without booting the catalogue');
        check(!Array.from(d.querySelectorAll('script:not([src])')).some(script => script.type !== 'application/ld+json'), 'No inline executable scripts are generated');
        check(Array.from(d.querySelectorAll('[src],[href]')).every(node => {
            const value = node.getAttribute('src') || node.getAttribute('href');
            return value.startsWith('/') || value.startsWith('#') || /^https?:\/\//.test(value);
        }), 'Assets and links survive deeply nested route URLs');
        const data = JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);
        check(data['@type'] === 'BreadcrumbList' && data.itemListElement[2].name === page.title, 'Readable breadcrumb structured data');
        check(!/service_role|SUPABASE_SERVICE_ROLE_KEY|DISCORD_CLIENT_SECRET|SESSION_SECRET/.test(html), 'Generated pages contain no privileged credential material');
        if (page.title === 'Illfang') {
            check(d.body.textContent.includes('Donjon Kobold') && !d.body.textContent.includes('600'), 'Illfang keeps its documented zone and omits unverified combat values');
            const map = d.querySelector('a[href^="/carte?"]');
            check(map && new URL(map.getAttribute('href'), 'https://nameless-sao.fr').searchParams.get('floor') === '1', 'Confirmed boss zone links to the correct map floor');
            check(d.body.textContent.includes('Aucun butin connu.'), 'Unknown boss loot stays explicitly unknown');
        }
        if (page.title === 'Léviathan') check(!d.querySelector('a[href="/items?item=coeur_nautherion"]')
            && d.querySelector('a[href="/items?q=Coeur%20de%20Nautherion"]'), 'An old drop absent from the current official catalogue remains a name search rather than a fabricated identity');
        check(!/Points de vie|\b(?:PV|HP)\b/.test(html), 'Unverified combat labels and metadata are absent from generated boss pages');
        dom.window.close();
    }
    const index = createSearchIndex().entries.filter(entry => ['boss', 'creature'].includes(entry.kind));
    check(index.length === 60 && index.filter(entry => entry.kind === 'boss').length === 14, 'Search keeps all 60 identities and only the 14 confirmed boss-family entries');
    for (const entry of index) {
        const label = creatureCategory(entry.category);
        check(entry.categoryLabel === label.label && entry.categoryLabelEn === label.labelEn, 'Search exposes exact bilingual creature categories');
        check(entry.summary.startsWith(label.label + ' · ') && entry.summaryEn.startsWith(label.labelEn + ' · '), 'Search summaries identify the actual classification in both languages');
        if (entry.category === 'creature') check(entry.kind === 'creature' && entry.url === '/bestiaire?creature=' + entry.id, 'Every normal monster links to its bestiary identity');
    }
    const nazgul = index.find(entry => entry.id === '58');
    check(nazgul.title === 'Nazgul' && nazgul.titleEn === 'Nazgul' && nazgul.url === '/boss/nazgul', 'Renamed boss uses Nazgul in both public languages and its canonical URL');
    check(nazgul.keywords.includes('Soul Knight'), 'An old name search can still find the renamed identity');
    for (const [id, slug] of LEGACY_BOSS_ROUTES) {
        const entry = index.find(record => record.id === String(id));
        const dom = new JSDOM(fs.readFileSync(path.join(output, 'boss', slug, 'index.html'), 'utf8'));
        const d = dom.window.document;
        check(d.querySelector('meta[name="robots"]').content.includes('noindex'), 'Compatibility URLs do not duplicate public indexing');
        check(d.querySelector('meta[http-equiv="refresh"]').content === '0;url=' + entry.url && d.querySelector('a').getAttribute('href') === entry.url, 'Old URL automatically opens the current identity and offers a working link');
        check(d.querySelector('link[rel="canonical"]').href === 'https://nameless-sao.fr' + entry.url && d.querySelector('h1').textContent === entry.title, 'Alias metadata uses the current name and destination');
        check(!d.querySelector('script') && !pages.some(page => page.path === '/boss/' + slug), 'Lightweight aliases add neither executable redirects nor sitemap pages');
        if (entry.category === 'creature') check(d.title.includes(' — Monstre | ') && !d.body.textContent.includes('Boss'), 'Demoted entries have no misleading boss label');
        dom.window.close();
    }
    console.log(`Boss page build: ${pages.length} generated pages, ${checks} checks passed.`);
} finally {
    // Remove only this uniquely-created test directory, never the supplied source or deployment output.
    if (path.dirname(output) !== os.tmpdir() || !path.basename(output).startsWith('nameless-boss-build-')) throw new Error('Unexpected temporary test directory');
    fs.rmSync(output, { recursive: true, force: true });
}
