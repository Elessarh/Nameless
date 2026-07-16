#!/usr/bin/env node
/* Lightweight, dependency-free checks for the local FR/EN implementation. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/i18n-en.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/i18n-en-reviewed.js'), 'utf8'), sandbox);

const catalog = sandbox.window.NamelessTranslations?.en || {};
const errors = [];
const requiredTerms = new Map([
    ['Recherche', 'Search'],
    ['Palier', 'Floor'],
    ['Métiers', 'Professions'],
    ['Donjons', 'Dungeons'],
    ['Familiers', 'Pets'],
    ['Familier & Monture', 'Pets & Mounts'],
    ['Quête Principale', 'Main Quest'],
    ['Quête Secondaire', 'Side Quest'],
    ['Sections du Wiki', 'Wiki Sections'],
    ['Premiers Pas', 'First Steps'],
    ['PNJ', 'NPC']
]);

for (const [source, expected] of requiredTerms) {
    if (catalog[source] !== expected) {
        errors.push(`Glossary: ${JSON.stringify(source)} must be ${JSON.stringify(expected)}.`);
    }
}

const htmlFiles = [
    'index.html', '404.html',
    ...fs.readdirSync(path.join(root, 'pages'))
        .filter((name) => name.endsWith('.html'))
        .map((name) => path.join('pages', name))
];

for (const relativeFile of htmlFiles) {
    const html = fs.readFileSync(path.join(root, relativeFile), 'utf8');
    const generatedIndex = html.indexOf('i18n-en.js');
    const reviewedIndex = html.indexOf('i18n-en-reviewed.js');
    const engineIndex = html.indexOf('i18n.js');
    if (generatedIndex < 0 || reviewedIndex < 0 || engineIndex < 0) {
        errors.push(`${relativeFile}: missing an i18n script.`);
    } else if (!(generatedIndex < reviewedIndex && reviewedIndex < engineIndex)) {
        errors.push(`${relativeFile}: i18n scripts are not in catalogue/review/engine order.`);
    }
}

if (Object.keys(catalog).length < 1500) {
    errors.push(`Catalogue unexpectedly small (${Object.keys(catalog).length} entries).`);
}

if (errors.length) {
    console.error(`i18n audit failed (${errors.length} issue${errors.length > 1 ? 's' : ''}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
} else {
    console.log(`i18n audit passed: ${Object.keys(catalog).length} translated strings, ${htmlFiles.length} entry pages, reviewed glossary intact.`);
}
