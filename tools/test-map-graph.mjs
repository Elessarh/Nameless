#!/usr/bin/env node
// Graph invariants checked against the original JSON and HTML, without a browser runtime.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createMapGraph, writeMapGraph } from './build-map-graph.mjs';
import {isPublishedMapEntity, assertNoCombatFields} from './public-content-policy.mjs';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/map-source.json'), 'utf8'));
const graph = createMapGraph({ root });
const all = Object.values(graph.floors).flatMap(floor => Object.values(floor.entities));
const byKey = new Map(all.map(entity => [entity.key, entity]));
const byKind = kind => all.filter(entity => entity.kind === kind);
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

assert.deepEqual(Object.keys(graph).sort(), ['catalog', 'floors', 'registry']);
assert.equal(graph.catalog.version, 1);
assert.equal(byKind('guide').length, 0);
assert.equal(byKind('creature').length, 60);
assert.equal(byKind('item').length, 104);
assert.equal(byKind('location').length, 33);
assert.equal(byKind('quest').length, 0);
assert.equal(byKind('npc').length, 0);
assertNoCombatFields(graph);
assert.equal(all.length, byKey.size, 'Stable keys are unique');
assert.equal(graph.catalog.index.length, all.length);
assert.equal(graph.registry.length, all.length - 104);
assert.deepEqual(graph.catalog.registry, graph.registry);
assert.deepEqual(createMapGraph({ root }), graph, 'Compilation is deterministic');

const confirmed = {boss: [19, 21, 58, 60], miniboss: [11, 15, 17, 41, 43, 44, 46, 47, 56], 'floor-boss': [53]};
for (const [category, ids] of Object.entries(confirmed)) {
    assert.deepEqual(byKind('creature').filter(entity => entity.category === category).map(entity => entity.id).sort((a, b) => a - b), ids, 'Graph classification matches the explicit ' + category + ' list');
}
assert.equal(byKind('creature').filter(entity => entity.category === 'creature').length, 46, 'Every unlisted creature is a normal monster');
for (const entity of byKind('creature')) {
    const bossFamily = entity.category !== 'creature';
    assert.equal(entity.markerType, bossFamily ? 'boss' : 'creature', 'Map marker grouping follows the actual family');
    const entry = graph.catalog.index.find(entry => entry.key === entity.key);
    assert.equal(entry.url, entity.url, 'Map search opens the same public creature identity');
    assert.equal(entry.category, entity.category, 'Lightweight map search retains the exact category');
    assert.equal(entry.categoryLabel, entity.categoryLabel, 'Lightweight map search retains the exact French category label');
    assert.equal(entry.categoryLabelEn, entity.categoryLabelEn, 'Lightweight map search retains the exact English category label');
    assert.equal(entry.type, entity.type, 'Lightweight map search preserves the native creature type');
    assert.equal(entity.url.startsWith('/boss/'), bossFamily, 'Only boss families use generated boss URLs');
}
assert.equal(byKey.get('creature:58').title, 'Nazgul', 'Map displays the corrected boss name');
assert.equal(byKey.get('creature:58').url, '/boss/nazgul');
for (const [id, slug] of [[1, 'gorbel'], [16, 'ika'], [18, 'nephantes'], [54, 'jira'], [55, 'kamilia'], [57, 'priscilia'], [59, 'yula'], [58, 'soul-knight']]) {
    assert.deepEqual(byKey.get('creature:' + id).legacyBossSlugs, [slug], 'Former map boss aliases preserve the permanent identity');
    assert.deepEqual(graph.catalog.index.find(entry => entry.key === 'creature:' + id).legacyBossSlugs, [slug], 'Map lightweight catalogue includes the former alias');
}

const previewManifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/map-exploration-2026-10-08/preview-manifest.json'), 'utf8'));
assert.equal(previewManifest.version, 1);
assert.equal(previewManifest.process.method, 6);
assert.equal(previewManifest.process.lossless, false);
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
function imageSize(buffer) {
    assert.equal(buffer.toString('ascii', 0, 4), 'RIFF'); assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
    for (let offset = 12; offset + 8 <= buffer.length;) {
        const kind = buffer.toString('ascii', offset, offset + 4), size = buffer.readUInt32LE(offset + 4), start = offset + 8;
        if (kind === 'VP8X') return [1 + buffer.readUIntLE(start + 4, 3), 1 + buffer.readUIntLE(start + 7, 3)];
        if (kind === 'VP8 ') return [buffer.readUInt16LE(start + 6) & 0x3fff, buffer.readUInt16LE(start + 8) & 0x3fff];
        if (kind === 'VP8L') { const bits = buffer.readUInt32LE(start + 1); return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]; }
        offset = start + size + (size % 2);
    }
    throw new Error('No WebP image dimensions');
}
for (const meta of graph.catalog.floors) {
    assert.equal(meta.dataUrl, '/assets/map/floor-' + meta.id + '.json');
    const evidence = previewManifest.floors.find(entry => entry.floor === meta.id);
    assert.equal(meta.originalImage, '/' + evidence.source.path, 'Original source URL remains documented');
    const original = fs.readFileSync(path.join(root, evidence.source.path));
    assert.equal(sha256(original), evidence.source.sha256, 'Original source bytes retain their recorded SHA-256');
    assert.equal(original.length, evidence.source.bytes);
    assert.deepEqual(imageSize(original), [meta.width, meta.height]);
    assert.equal(meta.originalImage, new URL(source.floorMaps[meta.id], 'https://nameless-sao.fr/pages/map.html').pathname);
    if (meta.id !== 3) { assert.deepEqual(meta.bounds, source.floorConfig[meta.id].bounds); assert.deepEqual(meta.maxBounds, source.floorConfig[meta.id].maxBounds); }
    for (const output of evidence.outputs) {
        const buffer = fs.readFileSync(path.join(root, output.path));
        assert.equal(sha256(buffer), output.sha256, 'Derived image bytes match the manifest');
        assert.equal(buffer.length, output.bytes);
        assert.deepEqual(imageSize(buffer), [output.width, output.height]);
        assert.equal(output.height, Math.round(meta.height * output.width / meta.width), 'Derived images preserve aspect ratio');
        check(output.bytes < original.length, 'Compressed derivative is lighter than the lossless original');
        assert.equal(output.quality, { desktop: 82, mobile: 80, detail: 84 }[output.variant]);
        assert.equal(output.method, 6); assert.equal(output.lossless, false);
        if (output.variant === 'desktop') { assert.equal(meta.overview, '/' + output.path); assert.equal(meta.overviewWidth, output.width); }
        if (output.variant === 'mobile') { assert.equal(meta.overviewMobile, '/' + output.path); assert.equal(meta.overviewMobileWidth, 768); assert.equal(output.width, 768); }
        if (output.variant === 'detail') { assert.equal(meta.image, '/' + output.path); assert.deepEqual([output.width, output.height], [meta.width, meta.height]); }
    }
    assert.deepEqual(evidence.outputs.map(output => output.variant), ['desktop', 'mobile', 'detail']);
}
const p3 = graph.catalog.floors.find(floor => floor.id === 3);
assert.deepEqual([p3.width, p3.height, p3.gameOffset, p3.coordinateStatus], [1274, 1513, null, 'image-only']);
assert.deepEqual(p3.bounds, [[0, 0], [1513, 1274]]);
assert.deepEqual(graph.floors[3].entities, {});
assert.deepEqual(graph.floors[3].points, []);

const expectedPoints = [];
for (const [table, floor, kind] of [['villesData', 1, 'location'], ['donjonsData', 1, 'location'], ['marchandsData', 1, 'location'], ['monstresData', 1, 'location'], ['questData', 1, 'quest'], ['questDataFloor2', 2, 'quest']]) {
    for (const original of source[table]) {
        if (kind === 'quest') {
            assert.ok(!byKey.has(kind + ':' + floor + ':' + original.id), 'Historical quest never enters the public graph');
            continue;
        }
        const key = kind + ':' + floor + ':' + original.id, entity = byKey.get(key);
        check(Boolean(entity), 'Every legacy row has its permanent source ID');
        assert.equal(entity.title, original.name);
        assert.equal(entity.description, original.description);
        assert.deepEqual([entity.position.x, entity.position.z], original.coordinates, 'Legacy coordinates remain exact');
        const meta = graph.catalog.floors.find(entry => entry.id === floor);
        assert.equal(entity.position.u, (original.coordinates[0] - meta.bounds[0][1]) / (meta.bounds[1][1] - meta.bounds[0][1]));
        assert.equal(entity.position.v, (meta.bounds[1][0] - (5121 - original.coordinates[1])) / (meta.bounds[1][0] - meta.bounds[0][0]));
        assert.equal(entity.position.source, 'map-source');
        assert.deepEqual(entity.sources[0].coordinates, original.coordinates);
        expectedPoints.push(key);
    }
}
assert.deepEqual(Object.values(graph.floors).flatMap(floor => floor.points), expectedPoints);
assert.equal(expectedPoints.length, 33);

