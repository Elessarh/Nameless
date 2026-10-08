import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import {createMapGraph} from './build-map-graph.mjs';
import {projectCreature} from './public-content-policy.mjs';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const origin = 'https://nameless-sao.fr';

export function bossSlug(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Read only the named data literal. Never execute a page module, its lifecycle, or external code.
function readLiteral(source, name) {
    const declaration = new RegExp('\\b(?:const|let|var)\\s+' + name + '\\s*=\\s*').exec(source);
    if (!declaration) throw new Error('Missing catalogue data: ' + name);
    const start = declaration.index + declaration[0].length;
    if (!['[', '{'].includes(source[start])) throw new Error('Expected catalogue literal: ' + name);
    const stack = [];
    let quote = '', escaped = false, lineComment = false, blockComment = false;
    for (let i = start; i < source.length; i++) {
        const char = source[i], next = source[i + 1];
        if (lineComment) { if (char === '\n') lineComment = false; continue; }
        if (blockComment) { if (char === '*' && next === '/') { blockComment = false; i++; } continue; }
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = '';
            continue;
        }
        if (char === '/' && next === '/') { lineComment = true; i++; continue; }
        if (char === '/' && next === '*') { blockComment = true; i++; continue; }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === '`') throw new Error('Template expressions are not catalogue literals: ' + name);
        if (char === '[' || char === '{') stack.push(char);
        if (char === ']' || char === '}') {
            const open = stack.pop();
            if ((char === ']' && open !== '[') || (char === '}' && open !== '{')) throw new Error('Invalid catalogue literal: ' + name);
            if (!stack.length) {
                const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
                return vm.runInContext('(' + source.slice(start, i + 1) + ')', context, { timeout: 1000 });
            }
        }
    }
    throw new Error('Unclosed catalogue literal: ' + name);
}

function assetPath(root, source, fallback = '/assets/brand/nameless-logo.png') {
    const url = new URL(source, origin + '/pages/bestiaire.html');
    if (url.origin !== origin || !url.pathname.startsWith('/assets/')) return fallback;
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return fallback; }
    const filename = path.resolve(root, '.' + pathname);
    const assets = path.resolve(root, 'assets');
    if (!filename.startsWith(assets + path.sep) || !fs.existsSync(filename)) return fallback;
    return url.pathname;
}

function pngSize(root, image) {
    const filename = path.join(root, decodeURIComponent(image));
    if (!fs.existsSync(filename)) return null;
    const buffer = fs.readFileSync(filename);
    if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    return null;
}

