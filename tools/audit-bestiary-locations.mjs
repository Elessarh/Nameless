#!/usr/bin/env node
/* Canonical-zone audit: unknown future locations must remain "???". */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/bestiaire.js'), 'utf8');
const start = source.indexOf('const creaturesData = [');
const end = source.indexOf("// État de l'application", start);
const context = {};
const errors = [];

if (start < 0 || end < 0) throw new Error('Unable to isolate Bestiary data.');
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nthis.creatures = creaturesData;`, context);

const creatures = context.creatures;
const expectedZones = new Map([
    ...['Soul Knight', 'Narax', 'Squelette', 'Archer Squelette', 'Épéiste Squelette',
        'Guerrier Squelette', 'Hallebardier Squelette', 'Tank Squelette', 'Sorcier Squelette']
        .map((name) => [name, 'Ruines Maudites']),
    ...['Ornstein', 'Smoug', 'Soldat Déchu', 'Gardien Déchu', 'Guerrier Déchu',
        'Héraut Déchu', 'Faucheuse Déchu']
        .map((name) => [name, 'Donjon Labyrinthe']),
    ...['Araignée Chasseuse', 'Araignée Empoisonnée', 'Araignée Étrangleuse', 'Jira',
        'Kamilia', 'Priscilia', 'Yula', 'Octana']
        .map((name) => [name, "Donjon de Xal'Zirith"]),
    ...['Kobold', 'Archer Kobold', 'Guerrier Kobold', 'Hallebardier Kobold',
        'Mineur Kobold', 'Soldat Kobold', 'Sorcier Kobold', 'Illfang']
        .map((name) => [name, 'Donjon Kobold'])
]);

const approvedZones = new Set([
    '???', 'Archipel Ika', 'Bois Sacré', 'Champ de Mizunari', 'Citadelle de glace',
    "Donjon de Xal'Zirith", 'Donjon Geldorak', 'Donjon Kobold', 'Donjon Labyrinthe',
    'Forêt Enchantée', 'Marais Toxique', 'Marécage putride', 'Montagne des bandits',
    'Ruines Maudites', 'Tolbana', 'Vallée des loups', 'Virelune', 'Zone des Sangliers'
]);

for (const creature of creatures) {
    if (!approvedZones.has(creature.location)) {
        errors.push(`${creature.name}: unapproved location ${JSON.stringify(creature.location)}; use "???" until confirmed.`);
    }
    if (expectedZones.has(creature.name) && creature.location !== expectedZones.get(creature.name)) {
        errors.push(`${creature.name}: expected ${JSON.stringify(expectedZones.get(creature.name))}, received ${JSON.stringify(creature.location)}.`);
    }
}

for (const name of expectedZones.keys()) {
    if (!creatures.some((creature) => creature.name === name)) errors.push(`Expected creature missing: ${name}.`);
}

if (errors.length) {
    console.error(`Bestiary-location audit failed (${errors.length} issue${errors.length > 1 ? 's' : ''}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
} else {
    console.log(`Bestiary-location audit passed: ${creatures.length} creatures, ${expectedZones.size} requested assignments and ${approvedZones.size - 1} approved named zones.`);
}
