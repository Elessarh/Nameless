#!/usr/bin/env node
/* Strict coverage and terminology audit for dynamic Bestiary/Items data. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const errors = [];

export function collectCatalogText(source, catalogueName, fields) {
    const file = ts.createSourceFile('catalogue.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (file.parseDiagnostics.length) throw new Error('Catalogue source has invalid JavaScript syntax.');
    const declarations = [];
    function findDeclaration(node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === catalogueName) declarations.push(node);
        ts.forEachChild(node, findDeclaration);
    }
    findDeclaration(file);
    if (declarations.length !== 1) throw new Error(`Expected one ${catalogueName} catalogue declaration.`);
    const literal = declarations[0].initializer;
    if (!literal || (!ts.isArrayLiteralExpression(literal) && !ts.isObjectLiteralExpression(literal))) throw new Error(`${catalogueName} must be a static array or object literal.`);
    const selected = new Set(fields);
    const values = new Set();
    function collect(node) {
        if (ts.isSpreadAssignment(node) || ts.isSpreadElement(node)) throw new Error(`${catalogueName} contains a dynamic spread that cannot be reviewed statically.`);
        if (ts.isPropertyAssignment(node)) {
            const propertyName = ts.isComputedPropertyName(node.name) ? node.name.expression : node.name;
            if (ts.isComputedPropertyName(node.name) && !ts.isStringLiteral(propertyName)) throw new Error(`${catalogueName} contains a dynamic property name that cannot be reviewed statically.`);
            const name = ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName) ? propertyName.text : null;
            if (selected.has(name)) {
                if (!ts.isStringLiteral(node.initializer) && !ts.isNoSubstitutionTemplateLiteral(node.initializer)) throw new Error(`${catalogueName}: ${name} must be a static string literal.`);
                values.add(node.initializer.text);
            }
        } else if (ts.isShorthandPropertyAssignment(node) && selected.has(node.name.text)) {
            throw new Error(`${catalogueName}: ${node.name.text} must be a static string literal.`);
        }
        ts.forEachChild(node, collect);
    }
    collect(literal);
    return values;
}

function extractLiteralFields(relativeFile, catalogueName, fields) {
    try { return collectCatalogText(read(relativeFile), catalogueName, fields); }
    catch (error) { errors.push(`${relativeFile}: ${error.message}`); return new Set(); }
}

function captureReviewed(relativeFile) {
    const keys = new Set();
    const catalogue = new Proxy({}, {
        set(target, key, value) {
            keys.add(String(key));
            target[key] = value;
            return true;
        }
    });
    vm.runInNewContext(read(relativeFile), {
        window: { NamelessTranslations: { en: catalogue } }
    });
    return { keys, catalogue };
}

function runAudit() {
const bestiaryValues = extractLiteralFields('js/bestiaire.js', 'creaturesData', ['name', 'type', 'description', 'location']);
const itemValues = extractLiteralFields('js/items-catalog-hdv.js', 'itemsCatalog', ['name']);
const gameValues = new Set([...bestiaryValues, ...itemValues]);
const { keys: reviewedKeys, catalogue } = captureReviewed('js/i18n-game-en-reviewed.js');

const knownBadEnglish = /Contact details|\bSpices\b|Bouleau log|Scratch Scratch|Spider Poisoned|Shaman Witch's Stick|Brindille Enchanted|\bElementary\b|Magic Wood Splash|\bDumpback\b|\bCrain\b|Chair Putride|\bSlim Warrior\b|\bReal Elite\b|\bMini Real\b|Frozen pick|Copper dust|Giant culvert|From Spider|Spider wire|Oceanic base|Forget Fortress|Abbreviated axe|Metal Soul Lingot|enchanted metal linget|Requin Fish|\bDevoring\b/i;
const frenchResidue = /\b(Araign(?:ée|ées)|Bouleau|Cerf|Chêne|Crocs|Déchu|Déchus|Donjon|Écorce|Fêlée|Fourrure|Marais|Palier|Peaux?|Poussière|Sanglier|Sylvestre|Tissu|Tréant)\b/i;

for (const source of gameValues) {
    if (!reviewedKeys.has(source)) {
        errors.push(`Unreviewed game value: ${JSON.stringify(source)}`);
        continue;
    }
    const translated = catalogue[source];
    if (typeof translated !== 'string' || !translated.trim()) {
        errors.push(`Missing English translation: ${JSON.stringify(source)}`);
        continue;
    }
    if (knownBadEnglish.test(translated)) {
        errors.push(`Known-bad English: ${JSON.stringify(source)} -> ${JSON.stringify(translated)}`);
    }
    if (source !== translated && frenchResidue.test(translated)) {
        errors.push(`French residue: ${JSON.stringify(source)} -> ${JSON.stringify(translated)}`);
    }
}

if (errors.length) {
    console.error(`Game-content i18n audit failed (${errors.length} issue${errors.length > 1 ? 's' : ''}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
} else {
    console.log(`Game-content i18n audit passed: ${bestiaryValues.size} Bestiary values and ${itemValues.size} Item values explicitly reviewed (${gameValues.size} unique).`);
}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runAudit();