export function buildBossPages({ root, output, mapGraph }) {
    root = path.resolve(root); output = path.resolve(output);
    const read = file => fs.readFileSync(path.join(root, file), 'utf8');
    const creatures = readLiteral(read('js/bestiaire.js'), 'creaturesData').map(projectCreature);
    const catalog = readLiteral(read('js/items-catalog-hdv.js'), 'itemsCatalog');
    const items = Object.values(catalog).flatMap(group => group.items);
    mapGraph ||= createMapGraph({root});
    const template = read('pages/bestiaire.html').replace(/^\uFEFF/, '');
    const used = new Set();
    const generated = [];
    for (const boss of creatures.filter(creature => creature.category === 'boss')) {
        const slug = bossSlug(boss.name);
        if (!slug || used.has(slug)) throw new Error('Boss URL collision: ' + boss.name);
        used.add(slug);
        const route = '/boss/' + slug;
        const canonical = origin + route;
        const title = boss.name + ' — Boss du palier ' + boss.palier + ' | Nameless';
        const description = (boss.name + ', boss du palier ' + boss.palier + " d'Aincrad : " + boss.location + '. ' + boss.description).slice(0, 160);
        const image = assetPath(root, boss.image);
        const imageSize = pngSize(root, image);
        const dom = new JSDOM(template, { url: origin + '/pages/bestiaire.html' });
        const doc = dom.window.document;
        const element = (tag, className, text) => {
            const node = doc.createElement(tag);
            if (className) node.className = className;
            if (text !== undefined) node.textContent = String(text);
            return node;
        };
        const link = (href, text, className) => {
            const node = element('a', className, text); node.setAttribute('href', href); return node;
        };
        const meta = (name, content, property = false) => {
            const attribute = property ? 'property' : 'name';
            let node = doc.head.querySelector('meta[' + attribute + '="' + name + '"]');
            if (!node) { node = doc.createElement('meta'); node.setAttribute(attribute, name); doc.head.appendChild(node); }
            node.setAttribute('content', String(content));
        };
        doc.title = title;
        doc.head.querySelector('link[rel="canonical"]').setAttribute('href', canonical);
        meta('description', description);
        meta('keywords', [boss.name, 'boss', 'Aincrad', boss.location, 'palier ' + boss.palier, 'Nameless', 'Minecraft'].join(', '));
        for (const name of ['og:title', 'twitter:title']) meta(name, title, name.startsWith('og:'));
        for (const name of ['og:description', 'twitter:description']) meta(name, description, name.startsWith('og:'));
        meta('og:url', canonical, true); meta('og:type', 'article', true);
        meta('og:image', origin + image, true); meta('og:image:alt', boss.name, true);
        meta('twitter:image', origin + image);
        doc.head.querySelectorAll('meta[property="og:image:width"],meta[property="og:image:height"]').forEach(node => node.remove());
        if (imageSize) { meta('og:image:width', imageSize.width, true); meta('og:image:height', imageSize.height, true); }

        const main = doc.querySelector('main'); main.replaceChildren();
        const breadcrumb = element('nav', 'boss-breadcrumb'); breadcrumb.setAttribute('aria-label', "Fil d'Ariane");
        breadcrumb.append(link('/', 'Nameless'), doc.createTextNode(' › '), link('/bestiaire', 'Bestiaire'), doc.createTextNode(' › '));
        const current = element('span', '', boss.name); current.setAttribute('aria-current', 'page'); breadcrumb.appendChild(current);
        main.appendChild(breadcrumb);
        const hero = element('header', 'bes-hero');
        hero.append(element('span', 'nm-eyebrow', 'Codex des boss'), element('h1', '', boss.name), element('p', 'bes-subtitle', 'Boss du palier ' + boss.palier + " d'Aincrad"));
        main.appendChild(hero);
        const article = element('article', 'modal-content boss-fact');
        const header = element('div', 'modal-header');
        const media = element('div', 'modal-media');
        const portrait = element('img'); portrait.src = image; portrait.alt = boss.name; portrait.decoding = 'async';
        if (imageSize) { portrait.width = imageSize.width; portrait.height = imageSize.height; }
        media.appendChild(portrait); header.appendChild(media);
        const info = element('div', 'modal-info');
        const badges = element('div', 'modal-badges');
        badges.append(element('span', 'creature-chip chip-boss', 'Boss'), element('span', 'creature-chip chip-type', boss.type), element('span', 'creature-chip chip-palier', 'Palier ' + boss.palier));
        info.appendChild(badges);
        const stats = element('dl', 'modal-stats');
        for (const [label, value] of [['Zone', boss.location]]) {
            const stat = element('div', 'modal-stat'); stat.append(element('dt', 'modal-stat-label', label), element('dd', 'modal-stat-value', value)); stats.appendChild(stat);
        }
        info.appendChild(stats);
        const mappedBoss = mapGraph.catalog.index.find(entry => entry.key === 'creature:' + boss.id);
        if (mappedBoss?.positionRef) {
            info.append(link(mappedBoss.mapUrl, 'Voir cette zone sur la carte', 'boss-related-link'));
            info.append(element('p', 'modal-desc', 'Repère de zone ; position exacte inconnue.'));
        }
        header.appendChild(info); article.appendChild(header);
        const section = (heading, content) => {
            const node = element('section', 'modal-section'); node.append(element('h2', 'modal-section-title', heading), content); article.appendChild(node);
        };
        section('Description', element('p', 'modal-desc', boss.description));
        if (boss.drops.length) {
            const grid = element('div', 'drops-grid');
            for (const drop of boss.drops) {
                const graphBoss = mapGraph.floors[boss.palier]?.entities['creature:' + boss.id];
                const itemKey = graphBoss?.drops.find(candidate => candidate.name === drop.name)?.itemKey;
                const item = items.find(candidate => itemKey === 'item:' + candidate.id);
                const target = item ? '/items?item=' + encodeURIComponent(item.id) : '/items?q=' + encodeURIComponent(drop.name);
                const row = link(target, undefined, 'drop-item');
                if (item) {
                    const icon = element('img', 'drop-icon'); icon.src = assetPath(root, '/assets/items/' + item.image); icon.alt = ''; icon.width = 40; icon.height = 40; icon.loading = 'lazy'; icon.decoding = 'async'; row.appendChild(icon);
                }
                const details = element('span', 'drop-info'); details.appendChild(element('span', 'drop-name', drop.name));
                if (typeof drop.rate === 'number' && Number.isFinite(drop.rate)) details.appendChild(element('span', 'drop-rate', drop.rate + '%'));
                row.appendChild(details); grid.appendChild(row);
            }
            section('Butin possible', grid);
        } else section('Butin possible', element('p', 'modal-desc', 'Aucun butin connu.'));
        const related = element('p', 'boss-related');
        related.append(link('/bestiaire?creature=' + boss.id, 'Ouvrir dans le bestiaire'), doc.createTextNode(' · '), link('/wiki#donjons', 'Guide des donjons'));
        section('Poursuivre la lecture', related); main.appendChild(article);

        const style = element('style');
        style.textContent = '.boss-breadcrumb{max-width:760px;margin:1rem auto;color:var(--nm-steel);font-size:.85rem}.boss-breadcrumb a,.boss-related a,.boss-related-link{color:var(--sao-cyan)}.boss-breadcrumb a,.boss-related a,.boss-related-link{display:inline-block;padding:.4rem 0}.boss-fact{max-height:none;overflow:visible;margin:1.5rem auto;background:none;border:0;box-shadow:none;padding:0}.boss-fact .modal-stat{background:none;border:0;border-bottom:1px solid var(--nm-hairline)}.boss-fact .modal-section{border-top:1px solid var(--nm-hairline);padding-top:1.25rem}.boss-fact dd{margin:0}.boss-fact a:focus-visible{outline:2px solid var(--sao-cyan);outline-offset:3px}.boss-related{color:var(--sao-text);line-height:1.7}.boss-fact .modal-info{min-width:0}';
        doc.head.appendChild(style);
        const structured = element('script'); structured.type = 'application/ld+json';
        structured.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Nameless', item: origin + '/' },
            { '@type': 'ListItem', position: 2, name: 'Bestiaire', item: origin + '/bestiaire' },
            { '@type': 'ListItem', position: 3, name: boss.name, item: canonical }
        ] }).replace(/</g, '\\u003c');
        doc.head.appendChild(structured);
        doc.querySelectorAll('script[src]').forEach(script => {
            if (/\/(?:bestiaire|app-router|page-registry)\.js(?:\?|$)/.test(script.getAttribute('src'))) script.remove();
        });
        doc.querySelector('.nav-link.active')?.setAttribute('aria-current', 'location');
        doc.querySelectorAll('[href],[src]').forEach(node => {
            for (const attribute of ['href', 'src']) {
                const value = node.getAttribute(attribute);
                if (!value || value.startsWith('#') || /^[a-z][\w+.-]*:/i.test(value) || value.startsWith('//')) continue;
                const absolute = new URL(value, dom.window.location.href);
                node.setAttribute(attribute, absolute.pathname + absolute.search + absolute.hash);
            }
        });
        const directory = path.join(output, 'boss', slug);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'index.html'), dom.serialize());
        dom.window.close();
        generated.push({ path: route, title: boss.name, id: boss.id });
    }
    return generated;
}
