import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {bossSlug} from './build-boss-pages.mjs';
import {createMapGraph} from './build-map-graph.mjs';
const require = createRequire(import.meta.url);
const {JSDOM} = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

// Extract only a named literal array, without booting a page or Leaflet.
function literalArray(source, name) {
    const start = source.indexOf('[', source.indexOf('const ' + name + ' ='));
    if (start < 0) throw new Error('Missing data array: ' + name);
    let depth = 0, quote = '', escaped = false;
    for (let i = start; i < source.length; i++) {
        const char = source[i];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = '';
        } else if (char === '"' || char === "'" || char === '`') quote = char;
        else if (char === '[') depth++;
        else if (char === ']' && --depth === 0) return vm.runInNewContext(source.slice(start, i + 1));
    }
    throw new Error('Unclosed data array: ' + name);
}

export function createSearchIndex({mapGraph = createMapGraph({root})} = {}) {
    const mapSource = JSON.parse(read('data/map-source.json'));
    const mapEntries = new Map(mapGraph.catalog.index.map(entry => [entry.key, entry]));
    const mapEntities = Object.assign({}, ...Object.values(mapGraph.floors).map(floor => floor.entities));
    const mapMetadata = key => {
        const entry = mapEntries.get(key);
        return entry ? {mapUrl: entry.mapUrl, positionKnown: Boolean(entry.positionRef)} : {};
    };
    const translations = {window: {}};
    for (const file of ['i18n-en.js', 'i18n-en-reviewed.js', 'i18n-quests-en-reviewed.js', 'i18n-game-en-reviewed.js']) {
        vm.runInNewContext(read('js/' + file), translations);
    }
    const en = translations.window.NamelessTranslations.en;
    const entries = [];
    const add = entry => entries.push({...entry, titleEn: en[entry.title] || entry.title, summaryEn: en[entry.summary] || entry.summary});
    const creatures = literalArray(read('js/bestiaire.js'), 'creaturesData');
    creatures.forEach(c => add({kind: c.category === 'boss' ? 'boss' : 'creature', id: String(c.id), title: c.name,
        url: c.category === 'boss' ? '/boss/' + bossSlug(c.name) : '/bestiaire?creature=' + c.id, summary: c.location + ' · Palier ' + c.palier, location: c.location, ...mapMetadata('creature:' + c.id), keywords: c.type + ' ' + c.description + ' ' + c.drops.map(d => d.name).join(' ')}));
    const sandbox = {};
    vm.runInNewContext(read('js/items-catalog-hdv.js') + ';this.catalog = itemsCatalog;', sandbox);
    for (const group of Object.values(sandbox.catalog)) {
        for (const item of group.items) {
            const graphItem = mapEntities['item:' + item.id];
            const sources = creatures.filter(c => graphItem?.creatureKeys.includes('creature:' + c.id))
                .map(c => ({title: c.name, url: '/bestiaire?creature=' + c.id, floor: c.palier, location: c.location,
                    ...(mapEntries.get('creature:' + c.id)?.positionRef ? {mapUrl: mapEntries.get('creature:' + c.id).mapUrl} : {})}));
            add({kind: 'item', id: item.id, title: item.name, url: '/items?item=' + encodeURIComponent(item.id),
                summary: clean(group.name).replace(/^\S+\s+/, ''), keywords: item.rarity + ' ' + sources.map(s => s.title).join(' '), sources,
                dropNames: [...new Set((graphItem?.sources || []).filter(source => source.creatureKey).map(source => source.name))]});
        }
    }
    const quests = new JSDOM(read('pages/quetes.html')).window.document;
    quests.querySelectorAll('.quest-step').forEach(step => {
        if (!step.id) throw new Error('Quest is missing a permanent ID');
        const section = step.closest('.quest-section');
        add({kind: 'quest', id: step.id, title: clean(step.querySelector('h4')?.textContent), url: '/quetes?quest=' + encodeURIComponent(step.id),
            summary: 'Palier ' + section.dataset.tier + ' · ' + section.dataset.category, ...mapMetadata('guide:' + step.id), keywords: clean(step.textContent).slice(0, 450)});
    });
    const wiki = new JSDOM(read('pages/wiki.html')).window.document;
    wiki.querySelectorAll('.wiki-page').forEach(article => {
        const title = clean(article.querySelector('h1')?.textContent);
        const id = article.id.replace(/^page-/, '');
        add({kind: 'wiki', id, title, url: '/wiki#' + id, summary: clean(article.querySelector('p')?.textContent).slice(0, 160),
            keywords: clean(Array.from(article.querySelectorAll('h2,h3')).map(h => h.textContent).join(' '))});
    });
    for (const [name, kind] of [['villesData', 'location'], ['donjonsData', 'location'], ['marchandsData', 'npc'], ['monstresData', 'location']]) {
        mapSource[name].forEach((point, i) => add({kind, id: name + '-' + i, title: point.name,
            summary: 'Carte · Palier 1', keywords: point.description || '', ...mapMetadata('location:1:' + point.id), url: mapEntries.get('location:1:' + point.id).mapUrl}));
    }
    const npcKeys = new Set();
    for (const [name, floor] of [['questData', 1], ['questDataFloor2', 2]]) {
        mapSource[name].forEach(point => {
            if (!point.npc) return;
            const key = floor + '-' + normalize(point.npc);
            if (npcKeys.has(key)) return;
            npcKeys.add(key);
            const target = mapGraph.catalog.index.find(entry => entry.kind === 'npc' && entry.floor === floor && normalize(entry.title) === normalize(point.npc));
            add({kind: 'npc', id: key, title: point.npc, summary: 'Carte · Palier ' + floor, keywords: point.name,
                ...(target ? mapMetadata(target.key) : {}), url: target?.mapUrl || '/carte?floor=' + floor + '&q=' + encodeURIComponent(point.npc)});
        });
    }
    const seen = new Set();
    for (const entry of entries) {
        const key = entry.kind + ':' + entry.id;
        if (seen.has(key)) throw new Error('Duplicate search entry: ' + key);
        seen.add(key);
    }
    return {version: 1, entries};
}

if (process.argv[1] === import.meta.filename) {
    const output = path.join(root, 'assets/search-index.json');
    const index = createSearchIndex();
    fs.writeFileSync(output, JSON.stringify(index));
    console.log('Search index: ' + index.entries.length + ' entries, ' + fs.statSync(output).size + ' bytes.');
}
