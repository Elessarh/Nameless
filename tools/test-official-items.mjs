// Source-contract tests use isolated data fixtures, never the old server or network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readOfficialItemCatalogue, writeOfficialItemCatalogue} from './items-catalogue.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nameless-official-items-test-'));
let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const currentItem = (id, name, extra = {}) => ({id, sourceId: id, sourceKey: 'wiki:' + id, name,
    category: {id: 'resources', slug: 'ressources', label: 'Ressources'}, image: null,
    rarity: null, level: null, description: '', lore: [], stats: [], material: null, customModelData: null,
    sourceUrl: 'https://saominecraft.com/fr/wiki/items', ...extra});
const oldIdentities = {schemaVersion: 1, items: [{id: 'old_gel', name: 'Gelée de Slime',
    rarity: 'legendary', level: 99, description: 'Outdated detail', image: 'retired.png', stats: [{label: 'Ancien dégât', value: '999'}]},
    {id: 'old_missing', name: 'Ancien objet absent'}], reviewedAliases: []};
const snapshot = items => ({schemaVersion: 1, source: {wikiUrl: 'https://saominecraft.com/fr/wiki'},
    fetchedAt: '2026-10-14T00:00:00Z', items});
function fixture(items, legacy = oldIdentities) {
    fs.mkdirSync(path.join(temporaryRoot, 'data'), {recursive: true});
    fs.mkdirSync(path.join(temporaryRoot, 'js'), {recursive: true});
    fs.writeFileSync(path.join(temporaryRoot, 'data/official-items.json'), JSON.stringify(snapshot(items)));
    fs.writeFileSync(path.join(temporaryRoot, 'data/item-legacy-identities.json'), JSON.stringify(legacy));
    return readOfficialItemCatalogue({root: temporaryRoot});
}

try {
    let result = fixture([currentItem('wiki_gel', '§aGelée de Slime')]);
    equal(result.items.map(item => item.id), ['old_gel'], 'An unambiguous exact normalized name retains the old public identity');
    equal(result.aliases.wiki_gel, 'old_gel', 'The official identity resolves to the same public record');
    equal([result.items[0].rarity, result.items[0].rarityLabel, result.items[0].level, result.items[0].description,
        result.items[0].image, result.items[0].stats], ['unrecorded', null, null, '', null, []],
        'Missing official facts remain missing instead of being copied from historical data');
    check(!result.items.some(item => item.id === 'old_missing') && result.unmatchedLegacy.old_missing === 'Ancien objet absent'
        && result.legacyResolution.old_missing.status === 'not-in-current-snapshot',
        'A missing old item is reported for compatibility without re-entering the active catalogue');

    const genuine = currentItem('wiki_sword', 'Épée documentée', {rarity: {slug: 'mythique', label: 'Mythique', color: '#e061ff'}, level: 0,
        description: 'Texte officiel', lore: ['Ligne exacte'], stats: [{label: 'Dégâts', value: '12–18'}, {label: 'Force', value: '+3%'}]});
    result = fixture([genuine]);
    equal([result.items[0].rarity, result.items[0].rarityLabel, result.items[0].rarityColor, result.items[0].level,
        result.items[0].description, result.items[0].lore, result.items[0].stats],
        ['mythique', 'Mythique', '#e061ff', 0, genuine.description, genuine.lore, genuine.stats],
        'Official rarity, zero level, descriptions and textual statistics keep their exact supplied values');
    check(!Object.hasOwn(result.items[0], 'palier') && !Object.hasOwn(result.items[0], 'drops') && !Object.hasOwn(result.items[0], 'rate'),
        'New official items receive no invented floor, drop source or probability');

    result = fixture([currentItem('wiki_gel_a', 'Gelée de Slime'), currentItem('wiki_gel_b', 'Gelée de Slime')]);
    equal(result.items.map(item => item.id), ['wiki_gel_a', 'wiki_gel_b'], 'Distinct official identities with identical names are not collapsed');
    check(!Object.hasOwn(result.aliases, 'old_gel') && result.legacyResolution.old_gel.status === 'ambiguous',
        'An ambiguous old name produces no automatic compatibility destination');
    const reviewed = {...oldIdentities, reviewedAliases: [{legacyId: 'old_gel', officialId: 'wiki_gel_b', officialName: 'Gelée de Slime', evidence: 'Explicit source identity reviewed for this fixture'}]};
    result = fixture([currentItem('wiki_gel_a', 'Gelée de Slime'), currentItem('wiki_gel_b', 'Gelée de Slime')], reviewed);
    equal(result.aliases.old_gel, 'old_gel', 'A reviewed identity can preserve an otherwise ambiguous old link');
    equal(result.aliases.wiki_gel_b, 'old_gel', 'The reviewed official destination remains exact');
    for (const alias of [{...reviewed.reviewedAliases[0], evidence: ''}, {...reviewed.reviewedAliases[0], officialName: 'Wrong name'},
        {...reviewed.reviewedAliases[0], officialId: 'missing_id'}]) {
        assert.throws(() => fixture([currentItem('wiki_gel_b', 'Gelée de Slime')], {...oldIdentities, reviewedAliases: [alias]}), /alias/i);
        checks++;
    }
    assert.throws(() => fixture([currentItem('duplicate', 'A'), currentItem('duplicate', 'B')]), /duplicate official item ID/); checks++;
    assert.throws(() => fixture([currentItem('unsafe', 'A', {image: '/assets/items/official/../old.png'})]), /local imported asset/); checks++;
    assert.throws(() => fixture([currentItem('unsafe', 'A', {image: 'https://foreign.example/a.png'})]), /local imported asset/); checks++;

    fixture([currentItem('wiki_escape', '<script>known plain text</script>')]);
    writeOfficialItemCatalogue({root: temporaryRoot});
    const generated = fs.readFileSync(path.join(temporaryRoot, 'js/items-catalog-official.js'), 'utf8');
    check(!generated.includes('<script>'), 'Generated script escapes markup while retaining literal content');
    const scope = {window: {}};
    vm.runInNewContext(generated + '\nwindow.records = Object.values(itemsCatalog).flatMap(group => group.items);', scope);
    equal(scope.window.records[0].name, '<script>known plain text</script>', 'Escaping does not rewrite actual item names');
} finally {
    const resolved = path.resolve(temporaryRoot), allowed = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(allowed) || !path.basename(resolved).startsWith('nameless-official-items-test-')) throw new Error('Unsafe temporary fixture cleanup');
    fs.rmSync(resolved, {recursive: true, force: true});
}