const dom = new JSDOM(fs.readFileSync(path.join(root, 'pages/quetes.html'), 'utf8'));
const steps = [...dom.window.document.querySelectorAll('.quest-step')];
for (const step of steps) {
    check(!byKey.has('guide:' + step.id), 'Historical HTML guide is omitted from public map data');
}
assert.equal(steps.length, 58, 'Retired guide source remains recoverable');
dom.window.close();

for (const entity of all) {
    assert.equal(graph.floors[entity.floor].entities[entity.key], entity);
    assert.ok(entity.sources.length, 'Every entity has source evidence');
    check(isPublishedMapEntity(entity), 'No archived entity is shipped');
    for (const reference of [entity.positionRef, entity.placeKey, ...entity.relatedKeys, ...entity.creatureKeys, ...entity.guideKeys].filter(Boolean)) {
        check(byKey.has(reference), 'Reference exists: ' + reference);
        assert.equal(byKey.get(reference).floor, entity.floor, 'Linked entities are on the same floor');
    }
    if (entity.kind === 'creature' || entity.kind === 'npc' || entity.kind === 'item') assert.equal(entity.position, null, 'Derived actors/items have no invented coordinates');
    if (entity.kind === 'item') {
        assert.equal(entity.markerType, null); assert.equal(entity.positionRef, null);
        check(/^\p{L}/u.test(entity.description), 'Generated item category descriptions omit the catalogue emoji');
        check(!graph.registry.some(entry => entry.key === entity.key), 'Items do not enter the map overlay registry');
    }
}
for (const entry of graph.registry) {
    const entity = byKey.get(entry.key);
    assert.deepEqual(entry, { key: entity.key, kind: entity.kind, floor: entity.floor, markerType: entity.markerType });
}

// These similarly named places are explicitly different in the source material.
assert.equal(byKey.get('creature:18').placeKey, null, 'Champ de Mizunari does not become Champ de Néphantes');
assert.equal(byKey.get('creature:49').placeKey, null, 'Forêt Enchantée does not become Forêt Noir');
const atlantide = byKey.get('location:1:atlantide'), cerfs = byKey.get('location:1:montagne-cerfs');
assert.equal(atlantide.creatureKeys.length, 0, 'Virelune does not become Atlantide');
assert.equal(cerfs.creatureKeys.length, 0, 'Tolbana does not become Montagne des Cerfs');
for (const creature of byKind('creature')) {
    if (creature.sources[0].location === '???') assert.equal(creature.positionRef, null);
    if (creature.positionRef) {
        const place = byKey.get(creature.positionRef);
        assert.equal(place.kind, 'location'); check(place.creatureKeys.includes(creature.key), 'Zone-to-creature relation is reciprocal');
    }
}
for (const slug of ['varn', 'saya', 'haruto', 'mephisto', 'ramoon', 'malrik', 'virel']) assert.equal(byKey.has('npc:1:' + slug), false, 'Archived NPC cannot become a current public point');
for (const place of byKind('location')) {
    assert.deepEqual(place.guideKeys, [], 'Current places have no archive guide shortcuts');
    check(!place.relatedKeys.some(key => /^(?:quest|guide|npc):/.test(key)), 'Current place relations contain no historical quest entry');
}

// Each individual drop keeps its own rate, and only exact normalized item names match.
const itemNames = new Set();
for (const item of byKind('item')) {
    check(!itemNames.has(normalize(item.title)), 'Normalized item names are deduplicated'); itemNames.add(normalize(item.title));
    const evidence = item.sources.filter(source => source.creatureKey);
    assert.deepEqual(new Set(item.creatureKeys), new Set(evidence.map(source => source.creatureKey)), 'Item sources are actual matching creature drops');
    for (const source of evidence) {
        const drop = byKey.get(source.creatureKey).drops[source.dropIndex];
        assert.equal(drop.itemKey, item.key); assert.equal(drop.rate, source.rate); assert.equal(drop.name, source.name);
    }
}
for (const creature of byKind('creature')) {
    for (const drop of creature.drops) {
        if (!drop.itemKey) continue;
        const item = byKey.get(drop.itemKey);
        const knownBrindille = item.id === 'brindille_enchantees' && normalize(drop.name) === 'brindille enchantee';
        const knownGlacial = item.id === 'peau_glacial' && normalize(drop.name) === 'peau dur glacial'
            && item.sources.some(source => source.creatureKey === creature.key && source.name === drop.name
                && source.match === 'explicit-name-image-id' && source.catalogImage === 'Ressources/PeaudurGlacial.png' && source.dropImage === 'PeaudurGlacial.png');
        check(knownBrindille || knownGlacial || normalize(drop.name) === normalize(item.title), 'Drops match exact normalized names or an explicitly evidenced alias');
    }
}
assert.equal(byKey.get('creature:7').drops[0].itemKey, 'item:brindille_enchantees');
for (const id of [22, 45]) assert.equal(byKey.get('creature:' + id).drops.find(drop => drop.name === 'Peau Dur Glacial').itemKey, 'item:peau_glacial', 'Reviewed ID and shared image identify the explicit Glacial alias');

