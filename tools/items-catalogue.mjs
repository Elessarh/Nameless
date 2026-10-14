// The official snapshot is the sole active item content source. Historical
// names below resolve URLs only; they never supply missing item facts.
import fs from 'node:fs';
import path from 'node:path';

const defaultRoot = path.resolve(import.meta.dirname, '..');
export const OFFICIAL_ITEMS_PATH = 'data/official-items.json';
export const LEGACY_IDENTITIES_PATH = 'data/item-legacy-identities.json';

export function normalizeItemName(value) {
    return String(value ?? '').replace(/§[0-9a-fk-or]/gi, '').normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, '');
}

export function readOfficialItemCatalogue({root = defaultRoot} = {}) {
    root = path.resolve(root);
    const snapshot = JSON.parse(fs.readFileSync(path.join(root, OFFICIAL_ITEMS_PATH), 'utf8'));
    const legacy = JSON.parse(fs.readFileSync(path.join(root, LEGACY_IDENTITIES_PATH), 'utf8'));
    if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.items) || !snapshot.items.length) throw new Error('Invalid or empty official item snapshot');
    if (legacy.schemaVersion !== 1 || !Array.isArray(legacy.items) || !Array.isArray(legacy.reviewedAliases)) throw new Error('Invalid historical item identity document');
    const names = new Map(), legacyNames = new Map();
    for (const item of snapshot.items) {
        const name = normalizeItemName(item.name);
        if (!name) throw new Error('Missing official item name: ' + item.id);
        names.set(name, [...(names.get(name) || []), item]);
    }
    for (const item of legacy.items) {
        const name = normalizeItemName(item.name);
        legacyNames.set(name, [...(legacyNames.get(name) || []), item]);
    }
    const matches = new Map();
    for (const item of legacy.items) {
        const name = normalizeItemName(item.name), candidates = names.get(name) || [];
        if (candidates.length === 1 && legacyNames.get(name).length === 1) matches.set(candidates[0].id, item.id);
    }
    for (const alias of legacy.reviewedAliases) {
        if (!alias || typeof alias.evidence !== 'string' || !alias.evidence.trim()) throw new Error('Reviewed item alias requires evidence');
        const old = legacy.items.find(item => item.id === alias.legacyId);
        const current = snapshot.items.find(item => item.id === alias.officialId);
        if (!old || !current || current.name !== alias.officialName) throw new Error('Reviewed item alias no longer matches its named official identity');
        if (matches.has(current.id) && matches.get(current.id) !== old.id) throw new Error('Conflicting reviewed official item alias: ' + current.id);
        matches.set(current.id, old.id);
    }
    const items = [], groups = {}, aliases = {}, ids = new Set(), officialIds = new Set(), matchedLegacyIds = new Set();
    const addAlias = (alias, id) => {
        if (aliases[alias] && aliases[alias] !== id) throw new Error('Ambiguous public item URL alias: ' + alias);
        aliases[alias] = id;
    };
    for (const item of snapshot.items) {
        if (typeof item.id !== 'string' || !/^[a-z0-9_-]+$/i.test(item.id) || officialIds.has(item.id)) throw new Error('Invalid or duplicate official item ID: ' + item.id);
        officialIds.add(item.id);
        const id = matches.get(item.id) || item.id;
        if (ids.has(id)) throw new Error('Public item identity collision: ' + id);
        ids.add(id); if (matches.has(item.id)) matchedLegacyIds.add(id);
        const category = item.category;
        if (!category || typeof category.slug !== 'string' || !/^[a-z0-9_-]+$/i.test(category.slug) || typeof category.label !== 'string' || !category.label.trim()) throw new Error('Missing official item category: ' + item.id);
        if (['__proto__', 'prototype', 'constructor'].includes(category.slug)) throw new Error('Unsafe official category slug');
        if (item.image !== null) {
            if (typeof item.image !== 'string' || !item.image.startsWith('/assets/items/official/') || item.image.includes('..') || item.image.includes('\\')) throw new Error('Official item image must be a local imported asset: ' + item.id);
            const imagePath = path.resolve(root, '.' + decodeURIComponent(item.image));
            if (!imagePath.startsWith(path.resolve(root, 'assets/items/official') + path.sep) || !fs.existsSync(imagePath)) throw new Error('Missing or unsafe official item image: ' + item.id);
        }
        const current = {
            id, officialId: item.id, sourceId: item.sourceId, sourceKey: item.sourceKey, name: item.name,
            image: item.image === null ? null : item.image.slice('/assets/items/'.length), rarity: item.rarity?.slug || 'unrecorded',
            rarityLabel: item.rarity?.label || null, rarityColor: item.rarity?.color || null,
            level: item.level ?? null, description: item.description || '', lore: item.lore || [],
            stats: item.stats || [],
            material: item.material ?? null, customModelData: item.customModelData ?? null,
            sourceUrl: item.sourceUrl || snapshot.source?.wikiUrl || null,
            sourceFetchedAt: snapshot.fetchedAt, requiredClass: item.requiredClass ?? null,
            provenance: 'sao-minecraft-official-wiki'
        };
        if (!groups[category.slug]) groups[category.slug] = {name: category.label, sourceId: category.id, items: []};
        if (groups[category.slug].name !== category.label) throw new Error('Conflicting official category label: ' + category.slug);
        groups[category.slug].items.push(current); items.push({...current, category: category.slug, categoryName: category.label});
        addAlias(item.id, id); addAlias(id, id);
    }
    const unresolved = legacy.items.filter(item => !matchedLegacyIds.has(item.id));
    const unmatchedLegacy = Object.fromEntries(unresolved.map(item => [item.id, item.name]));
    const legacyResolution = Object.fromEntries(unresolved.map(item => [item.id, {name: item.name,
        status: names.get(normalizeItemName(item.name))?.length > 1 || legacyNames.get(normalizeItemName(item.name))?.length > 1 ? 'ambiguous' : 'not-in-current-snapshot'}]));
    const snapshotInfo = {schemaVersion: snapshot.schemaVersion, source: snapshot.source, fetchedAt: snapshot.fetchedAt, itemCount: items.length,
        rarities: snapshot.rarities || [], confirmedLegacyIds: matchedLegacyIds.size};
    return {groups, items, aliases, unmatchedLegacy, legacyResolution, snapshotInfo};
}

export function writeOfficialItemCatalogue({root = defaultRoot} = {}) {
    const catalogue = readOfficialItemCatalogue({root});
    const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
    const metadata = {sourceUrl: catalogue.snapshotInfo.source?.wikiUrl || null, fetchedAt: catalogue.snapshotInfo.fetchedAt,
        count: catalogue.items.length, rarities: catalogue.snapshotInfo.rarities, snapshot: catalogue.snapshotInfo,
        aliases: catalogue.aliases, unmatchedLegacy: catalogue.unmatchedLegacy};
    const source = '// Generated from the current official snapshot. Do not edit by hand.\n'
        + 'const itemsCatalog = ' + json(catalogue.groups) + ';\n'
        + 'window.NamelessItemCatalogueMeta = ' + json(metadata) + ';\n'
        + 'window.NamelessItemCatalogueMeta.resolveAlias = function (id) { return Object.hasOwn(this.aliases, String(id)) ? this.aliases[String(id)] : null; };\n';
    fs.writeFileSync(path.join(root, 'js/items-catalog-official.js'), source);
    return catalogue;
}
