#!/usr/bin/env node
// Build-time compiler. Page scripts, Leaflet and browser caches are never started here.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const defaultRoot = path.resolve(import.meta.dirname, '..');
const origin = 'https://nameless-sao.fr';
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = value => normalize(value).replace(/ /g, '-');
const unique = values => [...new Set(values.filter(Boolean))];
const aliases = [
    ['Zone Sanglier', 'Zone des Sangliers'],
    ['Bois Sacrée', 'Bois Sacré'],
    ["Archipel d'Ika", 'Archipel Ika'],
    ['Montagnes des Bandits', 'Montagne des bandits'],
    ['Donjon de Geldorak', 'Donjon Geldorak'],
    ['Donjon Le Labyrinthe', 'Donjon Labyrinthe']
];
const cityAliases = [['Valhat', 'Valhatt']];
const forbiddenAliases = [
    ['Champ de Néphantes', 'Champ de Mizunari'], ['Atlantide', 'Virelune'],
    ['Forêt Noir', 'Forêt Enchantée'], ['Montagne des Cerfs', 'Tolbana']
];

function validateLiteral(node) {
    if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return;
    if (ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken].includes(node.operator) && ts.isNumericLiteral(node.operand)) return;
    if (ts.isArrayLiteralExpression(node)) { node.elements.forEach(validateLiteral); return; }
    if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name))) throw new Error('Catalogue contains a nonliteral property');
            if (property.name.text === '__proto__') throw new Error('Unsafe catalogue property');
            validateLiteral(property.initializer);
        }
        return;
    }
    throw new Error('Catalogue contains executable data: ' + ts.SyntaxKind[node.kind]);
}

function evaluateLiteral(node, sourceFile) {
    validateLiteral(node);
    const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
    return JSON.parse(JSON.stringify(vm.runInContext('(' + node.getText(sourceFile) + ')', context, { timeout: 1000 })));
}

