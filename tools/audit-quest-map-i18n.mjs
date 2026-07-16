#!/usr/bin/env node
/*
 * Strict audit for the two content-heavy bilingual surfaces.
 * A string passes only when it was explicitly reviewed, is a protected
 * coordinate, or is an intentional language-invariant proper noun.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const errors = [];

function captureReviewedKeys(relativeFile) {
    const keys = new Set();
    const target = new Proxy({}, {
        set(object, key, value) {
            keys.add(String(key));
            object[key] = value;
            return true;
        }
    });
    const sandbox = { window: { NamelessTranslations: { en: target } } };
    vm.runInNewContext(read(relativeFile), sandbox);
    return keys;
}

const reviewedKeys = new Set([
    ...captureReviewedKeys('js/i18n-en-reviewed.js'),
    ...captureReviewedKeys('js/i18n-quests-en-reviewed.js')
]);

const catalogueSandbox = { window: {} };
for (const file of ['js/i18n-en.js', 'js/i18n-en-reviewed.js', 'js/i18n-quests-en-reviewed.js']) {
    vm.runInNewContext(read(file), catalogueSandbox);
}
const catalogue = catalogueSandbox.window.NamelessTranslations.en;

const invariant = new Set([
    'Items', 'Wiki', 'Nameless', 'FAQ', 'N/A', 'Minecraft', 'Aincrad'
]);
const coordinatePattern = /^(X:\s*-?\d+\s*,\s*Z:\s*-?\d+)(?:\s*\(([^)]+)\))?$/i;

function decodeHtml(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function assertReviewed(source, context) {
    if (!source || invariant.has(source)) return;
    const coordinate = source.match(coordinatePattern);
    if (coordinate) {
        if (coordinate[2] && !reviewedKeys.has(coordinate[2]) && !invariant.has(coordinate[2])) {
            errors.push(`${context}: coordinate location is not reviewed: ${JSON.stringify(coordinate[2])}`);
        }
        return;
    }
    if (!reviewedKeys.has(source)) {
        errors.push(`${context}: string is not explicitly reviewed: ${JSON.stringify(source)}`);
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(catalogue, source)) {
        errors.push(`${context}: reviewed string missing from final catalogue: ${JSON.stringify(source)}`);
    }
}

function extractVisibleHtml(relativeFile) {
    const html = read(relativeFile)
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');
    const values = new Set();
    for (const match of html.matchAll(/>([^<>]+)</g)) {
        const value = decodeHtml(match[1]);
        if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value)) values.add(value);
    }
    return values;
}

for (const file of ['pages/quetes.html', 'pages/map.html']) {
    for (const source of extractVisibleHtml(file)) assertReviewed(source, file);
}

const reviewedAttributes = [
    "Progression d'Aincrad — le guide des quêtes principales et secondaires de la guilde Nameless, avec lieux, PNJ, objectifs et coordonnées.",
    "Le guide des quêtes d'Aincrad : lieux, PNJ, objectifs et coordonnées.",
    "La carte interactive d'Aincrad — zones, donjons, quêtes, villes, marchands et monstres. Le territoire de la guilde Nameless.",
    "La carte interactive d'Aincrad et tous ses points d'intérêt.",
    'Navigation principale', 'Nameless - Accueil', 'Se déconnecter', 'Ouvrir le menu',
    'Filtres de quêtes', 'Type de quête', 'Rechercher une quête, un PNJ, un lieu...',
    'Pagination des quêtes', 'Contrôles de la carte', 'Quête, PNJ, monstre, ville...',
    'Effacer la recherche', 'Résultats de recherche', 'Activer le mode édition',
    "Carte interactive d'Aincrad", "Carte du monde d'Aincrad"
];
for (const source of reviewedAttributes) assertReviewed(source, 'HTML attribute');

const mapSource = read('js/map.js');
const mapDataValues = new Set();
for (const field of ['name', 'description', 'npc']) {
    const expression = new RegExp(`\\b${field}\\s*:\\s*(['"])((?:\\\\.|(?!\\1).)*)\\1`, 'g');
    let match;
    while ((match = expression.exec(mapSource))) {
        try {
            mapDataValues.add(vm.runInNewContext(match[1] + match[2] + match[1]));
        } catch { /* Invalid/non-literal values are outside this data audit. */ }
    }
}
for (const source of mapDataValues) assertReviewed(source, 'js/map.js data');

const mapRuntimeText = [
    'Quête ciblée', 'Cliquez ailleurs pour fermer', 'Carte chargée avec succès',
    'Coordonnées pixel:', 'Précision: Standard', 'ULTRA-PRÉCISION (Pixel parfait)',
    'HAUTE PRÉCISION (Millième)', 'PRÉCISION FINE (Centième)',
    'PRÉCISION NORMALE (Dixième)', 'PRÉCISION STANDARD', 'Terre Inconnue',
    'Quadrant Nord-Ouest', 'Secteur Ouest', 'Quadrant Sud-Ouest', 'Secteur Nord',
    'Centre - Palier 2', 'Secteur Sud', 'Quadrant Nord-Est', 'Secteur Est',
    'Quadrant Sud-Est', 'Terres du Nord-Ouest', 'Plaines Centrales Ouest',
    'Terres du Sud-Ouest', 'Territoires du Nord', 'Cœur du Royaume',
    'Terres du Sud', 'Terres du Nord-Est', 'Plaines Centrales Est',
    'Terres du Sud-Est', 'Zone:', 'Zoom amélioré !',
    'Utilisez la molette pour zoomer', 'ou les contrôles en haut à droite',
    'Type:', 'Étape:', 'Position:', 'PNJ:', 'Quête Principale',
    'Quête Secondaire', 'Quêtes à cet emplacement', 'Voir toutes les quêtes',
    'Ville', 'Donjon', 'Marchand', 'Zone de Monstres'
];
for (const source of mapRuntimeText) assertReviewed(source, 'js/map.js runtime');

const forbiddenEnglish = /Master Epistle|Contact details|\bDonjon\b|\bPalier\b|\bPlums?\b|\bSpices\b|\bArteon\b|\bVirlon\b|Scale \d selected|Frossed|Corrected Plums|Skin Thickness|\bWin \d/i;
for (const source of new Set([...reviewedKeys, ...mapDataValues])) {
    const translated = catalogue[source];
    if (translated && forbiddenEnglish.test(translated)) {
        errors.push(`Known-bad English pattern: ${JSON.stringify(source)} -> ${JSON.stringify(translated)}`);
    }
}

if (/setView\([^;]+,\s*4\s*\)/s.test(mapSource)) {
    errors.push('js/map.js still contains a forced search/quest zoom level of 4.');
}
if (!mapSource.includes('focusMapLocation([lat, lng])') || !mapSource.includes('focusMapLocation(leafletCoords)')) {
    errors.push('Both map focus paths must use focusMapLocation().');
}
if (/<(?:strong|button)[^>]*>[⭐📜📋📍🏹🏰⚔️💰👹]/u.test(mapSource)) {
    errors.push('An emoji is still fused to translatable popup text.');
}

if (errors.length) {
    console.error(`Quest/map i18n audit failed (${errors.length} issue${errors.length > 1 ? 's' : ''}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
} else {
    console.log(`Quest/map i18n audit passed: ${extractVisibleHtml('pages/quetes.html').size} quest-page strings, ${extractVisibleHtml('pages/map.html').size} map-page strings and ${mapDataValues.size} map data values explicitly reviewed.`);
}
