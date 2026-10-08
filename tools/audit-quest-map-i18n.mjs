#!/usr/bin/env node
/*
 * Strict audit for the two content-heavy bilingual surfaces.
 * A string passes only when it was explicitly reviewed, is a protected
 * coordinate, or is an intentional language-invariant proper noun.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {projectMapSource} from './public-content-policy.mjs';
const require = createRequire(import.meta.url);
const ts = require('typescript');

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
    ...captureReviewedKeys('js/i18n-information-en-reviewed.js'),
    ...captureReviewedKeys('js/i18n-quests-en-reviewed.js')
]);

const catalogueSandbox = { window: {} };
for (const file of ['js/i18n-en.js', 'js/i18n-en-reviewed.js', 'js/i18n-quests-en-reviewed.js', 'js/i18n-information-en-reviewed.js']) {
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
    "Archives des quêtes secondaires d'Aincrad. Informations historiques non vérifiées.",
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
for (const table of Object.values(projectMapSource(JSON.parse(read('data/map-source.json'))))) {
    if (!Array.isArray(table)) continue;
    for (const point of table) for (const field of ['name', 'description', 'npc']) {
        if (point[field]) mapDataValues.add(point[field]);
    }
}
for (const source of mapDataValues) assertReviewed(source, 'data/map-source.json');

// Runtime labels carry a reviewed FR/EN pair beside their use; do not require
// the retired popup prose to remain in the new contextual panel.
let runtimePairs = 0;
for (const file of ['js/map.js', 'js/map-admin.js']) {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
    const visit = node => {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'text'
            && node.arguments.length === 2 && node.arguments.every(ts.isStringLiteral)) {
            runtimePairs++;
            if (!node.arguments[0].text.trim() || !node.arguments[1].text.trim()) errors.push(file + ': empty bilingual runtime label');
        }
        ts.forEachChild(node, visit);
    };
    visit(ast);
}
if (runtimePairs < 45) errors.push('Map bilingual runtime labels are missing.');

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
if (/<(?:strong|button)[^>]*>[⭐📜📋📍🏹🏰⚔️💰👹]/u.test(mapSource)) {
    errors.push('An emoji is still fused to translatable popup text.');
}

if (errors.length) {
    console.error(`Quest/map i18n audit failed (${errors.length} issue${errors.length > 1 ? 's' : ''}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
} else {
    console.log(`Quest/map i18n audit passed: ${extractVisibleHtml('pages/quetes.html').size} quest-page strings, ${extractVisibleHtml('pages/map.html').size} map-page strings, ${mapDataValues.size} source data values and ${runtimePairs} bilingual runtime labels reviewed.`);
}