function readLiteral(source, name) {
    const sourceFile = ts.createSourceFile(name + '.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    let initializer;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
            if (initializer) throw new Error('Duplicate named catalogue: ' + name);
            initializer = node.initializer;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (!initializer) throw new Error('Missing named catalogue: ' + name);
    return evaluateLiteral(initializer, sourceFile);
}

function readEnglish(read) {
    const result = {};
    for (const file of ['js/i18n-en.js', 'js/i18n-en-reviewed.js', 'js/i18n-quests-en-reviewed.js', 'js/i18n-game-en-reviewed.js']) {
        const sourceFile = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        const visit = node => {
            if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && /NamelessTranslations\.en$/.test(node.left.getText(sourceFile)) && ts.isObjectLiteralExpression(node.right)) Object.assign(result, evaluateLiteral(node.right, sourceFile));
            if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'Object.assign' && /NamelessTranslations\.en$/.test(node.arguments[0]?.getText(sourceFile) || '')) {
                for (const argument of node.arguments.slice(1)) if (ts.isObjectLiteralExpression(argument)) Object.assign(result, evaluateLiteral(argument, sourceFile));
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }
    return result;
}

function imageUrl(value, base = '/pages/bestiaire.html') {
    const url = new URL(String(value), origin + base);
    if (url.origin !== origin || !url.pathname.startsWith('/assets/')) throw new Error('Invalid public image: ' + value);
    return url.pathname;
}

function webpSize(file) {
    const buffer = fs.readFileSync(file);
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Expected WebP map: ' + file);
    for (let offset = 12; offset + 8 <= buffer.length;) {
        const kind = buffer.toString('ascii', offset, offset + 4), size = buffer.readUInt32LE(offset + 4), start = offset + 8;
        if (kind === 'VP8X') return { width: 1 + buffer.readUIntLE(start + 4, 3), height: 1 + buffer.readUIntLE(start + 7, 3) };
        if (kind === 'VP8L') {
            if (buffer[start] !== 0x2f) throw new Error('Invalid lossless WebP header');
            const bits = buffer.readUInt32LE(start + 1);
            return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
        }
        if (kind === 'VP8 ') return { width: buffer.readUInt16LE(start + 6) & 0x3fff, height: buffer.readUInt16LE(start + 8) & 0x3fff };
        offset = start + size + (size % 2);
    }
    throw new Error('Map image dimensions missing: ' + file);
}

function aliasMatcher(pairs) {
    const names = new Map();
    pairs.forEach(([first, second]) => { names.set(normalize(first), normalize(first)); names.set(normalize(second), normalize(first)); });
    return value => names.get(normalize(value)) || normalize(value);
}

function compile({ root = defaultRoot } = {}) {
    root = path.resolve(root);
    const read = file => fs.readFileSync(path.join(root, file), 'utf8');
    const source = JSON.parse(read('data/map-source.json'));
    const creatures = readLiteral(read('js/bestiaire.js'), 'creaturesData');
    const groups = readLiteral(read('js/items-catalog-hdv.js'), 'itemsCatalog');
    const en = readEnglish(read);
    const audit = { version: 1, source: 'data/map-source.json', locationAliases: aliases, cityAliases,
        forbiddenAliases, itemAliases: [['Brindille Enchantée', 'Brindille Enchantées'], ['Peau Dur Glacial', "Peau d'ur Glacial"]],
        itemAliasEvidence: [{ itemKey: 'item:peau_glacial', catalogId: 'peau_glacial', catalogName: "Peau d'ur Glacial",
            catalogImage: 'Ressources/PeaudurGlacial.png', dropName: 'Peau Dur Glacial', dropImage: 'PeaudurGlacial.png',
            rule: 'Explicit reviewed name alias; catalogue ID and identical image filename are both required', matches: [] }], counts: {},
        coordinateConflicts: [], unmatchedCreatureLocations: [], unmatchedDrops: [], unmatchedLegacyGuides: [],
        legacyFavorites: [], coordinateNotes: [
            'P1 and P2 preserve game X/Z and use Leaflet [5121-Z,X].',
            'Creature position is always null; a positionRef only indicates the documented zone, never a spawn.',
            'HTML guide coordinates are retained independently of legacy quest coordinates. Evidence is recorded in sources.',
            'NPC coordinates are references to existing guides/quests. Conflicting evidence has no unique positionRef.',
            'P3 uses the actual 1274×1513 image extent and has no game coordinate reference or entity.'
        ] };
    const floorMeta = Object.keys(source.floorMaps).map(value => {
        const id = Number(value), originalImage = imageUrl(source.floorMaps[value]);
        const { width, height } = webpSize(path.join(root, decodeURIComponent(originalImage)));
        const config = source.floorConfig[value];
        return { id, title: 'Palier ' + id, bounds: id === 3 ? [[0, 0], [height, width]] : config.bounds,
            maxBounds: id === 3 ? [[0, 0], [height, width]] : config.maxBounds,
            gameOffset: id === 3 ? null : 5121, image: '/assets/map-preview/floor-' + id + '-detail.webp', originalImage,
            overview: '/assets/map-preview/floor-' + id + '-desktop.webp',
            overviewMobile: '/assets/map-preview/floor-' + id + '-mobile.webp',
            overviewWidth: { 1: 1600, 2: 1400, 3: 1274 }[id], overviewMobileWidth: 768, width, height,
            dataUrl: '/assets/map/floor-' + id + '.json', coordinateStatus: id === 3 ? 'image-only' : 'game-reference' };
    });
    const floors = Object.fromEntries(floorMeta.map(meta => [meta.id, { version: 1, floor: meta.id, entities: {}, points: [] }]));
    const entities = new Map();
    const add = data => {
        if (entities.has(data.key)) throw new Error('Duplicate graph entity: ' + data.key);
        if (!floors[data.floor]) throw new Error('Invalid entity floor: ' + data.key);
        const entity = { key: data.key, id: String(data.id), kind: data.kind, title: clean(data.title), titleEn: en[clean(data.title)] || clean(data.title),
            floor: data.floor, markerType: data.markerType ?? null, description: clean(data.description), url: data.url,
            position: null, positionRef: null, placeKey: null, creatureKeys: [], guideKeys: [], relatedKeys: [], drops: [], sources: [], ...data };
        entities.set(entity.key, entity); floors[entity.floor].entities[entity.key] = entity; return entity;
    };
    const position = (coordinates, floor) => {
        if (!Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) return null;
        const meta = floorMeta.find(entry => entry.id === floor);
        if (meta.gameOffset === null) return null;
        const [x, z] = coordinates, [[south, west], [north, east]] = meta.bounds;
        return { u: (x - west) / (east - west), v: (north - (meta.gameOffset - z)) / (north - south), x, z, source: 'map-source' };
    };
    const link = (first, second) => {
        if (!first || !second || first.key === second.key) return;
        first.relatedKeys.push(second.key); second.relatedKeys.push(first.key);
    };
    const locations = [];
    for (const [table, markerType, legacyKind] of [['villesData', 'town', 'location'], ['donjonsData', 'dungeon', 'location'], ['marchandsData', 'merchant', 'npc'], ['monstresData', 'zone', 'location']]) {
        source[table].forEach((point, index) => {
            const key = 'location:1:' + point.id;
            const entity = add({ key, id: point.id, kind: 'location', title: point.name, floor: 1, markerType, description: point.description,
                url: '/carte?floor=1&entity=' + encodeURIComponent(key), position: position(point.coordinates, 1), positionRef: key,
                sources: [{ file: 'data/map-source.json', table, index, id: point.id, coordinates: point.coordinates }] });
            locations.push(entity); if (entity.position) floors[1].points.push(key);
            audit.legacyFavorites.push({ key, globalIds: [legacyKind + ':' + table + '-' + index], table, index, originalId: point.id });
        });
    }
    const matchLocationName = aliasMatcher(aliases), matchCityName = aliasMatcher(cityAliases);
    const placesByName = new Map(locations.filter(entity => entity.markerType !== 'merchant').map(entity => [matchLocationName(entity.title), entity]));
    const citiesByName = new Map(locations.filter(entity => entity.markerType === 'town').map(entity => [matchCityName(entity.title), entity]));
    const quests = [];
    for (const [table, floor] of [['questData', 1], ['questDataFloor2', 2]]) {
        source[table].forEach((point, index) => {
            const key = 'quest:' + floor + ':' + point.id;
            const entity = add({ key, id: point.id, kind: 'quest', title: point.name, floor,
                markerType: normalize(point.name) === 'teleporteur' ? 'teleporter' : point.type === 'principale' ? 'quest-primary' : 'quest-secondary', description: point.description,
                url: '/carte?floor=' + floor + '&entity=' + encodeURIComponent(key), position: position(point.coordinates, floor), positionRef: key,
                category: point.type, step: point.step, npc: point.npc || null,
                sources: [{ file: 'data/map-source.json', table, index, id: point.id, coordinates: point.coordinates, npc: point.npc || null }] });
            if (entity.position) floors[floor].points.push(key); quests.push(entity);
        });
    }
    const dom = new JSDOM(read('pages/quetes.html'));
    const guides = [];
    const guideNpc = new Map();
    for (const step of dom.window.document.querySelectorAll('.quest-step')) {
        if (!step.id) throw new Error('Guide needs a permanent HTML ID');
        const section = step.closest('.quest-section'), floor = Number(section.dataset.tier), category = section.dataset.category;
        const title = clean(step.querySelector('h4')?.textContent), coordinate = step.querySelector('.coordinates');
        const coordinates = coordinate ? [Number(coordinate.dataset.x), Number(coordinate.dataset.y)] : null;
        const group = step.closest('.secondary-quest-group');
        const cityName = clean(group?.querySelector('h3')?.textContent);
        const place = cityName ? citiesByName.get(matchCityName(cityName)) : null;
        let npcName = null;
        for (const paragraph of step.querySelectorAll('p')) {
            if (/^PNJ\s*:/i.test(clean(paragraph.querySelector('strong')?.textContent))) npcName = clean(paragraph.textContent).replace(/^PNJ\s*:\s*/i, '');
        }
        if (!npcName && category === 'secondaire') npcName = title;
        // Spoken targets are used only when the HTML supplies no explicit current PNJ.
        if (!npcName && category === 'principale') {
            const spoken = /^(?:Parler (?:à|au)|Trouver|Rapport à|Fin avec|Suite avec|Retour (?:à|au))\s+(?:la\s+)?(.+)$/i.exec(title);
            if (spoken) npcName = clean(spoken[1]).replace(/\s+\([^)]*\)$/, '');
        }
        const key = 'guide:' + step.id;
        const entity = add({ key, id: step.id, kind: 'guide', title, floor, markerType: category === 'principale' ? 'quest-primary' : 'quest-secondary',
            description: clean(step.querySelector('.step-content')?.textContent), url: '/quetes?quest=' + encodeURIComponent(step.id),
            position: position(coordinates, floor), positionRef: coordinates ? key : null, placeKey: place?.key || null, category,
            sources: [{ file: 'pages/quetes.html', id: step.id, category, floor, coordinates, npc: npcName, city: cityName || null }] });
        guides.push(entity); if (npcName) guideNpc.set(key, npcName);
        if (place) { place.guideKeys.push(key); link(place, entity); }
    }
    dom.window.close();
    const guidesById = new Map(guides.map(guide => [guide.id, guide]));
    const questToGuide = new Map();
    for (const quest of quests) {
        let guideId;
        if (quest.floor === 1) guideId = quest.id.startsWith('quest-') ? 'p1-principale-' + quest.id.slice(6) : 'p1-secondaire-' + quest.id.slice(10);
        else guideId = quest.id.startsWith('floor2-quest-') ? 'p2-principale-' + quest.id.slice(13) : null;
        if (quest.id === 'secondary-therra') guideId = 'p1-secondaire-soeur-therra';
        if (quest.floor === 2 && quest.category === 'secondaire' && quest.npc) guideId = 'p2-secondaire-' + slug(quest.npc);
        const guide = guidesById.get(guideId);
        if (!guide) { audit.unmatchedLegacyGuides.push({ key: quest.key, expectedGuideId: guideId }); continue; }
        quest.guideKeys.push(guide.key); questToGuide.set(quest.key, guide); link(quest, guide);
        if (guide.placeKey) { quest.placeKey = guide.placeKey; const place = entities.get(guide.placeKey); place.guideKeys.push(guide.key); link(place, quest); }
        if (quest.position && guide.position && (quest.position.x !== guide.position.x || quest.position.z !== guide.position.z)) audit.coordinateConflicts.push({ kind: 'quest-guide', key: quest.key, title: quest.title,
            evidence: [{ key: quest.key, coordinates: [quest.position.x, quest.position.z], source: quest.sources[0] }, { key: guide.key, coordinates: [guide.position.x, guide.position.z], source: guide.sources[0] }] });
    }
    const npcs = new Map();
    const npcEvidence = new Map();
    const addNpcEvidence = (name, reference, file) => {
        if (!name) return;
        const key = 'npc:' + reference.floor + ':' + slug(name);
        let npc = npcs.get(key);
        if (!npc) {
            npc = add({ key, id: slug(name), kind: 'npc', title: name, floor: reference.floor, markerType: 'npc',
                description: 'PNJ associé aux quêtes du palier ' + reference.floor, url: '/carte?floor=' + reference.floor + '&entity=' + encodeURIComponent(key) });
            npcs.set(key, npc); npcEvidence.set(key, []);
        }
        npc.sources.push({ file, referenceKey: reference.key, coordinates: reference.position ? [reference.position.x, reference.position.z] : null, placeKey: reference.placeKey });
        npcEvidence.get(key).push(reference); link(npc, reference);
        if (reference.kind === 'guide') npc.guideKeys.push(reference.key);
        if (reference.kind === 'quest') npc.guideKeys.push(...reference.guideKeys);
    };
    guides.forEach(guide => addNpcEvidence(guideNpc.get(guide.key), guide, 'pages/quetes.html'));
    quests.forEach(quest => {
        let name = quest.npc || guideNpc.get(questToGuide.get(quest.key)?.key);
        if (!name && quest.category === 'secondaire') name = quest.title;
        if (!name && quest.category === 'principale') {
            const spoken = /^(?:Parler (?:à|au)|Trouver)\s+(?:la\s+)?(.+)$/.exec(quest.title);
            if (spoken) name = clean(spoken[1]);
        }
        addNpcEvidence(name, quest, 'data/map-source.json');
        if (quest.npc) audit.legacyFavorites.push({ key: 'npc:' + quest.floor + ':' + slug(quest.npc), globalIds: ['npc:' + quest.floor + '-' + normalize(quest.npc)] });
    });
    for (const [key, npc] of npcs) {
        const references = npcEvidence.get(key), positioned = references.filter(entity => entity.position);
        const coordinates = unique(positioned.map(entity => entity.position.x + ',' + entity.position.z));
        const places = unique(references.map(entity => entity.placeKey));
        if (coordinates.length === 1) npc.positionRef = positioned[0].key;
        if (places.length === 1) npc.placeKey = places[0];
        if (coordinates.length > 1) audit.coordinateConflicts.push({ kind: 'npc', key, title: npc.title, evidence: positioned.map(entity => ({ key: entity.key, coordinates: [entity.position.x, entity.position.z], source: entity.sources[0] })) });
        if (npc.placeKey) { const place = entities.get(npc.placeKey); place.guideKeys.push(...npc.guideKeys); link(place, npc); }
        npc.url = npc.guideKeys.length ? entities.get(npc.guideKeys[0]).url : npc.url;
    }
    const itemsByName = new Map();
    for (const [category, group] of Object.entries(groups)) {
        group.items.forEach((item, index) => {
            const key = 'item:' + item.id;
            const entity = add({ key, id: item.id, kind: 'item', title: item.name, floor: 1, markerType: null, description: clean(group.name).replace(/^[^\p{L}\p{N}]+/u, ''),
                url: '/items?item=' + encodeURIComponent(item.id), image: imageUrl('/assets/items/' + item.image), category, rarity: item.rarity,
                sources: [{ file: 'js/items-catalog-hdv.js', literal: 'itemsCatalog', category, index, id: item.id }] });
            const name = normalize(item.name);
            if (itemsByName.has(name)) throw new Error('Duplicate normalized item title: ' + item.name);
            itemsByName.set(name, entity);
        });
    }
    const brindille = itemsByName.get(normalize('Brindille Enchantées'));
    if (brindille) itemsByName.set(normalize('Brindille Enchantée'), brindille);
    const glacial = entities.get('item:peau_glacial');
    const glacialProof = audit.itemAliasEvidence[0];
    creatures.forEach((creature, index) => {
        const place = creature.location === '???' ? null : placesByName.get(matchLocationName(creature.location));
        const entity = add({ key: 'creature:' + creature.id, id: creature.id, kind: 'creature', title: creature.name, floor: creature.palier,
            markerType: creature.category === 'boss' ? 'boss' : 'creature', description: creature.description,
            url: creature.category === 'boss' ? '/boss/' + slug(creature.name) : '/bestiaire?creature=' + creature.id,
            image: imageUrl(creature.image), positionRef: place?.key || null, placeKey: place?.key || null,
            category: creature.category, type: creature.type, hp: creature.hp,
            sources: [{ file: 'js/bestiaire.js', literal: 'creaturesData', index, id: creature.id, location: creature.location }] });
        if (place) { place.creatureKeys.push(entity.key); link(place, entity); }
        else audit.unmatchedCreatureLocations.push({ key: entity.key, title: entity.title, location: creature.location, reason: creature.location === '???' ? 'unknown' : 'no-exact-or-approved-alias' });
        entity.drops = creature.drops.map((drop, dropIndex) => {
            let item = itemsByName.get(normalize(drop.name)), aliasEvidence = null;
            if (!item && glacial && normalize(drop.name) === normalize(glacialProof.dropName)
                && glacial.id === glacialProof.catalogId && glacial.title === glacialProof.catalogName
                && decodeURIComponent(glacial.image) === '/assets/items/' + glacialProof.catalogImage
                && drop.image === glacialProof.dropImage) {
                item = glacial;
                aliasEvidence = { match: 'explicit-name-image-id', alias: 'peau-glacial', catalogId: glacial.id,
                    catalogImage: glacialProof.catalogImage, dropImage: drop.image };
                glacialProof.matches.push({ creatureKey: entity.key, dropIndex, file: 'js/bestiaire.js', name: drop.name, image: drop.image });
            }
            if (item) {
                item.creatureKeys.push(entity.key); link(item, entity);
                item.sources.push({ file: 'js/bestiaire.js', literal: 'creaturesData', index, id: creature.id, creatureKey: entity.key, dropIndex, name: drop.name, rate: Number.isFinite(drop.rate) ? drop.rate : null, ...aliasEvidence });
            } else audit.unmatchedDrops.push({ creatureKey: entity.key, name: drop.name, rate: Number.isFinite(drop.rate) ? drop.rate : null });
            return { name: drop.name, itemKey: item?.key || null, rate: Number.isFinite(drop.rate) ? drop.rate : null };
        });
    });
    for (const entity of entities.values()) {
        for (const field of ['relatedKeys', 'creatureKeys', 'guideKeys']) entity[field] = unique(entity[field]);
        if (!entity.position && entity.positionRef === entity.key) entity.positionRef = null;
        for (const reference of [entity.positionRef, entity.placeKey, ...entity.relatedKeys, ...entity.creatureKeys, ...entity.guideKeys].filter(Boolean)) {
            if (!entities.has(reference)) throw new Error('Unresolved graph reference: ' + entity.key + ' → ' + reference);
        }
    }
    const registry = [...entities.values()].filter(entity => entity.kind !== 'item').map(entity => ({ key: entity.key, kind: entity.kind, floor: entity.floor, markerType: entity.markerType }));
    const catalog = { version: 1, floors: floorMeta, index: [...entities.values()].map(entity => ({ key: entity.key, id: entity.id, kind: entity.kind, title: entity.title,
        titleEn: entity.titleEn, floor: entity.floor, markerType: entity.markerType, positionRef: entity.position ? entity.key : entity.positionRef, url: entity.url,
        mapUrl: '/carte?floor=' + entity.floor + '&entity=' + encodeURIComponent(entity.key),
        keywords: clean([entity.description, entity.npc, entity.category, ...entity.sources.map(source => source.location || source.city || ''), ...entity.drops.map(drop => drop.name)].join(' ')) })), registry };
    audit.counts = { entities: entities.size, byKind: Object.fromEntries(['location', 'quest', 'guide', 'npc', 'creature', 'item'].map(kind => [kind, [...entities.values()].filter(entity => entity.kind === kind).length])),
        floors: Object.fromEntries(Object.values(floors).map(floor => [floor.floor, { entities: Object.keys(floor.entities).length, defaultPoints: floor.points.length }])), registry: registry.length,
        guidesByCategory: Object.fromEntries(['1:principale', '1:secondaire', '2:principale', '2:secondaire'].map(key => [key, guides.filter(guide => guide.floor + ':' + guide.category === key).length])) };
    audit.legacyFavorites = audit.legacyFavorites.filter((entry, index, all) => all.findIndex(other => other.key === entry.key && JSON.stringify(other.globalIds) === JSON.stringify(entry.globalIds)) === index);
    return { graph: { catalog, floors, registry }, audit };
}

