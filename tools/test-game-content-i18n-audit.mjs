import assert from 'node:assert/strict';
import {collectCatalogText} from './audit-game-content-i18n.mjs';

const source = `
const creaturesData = [{name: 'Gorbel', location: 'Bois Sacré', description: 'Vraie valeur non revue', type: 'Créature', drops: [{name: 'Gelée de Slime'}]}];
const ui = {name: 'Nom du contrôle', location: 'Emplacement de l’interface'};
const link = 'location:' + creature.palier + ':';
// location: 'Commentaire exclu'
`;
const values = collectCatalogText(source, 'creaturesData', ['name', 'location', 'description', 'type']);
assert.deepEqual([...values], ['Gorbel', 'Bois Sacré', 'Vraie valeur non revue', 'Créature', 'Gelée de Slime']);
assert.ok(values.has('Vraie valeur non revue'), 'Actual unreviewed game text remains subject to reviewed-catalogue coverage');
assert.ok(!values.has(' + creature.palier + '), 'A colon inside URL-building code is not a catalogue property');
assert.deepEqual([...collectCatalogText('const itemsCatalog = {weapons: {name: "⚔️ Armes", items: [{name: `Épée`}]}};', 'itemsCatalog', ['name'])], ['⚔️ Armes', 'Épée']);
assert.throws(() => collectCatalogText('const creaturesData = [{name: "Nom " + suffix}];', 'creaturesData', ['name']), /must be a static string literal/);
assert.throws(() => collectCatalogText('const creaturesData = [{name}];', 'creaturesData', ['name']), /must be a static string literal/);
assert.throws(() => collectCatalogText('const creaturesData = [...externalRecords];', 'creaturesData', ['name']), /dynamic spread/);
assert.deepEqual([...collectCatalogText('const creaturesData = [{["name"]: "Vraie valeur calculée statiquement"}];', 'creaturesData', ['name'])], ['Vraie valeur calculée statiquement']);
assert.throws(() => collectCatalogText('const creaturesData = [{[field]: "Texte"}];', 'creaturesData', ['name']), /dynamic property name/);
assert.throws(() => collectCatalogText('const ui = {name: "Nom"};', 'creaturesData', ['name']), /Expected one/);
console.log('Game-content i18n extraction passed: real nested catalogue strings retained, UI/URL/comment false positives excluded, dynamic text and spreads rejected.');