// Appended page code proves the compiler reads literal catalogues, not whole scripts.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'nameless-map-graph-'));
try {
    for (const file of ['data/map-source.json', 'js/bestiaire.js', 'js/items-catalog-hdv.js', 'js/i18n-en.js', 'js/i18n-en-reviewed.js', 'js/i18n-quests-en-reviewed.js', 'js/i18n-game-en-reviewed.js', 'pages/quetes.html', 'assets/carte.webp', 'assets/Palier2-map.webp', 'assets/Palier3-map.webp']) {
        const target = path.join(fixture, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, file), target);
    }
    for (const file of ['js/bestiaire.js', 'js/items-catalog-hdv.js']) fs.appendFileSync(path.join(fixture, file), '\nthrow new Error("Page runtime must not execute");\n');
    fs.appendFileSync(path.join(fixture, 'pages/quetes.html'), '<script>throw new Error("HTML runtime must not execute")</script>');
    const written = writeMapGraph({ root: fixture, output: path.join(fixture, 'public') });
    assert.deepEqual(written, graph);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture, 'public/assets/map/catalog.json'), 'utf8')), graph.catalog);
    for (const floor of Object.values(graph.floors)) assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture, 'public/assets/map/floor-' + floor.floor + '.json'), 'utf8')), floor);
    const audit = JSON.parse(fs.readFileSync(path.join(fixture, 'docs/map-exploration-2026-10-08/graph-audit.json'), 'utf8'));
    assert.equal(audit.counts.byKind.guide, 0);
    assert.equal(audit.excludedHistoricalEntities.length, 176, 'All 59 quests, 58 guides and 59 derived NPCs are excluded');
    assert.ok(audit.excludedHistoricalEntities.every(entry => !graph.catalog.index.some(entity => entity.key === entry.key)));
    assert.deepEqual(audit.unmatchedDrops, [], 'Every current drop has an exact or explicitly evidenced catalogue identity');
    assert.deepEqual(audit.itemAliasEvidence[0].matches.map(match => match.creatureKey), ['creature:22', 'creature:45']);
    assert.equal(audit.legacyFavorites.find(entry => entry.key === 'location:1:ville-depart').globalIds[0], 'location:villesData-0');
    assert.equal(audit.legacyFavorites.find(entry => entry.key === 'location:1:marchand-depart').globalIds[0], 'npc:marchandsData-0');
    check(audit.coordinateConflicts.some(conflict => conflict.key === 'npc:1:varn'), 'The retained secondary NPC conflict appears in the audit');
    const seed = fs.readFileSync(path.join(fixture, 'docs/supabase/SAO_NAMELESS_MAP_ENTITY_SEED_005.sql'), 'utf8');
    check(seed.includes('public.map_entity_registry (entity_key, kind, floor, marker_type)'), 'Seed uses the exact schema 005 registry contract');
    check(seed.includes('ON CONFLICT (entity_key) DO UPDATE'), 'Seed can be applied repeatedly');
    check(!seed.includes("'item:") && !seed.includes('coordinates'), 'Seed contains identities without item data or coordinates');
} finally {
    const resolved = path.resolve(fixture), temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(temporaryRoot) || !path.basename(resolved).startsWith('nameless-map-graph-')) throw new Error('Unsafe temporary fixture cleanup');
    fs.rmSync(resolved, { recursive: true, force: true });
}
console.log('Map graph tests passed: ' + checks + ' checks, 176 archived identities excluded, 60 creatures, 104 items and 33 current default points preserved.');