export function createMapGraph(options = {}) { return compile(options).graph; }

export function writeMapGraph({ root = defaultRoot, output = root } = {}) {
    root = path.resolve(root); output = path.resolve(output);
    const { graph, audit } = compile({ root });
    const target = path.join(output, 'assets/map');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'catalog.json'), JSON.stringify(graph.catalog));
    for (const floor of Object.values(graph.floors)) fs.writeFileSync(path.join(target, 'floor-' + floor.floor + '.json'), JSON.stringify(floor));
    const auditDirectory = path.join(root, 'docs/map-exploration-2026-10-08');
    fs.mkdirSync(auditDirectory, { recursive: true });
    fs.writeFileSync(path.join(auditDirectory, 'graph-audit.json'), JSON.stringify(audit, null, 2) + '\n');
    const sqlQuote = value => "'" + String(value).replace(/'/g, "''") + "'";
    const rows = graph.registry.map(entity => '    (' + [sqlQuote(entity.key), sqlQuote(entity.kind), entity.floor, sqlQuote(entity.markerType)].join(', ') + ')').join(',\n');
    const sqlDirectory = path.join(root, 'docs/supabase'); fs.mkdirSync(sqlDirectory, { recursive: true });
    fs.writeFileSync(path.join(sqlDirectory, 'SAO_NAMELESS_MAP_ENTITY_SEED_005.sql'), '-- Generated by tools/build-map-graph.mjs. Apply after the map registry schema 005.\n-- Public entity identities only; content and coordinate evidence stay in static JSON.\nBEGIN;\nINSERT INTO public.map_entity_registry (entity_key, kind, floor, marker_type) VALUES\n' + rows + '\nON CONFLICT (entity_key) DO UPDATE SET kind = EXCLUDED.kind, floor = EXCLUDED.floor, marker_type = EXCLUDED.marker_type;\nCOMMIT;\n');
    return graph;
}

if (process.argv[1] === import.meta.filename) {
    const graph = writeMapGraph();
    console.log('Map graph: ' + graph.catalog.index.length + ' entities, ' + graph.registry.length + ' registry keys, ' + Object.values(graph.floors).reduce((sum, floor) => sum + floor.points.length, 0) + ' default points.');
}
