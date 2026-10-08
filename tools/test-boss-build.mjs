import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { bossSlug, buildBossPages } from './build-boss-pages.mjs';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'nameless-boss-build-'));
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
try {
    check(bossSlug('Léviathan') === 'leviathan' && bossSlug('Soul Knight') === 'soul-knight', 'Stable accent-insensitive boss slugs');
    const pages = buildBossPages({ root, output });
    check(pages.length === 18 && new Set(pages.map(page => page.path)).size === pages.length, 'Every confirmed boss gets a unique generated page');
    for (const page of pages) {
        const html = fs.readFileSync(path.join(output, page.path, 'index.html'), 'utf8');
        const dom = new JSDOM(html), d = dom.window.document;
        check(d.querySelector('h1').textContent === page.title, 'Boss name is present in static page content');
        check(d.title.includes(page.title) && d.querySelector('meta[name="description"]').content.includes(page.title), 'Entity-specific title and description');
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
        if (page.title === 'Léviathan') check(d.querySelector('a[href="/items?item=coeur_nautherion"]'), 'Confirmed loot links directly to its existing item ID');
        check(!/Points de vie|\b(?:PV|HP)\b/.test(html), 'Unverified combat labels and metadata are absent from generated boss pages');
        dom.window.close();
    }
    console.log(`Boss page build: ${pages.length} generated pages, ${checks} checks passed.`);
} finally {
    // Remove only this uniquely-created test directory, never the supplied source or deployment output.
    if (path.dirname(output) !== os.tmpdir() || !path.basename(output).startsWith('nameless-boss-build-')) throw new Error('Unexpected temporary test directory');
    fs.rmSync(output, { recursive: true, force: true });
}
