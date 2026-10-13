// Public category names shared by the static page, map and search compilers.
// Categories themselves remain authored in the bestiary catalogue.
const categories = Object.freeze({
    creature: { label: 'Monstre', labelEn: 'Monster' },
    miniboss: { label: 'Mini-boss', labelEn: 'Mini-boss' },
    boss: { label: 'Boss', labelEn: 'Boss' },
    'floor-boss': { label: 'Boss de palier', labelEn: 'Floor boss' }
});

export function isBossFamily(category) {
    return ['boss', 'miniboss', 'floor-boss'].includes(category);
}

export function creatureCategory(category) {
    const result = categories[category];
    if (!result) throw new Error('Unknown public creature category: ' + category);
    return result;
}

export const LEGACY_BOSS_ROUTES = Object.freeze([
    [1, 'gorbel'], [16, 'ika'], [18, 'nephantes'], [54, 'jira'],
    [55, 'kamilia'], [57, 'priscilia'], [59, 'yula'], [58, 'soul-knight']
]);

export function legacyBossSlugs(id) {
    return LEGACY_BOSS_ROUTES.filter(([creatureId]) => creatureId === id).map(([, slug]) => slug);
}
