#!/usr/bin/env node
/* Strict coverage and terminology audit for dynamic Bestiary/Items data. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const errors = [];

function extractLiteralFields(relativeFile, fields) {
    const source = read(relativeFile);
    const values = new Set();
    for (const field of fields) {
        const expression = new RegExp(`\\b${field}\\s*:\\s*(['"])((?:\\\\.|(?!\\1).)*)\\1`, 'g');
        let match;
        while ((match = expression.exec(source))) {
            try {
                values.add(vm.runInNewContext(match[1] + match[2] + match[1]));
            } catch {
                errors.push(`${relativeFile}: unreadable ${field} literal at offset ${match.index}.`);
            }
        }
    }
    return values;
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

const bestiaryValues = extractLiteralFields('js/bestiaire.js', ['name', 'type', 'description', 'location']);
const itemValues = extractLiteralFields('js/items-catalog-hdv.js', ['name']);
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
