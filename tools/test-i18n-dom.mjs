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
    'js/i18n-information-en-reviewed.js',
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

const secondaryQuestHeading = window.document.querySelector('.quest-section h2');
assertEqual(secondaryQuestHeading.textContent.trim(), 'Side Quests — Floor 1', 'Static secondary archive heading');

const popup = window.document.createElement('div');
popup.innerHTML = `
    <div class="quest-popup">
        <strong><span aria-hidden="true"></span><span>Milla</span></strong>
        <p><strong>Position:</strong> X:638, Z:-267</p>
        <p>Obtenir 4 Plumes Enflammées, 4 Plumes Ondoyantes, 4 Plumes Terreuses</p>
        <p>Collectez les différentes plumes élémentaires pour Ifa</p>
    </div>`;
window.document.body.appendChild(popup);
await waitForMutations();

assertEqual(popup.querySelector('strong span:last-child').textContent, 'Milla', 'Dynamic popup NPC proper name');
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

const itemCategories = [['Armes', 'Weapons'], ['Accessoires', 'Accessories'], ['Consommables', 'Consumables']];
const categoryLabels = window.document.createElement('div');
itemCategories.forEach(([french]) => { const label = window.document.createElement('span'); label.textContent = french; categoryLabels.appendChild(label); });
window.document.body.appendChild(categoryLabels);
await waitForMutations();
itemCategories.forEach(([, english], index) => assertEqual(categoryLabels.children[index].textContent, english, 'Dynamic item category EN'));

const liveStatus = window.document.createElement('span');
liveStatus.textContent = 'Exploration';
window.document.body.appendChild(liveStatus);
await waitForMutations();
liveStatus.firstChild.nodeValue = 'Terre Inconnue';
await waitForMutations();
assertEqual(liveStatus.textContent, 'Unknown Land', 'Dynamic text-node update');

window.NamelessI18n.setLanguage('fr');
await waitForMutations();
assertEqual(popup.querySelector('strong span:last-child').textContent, 'Milla', 'English to French proper-name switch');
assertEqual(liveStatus.textContent, 'Terre Inconnue', 'English to French dynamic switch');
itemCategories.forEach(([french], index) => assertEqual(categoryLabels.children[index].textContent, french, 'Dynamic item category FR'));

window.NamelessI18n.setLanguage('en');
await waitForMutations();
assertEqual(popup.querySelector('strong span:last-child').textContent, 'Milla', 'French to English proper-name switch');
assertEqual(liveStatus.textContent, 'Unknown Land', 'French to English dynamic switch');
itemCategories.forEach(([, english], index) => assertEqual(categoryLabels.children[index].textContent, english, 'Dynamic item category EN round trip'));

const entryPages = [
    'index.html', '404.html', 'pages/admin-dashboard.html', 'pages/bestiaire.html',
    'pages/connexion.html', 'pages/espace-guilde.html', 'pages/items.html',
    'pages/map.html', 'pages/profil.html', 'pages/quetes.html', 'pages/wiki.html',
    'pages/confidentialite.html', 'pages/conditions.html'
];
const frenchResidue = /\b(accueil|aucun|aucune|araignée|araignées|bientôt|bouleau|cerf|chêne|coordonnées|déconnexion|donjon|donjons|étape|guilde|joueur|lieu|marchand|métier|métiers|palier|paliers|parler|peaux|plumes|quête|quêtes|recherche|ressources|retournez|sanglier|tuer|vaincre|ville|votre|vous)\b/i;
const knownBadEnglish = /Master Epistle|Contact details|\bDonjon\b|\bPalier\b|\bPlums?\b|\bSpices\b|\bArteon\b|\bVirlon\b|Scale \d selected|Frossed|Corrected Plums|Skin Thickness|Bouleau log|Scratch Scratch|Spider Poisoned|\bElementary\b|Copper dust|Giant culvert|From Spider|\bWin \d/i;
const referenceLabels = {
    'pages/bestiaire.html': [
        ['label[for="bes-search"]', null, 'Rechercher une créature', 'Find a creature'],
        ['[data-catalog-view="grid"]', 'aria-label', 'Vue grille', 'Grid view'],
        ['.catalogue-detail-slot', 'aria-label', 'Fiche de la créature', 'Creature details']
    ],
    'pages/items.html': [
        ['.catalogue-detail-slot', 'aria-label', 'Fiche de l’objet', 'Item details'],
        ['#it-source option[value="known"]', null, 'Butins du bestiaire', 'Bestiary drops'],
        ['#it-source', 'aria-label', 'Filtrer par source', 'Filter by source']
    ],
    'pages/map.html': [
        ['#map-legend-title', null, 'Légende de la carte', 'Map legend'],
        ['#map-legend-close', 'aria-label', 'Fermer la légende', 'Close legend'],
        ['#map-admin-entry', null, 'Administrer la carte', 'Manage map']
    ]
};