// Check full production coverage directly against the importer snapshot, not a
// duplicated list or the renderer's record count.
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/official-items.json'), 'utf8'));
const catalogue = readOfficialItemCatalogue({root});
equal(catalogue.items.length, source.items.length, 'Every current official source row reaches the active catalogue exactly once');
equal(new Set(catalogue.items.map(item => item.officialId)), new Set(source.items.map(item => item.id)), 'Complete official identities are retained without fabricated or historical extras');
check(new Set(catalogue.items.map(item => item.id)).size === catalogue.items.length, 'Public official item identities are unique');
equal(catalogue.snapshotInfo.rarities, source.rarities || [], 'Catalogue keeps the published rarity order rather than guessing ranks from rarity names');
const generatedScope = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/items-catalog-official.js'), 'utf8') + '\nwindow.records = Object.values(itemsCatalog).flatMap(group => group.items);', generatedScope);
equal(JSON.parse(JSON.stringify(generatedScope.window.records)).map(item => item.officialId), catalogue.items.map(item => item.officialId), 'The shipped generated browser catalogue covers the same official source identities');
equal(generatedScope.window.NamelessItemCatalogueMeta.count, source.items.length, 'The browser publishes the real import count');
check(!fs.readFileSync(path.join(root, 'pages/items.html'), 'utf8').includes('items-catalog-hdv.js'), 'The active item page does not load historical facts');
for (const row of source.items) {
    const active = catalogue.items.find(item => item.officialId === row.id);
    equal([active.sourceId, active.sourceKey, active.name, active.rarity, active.rarityLabel, active.rarityColor, active.level,
        active.description, active.lore, active.stats, active.material, active.customModelData],
        [row.sourceId, row.sourceKey, row.name, row.rarity?.slug || 'unrecorded', row.rarity?.label || null, row.rarity?.color || null,
            row.level ?? null, row.description || '', row.lore || [], row.stats || [], row.material ?? null, row.customModelData ?? null],
        'Source facts remain exact for ' + row.id);
    equal([active.category, active.categoryName], [row.category.slug, row.category.label], 'Published category follows the official source for ' + row.id);
    check(active.sourceUrl?.startsWith('https://saominecraft.com/') && active.provenance === 'sao-minecraft-official-wiki', 'Each row states its official origin');
    check(!Object.hasOwn(active, 'palier') && !Object.hasOwn(active, 'floor') && !Object.hasOwn(active, 'drops'), 'Catalogue does not invent world associations for ' + row.id);
}
console.log('Official item source contract: ' + checks + ' checks passed for complete coverage, exact source facts, truthful missing values and safe unambiguous legacy identities.');
