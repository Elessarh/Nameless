#!/usr/bin/env node
/* DOM regression test for language switching and dynamic Leaflet-like content. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const waitForMutations = () => new Promise((resolve) => setTimeout(resolve, 0));

const dom = new JSDOM(read('pages/quetes.html'), {
    url: 'https://nameless-sao.fr/quetes',
    runScripts: 'outside-only',
    pretendToBeVisual: true
});
const { window } = dom;
window.localStorage.setItem('nameless-language', 'en');

for (const script of [
    'js/i18n-en.js',
    'js/i18n-en-reviewed.js',
    'js/i18n-quests-en-reviewed.js',
    'js/i18n-game-en-reviewed.js',
    'js/i18n.js'
]) {
    window.eval(read(script));
}
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await waitForMutations();

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
}

const mainQuestHeading = window.document.querySelector('.quest-section h2');
assertEqual(mainQuestHeading.textContent.trim(), 'Main Quest — Floor 1', 'Static quest heading');

const popup = window.document.createElement('div');
popup.innerHTML = `
    <div class="quest-popup">
        <strong><span aria-hidden="true"></span><span>Parler au Maître Épéiste</span></strong>
        <p><strong>Position:</strong> X:638, Z:-267</p>
        <p>Obtenir 4 Plumes Enflammées, 4 Plumes Ondoyantes, 4 Plumes Terreuses</p>
        <p>Collectez les différentes plumes élémentaires pour Ifa</p>
    </div>`;
window.document.body.appendChild(popup);
await waitForMutations();

assertEqual(popup.querySelector('strong span:last-child').textContent, 'Talk to the Master Swordsman', 'Dynamic popup quest name');
assertEqual(popup.querySelector('p strong').textContent, 'Location:', 'Dynamic popup label');
assertEqual(popup.querySelectorAll('p')[0].textContent.trim(), 'Location: X:638, Z:-267', 'Negative coordinate preservation');
assertEqual(popup.querySelectorAll('p')[1].textContent, 'Collect 4 Flaming Feathers, 4 Water Feathers and 4 Earth Feathers', 'Dynamic popup objective');
assertEqual(popup.querySelectorAll('p')[2].textContent, 'Collect the different elemental feathers for Ifa', 'Dynamic popup description');

const coordinateWithLocation = window.document.createElement('span');
coordinateWithLocation.textContent = "X:979, Z:1372 (Donjon Araignée)";
window.document.body.appendChild(coordinateWithLocation);
await waitForMutations();
assertEqual(coordinateWithLocation.textContent, 'X:979, Z:1372 (Spider Dungeon)', 'Coordinate location translation');

const gameContent = window.document.createElement('div');
gameContent.innerHTML = '<span>Bûche de Bouleau</span><span>Araignée Étrangleuse</span><span>Élémentaire</span><span>Venin d\'Araignée</span>';
window.document.body.appendChild(gameContent);
await waitForMutations();
assertEqual(gameContent.children[0].textContent, 'Birch Log', 'Birch resource translation');
assertEqual(gameContent.children[1].textContent, 'Strangler Spider', 'Monster-name translation');
assertEqual(gameContent.children[2].textContent, 'Elemental', 'Monster-type translation');
assertEqual(gameContent.children[3].textContent, 'Spider Venom', 'Loot translation');

const liveStatus = window.document.createElement('span');
liveStatus.textContent = 'Exploration';
window.document.body.appendChild(liveStatus);
await waitForMutations();
liveStatus.firstChild.nodeValue = 'Terre Inconnue';
await waitForMutations();
assertEqual(liveStatus.textContent, 'Unknown Land', 'Dynamic text-node update');

window.NamelessI18n.setLanguage('fr');
await waitForMutations();
assertEqual(popup.querySelector('strong span:last-child').textContent, 'Parler au Maître Épéiste', 'English to French popup switch');
assertEqual(liveStatus.textContent, 'Terre Inconnue', 'English to French dynamic switch');

window.NamelessI18n.setLanguage('en');
await waitForMutations();
assertEqual(popup.querySelector('strong span:last-child').textContent, 'Talk to the Master Swordsman', 'French to English popup switch');
assertEqual(liveStatus.textContent, 'Unknown Land', 'French to English dynamic switch');

const entryPages = [
    'index.html', '404.html', 'pages/admin-dashboard.html', 'pages/bestiaire.html',
    'pages/connexion.html', 'pages/espace-guilde.html', 'pages/items.html',
    'pages/map.html', 'pages/profil.html', 'pages/quetes.html', 'pages/wiki.html'
];
const frenchResidue = /\b(accueil|aucun|aucune|araignée|araignées|bientôt|bouleau|cerf|chêne|coordonnées|déconnexion|donjon|donjons|étape|guilde|joueur|lieu|marchand|métier|métiers|palier|paliers|parler|peaux|plumes|quête|quêtes|recherche|ressources|retournez|sanglier|tuer|vaincre|ville|votre|vous)\b/i;
const knownBadEnglish = /Master Epistle|Contact details|\bDonjon\b|\bPalier\b|\bPlums?\b|\bSpices\b|\bArteon\b|\bVirlon\b|Scale \d selected|Frossed|Corrected Plums|Skin Thickness|Bouleau log|Scratch Scratch|Spider Poisoned|\bElementary\b|Copper dust|Giant culvert|From Spider|\bWin \d/i;

for (const page of entryPages) {
    const pageDom = new JSDOM(read(page), {
        url: `https://nameless-sao.fr/${page}`,
        runScripts: 'outside-only'
    });
    const pageWindow = pageDom.window;
    pageWindow.localStorage.setItem('nameless-language', 'en');
    const scripts = [
        'js/i18n-en.js',
        'js/i18n-en-reviewed.js',
        'js/i18n-quests-en-reviewed.js',
        'js/i18n-game-en-reviewed.js'
    ];
    scripts.push('js/i18n.js');
    for (const script of scripts) pageWindow.eval(read(script));
    pageWindow.document.dispatchEvent(new pageWindow.Event('DOMContentLoaded'));
    await waitForMutations();

    const renderedText = pageWindow.document.body.textContent.replace(/\s+/g, ' ').trim();
    const residue = renderedText.match(frenchResidue);
    if (residue) {
        const start = Math.max(0, residue.index - 90);
        const excerpt = renderedText.slice(start, residue.index + residue[0].length + 90);
        throw new Error(`${page}: French residue detected in English DOM: ${JSON.stringify(excerpt)}`);
    }
    const badEnglish = renderedText.match(knownBadEnglish);
    if (badEnglish) throw new Error(`${page}: known bad English detected in DOM: ${JSON.stringify(badEnglish[0])}`);
}

console.log(`DOM i18n test passed: dynamic popups, coordinates, FR/EN/FR switching and ${entryPages.length} English entry pages.`);