// Administrator publication labels use mixed native labels/selects. Language
// switching must translate their text without rebuilding or resetting controls.
{
    const adminDom = new JSDOM(read('pages/admin-carte.html'), {url:'https://nameless-sao.fr/admin-carte',runScripts:'outside-only'});
    const adminWindow=adminDom.window,doc=adminWindow.document;
    adminWindow.localStorage.setItem('nameless-language','fr');
    for(const script of ['js/i18n-en.js','js/i18n-en-reviewed.js','js/i18n.js'])adminWindow.eval(read(script));
    doc.dispatchEvent(new adminWindow.Event('DOMContentLoaded'));await waitForMutations();
    adminWindow.NamelessSpaRouter={controlsLifecycle:true};adminWindow.NamelessMapPage={destroy(){}};adminWindow.NamelessMapRegions={active:null};
    adminWindow.eval(read('js/map-workspace.js'));await adminWindow.NamelessMapWorkspace.init(doc);
    const panel=doc.getElementById('workspace-region-publication');
    const sourceName=doc.createElement('span');sourceName.textContent='Zone Sanglier';doc.getElementById('map-region-list').appendChild(sourceName);
    const select=doc.getElementById('workspace-region-status'),checkbox=doc.getElementById('workspace-region-visible'),publish=doc.getElementById('workspace-region-publish'),reset=doc.getElementById('workspace-region-reset');
    const options=[...select.options];select.value='verified';checkbox.checked=false;publish.disabled=true;
    const labels=[
        [()=>select.labels[0].firstChild.nodeValue.trim(),'Fiabilité des limites','Boundary confidence'],
        [()=>options[0].textContent,'Indicatives · à valider en jeu','Indicative · check in game'],
        [()=>options[1].textContent,'Vérifiées par l’administration','Verified by administrators'],
        [()=>options[2].textContent,'Brouillon partagé · invisible au public','Shared draft · hidden from visitors'],
        [()=>checkbox.labels[0].textContent.trim(),'Afficher la zone sur la carte publique','Show this zone on the public map'],
        [()=>panel.querySelector('h3').textContent,'02 Publier la zone','02 Publish zone'],
        [()=>publish.textContent,'Publier la zone ↗','Publish zone ↗'],
        [()=>panel.querySelector('summary').textContent,'Restaurer la version d’origine','Restore the original version'],
        [()=>panel.querySelector('.workspace-advanced p').textContent,'Retire la modification publiée et rétablit les limites proposées par le site.',"Remove the published change and restore the site's proposed boundaries."],
        [()=>reset.textContent,'Restaurer les limites d’origine','Restore original boundaries']
    ];
    for(const language of ['fr','en','fr']) {
        adminWindow.NamelessI18n.setLanguage(language);await waitForMutations();
        for(const [get,french,english] of labels)assertEqual(get(),language==='fr'?french:english,'Admin region publication '+language+' label');
        for(const element of [select,checkbox,publish,reset])assertEqual(doc.getElementById(element.id),element,'Admin publication control identity '+element.id+' '+language);
        options.forEach((option,index)=>assertEqual(select.options[index],option,'Admin region option identity '+index+' '+language));
        assertEqual(select.value,'verified','Admin region confidence selection preserved '+language);
        assertEqual([...select.options].map(option=>option.value).join(','),'indicative,verified,draft','Admin region option values preserved '+language);
        assertEqual(checkbox.checked,false,'Admin region visibility draft preserved '+language);
        assertEqual(publish.disabled,true,'Admin publication permission state preserved '+language);
        assertEqual(sourceName.textContent,'Zone Sanglier','Admin source zone name preserved '+language);
        assertEqual(doc.getElementById('main-content').hasAttribute('data-i18n-ignore'),true,'Admin source-data translation guard preserved '+language);
    }
    adminWindow.NamelessMapWorkspace.destroy();
}

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
        'js/i18n-game-en-reviewed.js',
        'js/i18n-information-en-reviewed.js'
    ];
    // Headquarters keeps its reviewed copy beside the optional expedition module.
    // The actual entry page loads this module before DOMContentLoaded/i18n boot.
    if (page === 'pages/espace-guilde.html') scripts.push('js/guild-expeditions.js');
    // Character-sheet labels are explicit FR/EN pairs owned by the profile module.
    if (page === 'pages/profil.html') scripts.push('js/profil.js');
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
    const labels = referenceLabels[page] || [];
    for (const language of ['en', 'fr', 'en']) {
        if (!labels.length) break;
        pageWindow.NamelessI18n.setLanguage(language);
        await waitForMutations();
        for (const [selector, attribute, french, english] of labels) {
            const element = pageWindow.document.querySelector(selector);
            assertEqual(attribute ? element.getAttribute(attribute) : element.textContent, language === 'fr' ? french : english, `${page} ${selector} ${language} reference label`);
        }
    }
    pageWindow.NamelessProfilePage?.destroy();
}

console.log(`DOM i18n test passed: dynamic popups, coordinates, administrator publication controls, FR/EN/FR switching and ${entryPages.length} English entry pages.`);
